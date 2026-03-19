import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import '@/models/Property';
import QRCode from 'qrcode';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PassportPDFDocument } from '@/app/components/PassportPDF';
// eslint-disable-next-line @typescript-eslint/no-var-requires
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
    const { id } = await params;
    
    const app = await Application.findById(id)
      .populate('property', 'name address rentAmount')
      .lean();
    
    if (!app) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
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
        dark: '#1A1A2E',
        light: '#FFFFFF',
      },
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfElement = React.createElement(PassportPDFDocument, {
      data: passport,
      qrCodeDataUrl,
    }) as any;
    const pdfBuffer = await renderToBuffer(pdfElement);

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
    console.error('GET /api/passport/pdf/[id]', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la génération du PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
