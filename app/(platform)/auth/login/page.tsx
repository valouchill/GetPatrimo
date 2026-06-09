'use client';

import { useState, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import OtpInput from '@/app/components/OtpInput';
import { Logo } from '@/app/components/Logo';
import { safeCallbackUrl } from '@/lib/safe-callback-url';

type Mode = 'password' | 'otp';
type OtpStep = 'email' | 'otp' | 'unlocking';

const LOGIN_TIMEOUT_MS = 12_000;
const LOGIN_TIMEOUT_MESSAGE = 'Connexion trop longue, veuillez réessayer.';

function withLoginTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error(LOGIN_TIMEOUT_MESSAGE)), LOGIN_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function loginErrorMessage(error: unknown) {
  if (error instanceof Error && (error.name === 'AbortError' || error.message === LOGIN_TIMEOUT_MESSAGE)) {
    return LOGIN_TIMEOUT_MESSAGE;
  }
  return 'Erreur réseau. Veuillez réessayer.';
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('password');

  // password mode
  const [pwEmail, setPwEmail] = useState('');
  const [pwPassword, setPwPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // otp mode
  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  const [otpEmail, setOtpEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA (revue V1 — S10) : étape de second facteur après mot de passe / code email.
  const [twoFa, setTwoFa] = useState<{ email: string; token: string; role?: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');

  const maskedEmail = otpEmail
    ? otpEmail.replace(/^(.{2})(.*)(@.*)$/, (_m, a, b, c) => a + b.replace(/./g, '·') + c)
    : '';

  // ── Helper: redirect after signIn ──
  // V8.3 (audit M2) — honore un callbackUrl interne sûr (garde anti
  // open-redirect centralisée dans lib/safe-callback-url) plutôt que de
  // toujours retomber sur l'accueil du rôle.
  const redirectByRole = (role: string | undefined) => {
    const callbackUrl =
      typeof window !== 'undefined'
        ? safeCallbackUrl(window.location.search, role)
        : null;
    if (callbackUrl) {
      window.location.href = callbackUrl;
      return;
    }
    if (role === 'tenant') {
      window.location.href = '/dashboard/tenant';
    } else {
      window.location.href = '/dashboard/owner';
    }
  };

  const cleanupStaleCookies = () => {
    document.cookie.split(';').forEach((c) => {
      const name = c.trim().split('=')[0];
      if (name.includes('next-auth') || name.includes('__Secure-next-auth')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure`;
      }
    });
  };

  // ── Password login ──
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwEmail.trim() || !pwPassword) return;
    setLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
      const res = await (async () => {
        try {
          return await fetch('/api/auth/login-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              email: pwEmail.trim().toLowerCase(),
              password: pwPassword,
            }),
          });
        } finally {
          clearTimeout(timeoutId);
        }
      })();
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connexion impossible.');
        setLoading(false);
        return;
      }

      if (data.requires2fa) {
        // Compte avec 2FA : on demande le code TOTP avant d'ouvrir la session.
        setTwoFa({ email: data.email, token: data.token, role: data.role });
        setLoading(false);
        return;
      }

      cleanupStaleCookies();
      const result = await withLoginTimeout(
        signIn('magic-fast', {
          email: data.email,
          token: data.token,
          redirect: false,
        }),
      );

      if (result?.ok) {
        redirectByRole(data.role);
      } else {
        setError("Erreur d'authentification. Veuillez réessayer.");
        setLoading(false);
      }
    } catch (err) {
      setError(loginErrorMessage(err));
      setLoading(false);
    }
  };

  // ── OTP send ──
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpEmail.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible d'envoyer le code.");
        return;
      }
      setOtpStep('otp');
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP verify ──
  const handleVerifyOtp = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: otpEmail.trim().toLowerCase(), otp: code }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Code invalide.');
          setLoading(false);
          return;
        }

        if (data.requires2fa) {
          setTwoFa({ email: data.email, token: data.token });
          setLoading(false);
          return;
        }

        setOtpStep('unlocking');
        cleanupStaleCookies();

        const result = await signIn('magic-fast', {
          email: data.email,
          token: data.token,
          redirect: false,
        });

        if (result?.ok) {
          // verify-otp ne renvoie pas le role — fallback owner, mais on
          // honore tout de même un callbackUrl interne sûr (audit M2).
          redirectByRole(undefined);
        } else {
          setError("Erreur d'authentification. Veuillez réessayer.");
          setOtpStep('otp');
          setLoading(false);
        }
      } catch {
        setError('Erreur réseau. Veuillez réessayer.');
        setLoading(false);
        setOtpStep('otp');
      }
    },
    [otpEmail],
  );

  // ── 2FA : finalise la connexion avec le code TOTP / de secours ──
  const completeTotpSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFa || totpCode.trim().length < 6) return;
    setLoading(true);
    setError(null);
    try {
      cleanupStaleCookies();
      const result = await withLoginTimeout(
        signIn('magic-fast', {
          email: twoFa.email,
          token: twoFa.token,
          totpCode: totpCode.trim(),
          redirect: false,
        }),
      );
      if (result?.ok) {
        redirectByRole(twoFa.role);
      } else {
        setError('Code de vérification invalide. Réessayez.');
        setTotpCode('');
        setLoading(false);
      }
    } catch (err) {
      setError(loginErrorMessage(err));
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setLoading(true);
    try {
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail.trim().toLowerCase() }),
      });
    } catch {
      setError('Impossible de renvoyer le code.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setOtpStep('email');
  };

  const showToggle = otpStep === 'email'; // cacher le toggle pendant flow OTP avancé

  // 2FA (revue V1 — S10) : écran dédié de saisie du second facteur.
  if (twoFa) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-amber-100/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-slate-200/40 rounded-full blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-md"
        >
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center">
              <Logo className="h-10" />
            </Link>
          </div>
          <div className="bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-500" />
              </div>
              <h1 className="font-serif text-xl font-semibold text-slate-900">Vérification en deux étapes</h1>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Saisissez le code à 6 chiffres de votre application d&apos;authentification, ou un code de secours.
            </p>
            <form onSubmit={completeTotpSignIn} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ''))}
                placeholder="Code de vérification"
                className="w-full text-center tracking-[0.3em] text-lg py-3 rounded-xl border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading || totpCode.trim().length < 6}
                className="w-full py-3 rounded-xl bg-emerald-900 text-white font-medium disabled:opacity-50 hover:bg-emerald-800 transition-colors"
              >
                {loading ? 'Vérification…' : 'Vérifier'}
              </button>
              <button
                type="button"
                onClick={() => { setTwoFa(null); setTotpCode(''); setError(null); }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-amber-100/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-slate-200/40 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center group">
            <Logo className="h-10" />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100">
          {/* Toggle Mode */}
          {showToggle && (
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => switchMode('password')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'password'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Mot de passe
              </button>
              <button
                type="button"
                onClick={() => switchMode('otp')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  mode === 'otp'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Code par email
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ─── Mode Password ─── */}
            {mode === 'password' && (
              <motion.div
                key="password"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-amber-500" />
                  </div>
                  <h1
                    className="font-serif text-xl font-semibold text-slate-900"
                  >
                    Connexion
                  </h1>
                </div>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Accédez à votre coffre-fort avec votre mot de passe.
                </p>

                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <input
                    type="email"
                    value={pwEmail}
                    onChange={(e) => setPwEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    autoFocus
                    className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-base"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={pwPassword}
                      onChange={(e) => setPwPassword(e.target.value)}
                      placeholder="Mot de passe"
                      required
                      className="w-full px-5 py-3.5 pr-12 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex justify-end -mt-1">
                    <Link
                      href="/auth/forgot-password"
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                    >
                      Mot de passe oublié ?
                    </Link>
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
                    disabled={loading || !pwEmail.trim() || !pwPassword}
                    className={`w-full py-4 rounded-2xl font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                      !pwEmail.trim() || !pwPassword
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 cursor-pointer'
                    } disabled:opacity-60`}
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Se connecter</>
                    )}
                  </button>
                </form>
                <p className="text-center text-sm text-slate-500 mt-5">
                  Pas encore de compte ?{' '}
                  <Link href="/auth/register" className="text-amber-500 hover:text-amber-600 font-medium">
                    Créer un compte gratuit
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ─── Mode OTP : saisie email ─── */}
            {mode === 'otp' && otpStep === 'email' && (
              <motion.div
                key="otp-email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-amber-500" />
                  </div>
                  <h1
                    className="font-serif text-xl font-semibold text-slate-900"
                  >
                    Connexion par code
                  </h1>
                </div>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Un code d&apos;accès unique vous sera envoyé par email.
                </p>

                <form onSubmit={handleSendOtp} className="space-y-5">
                  <input
                    type="email"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    autoFocus
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-base"
                  />

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
                    disabled={loading || !otpEmail.trim()}
                    className={`w-full py-4 rounded-2xl font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                      !otpEmail.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 cursor-pointer'
                    } disabled:opacity-60`}
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Recevoir mon code d&apos;accès</>
                    )}
                  </button>
                </form>
                <p className="text-center text-sm text-slate-500 mt-5">
                  Pas encore de compte ?{' '}
                  <Link href="/auth/register" className="text-amber-500 hover:text-amber-600 font-medium">
                    Créer un compte gratuit
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ─── Mode OTP : saisie code ─── */}
            {mode === 'otp' && otpStep === 'otp' && (
              <motion.div
                key="otp-code"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  onClick={() => { setOtpStep('email'); setError(null); }}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>

                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-7 h-7 text-amber-500" />
                  </div>
                  <h2
                    className="font-serif text-lg font-semibold text-slate-900 mb-2"
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
                    className="text-amber-500 hover:text-amber-600 font-medium transition-colors disabled:opacity-50"
                  >
                    Renvoyer le code
                  </button>
                </p>
              </motion.div>
            )}

            {/* ─── Mode OTP : unlocking ─── */}
            {mode === 'otp' && otpStep === 'unlocking' && (
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
                  className="font-serif text-lg font-semibold text-slate-900 mb-2"
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
            Connexion sécurisée · Chiffrement de bout en bout
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
