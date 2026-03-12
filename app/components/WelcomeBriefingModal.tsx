'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ShieldCheck, FileCheck } from 'lucide-react';

const LS_KEY = 'patrimo_welcome_seen';

const SLIDES = [
  {
    icon: Sparkles,
    iconBg: 'bg-amber-100 text-amber-600',
    title: 'Bienvenue dans votre coffre-fort.',
    text: 'Votre première mission : copiez votre Sésame et collez-le en réponse aux candidats sur LeBonCoin. Ils déposeront leur dossier en 3 minutes.',
  },
  {
    icon: ShieldCheck,
    iconBg: 'bg-emerald-100 text-emerald-600',
    title: 'L\'IA audite chaque candidat.',
    text: 'Détendez-vous. Identité, fraude, solvabilité : tout est scanné automatiquement. Seuls les profils « Grade S » remontent en haut de votre liste.',
  },
  {
    icon: FileCheck,
    iconBg: 'bg-blue-100 text-blue-600',
    title: 'Du bail à l\'état des lieux.',
    text: 'Une fois le profil idéal validé d\'un clic, nous générons le bail conforme instantanément. Prêt à déléguer ?',
  },
];

export default function WelcomeBriefingModal() {
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(LS_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage indisponible
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(LS_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const nextSlide = useCallback(() => {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1);
    } else {
      dismiss();
    }
  }, [slide, dismiss]);

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;
  const Icon = current.icon;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative max-w-lg w-full bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl p-10 text-center"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={slide}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div className={`w-16 h-16 rounded-2xl ${current.iconBg} flex items-center justify-center mx-auto mb-6`}>
                  <Icon className="w-8 h-8" />
                </div>
                <h2
                  className="text-2xl font-bold text-slate-900 mb-4"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {current.title}
                </h2>
                <p className="text-slate-600 leading-relaxed max-w-sm mx-auto">
                  {current.text}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Points de navigation */}
            <div className="flex items-center justify-center gap-2 mt-8 mb-6">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === slide
                      ? 'bg-emerald-600 w-6'
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={nextSlide}
              className="w-full py-4 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl transition-colors text-sm"
            >
              {isLast ? 'Déverrouiller mon tableau de bord' : 'Suivant →'}
            </button>

            {!isLast && (
              <button
                type="button"
                onClick={dismiss}
                className="mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                Passer le briefing
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
