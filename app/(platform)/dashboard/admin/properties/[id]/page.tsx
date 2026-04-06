'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EditField, FormSection } from '../../_components/EditField';
import SaveBar from '../../_components/SaveBar';
import BillingPanel from '../../_components/BillingPanel';

interface PropertyDoc {
  _id: string;
  name: string;
  address: string;
  addressLine?: string;
  zipCode?: string;
  city?: string;
  rentAmount: number;
  chargesAmount: number;
  surfaceM2?: number | null;
  propertyType?: string;
  floor?: number | null;
  totalFloors?: number | null;
  rooms?: number | null;
  bedrooms?: number | null;
  equipment?: string[];
  description?: string;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  vacantSince?: string | null;
  managed?: boolean;
  archived?: boolean;
  status?: string;
  applyToken?: string;
  user?: { _id: string; email?: string; firstName?: string; lastName?: string };
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

const PROPERTY_TYPES = ['APPARTEMENT', 'MAISON', 'STUDIO', 'LOFT', 'LOCAL_COMMERCIAL', 'GARAGE', 'AUTRE'];
const STATUSES = ['AVAILABLE', 'CANDIDATE_SELECTION', 'LEASE_IN_PROGRESS', 'OCCUPIED', 'VACANT'];

const EDITABLE_KEYS: (keyof PropertyDoc)[] = [
  'name', 'address', 'addressLine', 'zipCode', 'city',
  'rentAmount', 'chargesAmount', 'surfaceM2', 'propertyType',
  'floor', 'totalFloors', 'rooms', 'bedrooms', 'description',
  'purchasePrice', 'purchaseDate', 'vacantSince',
  'managed', 'archived', 'status',
];

export default function AdminPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PropertyDoc | null>(null);
  const [initial, setInitial] = useState<PropertyDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/properties/${id}`);
    const json = await res.json();
    setData(json.property);
    setInitial(json.property);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const dirty = useMemo(() => {
    if (!data || !initial) return false;
    return EDITABLE_KEYS.some((k) => JSON.stringify(data[k]) !== JSON.stringify(initial[k]));
  }, [data, initial]);

  function update<K extends keyof PropertyDoc>(key: K, value: PropertyDoc[K]) {
    setData((prev) => prev ? { ...prev, [key]: value } : prev);
    setInfo(null);
  }

  async function save() {
    if (!data || !initial) return;
    setSaving(true);
    setInfo(null);
    try {
      const payload: Record<string, any> = {};
      for (const k of EDITABLE_KEYS) {
        if (JSON.stringify(data[k]) !== JSON.stringify(initial[k])) {
          payload[k] = data[k];
        }
      }
      const res = await fetch(`/api/admin/properties/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setInfo(`❌ ${j.error || 'Erreur'}`);
      } else {
        setInfo('✓ Enregistré');
        await load();
        setTimeout(() => setInfo(null), 3000);
      }
    } finally { setSaving(false); }
  }

  if (loading || !data) return <div className="text-gray-500">Chargement…</div>;

  return (
    <div>
      <Link href="/dashboard/admin/properties" className="text-sm text-indigo-600 hover:underline">← Biens</Link>
      <header className="my-4">
        <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
        <p className="text-sm text-gray-600">
          {data.user?.email && <>Propriétaire : <span className="font-mono">{data.user.email}</span> · </>}
          Code : <span className="font-mono">{data.applyToken || '—'}</span>
        </p>
      </header>

      <FormSection title="Identité">
        <EditField label="Nom du bien" name="name" value={data.name} onChange={(v) => update('name', v)} />
        <EditField label="Adresse" name="address" value={data.address} onChange={(v) => update('address', v)} />
        <EditField label="Complément d'adresse" name="addressLine" value={data.addressLine} onChange={(v) => update('addressLine', v)} />
        <EditField label="Code postal" name="zipCode" value={data.zipCode} onChange={(v) => update('zipCode', v)} />
        <EditField label="Ville" name="city" value={data.city} onChange={(v) => update('city', v)} />
        <EditField
          label="Type" name="propertyType" type="select"
          value={data.propertyType || 'APPARTEMENT'}
          onChange={(v) => update('propertyType', v)}
          options={PROPERTY_TYPES.map((t) => ({ value: t, label: t }))}
        />
      </FormSection>

      <FormSection title="Financier">
        <EditField label="Loyer (€)" name="rentAmount" type="number" min={0} value={data.rentAmount} onChange={(v) => update('rentAmount', v)} />
        <EditField label="Charges (€)" name="chargesAmount" type="number" min={0} value={data.chargesAmount} onChange={(v) => update('chargesAmount', v)} />
        <EditField label="Prix d'achat (€)" name="purchasePrice" type="number" min={0} value={data.purchasePrice} onChange={(v) => update('purchasePrice', v)} />
        <EditField label="Date d'achat" name="purchaseDate" type="date" value={data.purchaseDate} onChange={(v) => update('purchaseDate', v)} />
      </FormSection>

      <FormSection title="Caractéristiques">
        <EditField label="Surface (m²)" name="surfaceM2" type="number" min={0} value={data.surfaceM2} onChange={(v) => update('surfaceM2', v)} />
        <EditField label="Pièces" name="rooms" type="number" min={0} value={data.rooms} onChange={(v) => update('rooms', v)} />
        <EditField label="Chambres" name="bedrooms" type="number" min={0} value={data.bedrooms} onChange={(v) => update('bedrooms', v)} />
        <EditField label="Étage" name="floor" type="number" value={data.floor} onChange={(v) => update('floor', v)} />
        <EditField label="Nombre d'étages" name="totalFloors" type="number" min={0} value={data.totalFloors} onChange={(v) => update('totalFloors', v)} />
        <EditField label="Description" name="description" type="textarea" rows={4} value={data.description} onChange={(v) => update('description', v)} className="md:col-span-2" />
      </FormSection>

      <FormSection title="Statut">
        <EditField
          label="Cycle" name="status" type="select"
          value={data.status || 'AVAILABLE'}
          onChange={(v) => update('status', v)}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <EditField label="Date de vacance" name="vacantSince" type="date" value={data.vacantSince} onChange={(v) => update('vacantSince', v)} />
        <EditField label="Archivé" name="archived" type="checkbox" value={data.archived} onChange={(v) => update('archived', v)} />
        <EditField label="Géré (PRO)" name="managed" type="checkbox" value={data.managed} onChange={(v) => update('managed', v)} />
      </FormSection>

      <BillingPanel propertyId={id} stripeCustomerId={data.stripeCustomerId} stripeSubscriptionId={data.stripeSubscriptionId} managed={Boolean(data.managed)} />

      <SaveBar dirty={dirty} saving={saving} info={info} onSave={save} onReset={() => setData(initial)} />
    </div>
  );
}
