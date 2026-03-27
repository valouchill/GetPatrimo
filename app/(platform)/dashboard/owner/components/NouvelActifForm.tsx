'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { StepBar, Btn, ACTIF_STEPS } from './ui';

export function NouvelActifForm({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ address: '', rentAmount: '', surfaceM2: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/owner/properties', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: form.address, rentAmount: parseFloat(form.rentAmount) || 0, surfaceM2: parseFloat(form.surfaceM2) || undefined }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Erreur lors de la création.'); return; }
      onDone();
    } catch { setError('Erreur réseau. Vérifiez votre connexion.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
        <StepBar step={step} steps={ACTIF_STEPS} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        {step === 0 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Adresse du bien</h3>
            <p className="mb-5 text-sm text-slate-500">Entrez l&apos;adresse complète du logement à mettre en gestion.</p>
            <div className="mb-6">
              <label htmlFor="actif-address" className="mb-1.5 block text-xs font-semibold text-slate-700">Adresse complète</label>
              <input id="actif-address" type="text" placeholder="Ex : 42 rue de la Roquette, 75011 Paris"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                value={form.address} onChange={(e) => f('address', e.target.value)}
                aria-required="true" />
            </div>
            <div className="flex justify-end">
              <Btn variant="amber" disabled={!form.address.trim()} onClick={() => setStep(1)}>
                Continuer <ArrowRight className="h-4 w-4" />
              </Btn>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Paramètres locatifs</h3>
            <p className="mb-5 text-sm text-slate-500">Ces données alimentent le scoring automatique des candidatures.</p>
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="actif-rent" className="mb-1.5 block text-xs font-semibold text-slate-700">Loyer charges exclues (€)</label>
                <input id="actif-rent" type="number" min={0} placeholder="1 200"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                  value={form.rentAmount} onChange={(e) => f('rentAmount', e.target.value)}
                  aria-required="true" />
              </div>
              <div>
                <label htmlFor="actif-surface" className="mb-1.5 block text-xs font-semibold text-slate-700">Surface (m²) <span className="font-normal text-slate-400">optionnel</span></label>
                <input id="actif-surface" type="number" min={0} placeholder="45"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                  value={form.surfaceM2} onChange={(e) => f('surfaceM2', e.target.value)} />
              </div>
            </div>
            <div className="flex justify-between">
              <Btn variant="secondary" onClick={() => setStep(0)}>← Retour</Btn>
              <Btn variant="amber" disabled={!form.rentAmount} onClick={() => setStep(2)}>Continuer →</Btn>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Récapitulatif</h3>
            <p className="mb-5 text-sm text-slate-500">Vérifiez avant de créer la fiche.</p>
            <div className="mb-5 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50">
              {([['Adresse', form.address], ['Loyer', `${parseFloat(form.rentAmount) || 0} €/mois`], ['Surface', form.surfaceM2 ? `${parseFloat(form.surfaceM2)} m²` : '—']] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500">{k}</span><span className="font-semibold text-slate-900">{v}</span>
                </div>
              ))}
            </div>
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Un lien Sésame unique sera généré pour partager aux candidats.</span>
            </div>
            {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="flex justify-between">
              <Btn variant="secondary" onClick={() => setStep(1)}>← Retour</Btn>
              <Btn variant="amber" disabled={loading} onClick={handleSubmit}>
                <CheckCircle2 className="h-4 w-4" /> {loading ? 'Création…' : 'Créer le bien'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
