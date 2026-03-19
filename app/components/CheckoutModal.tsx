'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Shield, CreditCard, FileText, Receipt, ClipboardCheck } from 'lucide-react';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  tenantName?: string;
  tenantGrade?: string;
  tenantId?: string;
  propertyLabel?: string;
  candidateCount?: number;
  unlockScope?: 'property' | 'candidate';
}

export default function CheckoutModal({
  open,
  onClose,
  propertyId,
  tenantName = '',
  tenantGrade = '',
  tenantId = '',
  propertyLabel = '',
  candidateCount = 0,
  unlockScope = 'property',
}: CheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          tenantId: unlockScope === 'candidate' ? tenantId : undefined,
          tenantName: unlockScope === 'candidate' ? tenantName : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création de la session de paiement.');
        setLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
      setLoading(false);
    }
  };

  const isPropertyUnlock = unlockScope === 'property';
  const gradeEmoji = tenantGrade === 'S' || tenantGrade === 'SOUVERAIN' ? '🛡️' : '✓';
  const candidateLabel = candidateCount > 1 ? `${candidateCount} dossiers` : candidateCount === 1 ? '1 dossier' : 'le bien';
  const accentLabel = isPropertyUnlock
    ? propertyLabel || candidateLabel
    : `${gradeEmoji} ${tenantName}`;
  const title = isPropertyUnlock ? 'Accédez aux dossiers complets.' : 'Poursuivre avec ce dossier.';
  const subtitle = isPropertyUnlock
    ? `Le paiement ouvre tous les profils masqués de ${propertyLabel || 'ce bien'} et vous laisse comparer puis sélectionner sereinement.`
    : 'Scellons votre location avec';
  const unlockLineItems = isPropertyUnlock
    ? ['Tous les dossiers du bien visibles', 'Comparateur complet débloqué', 'Sélection explicite avant bail']
    : ['Audit complet débloqué', 'Génération du Bail sécurisé', "Module État des lieux d'entrée"];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bandeau supérieur décoratif */}
            <div className="h-1.5 bg-gradient-to-r from-slate-900 via-emerald-600 to-amber-500" />

            {/* Bouton fermer */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="px-8 pt-8 pb-3">
              {/* En-tête */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h2
                    className="text-xl font-bold text-slate-900"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    {title}
                  </h2>
                </div>
              </div>
              <p className="text-slate-600 text-sm mb-6">
                {isPropertyUnlock ? (
                  subtitle
                ) : (
                  <>
                    {subtitle}{' '}
                    <span className="font-semibold text-slate-900">
                      {accentLabel}
                    </span>.
                  </>
                )}
              </p>

              {/* Récapitulatif de valeur */}
              <div className="bg-slate-50 rounded-2xl p-5 space-y-4 mb-5 border border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-900 text-sm">Pack Mise en Location</h4>
                      <span className="font-bold text-slate-900">89,00 €</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Paiement unique</p>
                    <ul className="mt-2 space-y-1">
                      {unlockLineItems.map((item) => (
                        <li key={item} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="border-t border-slate-200" />

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Receipt className="w-4 h-4 text-amber-700" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-900 text-sm">Gestion Souveraine</h4>
                      <span className="font-bold text-slate-900">9,99 € <span className="font-normal text-slate-500 text-xs">/ mois</span></span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Sans engagement · Résiliable à tout moment</p>
                    <ul className="mt-2 space-y-1">
                      {['Quittances automatiques', 'Suivi de paiement', 'État des lieux de sortie'].map((item) => (
                        <li key={item} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Check className="w-3 h-3 text-amber-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between px-1 mb-4">
                <span className="text-sm text-slate-500">Total aujourd&apos;hui</span>
                <span className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                  98,99 €
                </span>
              </div>
            </div>

            {/* Zone d'action */}
            <div className="px-8 pb-8 space-y-3">
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-center"
                >
                  {error}
                </motion.p>
              )}

              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-semibold text-sm shadow-xl shadow-slate-900/25 hover:bg-slate-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4.5 h-4.5" />
                    <span className="text-amber-400">◆</span>
                    {isPropertyUnlock ? 'Accéder aux dossiers complets' : 'Déverrouiller et poursuivre'}
                  </>
                )}
              </button>

              <div className="flex items-start gap-2 px-1">
                <ClipboardCheck className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  💡 Ces frais sont 100% déductibles de vos revenus fonciers (charges de gestion locative, Art. 31 CGI).
                </p>
              </div>

              <p className="text-center text-[10px] text-slate-400">
                Paiement sécurisé par Stripe · Puis 9,99 €/mois sans engagement
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
