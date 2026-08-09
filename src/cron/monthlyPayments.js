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

  const {
    billableLeaseFilter,
    createMonthlyPaymentForLease,
  } = require('../services/rentGenerationService');

  // Seuls les baux SIGNÉS et en cours sont facturés (cf. BILLABLE_LEASE_STATUSES) :
  // un bail en brouillon ou non signé générait des loyers, donc des relances, et
  // jusqu'à une mise en demeure à J+30 sur un contrat inexistant.
  const leases = await Lease.find(billableLeaseFilter(now)).populate('property', '_id user').lean();

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const lease of leases) {
    try {
      const r = await createMonthlyPaymentForLease(lease, { month, year });
      created += r.created;
      skipped += r.skipped;
      errors.push(...r.errors);
    } catch (err) {
      errors.push(`Bail ${lease._id}: ${err?.message || err}`);
    }
  }

  // Remontée d'erreur EXPLICITE : ces rapports étaient loggés en `info`, donc
  // invisibles dans Sentry — c'est ce qui a permis à la génération d'être
  // totalement inopérante sans que personne ne le voie.
  if (errors.length > 0) {
    logger.error('Cron: génération des loyers — erreurs', {
      month, year, created, skipped, errorCount: errors.length, errors: errors.slice(0, 20),
    });
  }
  logger.info('Cron: paiements générés', { created, skipped, errors: errors.length, leases: leases.length });
  return { created, skipped, errors, leasesConsidered: leases.length };
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
