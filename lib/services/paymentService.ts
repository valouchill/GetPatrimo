/**
 * Service de gestion des paiements locatifs
 *
 * Gère : génération mensuelle, prorata, révision IRL,
 * régularisation charges, confirmation, quittances PDF, relances.
 */
import { connectDiditDb } from '@/app/api/didit/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Payment = require('@/models/Payment');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

// ─── Helpers ────────────────────────────────────────────────────

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function formatPeriod(month: number, year: number): string {
  const months = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${months[month]} ${year}`;
}

// ─── 1. Génération mensuelle ────────────────────────────────────

export interface GenerateResult {
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Génère les paiements du mois en cours pour un bail actif.
 */
export async function generateMonthlyPayments(leaseId: string): Promise<GenerateResult> {
  await connectDiditDb();
  const result: GenerateResult = { created: 0, skipped: 0, errors: [] };

  const lease = await Lease.findById(leaseId)
    .populate('property')
    .lean();

  if (!lease) {
    result.errors.push('Bail introuvable');
    return result;
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Vérifier si le paiement existe déjà
  const existing = await Payment.findOne({
    lease: leaseId,
    'period.month': month,
    'period.year': year,
  });

  if (existing) {
    result.skipped = 1;
    return result;
  }

  const startDate = new Date(lease.startDate);
  const endDate = lease.endDate ? new Date(lease.endDate) : null;

  // Calcul prorata si entrée/sortie en cours de mois
  const prorata = calculateProrata(lease, month, year);

  const rentHC = prorata.isProrata
    ? Math.round(lease.rentAmount * prorata.ratio * 100) / 100
    : lease.rentAmount;
  const charges = prorata.isProrata
    ? Math.round((lease.chargesAmount || 0) * prorata.ratio * 100) / 100
    : (lease.chargesAmount || 0);
  const totalTTC = Math.round((rentHC + charges) * 100) / 100;

  // Déterminer le propriétaire
  const property = lease.property;
  const ownerId = property?.user || lease.user;

  await Payment.create({
    lease: leaseId,
    tenant: lease.tenantId || lease.tenant,
    owner: ownerId,
    property: property?._id || lease.property,
    period: { month, year },
    amounts: { rentHC, charges, totalTTC, paidAmount: 0 },
    prorata,
    status: 'PENDING',
  });

  result.created = 1;
  return result;
}

// ─── 2. Calcul prorata ──────────────────────────────────────────

export interface ProrataResult {
  isProrata: boolean;
  startDate?: Date;
  endDate?: Date;
  daysInMonth: number;
  daysOccupied: number;
  ratio: number;
}

/**
 * Calcule le prorata pour entrée/sortie en cours de mois.
 * Ratio = jours occupés / jours dans le mois.
 */
export function calculateProrata(
  lease: { startDate: string | Date; endDate?: string | Date | null },
  month: number,
  year: number
): ProrataResult {
  const totalDays = daysInMonth(month, year);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, totalDays);

  const leaseStart = new Date(lease.startDate);
  const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;

  let occupiedStart = monthStart;
  let occupiedEnd = monthEnd;
  let isProrata = false;

  // Entrée en cours de mois
  if (leaseStart > monthStart && leaseStart <= monthEnd) {
    occupiedStart = leaseStart;
    isProrata = true;
  }

  // Sortie en cours de mois
  if (leaseEnd && leaseEnd >= monthStart && leaseEnd < monthEnd) {
    occupiedEnd = leaseEnd;
    isProrata = true;
  }

  const daysOccupied = isProrata
    ? Math.max(0, Math.ceil((occupiedEnd.getTime() - occupiedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : totalDays;
  const ratio = Math.round((daysOccupied / totalDays) * 10000) / 10000;

  return {
    isProrata,
    startDate: isProrata ? occupiedStart : undefined,
    endDate: isProrata ? occupiedEnd : undefined,
    daysInMonth: totalDays,
    daysOccupied,
    ratio,
  };
}

// ─── 3. Révision IRL ────────────────────────────────────────────

export interface IRLRevisionResult {
  applied: boolean;
  previousRent: number;
  newRent: number;
  irlIndex: number;
  irlDate: Date;
}

/**
 * Applique la révision annuelle IRL.
 * Formule : nouveau_loyer = ancien_loyer × (nouvel_IRL / ancien_IRL)
 */
export async function applyIRLRevision(
  leaseId: string,
  newIRLIndex: number,
  oldIRLIndex: number
): Promise<IRLRevisionResult> {
  await connectDiditDb();
  const lease = await Lease.findById(leaseId);
  if (!lease) throw new Error('Bail introuvable');

  const previousRent = lease.rentAmount;
  const newRent = Math.round((previousRent * (newIRLIndex / oldIRLIndex)) * 100) / 100;

  lease.rentAmount = newRent;
  await lease.save();

  return {
    applied: true,
    previousRent,
    newRent,
    irlIndex: newIRLIndex,
    irlDate: new Date(),
  };
}

// ─── 4. Régularisation des charges ──────────────────────────────

export interface RegularizationResult {
  applied: boolean;
  realCharges: number;
  provisionCharges: number;
  adjustment: number; // positif = remboursement locataire, négatif = complément à payer
}

/**
 * Calcule la régularisation annuelle des charges.
 * adjustment = provisions versées - charges réelles
 */
export async function calculateRegularization(
  leaseId: string,
  realCharges: number,
  year: number
): Promise<RegularizationResult> {
  await connectDiditDb();

  // Somme des provisions versées sur l'année
  const payments = await Payment.find({
    lease: leaseId,
    'period.year': year,
    status: { $in: ['CONFIRMED', 'PARTIAL'] },
  }).lean();

  const provisionCharges = payments.reduce(
    (sum: number, p: { amounts: { charges: number } }) => sum + (p.amounts?.charges || 0),
    0
  );

  const adjustment = Math.round((provisionCharges - realCharges) * 100) / 100;

  return {
    applied: true,
    realCharges,
    provisionCharges,
    adjustment,
  };
}

// ─── 5. Confirmation de paiement ────────────────────────────────

export interface ConfirmResult {
  payment: Record<string, unknown>;
  receiptUrl?: string;
}

/**
 * Confirme un paiement, met à jour le statut, génère la quittance.
 */
export async function confirmPayment(
  paymentId: string,
  ownerId: string,
  paidAmount: number,
  notes?: string
): Promise<ConfirmResult> {
  await connectDiditDb();

  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error('Paiement introuvable');
  if (String(payment.owner) !== ownerId) throw new Error('Non autorisé');

  payment.amounts.paidAmount = paidAmount;
  payment.confirmedAt = new Date();
  payment.confirmedBy = ownerId;
  if (notes) payment.notes = notes;

  if (paidAmount >= payment.amounts.totalTTC) {
    payment.status = 'CONFIRMED';
  } else if (paidAmount > 0) {
    payment.status = 'PARTIAL';
  }

  await payment.save();

  // Génère la quittance PDF si paiement total
  let receiptUrl: string | undefined;
  if (payment.status === 'CONFIRMED') {
    receiptUrl = await generateReceipt(payment);
    payment.receiptUrl = receiptUrl;
    payment.receiptGeneratedAt = new Date();
    await payment.save();
  }

  return { payment: payment.toObject(), receiptUrl };
}

// ─── 6. Génération quittance PDF ────────────────────────────────

/**
 * Génère une quittance de loyer PDF conforme aux mentions obligatoires.
 */
export async function generateReceipt(payment: Record<string, unknown>): Promise<string> {
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const path = require('path');

  const p = typeof payment.toObject === 'function' ? payment.toObject() : payment;

  // Charger les données liées
  const lease = await Lease.findById(p.lease).lean();
  const property = await Property.findById(p.property).lean();
  const owner = await User.findById(p.owner).lean();
  const tenant = await User.findById(p.tenant).lean();

  const period = p.period as { month: number; year: number };
  const amounts = p.amounts as { rentHC: number; charges: number; totalTTC: number; paidAmount: number };
  const prorata = p.prorata as { isProrata: boolean; daysOccupied: number; daysInMonth: number; ratio: number } | undefined;
  const totalDays = daysInMonth(period.month, period.year);
  const periodStart = `01/${String(period.month).padStart(2, '0')}/${period.year}`;
  const periodEnd = `${totalDays}/${String(period.month).padStart(2, '0')}/${period.year}`;

  const ownerName = owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email : 'Propriétaire';
  const tenantName = tenant ? `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || tenant.email : 'Locataire';
  const propertyAddress = (property as { address?: string })?.address || 'Adresse non renseignée';
  const ownerAddress = (owner as { address?: string })?.address || '';

  // Créer le répertoire
  const receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');
  if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

  const fileName = `quittance_${period.year}_${String(period.month).padStart(2, '0')}_${String(p._id)}.pdf`;
  const filePath = path.join(receiptsDir, fileName);

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ─── Titre ───
    doc.fontSize(20).font('Helvetica-Bold').text('QUITTANCE DE LOYER', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(
      `Période : du ${periodStart} au ${periodEnd}`,
      { align: 'center' }
    );
    doc.moveDown(1.5);

    // ─── Bailleur ───
    doc.fontSize(11).font('Helvetica-Bold').text('BAILLEUR');
    doc.font('Helvetica').text(ownerName);
    if (ownerAddress) doc.text(ownerAddress);
    doc.moveDown(1);

    // ─── Locataire ───
    doc.font('Helvetica-Bold').text('LOCATAIRE');
    doc.font('Helvetica').text(tenantName);
    doc.moveDown(1);

    // ─── Bien loué ───
    doc.font('Helvetica-Bold').text('BIEN LOUÉ');
    doc.font('Helvetica').text(propertyAddress);
    doc.moveDown(1.5);

    // ─── Détail ───
    doc.font('Helvetica-Bold').text('DÉTAIL DU PAIEMENT');
    doc.moveDown(0.3);
    doc.font('Helvetica');
    doc.text(`Loyer hors charges : ${amounts.rentHC.toFixed(2)} €`);
    doc.text(`Provision pour charges : ${amounts.charges.toFixed(2)} €`);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text(`Total TTC : ${amounts.totalTTC.toFixed(2)} €`);
    doc.font('Helvetica').text(`Montant reçu : ${amounts.paidAmount.toFixed(2)} €`);

    if (prorata?.isProrata) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Oblique').text(
        `Prorata : ${prorata.daysOccupied} jours sur ${prorata.daysInMonth} (ratio ${(prorata.ratio * 100).toFixed(1)}%)`
      );
    }

    doc.moveDown(1);

    // ─── Date de paiement ───
    const confirmedDate = p.confirmedAt ? new Date(p.confirmedAt as string).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
    doc.font('Helvetica').text(`Date de paiement : ${confirmedDate}`);
    doc.moveDown(1.5);

    // ─── Mention légale ───
    doc.fontSize(9).font('Helvetica-Oblique').text(
      'Cette quittance annule tous les reçus qui auraient pu être établis précédemment pour la même période.',
      { align: 'center' }
    );
    doc.moveDown(2);

    // ─── Signature ───
    doc.fontSize(11).font('Helvetica').text(`Fait à __________, le ${new Date().toLocaleDateString('fr-FR')}`);
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text(`Le bailleur : ${ownerName}`);

    doc.end();

    stream.on('finish', () => resolve(`/uploads/receipts/${fileName}`));
    stream.on('error', reject);
  });
}

