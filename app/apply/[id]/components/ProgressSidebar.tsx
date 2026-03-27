'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { DocumentFile, CertificationItem } from '../types';
import { REQUIRED_DOCS_BY_PROFILE, ALL_CERTIFICATION_ITEMS } from '../constants';

export interface ProgressSidebarProps {
  profile: 'Etudiant' | 'Salarie' | 'Independant' | 'Retraite';
  certifiedItems: Set<string>;
  uploadedFiles: { identity: DocumentFile[]; resources: DocumentFile[]; guarantor: DocumentFile[] };
  score: number;
  diditVerified: boolean;
}

export function ProgressSidebar({ profile, certifiedItems, uploadedFiles, score, diditVerified }: ProgressSidebarProps) {
  const profileDocs = REQUIRED_DOCS_BY_PROFILE[profile] || REQUIRED_DOCS_BY_PROFILE.Etudiant;

  const allFiles = [...uploadedFiles.identity, ...uploadedFiles.resources, ...uploadedFiles.guarantor];
  const certifiedCount = allFiles.filter(f => f.status === 'CERTIFIED' && !f.flagged).length;

  const normalizeText = (value: string) =>
    value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const isBilanFile = (file: DocumentFile) => {
    const name = normalizeText(`${file.aiAnalysis?.documentType || ''} ${file.type || ''} ${file.name || ''}`);
    return name.includes('bilan') || name.includes('liasse');
  };

  const hasUrssaf = allFiles.some(f => {
    const name = normalizeText(`${f.aiAnalysis?.documentType || ''} ${f.type || ''} ${f.name || ''}`);
    return name.includes('urssaf');
  });

  const bilanCertifiedCount = allFiles.filter(f => f.status === 'CERTIFIED' && !f.flagged && isBilanFile(f)).length;

  const requiredCount = profileDocs.required.length + (diditVerified ? 1 : 0);
  const satisfiedRequiredCount = profileDocs.required.filter(id => {
    if (id === 'bilan_n1') return hasUrssaf || bilanCertifiedCount >= 1;
    if (id === 'bilan_n2') return hasUrssaf || bilanCertifiedCount >= 2;
    if (id === 'attestation_urssaf') return hasUrssaf || bilanCertifiedCount >= 2;
    return certifiedItems.has(id);
  }).length;
  // Synchroniser la barre de progression avec le PatrimoMeter (score)
  const completionPercent = score; // Harmonisation : progression = score PatrimoMeter

  const isRequirementSatisfied = (itemId: string) => {
    if (itemId === 'bilan_n1') return hasUrssaf || bilanCertifiedCount >= 1;
    if (itemId === 'bilan_n2') return hasUrssaf || bilanCertifiedCount >= 2;
    if (itemId === 'attestation_urssaf') return hasUrssaf || bilanCertifiedCount >= 2;
    return certifiedItems.has(itemId);
  };

  const hasMatchingFile = (itemId: string) => {
    const item = ALL_CERTIFICATION_ITEMS.find(i => i.id === itemId);
    if (!item) return false;
    const keywords = item.keywords.map(k => normalizeText(k));
    return allFiles.some(file => {
      const haystack = normalizeText(`${file.aiAnalysis?.documentType || ''} ${file.type || ''} ${file.name || ''}`);
      return keywords.some(keyword => haystack.includes(keyword));
    });
  };

  const getItemStatus = (itemId: string): 'certified' | 'pending' | 'missing' => {
    if (isRequirementSatisfied(itemId)) return 'certified';
    if (hasMatchingFile(itemId)) return 'pending';
    return 'missing';
  };

  const categoryOrder = ['Identité', 'Domicile', 'Activité', 'Ressources'];
  const requiredItems = profileDocs.required
    .map(id => ALL_CERTIFICATION_ITEMS.find(item => item.id === id))
    .filter((item): item is CertificationItem => !!item);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      {/* Header avec barre de complétion */}
      <div className="p-4 bg-gradient-to-r from-navy to-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-bold text-sm">Progression du dossier</h3>
          <span className="text-emerald-400 font-bold text-lg">{completionPercent}%</span>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-white/60 text-[10px] uppercase tracking-wider">
            {certifiedCount} document{certifiedCount > 1 ? 's' : ''} certifié{certifiedCount > 1 ? 's' : ''}
          </p>
          <p className="text-white/40 text-[8px]">
            Score : {score}/100
          </p>
        </div>
      </div>

      {/* Mention protection juridique */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
        <p className="text-[9px] text-slate-500 flex items-center gap-1.5">
          <span>🔒</span>
          <span>Données cryptées AES-256 • Secret professionnel PatrimoTrust</span>
        </p>
      </div>

      {/* Identité Didit */}
      <div className={`p-3 border-b ${diditVerified ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100'}`}>
        <div className="flex items-center gap-3">
          <motion.div
            animate={diditVerified ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3 }}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              diditVerified ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/30' : 'bg-slate-200'
            }`}
          >
            {diditVerified ? (
              <span className="text-white text-sm">🛡️</span>
            ) : (
              <div className="w-4 h-4 border-2 border-slate-400 rounded-full" />
            )}
          </motion.div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${diditVerified ? 'text-emerald-700' : 'text-slate-400'}`}>
              Identité certifiée Didit
            </p>
            <p className={`text-[10px] ${diditVerified ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
              {diditVerified ? '✓ Bloc Identité validé' : 'Bloc Identité 25 points'}
            </p>
          </div>
          {diditVerified && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full"
            >
              SCELLÉ
            </motion.span>
          )}
        </div>
        {!diditVerified && (
          <p className="text-[9px] text-slate-400 mt-2 pl-11">
            🔒 Zéro stockage de documents. Certification souveraine instantanée.
          </p>
        )}
      </div>

      {/* Checklist Souveraine */}
      <div className="p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Checklist Souveraine</p>
        <div className="space-y-4">
          {categoryOrder.map(category => {
            const categoryItems = requiredItems.filter(item => item.category === category);
            if (categoryItems.length === 0) return null;
            const missingItems = categoryItems.filter(item => !isRequirementSatisfied(item.id));

            return (
              <div key={category} className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{category}</p>
                {categoryItems.map(item => {
                  const status = getItemStatus(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3"
                    >
                      <motion.div
                        animate={status === 'certified' ? { scale: [1, 1.3, 1] } : {}}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          status === 'certified'
                            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/30'
                            : status === 'pending'
                            ? 'bg-amber-100 border-2 border-amber-400'
                            : 'bg-slate-100 border-2 border-slate-300'
                        }`}
                      >
                        {status === 'certified' && <span className="text-white text-sm">🛡️</span>}
                        {status === 'pending' && <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
                      </motion.div>
                      <span className={`text-sm flex-1 ${
                        status === 'certified' ? 'text-navy font-medium' : 'text-slate-500'
                      }`}>
                        {item.label}
                      </span>
                      {item.description && (
                        <span
                          title={item.description}
                          className="text-[10px] text-slate-400 cursor-help"
                          aria-label={item.description}
                        >
                          ℹ️
                        </span>
                      )}
                    </motion.div>
                  );
                })}
                {missingItems.length > 0 && (
                  <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    {category} : Manque {missingItems[0].label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Documents optionnels (boost) */}
      <div className="p-3 bg-gradient-to-b from-amber-50 to-white border-t border-amber-100">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-3 flex items-center gap-1">
          <span>⭐</span> Boostez votre score
        </p>
        <div className="space-y-2">
          {profileDocs.boost.map(boost => {
            const isCertified = certifiedItems.has(boost.id);

            return (
              <div key={boost.id} className="flex items-center gap-3">
                <span className="text-amber-500">★</span>
                <span className="text-lg">{boost.icon}</span>
                <span className={`text-xs flex-1 ${isCertified ? 'text-emerald-700 line-through' : 'text-slate-600'}`}>
                  {boost.label}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isCertified
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  +{boost.points} pts
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
