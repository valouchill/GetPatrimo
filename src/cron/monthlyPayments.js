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

async function sendLateReminders() {
  await connectDB();

  const Payment = require('../../models/Payment');
  const { sendEmail, isEmailConfigured } = require('../services/emailService');

  if (!isEmailConfigured()) {
    logger.warn('Cron: email non configuré, relances ignorées');
    return { sent: 0 };
  }

  const now = new Date();
  const thresholds = [5, 10, 15]; // jours de retard

  const pendingPayments = await Payment.find({
    status: 'PENDING',
  }).populate('tenant', 'email firstName lastName').lean();

  let sent = 0;

  for (const payment of pendingPayments) {
    const daysLate = Math.floor((now - new Date(payment.createdAt)) / (1000 * 60 * 60 * 24));

    // Envoyer une relance à J+5, J+10, J+15
    const shouldRemind = thresholds.some(threshold => {
      const alreadySent = (payment.remindersSent || []).some(r =>
        Math.floor((new Date(r.date) - new Date(payment.createdAt)) / (1000 * 60 * 60 * 24)) >= threshold - 1
        && Math.floor((new Date(r.date) - new Date(payment.createdAt)) / (1000 * 60 * 60 * 24)) <= threshold + 1
      );
      return daysLate >= threshold && !alreadySent;
    });

    if (!shouldRemind || !payment.tenant?.email) continue;

    try {
      const tenantName = `${payment.tenant.firstName || ''} ${payment.tenant.lastName || ''}`.trim() || 'Locataire';
      const months = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const periodLabel = `${months[payment.period.month]} ${payment.period.year}`;

      await sendEmail({
        to: payment.tenant.email,
        subject: `Rappel — Loyer ${periodLabel} en attente`,
        text: `Bonjour ${tenantName},\n\nNous vous rappelons que le loyer de ${periodLabel} (${payment.amounts.totalTTC.toFixed(2)} €) n'a pas encore été confirmé.\n\nMerci de procéder au règlement dès que possible.\n\nCordialement,\nPatrimoTrust`,
      });

      await Payment.findByIdAndUpdate(payment._id, {
        $push: { remindersSent: { date: now, type: 'EMAIL' } },
        status: daysLate >= 15 ? 'LATE' : 'PENDING',
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
