'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, Save, Check, Shield,
  Crown, ExternalLink, Lock, LogOut, Eye, EyeOff,
  AlertTriangle, Loader2, Download, Trash2, ChevronRight, Sparkles,
} from 'lucide-react';
import { useOwner } from '../OwnerContext';
import { OwnerShell } from '../components/OwnerShell';
import {
  TIERS,
  normalizeTier,
  formatTierPrice,
  type PropertyTier,
} from '@/lib/billing/tiers';

// V8.2 — Ordre des offres pour déterminer la "meilleure" + la prochaine.
const TIER_RANK: Record<PropertyTier, number> = {
  FREE: 0,
  ESSENTIAL: 1,
  PREMIUM: 2,
  MAX: 3,
};

// ─── Input component ────────────────────────────────────────────
function FormInput({
  id, label, icon: Icon, type = 'text', value, onChange, disabled, placeholder, suffix,
}: {
  id: string; label: string; icon: React.ElementType; type?: string;
  value: string; onChange: (v: string) => void; disabled?: boolean;
  placeholder?: string; suffix?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full pl-10 ${suffix ? 'pr-16' : 'pr-4'} py-2.5 border border-slate-200 rounded-xl text-sm outline-none transition-all ${
            disabled
              ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
              : 'bg-white text-slate-900 placeholder-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100'
          }`}
        />
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ─── Password input ─────────────────────────────────────────────
function PasswordInput({
  id, label, value, onChange, placeholder,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-900 placeholder-slate-400 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-all"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Section card ───────────────────────────────────────────────
function TwoFactorSection() {
  const [step, setStep] = useState<'idle' | 'setup' | 'confirm' | 'done'>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  useEffect(() => {
    fetch('/api/auth/totp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', code: '000000' }) })
      .catch(() => {});
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/totp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep('setup');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/totp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enable', code }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBackupCodes(data.backupCodes);
      setEnabled(true);
      setStep('done');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/totp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disable', code: disableCode }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnabled(false);
      setStep('idle');
      setDisableCode('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section icon={Shield} title="Authentification à deux facteurs" description="Protégez votre compte avec Google Authenticator" delay={0.12}>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 mb-3">{error}</div>}

      {step === 'idle' && !enabled && (
        <button
          type="button"
          onClick={handleSetup}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          Activer le 2FA
        </button>
      )}

      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Scannez ce QR code avec Google Authenticator ou une application TOTP compatible :</p>
          {qrCode && <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 mx-auto border rounded-xl" />}
          <p className="text-xs text-slate-500 text-center font-mono break-all">Clé manuelle : {secret}</p>
          <div>
            <label htmlFor="totp-code" className="block text-xs font-semibold text-slate-700 mb-1.5">Code de vérification</label>
            <input
              id="totp-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading || code.length !== 6}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Valider et activer
          </button>
        </div>
      )}

      {step === 'done' && backupCodes.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
            <Check className="w-4 h-4" /> 2FA activé avec succès
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">Codes de secours (sauvegardez-les maintenant) :</p>
            <div className="grid grid-cols-2 gap-1.5">
              {backupCodes.map((c) => (
                <code key={c} className="text-xs font-mono bg-white px-2 py-1 rounded border text-amber-900">{c}</code>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-2">Ces codes ne seront plus affichés. Chaque code est utilisable une seule fois.</p>
          </div>
        </div>
      )}

      {enabled && step !== 'done' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
            <Check className="w-4 h-4" /> 2FA actif
          </div>
          <div>
            <label htmlFor="disable-code" className="block text-xs font-semibold text-slate-700 mb-1.5">Code TOTP pour désactiver</label>
            <input
              id="disable-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <button
            type="button"
            onClick={handleDisable}
            disabled={loading || disableCode.length !== 6}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 text-red-600 px-5 py-2.5 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Désactiver le 2FA
          </button>
        </div>
      )}
    </Section>
  );
}

function Section({
  icon: Icon, title, description, children, delay = 0,
}: {
  icon: React.ElementType; title: string; description?: string;
  children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
          <Icon className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

// ─── Main page ──────────────────────────────────────────────────
export default function ProfilePage() {
  const { userEmail, data } = useOwner();

  // Profile form state
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: userEmail,
    phone: '', address: '', zipCode: '', city: '',
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password form state
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  // Billing
  const [portalLoading, setPortalLoading] = useState(false);

  // GDPR
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // V8.2 — Agrégat Pay-per-Listing au niveau du compte (somme sur les biens).
  const props = data.map((e) => e.property);
  const bestTier: PropertyTier = props.reduce<PropertyTier>((best, p) => {
    const t = normalizeTier(p.tier);
    return TIER_RANK[t] > TIER_RANK[best] ? t : best;
  }, 'FREE');
  const totalQuota = props.reduce((s, p) => s + Number(p.dossiersQuota || 0), 0);
  const totalUsed = props.reduce(
    (s, p) => s + Number(p.dossiersAnalyzedCount || 0),
    0,
  );
  const usagePercent =
    totalQuota > 0 ? Math.min((totalUsed / totalQuota) * 100, 100) : 0;
  // Offre supérieure à proposer (upsell). MAX → on reste sur MAX.
  const nextTier: PropertyTier =
    bestTier === 'MAX'
      ? 'MAX'
      : bestTier === 'PREMIUM'
      ? 'MAX'
      : bestTier === 'ESSENTIAL'
      ? 'PREMIUM'
      : 'ESSENTIAL';

  // ── Load profile ──
  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setForm((f) => ({
            ...f,
            firstName: json.data.firstName || '',
            lastName: json.data.lastName || '',
            email: json.data.email || userEmail,
            phone: json.data.phone || '',
            address: json.data.address || '',
            zipCode: json.data.zipCode || '',
            city: json.data.city || '',
          }));
        }
      }
    } catch { /* silent */ }
    finally { setProfileLoading(false); }
  }, [userEmail]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Save profile ──
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          address: form.address,
          zipCode: form.zipCode,
          city: form.city,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Erreur de sauvegarde');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change password ──
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError('Les mots de passe ne correspondent pas');
      return;
    }
    if (pwForm.newPw.length < 8) {
      setPwError('Minimum 8 caractères');
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pwForm.current || undefined,
          newPassword: pwForm.newPw,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setPwSuccess(true);
      setPwForm({ current: '', newPw: '', confirm: '' });
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setPwSaving(false);
    }
  };

  // ── Billing portal ──
  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setPortalLoading(false);
    } catch { setPortalLoading(false); }
  };

  // ── GDPR export ──
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch('/api/user/export');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `patrimo-trust-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* silent */ }
    finally { setExportLoading(false); }
  };

  // ── GDPR delete ──
  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/user/data', { method: 'DELETE' });
      if (res.ok) {
        await signOut({ callbackUrl: '/' });
      }
    } catch { /* silent */ }
    finally { setDeleteLoading(false); }
  };

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  if (profileLoading) {
    // V8.2 (Mission 2) — la page hérite désormais de la Sidebar via OwnerShell
    return (
      <OwnerShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </div>
      </OwnerShell>
    );
  }

  return (
    <OwnerShell>
    <div className="max-w-5xl mx-auto w-full p-6 lg:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-emerald-900 sm:text-3xl">Mon Profil</h1>
        <p className="text-sm text-slate-500 mt-1">Gérez vos informations personnelles, votre sécurité et votre abonnement.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left column: forms ── */}
        <div className="lg:col-span-7 space-y-6">

          {/* Informations personnelles */}
          <Section icon={User} title="Informations personnelles" description="Nom, coordonnées et adresse" delay={0.05}>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput id="firstName" label="Prénom" icon={User} value={form.firstName} onChange={(v) => update('firstName', v)} placeholder="Votre prénom" />
                <FormInput id="lastName" label="Nom" icon={User} value={form.lastName} onChange={(v) => update('lastName', v)} placeholder="Votre nom" />
              </div>

              <FormInput id="email" label="Email" icon={Mail} value={form.email} onChange={() => {}} disabled placeholder="Email" />

              <FormInput id="phone" label="Téléphone" icon={Phone} value={form.phone} onChange={(v) => update('phone', v)} placeholder="06 12 34 56 78" />

              <FormInput id="address" label="Adresse" icon={MapPin} value={form.address} onChange={(v) => update('address', v)} placeholder="Votre adresse" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput id="zipCode" label="Code postal" icon={MapPin} value={form.zipCode} onChange={(v) => update('zipCode', v)} placeholder="75000" />
                <FormInput id="city" label="Ville" icon={MapPin} value={form.city} onChange={(v) => update('city', v)} placeholder="Paris" />
              </div>

              {profileError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{profileError}</div>
              )}

              <button
                type="submit"
                disabled={profileSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {profileSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : profileSaved ? (
                  <><Check className="w-4 h-4" /> Enregistré</>
                ) : (
                  <><Save className="w-4 h-4" /> Enregistrer</>
                )}
              </button>
            </form>
          </Section>

          {/* Mot de passe */}
          <Section icon={Lock} title="Mot de passe" description="Créez ou modifiez votre mot de passe" delay={0.1}>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <PasswordInput id="currentPw" label="Mot de passe actuel" value={pwForm.current} onChange={(v) => setPwForm((f) => ({ ...f, current: v }))} placeholder="Laissez vide si vous n'en avez pas encore" />
              <PasswordInput id="newPw" label="Nouveau mot de passe" value={pwForm.newPw} onChange={(v) => setPwForm((f) => ({ ...f, newPw: v }))} placeholder="Min. 12 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 spécial" />
              <PasswordInput id="confirmPw" label="Confirmer" value={pwForm.confirm} onChange={(v) => setPwForm((f) => ({ ...f, confirm: v }))} placeholder="Retapez le nouveau mot de passe" />

              {pwError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{pwError}</div>
              )}
              {pwSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
                  <Check className="w-4 h-4" /> Mot de passe mis à jour
                </div>
              )}

              <button
                type="submit"
                disabled={pwSaving || !pwForm.newPw}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Changer le mot de passe
              </button>
            </form>
          </Section>

          {/* Authentification à deux facteurs */}
          <TwoFactorSection />

          {/* Données & Confidentialité */}
          <Section icon={Shield} title="Données & Confidentialité" description="RGPD : export et suppression de vos données" delay={0.15}>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={exportLoading}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-slate-500" />
                  Exporter toutes mes données
                </span>
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>

              {!deleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="w-full flex items-center justify-between rounded-xl border border-red-200 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Trash2 className="w-4 h-4" />
                    Supprimer mon compte
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-2.5 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">Action irréversible</p>
                      <p className="text-xs text-red-600 mt-1">
                        Toutes vos données personnelles seront anonymisées. Vos baux et propriétés seront archivés. Cette action est définitive.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading}
                      className="flex-1 rounded-xl bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmer la suppression'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Déconnexion */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </motion.div>
        </div>

        {/* ── Right column: Carte Abonnement & Quotas (V8.2 Pay-per-Listing) ── */}
        <div className="lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:sticky lg:top-28 space-y-4"
          >
            <div className="bg-slate-950 text-white rounded-2xl p-7 shadow-2xl shadow-slate-950/30">
              {/* En-tête offre actuelle */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    Offre {TIERS[bestTier].label}
                    {bestTier !== 'FREE' && (
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {props.length} bien{props.length > 1 ? 's' : ''} ·{' '}
                    {bestTier === 'FREE'
                      ? 'Aucune analyse IA incluse'
                      : `${TIERS[bestTier].quota} analyses / bien`}
                  </p>
                </div>
              </div>

              {/* Jauge d'utilisation agrégée */}
              {totalQuota > 0 ? (
                <div className="mb-6">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-slate-400">Dossiers analysés</span>
                    <span className="font-mono text-amber-400">
                      {totalUsed} / {totalQuota}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${usagePercent}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                      className={`h-full rounded-full ${
                        usagePercent >= 100
                          ? 'bg-gradient-to-r from-red-500 to-red-400'
                          : usagePercent >= 90
                            ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      }`}
                    />
                  </div>
                  {usagePercent >= 90 && (
                    <p className="mt-2 text-[11px] text-amber-300">
                      Quota presque atteint — les prochains dossiers seront
                      facturés 0,49 € / unité.
                    </p>
                  )}
                </div>
              ) : (
                <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                  <p className="text-xs text-amber-200">
                    Souscrivez une offre pour débloquer l&rsquo;analyse IA
                    anti-fraude sur vos dossiers.
                  </p>
                </div>
              )}

              {/* CTA Upsell (fond Or) */}
              <Link
                href="/pricing"
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-amber-500/20 text-sm"
              >
                <Sparkles className="w-4 h-4" />
                {bestTier === 'MAX'
                  ? 'Gérer mon offre Max'
                  : `Passer à l'${TIERS[nextTier].label} pour ${formatTierPrice(TIERS[nextTier].priceEur)}`}
              </Link>

              {/* Portail facturation Stripe (si abonnement actif) */}
              {bestTier !== 'FREE' && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="mt-3 w-full py-2.5 bg-white/10 border border-white/20 text-white font-medium rounded-xl hover:bg-white/15 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {portalLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><ExternalLink className="w-3.5 h-3.5" /> Gérer ma facturation</>
                  )}
                </button>
              )}

              <p className="text-[11px] text-slate-500 text-center mt-4">
                Paiement par logement · Dépassement 0,49 € / dossier ·
                Résiliable à tout moment
              </p>
            </div>

            {/* Mini-récap des avantages de l'offre supérieure */}
            {bestTier !== 'MAX' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  Inclus dans {TIERS[nextTier].label}
                </p>
                <ul className="mt-2 space-y-2">
                  {TIERS[nextTier].features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
    </OwnerShell>
  );
}
