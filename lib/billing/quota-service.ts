/**
 * quota-service.ts — Garde-fous backend "Pay-per-Listing" (V8.0).
 *
 * Logique de vérification + consommation du quota d'analyses IA par bien.
 * Utilisé par la route POST /api/owner/applications/[id]/analyze-v2.
 *
 * Modèle one-time : achat unique d'une offre (ESSENTIAL/PREMIUM/MAX) → quota fixe
 * d'analyses IA par bien. Au-delà du quota : PLAFOND DUR (racheter une offre), pas
 * de facturation à l'usage.
 *
 * Flux :
 *   1. checkAnalysisAllowed(property, applicationId)
 *      - FREE                       → { allowed:false, reason:'FREE' } (HTTP 402)
 *      - déjà comptabilisé          → { allowed:true,  mode:'ALREADY_COUNTED' }
 *      - dans le quota              → { allowed:true,  mode:'WITHIN_QUOTA' }
 *      - quota épuisé (enforced)    → { allowed:false, reason:'QUOTA_EXCEEDED' } (HTTP 402)
 *   2. (analyse réussie)
 *   3. consumeAnalysisQuota(property, applicationId, mode)
 *      - incrémente dossiersAnalyzedCount + ajoute l'app à analyzedApplicationIds
 *
 * On consomme APRÈS le succès de l'analyse pour ne jamais décompter un
 * dossier dont l'analyse a échoué.
 */

import 'server-only';
import { logger } from '@/lib/server-logger';
import { effectiveQuota, effectiveTier, FREE_TRIAL_LIMIT, type PropertyTier } from './tiers';

export type QuotaMode =
  | 'WITHIN_QUOTA'
  | 'ALREADY_COUNTED'
  // Essai gratuit : analyse FREE décomptée au niveau du COMPTE (User.freeAnalysesUsed).
  | 'FREE_TRIAL'
  // V8.0 — mode SOFT : offre FREE autorisée car enforcement désactivé.
  // Ne consomme PAS de quota (suivi visuel uniquement).
  | 'SOFT_FREE';

export interface QuotaCheck {
  allowed: boolean;
  /** Si allowed=false : 'QUOTA_EXCEEDED' (quota payant épuisé) ou 'FREE_TRIAL_EXHAUSTED'
   *  (3 analyses d'essai du compte épuisées). */
  reason?: 'QUOTA_EXCEEDED' | 'FREE_TRIAL_EXHAUSTED';
  /** Renseigné si allowed=true */
  mode?: QuotaMode;
  tier: PropertyTier;
  quota: number;
  used: number;
}

/** Forme minimale d'une Property mongoose pour le quota (doc mutable). */
export interface QuotaProperty {
  _id: unknown;
  tier?: string;
  dossiersQuota?: number;
  dossiersAnalyzedCount?: number;
  analyzedApplicationIds?: string[];
  overageReportedCount?: number;
  stripeCustomerId?: string;
  stripeUsageItemId?: string;
  stripeSubscriptionId?: string;
  managed?: boolean;
  save?: () => Promise<unknown>;
  markModified?: (path: string) => void;
}

/**
 * Vérifie si une analyse IA est autorisée pour ce bien + ce dossier.
 * NE MUTE RIEN — c'est consumeAnalysisQuota qui persiste.
 *
 * @param opts.enforced  Si false (soft-launch), une offre FREE n'est PAS
 *   bloquée (mode SOFT_FREE) — utile tant que Stripe n'est pas configuré.
 *   Piloté par le flag BILLING_ENFORCED côté route.
 */
