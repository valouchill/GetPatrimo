'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Ruler, Euro, Mail, Loader2, ArrowRight, ShieldCheck, LockKeyhole } from 'lucide-react';
import { signIn } from 'next-auth/react';
import OtpInput from './OtpInput';

type Step = 'address' | 'numbers' | 'email' | 'otp' | 'unlocking';

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3 },
};

export type HeroFastTrackProps = {
  id?: string;
};

export default function HeroFastTrack({ id = 'hero-fast-track' }: HeroFastTrackProps) {
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
      window.location.href = '/dashboard/owner';
    } catch {
      setError('Erreur réseau. Réessayez.');
      setStep('otp');
    }
  }, [email, address, addressInput, surfaceM2, rentAmount]);

  const canSubmitEmail =
    email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const maskedEmail = email
    ? email.replace(/^(.{2})[^@]*(@.*)$/, '$1•••$2')
    : '';

  return (
    <div id={id} className="w-full max-w-2xl mx-auto mt-10">
      <div className="p-2 bg-white/80 backdrop-blur-md rounded-2xl shadow-2xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* ── Étape 1 : Adresse ── */}
          {step === 'address' && (
            <motion.div key="address" {...fadeSlide} className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && validateAddress()}
                  placeholder="Saisissez l'adresse de votre bien..."
                  className="w-full h-14 pl-12 pr-4 text-lg bg-transparent outline-none placeholder:text-slate-400 text-slate-900 rounded-xl"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 mt-1 py-1 bg-white rounded-xl border border-slate-200 shadow-xl z-20 max-h-52 overflow-auto">
                    {suggestions.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-3 text-slate-700 hover:bg-emerald-50 transition-colors text-sm"
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
                className="h-14 px-8 py-4 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                Sécuriser ce bien
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* ── Étape 2 : Surface + Loyer ── */}
          {step === 'numbers' && (
            <motion.div key="numbers" {...fadeSlide} className="flex flex-col gap-4 p-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={surfaceM2}
                    onChange={(e) => setSurfaceM2(e.target.value)}
                    placeholder="Surface (m²)"
                    className="w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    min={1}
                    value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    placeholder="Loyer CC (€)"
                    className="w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={goToEmail}
                className="h-12 px-6 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                Continuer
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ── Étape 3 : Email ── */}
          {step === 'email' && (
            <motion.div key="email" {...fadeSlide} className="flex flex-col gap-4 p-2">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canSubmitEmail && sendOtp()}
                  placeholder="vous@exemple.fr"
                  className="w-full h-14 pl-12 pr-4 text-lg bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <button
                type="button"
                onClick={sendOtp}
                disabled={!canSubmitEmail || submitting}
                className="h-14 px-8 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Envoi du code...</>
                ) : (
                  <>Ouvrir mon tableau de bord <ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </motion.div>
          )}

          {/* ── Étape 4 : Vérification OTP ── */}
          {step === 'otp' && (
            <motion.div key="otp" {...fadeSlide} className="flex flex-col items-center gap-6 py-6 px-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="text-center space-y-2">
                <h3
                  className="text-lg font-bold text-slate-900"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Sceau de Vérification
                </h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Pour garantir l&apos;inviolabilité de vos données, un code de sécurité
                  vient d&apos;être envoyé à{' '}
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
                className="text-sm text-slate-400 hover:text-emerald-600 transition-colors"
              >
                Renvoyer le code
              </button>
            </motion.div>
          )}

          {/* ── Étape 5 : Animation d'ouverture ── */}
          {step === 'unlocking' && (
            <motion.div key="unlocking" {...fadeSlide} className="flex flex-col items-center gap-5 py-10 px-4">
              <motion.div
                animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.5 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25"
              >
                <LockKeyhole className="w-8 h-8 text-white" />
              </motion.div>
              <p
                className="text-lg font-bold text-slate-900"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Ouverture de votre coffre-fort...
              </p>
              <p className="text-sm text-slate-500">Vérification du sceau en cours</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-center text-sm text-slate-500 mt-4 flex items-center justify-center gap-1.5">
        <span className="text-amber-600">🛡️</span>
        Création du coffre-fort gratuite. Sans engagement.
      </p>
    </div>
  );
}
