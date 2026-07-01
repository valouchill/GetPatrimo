/**
 * mockAdminData — ESTIMATIONS & séries non trackées en base.
 *
 * Le Cockpit fusionne des données RÉELLES (agrégats Mongo, cf. lib/admin/cockpit-data.ts)
 * avec ce module pour tout ce qui n'est PAS encore mesuré :
 *   1. Coûts API unitaires (aucune table de coûts → estimés).
 *   2. Tendances historiques (aucun snapshot mensuel → courbes représentatives).
 *   3. Origine des inscriptions / UTM (non trackée → mock).
 *
 * ⚠️ À remplacer par un vrai tracking (table `ApiCostLog`, snapshots MRR mensuels,
 * champ `source`/UTM sur User) au fil de l'instrumentation.
 */

/* ───────────────  1. Coûts API unitaires estimés (€)  ─────────────── */

export const API_COST_ESTIMATES = {
  /** GPT-4o vision (OCR des pièces) + scoring patrimomètre + forensic V2, par dossier. */
  llmPerDossier: 0.09,
  /** Vérification biométrique eIDAS Didit, par KYC (500/mois gratuites, puis 0,25 €). */
  diditPerKyc: 0.25,
  /** OCR/extraction complémentaire, par dossier. */
  ocrPerDossier: 0.02,
  /** Envoi transactionnel (Brevo), par email. */
  mailPerSend: 0.0008,
  /** Frais Stripe : 1,5 % + 0,25 € par transaction. */
  stripeFeeRate: 0.015,
  stripeFeeFixed: 0.25,

  /* — Hypothèses de volume dérivé (faute de tracking fin) — */
  /** Part des dossiers déclenchant un KYC Didit. */
  kycRatePerDossier: 0.6,
  /** Emails transactionnels par dossier (invitations, magic links, notifications). */
  mailsPerDossier: 3,
};

/* ───────────────  2. Tendance Revenus vs Coûts API — 6 mois  ───────────────
 * Pas de snapshots mensuels en base → tendance estimée. Le DERNIER point est
 * écrasé par les valeurs RÉELLES (MRR + overage / coûts estimés) dans
 * getCockpitData() pour ancrer la courbe sur le présent.
 */
export const revenueVsCostTrend: Array<{ month: string; revenue: number; apiCost: number }> = [
  { month: 'Janv.', revenue: 6240, apiCost: 690 },
  { month: 'Févr.', revenue: 7180, apiCost: 760 },
  { month: 'Mars', revenue: 8430, apiCost: 910 },
  { month: 'Avr.', revenue: 9870, apiCost: 1020 },
  { month: 'Mai', revenue: 11120, apiCost: 1180 },
  { month: 'Juin', revenue: 12450, apiCost: 1290 },
];

/* ───────────────  3. Coût par dossier — 30 jours  ───────────────
 * Aucun tracking par jour → courbe représentative. Contient une ANOMALIE
 * volontaire (pic ~J-11) pour illustrer la détection d'une dérive de tokens.
 */
export const costPerDossier30d: Array<{ day: string; cost: number }> = [
  { day: 'J-29', cost: 0.108 }, { day: 'J-28', cost: 0.111 }, { day: 'J-27', cost: 0.105 },
  { day: 'J-26', cost: 0.112 }, { day: 'J-25', cost: 0.109 }, { day: 'J-24', cost: 0.114 },
  { day: 'J-23', cost: 0.107 }, { day: 'J-22', cost: 0.113 }, { day: 'J-21', cost: 0.110 },
  { day: 'J-20', cost: 0.116 }, { day: 'J-19', cost: 0.112 }, { day: 'J-18', cost: 0.118 },
  { day: 'J-17', cost: 0.115 }, { day: 'J-16', cost: 0.121 }, { day: 'J-15', cost: 0.119 },
  { day: 'J-14', cost: 0.123 }, { day: 'J-13', cost: 0.128 }, { day: 'J-12', cost: 0.142 },
  { day: 'J-11', cost: 0.217 }, { day: 'J-10', cost: 0.198 }, { day: 'J-9', cost: 0.151 },
  { day: 'J-8', cost: 0.124 }, { day: 'J-7', cost: 0.118 }, { day: 'J-6', cost: 0.115 },
  { day: 'J-5', cost: 0.117 }, { day: 'J-4', cost: 0.113 }, { day: 'J-3', cost: 0.116 },
  { day: 'J-2', cost: 0.112 }, { day: 'J-1', cost: 0.114 }, { day: "Auj.", cost: 0.111 },
];

/* ───────────────  4. Sources d'acquisition (UTM)  ───────────────
 * Aucun champ `source`/UTM sur User → mock. Câbler en taguant l'inscription.
 */
export const utmSources: Array<{ source: string; signups: number; conversion: number }> = [
  { source: 'Google Ads — Brand', signups: 142, conversion: 7.8 },
  { source: 'SEO — Blog', signups: 98, conversion: 4.2 },
  { source: 'Organique / Direct', signups: 76, conversion: 5.1 },
  { source: 'LinkedIn Ads', signups: 54, conversion: 3.4 },
  { source: 'Parrainage', signups: 31, conversion: 11.6 },
];
