'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon, LightbulbIcon, LockIcon, SparklesIcon, ShieldCheckIcon } from './Icons';
import { REQUIRED_DOCS_BY_PROFILE, ALL_CERTIFICATION_ITEMS } from '../constants';

// --- Contextual Sidebar: 100% lié au currentStep et detectedProfile ---
export interface ContextualSidebarProps {
  currentStep: number;
  diditStatus: 'idle' | 'loading' | 'verified';
  detectedProfile: string | null;
  candidateStatus: 'Etudiant' | 'Salarie' | 'Independant';
  certifiedItems: Set<string>;
  score: number;
  userName: string;
}

export function ContextualSidebar({
  currentStep,
  diditStatus,
  detectedProfile,
  candidateStatus,
  certifiedItems,
  score,
  userName
}: ContextualSidebarProps) {

  // --- Messages contextuels selon le chapitre ---
  const getChapterContent = () => {
    // Chapitre I : Identité (Didit)
    if (currentStep === 1) {
      if (diditStatus === 'idle') {
        return {
          title: 'Certification d\'Identité',
          messages: [
            {
              type: 'info' as const,
              text: 'La certification d\'identité est le socle de votre PatrimoScore™. Préparez votre document officiel.',
              delay: 0
            },
            {
              type: 'tip' as const,
              text: 'CNI, Passeport ou Titre de séjour — assurez-vous que le document soit lisible et en cours de validité.',
              delay: 0.2
            }
          ],
          showChecklist: false
        };
      }
      if (diditStatus === 'loading') {
        return {
          title: 'Vérification en cours',
          messages: [
            {
              type: 'loading' as const,
              text: 'Vérification en cours via le protocole sécurisé Didit...',
              delay: 0
            },
            {
              type: 'security' as const,
              text: 'Vos données sont chiffrées de bout en bout. Aucun stockage tiers.',
              delay: 0.3
            }
          ],
          showChecklist: false
        };
      }
      // Didit vérifié
      return {
        title: 'Identité Validée',
        messages: [
          {
            type: 'success' as const,
            text: `Identité validée. Le bloc Identité est complet, nous pouvons maintenant analyser vos ressources.`,
            delay: 0
          }
        ],
        showChecklist: false
      };
    }

    // Chapitre II : Ressources
    if (currentStep === 2) {
      const messages: { type: 'info' | 'tip' | 'success' | 'loading' | 'security'; text: string; delay: number }[] = [];

      if (!detectedProfile) {
        messages.push({
          type: 'info',
          text: 'Déposez un premier document de revenu. L\'IA PatrimoTrust™ détectera automatiquement votre profil.',
          delay: 0
        });
        messages.push({
          type: 'tip',
          text: 'Bulletin de salaire, avis de bourse, attestation CAF... Glissez-déposez sans vous soucier du tri.',
          delay: 0.2
        });
      } else if (candidateStatus === 'Etudiant') {
        messages.push({
          type: 'success',
          text: `Profil Étudiant détecté. Voici les documents clés pour votre certification :`,
          delay: 0
        });
      } else if (candidateStatus === 'Salarie') {
        messages.push({
          type: 'success',
          text: `Profil Salarié détecté. Consolidez votre dossier avec les justificatifs suivants :`,
          delay: 0
        });
      } else {
        messages.push({
          type: 'success',
          text: `Profil Indépendant détecté. Démontrez la régularité de vos revenus :`,
          delay: 0
        });
      }

      return {
        title: 'Analyse des Ressources',
        messages,
        showChecklist: !!detectedProfile,
        checklist: getProfileChecklist(candidateStatus, certifiedItems)
      };
    }

    // Chapitre III : Garantie
    if (currentStep === 3) {
      return {
        title: 'Garantie & Sécurité',
        messages: [
          {
            type: 'info' as const,
            text: 'Le garant renforce considérablement votre dossier. Invitez-le à compléter son espace sécurisé.',
            delay: 0
          },
          {
            type: 'tip' as const,
            text: 'Un garant avec des revenus ≥ 3x le loyer vous propulse vers le score AAA.',
            delay: 0.2
          }
        ],
        showChecklist: true,
        checklist: [
          { id: 'garant_id', label: 'Identité du garant', done: certifiedItems.has('garant_id') },
          { id: 'garant_domicile', label: 'Justificatif de domicile', done: certifiedItems.has('garant_domicile') },
          { id: 'garant_salaires', label: '3 derniers bulletins', done: certifiedItems.has('garant_salaires') }
        ]
      };
    }

    // Chapitre IV : Certification finale
    return {
      title: 'Certification Finale',
      messages: [
        {
          type: 'success' as const,
          text: `${userName}, votre dossier PatrimoTrust™ est prêt. Score final : ${score} points.`,
          delay: 0
        },
        {
          type: 'tip' as const,
          text: 'Téléchargez votre Passeport Certifié et envoyez-le à n\'importe quel propriétaire.',
          delay: 0.2
        }
      ],
      showChecklist: false
    };
  };

  // Checklist selon le profil
  const getProfileChecklist = (profile: string, certified: Set<string>) => {
    const profileDocs = REQUIRED_DOCS_BY_PROFILE[profile as keyof typeof REQUIRED_DOCS_BY_PROFILE] || REQUIRED_DOCS_BY_PROFILE.Etudiant;
    return profileDocs.required.map((id) => {
      const item = ALL_CERTIFICATION_ITEMS.find(i => i.id === id);
      const hasUrssaf = certified.has('attestation_urssaf');
      const done = id === 'bilan_n1' || id === 'bilan_n2'
        ? (certified.has(id) || hasUrssaf)
        : id === 'attestation_urssaf'
        ? (hasUrssaf || (certified.has('bilan_n1') && certified.has('bilan_n2')))
        : certified.has(id);
      return {
        id,
        label: item?.label || id,
        done,
      };
    });
  };

  const content = getChapterContent();

  // Icône selon le type de message
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircleIcon className="w-4 h-4 text-emerald-500" />;
      case 'tip': return <LightbulbIcon className="w-4 h-4 text-amber-500" />;
      case 'loading': return <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />;
      case 'security': return <LockIcon className="w-4 h-4 text-navy" />;
      default: return <SparklesIcon className="w-4 h-4 text-blue-500" />;
    }
  };

  const getMessageBg = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 border-emerald-200';
      case 'tip': return 'bg-amber-50 border-amber-200';
      case 'loading': return 'bg-blue-50 border-blue-200';
      case 'security': return 'bg-slate-50 border-slate-200';
      default: return 'bg-white border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-navy to-slate-700 rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-white text-sm font-serif font-bold">EP</span>
        </div>
        <div>
          <h4 className="text-xs font-bold text-navy">{content.title}</h4>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">Expert PatrimoTrust™</p>
        </div>
      </div>

      {/* Messages en bulles de chat */}
      <div className="space-y-3">
        {content.messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: msg.delay, duration: 0.3 }}
            className={`relative rounded-2xl rounded-tl-sm border p-4 shadow-sm ${getMessageBg(msg.type)}`}
          >
            {/* Flèche de bulle */}
            <div className={`absolute -left-1 top-3 w-2 h-2 rotate-45 border-l border-b ${getMessageBg(msg.type)}`} />

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getMessageIcon(msg.type)}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{msg.text}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Checklist contextuelle */}
      {content.showChecklist && content.checklist && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4"
        >
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
            Documents recommandés
          </p>
          <div className="space-y-2">
            {content.checklist.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  item.done
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className={`flex-shrink-0 ${item.done ? 'text-emerald-500' : 'text-slate-300'}`}>
                  {item.done
                    ? <CheckCircleIcon className="w-5 h-5" />
                    : <div className="w-5 h-5 rounded-full border-2 border-current" />
                  }
                </div>
                <span className={`text-sm ${item.done ? 'text-emerald-700 font-medium' : 'text-slate-600'}`}>
                  {item.label}
                </span>
                {item.done && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="ml-auto"
                  >
                    <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Message de réassurance sécurité (toujours visible) */}
      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-slate-400">
          <LockIcon className="w-3 h-3" />
          <span className="text-[9px] uppercase tracking-widest">Données chiffrées & sécurisées</span>
        </div>
      </div>
    </div>
  );
}