// ─── 7. Vérification impayés + relances ─────────────────────────

export interface LatePaymentInfo {
  paymentId: string;
  tenantEmail: string;
  tenantName: string;
  period: string;
  amount: number;
  daysLate: number;
}

/**
 * Identifie les paiements en retard (>5 jours) et retourne la liste.
 */
export async function checkLatePayments(): Promise<LatePaymentInfo[]> {
  await connectDiditDb();

  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  const latePayments = await Payment.find({
    status: 'PENDING',
    createdAt: { $lt: fiveDaysAgo },
  }).populate('tenant', 'email firstName lastName').lean();

  return latePayments.map((p: Record<string, unknown>) => {
    const tenant = p.tenant as { email: string; firstName?: string; lastName?: string } | undefined;
    const period = p.period as { month: number; year: number };
    const amounts = p.amounts as { totalTTC: number };
    const daysLate = Math.floor((now.getTime() - new Date(p.createdAt as string).getTime()) / (1000 * 60 * 60 * 24));
    return {
      paymentId: String(p._id),
      tenantEmail: tenant?.email || '',
      tenantName: `${tenant?.firstName || ''} ${tenant?.lastName || ''}`.trim(),
      period: formatPeriod(period.month, period.year),
      amount: amounts.totalTTC,
      daysLate,
    };
  });
}

