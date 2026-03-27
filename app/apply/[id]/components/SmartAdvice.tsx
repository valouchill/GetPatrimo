'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { REQUIRED_DOCS_BY_PROFILE, ALL_CERTIFICATION_ITEMS } from '../constants';

// --- Composant SmartAdvice (Next Best Action) ---
export interface SmartAdviceProps {
  score: number;
  profile: 'Etudiant' | 'Salarie' | 'Independant';
  certifiedItems: Set<string>;
  diditVerified: boolean;
  userName: string;
}

export function SmartAdvice({ score, profile, certifiedItems, diditVerified, userName }: SmartAdviceProps) {
  const getNextBestAction = (): { message: string; action: string; impact: number; icon: string } => {
    const isSatisfied = (id: string) => {
      if (id === 'bilan_n1' || id === 'bilan_n2') {
        return certifiedItems.has(id) || certifiedItems.has('attestation_urssaf');
      }
      if (id === 'attestation_urssaf') {
        return certifiedItems.has('attestation_urssaf') || (certifiedItems.has('bilan_n1') && certifiedItems.has('bilan_n2'));
      }
      return certifiedItems.has(id);
    };

    // Priorité 1: Didit
    if (!diditVerified) {
      return {
        message: `${userName}, commencez par certifier votre identité avec Didit pour débloquer votre dossier.`,
        action: 'Certifier mon identité',
        impact: 40,
        icon: '🔐'
      };
    }

    // Priorité 2: Documents requis manquants
    const profileDocs = REQUIRED_DOCS_BY_PROFILE[profile] || REQUIRED_DOCS_BY_PROFILE.Etudiant;
    for (const docId of profileDocs.required) {
      if (!isSatisfied(docId)) {
        const item = ALL_CERTIFICATION_ITEMS.find(i => i.id === docId);
        return {
          message: `Ajoutez ${item?.label || 'le document requis'} pour compléter votre dossier.`,
          action: `Ajouter ${item?.label || 'document'}`,
          impact: 10,
          icon: '📄'
        };
      }
    }

    // Priorité 3: Garant si score < 80
    if (score < 80 && !certifiedItems.has('garant_salaires')) {
      return {
        message: `Votre score est de ${score}. Ajoutez un garant pour franchir la barre des 80 et rassurer le propriétaire.`,
        action: 'Ajouter un garant',
        impact: 20,
        icon: '👥'
      };
    }

    // Priorité 4: Boost documents
    const boost = profileDocs.boost.find(b => !certifiedItems.has(b.id));
    if (boost) {
      return {
        message: `Excellent dossier ! Ajoutez "${boost.label}" pour maximiser vos chances.`,
        action: `Ajouter ${boost.label}`,
        impact: boost.points,
        icon: boost.icon
      };
    }

    // Dossier complet
    return {
      message: `Félicitations ${userName} ! Votre dossier est complet et prêt pour l'envoi.`,
      action: 'Finaliser le dossier',
      impact: 0,
      icon: '🎉'
    };
  };

  const advice = getNextBestAction();

  if (score >= 90 && advice.impact === 0) {
    return null; // Ne pas afficher si dossier complet et excellent
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 border ${
        score < 50
          ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200'
          : score < 80
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
          : 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">{advice.icon}</div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
            Conseil de l&apos;Expert
          </p>
          <p className="text-sm text-navy leading-relaxed">{advice.message}</p>
          {advice.impact > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                +{advice.impact} points potentiels
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
