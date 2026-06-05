'use client';

/**
 * <CoTenantVerificationClient> — écran ouvert par un colocataire depuis le lien
 * de son email d'invitation. Il y certifie son identité (eIDAS via Didit).
 *
 * Implémentation focalisée sur le chemin Didit (le fallback audit documentaire
 * du flux garant est différé). Utilise /api/cotenant/{status,create-session}.
 * À la certification, le webhook + la route status re-synchronisent le score du
 * foyer côté Application (cf. lib/cotenant-sync).
 */

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle, Fingerprint } from 'lucide-react';

interface CoTenantInfo {
  email?: string;
  firstName?: string;
  lastName?: string;
  slot?: number;
  status?: string;
}

export default function CoTenantVerificationClient({ token }: { token: string }) {
  const [info, setInfo] = useState<CoTenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCertified, setIsCertified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [diditSessionId, setDiditSessionId] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/cotenant/status?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Lien invalide ou expiré.');
        return;
      }
      setInfo(data.coTenant);
      if (data.coTenant?.status === 'CERTIFIED') setIsCertified(true);
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Polling pendant la session Didit (la route status re-sync le foyer).
  useEffect(() => {
    if (!diditSessionId || isCertified) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/cotenant/status?token=${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.coTenant?.status === 'CERTIFIED') {
            setIsCertified(true);
            clearInterval(interval);
          }
        }
      } catch {
        /* on réessaiera au prochain tick */
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [diditSessionId, token, isCertified]);

  const startDidit = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/cotenant/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationToken: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création de la session.');
        setIsVerifying(false);
        return;
      }
      if (data.fallbackMode) {
        setFallback(true);
        setIsVerifying(false);
        return;
      }
      setDiditSessionId(data.sessionId);
      setVerificationUrl(data.verificationUrl);
    } catch {
      setFallback(true);
      setIsVerifying(false);
    }
  };

  const fullName = [info?.firstName, info?.lastName].filter(Boolean).join(' ');

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-2xl sm:p-10">
        {/* En-tête */}
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-900">
            <ShieldCheck className="h-6 w-6 text-amber-400" aria-hidden="true" />
          </span>
          <p className="mt-4 font-serif text-lg font-semibold text-emerald-900">Maison Patrimo</p>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Colocation — Certification d’identité
          </p>
        </div>

        {/* Contenu */}
        <div className="mt-8">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              <p className="text-sm">Chargement…</p>
            </div>
          ) : error && !info ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </span>
              <h1 className="text-lg font-semibold text-slate-900">Lien invalide</h1>
              <p className="text-sm leading-relaxed text-slate-500">{error}</p>
            </div>
          ) : isCertified ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </span>
              <h1 className="font-serif text-xl font-semibold text-emerald-900">Identité certifiée</h1>
              <p className="text-sm leading-relaxed text-slate-500">
                Merci{fullName ? ` ${fullName}` : ''} ! Votre identité est vérifiée. Votre
                colocation est renforcée auprès du propriétaire. Vous pouvez fermer cette page.
              </p>
            </div>
          ) : diditSessionId && verificationUrl ? (
            <div className="flex flex-col gap-4">
              <p className="text-center text-sm text-slate-600">
                Suivez la vérification sécurisée Didit ci-dessous. Cette page se met à jour
                automatiquement une fois terminée.
              </p>
              <iframe
                src={verificationUrl}
                title="Vérification Didit"
                allow="camera; microphone"
                className="h-[460px] w-full rounded-2xl border border-slate-200"
              />
              <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> En attente de la certification…
              </p>
            </div>
          ) : fallback ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
                <AlertCircle className="h-7 w-7 text-amber-500" />
              </span>
              <h1 className="text-lg font-semibold text-slate-900">Vérification indisponible</h1>
              <p className="text-sm leading-relaxed text-slate-500">
                La certification eIDAS n’est pas disponible pour le moment. Réessayez plus tard
                ou contactez le colocataire qui vous a invité.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 text-center">
              <p className="text-sm leading-relaxed text-slate-600">
                {fullName ? `Bonjour ${fullName}, vous` : 'Vous'} avez été invité(e) à rejoindre une{' '}
                <span className="font-semibold text-emerald-900">colocation</span> sur Maison Patrimo.
                Certifiez votre identité en moins de 30 secondes.
              </p>
              <ul className="mx-auto space-y-2 text-left text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 shrink-0 text-emerald-600" /> Vérification eIDAS (biométrie)
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /> Aucun document sensible stocké
                </li>
              </ul>
              <button
                type="button"
                onClick={startDidit}
                disabled={isVerifying}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Préparation…
                  </>
                ) : (
                  <>Certifier mon identité (Didit)</>
                )}
              </button>
              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
