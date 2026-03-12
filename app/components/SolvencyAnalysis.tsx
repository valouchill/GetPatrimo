'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { calculateSolvency, SolvencyCalculationResult } from '@/app/actions/calculate-solvency';

interface SolvencyAnalysisProps {
  totalCertifiedIncome: number; // Revenu mensuel total certifié du Passeport PatrimoTrust
  rentAmount: number; // Montant du loyer de l'annonce
  profile: 'STUDENT' | 'SALARIED' | 'INDEPENDENT' | 'RETIRED' | 'UNKNOWN';
  guarantorIncome?: number;
  aplAmount?: number;
  bourseAmount?: number;
  candidateName?: string;
}

export default function SolvencyAnalysis({
  totalCertifiedIncome,
  rentAmount,
  profile,
  guarantorIncome,
  aplAmount,
  bourseAmount,
  candidateName = 'Candidat',
}: SolvencyAnalysisProps) {
  const [result, setResult] = useState<SolvencyCalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function computeSolvency() {
      setIsLoading(true);
      try {
        const solvencyResult = await calculateSolvency(
          totalCertifiedIncome,
          rentAmount,
          profile,
          guarantorIncome,
          aplAmount,
          bourseAmount
        );
        setResult(solvencyResult);
      } catch (error) {
        console.error('Erreur calcul solvabilité:', error);
        setResult({
          ratio: 0,
          zone: 'red',
          grade: 'Insuffisant',
          status: 'Erreur',
          message: 'Impossible de calculer la solvabilité.',
          expertAdvice: 'Une erreur est survenue lors du calcul. Veuillez réessayer.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    if (rentAmount > 0) {
      computeSolvency();
    } else {
      setIsLoading(false);
    }
  }, [totalCertifiedIncome, rentAmount, profile, guarantorIncome, aplAmount, bourseAmount]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />
          <div className="flex-1">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200 mb-2" />
            <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!result || rentAmount <= 0) {
    return null;
  }

  const getZoneColors = () => {
    switch (result.zone) {
      case 'green':
        return {
          gradient: 'from-emerald-400 via-emerald-500 to-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
          badge: 'bg-emerald-500',
          icon: ShieldCheckIcon,
        };
      case 'amber':
        return {
          gradient: 'from-amber-400 via-amber-500 to-orange-500',
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          badge: 'bg-amber-500',
          icon: ExclamationTriangleIcon,
        };
      default:
        return {
          gradient: 'from-slate-300 via-slate-400 to-slate-500',
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          badge: 'bg-red-500',
          icon: ExclamationTriangleIcon,
        };
    }
  };

  const colors = getZoneColors();
  const Icon = colors.icon;

  // Calcul du pourcentage pour la jauge (max 5x = 100%)
  const gaugePercentage = Math.min((result.ratio / 5) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${colors.border} ${colors.bg} p-6 shadow-sm mb-6`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${colors.badge} rounded-xl flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Analyse de Solvabilité
            </h4>
            <p className={`text-sm font-bold ${colors.text}`}>{result.grade}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-serif font-bold text-navy" style={{ fontFamily: "'Playfair Display', serif" }}>
            {result.ratio.toFixed(1)}x
          </span>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">le loyer</p>
        </div>
      </div>

      {/* Jauge horizontale */}
      <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden mb-4">
        {/* Marqueurs de seuils */}
        <div className="absolute top-0 bottom-0 left-[50%] w-px bg-slate-300 z-10" title="2.5x" />
        <div className="absolute top-0 bottom-0 left-[60%] w-px bg-slate-300 z-10" title="3.0x" />
        
        {/* Barre de progression */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${gaugePercentage}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full bg-gradient-to-r ${colors.gradient} relative`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
        </motion.div>
      </div>

      {/* Légende des seuils */}
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider mb-4">
        <span className="text-red-400">&lt; 2.5x</span>
        <span className="text-amber-500">2.5x</span>
        <span className="text-emerald-500">3.0x+</span>
      </div>

      {/* Détails du calcul */}
      <div className="bg-white/60 rounded-xl p-4 border border-slate-100 mb-4">
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex justify-between">
            <span className="font-medium">Revenu mensuel certifié:</span>
            <span className="font-bold">{totalCertifiedIncome.toLocaleString('fr-FR')}€</span>
          </div>
          {guarantorIncome && (
            <div className="flex justify-between">
              <span className="font-medium">Revenu garant:</span>
              <span className="font-bold">{guarantorIncome.toLocaleString('fr-FR')}€</span>
            </div>
          )}
          {(aplAmount || bourseAmount) && (
            <div className="flex justify-between">
              <span className="font-medium">Aides (APL/Bourse):</span>
              <span className="font-bold">
                {((aplAmount || 0) + (bourseAmount || 0)).toLocaleString('fr-FR')}€
              </span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-slate-200">
            <span className="font-medium">Loyer mensuel:</span>
            <span className="font-bold">{rentAmount.toLocaleString('fr-FR')}€</span>
          </div>
        </div>
      </div>

      {/* Message contextuel */}
      <div className="bg-white/60 rounded-xl p-4 border border-slate-100 mb-4">
        <div className="flex items-start gap-2">
          <SparklesIcon className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed italic">
            "{result.message}"
          </p>
        </div>
      </div>

      {/* Conseil Expert */}
      <div className="bg-gradient-to-r from-navy/5 to-emerald-50/50 border border-navy/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center flex-shrink-0">
            <SparklesIcon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h5 className="text-xs font-bold text-navy mb-1">Conseil Expert PatrimoTrust™</h5>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {result.expertAdvice}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
