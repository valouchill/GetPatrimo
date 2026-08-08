/**
 * Service de gestion des paiements locatifs
 *
 * Gère : génération mensuelle, prorata, révision IRL,
 * régularisation charges, confirmation, quittances PDF, relances.
 */
import { connectDiditDb } from '@/app/api/didit/db';

 
const Payment = require('@/models/Payment');
 
const Lease = require('@/models/Lease');
 
const Property = require('@/models/Property');
 
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
  } else {
    // Sécurité (audit passe-5) : paidAmount=0 ne doit PAS conserver un ancien statut CONFIRMED
    // (incohérence d'intégrité — quittance valable pour un paiement remis à zéro).
    payment.status = 'PENDING';
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
/**
 * Quittance — POINT D'ENTRÉE UNIQUE.
 *
 * Deux générateurs coexistaient (~350 lignes de dessin PDF chacun) : selon le
 * chemin emprunté, deux locataires du même bailleur recevaient des quittances
 * de mise en page DIFFÉRENTE pour le même mois. `generateReceipt` délègue
 * désormais à la V2 (design retenu) ; l'implémentation V1 est conservée sous
 * `generateReceiptLegacyV1` le temps de vérifier qu'aucun cas ne la requiert.
 */
export async function generateReceipt(payment: Record<string, unknown>): Promise<string> {
  return generateReceiptV2(payment);
}

async function generateReceiptLegacyV1(payment: Record<string, unknown>): Promise<string> {
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

    // Embed owner signature image if available, otherwise show empty box
    const v1SigPath = (owner as Record<string, unknown>)?.signatureUrl
      ? path.join(process.cwd(), owner.signatureUrl as string)
      : null;
    if (v1SigPath && fs.existsSync(v1SigPath)) {
      try {
        doc.image(v1SigPath, M + contentW / 2 + 10, y, { fit: [contentW / 2 - 20, 50] });
      } catch {
        // Fallback: empty signature box
        doc.rect(M + contentW / 2, y, contentW / 2, 50).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
        doc.fontSize(8).font('Helvetica').fillColor('#94A3B8')
          .text('Signature', M + contentW / 2 + 10, y + 18, { width: contentW / 2 - 20 });
      }
    } else {
      doc.rect(M + contentW / 2, y, contentW / 2, 50).strokeColor('#CBD5E1').lineWidth(0.5).stroke();
      doc.fontSize(8).font('Helvetica').fillColor('#94A3B8')
        .text('Signature', M + contentW / 2 + 10, y + 18, { width: contentW / 2 - 20 });
    }

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
export async function checkLatePayments(ownerId: string): Promise<LatePaymentInfo[]> {
  await connectDiditDb();

  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  // Sécurité (re-audit V1 — 3e passe) : TOUJOURS borner au propriétaire courant.
  // Sans ce filtre, un bailleur authentifié pouvait relancer/muter les paiements
  // d'AUTRES bailleurs (IDOR cross-tenant) en passant un paymentId arbitraire.
  if (!ownerId) return [];
  const latePayments = await Payment.find({
    owner: ownerId,
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

// ─── 11. Quittance PDF v2 — design "private banking" ────────────

/**
 * Génère une quittance de loyer au design minimaliste (noir/blanc, serif).
 * Si paiement partiel → "REÇU DE PAIEMENT" au lieu de "QUITTANCE DE LOYER".
 */
export async function generateReceiptV2(payment: Record<string, unknown>): Promise<string> {
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const path = require('path');

  const p = typeof payment.toObject === 'function' ? payment.toObject() : payment;

  const lease = await Lease.findById(p.lease).lean();
  const property = await Property.findById(p.property).lean();
  const owner = await User.findById(p.owner).lean();
  const tenant = await User.findById(p.tenant).lean();

  const period = p.period as { month: number; year: number };
  const amounts = p.amounts as { rentHC: number; charges: number; totalTTC: number; paidAmount: number };
  const totalDays = daysInMonth(period.month, period.year);
  const periodStart = `01/${String(period.month).padStart(2, '0')}/${period.year}`;
  const periodEnd = `${totalDays}/${String(period.month).padStart(2, '0')}/${period.year}`;

  const ownerName = owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email : 'Proprietaire';
  const ownerAddress = (owner as Record<string, unknown>)?.address
    ? `${owner.address}${owner.zipCode ? ', ' + owner.zipCode : ''}${owner.city ? ' ' + owner.city : ''}`
    : '';
  const tenantName = tenant
    ? `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || tenant.email
    : lease ? `${lease.tenantFirstName || ''} ${lease.tenantLastName || ''}`.trim() : 'Locataire';
  const tenantAddress = (tenant as Record<string, unknown>)?.address
    ? `${tenant.address}${tenant.zipCode ? ', ' + tenant.zipCode : ''}${tenant.city ? ' ' + tenant.city : ''}`
    : '';
  const propertyAddress = (property as Record<string, unknown>)?.address || 'Adresse non renseignee';

  const isPartial = amounts.paidAmount < amounts.totalTTC;
  const docTitle = isPartial ? 'RECU DE PAIEMENT' : 'QUITTANCE DE LOYER';

  const receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');
  if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

  const fileName = `quittance_${period.year}_${String(period.month).padStart(2, '0')}_${String(p._id)}.pdf`;
  const filePath = path.join(receiptsDir, fileName);
  const receiptNumber = `QT-${period.year}-${String(period.month).padStart(2, '0')}-${String(p._id).slice(-4).toUpperCase()}`;

  const methodLabels: Record<string, string> = {
    VIREMENT: 'Virement bancaire', CHEQUE: 'Cheque', ESPECES: 'Especes',
    PRELEVEMENT: 'Prelevement automatique', AUTRE: 'Autre',
  };
  const methodLabel = methodLabels[(p.paymentMethod as string) || ''] || 'Virement bancaire';

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const M = 60;
    const W = 595;
    const contentW = W - M * 2;

    // ─── Titre ───
    doc.fontSize(22).font('Times-Bold').fillColor('#111827')
      .text(docTitle, M, 60, { width: contentW, align: 'center', characterSpacing: 3 });

    // Filet horizontal
    const titleBottom = 90;
    doc.moveTo(M, titleBottom).lineTo(W - M, titleBottom)
      .strokeColor('#D1D5DB').lineWidth(0.5).stroke();

    // N° et période
    doc.fontSize(9).font('Times-Roman').fillColor('#6B7280')
      .text(`N\u00b0 ${receiptNumber}  \u2014  Periode du ${periodStart} au ${periodEnd}`, M, titleBottom + 8, {
        width: contentW, align: 'center',
      });

    // ─── Bloc parties (deux colonnes, sans bordure) ───
    let y = 130;
    const colW = contentW / 2;

    // BAILLEUR (gauche)
    doc.fontSize(8).font('Times-Roman').fillColor('#9CA3AF')
      .text('BAILLEUR', M, y);
    doc.fontSize(11).font('Times-Bold').fillColor('#111827')
      .text(ownerName, M, y + 14, { width: colW - 20 });
    if (ownerAddress) {
      doc.fontSize(9).font('Times-Roman').fillColor('#6B7280')
        .text(ownerAddress, M, y + 30, { width: colW - 20 });
    }

    // LOCATAIRE (droite)
    doc.fontSize(8).font('Times-Roman').fillColor('#9CA3AF')
      .text('LOCATAIRE', M + colW, y, { width: colW });
    doc.fontSize(11).font('Times-Bold').fillColor('#111827')
      .text(tenantName, M + colW, y + 14, { width: colW });
    if (tenantAddress) {
      doc.fontSize(9).font('Times-Roman').fillColor('#6B7280')
        .text(tenantAddress, M + colW, y + 30, { width: colW });
    }

    // ─── Bien loué ───
    y = 190;
    doc.fontSize(8).font('Times-Roman').fillColor('#9CA3AF')
      .text('BIEN LOUE', M, y);
    doc.fontSize(9).font('Times-Italic').fillColor('#374151')
      .text(propertyAddress, M, y + 14, { width: contentW });

    // ─── Tableau des montants ───
    y = 240;
    const colLabel = M;
    const colAmount = W - M - 100;
    const rowH = 28;

    // Filet haut
    doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();

    // Loyer HC
    y += 6;
    doc.fontSize(10).font('Times-Roman').fillColor('#374151')
      .text('Loyer hors charges', colLabel, y);
    doc.fontSize(10).font('Times-Roman').fillColor('#374151')
      .text(fmt(amounts.rentHC), colAmount, y, { width: 100, align: 'right' });

    y += rowH;
    doc.moveTo(M, y - 4).lineTo(W - M, y - 4).strokeColor('#F3F4F6').lineWidth(0.3).stroke();

    // Charges
    doc.fontSize(10).font('Times-Roman').fillColor('#374151')
      .text('Provision pour charges', colLabel, y);
    doc.fontSize(10).font('Times-Roman').fillColor('#374151')
      .text(fmt(amounts.charges), colAmount, y, { width: 100, align: 'right' });

    y += rowH;

    // Séparateur total
    doc.moveTo(M, y - 4).lineTo(W - M, y - 4).strokeColor('#9CA3AF').lineWidth(0.8).stroke();

    // TOTAL
    doc.fontSize(13).font('Times-Bold').fillColor('#111827')
      .text('TOTAL', colLabel, y + 2);
    doc.fontSize(13).font('Times-Bold').fillColor('#111827')
      .text(fmt(amounts.totalTTC), colAmount, y + 2, { width: 100, align: 'right' });

    y += rowH + 4;

    // Montant reçu (si partiel)
    if (isPartial) {
      doc.moveTo(M, y - 4).lineTo(W - M, y - 4).strokeColor('#F3F4F6').lineWidth(0.3).stroke();
      doc.fontSize(10).font('Times-Italic').fillColor('#6B7280')
        .text('Montant recu', colLabel, y);
      doc.fontSize(10).font('Times-Italic').fillColor('#6B7280')
        .text(fmt(amounts.paidAmount), colAmount, y, { width: 100, align: 'right' });
      y += rowH;
    }

    // Filet bas du tableau
    doc.moveTo(M, y - 4).lineTo(W - M, y - 4).strokeColor('#E5E7EB').lineWidth(0.5).stroke();

    // ─── Détails du paiement ───
    y += 16;
    doc.fontSize(9).font('Times-Roman').fillColor('#6B7280')
      .text(`Date du paiement : ${p.confirmedAt ? new Date(p.confirmedAt as string).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`, M, y);
    doc.fontSize(9).font('Times-Roman').fillColor('#6B7280')
      .text(`Mode de reglement : ${methodLabel}`, M, y + 14);

    // ─── Mention légale ───
    y += 50;
    const legalText = isPartial
      ? `Le bailleur soussigne, ${ownerName}, reconnait avoir recu de ${tenantName} la somme de ${fmt(amounts.paidAmount)} en paiement partiel du loyer et des charges du logement situe ${propertyAddress} pour la periode du ${periodStart} au ${periodEnd}. Le present document ne constitue pas une quittance de loyer, le solde restant du de ${fmt(amounts.totalTTC - amounts.paidAmount)} demeure exigible.`
      : `Le bailleur soussigne, ${ownerName}, reconnait avoir recu de ${tenantName} la somme de ${fmt(amounts.totalTTC)} au titre du paiement du loyer et des charges du logement situe ${propertyAddress} pour la periode du ${periodStart} au ${periodEnd}. Le bailleur donne quittance pour ladite somme.`;

    doc.fontSize(8).font('Times-Italic').fillColor('#4B5563')
      .text(legalText, M, y, { width: contentW, lineGap: 3 });

    y += 60;
    doc.fontSize(8).font('Times-Italic').fillColor('#6B7280')
      .text('Sous reserve de tous nos droits et actions, notamment de l\'encaissement effectif si le paiement a eu lieu par cheque.', M, y, { width: contentW, lineGap: 2 });

    // ─── Signature ───
    y += 40;
    doc.fontSize(9).font('Times-Roman').fillColor('#374151')
      .text(`Fait a __________, le ${new Date().toLocaleDateString('fr-FR')}`, M, y);
    doc.fontSize(9).font('Times-Bold').fillColor('#111827')
      .text(`Le bailleur : ${ownerName}`, M, y + 18);

    // Embed owner signature image if available
    const ownerSigPath = (owner as Record<string, unknown>)?.signatureUrl
      ? path.join(process.cwd(), owner.signatureUrl as string)
      : null;
    if (ownerSigPath && fs.existsSync(ownerSigPath)) {
      try {
        doc.image(ownerSigPath, M + contentW / 2 + 20, y - 10, { fit: [140, 55] });
      } catch {
        // Fallback silencieux si l'image est corrompue
      }
    }

    doc.end();

    stream.on('finish', () => resolve(`/uploads/receipts/${fileName}`));
    stream.on('error', reject);
  });
}

// ─── 12. Orchestrateur One-Click ────────────────────────────────

export interface OneClickResult {
  payment: Record<string, unknown>;
  receiptUrl: string;
  sentTo?: string;
  emailSkipped?: boolean;
}

/**
 * Orchestre le flux complet :
 * 1. Find/Create Payment  2. Confirm  3. PDF v2  4. Email
 */
export async function generateAndSendReceipt(
  leaseId: string,
  month: number,
  year: number,
  ownerId: string,
  paidAmount?: number
): Promise<OneClickResult> {
  await connectDiditDb();

  // 1. Load lease
  const lease = await Lease.findById(leaseId).lean();
  if (!lease) throw Object.assign(new Error('Bail introuvable'), { statusCode: 404 });

  const leaseOwnerId = String((lease as Record<string, unknown>).user);
  if (leaseOwnerId !== ownerId) throw Object.assign(new Error('Non autorise'), { statusCode: 403 });

  // 2. Load property
  const property = await Property.findById(lease.property).lean();

  // 3. Resolve tenant
  const tenantEmail = (lease as Record<string, unknown>).tenantEmail as string;
  if (!tenantEmail) throw Object.assign(new Error('Email locataire manquant sur le bail'), { statusCode: 400 });

  const tenantUser = await User.findOne({ email: tenantEmail }).lean();
  if (!tenantUser) throw Object.assign(new Error(`Locataire introuvable pour ${tenantEmail}. Le locataire doit avoir un compte.`), { statusCode: 400 });

  const propertyId = (property as Record<string, unknown>)?._id || lease.property;
  const ownId = (property as Record<string, unknown>)?.user || lease.user;

  // 4. Find or create Payment
  let payment = await Payment.findOne({ lease: leaseId, 'period.month': month, 'period.year': year });

  if (!payment) {
    const prorata = calculateProrata(lease, month, year);
    const rentHC = prorata.isProrata
      ? Math.round(lease.rentAmount * prorata.ratio * 100) / 100
      : lease.rentAmount;
    const charges = prorata.isProrata
      ? Math.round((lease.chargesAmount || 0) * prorata.ratio * 100) / 100
      : (lease.chargesAmount || 0);
    const totalTTC = Math.round((rentHC + charges) * 100) / 100;

    payment = await Payment.create({
      lease: leaseId,
      tenant: tenantUser._id,
      owner: ownId,
      property: propertyId,
      period: { month, year },
      amounts: { rentHC, charges, totalTTC, paidAmount: 0 },
      prorata: prorata.isProrata ? prorata : { isProrata: false },
      status: 'PENDING',
    });
  }

  // 5. Confirm payment
  const finalAmount = paidAmount ?? payment.amounts.totalTTC;
  payment.amounts.paidAmount = finalAmount;
  payment.confirmedAt = new Date();
  payment.confirmedBy = ownerId;
  payment.paymentMethod = 'VIREMENT';

  if (finalAmount >= payment.amounts.totalTTC) {
    payment.status = 'CONFIRMED';
  } else if (finalAmount > 0) {
    payment.status = 'PARTIAL';
  }
  await payment.save();

  // 6. Generate PDF v2
  const receiptUrl = await generateReceiptV2(payment);
  payment.receiptUrl = receiptUrl;
  payment.receiptGeneratedAt = new Date();
  await payment.save();

  // 7. Send email (best-effort)
  let sentTo: string | undefined;
  let emailSkipped = false;
  try {
    const { sendEmail, isEmailConfigured } = require('@/src/services/emailService');
    if (isEmailConfigured()) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), receiptUrl);
      const pdfBuffer = fs.readFileSync(filePath);

      const MONTHS = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];
      const monthLabel = MONTHS[month - 1];
      const tName = `${tenantUser.firstName || ''} ${tenantUser.lastName || ''}`.trim() || tenantUser.email;

      await sendEmail({
        to: tenantUser.email,
        subject: `Votre quittance de loyer \u2014 ${monthLabel} ${year}`,
        text: `Bonjour ${tName},\n\nVeuillez trouver ci-joint votre quittance de loyer pour la periode : ${monthLabel} ${year}.\n\nCordialement,\nVotre bailleur`,
        html: `<div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <p>Bonjour <strong>${tName}</strong>,</p>
          <p>Veuillez trouver ci-joint votre quittance de loyer pour la periode : <strong>${monthLabel} ${year}</strong>.</p>
          <p style="color:#6B7280;font-size:13px;">Cordialement,<br/>Votre bailleur</p>
        </div>`,
        attachments: [{
          filename: `quittance_${monthLabel.toLowerCase()}_${year}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }],
      });

      sentTo = tenantUser.email;
      payment.receiptSentAt = new Date();
      payment.receiptSentTo = tenantUser.email;
      await payment.save();
    } else {
      emailSkipped = true;
    }
  } catch {
    emailSkipped = true;
  }

  return { payment: payment.toObject(), receiptUrl, sentTo, emailSkipped };
}
