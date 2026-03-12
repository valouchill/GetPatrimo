'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Check, Building2, Shield, Pencil,
  Lock, ExternalLink, Loader2, Crown,
  FileText, Fingerprint, Unlock,
} from 'lucide-react';
import { useOwner } from './OwnerContext';
import LbcShieldMessage from '@/app/components/LbcShieldMessage';
import TrustCardPreview from '@/app/components/TrustCardPreview';
import EditPropertyModal from '@/app/components/EditPropertyModal';
import PropertyTimeline from '@/app/components/PropertyTimeline';
import WelcomeBriefingModal from '@/app/components/WelcomeBriefingModal';
import CheckoutModal from '@/app/components/CheckoutModal';

function gradeLabel(g: string) {
  if (g === 'S' || g === 'SOUVERAIN') return 'S';
  return g;
}

function gradePill(g: string) {
  if (g === 'S' || g === 'SOUVERAIN')
    return 'bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/25';
  if (g === 'A' || g === 'PREMIUM')
    return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (g === 'B' || g === 'STANDARD')
    return 'bg-blue-50 text-blue-700 border border-blue-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

function derivePrivilegeCode(token: string): string {
  if (token.startsWith('PT-')) return token;
  return `PT-${token.slice(0, 5).toUpperCase()}`;
}

export default function OwnerDashboardClient() {
  const { loading, activeEntry, refresh } = useOwner();
  const [editOpen, setEditOpen] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<{
    id: string; name: string; grade: string;
  } | null>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setJustUnlocked(true);
      refresh();
      const t = setTimeout(() => setJustUnlocked(false), 4000);
      return () => clearTimeout(t);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const property = activeEntry?.property;
  const candidatures = activeEntry?.candidatures ?? [];

  const applyUrl =
    typeof window !== 'undefined' && property?.applyToken
      ? `${window.location.origin}/apply/${property.applyToken}`
      : property?.applyToken
        ? `/apply/${property.applyToken}`
        : null;

  const privilegeCode = property
    ? derivePrivilegeCode(property.applyToken || '')
    : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-8">
          <Building2 className="w-9 h-9 text-slate-400" />
        </div>
        <h2
          className="text-2xl font-bold text-slate-900 mb-3"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Votre cockpit est prêt
        </h2>
        <p className="text-slate-500 max-w-md mx-auto mb-8">
          Ajoutez votre premier bien pour activer le protocole de sécurité
          et commencer à recevoir des dossiers certifiés.
        </p>
        <Link
          href="/fast-track"
          className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
        >
          <Building2 className="w-5 h-5" />
          Ajouter mon bien
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* ── BRIEFING DE BIENVENUE (première visite) ── */}
      <WelcomeBriefingModal />

      {/* ── BANDEAU SUCCÈS POST-PAIEMENT ── */}
      <AnimatePresence>
        {justUnlocked && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <Unlock className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900 text-sm">Scellés levés avec succès</h3>
              <p className="text-xs text-emerald-700">
                Vos dossiers sont maintenant déverrouillés. Identités, documents et coordonnées sont accessibles.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PROPERTY FOCUS ── */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-3xl font-bold text-slate-900"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {property.address || property.title}
              </h1>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="text-slate-300 hover:text-emerald-600 transition-colors p-1"
                title="Modifier les informations du bien"
              >
                <Pencil className="w-[18px] h-[18px]" />
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm mt-1">
              {property.surfaceM2 && (
                <span className="text-emerald-700 font-medium">{property.surfaceM2} m²</span>
              )}
              {property.rent && (
                <span className="text-emerald-700 font-medium">{property.rent} € CC</span>
              )}
            </div>
          </div>
          {property.archived ? (
            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full text-sm font-medium border border-slate-200 self-start">
              🌙 En sommeil
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-sm font-medium border border-emerald-200 self-start">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              En recherche de locataire
            </span>
          )}
        </div>

        {/* Timeline Souveraine */}
        <PropertyTimeline activeStep={0} />
      </section>

      {/* Modale d'édition du bien */}
      <EditPropertyModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        propertyId={property.id}
        currentAddress={property.address || property.title || ''}
        currentSurface={property.surfaceM2}
        currentRent={property.rent}
        isArchived={property.archived}
        onSaved={refresh}
      />

      {/* Paywall Stripe : Modale de Scellement */}
      <CheckoutModal
        open={!!checkoutTarget}
        onClose={() => setCheckoutTarget(null)}
        tenantName={checkoutTarget?.name || ''}
        tenantGrade={checkoutTarget?.grade || ''}
        propertyId={property.id}
        tenantId={checkoutTarget?.id || ''}
      />

      {/* ── BLOC ACQUISITION : LBC Shield + Trust Card (masqué si archivé) ── */}
      {applyUrl && !property.archived && (
        <section className="bg-white shadow-md rounded-3xl p-8 border border-slate-100">
          <h2
            className="text-2xl font-bold text-slate-900 mb-6"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Invitez vos candidats en toute sécurité
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Colonne gauche : Message LBC anti-spam */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                Message LeBonCoin (anti-blocage)
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Copiez ce message et collez-le en réponse aux candidats sur LeBonCoin.
                Le lien &quot;cassé&quot; contourne les filtres anti-spam.
              </p>
              <LbcShieldMessage privilegeCode={privilegeCode} />
            </div>

            {/* Colonne droite : Carte Sésame Numérique */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                Sésame Numérique
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Téléchargez cette carte pour l&apos;envoyer sur WhatsApp ou l&apos;ajouter en photo
                sur votre annonce LeBonCoin.
              </p>
              <TrustCardPreview applyUrl={applyUrl} privilegeCode={privilegeCode} />
            </div>
          </div>
        </section>
      )}

      {/* ── SALON D'ATTENTE — DOSSIERS SOUS SCELLÉ ── */}
      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
          Dossiers Audités
          {candidatures.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
              {candidatures.length}
            </span>
          )}
        </h2>

        {candidatures.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center rounded-2xl">
            <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Shield className="w-7 h-7 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              En attente des premiers scans...
            </h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Votre coffre-fort est ouvert. Dès qu&apos;un candidat utilisera
              votre Sésame, son audit IA s&apos;affichera ici en temps réel.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {candidatures.map((c) => {
              const isSovereign = c.patrimometer.grade === 'S' || c.patrimometer.grade === 'SOUVERAIN';
              const sealed = c.isSealed;

              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                    isSovereign ? 'border-amber-200 shadow-amber-100/50' : 'border-slate-200'
                  }`}
                >
                  {/* En-tête du dossier */}
                  <div className={`p-5 ${isSovereign ? 'bg-amber-50/30' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Avatar / Grade */}
                        <div className="relative shrink-0">
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-bold ${gradePill(c.patrimometer.grade)}`}
                          >
                            {isSovereign ? '🛡️' : gradeLabel(c.patrimometer.grade)}
                          </div>
                          {sealed && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white">
                              <Lock className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {sealed ? (
                              <>
                                <h4 className="font-semibold text-slate-900">
                                  Candidat certifié {c.sealedId}
                                </h4>
                                <span className="text-xs text-slate-400 font-mono">
                                  ({c.sealedLabel})
                                </span>
                              </>
                            ) : (
                              <h4 className="font-semibold text-slate-900 truncate">
                                {c.profile.firstName} {c.profile.lastName}
                              </h4>
                            )}
                            {c.didit.status === 'VERIFIED' && (
                              <span className="shrink-0 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                                <Fingerprint className="w-3 h-3" />
                                Biométrie
                              </span>
                            )}
                          </div>

                          {/* Chiffres en clair (l'appât) */}
                          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            <span className="font-medium text-slate-700">
                              Score {c.patrimometer.score}/100
                            </span>
                            {c.financialSummary?.contractType && (
                              <span>• {c.financialSummary.contractType}</span>
                            )}
                            {c.financialSummary?.monthlyNetIncome && (
                              <span>• {c.financialSummary.monthlyNetIncome.toLocaleString('fr-FR')} €/mois</span>
                            )}
                            {c.guarantor.status === 'CERTIFIED' && (
                              <span className="text-blue-600">• Garant certifié</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!sealed && (
                          <button
                            onClick={() => window.open(`/verify/${c.applyToken}`, '_blank')}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            Voir le dossier
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setCheckoutTarget({
                            id: c.id,
                            name: sealed
                              ? `Candidat ${c.sealedId}`
                              : `${c.profile.firstName} ${c.profile.lastName}`,
                            grade: c.patrimometer.grade,
                          })}
                          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors shadow-md ${
                            sealed
                              ? 'text-white bg-slate-900 hover:bg-slate-800 shadow-slate-900/15'
                              : 'text-white bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                          }`}
                        >
                          {sealed ? (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-amber-400" />
                              Déverrouiller ce profil
                            </>
                          ) : (
                            <>
                              <Crown className="w-3.5 h-3.5 text-amber-300" />
                              Accepter &amp; Générer le bail
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Verdict IA (visible même sous scellé) */}
                    {c.financialSummary?.remainingIncome != null && (
                      <div className="mt-3 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-semibold text-slate-800">Verdict IA :</span>{' '}
                          Ce candidat présente un reste à vivre de{' '}
                          <span className="font-bold text-emerald-700">
                            {c.financialSummary.remainingIncome.toLocaleString('fr-FR')} €
                          </span>{' '}
                          après paiement du loyer.
                          {c.financialSummary.riskPercent != null && (
                            <> Le risque d&apos;impayé est évalué à{' '}
                            <span className="font-bold text-emerald-700">
                              {c.financialSummary.riskPercent}%
                            </span>{' '}
                            ({c.financialSummary.riskLevel || 'Faible'}).</>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Documents sous scellé */}
                  {sealed && (
                    <div className="border-t border-slate-100 p-5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {['Pièce d\'identité', 'Fiche de paie', 'Avis d\'imposition', 'Justificatif de domicile'].map((doc) => (
                          <div
                            key={doc}
                            className="relative bg-slate-50 rounded-xl p-4 text-center border border-slate-100 overflow-hidden"
                          >
                            <div className="absolute inset-0 backdrop-blur-[1px] bg-white/30 z-10 flex flex-col items-center justify-center">
                              <Lock className="w-4 h-4 text-amber-500 mb-1" />
                              <span className="text-[9px] text-amber-600 font-medium">Sous scellé</span>
                            </div>
                            <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                            <p className="text-[10px] text-slate-400 leading-tight">{doc}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 text-center mt-3 flex items-center justify-center gap-1.5">
                        <Shield className="w-3 h-3 text-amber-500" />
                        Authenticité validée par biométrie Didit — Identité et pièces sous scellé
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── FOOTER ── */}
      <footer className="pt-8 text-center">
        <p className="text-xs text-slate-400">PatrimoTrust™ • Standard de Confiance Immobilier 2026</p>
      </footer>
    </motion.div>
  );
}
