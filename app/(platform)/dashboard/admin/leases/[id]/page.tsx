'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { EditField, FormSection } from '../../_components/EditField';
import SaveBar from '../../_components/SaveBar';

interface LeaseDoc {
  _id: string;
  tenantFirstName?: string;
  tenantLastName?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  startDate?: string;
  endDate?: string | null;
  rentAmount?: number;
  chargesAmount?: number;
  depositAmount?: number;
  propertyType?: string;
  leaseType?: string;
  paymentDay?: number;
  durationMonths?: number;
  additionalClauses?: string;
  leaseStatus?: string;
  irlRevision?: { enabled?: boolean; anniversaryDate?: string | null; referenceIndex?: number | null };
  specificClauses?: { petsAllowed?: boolean; terminationClause?: boolean; recoverableChargesType?: string };
  termination?: any;
  user?: { email?: string };
  property?: { _id?: string; name?: string; city?: string; address?: string };
}

const LEASE_STATUSES = ['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED'];
const LEASE_TYPES = ['VIDE', 'MEUBLE', 'MOBILITE', 'GARAGE_PARKING'];
const PROPERTY_TYPES = ['MEUBLE', 'NU', 'MOBILITE', 'GARAGE_PARKING'];

const FLAT_KEYS: (keyof LeaseDoc)[] = [
  'tenantFirstName', 'tenantLastName', 'tenantEmail', 'tenantPhone',
  'startDate', 'endDate', 'rentAmount', 'chargesAmount', 'depositAmount',
  'propertyType', 'leaseType', 'paymentDay', 'durationMonths', 'additionalClauses', 'leaseStatus',
];

