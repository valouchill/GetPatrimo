/**
 * POST /api/owner/demo-analysis?variant=clean|fraud
 *
 * Mode « dossier exemple » : exécute le pipeline d'analyse réel sur une FIXTURE
 * (pas un vrai dossier), pour faire vivre le « aha moment » à un propriétaire
 * fraîchement inscrit, sans locataire réel.
 *
 * Garanties :
 *   - AUCUNE écriture MÉTIER Mongo (pas d'Application, pas de Property) ni décompte
 *     de quota / d'essai gratuit (isolé du hot-path facturation analyze-v2).
 *   - AUCUN appel Didit (l'identité est un simple booléen dans la fixture).
 *   - Seule écriture Mongo : la ligne ApiCostLog du scoring LLM (~0,04 €), taggée
 *     `isSample` → exclue de la marge/COGS du cockpit (cf. cockpit-data.ts) et
 *     comptée pour PLAFONNER la dépense.
 *
 * Garde-fous de coût (argent réel contre la clé OpenAI — anti « denial-of-wallet ») :
 *   - Réservé aux rôles propriétaire / admin.
 *   - Cooldown 15 s (anti double-clic, process-local).
 *   - Plafond quotidien PERSISTANT par utilisateur ET global (compté sur
 *     ApiCostLog.meta.isSample) → indépendant du process/replica, survit aux restarts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import { runFullAnalysis } from '@/lib/ai/tenant-analyzer';
import { getDemoFixture } from '@/lib/ai/demo-fixtures';
import { isEnabled } from '@/lib/features';
import ApiCostLog from '@/models/ApiCostLog';

const COOLDOWN_MS = 15_000;
// Chaque run démo = 1 appel OpenAI (~0,04 €). Plafonds quotidiens DURS :
const DEMO_DAILY_PER_USER = 10;
const DEMO_DAILY_GLOBAL = 1_000; // plafond absolu ~40 €/jour, tous comptes confondus
const ALLOWED_ROLES = ['owner', 'admin', 'superadmin'];

const cooldownRegistry = new Map<string, number>();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!isEnabled('DEMO_MODE_ALLOWED')) {
      return NextResponse.json({ error: 'Démo indisponible' }, { status: 404 });
    }

    // Auth requise (propriétaire connecté).
    const session = await getServerSession(authOptions as any);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    const sUser = (session as any).user || {};
    const userId = String(sUser.id || sUser._id || '');
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    // Réservé aux propriétaires/admin (réduit la surface d'abus de coût,
    // aligné sur le préfixe /api/owner). Rôle absent → toléré (fail-open léger,
    // le plafond de dépense reste le vrai garde-fou).
    const role = String(sUser.role || '').toLowerCase();
    if (role && !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Réservé aux propriétaires' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const variant = searchParams.get('variant') || 'clean';
    const fixture = getDemoFixture(variant);
    if (!fixture) {
      return NextResponse.json({ error: 'Variante inconnue' }, { status: 400 });
    }

    // Cooldown 15 s (anti double-clic) — throttle process-local, PAS le plafond.
    const key = `${userId}:${variant}`;
    const now = Date.now();
    const last = cooldownRegistry.get(key) || 0;
    if (now - last < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
      return NextResponse.json(
        { error: `Patientez ${wait}s avant de relancer la démo.` },
        { status: 429 },
      );
    }
    cooldownRegistry.set(key, now);

    await connectDiditDb();

    // Plafond de dépense PERSISTANT (denial-of-wallet). Compté sur les lignes
    // ApiCostLog démo (meta.isSample) du jour → survit aux restarts/replicas.
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const [runsUser, runsGlobal] = await Promise.all([
      ApiCostLog.countDocuments({
        'meta.isSample': true,
        'meta.userId': userId,
        createdAt: { $gte: dayStart },
      }),
      ApiCostLog.countDocuments({
        'meta.isSample': true,
        createdAt: { $gte: dayStart },
      }),
    ]);
    if (runsUser >= DEMO_DAILY_PER_USER) {
      return NextResponse.json(
        {
          error:
            'Limite quotidienne de démos atteinte. Revenez demain, ou recevez un vrai dossier via votre lien Sésame.',
        },
        { status: 429 },
      );
    }
    if (runsGlobal >= DEMO_DAILY_GLOBAL) {
      return NextResponse.json(
        {
          error:
            'La démo est temporairement indisponible (trop de sollicitations). Réessayez plus tard.',
        },
        { status: 429 },
      );
    }

    // Aucun quota, aucun Didit, aucune écriture métier — seul le scoring LLM tourne.
    // costMeta { isSample, userId } : coût exclu de la COGS + compté pour le plafond.
    const result = await runFullAnalysis(fixture, {
      costMeta: { isSample: true, source: 'demo-analysis', variant, userId },
    });

    logger.info('demo-analysis success', {
      variant,
      userId,
      runsUserToday: runsUser + 1,
      score: result.resilience.score,
      level: result.resilience.level,
      decision: result.resilience.decision,
    });

    return NextResponse.json({ ...result, demo: true, variant });
  } catch (error) {
    logger.error('POST /api/owner/demo-analysis', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: "Erreur lors de l'analyse démo" },
      { status: 500 },
    );
  }
}
