'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangleIcon } from './Icons';

export function SkipVerificationButton({ onSkip, onUpload, onScan }: { onSkip: () => void; onUpload: () => void; onScan?: () => void }) {
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
