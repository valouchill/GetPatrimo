'use server';

import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';

/**
 * Sauvegarde automatique du tunnel - appelée à chaque changement d'étape
 */
export async function saveApplicationProgress(
  userEmail: string,
  applyToken: string,
  data: {
    currentStep?: number;
    profile?: { firstName?: string; lastName?: string; phone?: string };
    diditStatus?: string;
    diditSessionId?: string;
    diditIdentity?: { firstName?: string; lastName?: string; birthDate?: string };
    documents?: Array<{
      id: string;
      category: string;
      type: string;
      fileName: string;
      fileUrl?: string;
      status: string;
      aiAnalysis?: unknown;
    }>;
    guarantorStatus?: string;
    guarantorMethod?: string;
    patrimometerScore?: number;
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
      // Fusionner les documents existants avec les nouveaux
      for (const doc of data.documents) {
        const existingIndex = application.documents.findIndex(
          (d: { id: string }) => d.id === doc.id
        );
        if (existingIndex >= 0) {
          application.documents[existingIndex] = { 
            ...application.documents[existingIndex], 
            ...doc 
          };
        } else {
          application.documents.push(doc);
        }
      }
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

    if (data.patrimometerScore !== undefined) {
      application.patrimometer.score = data.patrimometerScore;
      application.patrimometer.grade = application.calculateGrade();
      application.patrimometer.lastCalculatedAt = new Date();
    }

    // Mettre à jour le progrès et le statut
    application.tunnel.lastActiveAt = new Date();
    application.tunnel.progress = application.calculateProgress();
    
    if (application.tunnel.progress > 0 && application.status === 'DRAFT') {
      application.status = 'IN_PROGRESS';
    }
    
    if (application.tunnel.progress >= 100) {
      application.status = 'COMPLETE';
      application.tunnel.completedAt = new Date();
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
