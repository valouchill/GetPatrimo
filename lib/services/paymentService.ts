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
 * Génère le paiement du mois en cours pour un bail actif.
 * Ultra-robuste : chaque étape est validée avec des messages d'erreur clairs.
 */
export async function generateMonthlyPayments(leaseId: string): Promise<GenerateResult> {
  await connectDiditDb();
  const result: GenerateResult = { created: 0, skipped: 0, errors: [] };

  // ── 1. Charger le bail ──
  let lease;
  try {
    lease = await Lease.findById(leaseId).lean();
  } catch (err) {
    result.errors.push(`Erreur lecture bail ${leaseId}: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  if (!lease) {
    result.errors.push(`Bail introuvable (id: ${leaseId})`);
    return result;
  }

  // ── 2. Vérifier le statut du bail ──
  // Accepter : ACTIVE, EXPIRING, PENDING_SIGNATURE, ou undefined/null (baux legacy)
  const terminalStatuses = ['EXPIRED', 'TERMINATED', 'DRAFT'];
  if (lease.leaseStatus && terminalStatuses.includes(lease.leaseStatus)) {
    result.errors.push(`Bail ${leaseId} au statut "${lease.leaseStatus}" — génération ignorée`);
    return result;
  }

  // ── 3. Période courante ──
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // ── 4. Vérifier si le paiement existe déjà ──
  try {
    const existing = await Payment.findOne({
      lease: leaseId,
      'period.month': month,
      'period.year': year,
    });
    if (existing) {
      result.skipped = 1;
      return result;
    }
  } catch (err) {
    result.errors.push(`Erreur vérification doublon: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  // ── 5. Charger la propriété ──
  let property;
  try {
    property = await Property.findById(lease.property).lean();
  } catch {
    // On continue sans property enrichie
  }

  // ── 6. Résoudre le locataire ──
  // Le Lease stocke tenantEmail (string) mais le Payment exige un ObjectId → lookup User
  const tenantEmail = lease.tenantEmail;
  if (!tenantEmail) {
    result.errors.push(`Bail ${leaseId} : email locataire manquant`);
    return result;
  }

  let tenantUser;
  try {
    tenantUser = await User.findOne({ email: tenantEmail }).lean();
  } catch (err) {
    result.errors.push(`Erreur recherche locataire: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  if (!tenantUser) {
    result.errors.push(`Locataire introuvable pour "${tenantEmail}" (bail ${leaseId}). Le locataire doit avoir un compte.`);
    return result;
  }

  // ── 7. Résoudre le propriétaire ──
  const ownerId = (property as Record<string, unknown>)?.user || lease.user;
  if (!ownerId) {
    result.errors.push(`Bail ${leaseId} : propriétaire introuvable`);
    return result;
  }

  // ── 8. Résoudre la property ID ──
  const propertyId = (property as Record<string, unknown>)?._id || lease.property;
  if (!propertyId) {
    result.errors.push(`Bail ${leaseId} : bien immobilier introuvable`);
    return result;
  }

  // ── 9. Calcul prorata ──
  const prorata = calculateProrata(lease, month, year);

  const rentHC = prorata.isProrata
    ? Math.round(lease.rentAmount * prorata.ratio * 100) / 100
    : lease.rentAmount;
  const charges = prorata.isProrata
    ? Math.round((lease.chargesAmount || 0) * prorata.ratio * 100) / 100
    : (lease.chargesAmount || 0);
  const totalTTC = Math.round((rentHC + charges) * 100) / 100;

  // ── 10. Créer le paiement ──
  try {
    await Payment.create({
      lease: leaseId,
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
    const msg = err instanceof Error ? err.message : String(err);
    // Index unique déjà existant = pas une erreur, c'est un skip
    if (msg.includes('E11000') || msg.includes('duplicate key')) {
      result.skipped = 1;
    } else {
      result.errors.push(`Erreur création paiement pour bail ${leaseId}: ${msg}`);
      console.error(`[paymentService] Payment.create failed for lease ${leaseId}:`, msg);
    }
  }

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
  notes?: string,
  paymentMethod?: string
): Promise<ConfirmResult> {
  await connectDiditDb();

  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error('Paiement introuvable');
  if (String(payment.owner) !== ownerId) throw new Error('Non autorisé');

  payment.amounts.paidAmount = paidAmount;
  payment.confirmedAt = new Date();
  payment.confirmedBy = ownerId;
  if (notes) payment.notes = notes;
  if (paymentMethod) payment.paymentMethod = paymentMethod;

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
  const tenantName = tenant
    ? `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || tenant.email
    : lease ? `${lease.tenantFirstName || ''} ${lease.tenantLastName || ''}`.trim() : 'Locataire';
  const propertyAddress = (property as { address?: string })?.address || 'Adresse non renseignée';
  const ownerAddress = (owner as { address?: string })?.address || '';

  // Créer le répertoire
  const receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');
  if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

  const fileName = `quittance_${period.year}_${String(period.month).padStart(2, '0')}_${String(p._id)}.pdf`;
  const filePath = path.join(receiptsDir, fileName);

  // Numéro de quittance déterministe
  const receiptNumber = `QT-${period.year}-${String(period.month).padStart(2, '0')}-${String(p._id).slice(-4).toUpperCase()}`;

  // Méthode de paiement en français
  const methodLabels: Record<string, string> = {
    VIREMENT: 'Virement bancaire', CHEQUE: 'Chèque', ESPECES: 'Espèces',
    PRELEVEMENT: 'Prélèvement automatique', AUTRE: 'Autre',
  };
  const methodLabel = methodLabels[(p.paymentMethod as string) || ''] || 'Non précisé';

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = 595, M = 50;
    const contentW = W - M * 2;

    // ─── En-tête orange ───
    doc.rect(0, 0, W, 75).fill('#F97316');
    doc.fontSize(18).font('Helvetica-Bold').fillColor('white')
      .text('QUITTANCE DE LOYER', M, 18, { width: contentW });
    doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.85)')
      .text(`N° ${receiptNumber}`, M, 42, { width: contentW / 2 });
    doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.85)')
      .text(`Période : ${periodStart} — ${periodEnd}`, M + contentW / 2, 42, { width: contentW / 2, align: 'right' });

    doc.fillColor('#1E293B'); // reset to dark

    let y = 95;

    // ─── Bloc parties (deux colonnes) ───
    const colW = (contentW - 10) / 2;
    const partyBoxH = 90;
    doc.rect(M, y, contentW, partyBoxH).strokeColor('#E2E8F0').lineWidth(1).stroke();
    doc.moveTo(M + colW + 5, y).lineTo(M + colW + 5, y + partyBoxH).strokeColor('#E2E8F0').stroke();

    // Colonne gauche: BAILLEUR
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B')
      .text('BAILLEUR', M + 12, y + 10, { width: colW - 12 });
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A')
      .text(ownerName, M + 12, y + 23, { width: colW - 12 });
    if (ownerAddress) {
      doc.fontSize(9).font('Helvetica').fillColor('#475569')
        .text(ownerAddress, M + 12, y + 38, { width: colW - 12 });
    }

    // Colonne droite: LOCATAIRE
    const col2X = M + colW + 17;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B')
      .text('LOCATAIRE', col2X, y + 10, { width: colW - 12 });
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A')
      .text(tenantName, col2X, y + 23, { width: colW - 12 });

    y += partyBoxH + 12;

    // ─── Bien loué ───
    doc.rect(M, y, contentW, 36).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B')
      .text('BIEN LOUÉ', M + 12, y + 7, { width: contentW - 24 });
    doc.fontSize(9).font('Helvetica').fillColor('#0F172A')
      .text(propertyAddress, M + 12, y + 19, { width: contentW - 24 });

    y += 36 + 16;

    // ─── Tableau des montants ───
    const tableRows = [
      { label: 'Loyer hors charges', amount: amounts.rentHC, bold: false },
      { label: 'Provision pour charges', amount: amounts.charges, bold: false },
      ...(prorata?.isProrata
        ? [{ label: `Prorata (${prorata.daysOccupied}j / ${prorata.daysInMonth}j — ${(prorata.ratio * 100).toFixed(1)}%)`, amount: amounts.totalTTC, bold: false }]
        : []
      ),
    ];
    const rowH = 24;
    const labelColW = contentW * 0.65;
    const amtColW = contentW - labelColW;

    // Header
    doc.rect(M, y, contentW, rowH).fillAndStroke('#F1F5F9', '#E2E8F0');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B')
      .text('DÉSIGNATION', M + 12, y + 7, { width: labelColW - 12 });
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B')
      .text('MONTANT', M + labelColW + 8, y + 7, { width: amtColW - 20, align: 'right' });

    let rowY = y + rowH;
    for (const row of tableRows) {
      doc.rect(M, rowY, contentW, rowH).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      doc.moveTo(M + labelColW, rowY).lineTo(M + labelColW, rowY + rowH).strokeColor('#E2E8F0').stroke();
      doc.fontSize(9).font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#334155')
        .text(row.label, M + 12, rowY + 7, { width: labelColW - 20 });
      doc.fontSize(9).font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#334155')
        .text(`${row.amount.toFixed(2)} €`, M + labelColW + 8, rowY + 7, { width: amtColW - 16, align: 'right' });
      rowY += rowH;
    }

    // Ligne Total TTC
    doc.rect(M, rowY, contentW, rowH).fillAndStroke('#FFF7ED', '#F97316');
    doc.moveTo(M + labelColW, rowY).lineTo(M + labelColW, rowY + rowH).strokeColor('#F97316').lineWidth(1).stroke();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#EA580C')
      .text('TOTAL TTC', M + 12, rowY + 6, { width: labelColW - 20 });
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#EA580C')
      .text(`${amounts.totalTTC.toFixed(2)} €`, M + labelColW + 8, rowY + 6, { width: amtColW - 16, align: 'right' });
    rowY += rowH;

    // Montant reçu
    doc.rect(M, rowY, contentW, rowH).fillAndStroke('#F0FDF4', '#BBF7D0');
    doc.moveTo(M + labelColW, rowY).lineTo(M + labelColW, rowY + rowH).strokeColor('#BBF7D0').lineWidth(1).stroke();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#166534')
      .text('Montant reçu', M + 12, rowY + 7, { width: labelColW - 20 });
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#166534')
      .text(`${amounts.paidAmount.toFixed(2)} €`, M + labelColW + 8, rowY + 7, { width: amtColW - 16, align: 'right' });

    y = rowY + rowH + 16;

    // ─── Date et mode de paiement ───
    const confirmedDate = p.confirmedAt
      ? new Date(p.confirmedAt as string).toLocaleDateString('fr-FR')
      : new Date().toLocaleDateString('fr-FR');
    doc.fontSize(9).font('Helvetica').fillColor('#475569')
      .text(`Date de paiement : ${confirmedDate}   |   Mode de règlement : ${methodLabel}`, M, y, { width: contentW });

    y += 24;

    // ─── Mention légale (boîte bordée) ───
    const legalText = `Le bailleur soussigné reconnaît avoir reçu de ${tenantName}, locataire du logement désigné ci-dessus, la somme de ${amounts.paidAmount.toFixed(2)} € au titre du loyer et des charges du mois de ${periodStart} au ${periodEnd}.\n\nCette quittance annule tous les reçus qui auraient pu être établis précédemment pour la même période.`;
    const legalH = 62;
    doc.rect(M, y, contentW, legalH).fillAndStroke('#FAFAFA', '#CBD5E1');
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#475569')
      .text(legalText, M + 12, y + 10, { width: contentW - 24 });

    y += legalH + 20;

    // ─── Zone signature ───
    doc.fontSize(9).font('Helvetica').fillColor('#64748B')
      .text(`Fait à __________, le ${new Date().toLocaleDateString('fr-FR')}`, M, y, { width: contentW / 2 });
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A')
      .text(`Le bailleur : ${ownerName}`, M, y + 16, { width: contentW / 2 });
    // Zone de signature vide
    doc.rect(M + contentW / 2, y, contentW / 2, 50).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#94A3B8')
      .text('Signature', M + contentW / 2 + 10, y + 18, { width: contentW / 2 - 20 });

    doc.end();

    stream.on('finish', () => resolve(`/uploads/receipts/${fileName}`));
    stream.on('error', reject);
  });
}

