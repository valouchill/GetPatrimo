import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import QRCode from 'qrcode';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PassportPDFDocument, PassportData } from '@/app/components/PassportPDF';

/**
 * GET /api/passport/pdf/[id]
 * Génère et retourne le PDF du Passeport Souverain
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDiditDb();
    const { id } = await params;
    
    // Récupérer l'application complète
    const app = await Application.findById(id).lean();
    
    if (!app) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    }
    
    const appData = app as any;
    const profile = appData.profile || {};
    const patrimometer = appData.patrimometer || {};
    const didit = appData.didit || {};
    const guarantor = appData.guarantor || {};
    const financialSummary = appData.financialSummary || {};
    const breakdown = patrimometer.breakdown || {};
    
    // URL absolue obligatoire pour que le QR code du PDF fonctionne au scan
    const host = request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 
      (host ? `${proto}://${host}` : '') || 
      'https://doc2loc.com';
    
    // Générer ou récupérer le slug
    let slug = appData.passportSlug;
    if (!slug) {
      const crypto = await import('crypto');
      const safeName = (profile.firstName || 'dossier').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 12);
      const suffix = crypto.randomBytes(4).toString('hex');
      slug = safeName + '-' + suffix;
      await Application.findByIdAndUpdate(id, { passportSlug: slug });
    }
    
    const verificationUrl = `${baseUrl}/p/${slug}`;
    
    // Générer le QR code en base64
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#1A1A2E',
        light: '#FFFFFF',
      },
    });
    
    // Calculer le taux d'effort si on a les données
    let effortRate: number | undefined;
    const monthlyIncome = financialSummary.totalMonthlyIncome || 0;
    
    // Préparer les données du passeport
    const passportData: PassportData = {
      firstName: profile.firstName || didit.identityData?.firstName || 'Prénom',
      lastName: profile.lastName || didit.identityData?.lastName || 'Nom',
      birthDate: profile.birthDate || didit.identityData?.birthDate,
      photoUrl: undefined,
      identityVerified: didit.status === 'VERIFIED',
      identityVerifiedAt: didit.verifiedAt ? new Date(didit.verifiedAt).toLocaleDateString('fr-FR') : undefined,
      
      score: patrimometer.score || 0,
      grade: patrimometer.grade || 'F',
      
      monthlyIncome: monthlyIncome > 0 ? monthlyIncome : undefined,
      rentAmount: undefined,
      effortRate,
      
      guarantorType: guarantor.hasGuarantor ? (guarantor.certificationMethod === 'VISALE' ? 'VISALE' : 'PHYSICAL') : 'NONE',
      guarantorStatus: guarantor.status,
      
      pillars: {
        identity: {
          score: breakdown.identity || 0,
          verified: didit.status === 'VERIFIED',
        },
        domicile: {
          score: 0,
          verified: appData.documents?.some((d: any) => d.category === 'address' && d.status === 'certified') || false,
        },
        activity: {
          score: 0,
          verified: appData.documents?.some((d: any) => 
            (d.type === 'contrat_travail' || d.type === 'attestation_employeur') && d.status === 'certified'
          ) || false,
        },
        resources: {
          score: breakdown.income || 0,
          verified: financialSummary.certifiedIncome || false,
        },
      },
      
      certificationDate: new Date().toLocaleDateString('fr-FR'),
      passportId: `PT-${new Date().getFullYear()}-${id.toString().slice(-8).toUpperCase()}`,
      qrCodeDataUrl,
      verificationUrl,
    };
    
    // Générer le PDF avec @react-pdf/renderer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfElement = React.createElement(PassportPDFDocument, { data: passportData }) as any;
    const pdfBuffer = await renderToBuffer(pdfElement);
    
    // Nom du fichier
    const fileName = `Passeport_Souverain_${profile.firstName || 'Dossier'}_${profile.lastName || ''}_${new Date().toISOString().slice(0, 10)}.pdf`;
    
    // Retourner le PDF (convertir Buffer en Uint8Array pour NextResponse)
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