export function checkAnalysisAllowed(
  property: QuotaProperty,
  applicationId: string,
  opts: { enforced?: boolean; accountFreeUsed?: number } = {},
): QuotaCheck {
  // V8.0 — offre EFFECTIVE (grandfather les biens `managed` legacy en PREMIUM)
  const tier = effectiveTier(property);
  const quota = effectiveQuota(property);
  const used = Number(property.dossiersAnalyzedCount || 0);
  const already = (property.analyzedApplicationIds || []).map(String);

  // FREE — essai gratuit au niveau du COMPTE (3 analyses au TOTAL, pas par bien).
  if (tier === 'FREE') {
    // Soft-launch (enforcement off) : autorisé sans blocage ni décompte.
    if (!opts.enforced) {
      return { allowed: true, mode: 'SOFT_FREE', tier, quota, used };
    }
    // Re-analyse d'un dossier déjà compté sur ce bien → gratuit.
    if (already.includes(String(applicationId))) {
      return { allowed: true, mode: 'ALREADY_COUNTED', tier, quota, used };
    }
    const freeUsed = Number(opts.accountFreeUsed || 0);
    if (freeUsed < FREE_TRIAL_LIMIT) {
      return { allowed: true, mode: 'FREE_TRIAL', tier, quota: FREE_TRIAL_LIMIT, used: freeUsed };
    }
    return { allowed: false, reason: 'FREE_TRIAL_EXHAUSTED', tier, quota: FREE_TRIAL_LIMIT, used: freeUsed };
  }

  // ── Offre payante : quota PAR BIEN ──
  // Dossier déjà analysé/comptabilisé → pas de re-décompte (re-analyse libre)
  if (already.includes(String(applicationId))) {
    return { allowed: true, mode: 'ALREADY_COUNTED', tier, quota, used };
  }

  // Dans le quota inclus ?
  if (used < quota) {
    return { allowed: true, mode: 'WITHIN_QUOTA', tier, quota, used };
  }

  // Quota épuisé — modèle one-time : PLAFOND DUR (il faut racheter une offre).
  if (opts.enforced) {
    return { allowed: false, reason: 'QUOTA_EXCEEDED', tier, quota, used };
  }
  // Soft-launch (enforcement off) : on n'impose pas le plafond — suivi visuel only.
  return { allowed: true, mode: 'WITHIN_QUOTA', tier, quota, used };
}

export interface QuotaConsumption {
  mode: QuotaMode;
  used: number;
  quota: number;
  /** @deprecated modèle one-time : toujours false (plus de facturation à l'usage) */
  overageBilled: boolean;
}

/**
 * Consomme le quota après une analyse réussie. Persiste la Property.
 *  - ALREADY_COUNTED / SOFT_FREE → no-op (pas de décompte)
 *  - WITHIN_QUOTA → +1 dossier distinct, push l'app id
 *
 * @param enforced  Plafond dur actif (BILLING_ENFORCED). Quand `true`, le décompte est
 *   borné ATOMIQUEMENT par `dossiersAnalyzedCount < quota` : deux analyses concurrentes
 *   de dossiers DIFFÉRENTS passant toutes deux le check (used == quota-1) ne peuvent plus
 *   faire dépasser le compteur au-delà du quota payé (race check→consume). En soft-launch
 *   (`enforced=false`) on NE borne PAS — le compteur sert de suivi visuel et peut dépasser.
 */
export async function consumeAnalysisQuota(
  property: QuotaProperty,
  applicationId: string,
  mode: QuotaMode,
  enforced: boolean = false,
): Promise<QuotaConsumption> {
  const quota = effectiveQuota(property);

  // SOFT_FREE (enforcement off) ou ALREADY_COUNTED → aucune consommation.
  // FREE_TRIAL est décompté au niveau du COMPTE (analyze-v2), pas par bien → no-op ici.
  if (mode === 'ALREADY_COUNTED' || mode === 'SOFT_FREE' || mode === 'FREE_TRIAL') {
    return {
      mode,
      used: Number(property.dossiersAnalyzedCount || 0),
      quota,
      overageBilled: false,
    };
  }

  // Décompte ATOMIQUE du dossier distinct (revue V1 — S12) : évite double-compte /
  // sous-compte en analyses concurrentes. Filtre `$ne` + `$addToSet` = idempotent par
  // dossier ; `$inc` atomique = pas de « last-writer-wins » sur le compteur.
  // Audit passe-4 (quota-race) : quand le plafond est imposé, on ajoute la borne
  // `dossiersAnalyzedCount < quota` AU FILTRE pour que l'$inc ne franchisse jamais le
  // quota, même sous course concurrente (le check `used < quota` seul est TOCTOU).

  const PropertyModel = require('@/models/Property');
  const appIdStr = String(applicationId);
  const propId = (property as { _id: unknown })._id;
  const filter: Record<string, unknown> = {
    _id: propId,
    analyzedApplicationIds: { $ne: appIdStr },
  };
  if (enforced) {
    filter.dossiersAnalyzedCount = { $lt: quota };
  }
  const updated = await PropertyModel.findOneAndUpdate(
    filter,
    { $inc: { dossiersAnalyzedCount: 1 }, $addToSet: { analyzedApplicationIds: appIdStr } },
    { new: true },
  ).lean();

  // updated === null ⇒ soit le dossier est déjà compté (course / ré-analyse), soit
  // (enforced) le quota est déjà atteint car une analyse concurrente a pris le dernier
  // crédit : dans les deux cas on ne recompte pas (le compteur reste ≤ quota).
  if (!updated) {
    return { mode, used: Number(property.dossiersAnalyzedCount || 0), quota, overageBilled: false };
  }

  return {
    mode,
    used: Number((updated as { dossiersAnalyzedCount?: number }).dossiersAnalyzedCount || 0),
    quota,
    overageBilled: false,
  };
}
