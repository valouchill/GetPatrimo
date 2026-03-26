'use client';

import { useState } from 'react';
import { useNotification } from '@/app/hooks/useNotification';
import { motion } from 'framer-motion';
import {
  User, Mail, Save, Check, Shield, Zap,
  Crown, ExternalLink, Receipt,
} from 'lucide-react';
import { useOwner } from '../OwnerContext';

const FREE_AUDIT_LIMIT = 3;

export default function ProfilePage() {
  const { userEmail, data } = useOwner();
  const notify = useNotification();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: userEmail,
  });
  const [saved, setSaved] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const totalAudits = data.reduce((sum, e) => sum + e.candidatures.length, 0);
  const usagePercent = Math.min((totalAudits / FREE_AUDIT_LIMIT) * 100, 100);
  const hasActiveSubscription = data.some((e) => e.property.managed === true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        notify.error(json.error || 'Impossible d\'ouvrir le portail.');
        setPortalLoading(false);
      }
    } catch {
      notify.error('Erreur réseau.');
      setPortalLoading(false);
    }
  };

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 max-w-5xl mx-auto">
      {/* ── Col 1 : Formulaire identité ── */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        className="md:col-span-7"
      >
        <h1
          className="text-3xl font-bold text-slate-900 mb-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Mon Profil
        </h1>
        <p className="text-slate-500 text-sm mb-8">Gérez vos informations personnelles.</p>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Prénom
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => update('firstName', e.target.value)}
                    placeholder="Votre prénom"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nom
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => update('lastName', e.target.value)}
                    placeholder="Votre nom"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  disabled
                  className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm cursor-not-allowed"
                />
              </div>
            </div>

          </div>

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-md text-sm"
          >
            {saved ? (
              <><Check className="w-4 h-4" /> Enregistré</>
            ) : (
              <><Save className="w-4 h-4" /> Enregistrer</>
            )}
          </button>
        </form>
      </motion.div>

      {/* ── Col 2 : Carte Statut ── */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="md:col-span-5"
      >
        <div className="bg-slate-950 text-white rounded-3xl p-8 shadow-2xl shadow-slate-950/30 sticky top-28">
          {hasActiveSubscription ? (
            <>
              {/* ── ÉTAT SOUVERAIN ACTIF ── */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Crown className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    Gestion Souveraine
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  </h3>
                  <p className="text-xs text-slate-400">Abonnement actif · 9,99 €/mois</p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {[
                  { icon: Check, label: 'Profils candidats déverrouillés', color: 'text-emerald-400' },
                  { icon: Receipt, label: 'Génération de bail sécurisé', color: 'text-emerald-400' },
                  { icon: Shield, label: 'Quittances automatiques', color: 'text-emerald-400' },
                  { icon: Zap, label: 'Suivi de paiement & relances', color: 'text-emerald-400' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
                    <span className="text-sm text-slate-300">{label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="w-full py-3.5 bg-white/10 border border-white/20 text-white font-medium rounded-xl hover:bg-white/15 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {portalLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Gérer ma facturation &amp; Mes factures
                  </>
                )}
              </button>

              <p className="text-[11px] text-slate-500 text-center mt-3">
                Factures · Moyen de paiement · Résiliation — Portail sécurisé Stripe
              </p>
            </>
          ) : (
            <>
              {/* ── ÉTAT FREEMIUM ── */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Compte Gratuit</h3>
                  <p className="text-xs text-slate-400">Plan actuel</p>
                </div>
              </div>

              {/* Jauge d'utilisation */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-400">Audits IA utilisés</span>
                  <span className="font-mono text-amber-400">
                    {totalAudits}/{FREE_AUDIT_LIMIT}
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
                        : usagePercent >= 66
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                          : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    }`}
                  />
                </div>
                {usagePercent >= 100 && (
                  <p className="text-xs text-red-400 mt-2">
                    Limite atteinte. Acceptez un dossier pour activer la Gestion Souveraine.
                  </p>
                )}
              </div>

              {/* Pack Mise en Location */}
              <div className="space-y-3 mb-5">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Pack Mise en Location — 89 €
                </h4>
                {[
                  'Audit complet débloqué',
                  'Génération du Bail sécurisé',
                  "Module État des lieux d'entrée",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-800 mb-5" />

              {/* Gestion Souveraine */}
              <div className="space-y-3 mb-8">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Gestion Souveraine — 9,99 €/mois
                </h4>
                {[
                  'Quittances automatiques',
                  'Suivi de paiement',
                  'État des lieux de sortie',
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-medium rounded-xl hover:scale-[1.02] transition-transform shadow-lg shadow-amber-500/20 text-sm">
                Accepter un dossier pour activer
              </button>

              <p className="text-[11px] text-slate-500 text-center mt-3">
                89 € (une fois) + 9,99 €/mois sans engagement · 100% déductible
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
