'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Logo } from '@/app/components/Logo';

// Doit rester aligné avec ResetPasswordSchema (lib/validations/auth.ts) et le modèle User.
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]).{12,}$/;

function Shell({ children }: { children: React.ReactNode }) {
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
            <Logo className="h-10" />
          </Link>
        </div>
        <div className="bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function ResetPasswordInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strong = PASSWORD_REGEX.test(password);
  const matches = password.length > 0 && password === confirm;

  if (!token) {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="font-serif text-xl font-semibold text-slate-900 mb-2">Lien invalide</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Ce lien de réinitialisation est incomplet ou a expiré.
          </p>
          <Link href="/auth/forgot-password" className="text-sm text-amber-500 hover:text-amber-600 font-medium">
            Refaire une demande
          </Link>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="font-serif text-xl font-semibold text-slate-900 mb-2">Mot de passe réinitialisé</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Vous pouvez maintenant vous connecter avec votre nouveau mot de passe. Redirection…
          </p>
          <Link href="/auth/login" className="text-sm text-amber-500 hover:text-amber-600 font-medium">
            Se connecter
          </Link>
        </div>
      </Shell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strong) {
      setError('Le mot de passe doit contenir au moins 12 caractères, 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial.');
      return;
    }
    if (!matches) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Lien invalide ou expiré.');
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/auth/login'), 2500);
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <Lock className="w-5 h-5 text-amber-500" />
        </div>
        <h1 className="font-serif text-xl font-semibold text-slate-900">Nouveau mot de passe</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
        Choisissez un mot de passe fort : 12 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            required
            autoFocus
            className="w-full px-5 py-3.5 pr-12 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-base"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <input
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmer le mot de passe"
          required
          className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-base"
        />

        {password.length > 0 && (
          <p className={`text-xs ${strong ? 'text-emerald-600' : 'text-slate-400'}`}>
            {strong ? '✓ Mot de passe conforme' : '12 caractères, 1 maj., 1 min., 1 chiffre, 1 spécial'}
            {confirm.length > 0 && !matches ? ' · les mots de passe diffèrent' : ''}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !strong || !matches}
          className={`w-full py-4 rounded-2xl font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
            !strong || !matches
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
              : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 cursor-pointer'
          } disabled:opacity-60`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>Réinitialiser mon mot de passe</>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-5">
        <Link href="/auth/login" className="text-amber-500 hover:text-amber-600 font-medium">
          Retour à la connexion
        </Link>
      </p>
    </Shell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
