'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Loader2, CheckCircle2, Download, Send, X, Share2 } from 'lucide-react';
import { sharePassportByEmail } from '@/app/actions/share-passport';
import confetti from 'canvas-confetti';

interface PassportData {
  slug: string;
  shareUrl: string;
  viewCount: number;
  shareCount: number;
  lastViewedAt: string | null;
  grade: string;
  firstName: string;
  score?: number;
}

export default function SuccessClient({
  candidatureId,
  ownerName,
}: {
  candidatureId?: string;
  ownerName?: string;
}) {
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [loading, setLoading] = useState(!!candidatureId);
  const [loadError, setLoadError] = useState(false);
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
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const colors = ['#10B981', '#D4AF37', '#F59E0B', '#34D399', '#FBBF24'];
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) { clearInterval(interval); return; }
      const particleCount = 50 * (timeLeft / duration);
      confetti({
        particleCount: Math.floor(particleCount), startVelocity: 30, spread: 360,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors, ticks: 60, gravity: 0.8, scalar: 1.2, shapes: ['circle', 'square'],
      });
      confetti({
        particleCount: Math.floor(particleCount), startVelocity: 30, spread: 360,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors, ticks: 60, gravity: 0.8, scalar: 1.2, shapes: ['circle', 'square'],
      });
    }, 250);
  }, []);

  useEffect(() => {
    if (!candidatureId) { setLoading(false); return; }
    fetch(`/api/passport/application/${candidatureId}`)
      .then((res) => { if (!res.ok) throw new Error('Invalid'); return res.json(); })
      .then((data) => {
        setPassport(data);
        setLoading(false);
        setTimeout(() => launchConfetti(), 600);
      })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, [candidatureId, launchConfetti]);

  const handleCopy = () => {
    if (!passport?.shareUrl) return;
    navigator.clipboard.writeText(passport.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    fetch(`/api/passport/share/${passport.slug}`, { method: 'POST' }).catch(() => {});
  };

  const handleDownloadPdf = async () => {
    if (!candidatureId) return;
    setDownloadingPdf(true);
    try {
      const response = await fetch(`/api/passport/pdf/${candidatureId}`);
      if (!response.ok) throw new Error('Erreur');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Passeport_PatrimoTrust_${passport?.firstName || 'Dossier'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
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
          setEmailRecipient(''); setEmailRecipientName(''); setEmailMessage('');
        }, 2000);
      } else {
        setEmailError(result.error || "Erreur lors de l'envoi");
      }
    } catch {
      setEmailError('Erreur technique. Veuillez réessayer.');
    } finally {
      setSendingEmail(false);
    }
  };

  const displayName = passport?.firstName?.trim() || '';
  const ownerLabel = ownerName ? decodeURIComponent(ownerName) : 'Le propriétaire';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-emerald-200 rounded-full" />
            <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-slate-500 text-sm">Scellement de votre Passeport…</p>
        </motion.div>
      </div>
    );
  }

  if (!candidatureId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-slate-600 mb-4">Cette page est réservée aux candidats ayant transmis leur dossier.</p>
          <a href="/" className="text-emerald-600 font-medium hover:underline">Retour à l&apos;accueil</a>
        </div>
      </div>
    );
  }

  if (loadError || !passport) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-slate-600 mb-4">Impossible de charger votre dossier.</p>
          <a href="/" className="text-emerald-600 font-medium hover:underline">Retour à l&apos;accueil</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">

        {/* ── SECTION 1 : CÉLÉBRATION — LE SCEAU ── */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.2 }}
          className="relative inline-block mb-8"
        >
          <motion.div
            className="absolute inset-0 bg-amber-300/40 rounded-full blur-3xl -z-10"
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <svg width="160" height="160" viewBox="0 0 160 160" fill="none" className="drop-shadow-2xl">
            <circle cx="80" cy="80" r="78" stroke="url(#gld)" strokeWidth="3" opacity="0.4" />
            <circle cx="80" cy="80" r="70" stroke="url(#gld)" strokeWidth="2" />
            <circle cx="80" cy="80" r="62" fill="url(#seal)" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <rect key={a} x="76" y="4" width="8" height="14" rx="4" fill="url(#gld)" transform={`rotate(${a} 80 80)`} />
            ))}
            <path d="M80 45C80 45 55 55 55 75C55 95 80 115 80 115C80 115 105 95 105 75C105 55 80 45 80 45Z" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            <path d="M71 78L77 84L91 70" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="gld" x1="0" y1="0" x2="160" y2="160">
                <stop offset="0%" stopColor="#D4AF37" /><stop offset="50%" stopColor="#F5D060" /><stop offset="100%" stopColor="#D4AF37" />
              </linearGradient>
              <linearGradient id="seal" x1="20" y1="20" x2="140" y2="140">
                <stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-4xl md:text-5xl font-bold text-slate-900 mt-6 mb-2"
          style={{ fontFamily: 'Georgia, "Playfair Display", serif' }}
        >
          {displayName ? `Félicitations ${displayName},` : 'Félicitations,'}<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-500">
            votre Passeport est scellé.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-emerald-700 font-medium mb-12"
        >
          {ownerLabel} a été notifié de l&apos;excellence de votre dossier.
          <br />
          <span className="text-slate-500 font-normal">
            Vous faites désormais partie du <strong className="text-slate-700">top 5%</strong> des candidats certifiés.
          </span>
        </motion.p>

        {/* ── SECTION 2 : VIRALITÉ — LE LEVIER ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-white shadow-xl rounded-3xl p-8 border border-slate-100 text-left mb-8"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-3">
            Prenez l&apos;avantage sur les autres annonces.
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Votre identité et vos revenus sont désormais <strong className="text-slate-800">certifiés par l&apos;IA</strong>.
            Utilisez ce passeport pour postuler à d&apos;autres annonces sur LeBonCoin, SeLoger ou Jinka.
            Les propriétaires adorent les dossiers PatrimoTrust car ils sont <strong className="text-slate-800">garantis sans fraude</strong>.
          </p>

          {/* ARME N°1 — Le Lien Magique */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 mt-6 mb-4">
            <span className="text-sm text-slate-700 font-medium truncate flex-1">{passport.shareUrl}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shrink-0"
            >
              {copied ? (
                <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Copié !</>
              ) : (
                <><Copy className="w-4 h-4" /> Copier le lien</>
              )}
            </button>
          </div>

          {/* ARME N°2 — Le PDF Souverain */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl flex items-center justify-center gap-2 transition-colors font-semibold disabled:opacity-60 mb-4"
          >
            {downloadingPdf ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Génération en cours…</>
            ) : (
              <>⬇️ Télécharger le Passeport (PDF certifié)</>
            )}
          </button>

          {/* Bonus — Partage par email */}
          <button
            onClick={() => setShowEmailModal(true)}
            className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium text-sm"
          >
            <Share2 className="w-4 h-4" /> Envoyer par email à un propriétaire
          </button>
        </motion.div>

        {/* ── SECTION 3 : CONSEIL EXPERT ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <p className="text-emerald-800 font-semibold text-sm mb-1">Conseil de l&apos;expert</p>
              <p className="text-slate-700 text-sm leading-relaxed">
                Ne vous arrêtez pas là. Envoyez votre lien à chaque propriétaire que vous contactez :
                ils verront immédiatement que vos revenus et votre identité sont <strong>garantis sans fraude</strong>.
                Votre audit est valable 3 mois.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats de consultation */}
        {(passport.viewCount > 0 || passport.shareCount > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="grid grid-cols-2 gap-4 mt-8"
          >
            <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
              <p className="text-3xl font-bold text-slate-900">{passport.viewCount}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Consultations</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
              <p className="text-3xl font-bold text-slate-900">{passport.shareCount}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Partages</p>
            </div>
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-12 text-slate-400 text-xs"
        >
          Certification PatrimoTrust™ • Conforme Loi Alur 2026
        </motion.p>
      </div>

      {/* ── MODAL PARTAGE PAR EMAIL ── */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold text-lg">Partager mon Passeport</h3>
                  <p className="text-emerald-200 text-xs">Envoyez votre dossier certifié à un propriétaire</p>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="text-emerald-200 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {emailSent ? (
                <div className="p-8 text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </motion.div>
                  <h4 className="text-xl font-bold text-slate-900 mb-2">Email envoyé !</h4>
                  <p className="text-slate-500 text-sm">Votre Passeport a été partagé avec succès.</p>
                </div>
              ) : (
                <form onSubmit={handleSendEmail} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email du propriétaire *</label>
                    <input type="email" required value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)}
                      placeholder="proprietaire@example.com"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom du propriétaire <span className="text-slate-400">(optionnel)</span></label>
                    <input type="text" value={emailRecipientName} onChange={(e) => setEmailRecipientName(e.target.value)}
                      placeholder="M. Dupont"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Message personnel <span className="text-slate-400">(optionnel)</span></label>
                    <textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Bonjour, suite à notre échange…" rows={3}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent resize-none" />
                  </div>
                  {emailError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{emailError}</div>}
                  <button type="submit" disabled={sendingEmail || !emailRecipient}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                    {sendingEmail ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Envoi en cours…</>
                    ) : (
                      <><Send className="w-5 h-5" /> Envoyer mon Passeport</>
                    )}
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
