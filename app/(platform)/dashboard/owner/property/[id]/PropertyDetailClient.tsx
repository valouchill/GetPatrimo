'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface Candidature {
  id: string;
  token: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
  };
  patrimometer: {
    score: number;
    grade: string;
  };
  diditStatus: string;
  income?: {
    monthly: number;
    type: string;
    verified: boolean;
  };
  effortRate?: number;
  guarantor?: {
    status: string;
    type: string;
  };
  documentsComplete: boolean;
  submittedAt: string;
  isUnlocked?: boolean;
}

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  rent: number;
  status: 'ACTIVE' | 'PENDING' | 'RENTED';
  views: number;
  shareLink: string;
  shortLink: string;
}

export default function PropertyDetailClient({ propertyId }: { propertyId: string }) {
  const [property, setProperty] = useState<Property | null>(null);
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Fetch from API
    // Simulation data
    setTimeout(() => {
      setProperty({
        id: propertyId,
        name: 'Résidence rue des Minimes',
        address: '24 rue des Minimes',
        city: 'Lyon 5ème',
        rent: 850,
        status: 'ACTIVE',
        views: 147,
        shareLink: `https://getpatrimo.com/apply/${propertyId}`,
        shortLink: 'patrimo.link/minimes',
      });

      setCandidatures([
        {
          id: '1',
          token: 'abc123',
          profile: { firstName: 'Louna', lastName: 'Cogoni', email: 'louna@email.com' },
          patrimometer: { score: 98, grade: 'SOUVERAIN' },
          diditStatus: 'VERIFIED',
          income: { monthly: 3250, type: 'CDI', verified: true },
          effortRate: 28,
          guarantor: { status: 'CERTIFIED', type: 'PatrimoTrust' },
          documentsComplete: true,
          submittedAt: '2026-02-02T14:30:00Z',
          isUnlocked: false,
        },
        {
          id: '2',
          token: 'def456',
          profile: { firstName: 'Thomas', lastName: 'Martin', email: 'thomas@email.com' },
          patrimometer: { score: 82, grade: 'A' },
          diditStatus: 'VERIFIED',
          income: { monthly: 2800, type: 'CDI', verified: true },
          effortRate: 32,
          guarantor: { status: 'PENDING', type: 'Physical' },
          documentsComplete: true,
          submittedAt: '2026-02-01T10:15:00Z',
          isUnlocked: false,
        },
        {
          id: '3',
          token: 'ghi789',
          profile: { firstName: 'Marie', lastName: 'Durand', email: 'marie@email.com' },
          patrimometer: { score: 65, grade: 'B' },
          diditStatus: 'VERIFIED',
          income: { monthly: 2200, type: 'CDD', verified: true },
          effortRate: 38,
          documentsComplete: false,
          submittedAt: '2026-01-30T16:45:00Z',
          isUnlocked: false,
        },
      ]);
      setLoading(false);
    }, 500);
  }, [propertyId]);

  const handleCopyLink = () => {
    if (property) {
      navigator.clipboard.writeText(property.shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const getGradeConfig = (grade: string) => {
    if (grade === 'SOUVERAIN' || grade === 'S') {
      return {
        label: 'GRADE S - SOUVERAIN',
        emoji: '🏆',
        colors: 'from-amber-400 via-yellow-400 to-amber-500',
        textColor: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        glow: 'shadow-amber-500/20',
      };
    }
    if (grade === 'A' || grade === 'PREMIUM') {
      return {
        label: 'GRADE A - PREMIUM',
        emoji: '⭐',
        colors: 'from-emerald-400 to-emerald-600',
        textColor: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        glow: 'shadow-emerald-500/10',
      };
    }
    if (grade === 'B' || grade === 'STANDARD') {
      return {
        label: 'GRADE B - STANDARD',
        emoji: '✓',
        colors: 'from-blue-400 to-blue-600',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        glow: '',
      };
    }
    return {
      label: `GRADE ${grade}`,
      emoji: '○',
      colors: 'from-slate-300 to-slate-400',
      textColor: 'text-slate-600',
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-200',
      glow: '',
    };
  };

  const sortedCandidatures = [...candidatures].sort((a, b) => b.patrimometer.score - a.patrimometer.score);
  const topCandidate = sortedCandidatures[0];
  const otherCandidates = sortedCandidatures.slice(1);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header Crystal */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard/owner" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Retour</span>
            </Link>
            
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">PatrimoTrust™</span>
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="max-w-6xl mx-auto px-6 pb-4">
          <div className="flex items-center justify-center gap-8">
            {[
              { label: 'Recherche', done: true },
              { label: 'Sélection', active: true },
              { label: 'Signature', done: false },
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step.done ? 'bg-emerald-500 text-white' :
                    step.active ? 'bg-amber-400 text-white ring-4 ring-amber-100' :
                    'bg-slate-200 text-slate-400'
                  }`}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm font-medium ${
                    step.active ? 'text-slate-900' : step.done ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`w-16 h-0.5 rounded-full ${step.done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Property Header - Statutaire */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Georgia, Playfair Display, serif' }}>
                  {property?.name}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">En Recrutement</span>
                </span>
              </div>
              <p className="text-slate-500">{property?.address}, {property?.city}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>{property?.rent}€</p>
              <p className="text-sm text-slate-400">/mois</p>
            </div>
          </div>
        </motion.div>

        {/* Performance Panel - Glassmorphism Premium */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10 bg-white/70 backdrop-blur-xl rounded-3xl border border-slate-200/50 shadow-xl overflow-hidden"
        >
          <div className="p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              {/* Gauche - Les Chiffres Clés */}
              <div className="flex items-center gap-10">
                <div className="text-center">
                  <p className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
                    {property?.views}
                  </p>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Vues</p>
                </div>
                <div className="w-px h-12 bg-slate-200" />
                <div className="text-center">
                  <p className="text-4xl font-bold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
                    {candidatures.length}
                  </p>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Candidatures</p>
                </div>
                <div className="w-px h-12 bg-slate-200" />
                <div className="text-center">
                  <p className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent" style={{ fontFamily: 'Georgia, serif' }}>
                    {topCandidate?.patrimometer.score || 0}/100
                  </p>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">Meilleur Score</p>
                </div>
              </div>

              {/* Droite - Lien de Diffusion */}
              <div className="lg:border-l lg:border-slate-200 lg:pl-8">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Lien de Candidature Sécurisé</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-sm font-mono text-slate-600 truncate">{property?.shortLink}</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCopyLink}
                    className={`px-5 py-3 rounded-xl font-medium text-sm transition-all ${
                      linkCopied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40'
                    }`}
                  >
                    {linkCopied ? '✓ Copié !' : 'Copier'}
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Section Titre */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800">
            Sélection des Meilleurs Profils
          </h2>
          <span className="text-sm text-slate-400">
            Triés par PatrimoScore™
          </span>
        </div>

        {/* Liste des Candidats */}
        <div className="space-y-6">
          {/* Top Candidat - Grade S - Mise en avant Premium */}
          {topCandidate && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`relative bg-white rounded-3xl border-2 overflow-hidden ${
                topCandidate.patrimometer.grade === 'SOUVERAIN' || topCandidate.patrimometer.grade === 'S'
                  ? 'border-amber-300 shadow-2xl shadow-amber-500/20'
                  : 'border-emerald-300 shadow-xl shadow-emerald-500/10'
              }`}
            >
              {/* Lueur de fond */}
              {(topCandidate.patrimometer.grade === 'SOUVERAIN' || topCandidate.patrimometer.grade === 'S') && (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/50 pointer-events-none" />
              )}
              
              <div className="relative p-8">
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Gauche - Avatar et Badge */}
                  <div className="flex flex-col items-center lg:items-start gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-28 h-28 bg-gradient-to-br from-slate-200 to-slate-300 rounded-2xl flex items-center justify-center overflow-hidden">
                        {!topCandidate.isUnlocked ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <span className="text-5xl filter blur-sm">👤</span>
                            <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px]" />
                          </div>
                        ) : (
                          <span className="text-5xl">👤</span>
                        )}
                      </div>
                      {topCandidate.diditStatus === 'VERIFIED' && (
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center border-4 border-white shadow-lg">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Badge Grade */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4, type: 'spring' }}
                      className={`px-4 py-2 bg-gradient-to-r ${getGradeConfig(topCandidate.patrimometer.grade).colors} rounded-full shadow-lg`}
                    >
                      <span className="text-white text-sm font-bold">
                        {getGradeConfig(topCandidate.patrimometer.grade).emoji} {getGradeConfig(topCandidate.patrimometer.grade).label}
                      </span>
                    </motion.div>
                    
                    {/* Score */}
                    <div className="text-center lg:text-left">
                      <p className="text-5xl font-bold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
                        {topCandidate.patrimometer.score}
                        <span className="text-2xl text-slate-400">/100</span>
                      </p>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">PatrimoScore™</p>
                    </div>
                  </div>

                  {/* Centre - Infos */}
                  <div className="flex-1">
                    <div className="mb-4">
                      <h3 className="text-2xl font-bold text-slate-900 mb-1">
                        {topCandidate.isUnlocked 
                          ? `${topCandidate.profile.firstName} ${topCandidate.profile.lastName}`
                          : `${topCandidate.profile.firstName} ${topCandidate.profile.lastName.charAt(0)}.`
                        }
                      </h3>
                      <p className="text-emerald-600 text-sm font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Dossier certifié complet par l'IA
                      </p>
                    </div>

                    {/* Données Certifiées */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {/* Revenus */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Revenus Certifiés</p>
                        <p className="text-xl font-bold text-slate-900">
                          {topCandidate.income?.monthly.toLocaleString('fr-FR')} €<span className="text-sm font-normal text-slate-500">/mois</span>
                        </p>
                        {topCandidate.income?.verified && (
                          <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] text-emerald-700 font-medium">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {topCandidate.income.type} Confirmé
                          </span>
                        )}
                      </div>

                      {/* Solvabilité */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Solvabilité</p>
                        <p className="text-xl font-bold text-emerald-600">Excellente</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Taux d'effort : <span className="font-semibold text-slate-700">{topCandidate.effortRate}%</span>
                        </p>
                      </div>

                      {/* Garantie */}
                      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
                        <p className="text-xs text-emerald-600 uppercase tracking-wider mb-1">Garantie</p>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🛡️</span>
                          <div>
                            <p className="text-sm font-bold text-emerald-800">Éligible Protection Totale</p>
                            <p className="text-xs text-emerald-600">Garantie PatrimoTrust™</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Date de candidature */}
                    <p className="text-xs text-slate-400">
                      Candidature reçue le {new Date(topCandidate.submittedAt).toLocaleDateString('fr-FR', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Droite - CTA */}
                  <div className="flex flex-col items-center lg:items-end justify-center gap-4">
                    <motion.button
                      whileHover={{ scale: 1.03, boxShadow: '0 20px 40px -10px rgba(245, 158, 11, 0.4)' }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full lg:w-auto px-8 py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-white text-lg font-bold rounded-2xl shadow-xl shadow-amber-500/30 transition-all"
                    >
                      DÉVERROUILLER CE DOSSIER
                    </motion.button>
                    <p className="text-xs text-slate-400 text-center lg:text-right">
                      Accédez aux documents vérifiés
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Autres Candidats */}
          {otherCandidates.map((candidature, index) => {
            const config = getGradeConfig(candidature.patrimometer.grade);
            
            return (
              <motion.div
                key={candidature.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className={`bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-lg ${config.borderColor}`}
              >
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-16 h-16 bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl flex items-center justify-center">
                        <span className="text-2xl filter blur-[1px]">👤</span>
                      </div>
                      {candidature.diditStatus === 'VERIFIED' && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center border-2 border-white">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h4 className="font-bold text-slate-900">
                          {candidature.profile.firstName} {candidature.profile.lastName.charAt(0)}.
                        </h4>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full bg-gradient-to-r ${config.colors} text-white`}>
                          {config.emoji} {candidature.patrimometer.grade}
                        </span>
                        <span className="text-sm font-bold text-slate-700">
                          {candidature.patrimometer.score}/100
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                        {candidature.income && (
                          <span>{candidature.income.monthly.toLocaleString('fr-FR')}€/mois • {candidature.income.type}</span>
                        )}
                        {candidature.effortRate && (
                          <span>Taux d'effort : {candidature.effortRate}%</span>
                        )}
                        {!candidature.documentsComplete && (
                          <span className="text-amber-600 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            En cours de complétion
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <button className="px-5 py-2.5 border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all text-sm">
                      Voir le profil
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* État vide */}
          {candidatures.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📋</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Aucune candidature pour le moment</h3>
              <p className="text-slate-500 mb-6">Partagez votre lien de candidature pour recevoir des dossiers certifiés.</p>
              <button
                onClick={handleCopyLink}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
              >
                Copier le lien de candidature
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-slate-400">
            PatrimoTrust™ • Standard de Confiance Immobilier 2026 • Conforme Loi Alur
          </p>
        </div>
      </footer>
    </div>
  );
}
