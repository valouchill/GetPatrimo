/**
 * Cron mensuel — Génération des paiements + relances impayés
 *
 * Exécution recommandée :
 * - Le 1er du mois à 6h : génération des lignes PENDING
 * - Les 5, 10, 15 du mois à 9h : relances email
 *
 * Usage standalone : node src/cron/monthlyPayments.js [generate|remind]
 */

const { connectDB } = require('../config/db');
const { logger } = require('../../lib/logger');

async function generateAllMonthlyPayments() {
  await connectDB();

  const Lease = require('../../models/Lease');
  const Payment = require('../../models/Payment');

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  logger.info('Cron: génération des paiements mensuels', { month, year });

  // Trouver tous les baux actifs
  const leases = await Lease.find({
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
  }).populate('property').lean();

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const lease of leases) {
    try {
      // Vérifier si paiement existe déjà
      const existing = await Payment.findOne({
        lease: lease._id,
        'period.month': month,
        'period.year': year,
      });

      if (existing) {
        skipped++;
        continue;
      }

      const property = lease.property;
      if (!property) {
        errors.push(`Bail ${lease._id}: bien introuvable`);
        continue;
      }

      const totalDays = new Date(year, month, 0).getDate();
      const leaseStart = new Date(lease.startDate);
      const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month - 1, totalDays);

      let isProrata = false;
      let occupiedStart = monthStart;
      let occupiedEnd = monthEnd;

      if (leaseStart > monthStart && leaseStart <= monthEnd) {
        occupiedStart = leaseStart;
        isProrata = true;
      }
      if (leaseEnd && leaseEnd >= monthStart && leaseEnd < monthEnd) {
        occupiedEnd = leaseEnd;
        isProrata = true;
      }

      const daysOccupied = isProrata
        ? Math.max(0, Math.ceil((occupiedEnd - occupiedStart) / (1000 * 60 * 60 * 24)) + 1)
        : totalDays;
      const ratio = Math.round((daysOccupied / totalDays) * 10000) / 10000;

      const rentHC = isProrata
        ? Math.round(lease.rentAmount * ratio * 100) / 100
        : lease.rentAmount;
      const charges = isProrata
        ? Math.round((lease.chargesAmount || 0) * ratio * 100) / 100
        : (lease.chargesAmount || 0);
      const totalTTC = Math.round((rentHC + charges) * 100) / 100;

      await Payment.create({
        lease: lease._id,
        tenant: lease.tenantId || lease.tenant,
        owner: property.user,
        property: property._id,
        period: { month, year },
        amounts: { rentHC, charges, totalTTC, paidAmount: 0 },
        prorata: isProrata ? {
          isProrata: true,
          startDate: occupiedStart,
          endDate: occupiedEnd,
          daysInMonth: totalDays,
          daysOccupied,
          ratio,
        } : { isProrata: false, daysInMonth: totalDays, daysOccupied: totalDays, ratio: 1 },
        status: 'PENDING',
      });

      created++;
    } catch (err) {
      errors.push(`Bail ${lease._id}: ${err?.message || err}`);
    }
  }

  const report = { created, skipped, errors: errors.length, total: leases.length };
  logger.info('Cron: génération terminée', report);
  return report;
}

/**
 * Relances automatiques des loyers impayés.
 *
 * Politique UNIQUE, alignée sur POST /api/payments/remind (lib/templates/rent-reminders.ts) :
 *   J+5 friendly · J+15 formal · J+30 formal_notice (mise en demeure) · J+45 critical_alert (bailleur)
 *
 * Correctifs (le cron divergeait et cassait l'escalade) :
 *  - il poussait `type:'EMAIL'` → determineReminderLevel() ne reconnaissait
 *    jamais les niveaux déjà envoyés et restait bloqué sur `friendly` ;
 *  - ses seuils (5/10/15) différaient de ceux de l'API (5/15/30/45) ;
 *  - il ignorait User.emailPreferences.reminders (RGPD art. 21) ;
 *  - le statut UNPAID n'était jamais posé.
 */
