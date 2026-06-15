'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/app/components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Une erreur est survenue. Veuillez réessayer.');
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-amber-100/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-slate-200/40 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center group">
            <Logo className="text-2xl" />
          </Link>
        </div>

        <div className="bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h1 className="font-serif text-xl font-semibold text-slate-900 mb-2">Vérifiez vos emails</h1>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Si un compte est associé à{' '}
                <strong className="text-slate-700">{email.trim().toLowerCase()}</strong>, un lien de
                réinitialisation vient d&apos;être envoyé. Il expire dans 1&nbsp;heure.
              </p>
              <Link href="/auth/login" className="text-sm text-amber-500 hover:text-amber-600 font-medium">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-amber-500" />
                </div>
                <h1 className="font-serif text-xl font-semibold text-slate-900">Mot de passe oublié</h1>
              </div>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Entrez votre email : nous vous enverrons un lien pour définir un nouveau mot de passe.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  autoFocus
                  className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-base"
                />

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className={`w-full py-4 rounded-2xl font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                    !email.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                      : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 cursor-pointer'
                  } disabled:opacity-60`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Envoyer le lien</>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-5">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Retour à la connexion
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
