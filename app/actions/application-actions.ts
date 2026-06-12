'use server';

import { connectDiditDb } from '@/app/api/didit/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import Application from '@/models/Application';
import Property from '@/models/Property';
import IdentitySession from '@/models/IdentitySession';
import Guarantor from '@/models/Guarantor';
 
const { computeApplicationPatrimometer } = require('@/src/utils/applicationScoring');
 
const { buildPassportViewModel } = require('@/src/utils/passportViewModel');
 
const { deriveApplicationFinancialProfile } = require('@/src/utils/financialExtraction');
 
const { resolveResilienceScore } = require('@/src/utils/resilienceScore');

/**
 * Sécurité (revue V1 — S3) : ces server actions reçoivent `userEmail` en argument
 * mais sont des endpoints POST publics. On exige une session authentifiée dont
 * l'email correspond — sinon un appelant pourrait lire/écrire le dossier d'autrui.
 */
async function assertSessionOwns(userEmail: string | undefined | null): Promise<boolean> {
  if (!userEmail) return false;
  try {
    const session: any = await getServerSession(authOptions as any);
    const sessionEmail: string | undefined = session?.user?.email?.toLowerCase();
    return !!sessionEmail && sessionEmail === userEmail.toLowerCase();
  } catch {
    return false;
  }
}

function withResolvedResilience(application: unknown) {
  if (!application || typeof application !== 'object') return application;
  const app = application as Record<string, unknown>;
  return {
    ...app,
    resilience: resolveResilienceScore(app),
  };
}

async function resolvePropertyId(applyToken?: string): Promise<string | null> {
  if (!applyToken) return null;
  const property = await Property.findOne({ applyToken }).select('_id').lean() as { _id?: { toString(): string } } | null;
  return property?._id?.toString() || null;
}

/**
 * Identité réellement vérifiée par Didit — SOURCE DE VÉRITÉ SERVEUR uniquement (jamais le client).
 * (1) `IdentitySession` `CERTIFIEE` (posée par /api/didit/status APRÈS appel à l'API Didit),
 *     résolue par le `sessionId` PROPRE au candidat (jamais par l'applyToken, partagé entre
 *     candidats — revue V1 S4) ; OU (2) cookie signé `didit_verified` (flux OIDC, JWT_SECRET).
 * Retourne l'identité vérifiée, ou null. Aucune de ces sources n'est falsifiable par le candidat.
 */
async function resolveServerVerifiedIdentity(
  sessionId?: string
): Promise<{ firstName: string; lastName: string; birthDate: string } | null> {
  // (1) IdentitySession CERTIFIEE — UNIQUEMENT par sessionId (sécurité, revue V1 — S4).
  // L'applyToken est PARTAGÉ par tous les candidats d'une même annonce : matcher dessus
  // laissait un candidat hériter la certification Didit d'un autre. Le sessionId est le
  // secret propre à CE candidat (obtenu en lançant SA propre vérification Didit).
  if (sessionId) {
    try {
      const sess = (await IdentitySession.findOne({ sessionId, identityStatus: 'CERTIFIEE' })
        .lean()) as { firstName?: string; lastName?: string; birthDate?: string } | null;
      if (sess) {
        return { firstName: sess.firstName || '', lastName: sess.lastName || '', birthDate: sess.birthDate || '' };
      }
    } catch {
      /* ignore — on tente la source (2) */
    }
  }
  // (2) Cookie signé `didit_verified`
  try {
    const token = (await cookies()).get('didit_verified')?.value;
    const secret = process.env.JWT_SECRET;
    if (token && secret) {
      const claims = jwt.verify(token, secret) as {
        firstName?: string;
        lastName?: string;
        birthDate?: string;
        humanVerified?: boolean;
      };
      if (claims && claims.humanVerified) {
        return {
          firstName: claims.firstName || '',
          lastName: claims.lastName || '',
          birthDate: claims.birthDate || '',
        };
      }
    }
  } catch {
    /* cookie absent / JWT invalide ou expiré */
  }
  return null;
}

