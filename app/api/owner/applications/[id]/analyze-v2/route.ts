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
import { runFullAnalysis } from '@/lib/ai/tenant-analyzer';
import type { AnalysisInputType } from '@/lib/ai/analysis-schema';

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

    const property = await Property.findById((app as any).property as unknown)
      .select('owner rentAmount')
      .lean();

    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }

    const userId = (session as any)?.user?.id || (session as any)?.user?._id;
    const propertyOwner = String((property as any).owner || '');
    if (userId && propertyOwner && String(userId) !== propertyOwner) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const rentAmount = Number((property as any).rentAmount || 0);

    // Mapping Mongo → AnalysisInputType
    const analysisInput = buildAnalysisInput(app, rentAmount);

    // Pipeline neuro-symbolique
    cooldownRegistry.set(cooldownKey, now);
    const result = await runFullAnalysis(analysisInput);

    logger.info('analyze-v2 success', {
      applicationId: id,
      score: result.resilience.score,
      grade: result.resilience.grade,
      decision: result.resilience.decision,
      hardGates: result.resilience.hardGates.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('POST /api/owner/applications/[id]/analyze-v2', {
      error: error instanceof Error ? error.message : error,
    });
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Erreur lors de l\'analyse';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
