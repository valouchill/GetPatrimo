'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useFetch } from '@/app/hooks/useFetch';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Copy, Download, Eye, Loader2, Send, Share2, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sharePassportByEmail } from '@/app/actions/share-passport';
import {
  ActionBar,
  MetricTile,
  PremiumSectionHeader,
  PremiumSurface,
  StatusBadge,
} from '@/app/components/ui/premium';

interface PassportData {
  state: 'draft' | 'review' | 'ready' | 'sealed';
  stateLabel: string;
  shareEnabled: boolean;
  previewUrl: string | null;
  shareUrl: string | null;
  downloadUrl: string | null;
  score: number;
  summary: string;
  hero: {
    fullName: string;
    gradeLabel: string;
    profession: string;
    region: string;
    badge: string;
  };
  solvency: {
    exactMonthlyIncomeLabel: string | null;
    effortRateLabel: string | null;
  };
  guarantee: {
    label: string;
    status: string;
  };
  readinessReasons: string[];
  warnings: string[];
  metrics: {
    viewCount: number;
    shareCount: number;
    passportId: string;
    certificationDate: string | null;
    validUntil: string | null;
  };
}

export default function SuccessClient({
  candidatureId,
  ownerName,
}: {
  candidatureId?: string;
  ownerName?: string;
}) {
  const { data: passport, loading, error: passportError } = useFetch<PassportData>(
    candidatureId ? `/api/passport/application/${candidatureId}` : null
  );
  const loadError = !!passportError;
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailRecipientName, setEmailRecipientName] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  const launchConfetti = useCallback(() => {
    const duration = 2600;
    const animationEnd = Date.now() + duration;
    const colors = ['#0F766E', '#D97706', '#111827', '#14B8A6', '#FBBF24'];
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        window.clearInterval(interval);
        return;
      }
      const particleCount = 40 * (timeLeft / duration);
      confetti({
        particleCount: Math.floor(particleCount),
        startVelocity: 26,
        spread: 340,
        origin: { x: randomInRange(0.08, 0.26), y: Math.random() - 0.2 },
        colors,
        ticks: 70,
        gravity: 0.8,
        scalar: 1.1,
      });
      confetti({
        particleCount: Math.floor(particleCount),
        startVelocity: 26,
        spread: 340,
        origin: { x: randomInRange(0.74, 0.92), y: Math.random() - 0.2 },
        colors,
        ticks: 70,
        gravity: 0.8,
        scalar: 1.1,
      });
    }, 240);
  }, []);

  useEffect(() => {
    if (passport) {
      setTimeout(() => launchConfetti(), 500);
    }
  }, [passport, launchConfetti]);

  const handleOpenPreview = () => {
    const url = passport?.shareUrl || passport?.previewUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async () => {
    const url = passport?.shareUrl || passport?.previewUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPdf = async () => {
    const url = passport?.downloadUrl;
    if (!url) return;
    setDownloadingPdf(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('pdf-download-failed');
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `Passeport_PatrimoTrust_${passport?.hero.fullName || 'Dossier'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidatureId || !emailRecipient) return;
    setSendingEmail(true);
    setEmailError('');
    try {
      const result = await sharePassportByEmail(candidatureId, {
        recipientEmail: emailRecipient,
        recipientName: emailRecipientName || undefined,
        personalMessage: emailMessage || undefined,
      });
      if (result.success) {
        setEmailSent(true);
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailSent(false);
          setEmailRecipient('');
          setEmailRecipientName('');
          setEmailMessage('');
        }, 1900);
      } else {
        setEmailError(result.error || "Erreur lors de l'envoi");
      }
    } catch {
      setEmailError('Erreur technique. Veuillez réessayer.');
    } finally {
      setSendingEmail(false);
    }
  };

  const ownerLabel = ownerName ? decodeURIComponent(ownerName) : 'Le propriétaire';
  const highlights = passport?.warnings?.slice(0, 3).length
    ? passport.warnings.slice(0, 3)
    : passport?.readinessReasons || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(180deg,#f8fafc,#fff7ed)]">
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-200" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          </div>
          <p className="text-sm text-slate-500">Scellement du passeport en cours…</p>
        </div>
      </div>
    );
  }

  if (!candidatureId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(180deg,#f8fafc,#fff7ed)] p-6">
        <div className="max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-600">Cette page est réservée aux candidats ayant transmis leur dossier.</p>
        </div>
      </div>
    );
  }

  if (loadError || !passport) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(180deg,#f8fafc,#fff7ed)] p-6">
        <div className="max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-600">Impossible de charger votre passeport.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#fffaf0_45%,#f8fafc_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-[radial-gradient(circle_at_top,#fff8dc,transparent_38%),linear-gradient(135deg,#0f172a,#111827_40%,#0f766e)] p-8 text-white shadow-[0_35px_100px_-55px_rgba(15,23,42,0.85)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <StatusBadge tone="premium" label={`Passeport ${passport.stateLabel}`} />
            <StatusBadge tone="neutral" label={passport.hero.gradeLabel} className="bg-white text-slate-950" />
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="min-w-0">
              <h1 className="break-words font-serif text-4xl tracking-tight sm:text-5xl">
                {passport.hero.fullName}
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-slate-200">{passport.summary}</p>
              <p className="mt-4 break-anywhere text-sm uppercase tracking-[0.2em] text-slate-300">
                {ownerLabel} a été notifié • Passeport ID {passport.metrics.passportId}
              </p>

              <ActionBar className="mt-8">
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-50"
                >
                  <Eye className="h-4 w-4" />
                  Voir la page web
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
                >
                  {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Télécharger le PDF
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Lien copié' : 'Copier le lien'}
                </button>
              </ActionBar>
            </div>

            <div className="min-w-0 rounded-[1.9rem] border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-300">Synthèse du passeport</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricTile label="Score" value={passport.score} tone="dark" valueClassName="text-3xl font-black" />
                <MetricTile label="Garantie" value={passport.guarantee.label} caption={passport.guarantee.status} tone="dark" valueClassName="text-sm sm:text-base" />
                <MetricTile label="Revenus" value={passport.solvency.exactMonthlyIncomeLabel || 'En attente'} tone="dark" valueClassName="text-sm sm:text-base" />
                <MetricTile label="Validité" value={passport.metrics.validUntil || 'À confirmer'} tone="dark" valueClassName="text-sm sm:text-base" />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45 }}
            className="min-w-0"
          >
            <PremiumSurface className="h-full">
              <PremiumSectionHeader
                eyebrow="Ce que voit un propriétaire"
                title="Un passeport riche, prêt à envoyer"
                description="Votre lien partageable et votre PDF montrent la synthèse de solvabilité, la garantie, la couverture documentaire et le journal d’audit, sans exposer vos pièces brutes ni vos coordonnées sensibles."
              />

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <MetricTile
                  label="Page web"
                  value="Version publique masquée"
                  caption="Nom masqué, revenus arrondis, région au lieu de l’adresse complète."
                />
                <MetricTile
                  label="PDF"
                  value="Document premium multi-pages"
                  caption="Score, garantie, 4 piliers, matrice documentaire et QR de vérification."
                />
              </div>

              <button
                type="button"
                onClick={() => setShowEmailModal(true)}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <Share2 className="h-4 w-4" />
                Envoyer par email à un propriétaire
              </button>
            </PremiumSurface>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.45 }}
            className="min-w-0"
          >
            <PremiumSurface className="h-full">
              <PremiumSectionHeader eyebrow="Points saillants" title="Lecture d’audit" />

              <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-700">
                {highlights.length > 0 ? (
                  highlights.map((item) => (
                    <li key={item} className="break-anywhere">• {item}</li>
                  ))
                ) : (
                  <li>• Aucun point d’attention critique n’a été remonté lors du scellement.</li>
                )}
              </ul>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <MetricTile label="Consultations" value={passport.metrics.viewCount} />
                <MetricTile label="Partages" value={passport.metrics.shareCount} />
              </div>
            </PremiumSurface>
          </motion.section>
        </div>
      </div>

      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between bg-[linear-gradient(135deg,#0f766e,#0f172a)] px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-white">Partager mon passeport</h3>
                  <p className="text-xs text-emerald-100">Envoyez votre lien certifié à un propriétaire</p>
                </div>
                <button type="button" onClick={() => setShowEmailModal(false)} className="text-emerald-100 transition hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {emailSent ? (
                <div className="p-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h4 className="text-xl font-semibold text-slate-900">Email envoyé</h4>
                  <p className="mt-2 text-sm text-slate-500">Votre passeport a bien été partagé.</p>
                </div>
              ) : (
                <form onSubmit={handleSendEmail} className="space-y-4 p-6">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Email du propriétaire *</label>
                    <input
                      type="email"
                      required
                      value={emailRecipient}
                      onChange={(e) => setEmailRecipient(e.target.value)}
                      placeholder="proprietaire@example.com"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Nom du propriétaire</label>
                    <input
                      type="text"
                      value={emailRecipientName}
                      onChange={(e) => setEmailRecipientName(e.target.value)}
                      placeholder="Mme Martin"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Message personnel</label>
                    <textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      rows={3}
                      placeholder="Bonjour, suite à notre échange..."
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  {emailError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {emailError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={sendingEmail || !emailRecipient}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {sendingEmail ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    Envoyer le passeport
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
