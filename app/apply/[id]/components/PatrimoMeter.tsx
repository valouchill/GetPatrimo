'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangleIcon, SparklesIcon, AwardIcon } from './Icons';

// --- PatrimoMeter: Système de Gamification ---
export interface PatrimoMeterProps {
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

export function PatrimoMeter({
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
