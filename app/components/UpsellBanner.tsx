'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, Home, Euro, Mail } from 'lucide-react';
import FastOnboardingForm from './FastOnboardingForm';

type UpsellBannerProps = {
  /** Slug du passeport (pour associer le locataire au bien créé) */
  passportSlug: string;
  /** Nom du candidat pour personnaliser le CTA */
  candidateName?: string;
};

export default function UpsellBanner({ passportSlug, candidateName }: UpsellBannerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const displayName = candidateName || 'ce profil';

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-slate-900 via-slate-800/98 to-slate-900/95 backdrop-blur-md border-t border-white/10 shadow-2xl"
      >
        <div className="max-w-2xl mx-auto px-6 py-5">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="flex items-center gap-3 text-emerald-400">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">
                  Ce profil a été certifié par l&apos;IA PatrimoTrust.
                </p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Générez le bail, sécurisez le paiement et automatisez l&apos;état des lieux.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex-shrink-0 w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              Gérer {displayName} sur ma plateforme
              <Home className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                <h3 className="font-semibold text-slate-800">
                  Sélectionner {displayName} pour mon bien
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-4">
                  Indiquez l&apos;adresse du bien, le loyer convenu et votre email. Vous accéderez à votre tableau de bord avec {displayName} déjà en candidature acceptée.
                </p>
                <FastOnboardingForm
                  passportSlug={passportSlug}
                  title=""
                  compact
                  onSuccess={() => setModalOpen(false)}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
