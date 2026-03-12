'use client';

import { motion } from 'framer-motion';

interface CertificationScoreBarProps {
  score: number; // 0-100
  level: 'incomplet' | 'certifie' | 'excellence';
}

/**
 * Barre de score de certification avec niveaux
 */
export default function CertificationScoreBar({ score, level }: CertificationScoreBarProps) {
  const levelLabels = {
    incomplet: 'Profil incomplet',
    certifie: 'Dossier certifié',
    excellence: 'Excellence PatrimoTrust™',
  };

  const levelColors = {
    incomplet: 'from-slate-300 to-slate-400',
    certifie: 'from-emerald-400 to-emerald-600',
    excellence: 'from-amber-300 via-emerald-400 to-emerald-600',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        <span>Profil incomplet</span>
        <span>Dossier certifié</span>
        <span>Excellence PatrimoTrust™</span>
      </div>
      
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
        {/* Barre de progression */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full bg-gradient-to-r ${levelColors[level]} rounded-full relative`}
        >
          {/* Effet de brillance */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
        </motion.div>
      </div>

      <p className="text-xs text-emerald-700 font-semibold">{levelLabels[level]}</p>
    </div>
  );
}
