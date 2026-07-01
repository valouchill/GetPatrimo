/**
 * getCockpitData — agrégats RÉELS (MongoDB) pour le Cockpit SuperAdmin.
 *
 * Fusionne :
 *   • RÉEL : inscriptions, dossiers analysés, grades, abonnements (Property.tier),
 *     overage (Property.overageReportedCount), activation, anti-fraude.
 *   • ESTIMÉ : coûts API (aucune table de coûts) dérivés du VOLUME RÉEL × coûts
 *     unitaires (cf. mockAdminData.API_COST_ESTIMATES).
 *   • MOCK : tendances historiques (pas de snapshots) & sources UTM (non trackées).
 *
 * Server-only (utilise les modèles Mongoose). Importé par la page serveur du cockpit.
 */

import { connectDiditDb } from '@/app/api/didit/db';
import { TIERS, OVERAGE_PRICE_EUR, type PropertyTier } from '@/lib/billing/tiers';
import {
  API_COST_ESTIMATES as EST,
  revenueVsCostTrend,
  costPerDossier30d,
  utmSources,
} from '@/app/(platform)/dashboard/admin/cockpit/mockAdminData';

 
const User = require('@/models/User');
 
const Property = require('@/models/Property');
 
const Application = require('@/models/Application');
 
const ApiCostLog = require('@/models/ApiCostLog');

export interface MetricDelta {
  value: number;
  /** % vs M-1 ; null quand non calculable (pas d'historique). */
  delta: number | null;
}

export interface CockpitData {
  generatedAt: string;
  /** Vrai si au moins une métrique repose sur une estimation (coûts API). */
  hasEstimates: boolean;

  northStar: {
    mrr: number;
    /** Revenus totaux − coûts API estimés (vert si > 0). */
    marginBrutIA: number;
    /** Coût API estimé moyen par dossier (€). À garder < overagePriceEur. */
    costPerDossier: number;
    dossiersAnalyzed: MetricDelta;
  };
  growth: { newOwners: MetricDelta; newTenants: MetricDelta };

  revenueTotal: number;
  overageRevenue: number;
  overageUnits: number;
  apiCostTotal: number;
  overagePriceEur: number;

  revenueVsCost: Array<{ month: string; revenue: number; apiCost: number }>;
  costPerDossier30d: Array<{ day: string; cost: number }>;
  subscriptionBreakdown: Array<{ plan: string; tier: PropertyTier; count: number; priceEur: number; mrr: number }>;
  dailySignups: Array<{ date: string; owners: number; tenants: number }>;
  activationRate: number;
  utmSources: Array<{ source: string; signups: number; conversion: number }>;
  gradeDistribution: Array<{ grade: string; value: number; color: string }>;
  fraudShield: { blocked: number; analyzed: number };
  apiCostsByProvider: Array<{ provider: string; category: string; requests: number; estCost: number; real: boolean }>;
  /** Origine des coûts : 'real' (ApiCostLog), 'estimated' (fallback) ou 'mixed'. */
  costSource: 'real' | 'estimated' | 'mixed';
  /** Vrai si le coût/dossier provient de logs LLM réels (et non d'une estimation). */
  costPerDossierReal: boolean;
  /** Détail des derniers appels API réellement loggés. */
  recentApiCalls: Array<{
    provider: string;
    category: string;
    model: string;
    costEur: number;
    tokens: number;
    createdAt: string;
  }>;
}

