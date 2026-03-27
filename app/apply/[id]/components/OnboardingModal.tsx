'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export function OnboardingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
