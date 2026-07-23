/**
 * POST /api/owner/applications/[id]/analyze-v2
 *
 * Déclenche l'analyse neuro-symbolique d'un dossier candidat :
 *   1. Mapping Application Mongo → AnalysisInputType (déterministe)
 *   2. Appel OpenAI Structured Outputs (lib/ai/tenant-analyzer.ts)
 *   3. Calcul de l'Indice de Résilience (algorithme déterministe)
 *   4. Retour JSON { ai, resilience, meta }
 *
 * Sécurité :
 *   - Auth NextAuth requise (propriétaire connecté)
 *   - Ownership : la Property associée doit appartenir au session.user
 *   - Pas de persistance Mongo dans cette première version (l'appelant
 *     décide quoi persister — typiquement le score dans Application.patrimometer)
 *   - Cooldown 30s anti-double-click (réutilise le pattern existant
 *     /reanalyze/route.ts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import Application from '@/models/Application';
import Property from '@/models/Property';
import User from '@/models/User';
import { runFullAnalysis } from '@/lib/ai/tenant-analyzer';
import type { AnalysisInputType } from '@/lib/ai/analysis-schema';
import {
  checkAnalysisAllowed,
  consumeAnalysisQuota,
  type QuotaProperty,
} from '@/lib/billing/quota-service';
import { FREE_TRIAL_LIMIT } from '@/lib/billing/tiers';
import { isEnabled } from '@/lib/features';
import { captureServer } from '@/lib/analytics/posthog-server';

const COOLDOWN_MS = 30_000;

// In-memory cooldown registry (simple — pour V1, sera remplacé par Redis
// si plusieurs replicas backend)
const cooldownRegistry = new Map<string, number>();

interface MongoApplicationDoc {
  _id: unknown;
  profile?: {
    firstName?: string;
    lastName?: string;
    status?: string;
  };
  property?: { _id?: unknown; owner?: unknown; rentAmount?: number };
  documents?: Array<{
    category?: string;
    type?: string;
    status?: string;
    flagged?: boolean;
    aiAnalysis?: {
      flags?: string[];
      detectedSoftware?: string;
    };
  }>;
  didit?: { status?: string };
  financialSummary?: {
    totalMonthlyIncome?: number;
    certifiedIncome?: boolean;
    incomeSource?: string;
    monthlyIncomeStdDev?: number;
    varianceHigh?: boolean;
  };
  guarantee?: { type?: string };
  guarantor?: {
    profile?: { status?: string };
    financialSummary?: { totalMonthlyIncome?: number };
  };
  patrimometer?: {
    score?: number;
    grade?: string;
    flags?: string[];
  };
}

function buildAnalysisInput(
  app: MongoApplicationDoc,
  rentAmount: number,
): AnalysisInputType {
  const documents = app.documents || [];

  // Compteurs par catégorie
  const hasCategory = (cat: string): boolean =>
    documents.some((d) => (d.category || '').toUpperCase() === cat);

  const payslipsCount = documents.filter(
    (d) =>
      (d.category || '').toUpperCase() === 'INCOME' &&
      ((d.type || '').toUpperCase().includes('PAIE') ||
        (d.type || '').toUpperCase().includes('BULLETIN') ||
        (d.type || '').toUpperCase().includes('SALAIRE')),
  ).length;

  const hasTaxNotice = documents.some(
    (d) =>
      (d.category || '').toUpperCase() === 'INCOME' &&
      ((d.type || '').toUpperCase().includes('IMPOSITION') ||
        (d.type || '').toUpperCase().includes('AVIS')),
  );

  const hasEmployerCertificate = documents.some(
    (d) =>
      (d.category || '').toUpperCase() === 'GUARANTOR' ||
      (d.type || '').toUpperCase().includes('ATTESTATION') ||
      (d.type || '').toUpperCase().includes('CONTRAT'),
  );

  const rejectedCount = documents.filter(
    (d) => (d.status || '').toUpperCase() === 'REJECTED',
  ).length;

  const forensicAlertCount = documents.filter(
    (d) =>
      d.flagged === true ||
      ((d.status || '').toUpperCase() === 'FLAGGED') ||
      ((d.aiAnalysis?.flags || []) as string[]).length > 0,
  ).length;

  // Suspicions software
  const suspiciousSoftwareDetected = documents.some((d) => {
    const detected = d.aiAnalysis?.detectedSoftware || '';
    return /photoshop|canva|illustrator|gimp/i.test(detected);
  });

  // Forensic global status — réutilise patrimometer.flags si présent
  const flagsArr = (app.patrimometer?.flags || []) as string[];
  let forensicStatus: 'CLEAR' | 'REVIEW' | 'ALERT' | 'PENDING' = 'PENDING';
  if (flagsArr.includes('critical_alerts') || rejectedCount > 0) {
    forensicStatus = 'ALERT';
  } else if (flagsArr.includes('authenticity_issues') || forensicAlertCount > 0) {
    forensicStatus = 'REVIEW';
  } else if (documents.length > 0) {
    forensicStatus = 'CLEAR';
  }

  // Calcul du taux d'effort
  const monthlyIncome = app.financialSummary?.totalMonthlyIncome || 0;
  const effortRatePercent =
    rentAmount > 0 && monthlyIncome > 0
      ? Math.round((rentAmount / monthlyIncome) * 1000) / 10
      : null;

  // Mode de garantie
  let guaranteeMode: 'NONE' | 'VISALE' | 'PHYSICAL' = 'NONE';
  const gType = (app.guarantee?.type || '').toUpperCase();
  if (gType.includes('VISALE')) guaranteeMode = 'VISALE';
  else if (gType.includes('PHYSICAL') || app.guarantor) guaranteeMode = 'PHYSICAL';

  return {
    applicationId: String(app._id || ''),
    candidate: {
      firstName: app.profile?.firstName || null,
      lastName: app.profile?.lastName || null,
      profession: app.profile?.status || null,
      employer: null, // Pourrait être extrait du contrat de travail si présent
      contractType: app.profile?.status || null,
      seniorityMonths: null,
    },
    financial: {
      monthlyIncomeNet: monthlyIncome || null,
      targetRent: rentAmount || null,
      effortRatePercent,
      incomeStabilityMonths: app.financialSummary?.varianceHigh ? 3 : 12,
      taxIncomeAnnual: null,
      incomeSource: app.financialSummary?.incomeSource || null,
    },
    identity: {
      diditVerified: app.didit?.status === 'VERIFIED',
      cniPresent: hasCategory('IDENTITY'),
    },
    guarantee: {
      mode: guaranteeMode,
      guarantorIncomeNet:
        app.guarantor?.financialSummary?.totalMonthlyIncome || null,
      coverage: null,
    },
    documents: {
      identityProvided: hasCategory('IDENTITY'),
      payslipsCount,
      taxNoticeProvided: hasTaxNotice,
      addressProofProvided: hasCategory('ADDRESS'),
      employerCertificateProvided: hasEmployerCertificate,
      rejectedCount,
      forensicAlertCount,
    },
    forensic: {
      globalStatus: forensicStatus,
      suspiciousSoftwareDetected,
      mathematicalInconsistencies: forensicAlertCount > 0,
    },
  };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDiditDb();

    const session = await getServerSession(authOptions as any);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;

    // Cooldown anti-double-click
    const cooldownKey = `${(session as any)?.user?.id || 'anon'}:${id}`;
    const lastRun = cooldownRegistry.get(cooldownKey) || 0;
    const now = Date.now();
    if (now - lastRun < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (now - lastRun)) / 1000);
      return NextResponse.json(
        { error: `Patientez ${wait}s avant de relancer l'analyse.` },
        { status: 429 },
      );
    }

    // Récupération + validation ownership
    const app = (await Application.findById(id)
      .select('profile property documents didit financialSummary guarantee guarantor patrimometer')
      .lean()) as MongoApplicationDoc | null;

    if (!app) {
      return NextResponse.json(
        { error: 'Candidature introuvable' },
        { status: 404 },
      );
    }

    // V8.0 — Doc MUTABLE (pas .lean()) : on doit pouvoir incrémenter le
    // quota et sauvegarder après une analyse réussie.
    const property = await Property.findById(
      (app as any).property as unknown,
    ).select(
      'user rentAmount tier dossiersQuota dossiersAnalyzedCount analyzedApplicationIds overageReportedCount stripeCustomerId stripeSubscriptionId managed',
    );

    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }

    // Sécurité (revue V1 — S2) : propriétaire = `user` ; fail-closed.
    const userId = (session as any)?.user?.id || (session as any)?.user?._id;
    const propertyOwner = String((property as any).user || '');
    if (!userId || propertyOwner !== String(userId)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Essai gratuit au niveau du COMPTE : compteur du propriétaire (plafond FREE_TRIAL_LIMIT).
    const ownerUser = (await User.findById(propertyOwner)
      .select('freeAnalysesUsed')
      .lean()) as { freeAnalysesUsed?: number } | null;
    const accountFreeUsed = Number(ownerUser?.freeAnalysesUsed || 0);

    // ─── V8.0 — Garde-fou Pay-per-Listing ──────────────────────────────
    // Vérifie l'offre du bien AVANT de lancer l'analyse (économise un
    // appel OpenAI si essai épuisé / non autorisé). Enforcement piloté par BILLING_ENFORCED.
    const quotaCheck = checkAnalysisAllowed(
      property as unknown as QuotaProperty,
      id,
      { enforced: isEnabled('BILLING_ENFORCED'), accountFreeUsed },
    );
    if (!quotaCheck.allowed) {
      captureServer('paywall_viewed', String(userId), {
        reason: quotaCheck.reason,
        tier: quotaCheck.tier,
        source: 'analyze_v2',
      });
      // 402 : essai gratuit du compte épuisé (souscrire) ou quota payant épuisé (racheter).
      const quotaExceeded = quotaCheck.reason === 'QUOTA_EXCEEDED';
      if (quotaCheck.reason === 'FREE_TRIAL_EXHAUSTED') {
        // Rattrapage growth : marque l'épuisement pour la relance paywall J+2 —
        // couvre la cohorte épuisée AVANT le déploiement du champ et le cas où
        // le marquage au moment du franchissement a échoué. Non bloquant.
        User.updateOne(
          { _id: propertyOwner, freeTrialExhaustedAt: null },
          { $set: { freeTrialExhaustedAt: new Date() } },
        ).catch(() => { /* fire-and-forget */ });
      }
      return NextResponse.json(
        {
          error: quotaExceeded
            ? `Audits épuisés pour ce bien (${quotaCheck.used}/${quotaCheck.quota}). Rachetez une offre : vos crédits se cumulent, rien n'est perdu.`
            : `${quotaCheck.quota === 1 ? 'Votre audit d’essai est utilisé' : `Vos ${quotaCheck.quota} audits d’essai sont utilisés`}. Débloquez l'identité, les coordonnées et les pièces de TOUS vos candidats + de nouveaux audits dès 19,90 €.`,
          code: quotaExceeded ? 'QUOTA_EXCEEDED' : 'PAYMENT_REQUIRED',
          tier: quotaCheck.tier,
          quota: quotaCheck.quota,
          used: quotaCheck.used,
          // Achat direct pour CE bien (PricingTiers lit ?property=).
          pricingUrl: `/pricing?property=${String((property as any)._id)}`,
        },
        { status: 402 },
      );
    }

    const rentAmount = Number((property as any).rentAmount || 0);

    // Mapping Mongo → AnalysisInputType
    const analysisInput = buildAnalysisInput(app, rentAmount);

    // Pipeline neuro-symbolique
    cooldownRegistry.set(cooldownKey, now);
    const result = await runFullAnalysis(analysisInput);

    // ─── V8.0 — Consommation du quota APRÈS succès ─────────────────────
    // (jamais avant : on ne facture pas un dossier dont l'analyse a échoué)
    let quotaConsumption: Awaited<ReturnType<typeof consumeAnalysisQuota>> | null =
      null;
    try {
      if (quotaCheck.mode === 'FREE_TRIAL') {
        // Essai gratuit : décompte ATOMIQUE au niveau du COMPTE (borné à FREE_TRIAL_LIMIT)
        // + dédup du dossier sur le bien (re-analyse ultérieure gratuite).
        await User.updateOne(
          { _id: propertyOwner, freeAnalysesUsed: { $lt: FREE_TRIAL_LIMIT } },
          { $inc: { freeAnalysesUsed: 1 } },
        );
        await Property.updateOne(
          { _id: (property as any)._id, analyzedApplicationIds: { $ne: id } },
          { $addToSet: { analyzedApplicationIds: id } },
        );
        // Growth : horodate l'épuisement de l'essai (relance paywall J+2).
        // APRÈS le dédup Property (un échec ici ne doit pas casser l'invariant
        // « un crédit par dossier ») ; le chemin 402 sert de rattrapage.
        await User.updateOne(
          { _id: propertyOwner, freeAnalysesUsed: { $gte: FREE_TRIAL_LIMIT }, freeTrialExhaustedAt: null },
          { $set: { freeTrialExhaustedAt: new Date() } },
        );
      } else {
        quotaConsumption = await consumeAnalysisQuota(
          property as unknown as QuotaProperty,
          id,
          quotaCheck.mode || 'WITHIN_QUOTA',
          isEnabled('BILLING_ENFORCED'),
        );
      }
    } catch (quotaErr) {
      logger.error('analyze-v2 quota consume failed', {
        applicationId: id,
        error:
          quotaErr instanceof Error ? quotaErr.message : String(quotaErr),
      });
    }

    // Persistance Mongo (cache + audit) — évite de rappeler OpenAI à chaque
    // ouverture de la modale. La forme {ai, resilience, meta} est garantie
    // par Zod côté serveur.
    const cachedAt = new Date();
    try {
      await Application.updateOne(
        { _id: id },
        {
          $set: {
            aiAuditV2: {
              ai: result.ai,
              resilience: result.resilience,
              meta: result.meta,
              cachedAt,
            },
          },
        },
      );
    } catch (persistErr) {
      // Erreur de persistance non-bloquante : on log + on retourne quand
      // même le résultat à l'utilisateur (qui voit l'analyse fraîche).
      logger.warn('analyze-v2 persist failed', {
        applicationId: id,
        error:
          persistErr instanceof Error ? persistErr.message : String(persistErr),
      });
    }

    logger.info('analyze-v2 success', {
      applicationId: id,
      score: result.resilience.score,
      level: result.resilience.level,
      decision: result.resilience.decision,
      hardGates: result.resilience.hardGates.length,
      cachedAt: cachedAt.toISOString(),
      quotaMode: quotaConsumption?.mode,
      quotaUsed: quotaConsumption?.used,
      overageBilled: quotaConsumption?.overageBilled,
    });

    captureServer('analysis_completed', String(userId), {
      tier: quotaCheck.tier,
      grade: result.resilience.level,
      score: result.resilience.score,
      decision: result.resilience.decision,
      fraud_detected: result.ai?.flags?.isFraudDetected === true,
    });

    return NextResponse.json({
      ...result,
      cachedAt: cachedAt.toISOString(),
      // V8.0 — état du quota après cette analyse (pour la jauge front)
      quota: quotaConsumption
        ? {
            tier: quotaCheck.tier,
            used: quotaConsumption.used,
            quota: quotaConsumption.quota,
            mode: quotaConsumption.mode,
            overageBilled: quotaConsumption.overageBilled,
          }
        : null,
      // Essai gratuit : compteur APRÈS cette analyse (rappel doux côté front —
      // évite le mur brutal au 4e dossier) + achat direct pour ce bien.
      freeTrial:
        quotaCheck.mode === 'FREE_TRIAL'
          ? {
              used: Math.min(accountFreeUsed + 1, FREE_TRIAL_LIMIT),
              limit: FREE_TRIAL_LIMIT,
              pricingUrl: `/pricing?property=${String((property as any)._id)}`,
            }
          : null,
    });
  } catch (error) {
    logger.error('POST /api/owner/applications/[id]/analyze-v2', {
      error: error instanceof Error ? error.message : error,
    });
    // Sécurité (audit passe-5) : message générique — pas de fuite de l'exception interne au client.
    return NextResponse.json({ error: 'Erreur lors de l\'analyse' }, { status: 500 });
  }
}

