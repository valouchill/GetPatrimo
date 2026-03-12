'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Ruler, Euro, Mail, Loader2, ArrowRight, Sparkles, ShieldCheck, LockKeyhole, Briefcase } from 'lucide-react';
import { signIn, useSession } from 'next-auth/react';
import OtpInput from './OtpInput';

type Step = 'address' | 'numbers' | 'email' | 'otp' | 'unlocking';

const fadeSlide = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35 },
};

export type FastOnboardingFormProps = {
  passportSlug?: string;
  title?: string;
  onSuccess?: () => void;
  compact?: boolean;
};

export default function FastOnboardingForm({
  passportSlug,
  title,
  onSuccess,
  compact = false,
}: FastOnboardingFormProps) {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [surfaceM2, setSurfaceM2] = useState<string>('');
  const [rentAmount, setRentAmount] = useState<string>('');
  const [email, setEmail] = useState('');
  const [suggestions, setSuggestions] = useState<{ label: string; value: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addressInput.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(addressInput)}&limit=5`
      )
        .then((r) => { if (!r.ok) throw new Error('API error'); return r.json(); })
        .then((data: { features?: { properties: { label: string } }[] }) => {
          const items =
            data.features?.map((f: { properties: { label: string } }) => ({
              label: f.properties.label,
              value: f.properties.label,
            })) ?? [];
          setSuggestions(items);
          setShowSuggestions(items.length > 0);
        })
        .catch(() => { setSuggestions([]); setShowSuggestions(false); });
    }, 280);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [addressInput]);

  const selectAddress = useCallback((value: string) => {
    setAddress(value);
    setAddressInput(value);
    setShowSuggestions(false);
    setSuggestions([]);
    setStep('numbers');
  }, []);

  const validateAddress = useCallback(() => {
    const trimmed = addressInput.trim();
    if (trimmed.length >= 3) {
      setAddress(trimmed);
      setStep('numbers');
    }
  }, [addressInput]);

  const goToEmail = useCallback(() => {
    setStep('email');
  }, []);

  const addToPortfolio = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/owner/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address || addressInput.trim(),
          surfaceM2: Number(surfaceM2) || 0,
          rentAmount: Number(rentAmount) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur');
        setSubmitting(false);
        return;
      }
      onSuccess?.();
      window.location.href = '/dashboard/owner';
    } catch {
      setError('Erreur réseau. Réessayez.');
      setSubmitting(false);
    }
  }, [address, addressInput, surfaceM2, rentAmount, onSuccess]);

  const sendOtp = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de l\'envoi du code.');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setStep('otp');
    } catch {
      setError('Erreur réseau. Réessayez.');
      setSubmitting(false);
    }
  }, [email]);

  const verifyOtp = useCallback(async (code: string) => {
    setError(null);
    setStep('unlocking');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: code,
          propertyData: {
            address: address || addressInput.trim(),
            surfaceM2: Number(surfaceM2) || 0,
            rentAmount: Number(rentAmount) || 0,
          },
          passportSlug,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Code invalide.');
        setStep('otp');
        return;
      }

      const signInResult = await signIn('magic-fast', {
        email: data.email,
        token: data.token,
        redirect: false,
      });
      if (signInResult?.error) {
        setError('Connexion impossible. Réessayez.');
        setStep('otp');
        return;
      }
      onSuccess?.();
      window.location.href = '/dashboard/owner';
    } catch {
      setError('Erreur réseau. Réessayez.');
      setStep('otp');
    }
  }, [email, address, addressInput, surfaceM2, rentAmount, passportSlug, onSuccess]);

  const canSubmitEmail =
    email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const maskedEmail = email
    ? email.replace(/^(.{2})[^@]*(@.*)$/, '$1•••$2')
    : '';

  return (
    <div
      className={
        compact
          ? 'w-full max-w-md mx-auto'
          : 'w-full max-w-lg mx-auto rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden'
      }
    >
      <div className={compact ? 'p-4' : 'p-8 md:p-10'}>
        {title && (
          <h3 className="text-lg font-semibold text-slate-800 mb-6 text-center">{title}</h3>
        )}
        <div className="relative min-h-[200px]">
          <AnimatePresence mode="wait">
            {/* ── Étape 1 : Adresse ── */}
            {step === 'address' && (
              <motion.div key="address" {...fadeSlide} className="space-y-4">
                <p className="text-slate-600 text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Où se situe votre bien ?
                </p>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') validateAddress(); }}
                    placeholder="12 rue de la Paix, Paris"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white/90 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
                    autoFocus
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 mt-1 py-1 bg-white rounded-xl border border-slate-200 shadow-lg z-10 max-h-48 overflow-auto">
                      {suggestions.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-emerald-50 transition-colors"
                            onClick={() => selectAddress(s.value)}
                          >
                            {s.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={validateAddress}
                  disabled={addressInput.trim().length < 3}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-600 hover:to-emerald-700 transition-all"
                >
                  Valider l&apos;adresse
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* ── Étape 2 : Surface + Loyer ── */}
            {step === 'numbers' && (
              <motion.div key="numbers" {...fadeSlide} className="space-y-4">
                <p className="text-slate-600 text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Les chiffres clés
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Surface (m²)</label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={surfaceM2}
                        onChange={(e) => setSurfaceM2(e.target.value)}
                        placeholder="45"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white/90 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Loyer CC (€)</label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        min={1}
                        value={rentAmount}
                        onChange={(e) => setRentAmount(e.target.value)}
                        placeholder="850"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white/90 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={addToPortfolio}
                    disabled={submitting}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-50 hover:from-amber-600 hover:to-amber-700 transition-all"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Création...</>
                    ) : (
                      <><Briefcase className="w-4 h-4" /> Ajouter au portefeuille</>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goToEmail}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-emerald-700 transition-all"
                  >
                    Continuer
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {error && step === 'numbers' && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}
              </motion.div>
            )}

            {/* ── Étape 3 : Email (masquée si connecté) ── */}
            {step === 'email' && (
              <motion.div key="email" {...fadeSlide} className="space-y-4">
                <p className="text-slate-600 text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-600" />
                  Votre coffre-fort est prêt. Saisissez votre email pour y accéder.
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canSubmitEmail) sendOtp(); }}
                  placeholder="vous@exemple.fr"
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white/90 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all"
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={!canSubmitEmail || submitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-600 hover:to-emerald-700 transition-all"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Envoi du code...</>
                  ) : (
                    <>Ouvrir mon tableau de bord <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </motion.div>
            )}

            {/* ── Étape 4 : Vérification OTP ── */}
            {step === 'otp' && (
              <motion.div key="otp" {...fadeSlide} className="flex flex-col items-center gap-5 py-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="text-center space-y-1.5">
                  <h3
                    className="text-base font-bold text-slate-900"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Sceau de Vérification
                  </h3>
                  <p className="text-xs text-slate-500">
                    Un code à 6 chiffres a été envoyé à{' '}
                    <span className="font-medium text-slate-700">{maskedEmail}</span>.
                  </p>
                </div>
                <OtpInput onComplete={verifyOtp} />
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 w-full text-center">{error}</p>
                )}
                <button
                  type="button"
                  onClick={sendOtp}
                  className="text-xs text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  Renvoyer le code
                </button>
              </motion.div>
            )}

            {/* ── Étape 5 : Animation d'ouverture ── */}
            {step === 'unlocking' && (
              <motion.div key="unlocking" {...fadeSlide} className="flex flex-col items-center gap-4 py-8">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.5 }}
                  className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25"
                >
                  <LockKeyhole className="w-7 h-7 text-white" />
                </motion.div>
                <p
                  className="text-base font-bold text-slate-900"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Ouverture du coffre-fort...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!compact && (
          <p className="text-center text-xs text-slate-500 mt-6">
            Pas de mot de passe. Un code à usage unique sécurise chaque connexion.
          </p>
        )}
      </div>
    </div>
  );
}
