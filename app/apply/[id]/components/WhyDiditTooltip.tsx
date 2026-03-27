'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function WhyDiditTooltip({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
