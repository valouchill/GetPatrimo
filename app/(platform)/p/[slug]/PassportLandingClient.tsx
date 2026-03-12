'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, FileCheck, Euro, Lock, Loader2, ArrowRight } from 'lucide-react';
import UpsellBanner from '@/app/components/UpsellBanner';

interface PassportPublicData {
  firstName: string;
  lastName: string;
  grade: string;
  monthlyNetIncome: number;
  propertyName?: string;
  hasDocs: boolean;
  docCount: number;
}

export default function PassportLandingClient({ slug }: { slug: string }) {
  const [data, setData] = useState<PassportPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (slug.startsWith('PT-')) {
      window.location.href = `/apply/${slug}`;
      return;
    }
    fetch(`/api/passport/public/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const ctaUrl = `${baseUrl}/auth/login`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center text-slate-600">
          <p className="font-semibold">Ce lien de passeport est invalide ou a expiré.</p>
          <p className="text-sm mt-2">Demandez au locataire de vous renvoyer le lien.</p>
        </div>
      </div>
    );
  }

  const displayName = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Le candidat';
  const gradeLabel = data.grade === 'SOUVERAIN' ? 'SOUVERAIN' : data.grade || 'Certifié';
  const incomeLabel = data.monthlyNetIncome
    ? `Revenus nets mensuels : ${Number(data.monthlyNetIncome).toLocaleString('fr-FR')} €`
    : 'Revenus vérifiés';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white font-sans">
      {/* Bandeau d'acquisition propriétaire — sticky top */}
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm"
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-slate-700 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>
              Ce dossier est certifié par <strong className="text-slate-900">PatrimoTrust</strong>.
              <span className="hidden sm:inline"> Vous êtes propriétaire ? Sécurisez vos locations dès aujourd&apos;hui.</span>
            </span>
          </p>
          <a
            href="/auth/login"
            className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm px-5 py-2 rounded-lg transition-colors shrink-0"
          >
            Découvrir <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </motion.div>

      <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
        <motion.header
          className="text-center mb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-emerald-300 text-sm font-medium mb-6">
            <ShieldCheck className="w-4 h-4" />
            Dossier certifié par IA
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Vous avez reçu un dossier certifié par IA
          </h1>
          <p className="text-slate-300 text-lg">
            Grade de Solvabilité : <span className="font-bold text-amber-400">{gradeLabel}</span>
          </p>
        </motion.header>

        <motion.section
          className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 mb-8"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h2 className="text-slate-200 font-semibold mb-4 text-sm uppercase tracking-wider">
            Aperçu du dossier
          </h2>
          <ul className="space-y-4">
            <li className="flex items-center gap-3 text-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <FileCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <span className="font-medium text-white">{displayName}</span>
                <span className="text-slate-400 text-sm block">Identité vérifiée</span>
              </div>
            </li>
            <li className="flex items-center gap-3 text-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Euro className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="font-medium text-white">{incomeLabel}</span>
                <span className="text-slate-400 text-sm block">Revenus audités</span>
              </div>
            </li>
            <li className="flex items-center gap-3 text-slate-100">
              <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <span className="font-medium text-white">
                  {data.docCount} pièce(s) justificative(s) auditées
                </span>
                <span className="text-slate-400 text-sm block">
                  Pour consulter les pièces et bénéficier de la Protection Impayés PatrimoTrust, créez votre compte gratuit.
                </span>
              </div>
            </li>
          </ul>
        </motion.section>

        <motion.p
          className="text-slate-300 text-center mb-8 text-sm md:text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Identité, Revenus et Garanties déjà vérifiés. <strong className="text-white">Gagnez 48h</strong> sur votre mise en location.
        </motion.p>

        <motion.div
          className="text-center mb-24"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <a
            href={ctaUrl}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4 rounded-xl text-lg uppercase tracking-wide shadow-lg hover:shadow-emerald-500/30 transition-all"
          >
            Accéder au dossier complet (gratuit)
            <ArrowRight className="w-5 h-5" />
          </a>
          <p className="text-slate-400 text-xs mt-4">
            Créez votre compte gratuit pour débloquer les pièces justificatives et la Protection Impayés PatrimoTrust.
          </p>
        </motion.div>

        <UpsellBanner
          passportSlug={slug}
          candidateName={displayName}
        />
      </div>
    </div>
  );
}
