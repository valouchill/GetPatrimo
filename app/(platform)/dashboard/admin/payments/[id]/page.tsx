'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EditField, FormSection } from '../../_components/EditField';
import SaveBar from '../../_components/SaveBar';

interface PaymentDoc {
  _id: string;
  status: string;
  period: { month: number; year: number };
  amounts: { rentHC: number; charges: number; totalTTC: number; paidAmount: number };
  paymentMethod?: string;
  notes?: string;
  receiptUrl?: string;
  receiptSentAt?: string;
  receiptSentTo?: string;
  revision?: { applied: boolean; previousRent?: number; newRent?: number; irlIndex?: number; irlDate?: string };
  regularization?: { applied: boolean; realCharges?: number; provisionCharges?: number; adjustment?: number };
  discount?: { applied: boolean; amount?: number; reason?: string };
  prorata?: { isProrata: boolean; daysInMonth?: number; daysOccupied?: number; ratio?: number };
  tenant?: { email?: string; firstName?: string; lastName?: string };
  owner?: { email?: string };
  property?: { name?: string; address?: string };
  remindersSent?: Array<{ date: string; type: string }>;
}

const STATUSES = ['PENDING', 'CONFIRMED', 'PARTIAL', 'LATE', 'UNPAID'];
const METHODS = ['VIREMENT', 'CHEQUE', 'ESPECES', 'PRELEVEMENT', 'AUTRE'];