async function sendLateReminders() {
  await connectDB();

  const Payment = require('../../models/Payment');
  const { sendEmail, isEmailConfigured } = require('../services/emailService');
  const { fillReminderTemplate } = require('../templates/rentReminders');

  if (!isEmailConfigured()) {
    logger.warn('Cron: email non configuré, relances ignorées');
    return { sent: 0 };
  }

  const now = new Date();
  const baseUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://maisonpatrimo.com').replace(/\/$/, '');

  function determineReminderLevel(daysLate, alreadySent) {
    if (daysLate >= 45 && !alreadySent.includes('critical_alert')) return 'critical_alert';
    if (daysLate >= 30 && !alreadySent.includes('formal_notice')) return 'formal_notice';
    if (daysLate >= 15 && !alreadySent.includes('formal')) return 'formal';
    if (daysLate >= 5 && !alreadySent.includes('friendly')) return 'friendly';
    return null;
  }

  const pendingPayments = await Payment.find({ status: { $in: ['PENDING', 'LATE', 'PARTIAL'] } })
    .populate('tenant', 'email firstName lastName emailPreferences')
    .populate('owner', 'email firstName lastName')
    .populate('property', 'address name')
    .lean();

  let sent = 0;

  for (const payment of pendingPayments) {
    const daysLate = Math.floor((now - new Date(payment.createdAt)) / (1000 * 60 * 60 * 24));
    const alreadySent = (payment.remindersSent || []).map((r) => r.type);
    const level = determineReminderLevel(daysLate, alreadySent);
    if (!level) continue;

    // critical_alert : destinataire = le BAILLEUR (alerte, pas relance locataire).
    const toOwner = level === 'critical_alert';
    const recipientUser = toOwner ? payment.owner : payment.tenant;
    const recipient = recipientUser?.email;
    if (!recipient) continue;

    // RGPD art. 21 : opposition aux emails de relance (locataire uniquement).
    if (!toOwner && recipientUser?.emailPreferences?.reminders === false) continue;

    try {
      const months = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const filled = fillReminderTemplate(level, {
        prenom: payment.tenant?.firstName || 'Locataire',
        nom: payment.tenant?.lastName || '',
        adresse: payment.property?.address || payment.property?.name || 'votre logement',
        mois: `${months[payment.period?.month] || ''} ${payment.period?.year || ''}`.trim(),
        // Paiement partiel : on réclame le SOLDE, jamais le total déjà
        // partiellement réglé (une mise en demeure pour 1000 € alors que 950 €
        // ont été payés est juridiquement fausse et commercialement violente).
        montant: `${Math.max(0, Number(payment.amounts?.totalTTC || 0) - Number(payment.amounts?.paidAmount || 0)).toLocaleString('fr-FR')} €`,
        jours_retard: String(daysLate),
        date_rappel: new Date(payment.remindersSent?.[0]?.date || payment.createdAt).toLocaleDateString('fr-FR'),
      });

      await sendEmail({
        to: recipient,
        subject: filled.subject,
        text: `${filled.body}\n\n---\nSe désinscrire : ${baseUrl}/api/user/unsubscribe?category=reminders`,
      });

      await Payment.findByIdAndUpdate(payment._id, {
        $push: { remindersSent: { date: now, type: level } },
        // UNPAID au-delà de 45 j : l'état n'était jamais écrit nulle part.
        // On NE dégrade PAS un paiement partiel : écraser PARTIAL en LATE/UNPAID
        // perdait l'information « il a déjà payé une partie » et le renvoyait en
        // boucle dans les relances ET dans les propositions de rapprochement.
        $set: {
          status: payment.status === 'PARTIAL'
            ? 'PARTIAL'
            : daysLate >= 45 ? 'UNPAID' : daysLate >= 15 ? 'LATE' : payment.status,
        },
      });

      sent++;
    } catch (err) {
      logger.error('Cron: erreur envoi relance', { paymentId: payment._id, error: err?.message });
    }
  }

  logger.info('Cron: relances envoyées', { sent });
  return { sent };
}

// Exécution CLI
if (require.main === module) {
  const action = process.argv[2] || 'generate';
  const fn = action === 'remind' ? sendLateReminders : generateAllMonthlyPayments;
  fn()
    .then((r) => { console.log(JSON.stringify(r)); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { generateAllMonthlyPayments, sendLateReminders };
