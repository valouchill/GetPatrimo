import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import { checkRateLimit } from '@/lib/rate-limit';
import Property from '@/models/Property';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Anti-abus/scraping (pré-lancement) : endpoint public d'apply. Borne par IP.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`public-apply:${ip}`, { windowMs: 60_000, max: 60 }).allowed) {
      return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
    }
    const { token } = await params;

    // Passeport Locatif universel (codeless) : auto-candidature sans bien.
    // Court-circuit AVANT toute requête DB (un self-token n'a aucun bien associé).
    // Tout autre token introuvable garde le 404 (non-régression du flux invité).
    if (token.startsWith('PT-SELF-')) {
      return NextResponse.json({ property: null, universal: true });
    }

    await connectDiditDb();
    // Sécurité (re-audit V1 — N5) : endpoint PUBLIC → on EXCLUT les champs internes
    // (Stripe, propriétaire, quota) ; on ne renvoie que l'info publique du bien.
    const property = await Property.findOne({ applyToken: token })
      .select('-stripeCustomerId -stripeSubscriptionId -stripeUsageItemId -user -managed -tier -dossiersQuota -dossiersAnalyzedCount -analyzedApplicationIds -overageReportedCount -acceptedTenantId -__v')
      .lean();

    if (!property) {
      return NextResponse.json({ msg: 'Lien invalide' }, { status: 404 });
    }

    return NextResponse.json({ property });
  } catch (error: any) {
    logger.error('GET /api/public/apply/[token]', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { msg: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