// ─── 7. Vérification impayés + relances ─────────────────────────

export interface LatePaymentInfo {
  paymentId: string;
  tenantEmail: string;
  tenantFirstName: string;
  tenantLastName: string;
  tenantName: string;
  ownerEmail: string;
  propertyAddress: string;
  period: string;
  amount: number;
  daysLate: number;
  remindersSent: { date: Date; type: string }[];
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
  })
    .populate('tenant', 'email firstName lastName')
    .populate('property', 'address name')
    .populate('owner', 'email firstName lastName')
    .lean();

  return latePayments.map((p: Record<string, unknown>) => {
    const tenant = p.tenant as { email: string; firstName?: string; lastName?: string } | undefined;
    const property = p.property as { address?: string; name?: string } | undefined;
    const owner = p.owner as { email?: string; firstName?: string; lastName?: string } | undefined;
    const period = p.period as { month: number; year: number };
    const amounts = p.amounts as { totalTTC: number };
    const remindersSent = (p.remindersSent || []) as { date: Date; type: string }[];
    const daysLate = Math.floor((now.getTime() - new Date(p.createdAt as string).getTime()) / (1000 * 60 * 60 * 24));
    return {
      paymentId: String(p._id),
      tenantEmail: tenant?.email || '',
      tenantFirstName: tenant?.firstName || '',
      tenantLastName: tenant?.lastName || '',
      tenantName: `${tenant?.firstName || ''} ${tenant?.lastName || ''}`.trim(),
      ownerEmail: owner?.email || '',
      propertyAddress: property?.address || property?.name || '',
      period: formatPeriod(period.month, period.year),
      amount: amounts.totalTTC,
      daysLate,
      remindersSent,
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
