import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import Application from '@/models/Application';
import '@/models/Property';
import { userCanAccessApplicationPassport } from '@/lib/passport-access';
 
const { buildPassportViewModel, ensurePassportSlug } = require('@/src/utils/passportViewModel');

/**
 * GET /api/passport/application/[id]
 * Retourne le view-model complet du passeport candidat
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDiditDb();

    const session = await getServerSession(authOptions as any);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    const app = await Application.findById(id)
      .populate('property', 'name address rentAmount')
      .populate('guarantor.guarantorId', 'firstName lastName identityVerification')
      .lean();
    if (!app) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    }

    // V8.3 — Anti-IDOR : locataire propriétaire du dossier OU propriétaire
    // du bien lié uniquement.
    const authorized = await userCanAccessApplicationPassport(app as any, session as any);
    if (!authorized) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    let slug = (app as any).passportSlug;
    if (!slug) {
      slug = ensurePassportSlug(app);
      await Application.findByIdAndUpdate(id, { passportSlug: slug });
    }
    const host = request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL ||
      (host ? `${proto === 'https' ? 'https' : 'http'}://${host}` : '') ||
      'https://maisonpatrimo.com';
    const passport = buildPassportViewModel({
      application: { ...(app as any), passportSlug: slug },
      audience: 'candidate',
      baseUrl,
      slug,
    });

    return NextResponse.json({
      ...passport,
      lastViewedAt: (app as any).passportLastViewedAt ?? null,
    });
  } catch (e) {
    logger.error('GET /api/passport/application/[id]', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
