/**
 * Données mockées du Cockpit SuperAdmin.
 *
 * ⚠️ MOCK — à remplacer par des agrégations réelles (MongoDB) lors du câblage.
 * Chaque export est volontairement isolé et typé pour qu'un futur endpoint
 * `/api/admin/cockpit/*` puisse le remplacer sans toucher au composant d'UI.
 * (cf. les `countDocuments` / agrégats déjà utilisés dans dashboard/admin/page.tsx)
 */

export interface NorthStarMetric {
  /** Valeur du mois en cours. */
  value: number;
  /** Évolution en % vs mois précédent (M-1). Positif = vert, négatif = rouge. */
  delta: number;
}

/** 1. North Star Metrics (top bar temps réel). */
export const northStar: {
  mrr: NorthStarMetric;
  newOwners: NorthStarMetric;
  newTenants: NorthStarMetric;
  aiDossiers: NorthStarMetric;
} = {
  mrr: { value: 12450, delta: 12.4 },
  newOwners: { value: 38, delta: 8.1 },
  newTenants: { value: 214, delta: 22.5 },
  aiDossiers: { value: 526, delta: 15.2 },
};

/* ─────────────────────────  Onglet A — Finance & Croissance  ───────────────────────── */

/** Abonnements actifs par palier (BarChart). */
export const subscriptionBreakdown: Array<{ plan: string; count: number }> = [
  { plan: 'Gratuit', count: 412 },
  { plan: 'Essentiel', count: 156 },
  { plan: 'Analyse IA', count: 98 },
  { plan: 'Max', count: 41 },
];

/** Revenus de dépassement (overage 0,49 €) — 6 derniers mois (LineChart). */
export const overageRevenue: Array<{ month: string; revenue: number }> = [
  { month: 'Janv.', revenue: 184 },
  { month: 'Févr.', revenue: 232 },
  { month: 'Mars', revenue: 268 },
  { month: 'Avr.', revenue: 301 },
  { month: 'Mai', revenue: 357 },
  { month: 'Juin', revenue: 421 },
];

export type StripeStatus = 'réussi' | 'échoué';
/** Derniers paiements Stripe (réussis / échoués). */
export const stripePayments: Array<{
  id: string;
  customer: string;
  plan: string;
  amount: number;
  status: StripeStatus;
  date: string;
}> = [
  { id: 'pi_3QvAa1', customer: 'M. Lefèvre', plan: 'Max', amount: 59.9, status: 'réussi', date: '03 juin · 14:22' },
  { id: 'pi_3Qvfb2', customer: 'SCI Borgia', plan: 'Analyse IA', amount: 39.9, status: 'réussi', date: '03 juin · 11:08' },
  { id: 'pi_3Qkfc3', customer: 'Mme Nguyen', plan: 'Essentiel', amount: 19.9, status: 'réussi', date: '02 juin · 19:41' },
  { id: 'pi_3Qjzd4', customer: 'M. Abadie', plan: 'Max', amount: 59.9, status: 'échoué', date: '02 juin · 16:30' },
  { id: 'pi_3Qpqe5', customer: 'Foncia Lyon', plan: 'Analyse IA', amount: 39.9, status: 'réussi', date: '02 juin · 09:12' },
  { id: 'pi_3Qmwf6', customer: 'M. Sorrentino', plan: 'Essentiel', amount: 19.9, status: 'échoué', date: '01 juin · 22:05' },
  { id: 'pi_3Qrxg7', customer: 'Mme Diallo', plan: 'Max', amount: 59.9, status: 'réussi', date: '01 juin · 14:53' },
];

/* ─────────────────────────  Onglet B — Marketing & Acquisition  ───────────────────────── */

/** Inscriptions quotidiennes (2 courbes : propriétaires bleu, locataires vert). */
export const dailySignups: Array<{ date: string; owners: number; tenants: number }> = [
  { date: '21/05', owners: 3, tenants: 12 },
  { date: '22/05', owners: 5, tenants: 19 },
  { date: '23/05', owners: 2, tenants: 9 },
  { date: '24/05', owners: 6, tenants: 24 },
  { date: '25/05', owners: 4, tenants: 17 },
  { date: '26/05', owners: 7, tenants: 31 },
  { date: '27/05', owners: 9, tenants: 28 },
  { date: '28/05', owners: 5, tenants: 22 },
  { date: '29/05', owners: 8, tenants: 35 },
  { date: '30/05', owners: 6, tenants: 26 },
  { date: '31/05', owners: 10, tenants: 41 },
  { date: '01/06', owners: 7, tenants: 33 },
  { date: '02/06', owners: 11, tenants: 38 },
  { date: '03/06', owners: 9, tenants: 44 },
];

/** Taux d'activation : % d'inscrits ayant créé ≥ 1 lien de location (jauge). */
export const activationRate = 64;

/** Origine des inscriptions (UTM / sources) + taux de conversion. */
export const utmSources: Array<{ source: string; signups: number; conversion: number }> = [
  { source: 'Google Ads — Brand', signups: 142, conversion: 7.8 },
  { source: 'SEO — Blog', signups: 98, conversion: 4.2 },
  { source: 'Organique / Direct', signups: 76, conversion: 5.1 },
  { source: 'LinkedIn Ads', signups: 54, conversion: 3.4 },
  { source: 'Parrainage', signups: 31, conversion: 11.6 },
];

/* ─────────────────────────  Onglet C — Moteur IA & Forensic  ───────────────────────── */

/**
 * Répartition des grades attribués par l'IA.
 * Note dark-mode : « Platinum » est rendu en métal clair (et non noir) pour
 * rester lisible sur fond slate-900 — platine = blanc argenté.
 */
export const gradeDistribution: Array<{ grade: string; value: number; color: string }> = [
  { grade: 'Platinum', value: 118, color: '#e2e8f0' },
  { grade: 'Gold', value: 167, color: '#f59e0b' },
  { grade: 'Silver', value: 174, color: '#94a3b8' },
  { grade: 'Alerte', value: 67, color: '#ef4444' },
];

/** Mur de protection anti-fraude (ce mois). */
export const fraudWall: { blocked: number; analyzed: number } = {
  blocked: 47,
  analyzed: 526,
};

/** Estimation des coûts LLM (surveillance de la rentabilité vs abonnements). */
export const llmCosts: Array<{ model: string; usage: string; requests: number; estCost: number }> = [
  { model: 'GPT-4o — Vision OCR', usage: 'Analyse de pièces', requests: 1840, estCost: 92.4 },
  { model: 'GPT-4o-mini — Scoring', usage: 'Patrimomètre', requests: 3120, estCost: 21.8 },
  { model: 'GPT-4o — Forensic V2', usage: 'Anti-fraude', requests: 526, estCost: 47.3 },
  { model: 'text-embedding-3', usage: 'Index résilience', requests: 4980, estCost: 6.2 },
];
