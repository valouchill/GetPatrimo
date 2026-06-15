'use client';

import { useState } from 'react';
import { Logo } from '@/app/components/Logo';
import { motion } from 'framer-motion';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import {
  DocumentTextIcon,
  HomeIcon,
  UserCircleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  ArrowRightOnRectangleIcon,
  SparklesIcon,
  ClockIcon,
  EyeIcon,
} from '@heroicons/react/24/solid';
import { Crown, Download } from 'lucide-react';
import {
  ActionBar,
  EmptyState,
  MetricTile,
  PremiumSectionHeader,
  PremiumSurface,
  StatusBadge,
} from '@/app/components/ui/premium';
import { applyPassportToProperty } from '@/app/actions/application-actions';

interface Document {
  id: string;
  category: string;
  type: string;
  fileName: string;
  status: string;
  uploadedAt: string;
}

interface Application {
  _id: string;
  applyToken: string;
  profile: {
    firstName: string;
    lastName: string;
  };
  tunnel: {
    currentStep: number;
    progress: number;
    lastActiveAt: string;
  };
  didit: {
    status: string;
  };
  documents: Document[];
  guarantor: {
    status: string;
    certificationMethod?: string;
  };
  patrimometer: {
    score: number;
    grade: string;
    badges: Array<{ id: string; label: string }>;
  };
  resilience?: {
    score: number;
    level: MetalLevel;
    label: string;
    scoreLabel: string;
    source: 'v2' | 'legacy';
    isV2: boolean;
    cachedAt?: string | null;
  };
  status: string;
  property?: {
    name: string;
    address: string;
    rentAmount: number;
  };
  submittedAt?: string;
  viewedByOwnerAt?: string;
  ownerDecision: string;
}

interface LeaseInfo {
  _id: string;
  property?: { name: string; address: string };
  startDate: string;
  endDate?: string;
  rentAmount: number;
  chargesAmount?: number;
  tenantFirstName?: string;
  tenantLastName?: string;
}

interface PaymentInfo {
  _id: string;
  period: { month: number; year: number };
  amounts: { totalTTC: number; paidAmount: number };
  status: string;
  property?: { name: string; address: string };
}

interface Props {
  userEmail: string;
  userName?: string;
  applications: Application[];
  latestApplication: Application | null;
  activeLease?: LeaseInfo | null;
  recentPayments?: PaymentInfo[];
}

// V6.6 — Migration vers le système métal (PLATINUM/GOLD/SILVER/ALERTE).
// Source de vérité = getMetalLevel(score). Le legacy patrimometer.grade
// (F..A..SOUVERAIN) reste en Mongo mais n'est plus consommé pour le rendu.
import {
  getMetalLevel,
  METAL_LABELS,
  type MetalLevel,
} from '@/lib/product-lexicon';

const METAL_STYLE: Record<
  MetalLevel,
  { bg: string; text: string; border: string }
> = {
  PLATINUM: {
    bg: 'bg-gradient-to-br from-slate-900 to-slate-800',
    text: 'text-amber-400',
    border: 'border-amber-500',
  },
  GOLD: {
    bg: 'bg-gradient-to-br from-amber-400 to-amber-600',
    text: 'text-amber-900',
    border: 'border-amber-400',
  },
  SILVER: {
    bg: 'bg-gradient-to-br from-slate-300 to-slate-500',
    text: 'text-slate-900',
    border: 'border-slate-400',
  },
  ALERTE: {
    bg: 'bg-gradient-to-br from-red-400 to-red-600',
    text: 'text-red-900',
    border: 'border-red-400',
  },
};

const DOCUMENT_TYPES = [
  { category: 'identity', label: "Pièce d'identité", icon: '🪪', description: 'CNI ou Passeport' },
  { category: 'income', label: 'Justificatif de revenus', icon: '💰', description: 'Bulletins de salaire, Avis imposition' },
  { category: 'address', label: 'Justificatif de domicile', icon: '🏠', description: 'Facture, Quittance' },
  { category: 'guarantor', label: 'Documents garant', icon: '🤝', description: 'Documents du garant' },
];

