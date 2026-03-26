'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { useNotification } from '@/app/hooks/useNotification';
import { ApplySchema } from '@/lib/schemas/apply';
import { AnimatePresence, motion } from 'framer-motion';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { useSession } from 'next-auth/react';
import { processDossier } from '@/app/actions/process-dossier';
import { saveApplicationProgress, getApplication, submitApplication } from '@/app/actions/application-actions';
import { createTenantAccount } from '@/app/actions/create-tenant-account';
import PassportStudio from '@/app/components/PassportStudio';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  getChecklistIdForDocumentType,
  getDocumentCertificationDecision,
  isChecklistItemCompatibleWithUploadCategory,
  normalizeAnalysisDocumentType,
} = require('@/src/utils/documentCertificationRules');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  SUPPORTED_PROFILES,
  computeApplicationPatrimometer,
  inferEvidenceKind,
} = require('@/src/utils/applicationScoring');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  buildExpectedIdentityTarget,
  compareIdentityToExpected,
  extractIdentityCandidate,
  hasUsableIdentity,
} = require('@/src/utils/documentSubjectIdentity');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDocumentIncomeContribution } = require('@/src/utils/financialExtraction');

// Types pour l'analyse de document
interface DocumentAnalysisResult {
  documentType: string;
  extractedData: {
    nom?: string;
    prenom?: string;
    montants?: number[];
    dates?: string[];
    autres?: Record<string, unknown>;
  };
  confidenceScore: number;
  recommendations: string[];
  fraudIndicators?: {
    suspicious: boolean;
    reasons: string[];
  };
  personaMatch?: {
    matches: boolean;
    expectedProfile: string;
    detectedProfile: string;
  };
  error?: string;
}

declare global {
  interface Window {
    Didit?: {
      embed?: (config: Record<string, unknown>) => void;
      init?: (config: Record<string, unknown>) => void;
      create?: (config: Record<string, unknown>) => void;
    };
  }
}

type DiditPostMessage = {
  source?: string;
  type?: string;
  sessionId?: string;
  status?: string;
  redirectUrl?: string;
};

interface AnalysisV2Result extends DocumentAnalysisResult {
  ownerName?: string;
  date?: string;
  suggestedFileName?: string;
  originalFileName?: string;
  isIllegible?: boolean;
  errorMessage?: string;
  analysisMethod?: string;
  fraudScore?: number; // Score de fraude 0-100
  fraudAudit?: {
    structureAnalysis?: {
      suspiciousAlignment: boolean;
      fontInconsistencies: boolean;
      details: string[];
    };
    mathematicalAudit?: {
      calculationErrors: boolean;
      brutNetDifference?: number;
      details: string[];
    };
    consistencyCheck?: {
      dateIssues: boolean;
      addressMismatch: boolean;
      details: string[];
    };
    metadataAnalysis?: {
      suspiciousCreator: boolean;
      creatorSoftware?: string;
      details: string[];
    };
  };
  // Structure normalisée (nouvelle API)
  document_metadata?: {
    type: string;
    owner_name: string;
    is_owner_match: boolean;
    date_emission: string;
    date_validite?: string;
    suggested_file_name: string;
  };
  financial_data?: {
    monthly_net_income: number;
    currency: string;
    is_recurring: boolean;
    extra_details?: {
      visale?: {
        numero_visa: string;
        date_validite: string;
        loyer_maximum_garanti: number;
        code_2d_doc?: string;
        code_2d_doc_valide?: boolean;
      };
    };
  };
  trust_and_security?: {
    fraud_score: number;
    forensic_alerts: string[];
    math_validation: boolean;
    digital_seal_authenticated?: boolean; // true si authentifié par sceau numérique 2D-Doc
    digital_seal_status?: 'AUTHENTIFIÉ_PAR_SCELLEMENT_NUMÉRIQUE' | 'SIGNATURE_INVALIDE' | 'NOM_NON_CORRESPONDANT' | 'NON_DÉTECTÉ';
    // Nouveaux champs "Bienveillance Sécuritaire"
    needs_human_review?: boolean;
    human_review_reason?: string;
    partial_extraction?: boolean;
    extracted_fields?: string[];
  };
  ai_analysis?: {
    detected_profile: string;
    impact_on_patrimometer: number;
    expert_advice: string;
    improvement_tip?: string;
    visale_alert?: string; // Alerte si le loyer dépasse le plafond Visale
  };
  // Champs de niveau supérieur (compatibilité)
  needsHumanReview?: boolean;
  humanReviewReason?: string;
  partialExtraction?: boolean;
  extractedFields?: string[];
  improvementTip?: string;
  expertAdvice?: string;
}