// ─── 8. Historique ──────────────────────────────────────────────

export async function getPaymentHistory(
  leaseId: string,
  filters?: { year?: number; status?: string }
): Promise<Record<string, unknown>[]> {
  await connectDiditDb();

  const query: Record<string, unknown> = { lease: leaseId };
  if (filters?.year) query['period.year'] = filters.year;
  if (filters?.status) query.status = filters.status;

  return Payment.find(query)
    .sort({ 'period.year': -1, 'period.month': -1 })
    .lean();
}

// ─── 9. Export ──────────────────────────────────────────────────

export async function exportPayments(
  ownerId: string,
  format: 'csv' | 'pdf'
): Promise<string> {
  await connectDiditDb();

  const payments = await Payment.find({ owner: ownerId })
    .populate('property', 'address')
    .populate('tenant', 'firstName lastName email')
    .sort({ 'period.year': -1, 'period.month': -1 })
    .lean();

  if (format === 'csv') {
    const header = 'Période;Bien;Locataire;Loyer HC;Charges;Total TTC;Payé;Statut';
    const rows = payments.map((p: Record<string, unknown>) => {
      const period = p.period as { month: number; year: number };
      const amounts = p.amounts as { rentHC: number; charges: number; totalTTC: number; paidAmount: number };
      const property = p.property as { address?: string } | undefined;
      const tenant = p.tenant as { firstName?: string; lastName?: string } | undefined;
      return [
        `${String(period.month).padStart(2, '0')}/${period.year}`,
        property?.address || '',
        `${tenant?.firstName || ''} ${tenant?.lastName || ''}`.trim(),
        amounts.rentHC.toFixed(2),
        amounts.charges.toFixed(2),
        amounts.totalTTC.toFixed(2),
        amounts.paidAmount.toFixed(2),
        p.status,
      ].join(';');
    });
    return [header, ...rows].join('\n');
  }

  // PDF — réutiliser PDFKit
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const path = require('path');

  const dir = path.join(process.cwd(), 'uploads', 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const fileName = `export_${ownerId}_${Date.now()}.pdf`;
  const filePath = path.join(dir, fileName);

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(16).font('Helvetica-Bold').text('Historique des paiements', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(9).font('Helvetica');
    for (const p of payments) {
      const period = p.period as { month: number; year: number };
      const amounts = p.amounts as { rentHC: number; charges: number; totalTTC: number; paidAmount: number };
      const property = p.property as { address?: string } | undefined;
      doc.text(
        `${formatPeriod(period.month, period.year)} | ${property?.address || '—'} | ${amounts.totalTTC.toFixed(2)} € | ${p.status}`,
      );
    }

    doc.end();
    stream.on('finish', () => resolve(`/uploads/exports/${fileName}`));
    stream.on('error', reject);
  });
}