function pctDelta(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

export async function getCockpitData(): Promise<CockpitData> {
  await connectDiditDb();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const days30Ago = new Date(now.getTime() - 30 * 86_400_000);

  // "Analysé" = un patrimomètre a été calculé (score > 0).
  const analyzed = { 'patrimometer.score': { $gt: 0 } };

  const [
    ownersThisM,
    ownersLastM,
    tenantsThisM,
    tenantsLastM,
    dossiersThisM,
    dossiersLastM,
    tierAgg,
    overageAgg,
    gradeAgg,
    fraudBlocked,
    ownersTotal,
    ownersWithProp,
    signupAgg,
    apiCostAgg,
    recentCalls,
  ] = await Promise.all([
    User.countDocuments({ role: 'owner', createdAt: { $gte: monthStart } }),
    User.countDocuments({ role: 'owner', createdAt: { $gte: lastMonthStart, $lt: monthStart } }),
    User.countDocuments({ role: 'tenant', createdAt: { $gte: monthStart } }),
    User.countDocuments({ role: 'tenant', createdAt: { $gte: lastMonthStart, $lt: monthStart } }),
    Application.countDocuments({ ...analyzed, createdAt: { $gte: monthStart } }),
    Application.countDocuments({ ...analyzed, createdAt: { $gte: lastMonthStart, $lt: monthStart } }),
    Property.aggregate([{ $group: { _id: '$tier', count: { $sum: 1 } } }]),
    Property.aggregate([{ $group: { _id: null, total: { $sum: '$overageReportedCount' } } }]),
    Application.aggregate([
      { $match: analyzed },
      {
        $bucket: {
          groupBy: '$patrimometer.score',
          boundaries: [0, 50, 75, 90, 101],
          default: 'other',
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    Application.countDocuments({ 'documents.status': 'FLAGGED', createdAt: { $gte: monthStart } }),
    User.countDocuments({ role: 'owner' }),
    Property.distinct('user'),
    User.aggregate([
      { $match: { createdAt: { $gte: days30Ago }, role: { $in: ['owner', 'tenant'] } } },
      {
        $group: {
          _id: { d: { $dateToString: { format: '%d/%m', date: '$createdAt' } }, role: '$role' },
          c: { $sum: 1 },
        },
      },
    ]),
    // Coûts API RÉELS du mois (ApiCostLog), agrégés par catégorie.
    // Exclut les runs démo (meta.isSample) — leur coût ne doit PAS polluer la
    // marge/COGS ni le coût réel par dossier (cf. mode « dossier exemple »).
    ApiCostLog.aggregate([
      { $match: { createdAt: { $gte: monthStart }, 'meta.isSample': { $ne: true } } },
      { $group: { _id: '$category', cost: { $sum: '$costEur' }, count: { $sum: '$units' } } },
    ]),
    // Détail des derniers appels API loggés (hors runs démo).
    ApiCostLog.find({ 'meta.isSample': { $ne: true } }).sort({ createdAt: -1 }).limit(12).lean(),
  ]);

  // — Abonnements par palier + MRR (prix réels depuis lib/billing/tiers) —
  const tierCount: Record<string, number> = {};
  for (const t of tierAgg) tierCount[(t._id as string) || 'FREE'] = t.count;
  const subscriptionBreakdown = (Object.keys(TIERS) as PropertyTier[]).map((id) => ({
    plan: TIERS[id].label,
    tier: id,
    count: tierCount[id] || 0,
    priceEur: TIERS[id].priceEur,
    mrr: (tierCount[id] || 0) * TIERS[id].priceEur,
  }));
  const mrr = subscriptionBreakdown.reduce((s, b) => s + b.mrr, 0);
  const paidSubs = subscriptionBreakdown
    .filter((b) => b.tier !== 'FREE')
    .reduce((s, b) => s + b.count, 0);

  const overageUnits = (overageAgg[0]?.total as number) || 0;
  const overageRevenue = overageUnits * OVERAGE_PRICE_EUR;
  const revenueTotal = mrr + overageRevenue;

  // — Répartition des grades (score → métal) —
  const bucket: Record<string, number> = {};
  for (const b of gradeAgg) bucket[String(b._id)] = b.count;
  const gradeDistribution = [
    { grade: 'Platinum', value: bucket['90'] || 0, color: '#e2e8f0' },
    { grade: 'Gold', value: bucket['75'] || 0, color: '#f59e0b' },
    { grade: 'Silver', value: bucket['50'] || 0, color: '#94a3b8' },
    { grade: 'Alerte', value: bucket['0'] || 0, color: '#ef4444' },
  ];

  // — Coûts API : RÉELS (ApiCostLog) si disponibles, sinon ESTIMÉS (fallback) —
  const d = dossiersThisM;

  // Coûts réels du mois, par catégorie (depuis ApiCostLog).
  const realCat: Record<string, { cost: number; count: number }> = {};
  for (const c of apiCostAgg) realCat[String(c._id)] = { cost: c.cost || 0, count: c.count || 0 };
  const realLlm =
    (realCat['LLM']?.cost || 0) +
    (realCat['LLM_VISION']?.cost || 0) +
    (realCat['LLM_SCORING']?.cost || 0) +
    (realCat['OCR']?.cost || 0);
  const realLlmCalls =
    (realCat['LLM']?.count || 0) +
    (realCat['LLM_VISION']?.count || 0) +
    (realCat['LLM_SCORING']?.count || 0) +
    (realCat['OCR']?.count || 0);
  const realKyc = realCat['KYC']?.cost || 0;
  const realKycCalls = realCat['KYC']?.count || 0;
  const realMail = realCat['Mail']?.cost || 0;
  const realMailCalls = realCat['Mail']?.count || 0;
  const hasRealCosts = realLlm > 0 || realKyc > 0;

  // Estimations (fallback, dérivées du volume réel) — utilisées tant qu'aucun
  // appel n'a encore été loggé pour la catégorie.
  const estLlm = d * (EST.llmPerDossier + EST.ocrPerDossier);
  const estKyc = d * EST.kycRatePerDossier * EST.diditPerKyc;
  const estMail = d * EST.mailsPerDossier * EST.mailPerSend;

  // Par catégorie : réel si présent, sinon estimé.
  const llmCost = realLlm > 0 ? realLlm : estLlm;
  const kycCost = realKyc > 0 ? realKyc : estKyc;
  const mailCost = realMail > 0 ? realMail : estMail;
  const stripeFees = revenueTotal * EST.stripeFeeRate + paidSubs * EST.stripeFeeFixed; // toujours calculé
  const apiCostTotal = llmCost + kycCost + mailCost + stripeFees;

  const apiCostsByProvider = [
    {
      provider: 'OpenAI — GPT-4o (LLM + OCR)',
      category: 'LLM',
      requests: realLlm > 0 ? realLlmCalls : d * 4,
      estCost: llmCost,
      real: realLlm > 0,
    },
    {
      provider: 'Didit — Biométrie eIDAS',
      category: 'KYC',
      requests: realKyc > 0 ? realKycCalls : Math.round(d * EST.kycRatePerDossier),
      estCost: kycCost,
      real: realKyc > 0,
    },
    {
      provider: 'Brevo — Emails',
      category: 'Mail',
      requests: realMail > 0 ? realMailCalls : d * EST.mailsPerDossier,
      estCost: mailCost,
      real: realMail > 0,
    },
    { provider: 'Stripe — Frais', category: 'Paiement', requests: paidSubs, estCost: stripeFees, real: false },
  ];

  const marginBrutIA = revenueTotal - apiCostTotal;
  // Coût RÉEL moyen d'analyse d'un dossier = coût LLM réel du mois / dossiers
  // analysés (doit rester < overage 0,49 €). Fallback estimé tant qu'aucun
  // appel LLM n'a été loggé.
  const costPerDossierReal = realLlm > 0 && d > 0;
  const costPerDossier = costPerDossierReal ? realLlm / d : EST.llmPerDossier + EST.ocrPerDossier;
  const costSource: 'real' | 'estimated' | 'mixed' = hasRealCosts ? 'mixed' : 'estimated';

  // Détail des derniers appels API réels.
  const recentApiCalls = (recentCalls as Array<Record<string, unknown>>).map((c) => ({
    provider: String(c.provider || ''),
    category: String(c.category || ''),
    model: String(c.model || ''),
    costEur: Number(c.costEur) || 0,
    tokens: (Number(c.inputTokens) || 0) + (Number(c.outputTokens) || 0),
    createdAt: c.createdAt ? new Date(c.createdAt as string).toISOString() : '',
  }));

  // — Activation : part des propriétaires ayant ≥ 1 bien (lien de location) —
  const activationRate =
    ownersTotal > 0 ? Math.round(((ownersWithProp as unknown[]).length / ownersTotal) * 100) : 0;

  // — Inscriptions quotidiennes (pivot owner/tenant) —
  const dayMap: Record<string, { owners: number; tenants: number }> = {};
  for (const r of signupAgg) {
    const key = r._id.d as string;
    dayMap[key] = dayMap[key] || { owners: 0, tenants: 0 };
    if (r._id.role === 'owner') dayMap[key].owners = r.c;
    else dayMap[key].tenants = r.c;
  }
  const dailySignups = Object.keys(dayMap)
    .map((date) => ({ date, ...dayMap[date] }))
    .sort((a, b) => {
      const [da, ma] = a.date.split('/').map(Number);
      const [db, mb] = b.date.split('/').map(Number);
      return ma - mb || da - db;
    });

  // — Tendance Revenus vs Coûts : ancrer le dernier point sur le RÉEL —
  const revenueVsCost = revenueVsCostTrend.map((p, i) =>
    i === revenueVsCostTrend.length - 1
      ? { month: p.month, revenue: Math.round(revenueTotal), apiCost: Math.round(apiCostTotal) }
      : p,
  );

  return {
    generatedAt: now.toISOString(),
    hasEstimates: true,
    northStar: {
      mrr,
      marginBrutIA,
      costPerDossier,
      dossiersAnalyzed: { value: dossiersThisM, delta: pctDelta(dossiersThisM, dossiersLastM) },
    },
    growth: {
      newOwners: { value: ownersThisM, delta: pctDelta(ownersThisM, ownersLastM) },
      newTenants: { value: tenantsThisM, delta: pctDelta(tenantsThisM, tenantsLastM) },
    },
    revenueTotal,
    overageRevenue,
    overageUnits,
    apiCostTotal,
    overagePriceEur: OVERAGE_PRICE_EUR,
    revenueVsCost,
    costPerDossier30d,
    subscriptionBreakdown,
    dailySignups,
    activationRate,
    utmSources,
    gradeDistribution,
    fraudShield: { blocked: fraudBlocked, analyzed: dossiersThisM },
    apiCostsByProvider,
    costSource,
    costPerDossierReal,
    recentApiCalls,
  };
}
