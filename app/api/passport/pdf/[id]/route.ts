import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import Application from '@/models/Application';
import '@/models/Property';
import QRCode from 'qrcode';
import { generatePassportPdf } from '@/lib/passport-pdf-service';
import { userCanAccessApplicationPassport } from '@/lib/passport-access';
 
const { buildPassportViewModel, ensurePassportSlug } = require('@/src/utils/passportViewModel');

/**
 * GET /api/passport/pdf/[id]
 * Génère et retourne le PDF premium du passeport
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

    // V8.3 — Anti-IDOR : seul le locataire propriétaire du dossier OU le
    // propriétaire du bien lié peut télécharger ce passeport (PII financières).
    const authorized = await userCanAccessApplicationPassport(app as any, session as any);
    if (!authorized) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const host = request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL ||
      (host ? `${proto}://${host}` : '') ||
      'https://doc2loc.com';

    let slug = (app as any).passportSlug;
    if (!slug) {
      slug = ensurePassportSlug(app);
      await Application.findByIdAndUpdate(id, { passportSlug: slug });
    }

    const passport = buildPassportViewModel({
      application: { ...(app as any), passportSlug: slug },
      audience: 'candidate',
      baseUrl,
      slug,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(
      passport.shareEnabled ? passport.shareUrl : passport.previewUrl,
      {
        width: 200,
        margin: 2,
        color: {
          dark: '#064E3B', // Emerald 900 (cohérent palette PDF)
          light: '#FFFFFF',
        },
      },
    );

    // V4.2 — Génération via WeasyPrint (HTML/CSS complet) au lieu de
    // @react-pdf/renderer. Le HTML est construit dans
    // lib/passport-html-template.ts puis rendu par scripts/generate_passport_pdf.py.
    const pdfBuffer = await generatePassportPdf({
      data: passport,
      qrCodeDataUrl,
      ownerSignupUrl: passport.marketing?.ownerSignupUrl,
    });

    const fileName = `Passeport_PatrimoTrust_${passport.hero.fullName || 'Dossier'}_${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
    
  } catch (error) {
    logger.error('GET /api/passport/pdf/[id]', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({
      error: 'Erreur lors de la génération du PDF'
    }, { status: 500 });
  }
}