export default function AdminPaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PaymentDoc | null>(null);
  const [initial, setInitial] = useState<PaymentDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/payments/${id}`);
    const json = await res.json();
    setData(json.payment);
    setInitial(json.payment);
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées (chargement au montage / sur changement ciblé)
  useEffect(() => { load();   }, [id]);

  const dirty = useMemo(() => JSON.stringify(data) !== JSON.stringify(initial), [data, initial]);

  function setField(path: string, value: any) {
    if (!data) return;
    const next = JSON.parse(JSON.stringify(data));
    const parts = path.split('.');
    let obj: any = next;
    for (let i = 0; i < parts.length - 1; i++) {
      obj[parts[i]] = obj[parts[i]] || {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    setData(next);
    setInfo(null);
  }

  function buildPatch(): Record<string, any> {
    if (!data || !initial) return {};
    const payload: Record<string, any> = {};
    // Flat fields
    if (data.status !== initial.status) payload.status = data.status;
    if (data.paymentMethod !== initial.paymentMethod) payload.paymentMethod = data.paymentMethod;
    if (data.notes !== initial.notes) payload.note = data.notes || '';
    if (data.receiptUrl !== initial.receiptUrl) payload.receiptUrl = data.receiptUrl || '';
    // Nested
    if (JSON.stringify(data.amounts) !== JSON.stringify(initial.amounts)) payload.amounts = data.amounts;
    if (JSON.stringify(data.period) !== JSON.stringify(initial.period)) payload.period = data.period;
    if (JSON.stringify(data.prorata) !== JSON.stringify(initial.prorata)) payload.prorata = data.prorata;
    if (JSON.stringify(data.revision) !== JSON.stringify(initial.revision)) payload.revision = data.revision;
    if (JSON.stringify(data.regularization) !== JSON.stringify(initial.regularization)) payload.regularization = data.regularization;
    if (JSON.stringify(data.discount) !== JSON.stringify(initial.discount)) payload.discount = data.discount;
    // map paidAmount out of amounts nested (handled by amounts above)
    return payload;
  }

  async function save() {
    setSaving(true); setInfo(null);
    try {
      const res = await fetch(`/api/admin/payments/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPatch()),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setInfo(`❌ ${j.error || 'Erreur'}`);
      else { setInfo('✓ Enregistré'); await load(); setTimeout(() => setInfo(null), 3000); }
    } finally { setSaving(false); }
  }

  async function runAction(label: string, url: string, body?: any) {
    if (!confirm(`Confirmer : ${label} ?`)) return;
    setActionBusy(true); setActionInfo(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setActionInfo(`❌ ${j.error || 'Erreur'}`);
      else { setActionInfo(`✓ ${label}`); await load(); setTimeout(() => setActionInfo(null), 4000); }
    } finally { setActionBusy(false); }
  }

  if (loading || !data) return <div className="text-gray-500">Chargement…</div>;

  return (
    <div>
      <Link href="/dashboard/admin/payments" className="text-sm text-indigo-600 hover:underline">← Paiements</Link>
      <header className="my-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {String(data.period.month).padStart(2, '0')}/{data.period.year} — {data.property?.name || '—'}
        </h1>
        <p className="text-sm text-gray-600">
          Locataire <span className="font-mono">{data.tenant?.email || '—'}</span> · Propriétaire <span className="font-mono">{data.owner?.email || '—'}</span>
        </p>
      </header>

      <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Actions</h2>
          {actionInfo && <span className={`text-sm ${actionInfo.startsWith('❌') ? 'text-red-600' : 'text-green-600'}`}>{actionInfo}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => runAction('Régénérer la quittance', `/api/admin/payments/${id}/regenerate-receipt`)} disabled={actionBusy}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
            📄 Régénérer quittance
          </button>
          <button onClick={() => runAction('Envoyer la quittance', `/api/admin/payments/${id}/send-receipt`, {})} disabled={actionBusy}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
            ✉️ Envoyer quittance
          </button>
          <button onClick={() => runAction('Envoyer relance', `/api/admin/payments/${id}/send-reminder`)} disabled={actionBusy}
            className="px-3 py-1.5 text-sm border border-amber-300 text-amber-800 rounded hover:bg-amber-50 disabled:opacity-50">
            🔔 Envoyer relance
          </button>
          {data.receiptUrl && (
            <a href={`/${data.receiptUrl}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
              📎 Télécharger PDF
            </a>
          )}
        </div>
        {data.receiptSentAt && (
          <div className="text-xs text-gray-500 mt-2">
            Dernière envoi : {new Date(data.receiptSentAt).toLocaleString('fr-FR')} à <span className="font-mono">{data.receiptSentTo}</span>
          </div>
        )}
        {data.remindersSent && data.remindersSent.length > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            Relances envoyées : {data.remindersSent.length}
          </div>
        )}
      </section>

      <FormSection title="Statut & méthode">
        <EditField label="Statut" name="status" type="select" value={data.status} onChange={(v) => setField('status', v)}
          options={STATUSES.map((s) => ({ value: s, label: s }))} />
        <EditField label="Mode de paiement" name="paymentMethod" type="select" value={data.paymentMethod || ''} onChange={(v) => setField('paymentMethod', v)}
          options={[{ value: '', label: '—' }, ...METHODS.map((s) => ({ value: s, label: s }))]} />
      </FormSection>

      <FormSection title="Période">
        <EditField label="Mois" name="month" type="number" min={1} max={12} value={data.period.month} onChange={(v) => setField('period.month', v)} />
        <EditField label="Année" name="year" type="number" min={2020} max={2100} value={data.period.year} onChange={(v) => setField('period.year', v)} />
      </FormSection>

      <FormSection title="Montants (€)">
        <EditField label="Loyer HC" name="rentHC" type="number" min={0} value={data.amounts.rentHC} onChange={(v) => setField('amounts.rentHC', v)} />
        <EditField label="Charges" name="charges" type="number" min={0} value={data.amounts.charges} onChange={(v) => setField('amounts.charges', v)} />
        <EditField label="Total TTC" name="totalTTC" type="number" min={0} value={data.amounts.totalTTC} onChange={(v) => setField('amounts.totalTTC', v)} />
        <EditField label="Payé" name="paidAmount" type="number" min={0} value={data.amounts.paidAmount} onChange={(v) => setField('amounts.paidAmount', v)} />
      </FormSection>

      <FormSection title="Révision IRL">
        <EditField label="Appliquée" name="revApplied" type="checkbox" value={data.revision?.applied} onChange={(v) => setField('revision.applied', v)} />
        <EditField label="Loyer précédent" name="revPrev" type="number" min={0} value={data.revision?.previousRent} onChange={(v) => setField('revision.previousRent', v)} />
        <EditField label="Nouveau loyer" name="revNew" type="number" min={0} value={data.revision?.newRent} onChange={(v) => setField('revision.newRent', v)} />
        <EditField label="Indice IRL" name="irlIndex" type="number" value={data.revision?.irlIndex} onChange={(v) => setField('revision.irlIndex', v)} />
        <EditField label="Date IRL" name="irlDate" type="date" value={data.revision?.irlDate} onChange={(v) => setField('revision.irlDate', v)} />
      </FormSection>

      <FormSection title="Régularisation">
        <EditField label="Appliquée" name="regApplied" type="checkbox" value={data.regularization?.applied} onChange={(v) => setField('regularization.applied', v)} />
        <EditField label="Charges réelles" name="regReal" type="number" min={0} value={data.regularization?.realCharges} onChange={(v) => setField('regularization.realCharges', v)} />
        <EditField label="Provisions" name="regProv" type="number" min={0} value={data.regularization?.provisionCharges} onChange={(v) => setField('regularization.provisionCharges', v)} />
        <EditField label="Ajustement (+/-)" name="regAdj" type="number" value={data.regularization?.adjustment} onChange={(v) => setField('regularization.adjustment', v)} />
      </FormSection>

      <FormSection title="Remise">
        <EditField label="Appliquée" name="discApp" type="checkbox" value={data.discount?.applied} onChange={(v) => setField('discount.applied', v)} />
        <EditField label="Montant" name="discAmount" type="number" min={0} value={data.discount?.amount} onChange={(v) => setField('discount.amount', v)} />
        <EditField label="Motif" name="discReason" type="textarea" rows={2} className="md:col-span-2" value={data.discount?.reason} onChange={(v) => setField('discount.reason', v)} />
      </FormSection>

      <FormSection title="Notes">
        <EditField label="Notes internes" name="notes" type="textarea" rows={3} className="md:col-span-2" value={data.notes} onChange={(v) => setField('notes', v)} />
      </FormSection>

      <SaveBar dirty={dirty} saving={saving} info={info} onSave={save} onReset={() => setData(initial)} />
    </div>
  );
}
