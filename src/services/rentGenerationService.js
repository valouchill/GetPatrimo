/**
 * Génération des lignes de loyer mensuelles — IMPLÉMENTATION CANONIQUE.
 *
 * En CommonJS pour être partagée par le cron Node pur
 * (src/cron/monthlyPayments.js) et par le service TypeScript des routes Next.
 *
 * Historique : deux implémentations parallèles coexistaient. Celle du cron
 * écrivait `tenant: lease.tenantId || lease.tenant` — or le modèle Lease ne
 * possède AUCUN de ces champs (il ne stocke que `tenantEmail`), tandis que
 * `Payment.tenant` est un ObjectId requis. Chaque création levait donc une
 * ValidationError, avalée par le wrapper de cron : la génération automatique
 * mensuelle produisait ZÉRO ligne, en silence, pour tout le portefeuille.
 */

const Payment = require('../../models/Payment');
const Property = require('../../models/Property');
const User = require('../../models/User');

/**
 * Statuts de bail éligibles à la facturation.
 *
 * Un bail en brouillon, en attente de signature ou résilié ne doit JAMAIS
 * générer de loyer : ces lignes alimentaient ensuite les relances automatiques
 * et pouvaient produire une mise en demeure (J+30) pour un contrat non signé.
 */
// EXPIRING = bail en cours arrivant à terme : il doit continuer d'être facturé.
// Exclus : DRAFT, PENDING_SIGNATURE (non signé), EXPIRED, TERMINATED.
const BILLABLE_LEASE_STATUSES = ['ACTIVE', 'EXPIRING'];

/** Filtre Mongo des baux à facturer pour une date donnée. */
function billableLeaseFilter(now) {
  return {
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
    leaseStatus: { $in: BILLABLE_LEASE_STATUSES },
  };
}

/** Calcul du prorata d'occupation sur le mois (entrée/sortie en cours de mois). */
function calculateProrata(lease, month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, daysInMonth);
  const leaseStart = new Date(lease.startDate);
  const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;

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
    ? Math.max(0, Math.ceil((occupiedEnd - occupiedStart) / 86400000) + 1)
    : daysInMonth;
  const ratio = Math.round((daysOccupied / daysInMonth) * 10000) / 10000;

  return isProrata
    ? { isProrata: true, startDate: occupiedStart, endDate: occupiedEnd, daysInMonth, daysOccupied, ratio }
    : { isProrata: false, daysInMonth, daysOccupied, ratio: 1 };
}

/**
 * Crée la ligne de loyer d'un bail pour une période donnée.
 * Idempotent : un doublon (index unique lease+période) est un `skipped`.
 * @returns {Promise<{created:number, skipped:number, errors:string[]}>}
 */
async function createMonthlyPaymentForLease(lease, { month, year }) {
  const result = { created: 0, skipped: 0, errors: [] };
  const leaseId = String(lease._id);

  const existing = await Payment.findOne({
    lease: lease._id,
    'period.month': month,
    'period.year': year,
  }).lean();
  if (existing) {
    result.skipped = 1;
    return result;
  }

  // Le bail ne stocke qu'un EMAIL ; Payment exige un ObjectId User.
  const tenantEmail = lease.tenantEmail;
  if (!tenantEmail) {
    result.errors.push(`Bail ${leaseId} : email locataire manquant`);
    return result;
  }
  const tenantUser = await User.findOne({ email: tenantEmail }).select('_id').lean();
  if (!tenantUser) {
    result.errors.push(
      `Locataire introuvable pour "${tenantEmail}" (bail ${leaseId}) — le locataire doit avoir un compte.`,
    );
    return result;
  }

  // `lease.property` peut déjà être peuplé (populate) ou être un simple id.
  const populated = lease.property && typeof lease.property === 'object' && lease.property._id;
  const property = populated
    ? lease.property
    : await Property.findById(lease.property).select('_id user').lean();
  const ownerId = property?.user || lease.user;
  const propertyId = property?._id || lease.property;
  if (!ownerId || !propertyId) {
    result.errors.push(`Bail ${leaseId} : bien ou propriétaire introuvable`);
    return result;
  }

  const prorata = calculateProrata(lease, month, year);
  const rentHC = prorata.isProrata
    ? Math.round(Number(lease.rentAmount || 0) * prorata.ratio * 100) / 100
    : Number(lease.rentAmount || 0);
  const charges = prorata.isProrata
    ? Math.round(Number(lease.chargesAmount || 0) * prorata.ratio * 100) / 100
    : Number(lease.chargesAmount || 0);
  const totalTTC = Math.round((rentHC + charges) * 100) / 100;

  try {
    await Payment.create({
      lease: lease._id,
      tenant: tenantUser._id,
      owner: ownerId,
      property: propertyId,
      period: { month, year },
      amounts: { rentHC, charges, totalTTC, paidAmount: 0 },
      prorata: prorata.isProrata ? prorata : { isProrata: false },
      status: 'PENDING',
    });
    result.created = 1;
  } catch (err) {
    const msg = err?.message || String(err);
    // Course entre deux exécutions : l'index unique a joué son rôle.
    if (msg.includes('E11000') || msg.includes('duplicate key')) result.skipped = 1;
    else result.errors.push(`Création du loyer impossible (bail ${leaseId}) : ${msg}`);
  }
  return result;
}

module.exports = {
  BILLABLE_LEASE_STATUSES,
  billableLeaseFilter,
  calculateProrata,
  createMonthlyPaymentForLease,
};