/**
 * GET /api/owner/applications/[id]/analyze-v2
 *
 * Lecture seule du cache aiAuditV2 — n'invoque PAS OpenAI.
 *   200 : analyse cachée trouvée → retourne {ai, resilience, meta, cachedAt}
 *   204 : pas de cache (analyse jamais lancée)
 *   401 : non authentifié
 *   403 : accès refusé (ownership)
 *   404 : candidature introuvable
 *
 * Pattern client : appeler GET au montage de la modale d'audit pour afficher
 * l'analyse en cache instantanément. Si 204, afficher l'état "Lancer l'analyse".
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await connectDiditDb();

    const session = await getServerSession(authOptions as any);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;

    const app = (await Application.findById(id)
      .select('property aiAuditV2')
      .lean()) as
      | (MongoApplicationDoc & { aiAuditV2?: unknown })
      | null;

    if (!app) {
      return NextResponse.json(
        { error: 'Candidature introuvable' },
        { status: 404 },
      );
    }

    const property = await Property.findById((app as any).property as unknown)
      .select('user')
      .lean();

    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }

    // Sécurité (revue V1 — S2) : propriétaire = `user` ; fail-closed.
    const userId = (session as any)?.user?.id || (session as any)?.user?._id;
    const propertyOwner = String((property as any).user || '');
    if (!userId || propertyOwner !== String(userId)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    if (!app.aiAuditV2) {
      // Pas de cache — 204 (No Content) pour que le client affiche
      // l'état initial "Lancer l'analyse"
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(app.aiAuditV2);
  } catch (error) {
    logger.error('GET /api/owner/applications/[id]/analyze-v2', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: 'Erreur lors de la lecture du cache' },
      { status: 500 },
    );
  }
}