export default function AdminLeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<LeaseDoc | null>(null);
  const [initial, setInitial] = useState<LeaseDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTerminate, setShowTerminate] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/leases/${id}`);
    const json = await res.json();
    setData(json.lease);
    setInitial(json.lease);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées (chargement au montage / sur changement ciblé)
  useEffect(() => { load();   }, [id]);

  const dirty = useMemo(() => {
    if (!data || !initial) return false;
    const flatDirty = FLAT_KEYS.some((k) => JSON.stringify(data[k]) !== JSON.stringify(initial[k]));
    const irlDirty = JSON.stringify(data.irlRevision) !== JSON.stringify(initial.irlRevision);
    const clausesDirty = JSON.stringify(data.specificClauses) !== JSON.stringify(initial.specificClauses);
    return flatDirty || irlDirty || clausesDirty;
  }, [data, initial]);

  function update<K extends keyof LeaseDoc>(key: K, value: LeaseDoc[K]) {
    setData((prev) => prev ? { ...prev, [key]: value } : prev);
    setInfo(null);
  }
  function updateIrl(key: string, value: any) {
    setData((prev) => prev ? { ...prev, irlRevision: { ...(prev.irlRevision || {}), [key]: value } } : prev);
    setInfo(null);
  }
  function updateClause(key: string, value: any) {
    setData((prev) => prev ? { ...prev, specificClauses: { ...(prev.specificClauses || {}), [key]: value } } : prev);
    setInfo(null);
  }

  async function save() {
    if (!data || !initial) return;
    setSaving(true);
    setInfo(null);
    try {
      const payload: Record<string, any> = {};
      for (const k of FLAT_KEYS) {
        if (JSON.stringify(data[k]) !== JSON.stringify(initial[k])) payload[k] = data[k];
      }
      if (JSON.stringify(data.irlRevision) !== JSON.stringify(initial.irlRevision)) payload.irlRevision = data.irlRevision;
      if (JSON.stringify(data.specificClauses) !== JSON.stringify(initial.specificClauses)) payload.specificClauses = data.specificClauses;
      const res = await fetch(`/api/admin/leases/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setInfo(`❌ ${j.error || 'Erreur'}`);
      else { setInfo('✓ Enregistré'); await load(); setTimeout(() => setInfo(null), 3000); }
    } finally { setSaving(false); }
  }

  if (loading || !data) return <div className="text-gray-500">Chargement…</div>;

  return (
    <div>
      <Link href="/dashboard/admin/leases" className="text-sm text-indigo-600 hover:underline">← Baux</Link>
      <header className="my-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {data.tenantFirstName} {data.tenantLastName}
          </h1>
          <p className="text-sm text-gray-600">
            {data.property?.name} · {data.property?.city} · propriétaire <span className="font-mono">{data.user?.email}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Statut : <span className="font-semibold">{data.leaseStatus}</span>
          </p>
        </div>
        {data.leaseStatus !== 'TERMINATED' && (
          <button onClick={() => setShowTerminate(true)} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700">
            🛑 Forcer terminaison
          </button>
        )}
      </header>

      <FormSection title="Locataire">
        <EditField label="Prénom" name="tenantFirstName" value={data.tenantFirstName} onChange={(v) => update('tenantFirstName', v)} />
        <EditField label="Nom" name="tenantLastName" value={data.tenantLastName} onChange={(v) => update('tenantLastName', v)} />
        <EditField label="Email" name="tenantEmail" type="email" value={data.tenantEmail} onChange={(v) => update('tenantEmail', v)} />
        <EditField label="Téléphone" name="tenantPhone" type="tel" value={data.tenantPhone} onChange={(v) => update('tenantPhone', v)} />
      </FormSection>

      <FormSection title="Bail">
        <EditField label="Statut" name="leaseStatus" type="select" value={data.leaseStatus} onChange={(v) => update('leaseStatus', v)}
          options={LEASE_STATUSES.map((s) => ({ value: s, label: s }))} />
        <EditField label="Type de bail" name="leaseType" type="select" value={data.leaseType} onChange={(v) => update('leaseType', v)}
          options={LEASE_TYPES.map((s) => ({ value: s, label: s }))} />
        <EditField label="Type de logement" name="propertyType" type="select" value={data.propertyType} onChange={(v) => update('propertyType', v)}
          options={PROPERTY_TYPES.map((s) => ({ value: s, label: s }))} />
        <EditField label="Date de début" name="startDate" type="date" value={data.startDate} onChange={(v) => update('startDate', v)} />
        <EditField label="Date de fin" name="endDate" type="date" value={data.endDate} onChange={(v) => update('endDate', v)} />
        <EditField label="Durée (mois)" name="durationMonths" type="number" min={1} max={120} value={data.durationMonths} onChange={(v) => update('durationMonths', v)} />
      </FormSection>

      <FormSection title="Financier">
        <EditField label="Loyer (€)" name="rentAmount" type="number" min={0} value={data.rentAmount} onChange={(v) => update('rentAmount', v)} />
        <EditField label="Charges (€)" name="chargesAmount" type="number" min={0} value={data.chargesAmount} onChange={(v) => update('chargesAmount', v)} />
        <EditField label="Dépôt de garantie (€)" name="depositAmount" type="number" min={0} value={data.depositAmount} onChange={(v) => update('depositAmount', v)} />
        <EditField label="Jour de paiement" name="paymentDay" type="number" min={1} max={31} value={data.paymentDay} onChange={(v) => update('paymentDay', v)} />
      </FormSection>

      <FormSection title="Révision IRL">
        <EditField label="Activée" name="irlEnabled" type="checkbox" value={data.irlRevision?.enabled} onChange={(v) => updateIrl('enabled', v)} />
        <EditField label="Date anniversaire" name="irlAnniversary" type="date" value={data.irlRevision?.anniversaryDate} onChange={(v) => updateIrl('anniversaryDate', v)} />
        <EditField label="Indice de référence" name="irlRef" type="number" value={data.irlRevision?.referenceIndex} onChange={(v) => updateIrl('referenceIndex', v)} />
      </FormSection>

      <FormSection title="Clauses">
        <EditField label="Animaux autorisés" name="petsAllowed" type="checkbox" value={data.specificClauses?.petsAllowed} onChange={(v) => updateClause('petsAllowed', v)} />
        <EditField label="Clause de résiliation" name="terminationClause" type="checkbox" value={data.specificClauses?.terminationClause} onChange={(v) => updateClause('terminationClause', v)} />
        <EditField label="Type charges" name="recoverableChargesType" type="select"
          value={data.specificClauses?.recoverableChargesType || 'PROVISION'}
          onChange={(v) => updateClause('recoverableChargesType', v)}
          options={[{ value: 'PROVISION', label: 'PROVISION' }, { value: 'FORFAIT', label: 'FORFAIT' }]} />
        <EditField label="Clauses additionnelles" name="additionalClauses" type="textarea" rows={4} className="md:col-span-2"
          value={data.additionalClauses} onChange={(v) => update('additionalClauses', v)} />
      </FormSection>

      {data.termination && (
        <FormSection title="Terminaison (read-only)">
          <div className="text-xs text-gray-700 col-span-2 whitespace-pre-wrap font-mono p-2 bg-gray-50 rounded">
            {JSON.stringify(data.termination, null, 2)}
          </div>
        </FormSection>
      )}

      <SaveBar dirty={dirty} saving={saving} info={info} onSave={save} onReset={() => setData(initial)} />

      {showTerminate && (
        <TerminateModal leaseId={id} onClose={() => setShowTerminate(false)} onDone={() => { setShowTerminate(false); router.refresh(); load(); }} />
      )}
    </div>
  );
}

