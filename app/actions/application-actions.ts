'use server';

import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import Property from '@/models/Property';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { computeApplicationPatrimometer } = require('@/src/utils/applicationScoring');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildPassportViewModel } = require('@/src/utils/passportViewModel');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { deriveApplicationFinancialProfile } = require('@/src/utils/financialExtraction');

async function resolvePropertyId(applyToken?: string): Promise<string | null> {
  if (!applyToken) return null;
  const property = await Property.findOne({ applyToken }).select('_id').lean() as { _id?: { toString(): string } } | null;
  return property?._id?.toString() || null;
}

/**
 * Sauvegarde automatique du tunnel - appelée à chaque changement d'étape
 */
export async function saveApplicationProgress(
  userEmail: string,
  applyToken: string,
  data: {
    currentStep?: number;
    profile?: { firstName?: string; lastName?: string; phone?: string; status?: string };
    diditStatus?: string;
    diditSessionId?: string;
    diditIdentity?: { firstName?: string; lastName?: string; birthDate?: string };
    documents?: Array<{
      id: string;
      category: string;
      subjectType?: 'tenant' | 'guarantor' | 'visale';
      subjectSlot?: 1 | 2;
      type: string;
      fileName: string;
      fileUrl?: string;
      status: string;
      aiAnalysis?: unknown;
    }>;
    guarantorStatus?: string;
    guarantorMethod?: string;
    patrimometerScore?: number;
    patrimometerBreakdown?: unknown;
    patrimometerWarnings?: string[];
    patrimometerNextAction?: unknown;
    patrimometerChapterStates?: unknown;
    guarantee?: unknown;
    candidateStatus?: string;
    propertyRentAmount?: number;
    detectedIncome?: number;
  }
) {
  try {
    await connectDiditDb();

    // Trouver ou créer l'application
    let application = await Application.findOne({ 
      userEmail: userEmail.toLowerCase(),
      applyToken 
    });

    if (!application) {
      application = new Application({
        userEmail: userEmail.toLowerCase(),
        applyToken,
        status: 'DRAFT',
      });
    }

    if (!application.property) {
      const resolvedPropertyId = await resolvePropertyId(applyToken);
      if (resolvedPropertyId) {
        application.property = resolvedPropertyId as any;
      }
    }

    // Mettre à jour les données
    if (data.currentStep !== undefined) {
      application.tunnel.currentStep = data.currentStep;
      if (!application.tunnel.completedSteps.includes(data.currentStep)) {
        application.tunnel.completedSteps.push(data.currentStep);
      }
    }

    if (data.profile) {
      application.profile = { ...application.profile, ...data.profile };
    }

    if (data.candidateStatus) {
      application.profile.status = data.candidateStatus;
    }

    if (data.diditStatus) {
      application.didit.status = data.diditStatus;
      if (data.diditStatus === 'VERIFIED') {
        application.didit.verifiedAt = new Date();
      }
    }

    if (data.diditSessionId) {
      application.didit.sessionId = data.diditSessionId;
    }

    if (data.diditIdentity) {
      application.didit.identityData = data.diditIdentity;
    }

    if (data.documents) {
      application.documents = data.documents as typeof application.documents;
    }

    if (data.guarantorStatus) {
      application.guarantor.status = data.guarantorStatus;
      if (data.guarantorStatus === 'CERTIFIED' || data.guarantorStatus === 'AUDITED') {
        application.guarantor.hasGuarantor = true;
      }
    }

    if (data.guarantorMethod) {
      application.guarantor.certificationMethod = data.guarantorMethod;
    }

    const derivedFinancialSummary = deriveApplicationFinancialProfile({
      application: {
        ...application.toObject(),
        documents: data.documents || application.documents,
        financialSummary: application.financialSummary,
      },
      fallbackIncome: data.detectedIncome,
    });
    application.financialSummary.totalMonthlyIncome = derivedFinancialSummary.totalMonthlyIncome;
    application.financialSummary.certifiedIncome = derivedFinancialSummary.certifiedIncome;
    application.financialSummary.incomeSource = derivedFinancialSummary.incomeSource;

    const computedPatrimometer = computeApplicationPatrimometer({
      candidateStatus: data.candidateStatus || application.profile.status,
      diditStatus: data.diditStatus || application.didit.status,
      propertyRentAmount: data.propertyRentAmount,
      detectedIncome: derivedFinancialSummary.totalMonthlyIncome || data.detectedIncome,
      documents: data.documents || application.documents,
      guarantee: data.guarantee || application.guarantee || null,
      legacyGuarantor: {
        hasGuarantor: application.guarantor.hasGuarantor,
        status: data.guarantorStatus || application.guarantor.status,
        certificationMethod: data.guarantorMethod || application.guarantor.certificationMethod,
      },
    });

    const nextScore =
      data.patrimometerScore !== undefined ? data.patrimometerScore : computedPatrimometer.score;
    application.patrimometer.score = nextScore;
    application.patrimometer.breakdown =
      (data.patrimometerBreakdown as Record<string, unknown>) || computedPatrimometer.breakdown;
    application.patrimometer.warnings = data.patrimometerWarnings || computedPatrimometer.warnings;
    application.patrimometer.nextAction =
      (data.patrimometerNextAction as Record<string, unknown>) || computedPatrimometer.nextAction;
    application.patrimometer.chapterStates =
      (data.patrimometerChapterStates as Record<string, unknown>) || computedPatrimometer.chapterStates;
    application.patrimometer.grade = application.calculateGrade();
    application.patrimometer.lastCalculatedAt = new Date();

    if (data.guarantee || computedPatrimometer.guarantee) {
      application.guarantee = data.guarantee || computedPatrimometer.guarantee;
    }

    const legacyGuarantor = computedPatrimometer.legacyGuarantor || null;
    if (legacyGuarantor) {
      application.guarantor.hasGuarantor = Boolean(legacyGuarantor.hasGuarantor);
      application.guarantor.status = legacyGuarantor.status || 'NONE';
      if (legacyGuarantor.certificationMethod) {
        application.guarantor.certificationMethod = legacyGuarantor.certificationMethod;
      }
    }

    // Mettre à jour le progrès et le statut
    application.tunnel.lastActiveAt = new Date();
    application.tunnel.chapterStates =
      (data.patrimometerChapterStates as Record<string, unknown>) || computedPatrimometer.chapterStates;
    const passportBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      'https://doc2loc.com';
    const passportView = buildPassportViewModel({
      application: {
        _id: application._id,
        status: application.status,
        profile: application.profile,
        didit: application.didit,
        documents: data.documents || application.documents,
        guarantee: data.guarantee || application.guarantee || computedPatrimometer.guarantee,
        financialSummary: application.financialSummary,
        passportSlug: application.passportSlug,
        passportViewCount: application.passportViewCount,
        passportShareCount: application.passportShareCount,
        property: {
          rentAmount: data.propertyRentAmount,
        },
        patrimometer: {
          score: nextScore,
          grade: application.patrimometer.grade,
          breakdown:
            (data.patrimometerBreakdown as Record<string, unknown>) || computedPatrimometer.breakdown,
          warnings: data.patrimometerWarnings || computedPatrimometer.warnings,
          nextAction:
            (data.patrimometerNextAction as Record<string, unknown>) || computedPatrimometer.nextAction,
          chapterStates:
            (data.patrimometerChapterStates as Record<string, unknown>) || computedPatrimometer.chapterStates,
        },
        submittedAt: application.submittedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
      },
      audience: 'candidate',
      baseUrl: passportBaseUrl,
    });
    application.patrimometer.chapterStates = {
      ...(application.patrimometer.chapterStates || {}),
      passport: {
        ...(application.patrimometer.chapterStates?.passport || {}),
        state: passportView.state,
        ready: passportView.state === 'ready' || passportView.state === 'sealed',
        shareEnabled: passportView.shareEnabled,
      },
    };
    application.tunnel.chapterStates = {
      ...(application.tunnel.chapterStates || {}),
      passport: {
        ...(application.tunnel.chapterStates?.passport || {}),
        state: passportView.state,
        ready: passportView.state === 'ready' || passportView.state === 'sealed',
        shareEnabled: passportView.shareEnabled,
      },
    };
    application.tunnel.progress = application.calculateProgress();
    
    if (application.tunnel.progress > 0 && application.status === 'DRAFT') {
      application.status = 'IN_PROGRESS';
    }
    
    if (passportView.state === 'ready') {
      application.status = 'COMPLETE';
      application.tunnel.completedAt = new Date();
    } else if (!['SUBMITTED', 'ACCEPTED', 'REJECTED'].includes(application.status) && application.status === 'COMPLETE') {
      application.status = 'IN_PROGRESS';
      application.tunnel.completedAt = undefined;
    }

    await application.save();

    return { 
      success: true, 
      applicationId: application._id.toString(),
      progress: application.tunnel.progress,
      grade: application.patrimometer.grade,
    };
  } catch (error) {
    console.error('Erreur saveApplicationProgress:', error);
    return { success: false, error: 'Erreur lors de la sauvegarde' };
  }
}

