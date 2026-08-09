import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { FREE_TRIAL_LIMIT } from '@/lib/billing/tiers';

 
const User = require('@/models/User');
 
const Payment = require('@/models/Payment');
 
const Lease = require('@/models/Lease');
 
const Property = require('@/models/Property');
 
const Event = require('@/models/Event');

const PilotGrant = require('@/models/PilotGrant');

/**
 * GET /api/dashboard
 * Returns aggregated dashboard data: financial summary, alerts, recent events.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const userId = user._id;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Properties owned by this user
  const properties = await Property.find({ user: userId, archived: { $ne: true } }).lean();
  const propertyIds = properties.map((p: { _id: unknown }) => p._id);
  const totalProperties = properties.length;
  const occupiedProperties = properties.filter((p: { status?: string; managed?: boolean }) =>
    p.status === 'OCCUPIED' || p.managed
  ).length;

  // Active leases
  const activeLeases = await Lease.find({
    property: { $in: propertyIds },
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
  }).lean();
  const activeLeasesCount = activeLeases.length;

  // ── Financial summary for current month ──
  const monthPayments = await Payment.find({
    owner: userId,
    'period.month': currentMonth,
    'period.year': currentYear,
  }).lean();

  const totalExpected = monthPayments.reduce(
    (s: number, p: { amounts?: { totalTTC?: number } }) => s + (p.amounts?.totalTTC || 0), 0
  );
  const totalReceived = monthPayments.reduce(
    (s: number, p: { amounts?: { paidAmount?: number } }) => s + (p.amounts?.paidAmount || 0), 0
  );
  const lateCount = monthPayments.filter(
    (p: { status?: string }) => p.status === 'LATE' || p.status === 'UNPAID'
  ).length;
  const pendingReceipts = monthPayments.filter(
    (p: { status?: string; receiptUrl?: string }) => p.status === 'CONFIRMED' && !p.receiptUrl
  ).length;

  // ── Revenue trend (last 6 months) ──
  const sixMonthsAgo = new Date(currentYear, currentMonth - 7, 1);
  const trendPayments = await Payment.find({
    owner: userId,
    $or: [
      { 'period.year': currentYear, 'period.month': { $lte: currentMonth } },
      { 'period.year': currentYear - 1, 'period.month': { $gte: sixMonthsAgo.getMonth() + 1 } },
    ],
  }).lean();

  const revenueTrend: { month: number; year: number; expected: number; received: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const mp = trendPayments.filter(
      (p: { period?: { month?: number; year?: number } }) => p.period?.month === m && p.period?.year === y
    );
    revenueTrend.push({
      month: m,
      year: y,
      expected: mp.reduce((s: number, p: { amounts?: { totalTTC?: number } }) => s + (p.amounts?.totalTTC || 0), 0),
      received: mp.reduce((s: number, p: { amounts?: { paidAmount?: number } }) => s + (p.amounts?.paidAmount || 0), 0),
    });
  }

  // ── Alerts ──
  interface Alert {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    actionLabel: string;
    actionTarget: string;
  }
  const alerts: Alert[] = [];

  // Late payments
  for (const p of monthPayments) {
    const pay = p as { _id: unknown; status?: string; property?: unknown; amounts?: { totalTTC?: number } };
    if (pay.status === 'LATE' || pay.status === 'UNPAID') {
      const prop = properties.find((pr: { _id: unknown }) => String(pr._id) === String(pay.property));
      const propName = (prop as { name?: string; address?: string })?.name || (prop as { name?: string; address?: string })?.address || 'Bien';
      alerts.push({
        id: `late-${String(pay._id)}`,
        severity: 'critical',
        message: `Loyer impayé — ${propName} (${(pay.amounts?.totalTTC || 0).toLocaleString('fr-FR')} €)`,
        actionLabel: 'Relancer',
        actionTarget: 'loyers',
      });
    }
  }

  // Expiring leases (within 60 days)
  const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  for (const lease of activeLeases) {
    const l = lease as { _id: unknown; endDate?: Date; property?: unknown; tenantFirstName?: string; tenantLastName?: string };
    if (l.endDate && new Date(l.endDate) <= sixtyDaysFromNow) {
      const prop = properties.find((pr: { _id: unknown }) => String(pr._id) === String(l.property));
      const propName = (prop as { name?: string; address?: string })?.name || (prop as { name?: string; address?: string })?.address || 'Bien';
      const daysLeft = Math.ceil((new Date(l.endDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      alerts.push({
        id: `lease-exp-${String(l._id)}`,
        severity: daysLeft <= 30 ? 'critical' : 'warning',
        message: `Bail expirant dans ${daysLeft}j — ${propName} (${l.tenantFirstName || ''} ${l.tenantLastName || ''})`,
        actionLabel: 'Voir le bail',
        actionTarget: 'baux',
      });
    }
  }

  // Pending payments to confirm
  const pendingPayments = monthPayments.filter((p: { status?: string }) => p.status === 'PENDING');
  if (pendingPayments.length > 0) {
    alerts.push({
      id: 'pending-payments',
      severity: 'info',
      message: `${pendingPayments.length} loyer${pendingPayments.length > 1 ? 's' : ''} en attente de confirmation`,
      actionLabel: 'Confirmer',
      actionTarget: 'loyers',
    });
  }

  // Sort alerts by severity
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // ── Recent events ──
  const events = await Event.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('property', 'name address')
    .lean();

  const recentEvents = events.map((e: {
    _id: unknown;
    type?: string;
    createdAt?: Date;
    property?: { _id?: unknown; name?: string; address?: string } | null;
    meta?: Map<string, unknown> | Record<string, unknown>;
  }) => ({
    id: String(e._id),
    type: e.type,
    date: e.createdAt,
    propertyLabel: e.property?.name || e.property?.address?.split(',')[0]?.trim() || null,
    meta: e.meta instanceof Map ? Object.fromEntries(e.meta) : (e.meta || {}),
  }));

  // ── Pilote B2B : audits octroyés AVANT le premier bien (grants PENDING) ──
  // Sans ça, un compte invité « 10 audits offerts » voyait la bannière d'essai
  // gratuit « 1 audit » à sa première connexion (incohérent avec l'email reçu).
  const pendingGrants = await PilotGrant.find({
    status: 'PENDING',
    $or: [{ user: (user as { _id: unknown })._id }, { email: (user as { email?: string }).email }],
  })
    .select('audits')
    .lean();
  const pilotPendingAudits = pendingGrants.reduce(
    (sum: number, g: { audits?: number }) => sum + (g.audits || 0),
    0,
  );

  return NextResponse.json({
    success: true,
    data: {
      pilotPendingAudits,
      // B2B : pilote l'onglet « Mon offre Pro » (jamais d'offres B2C pour un pro).
      accountType: (user as { accountType?: string }).accountType === 'B2B' ? 'B2B' : 'B2C',
      financial: {
        totalExpected,
        totalReceived,
        lateCount,
        pendingReceipts,
        collectionRate: totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0,
        remaining: totalExpected - totalReceived,
        revenueTrend,
      },
      kpis: {
        totalProperties,
        occupiedProperties,
        activeLeasesCount,
      },
      // Essai gratuit (compteur au niveau du COMPTE) + a-t-il au moins une offre payante.
      freeTrial: {
        used: Number((user as { freeAnalysesUsed?: number }).freeAnalysesUsed || 0),
        limit: FREE_TRIAL_LIMIT,
      },
      // Gestion locative : est-ce qu'AU MOINS un logement est abonné, et si non,
      // lequel proposer en priorité (le plus récent) → point de vente de l'offre.
      management: {
        offerLive: Boolean(process.env.PRICE_ID_MANAGEMENT_MONTHLY),
        anyActive: properties.some((p: { management?: { active?: boolean } }) => p.management?.active === true),
        // Nombre d'abonnements DÉJÀ actifs : au 3e logement le tarif devient dégressif,
        // l'UI doit donc annoncer le bon prix avant même le clic.
        activeCount: properties.filter((p: { management?: { active?: boolean } }) => p.management?.active === true).length,
        upsellPropertyId: (() => {
          const candidate = properties.find((p: { management?: { active?: boolean }; _id?: unknown }) => !p.management?.active);
          return candidate ? String((candidate as { _id: unknown })._id) : null;
        })(),
      },
      hasPaidProperty: properties.some(
        (p: { tier?: string; managed?: boolean }) =>
          (p.tier && p.tier !== 'FREE') || p.managed === true,
      ),
      alerts,
      recentEvents,
    },
  });
});
