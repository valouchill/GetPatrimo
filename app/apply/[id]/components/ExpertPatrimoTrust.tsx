'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SparklesIcon, AlertTriangleIcon, CheckCircleIcon, LightbulbIcon } from './Icons';
import { REQUIRED_DOCS_BY_PROFILE } from '../constants';

// --- Expert PatrimoTrust: Conseiller IA Adaptatif ---
export interface ExpertAdvice {
  message: string;
  action?: string;
  priority: 'high' | 'medium' | 'low';
  icon: 'star' | 'warning' | 'tip' | 'success';
}

export interface ExpertPatrimoTrustProps {
  profile: 'Etudiant' | 'Salarie' | 'Independant';
  score: number;
  rentAmount?: number;
  detectedIncome?: number | null;
  hasGuarantor: boolean;
  guarantorIncome?: number | null;
  certifiedItems: Set<string>;
  userName: string;
  hasFlaggedDocs: boolean;
}

export function ExpertPatrimoTrust({
  profile,
  score,
  rentAmount = 0,
  detectedIncome,
  hasGuarantor,
  guarantorIncome,
  certifiedItems,
  userName,
  hasFlaggedDocs
}: ExpertPatrimoTrustProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentAdviceIndex, setCurrentAdviceIndex] = useState(0);

  // Calcul du ratio loyer/revenu
  const rentRatio = detectedIncome && rentAmount > 0
    ? Math.round((rentAmount / detectedIncome) * 100)
    : null;

  // Calcul du ratio garant (revenus garant / loyer)
  const guarantorRatio = guarantorIncome && rentAmount > 0
    ? Math.round(guarantorIncome / rentAmount)
    : null;

  // Génère les conseils adaptatifs selon le profil
  const generateAdvice = (): ExpertAdvice[] => {
    const advice: ExpertAdvice[] = [];

    // --- Conseils communs ---
    if (score < 40) {
      advice.push({
        message: `${userName}, votre dossier débute son ascension. Chaque document ajouté vous rapproche de l'Excellence.`,
        priority: 'medium',
        icon: 'tip'
      });
    }

    if (hasFlaggedDocs) {
      advice.push({
        message: `Notre analyse a détecté une légère incohérence. Fournissez l'original pour lever toute réserve et restaurer votre score.`,
        action: 'Corriger maintenant',
        priority: 'high',
        icon: 'warning'
      });
    }

    // --- Conseils selon le profil ---
    if (profile === 'Etudiant') {
      // Vérification garant pour étudiant
      if (!hasGuarantor) {
        advice.push({
          message: `En tant qu'étudiant, le dossier de votre garant est la clé de voûte de votre certification. Invitez-le à compléter son espace sécurisé.`,
          action: 'Inviter mon garant',
          priority: 'high',
          icon: 'star'
        });
      } else if (guarantorRatio !== null && guarantorRatio < 4) {
        advice.push({
          message: `Les revenus de votre garant représentent ${guarantorRatio}x le loyer. Pour atteindre le score AAA, nous recommandons un second garant ou une caution solidaire.`,
          action: 'Ajouter un garant',
          priority: 'high',
          icon: 'warning'
        });
      } else if (guarantorRatio !== null && guarantorRatio >= 4) {
        advice.push({
          message: `Excellent choix de garant : ses revenus couvrent ${guarantorRatio}x le loyer. Votre dossier inspire confiance.`,
          priority: 'low',
          icon: 'success'
        });
      }

      // Documents clés étudiants
      if (!certifiedItems.has('bourse') && !certifiedItems.has('scolarite')) {
        advice.push({
          message: `L'ajout de votre certificat de scolarité ou avis de bourse valorise immédiatement votre profil académique.`,
          action: 'Ajouter un justificatif',
          priority: 'medium',
          icon: 'tip'
        });
      }

      if (!certifiedItems.has('caf')) {
        advice.push({
          message: `Une simulation CAF/APL démontre votre éligibilité aux aides et renforce la solvabilité perçue de votre dossier.`,
          priority: 'low',
          icon: 'tip'
        });
      }
    }

    if (profile === 'Salarie') {
      // Ratio loyer/revenu
      if (rentRatio !== null) {
        if (rentRatio > 33) {
          advice.push({
            message: `Votre ratio loyer/revenu est de ${rentRatio}%. Au-delà de 33%, nous vous recommandons de mettre en avant une épargne solide ou d'ajouter un garant.`,
            action: 'Ajouter un justificatif',
            priority: 'high',
            icon: 'warning'
          });
        } else if (rentRatio <= 25) {
          advice.push({
            message: `Ratio loyer/revenu de ${rentRatio}% — un indicateur d'excellence. Votre capacité financière est optimale.`,
            priority: 'low',
            icon: 'success'
          });
        } else {
          advice.push({
            message: `Votre ratio loyer/revenu de ${rentRatio}% est dans la norme. Un justificatif d'épargne pourrait renforcer votre profil.`,
            priority: 'medium',
            icon: 'tip'
          });
        }
      }

      // Documents clés salariés
      if (!certifiedItems.has('contrat')) {
        advice.push({
          message: `Votre contrat de travail (CDI/CDD) est un pilier de crédibilité. Les propriétaires y accordent une attention particulière.`,
          action: 'Ajouter le contrat',
          priority: 'high',
          icon: 'star'
        });
      }

      // Comptage des bulletins de salaire
      const bulletinCount = Array.from(certifiedItems).filter(id =>
        id.includes('salaire') || id.includes('bulletin')
      ).length;

      if (bulletinCount < 3) {
        const missingCount = 3 - bulletinCount;
        advice.push({
          message: bulletinCount === 0
            ? `${userName}, pour atteindre le Grade A immédiatement, déposez vos 3 derniers bulletins de salaire.`
            : `Il me manque ${missingCount} bulletin${missingCount > 1 ? 's' : ''} de salaire pour valider vos 20 points de revenus.`,
          action: 'Ajouter les bulletins',
          priority: 'high',
          icon: 'star'
        });
      } else {
        advice.push({
          message: `Excellent ! Vos 3 bulletins de salaire sont certifiés. +20 points de revenus validés.`,
          priority: 'low',
          icon: 'success'
        });
      }
    }

    if (profile === 'Independant') {
      advice.push({
        message: `En tant qu'indépendant, la régularité de vos revenus est scrutée. Les avis d'imposition N-1 et N-2 rassurent sur votre moyenne annuelle.`,
        action: 'Ajouter les avis',
        priority: 'high',
        icon: 'star'
      });

      if (detectedIncome) {
        advice.push({
          message: `Chiffre d'affaires détecté : ${detectedIncome.toLocaleString('fr-FR')}€. Pour un dossier AAA, démontrez la constance sur 24 mois minimum.`,
          priority: 'medium',
          icon: 'tip'
        });
      }

      if (!hasGuarantor && rentRatio && rentRatio > 25) {
        advice.push({
          message: `Compte tenu de la variabilité des revenus indépendants, un garant ou une caution bancaire sécuriserait votre candidature.`,
          action: 'Ajouter une garantie',
          priority: 'high',
          icon: 'warning'
        });
      }
    }

    // --- Conseil score plafonné ---
    if (score > 60 && score <= 70 && !hasGuarantor && profile === 'Etudiant') {
      advice.push({
        message: `Votre score est plafonné à 70 sans garant certifié. Débloquez les 30 points restants en complétant le dossier de garantie.`,
        action: 'Compléter la garantie',
        priority: 'high',
        icon: 'warning'
      });
    }

    // --- Félicitations score élevé ---
    if (score >= 85) {
      advice.push({
        message: `${userName}, votre dossier atteint le cercle prestigieux des candidatures d'Excellence. Les propriétaires privilégient systématiquement ce niveau.`,
        priority: 'low',
        icon: 'success'
      });
    }

    // Trier par priorité
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    advice.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return advice.slice(0, 3); // Max 3 conseils
  };

  const adviceList = generateAdvice();
  const currentAdvice = adviceList[currentAdviceIndex] || adviceList[0];

  // Rotation automatique des conseils
  useEffect(() => {
    if (adviceList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAdviceIndex(prev => (prev + 1) % adviceList.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [adviceList.length]);

  const getIconComponent = (icon: string) => {
    switch (icon) {
      case 'star':
        return <SparklesIcon className="w-5 h-5 text-amber-500" />;
      case 'warning':
        return <AlertTriangleIcon className="w-5 h-5 text-orange-500" />;
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-emerald-500" />;
      default:
        return <LightbulbIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = (icon: string) => {
    switch (icon) {
      case 'star': return 'border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50';
      case 'warning': return 'border-orange-200 bg-gradient-to-br from-orange-50/80 to-amber-50/50';
      case 'success': return 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/50';
      default: return 'border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/50';
    }
  };

  if (adviceList.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div
        className="flex items-center justify-between mb-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-navy to-slate-700 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white text-xs font-serif font-bold">EP</span>
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Expert PatrimoTrust™</h4>
            <p className="text-[9px] text-slate-400">Conseiller dédié</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          className="text-slate-400"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </div>

      <AnimatePresence>
        {isExpanded && currentAdvice && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <motion.div
              key={currentAdviceIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className={`relative rounded-2xl border p-4 ${getBorderColor(currentAdvice.icon)}`}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
              </div>

              <div className="relative flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getIconComponent(currentAdvice.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium italic">
                    "{currentAdvice.message}"
                  </p>
                  {currentAdvice.action && (
                    <button className="mt-3 px-4 py-2 bg-navy text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
                      {currentAdvice.action}
                    </button>
                  )}
                </div>
              </div>

              {/* Indicateurs de pagination */}
              {adviceList.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-4">
                  {adviceList.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentAdviceIndex(idx);
                      }}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === currentAdviceIndex
                          ? 'w-4 bg-navy'
                          : 'bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
