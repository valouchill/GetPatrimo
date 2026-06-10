/**
 * quota-service.ts — Garde-fous backend "Pay-per-Listing" (V8.0).
 *
 * Logique de vérification + consommation du quota d'analyses IA par bien.
 * Utilisé par la route POST /api/owner/applications/[id]/analyze-v2.
 *
 * Flux :
 *   1. checkAnalysisAllowed(property, applicationId)
 *      - FREE                       → { allowed:false, reason:'FREE' } (HTTP 402)
 *      - déjà comptabilisé          → { allowed:true,  mode:'ALREADY_COUNTED' }
 *      - dans le quota              → { allowed:true,  mode:'WITHIN_QUOTA' }
 *      - dépassement (over quota)   → { allowed:true,  mode:'OVERAGE' }
 *   2. (analyse réussie)
 *   3. consumeAnalysisQuota(property, applicationId, mode)
 *      - incrémente dossiersAnalyzedCount + ajoute l'app à analyzedApplicationIds
 *      - si OVERAGE : facture 1 unité à Stripe (invoice item, best-effort)
 *
 * On consomme APRÈS le succès de l'analyse pour ne jamais facturer un
 * dossier dont l'analyse a échoué.
 */

import 'server-only';
import { getStripeClient } from '@/lib/admin-stripe';
import { logger } from '@/lib/server-logger';
import { effectiveQuota, effectiveTier, type PropertyTier } from './tiers';

export type QuotaMode =
  | 'WITHIN_QUOTA'
  | 'OVERAGE'
  | 'ALREADY_COUNTED'
  // V8.0 — mode SOFT : offre FREE autorisée car enforcement désactivé.
  // Ne consomme PAS de quota, ne facture rien (suivi visuel uniquement).
  | 'SOFT_FREE';

export interface QuotaCheck {
  allowed: boolean;
  /** Renseigné si allowed=false (seul cas : 'FREE') */
  reason?: 'FREE';
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

  // Dépassement — autorisé mais facturé (metered)
  return { allowed: true, mode: 'OVERAGE', tier, quota, used };
}

/** Prix unitaire du dépassement en centimes (0,49 € par défaut). */
function overageUnitCents(): number {
  const v = Number(process.env.OVERAGE_UNIT_CENTS);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 49;
}

/**
 * Facture N unité(s) de dépassement à Stripe via un "invoice item" posé sur le
 * CLIENT : le montant est ajouté à la PROCHAINE facture de l'abonnement (modèle
 * forfait + à l'usage, facturé en fin de cycle — cf. docs/BILLING.md).
 * Best-effort : une erreur Stripe ne bloque jamais l'analyse (loggée).
 */
async function reportOverageToStripe(
  property: QuotaProperty,
  quantity: number,
): Promise<boolean> {
  const customerId = property.stripeCustomerId;
  if (!customerId) {
    logger.warn('[quota] dépassement non facturé : stripeCustomerId absent', {
      propertyId: String(property._id),
    });
    return false;
  }
  const amount = overageUnitCents() * quantity;
  try {
    const stripe = getStripeClient();
    await stripe.invoiceItems.create({
      customer: customerId,
      amount, // centimes ; ajouté à la prochaine facture du client
      currency: 'eur',
      description: `Dépassement de quota — ${quantity} dossier(s) analysé(s)`,
      metadata: {
        propertyId: String(property._id),
        quantity: String(quantity),
      },
    });
    logger.info('[quota] dépassement facturé à Stripe (invoice item)', {
      propertyId: String(property._id),
      customerId,
      quantity,
      amountCents: amount,
    });
    return true;
  } catch (err) {
    logger.error('[quota] échec facturation overage (invoiceItems.create)', {
      propertyId: String(property._id),
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export interface QuotaConsumption {
  mode: QuotaMode;
  used: number;
  quota: number;
  /** True si une unité de dépassement a été reportée à Stripe avec succès */
  overageBilled: boolean;
}

/**
 * Consomme le quota après une analyse réussie. Persiste la Property.
 *  - ALREADY_COUNTED → no-op (le dossier était déjà décompté)
 *  - WITHIN_QUOTA / OVERAGE → +1 dossier distinct, push l'app id
 *  - OVERAGE → report Stripe + overageReportedCount++
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
  // on ne recompte pas et on ne refacture pas le dépassement.
  if (!updated) {
    return { mode, used: Number(property.dossiersAnalyzedCount || 0), quota, overageBilled: false };
  }

  let overageBilled = false;
  if (mode === 'OVERAGE') {
    overageBilled = await reportOverageToStripe(property, 1);
    if (overageBilled) {
      await PropertyModel.updateOne({ _id: propId }, { $inc: { overageReportedCount: 1 } });
    }
  }

  return {
    mode,
    used: Number((updated as { dossiersAnalyzedCount?: number }).dossiersAnalyzedCount || 0),
    quota,
    overageBilled,
  };
}