export default function TenantDashboardClient({
  userEmail,
  userName,
  applications,
  latestApplication,
  activeLease,
  recentPayments = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'housing' | 'documents' | 'candidatures'>('overview');

  const app = latestApplication;
  const firstName = app?.profile?.firstName || userName?.split(' ')[0] || 'Locataire';
  const score = app?.resilience?.score ?? app?.patrimometer?.score ?? 0;
  const metalLevel = app?.resilience?.level || getMetalLevel(score);
  const grade = METAL_LABELS[metalLevel]; // Affichage display (PLATINUM/GOLD/...)
  const gradeStyle = METAL_STYLE[metalLevel];

  // Message de bienvenue personnalisé
  const getWelcomeMessage = () => {
    if (!app || app.tunnel.progress === 0) {
      return "Bienvenue ! Commencez votre dossier pour obtenir votre grade.";
    }
    if (app.tunnel.progress < 50) {
      return `Votre dossier est à ${app.tunnel.progress}%. Continuez pour améliorer votre grade.`;
    }
    if (app.tunnel.progress < 100) {
      return `Excellent progrès ! Plus que quelques étapes pour atteindre le grade Souverain.`;
    }
    return "Félicitations ! Votre dossier est complet.";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:px-6 md:py-4">
          <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <Logo variant="light" className="text-xl" />
              <h1 className="sr-only">Espace locataire — Maison Patrimo</h1>
              <span className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true" />
              <p className="hidden text-xs font-medium text-slate-500 sm:block">Espace Locataire</p>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-4">
              <span className="min-w-0 break-anywhere text-sm text-slate-600">{userEmail}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span className="text-sm">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:px-6 md:py-8">
        {/* Hero Section - PatrimoMeter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <PremiumSurface padding="lg" className="overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              {/* Salutation et message */}
              <div className="min-w-0 flex-1">
                <h2 className="mb-2 text-balance text-xl font-serif text-navy md:text-3xl">
                  Bonjour {firstName} 👋
                </h2>
                <p className="text-pretty text-lg text-slate-600">{getWelcomeMessage()}</p>
                
                {app && app.tunnel.progress < 100 && app.applyToken && (
                  <Link
                    href={`/apply/${app.applyToken}`}
                    className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/30"
                  >
                    <SparklesIcon className="w-5 h-5" />
                    Reprendre mon dossier
                    <ArrowRightIcon className="w-4 h-4" />
                  </Link>
                )}
                {/* V4.1 — CTA téléchargement Passeport PDF (cohérent avec UI owner) */}
                {app && app.tunnel.progress === 100 && app._id && (
                  <a
                    href={`/api/passport/pdf/${app._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-6 ml-3 rounded-button border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                    title="Télécharger mon Passeport Locatif PDF"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Télécharger mon Passeport Locatif
                  </a>
                )}
              </div>

              {/* PatrimoMeter Badge */}
              <div className="flex flex-col items-center self-center md:self-start">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  className={`w-32 h-32 ${gradeStyle.bg} rounded-3xl flex flex-col items-center justify-center shadow-2xl`}
                >
                  <span className="text-white/80 text-xs font-bold uppercase tracking-wider">Niveau</span>
                  {metalLevel === 'PLATINUM' ? (
                    <Crown className="h-12 w-12 text-amber-400" aria-hidden="true" />
                  ) : (
                    <span className="text-white text-lg font-black tracking-[0.14em] mt-1">
                      {grade}
                    </span>
                  )}
                </motion.div>
                <div className="mt-4 text-center">
                  <p className="text-2xl font-bold text-navy">{score}/100</p>
                  <p className="text-sm text-slate-500">PatrimoMeter™</p>
                </div>
              </div>
            </div>

            {/* Barre de progression */}
            {app && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">Progression du dossier</span>
                  <span className="text-sm font-bold text-navy">{app.tunnel.progress}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${app.tunnel.progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                  />
                </div>
              </div>
            )}
          </PremiumSurface>
        </motion.div>

        {/* Onglets */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: HomeIcon },
            ...(activeLease ? [{ id: 'housing', label: 'Mon Logement', icon: HomeIcon }] : []),
            { id: 'documents', label: 'Mes Documents', icon: DocumentTextIcon },
            { id: 'candidatures', label: 'Mes Candidatures', icon: UserCircleIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-navy text-white shadow-lg'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu des onglets */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {/* Carte Identité */}
            <DocumentCard
              icon="🪪"
              title="Identité"
              status={app?.didit?.status === 'VERIFIED' ? 'certified' : 'pending'}
              description={app?.didit?.status === 'VERIFIED' ? 'Certifiée par Didit' : 'Non vérifiée'}
              points={app?.didit?.status === 'VERIFIED' ? 25 : 0}
              href={app?.applyToken ? `/apply/${app.applyToken}` : undefined}
            />

            {/* Carte Revenus */}
            <DocumentCard
              icon="💰"
              title="Revenus"
              status={app?.documents?.some(d => d.category === 'INCOME' && d.status === 'CERTIFIED') ? 'certified' : 'pending'}
              description={app?.documents?.some(d => d.category === 'INCOME' && d.status === 'CERTIFIED') ? 'Revenus certifiés' : 'À compléter'}
              points={app?.documents?.some(d => d.category === 'INCOME' && d.status === 'CERTIFIED') ? 25 : 0}
              href={app?.applyToken ? `/apply/${app.applyToken}` : undefined}
            />

            {/* Carte Domicile */}
            <DocumentCard
              icon="🏠"
              title="Domicile"
              status={app?.documents?.some(d => d.category === 'ADDRESS' && d.status === 'CERTIFIED') ? 'certified' : 'pending'}
              description={app?.documents?.some(d => d.category === 'ADDRESS' && d.status === 'CERTIFIED') ? 'Justificatif validé' : 'À compléter'}
              points={app?.documents?.some(d => d.category === 'ADDRESS' && d.status === 'CERTIFIED') ? 10 : 0}
              href={app?.applyToken ? `/apply/${app.applyToken}` : undefined}
            />

            {/* Carte Garant */}
            <DocumentCard
              icon="🤝"
              title="Garant"
              status={app?.guarantor?.status === 'CERTIFIED' || app?.guarantor?.status === 'AUDITED' ? 'certified' : 'pending'}
              description={
                app?.guarantor?.status === 'CERTIFIED' ? 'Certifié Didit' :
                app?.guarantor?.status === 'AUDITED' ? 'Audité Maison Patrimo' :
                'Non configuré'
              }
              points={
                app?.guarantor?.status === 'CERTIFIED' ? 40 :
                app?.guarantor?.status === 'AUDITED' ? 30 : 0
              }
              href={app?.applyToken ? `/apply/${app.applyToken}` : undefined}
            />
          </motion.div>
        )}

        {activeTab === 'housing' && activeLease && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Bail actif */}
            <PremiumSurface padding="md">
              <PremiumSectionHeader
                eyebrow="Bail"
                title="Mon bail actif"
                description={activeLease.property?.address || ''}
              />
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 mb-1">Loyer HC</p>
                  <p className="text-lg font-bold text-navy">{activeLease.rentAmount} €</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 mb-1">Charges</p>
                  <p className="text-lg font-bold text-navy">{activeLease.chargesAmount || 0} €</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 mb-1">Total TTC</p>
                  <p className="text-lg font-bold text-emerald-600">{(activeLease.rentAmount + (activeLease.chargesAmount || 0))} €</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 mb-1">Depuis le</p>
                  <p className="text-lg font-bold text-navy">{new Date(activeLease.startDate).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
            </PremiumSurface>

            {/* Paiements récents */}
            <PremiumSurface padding="md">
              <PremiumSectionHeader
                eyebrow="Paiements"
                title="Derniers paiements"
                description="Historique de vos 6 derniers loyers"
              />
              {recentPayments.length > 0 ? (
                <div className="mt-6 divide-y divide-slate-100">
                  {recentPayments.map((p) => {
                    const months = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                    return (
                      <div key={p._id} className="flex items-center justify-between py-3 px-2">
                        <div>
                          <p className="font-medium text-slate-800">{months[p.period.month]} {p.period.year}</p>
                          <p className="text-sm text-slate-500">{p.amounts.totalTTC.toFixed(2)} €</p>
                        </div>
                        <StatusBadge
                          tone={
                            p.status === 'CONFIRMED' ? 'success' :
                            p.status === 'PARTIAL' ? 'warning' :
                            p.status === 'LATE' || p.status === 'UNPAID' ? 'danger' : 'neutral'
                          }
                          label={
                            p.status === 'CONFIRMED' ? 'Payé' :
                            p.status === 'PARTIAL' ? 'Partiel' :
                            p.status === 'LATE' ? 'En retard' :
                            p.status === 'UNPAID' ? 'Impayé' : 'En attente'
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6">
                  <EmptyState
                    icon={<DocumentTextIcon className="w-8 h-8 text-slate-300" />}
                    title="Aucun paiement"
                    description="Vos paiements de loyer apparaîtront ici."
                  />
                </div>
              )}
            </PremiumSurface>
          </motion.div>
        )}

        {activeTab === 'documents' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0"
          >
            <PremiumSurface padding="md" className="overflow-hidden">
              <PremiumSectionHeader
                eyebrow="Documents"
                title="Mes documents"
                description="Tous vos documents uploadés et certifiés, dans une vue plus claire et plus robuste."
              />
            
            {app?.documents && app.documents.length > 0 ? (
              <div className="mt-6 divide-y divide-slate-100">
                {app.documents.map((doc, index) => (
                  <div key={doc.id || index} className="flex flex-col gap-4 p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      doc.status === 'CERTIFIED' ? 'bg-emerald-100' :
                      doc.status === 'NEEDS_REVIEW' ? 'bg-amber-100' :
                      doc.status === 'ILLEGIBLE' ? 'bg-amber-100' :
                      doc.status === 'FLAGGED' ? 'bg-amber-100' :
                      doc.status === 'REJECTED' ? 'bg-red-100' : 'bg-slate-100'
                    }`}>
                      {doc.status === 'CERTIFIED' ? (
                        <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
                      ) : doc.status === 'NEEDS_REVIEW' ? (
                        <ExclamationCircleIcon className="w-6 h-6 text-amber-600" />
                      ) : doc.status === 'ILLEGIBLE' ? (
                        <ExclamationCircleIcon className="w-6 h-6 text-amber-600" />
                      ) : doc.status === 'REJECTED' ? (
                        <ExclamationCircleIcon className="w-6 h-6 text-red-600" />
                      ) : (
                        <DocumentTextIcon className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="break-anywhere font-medium text-slate-800">{doc.fileName}</p>
                      <p className="text-sm text-slate-500">{doc.type || doc.category}</p>
                    </div>
                    <StatusBadge
                      tone={
                        doc.status === 'CERTIFIED'
                          ? 'success'
                          : doc.status === 'NEEDS_REVIEW' || doc.status === 'FLAGGED'
                            ? 'warning'
                            : doc.status === 'ILLEGIBLE'
                              ? 'warning'
                              : doc.status === 'REJECTED'
                                ? 'danger'
                                : 'neutral'
                      }
                      label={
                        doc.status === 'CERTIFIED' ? 'Certifié' :
                        doc.status === 'NEEDS_REVIEW' ? 'Revue manuelle' :
                        doc.status === 'ILLEGIBLE' ? 'Illisible' :
                        doc.status === 'FLAGGED' ? 'À vérifier' :
                        doc.status === 'REJECTED' ? 'Rejeté' : 'En attente'
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6">
                <EmptyState
                  icon={<DocumentTextIcon className="w-8 h-8 text-slate-300" />}
                  title="Aucun document uploadé"
                  description="Ajoutez vos pièces pour enrichir le dossier et améliorer le passeport locataire."
                  action={
                    app?.applyToken ? (
                      <Link
                        href={`/apply/${app.applyToken}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-600"
                      >
                        Ajouter des documents
                      </Link>
                    ) : null
                  }
                />
              </div>
            )}
            </PremiumSurface>
          </motion.div>
        )}

        {activeTab === 'candidatures' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0"
          >
            <PremiumSurface padding="md" className="overflow-hidden">
              <PremiumSectionHeader
                eyebrow="Candidatures"
                title="Mes candidatures"
                description="Suivez l’état de vos dépôts sans perdre les informations importantes sur mobile."
              />

            <ApplyToListingCard userEmail={userEmail} />

            {applications && applications.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="mt-6 hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Bien</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Loyer</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Grade</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {applications.map((candidature) => (
                        <tr key={candidature._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-slate-800">{candidature.property?.name || 'Bien immobilier'}</p>
                              <p className="max-w-xs break-anywhere text-sm text-slate-500">{candidature.property?.address || '-'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-800">
                              {candidature.property?.rentAmount ? `${candidature.property.rentAmount}€` : '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const lvl = candidature.resilience?.level || getMetalLevel(
                                candidature.resilience?.score ?? candidature.patrimometer?.score ?? 0,
                              );
                              return (
                                <span
                                  className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white ${METAL_STYLE[lvl].bg}`}
                                  title={METAL_LABELS[lvl]}
                                >
                                  {lvl === 'PLATINUM' && (
                                    <span aria-hidden="true" className="mr-1">★</span>
                                  )}
                                  {METAL_LABELS[lvl]}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            <CandidatureStatus
                              status={candidature.status}
                              viewedAt={candidature.viewedByOwnerAt}
                              decision={candidature.ownerDecision}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              href={`/apply/${candidature.applyToken}`}
                              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                            >
                              Voir <ArrowRightIcon className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="mt-6 space-y-3 md:hidden">
                  {applications.map((candidature) => (
                    <div key={candidature._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start gap-3">
                        {(() => {
                          const lvl = candidature.resilience?.level || getMetalLevel(
                            candidature.resilience?.score ?? candidature.patrimometer?.score ?? 0,
                          );
                          return (
                            <span
                              className={`inline-flex shrink-0 items-center justify-center rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white ${METAL_STYLE[lvl].bg}`}
                              title={METAL_LABELS[lvl]}
                            >
                              {lvl === 'PLATINUM' && (
                                <span aria-hidden="true" className="mr-1">★</span>
                              )}
                              {METAL_LABELS[lvl]}
                            </span>
                          );
                        })()}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">{candidature.property?.name || 'Bien immobilier'}</p>
                          <p className="truncate text-xs text-slate-500">{candidature.property?.address || '-'}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">
                          {candidature.property?.rentAmount ? `${candidature.property.rentAmount} €/mois` : '-'}
                        </span>
                        <CandidatureStatus
                          status={candidature.status}
                          viewedAt={candidature.viewedByOwnerAt}
                          decision={candidature.ownerDecision}
                        />
                      </div>
                      <div className="mt-3">
                        <Link
                          href={`/apply/${candidature.applyToken}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          Voir le dossier <ArrowRightIcon className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-6">
                <EmptyState
                  icon={<HomeIcon className="mx-auto h-8 w-8 text-slate-300" />}
                  title="Aucune candidature en cours"
                  description="Vos candidatures apparaîtront ici dès qu’un dossier sera envoyé."
                />
              </div>
            )}
            </PremiumSurface>
          </motion.div>
        )}
      </main>
    </div>
  );
}

// Composant carte document
function DocumentCard({ 
  icon, 
  title, 
  status, 
  description, 
  points, 
  href 
}: { 
  icon: string; 
  title: string; 
  status: 'certified' | 'pending' | 'flagged'; 
  description: string; 
  points: number;
  href?: string;
}) {
  const content = (
    <PremiumSurface className={`h-full ${status === 'certified' ? 'border-emerald-200' : 'border-slate-200'} hover:shadow-lg transition-all`} padding="sm">
      <div className="flex items-start justify-between mb-4">
        <span className="text-3xl">{icon}</span>
        {status === 'certified' ? <StatusBadge tone="success" label="Certifié" /> : null}
      </div>
      <h4 className="mb-1 break-words font-bold text-navy">{title}</h4>
      <p className="mb-3 text-sm text-slate-500">{description}</p>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${points > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
          +{points} pts
        </span>
        {status === 'pending' && href && (
          <span className="text-xs text-emerald-600 font-medium">Compléter →</span>
        )}
      </div>
    </PremiumSurface>
  );

  if (href && status === 'pending') {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// Composant statut candidature
function CandidatureStatus({ 
  status, 
  viewedAt, 
  decision 
}: { 
  status: string; 
  viewedAt?: string; 
  decision: string;
}) {
  if (decision === 'ACCEPTED') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
        <CheckCircleIcon className="w-4 h-4" /> Accepté
      </span>
    );
  }
  
  if (decision === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
        <ExclamationCircleIcon className="w-4 h-4" /> Refusé
      </span>
    );
  }

  if (viewedAt) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
        <EyeIcon className="w-4 h-4" /> Lu par le propriétaire
      </span>
    );
  }

  if (status === 'SUBMITTED') {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
        <ClockIcon className="w-4 h-4" /> Dossier envoyé
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
      <ClockIcon className="w-4 h-4" /> En cours
    </span>
  );
}

/**
 * Carte « Postuler à une annonce » — réutilise le Passeport Locatif universel
 * du locataire pour candidater à un bien via son code (Phase 5).
 */
function ApplyToListingCard({ userEmail }: { userEmail: string }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await applyPassportToProperty(userEmail, c);
      if (!res.success) {
        setError(res.error || 'Erreur lors de la candidature.');
      } else if (res.submitted) {
        setSuccess(res.message || 'Votre dossier a été transmis au propriétaire.');
        setCode('');
      } else {
        // Dossier rattaché mais incomplet → le compléter dans le tunnel.
        window.location.href = `/apply/${c}`;
        return;
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <ArrowRightIcon className="h-4 w-4 text-emerald-700" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            Postuler à une annonce avec mon Passeport
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Un propriétaire vous a transmis un code&nbsp;? Candidatez en un clic — votre
            dossier certifié est réutilisé.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); setSuccess(null); }}
              placeholder="Code du bien (ex : PT-75001-K7M9)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium uppercase tracking-wide text-slate-800 outline-none transition-colors focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Envoi…' : 'Postuler'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
          {success && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircleIcon className="h-3.5 w-3.5" /> {success}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