/**
 * Sauvegarde automatique du tunnel - appelée à chaque changement d'étape
 */
export async function saveApplicationProgress(
  userEmail: string,
  applyToken: string,
  data: {
    currentStep?: number;
    profile?: { firstName?: string; lastName?: string; phone?: string; status?: string; presentationText?: string };
    diditStatus?: string;
    diditSessionId?: string;
    diditIdentity?: { firstName?: string; lastName?: string; birthDate?: string };
    documents?: Array<{
      id: string;
      category: string;
      subjectType?: 'tenant' | 'guarantor' | 'visale';
      subjectSlot?: 1 | 2 | 3 | 4;
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
    if (!(await assertSessionOwns(userEmail))) {
      return { success: false, error: 'Non autorisé' };
    }
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

    // ── Identité Didit : SOURCE DE VÉRITÉ SERVEUR (jamais le client). ──
    // Le candidat ne peut PAS s'auto-certifier : `VERIFIED` + identité proviennent exclusivement
    // d'une IdentitySession CERTIFIEE (posée serveur après appel Didit) ou du cookie signé.
    if (data.diditSessionId) {
      application.didit.sessionId = data.diditSessionId;
    }
    const verifiedIdentity = await resolveServerVerifiedIdentity(
      data.diditSessionId || application.didit.sessionId
    );
    if (verifiedIdentity) {
      application.didit.status = 'VERIFIED';
      if (!application.didit.verifiedAt) application.didit.verifiedAt = new Date();
      application.didit.identityData = verifiedIdentity;
    } else if (application.didit.status !== 'VERIFIED' && data.diditStatus && data.diditStatus !== 'VERIFIED') {
      // Statuts non sensibles (PENDING/loading) : reflétés pour l'UI, jamais d'élévation à VERIFIED.
      application.didit.status = data.diditStatus;
    }

    if (data.documents) {
      // AIPD §2.3 (minimisation) — bornes serveur sur le payload documents : le client ne
      // peut ni stocker un volume arbitraire en base, ni injecter d'URL exotiques. La nature
      // des pièces reste bornée par l'enum du schéma (IDENTITY/INCOME/ADDRESS/GUARANTOR).
      if (data.documents.length > 40) {
        return { success: false, error: 'Nombre de pièces trop élevé (40 max).' };
      }
      const { isForbiddenDocumentLabel } = require('@/src/services/visionAnalysisService');
      for (const doc of data.documents) {
        const url = doc.fileUrl || '';
        // ~12 M caractères ≈ 9 Mo binaire : aucune pièce légitime (PDF/photo) au-delà.
        if (url.length > 12_000_000) {
          return { success: false, error: `Pièce trop volumineuse : ${doc.fileName || doc.id}` };
        }
        if (url && !/^(data:(application\/pdf|image\/(png|jpe?g|webp|heic|heif));|\/uploads\/|https?:\/\/)/i.test(url)) {
          return { success: false, error: 'Format de pièce non autorisé (PDF ou image attendu).' };
        }
        if (typeof doc.fileName === 'string' && doc.fileName.length > 255) {
          doc.fileName = doc.fileName.slice(0, 255);
        }
        // AIPD action n°12 — pièce interdite (décret n° 2015-1437) détectée par l'analyse :
        // statut REJETÉ imposé côté serveur et CONTENU NON CONSERVÉ (minimisation).
        const aiType = (doc.aiAnalysis as { documentType?: string } | undefined)?.documentType;
        if (isForbiddenDocumentLabel(aiType) || isForbiddenDocumentLabel(doc.type)) {
          doc.status = 'REJECTED';
          doc.fileUrl = '';
        }
      }
      application.documents = data.documents as typeof application.documents;
    }

    // ── Statut garant : dérivé du modèle Guarantor SERVEUR (jamais le client). ──
    if (data.guarantorStatus) {
      const isCertClaim = data.guarantorStatus === 'CERTIFIED' || data.guarantorStatus === 'AUDITED';
      if (isCertClaim) {
        // Élévation CERTIFIED/AUDITED acceptée UNIQUEMENT si un garant est réellement certifié
        // côté serveur (statut posé par /api/guarantor/{status,audit} après vérification Didit/audit).
        const serverCertified = await Guarantor.exists({ applyToken, status: 'CERTIFIED' });
        if (serverCertified) {
          application.guarantor.status = data.guarantorStatus;
          application.guarantor.hasGuarantor = true;
        }
        // sinon : élévation ignorée (pas de confiance au client).
      } else {
        application.guarantor.status = data.guarantorStatus;
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
    application.financialSummary.perSlot = derivedFinancialSummary.perSlot || [];

    // Garants : on passe les enregistrements Guarantor (nom Didit-vérifié + statut) pour
    // ancrer la concordance des docs garant sur leur identité KYC (parité avec le locataire).
    let guarantorOne: unknown = null;
    let guarantorTwo: unknown = null;
    try {
      const guarantorRecords = (await Guarantor.find({ applyToken })
        .select('firstName lastName status identityVerification slot')
        .lean()) as unknown as Array<Record<string, unknown>>;
      guarantorOne = guarantorRecords.find((g) => Number(g.slot) !== 2) || null;
      guarantorTwo = guarantorRecords.find((g) => Number(g.slot) === 2) || null;
    } catch { /* best-effort — ne bloque jamais le scoring */ }

    const computedPatrimometer = computeApplicationPatrimometer({
      candidateStatus: data.candidateStatus || application.profile.status,
      diditStatus: application.didit.status,
      propertyRentAmount: data.propertyRentAmount,
      detectedIncome: derivedFinancialSummary.totalMonthlyIncome || data.detectedIncome,
      documents: data.documents || application.documents,
      // Colocation : états d'identité des colocataires (slots 2-4) pour l'agrégation.
      coTenants: application.coTenants,
      // Concordance d'identité (anti-fraude inter-documents) : ancre Didit + profil.
      profile: application.profile,
      diditIdentity: application.didit?.identityData || null,
      guarantorOne,
      guarantorTwo,
      guarantee: data.guarantee || application.guarantee || null,
      legacyGuarantor: {
        hasGuarantor: application.guarantor.hasGuarantor,
        status: application.guarantor.status,
        certificationMethod: data.guarantorMethod || application.guarantor.certificationMethod,
      },
    });

    // Concordance d'identité : si une non-concordance de nom est détectée, on flague
    // les documents fautifs AVANT buildPassportViewModel — le passeport est alors gaté
    // (state 'review' ⇒ pas de bascule en COMPLETE) et le grade est déjà abaissé par le
    // malus du scorer. No-op quand le flag est OFF (concordance === null).
    const concordance = (
      computedPatrimometer as {
        concordance?: { needsHumanReview?: boolean; flaggedDocumentIds?: Array<string | number> } | null;
      }
    ).concordance;
    if (concordance && concordance.needsHumanReview) {
      const flaggedIds = new Set((concordance.flaggedDocumentIds || []).map((x) => String(x)));
      if (Array.isArray(data.documents)) {
        const flaggedDocs = (data.documents as unknown as Array<Record<string, unknown>>).map((d) =>
          flaggedIds.has(String(d && d.id)) ? { ...d, flagged: true, status: 'NEEDS_REVIEW' } : d
        );
        data.documents = flaggedDocs as unknown as typeof data.documents;
        application.documents = flaggedDocs as unknown as typeof application.documents;
      } else if (Array.isArray(application.documents)) {
        (application.documents as unknown as Array<Record<string, unknown>>).forEach((d) => {
          if (flaggedIds.has(String(d && d.id))) {
            d.flagged = true;
            d.status = 'NEEDS_REVIEW';
          }
        });
      }
    }

    // ── Score / grade / breakdown / warnings : TOUJOURS la valeur calculée SERVEUR (jamais le
    // client). Le candidat ne peut ni gonfler son score, ni effacer ses propres alertes de fraude. ──
    application.patrimometer.score = computedPatrimometer.score;
    application.patrimometer.breakdown = computedPatrimometer.breakdown;
    application.patrimometer.warnings = computedPatrimometer.warnings;
    application.patrimometer.nextAction = computedPatrimometer.nextAction;
    application.patrimometer.chapterStates = computedPatrimometer.chapterStates;
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
    application.tunnel.chapterStates = computedPatrimometer.chapterStates;
    const passportBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      'https://maisonpatrimo.com';
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
          score: application.patrimometer.score,
          grade: application.patrimometer.grade,
          breakdown: computedPatrimometer.breakdown,
          warnings: computedPatrimometer.warnings,
          nextAction: computedPatrimometer.nextAction,
          chapterStates: computedPatrimometer.chapterStates,
        },
        submittedAt: application.submittedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        aiAuditV2: application.aiAuditV2,
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
/**
 * RGPD — droit à l'effacement granulaire (AIPD §2.5) : le candidat supprime
 * DÉFINITIVEMENT une ou plusieurs pièces de SON dossier depuis son espace.
 * Suppression ciblée ($pull, pas de réécriture du tableau côté client), fichier
 * physique /uploads effacé le cas échéant, et trace d'audit journalisée.
 */
export async function deleteApplicationDocuments(
  userEmail: string,
  applyToken: string,
  documentIds: string[]
): Promise<{ success: boolean; deleted?: number; error?: string }> {
  try {
    if (!(await assertSessionOwns(userEmail))) {
      return { success: false, error: 'Non autorisé' };
    }
    const ids = (documentIds || []).map(String).filter(Boolean).slice(0, 40);
    if (ids.length === 0) {
      return { success: false, error: 'Aucune pièce indiquée' };
    }

    await connectDiditDb();
    const application = await Application.findOne({
      userEmail: userEmail.toLowerCase(),
      applyToken,
    }).select('_id documents').lean();
    if (!application) {
      return { success: false, error: 'Dossier introuvable' };
    }

    const docs = ((application as { documents?: Array<{ id?: string; fileUrl?: string }> }).documents) || [];
    const targets = docs.filter((d) => ids.includes(String(d.id)));
    if (targets.length === 0) {
      return { success: false, error: 'Pièce introuvable dans votre dossier' };
    }

    // Fichier physique éventuel (fileUrl /uploads/...) — suppression best-effort,
    // bornée au dossier uploads (anti path-traversal sur une valeur en base).
    const fs = require('fs');
    const path = require('path');
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    for (const doc of targets) {
      const url = String(doc.fileUrl || '');
      if (url.startsWith('/uploads/')) {
        try {
          const p = path.resolve(process.cwd(), '.' + url);
          if (p.startsWith(uploadsRoot + path.sep) && fs.existsSync(p)) fs.unlinkSync(p);
        } catch { /* best effort — la pièce est de toute façon retirée du dossier */ }
      }
    }

    await Application.updateOne(
      { _id: (application as { _id: unknown })._id },
      { $pull: { documents: { id: { $in: ids } } } }
    );

    const { logger } = require('@/lib/server-logger');
    logger.info('[RGPD] Pièce(s) supprimée(s) définitivement par le candidat', {
      applicationId: String((application as { _id: unknown })._id),
      count: targets.length,
    });

    return { success: true, deleted: targets.length };
  } catch (error) {
    console.error('Erreur deleteApplicationDocuments:', error);
    return { success: false, error: 'Erreur lors de la suppression. Réessayez.' };
  }
}

export async function getApplication(userEmail: string, applyToken?: string) {
  try {
    if (!(await assertSessionOwns(userEmail))) {
      return { success: false, error: 'Non autorisé' };
    }
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
      application: JSON.parse(JSON.stringify(withResolvedResilience(application)))
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
    if (!(await assertSessionOwns(userEmail))) {
      return { success: false, applications: [] };
    }
    await connectDiditDb();

    const applications = await Application.find({
      userEmail: userEmail.toLowerCase() 
    })
      .populate('property', 'name address rentAmount')
      .sort({ 'tunnel.lastActiveAt': -1 })
      .lean();

    return { 
      success: true, 
      applications: JSON.parse(JSON.stringify(applications.map((application) => withResolvedResilience(application))))
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

    if (!(await assertSessionOwns((application as { userEmail?: string }).userEmail))) {
      return { success: false, error: 'Non autorisé' };
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

/**
 * Applique le Passeport Locatif universel d'un locataire à une annonce précise.
 *
 * Réutilise toute la machinerie existante : on alimente la candidature liée au
 * bien (find-or-create par {userEmail, applyToken=code}) à partir du dossier
 * universel (identité, documents, revenus), le score est recalculé AVEC le loyer
 * du bien via saveApplicationProgress, puis on soumet via submitApplication →
 * la candidature apparaît dans les candidatures du bailleur.
 */
export async function applyPassportToProperty(userEmail: string, propertyCode: string) {
  try {
    if (!(await assertSessionOwns(userEmail))) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectDiditDb();
    const code = String(propertyCode || '').trim().toUpperCase();
    if (!/^PT-\d{5}-[A-Z0-9]{4}$/.test(code)) {
      return { success: false, error: 'Format de code invalide (ex : PT-75001-K7M9)' };
    }

    const property = (await Property.findOne({ applyToken: code })
      .select('_id rentAmount')
      .lean()) as { _id: { toString(): string }; rentAmount?: number } | null;
    if (!property) {
      return { success: false, error: 'Code de bien introuvable' };
    }

    // Dossier universel le plus récent du locataire (self-token PT-SELF-*).
    const universal = await Application.findOne({
      userEmail: userEmail.toLowerCase(),
      applyToken: { $regex: '^PT-SELF-' },
    }).sort({ 'tunnel.lastActiveAt': -1 });
    if (!universal) {
      return {
        success: false,
        error: "Vous n'avez pas encore de Passeport Locatif universel.",
      };
    }

    const u = universal.toObject() as Record<string, any>;

    // Copie des champs vérifiés + recalcul du score AVEC le loyer du bien.
    const saved = await saveApplicationProgress(userEmail, code, {
      profile: {
        firstName: u.profile?.firstName,
        lastName: u.profile?.lastName,
        phone: u.profile?.phone,
        status: u.profile?.status,
      },
      candidateStatus: u.profile?.status,
      diditStatus: u.didit?.status,
      diditSessionId: u.didit?.sessionId,
      diditIdentity: u.didit?.identityData,
      documents: u.documents,
      guarantorStatus: u.guarantor?.status,
      guarantorMethod: u.guarantor?.certificationMethod,
      guarantee: u.guarantee,
      propertyRentAmount: Number(property.rentAmount) || undefined,
      detectedIncome: u.financialSummary?.totalMonthlyIncome,
    });
    if (!saved.success || !saved.applicationId) {
      return { success: false, error: saved.error || 'Erreur lors de la candidature' };
    }

    // Soumission → apparaît dans les candidatures du bailleur (si dossier complet).
    const submitted = await submitApplication(saved.applicationId);

    return {
      success: true,
      applicationId: saved.applicationId,
      propertyId: String(property._id),
      submitted: submitted.success,
      message: submitted.success
        ? 'Votre dossier a été transmis au propriétaire.'
        : 'Dossier rattaché au bien — complétez-le pour le transmettre.',
    };
  } catch (error) {
    console.error('Erreur applyPassportToProperty:', error);
    return { success: false, error: 'Erreur lors de la candidature' };
  }
}
