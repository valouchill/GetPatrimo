import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { logger } from '@/lib/server-logger';
import { generateAndSendReceipt } from '@/lib/services/paymentService';
import { hasManagementAccess, MANAGEMENT_UPSELL_MESSAGE } from '@/lib/billing/management-access';

const Payment = require('@/models/Payment');
const User = require('@/models/User');
const Property = require('@/models/Property');
const { parseStatement, matchTransactions } = require('@/src/services/bankReconciliationService');

const { logEvent } = require('@/src/services/eventService');

const MAX_STATEMENT_BYTES = 2 * 1024 * 1024; // 2 Mo — un relevé texte reste petit

async function requireOwner() {
  const session = (await getServerSession(authOptions as never)) as { user?: { email?: string } } | null;
  if (!session?.user?.email) return null;
  await connectDiditDb();
  return User.findOne({ email: session.user.email }).select('_id email').lean();
}

/**
 * POST /api/payments/reconcile — rapprochement bancaire assisté.
 *
 * Deux modes :
 *  1. { statement, fileName }  → analyse le relevé et renvoie des PROPOSITIONS
 *     (aucune écriture : le bailleur garde la main).
 *  2. { confirm: [{ paymentId, amount, label, date }] } → confirme les
 *     paiements validés, génère et ENVOIE la quittance automatiquement.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireOwner();
  if (!user?._id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  // Accès module (revue F4) : l'abonnement Gestion ne débloquait rien — tout le
  // monde utilisait les modules facturés par les CGV art. 2 bis. Le contrôle
  // s'active automatiquement dès que le prix Stripe est configuré.
  const subscribed = await Property.exists({
    user: user._id,
    archived: { $ne: true },
    'management.active': true,
  });
  if (!hasManagementAccess(subscribed ? { management: { active: true } } : null)) {
    return NextResponse.json(
      { error: MANAGEMENT_UPSELL_MESSAGE, code: 'MANAGEMENT_REQUIRED' },
      { status: 402 },
    );
  }

  // ── Mode 2 : confirmation des rapprochements validés ──
  if (Array.isArray(body?.confirm) && body.confirm.length > 0) {
    const results: Array<Record<string, unknown>> = [];
    for (const item of body.confirm.slice(0, 100)) {
      try {
        // Ownership : on ne confirme QUE les loyers du bailleur connecté.
        const payment = await Payment.findOne({ _id: item.paymentId, owner: user._id })
          .select('lease period amounts status receiptSentAt')
          .lean();
        if (!payment) {
          results.push({ paymentId: item.paymentId, ok: false, error: 'Loyer introuvable' });
          continue;
        }
        // Idempotence (revue F7) : un rejeu (retry réseau, double soumission,
        // onglet resté ouvert) renvoyait une SECONDE quittance au locataire
        // pour le même mois, en écrasant montant et dates.
        if (payment.status === 'CONFIRMED' && payment.receiptSentAt) {
          results.push({ paymentId: String(payment._id), ok: true, alreadyConfirmed: true });
          continue;
        }
        // Le montant vient du CLIENT (revue F2) : il était imprimé tel quel sur
        // la quittance (« reconnaît avoir reçu la somme de … »). On le borne au
        // montant réellement dû, jamais au-delà.
        const due = Number(payment.amounts?.totalTTC || 0);
        const claimed = Number(item.amount);
        const paidAmount = Number.isFinite(claimed) && claimed > 0 ? Math.min(claimed, due) : due;
        // Chaîne complète : confirme le paiement, génère la quittance PDF ET
        // l'envoie au locataire (le service one-click fait les trois).
        const receipt = await generateAndSendReceipt(
          String(payment.lease),
          Number(payment.period?.month),
          Number(payment.period?.year),
          String(user._id),
          paidAmount,
        );
        results.push({
          paymentId: String(payment._id),
          ok: true,
          receiptUrl: (receipt as { receiptUrl?: string })?.receiptUrl || null,
        });
      } catch (e) {
        logger.error('[reconcile] confirmation', { error: e instanceof Error ? e.message : e });
        results.push({ paymentId: item.paymentId, ok: false, error: 'Échec de la confirmation' });
      }
    }
    const confirmed = results.filter((r) => r.ok).length;
    if (confirmed > 0) {
      logEvent(String(user._id), { type: 'rent_reconciled', meta: { count: confirmed } });
    }
    return NextResponse.json({ success: true, confirmed, results });
  }

  // ── Mode 1 : analyse du relevé ──
  const statement = String(body?.statement || '');
  if (!statement.trim()) {
    return NextResponse.json({ error: 'Relevé vide.' }, { status: 400 });
  }
  if (Buffer.byteLength(statement, 'utf8') > MAX_STATEMENT_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 2 Mo).' }, { status: 413 });
  }

  const transactions = parseStatement(statement, String(body?.fileName || ''));
  if (!transactions.length) {
    return NextResponse.json({
      proposals: [],
      parsedCount: 0,
      unmatchedCount: 0,
      hint: "Aucun encaissement détecté. Exportez un relevé CSV ou OFX depuis votre banque (colonnes date, libellé, montant ou débit/crédit).",
    });
  }

  // Loyers en attente du bailleur (tous biens confondus).
  const pending = await Payment.find({
    owner: user._id,
    status: { $in: ['PENDING', 'LATE', 'PARTIAL', 'UNPAID'] },
  })
    .populate('tenant', 'firstName lastName')
    .populate('property', 'address name')
    .select('amounts period status tenant property createdAt')
    .lean();

  const MONTHS = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const expected = pending.map((p: any) => ({
    paymentId: String(p._id),
    tenantName: `${p.tenant?.firstName || ''} ${p.tenant?.lastName || ''}`.trim(),
    amount: Number(p.amounts?.totalTTC || 0),
    dueDate: p.createdAt,
    period: `${MONTHS[p.period?.month] || ''} ${p.period?.year || ''}`.trim(),
    propertyLabel: p.property?.address || p.property?.name || '',
  }));

  const result = matchTransactions(transactions, expected);
  return NextResponse.json({
    ...result,
    pendingCount: expected.length,
  });
});
