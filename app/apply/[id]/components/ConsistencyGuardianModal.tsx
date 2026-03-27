'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export function ConsistencyGuardianModal({
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="consistency-modal-title"
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
                  <h3 id="consistency-modal-title" className="text-lg font-bold text-slate-800">Une petite ombre au tableau</h3>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer la fenêtre"
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    aria-required="true"
                    aria-label="Justification de la différence de nom"
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
