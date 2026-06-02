'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Building2, User, ArrowLeft, ArrowRight, Shield, CheckCircle2, MapPin, Eye, EyeOff } from 'lucide-react';
import { safeCallbackUrl } from '@/lib/safe-callback-url';

type Role = 'owner' | 'tenant';
type Step = 'role' | 'ownerForm' | 'tenantCode' | 'tenantForm' | 'unlocking';

type PropertyPreview = {
  _id: string;
  address?: string;
  city?: string;
  zipCode?: string;
  name?: string;
};

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<Role>('owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [propertyCode, setPropertyCode] = useState('');
  const [property, setProperty] = useState<PropertyPreview | null>(null);
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mode "codeless" : création d'un Passeport Locatif universel sans code de bien.
  const [codeless, setCodeless] = useState(false);

  // ── Pré-sélection du parcours via ?role= / ?mode= (depuis l'Espace Locataire) ──
  // ?role=tenant&mode=codeless → Passeport universel (saute l'étape code).
  // ?role=tenant → flux invité (étape code) ; ?role=owner → formulaire bailleur.
  // Lu côté client (pas de Suspense requis) ; léger flash acceptable.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get('role');
    const mode = params.get('mode');
    if (r === 'tenant' && mode === 'codeless') {
      setRole('tenant');
      setCodeless(true);
      setStep('tenantForm');
    } else if (r === 'tenant') {
      setRole('tenant');
      setStep('tenantCode');
    } else if (r === 'owner') {
      setRole('owner');
      setStep('ownerForm');
    }
  }, []);

  // ── Password strength (0-5) ──
  const passwordScore = useMemo(() => {
    let s = 0;
    if (password.length >= 12) s++;
    if (/[a-z]/.test(password)) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) s++;
    return s;
  }, [password]);

  const passwordValid = passwordScore === 5;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const canSubmitForm = emailValid && passwordValid && passwordsMatch;

  // UX — détaille ce qui bloque encore la soumission, pour expliquer un bouton
  // désactivé (sinon l'utilisateur croit que « le bouton ne fonctionne pas »).
  const formBlockers: string[] = [];
  if (!emailValid) formBlockers.push('un email valide');
  if (password.length < 12) formBlockers.push('12 caractères');
  if (!/[A-Z]/.test(password)) formBlockers.push('une majuscule');
  if (!/[a-z]/.test(password)) formBlockers.push('une minuscule');
  if (!/\d/.test(password)) formBlockers.push('un chiffre');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) formBlockers.push('un caractère spécial');
  if (passwordValid && !passwordsMatch) formBlockers.push('confirmer le mot de passe à l’identique');
  const showBlockers = !canSubmitForm && (email.length > 0 || password.length > 0) && formBlockers.length > 0;

  // ── Validation live du code de bien (débouncé 400ms) ──
  useEffect(() => {
    if (step !== 'tenantCode') return;
    const code = propertyCode.trim().toUpperCase();
    if (!/^PT-\d{5}-[A-Z0-9]{4}$/.test(code)) {
      setProperty(null);
      setCodeError(null);
      return;
    }
    setCodeValidating(true);
    setCodeError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/public/apply/${code}`);
        const data = await res.json();
        if (!res.ok || !data.property) {
          setProperty(null);
          setCodeError('Code de bien introuvable');
        } else {
          setProperty(data.property);
          setCodeError(null);
        }
      } catch {
        setProperty(null);
        setCodeError('Erreur réseau');
      } finally {
        setCodeValidating(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [propertyCode, step]);

  const formatCode = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return clean.slice(0, 13);
  };

  const selectRole = (r: Role) => {
    setRole(r);
    setError(null);
    setStep(r === 'owner' ? 'ownerForm' : 'tenantCode');
  };

  const submitRegister = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        email: email.trim().toLowerCase(),
        password,
        role,
      };
      // En mode codeless, on n'envoie PAS de code → le backend génère un self-token.
      if (role === 'tenant' && !codeless) payload.propertyCode = propertyCode.trim().toUpperCase();

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Impossible de créer le compte.');
        setLoading(false);
        return;
      }

      setStep('unlocking');

      // Nettoyer anciens cookies NextAuth potentiellement corrompus
      document.cookie.split(';').forEach((c) => {
        const name = c.trim().split('=')[0];
        if (name.includes('next-auth') || name.includes('__Secure-next-auth')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure`;
        }
      });

      const signInResult = await signIn('magic-fast', {
        email: data.email,
        token: data.token,
        redirect: false,
      });

      if (signInResult?.ok) {
        if (data.role === 'tenant' && data.selfToken) {
          // Passeport Locatif universel (codeless) → tunnel sans bien.
          window.location.href = `/apply/${data.selfToken}`;
        } else if (data.role === 'tenant' && data.propertyId) {
          window.location.href = `/apply/${data.propertyId}`;
        } else {
          // V8.3 (audit M2) — honore un callbackUrl interne sûr si présent,
          // sinon accueil bailleur. Garde anti open-redirect centralisée.
          const cb =
            typeof window !== 'undefined'
              ? safeCallbackUrl(window.location.search, data.role)
              : null;
          window.location.href = cb ?? '/dashboard/owner';
        }
      } else {
        setError("Connexion impossible. Veuillez réessayer.");
        setStep(role === 'owner' ? 'ownerForm' : 'tenantForm');
        setLoading(false);
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
      setLoading(false);
    }
  }, [email, password, role, propertyCode, codeless]);

  // ── UI ──
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
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-sm font-bold group-hover:scale-105 transition-transform">
              PT
            </div>
            <span
              className="text-xl font-semibold text-slate-900 tracking-tight"
            >
              PatrimoTrust
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100">
          <AnimatePresence mode="wait">
            {/* ─── Step 0 : Role Selector ─── */}
            {step === 'role' && (
              <motion.div
                key="role"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <h1
                  className="font-serif text-xl font-semibold text-slate-900 mb-2"
                >
                  Créez votre compte
                </h1>
                <p className="text-sm text-slate-500 mb-8">
                  Choisissez votre profil pour commencer.
                </p>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => selectRole('owner')}
                    className="w-full flex items-center gap-4 p-5 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-300 rounded-2xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Building2 className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900">Je suis propriétaire</div>
                      <div className="text-xs text-slate-500 mt-0.5">Je mets un bien en location</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={() => selectRole('tenant')}
                    className="w-full flex items-center gap-4 p-5 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-300 rounded-2xl transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <User className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900">Je suis locataire</div>
                      <div className="text-xs text-slate-500 mt-0.5">J&apos;ai un code de bien à rejoindre</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── Step 1a : Owner form ─── */}
            {step === 'ownerForm' && (
              <motion.div
                key="ownerForm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  onClick={() => { setStep('role'); setError(null); }}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-amber-500" />
                  </div>
                  <h2
                    className="font-serif text-xl font-semibold text-slate-900"
                  >
                    Créer mon coffre-fort
                  </h2>
                </div>

                <FormFields
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  passwordScore={passwordScore}
                />

                {error && <ErrorBox text={error} />}

                <button
                  type="button"
                  onClick={submitRegister}
                  disabled={!canSubmitForm || loading}
                  className={`w-full mt-6 py-4 rounded-2xl font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                    !canSubmitForm
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                      : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                  } disabled:opacity-60`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Créer mon coffre-fort <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
                <BlockHint blockers={formBlockers} show={showBlockers} />
              </motion.div>
            )}

            {/* ─── Step 1b : Tenant code ─── */}
            {step === 'tenantCode' && (
              <motion.div
                key="tenantCode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  onClick={() => { setStep('role'); setError(null); setPropertyCode(''); setProperty(null); }}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>

                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <User className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h2
                    className="font-serif text-xl font-semibold text-slate-900"
                  >
                    Code de bien
                  </h2>
                </div>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Saisissez le code transmis par votre propriétaire (format <span className="font-mono text-slate-700">PT-XXXXX-XXXX</span>).
                </p>

                <div className="space-y-4">
                  <input
                    type="text"
                    value={propertyCode}
                    onChange={(e) => setPropertyCode(formatCode(e.target.value))}
                    placeholder="PT-75001-A1B2"
                    autoFocus
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all text-base font-mono tracking-wider uppercase"
                  />

                  {codeValidating && (
                    <p className="text-sm text-slate-400 flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
                      Vérification...
                    </p>
                  )}

                  {codeError && <ErrorBox text={codeError} />}

                  {property && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-emerald-900">Bien trouvé</div>
                          <div className="text-xs text-emerald-700 mt-1 flex items-start gap-1">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span className="truncate">
                              {property.address || property.name || 'Adresse masquée'}
                              {property.city && ` · ${property.city}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => { setError(null); setStep('tenantForm'); }}
                  disabled={!property}
                  className={`w-full mt-6 py-4 rounded-2xl font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                    !property
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                  }`}
                >
                  Continuer <ArrowRight className="w-4 h-4" />
                </button>

                {/* Échappatoire codeless : pas de code → Passeport Locatif universel */}
                <button
                  type="button"
                  onClick={() => { setError(null); setCodeless(true); setStep('tenantForm'); }}
                  className="w-full mt-4 text-center text-sm text-slate-500 hover:text-emerald-700 transition-colors"
                >
                  Pas encore de code ?{' '}
                  <span className="font-semibold underline underline-offset-2">Créer mon Passeport universel</span>
                </button>
              </motion.div>
            )}

            {/* ─── Step 2b : Tenant form ─── */}
            {step === 'tenantForm' && (
              <motion.div
                key="tenantForm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  onClick={() => { setStep(codeless ? 'role' : 'tenantCode'); setError(null); if (codeless) setCodeless(false); }}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>

                <h2
                  className="font-serif text-xl font-semibold text-slate-900 mb-2"
                >
                  Finaliser mon inscription
                </h2>
                {codeless && (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-5 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Vous créez votre <span className="font-medium">Passeport Locatif universel</span> — sans code.
                  </p>
                )}
                {property && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Vous rejoignez : <span className="font-medium">{property.address || property.name}</span>
                  </p>
                )}

                <FormFields
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  confirmPassword={confirmPassword}
                  setConfirmPassword={setConfirmPassword}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  passwordScore={passwordScore}
                />

                {error && <ErrorBox text={error} />}

                <button
                  type="button"
                  onClick={submitRegister}
                  disabled={!canSubmitForm || loading}
                  className={`w-full mt-6 py-4 rounded-2xl font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                    !canSubmitForm
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                  } disabled:opacity-60`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>{codeless ? 'Créer mon Passeport' : 'Rejoindre le bien'} <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
                <BlockHint blockers={formBlockers} show={showBlockers} />
              </motion.div>
            )}

            {/* ─── Step : Unlocking ─── */}
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
                  className="font-serif text-lg font-semibold text-slate-900 mb-2"
                >
                  Création de votre coffre-fort…
                </h2>
                <p className="text-sm text-slate-500">
                  Vos données sont chiffrées et sécurisées.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-slate-400">
            En créant un compte, vous acceptez nos conditions d&apos;utilisation.
          </p>
          <p className="text-sm text-slate-500">
            Déjà inscrit ?{' '}
            <Link href="/auth/login" className="text-amber-500 hover:text-amber-600 font-medium">
              Se connecter
            </Link>
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

// ── Sous-composants ──

function ErrorBox({ text }: { text: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mt-4"
    >
      {text}
    </motion.p>
  );
}

/**
 * Explique pourquoi le bouton de soumission est désactivé (UX) : liste ce qu'il
 * reste à renseigner. Évite l'impression que « le bouton ne fonctionne pas ».
 */
function BlockHint({ blockers, show }: { blockers: string[]; show: boolean }) {
  if (!show || blockers.length === 0) return null;
  return (
    <p className="mt-3 text-center text-xs leading-relaxed text-slate-400">
      Pour activer le bouton, il manque encore&nbsp;:{' '}
      <span className="font-medium text-slate-600">{blockers.join(', ')}</span>.
    </p>
  );
}

type FormFieldsProps = {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  passwordScore: number;
};

function FormFields({
  email, setEmail, password, setPassword, confirmPassword, setConfirmPassword,
  showPassword, setShowPassword, passwordScore,
}: FormFieldsProps) {
  const strengthLabel = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Fort', 'Excellent'][passwordScore];
  const strengthColor = [
    'bg-red-400', 'bg-red-400', 'bg-amber-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500',
  ][passwordScore];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.com"
          required
          className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all text-base"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Mot de passe</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="12 caractères minimum"
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
        {password.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < passwordScore ? strengthColor : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Force : <span className="font-medium">{strengthLabel}</span>
              {passwordScore < 5 && <span className="text-slate-400"> · 12 car. · maj · min · chiffre · spécial</span>}
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirmer</label>
        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirmez votre mot de passe"
          required
          className={`w-full px-5 py-3.5 bg-slate-50 border-2 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-all text-base ${
            confirmPassword.length > 0 && confirmPassword !== password
              ? 'border-red-300 focus:border-red-400'
              : 'border-slate-200 focus:border-amber-400'
          }`}
        />
        {confirmPassword.length > 0 && confirmPassword !== password && (
          <p className="text-[11px] text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>
        )}
      </div>
    </div>
  );
}
