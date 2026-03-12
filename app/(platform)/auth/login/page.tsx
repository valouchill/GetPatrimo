'use client';

import { useState, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';
import OtpInput from '@/app/components/OtpInput';

type Step = 'email' | 'otp' | 'unlocking';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_m, a, b, c) => a + b.replace(/./g, '·') + c)
    : '';

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible d'envoyer le code.");
        return;
      }
      setStep('otp');
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), otp: code }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Code invalide.');
          setLoading(false);
          return;
        }

        setStep('unlocking');

        const result = await signIn('magic-fast', {
          email: data.email,
          token: data.token,
          redirect: false,
        });

        if (result?.ok) {
          window.location.href = '/dashboard/owner';
        } else {
          setError('Erreur d\'authentification. Veuillez réessayer.');
          setStep('otp');
          setLoading(false);
        }
      } catch {
        setError('Erreur réseau. Veuillez réessayer.');
        setLoading(false);
        setStep('otp');
      }
    },
    [email],
  );

  const handleResend = async () => {
    setError(null);
    setLoading(true);
    try {
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setError(null);
    } catch {
      setError('Impossible de renvoyer le code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {/* Fond subtil */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-slate-200/60 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-sm font-bold group-hover:scale-105 transition-transform">
              PT
            </div>
            <span
              className="text-xl font-semibold text-slate-900 tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              PatrimoTrust
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100">
          <AnimatePresence mode="wait">
            {/* ─── État 1 : Saisie Email ─── */}
            {step === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h1
                    className="text-xl font-semibold text-slate-900"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Accédez à votre coffre-fort.
                  </h1>
                </div>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                  Saisissez votre adresse email. Un code d&apos;accès unique vous sera
                  envoyé pour garantir l&apos;inviolabilité de votre session.
                </p>

                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      required
                      autoFocus
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-base"
                    />
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5"
                    >
                      {error}
                    </motion.p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-amber-400">&#9670;</span>
                        Recevoir mon code d&apos;accès
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ─── État 2 : Saisie OTP ─── */}
            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  onClick={() => { setStep('email'); setError(null); }}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>

                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h2
                    className="text-lg font-semibold text-slate-900 mb-2"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Sceau de sécurité envoyé
                  </h2>
                  <p className="text-sm text-slate-500">
                    Code envoyé à <span className="font-medium text-slate-700">{maskedEmail}</span>
                  </p>
                </div>

                <div className="mb-6">
                  <OtpInput onComplete={handleVerifyOtp} disabled={loading} />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-center mb-4"
                  >
                    {error}
                  </motion.p>
                )}

                <p className="text-center text-xs text-slate-400">
                  Rien reçu ?{' '}
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors disabled:opacity-50"
                  >
                    Renvoyer le code
                  </button>
                </p>
              </motion.div>
            )}

            {/* ─── État 3 : Déverrouillage ─── */}
            {step === 'unlocking' && (
              <motion.div
                key="unlocking"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5"
                >
                  <Shield className="w-7 h-7 text-emerald-600" />
                </motion.div>
                <h2
                  className="text-lg font-semibold text-slate-900 mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Déverrouillage en cours…
                </h2>
                <p className="text-sm text-slate-500">
                  Ouverture de votre coffre-fort sécurisé.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-slate-400">
            Connexion sécurisée sans mot de passe · Chiffrement de bout en bout
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Retour à l&apos;accueil
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