async function analyzeDocumentViaApi(
  file: File,
  candidateStatus?: string,
  diditIdentity?: { firstName?: string; lastName?: string; birthDate?: string },
  candidateName?: string,
  rentAmount?: number,
  category?: 'identity' | 'resources' | 'guarantor'
): Promise<AnalysisV2Result> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('originalFileName', file.name);
  if (category) {
    formData.append('category', category);
  }
  if (candidateStatus) {
    formData.append('candidateStatus', candidateStatus);
  }
  if (candidateName) {
    formData.append('candidateName', candidateName);
  }
  if (diditIdentity?.firstName) {
    formData.append('diditFirstName', diditIdentity.firstName);
  }
  if (diditIdentity?.lastName) {
    formData.append('diditLastName', diditIdentity.lastName);
  }
  if (diditIdentity?.birthDate) {
    formData.append('diditBirthDate', diditIdentity.birthDate);
  }
  if (rentAmount && rentAmount > 0) {
    formData.append('rentAmount', rentAmount.toString());
  }

  const controller = new AbortController();
  const clientTimeout = setTimeout(() => controller.abort(), 60_000);

  let response: Response;
  try {
    response = await fetch('/api/analyze-document-v2', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(clientTimeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 'delayed',
        message: "L'analyse prend plus de temps que prévu. Votre document sera analysé sous peu.",
        document_metadata: { type: 'PENDING', status: 'pending_manual_review' },
        ai_analysis: { fraud_score: 0, expert_advice: "Document reçu, analyse en cours." },
        financial_data: {},
        trust_and_security: { fraud_score: 0, forensic_alerts: [] },
      } as unknown as AnalysisV2Result;
    }
    throw err;
  } finally {
    clearTimeout(clientTimeout);
  }

  if (response.status === 202) {
    const data = await response.json();
    return { ...data, status: 'delayed' } as unknown as AnalysisV2Result;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erreur ${response.status}`);
  }

  return response.json();
}

import AIFeedbackBubble from '@/app/components/AIFeedbackBubble';

const ANALYSIS_MESSAGES = [
  "Chiffrement du document...",
  "Analyse forensique par l'IA...",
  "Sécurisation de la donnée...",
  "Vérification de l'authenticité...",
  "Extraction des informations clés...",
];

function AnalysisRotatingMessage() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % ANALYSIS_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={msgIndex}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="text-slate-700 font-semibold text-center text-sm"
      >
        {ANALYSIS_MESSAGES[msgIndex]}
      </motion.p>
    </AnimatePresence>
  );
}

// --- Calculateur de Solvabilité ---
// NOTE: Le calcul de solvabilité a été déplacé côté serveur pour des raisons de sécurité.
// Le SolvencyGauge n'est plus affiché côté locataire - seule la certification des données brutes est effectuée.
// Le calcul de solvabilité est effectué côté propriétaire via une Server Action sécurisée.
function calculateSolvencyRatio(
  monthlyIncome: number,
  rentAmount: number,
  profile: string,
  guarantorIncome?: number | null,
  aplAmount?: number | null,
  bourseAmount?: number | null
) {
  // Calcul du revenu total mensuel
  const totalMonthlyIncome = monthlyIncome + (aplAmount || 0) + ((bourseAmount || 0) / 12);
  
  // Ratio personnel
  const personalRatio = rentAmount > 0 ? totalMonthlyIncome / rentAmount : 0;
  
  // Ratio combiné avec garant
  const combinedIncome = totalMonthlyIncome + (guarantorIncome ? guarantorIncome / 12 : 0);
  const combinedRatio = rentAmount > 0 ? combinedIncome / rentAmount : 0;
  
  // Utiliser le ratio combiné si un garant est présent, sinon le ratio personnel
  const ratio = guarantorIncome ? combinedRatio : personalRatio;
  
  let zone: 'green' | 'amber' | 'red';
  let status: string;
  let recommendation: string | undefined;

  if (ratio >= 3.0) {
    zone = 'green';
    status = 'Souverain';
  } else if (ratio >= 2.5) {
    zone = 'amber';
    status = 'Besoin d\'un garant solide';
    recommendation = 'Un garant avec des revenus stables renforcerait significativement votre dossier.';
  } else {
    zone = 'red';
    status = 'Garantie obligatoire';
    recommendation = 'Une garantie Visale, caution bancaire ou garant solide est nécessaire pour sécuriser votre candidature.';
  }

  // Message contextuel
  let message: string;
  if (profile === 'Etudiant' && guarantorIncome) {
    message = `Vos revenus personnels couvrent ${personalRatio.toFixed(1)}x le loyer. Avec votre garant (${guarantorIncome.toLocaleString('fr-FR')}€), votre solvabilité combinée atteint ${combinedRatio.toFixed(1)}x. Statut : ${ratio >= 3 ? 'Éligible AAA' : ratio >= 2.5 ? 'Éligible avec garant' : 'Garantie requise'}.`;
  } else if (guarantorIncome) {
    message = `Ratio personnel : ${personalRatio.toFixed(1)}x. Avec garant : ${combinedRatio.toFixed(1)}x le loyer. ${status}.`;
  } else {
    message = `Vos revenus couvrent ${ratio.toFixed(1)}x le loyer mensuel. ${status}.`;
  }

  return {
    ratio,
    zone,
    status,
    message,
    personalRatio,
    combinedRatio,
    recommendation
  };
}

// NOTE: Le composant SolvencyGauge a été retiré.
// Le calcul de solvabilité est maintenant effectué uniquement côté propriétaire via une Server Action sécurisée.
// Côté locataire, seule la certification des données brutes est effectuée (Passeport PatrimoTrust).


// --- Document Card avec Laser Scan ---
interface DocumentCardProps {
  file: DocumentFile;
  showAmount?: boolean;
  onDelete?: (fileId: string) => void;
  onForceValidate?: (fileId: string) => void;
  isDeleting?: boolean;
}

function DocumentCard({ file, showAmount = true, onDelete, onForceValidate, isDeleting = false }: DocumentCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isAnalyzing = file.status === 'ANALYZING' || file.status === 'scanning';
  const hasInconsistency = file.inconsistencyDetected && !file.inconsistencyResolved;
  const isCertified = file.status === 'CERTIFIED' && !file.flagged && !hasInconsistency;
  const isNeedsReview = file.status === 'NEEDS_REVIEW';
  const isRejected = file.status === 'REJECTED';
  const isIllegible = file.status === 'ILLEGIBLE';
  const isFlagged = (file.flagged && !isNeedsReview) || hasInconsistency;
  const isRenamed = file.isRenamed && file.suggestedName;

  // Montant extrait
  const extractedAmount = file.extractedData?.montants?.[0];

  // Animation du nom (transition fluide)
  const [displayedName, setDisplayedName] = useState(file.originalName || file.name);
  const [showMagicBadge, setShowMagicBadge] = useState(false);

  useEffect(() => {
    if (isRenamed && file.suggestedName) {
      // Delay pour l'animation de transition du nom
      const timer = setTimeout(() => {
        setDisplayedName(file.suggestedName!);
        setShowMagicBadge(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isRenamed, file.suggestedName]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`group relative overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md ${
        isIllegible
          ? 'bg-orange-50 border-orange-300'
          : isRejected
          ? 'bg-red-50 border-red-200'
          : isCertified
          ? 'bg-gradient-to-r from-emerald-50 to-white border-emerald-200 shadow-emerald-100/50'
          : isNeedsReview
          ? 'bg-amber-50 border-amber-200'
          : isFlagged
          ? 'bg-amber-50 border-amber-200'
          : 'bg-white border-slate-200'
      }`}
    >
      {/* Animation Laser Scan pendant l'analyse */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ top: '-100%' }}
            animate={{ top: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent z-10"
            style={{ boxShadow: '0 0 20px 5px rgba(16, 185, 129, 0.4)' }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 p-4">
        {/* Icône / Statut */}
        <div className="relative">
          {isAnalyzing ? (
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isIllegible ? (
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            </div>
          ) : isRejected ? (
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          ) : isNeedsReview ? (
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <AlertTriangleIcon className="w-5 h-5 text-amber-500" />
            </div>
          ) : isFlagged ? (
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <AlertTriangleIcon className="w-5 h-5 text-amber-500" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <FileIcon className="w-5 h-5 text-emerald-600" />
            </div>
          )}

          {/* Badge de certification ShieldCheck */}
          {isCertified && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.2 }}
              className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
            >
              <ShieldCheckIcon className="w-3 h-3 text-white" />
            </motion.div>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-navy truncate">{file.type}</p>
            {isCertified && (
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-bold uppercase tracking-wider rounded">
                Certifié
              </span>
            )}
            {isNeedsReview && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-bold uppercase tracking-wider rounded">
                Revue requise
              </span>
            )}
            {isRejected && !file.flagged && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[8px] font-bold uppercase tracking-wider rounded">
                Non retenu
              </span>
            )}
            {/* Badge Incohérence détectée */}
            {hasInconsistency && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-[8px] font-bold uppercase tracking-wider rounded-full shadow-sm"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                À réviser
              </motion.span>
            )}
            {/* Badge Justification acceptée */}
            {file.inconsistencyResolved && file.inconsistencyJustification && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-400 to-blue-500 text-white text-[8px] font-bold uppercase tracking-wider rounded-full shadow-sm"
                title={`Justification : ${file.inconsistencyJustification}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Justifié
              </motion.span>
            )}
            {/* Badge Magic/AI-Cleaned pour les fichiers renommés */}
            <AnimatePresence>
              {showMagicBadge && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[8px] font-bold uppercase tracking-wider rounded-full shadow-lg"
                >
                  <SparklesIcon className="w-3 h-3" />
                  Magic
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          
          {/* Nom du fichier avec animation de transition */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={displayedName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className={`text-xs truncate ${isRenamed ? 'text-violet-600 font-medium' : 'text-slate-500'}`}
              >
                {displayedName}
              </motion.p>
            </AnimatePresence>
            
            {/* Ancien nom barré si renommé */}
            {isRenamed && file.originalName && file.originalName !== displayedName && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                className="text-[10px] text-slate-400 line-through truncate"
              >
                {file.originalName}
              </motion.p>
            )}
          </div>
          
          {/* Montant extrait affiché */}
          {showAmount && extractedAmount && isCertified && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-bold text-emerald-600 mt-1"
            >
              💰 {extractedAmount.toLocaleString('fr-FR')}€ détectés
            </motion.p>
          )}
        </div>

        {/* Score de confiance */}
        {file.confidenceScore && !isAnalyzing && (
          <div className="text-right">
            <motion.span
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className={`text-lg font-bold ${
                file.confidenceScore >= 80 ? 'text-emerald-600' : 
                file.confidenceScore >= 60 ? 'text-amber-600' : 'text-red-500'
              }`}
            >
              {file.confidenceScore}%
            </motion.span>
            <p className="text-[8px] text-slate-400 uppercase tracking-wider">Confiance</p>
          </div>
        )}

        {/* Bouton Supprimer */}
        {onDelete && !isAnalyzing && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="ml-2 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            title="Supprimer ce document"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Modal de confirmation de suppression */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4 rounded-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              className="text-center"
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <p className="text-sm font-bold text-navy mb-1">Supprimer ce document ?</p>
              <p className="text-xs text-slate-500 mb-4">Votre PatrimoScore™ diminuera de <span className="font-bold text-red-500">-10 pts</span></p>
              <div className="flex items-center gap-2 justify-center">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    onDelete?.(file.id);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge Fraud Score - Audit Anti-Fraude */}
      {file.fraudScore !== undefined && file.fraudScore !== null && !isAnalyzing && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className={`px-4 pb-3 border-t ${
            file.fraudScore <= 10 
              ? 'bg-emerald-50 border-emerald-200' 
              : file.fraudScore <= 50 
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                file.fraudScore <= 10 
                  ? 'bg-emerald-500' 
                  : file.fraudScore <= 50 
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Audit Anti-Fraude
                </p>
                <p className={`text-xs font-bold ${
                  file.fraudScore <= 10 
                    ? 'text-emerald-700' 
                    : file.fraudScore <= 50 
                    ? 'text-amber-700'
                    : 'text-red-700'
                }`}>
                  {file.fraudScore <= 10 
                    ? '✅ Document authentique' 
                    : file.fraudScore <= 50 
                    ? '⚠️ Incohérences mineures'
                    : '🚨 Fraude suspectée'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <motion.span
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className={`text-xl font-bold ${
                  file.fraudScore <= 10 
                    ? 'text-emerald-600' 
                    : file.fraudScore <= 50 
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`}
              >
                {file.fraudScore}
              </motion.span>
              <p className="text-[8px] text-slate-400 uppercase tracking-wider">/100</p>
            </div>
          </div>
          
          {/* Détails de l'audit si fraudScore > 10 */}
          {file.fraudScore > 10 && file.aiAnalysis?.fraudAudit && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-3 pt-3 border-t border-slate-200"
            >
              <div className="space-y-2">
                {file.aiAnalysis.fraudAudit.structureAnalysis?.suspiciousAlignment && (
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 text-xs">⚠️</span>
                    <p className="text-[10px] text-slate-700">
                      <strong>Structure:</strong> {file.aiAnalysis.fraudAudit.structureAnalysis.details[0] || 'Alignements suspects détectés'}
                    </p>
                  </div>
                )}
                {file.aiAnalysis.fraudAudit.mathematicalAudit?.calculationErrors && (
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 text-xs">⚠️</span>
                    <p className="text-[10px] text-slate-700">
                      <strong>Calcul:</strong> {file.aiAnalysis.fraudAudit.mathematicalAudit.details[0] || 'Erreur de calcul détectée'}
                    </p>
                  </div>
                )}
                {file.aiAnalysis.fraudAudit.consistencyCheck?.dateIssues && (
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 text-xs">⚠️</span>
                    <p className="text-[10px] text-slate-700">
                      <strong>Cohérence:</strong> {file.aiAnalysis.fraudAudit.consistencyCheck.details[0] || 'Problème de date détecté'}
                    </p>
                  </div>
                )}
                {file.aiAnalysis.fraudAudit.metadataAnalysis?.suspiciousCreator && (
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 text-xs">🚨</span>
                    <p className="text-[10px] text-slate-700">
                      <strong>Métadonnées:</strong> PDF créé par {file.aiAnalysis.fraudAudit.metadataAnalysis.creatorSoftware || 'logiciel de retouche'}
                    </p>
                  </div>
                )}
                {file.aiAnalysis.fraudIndicators?.reasons && file.aiAnalysis.fraudIndicators.reasons.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 text-xs">📋</span>
                    <p className="text-[10px] text-slate-700">
                      <strong>Raisons:</strong> {file.aiAnalysis.fraudIndicators.reasons.join('; ')}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Message bienveillant pour documents nécessitant révision */}
      {(isNeedsReview || file.needsHumanReview) && !file.forceSent && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pb-3"
        >
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🧠</span>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Expert PatrimoTrust</p>
                <p className="text-sm text-amber-900 leading-relaxed">
                  {file.humanReviewReason || file.improvementTip || file.errorMessage || 'Document partiellement analysé. Une petite amélioration et c\'est parfait !'}
                </p>
                {file.extractedFields && file.extractedFields.length > 0 && (
                  <p className="text-xs text-amber-700 mt-2">
                    ✅ Déjà extrait : {file.extractedFields.join(', ')}
                  </p>
                )}
              </div>
            </div>
            
            {/* Bouton "Envoyer quand même" */}
            {onForceValidate && file.canForceSend !== false && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <button
                  onClick={() => onForceValidate(file.id)}
                  className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <span>Envoyer quand même au propriétaire</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
                <p className="text-[10px] text-amber-600 text-center mt-2">
                  Le propriétaire sera informé qu'une vérification visuelle est recommandée
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Badge "Envoyé malgré doute" */}
      {file.forceSent && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pb-3"
        >
          <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-[10px] text-blue-700 flex items-center gap-1">
              <span>📤</span>
              Document envoyé • Le propriétaire effectuera une vérification visuelle
            </p>
          </div>
        </motion.div>
      )}

      {isRejected && !file.flagged && (file.humanReviewReason || file.improvementTip) && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pb-3 -mt-1"
        >
          <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border border-red-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">📄</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-red-700 mb-1">Document non retenu</p>
                <p className="text-sm text-red-900 leading-relaxed">
                  {file.humanReviewReason || file.improvementTip}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Message d'erreur pour documents illisibles */}
      {isIllegible && file.errorMessage && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pb-3 -mt-1"
        >
          <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">💁‍♀️</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-700 mb-1">Conseil de l&apos;Expert</p>
                <p className="text-sm text-orange-900 leading-relaxed">
                  {file.errorMessage}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recommandations IA */}
      {file.aiAnalysis?.recommendations?.length && isCertified && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pb-3 -mt-1"
        >
          <p className="text-[10px] text-slate-500 italic flex items-center gap-1">
            <SparklesIcon className="w-3 h-3 text-emerald-500" />
            {file.aiAnalysis.recommendations[0]}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// --- Types ---
interface Property {
  _id: string;
  name: string;
  address: string;
  rentAmount: number;
  photos: string[];
  city?: string;
}

type CandidateStatus = 'Etudiant' | 'Salarie' | 'Independant' | 'Retraite';
type GuaranteeMode = 'NONE' | 'VISALE' | 'PHYSICAL';
type GuarantorCertificationMethod = 'DIDIT' | 'AUDIT' | 'VISALE' | null;

interface GuarantorSlotState {
  slot: 1 | 2;
  profile: CandidateStatus | 'Retraite';
  firstName: string;
  lastName: string;
  email: string;
  status: 'NONE' | 'PENDING' | 'CERTIFIED' | 'AUDITED';
  certificationMethod: GuarantorCertificationMethod;
  invitationSent: boolean;
}

type GuarantorBlockStatus = 'complete' | 'partial' | 'missing';

interface GuarantorChapterBlock {
  id: 'identity' | 'income' | 'activity' | 'domicile';
  label: string;
  description: string;
  status: GuarantorBlockStatus;
}

interface DocumentFile {
  id: string;
  type: string;
  name: string;
  originalName?: string; // Nom original avant renommage IA
  suggestedName?: string; // Nom suggéré par l'IA
  isRenamed?: boolean; // Si le fichier a été renommé par l'IA
  status: 'pending' | 'scanning' | 'analyzing' | 'certified' | 'rejected' | 'illegible' | 'needs_review';
  category: string;
  url?: string; // URL du fichier sur le serveur
  confidenceScore?: number;
  fraudScore?: number; // Score de fraude 0-100 (0 = authentique, >50 = suspect)
  flagged?: boolean;
  dateEmission?: string; // Date d'émission estimée (YYYY-MM-DD)
  dateExpiration?: string; // Date d'expiration estimée (YYYY-MM-DD) pour les pièces avec validité
  // Nouveaux champs "Bienveillance Sécuritaire"
  needsHumanReview?: boolean; // true si l'IA recommande vérification humaine
  humanReviewReason?: string; // Raison du doute pour le propriétaire
  partialExtraction?: boolean; // true si extraction partielle
  extractedFields?: string[]; // Liste des champs extraits avec succès
  improvementTip?: string; // Conseil d'amélioration du document
  forceSent?: boolean; // true si le locataire a forcé l'envoi malgré le doute
  canForceSend?: boolean;
  categoryMatch?: boolean;
  subjectType?: 'tenant' | 'guarantor' | 'visale';
  subjectSlot?: 1 | 2;
  // Champs pour la cohérence documentaire
  inconsistencyDetected?: boolean; // Incohérence de nom détectée
  inconsistencyJustification?: string; // Justification fournie par l'utilisateur
  inconsistencyResolved?: boolean; // L'incohérence a été résolue
  extractedData?: {
    nom?: string;
    prenom?: string;
    montants?: number[];
    dates?: string[];
    employeur?: string;
    organisme?: string;
  };
  aiAnalysis?: {
    documentType: string;
    ownerName?: string;
    document_metadata?: { owner_name?: string };
    financial_data?: AnalysisV2Result['financial_data'];
    trust_and_security?: AnalysisV2Result['trust_and_security'];
    recommendations: string[];
    fraudIndicators?: {
      suspicious: boolean;
      reasons: string[];
    };
    fraudAudit?: {
      structureAnalysis?: {
        suspiciousAlignment: boolean;
        fontInconsistencies: boolean;
        details: string[];
      };
      mathematicalAudit?: {
        calculationErrors: boolean;
        brutNetDifference?: number;
        details: string[];
      };
      consistencyCheck?: {
        dateIssues: boolean;
        addressMismatch: boolean;
        details: string[];
      };
      metadataAnalysis?: {
        suspiciousCreator: boolean;
        creatorSoftware?: string;
        details: string[];
      };
    };
  };
  errorMessage?: string; // Message d'erreur pour documents illisibles
}

// --- Configuration de la Checklist de Certification ---
interface CertificationItem {
  id: string;
  category: string;
  label: string;
  description: string;
  keywords: string[];
  required: boolean;
}

const CERTIFICATION_ITEMS: Record<string, CertificationItem[]> = {
  identite: [
    { id: 'cni', category: 'Identité', label: 'CNI / Passeport', description: 'Document officiel en cours de validité.', keywords: ['cni', 'carte', 'identite', 'passeport', 'id'], required: true },
    { id: 'photo_profil', category: 'Identité', label: 'Photo de profil professionnelle', description: 'Renforce la confiance du propriétaire.', keywords: ['photo', 'profil', 'portrait', 'selfie'], required: false }
  ],
  domicile: [
    { id: 'domicile', category: 'Domicile', label: 'Justificatif de domicile', description: 'Facture ou quittance de moins de 3 mois.', keywords: ['domicile', 'facture', 'edf', 'engie', 'totalenergies', 'gdf', 'gaz', 'electricite', 'energie', 'eau', 'internet', 'telephone', 'orange', 'sfr', 'free', 'bouygues', 'quittance', 'assurance habitation', 'habitation', 'echeance'], required: true },
    { id: 'quittance', category: 'Domicile', label: 'Quittance de loyer', description: 'Prouve que vous êtes un locataire exemplaire.', keywords: ['quittance', 'loyer'], required: false }
  ],
  activite: [
    { id: 'scolarite', category: 'Activité', label: 'Certificat de scolarité', description: 'Année en cours.', keywords: ['scolarite', 'certificat', 'etudiant', 'inscription', 'universite'], required: false },
    { id: 'attestation_employeur', category: 'Activité', label: 'Attestation employeur (< 1 mois)', description: 'Garantit votre situation réelle au-delà du contrat.', keywords: ['attestation employeur', 'employeur', 'attestation', 'certificat employeur'], required: false },
    { id: 'contrat', category: 'Activité', label: 'Contrat de travail', description: 'CDI/CDD ou promesse d\'embauche.', keywords: ['contrat', 'travail', 'cdi', 'cdd', 'emploi', 'promesse'], required: false },
    { id: 'attestation_urssaf', category: 'Activité', label: 'Attestation URSSAF', description: 'Situation à jour.', keywords: ['urssaf', 'attestation urssaf'], required: false },
    { id: 'bilan_n1', category: 'Activité', label: 'Bilan N-1', description: 'Dernier exercice.', keywords: ['bilan', 'liasse', 'bilan n-1', 'bilan n1'], required: false },
    { id: 'bilan_n2', category: 'Activité', label: 'Bilan N-2', description: 'Avant-dernier exercice.', keywords: ['bilan', 'liasse', 'bilan n-2', 'bilan n2'], required: false },
    { id: 'kbis', category: 'Activité', label: 'Extrait Kbis / INSEE', description: 'Identification de l\'entreprise.', keywords: ['kbis', 'insee', 'siren', 'siret'], required: false }
  ],
  ressources: [
    { id: 'salaire', category: 'Ressources', label: 'Bulletins de salaire', description: '3 derniers mois.', keywords: ['salaire', 'bulletin', 'fiche', 'paie'], required: false },
    { id: 'avis_imposition', category: 'Ressources', label: 'Avis d\'imposition', description: 'Confirme la cohérence de vos revenus annuels.', keywords: ['avis d\'imposition', 'imposition', 'impot', 'rfr', 'revenu fiscal'], required: false },
    { id: 'bourse', category: 'Ressources', label: 'Avis de bourse', description: 'Notification CROUS.', keywords: ['bourse', 'crous', 'attribution'], required: false },
    { id: 'caf', category: 'Ressources', label: 'Simulation CAF/APL', description: 'Attestation.', keywords: ['caf', 'apl', 'als', 'aide', 'logement'], required: false },
    { id: 'pension', category: 'Ressources', label: 'Justificatif de pension', description: 'Alimentaire.', keywords: ['pension', 'alimentaire'], required: false },
    { id: 'visale', category: 'Ressources', label: 'Certificat Visale', description: 'Garantie gratuite de l\'État.', keywords: ['visale'], required: false }
  ],
  garantie: [
    { id: 'garant_id', category: 'Garantie', label: 'ID du garant', description: 'CNI ou Passeport', keywords: ['garant', 'identite', 'parent'], required: false },
    { id: 'garant_domicile', category: 'Garantie', label: 'Justificatif domicile', description: 'Moins de 3 mois', keywords: ['domicile', 'facture', 'edf', 'engie', 'gaz', 'eau', 'internet', 'telephone', 'orange', 'sfr', 'free', 'bouygues', 'quittance', 'assurance habitation', 'habitation', 'echeance'], required: false },
    { id: 'garant_salaires', category: 'Garantie', label: 'Salaires du garant', description: '3 derniers bulletins', keywords: ['garant', 'salaire', 'bulletin'], required: false }
  ],
  engagement: [
    { id: 'motivation', category: 'Engagement', label: 'Lettre de motivation', description: 'Personnalisée', keywords: ['motivation', 'lettre'], required: false }
  ]
};

// Aplatir tous les items pour la détection
const ALL_CERTIFICATION_ITEMS = Object.values(CERTIFICATION_ITEMS).flat();

// Messages de recommandation IA
const AI_MESSAGES: Record<string, string> = {
  bourse: "L'IA PatrimoTrust™ suggère d'ajouter votre avis d'attribution de bourse pour maximiser la confiance du propriétaire.",
  caf: "Une simulation CAF/APL renforce significativement la crédibilité de votre dossier auprès des bailleurs.",
  avis_imposition: "L'avis d'imposition confirme la cohérence de vos revenus annuels.",
  attestation_employeur: "L'attestation employeur (< 1 mois) est un critère clé pour sécuriser votre dossier.",
  domicile: "Un justificatif de domicile récent renforce la conformité administrative de votre dossier.",
  attestation_urssaf: "L'attestation URSSAF prouve la régularité de votre activité.",
  bilan_n1: "Deux bilans récents ou une attestation URSSAF renforcent la transparence financière.",
  garant_salaires: "Les justificatifs de revenus du garant sont essentiels pour une certification complète.",
  motivation: "Une lettre de motivation personnalisée fait la différence et démontre votre sérieux.",
  default: "Chaque document ajouté renforce votre Score de Confiance PatrimoTrust™."
};

// === NOUVEAUX COMPOSANTS UX ===

// --- Documents requis selon profil ---
const REQUIRED_DOCS_BY_PROFILE: Record<string, { required: string[]; optional: string[]; boost: { id: string; label: string; points: number; icon: string }[] }> = {
  Etudiant: {
    required: ['cni', 'scolarite', 'domicile'],
    optional: ['bourse', 'caf', 'avis_imposition', 'pension'],
    boost: [
      { id: 'quittance', label: 'Dernière quittance de loyer', points: 10, icon: '🏠' },
      { id: 'photo_profil', label: 'Photo de profil professionnelle', points: 5, icon: '📸' },
    ]
  },
  Salarie: {
    required: ['cni', 'attestation_employeur', 'salaire', 'avis_imposition', 'domicile'],
    optional: ['contrat'],
    boost: [
      { id: 'quittance', label: 'Dernière quittance de loyer', points: 10, icon: '🏠' },
      { id: 'photo_profil', label: 'Photo de profil professionnelle', points: 5, icon: '📸' },
    ]
  },
  Independant: {
    required: ['cni', 'avis_imposition', 'bilan_n1', 'bilan_n2', 'attestation_urssaf', 'domicile'],
    optional: ['kbis'],
    boost: [
      { id: 'quittance', label: 'Dernière quittance de loyer', points: 10, icon: '🏠' },
      { id: 'photo_profil', label: 'Photo de profil professionnelle', points: 5, icon: '📸' },
    ]
  },
  Retraite: {
    required: ['cni', 'pension', 'avis_imposition', 'domicile'],
    optional: [],
    boost: [
      { id: 'quittance', label: 'Dernière quittance de loyer', points: 10, icon: '🏠' },
      { id: 'photo_profil', label: 'Photo de profil professionnelle', points: 5, icon: '📸' },
    ]
  },
};

// --- Composant ProgressSidebar ---
interface ProgressSidebarProps {
  profile: 'Etudiant' | 'Salarie' | 'Independant' | 'Retraite';
  certifiedItems: Set<string>;
  uploadedFiles: { identity: DocumentFile[]; resources: DocumentFile[]; guarantor: DocumentFile[] };
  score: number;
  diditVerified: boolean;
}

function ProgressSidebar({ profile, certifiedItems, uploadedFiles, score, diditVerified }: ProgressSidebarProps) {
  const profileDocs = REQUIRED_DOCS_BY_PROFILE[profile] || REQUIRED_DOCS_BY_PROFILE.Etudiant;
  
  const allFiles = [...uploadedFiles.identity, ...uploadedFiles.resources, ...uploadedFiles.guarantor];
  const certifiedCount = allFiles.filter(f => f.status === 'CERTIFIED' && !f.flagged).length;

  const normalizeText = (value: string) =>
    value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const isBilanFile = (file: DocumentFile) => {
    const name = normalizeText(`${file.aiAnalysis?.documentType || ''} ${file.type || ''} ${file.name || ''}`);
    return name.includes('bilan') || name.includes('liasse');
  };

  const hasUrssaf = allFiles.some(f => {
    const name = normalizeText(`${f.aiAnalysis?.documentType || ''} ${f.type || ''} ${f.name || ''}`);
    return name.includes('urssaf');
  });

  const bilanCertifiedCount = allFiles.filter(f => f.status === 'CERTIFIED' && !f.flagged && isBilanFile(f)).length;

  const requiredCount = profileDocs.required.length + (diditVerified ? 1 : 0);
  const satisfiedRequiredCount = profileDocs.required.filter(id => {
    if (id === 'bilan_n1') return hasUrssaf || bilanCertifiedCount >= 1;
    if (id === 'bilan_n2') return hasUrssaf || bilanCertifiedCount >= 2;
    if (id === 'attestation_urssaf') return hasUrssaf || bilanCertifiedCount >= 2;
    return certifiedItems.has(id);
  }).length;
  // Synchroniser la barre de progression avec le PatrimoMeter (score)
  const completionPercent = score; // Harmonisation : progression = score PatrimoMeter

  const isRequirementSatisfied = (itemId: string) => {
    if (itemId === 'bilan_n1') return hasUrssaf || bilanCertifiedCount >= 1;
    if (itemId === 'bilan_n2') return hasUrssaf || bilanCertifiedCount >= 2;
    if (itemId === 'attestation_urssaf') return hasUrssaf || bilanCertifiedCount >= 2;
    return certifiedItems.has(itemId);
  };

  const hasMatchingFile = (itemId: string) => {
    const item = ALL_CERTIFICATION_ITEMS.find(i => i.id === itemId);
    if (!item) return false;
    const keywords = item.keywords.map(k => normalizeText(k));
    return allFiles.some(file => {
      const haystack = normalizeText(`${file.aiAnalysis?.documentType || ''} ${file.type || ''} ${file.name || ''}`);
      return keywords.some(keyword => haystack.includes(keyword));
    });
  };

  const getItemStatus = (itemId: string): 'certified' | 'pending' | 'missing' => {
    if (isRequirementSatisfied(itemId)) return 'certified';
    if (hasMatchingFile(itemId)) return 'pending';
    return 'missing';
  };

  const categoryOrder = ['Identité', 'Domicile', 'Activité', 'Ressources'];
  const requiredItems = profileDocs.required
    .map(id => ALL_CERTIFICATION_ITEMS.find(item => item.id === id))
    .filter((item): item is CertificationItem => !!item);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      {/* Header avec barre de complétion */}
      <div className="p-4 bg-gradient-to-r from-navy to-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-bold text-sm">Progression du dossier</h3>
          <span className="text-emerald-400 font-bold text-lg">{completionPercent}%</span>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-white/60 text-[10px] uppercase tracking-wider">
            {certifiedCount} document{certifiedCount > 1 ? 's' : ''} certifié{certifiedCount > 1 ? 's' : ''}
          </p>
          <p className="text-white/40 text-[8px]">
            Score : {score}/100
          </p>
        </div>
      </div>
      
      {/* Mention protection juridique */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
        <p className="text-[9px] text-slate-500 flex items-center gap-1.5">
          <span>🔒</span>
          <span>Données cryptées AES-256 • Secret professionnel PatrimoTrust</span>
        </p>
      </div>

      {/* Identité Didit */}
      <div className={`p-3 border-b ${diditVerified ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100'}`}>
        <div className="flex items-center gap-3">
          <motion.div
            animate={diditVerified ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3 }}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              diditVerified ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/30' : 'bg-slate-200'
            }`}
          >
            {diditVerified ? (
              <span className="text-white text-sm">🛡️</span>
            ) : (
              <div className="w-4 h-4 border-2 border-slate-400 rounded-full" />
            )}
          </motion.div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${diditVerified ? 'text-emerald-700' : 'text-slate-400'}`}>
              Identité certifiée Didit
            </p>
            <p className={`text-[10px] ${diditVerified ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
              {diditVerified ? '✓ Bloc Identité validé' : 'Bloc Identité 25 points'}
            </p>
          </div>
          {diditVerified && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full"
            >
              SCELLÉ
            </motion.span>
          )}
        </div>
        {!diditVerified && (
          <p className="text-[9px] text-slate-400 mt-2 pl-11">
            🔒 Zéro stockage de documents. Certification souveraine instantanée.
          </p>
        )}
      </div>

      {/* Checklist Souveraine */}
      <div className="p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Checklist Souveraine</p>
        <div className="space-y-4">
          {categoryOrder.map(category => {
            const categoryItems = requiredItems.filter(item => item.category === category);
            if (categoryItems.length === 0) return null;
            const missingItems = categoryItems.filter(item => !isRequirementSatisfied(item.id));

            return (
              <div key={category} className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{category}</p>
                {categoryItems.map(item => {
                  const status = getItemStatus(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3"
                    >
                      <motion.div
                        animate={status === 'certified' ? { scale: [1, 1.3, 1] } : {}}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          status === 'certified' 
                            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/30' 
                            : status === 'pending'
                            ? 'bg-amber-100 border-2 border-amber-400'
                            : 'bg-slate-100 border-2 border-slate-300'
                        }`}
                      >
                        {status === 'certified' && <span className="text-white text-sm">🛡️</span>}
                        {status === 'pending' && <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
                      </motion.div>
                      <span className={`text-sm flex-1 ${
                        status === 'certified' ? 'text-navy font-medium' : 'text-slate-500'
                      }`}>
                        {item.label}
                      </span>
                      {item.description && (
                        <span
                          title={item.description}
                          className="text-[10px] text-slate-400 cursor-help"
                          aria-label={item.description}
                        >
                          ℹ️
                        </span>
                      )}
                    </motion.div>
                  );
                })}
                {missingItems.length > 0 && (
                  <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    {category} : Manque {missingItems[0].label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Documents optionnels (boost) */}
      <div className="p-3 bg-gradient-to-b from-amber-50 to-white border-t border-amber-100">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-3 flex items-center gap-1">
          <span>⭐</span> Boostez votre score
        </p>
        <div className="space-y-2">
          {profileDocs.boost.map(boost => {
            const isCertified = certifiedItems.has(boost.id);
            
            return (
              <div key={boost.id} className="flex items-center gap-3">
                <span className="text-amber-500">★</span>
                <span className="text-lg">{boost.icon}</span>
                <span className={`text-xs flex-1 ${isCertified ? 'text-emerald-700 line-through' : 'text-slate-600'}`}>
                  {boost.label}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isCertified 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  +{boost.points} pts
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Composant SmartAdvice (Next Best Action) ---
interface SmartAdviceProps {
  score: number;
  profile: 'Etudiant' | 'Salarie' | 'Independant';
  certifiedItems: Set<string>;
  diditVerified: boolean;
  userName: string;
}

function SmartAdvice({ score, profile, certifiedItems, diditVerified, userName }: SmartAdviceProps) {
  const getNextBestAction = (): { message: string; action: string; impact: number; icon: string } => {
    const isSatisfied = (id: string) => {
      if (id === 'bilan_n1' || id === 'bilan_n2') {
        return certifiedItems.has(id) || certifiedItems.has('attestation_urssaf');
      }
      if (id === 'attestation_urssaf') {
        return certifiedItems.has('attestation_urssaf') || (certifiedItems.has('bilan_n1') && certifiedItems.has('bilan_n2'));
      }
      return certifiedItems.has(id);
    };

    // Priorité 1: Didit
    if (!diditVerified) {
      return {
        message: `${userName}, commencez par certifier votre identité avec Didit pour débloquer votre dossier.`,
        action: 'Certifier mon identité',
        impact: 40,
        icon: '🔐'
      };
    }

    // Priorité 2: Documents requis manquants
    const profileDocs = REQUIRED_DOCS_BY_PROFILE[profile] || REQUIRED_DOCS_BY_PROFILE.Etudiant;
    for (const docId of profileDocs.required) {
      if (!isSatisfied(docId)) {
        const item = ALL_CERTIFICATION_ITEMS.find(i => i.id === docId);
        return {
          message: `Ajoutez ${item?.label || 'le document requis'} pour compléter votre dossier.`,
          action: `Ajouter ${item?.label || 'document'}`,
          impact: 10,
          icon: '📄'
        };
      }
    }

    // Priorité 3: Garant si score < 80
    if (score < 80 && !certifiedItems.has('garant_salaires')) {
      return {
        message: `Votre score est de ${score}. Ajoutez un garant pour franchir la barre des 80 et rassurer le propriétaire.`,
        action: 'Ajouter un garant',
        impact: 20,
        icon: '👥'
      };
    }

    // Priorité 4: Boost documents
    const boost = profileDocs.boost.find(b => !certifiedItems.has(b.id));
    if (boost) {
      return {
        message: `Excellent dossier ! Ajoutez "${boost.label}" pour maximiser vos chances.`,
        action: `Ajouter ${boost.label}`,
        impact: boost.points,
        icon: boost.icon
      };
    }

    // Dossier complet
    return {
      message: `Félicitations ${userName} ! Votre dossier est complet et prêt pour l'envoi.`,
      action: 'Finaliser le dossier',
      impact: 0,
      icon: '🎉'
    };
  };

  const advice = getNextBestAction();

  if (score >= 90 && advice.impact === 0) {
    return null; // Ne pas afficher si dossier complet et excellent
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 border ${
        score < 50 
          ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200' 
          : score < 80
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
          : 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">{advice.icon}</div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
            Conseil de l&apos;Expert
          </p>
          <p className="text-sm text-navy leading-relaxed">{advice.message}</p>
          {advice.impact > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                +{advice.impact} points potentiels
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// --- Icons (Lucide-style SVGs) ---
function CheckCircleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01" strokeLinecap="round" />
      <path d="M11 12h2v5h-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IdCardIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="M14 10h4M14 14h2" strokeLinecap="round" />
    </svg>
  );
}

function SparklesIcon({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" strokeLinecap="round" />
      <path d="M12 8l1.5 3.5L17 13l-3.5 1.5L12 18l-1.5-3.5L7 13l3.5-1.5L12 8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function UsersIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function ShieldIcon({ className = "w-32 h-32" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QRCodeIcon({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="3" height="3" />
      <rect x="18" y="14" width="3" height="3" />
      <rect x="14" y="18" width="3" height="3" />
      <rect x="18" y="18" width="3" height="3" />
    </svg>
  );
}

function LockIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function ArrowRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LightbulbIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21h6M12 3a6 6 0 00-3 11.19V17a1 1 0 001 1h4a1 1 0 001-1v-2.81A6 6 0 0012 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AwardIcon({ className = "w-20 h-20" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function FileIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// --- Skip Verification Button with Score Nudge ---
function SkipVerificationButton({ onSkip, onUpload, onScan }: { onSkip: () => void; onUpload: () => void; onScan?: () => void }) {
  const [showAlert, setShowAlert] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  
  const handleClick = () => {
    setShowAlert(true);
  };

  const handleConfirmSkip = () => {
    setShowAlert(false);
    onSkip();
  };

  const handleUploadInstead = () => {
    setShowAlert(false);
    onUpload();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="text-sm text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-4 decoration-dashed"
      >
        Continuer sans vérification souveraine
      </button>

      {/* Micro-alerte élégante */}
      <AnimatePresence>
        {(showAlert || isHovering) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-80 z-50"
          >
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-xl shadow-amber-500/10">
              {/* Flèche */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-50 border-l border-t border-amber-200 rotate-45" />
              
              <div className="relative">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                    <AlertTriangleIcon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 mb-1">Impact sur votre candidature</h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      L'absence de certification Didit limite votre <span className="font-bold">PatrimoScore™</span> au grade <span className="font-bold text-amber-900">B maximum</span> et nécessite un upload manuel de vos pièces d'identité à l'étape suivante.
                    </p>
                  </div>
                </div>

                {showAlert && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleUploadInstead}
                        className="flex-1 px-3 py-2 bg-white border border-amber-200 text-amber-700 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-amber-50 transition-colors"
                      >
                        Upload manuel
                      </button>
                      <button
                        onClick={handleConfirmSkip}
                        className="flex-1 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
                      >
                        Continuer quand même
                      </button>
                    </div>
                    {onScan && (
                      <button
                        onClick={() => { setShowAlert(false); onScan(); }}
                        className="md:hidden w-full px-3 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-bold uppercase tracking-wider active:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <span>📸</span> Scanner ma pièce d&apos;identité
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- PatrimoMeter: Système de Gamification ---
interface PatrimoMeterProps {
  score: number;
  previousScore: number;
  userName: string;
  nextAction?: string;
  nextActionPoints?: number;
  hasInconsistency?: boolean;
  scoreDelta?: number | null;
  hasExpirationMalus?: boolean;
  canGeneratePassport?: boolean;
  passportHint?: string;
}

function PatrimoMeter({ 
  score, 
  previousScore, 
  userName, 
  nextAction, 
  nextActionPoints,
  hasInconsistency,
  scoreDelta,
  hasExpirationMalus,
  canGeneratePassport,
  passportHint,
}: PatrimoMeterProps) {
  const [displayScore, setDisplayScore] = useState(previousScore);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationTriggered, setCelebrationTriggered] = useState(false);
  
  // Déterminer le grade - Nouveaux seuils harmonisés
  const getGrade = (s: number): { grade: string; label: string; color: string } => {
    if (s >= 90) return { grade: 'S', label: 'Souverain', color: 'text-amber-500' };
    if (s >= 71) return { grade: 'A', label: 'Premium', color: 'text-emerald-500' };
    if (s >= 41) return { grade: 'B', label: 'Standard', color: 'text-blue-500' };
    return { grade: '—', label: 'Initial', color: 'text-slate-400' };
  };

  const rawGrade = getGrade(score);
  const gradeInfo = hasExpirationMalus && rawGrade.grade === 'S'
    ? { grade: 'A', label: 'Excellent (à rafraîchir)', color: 'text-emerald-500' }
    : rawGrade;
  
  // Animation du compteur (rolling number effect)
  useEffect(() => {
    if (score === displayScore) return;
    
    const duration = 800;
    const steps = 20;
    const stepDuration = duration / steps;
    const increment = (score - displayScore) / steps;
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayScore(score);
        clearInterval(interval);
      } else {
        setDisplayScore(prev => Math.round(prev + increment));
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [score, displayScore]);

  // Célébration AAA
  useEffect(() => {
    if (score >= 90 && !celebrationTriggered) {
      setShowCelebration(true);
      setCelebrationTriggered(true);
      setTimeout(() => setShowCelebration(false), 4000);
    }
  }, [score, celebrationTriggered]);

  const getNextGrade = (current: string) => {
    if (current === '—') return 'B (Standard)';
    if (current === 'B') return 'A (Premium)';
    if (current === 'A') return 'S (Souverain)';
    return 'S (Souverain)';
  };

  // Gradient de la barre
  const getGradientColor = () => {
    if (hasExpirationMalus) return 'from-amber-400 via-amber-500 to-orange-500';
    if (score >= 90) return 'from-amber-400 via-amber-500 to-yellow-400';
    if (score >= 70) return 'from-emerald-400 via-emerald-500 to-emerald-600';
    if (score >= 50) return 'from-blue-400 via-blue-500 to-blue-600';
    return 'from-slate-300 via-slate-400 to-slate-500';
  };

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, score);
  const dashOffset = circumference - (progress / 100) * circumference;

  // Le composant est maintenant intégré dans le panneau latéral (non fixe)
  return (
    <div className="w-full mb-6">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className={`glass-cockpit rounded-2xl shadow-2xl border overflow-hidden ${
          showCelebration ? 'border-amber-300 shadow-amber-200/50' : hasInconsistency ? 'border-orange-200' : 'border-slate-100'
        }`}
      >
        {/* Célébration AAA - Effet brillance dorée */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 via-yellow-300/20 to-amber-400/10 animate-pulse" />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 1.5, repeat: 2 }}
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-12"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">PatrimoMeter™</span>
            <motion.span 
              key={gradeInfo.grade}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-[10px] font-black uppercase tracking-widest ${gradeInfo.color}`}
            >
              Grade {gradeInfo.grade}
            </motion.span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="#e2e8f0"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke="url(#patrimoGradient)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
                {hasExpirationMalus && (
                  <circle
                    cx="50"
                    cy="50"
                    r={radius + 6}
                    stroke="#f97316"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="4 4"
                  />
                )}
                <defs>
                  <linearGradient id="patrimoGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="60%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-2 bg-white rounded-full flex flex-col items-center justify-center text-navy">
                <motion.span
                  key={displayScore}
                  initial={{ y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-xl font-serif font-bold"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {displayScore}
                </motion.span>
                <span className="text-[8px] uppercase tracking-widest text-slate-400">/100</span>
              </div>
              <AnimatePresence>
                {scoreDelta && scoreDelta > 0 && (
                  <motion.div
                    key={`delta-${scoreDelta}`}
                    initial={{ opacity: 0, y: 6, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-2 py-1 rounded-full shadow-lg"
                  >
                    +{scoreDelta}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-slate-900 text-white text-[9px] px-2 py-1 rounded-full shadow-lg">
                  Score temps réel basé sur vos pièces certifiées
                </div>
              </div>
            </div>

            <div>
              <motion.div
                key={gradeInfo.grade}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`text-4xl font-serif ${gradeInfo.color}`}
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {gradeInfo.grade}
              </motion.div>
              <p className="text-xs text-slate-500">{gradeInfo.label}</p>
            </div>
          </div>
        </div>

        {/* Barre de progression fine et luxe */}
        <div className="px-5 pb-4">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: `${previousScore}%` }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full rounded-full bg-gradient-to-r ${getGradientColor()} relative`}
            >
              {/* Effet brillance sur la barre */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </motion.div>
          </div>
          
          {/* Marqueurs de grade */}
          <div className="flex justify-between mt-1.5 text-[7px] font-bold text-slate-300 uppercase">
            <span>Initial</span>
            <span>Standard</span>
            <span>Premium</span>
            <span className="text-amber-400">Souverain</span>
          </div>

          <div className="mt-4 text-xs text-slate-600">
            {nextAction ? (
              <span>
                Prochaine étape : {nextAction} pour passer au Grade {getNextGrade(gradeInfo.grade)}.
              </span>
            ) : (
              <span>Votre dossier est prêt pour le Grade {gradeInfo.grade}.</span>
            )}
          </div>

          {canGeneratePassport ? (
            <button
              className="mt-4 w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all patrimo-gradient text-white shadow-lg hover:opacity-90"
            >
              🛡️ Générer mon Passeport
            </button>
          ) : (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-500 text-center">
                {passportHint || 'Complétez les chapitres réellement requis pour débloquer votre Passeport Souverain.'}
              </p>
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-slate-400 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, score)}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-400 text-center mt-1">{score}/100 points</p>
            </div>
          )}
        </div>

        {/* Alerte Incohérence */}
        <AnimatePresence>
          {hasInconsistency && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 py-3 bg-orange-50 border-t border-orange-100">
                <div className="flex items-center gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <p className="text-[10px] text-orange-700 font-medium">
                    Incohérence détectée • <span className="text-orange-500 font-bold">-15 pts</span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nudge IA */}
        {nextAction && (
          <div className="px-5 py-4 bg-gradient-to-br from-slate-50 to-white border-t border-slate-100">
            <div className="flex items-start gap-2">
              <SparklesIcon className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <span className="font-medium">{nextAction}</span>
                  {nextActionPoints && (
                    <span className="ml-1 text-emerald-600 font-bold">
                      (+{nextActionPoints} pts)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Notification Célébration */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 py-4 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-t border-amber-200">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5, repeat: 3 }}
                  >
                    <AwardIcon className="w-6 h-6 text-amber-500" />
                  </motion.div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-0.5">
                      Rang d'Excellence Atteint !
                    </p>
                    <p className="text-xs text-amber-700">
                      Félicitations <span className="font-bold">{userName}</span>, votre dossier a atteint le rang d'Excellence.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* Style pour l'animation shimmer */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}

// --- Expert PatrimoTrust: Conseiller IA Adaptatif ---
interface ExpertAdvice {
  message: string;
  action?: string;
  priority: 'high' | 'medium' | 'low';
  icon: 'star' | 'warning' | 'tip' | 'success';
}

interface ExpertPatrimoTrustProps {
  profile: 'Etudiant' | 'Salarie' | 'Independant';
  score: number;
  rentAmount?: number;
  detectedIncome?: number | null;
  hasGuarantor: boolean;
  guarantorIncome?: number | null;
  certifiedItems: Set<string>;
  userName: string;
  hasFlaggedDocs: boolean;
}

function ExpertPatrimoTrust({
  profile,
  score,
  rentAmount = 0,
  detectedIncome,
  hasGuarantor,
  guarantorIncome,
  certifiedItems,
  userName,
  hasFlaggedDocs
}: ExpertPatrimoTrustProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentAdviceIndex, setCurrentAdviceIndex] = useState(0);

  // Calcul du ratio loyer/revenu
  const rentRatio = detectedIncome && rentAmount > 0 
    ? Math.round((rentAmount / detectedIncome) * 100) 
    : null;

  // Calcul du ratio garant (revenus garant / loyer)
  const guarantorRatio = guarantorIncome && rentAmount > 0
    ? Math.round(guarantorIncome / rentAmount)
    : null;

  // Génère les conseils adaptatifs selon le profil
  const generateAdvice = (): ExpertAdvice[] => {
    const advice: ExpertAdvice[] = [];

    // --- Conseils communs ---
    if (score < 40) {
      advice.push({
        message: `${userName}, votre dossier débute son ascension. Chaque document ajouté vous rapproche de l'Excellence.`,
        priority: 'medium',
        icon: 'tip'
      });
    }

    if (hasFlaggedDocs) {
      advice.push({
        message: `Notre analyse a détecté une légère incohérence. Fournissez l'original pour lever toute réserve et restaurer votre score.`,
        action: 'Corriger maintenant',
        priority: 'high',
        icon: 'warning'
      });
    }

    // --- Conseils selon le profil ---
    if (profile === 'Etudiant') {
      // Vérification garant pour étudiant
      if (!hasGuarantor) {
        advice.push({
          message: `En tant qu'étudiant, le dossier de votre garant est la clé de voûte de votre certification. Invitez-le à compléter son espace sécurisé.`,
          action: 'Inviter mon garant',
          priority: 'high',
          icon: 'star'
        });
      } else if (guarantorRatio !== null && guarantorRatio < 4) {
        advice.push({
          message: `Les revenus de votre garant représentent ${guarantorRatio}x le loyer. Pour atteindre le score AAA, nous recommandons un second garant ou une caution solidaire.`,
          action: 'Ajouter un garant',
          priority: 'high',
          icon: 'warning'
        });
      } else if (guarantorRatio !== null && guarantorRatio >= 4) {
        advice.push({
          message: `Excellent choix de garant : ses revenus couvrent ${guarantorRatio}x le loyer. Votre dossier inspire confiance.`,
          priority: 'low',
          icon: 'success'
        });
      }

      // Documents clés étudiants
      if (!certifiedItems.has('bourse') && !certifiedItems.has('scolarite')) {
        advice.push({
          message: `L'ajout de votre certificat de scolarité ou avis de bourse valorise immédiatement votre profil académique.`,
          action: 'Ajouter un justificatif',
          priority: 'medium',
          icon: 'tip'
        });
      }

      if (!certifiedItems.has('caf')) {
        advice.push({
          message: `Une simulation CAF/APL démontre votre éligibilité aux aides et renforce la solvabilité perçue de votre dossier.`,
          priority: 'low',
          icon: 'tip'
        });
      }
    }

    if (profile === 'Salarie') {
      // Ratio loyer/revenu
      if (rentRatio !== null) {
        if (rentRatio > 33) {
          advice.push({
            message: `Votre ratio loyer/revenu est de ${rentRatio}%. Au-delà de 33%, nous vous recommandons de mettre en avant une épargne solide ou d'ajouter un garant.`,
            action: 'Ajouter un justificatif',
            priority: 'high',
            icon: 'warning'
          });
        } else if (rentRatio <= 25) {
          advice.push({
            message: `Ratio loyer/revenu de ${rentRatio}% — un indicateur d'excellence. Votre capacité financière est optimale.`,
            priority: 'low',
            icon: 'success'
          });
        } else {
          advice.push({
            message: `Votre ratio loyer/revenu de ${rentRatio}% est dans la norme. Un justificatif d'épargne pourrait renforcer votre profil.`,
            priority: 'medium',
            icon: 'tip'
          });
        }
      }

      // Documents clés salariés
      if (!certifiedItems.has('contrat')) {
        advice.push({
          message: `Votre contrat de travail (CDI/CDD) est un pilier de crédibilité. Les propriétaires y accordent une attention particulière.`,
          action: 'Ajouter le contrat',
          priority: 'high',
          icon: 'star'
        });
      }

      // Comptage des bulletins de salaire
      const bulletinCount = Array.from(certifiedItems).filter(id => 
        id.includes('salaire') || id.includes('bulletin')
      ).length;
      
      if (bulletinCount < 3) {
        const missingCount = 3 - bulletinCount;
        advice.push({
          message: bulletinCount === 0 
            ? `${userName}, pour atteindre le Grade A immédiatement, déposez vos 3 derniers bulletins de salaire.`
            : `Il me manque ${missingCount} bulletin${missingCount > 1 ? 's' : ''} de salaire pour valider vos 20 points de revenus.`,
          action: 'Ajouter les bulletins',
          priority: 'high',
          icon: 'star'
        });
      } else {
        advice.push({
          message: `Excellent ! Vos 3 bulletins de salaire sont certifiés. +20 points de revenus validés.`,
          priority: 'low',
          icon: 'success'
        });
      }
    }

    if (profile === 'Independant') {
      advice.push({
        message: `En tant qu'indépendant, la régularité de vos revenus est scrutée. Les avis d'imposition N-1 et N-2 rassurent sur votre moyenne annuelle.`,
        action: 'Ajouter les avis',
        priority: 'high',
        icon: 'star'
      });

      if (detectedIncome) {
        advice.push({
          message: `Chiffre d'affaires détecté : ${detectedIncome.toLocaleString('fr-FR')}€. Pour un dossier AAA, démontrez la constance sur 24 mois minimum.`,
          priority: 'medium',
          icon: 'tip'
        });
      }

      if (!hasGuarantor && rentRatio && rentRatio > 25) {
        advice.push({
          message: `Compte tenu de la variabilité des revenus indépendants, un garant ou une caution bancaire sécuriserait votre candidature.`,
          action: 'Ajouter une garantie',
          priority: 'high',
          icon: 'warning'
        });
      }
    }

    // --- Conseil score plafonné ---
    if (score > 60 && score <= 70 && !hasGuarantor && profile === 'Etudiant') {
      advice.push({
        message: `Votre score est plafonné à 70 sans garant certifié. Débloquez les 30 points restants en complétant le dossier de garantie.`,
        action: 'Compléter la garantie',
        priority: 'high',
        icon: 'warning'
      });
    }

    // --- Félicitations score élevé ---
    if (score >= 85) {
      advice.push({
        message: `${userName}, votre dossier atteint le cercle prestigieux des candidatures d'Excellence. Les propriétaires privilégient systématiquement ce niveau.`,
        priority: 'low',
        icon: 'success'
      });
    }

    // Trier par priorité
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    advice.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return advice.slice(0, 3); // Max 3 conseils
  };

  const adviceList = generateAdvice();
  const currentAdvice = adviceList[currentAdviceIndex] || adviceList[0];

  // Rotation automatique des conseils
  useEffect(() => {
    if (adviceList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAdviceIndex(prev => (prev + 1) % adviceList.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [adviceList.length]);

  const getIconComponent = (icon: string) => {
    switch (icon) {
      case 'star':
        return <SparklesIcon className="w-5 h-5 text-amber-500" />;
      case 'warning':
        return <AlertTriangleIcon className="w-5 h-5 text-orange-500" />;
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-emerald-500" />;
      default:
        return <LightbulbIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = (icon: string) => {
    switch (icon) {
      case 'star': return 'border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50';
      case 'warning': return 'border-orange-200 bg-gradient-to-br from-orange-50/80 to-amber-50/50';
      case 'success': return 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/50';
      default: return 'border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/50';
    }
  };

  if (adviceList.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div 
        className="flex items-center justify-between mb-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-navy to-slate-700 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white text-xs font-serif font-bold">EP</span>
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Expert PatrimoTrust™</h4>
            <p className="text-[9px] text-slate-400">Conseiller dédié</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          className="text-slate-400"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </div>

      <AnimatePresence>
        {isExpanded && currentAdvice && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <motion.div
              key={currentAdviceIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className={`relative rounded-2xl border p-4 ${getBorderColor(currentAdvice.icon)}`}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
              </div>

              <div className="relative flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getIconComponent(currentAdvice.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium italic">
                    "{currentAdvice.message}"
                  </p>
                  {currentAdvice.action && (
                    <button className="mt-3 px-4 py-2 bg-navy text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
                      {currentAdvice.action}
                    </button>
                  )}
                </div>
              </div>

              {/* Indicateurs de pagination */}
              {adviceList.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-4">
                  {adviceList.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentAdviceIndex(idx);
                      }}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === currentAdviceIndex 
                          ? 'w-4 bg-navy' 
                          : 'bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Contextual Sidebar: 100% lié au currentStep et detectedProfile ---
interface ContextualSidebarProps {
  currentStep: number;
  diditStatus: 'idle' | 'loading' | 'verified';
  detectedProfile: string | null;
  candidateStatus: 'Etudiant' | 'Salarie' | 'Independant';
  certifiedItems: Set<string>;
  score: number;
  userName: string;
}

function ContextualSidebar({
  currentStep,
  diditStatus,
  detectedProfile,
  candidateStatus,
  certifiedItems,
  score,
  userName
}: ContextualSidebarProps) {

  // --- Messages contextuels selon le chapitre ---
  const getChapterContent = () => {
    // Chapitre I : Identité (Didit)
    if (currentStep === 1) {
      if (diditStatus === 'idle') {
        return {
          title: 'Certification d\'Identité',
          messages: [
            {
              type: 'info' as const,
              text: 'La certification d\'identité est le socle de votre PatrimoScore™. Préparez votre document officiel.',
              delay: 0
            },
            {
              type: 'tip' as const,
              text: 'CNI, Passeport ou Titre de séjour — assurez-vous que le document soit lisible et en cours de validité.',
              delay: 0.2
            }
          ],
          showChecklist: false
        };
      }
      if (diditStatus === 'loading') {
        return {
          title: 'Vérification en cours',
          messages: [
            {
              type: 'loading' as const,
              text: 'Vérification en cours via le protocole sécurisé Didit...',
              delay: 0
            },
            {
              type: 'security' as const,
              text: 'Vos données sont chiffrées de bout en bout. Aucun stockage tiers.',
              delay: 0.3
            }
          ],
          showChecklist: false
        };
      }
      // Didit vérifié
      return {
        title: 'Identité Validée',
        messages: [
          {
            type: 'success' as const,
            text: `Identité validée. Le bloc Identité est complet, nous pouvons maintenant analyser vos ressources.`,
            delay: 0
          }
        ],
        showChecklist: false
      };
    }

    // Chapitre II : Ressources
    if (currentStep === 2) {
      const messages: { type: 'info' | 'tip' | 'success' | 'loading' | 'security'; text: string; delay: number }[] = [];
      
      if (!detectedProfile) {
        messages.push({
          type: 'info',
          text: 'Déposez un premier document de revenu. L\'IA PatrimoTrust™ détectera automatiquement votre profil.',
          delay: 0
        });
        messages.push({
          type: 'tip',
          text: 'Bulletin de salaire, avis de bourse, attestation CAF... Glissez-déposez sans vous soucier du tri.',
          delay: 0.2
        });
      } else if (candidateStatus === 'Etudiant') {
        messages.push({
          type: 'success',
          text: `Profil Étudiant détecté. Voici les documents clés pour votre certification :`,
          delay: 0
        });
      } else if (candidateStatus === 'Salarie') {
        messages.push({
          type: 'success',
          text: `Profil Salarié détecté. Consolidez votre dossier avec les justificatifs suivants :`,
          delay: 0
        });
      } else {
        messages.push({
          type: 'success',
          text: `Profil Indépendant détecté. Démontrez la régularité de vos revenus :`,
          delay: 0
        });
      }

      return {
        title: 'Analyse des Ressources',
        messages,
        showChecklist: !!detectedProfile,
        checklist: getProfileChecklist(candidateStatus, certifiedItems)
      };
    }

    // Chapitre III : Garantie
    if (currentStep === 3) {
      return {
        title: 'Garantie & Sécurité',
        messages: [
          {
            type: 'info' as const,
            text: 'Le garant renforce considérablement votre dossier. Invitez-le à compléter son espace sécurisé.',
            delay: 0
          },
          {
            type: 'tip' as const,
            text: 'Un garant avec des revenus ≥ 3x le loyer vous propulse vers le score AAA.',
            delay: 0.2
          }
        ],
        showChecklist: true,
        checklist: [
          { id: 'garant_id', label: 'Identité du garant', done: certifiedItems.has('garant_id') },
          { id: 'garant_domicile', label: 'Justificatif de domicile', done: certifiedItems.has('garant_domicile') },
          { id: 'garant_salaires', label: '3 derniers bulletins', done: certifiedItems.has('garant_salaires') }
        ]
      };
    }

    // Chapitre IV : Certification finale
    return {
      title: 'Certification Finale',
      messages: [
        {
          type: 'success' as const,
          text: `${userName}, votre dossier PatrimoTrust™ est prêt. Score final : ${score} points.`,
          delay: 0
        },
        {
          type: 'tip' as const,
          text: 'Téléchargez votre Passeport Certifié et envoyez-le à n\'importe quel propriétaire.',
          delay: 0.2
        }
      ],
      showChecklist: false
    };
  };

  // Checklist selon le profil
  const getProfileChecklist = (profile: string, certified: Set<string>) => {
    const profileDocs = REQUIRED_DOCS_BY_PROFILE[profile as keyof typeof REQUIRED_DOCS_BY_PROFILE] || REQUIRED_DOCS_BY_PROFILE.Etudiant;
    return profileDocs.required.map((id) => {
      const item = ALL_CERTIFICATION_ITEMS.find(i => i.id === id);
      const hasUrssaf = certified.has('attestation_urssaf');
      const done = id === 'bilan_n1' || id === 'bilan_n2'
        ? (certified.has(id) || hasUrssaf)
        : id === 'attestation_urssaf'
        ? (hasUrssaf || (certified.has('bilan_n1') && certified.has('bilan_n2')))
        : certified.has(id);
      return {
        id,
        label: item?.label || id,
        done,
      };
    });
  };

  const content = getChapterContent();

  // Icône selon le type de message
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircleIcon className="w-4 h-4 text-emerald-500" />;
      case 'tip': return <LightbulbIcon className="w-4 h-4 text-amber-500" />;
      case 'loading': return <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />;
      case 'security': return <LockIcon className="w-4 h-4 text-navy" />;
      default: return <SparklesIcon className="w-4 h-4 text-blue-500" />;
    }
  };

  const getMessageBg = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 border-emerald-200';
      case 'tip': return 'bg-amber-50 border-amber-200';
      case 'loading': return 'bg-blue-50 border-blue-200';
      case 'security': return 'bg-slate-50 border-slate-200';
      default: return 'bg-white border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-navy to-slate-700 rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-white text-sm font-serif font-bold">EP</span>
        </div>
        <div>
          <h4 className="text-xs font-bold text-navy">{content.title}</h4>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">Expert PatrimoTrust™</p>
        </div>
      </div>

      {/* Messages en bulles de chat */}
      <div className="space-y-3">
        {content.messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: msg.delay, duration: 0.3 }}
            className={`relative rounded-2xl rounded-tl-sm border p-4 shadow-sm ${getMessageBg(msg.type)}`}
          >
            {/* Flèche de bulle */}
            <div className={`absolute -left-1 top-3 w-2 h-2 rotate-45 border-l border-b ${getMessageBg(msg.type)}`} />
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getMessageIcon(msg.type)}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{msg.text}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Checklist contextuelle */}
      {content.showChecklist && content.checklist && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4"
        >
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
            Documents recommandés
          </p>
          <div className="space-y-2">
            {content.checklist.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  item.done 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className={`flex-shrink-0 ${item.done ? 'text-emerald-500' : 'text-slate-300'}`}>
                  {item.done 
                    ? <CheckCircleIcon className="w-5 h-5" />
                    : <div className="w-5 h-5 rounded-full border-2 border-current" />
                  }
                </div>
                <span className={`text-sm ${item.done ? 'text-emerald-700 font-medium' : 'text-slate-600'}`}>
                  {item.label}
                </span>
                {item.done && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto"
                  >
                    <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Message de réassurance sécurité (toujours visible) */}
      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-slate-400">
          <LockIcon className="w-3 h-3" />
          <span className="text-[9px] uppercase tracking-widest">Données chiffrées & sécurisées</span>
        </div>
      </div>
    </div>
  );
}

// --- Consistency Guardian Modal Component ---
function ConsistencyGuardianModal({
  isOpen,
  onClose,
  inconsistency,
  onJustify,
  onReplace,
}: {
  isOpen: boolean;
  onClose: () => void;
  inconsistency: {
    documentId: string;
    documentName: string;
    detectedName: string;
    expectedName: string;
  } | null;
  onJustify: (justification: string) => void;
  onReplace: () => void;
}) {
  const [justificationText, setJustificationText] = useState('');
  const [showJustificationInput, setShowJustificationInput] = useState(false);
  
  if (!isOpen || !inconsistency) return null;
  
  const handleJustify = () => {
    if (justificationText.trim()) {
      onJustify(justificationText);
      setJustificationText('');
      setShowJustificationInput(false);
    }
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-amber-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header ambre */}
            <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 px-6 py-5 border-b border-amber-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Diagnostic de Cohérence</span>
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded-full">À RÉVISER</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Une petite ombre au tableau</h3>
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Corps */}
            <div className="p-6">
              {/* Avatar Expert */}
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                  <span className="text-white text-lg">🧐</span>
                </div>
                <div className="flex-1 bg-slate-50 rounded-2xl rounded-tl-none p-4">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Le nom sur votre <span className="font-semibold text-amber-700">{inconsistency.documentName}</span> (<span className="font-bold">{inconsistency.detectedName}</span>) ne correspond pas exactement à votre identité certifiée (<span className="font-bold">{inconsistency.expectedName}</span>).
                  </p>
                  <p className="text-sm text-slate-600 mt-2">
                    Un propriétaire y verra un risque de dossier non conforme. <span className="font-medium text-emerald-600">Corrigeons cela ensemble avant l'envoi.</span>
                  </p>
                </div>
              </div>
              
              {/* Comparaison visuelle */}
              <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Identité Certifiée</p>
                    <p className="font-bold text-slate-800 bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-3">
                      {inconsistency.expectedName}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Sur le document</p>
                    <p className="font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3">
                      {inconsistency.detectedName}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Zone de justification */}
              {showJustificationInput ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-5"
                >
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expliquez la différence (ex: nom d'épouse, nom d'usage...)
                  </label>
                  <textarea
                    value={justificationText}
                    onChange={(e) => setJustificationText(e.target.value)}
                    placeholder="Ex: Il s'agit de mon nom d'épouse. Mon nom de naissance est bien celui figurant sur ma pièce d'identité."
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleJustify}
                      disabled={!justificationText.trim()}
                      className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                    >
                      Valider ma justification
                    </button>
                    <button
                      onClick={() => setShowJustificationInput(false)}
                      className="px-4 py-2.5 bg-slate-100 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {/* Option A : Justifier */}
                  <button
                    onClick={() => setShowJustificationInput(true)}
                    className="w-full flex items-center gap-4 p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group"
                  >
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-800">Expliquer la différence</p>
                      <p className="text-xs text-slate-500">Mariage, nom d'usage, etc.</p>
                    </div>
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  
                  {/* Option B : Remplacer */}
                  <button
                    onClick={onReplace}
                    className="w-full flex items-center gap-4 p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-amber-300 hover:bg-amber-50/50 transition-all group"
                  >
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-800">Remplacer le document</p>
                      <p className="text-xs text-slate-500">Déposer un fichier correct</p>
                    </div>
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Message de réassurance */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 text-center italic">
                  💡 Je suis là pour que votre dossier soit irréprochable. Un petit ajustement et vous retrouvez votre Grade S.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Onboarding Modal Component ---
function OnboardingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isClosing, setIsClosing] = useState(false);
  
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 400);
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop avec effet blur intense */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/70"
            style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
            onClick={handleClose}
          />
          
          {/* Modal - Style Banque Privée */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={isClosing 
              ? { opacity: 0, y: 100, scale: 0.5 } 
              : { opacity: 1, y: 0, scale: 1 }
            }
            exit={{ opacity: 0, y: 100, scale: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Effet de brillance émeraude/or sur les bords */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none">
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-emerald-400/30 to-transparent rounded-tl-3xl" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-amber-400/30 to-transparent rounded-br-3xl" />
            </div>
            
            {/* Bouton fermer - discret */}
            <button
              onClick={handleClose}
              className="absolute top-5 right-5 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all shadow-sm border border-slate-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Header - Style Magistral */}
            <div className="relative px-8 pt-10 pb-6 text-center">
              {/* Icône avec glow émeraude */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="relative w-20 h-20 mx-auto mb-5"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-emerald-400/40 rounded-2xl blur-xl animate-pulse" />
                <div className="relative w-full h-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/40">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </motion.div>
              
              <p className="text-emerald-600 text-[10px] font-bold uppercase tracking-[0.4em] mb-3">PatrimoTrust™ • Certification 2026</p>
              
              {/* Titre Serif - Style Banque Privée */}
              <h2 className="text-2xl md:text-3xl text-slate-900 mb-3 leading-tight" style={{ fontFamily: 'Georgia, "Playfair Display", serif' }}>
                Votre Passeport pour ce logement<br />
                <span className="text-emerald-600">commence ici.</span>
              </h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                Ne déposez pas un dossier, <span className="font-semibold text-slate-700">obtenez une certification.</span>
              </p>
            </div>
            
            {/* Corps - Les 3 Étapes Premium */}
            <div className="px-8 pb-8">
              
              {/* Les 3 étapes avec cartes surélevées */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                
                {/* Étape 1 : Scellement d'Identité */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ y: -4, boxShadow: '0 12px 40px -10px rgba(16, 185, 129, 0.3)' }}
                  className="relative bg-white rounded-2xl p-5 border border-slate-100 shadow-sm cursor-default transition-all duration-300"
                >
                  {/* Badge numéro */}
                  <div className="absolute -top-2 -left-2 w-7 h-7 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-lg">
                    1
                  </div>
                  
                  {/* Icône verrou doré */}
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center border border-amber-300/50">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  
                  <h3 className="font-bold text-slate-800 text-sm mb-1 text-center">Scellement d'Identité</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed text-center mb-3">
                    Le socle de votre crédit. Prouvez votre authenticité sans stocker vos documents sensibles.
                  </p>
                  
                  {/* Badge temps */}
                  <div className="flex items-center justify-center gap-2 text-[10px]">
                    <span className="px-2 py-1 bg-slate-100 rounded-full text-slate-500 font-medium">⏱ 30 sec</span>
                    <span className="px-2 py-1 bg-emerald-50 rounded-full text-emerald-600 font-medium">Sécurité Militaire</span>
                  </div>
                </motion.div>
                
                {/* Étape 2 : Audit Intelligent */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ y: -4, boxShadow: '0 12px 40px -10px rgba(16, 185, 129, 0.3)' }}
                  className="relative bg-white rounded-2xl p-5 border border-slate-100 shadow-sm cursor-default transition-all duration-300"
                >
                  {/* Badge numéro */}
                  <div className="absolute -top-2 -left-2 w-7 h-7 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-lg">
                    2
                  </div>
                  
                  {/* Icône baguette magique / étincelles */}
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center border border-emerald-300/50">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  
                  <h3 className="font-bold text-slate-800 text-sm mb-1 text-center">Audit Intelligent</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed text-center mb-3">
                    L'IA travaille pour vous. Glissez vos justificatifs en vrac, nous faisons le reste.
                  </p>
                  
                  {/* Badge temps */}
                  <div className="flex items-center justify-center gap-2 text-[10px]">
                    <span className="px-2 py-1 bg-slate-100 rounded-full text-slate-500 font-medium">⏱ 5 min</span>
                    <span className="px-2 py-1 bg-blue-50 rounded-full text-blue-600 font-medium">Analyse instantanée</span>
                  </div>
                </motion.div>
                
                {/* Étape 3 : Grade Souverain */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ y: -4, boxShadow: '0 12px 40px -10px rgba(217, 119, 6, 0.3)' }}
                  className="relative bg-gradient-to-br from-amber-50/80 to-white rounded-2xl p-5 border border-amber-200/50 shadow-sm cursor-default transition-all duration-300"
                >
                  {/* Badge S doré */}
                  <div className="absolute -top-2 -left-2 w-7 h-7 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-lg">
                    S
                  </div>
                  
                  {/* Icône couronne / sceau */}
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-amber-200 to-amber-300 rounded-xl flex items-center justify-center border border-amber-400/50">
                    <svg className="w-6 h-6 text-amber-700" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                    </svg>
                  </div>
                  
                  <h3 className="font-bold text-slate-800 text-sm mb-1 text-center">Grade Souverain</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed text-center mb-3">
                    Le sésame des zones tendues. La garantie qui rassure 100% des propriétaires.
                  </p>
                  
                  {/* Badge objectif */}
                  <div className="flex items-center justify-center text-[10px]">
                    <span className="px-3 py-1 bg-gradient-to-r from-amber-100 to-amber-200 rounded-full text-amber-700 font-bold border border-amber-300/50">✨ Objectif : 100/100</span>
                  </div>
                </motion.div>
              </div>
              
              {/* Bloc de réassurance - Style officiel */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-slate-50/80 rounded-xl p-4 flex items-center gap-3 mb-4 border border-slate-100"
              >
                <div className="w-9 h-9 bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Vos données sont <span className="font-semibold">chiffrées de bout en bout</span> et protégées par le <span className="font-semibold">secret professionnel PatrimoTrust</span>. Conforme Loi Alur 2026.
                </p>
              </motion.div>
              
              {/* CTA Principal */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={handleClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 text-white font-bold text-sm uppercase tracking-[0.15em] rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all relative overflow-hidden group"
              >
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">Commencer ma certification</span>
              </motion.button>
              
              <p className="text-center text-[10px] text-slate-400 mt-3">
                Cela prend moins de 10 minutes
              </p>
              
              {/* Bandeau Expert IA */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-4 pt-4 border-t border-slate-100 text-center"
              >
                <p className="text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-5 h-5 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center text-[10px]">🤖</span>
                    <span>Besoin d'aide ? <span className="font-semibold text-emerald-600">Notre Expert IA</span> vous guide à chaque étape du dépôt.</span>
                  </span>
                </p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Tooltip "Pourquoi Didit ?" ---
function WhyDiditTooltip({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 5, scale: 0.98 }}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-96 z-50"
    >
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl">
        {/* Flèche */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45" />
        
        <div className="relative">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-xl">🏦</span>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-800 text-sm mb-1">
                La norme de sécurité bancaire, appliquée à votre logement.
              </h4>
              <button
                onClick={onClose}
                className="absolute top-0 right-0 text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Corps */}
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              En 2026, une simple photo de votre pièce d'identité ne suffit plus à protéger contre les <span className="font-semibold">usurpations sophistiquées (Deepfakes)</span>.
            </p>
            
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="font-semibold text-blue-800 mb-1">Pourquoi cette étape ?</p>
              <p className="text-blue-700">
                Didit effectue une comparaison biométrique éphémère entre votre visage et la puce sécurisée de votre document. Cela génère une <span className="font-semibold">preuve d'identité infalsifiable</span> qui rassure instantanément 100% des propriétaires.
              </p>
            </div>
            
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <p className="font-semibold text-emerald-800 mb-1">🔒 Notre garantie Souveraine</p>
              <p className="text-emerald-700">
                PatrimoTrust ne stocke <span className="font-semibold">jamais</span> l'image brute de votre pièce d'identité ni vos données biométriques. Nous ne conservons que le <span className="font-semibold">certificat de validation chiffré</span>.
              </p>
            </div>
          </div>
          
          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Technologie certifiée RGPD</span>
            <button
              onClick={onClose}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              Compris →
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Main Component ---
export default function ApplyClient({ token }: { token: string }) {
  const notify = useNotification();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  // Form Data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    email: '',
    phone: '',
    guarantorName: '',
    status: 'Etudiant' as CandidateStatus,
  });

  // Candidate Status
  const [candidateStatus, setCandidateStatus] = useState<CandidateStatus>('Etudiant');
  const [guaranteeMode, setGuaranteeMode] = useState<GuaranteeMode>('NONE');
  const [guarantorSlotsCount, setGuarantorSlotsCount] = useState<1 | 2>(1);
  const [diditStatus, setDiditStatus] = useState<'idle' | 'loading' | 'verified'>('idle');
  const [diditIdentity, setDiditIdentity] = useState<{
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    humanVerified?: boolean;
  } | null>(null);
  const [diditSessionId, setDiditSessionId] = useState<string | null>(null);
  const [diditClientId, setDiditClientId] = useState<string | null>(null);
  
  // Garant Physique Souverain
  const [guarantorCertified, setGuarantorCertified] = useState(false);
  const [guarantorCertificationMethod, setGuarantorCertificationMethod] = useState<'DIDIT' | 'AUDIT' | null>(null);
  const [guarantorProfile, setGuarantorProfile] = useState<CandidateStatus>('Salarie');
  const [guarantorEmail, setGuarantorEmail] = useState('');
  const [guarantorFirstName, setGuarantorFirstName] = useState('');
  const [guarantorLastName, setGuarantorLastName] = useState('');
  const [guarantorInvitationSent, setGuarantorInvitationSent] = useState(false);
  const [guarantorDirectCertification, setGuarantorDirectCertification] = useState(false);
  const [guarantorDiditSessionId, setGuarantorDiditSessionId] = useState<string | null>(null);
  const [guarantorDiditVerificationUrl, setGuarantorDiditVerificationUrl] = useState<string | null>(null);
  const [secondGuarantor, setSecondGuarantor] = useState<GuarantorSlotState>({
    slot: 2,
    profile: 'Salarie',
    firstName: '',
    lastName: '',
    email: '',
    status: 'NONE',
    certificationMethod: null,
    invitationSent: false,
  });
  const [diditVerificationUrl, setDiditVerificationUrl] = useState<string | null>(null);
  const [diditQrCode, setDiditQrCode] = useState<string | null>(null);
  // diditScriptReady supprimé - SDK Didit (cdn.didit.me) n'est plus disponible
  const [detectedProfile, setDetectedProfile] = useState<string | null>(null);
  const [detectedIncome, setDetectedIncome] = useState<number | null>(null);
  const [guarantorIncome, setGuarantorIncome] = useState<number | null>(null);
  const [aplAmount, setAplAmount] = useState<number | null>(null);
  const [bourseAmount, setBourseAmount] = useState<number | null>(null);
  const [salaryNetSamples, setSalaryNetSamples] = useState<number[]>([]);
  const [rfrAmount, setRfrAmount] = useState<number | null>(null);
  const [incomeCrossCheck, setIncomeCrossCheck] = useState<{ status: 'ok' | 'warning'; message: string } | null>(null);
  const incomeCrossCheckRef = useRef<string | null>(null);
  const [guarantorHint, setGuarantorHint] = useState<string | null>(null);

  // Documents
  const [certifiedItems, setCertifiedItems] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<{identity: DocumentFile[], resources: DocumentFile[], guarantor: DocumentFile[]}>({
    identity: [],
    resources: [],
    guarantor: []
  });

  // UI States
  const [showGoldenSeal, setShowGoldenSeal] = useState<{show: boolean, label: string}>({show: false, label: ''});
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
  const [aiAlertMessage, setAiAlertMessage] = useState<string | null>(null);
  
  // Onboarding Modal - affichée une seule fois
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDiditTooltip, setShowDiditTooltip] = useState(false);
  const [showPostOnboardingNudge, setShowPostOnboardingNudge] = useState(false);
  const [diditButtonPulse, setDiditButtonPulse] = useState(false);
  
  // Vérifier si c'est la première visite
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('patrimo_onboarding_seen');
    if (!hasSeenOnboarding) {
      // Délai court pour laisser la page se charger
      const timer = setTimeout(() => setShowOnboarding(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('patrimo_onboarding_seen', 'true');
    
    // Afficher le nudge post-onboarding après un court délai
    setTimeout(() => {
      setShowPostOnboardingNudge(true);
      setDiditButtonPulse(true);
      
      // Masquer le nudge après 10 secondes
      setTimeout(() => {
        setShowPostOnboardingNudge(false);
      }, 10000);
      
      // Arrêter la pulsation après 5 secondes
      setTimeout(() => {
        setDiditButtonPulse(false);
      }, 5000);
    }, 300);
  };
  
  // Handlers pour la résolution d'incohérences documentaires
  const handleJustifyInconsistency = (justification: string) => {
    if (!activeInconsistency) return;
    
    // Mettre à jour l'incohérence avec la justification
    setDocumentInconsistencies(prev => 
      prev.map(inc => 
        inc.documentId === activeInconsistency.documentId
          ? { ...inc, status: 'justified' as const, justification }
          : inc
      )
    );
    
    // Mettre à jour le fichier
    setUploadedFiles(prev => {
      const newFiles = { ...prev };
      for (const category of ['identity', 'resources', 'guarantor'] as const) {
        newFiles[category] = prev[category].map(f => 
          f.id === activeInconsistency.documentId
            ? { ...f, flagged: false, inconsistencyResolved: true, inconsistencyJustification: justification }
            : f
        );
      }
      return newFiles;
    });
    
    // Fermer la modale et afficher un message de succès
    setShowConsistencyModal(false);
    setActiveInconsistency(null);
    
    setAiFeedback({
      visible: true,
      message: `Parfait ! Votre justification a été enregistrée. Le propriétaire verra que c'est un ${justification.toLowerCase().includes('mariage') || justification.toLowerCase().includes('épouse') || justification.toLowerCase().includes('époux') ? 'nom d\'époux/se' : 'nom d\'usage'}.`,
      type: 'success',
      scoreIncrease: 15,
    });
    setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
  };
  
  const handleReplaceInconsistentDocument = () => {
    if (!activeInconsistency) return;
    
    // Supprimer le document incohérent
    setUploadedFiles(prev => {
      const newFiles = { ...prev };
      for (const category of ['identity', 'resources', 'guarantor'] as const) {
        newFiles[category] = prev[category].filter(f => f.id !== activeInconsistency.documentId);
      }
      return newFiles;
    });
    
    // Retirer l'incohérence de la liste
    setDocumentInconsistencies(prev => 
      prev.filter(inc => inc.documentId !== activeInconsistency.documentId)
    );
    
    // Fermer la modale
    setShowConsistencyModal(false);
    setActiveInconsistency(null);
    
    // Message d'encouragement
    setAiFeedback({
      visible: true,
      message: 'Document supprimé. Déposez le fichier correct pour retrouver vos points.',
      type: 'info',
    });
    setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 4000);
  };
  
  const [expertBubbleMessage, setExpertBubbleMessage] = useState<string>('Expert PatrimoTrust™ à votre service.');
  // cockpitOpen supprimé — le cockpit est masqué sur mobile, toujours visible sur desktop
  
  // AI Feedback States
  const [aiFeedback, setAiFeedback] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'warning' | 'info' | 'error';
    scoreIncrease?: number;
  }>({
    visible: false,
    message: '',
    type: 'info',
  });

  // Name verification state
  const [nameVerification, setNameVerification] = useState<{
    verified: boolean;
    message: string;
  } | null>(null);
  
  // État pour les incohérences documentaires détaillées
  const [documentInconsistencies, setDocumentInconsistencies] = useState<{
    documentId: string;
    documentName: string;
    documentType: string;
    detectedName: string;
    expectedName: string;
    status: 'detected' | 'justified' | 'replaced';
    justification?: string;
  }[]>([]);
  
  // État pour afficher la modale de résolution d'incohérence
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);
  const [activeInconsistency, setActiveInconsistency] = useState<{
    documentId: string;
    documentName: string;
    detectedName: string;
    expectedName: string;
  } | null>(null);

  // Étape coordonnées de contact (après Didit)
  const [contactStep, setContactStep] = useState<'pending' | 'active' | 'completed'>('pending');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [passportStudioState, setPassportStudioState] = useState<{
    state: 'draft' | 'review' | 'ready' | 'sealed';
    readinessReasons: string[];
    summary: string;
  } | null>(null);
  const [submittingPassport, setSubmittingPassport] = useState(false);

  // --- État pour le score précédent (pour l'animation) ---
  const [previousScore, setPreviousScore] = useState(0);
  const [scoreDelta, setScoreDelta] = useState<number | null>(null);
  const [hasInconsistency, setHasInconsistency] = useState(false);
  const [hasExpirationMalus, setHasExpirationMalus] = useState(false);

  // --- Helpers pour la péremption (doivent être déclarés avant useMemo) ---
  const normalizeValue = (value: string) =>
    value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const getPersistedDocumentCategory = (
    file: DocumentFile,
    bucket: 'identity' | 'resources' | 'guarantor'
  ): 'identity' | 'income' | 'address' | 'guarantor' => {
    if (bucket === 'identity') return 'identity';
    if (bucket === 'guarantor') return 'guarantor';

    const normalizedType = normalizeAnalysisDocumentType(
      file.aiAnalysis?.documentType || file.type || file.name
    );

    return normalizedType === 'JUSTIFICATIF_DOMICILE' ? 'address' : 'income';
  };

  const buildGuarantorSlot = useCallback((
    slot: 1 | 2,
    overrides: Partial<GuarantorSlotState> = {}
  ): GuarantorSlotState => ({
    slot,
    profile: 'Salarie',
    firstName: '',
    lastName: '',
    email: '',
    status: 'NONE',
    certificationMethod: null,
    invitationSent: false,
    ...overrides,
  }), []);

  const getGuarantorFilesForSlot = useCallback((slot: 1 | 2) => (
    uploadedFiles.guarantor.filter(file => (file.subjectSlot || 1) === slot)
  ), [uploadedFiles.guarantor]);

  const buildPortalDocuments = useCallback(() => ([
    ...uploadedFiles.identity.map(file => ({
      ...file,
      fileName: file.name,
      subjectType: 'tenant' as const,
    })),
    ...uploadedFiles.resources.map(file => ({
      ...file,
      fileName: file.name,
      subjectType: file.subjectType || (normalizeAnalysisDocumentType(file.aiAnalysis?.documentType || file.type || file.name) === 'CERTIFICAT_VISALE' ? 'visale' : 'tenant'),
    })),
    ...uploadedFiles.guarantor.map(file => ({
      ...file,
      fileName: file.name,
      subjectType: 'guarantor' as const,
      subjectSlot: file.subjectSlot || 1,
    })),
  ]), [uploadedFiles]);

  const getExpectedIdentityForSubject = useCallback((
    subjectType: 'tenant' | 'guarantor' | 'visale',
    subjectSlot?: 1 | 2
  ) => buildExpectedIdentityTarget({
    subjectType,
    subjectSlot,
    tenant: {
      firstName: formData.firstName || diditIdentity?.firstName || '',
      lastName: formData.lastName || diditIdentity?.lastName || '',
    },
    guarantorOne: {
      firstName: guarantorFirstName,
      lastName: guarantorLastName,
    },
    guarantorTwo: {
      firstName: secondGuarantor.firstName,
      lastName: secondGuarantor.lastName,
    },
  }), [
    formData.firstName,
    formData.lastName,
    diditIdentity?.firstName,
    diditIdentity?.lastName,
    guarantorFirstName,
    guarantorLastName,
    secondGuarantor.firstName,
    secondGuarantor.lastName,
  ]);

  const parseIsoDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const diffInMonths = (from: Date, to: Date): number => {
    const years = to.getFullYear() - from.getFullYear();
    const months = to.getMonth() - from.getMonth();
    const total = years * 12 + months;
    return total < 0 ? 0 : total;
  };

  const isIdentityDoc = (file: DocumentFile) => {
    const haystack = normalizeValue(`${file.aiAnalysis?.documentType || ''} ${file.type || ''} ${file.name || ''}`);
    return haystack.includes('cni') || haystack.includes('passeport') || haystack.includes('carte identite');
  };

  const isBulletinSalaire = (file: DocumentFile) => {
    const haystack = normalizeValue(`${file.aiAnalysis?.documentType || ''} ${file.type || ''} ${file.name || ''}`);
    return haystack.includes('bulletin') || haystack.includes('salaire') || haystack.includes('fiche de paie');
  };

  const isAttestationEmployeur = (file: DocumentFile) => {
    const haystack = normalizeValue(`${file.aiAnalysis?.documentType || ''} ${file.type || ''} ${file.name || ''}`);
    return haystack.includes('attestation employeur') || haystack.includes('employeur');
  };

  const isQuittanceLoyer = (file: DocumentFile) => {
    const haystack = normalizeValue(`${file.aiAnalysis?.documentType || ''} ${file.type || ''} ${file.name || ''}`);
    return haystack.includes('quittance') && haystack.includes('loyer');
  };

  const getGuarantorUploadInputId = useCallback((slot: 1 | 2) => (
    slot === 2 ? 'guarantor-slot-2-file-input' : 'guarantor-file-input'
  ), []);

  const getGuarantorBlockStatusLabel = useCallback((status: GuarantorBlockStatus) => {
    if (status === 'complete') return 'Complet';
    if (status === 'partial') return 'À consolider';
    return 'Manquant';
  }, []);

  const getGuarantorBlockStatusClasses = useCallback((status: GuarantorBlockStatus) => {
    if (status === 'complete') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }
    if (status === 'partial') {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }
    return 'border-slate-200 bg-white text-slate-500';
  }, []);

  interface ExpirationFlags {
    identityBlock: number;
    revenusBlock: number;
    activiteBlock: number;
    revenusMalus: number;
    quittanceMalus: number;
    guarantorRevenusBlock: number; // 10 si 3 bulletins garant, sinon 0
    guarantorRevenusMalus: number; // 10 si bulletin garant le plus récent > 2 mois
    hasExpirationMalus: boolean;
    expertMessages: string[];
  }

  const computeExpirationFlags = (): ExpirationFlags => {
    const allFiles = [...uploadedFiles.identity, ...uploadedFiles.resources, ...uploadedFiles.guarantor].filter(f => f.status === 'CERTIFIED' && !f.flagged);
    const now = new Date();

    let identityBlock = 0;
    let revenusBlock = 0;
    let activiteBlock = 0;
    let revenusMalus = 0;
    let quittanceMalus = 0;
    let guarantorRevenusBlock = 0;
    let guarantorRevenusMalus = 0;
    let hasExpirationMalus = false;
    const expertMessages: string[] = [];

    // Bloc Identité (40 pts) - Didit ou CNI/Passeport valide
    const identityDocs = allFiles.filter(isIdentityDoc);
    let identityExpired = false;

    if (diditStatus === 'verified') {
      identityBlock = 40;
    } else if (identityDocs.length > 0) {
      identityBlock = 40;
      for (const doc of identityDocs) {
        const exp = parseIsoDate(doc.dateExpiration || doc.extractedData?.dates?.[1] || doc.extractedData?.dates?.[0]);
        if (exp && exp.getTime() < now.getTime()) {
          identityExpired = true;
          break;
        }
      }
    }

    if (identityExpired) {
      identityBlock = 0;
      hasExpirationMalus = true;
      expertMessages.push(`Attention ${formData.firstName || diditIdentity?.firstName || 'Locataire'}, votre pièce d'identité semble expirée. Mettez à jour votre CNI ou passeport pour débloquer le bloc Identité (40 pts).`);
    }

    // Bloc Revenus (20 pts) - 3 bulletins + fraîcheur
    const bulletins = allFiles.filter(f => isBulletinSalaire(f) && f.category !== 'guarantor');
    if (bulletins.length >= 3) {
      revenusBlock = 20;
      const dates = bulletins
        .map(f => parseIsoDate(f.dateEmission || f.extractedData?.dates?.[0]))
        .filter((d): d is Date => !!d);
      if (dates.length > 0) {
        const latest = dates.reduce((max, d) => (d > max ? d : max), dates[0]);
        const months = diffInMonths(latest, now);
        if (months > 2) {
          revenusMalus = 10;
          hasExpirationMalus = true;
          expertMessages.push(`${formData.firstName || diditIdentity?.firstName || 'Vous'}, vous y êtes presque ! Votre dernier bulletin de salaire commence à dater. Ajoutez un bulletin récent pour récupérer 10 points sur le bloc Revenus.`);
        }
      }
    }

    // Bloc Activité (10 pts) - Attestation Employeur fraîche
    const attestations = allFiles.filter(isAttestationEmployeur);
    if (attestations.length > 0) {
      activiteBlock = 10;
      const att = attestations[0];
      const attDate = parseIsoDate(att.dateEmission || att.extractedData?.dates?.[0]);
      if (attDate) {
        const months = diffInMonths(attDate, now);
        if (months > 3) {
          activiteBlock = 0;
          hasExpirationMalus = true;
          expertMessages.push(`Attention ${formData.firstName || diditIdentity?.firstName || 'Locataire'}, votre attestation employeur a plus de 3 mois. Elle n'est plus considérée comme une preuve de stabilité. Renouvelez-la pour récupérer vos 10 points sur le bloc Activité.`);
        } else if (months > 1) {
          expertMessages.push("Votre attestation employeur a plus d'un mois. Pensez à la renouveler prochainement pour garder un dossier à jour.");
        }
      }
    }

    // Quittances de loyer - malus -5 si dernière > 2 mois
    const quittances = allFiles.filter(isQuittanceLoyer);
    if (quittances.length > 0) {
      const dates = quittances
        .map(f => parseIsoDate(f.dateEmission || f.extractedData?.dates?.[0]))
        .filter((d): d is Date => !!d);
      if (dates.length > 0) {
        const latest = dates.reduce((max, d) => (d > max ? d : max), dates[0]);
        const months = diffInMonths(latest, now);
        if (months > 2) {
          quittanceMalus = 5;
          hasExpirationMalus = true;
          expertMessages.push("Votre dernière quittance de loyer a plus de 2 mois. Ajoutez une quittance récente pour récupérer 5 points et démontrer votre régularité de paiement.");
        }
      }
    }

    // Garant : règle des 3 bulletins + fraîcheur (même logique que locataire)
    const guarantorFiles = (uploadedFiles.guarantor || []).filter(f => f.status === 'CERTIFIED' && !f.flagged);
    const guarantorBulletins = guarantorFiles.filter(f => isBulletinSalaire(f));
    if (guarantorBulletins.length >= 3) {
      guarantorRevenusBlock = 10;
      const gDates = guarantorBulletins
        .map(f => parseIsoDate(f.dateEmission || f.extractedData?.dates?.[0]))
        .filter((d): d is Date => !!d);
      if (gDates.length > 0) {
        const gLatest = gDates.reduce((max, d) => (d > max ? d : max), gDates[0]);
        const gMonths = diffInMonths(gLatest, now);
        if (gMonths > 2) {
          guarantorRevenusMalus = 10;
          hasExpirationMalus = true;
          expertMessages.push("Le bulletin de salaire le plus récent de votre garant a plus de 2 mois. Demandez-lui d'ajouter un bulletin récent pour récupérer 10 points sur le bloc Garant.");
        }
      }
    }

    return {
      identityBlock,
      revenusBlock,
      activiteBlock,
      revenusMalus,
      quittanceMalus,
      guarantorRevenusBlock,
      guarantorRevenusMalus,
      hasExpirationMalus,
      expertMessages,
    };
  };

  const expirationFlags = useMemo(() => computeExpirationFlags(), [uploadedFiles, diditStatus, candidateStatus]);

  // Cross-check identité garant : CNI vs avis d'imposition (bloc score si incohérent)
  const guarantorIdentityMismatch = useMemo(() => {
    return ([1, 2] as const).some(slot => {
      const guarantorDocs = getGuarantorFilesForSlot(slot).filter(f => f.status === 'CERTIFIED' && !f.flagged);
      const idDoc = guarantorDocs.find(f => isIdentityDoc(f));
      const avisDoc = guarantorDocs.find(f => {
        const haystack = normalizeValue(`${f.aiAnalysis?.documentType || ''} ${f.type || ''} ${f.name || ''}`);
        return haystack.includes('avis') && haystack.includes('imposition');
      });
      const nameFromId = (idDoc?.aiAnalysis?.document_metadata?.owner_name || idDoc?.aiAnalysis?.ownerName || '').trim();
      const nameFromAvis = (avisDoc?.aiAnalysis?.document_metadata?.owner_name || avisDoc?.aiAnalysis?.ownerName || '').trim();
      if (!nameFromId || !nameFromAvis) return false;
      const n1 = normalizeValue(nameFromId).replace(/\s/g, '');
      const n2 = normalizeValue(nameFromAvis).replace(/\s/g, '');
      return n1 !== n2;
    });
  }, [getGuarantorFilesForSlot]);

  const visaleFiles = useMemo(
    () =>
      uploadedFiles.resources.filter(
        file =>
          file.subjectType === 'visale' ||
          normalizeAnalysisDocumentType(file.aiAnalysis?.documentType || file.type || file.name) === 'CERTIFICAT_VISALE'
      ),
    [uploadedFiles.resources]
  );

  const guaranteeState = useMemo(() => {
    const slotOneStatus: GuarantorSlotState['status'] = guarantorCertified
      ? (guarantorCertificationMethod === 'AUDIT' ? 'AUDITED' : 'CERTIFIED')
      : guarantorInvitationSent
        ? 'PENDING'
        : getGuarantorFilesForSlot(1).some(file => file.status === 'CERTIFIED')
          ? 'AUDITED'
          : 'NONE';

    const slotTwoStatus: GuarantorSlotState['status'] =
      getGuarantorFilesForSlot(2).some(file => file.status === 'CERTIFIED')
        ? 'AUDITED'
        : secondGuarantor.status;

    const certifiedVisale = visaleFiles.some(file => file.status === 'CERTIFIED' && !file.flagged);
    const visaleFile = visaleFiles.find(file => file.status === 'CERTIFIED' && !file.flagged) || visaleFiles[0];
    const visaleMaxRent =
      Number(
        visaleFile?.aiAnalysis?.financial_data?.extra_details?.visale?.loyer_maximum_garanti ||
        0
      ) || null;
    const visaleCompatible = property?.rentAmount && visaleMaxRent
      ? visaleMaxRent >= property.rentAmount
      : certifiedVisale;

    return {
      mode: guaranteeMode,
      visale: {
        status: certifiedVisale ? 'CERTIFIED' : visaleFiles.length > 0 ? 'PENDING' : 'NONE',
        certified: certifiedVisale,
        maxRent: visaleMaxRent,
        compatibleWithRent: visaleCompatible,
        digitalSeal:
          visaleFile?.aiAnalysis?.trust_and_security?.digital_seal_authenticated === true ||
          visaleFile?.aiAnalysis?.trust_and_security?.digital_seal_status === 'AUTHENTIFIÉ_PAR_SCELLEMENT_NUMÉRIQUE',
      },
      guarantors: [
        buildGuarantorSlot(1, {
          profile: guarantorProfile,
          firstName: guarantorFirstName,
          lastName: guarantorLastName,
          email: guarantorEmail,
          status: slotOneStatus,
          certificationMethod: guarantorCertificationMethod,
          invitationSent: guarantorInvitationSent,
        }),
        ...(guarantorSlotsCount === 2 ? [buildGuarantorSlot(2, {
          ...secondGuarantor,
          status: slotTwoStatus,
        })] : []),
      ],
    };
  }, [
    guaranteeMode,
    guarantorCertified,
    guarantorCertificationMethod,
    guarantorInvitationSent,
    guarantorProfile,
    guarantorFirstName,
    guarantorLastName,
    guarantorEmail,
    guarantorSlotsCount,
    secondGuarantor,
    getGuarantorFilesForSlot,
    visaleFiles,
    property?.rentAmount,
    buildGuarantorSlot,
  ]);

  const scoringSnapshot = useMemo(
    () =>
      computeApplicationPatrimometer({
        candidateStatus,
        diditStatus,
        propertyRentAmount: property?.rentAmount,
        detectedIncome,
        documents: buildPortalDocuments(),
        guarantee: guaranteeState,
        legacyGuarantor: {
          hasGuarantor: guarantorCertified || uploadedFiles.guarantor.some(file => file.status === 'CERTIFIED'),
          status: guarantorCertified ? 'CERTIFIED' : guarantorInvitationSent ? 'PENDING' : 'NONE',
          certificationMethod: guarantorCertificationMethod || undefined,
        },
      }),
    [
      candidateStatus,
      diditStatus,
      property?.rentAmount,
      detectedIncome,
      buildPortalDocuments,
      guaranteeState,
      guarantorCertified,
      guarantorInvitationSent,
      guarantorCertificationMethod,
      uploadedFiles.guarantor,
    ]
  );

  const buildGuarantorChapterBlocks = useCallback((slot: 1 | 2, profile: CandidateStatus): GuarantorChapterBlock[] => {
    const slotFiles = getGuarantorFilesForSlot(slot);
    const certifiedFiles = slotFiles.filter(file => file.status === 'CERTIFIED' && !file.flagged);
    const uploadedFilesForSlot = slotFiles.filter(file => file.status !== 'ANALYZING');
    const countKinds = (files: DocumentFile[]) => files.reduce<Record<string, number>>((acc, file) => {
      const kind = inferEvidenceKind({
        ...file,
        fileName: file.name,
      });
      acc[kind] = (acc[kind] || 0) + 1;
      return acc;
    }, {});

    const certifiedKinds = countKinds(certifiedFiles);
    const uploadedKinds = countKinds(uploadedFilesForSlot);
    const slotScore = scoringSnapshot.guarantee?.guarantors?.find((entry: { slot: number }) => entry.slot === slot);
    const slotVerified = ['CERTIFIED', 'AUDITED'].includes(String(slotScore?.status || '').toUpperCase());

    const makeStatus = (complete: boolean, partial: boolean): GuarantorBlockStatus => (
      complete ? 'complete' : partial ? 'partial' : 'missing'
    );

    const salaryUploaded = (uploadedKinds.salary || 0) >= 1;
    const salaryComplete = (certifiedKinds.salary || 0) >= 3;
    const taxUploaded = (uploadedKinds.tax || 0) > 0;
    const taxComplete = (certifiedKinds.tax || 0) > 0;
    const domicileUploaded = (uploadedKinds.domicile || 0) > 0 || (uploadedKinds.rent_receipt || 0) > 0;
    const domicileComplete = (certifiedKinds.domicile || 0) > 0 || (certifiedKinds.rent_receipt || 0) > 0;
    const activityUploaded =
      (uploadedKinds.employment_certificate || 0) > 0 ||
      (uploadedKinds.employment_contract || 0) > 0 ||
      (uploadedKinds.scolarite || 0) > 0 ||
      (uploadedKinds.urssaf || 0) > 0 ||
      (uploadedKinds.kbis || 0) > 0 ||
      (uploadedKinds.bilan || 0) > 0 ||
      (uploadedKinds.retirement || 0) > 0 ||
      (uploadedKinds.pension || 0) > 0;
    const activityComplete =
      (certifiedKinds.employment_certificate || 0) > 0 ||
      (certifiedKinds.employment_contract || 0) > 0 ||
      (certifiedKinds.scolarite || 0) > 0 ||
      (certifiedKinds.urssaf || 0) > 0 ||
      (certifiedKinds.kbis || 0) > 0 ||
      (certifiedKinds.bilan || 0) >= 2 ||
      (certifiedKinds.retirement || 0) > 0 ||
      (certifiedKinds.pension || 0) > 0;

    let incomeStatus: GuarantorBlockStatus = 'missing';
    let activityStatus: GuarantorBlockStatus = 'missing';
    let incomeDescription = 'Revenus du garant';
    let activityDescription = 'Activité ou stabilité';

    if (profile === 'Etudiant') {
      const incomePiecesUploaded =
        (uploadedKinds.student_aid || 0) +
        (uploadedKinds.housing_aid || 0) +
        (uploadedKinds.salary || 0) +
        (uploadedKinds.pension || 0) +
        (uploadedKinds.tax || 0);
      const incomePiecesCertified =
        (certifiedKinds.student_aid || 0) +
        (certifiedKinds.housing_aid || 0) +
        (certifiedKinds.salary || 0) +
        (certifiedKinds.pension || 0) +
        (certifiedKinds.tax || 0);

      incomeStatus = makeStatus(incomePiecesCertified >= 2, incomePiecesUploaded >= 1);
      activityStatus = makeStatus((certifiedKinds.scolarite || 0) > 0, (uploadedKinds.scolarite || 0) > 0);
      incomeDescription = 'Bourse, aides, salaires ou fiscalité étudiante';
      activityDescription = 'Certificat de scolarité ou inscription';
    } else if (profile === 'Salarie') {
      const hasActivityUploaded = (uploadedKinds.employment_certificate || 0) > 0 || (uploadedKinds.employment_contract || 0) > 0;
      const hasActivityCertified = (certifiedKinds.employment_certificate || 0) > 0 || (certifiedKinds.employment_contract || 0) > 0;

      incomeStatus = makeStatus(salaryComplete && taxComplete, salaryUploaded || taxUploaded);
      activityStatus = makeStatus(hasActivityCertified, hasActivityUploaded);
      incomeDescription = '3 bulletins + avis d’imposition';
      activityDescription = 'Attestation employeur ou contrat récent';
    } else if (profile === 'Independant') {
      const bilanUploaded = (uploadedKinds.bilan || 0) > 0;
      const bilanCertified = (certifiedKinds.bilan || 0) > 0;
      const incomeComplete = taxComplete && ((certifiedKinds.urssaf || 0) > 0 || (certifiedKinds.bilan || 0) >= 2);
      const incomePartial = taxUploaded || (uploadedKinds.urssaf || 0) > 0 || bilanUploaded || (uploadedKinds.kbis || 0) > 0;
      const activityCompleteForProfile = (certifiedKinds.urssaf || 0) > 0 || (certifiedKinds.bilan || 0) >= 2;
      const activityPartialForProfile = (uploadedKinds.urssaf || 0) > 0 || bilanUploaded || (uploadedKinds.kbis || 0) > 0;

      incomeStatus = makeStatus(incomeComplete, incomePartial);
      activityStatus = makeStatus(activityCompleteForProfile, activityPartialForProfile);
      incomeDescription = 'Avis d’imposition + URSSAF ou bilans';
      activityDescription = 'URSSAF, KBIS et bilans d’activité';
    } else {
      const retirementUploaded = (uploadedKinds.retirement || 0) + (uploadedKinds.pension || 0);
      const retirementCertified = (certifiedKinds.retirement || 0) + (certifiedKinds.pension || 0);

      incomeStatus = makeStatus(retirementCertified > 0 && taxComplete, retirementUploaded > 0 || taxUploaded);
      activityStatus = makeStatus(retirementCertified > 0, retirementUploaded > 0);
      incomeDescription = 'Pension/retraite + avis d’imposition';
      activityDescription = 'Justificatif de pension ou de retraite';
    }

    return [
      {
        id: 'identity',
        label: 'Identité',
        description: slotVerified ? 'Identité déjà certifiée pour ce garant' : 'CNI ou passeport en cours de validité',
        status: makeStatus(slotVerified || (certifiedKinds.identity || 0) > 0, (uploadedKinds.identity || 0) > 0),
      },
      {
        id: 'income',
        label: 'Revenus',
        description: incomeDescription,
        status: incomeStatus,
      },
      {
        id: 'activity',
        label: 'Activité / Stabilité',
        description: activityDescription,
        status: activityStatus,
      },
      {
        id: 'domicile',
        label: 'Domicile / Administratif',
        description: 'Justificatif de domicile récent',
        status: makeStatus(domicileComplete, domicileUploaded),
      },
    ];
  }, [getGuarantorFilesForSlot, scoringSnapshot.guarantee?.guarantors]);

  const slotOneGuarantorBlocks = useMemo(
    () => buildGuarantorChapterBlocks(1, guarantorProfile),
    [buildGuarantorChapterBlocks, guarantorProfile]
  );

  const slotTwoGuarantorBlocks = useMemo(
    () => buildGuarantorChapterBlocks(2, secondGuarantor.profile),
    [buildGuarantorChapterBlocks, secondGuarantor.profile]
  );

  const passportBlockerMessage = useMemo(() => {
    if (passportStudioState?.state === 'sealed') {
      return 'Votre passeport est scellé et synchronisé sur toutes les surfaces.';
    }
    if (passportStudioState?.state === 'ready') {
      return 'Votre passeport peut être généré et partagé.';
    }
    if (passportStudioState?.readinessReasons?.length) {
      return passportStudioState.readinessReasons[0];
    }
    if (scoringSnapshot.chapterStates.passport.ready) {
      return 'Votre passeport peut être généré.';
    }
    if (scoringSnapshot.chapterStates.guarantee.requirement === 'required' && !scoringSnapshot.chapterStates.guarantee.satisfied) {
      return scoringSnapshot.nextAction?.action || 'Ajoutez une garantie valide pour finaliser votre passeport.';
    }
    return scoringSnapshot.nextAction?.action || scoringSnapshot.warnings[0] || "Complétez d'abord l'identité et les pièces requises pour générer le passeport.";
  }, [
    scoringSnapshot.chapterStates.passport.ready,
    scoringSnapshot.chapterStates.guarantee.requirement,
    scoringSnapshot.chapterStates.guarantee.satisfied,
    scoringSnapshot.nextAction,
    scoringSnapshot.warnings,
    passportStudioState,
  ]);

  const score = scoringSnapshot.score;
  
  // Session NextAuth pour l'auto-save
  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  
  // Mettre à jour previousScore quand le score change
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPreviousScore(score);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [score]);

  useEffect(() => {
    if (score > previousScore) {
      const delta = score - previousScore;
      setScoreDelta(delta);
      const timeout = setTimeout(() => setScoreDelta(null), 2000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [score, previousScore]);

  useEffect(() => {
    if (!scoreDelta || scoreDelta <= 0) return;
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.12);
      oscillator.onended = () => ctx.close();
    } catch {
      // ignore audio errors (autoplay restrictions)
    }
  }, [scoreDelta]);

  // Mettre à jour l'état de malus de péremption et le message Expert
  useEffect(() => {
    const hasFlaggedDocuments = buildPortalDocuments().some(file => file.flagged);
    setHasInconsistency(hasFlaggedDocuments || Boolean(nameVerification && !nameVerification.verified) || guarantorIdentityMismatch);
    setHasExpirationMalus(
      expirationFlags.hasExpirationMalus ||
      scoringSnapshot.warnings.some((message: string) => /dater|fraich|mois|expire/i.test(message))
    );
    if (!isAnalyzingDoc && scoringSnapshot.warnings.length > 0) {
      setExpertBubbleMessage(scoringSnapshot.warnings[0]);
    } else if (!isAnalyzingDoc && expirationFlags.expertMessages.length > 0) {
      setExpertBubbleMessage(expirationFlags.expertMessages[0]);
    }
  }, [expirationFlags, isAnalyzingDoc, buildPortalDocuments, nameVerification, guarantorIdentityMismatch, scoringSnapshot.warnings]);

  useEffect(() => {
    const categories: Array<'identity' | 'resources' | 'guarantor'> = ['identity', 'resources', 'guarantor'];
    let resolvedDocumentIds: string[] = [];

    setUploadedFiles(prev => {
      let changed = false;
      const next = { ...prev };

      for (const category of categories) {
        next[category] = prev[category].map(file => {
          if (!file.flagged || !file.inconsistencyDetected) {
            return file;
          }

          const effectiveSubjectType =
            file.subjectType ||
            (category === 'guarantor'
              ? 'guarantor'
              : normalizeAnalysisDocumentType(file.aiAnalysis?.documentType || file.type || file.name) === 'CERTIFICAT_VISALE'
                ? 'visale'
                : 'tenant');
          const expectedIdentity = getExpectedIdentityForSubject(effectiveSubjectType, file.subjectSlot);
          const extractedIdentity = extractIdentityCandidate({
            extractedData: file.extractedData,
            document_metadata: file.aiAnalysis?.document_metadata,
            ownerName: file.aiAnalysis?.ownerName,
          });

          if (!hasUsableIdentity(expectedIdentity) || !hasUsableIdentity(extractedIdentity)) {
            return file;
          }

          const verification = compareIdentityToExpected(extractedIdentity, expectedIdentity);
          if (!verification.matches) {
            return file;
          }

          changed = true;
          resolvedDocumentIds.push(file.id);
          return {
            ...file,
            flagged: false,
            inconsistencyDetected: false,
            inconsistencyResolved: true,
          };
        });
      }

      return changed ? next : prev;
    });

    if (resolvedDocumentIds.length > 0) {
      setDocumentInconsistencies(prev =>
        prev.filter(inconsistency => !resolvedDocumentIds.includes(inconsistency.documentId))
      );
    }
  }, [uploadedFiles, getExpectedIdentityForSubject]);

  // Auto-save: Sauvegarder la progression à chaque changement important
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const triggerAutoSave = useCallback(async () => {
    if (!userEmail || !token) return;
    
    try {
      const result = await saveApplicationProgress(userEmail, token, {
        currentStep,
        profile: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          status: candidateStatus,
        },
        candidateStatus,
        diditStatus: diditStatus === 'verified' ? 'VERIFIED' : diditStatus === 'loading' ? 'PENDING' : undefined,
        diditSessionId: diditSessionId || undefined,
        diditIdentity: diditIdentity || undefined,
        documents: [
          ...uploadedFiles.identity.map(f => ({
            id: f.id,
            category: getPersistedDocumentCategory(f, 'identity'),
            subjectType: 'tenant' as const,
            type: f.type || 'UNKNOWN',
            fileName: f.name,
            status: f.status,
            aiAnalysis: f.aiAnalysis,
          })),
          ...uploadedFiles.resources.map(f => ({
            id: f.id,
            category: getPersistedDocumentCategory(f, 'resources'),
            subjectType: f.subjectType || (normalizeAnalysisDocumentType(f.aiAnalysis?.documentType || f.type || f.name) === 'CERTIFICAT_VISALE' ? 'visale' : 'tenant'),
            type: f.type || 'UNKNOWN',
            fileName: f.name,
            status: f.status,
            aiAnalysis: f.aiAnalysis,
          })),
          ...uploadedFiles.guarantor.map(f => ({
            id: f.id,
            category: getPersistedDocumentCategory(f, 'guarantor'),
            subjectType: 'guarantor' as const,
            subjectSlot: f.subjectSlot || 1,
            type: f.type || 'UNKNOWN',
            fileName: f.name,
            status: f.status,
            aiAnalysis: f.aiAnalysis,
          })),
        ],
        guarantorStatus: guarantorCertified ? 'CERTIFIED' : guarantorInvitationSent ? 'PENDING' : undefined,
        guarantorMethod: guarantorCertificationMethod || undefined,
        patrimometerScore: score,
        patrimometerBreakdown: scoringSnapshot.breakdown,
        patrimometerWarnings: scoringSnapshot.warnings,
        patrimometerNextAction: scoringSnapshot.nextAction,
        patrimometerChapterStates: scoringSnapshot.chapterStates,
        guarantee: scoringSnapshot.guarantee,
        propertyRentAmount: property?.rentAmount,
        detectedIncome: detectedIncome ?? undefined,
      });
      if (result?.success && result.applicationId) {
        setApplicationId(result.applicationId);
      }
      console.log('✅ Dossier sauvegardé automatiquement');
    } catch (error) {
      console.error('Erreur auto-save:', error);
    }
  }, [userEmail, token, currentStep, formData, candidateStatus, diditStatus, diditSessionId, diditIdentity, uploadedFiles, guarantorCertified, guarantorInvitationSent, guarantorCertificationMethod, score, scoringSnapshot, property?.rentAmount, detectedIncome]);

  // Déclencher l'auto-save avec debounce
  useEffect(() => {
    if (!userEmail) return;
    
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    
    autoSaveTimeout.current = setTimeout(() => {
      triggerAutoSave();
    }, 3000); // Sauvegarde 3 secondes après le dernier changement
    
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [currentStep, formData, diditStatus, uploadedFiles, guarantorCertified, score, triggerAutoSave, userEmail]);

  // Restaurer le dossier si l'utilisateur revient
  useEffect(() => {
    if (!userEmail || !token) return;
    
    const restoreApplication = async () => {
      try {
        const { application } = await getApplication(userEmail, token);
        
        if (application && application.tunnel?.progress > 0) {
          setHasStarted(true);
          setShowOnboarding(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem('patrimo_onboarding_seen', 'true');
          }
          if ((application as { _id?: string })._id) {
            setApplicationId((application as { _id: string })._id);
          }
          // Restaurer l'étape
          if (application.tunnel.currentStep) {
            setCurrentStep(application.tunnel.currentStep);
          }
          
          // Restaurer le profil
          if (application.profile) {
            setFormData(prev => ({
              ...prev,
              firstName: application.profile.firstName || prev.firstName,
              lastName: application.profile.lastName || prev.lastName,
              phone: application.profile.phone || prev.phone,
              status: (application.profile.status as CandidateStatus) || prev.status,
            }));
            if (application.profile.status && SUPPORTED_PROFILES.includes(application.profile.status)) {
              setCandidateStatus(application.profile.status as CandidateStatus);
            }
          }
          
          // Restaurer le statut Didit
          if (application.didit?.status === 'VERIFIED') {
            setDiditStatus('verified');
            if (application.didit.identityData) {
              setDiditIdentity(application.didit.identityData);
            }
          }
          
          // Restaurer le statut du garant
          if (application.guarantor?.status === 'CERTIFIED' || application.guarantor?.status === 'AUDITED') {
            if (application.guarantor?.certificationMethod !== 'VISALE') {
              setGuarantorCertified(true);
              setGuarantorCertificationMethod(application.guarantor.certificationMethod as 'DIDIT' | 'AUDIT');
            }
          }

          if (Array.isArray(application.documents) && application.documents.length > 0) {
            const restored = {
              identity: [] as DocumentFile[],
              resources: [] as DocumentFile[],
              guarantor: [] as DocumentFile[],
            };

            application.documents.forEach((doc: any) => {
              const restoredFile: DocumentFile = {
                id: doc.id || Math.random().toString(36).slice(2),
                type: doc.type || 'UNKNOWN',
                name: doc.fileName || 'Document',
                originalName: doc.fileName || 'Document',
                status: doc.status || 'pending',
                category: doc.category || 'Autre',
                subjectType: doc.subjectType || (doc.category === 'guarantor' ? 'guarantor' : 'tenant'),
                subjectSlot: doc.subjectSlot,
                aiAnalysis: doc.aiAnalysis,
              };

              if (doc.category === 'identity') {
                restored.identity.push(restoredFile);
              } else if (doc.category === 'guarantor') {
                restored.guarantor.push(restoredFile);
              } else {
                restored.resources.push(restoredFile);
              }
            });

            setUploadedFiles(restored);
          }

          if (application.guarantee?.mode) {
            setGuaranteeMode(application.guarantee.mode as GuaranteeMode);
          } else if (application.guarantor?.certificationMethod === 'VISALE') {
            setGuaranteeMode('VISALE');
          } else if (application.guarantor?.hasGuarantor) {
            setGuaranteeMode('PHYSICAL');
          }

          if (Array.isArray(application.guarantee?.guarantors) && application.guarantee.guarantors.length > 0) {
            const slotOne = application.guarantee.guarantors.find((slot: any) => slot.slot === 1);
            const slotTwo = application.guarantee.guarantors.find((slot: any) => slot.slot === 2);

            if (slotOne) {
              setGuarantorProfile((slotOne.profile as CandidateStatus) || 'Salarie');
              setGuarantorFirstName(slotOne.firstName || '');
              setGuarantorLastName(slotOne.lastName || '');
              setGuarantorEmail(slotOne.email || '');
              setGuarantorInvitationSent(Boolean(slotOne.invitationSent));
            }

            if (slotTwo) {
              setGuarantorSlotsCount(2);
              setSecondGuarantor({
                slot: 2,
                profile: (slotTwo.profile as CandidateStatus) || 'Salarie',
                firstName: slotTwo.firstName || '',
                lastName: slotTwo.lastName || '',
                email: slotTwo.email || '',
                status: slotTwo.status || 'NONE',
                certificationMethod: slotTwo.certificationMethod || null,
                invitationSent: Boolean(slotTwo.invitationSent),
              });
            }
          }
          
          // Afficher un message de bienvenue personnalisé
          const firstName = application.profile?.firstName || 'Locataire';
          setAiFeedback({
            visible: true,
            message: `👋 Bon retour ${firstName} ! Reprenons votre dossier là où vous l'aviez laissé.`,
            type: 'info',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
        }
      } catch (error) {
        console.error('Erreur restauration dossier:', error);
      }
    };
    
    restoreApplication();
  }, [userEmail, token]);

  // Vérifier périodiquement le statut du garant si une session Didit est active
  useEffect(() => {
    if (!guarantorDiditSessionId || guarantorCertified || !token) return;

    const interval = setInterval(async () => {
      try {
        const searchParams = new URLSearchParams({
          applyToken: token,
          sessionId: guarantorDiditSessionId,
          slot: '1',
        });

        if (guarantorEmail) {
          searchParams.set('email', guarantorEmail);
        }

        const response = await fetch(`/api/guarantor/status?${searchParams.toString()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.guarantor && data.guarantor.status === 'CERTIFIED') {
            setGuarantorCertified(true);
            setGuaranteeMode('PHYSICAL');
            setGuarantorFirstName(data.guarantor.firstName || guarantorFirstName);
            setGuarantorLastName(data.guarantor.lastName || guarantorLastName);
            setGuarantorEmail(data.guarantor.email || guarantorEmail);
            
            // Déterminer la méthode de certification
            const isAuditCertified = data.guarantor.auditDetails || 
              (data.guarantor.identityVerification?.source?.includes('Audit'));
            const certMethod = isAuditCertified ? 'AUDIT' : 'DIDIT';
            setGuarantorCertificationMethod(certMethod);
            setGuarantorDirectCertification(false);
            setGuarantorDiditVerificationUrl(null);
            
            const badge = certMethod === 'DIDIT' ? 'Identité Souveraine Certifiée' : 'Identité Auditée & Cohérente';
            
            setAiFeedback({
              visible: true,
              message: `🎉 Garantie Souveraine activée. Le garant 1 a validé son identité et son bloc Garantie vient d'être renforcé (${badge}).`,
              type: 'success',
              scoreIncrease: 10,
            });
            setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 8000);
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Erreur vérification statut garant:', error);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [guarantorDiditSessionId, guarantorCertified, token, guarantorFirstName, guarantorLastName, guarantorEmail]);

  const nextActionInfo = scoringSnapshot.nextAction || null;

  // NOTE: Le calcul de solvabilité a été déplacé côté serveur (propriétaire uniquement).
  // Côté locataire, seule la certification des données brutes est effectuée.

  // Message du Coach selon le score
  const getCoachMessage = () => {
    if (score >= 85) return "Exceptionnel ! Votre dossier atteint un niveau de certification premium. Les propriétaires privilégient systématiquement ce type de profil.";
    if (score >= 70) return "Excellent ! Votre dossier est solide. Quelques documents supplémentaires vous placeraient en tête des candidatures.";
    if (score >= 50) return "Votre dossier progresse bien. Chaque document ajouté renforce significativement votre crédibilité.";
    return "Commencez par les documents essentiels. L'IA PatrimoTrust™ vous guide vers une certification optimale.";
  };

  // --- Détecter le type de document par nom de fichier ---
  const detectDocumentType = (fileName: string): CertificationItem | null => {
    const lowerName = normalizeValue(fileName);
    for (const item of ALL_CERTIFICATION_ITEMS) {
      if (item.keywords.some(keyword => lowerName.includes(keyword))) {
        return item;
      }
    }
    return null;
  };

  // --- Mapper le documentType de l'IA vers un CertificationItem ---
  const mapDocumentTypeToChecklistId = (documentType: string, category: 'identity' | 'resources' | 'guarantor'): CertificationItem | null => {
    const checklistId = getChecklistIdForDocumentType(documentType, category);
    if (!checklistId) return null;
    return ALL_CERTIFICATION_ITEMS.find(i => i.id === checklistId) || null;
  };

  // --- Afficher le sceau doré ---
  const triggerGoldenSeal = (label: string) => {
    setShowGoldenSeal({show: true, label});
    setTimeout(() => setShowGoldenSeal({show: false, label: ''}), 1500);
  };

  // État pour le fichier en cours de suppression
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  // --- Supprimer un document ---
  const handleDeleteDocument = async (fileId: string) => {
    setDeletingFileId(fileId);
    
    // Trouver le fichier et sa catégorie
    let fileToDelete: DocumentFile | undefined;
    let category: 'identity' | 'resources' | 'guarantor' | null = null;
    
    for (const cat of ['identity', 'resources', 'guarantor'] as const) {
      const found = uploadedFiles[cat].find(f => f.id === fileId);
      if (found) {
        fileToDelete = found;
        category = cat;
        break;
      }
    }
    
    if (!fileToDelete || !category) {
      setDeletingFileId(null);
      return;
    }

    const confirmed = window.confirm('Voulez-vous supprimer ce document ? Votre PatrimoScore™ diminuera.');
    if (!confirmed) {
      setDeletingFileId(null);
      return;
    }

    // Vérifier si c'est une pièce maîtresse (CNI, passeport)
    const isCriticalDocument = fileToDelete.type?.toLowerCase().includes('cni') || 
                               fileToDelete.type?.toLowerCase().includes('identité') ||
                               fileToDelete.type?.toLowerCase().includes('passeport');
    
    try {
      // Note: La suppression du stockage serveur sera ajoutée ultérieurement
      // quand l'upload des fichiers sera implémenté avec persistance
      
      // Supprimer de l'état local avec animation
      setUploadedFiles(prev => ({
        ...prev,
        [category!]: prev[category!].filter(f => f.id !== fileId)
      }));
      
      // Décocher l'item de la checklist si applicable
      if (fileToDelete.type) {
        const checklistItem = ALL_CERTIFICATION_ITEMS.find(i => 
          i.label.toLowerCase().includes(fileToDelete!.type!.toLowerCase()) ||
          fileToDelete!.type!.toLowerCase().includes(i.id)
        );
        if (checklistItem) {
          setCertifiedItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(checklistItem.id);
            return newSet;
          });
        }
      }
      
      // Message de l'Expert si pièce critique
      if (isCriticalDocument) {
        setAiFeedback({
          visible: true,
          message: `⚠️ Attention ${formData.firstName || 'Locataire'}, votre identité n'est plus certifiée. Votre dossier est repassé en Grade C.`,
          type: 'warning',
        });
      } else {
        setAiFeedback({
          visible: true,
          message: '🗑️ Document supprimé. Votre PatrimoScore™ a été recalculé.',
          type: 'info',
          scoreIncrease: -10,
        });
      }
      setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 4000);
      
    } catch (error) {
      console.error('Erreur suppression document:', error);
      setAiFeedback({
        visible: true,
        message: '❌ Erreur lors de la suppression du document',
        type: 'error',
      });
      setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 4000);
    } finally {
      setDeletingFileId(null);
    }
  };

  // --- Forcer la validation d'un document malgré le doute IA ---
  const handleForceValidate = (fileId: string) => {
    // Trouver le fichier et sa catégorie
    for (const cat of ['identity', 'resources', 'guarantor'] as const) {
      const fileIndex = uploadedFiles[cat].findIndex(f => f.id === fileId);
      if (fileIndex !== -1) {
        setUploadedFiles(prev => ({
          ...prev,
          [cat]: prev[cat].map(f => 
            f.id === fileId 
              ? { 
                  ...f, 
                  forceSent: true,
                  status: 'needs_review' as const,
                  needsHumanReview: true, // Garder le flag pour le propriétaire
                  canForceSend: false,
                }
              : f
          )
        }));
        
        setAiFeedback({
          visible: true,
          message: '📤 Document transmis au propriétaire pour revue visuelle. Il ne sera pas marqué comme certifié tant qu il n aura pas été remplacé ou validé.',
          type: 'success',
        });
        setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 4000);
        break;
      }
    }
  };

  // --- Compresser une image avant upload ---
  const compressImage = async (file: File, maxSizeKB: number = 800): Promise<File> => {
    // Si ce n'est pas une image, retourner tel quel
    if (!file.type.startsWith('image/')) {
      return file;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          // Réduire la taille si l'image est trop grande
          const MAX_DIM = 1600;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = (height / width) * MAX_DIM;
              width = MAX_DIM;
            } else {
              width = (width / height) * MAX_DIM;
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Ajuster la qualité pour rester sous la limite
          let quality = 0.8;
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  if (blob.size > maxSizeKB * 1024 && quality > 0.3) {
                    quality -= 0.1;
                    tryCompress();
                  } else {
                    const compressedFile = new File([blob], file.name, {
                      type: 'image/jpeg',
                      lastModified: Date.now(),
                    });
                    console.log(`📦 Image compressée: ${(file.size/1024).toFixed(0)}KB → ${(compressedFile.size/1024).toFixed(0)}KB`);
                    resolve(compressedFile);
                  }
                } else {
                  resolve(file);
                }
              },
              'image/jpeg',
              quality
            );
          };
          tryCompress();
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const sanitizeSegment = (value: string) =>
    normalizeValue(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');

  const formatDateForFileName = (value?: string) => {
    if (!value) return 'SANS_DATE';
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = `${parsed.getMonth() + 1}`.padStart(2, '0');
      const dd = `${parsed.getDate()}`.padStart(2, '0');
      return `${yyyy}${mm}${dd}`;
    }
    const cleaned = sanitizeSegment(value);
    return cleaned || 'SANS_DATE';
  };

  const buildSuggestedFileName = (
    analysis: AnalysisV2Result,
    originalFile: File,
    fallbackType: string
  ) => {
    const ownerNameRaw =
      analysis.document_metadata?.owner_name ||
      analysis.ownerName ||
      (diditIdentity?.lastName && diditIdentity?.firstName
        ? `${diditIdentity.lastName} ${diditIdentity.firstName}`
        : `${formData.lastName} ${formData.firstName}`.trim());

    const typeRaw = analysis.documentType || fallbackType || 'document';
    const dateRaw =
      analysis.document_metadata?.date_emission ||
      analysis.date ||
      analysis.extractedData?.dates?.[0];

    const ownerSegment = sanitizeSegment(ownerNameRaw || 'LOCATAIRE');
    const typeSegment = sanitizeSegment(typeRaw || 'DOCUMENT');
    const dateSegment = formatDateForFileName(dateRaw);

    const extension = (() => {
      const ext = originalFile.name.split('.').pop()?.toLowerCase() || 'pdf';
      if (['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
      return 'pdf';
    })();

    return `${ownerSegment}_${typeSegment}_${dateSegment}.${extension}`;
  };

  const FORBIDDEN_DOC_KEYWORDS = [
    'rib',
    'iban',
    'bic',
    'carte vitale',
    'vitale',
    'releve de compte',
    'releve bancaire',
    'releve compte'
  ];

  const isForbiddenDocumentName = (fileName: string) => {
    const normalized = normalizeValue(fileName);
    return FORBIDDEN_DOC_KEYWORDS.some(keyword => normalized.includes(keyword));
  };

  const isForbiddenDocumentType = (documentType?: string) => {
    if (!documentType) return false;
    const normalized = normalizeValue(documentType);
    return FORBIDDEN_DOC_KEYWORDS.some(keyword => normalized.includes(keyword));
  };

  const applyPdfWatermark = async (file: File): Promise<File> => {
    if (file.type !== 'application/pdf') return file;
    try {
      const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      const watermark = 'Document destiné exclusivement à la location - Janvier 2026';

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        page.drawText(watermark, {
          x: 30,
          y: height - 40,
          size: 12,
          font,
          color: rgb(0.75, 0.75, 0.75),
          opacity: 0.6,
        });
      });

      const pdfBytes = await pdfDoc.save();
      const bytes = new Uint8Array(pdfBytes);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      return new File([blob], file.name, { type: 'application/pdf', lastModified: Date.now() });
    } catch (error) {
      console.error('❌ Watermark PDF failed:', error);
      return file;
    }
  };

  // --- Gérer l'upload de fichiers avec IA réelle ---
  const handleFileUpload = async (
    category: 'identity' | 'resources' | 'guarantor',
    files: FileList | null,
    options?: { subjectType?: 'tenant' | 'guarantor' | 'visale'; subjectSlot?: 1 | 2 }
  ) => {
    if (!files) return;
    
    for (let file of Array.from(files)) {
      if (isForbiddenDocumentName(file.name)) {
        setAiFeedback({
          visible: true,
          message: "Ce document est interdit par la loi Alur pour protéger votre vie privée.",
          type: 'warning',
        });
        setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 6000);
        continue;
      }

      // Vérifier la taille et compresser si nécessaire
      if (file.size > 900 * 1024) {
        if (file.type.startsWith('image/')) {
          console.log(`⚠️ Image trop grande (${(file.size/1024/1024).toFixed(2)}MB), compression en cours...`);
          setAiFeedback({
            visible: true,
            message: `Compression de l'image en cours...`,
            type: 'info',
          });
          file = await compressImage(file, 800);
        } else if (file.type === 'application/pdf' && file.size > 5 * 1024 * 1024) {
          // PDF trop gros
          setAiFeedback({
            visible: true,
            message: `Le fichier PDF est trop volumineux (${(file.size/1024/1024).toFixed(1)}MB). Veuillez utiliser un PDF de moins de 5MB.`,
            type: 'error',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
          continue;
        }
      }

      // Filigrane automatique pour les PDFs
      file = await applyPdfWatermark(file);

      // Détection initiale par nom de fichier (pour l'affichage immédiat)
      const detected = detectDocumentType(file.name);
      const resolvedSubjectType =
        options?.subjectType ||
        (category === 'guarantor' ? 'guarantor' : 'tenant');
      const resolvedSubjectSlot =
        resolvedSubjectType === 'guarantor'
          ? (options?.subjectSlot || 1)
          : undefined;
      
      const newFile: DocumentFile = {
        id: Math.random().toString(36).substr(2, 9),
        type: detected?.label || file.name,
        name: file.name,
        originalName: file.name, // Conserver le nom original
        status: 'ANALYZING',
        category: detected?.category || 'Autre',
        subjectType: resolvedSubjectType,
        subjectSlot: resolvedSubjectSlot,
      };

      setUploadedFiles(prev => ({
        ...prev,
        [category]: [...prev[category], newFile]
      }));

      try {
        setIsAnalyzingDoc(true);
        // Afficher un feedback immédiat
        setAiFeedback({
          visible: true,
          message: `Analyse en cours de "${file.name}" par l'IA PatrimoTrust™...`,
          type: 'info',
        });

        // Analyse IA: Utiliser API V2 pour tous les fichiers (meilleure analyse PDF)
        console.log('🔍 Analyse document V2:', file.name, 'Statut:', candidateStatus);
        
        // Construire le nom du candidat si disponible
        const fullCandidateName = diditIdentity?.firstName && diditIdentity?.lastName
          ? `${diditIdentity.lastName} ${diditIdentity.firstName}`
          : undefined;
        
        const analysis = await analyzeDocumentViaApi(
          file, 
          candidateStatus, 
          diditIdentity || undefined,
          fullCandidateName,
          property?.rentAmount, // Passer le loyer pour vérification Visale
          category as 'identity' | 'resources' | 'guarantor'
        );
        console.log('✅ Résultat analyse V2:', analysis);

        // Fallback 202 : document reçu mais analyse différée
        if ((analysis as unknown as { status?: string }).status === 'delayed') {
          setUploadedFiles(prev => ({
            ...prev,
            [category]: prev[category].map(f => f.id === newFile.id
              ? { ...f, status: 'pending' as const }
              : f
            )
          }));
          setAiFeedback({
            visible: true,
            message: "Document reçu ! L'analyse prend un peu plus de temps — il sera vérifié sous peu.",
            type: 'info',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 8000);
          continue;
        }

        if (isForbiddenDocumentType(analysis.documentType)) {
          setUploadedFiles(prev => ({
            ...prev,
            [category]: prev[category].filter(f => f.id !== newFile.id)
          }));
          setAiFeedback({
            visible: true,
            message: "Ce document est interdit par la loi Alur pour protéger votre vie privée.",
            type: 'warning',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 6000);
          continue;
        }
        
        // Vérifier si document illisible
        const isIllegible = analysis.isIllegible === true;
        const aiDocumentType = analysis.documentType || analysis.document_metadata?.type || '';
        const normalizedAiDocumentType = normalizeAnalysisDocumentType(aiDocumentType);
        const aiFraudScore = analysis.fraudScore ?? analysis.trust_and_security?.fraud_score ?? 0;
        const compatibleDetectedItem =
          detected && isChecklistItemCompatibleWithUploadCategory(detected, category)
            ? detected
            : null;
        const aiDetectedItem = aiDocumentType
          ? mapDocumentTypeToChecklistId(aiDocumentType, category)
          : null;
        let finalDetectedItem = aiDetectedItem || compatibleDetectedItem;
        if (finalDetectedItem?.id === 'bilan_n1' && certifiedItems.has('bilan_n1') && !certifiedItems.has('bilan_n2')) {
          const secondBilan = ALL_CERTIFICATION_ITEMS.find(i => i.id === 'bilan_n2') || null;
          if (secondBilan) finalDetectedItem = secondBilan;
        }

        const certificationDecision = getDocumentCertificationDecision({
          uploadCategory: category,
          aiDocumentType: aiDocumentType || normalizedAiDocumentType,
          fraudScore: aiFraudScore,
          isIllegible,
          needsHumanReview: analysis.needsHumanReview || false,
          partialExtraction: analysis.partialExtraction || false,
          hasCompatibleChecklistHint: Boolean(finalDetectedItem),
        });
        const isFlagged = certificationDecision.flagged || analysis.fraudIndicators?.suspicious === true;
        const isRejected = certificationDecision.status === 'REJECTED';
        const finalStatus = certificationDecision.status as DocumentFile['status'];
        const finalConfidenceScore = analysis.confidenceScore ?? certificationDecision.confidenceScore;
        
        // Déterminer si renommage a eu lieu
        const formattedFileName = buildSuggestedFileName(analysis, file, detected?.label || file.name);
        const finalSuggestedName = !isIllegible ? (formattedFileName || analysis.suggestedFileName) : undefined;
        const hasBeenRenamed = !!finalSuggestedName && finalSuggestedName !== file.name;
        const finalSubjectType =
          resolvedSubjectType === 'tenant' && normalizedAiDocumentType === 'CERTIFICAT_VISALE'
            ? 'visale'
            : resolvedSubjectType;

        // Mettre à jour le fichier avec les résultats de l'analyse
        setUploadedFiles(prev => ({
          ...prev,
          [category]: prev[category].map(f => 
            f.id === newFile.id 
              ? { 
                  ...f, 
                  type: finalDetectedItem?.label || (normalizedAiDocumentType !== 'AUTRE' ? normalizedAiDocumentType.replace(/_/g, ' ') : f.type),
                  status: finalStatus,
                  flagged: isFlagged,
                  confidenceScore: finalConfidenceScore,
                  fraudScore: aiFraudScore,
                  extractedData: analysis.extractedData,
                  // Dates normalisées
                  dateEmission: analysis.document_metadata?.date_emission || analysis.date || analysis.extractedData?.dates?.[0],
                  dateExpiration: analysis.document_metadata?.date_validite,
                  // Renommage automatique
                  originalName: file.name,
                  suggestedName: hasBeenRenamed ? finalSuggestedName : undefined,
                  name: hasBeenRenamed ? finalSuggestedName! : file.name,
                  isRenamed: hasBeenRenamed,
                  subjectType: finalSubjectType,
                  subjectSlot: resolvedSubjectSlot,
                  // Message d'erreur pour docs illisibles
                  errorMessage: isIllegible ? analysis.errorMessage : undefined,
                  // Nouveaux champs "Bienveillance Sécuritaire"
                  needsHumanReview: finalStatus === 'NEEDS_REVIEW' || analysis.needsHumanReview || false,
                  humanReviewReason: analysis.humanReviewReason || certificationDecision.reason,
                  partialExtraction: analysis.partialExtraction || false,
                  extractedFields: analysis.extractedFields,
                  improvementTip: analysis.improvementTip || analysis.expertAdvice || certificationDecision.reason,
                  canForceSend: certificationDecision.canForceSend,
                  categoryMatch: certificationDecision.categoryMatch,
                  aiAnalysis: {
                    documentType: aiDocumentType || normalizedAiDocumentType,
                    ownerName: analysis.ownerName || analysis.document_metadata?.owner_name,
                    recommendations: analysis.recommendations || [],
                    fraudIndicators: analysis.fraudIndicators,
                    fraudAudit: analysis.fraudAudit, // Détails de l'audit anti-fraude
                    document_metadata: analysis.document_metadata, // Pour cross-check garant (CNI vs avis)
                    financial_data: analysis.financial_data,
                    trust_and_security: analysis.trust_and_security,
                  }
                }
              : f
          )
        }));

        if (finalSubjectType === 'visale') {
          setGuaranteeMode('VISALE');
        }
        if (finalSubjectType === 'guarantor') {
          setGuaranteeMode('PHYSICAL');
          if (resolvedSubjectSlot === 2) {
            setGuarantorSlotsCount(2);
          }
        }

        // Vérification anti-fraude : cohérence des noms par sujet (locataire, garant 1, garant 2)
        const expectedIdentity = getExpectedIdentityForSubject(
          finalSubjectType,
          resolvedSubjectSlot
        );
        const extractedIdentity = extractIdentityCandidate({
          extractedData: analysis.extractedData,
          document_metadata: analysis.document_metadata,
          ownerName: analysis.ownerName,
        });

        if (hasUsableIdentity(expectedIdentity) && hasUsableIdentity(extractedIdentity)) {
          const verification = compareIdentityToExpected(extractedIdentity, expectedIdentity);

          if (finalSubjectType !== 'guarantor') {
            setNameVerification({
              verified: verification.matches,
              message: verification.message,
            });
          }

          if (!verification.matches) {
            const detectedFullName = extractedIdentity.fullName || `${extractedIdentity.firstName || ''} ${extractedIdentity.lastName || ''}`.trim();
            const expectedFullName = `${expectedIdentity.firstName || ''} ${expectedIdentity.lastName || ''}`.trim();

            const newInconsistency = {
              documentId: newFile.id,
              documentName: analysis.documentType || file.name,
              documentType: analysis.documentType || 'Document',
              detectedName: detectedFullName,
              expectedName: expectedFullName,
              status: 'detected' as const,
            };

            setDocumentInconsistencies(prev => {
              const exists = prev.some(inc => inc.documentId === newFile.id);
              if (exists) return prev;
              return [...prev, newInconsistency];
            });

            setUploadedFiles(prev => ({
              ...prev,
              [category]: prev[category].map(f =>
                f.id === newFile.id
                  ? { ...f, flagged: true, inconsistencyDetected: true }
                  : f
              )
            }));

            setTimeout(() => {
              setActiveInconsistency({
                documentId: newFile.id,
                documentName: analysis.documentType || file.name,
                detectedName: detectedFullName,
                expectedName: expectedFullName,
              });
              setShowConsistencyModal(true);
            }, 800);
          }
        }

        // Profil détecté par l'IA
        if (analysis.personaMatch?.detectedProfile) {
          setDetectedProfile(analysis.personaMatch.detectedProfile);
        } else if (normalizedAiDocumentType === 'ATTESTATION_BOURSE' || normalizeValue(aiDocumentType).includes('scolarite')) {
          setDetectedProfile('Étudiant boursier');
          setCandidateStatus('Etudiant');
          setFormData(prev => ({ ...prev, status: 'Etudiant' }));
        } else if (normalizedAiDocumentType === 'BULLETIN_SALAIRE' || normalizedAiDocumentType === 'CONTRAT_TRAVAIL') {
          setDetectedProfile('Salarié');
          setCandidateStatus('Salarie');
          setFormData(prev => ({ ...prev, status: 'Salarie' }));
        } else if (normalizedAiDocumentType === 'PENSION' || normalizeValue(aiDocumentType).includes('retraite')) {
          setDetectedProfile('Retraité');
          setCandidateStatus('Retraite');
          setFormData(prev => ({ ...prev, status: 'Retraite' }));
        }

        // Revenus détectés - Intelligence selon le type de document
        const normalizedDocType = normalizeValue(analysis.documentType || '');
        const resolvedIncomeContribution = getDocumentIncomeContribution({
          documentType: analysis.document_metadata?.type || analysis.documentType,
          analysis,
        });
        const resolvedMonthlyIncome = Number(resolvedIncomeContribution?.amount || 0);

        if (resolvedMonthlyIncome > 0) {
          if (normalizedDocType.includes('bourse') || normalizedDocType.includes('crous')) {
            setBourseAmount(prev => {
              const next = Math.max(prev || 0, resolvedMonthlyIncome);
              const salaryAverage =
                salaryNetSamples.length > 0
                  ? salaryNetSamples.reduce((sum, value) => sum + value, 0) / salaryNetSamples.length
                  : 0;
              setDetectedIncome(salaryAverage > 0 ? salaryAverage + next + (aplAmount || 0) : next + (aplAmount || 0));
              return next;
            });
          } else if (normalizedDocType.includes('caf') || normalizedDocType.includes('apl') || normalizedDocType.includes('als')) {
            setAplAmount(prev => {
              const next = Math.max(prev || 0, resolvedMonthlyIncome);
              const salaryAverage =
                salaryNetSamples.length > 0
                  ? salaryNetSamples.reduce((sum, value) => sum + value, 0) / salaryNetSamples.length
                  : 0;
              setDetectedIncome(salaryAverage > 0 ? salaryAverage + next + (bourseAmount || 0) : next + (bourseAmount || 0));
              return next;
            });
          } else if (category === 'guarantor' || normalizedDocType.includes('garant')) {
            setGuarantorIncome(prev => Math.max(prev || 0, resolvedMonthlyIncome));
          } else if (normalizedDocType.includes('bulletin') || normalizedDocType.includes('salaire')) {
            setSalaryNetSamples(prev => {
              const next = [...prev, resolvedMonthlyIncome].slice(-3);
              const averageSalary = next.reduce((sum, value) => sum + value, 0) / next.length;
              setDetectedIncome(averageSalary + (aplAmount || 0) + (bourseAmount || 0));
              return next;
            });
          } else if (!normalizedDocType.includes('imposition') && !normalizedDocType.includes('rfr')) {
            setDetectedIncome(prev => Math.max(prev || 0, resolvedMonthlyIncome));
          }
        }

        // Cross-check RFR (Avis d'imposition) vs bulletins de salaire
        if (normalizedDocType.includes('imposition') || normalizedDocType.includes('rfr')) {
          const rfrCandidate = Math.max(...(analysis.extractedData?.montants || []));
          if (Number.isFinite(rfrCandidate) && rfrCandidate > 0) {
            setRfrAmount(rfrCandidate);
          }
        }

        // Indication garant détecté
        const guarantorRecommendation = analysis.recommendations?.find(rec => rec.toLowerCase().includes('garant'));
        if (guarantorRecommendation) {
          setGuarantorHint(`${formData.firstName || diditIdentity?.firstName || 'Vous'}, j'ai détecté qu'un garant est mentionné. Cliquez ici pour lui envoyer un lien de dépôt sécurisé pour ses 3 derniers bulletins de salaire.`);
        }

        // Vérification de cohérence persona
        if (analysis.personaMatch && !analysis.personaMatch.matches) {
          setAiFeedback({
            visible: true,
            message: `Incohérence détectée : vous avez déclaré être "${candidateStatus}" mais les documents suggèrent un profil "${analysis.personaMatch.detectedProfile}". Veuillez vérifier.`,
            type: 'error',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 7000);
        }

        // Afficher les recommandations de l'IA
        if (analysis.recommendations?.length > 0 && finalStatus === 'CERTIFIED') {
          setAiFeedback({
            visible: true,
            message: analysis.recommendations[0],
            type: analysis.confidenceScore >= 70 ? 'success' : 'info',
            scoreIncrease: analysis.confidenceScore >= 70 ? Math.floor(analysis.confidenceScore / 10) : undefined,
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 6000);
        }

        // Alerte Visale si le loyer dépasse le plafond
        if (analysis.ai_analysis?.visale_alert) {
          setAiFeedback({
            visible: true,
            message: `⚠️ ${analysis.ai_analysis.visale_alert}`,
            type: 'warning',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 10000); // Plus long pour alerte importante
        }

        // Afficher le statut d'authentification par sceau numérique 2D-Doc
        if (analysis.trust_and_security?.digital_seal_status === 'AUTHENTIFIÉ_PAR_SCELLEMENT_NUMÉRIQUE') {
          setAiFeedback({
            visible: true,
            message: '🔐 ✅ Certificat Visale authentifié par sceau numérique 2D-Doc. Les données ont été vérifiées et signées par Action Logement.',
            type: 'success',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 8000);
        } else if (analysis.trust_and_security?.digital_seal_status === 'SIGNATURE_INVALIDE') {
          setAiFeedback({
            visible: true,
            message: '⚠️ Signature numérique du sceau 2D-Doc invalide. Le document peut être falsifié.',
            type: 'error',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 10000);
        } else if (analysis.trust_and_security?.digital_seal_status === 'NOM_NON_CORRESPONDANT') {
          setAiFeedback({
            visible: true,
            message: '⚠️ Le sceau numérique est valide mais le nom sur le certificat ne correspond pas à votre identité certifiée.',
            type: 'warning',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 10000);
        }

        // Si le document est certifié avec succès
        if (finalStatus === 'CERTIFIED' && !isFlagged && finalDetectedItem && !certifiedItems.has(finalDetectedItem.id)) {
          setCertifiedItems(prev => new Set([...prev, finalDetectedItem.id]));
          triggerGoldenSeal(finalDetectedItem.label);
          setExpertBubbleMessage('Parfait ! Votre solvabilité est renforcée de 15 points.');
          setTimeout(() => setExpertBubbleMessage('Expert PatrimoTrust™ à votre service.'), 5000);
          
          // Message de succès avec augmentation du score
          const scoreIncrease = Math.floor(finalConfidenceScore / 10);
          setAiFeedback({
            visible: true,
            message: `✅ Document certifié avec succès ! "${finalDetectedItem.label}" ajouté à votre checklist. Score de confiance : ${finalConfidenceScore}%`,
            type: 'success',
            scoreIncrease,
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
        }

        if (finalStatus === 'NEEDS_REVIEW' && certificationDecision.reason && !isFlagged) {
          setAiFeedback({
            visible: true,
            message: `🧠 ${certificationDecision.reason}`,
            type: 'info',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 7000);
        }

        if (finalStatus === 'REJECTED' && !isFlagged && certificationDecision.reason) {
          setAiFeedback({
            visible: true,
            message: `📄 ${certificationDecision.reason}`,
            type: 'warning',
          });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 7000);
        }

        // Alerte si document suspect (doute technique, pas accusation)
        if (isFlagged) {
          // Construire un message détaillé selon le fraudScore, en parlant de "doute technique"
          let alertMessage = '';
          if (aiFraudScore > 50) {
            const fraudDetails: string[] = [];
            if (analysis.fraudAudit?.structureAnalysis?.suspiciousAlignment) {
              fraudDetails.push('alignements suspects');
            }
            if (analysis.fraudAudit?.mathematicalAudit?.calculationErrors) {
              fraudDetails.push('erreurs de calcul');
            }
            if (analysis.fraudAudit?.metadataAnalysis?.suspiciousCreator) {
              fraudDetails.push(`PDF créé par ${analysis.fraudAudit.metadataAnalysis.creatorSoftware || 'logiciel de retouche'}`);
            }
            if (analysis.fraudAudit?.consistencyCheck?.dateIssues) {
              fraudDetails.push('incohérences de dates');
            }
            
            alertMessage = `🔍 Nous avons un doute technique sur la structure de ce document (Score d'intégrité: ${Math.max(0, 100 - aiFraudScore)}/100). `;
            if (fraudDetails.length > 0) {
              alertMessage += `Éléments à vérifier: ${fraudDetails.join(', ')}. `;
            }
            alertMessage += `Pour garantir votre certification, pouvez-vous fournir l'original numérique (PDF natif) plutôt qu'une photo ?`;
          } else if (aiFraudScore > 10) {
            alertMessage = `⚠️ Petite anomalie de lecture détectée (Score d'intégrité: ${Math.max(0, 100 - aiFraudScore)}/100). `;
            const reasons = analysis.fraudIndicators?.reasons.join(', ') || 'Vérifications recommandées';
            alertMessage += `${reasons}. Une version plus nette ou l'original PDF aidera l'expert à confirmer votre dossier.`;
          } else {
            const reasons = analysis.fraudIndicators?.reasons.join(', ') || 'Score de confiance insuffisant';
            alertMessage = `L'analyse haute définition signale un doute technique sur ce document (${reasons}). Pour lever ce doute, fournissez si possible l'original numérique (PDF) ou un scan de meilleure qualité.`;
          }
          
          setAiAlertMessage(alertMessage);
        }

      } catch (error) {
        console.error('❌ Erreur analyse document:', error);
        
        // En cas d'erreur, marquer comme rejeté
        setUploadedFiles(prev => ({
          ...prev,
          [category]: prev[category].map(f => 
            f.id === newFile.id 
              ? { ...f, status: 'rejected' as const, flagged: true }
              : f
          )
        }));

        const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'analyse du document.';
        
        setAiFeedback({
          visible: true,
          message: errorMessage.includes('OPENAI_API_KEY') 
            ? '⚠️ Clé API OpenAI non configurée. L\'analyse IA est désactivée. Veuillez configurer OPENAI_API_KEY dans les variables d\'environnement.'
            : errorMessage,
          type: 'error',
        });
        setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 8000);
      } finally {
        setIsAnalyzingDoc(false);
      }
    }
  };

  // --- Récupérer la checklist pour l'étape actuelle ---
  const getChecklistForStep = () => {
    switch (currentStep) {
      case 1: return { 'Identité': CERTIFICATION_ITEMS.identite };
      case 2: return { 'Activité': CERTIFICATION_ITEMS.activite, 'Ressources': CERTIFICATION_ITEMS.ressources, 'Domicile': CERTIFICATION_ITEMS.domicile };
      case 3: return { 'Garantie': CERTIFICATION_ITEMS.garantie };
      case 4: return { 'Engagement': CERTIFICATION_ITEMS.engagement };
      default: return {};
    }
  };

  // --- Message de recommandation ---
  const getRecommendationMessage = () => {
    const categories = getChecklistForStep();
    const allItems = Object.values(categories).flat();
    const missingItems = allItems.filter(item => !certifiedItems.has(item.id));
    if (missingItems.length === 0) return null;
    const firstMissing = missingItems[0];
    return AI_MESSAGES[firstMissing.id] || AI_MESSAGES.default;
  };

  // --- Effects ---
  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await fetch(`/api/public/apply/${token}`);
        if (res.ok) {
          const data = await res.json();
          setProperty(data.property);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchProperty();
  }, [token]);

  // Note: Le SDK Didit (cdn.didit.me) n'est plus disponible.
  // On utilise directement la redirection vers verify.didit.me

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const returnedSessionId = params.get('session_id');
    const returnedDiditStatus = params.get('didit_status');

    if (!returnedSessionId) return;

    setDiditSessionId((current) => current || returnedSessionId);
    setDiditStatus('loading');
    setDiditVerificationUrl(null);
    setDiditQrCode(null);

    if (returnedDiditStatus) {
      setAiFeedback({
        visible: true,
        message: returnedDiditStatus.toLowerCase() === 'approved'
          ? 'Verification Didit terminee. Confirmation de votre identite en cours...'
          : `Retour Didit recu (${returnedDiditStatus}). Verification du statut en cours...`,
        type: 'info',
      });
      setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 7000);
    }

    const cleanUrl = `/apply/${encodeURIComponent(token)}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleDiditMessage = (event: MessageEvent<DiditPostMessage>) => {
      if (event.origin !== window.location.origin) return;

      const payload = event.data;
      if (!payload || payload.source !== 'doc2loc-didit' || payload.type !== 'didit_completed') {
        return;
      }

      if (payload.sessionId) {
        setDiditSessionId((current) => current || payload.sessionId || null);
      }

      setDiditStatus('loading');
      setDiditVerificationUrl(null);
      setDiditQrCode(null);
      setAiFeedback({
        visible: true,
        message: 'Verification Didit terminee. Confirmation de votre identite en cours...',
        type: 'info',
      });
      setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 7000);
    };

    window.addEventListener('message', handleDiditMessage);
    return () => window.removeEventListener('message', handleDiditMessage);
  }, []);

  useEffect(() => {
    if (!diditSessionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/didit/status?sessionId=${encodeURIComponent(diditSessionId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.verified) {
          setDiditStatus('verified');
          setDiditIdentity({
            firstName: data.firstName,
            lastName: data.lastName,
            birthDate: data.birthDate,
            humanVerified: data.humanVerified,
          });
          setFormData(prev => ({
            ...prev,
            firstName: data.firstName || prev.firstName,
            lastName: data.lastName || prev.lastName,
            birthDate: data.birthDate || prev.birthDate,
          }));
          setDiditVerificationUrl(null);
          setDiditQrCode(null);
          setCertifiedItems(prev => new Set([...prev, 'cni']));
          // Ne pas passer automatiquement à l'étape 2 - attendre que le formulaire de coordonnées soit rempli
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Erreur récupération Didit:', error);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [diditSessionId]);

  useEffect(() => {
    if (!rfrAmount || salaryNetSamples.length === 0) return;
    const avgMonthly = salaryNetSamples.reduce((sum, val) => sum + val, 0) / salaryNetSamples.length;
    const annualFromPayslips = avgMonthly * 12;
    if (!Number.isFinite(annualFromPayslips) || annualFromPayslips <= 0) return;

    const diffRatio = Math.abs(annualFromPayslips - rfrAmount) / Math.max(annualFromPayslips, rfrAmount);
    const message = diffRatio > 0.25
      ? `⚠️ Écart détecté entre votre Revenu Fiscal de Référence (${Math.round(rfrAmount)}€) et le cumul net estimé des bulletins (${Math.round(annualFromPayslips)}€). Merci de vérifier les documents.`
      : `✅ Cohérence revenus validée entre l'avis d'imposition et les bulletins de salaire.`;

    const status = diffRatio > 0.25 ? 'warning' : 'ok';
    setIncomeCrossCheck({ status, message });

    if (status === 'warning' && incomeCrossCheckRef.current !== message) {
      incomeCrossCheckRef.current = message;
      setAiFeedback({
        visible: true,
        message,
        type: 'warning',
      });
      setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 8000);
    }
  }, [rfrAmount, salaryNetSamples]);

  useEffect(() => {
    if (isAnalyzingDoc) {
      setExpertBubbleMessage('Analyse en cours... Je vérifie la cohérence de vos revenus.');
    }
  }, [isAnalyzingDoc]);

  // --- Navigation ---
  const canAccessGuarantee = scoringSnapshot.chapterStates.guarantee.accessible;
  const guaranteeRequirement = scoringSnapshot.chapterStates.guarantee.requirement;
  const guaranteeSatisfied = scoringSnapshot.chapterStates.guarantee.satisfied;

  const handleNext = async () => {
    // Validation Zod des données personnelles à l'étape 1
    if (currentStep === 1) {
      const result = ApplySchema.safeParse({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone || '',
        monthlyNetIncome: 0,
        employmentType: 'AUTRE' as const,
        hasGuarantor: false,
      });
      if (!result.success) {
        const firstError = result.error.issues[0];
        if (firstError) {
          notify.warning(firstError.message);
          return;
        }
      }
    }
    if (currentStep === 2) {
      if (!canAccessGuarantee) {
        setAiFeedback({
          visible: true,
          message: "Chapitre III s'ouvre dès que votre identité est engagée. Lancez d'abord la vérification d'identité ou ajoutez une pièce d'identité.",
          type: 'warning',
        });
        setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 6000);
        return;
      }
      // Animation de scan IA
      setIsScanning(true);
      setTimeout(() => {
        setIsScanning(false);
        setCurrentStep(prev => prev + 1);
      }, 2000);
    } else if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else if (currentStep === 4) {
      if (!canAccessCertification) {
        setAiFeedback({
          visible: true,
          message: passportBlockerMessage,
          type: 'warning',
        });
        setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 6000);
        return;
      }
      if (!userEmail || !token) return;
      setSubmittingPassport(true);
      try {
        const { application } = await getApplication(userEmail, token);
        const appId = (application as { _id?: string })?._id;
        if (!appId) {
          setAiFeedback({ visible: true, message: 'Dossier introuvable. Rechargez la page.', type: 'warning' });
          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 4000);
          setSubmittingPassport(false);
          return;
        }
        const result = await submitApplication(appId);
        if (result && (result as { success?: boolean }).success) {
          const ownerName = property?.name ? encodeURIComponent(property.name) : '';
          window.location.href = `/apply/success?candidatureId=${appId}${ownerName ? `&ownerName=${ownerName}` : ''}`;
          return;
        }
        setAiFeedback({ visible: true, message: (result as { error?: string })?.error || 'Erreur lors de la transmission.', type: 'warning' });
        setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
      } catch (e) {
        setAiFeedback({ visible: true, message: 'Erreur lors de la transmission. Réessayez.', type: 'warning' });
        setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
      }
      setSubmittingPassport(false);
    } else {
      notify.info("Préparation du PDF certifié...");
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Note: On affiche le formulaire même pendant le chargement des données du bien
  // pour éviter un écran blanc prolongé

  const recommendationMessage = getRecommendationMessage();
  const checklistCategories = getChecklistForStep();

  // Score du passeport
  const getPassportScore = () => {
    if (score >= 85) return 'Score A+';
    if (score >= 70) return 'Score A';
    return 'Score B+';
  };

  const passportName = `${formData.firstName || diditIdentity?.firstName || 'Prénom'} ${formData.lastName || diditIdentity?.lastName || 'Nom'}`.trim() || 'Votre dossier';

  // Déterminer le niveau de certification
  const getCertificationLevel = (): 'incomplet' | 'certifie' | 'excellence' => {
    if (score >= 85) return 'excellence';
    if (score >= 50) return 'certifie';
    return 'incomplet';
  };

  // Documents requis selon le statut candidat
  const getRequiredDocuments = (): string[] => {
    const base = ['cni', 'domicile'];
    if (candidateStatus === 'Etudiant') {
      return [...base, 'scolarite'];
    }
    if (candidateStatus === 'Salarie') {
      return [...base, 'attestation_employeur', 'salaire', 'avis_imposition'];
    }
    if (candidateStatus === 'Retraite') {
      return [...base, 'pension', 'avis_imposition'];
    }
    return [...base, 'avis_imposition', 'bilan_n1', 'bilan_n2', 'attestation_urssaf'];
  };

  const isRequirementSatisfied = (id: string) => {
    if (id === 'bilan_n1' || id === 'bilan_n2') {
      return certifiedItems.has(id) || certifiedItems.has('attestation_urssaf');
    }
    if (id === 'attestation_urssaf') {
      return certifiedItems.has('attestation_urssaf') || (certifiedItems.has('bilan_n1') && certifiedItems.has('bilan_n2'));
    }
    return certifiedItems.has(id);
  };

  const coachSuggestions = candidateStatus === 'Etudiant'
    ? [
        { id: 'scolarite', label: 'Certificat de scolarité' },
        { id: 'bourse', label: 'Avis de bourse' },
      ]
    : candidateStatus === 'Salarie'
    ? [
        { id: 'attestation_employeur', label: 'Attestation employeur' },
        { id: 'avis_imposition', label: 'Avis d\'imposition' },
      ]
    : candidateStatus === 'Retraite'
    ? [
        { id: 'pension', label: 'Justificatif de retraite' },
        { id: 'avis_imposition', label: 'Avis d\'imposition' },
      ]
    : [
        { id: 'bilan_n1', label: 'Bilan N-1' },
        { id: 'attestation_urssaf', label: 'Attestation URSSAF' },
      ];

  const missingRequired = getRequiredDocuments().filter(item => !isRequirementSatisfied(item));
  const needsGuarantorReminder = missingRequired.includes('garant_id');
  const incomeBelowThreshold = !!(property?.rentAmount && detectedIncome !== null && detectedIncome < property.rentAmount * 3);

  const getItemLabel = (id: string) => {
    const match = ALL_CERTIFICATION_ITEMS.find(item => item.id === id);
    return match?.label || id;
  };

  const quickUploadTargets: Record<string, string> = {
    bourse: 'resources-file-input',
    caf: 'resources-file-input',
    salaire: 'resources-file-input',
    contrat: 'resources-file-input',
    attestation_employeur: 'resources-file-input',
    avis_imposition: 'resources-file-input',
    attestation_urssaf: 'resources-file-input',
    bilan_n1: 'resources-file-input',
    bilan_n2: 'resources-file-input',
    domicile: 'resources-file-input',
    garant_id: 'guarantor-file-input',
    garant_avis: 'guarantor-file-input',
    garant_domicile: 'guarantor-file-input',
  };

  const handleQuickUpload = (id: string) => {
    const target = quickUploadTargets[id];
    if (!target) return;
    document.getElementById(target)?.click();
  };

  const handleDiditVerification = async () => {
    if (diditStatus !== 'idle') return;
    setDiditStatus('loading');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch('/api/didit/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: token }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await res.json();
      
      if (data.fallbackMode) {
        setDiditStatus('idle');
        setAiFeedback({
          visible: true,
          message: 'Vérification biométrique temporairement indisponible. Vous pouvez télécharger votre pièce d\'identité manuellement ci-dessous.',
          type: 'info',
        });
        setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 10000);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Impossible de créer une session Didit.');
      }

      setDiditSessionId(data.sessionId);
      setDiditClientId(data.clientId);
      setDiditVerificationUrl(data.verificationUrl || null);
      setDiditQrCode(data.qrCode || null);
    } catch (error) {
      clearTimeout(timeout);
      setDiditStatus('idle');
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      setAiFeedback({
        visible: true,
        message: isTimeout
          ? 'Le service de vérification met trop de temps à répondre. Téléchargez votre pièce d\'identité manuellement.'
          : (error instanceof Error ? error.message : 'Erreur Didit.'),
        type: isTimeout ? 'info' : 'error',
      });
      setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 8000);
    }
  };

  const profileDocs = REQUIRED_DOCS_BY_PROFILE[candidateStatus] || REQUIRED_DOCS_BY_PROFILE.Etudiant;
  const slotOneGuarantorFiles = getGuarantorFilesForSlot(1);
  const slotTwoGuarantorFiles = getGuarantorFilesForSlot(2);
  const reviewedResources = uploadedFiles.resources.filter(file =>
    file.status === 'CERTIFIED' ||
    file.status === 'REJECTED' ||
    file.status === 'ILLEGIBLE' ||
    file.status === 'NEEDS_REVIEW' ||
    !!file.flagged
  );
  const certifiedResources = reviewedResources.filter(file => file.status === 'CERTIFIED' && !file.flagged);
  const invalidatedResources = reviewedResources.filter(file => file.status !== 'CERTIFIED' || !!file.flagged);
  const missingResourceDocs = profileDocs.required
    .map(id => ALL_CERTIFICATION_ITEMS.find(item => item.id === id))
    .filter((item): item is CertificationItem => !!item)
    .filter(item => !isRequirementSatisfied(item.id));
  const missingSummary = missingResourceDocs.slice(0, 3);
  const requiredTotal = profileDocs.required.length;
  const requiredDone = requiredTotal - missingResourceDocs.length;
  const passportStudioFallbackWarnings = useMemo(() => (
    scoringSnapshot.warnings.slice(0, 4).length > 0
      ? scoringSnapshot.warnings.slice(0, 4)
      : [scoringSnapshot.nextAction?.action || passportBlockerMessage]
  ), [passportBlockerMessage, scoringSnapshot.nextAction, scoringSnapshot.warnings]);
  const passportStudioRefreshKey = useMemo(() => [
    applicationId || 'draft',
    score,
    diditStatus,
    uploadedFiles.identity.length,
    uploadedFiles.resources.length,
    uploadedFiles.guarantor.length,
    guaranteeMode,
    guarantorSlotsCount,
    guarantorCertified ? '1' : '0',
  ].join(':'), [
    applicationId,
    diditStatus,
    guaranteeMode,
    guarantorCertified,
    guarantorSlotsCount,
    score,
    uploadedFiles.guarantor.length,
    uploadedFiles.identity.length,
    uploadedFiles.resources.length,
  ]);

  // Certification (étape 4) : pilotée par le moteur unifié et la complétude réelle du dossier
  const identityValidated = scoringSnapshot.chapterStates.identity.complete;
  const canAccessCertification = passportStudioState
    ? passportStudioState.state === 'ready' || passportStudioState.state === 'sealed'
    : scoringSnapshot.chapterStates.passport.ready;

  // Afficher le blocage du passeport sur place au lieu de renvoyer l'utilisateur en arrière.
  useEffect(() => {
    if (currentStep === 4 && !canAccessCertification) {
      setAiFeedback({
        visible: true,
        message: passportBlockerMessage,
        type: 'warning',
      });
      setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 6000);
    }
  }, [currentStep, canAccessCertification, passportBlockerMessage]);

  const getPotentialPoints = (itemId: string) => {
    if (['attestation_employeur', 'attestation_urssaf', 'bilan_n1', 'bilan_n2', 'avis_imposition'].includes(itemId)) return 15;
    if (['salaire', 'bourse', 'scolarite', 'domicile'].includes(itemId)) return 10;
    return 5;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium tracking-wide">Vérification du Sésame…</p>
        </motion.div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white/90 backdrop-blur-xl shadow-2xl rounded-3xl p-10 border border-slate-100 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-2xl flex items-center justify-center">
            <LockIcon className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Sésame introuvable</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Ce Sésame est expiré ou introuvable. Vérifiez le code auprès du propriétaire ou scannez à nouveau le QR Code.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Retour à l&apos;accueil
          </a>
        </motion.div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl w-full bg-white/90 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden border border-slate-100"
        >
          {/* Header émeraude avec cercles concentriques */}
          <div className="relative bg-emerald-900 p-8 text-center overflow-hidden">
            <svg className="absolute inset-0 w-full h-full opacity-[0.08]" viewBox="0 0 400 200">
              <circle cx="200" cy="100" r="180" fill="none" stroke="white" strokeWidth="0.5" />
              <circle cx="200" cy="100" r="140" fill="none" stroke="white" strokeWidth="0.5" />
              <circle cx="200" cy="100" r="100" fill="none" stroke="white" strokeWidth="0.5" />
              <circle cx="200" cy="100" r="60" fill="none" stroke="white" strokeWidth="0.5" />
            </svg>

            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

            <div className="relative z-10">
              <p className="text-amber-400 text-[11px] font-bold uppercase tracking-[0.3em] mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
                Candidature Sécurisée
              </p>
              <h1 className="text-white text-2xl md:text-3xl font-medium leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {property.address || property.name || 'Résidence'}
              </h1>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          </div>

          {/* Corps */}
          <div className="p-8 md:p-10">
            {/* Loyer */}
            {property.rentAmount && (
              <div className="text-center mb-6">
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Loyer charges comprises</p>
                <p className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {property.rentAmount.toLocaleString('fr-FR')} € <span className="text-base font-normal text-slate-400">CC / mois</span>
                </p>
              </div>
            )}

            {/* Séparateur */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-6" />

            {/* Paragraphe de rassurance */}
            <p className="text-slate-600 text-sm leading-relaxed text-center mb-8">
              Pour garantir un traitement équitable, le propriétaire utilise le protocole d&apos;audit IA <span className="font-semibold text-emerald-700">PatrimoTrust™</span>. Préparez votre pièce d&apos;identité et vos justificatifs de revenus.
            </p>

            {/* Badges de confiance */}
            <div className="flex items-center justify-center gap-4 md:gap-6 mb-8">
              {[
                { icon: '🔒', label: 'Chiffrement AES' },
                { icon: '👁️', label: 'Sans biais' },
                { icon: '⏱️', label: '3 minutes' },
              ].map((badge) => (
                <div key={badge.label} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                  <span className="text-sm">{badge.icon}</span>
                  <span className="text-[11px] font-medium text-slate-500">{badge.label}</span>
                </div>
              ))}
            </div>

            {/* Bouton CTA */}
            <motion.button
              type="button"
              onClick={() => setHasStarted(true)}
              whileHover={{ scale: 1.01, boxShadow: '0 20px 50px -12px rgba(15, 23, 42, 0.25)' }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-lg py-4 rounded-xl font-medium transition-all shadow-lg relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center justify-center gap-3">
                <ShieldCheckIcon className="w-5 h-5" />
                Démarrer mon Audit Sécurisé
              </span>
            </motion.button>

            {/* Mention de sécurité */}
            <p className="text-center text-[10px] text-slate-400 mt-4">
              🔒 Protocole conforme RGPD · Vos données sont chiffrées de bout en bout
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] antialiased text-slate-900 overflow-x-hidden">

      {/* AI Feedback Bubble */}
      <AIFeedbackBubble
        message={aiFeedback.message}
        type={aiFeedback.type}
        scoreIncrease={aiFeedback.scoreIncrease}
        visible={aiFeedback.visible}
      />

      {/* Onboarding Modal */}
      <OnboardingModal isOpen={showOnboarding} onClose={handleCloseOnboarding} />
      
      {/* Consistency Guardian Modal */}
      <ConsistencyGuardianModal
        isOpen={showConsistencyModal}
        onClose={() => {
          setShowConsistencyModal(false);
          setActiveInconsistency(null);
        }}
        inconsistency={activeInconsistency}
        onJustify={handleJustifyInconsistency}
        onReplace={handleReplaceInconsistentDocument}
      />

      <AnimatePresence>
        {isAnalyzingDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-3xl p-10 shadow-2xl flex flex-col items-center gap-6 max-w-sm mx-4"
            >
              <div className="relative w-16 h-16">
                <motion.div
                  className="absolute inset-0 rounded-full border-[3px] border-emerald-200"
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-emerald-500"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShieldCheckIcon className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <AnalysisRotatingMessage />
              <p className="text-xs text-slate-400 text-center">Veuillez patienter, ne fermez pas cette page.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Golden Seal Overlay */}
      <AnimatePresence>
        {showGoldenSeal.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="flex flex-col items-center gap-4 p-8 bg-white rounded-3xl shadow-2xl"
            >
              <div className="text-amber-500 seal-animation">
                <AwardIcon className="w-20 h-20" />
              </div>
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-amber-600 font-black mb-2">Certifié</p>
                <p className="font-serif-display text-xl text-[#0F172A]">{showGoldenSeal.label}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Crystal & Gold */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-xl z-50 border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Top Bar - Titre de Mission */}
          <div className="flex items-center justify-between h-14 border-b border-slate-100/50">
            <div className="flex items-center gap-4">
              <motion.div 
                className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"
                whileHover={{ scale: 1.05 }}
              >
                <span className="text-white text-lg">🛡️</span>
              </motion.div>
              <div>
                <span className="text-slate-400 text-[9px] font-bold tracking-[0.2em] uppercase block">Certification en cours</span>
                {property && (
                  <span className="text-slate-900 text-sm font-semibold truncate max-w-[280px] block" style={{ letterSpacing: '0.01em' }}>
                    {property.name || property.address || 'Résidence'}
                  </span>
                )}
              </div>
            </div>
            
            {/* Score Circulaire + Badge PatrimoTrust */}
            <div className="flex items-center gap-4">
              {/* Mini Score Circulaire - Style Crystal */}
              <motion.div 
                className="relative w-14 h-14 flex items-center justify-center bg-white rounded-full shadow-md border-2 border-amber-300/50"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                {/* Cercle de progression */}
                <svg className="absolute inset-0 w-14 h-14 -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="rgba(212, 175, 55, 0.15)"
                    strokeWidth="3"
                  />
                  <motion.circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke="url(#scoreGradientCrystal)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: score / 100 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{ strokeDasharray: '150.8', strokeDashoffset: 0 }}
                  />
                  <defs>
                    <linearGradient id="scoreGradientCrystal" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#D4AF37" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Score au centre */}
                <motion.span 
                  key={score}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-lg font-bold text-slate-800"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {score}
                </motion.span>
              </motion.div>
              
              {/* Badge PatrimoTrust */}
              <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
                <LockIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-[0.12em]">PatrimoTrust™</span>
              </div>
            </div>
          </div>
          
          {/* Bottom Bar - Navigation Steps Timeline */}
          <nav className="h-16 flex items-center">
            {/* Desktop: Full Timeline */}
            <div className="hidden lg:flex items-center justify-between w-full">
              {[
                { num: 'I', label: 'SCEAU D\'IDENTITÉ', step: 1, canAccess: true },
                { num: 'II', label: 'AUDIT DE SOLVABILITÉ', step: 2, canAccess: true },
                { num: 'III', label: 'BOUCLIER DE GARANTIE', step: 3, canAccess: canAccessGuarantee },
                { num: 'IV', label: 'PASSEPORT SOUVERAIN', step: 4, canAccess: canAccessCertification },
              ].map((item, index, arr) => {
                const isActive = currentStep === item.step;
                const isCompleted = currentStep > item.step || (item.step === 1 && diditStatus === 'verified');
                const isLocked = !item.canAccess;
                
                return (
                  <React.Fragment key={item.step}>
                    {/* Step Item */}
                    <motion.div
                      onClick={() => {
                        if (isLocked) {
                          setAiFeedback({
                            visible: true,
                            message: item.step === 3 
                              ? "Chapitre III disponible dès que l'identité est engagée."
                              : "Chapitre IV verrouillé : le passeport s'ouvre uniquement quand les chapitres réellement requis sont complets.",
                            type: 'warning',
                          });
                          setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
                          return;
                        }
                        setCurrentStep(item.step);
                      }}
                      className={`relative flex items-center gap-3 cursor-pointer group ${isLocked ? 'cursor-not-allowed' : ''}`}
                      whileHover={!isLocked ? { y: -2 } : {}}
                    >
                      {/* Point de la timeline */}
                      <div className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        isCompleted 
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/30' 
                          : isActive 
                          ? 'bg-white border-2 border-amber-400 ring-4 ring-amber-100 shadow-md' 
                          : isLocked
                          ? 'bg-slate-100 border border-slate-200'
                          : 'bg-white border-2 border-slate-200'
                      }`}>
                        {isCompleted ? (
                          <span className="text-white text-sm">🛡️</span>
                        ) : (
                          <span className={`text-xs font-bold ${
                            isActive ? 'text-amber-600' : isLocked ? 'text-slate-300' : 'text-slate-500'
                          }`}>
                            {item.num}
                          </span>
                        )}
                      </div>
                      
                      {/* Label */}
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-bold uppercase transition-all ${
                          isActive 
                            ? 'text-slate-900' 
                            : isCompleted 
                            ? 'text-emerald-700' 
                            : isLocked 
                            ? 'text-slate-300' 
                            : 'text-slate-400'
                        }`} style={{ letterSpacing: '0.05em' }}>
                          {item.label}
                        </span>
                        
                        {/* Underline animé pour étape active */}
                        {isActive && (
                          <motion.div
                            className="h-0.5 bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full mt-1"
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.5 }}
                          />
                        )}
                        
                        {isLocked && (
                          <span className="text-[8px] text-slate-300">Verrouillé</span>
                        )}
                      </div>
                    </motion.div>
                    
                    {/* Ligne de connexion */}
                    {index < arr.length - 1 && (
                      <div className="flex-1 mx-4 h-px relative">
                        <div className="absolute inset-0 bg-slate-200 rounded-full" />
                        <motion.div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full"
                          style={{ height: '2px', marginTop: '-0.5px' }}
                          initial={{ width: '0%' }}
                          animate={{ width: isCompleted ? '100%' : '0%' }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            
            {/* Mobile: Story-style progress bar + étape active */}
            <div className="flex lg:hidden flex-col w-full gap-2">
              {/* Barre de progression façon Story Instagram */}
              <div className="flex gap-1 w-full">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`story-progress-segment ${
                      step < currentStep ? 'completed' : step === currentStep ? 'active' : ''
                    }`}
                  />
                ))}
              </div>
              {/* Étape + Score compact */}
              <div className="flex items-center justify-between">
                <span className="text-slate-600 text-xs font-medium">
                  Étape {currentStep}/4 · {
                    currentStep === 1 ? 'Identité' : 
                    currentStep === 2 ? 'Solvabilité' : 
                    currentStep === 3 ? 'Garantie' : 
                    'Passeport'
                  }
                </span>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full border border-amber-200 shadow-sm">
                  <span className="text-slate-800 text-xs font-bold" style={{ fontFamily: 'Georgia, serif' }}>{score}</span>
                  <span className="text-slate-400 text-[9px]">pts</span>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-28 md:pt-32 pb-32 md:pb-20 px-4 md:px-6 min-h-[100dvh] md:min-h-screen">
        {/* Background - Image exacte comme HTML statique */}
        <div className="fixed inset-0 z-[-1] opacity-5">
          <img 
            src="https://images.unsplash.com/photo-1600607687940-467f4b566873?q=80&w=2000" 
            className="w-full h-full object-cover" 
            alt=""
          />
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-8">
          
          {/* Colonne principale */}
          <div className="glass-card rounded-none md:rounded-[2.5rem] p-4 md:p-12 border-0 md:border shadow-none md:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] overflow-hidden">
            
            {/* Step 1: Passerelle d'Identité Exclusive */}
            <div className={`step-page ${currentStep !== 1 ? 'hidden' : ''}`} id="step-1">
              <AnimatePresence mode="wait">
                {/* État initial ou en cours de vérification */}
                {diditStatus !== 'verified' && (
                  <motion.div
                    key="identity-gateway"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20, filter: 'blur(8px)' }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col items-center justify-center text-center py-8 space-y-8"
                  >
                    {/* Header */}
                    <div className="max-w-xl">
                      <p className="text-emerald-600 text-[10px] font-black uppercase tracking-[0.5em] mb-4">Chapitre I • Passerelle d'Identité</p>
                      <h1 className="text-4xl md:text-5xl font-serif text-[#0F172A] leading-tight mb-4">Votre identité, certifiée en 30 secondes.</h1>
                      <p className="text-slate-400 text-lg">Effort zéro. Sécurité maximale.</p>
                    </div>

                    {/* Bouclier Numérique Animé */}
                    <motion.div 
                      className="relative"
                      animate={{ 
                        scale: [1, 1.02, 1],
                      }}
                      transition={{ 
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      {/* Halo lumineux */}
                      <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-emerald-400/20 via-emerald-500/10 to-transparent blur-2xl animate-pulse" />
                      
                      {/* Cercles orbitaux */}
                      <motion.div
                        className="absolute inset-0 -m-12"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      >
                        <div className="absolute top-0 left-1/2 w-3 h-3 -ml-1.5 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50" />
                        <div className="absolute bottom-0 left-1/2 w-2 h-2 -ml-1 bg-emerald-300 rounded-full shadow-lg shadow-emerald-300/50" />
                      </motion.div>
                      
                      <motion.div
                        className="absolute inset-0 -m-16"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                      >
                        <div className="absolute top-1/2 right-0 w-2 h-2 -mt-1 bg-navy/60 rounded-full" />
                        <div className="absolute top-1/2 left-0 w-1.5 h-1.5 -mt-0.75 bg-navy/40 rounded-full" />
                      </motion.div>

                      {/* Bouclier principal */}
                      <div className="relative w-32 h-32 bg-gradient-to-br from-navy via-slate-800 to-navy rounded-3xl flex items-center justify-center shadow-2xl shadow-navy/40 border border-white/10">
                        <motion.div
                          animate={{ 
                            opacity: [0.5, 1, 0.5],
                            scale: [0.98, 1, 0.98],
                          }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <ShieldCheckIcon className="w-16 h-16 text-emerald-400" />
                        </motion.div>
                        
                        {/* Badge Didit */}
                        <div className="absolute -bottom-2 -right-2 bg-white rounded-xl px-2 py-1 shadow-lg border border-emerald-100">
                          <span className="text-[8px] font-black tracking-widest text-navy">DIDIT</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Widget Didit Iframe */}
                    {diditStatus === 'loading' && diditVerificationUrl && (
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="w-full max-w-2xl rounded-2xl border border-emerald-200 bg-white overflow-hidden shadow-xl"
                      >
                        <div className="p-4 bg-gradient-to-r from-emerald-50 to-white border-b border-emerald-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                              <ShieldCheckIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-navy text-sm">Vérification d'Identité Didit</h4>
                              <p className="text-xs text-slate-500">Complétez la vérification ci-dessous</p>
                            </div>
                          </div>
                        </div>
                        <iframe
                          src={diditVerificationUrl}
                          className="w-full border-0"
                          style={{ height: '550px', minHeight: '450px' }}
                          allow="camera; microphone"
                          title="Vérification Didit"
                        />
                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-400">Propulsé par Didit Protocol</span>
                          <a
                            href={diditVerificationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                          >
                            Ouvrir dans un nouvel onglet ↗
                          </a>
                        </div>
                      </motion.div>
                    )}

                    {/* Bouton Magistral - visible seulement si pas encore lancé */}
                    {diditStatus === 'idle' && (
                      <>
                        {/* Post-Onboarding Nudge - Bulle Expert PatrimoTrust */}
                        <AnimatePresence>
                          {showPostOnboardingNudge && (
                            <motion.div
                              initial={{ opacity: 0, y: 20, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -10, scale: 0.95 }}
                              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                              className="relative max-w-md mx-auto mb-4"
                            >
                              <div className="bg-gradient-to-br from-emerald-50 to-white border-2 border-emerald-200 rounded-2xl p-5 shadow-xl shadow-emerald-500/10">
                                {/* Header Expert */}
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <span className="text-white text-lg">🤖</span>
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Expert PatrimoTrust™</p>
                                    <p className="text-[10px] text-slate-400">L'instant décisif</p>
                                  </div>
                                  <button
                                    onClick={() => setShowPostOnboardingNudge(false)}
                                    className="ml-auto text-slate-400 hover:text-slate-600 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                
                                {/* Message Success Story */}
                                <p className="text-sm text-slate-700 leading-relaxed mb-3">
                                  C'est ici que tout commence. <span className="font-semibold text-emerald-700">Scellez votre identité</span> pour débloquer vos <span className="font-bold text-amber-600">40 premiers points</span> et rassurer le propriétaire dès la première seconde.
                                </p>
                                
                                {/* Réassurance de dernière seconde */}
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  <span>Chiffrement de grade bancaire • Zéro stockage de données sensibles</span>
                                </div>
                              </div>
                              
                              {/* Flèche pointant vers le bouton */}
                              <div className="flex justify-center mt-2">
                                <motion.div
                                  animate={{ y: [0, 5, 0] }}
                                  transition={{ repeat: Infinity, duration: 1.5 }}
                                  className="text-emerald-400"
                                >
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                  </svg>
                                </motion.div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {/* Bouton Didit avec pulsation */}
                        <div className="relative">
                          {/* Effet de pulsation dorée */}
                          {diditButtonPulse && (
                            <motion.div
                              className="absolute inset-0 rounded-2xl"
                              initial={{ opacity: 0.8, scale: 1 }}
                              animate={{ 
                                opacity: [0.8, 0, 0.8],
                                scale: [1, 1.15, 1],
                                boxShadow: [
                                  '0 0 0 0 rgba(245, 158, 11, 0.4)',
                                  '0 0 0 20px rgba(245, 158, 11, 0)',
                                  '0 0 0 0 rgba(245, 158, 11, 0.4)'
                                ]
                              }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(13, 148, 136, 0.2))' }}
                            />
                          )}
                          
                          <motion.button
                            type="button"
                            onClick={handleDiditVerification}
                            whileHover={{ scale: 1.02, boxShadow: "0 25px 60px -15px rgba(16, 185, 129, 0.4)" }}
                            whileTap={{ scale: 0.98 }}
                            className={`relative px-12 py-6 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-700 text-white rounded-2xl text-sm font-black tracking-[0.25em] uppercase shadow-2xl shadow-emerald-500/30 overflow-hidden group ${diditButtonPulse ? 'ring-2 ring-amber-400/50 ring-offset-2' : ''}`}
                          >
                            {/* Effet shimmer */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                            <span className="relative flex items-center gap-3">
                              <ShieldCheckIcon className="w-5 h-5" />
                              Vérifier mon identité avec Didit
                            </span>
                          </motion.button>
                        </div>
                        
                        {/* Social Proof - Success Story */}
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                          className="text-center text-xs text-slate-400 italic mt-2"
                        >
                          ✨ Déjà +1 200 dossiers certifiés cette semaine
                        </motion.p>
                        
                        {/* Bouton Info "Pourquoi Didit ?" */}
                        <div className="relative flex justify-center mt-3">
                          <button
                            onClick={() => setShowDiditTooltip(!showDiditTooltip)}
                            className="flex items-center gap-2 text-xs text-slate-500 hover:text-emerald-600 transition-colors py-2"
                          >
                            <span className="w-5 h-5 bg-slate-100 hover:bg-emerald-100 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors">i</span>
                            <span className="underline underline-offset-2 decoration-dashed">Pourquoi cette vérification biométrique ?</span>
                          </button>
                          
                          {/* Tooltip Pourquoi Didit */}
                          <AnimatePresence>
                            {showDiditTooltip && (
                              <WhyDiditTooltip isOpen={showDiditTooltip} onClose={() => setShowDiditTooltip(false)} />
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Copywriting de Réassurance */}
                        <div className="max-w-md bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                          <p className="text-sm text-slate-600 leading-relaxed">
                            <span className="font-bold text-navy">PatrimoTrust™</span> s'appuie sur la technologie <span className="font-bold text-emerald-600">Didit</span> pour certifier votre identité. <span className="font-semibold text-emerald-700">Zéro stockage de documents sensibles.</span> Certification souveraine instantanée.
                          </p>
                          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span className="font-bold uppercase tracking-wider">30 secondes</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <LockIcon className="w-4 h-4 text-navy" />
                              <span className="font-bold uppercase tracking-wider">Sécurité Militaire</span>
                            </div>
                          </div>
                          {/* Mention RGPD */}
                          <p className="mt-4 text-[10px] text-slate-400 text-center border-t border-slate-100 pt-3">
                            🔒 Protocole conforme RGPD : PatrimoTrust ne stocke pas votre pièce d'identité.
                          </p>
                        </div>

                        {/* Bouton secondaire - Continuer sans vérification */}
                        <div className="pb-48"> {/* Espace pour le popup */}
                          <SkipVerificationButton 
                            onSkip={() => setCurrentStep(2)} 
                            onUpload={() => document.getElementById('id-file-input')?.click()}
                            onScan={() => document.getElementById('id-camera-input')?.click()}
                          />
                        </div>
                        
                        {/* Input caché pour upload manuel */}
                        <input 
                          type="file" 
                          id="id-file-input" 
                          className="hidden" 
                          accept="image/*,application/pdf" 
                          multiple 
                          onChange={e => {
                            handleFileUpload('identity', e.target.files);
                            setCurrentStep(2);
                          }}
                        />
                        {/* Scanner natif (mobile) */}
                        <input 
                          type="file" 
                          id="id-camera-input" 
                          className="hidden" 
                          accept="image/*" 
                          capture="environment"
                          onChange={e => {
                            handleFileUpload('identity', e.target.files);
                            setCurrentStep(2);
                          }}
                        />
                      </>
                    )}

                    {/* État de chargement initial */}
                    {diditStatus === 'loading' && !diditVerificationUrl && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-4"
                      >
                        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-slate-500 font-medium">Création de votre session sécurisée...</p>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* État vérifié - Carte de profil pré-remplie */}
                {diditStatus === 'verified' && (
                  <motion.div
                    key="identity-verified"
                    initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center justify-center text-center py-8 space-y-8"
                  >
                    {/* Confettis visuels */}
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-600 flex items-center gap-2"
                    >
                      <span className="text-amber-500">✦</span>
                      Identité Certifiée
                      <span className="text-amber-500">✦</span>
                    </motion.div>

                    {/* Carte de profil élégante */}
                    <motion.div
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                      className="relative bg-gradient-to-br from-navy via-slate-800 to-navy rounded-[2rem] p-8 shadow-2xl shadow-navy/40 border border-white/10 min-w-[320px]"
                    >
                      {/* Badge vérifié */}
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5">
                        <ShieldCheckIcon className="w-3.5 h-3.5" />
                        Didit Verified
                      </div>

                      {/* Avatar placeholder */}
                      <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl">
                        <span className="text-3xl font-serif text-white">
                          {(formData.firstName || diditIdentity?.firstName || 'V').charAt(0).toUpperCase()}{(formData.lastName || diditIdentity?.lastName || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>

                      {/* Nom complet - Editable si données manquantes */}
                      {(!formData.firstName && !diditIdentity?.firstName) || (!formData.lastName && !diditIdentity?.lastName) ? (
                        <div className="space-y-2 mb-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              autoComplete="given-name"
                              placeholder="Prénom"
                              value={formData.firstName}
                              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                              className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-center text-[16px] md:text-lg font-serif focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                            <input
                              type="text"
                              autoComplete="family-name"
                              placeholder="Nom"
                              value={formData.lastName}
                              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                              className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 text-center text-[16px] md:text-lg font-serif focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                          </div>
                          <p className="text-[10px] text-white/60 text-center">Complétez votre identité pour personnaliser votre passeport</p>
                        </div>
                      ) : (
                        <h2 className="text-2xl font-serif text-white mb-1">
                          {formData.firstName || diditIdentity?.firstName} {formData.lastName || diditIdentity?.lastName}
                        </h2>
                      )}
                      
                      {/* Date de naissance */}
                      {(formData.birthDate || diditIdentity?.birthDate) && (
                        <p className="text-slate-400 text-sm mb-4">
                          Né(e) le {new Date(formData.birthDate || diditIdentity?.birthDate || '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}

                      {/* Badges */}
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                          Human Verified
                        </span>
                        <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-[9px] font-bold text-amber-400 uppercase tracking-widest">
                          Score A+
                        </span>
                      </div>
                    </motion.div>

                    {/* Étape Coordonnées de Contact */}
                    {!accountCreated ? (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="w-full max-w-md"
                      >
                        {/* Message Expert */}
                        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-2xl p-5 mb-6">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-lg">🧠</span>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">Expert PatrimoTrust</p>
                              <p className="text-slate-700 text-sm leading-relaxed">
                                Excellent début, <strong>{formData.firstName || diditIdentity?.firstName || 'Locataire'}</strong>. Votre identité est scellée. Indiquez votre téléphone pour que le propriétaire puisse vous joindre facilement après l&apos;audit de votre dossier.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Formulaire Coordonnées */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
                          <h3 className="text-lg font-bold text-navy mb-4 flex items-center gap-2">
                            <span className="text-xl">📱</span>
                            Coordonnées de contact
                          </h3>

                          <div className="space-y-4">
                            {/* Téléphone */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                Téléphone <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                value={contactPhone}
                                onChange={(e) => setContactPhone(e.target.value)}
                                placeholder="06 12 34 56 78"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-slate-800 text-[16px]"
                              />
                              <p className="text-xs text-slate-400 mt-1">Format français accepté</p>
                            </div>

                            {/* Email */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                Email <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                value={contactEmail || formData.email || ''}
                                onChange={(e) => setContactEmail(e.target.value)}
                                placeholder="votre@email.com"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-slate-800 text-[16px]"
                              />
                            </div>
                          </div>

                          {/* Bouton Continuer */}
                          <button
                            onClick={async () => {
                              if (!contactPhone || (!contactEmail && !formData.email)) {
                                setAiFeedback({
                                  visible: true,
                                  message: '❌ Veuillez renseigner votre téléphone et email',
                                  type: 'error',
                                });
                                setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 4000);
                                return;
                              }

                              setIsCreatingAccount(true);
                              try {
                                const result = await createTenantAccount(token, {
                                  email: contactEmail || formData.email,
                                  phone: contactPhone,
                                  firstName: formData.firstName || diditIdentity?.firstName,
                                  lastName: formData.lastName || diditIdentity?.lastName,
                                }, diditIdentity || undefined);

                                if (result.success) {
                                  setAccountCreated(true);
                                  setFormData(prev => ({ ...prev, phone: contactPhone, email: contactEmail || prev.email }));
                                  
                                  setAiFeedback({
                                    visible: true,
                                    message: result.magicLinkSent 
                                      ? '✅ Parfait ! Un email de confirmation vous a été envoyé. Vous pouvez revenir à votre dossier à tout moment.'
                                      : '✅ Coordonnées enregistrées !',
                                    type: 'success',
                                    scoreIncrease: 5,
                                  });
                                  setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
                                  
                                  // Transition automatique vers l'étape 2 après 2 secondes
                                  setTimeout(() => {
                                    setCurrentStep(2);
                                  }, 2000);
                                } else {
                                  setAiFeedback({
                                    visible: true,
                                    message: `❌ ${result.error || 'Erreur lors de la création du compte'}`,
                                    type: 'error',
                                  });
                                  setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
                                }
                              } catch (error) {
                                console.error('Erreur création compte:', error);
                                setAiFeedback({
                                  visible: true,
                                  message: '❌ Erreur technique. Veuillez réessayer.',
                                  type: 'error',
                                });
                                setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
                              } finally {
                                setIsCreatingAccount(false);
                              }
                            }}
                            disabled={isCreatingAccount || !contactPhone}
                            className="w-full mt-6 px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-bold uppercase tracking-wider shadow-xl hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                          >
                            {isCreatingAccount ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Création du compte...</span>
                              </>
                            ) : (
                              <>
                                <span>Continuer</span>
                                <ArrowRightIcon className="w-4 h-4" />
                              </>
                            )}
                          </button>

                          <p className="text-xs text-slate-400 text-center mt-4">
                            🔒 Vos coordonnées sont sécurisées et uniquement partagées avec le propriétaire après validation
                          </p>
                        </div>
                      </motion.div>
                    ) : (
                      <>
                        {/* Message de succès et transition */}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center"
                        >
                          <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckCircleIcon className="w-7 h-7 text-white" />
                          </div>
                          <p className="text-emerald-800 font-medium">Coordonnées enregistrées !</p>
                          <p className="text-emerald-600 text-sm mt-1">Redirection vers le Chapitre II...</p>
                        </motion.div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Step 2: Ressources */}
            <div className={`step-page hidden space-y-10 ${currentStep === 2 ? '' : 'hidden'}`} id="step-2" style={{ display: currentStep === 2 ? 'block' : 'none' }}>
                  <div className="max-w-2xl">
                    <p className="text-emerald-600 text-[10px] font-black uppercase tracking-[0.5em] mb-4">Chapitre II</p>
                    <h1 className="text-5xl font-serif text-[#0F172A] leading-tight mb-4">Revenus & Statut</h1>
                    <p className="text-slate-400 text-lg italic">Structurez vos preuves d&apos;activité et vos revenus en toute conformité.</p>
                  </div>

                {/* Profiling administratif */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Profil administratif</p>
                      <h3 className="text-lg font-serif text-navy">Quel est votre statut ?</h3>
                      <p className="text-sm text-slate-500 mt-1">La checklist s&apos;adapte automatiquement (attestation employeur &lt; 1 mois, bilans, bourse, etc.).</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                    {[
                      { id: 'Salarie', label: 'Salarié', detail: 'Attestation employeur (< 1 mois) requise' },
                      { id: 'Independant', label: 'Indépendant', detail: '2 derniers bilans ou attestations fiscales certifiées' },
                      { id: 'Etudiant', label: 'Étudiant', detail: 'Certificat de scolarité + avis de bourse' },
                      { id: 'Retraite', label: 'Retraité', detail: 'Justificatifs de retraite + avis d’imposition' },
                    ].map(option => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setCandidateStatus(option.id as CandidateStatus);
                          setFormData(prev => ({ ...prev, status: option.id as CandidateStatus }));
                        }}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          candidateStatus === option.id
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-navy">{option.label}</p>
                        <p className="text-xs text-slate-500 mt-1">{option.detail}</p>
                      </button>
                    ))}
                  </div>
                </div>

                  {/* Zone de dépôt intelligent */}
                  <div 
                    className="relative group border-2 border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white rounded-xl md:rounded-[2.5rem] p-8 md:p-16 flex flex-col items-center justify-center transition-all hover:border-emerald-400 cursor-pointer overflow-hidden"
                    onClick={() => document.getElementById('resources-file-input')?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      handleFileUpload('resources', e.dataTransfer.files);
                    }}
                  >
                    {isScanning && <div className="scanner-line" />}
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center shadow-xl mb-4 md:mb-5 group-hover:scale-110 transition-transform">
                      <SparklesIcon className="text-emerald-500 w-7 h-7 md:w-9 md:h-9" />
                    </div>
                    <h3 className="text-lg md:text-xl font-serif-display text-[#0F172A] mb-2">Dépôt Intelligent IA</h3>
                    <p className="text-center text-slate-500 max-w-sm text-sm hidden md:block">Glissez tous vos justificatifs en vrac. Notre IA trie et certifie chaque document automatiquement.</p>
                    <p className="text-center text-slate-500 text-sm md:hidden">Déposez ou scannez vos justificatifs.</p>
                    <input 
                      type="file" 
                      id="resources-file-input" 
                      className="hidden" 
                      accept="image/*,application/pdf" 
                      multiple 
                      onChange={e => handleFileUpload('resources', e.target.files)}
                    />
                  </div>

                  {/* Scanner natif (mobile) */}
                  <button
                    type="button"
                    className="md:hidden w-full flex items-center justify-center gap-3 py-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-semibold text-sm active:bg-emerald-100 transition-colors"
                    onClick={() => document.getElementById('resources-camera-input')?.click()}
                  >
                    <span className="text-lg">📸</span>
                    Scanner le document
                  </button>
                  <input 
                    type="file" 
                    id="resources-camera-input" 
                    className="hidden" 
                    accept="image/*" 
                    capture="environment"
                    onChange={e => handleFileUpload('resources', e.target.files)}
                  />

                  {/* Bulle Expert IA */}
                  <div className="flex items-center gap-3 bg-white/80 border border-amber-100 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="w-10 h-10 rounded-xl patrimo-gradient flex items-center justify-center text-white pulse-gold">
                      <SparklesIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Expert PatrimoTrust</p>
                      <p className="text-sm text-slate-600">{expertBubbleMessage}</p>
                    </div>
                  </div>

                  {/* Progression d'analyse */}
                  {isAnalyzingDoc && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span>Analyse IA en cours...</span>
                        <span>PatrimoTrust™</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: '10%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                          className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* Check & Upload */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Documents certifiés */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold tracking-widest uppercase text-slate-500">Documents certifiés</h3>
                        <span className="text-[10px] font-bold text-slate-600">
                          <span className="text-emerald-600">{certifiedResources.length} validé(s)</span>
                          {' • '}
                          <span className="text-red-600">{invalidatedResources.length} invalidé(s)</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">
                        Les documents validés ou invalidés apparaissent ici après analyse.
                      </p>
                      {reviewedResources.length === 0 ? (
                        <p className="text-xs text-slate-400">Aucun document analysé pour le moment.</p>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          <div className="space-y-3">
                            {reviewedResources.map(file => (
                              <DocumentCard
                                key={file.id}
                                file={file}
                                onDelete={handleDeleteDocument}
                                onForceValidate={handleForceValidate}
                                isDeleting={deletingFileId === file.id}
                              />
                            ))}
                          </div>
                        </AnimatePresence>
                      )}
                    </div>

                    {/* Pièces manquantes */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold tracking-widest uppercase text-slate-500">Pièces manquantes</h3>
                        <span className="text-[10px] font-bold text-amber-600">{missingResourceDocs.length} restante(s)</span>
                      </div>
                      {missingResourceDocs.length === 0 ? (
                        <p className="text-xs text-emerald-600">Tout est prêt pour ce chapitre.</p>
                      ) : (
                        <AnimatePresence>
                          {missingResourceDocs.map(item => (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 6 }}
                              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 mb-3"
                            >
                              <div
                                className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400"
                                title={item.description}
                                aria-label={item.description}
                              >
                                <InfoIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-600 truncate">{item.label}</p>
                                <p className="text-[10px] text-slate-400">{item.description}</p>
                              </div>
                              <span
                                title={item.description}
                                className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"
                              >
                                +{getPotentialPoints(item.id)} pts
                              </span>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>

                  {incomeCrossCheck && (
                    <div className={`rounded-xl border px-4 py-3 text-sm ${
                      incomeCrossCheck.status === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                      {incomeCrossCheck.message}
                    </div>
                  )}
                </div>

            {/* Step 3: Garantie */}
            <div className={`step-page hidden space-y-10 ${currentStep === 3 ? '' : 'hidden'}`} id="step-3" style={{ display: currentStep === 3 ? 'block' : 'none' }}>
                  {!canAccessGuarantee && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-800">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Chapitre verrouillé</p>
                      <p className="text-sm">Commencez par engager l&apos;identité du locataire pour ouvrir la garantie.</p>
                    </div>
                  )}
                  <div className={`space-y-10 ${!canAccessGuarantee ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="max-w-2xl">
                      <p className="text-emerald-600 text-[10px] font-black uppercase tracking-[0.5em] mb-4">Chapitre III</p>
                      <h1 className="text-5xl font-serif text-[#0F172A] leading-tight mb-4">Garantie Souveraine</h1>
                      <p className="text-slate-400 text-lg">Choisissez <strong className="text-navy">sans garant</strong>, une <strong className="text-emerald-600">Visale</strong> ou jusqu&apos;à <strong className="text-navy">2 garants physiques</strong>. Le bloc Garantie est plafonné à <strong>30 points</strong> et suit la même logique documentaire que le locataire.</p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                      {[
                        {
                          mode: 'NONE',
                          title: 'Sans garant',
                          subtitle: 'Aucun tiers engagé',
                          description: 'Continuez sans garantie complémentaire. Le moteur vous dira si elle reste optionnelle, recommandée ou requise.',
                        },
                        {
                          mode: 'VISALE',
                          title: 'Visale',
                          subtitle: 'Garantie Action Logement',
                          description: 'Un certificat Visale certifié et compatible couvre tout le bloc Garantie.',
                        },
                        {
                          mode: 'PHYSICAL',
                          title: '1 garant physique',
                          subtitle: 'Parcours miroir du locataire',
                          description: 'Identité, revenus, activité et domicile sont évalués sur 30 points.',
                        },
                        {
                          mode: 'PHYSICAL_2',
                          title: '2 garants physiques',
                          subtitle: 'Agrégation plafonnée',
                          description: 'Le meilleur sous-bloc de chaque garant est retenu, sans dépasser 30 points.',
                        },
                      ].map(option => {
                        const isActive =
                          option.mode === 'NONE'
                            ? guaranteeMode === 'NONE'
                            : option.mode === 'VISALE'
                            ? guaranteeMode === 'VISALE'
                            : guaranteeMode === 'PHYSICAL' && guarantorSlotsCount === (option.mode === 'PHYSICAL_2' ? 2 : 1);

                        return (
                          <button
                            key={option.mode}
                            type="button"
                            onClick={() => {
                              if (option.mode === 'NONE') {
                                setGuaranteeMode('NONE');
                                setGuarantorSlotsCount(1);
                                setGuarantorDiditVerificationUrl(null);
                                setGuarantorDirectCertification(false);
                              } else if (option.mode === 'VISALE') {
                                setGuaranteeMode('VISALE');
                                setGuarantorDiditVerificationUrl(null);
                                setGuarantorDirectCertification(false);
                              } else {
                                setGuaranteeMode('PHYSICAL');
                                setGuarantorSlotsCount(option.mode === 'PHYSICAL_2' ? 2 : 1);
                              }
                            }}
                            className={`text-left rounded-2xl border p-5 transition-all ${
                              isActive ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-300'
                            }`}
                          >
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{option.subtitle}</p>
                            <h3 className="text-lg font-serif text-navy mt-2">{option.title}</h3>
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{option.description}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Score garantie</p>
                        <p className="text-2xl font-semibold text-navy mt-1">{scoringSnapshot.breakdown.guarantee?.total || 0}/30</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exigence</p>
                        <p className="text-sm font-semibold text-navy mt-2">
                          {guaranteeRequirement === 'required' ? 'Garantie requise' : guaranteeRequirement === 'recommended' ? 'Garantie recommandée' : 'Garantie optionnelle'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Etat du chapitre</p>
                        <p className="text-sm font-semibold text-navy mt-2">
                          {scoringSnapshot.chapterStates.guarantee.satisfied ? 'Cohérent avec le dossier' : 'Action attendue'}
                        </p>
                      </div>
                    </div>

                    {guaranteeMode === 'NONE' && (
                      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
                        <p className="text-sm text-slate-600">
                          Vous pouvez continuer sans garant. Le moteur vérifiera si ce choix reste cohérent avec votre dossier, ou si une garantie devient recommandée ou requise selon vos revenus et le loyer.
                        </p>
                      </div>
                    )}

                  {guaranteeMode === 'VISALE' && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Parcours Visale</p>
                          <h3 className="text-xl font-serif text-navy mt-2">Déposez votre certificat Visale</h3>
                          <p className="text-sm text-slate-500 mt-2">Une Visale certifiée et compatible avec le loyer peut remplir à elle seule le bloc Garantie.</p>
                        </div>

                        <div
                          className="p-6 border-2 border-dashed border-emerald-200 rounded-2xl bg-emerald-50/40 hover:border-emerald-400 transition-all cursor-pointer"
                          onClick={() => document.getElementById('visale-file-input')?.click()}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h4 className="font-semibold text-navy">Certificat Visale</h4>
                              <p className="text-sm text-slate-500 mt-1">PDF natif recommandé pour conserver le sceau numérique et le plafond de loyer garanti.</p>
                            </div>
                            <div className="px-4 py-2 rounded-xl border border-emerald-300 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                              Déposer
                            </div>
                          </div>
                          <input
                            type="file"
                            id="visale-file-input"
                            className="hidden"
                            accept="image/*,application/pdf"
                            multiple
                            onChange={e => handleFileUpload('resources', e.target.files, { subjectType: 'visale' })}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut</p>
                            <p className="text-sm font-semibold text-navy mt-2">
                              {scoringSnapshot.guarantee?.visale?.certified ? 'Visale certifiée' : visaleFiles.length > 0 ? 'Analyse en cours' : 'En attente'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compatibilité loyer</p>
                            <p className="text-sm font-semibold text-navy mt-2">
                              {scoringSnapshot.guarantee?.visale?.compatibleWithRent ? 'Compatible' : visaleFiles.length > 0 ? 'À confirmer' : 'Non vérifiée'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sous-score</p>
                            <p className="text-sm font-semibold text-navy mt-2">{scoringSnapshot.breakdown.guarantee?.total || 0}/30</p>
                          </div>
                        </div>
                      </div>

                      {visaleFiles.length > 0 && (
                        <div className="space-y-3">
                          <AnimatePresence mode="popLayout">
                            {visaleFiles.map(file => (
                              <DocumentCard
                                key={file.id}
                                file={file}
                                showAmount={false}
                                onDelete={handleDeleteDocument}
                                onForceValidate={handleForceValidate}
                                isDeleting={deletingFileId === file.id}
                              />
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  )}

                  {guaranteeMode === 'PHYSICAL' && guarantorIdentityMismatch && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-amber-900">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Incohérence détectée</p>
                      <p className="text-sm">Le nom sur la CNI du garant ne correspond pas au nom sur l'avis d'imposition. Le score du bloc Garant est bloqué à 0 jusqu'à correction.</p>
                    </div>
                  )}

                  {/* Votre Bouclier de Garantie – visible quand garant certifié ou documents garant certifiés */}
                  {guaranteeMode === 'PHYSICAL' && (guarantorCertified || uploadedFiles.guarantor.some(f => f.status === 'CERTIFIED')) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-br from-emerald-50/80 to-slate-50 border-2 border-emerald-200 rounded-2xl p-6 shadow-sm"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                          <ShieldCheckIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-serif text-navy">Votre Bouclier de Garantie</h3>
                          <p className="text-sm text-emerald-700 font-medium flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Certifié par Audit PatrimoTrust
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {certifiedItems.has('garant_id') && (
                          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
                            Identité Auditée
                          </span>
                        )}
                        {certifiedItems.has('garant_salaires') && (
                          <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold uppercase tracking-wider">
                            Revenus Certifiés
                          </span>
                        )}
                        {uploadedFiles.guarantor.some(f => {
                          const haystack = normalizeValue(`${f.aiAnalysis?.documentType || ''} ${f.type || ''} ${f.name || ''}`);
                          return haystack.includes('avis') && haystack.includes('imposition') && f.status === 'CERTIFIED';
                        }) && (
                          <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider">
                            Fiscalité Validée
                          </span>
                        )}
                      </div>
                      <div className="bg-white/90 rounded-xl p-4 border border-emerald-100">
                        <p className="text-slate-700 text-sm leading-relaxed">
                          {formData.firstName || diditIdentity?.firstName || 'Votre dossier'}, l'identité et les revenus de votre garant ont été passés au scanner de sécurité. Son profil est désormais certifié conforme. L'intégrité documentaire de votre garant a été vérifiée à 100%. Ce document est désormais scellé numériquement pour le propriétaire.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {guaranteeMode === 'PHYSICAL' ? (
                    <>
                      {/* Garant certifié */}
                      {guarantorCertified && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`bg-gradient-to-br ${guarantorCertificationMethod === 'DIDIT' ? 'from-emerald-50 to-emerald-100 border-emerald-300' : 'from-blue-50 to-blue-100 border-blue-300'} border-2 rounded-2xl p-8`}
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`w-16 h-16 ${guarantorCertificationMethod === 'DIDIT' ? 'bg-emerald-500' : 'bg-blue-500'} rounded-full flex items-center justify-center`}>
                              <ShieldCheckIcon className="w-8 h-8 text-white" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-serif text-navy mb-1">
                                {guarantorCertificationMethod === 'DIDIT' ? 'Identité Souveraine Certifiée' : 'Identité Auditée & Cohérente'}
                              </h3>
                              <p className={`${guarantorCertificationMethod === 'DIDIT' ? 'text-emerald-700' : 'text-blue-700'} text-sm`}>
                                {guarantorFirstName} {guarantorLastName} ({guarantorEmail})
                              </p>
                            </div>
                          </div>
                          <div className={`bg-white/80 rounded-xl p-4 border ${guarantorCertificationMethod === 'DIDIT' ? 'border-emerald-200' : 'border-blue-200'}`}>
                            <p className={`${guarantorCertificationMethod === 'DIDIT' ? 'text-emerald-800' : 'text-blue-800'} font-medium text-sm`}>
                              {guarantorCertificationMethod === 'DIDIT'
                                ? '✅ Le garant 1 a certifié son identité via Didit. Vous pouvez maintenant déposer ses revenus, son activité et son domicile dans les blocs ci-dessous.'
                                : '📋 Le garant 1 a passé l’audit documentaire PatrimoTrust. Les zones d’upload restent disponibles ci-dessous pour compléter son sous-score.'
                              }
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* Formulaire d'ajout de garant */}
                      <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-xl font-serif text-navy">Garant physique 1</h3>
                            <p className="text-sm text-slate-500 mt-1">Le garant suit la même logique documentaire que le locataire.</p>
                          </div>
                          <div className="min-w-[220px]">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Profil du garant</label>
                            <select
                              value={guarantorProfile}
                              onChange={e => setGuarantorProfile(e.target.value as CandidateStatus)}
                              className="mt-2 w-full p-3 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                            >
                              {SUPPORTED_PROFILES.map((profile: string) => (
                                <option key={profile} value={profile}>{profile}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Prénom</label>
                            <input 
                              type="text" 
                              autoComplete="given-name"
                              value={guarantorFirstName}
                              onChange={e => setGuarantorFirstName(e.target.value)}
                              placeholder="Prénom" 
                              className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-[16px] md:text-lg font-light"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nom</label>
                            <input 
                              type="text" 
                              autoComplete="family-name"
                              value={guarantorLastName}
                              onChange={e => setGuarantorLastName(e.target.value)}
                              placeholder="Nom" 
                              className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-[16px] md:text-lg font-light"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email du garant *</label>
                          <input 
                            type="email" 
                            inputMode="email"
                            autoComplete="email"
                            value={guarantorEmail}
                            onChange={e => setGuarantorEmail(e.target.value)}
                            placeholder="email@exemple.com" 
                            className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-[16px] md:text-lg font-light"
                            required
                          />
                        </div>

                        {guarantorCertified ? (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                            <p className="text-sm text-emerald-800">
                              L&apos;identité du garant 1 est déjà validée. Vous pouvez encore déposer ses documents de revenus, activité, fiscalité et domicile juste en dessous.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Options */}
                            <div className="flex flex-col gap-4 pt-4 border-t border-slate-200">
                              {/* Option 1: Envoyer invitation */}
                              <button
                                onClick={async () => {
                                  if (!guarantorEmail || !token) return;
                                  try {
                                    const { sendGuarantorInvitation } = await import('@/app/actions/send-guarantor-invitation');
                                    const result = await sendGuarantorInvitation(
                                      token,
                                      guarantorEmail,
                                      guarantorFirstName,
                                      guarantorLastName,
                                      {
                                        firstName: formData.firstName || diditIdentity?.firstName,
                                        lastName: formData.lastName || diditIdentity?.lastName,
                                        email: formData.email
                                      }
                                    );
                                    if (result.success) {
                                      setGuarantorInvitationSent(true);
                                      setAiFeedback({
                                        visible: true,
                                        message: `✅ Invitation envoyée à ${guarantorEmail}. Le garant recevra un email avec un lien de certification.`,
                                        type: 'success',
                                      });
                                      setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
                                    } else {
                                      setAiFeedback({
                                        visible: true,
                                        message: `❌ Erreur: ${result.error}`,
                                        type: 'error',
                                      });
                                      setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
                                    }
                                  } catch (error) {
                                    console.error('Erreur envoi invitation:', error);
                                  }
                                }}
                                disabled={!guarantorEmail || guarantorInvitationSent}
                                className="w-full px-8 py-4 bg-navy text-white rounded-2xl text-sm font-bold tracking-[0.2em] uppercase shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                              >
                                {guarantorInvitationSent ? (
                                  <>
                                    <CheckCircleIcon className="w-5 h-5" />
                                    <span>Invitation envoyée</span>
                                  </>
                                ) : (
                                  <>
                                    <UsersIcon className="w-5 h-5" />
                                    <span>Envoyer l'invitation par email</span>
                                  </>
                                )}
                              </button>

                              {/* Option 2: En Direct */}
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl blur-xl" />
                                <button
                                  onClick={async () => {
                                    if (!guarantorEmail || !token) return;
                                    setGuarantorDirectCertification(true);
                                    try {
                                      // Créer une session Didit pour le garant (option "En Direct")
                                      const response = await fetch('/api/guarantor/create-session', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          candidatureId: token,
                                          slot: 1,
                                          email: guarantorEmail,
                                          firstName: guarantorFirstName,
                                          lastName: guarantorLastName,
                                        }),
                                      });

                                      if (response.ok) {
                                        const data = await response.json();
                                        setGuarantorDiditSessionId(data.sessionId);
                                        setGuarantorDiditVerificationUrl(data.verificationUrl);
                                        // L'iframe s'affichera automatiquement via le state
                                      } else {
                                        const errorData = await response.json().catch(() => ({}));
                                        setAiFeedback({
                                          visible: true,
                                          message: `❌ Erreur: ${errorData.error || 'Impossible de créer la session Didit'}`,
                                          type: 'error',
                                        });
                                        setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
                                        setGuarantorDirectCertification(false);
                                      }
                                    } catch (error) {
                                      console.error('Erreur certification directe:', error);
                                      setAiFeedback({
                                        visible: true,
                                        message: '❌ Erreur lors de la certification directe',
                                        type: 'error',
                                      });
                                      setTimeout(() => setAiFeedback(prev => ({ ...prev, visible: false })), 5000);
                                      setGuarantorDirectCertification(false);
                                    }
                                  }}
                                  disabled={!guarantorEmail || guarantorDirectCertification}
                                  className="relative w-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl text-sm font-bold tracking-[0.2em] uppercase shadow-xl hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                >
                                  {guarantorDirectCertification ? (
                                    <>
                                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      <span>Certification en cours...</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheckIcon className="w-5 h-5" />
                                      <span>Le garant est avec moi : Certifier immédiatement</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Iframe Didit pour le garant (option En Direct) */}
                            {guarantorDiditVerificationUrl && (
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl border-2 border-emerald-300 overflow-hidden shadow-xl"
                              >
                                <div className="p-4 bg-gradient-to-r from-emerald-50 to-blue-50 border-b border-emerald-200">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                                      <ShieldCheckIcon className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                      <h3 className="font-bold text-navy">Certification Garant en cours</h3>
                                      <p className="text-xs text-slate-600">Le garant doit compléter la vérification ci-dessous</p>
                                    </div>
                                  </div>
                                </div>
                                <iframe
                                  src={guarantorDiditVerificationUrl}
                                  className="w-full border-0"
                                  style={{ height: '550px', minHeight: '450px' }}
                                  allow="camera; microphone"
                                  title="Vérification Didit Garant"
                                />
                              </motion.div>
                            )}

                            {guarantorInvitationSent && (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                <p className="text-emerald-800 text-sm">
                                  ✅ Un email a été envoyé à <strong>{guarantorEmail}</strong>. Le garant pourra certifier son identité en cliquant sur le lien dans l&apos;email.
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {slotOneGuarantorBlocks.map(block => (
                          <button
                            key={`slot-1-${block.id}`}
                            type="button"
                            onClick={() => document.getElementById(getGuarantorUploadInputId(1))?.click()}
                            className={`text-left rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${getGuarantorBlockStatusClasses(block.status)}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest">Garant 1</p>
                                <h4 className="mt-2 text-sm font-semibold text-navy">{block.label}</h4>
                              </div>
                              <span className="rounded-full border border-current/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest">
                                {getGuarantorBlockStatusLabel(block.status)}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-slate-600">{block.description}</p>
                          </button>
                        ))}
                      </div>

                      {/* Zone upload garant (optionnel - documents classiques) */}
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                        <p className="text-slate-600 text-sm mb-4">
                          <strong>Dépôt documentaire du garant 1 :</strong> déposez chaque pièce dans le bloc correspondant ci-dessus ou utilisez l’espace global ci-dessous.
                        </p>
                        <div 
                          className="p-4 md:p-8 border-2 border-dashed border-slate-300 rounded-xl md:rounded-[2rem] bg-white flex flex-col md:flex-row items-center justify-between gap-4 group hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer"
                          onClick={() => document.getElementById(getGuarantorUploadInputId(1))?.click()}
                        >
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-50 group-hover:scale-110 transition-transform">
                              <UsersIcon className="text-slate-400 group-hover:text-emerald-500 w-7 h-7" />
                            </div>
                            <div>
                              <h3 className="font-bold text-[#0F172A]">Documents du garant 1</h3>
                              <p className="text-sm text-slate-400 uppercase text-[10px] font-bold mt-1">ID, domicile, revenus, activité, fiscalité</p>
                            </div>
                          </div>
                          <div className="px-5 py-2.5 border border-slate-200 rounded-xl text-[10px] font-black tracking-widest uppercase group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all">Télécharger</div>
                          <input 
                            type="file" 
                            id="guarantor-file-input" 
                            className="hidden" 
                            accept="image/*,application/pdf" 
                            multiple 
                            onChange={e => handleFileUpload('guarantor', e.target.files, { subjectType: 'guarantor', subjectSlot: 1 })}
                          />
                          <input 
                            type="file" 
                            id="guarantor-camera-input" 
                            className="hidden" 
                            accept="image/*" 
                            capture="environment"
                            onChange={e => handleFileUpload('guarantor', e.target.files, { subjectType: 'guarantor', subjectSlot: 1 })}
                          />
                        </div>
                        {/* Scanner natif garant (mobile) */}
                        <button
                          type="button"
                          className="md:hidden w-full flex items-center justify-center gap-3 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-semibold text-sm active:bg-emerald-100 transition-colors mt-3"
                          onClick={() => document.getElementById('guarantor-camera-input')?.click()}
                        >
                          <span className="text-lg">📸</span>
                          Scanner un document garant
                        </button>
                      </div>

                      {/* Fichiers uploadés avec DocumentCard */}
                      {slotOneGuarantorFiles.length > 0 && (
                        <div className="space-y-3">
                          <AnimatePresence mode="popLayout">
                            {slotOneGuarantorFiles.map(file => (
                              <DocumentCard 
                                key={file.id} 
                                file={file} 
                                showAmount={false}
                                onDelete={handleDeleteDocument}
                                onForceValidate={handleForceValidate}
                                isDeleting={deletingFileId === file.id}
                              />
                            ))}
                          </AnimatePresence>
                        </div>
                      )}

                      {guarantorSlotsCount === 2 && (
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-xl font-serif text-navy">Garant physique 2</h3>
                              <p className="text-sm text-slate-500 mt-1">Ce second garant complète le premier. Le meilleur sous-bloc par thème est retenu.</p>
                            </div>
                            <div className="min-w-[220px]">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Profil du garant 2</label>
                              <select
                                value={secondGuarantor.profile}
                                onChange={e => setSecondGuarantor(prev => ({ ...prev, profile: e.target.value as CandidateStatus }))}
                                className="mt-2 w-full p-3 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                              >
                                {SUPPORTED_PROFILES.map((profile: string) => (
                                  <option key={profile} value={profile}>{profile}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input
                              type="text"
                              value={secondGuarantor.firstName}
                              onChange={e => setSecondGuarantor(prev => ({ ...prev, firstName: e.target.value }))}
                              placeholder="Prénom"
                              className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-[16px]"
                            />
                            <input
                              type="text"
                              value={secondGuarantor.lastName}
                              onChange={e => setSecondGuarantor(prev => ({ ...prev, lastName: e.target.value }))}
                              placeholder="Nom"
                              className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-[16px]"
                            />
                            <input
                              type="email"
                              value={secondGuarantor.email}
                              onChange={e => setSecondGuarantor(prev => ({ ...prev, email: e.target.value }))}
                              placeholder="email@exemple.com"
                              className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500/20 text-[16px]"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            {slotTwoGuarantorBlocks.map(block => (
                              <button
                                key={`slot-2-${block.id}`}
                                type="button"
                                onClick={() => document.getElementById(getGuarantorUploadInputId(2))?.click()}
                                className={`text-left rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${getGuarantorBlockStatusClasses(block.status)}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest">Garant 2</p>
                                    <h4 className="mt-2 text-sm font-semibold text-navy">{block.label}</h4>
                                  </div>
                                  <span className="rounded-full border border-current/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest">
                                    {getGuarantorBlockStatusLabel(block.status)}
                                  </span>
                                </div>
                                <p className="mt-3 text-sm leading-relaxed text-slate-600">{block.description}</p>
                              </button>
                            ))}
                          </div>

                          <div
                            className="p-4 md:p-8 border-2 border-dashed border-slate-300 rounded-xl md:rounded-[2rem] bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-4 group hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer"
                            onClick={() => document.getElementById(getGuarantorUploadInputId(2))?.click()}
                          >
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center group-hover:bg-emerald-50 group-hover:scale-110 transition-transform">
                                <UsersIcon className="text-slate-400 group-hover:text-emerald-500 w-7 h-7" />
                              </div>
                              <div>
                                <h3 className="font-bold text-[#0F172A]">Documents du garant 2</h3>
                                <p className="text-sm text-slate-400 uppercase text-[10px] font-bold mt-1">ID, domicile, revenus, activité, fiscalité</p>
                              </div>
                            </div>
                            <div className="px-5 py-2.5 border border-slate-200 rounded-xl text-[10px] font-black tracking-widest uppercase group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all">Télécharger</div>
                            <input
                              type="file"
                              id="guarantor-slot-2-file-input"
                              className="hidden"
                              accept="image/*,application/pdf"
                              multiple
                              onChange={e => handleFileUpload('guarantor', e.target.files, { subjectType: 'guarantor', subjectSlot: 2 })}
                            />
                          </div>

                          {slotTwoGuarantorFiles.length > 0 && (
                            <div className="space-y-3">
                              <AnimatePresence mode="popLayout">
                                {slotTwoGuarantorFiles.map(file => (
                                  <DocumentCard
                                    key={file.id}
                                    file={file}
                                    showAmount={false}
                                    onDelete={handleDeleteDocument}
                                    onForceValidate={handleForceValidate}
                                    isDeleting={deletingFileId === file.id}
                                  />
                                ))}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
                </div>

            {/* Step 4: Validation / Passeport */}
            <div className={`step-page hidden flex flex-col items-center justify-center text-center space-y-10 py-8 ${currentStep === 4 ? '' : 'hidden'}`} id="step-4" style={{ display: currentStep === 4 ? 'flex' : 'none' }}>
                  <div className="w-full max-w-6xl space-y-6">
                    <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-7 text-left shadow-[0_25px_70px_-40px_rgba(15,23,42,0.28)]">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Chapitre IV</p>
                          <h2 className="mt-3 text-4xl font-serif text-[#0F172A]">Passport Studio</h2>
                          <p className="mt-3 max-w-2xl text-slate-600 leading-relaxed">
                            Prévisualisez la vraie page web et le vrai PDF de votre passeport locataire. Le partage externe ne s’active que lorsque le dossier est réellement prêt.
                          </p>
                        </div>
                        <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                          canAccessCertification
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}>
                          {canAccessCertification ? 'Partage activable' : 'Partage verrouillé'}
                        </div>
                      </div>

                      {!applicationId && (
                        <div className="mt-5 rounded-[1.35rem] border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
                          Votre dossier est en cours de synchronisation. Le studio s’active automatiquement dès que la sauvegarde crée votre passeport.
                        </div>
                      )}
                    </div>

                    <PassportStudio
                      applicationId={applicationId}
                      refreshKey={passportStudioRefreshKey}
                      fallbackName={passportName}
                      fallbackSummary={passportBlockerMessage}
                      fallbackWarnings={passportStudioFallbackWarnings}
                      onStateChange={setPassportStudioState}
                    />
                  </div>
            </div>
          </div>

          {/* Cockpit de Progression — Desktop uniquement (masqué sur mobile pour libérer l'écran) */}
          <motion.div
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="hidden lg:block glass-cockpit rounded-[2rem] p-6 shadow-lg h-fit sticky top-32"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Cockpit souverain</p>
                <h3 className="text-lg font-serif text-navy">PatrimoMeter™</h3>
              </div>
            </div>

            {/* Timeline des chapitres */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                <button
                  onClick={() => setCurrentStep(1)}
                  className={`${currentStep >= 1 ? 'text-emerald-600' : ''} hover:text-emerald-600`}
                >
                  Identité
                </button>
                <button
                  onClick={() => setCurrentStep(2)}
                  className={`${currentStep >= 2 ? 'text-emerald-600' : ''} hover:text-emerald-600`}
                >
                  Revenus
                </button>
                <button
                  onClick={() => {
                    if (!canAccessGuarantee) return;
                    setCurrentStep(3);
                  }}
                  className={`${currentStep >= 3 ? 'text-emerald-600' : !canAccessGuarantee ? 'text-slate-300 cursor-not-allowed' : ''} hover:text-emerald-600`}
                  disabled={!canAccessGuarantee}
                >
                  Garanties
                </button>
              </div>
              <div className="mt-2 h-1 rounded-full bg-slate-100 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500"
                  style={{ width: `${currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100}%` }}
                />
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                Progression critique : <span className="font-semibold text-navy">{requiredDone}/{requiredTotal}</span> pièces clés validées
              </div>
            </div>
            
            {/* PatrimoMeter - Jauge de Score Gamifiée */}
            <PatrimoMeter
              score={score}
              previousScore={previousScore}
              userName={formData.firstName || diditIdentity?.firstName || 'Candidat'}
              nextAction={nextActionInfo?.action}
              nextActionPoints={nextActionInfo?.points}
              hasInconsistency={hasInconsistency}
              scoreDelta={scoreDelta}
              hasExpirationMalus={hasExpirationMalus}
              canGeneratePassport={canAccessCertification}
              passportHint={passportBlockerMessage}
            />

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Résumé administratif</p>
                <p className="text-sm text-slate-600 mt-1">
                  Statut : <span className="font-semibold text-navy">{candidateStatus}</span> • Garantie <span className="font-semibold text-navy">{guaranteeMode === 'NONE' ? 'Aucune' : guaranteeMode === 'VISALE' ? 'Visale' : guarantorSlotsCount === 2 ? '2 garants physiques' : '1 garant physique'}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bloc locataire</p>
                  <p className="text-lg font-semibold text-navy mt-1">{scoringSnapshot.breakdown.tenant?.total || 0}/70</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bloc garantie</p>
                  <p className="text-lg font-semibold text-navy mt-1">{scoringSnapshot.breakdown.guarantee?.total || 0}/30</p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Priorités</p>
                {scoringSnapshot.warnings.length === 0 && missingSummary.length === 0 ? (
                  <p className="text-sm text-emerald-700 mt-2">Aucune pièce critique manquante.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {(scoringSnapshot.warnings.slice(0, 3).length > 0
                      ? scoringSnapshot.warnings.slice(0, 3).map((warning: string, index: number) => ({ id: `warning-${index}`, label: warning }))
                      : missingSummary).map((item: { id: string; label: string }) => (
                      <li key={item.id} className="flex items-start gap-2">
                        <span className="text-amber-500">•</span>
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Expert IA</p>
                <p className="text-sm text-slate-600 mt-2">{expertBubbleMessage}</p>
              </div>
            </div>

            {/* Alerte IA Anti-Fraude (toujours visible si présente) */}
            {aiAlertMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 mt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-900">{aiAlertMessage}</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Footer Navigation — Desktop */}
        <div className="hidden md:flex max-w-7xl mx-auto mt-10 items-center justify-between px-4">
          <div className="flex items-center gap-4 text-slate-300">
            <LockIcon className="w-4 h-4" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Finances sécurisées par IA</span>
          </div>
          <div className="flex gap-4">
            <button 
              id="btn-prev"
              onClick={handlePrev}
              className={`px-6 py-4 text-[10px] font-black tracking-[0.3em] text-slate-400 hover:text-navy transition-all uppercase ${
                currentStep > 1 ? '' : 'hidden'
              }`}
            >
              Retour
            </button>
            <button 
              id="btn-next"
              onClick={handleNext}
              disabled={isScanning || submittingPassport || isAnalyzingDoc || (currentStep === 4 && !canAccessCertification)}
              className={`px-10 py-5 bg-navy text-white rounded-2xl text-[10px] font-bold tracking-[0.4em] uppercase shadow-2xl shadow-navy/20 flex items-center gap-3 transition-all hover:bg-slate-800 ${
                isScanning || submittingPassport || isAnalyzingDoc || (currentStep === 4 && !canAccessCertification) ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <span>
                {isAnalyzingDoc
                  ? 'Analyse IA...'
                  : isScanning 
                    ? 'Analyse IA...' 
                    : submittingPassport
                      ? 'Transmission...'
                      : currentStep === 3 
                        ? 'Continuer vers le Passeport' 
                        : currentStep === 4 
                          ? canAccessCertification ? 'Transmettre et obtenir mon Passeport' : 'Passeport en attente'
                          : 'Continuer'
                }
              </span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer Navigation — Mobile Sticky Bottom (Thumb Zone) */}
        <div className="fixed bottom-0 left-0 w-full md:hidden z-50 bg-white/90 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center justify-between px-4 py-3">
            {currentStep > 1 && (
              <button 
                onClick={handlePrev}
                className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider"
              >
                Retour
              </button>
            )}
            <button 
              onClick={handleNext}
              disabled={isScanning || submittingPassport || isAnalyzingDoc || (currentStep === 4 && !canAccessCertification)}
              className={`flex-1 ${currentStep > 1 ? 'ml-3' : ''} py-4 bg-navy text-white rounded-xl text-sm font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                isScanning || submittingPassport || isAnalyzingDoc || (currentStep === 4 && !canAccessCertification) ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <span>
                {isAnalyzingDoc
                  ? 'Analyse IA...'
                  : isScanning 
                    ? 'Analyse IA...' 
                    : submittingPassport
                      ? 'Transmission...'
                      : currentStep === 3 
                        ? 'Continuer vers le Passeport' 
                        : currentStep === 4 
                          ? canAccessCertification ? 'Sceller mon Passeport' : 'Passeport en attente'
                          : 'Continuer'
                }
              </span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
