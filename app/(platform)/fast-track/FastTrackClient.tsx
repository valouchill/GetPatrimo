'use client';

import { motion } from 'framer-motion';
import FastOnboardingForm from '@/app/components/FastOnboardingForm';

export default function FastTrackClient() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden">
      {/* Fond Crystal & Gold — motifs discrets */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-100/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-gradient-to-t from-emerald-100/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/60 via-transparent to-transparent" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-lg"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Carte centrale épurée — style terminal banque privée */}
        <div className="rounded-3xl border border-white/20 bg-white/70 backdrop-blur-2xl shadow-2xl shadow-slate-200/50 overflow-hidden">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-medium uppercase tracking-wider mb-3">
              Formulaire Éclair
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              PatrimoTrust™
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Votre tableau de bord en moins de 15 secondes
            </p>
          </div>
          <div className="p-6 md:p-8">
            <FastOnboardingForm />
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Aucun mot de passe. Un lien de connexion vous sera envoyé par email pour vos prochaines visites.
        </p>
      </motion.div>
    </div>
  );
}