function TerminateModal({ leaseId, onClose, onDone }: { leaseId: string; onClose: () => void; onDone: () => void }) {
  const [initiatedBy, setInitiatedBy] = useState<'ADMIN' | 'OWNER' | 'TENANT'>('ADMIN');
  const [reason, setReason] = useState('');
  const [estimatedExitDate, setEstimatedExitDate] = useState('');
  const [actualExitDate, setActualExitDate] = useState('');
  const [depositReturned, setDepositReturned] = useState(false);
  const [depositReturnDate, setDepositReturnDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const body: any = { initiatedBy, reason };
      if (estimatedExitDate) body.estimatedExitDate = estimatedExitDate;
      if (actualExitDate) body.actualExitDate = actualExitDate;
      if (depositReturned) body.depositReturned = true;
      if (depositReturnDate) body.depositReturnDate = depositReturnDate;
      const res = await fetch(`/api/admin/leases/${leaseId}/terminate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.error || 'Erreur');
      else onDone();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Forcer la terminaison du bail</h3>
        <p className="text-sm text-gray-600 mb-4">Action irréversible. Le bail passera en TERMINATED et la propriété en VACANT.</p>
        {err && <div className="mb-3 text-sm text-red-700 bg-red-50 p-2 rounded">{err}</div>}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="text-xs text-gray-600">À l&apos;initiative de</label>
            <select value={initiatedBy} onChange={(e) => setInitiatedBy(e.target.value as any)} className="w-full border border-gray-300 rounded px-2 py-1.5">
              <option value="ADMIN">ADMIN (forcé)</option>
              <option value="OWNER">OWNER</option>
              <option value="TENANT">TENANT</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Date sortie prévue</label>
            <input type="date" value={estimatedExitDate} onChange={(e) => setEstimatedExitDate(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Date sortie réelle</label>
            <input type="date" value={actualExitDate} onChange={(e) => setActualExitDate(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5" />
          </div>
          <div>
            <label className="text-xs text-gray-600 flex items-center gap-1">
              <input type="checkbox" checked={depositReturned} onChange={(e) => setDepositReturned(e.target.checked)} /> Dépôt rendu
            </label>
            <input type="date" value={depositReturnDate} onChange={(e) => setDepositReturnDate(e.target.value)} disabled={!depositReturned} className="w-full border border-gray-300 rounded px-2 py-1.5 disabled:bg-gray-100" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-600">Raison</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full border border-gray-300 rounded px-2 py-1.5" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
            {busy ? '…' : 'Forcer terminaison'}
          </button>
        </div>
      </div>
    </div>
  );
}
