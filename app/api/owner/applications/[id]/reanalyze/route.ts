import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { logger } from '@/lib/server-logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import { safeUploadsPath } from '@/lib/safe-uploads-path';

 
const { analyzeDocumentBuffer } = require('@/src/services/documentAnalysisService');
 
const { deriveApplicationFinancialProfile } = require('@/src/utils/financialExtraction');
 
const Application = require('@/models/Application');
 
const Property = require('@/models/Property');
 
const { connectDiditDb } = require('@/app/api/didit/db');

const REANALYZE_COOLDOWN_MS = 30_000; // 30 secondes anti-double-clic

interface DocumentRecord {
  id?: string;
  type?: string;
  category?: string;
  subjectType?: string;
  fileName?: string;
  fileUrl?: string;
  status?: string;
  aiAnalysis?: Record<string, unknown>;
  dateEmission?: string;
  uploadedAt?: string;
}

// Sécurité (pentest files-2) : l'ancienne résolution renvoyait n'importe quel chemin absolu
// sous /opt/doc2loc/ (dont .env) ou s'évadait via '../'. On confine strictement sous uploads/.
function resolveLocalFilePath(fileUrl: string): string | null {
  return safeUploadsPath(fileUrl);
}

function guessMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function determineCategory(doc: DocumentRecord): string {
  const cat = String(doc.category || '').toUpperCase();
  if (cat === 'IDENTITY') return 'identity';
  if (cat === 'GUARANTOR' || doc.subjectType === 'GUARANTOR') return 'guarantor';
  return 'resources';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = (await getServerSession(authOptions as never)) as { user?: { id?: string; email?: string } } | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID application manquant' }, { status: 400 });
    }

    await connectDiditDb();

    const application = await Application.findById(id);
    if (!application) {
      return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 });
    }

    // Vérifier ownership via property
    const property = await Property.findById(application.property);
    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }
    if (String(property.user) !== String(session.user.id)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // V7.13 — Limite stricte : 1 ré-analyse réussie par dossier.
    // La ré-analyse est une opération coûteuse (appels IA sur chaque pièce) ;
    // une fois le dossier ré-analysé, le résultat fait foi.
    if ((application.reanalyzeCount || 0) >= 1) {
      return NextResponse.json(
        {
          error: 'Ce dossier a déjà été ré-analysé. La ré-analyse est limitée à une fois.',
          code: 'ALREADY_REANALYZED',
        },
        { status: 409 },
      );
    }

    // Rate-limit / anti-double-clic
    const lastReanalyzedAt = application.lastReanalyzedAt
      ? new Date(application.lastReanalyzedAt).getTime()
      : 0;
    const elapsed = Date.now() - lastReanalyzedAt;
    if (elapsed > 0 && elapsed < REANALYZE_COOLDOWN_MS) {
      return NextResponse.json(
        { error: `Ré-analyse en cours. Réessayez dans ${Math.ceil((REANALYZE_COOLDOWN_MS - elapsed) / 1000)}s.` },
        { status: 409 },
      );
    }

    const documents: DocumentRecord[] = Array.isArray(application.documents) ? application.documents : [];
    if (documents.length === 0) {
      return NextResponse.json({ error: 'Aucun document à ré-analyser' }, { status: 400 });
    }

    // Marquer en cours immédiatement (anti-race condition)
    application.lastReanalyzedAt = new Date();
    await application.save();

    const candidateContext = {
      candidateStatus: application.profile?.status,
      candidateName: [application.profile?.firstName, application.profile?.lastName].filter(Boolean).join(' ') || undefined,
      diditIdentity: {
        firstName: application.didit?.identityData?.firstName || application.profile?.firstName,
        lastName: application.didit?.identityData?.lastName || application.profile?.lastName,
        birthDate: application.didit?.identityData?.birthDate || application.profile?.birthDate,
      },
      rentAmount: Number(property.rentAmount || 0),
    };

    const documentsUpdated: Array<{ id: string; type: string; status: string; monthlyNet: number | null }> = [];
    const skippedReasons: Array<{ id: string; reason: string }> = [];
    let analyzedCount = 0;

    for (const doc of documents) {
      const docId = String(doc.id || '');
      if (!doc.fileUrl) {
        skippedReasons.push({ id: docId, reason: 'fileUrl manquante' });
        continue;
      }

      const filePath = resolveLocalFilePath(doc.fileUrl);
      if (!filePath) {
        skippedReasons.push({ id: docId, reason: 'chemin fichier non résolu' });
        continue;
      }

      let buffer: Buffer;
      try {
        buffer = await fs.readFile(filePath);
      } catch (err) {
        logger.warn('[reanalyze] fichier introuvable', { docId, filePath, err: (err as Error)?.message });
        skippedReasons.push({ id: docId, reason: 'fichier introuvable' });
        continue;
      }

      try {
        const result = await analyzeDocumentBuffer({
          buffer,
          fileName: doc.fileName || path.basename(filePath),
          mimeType: guessMimeType(doc.fileName || filePath),
          candidateContext,
          documentCategory: determineCategory(doc),
        });

        doc.aiAnalysis = result;
        const newStatus = result.isIllegible
          ? 'ILLEGIBLE'
          : result.needsHumanReview
          ? 'NEEDS_REVIEW'
          : (result.fraudScore || 0) > 50
          ? 'FLAGGED'
          : 'CERTIFIED';
        doc.status = newStatus;

        analyzedCount += 1;
        documentsUpdated.push({
          id: docId,
          type: String(doc.type || result.documentType || 'AUTRE'),
          status: newStatus,
          monthlyNet: Number(result.financial_data?.monthly_net_income || 0) || null,
        });
      } catch (err) {
        logger.error('[reanalyze] analyse échouée', { docId, err: (err as Error)?.message });
        skippedReasons.push({ id: docId, reason: 'erreur analyse IA' });
      }
    }

    // Recalcul financial summary
    const profile = deriveApplicationFinancialProfile({ application });
    application.financialSummary = {
      ...(application.financialSummary || {}),
      totalMonthlyIncome: profile.totalMonthlyIncome,
      monthlyNetIncome: profile.totalMonthlyIncome,
      certifiedIncome: profile.certifiedIncome,
      incomeSource: profile.incomeSource,
      basisLabel: profile.basisLabel,
      payslipCount: profile.payslipCount,
      certifiedPayslipCount: profile.certifiedPayslipCount,
      payslipsBreakdown: profile.payslipsBreakdown,
      monthlyIncomeMean: profile.monthlyIncomeMean,
      monthlyIncomeMedian: profile.monthlyIncomeMedian,
      monthlyIncomeStdDev: profile.monthlyIncomeStdDev,
      monthlyIncomeMethod: profile.monthlyIncomeMethod,
      varianceRatio: profile.varianceRatio,
      varianceHigh: profile.varianceHigh,
    };

    application.lastReanalyzedAt = new Date();
    // V7.13 — Incrémente le compteur (limite 1 ré-analyse / dossier)
    application.reanalyzeCount = (application.reanalyzeCount || 0) + 1;
    application.markModified('documents');
    application.markModified('financialSummary');
    await application.save();

    logger.info('[reanalyze] terminé', {
      applicationId: id,
      analyzed: analyzedCount,
      skipped: skippedReasons.length,
      totalIncome: profile.totalMonthlyIncome,
      reanalyzeCount: application.reanalyzeCount,
    });

    return NextResponse.json({
      analyzed: analyzedCount,
      skipped: skippedReasons.length,
      skippedReasons,
      documentsUpdated,
      financialSummary: {
        totalMonthlyIncome: profile.totalMonthlyIncome,
        certifiedIncome: profile.certifiedIncome,
        payslipsBreakdown: profile.payslipsBreakdown,
        monthlyIncomeMean: profile.monthlyIncomeMean,
        monthlyIncomeMedian: profile.monthlyIncomeMedian,
        monthlyIncomeMethod: profile.monthlyIncomeMethod,
        varianceHigh: profile.varianceHigh,
      },
    });
  } catch (error) {
    logger.error('[reanalyze] erreur', { err: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la ré-analyse', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
