'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheckIcon, CheckCircleIcon, DocumentMagnifyingGlassIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import UnifiedTunnelHeader from '@/app/components/UnifiedTunnelHeader';

interface GuarantorInfo {
  email: string;
  firstName: string;
  lastName: string;
  tenantName: string;
  propertyAddress?: string;
}

interface AuditDocument {
  file: File;
  type: 'CNI' | 'AVIS_IMPOSITION' | 'BULLETIN_SALAIRE';
  uploading: boolean;
  analysisResult?: {
    document_metadata?: { owner_name: string; type: string };
    trust_and_security?: { 
      fraud_score: number; 
      digital_seal_authenticated?: boolean;
    };
    financial_data?: { monthly_net_income: number };
  };
  mrzLines?: string[];
}

type VerificationMode = 'choice' | 'didit' | 'audit';
type AuditStatus = 'uploading' | 'processing' | 'success' | 'failed';

export default function GuarantorVerificationClient({ token }: { token: string }) {
  const [guarantorInfo, setGuarantorInfo] = useState<GuarantorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [diditSessionId, setDiditSessionId] = useState<string | null>(null);
  const [diditVerificationUrl, setDiditVerificationUrl] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCertified, setIsCertified] = useState(false);
  const [certificationMethod, setCertificationMethod] = useState<'DIDIT' | 'AUDIT' | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Nouveau: Mode de vérification (Didit ou Audit)
  const [verificationMode, setVerificationMode] = useState<VerificationMode>('choice');
  const [diditFailed, setDiditFailed] = useState(false);
  
  // Audit PatrimoTrust
  const [auditDocuments, setAuditDocuments] = useState<AuditDocument[]>([]);
  const [auditStatus, setAuditStatus] = useState<AuditStatus | null>(null);
  const [auditResult, setAuditResult] = useState<{
    success: boolean;
    score: number;
    badge?: string;
    expertAdvice: string;
    patrimometerPoints: number;
  } | null>(null);

  // Charger les informations du garant
  useEffect(() => {
    async function loadGuarantorInfo() {
      try {
        const response = await fetch(`/api/guarantor/status?token=${encodeURIComponent(token)}`);
        if (!response.ok) {
          throw new Error('Garant introuvable ou token invalide');
        }

        const data = await response.json();
        const guarantor = data.guarantor;

        if (guarantor.status === 'CERTIFIED') {
          setIsCertified(true);
          setCertificationMethod(guarantor.identityVerification?.source?.includes('Audit') ? 'AUDIT' : 'DIDIT');
        }

        setGuarantorInfo({
          email: guarantor.email,
          firstName: guarantor.firstName,
          lastName: guarantor.lastName,
          tenantName: data.tenantName || 'Le locataire',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    }

    loadGuarantorInfo();
  }, [token]);

  // Vérifier périodiquement le statut si une session Didit est active
  useEffect(() => {
    if (!diditSessionId || isCertified) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/guarantor/status?token=${encodeURIComponent(token)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.guarantor.status === 'CERTIFIED') {
            setIsCertified(true);
            setCertificationMethod('DIDIT');
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Erreur vérification statut:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [diditSessionId, token, isCertified]);

  const handleDiditVerification = async () => {
    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch('/api/guarantor/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationToken: token }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur lors de la création de la session Didit');
      }

      const data = await response.json();

      if (data.fallbackMode) {
        // Didit non disponible - proposer le fallback
        setDiditFailed(true);
        setVerificationMode('choice');
        setError(null);
        setIsVerifying(false);
        return;
      }

      setDiditSessionId(data.sessionId);
      setDiditVerificationUrl(data.verificationUrl);
      setVerificationMode('didit');
      // L'iframe s'affichera automatiquement via le state
    } catch (err) {
      // Erreur technique - proposer le fallback
      setDiditFailed(true);
      setError(null);
      setIsVerifying(false);
    }
  };

  // Gestion upload de document pour l'audit
  const handleAuditDocumentUpload = async (file: File, type: AuditDocument['type']) => {
    const newDoc: AuditDocument = { file, type, uploading: true };
    setAuditDocuments(prev => [...prev.filter(d => d.type !== type), newDoc]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('originalFileName', file.name);

      const response = await fetch('/api/analyze-document-v2', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setAuditDocuments(prev => 
          prev.map(d => 
            d.type === type 
              ? { ...d, uploading: false, analysisResult: result }
              : d
          )
        );
      } else {
        setAuditDocuments(prev => 
          prev.map(d => d.type === type ? { ...d, uploading: false } : d)
        );
      }
    } catch {
      setAuditDocuments(prev => 
        prev.map(d => d.type === type ? { ...d, uploading: false } : d)
      );
    }
  };

  // Lancer l'audit d'identité
  const handleRunAudit = useCallback(async () => {
    if (auditDocuments.length < 2) {
      setError('Veuillez uploader au moins 2 documents pour l\'audit');
      return;
    }

    setAuditStatus('processing');
    setError(null);

    try {
      const response = await fetch('/api/guarantor/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationToken: token,
          documents: auditDocuments.map(d => ({
            fileName: d.file.name,
            type: d.type,
            analysisResult: d.analysisResult,
            mrzLines: d.mrzLines
          }))
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAuditStatus('success');
        setAuditResult({
          success: true,
          score: result.score,
          badge: result.badge,
          expertAdvice: result.expertAdvice,
          patrimometerPoints: result.patrimometerPoints
        });
        
        // Vérifier si le garant est maintenant certifié
        if (result.verificationLevel === 'VERIFIED_AUDIT') {
          setTimeout(() => {
            setIsCertified(true);
            setCertificationMethod('AUDIT');
          }, 2000);
        }
      } else {
        setAuditStatus('failed');
        setAuditResult({
          success: false,
          score: result.score || 0,
          expertAdvice: result.expertAdvice || 'L\'audit n\'a pas pu confirmer votre identité.',
          patrimometerPoints: 0
        });
      }
    } catch (err) {
      setAuditStatus('failed');
      setError('Erreur lors de l\'audit. Veuillez réessayer.');
    }
  }, [auditDocuments, token]);

  // Transition vers le mode Audit
  const switchToAuditMode = () => {
    setVerificationMode('audit');
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <UnifiedTunnelHeader title="Certification Garant" />
        <main className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-slate-200 rounded w-64 mx-auto mb-4" />
              <div className="h-4 bg-slate-200 rounded w-96 mx-auto" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error && !guarantorInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <UnifiedTunnelHeader title="Certification Garant" />
        <main className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isCertified) {
    const isAuditCertified = certificationMethod === 'AUDIT';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
        <UnifiedTunnelHeader title="Certification Garant" />
        <main className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-emerald-200 shadow-lg p-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircleIcon className="w-12 h-12 text-white" />
              </motion.div>
              
              <h1 className="text-3xl font-serif text-navy mb-4">
                Certification Réussie
              </h1>
              
              <p className="text-slate-600 text-lg mb-8">
                Votre identité a été certifiée avec succès. La <strong>Garantie Souveraine</strong> est maintenant active pour {guarantorInfo?.tenantName}.
              </p>
              
              <div className={`rounded-xl p-6 border ${isAuditCertified ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <p className={`font-medium ${isAuditCertified ? 'text-blue-800' : 'text-emerald-800'}`}>
                  {isAuditCertified ? '📋 Identité Auditée & Cohérente' : '✅ Identité Souveraine Certifiée'}
                </p>
                <p className={`text-sm mt-2 ${isAuditCertified ? 'text-blue-700' : 'text-emerald-700'}`}>
                  Le PatrimoMeter™ du locataire a été augmenté de <strong>+{isAuditCertified ? '30' : '40'} points</strong> grâce à votre certification.
                </p>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <UnifiedTunnelHeader title="Certification Garant" />
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-navy/5 rounded-full mb-6"
            >
              <ShieldCheckIcon className="w-5 h-5 text-navy" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-navy">
                Certification Garant Souverain
              </span>
            </motion.div>
            
            <h1 className="text-4xl font-serif text-navy mb-4">
              Certifiez votre identité
            </h1>
            
            <p className="text-slate-600 text-lg max-w-lg mx-auto">
              <strong>{guarantorInfo?.tenantName}</strong> a besoin de votre garantie pour sécuriser sa candidature PatrimoTrust™.
            </p>
          </div>

          {/* Message Expert si Didit a échoué */}
          <AnimatePresence mode="wait">
            {diditFailed && verificationMode === 'choice' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-6"
              >
                <div className="flex items-start gap-4">
                  <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-amber-800 font-medium mb-2">
                      🧠 Conseil de l&apos;Expert PatrimoTrust
                    </p>
                    <p className="text-amber-700 text-sm leading-relaxed">
                      La certification instantanée Didit est temporairement indisponible. 
                      <strong> Passons à l&apos;audit sécurisé de vos documents</strong> pour ne pas ralentir le dossier de {guarantorInfo?.tenantName}.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Choix du mode de vérification */}
          <AnimatePresence mode="wait">
            {verificationMode === 'choice' && !diditVerificationUrl && (
              <motion.div
                key="choice"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-lg p-12"
              >
                <div className="text-center mb-8">
                  <p className="text-slate-700 text-base leading-relaxed">
                    Choisissez votre méthode de certification :
                  </p>
                </div>

                <div className="grid gap-6">
                  {/* Option Didit (Priorité 1) */}
                  <button
                    onClick={handleDiditVerification}
                    disabled={isVerifying}
                    className="group relative bg-gradient-to-br from-navy to-slate-800 text-white rounded-2xl p-8 text-left transition-all hover:scale-[1.02] hover:shadow-xl disabled:opacity-50"
                  >
                    <div className="flex items-start gap-6">
                      <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <ShieldCheckIcon className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">Certification Didit</h3>
                          <span className="px-2 py-0.5 bg-emerald-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            Recommandé
                          </span>
                        </div>
                        <p className="text-slate-300 text-sm mb-4">
                          Certification cryptographique instantanée via selfie et pièce d&apos;identité. 
                          <strong className="text-white"> +40 points PatrimoMeter</strong>
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span>⚡ 30 secondes</span>
                          <span>🔒 Infalsifiable</span>
                          <span>✨ Badge Premium</span>
                        </div>
                      </div>
                    </div>
                    {isVerifying && (
                      <div className="absolute inset-0 bg-navy/80 rounded-2xl flex items-center justify-center">
                        <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </button>

                  {/* Option Audit PatrimoTrust (Fallback) */}
                  <button
                    onClick={switchToAuditMode}
                    className="group bg-white border-2 border-slate-200 rounded-2xl p-8 text-left transition-all hover:border-blue-300 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-6">
                      <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                        <DocumentMagnifyingGlassIcon className="w-8 h-8 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Audit Documentaire PatrimoTrust</h3>
                        <p className="text-slate-600 text-sm mb-4">
                          Vérification par analyse croisée de vos documents officiels (CNI, avis d&apos;imposition).
                          <strong className="text-slate-800"> +30 points PatrimoMeter</strong>
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>📄 Upload documents</span>
                          <span>🔍 Cross-check IA</span>
                          <span>✅ MRZ validée</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4"
                  >
                    <p className="text-red-700 text-sm">{error}</p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Mode Didit actif - Iframe intégrée */}
            {verificationMode === 'didit' && diditVerificationUrl && (
              <motion.div
                key="didit"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-2xl border-2 border-emerald-300 shadow-xl overflow-hidden"
              >
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-blue-50 border-b border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                      <ShieldCheckIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-navy">Certification Didit en cours</h3>
                      <p className="text-xs text-slate-600">Complétez la vérification ci-dessous</p>
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
                
                <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
                  <button
                    onClick={switchToAuditMode}
                    className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Un problème ? Passer à l&apos;audit documentaire →
                  </button>
                </div>
              </motion.div>
            )}

            {/* Mode Audit PatrimoTrust */}
            {verificationMode === 'audit' && (
              <motion.div
                key="audit"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <DocumentMagnifyingGlassIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Audit Documentaire PatrimoTrust</h2>
                    <p className="text-slate-500 text-sm">Vérification par analyse croisée des documents</p>
                  </div>
                </div>

                {/* Résultat de l'audit si disponible */}
                {auditResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`mb-8 p-6 rounded-xl border ${
                      auditResult.success 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        auditResult.success ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}>
                        {auditResult.success ? (
                          <CheckCircleIcon className="w-6 h-6 text-white" />
                        ) : (
                          <ExclamationTriangleIcon className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`font-bold ${auditResult.success ? 'text-emerald-800' : 'text-amber-800'}`}>
                            {auditResult.success ? auditResult.badge : 'Audit incomplet'}
                          </span>
                          <span className={`text-sm ${auditResult.success ? 'text-emerald-600' : 'text-amber-600'}`}>
                            Score: {auditResult.score}%
                          </span>
                        </div>
                        <p className={`text-sm ${auditResult.success ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {auditResult.expertAdvice}
                        </p>
                        {auditResult.patrimometerPoints > 0 && (
                          <p className={`text-sm font-medium mt-2 ${auditResult.success ? 'text-emerald-800' : 'text-amber-800'}`}>
                            +{auditResult.patrimometerPoints} points PatrimoMeter ajoutés
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Upload des documents */}
                {!auditResult && (
                  <>
                    <div className="space-y-4 mb-8">
                      <p className="text-sm text-slate-600 mb-4">
                        Uploadez les documents suivants pour l&apos;audit d&apos;identité :
                      </p>

                      {/* CNI/Passeport */}
                      <DocumentUploadCard
                        type="CNI"
                        label="Carte d'identité ou Passeport"
                        description="Photo recto-verso de votre CNI (MRZ visible)"
                        icon="🪪"
                        document={auditDocuments.find(d => d.type === 'CNI')}
                        onUpload={(file) => handleAuditDocumentUpload(file, 'CNI')}
                        required
                      />

                      {/* Avis d'imposition */}
                      <DocumentUploadCard
                        type="AVIS_IMPOSITION"
                        label="Avis d'imposition"
                        description="Dernier avis d'imposition complet"
                        icon="📄"
                        document={auditDocuments.find(d => d.type === 'AVIS_IMPOSITION')}
                        onUpload={(file) => handleAuditDocumentUpload(file, 'AVIS_IMPOSITION')}
                        required
                      />

                      {/* Bulletin de salaire (optionnel) */}
                      <DocumentUploadCard
                        type="BULLETIN_SALAIRE"
                        label="Bulletin de salaire (optionnel)"
                        description="Pour renforcer la cohérence de l'audit"
                        icon="💰"
                        document={auditDocuments.find(d => d.type === 'BULLETIN_SALAIRE')}
                        onUpload={(file) => handleAuditDocumentUpload(file, 'BULLETIN_SALAIRE')}
                      />
                    </div>

                    {/* Bouton lancer l'audit */}
                    <button
                      onClick={handleRunAudit}
                      disabled={auditDocuments.filter(d => !d.uploading).length < 2 || auditStatus === 'processing'}
                      className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {auditStatus === 'processing' ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Analyse en cours...</span>
                        </>
                      ) : (
                        <>
                          <DocumentMagnifyingGlassIcon className="w-5 h-5" />
                          <span>Lancer l&apos;Audit PatrimoTrust</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4"
                  >
                    <p className="text-red-700 text-sm">{error}</p>
                  </motion.div>
                )}

                {/* Retour vers Didit */}
                <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                  <button
                    onClick={() => setVerificationMode('choice')}
                    className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    ← Revenir au choix de certification
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// Composant pour l'upload de document
interface DocumentUploadCardProps {
  type: AuditDocument['type'];
  label: string;
  description: string;
  icon: string;
  document?: AuditDocument;
  onUpload: (file: File) => void;
  required?: boolean;
}

function DocumentUploadCard({ label, description, icon, document, onUpload, required }: DocumentUploadCardProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const isUploaded = document && !document.uploading;
  const isUploading = document?.uploading;

  return (
    <label className={`block p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
      isUploaded 
        ? 'border-emerald-300 bg-emerald-50' 
        : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
          isUploaded ? 'bg-emerald-100' : 'bg-slate-100'
        }`}>
          {isUploading ? (
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : isUploaded ? (
            <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
          ) : (
            icon
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-800">{label}</span>
            {required && <span className="text-red-500 text-xs">*</span>}
          </div>
          <p className="text-xs text-slate-500">{description}</p>
          {isUploaded && document?.file && (
            <p className="text-xs text-emerald-600 mt-1">
              ✓ {document.file.name}
            </p>
          )}
        </div>
      </div>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />
    </label>
  );
}
