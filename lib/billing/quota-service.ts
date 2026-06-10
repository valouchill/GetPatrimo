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
import { effectiveQuota, effectiveTier, type PropertyTier } from './tiers';

export type QuotaMode =
  | 'WITHIN_QUOTA'
  | 'ALREADY_COUNTED'
  // V8.0 — mode SOFT : offre FREE autorisée car enforcement désactivé.
  // Ne consomme PAS de quota (suivi visuel uniquement).
  | 'SOFT_FREE';

export interface QuotaCheck {
  allowed: boolean;
  /** Si allowed=false : 'FREE' (offre gratuite) ou 'QUOTA_EXCEEDED' (quota épuisé) */
  reason?: 'FREE' | 'QUOTA_EXCEEDED';
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
  opts: { enforced?: boolean } = {},
): QuotaCheck {
  // V8.0 — offre EFFECTIVE (grandfather les biens `managed` legacy en PREMIUM)
  const tier = effectiveTier(property);
  const quota = effectiveQuota(property);
  const used = Number(property.dossiersAnalyzedCount || 0);

  // FREE — l'analyse IA n'est pas incluse.
  if (tier === 'FREE') {
    if (opts.enforced) {
      // HARD : il faut souscrire une offre.
      return { allowed: false, reason: 'FREE', tier, quota, used };
    }
    // SOFT : autorisé (pas de blocage, pas de consommation).
    return { allowed: true, mode: 'SOFT_FREE', tier, quota, used };
  }

  // Dossier déjà analysé/comptabilisé → pas de re-décompte (re-analyse libre)
  const already = (property.analyzedApplicationIds || []).map(String);
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
 */
export async function consumeAnalysisQuota(
  property: QuotaProperty,
  applicationId: string,
  mode: QuotaMode,
): Promise<QuotaConsumption> {
  const quota = effectiveQuota(property);

  // SOFT_FREE (enforcement off) ou ALREADY_COUNTED → aucune consommation.
  if (mode === 'ALREADY_COUNTED' || mode === 'SOFT_FREE') {
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

  const PropertyModel = require('@/models/Property');
  const appIdStr = String(applicationId);
  const propId = (property as { _id: unknown })._id;
  const updated = await PropertyModel.findOneAndUpdate(
    { _id: propId, analyzedApplicationIds: { $ne: appIdStr } },
    { $inc: { dossiersAnalyzedCount: 1 }, $addToSet: { analyzedApplicationIds: appIdStr } },
    { new: true },
  ).lean();

  // updated === null ⇒ dossier déjà compté (course concurrente ou ré-analyse) :
  // on ne recompte pas.
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
