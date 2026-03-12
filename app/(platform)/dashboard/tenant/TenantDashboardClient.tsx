'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import {
  ShieldCheckIcon,
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

interface Props {
  userEmail: string;
  userName?: string;
  applications: Application[];
  latestApplication: Application | null;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SOUVERAIN: { bg: 'bg-gradient-to-br from-amber-400 to-amber-600', text: 'text-amber-900', border: 'border-amber-400' },
  A: { bg: 'bg-gradient-to-br from-emerald-400 to-emerald-600', text: 'text-emerald-900', border: 'border-emerald-400' },
  B: { bg: 'bg-gradient-to-br from-blue-400 to-blue-600', text: 'text-blue-900', border: 'border-blue-400' },
  C: { bg: 'bg-gradient-to-br from-cyan-400 to-cyan-600', text: 'text-cyan-900', border: 'border-cyan-400' },
  D: { bg: 'bg-gradient-to-br from-slate-400 to-slate-600', text: 'text-slate-900', border: 'border-slate-400' },
  E: { bg: 'bg-gradient-to-br from-orange-400 to-orange-600', text: 'text-orange-900', border: 'border-orange-400' },
  F: { bg: 'bg-gradient-to-br from-red-400 to-red-600', text: 'text-red-900', border: 'border-red-400' },
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
  latestApplication 
}: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'candidatures'>('overview');

  const app = latestApplication;
  const firstName = app?.profile?.firstName || userName?.split(' ')[0] || 'Locataire';
  const grade = app?.patrimometer?.grade || 'F';
  const score = app?.patrimometer?.score || 0;
  const gradeStyle = GRADE_COLORS[grade] || GRADE_COLORS.F;

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
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-navy to-slate-700 rounded-xl flex items-center justify-center">
                <ShieldCheckIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-navy">PatrimoTrust™</h1>
                <p className="text-xs text-slate-500">Espace Locataire</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">{userEmail}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span className="text-sm">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Hero Section - PatrimoMeter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mb-8"
        >
          <div className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              {/* Salutation et message */}
              <div className="flex-1">
                <h2 className="text-3xl md:text-4xl font-serif text-navy mb-2">
                  Bonjour {firstName} 👋
                </h2>
                <p className="text-slate-600 text-lg">{getWelcomeMessage()}</p>
                
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
              </div>

              {/* PatrimoMeter Badge */}
              <div className="flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  className={`w-32 h-32 ${gradeStyle.bg} rounded-3xl flex flex-col items-center justify-center shadow-2xl`}
                >
                  <span className="text-white/80 text-xs font-bold uppercase tracking-wider">Grade</span>
                  <span className="text-white text-5xl font-black">{grade === 'SOUVERAIN' ? '👑' : grade}</span>
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
          </div>
        </motion.div>

        {/* Onglets */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: HomeIcon },
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
              status={app?.documents?.some(d => d.category === 'income' && d.status === 'certified') ? 'certified' : 'pending'}
              description={app?.documents?.some(d => d.category === 'income' && d.status === 'certified') ? 'Revenus certifiés' : 'À compléter'}
              points={app?.documents?.some(d => d.category === 'income' && d.status === 'certified') ? 25 : 0}
              href={app?.applyToken ? `/apply/${app.applyToken}` : undefined}
            />

            {/* Carte Domicile */}
            <DocumentCard
              icon="🏠"
              title="Domicile"
              status={app?.documents?.some(d => d.category === 'address' && d.status === 'certified') ? 'certified' : 'pending'}
              description={app?.documents?.some(d => d.category === 'address' && d.status === 'certified') ? 'Justificatif validé' : 'À compléter'}
              points={app?.documents?.some(d => d.category === 'address' && d.status === 'certified') ? 10 : 0}
              href={app?.applyToken ? `/apply/${app.applyToken}` : undefined}
            />

            {/* Carte Garant */}
            <DocumentCard
              icon="🤝"
              title="Garant"
              status={app?.guarantor?.status === 'CERTIFIED' || app?.guarantor?.status === 'AUDITED' ? 'certified' : 'pending'}
              description={
                app?.guarantor?.status === 'CERTIFIED' ? 'Certifié Didit' :
                app?.guarantor?.status === 'AUDITED' ? 'Audité PatrimoTrust' :
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

        {activeTab === 'documents' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-navy">Mes Documents</h3>
              <p className="text-sm text-slate-500">Tous vos documents uploadés et certifiés</p>
            </div>
            
            {app?.documents && app.documents.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {app.documents.map((doc, index) => (
                  <div key={doc.id || index} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      doc.status === 'certified' ? 'bg-emerald-100' :
                      doc.status === 'flagged' ? 'bg-amber-100' :
                      doc.status === 'rejected' ? 'bg-red-100' : 'bg-slate-100'
                    }`}>
                      {doc.status === 'certified' ? (
                        <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
                      ) : doc.status === 'rejected' ? (
                        <ExclamationCircleIcon className="w-6 h-6 text-red-600" />
                      ) : (
                        <DocumentTextIcon className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{doc.fileName}</p>
                      <p className="text-sm text-slate-500">{doc.type || doc.category}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      doc.status === 'certified' ? 'bg-emerald-100 text-emerald-700' :
                      doc.status === 'flagged' ? 'bg-amber-100 text-amber-700' :
                      doc.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {doc.status === 'certified' ? '✓ Certifié' :
                       doc.status === 'flagged' ? '⚠ À vérifier' :
                       doc.status === 'rejected' ? '✗ Rejeté' : 'En attente'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <DocumentTextIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500">Aucun document uploadé</p>
                {app?.applyToken && (
                  <Link
                    href={`/apply/${app.applyToken}`}
                    className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all"
                  >
                    Ajouter des documents
                  </Link>
                )}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'candidatures' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-navy">Mes Candidatures</h3>
              <p className="text-sm text-slate-500">Suivez l&apos;état de vos candidatures</p>
            </div>
            
            {applications && applications.length > 0 ? (
              <div className="overflow-x-auto">
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
                            <p className="text-sm text-slate-500 truncate max-w-xs">{candidature.property?.address || '-'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-800">
                            {candidature.property?.rentAmount ? `${candidature.property.rentAmount}€` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-white ${GRADE_COLORS[candidature.patrimometer.grade]?.bg || 'bg-slate-400'}`}>
                            {candidature.patrimometer.grade}
                          </span>
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
            ) : (
              <div className="p-12 text-center">
                <HomeIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500">Aucune candidature en cours</p>
              </div>
            )}
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
    <div className={`bg-white rounded-2xl border ${status === 'certified' ? 'border-emerald-200' : 'border-slate-200'} p-6 hover:shadow-lg transition-all h-full`}>
      <div className="flex items-start justify-between mb-4">
        <span className="text-3xl">{icon}</span>
        {status === 'certified' && (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 rounded-full">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700">Certifié</span>
          </div>
        )}
      </div>
      <h4 className="font-bold text-navy mb-1">{title}</h4>
      <p className="text-sm text-slate-500 mb-3">{description}</p>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${points > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
          +{points} pts
        </span>
        {status === 'pending' && href && (
          <span className="text-xs text-emerald-600 font-medium">Compléter →</span>
        )}
      </div>
    </div>
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