/**
 * Récupérer l'application pour un utilisateur
 */
export async function getApplication(userEmail: string, applyToken?: string) {
  try {
    await connectDiditDb();

    const query: { userEmail: string; applyToken?: string } = { 
      userEmail: userEmail.toLowerCase() 
    };
    if (applyToken) {
      query.applyToken = applyToken;
    }

    const application = await Application.findOne(query)
      .sort({ 'tunnel.lastActiveAt': -1 })
      .lean();

    if (!application) {
      return { success: true, application: null };
    }

    return { 
      success: true, 
      application: JSON.parse(JSON.stringify(application))
    };
  } catch (error) {
    console.error('Erreur getApplication:', error);
    return { success: false, error: 'Erreur lors de la récupération' };
  }
}

/**
 * Récupérer toutes les candidatures d'un utilisateur
 */
export async function getUserApplications(userEmail: string) {
  try {
    await connectDiditDb();

    const applications = await Application.find({ 
      userEmail: userEmail.toLowerCase() 
    })
      .populate('property', 'name address rentAmount')
      .sort({ 'tunnel.lastActiveAt': -1 })
      .lean();

    return { 
      success: true, 
      applications: JSON.parse(JSON.stringify(applications))
    };
  } catch (error) {
    console.error('Erreur getUserApplications:', error);
    return { success: false, error: 'Erreur lors de la récupération' };
  }
}

/**
 * Soumettre une candidature
 */
export async function submitApplication(applicationId: string) {
  try {
    await connectDiditDb();

    const application = await Application.findById(applicationId);
    if (!application) {
      return { success: false, error: 'Candidature introuvable' };
    }

    if (!application.property && application.applyToken) {
      const resolvedPropertyId = await resolvePropertyId(application.applyToken);
      if (resolvedPropertyId) {
        application.property = resolvedPropertyId as any;
      }
    }

    if (application.status !== 'COMPLETE') {
      return { success: false, error: 'Le dossier doit être complet pour être soumis' };
    }

    application.status = 'SUBMITTED';
    application.submittedAt = new Date();
    await application.save();

    return { success: true };
  } catch (error) {
    console.error('Erreur submitApplication:', error);
    return { success: false, error: 'Erreur lors de la soumission' };
  }
}
