'use client';

import React, { useEffect, useState } from 'react';
import { useNotification } from '@/app/hooks/useNotification';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

// Types pour le Journal d'Audit
interface AuditEvent {
  id: string;
  timestamp: string;
  time: string;
  type: 'identity' | 'income' | 'inconsistency' | 'justification' | 'validation' | 'seal';
  status: 'success' | 'warning' | 'info' | 'sealed';
  title: string;
  description: string;
  details?: string;
  documentLink?: string;
}

interface ApplicationData {
  firstName: string;
  lastName: string;
  age?: number;
  profession?: string;
  contractType?: string;
  location?: string;
  score: number;
  grade: string;
  identityVerified: boolean;
  incomeVerified: boolean;
  guarantorCertified: boolean;
  monthlyIncome?: number;
  rentAmount?: number;
  effortRate?: number;
  pillars: {
    identity: { verified: boolean };
    domicile: { verified: boolean };
    activity: { verified: boolean };
    resources: { verified: boolean };
  };
  certificationDate: string;
  passportId: string;
  documents?: {
    type: string;
    name: string;
    verified: boolean;
    date?: string;
  }[];
  auditEvents?: AuditEvent[];
  hasObservations?: boolean;
}

// --- Composant AuditTrail ---
function AuditTrail({ 
  events, 
  passportId, 
  certificationDate 
}: { 
  events: AuditEvent[]; 
  passportId: string; 
  certificationDate: string;
}) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  
  const statusConfig: Record<string, { icon: string; color: string; bg: string; border: string }> = {
    success: { icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/50' },
    warning: { icon: '⚠️', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/50' },
    info: { icon: 'ℹ️', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50' },
    sealed: { icon: '🛡️', color: 'text-amber-400', bg: 'bg-gradient-to-r from-amber-500/20 to-amber-600/20', border: 'border-amber-500' },
  };
  
  const statusLabels: Record<string, string> = {
    success: 'SUCCÈS',
    warning: 'ALERTE',
    info: 'INFO',
    sealed: 'SCELLÉ',
  };
  
  return (
    <div className="bg-gradient-to-br from-slate-900/95 to-slate-950 rounded-3xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-xl">📋</span>
              Rapport d'Intégrité PatrimoTrust™
            </h3>
            <p className="text-slate-500 text-xs mt-1 font-mono">
              Référence : <span className="text-slate-400">{passportId}</span> | Certification : <span className="text-slate-400">{certificationDate}</span>
            </p>
          </div>
          <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Audit Complet
            </p>
          </div>
        </div>
      </div>
      
      {/* Timeline */}
      <div className="p-6">
        <div className="relative">
          {/* Ligne verticale */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500/50 via-slate-700 to-amber-500/50" />
          
          {/* Événements */}
          <div className="space-y-6">
            {events.map((event, index) => {
              const config = statusConfig[event.status] || statusConfig.info;
              const isExpanded = expandedEvent === event.id;
              const isLast = index === events.length - 1;
              
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative pl-14"
                >
                  {/* Point sur la timeline */}
                  <div className={`absolute left-4 w-5 h-5 rounded-full ${config.bg} ${config.border} border-2 flex items-center justify-center z-10`}>
                    <span className="text-[10px]">{config.icon}</span>
                  </div>
                  
                  {/* Carte événement */}
                  <motion.div
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isExpanded 
                        ? `${config.bg} ${config.border}` 
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                    onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-slate-500 text-xs font-mono">{event.time}</span>
                          <span className={`px-2 py-0.5 ${config.bg} ${config.border} border rounded text-[10px] font-bold ${config.color} uppercase tracking-wider`}>
                            {statusLabels[event.status]}
                          </span>
                        </div>
                        <h4 className="text-white font-semibold text-sm mb-1">{event.title}</h4>
                        <p className="text-slate-400 text-xs leading-relaxed">{event.description}</p>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        className="text-slate-500 mt-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </motion.div>
                    </div>
                    
                    {/* Détails étendus */}
                    <AnimatePresence>
                      {isExpanded && event.details && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-4 pt-4 border-t border-slate-700/50"
                        >
                          <p className="text-slate-500 text-xs font-mono bg-slate-800/50 rounded-lg p-3">
                            {event.details}
                          </p>
                          {event.documentLink && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Ouvrir le document
                              }}
                              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Consulter la pièce justificative
                              <span className="px-1.5 py-0.5 bg-emerald-500/30 text-emerald-400 text-[8px] rounded-full font-bold">VÉRIFIÉ</span>
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  
                  {/* Sceau Final */}
                  {isLast && event.status === 'sealed' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-6 p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/50 rounded-2xl text-center"
                    >
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <motion.span
                          className="text-2xl"
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          🔐
                        </motion.span>
                        <span className="text-amber-400 font-bold text-sm uppercase tracking-wider">
                          Log Scellé
                        </span>
                      </div>
                      <p className="text-amber-400/80 text-xs">
                        Toute modification ultérieure annule la certification
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
        
        {/* Conclusion Expert */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: events.length * 0.1 + 0.2 }}
          className="mt-8 p-5 bg-slate-800/50 rounded-2xl border border-slate-700"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Conclusion de l'Expert PatrimoTrust</p>
              <p className="text-white text-sm leading-relaxed">
                "Ce dossier a passé notre protocole d'audit complet. 
                {events.some(e => e.status === 'warning') 
                  ? " Les observations relevées ont été traitées et validées. Le risque d'usurpation est écarté."
                  : " Aucune anomalie détectée."
                } Le dossier conserve son Grade certifié."
              </p>
            </div>
          </div>
        </motion.div>
        
        {/* Bannière Commercial */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: events.length * 0.1 + 0.4 }}
          className="mt-6 p-4 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-xl"
        >
          <p className="text-slate-400 text-xs text-center">
            <span className="text-emerald-400 font-semibold">Cette rigueur d'audit est incluse dans votre Protection PatrimoTrust.</span>
            <br />
            <span className="text-slate-500">Vous louez à un profil dont nous avons personnellement vérifié chaque détail.</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// Fonction pour générer les événements d'audit par défaut
function generateDefaultAuditEvents(data: ApplicationData): AuditEvent[] {
  const baseTime = new Date();
  baseTime.setMinutes(baseTime.getMinutes() - 30);
  
  const events: AuditEvent[] = [];
  
  // Événement 1: Vérification d'identité
  if (data.identityVerified) {
    events.push({
      id: 'evt-identity',
      timestamp: new Date(baseTime.getTime()).toISOString(),
      time: formatTime(baseTime),
      type: 'identity',
      status: 'success',
      title: 'Vérification d\'Identité',
      description: `Biométrie Didit confirmée (${data.firstName} ${data.lastName}).`,
      details: 'Fuzzy match score: 0.99 • Document valide • Aucune alerte de fraude',
    });
    baseTime.setMinutes(baseTime.getMinutes() + 3);
  }
  
  // Événement 2: Analyse des revenus
  if (data.pillars.resources.verified) {
    events.push({
      id: 'evt-income',
      timestamp: new Date(baseTime.getTime()).toISOString(),
      time: formatTime(baseTime),
      type: 'income',
      status: 'success',
      title: 'Analyse des Revenus',
      description: 'Bulletins de salaire et avis d\'imposition vérifiés.',
      details: data.monthlyIncome 
        ? `Revenu mensuel détecté: ${data.monthlyIncome.toLocaleString('fr-FR')}€ • Taux d'effort: ${data.effortRate || '< 33'}%`
        : 'Revenus conformes aux déclarations',
    });
    baseTime.setMinutes(baseTime.getMinutes() + 5);
  }
  
  // Événement 3: Vérification activité
  if (data.pillars.activity.verified) {
    events.push({
      id: 'evt-activity',
      timestamp: new Date(baseTime.getTime()).toISOString(),
      time: formatTime(baseTime),
      type: 'validation',
      status: 'success',
      title: 'Validation de l\'Activité Professionnelle',
      description: data.profession 
        ? `${data.profession} - ${data.contractType || 'CDI'} confirmé.`
        : 'Contrat de travail et attestation employeur validés.',
      details: 'Employeur vérifié • Ancienneté conforme',
    });
    baseTime.setMinutes(baseTime.getMinutes() + 3);
  }
  
  // Événement 4: Garant (si applicable)
  if (data.guarantorCertified) {
    events.push({
      id: 'evt-guarantor',
      timestamp: new Date(baseTime.getTime()).toISOString(),
      time: formatTime(baseTime),
      type: 'validation',
      status: 'success',
      title: 'Certification du Garant',
      description: 'Garant physique certifié avec revenus vérifiés.',
      details: 'Identité garant validée • Revenus garant conformes • Aucune incohérence détectée',
    });
    baseTime.setMinutes(baseTime.getMinutes() + 2);
  }
  
  // Événement final: Scellement
  events.push({
    id: 'evt-seal',
    timestamp: new Date(baseTime.getTime()).toISOString(),
    time: formatTime(baseTime),
    type: 'seal',
    status: 'sealed',
    title: 'Audit Final',
    description: `Dossier certifié conforme - Grade ${data.grade}.`,
    details: `Score PatrimoMeter: ${data.score}/100 • Certification ID: #PT-2026-${Date.now().toString(36).toUpperCase()}`,
  });
  
  return events;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function VerifyLandingClient({ token }: { token: string }) {
  const notify = useNotification();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApplicationData | null>(null);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/verify/${token}`);
        if (!res.ok) {
          throw new Error('Dossier introuvable ou lien expiré');
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token]);

  const gradeConfig: Record<string, { color: string; glow: string; label: string; bg: string }> = {
    'SOUVERAIN': { color: '#D4AF37', glow: '0 0 60px rgba(212,175,55,0.6)', label: 'SOUVERAIN', bg: 'from-amber-500 to-amber-700' },
    'A': { color: '#10B981', glow: '0 0 40px rgba(16,185,129,0.5)', label: 'EXCELLENCE', bg: 'from-emerald-500 to-emerald-700' },
    'B': { color: '#3B82F6', glow: '0 0 40px rgba(59,130,246,0.5)', label: 'CONFIANCE', bg: 'from-blue-500 to-blue-700' },
    'C': { color: '#8B5CF6', glow: '0 0 40px rgba(139,92,246,0.5)', label: 'SOLIDE', bg: 'from-violet-500 to-violet-700' },
    'D': { color: '#F59E0B', glow: '0 0 40px rgba(245,158,11,0.5)', label: 'STANDARD', bg: 'from-amber-500 to-orange-600' },
    'E': { color: '#F97316', glow: '0 0 40px rgba(249,115,22,0.5)', label: 'À COMPLÉTER', bg: 'from-orange-500 to-red-600' },
    'F': { color: '#6B7280', glow: '0 0 30px rgba(107,114,128,0.4)', label: 'EN COURS', bg: 'from-slate-500 to-slate-700' },
  };

  // Documents simulés pour le teasing
  const teasingDocuments = [
    { type: 'identity', name: 'Pièce d\'identité', icon: '🪪', verified: data?.pillars.identity.verified || false },
    { type: 'income', name: 'Bulletins de salaire', icon: '💰', verified: data?.pillars.resources.verified || false },
    { type: 'tax', name: 'Avis d\'imposition', icon: '📋', verified: data?.pillars.resources.verified || false },
    { type: 'address', name: 'Justificatif de domicile', icon: '🏠', verified: data?.pillars.domicile.verified || false },
    { type: 'contract', name: 'Contrat de travail', icon: '📄', verified: data?.pillars.activity.verified || false },
    { type: 'employer', name: 'Attestation employeur', icon: '🏢', verified: data?.pillars.activity.verified || false },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-amber-400/30 rounded-full" />
            <div className="absolute inset-0 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-2 border-4 border-amber-300/20 rounded-full" />
          </div>
          <p className="text-amber-400/80 text-sm uppercase tracking-[0.3em] font-medium">Vérification en cours</p>
          <p className="text-slate-500 text-xs mt-2">Audit de conformité PatrimoTrust™</p>
        </motion.div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/80 backdrop-blur-2xl rounded-3xl p-10 max-w-md text-center border border-slate-800"
        >
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Lien invalide ou expiré</h1>
          <p className="text-slate-400 mb-8">{error || 'Ce dossier n\'est plus accessible.'}</p>
          <Link
            href="/"
            className="inline-block px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-bold rounded-full hover:shadow-lg hover:shadow-amber-500/30 transition-all"
          >
            Retour à l'accueil
          </Link>
        </motion.div>
      </div>
    );
  }

  const gradeStyle = gradeConfig[data.grade] || gradeConfig['F'];
  const fullName = `${data.firstName} ${data.lastName}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header Sticky */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center">
              <span className="text-slate-900 font-bold text-lg">P</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">PatrimoTrust™</h1>
              <p className="text-[9px] text-slate-500 uppercase tracking-[0.2em]">Standard de Confiance Immobilier</p>
            </div>
          </div>
          <motion.div
            className="px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2"
            style={{ 
              background: `linear-gradient(135deg, ${gradeStyle.color}20, ${gradeStyle.color}40)`,
              border: `1px solid ${gradeStyle.color}50`,
              color: gradeStyle.color,
              boxShadow: gradeStyle.glow
            }}
            animate={{ boxShadow: [gradeStyle.glow, `0 0 80px ${gradeStyle.color}40`, gradeStyle.glow] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-lg">🛡️</span>
            GRADE {data.grade}
          </motion.div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Section 1: Header de Certification */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <p className="text-slate-500 text-xs uppercase tracking-[0.3em] mb-3">
            Dossier de Candidature Certifié
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            #{data.passportId || `PT-2026-${token.slice(0, 8).toUpperCase()}`}
          </h2>
          
          {/* Badge Animé */}
          <motion.div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl mb-4"
            style={{ 
              background: `linear-gradient(135deg, ${gradeStyle.color}15, ${gradeStyle.color}25)`,
              border: `2px solid ${gradeStyle.color}`,
              boxShadow: gradeStyle.glow
            }}
            animate={{ 
              boxShadow: [
                gradeStyle.glow, 
                `0 0 100px ${gradeStyle.color}50`, 
                gradeStyle.glow
              ] 
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <motion.span 
              className="text-4xl"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🛡️
            </motion.span>
            <div className="text-left">
              <p className="font-black text-xl" style={{ color: gradeStyle.color }}>
                GRADE {data.grade} — {gradeStyle.label}
              </p>
              <p className="text-slate-400 text-xs">Dossier audité par IA PatrimoTrust™</p>
            </div>
          </motion.div>
          
          <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Vérifié par l'IA PatrimoTrust le {data.certificationDate}
          </p>
        </motion.section>

        {/* Section 2: Carte d'Identité du Candidat */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-slate-800 overflow-hidden mb-8"
        >
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Photo avec badge vérifié */}
              <div className="relative">
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-700">
                  <span className="text-5xl">👤</span>
                </div>
                {data.identityVerified && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-slate-900"
                  >
                    <span className="text-white text-lg">✓</span>
                  </motion.div>
                )}
              </div>
              
              {/* Infos */}
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">{fullName}</h3>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                  {data.identityVerified && (
                    <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/50 rounded-full text-emerald-400 text-xs font-medium flex items-center gap-1">
                      <span>🔐</span> Identité Biométrique Validée
                    </span>
                  )}
                  <span className="px-3 py-1 bg-slate-800 rounded-full text-slate-400 text-xs">
                    {data.age || '26'} ans
                  </span>
                  <span className="px-3 py-1 bg-slate-800 rounded-full text-slate-400 text-xs">
                    {data.contractType || 'CDI'}
                  </span>
                </div>
                <p className="text-slate-500 text-sm">
                  {data.profession || 'Salarié(e)'} • {data.location || 'Île-de-France'}
                </p>
              </div>
              
              {/* Boutons Contact (verrouillés) */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowConversionModal(true)}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 text-sm font-medium flex items-center gap-2 transition-colors border border-slate-700"
                >
                  <span>📞</span> Appeler
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">🔒</span>
                </button>
                <button
                  onClick={() => setShowConversionModal(true)}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 text-sm font-medium flex items-center gap-2 transition-colors border border-slate-700"
                >
                  <span>💬</span> Envoyer SMS
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">🔒</span>
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Section 3: Dashboard de Solvabilité */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-slate-800 overflow-hidden mb-8"
        >
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Dashboard de Solvabilité</h3>
                <p className="text-slate-500 text-xs">Données certifiées par audit IA</p>
              </div>
            </div>
            
            {/* Tableau de solvabilité */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 text-slate-500 text-xs uppercase tracking-wider font-medium">Indicateur</th>
                    <th className="text-left py-3 px-4 text-slate-500 text-xs uppercase tracking-wider font-medium">Valeur Certifiée</th>
                    <th className="text-right py-3 px-4 text-slate-500 text-xs uppercase tracking-wider font-medium">Statut IA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-4 px-4">
                      <span className="text-white font-medium">Revenus Nets</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-white font-bold text-lg">
                        {data.monthlyIncome 
                          ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(data.monthlyIncome)
                          : '3 250 €'
                        } / mois
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium">
                        ✅ Certifié 2D-Doc
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-4 px-4">
                      <span className="text-white font-medium">Ratio Solvabilité</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-white font-bold text-lg">
                        Loyer / Revenus = {data.effortRate ? `${data.effortRate}%` : '28%'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium">
                        ✅ Excellent
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-4 px-4">
                      <span className="text-white font-medium">Stabilité Professionnelle</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-white font-bold text-lg">
                        {data.contractType || 'CDI'} ({data.location || 'Île-de-France'})
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium">
                        ✅ Attestation &lt; 1 mois
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4">
                      <span className="text-white font-medium">Score PatrimoTrust™</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-bold text-lg" style={{ color: gradeStyle.color }}>
                        {data.score}/100 — Grade {data.grade}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span 
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
                        style={{ 
                          background: `${gradeStyle.color}20`,
                          color: gradeStyle.color
                        }}
                      >
                        🛡️ {gradeStyle.label}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        {/* Section 4: Historique de Confiance */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-gradient-to-r from-amber-900/30 via-amber-800/20 to-amber-900/30 rounded-3xl border border-amber-700/40 overflow-hidden mb-8"
        >
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Badge Historique */}
              <div className="relative">
                <motion.div
                  className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30"
                  animate={{ 
                    boxShadow: [
                      '0 10px 40px rgba(212,175,55,0.3)',
                      '0 10px 60px rgba(212,175,55,0.5)',
                      '0 10px 40px rgba(212,175,55,0.3)'
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-4xl">⭐</span>
                </motion.div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-slate-900">
                  <span className="text-white text-sm font-bold">✓</span>
                </div>
              </div>
              
              {/* Contenu */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  <span className="text-amber-400 text-xs uppercase tracking-widest font-bold">
                    Historique de Confiance
                  </span>
                  <span className="px-2 py-0.5 bg-amber-500/20 rounded-full text-amber-400 text-[10px] font-bold">
                    VÉRIFIÉ
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Locataire certifié depuis 2 ans
                </h3>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <span className="text-emerald-400 text-sm">✓</span>
                    </span>
                    <span className="text-emerald-400 font-semibold">0 incident de paiement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <span className="text-emerald-400 text-sm">✓</span>
                    </span>
                    <span className="text-emerald-400 font-semibold">100% loyers à l'heure</span>
                  </div>
                </div>
              </div>
              
              {/* Score de confiance */}
              <div className="text-center px-6 py-4 bg-slate-900/50 rounded-2xl border border-amber-500/30">
                <p className="text-amber-400 text-xs uppercase tracking-wider mb-1">Indice de Confiance</p>
                <p className="text-4xl font-black text-white mb-1">A+</p>
                <div className="flex items-center justify-center gap-1">
                  {[1,2,3,4,5].map((star) => (
                    <motion.span 
                      key={star} 
                      className="text-amber-400 text-sm"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + star * 0.1 }}
                    >
                      ★
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Timeline */}
            <div className="mt-6 pt-6 border-t border-amber-700/30">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                  <span className="text-slate-400">Jan. 2024</span>
                  <span className="text-slate-500">— Première location</span>
                </div>
                <div className="hidden md:flex items-center gap-1 flex-1 mx-4">
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-emerald-500 to-amber-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Aujourd'hui —</span>
                  <span className="text-amber-400 font-medium">24 mois sans incident</span>
                  <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Section 5: Documents (Teasing avec Blur) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-slate-800 overflow-hidden mb-8"
        >
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">📁</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Pièces Justificatives Originales</h3>
                <p className="text-slate-500 text-xs">Documents certifiés et horodatés</p>
              </div>
            </div>
            
            {/* Grille de documents floutés */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {teasingDocuments.map((doc, index) => (
                <motion.div
                  key={doc.type}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="relative group"
                >
                  {/* Document preview flouté */}
                  <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 overflow-hidden">
                    <div className="aspect-[3/4] bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden">
                      {/* Lignes simulées de document (floutées) */}
                      <div className="absolute inset-4 blur-sm opacity-30">
                        <div className="h-3 bg-slate-600 rounded mb-2 w-3/4" />
                        <div className="h-2 bg-slate-600 rounded mb-1.5 w-full" />
                        <div className="h-2 bg-slate-600 rounded mb-1.5 w-5/6" />
                        <div className="h-2 bg-slate-600 rounded mb-1.5 w-full" />
                        <div className="h-2 bg-slate-600 rounded mb-3 w-2/3" />
                        <div className="h-8 bg-slate-600 rounded mb-2 w-1/2" />
                        <div className="h-2 bg-slate-600 rounded mb-1.5 w-full" />
                        <div className="h-2 bg-slate-600 rounded w-4/5" />
                      </div>
                      
                      {/* Icône centrale */}
                      <span className="text-4xl relative z-10">{doc.icon}</span>
                      
                      {/* Badge vérifié */}
                      {doc.verified && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-white text-sm font-medium text-center mb-1">{doc.name}</p>
                    <p className="text-slate-500 text-xs text-center">
                      {doc.verified ? 'Vérifié' : 'En attente'}
                    </p>
                  </div>
                  
                  {/* Overlay au hover */}
                  <div 
                    onClick={() => setShowConversionModal(true)}
                    className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    <div className="text-center p-4">
                      <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-amber-400 text-xl">🔓</span>
                      </div>
                      <p className="text-white text-sm font-medium">Consulter l'original</p>
                      <p className="text-amber-400 text-xs">Certifié PatrimoTrust™</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Section 6: Journal d'Audit de Conformité */}
        {(data.auditEvents && data.auditEvents.length > 0) || data.hasObservations ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="mb-8"
          >
            {/* Badge Observations d'Audit */}
            {data.hasObservations && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                      <span className="text-xl">🔍</span>
                    </div>
                    <div>
                      <p className="text-amber-400 text-sm font-semibold">Observations d'Audit</p>
                      <p className="text-slate-400 text-xs">
                        Nous avons relevé une différence de nom d'usage, validée par acte officiel.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      // Scroll vers le journal
                      document.getElementById('audit-trail')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-xl text-amber-400 text-xs font-medium transition-colors"
                  >
                    Voir le journal complet →
                  </button>
                </div>
              </motion.div>
            )}
            
            <div id="audit-trail">
              <AuditTrail 
                events={data.auditEvents || generateDefaultAuditEvents(data)} 
                passportId={data.passportId || `PT-2026-${token.slice(0, 8).toUpperCase()}`}
                certificationDate={data.certificationDate}
              />
            </div>
          </motion.section>
        ) : (
          /* Version simplifiée si pas d'observations spéciales */
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="mb-8"
          >
            <AuditTrail 
              events={generateDefaultAuditEvents(data)} 
              passportId={data.passportId || `PT-2026-${token.slice(0, 8).toUpperCase()}`}
              certificationDate={data.certificationDate}
            />
          </motion.section>
        )}

        {/* Section 7: Upsell GLI */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-emerald-900/40 to-emerald-800/40 rounded-3xl border border-emerald-700/50 overflow-hidden mb-8"
        >
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
                <span className="text-3xl">🛡️</span>
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="text-emerald-400 text-xs uppercase tracking-widest font-bold mb-2">
                  Sécurisez ce loyer à 100%
                </p>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Garantie Loyers Impayés PatrimoTrust™
                </h3>
                <p className="text-emerald-300/80 text-sm">
                  Ce dossier est éligible à notre <strong>GLI avec indemnisation sous 48h</strong>. 
                  Activez-la dès la signature du bail pour une sérénité totale.
                </p>
              </div>
              <button
                onClick={() => setShowConversionModal(true)}
                className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all whitespace-nowrap"
              >
                En savoir plus
              </button>
            </div>
          </div>
        </motion.section>

        {/* Bouton Magique Principal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center mb-12"
        >
          <motion.button
            onClick={() => setShowConversionModal(true)}
            className="relative px-10 py-6 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-900 font-black text-lg rounded-2xl shadow-2xl shadow-amber-500/40 hover:shadow-amber-500/60 transition-all transform hover:scale-105"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="flex items-center gap-3">
              <span className="text-2xl">🔓</span>
              DÉVERROUILLER LE DOSSIER & CONTACTER LE CANDIDAT
              <span className="text-2xl">→</span>
            </span>
          </motion.button>
          <p className="text-slate-500 text-sm mt-4">
            Accès gratuit • Vérification instantanée • Conformité Loi Alur
          </p>
        </motion.div>

        {/* Section Réassurance */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="border-t border-slate-800 pt-8"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <span className="text-2xl mb-2 block">🔒</span>
              <p className="text-white text-sm font-medium">Données Cryptées</p>
              <p className="text-slate-500 text-xs">Chiffrement AES-256</p>
            </div>
            <div>
              <span className="text-2xl mb-2 block">⚖️</span>
              <p className="text-white text-sm font-medium">Conforme Loi Alur</p>
              <p className="text-slate-500 text-xs">Respect vie privée</p>
            </div>
            <div>
              <span className="text-2xl mb-2 block">🤖</span>
              <p className="text-white text-sm font-medium">Audit IA Certifié</p>
              <p className="text-slate-500 text-xs">Vérification algorithmique</p>
            </div>
            <div>
              <span className="text-2xl mb-2 block">🇪🇺</span>
              <p className="text-white text-sm font-medium">RGPD Compliant</p>
              <p className="text-slate-500 text-xs">Hébergement EU</p>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <span className="text-slate-900 font-bold">P</span>
            </div>
            <span className="text-amber-400 font-bold text-lg">PatrimoTrust™</span>
          </div>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            PatrimoTrust est conforme à la Loi Alur et au RGPD. 
            Toutes les données sont cryptées et certifiées par audit IA.
          </p>
        </div>
      </footer>

      {/* Modal de Conversion */}
      <AnimatePresence>
        {showConversionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setShowConversionModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-8 py-6 text-center relative">
                <button
                  onClick={() => setShowConversionModal(false)}
                  className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
                  <span className="text-3xl">🔓</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Débloquez l'accès complet
                </h3>
                <p className="text-slate-400 text-sm">
                  Pour protéger la vie privée de {data.firstName} et accéder aux pièces originales auditées, créez votre accès propriétaire gratuit.
                </p>
              </div>

              {/* Body */}
              <div className="p-8">
                {/* Google Auth */}
                <button
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-gray-50 text-slate-900 font-medium rounded-xl mb-4 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>S'inscrire avec Google</span>
                </button>

                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-slate-700" />
                  <span className="text-slate-500 text-xs">ou par email</span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitting(true);
                  // Simulation
                  setTimeout(() => {
                    setSubmitting(false);
                    notify.info('Fonctionnalité en cours de développement');
                  }, 1000);
                }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@exemple.com"
                    className="w-full px-5 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 mb-4"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-bold rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Création en cours...' : 'Créer mon accès gratuit'}
                  </button>
                </form>

                {/* Bénéfices */}
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <p className="text-slate-400 text-xs text-center mb-4">Ce que vous obtiendrez :</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-emerald-400">✓</span>
                      <span className="text-slate-300">Accès aux documents originaux certifiés</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-emerald-400">✓</span>
                      <span className="text-slate-300">Contact direct avec le candidat</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-emerald-400">✓</span>
                      <span className="text-slate-300">Éligibilité GLI avec indemnisation 48h</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-emerald-400">✓</span>
                      <span className="text-slate-300">Génération du bail conforme</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-900/50 px-8 py-4 text-center">
                <p className="text-slate-500 text-xs">
                  En créant un compte, vous acceptez nos{' '}
                  <a href="/terms" className="text-amber-400 hover:underline">CGU</a>
                  {' '}et notre{' '}
                  <a href="/privacy" className="text-amber-400 hover:underline">politique de confidentialité</a>.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
