'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DocumentFile, AnalysisV2Result } from '../types';
import { ShieldCheckIcon, AlertTriangleIcon, SparklesIcon, FileIcon } from './Icons';

// --- Document Card avec Laser Scan ---
export interface DocumentCardProps {
  file: DocumentFile;
  showAmount?: boolean;
  onDelete?: (fileId: string) => void;
  onForceValidate?: (fileId: string) => void;
  isDeleting?: boolean;
}

export function DocumentCard({ file, showAmount = true, onDelete, onForceValidate, isDeleting = false }: DocumentCardProps) {
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
