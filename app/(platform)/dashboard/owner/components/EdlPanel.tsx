'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  GitCompare,
  Key,
  Loader2,
  PenLine,
  Plus,
  X,
} from 'lucide-react';
import { Btn, StatCard, Tag, Avatar } from './ui';

// ─── Types ──────────────────────────────────────────────────────

type ConditionType = 'GOOD' | 'NORMAL_WEAR' | 'DEGRADED' | 'NEEDS_RENOVATION';

interface InspectionRoom {
  name: string;
  order: number;
  wallCondition: ConditionType;
  floorCondition: ConditionType;
  ceilingCondition: ConditionType;
  equipment: { name: string; condition: ConditionType; comment: string }[];
  photos: { url: string; caption: string }[];
  comment: string;
}

interface InspectionRecord {
  _id: string;
  type: 'ENTRY' | 'EXIT';
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'SIGNED';
  date: string;
  property?: { _id: string; name?: string; address?: string };
  lease?: { tenantFirstName?: string; tenantLastName?: string; depositAmount?: number };
  rooms: InspectionRoom[];
  meterReadings?: { water?: number; gas?: number; electricity?: number };
  comparison?: {
    entryInspectionId?: string;
    retentions: { room: string; item: string; description: string; amount: number }[];
    totalRetention: number;
    depositAmount: number;
    refundAmount: number;
  };
  signatures?: {
    owner?: { date?: string };
    tenant?: { date?: string };
  };
  pdfUrl?: string;
}

// ─── Config ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT: { label: 'Brouillon', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  IN_PROGRESS: { label: 'En cours', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  COMPLETED: { label: 'Terminé', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  SIGNED: { label: 'Signé', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

const CONDITION_LABEL: Record<ConditionType, string> = {
  GOOD: 'Bon',
  NORMAL_WEAR: 'Usure normale',
  DEGRADED: 'Dégradé',
  NEEDS_RENOVATION: 'À rénover',
};

const CONDITION_COLOR: Record<ConditionType, string> = {
  GOOD: 'text-emerald-600',
  NORMAL_WEAR: 'text-blue-600',
  DEGRADED: 'text-amber-600',
  NEEDS_RENOVATION: 'text-red-600',
};

const ROOM_TEMPLATES: Record<string, string[]> = {
  T1: ['Entrée', 'Pièce principale', 'Cuisine', 'Salle de bain', 'WC'],
  T2: ['Entrée', 'Salon', 'Chambre', 'Cuisine', 'Salle de bain', 'WC'],
  T3: ['Entrée', 'Salon', 'Chambre 1', 'Chambre 2', 'Cuisine', 'Salle de bain', 'WC'],
  T4: ['Entrée', 'Salon', 'Chambre 1', 'Chambre 2', 'Chambre 3', 'Cuisine', 'Salle de bain', 'WC'],
  STUDIO: ['Pièce principale', 'Cuisine/Kitchenette', 'Salle de bain', 'WC'],
};

// ─── Create Modal ───────────────────────────────────────────────

function CreateEdlModal({
  leases,
  existingInspections,
  onClose,
  onCreated,
}: {
  leases: { _id: string; property: { _id: string; name?: string; address?: string }; tenantFirstName: string; tenantLastName: string }[];
  existingInspections: InspectionRecord[];
  onClose: () => void;
  onCreated: (id?: string) => void;
}) {
  const [leaseId, setLeaseId] = useState('');
  const [type, setType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [template, setTemplate] = useState('T2');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedLease = leases.find((l) => l._id === leaseId);
  const hasEntry = leaseId
    ? existingInspections.some((i) => String((i.lease as { _id?: string })?._id || i.lease) === leaseId && i.type === 'ENTRY')
    : false;

  const handleCreate = async () => {
    if (!leaseId || !selectedLease) return;
    setLoading(true);
    setError('');
    try {
      const rooms = (ROOM_TEMPLATES[template] || ROOM_TEMPLATES.T2).map((name, i) => ({
        name,
        order: i,
        wallCondition: 'GOOD',
        floorCondition: 'GOOD',
        ceilingCondition: 'GOOD',
        equipment: [],
        photos: [],
        comment: '',
      }));

      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedLease.property?._id || selectedLease.property,
          leaseId,
          type,
          rooms,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        onCreated(json.data?._id);
      } else {
        setError(json.error || `Erreur ${res.status} lors de la création`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Nouvel état des lieux</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Lease selection */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Bail / Locataire</label>
            <select
              value={leaseId}
              onChange={(e) => setLeaseId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
            >
              <option value="">Sélectionner un bail…</option>
              {leases.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.tenantFirstName} {l.tenantLastName} — {l.property?.name || l.property?.address?.split(',')[0]}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Type</label>
            <div className="flex gap-3">
              {(['ENTRY', 'EXIT'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                    type === t ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {t === 'ENTRY' ? "Entrée" : "Sortie"}
                </button>
              ))}
            </div>
            {type === 'EXIT' && leaseId && !hasEntry && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Aucun EDL d&apos;entrée trouvé — la comparaison ne sera pas possible.
              </p>
            )}
          </div>

          {/* Room template */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Modèle de pièces</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(ROOM_TEMPLATES).map((t) => (
                <button key={t} type="button" onClick={() => setTemplate(t)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    template === t ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Pièces : {(ROOM_TEMPLATES[template] || []).join(', ')}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>
        )}

        {leases.length === 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
            <AlertTriangle className="inline h-4 w-4 mr-1" />
            Aucun bail trouvé. Créez d&apos;abord un bail pour pouvoir faire un état des lieux.
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn variant="amber" disabled={!leaseId || loading} onClick={handleCreate}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Créer l&apos;EDL
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────

export function EdlPanel() {
  const router = useRouter();
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [leases, setLeases] = useState<{ _id: string; property: { _id: string; name?: string; address?: string }; tenantFirstName: string; tenantLastName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);

  const openWizard = (id: string) => router.push(`/dashboard/owner/edl/${id}`);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [insRes, leaseRes] = await Promise.all([
        fetch('/api/inspections'),
        fetch('/api/leases'),
      ]);
      if (insRes.ok) {
        const json = await insRes.json();
        setInspections(json.data || []);
      }
      if (leaseRes.ok) {
        const json = await leaseRes.json();
        setLeases(json.data || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // KPIs
  const total = inspections.length;
  const completed = inspections.filter((i) => i.status === 'COMPLETED' || i.status === 'SIGNED').length;
  const draft = inspections.filter((i) => i.status === 'DRAFT' || i.status === 'IN_PROGRESS').length;
  const entries = inspections.filter((i) => i.type === 'ENTRY').length;

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Chargement des EDL…</div>;
  }

  return (
    <div>
      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<ClipboardCheck className="h-5 w-5 text-blue-500" />} value={total} label="Total EDL" bg="bg-blue-50" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} value={completed} label="Terminés" bg="bg-emerald-50" />
        <StatCard icon={<PenLine className="h-5 w-5 text-amber-500" />} value={draft} label="En cours" bg="bg-amber-50" />
        <StatCard icon={<Key className="h-5 w-5 text-orange-500" />} value={entries} label="Entrées" bg="bg-orange-50" />
      </div>

      {/* Action button */}
      <div className="mb-5 flex justify-end">
        <Btn variant="amber" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Nouvel EDL
        </Btn>
      </div>

      {inspections.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100">
            <ClipboardCheck className="h-6 w-6 text-slate-400" />
          </div>
          <p className="mb-2 text-slate-500">Aucun état des lieux.</p>
          <p className="text-xs text-slate-400">Créez un EDL pour documenter l&apos;état de vos biens.</p>
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <Th>Locataire</Th>
                  <Th>Bien</Th>
                  <Th>Type</Th>
                  <Th>Date</Th>
                  <Th>Pièces</Th>
                  <Th>Statut</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((ins) => {
                  const cfg = STATUS_CONFIG[ins.status] || STATUS_CONFIG.DRAFT;
                  const tenantName = ins.lease
                    ? `${(ins.lease as { tenantFirstName?: string }).tenantFirstName || ''} ${(ins.lease as { tenantLastName?: string }).tenantLastName || ''}`.trim()
                    : '—';
                  const degradedCount = ins.rooms.filter(
                    (r) => r.wallCondition === 'DEGRADED' || r.wallCondition === 'NEEDS_RENOVATION' ||
                           r.floorCondition === 'DEGRADED' || r.floorCondition === 'NEEDS_RENOVATION' ||
                           r.ceilingCondition === 'DEGRADED' || r.ceilingCondition === 'NEEDS_RENOVATION'
                  ).length;

                  return (
                    <tr key={ins._id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={tenantName} id={ins._id} size="sm" />
                          <span className="text-sm font-semibold text-slate-900">{tenantName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">
                        {ins.property?.name || ins.property?.address?.split(',')[0] || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          ins.type === 'ENTRY' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-violet-200 bg-violet-50 text-violet-700'
                        }`}>
                          {ins.type === 'ENTRY' ? 'Entrée' : 'Sortie'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">
                        {new Date(ins.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-slate-600">{ins.rooms.length} pièces</span>
                        {degradedCount > 0 && (
                          <span className="ml-1.5 text-xs font-semibold text-amber-600">
                            ({degradedCount} dégradée{degradedCount > 1 ? 's' : ''})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {(ins.status === 'DRAFT' || ins.status === 'IN_PROGRESS') && (
                            <button type="button" onClick={() => openWizard(ins._id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition-colors">
                              <PenLine className="h-3 w-3" /> Éditer
                            </button>
                          )}
                          {(ins.status === 'COMPLETED' || ins.status === 'SIGNED') && (
                            <>
                              <button type="button" onClick={() => openWizard(ins._id)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                <Eye className="inline h-3 w-3 mr-1" />Voir
                              </button>
                              {ins.type === 'EXIT' && (
                                <button type="button" onClick={() => setCompareId(ins._id)}
                                  className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors">
                                  <GitCompare className="inline h-3 w-3 mr-1" />Comparer
                                </button>
                              )}
                              {ins.pdfUrl && (
                                <a href={ins.pdfUrl} download className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                  <Download className="inline h-3 w-3 mr-1" />PDF
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="block md:hidden space-y-3">
          {inspections.map((ins) => {
            const cfg = STATUS_CONFIG[ins.status] || STATUS_CONFIG.DRAFT;
            const tenantName = ins.lease
              ? `${(ins.lease as { tenantFirstName?: string }).tenantFirstName || ''} ${(ins.lease as { tenantLastName?: string }).tenantLastName || ''}`.trim()
              : '—';
            const degradedCount = ins.rooms.filter(
              (r) => r.wallCondition === 'DEGRADED' || r.wallCondition === 'NEEDS_RENOVATION' ||
                     r.floorCondition === 'DEGRADED' || r.floorCondition === 'NEEDS_RENOVATION' ||
                     r.ceilingCondition === 'DEGRADED' || r.ceilingCondition === 'NEEDS_RENOVATION'
            ).length;

            return (
              <div key={ins._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                {/* Header: tenant + status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={tenantName} id={ins._id} size="sm" />
                    <span className="text-sm font-semibold text-slate-900 truncate">{tenantName}</span>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Property */}
                <div className="mb-2 text-sm text-slate-600">
                  {ins.property?.name || ins.property?.address?.split(',')[0] || '—'}
                </div>

                {/* Type + date + rooms */}
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold ${
                    ins.type === 'ENTRY' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-violet-200 bg-violet-50 text-violet-700'
                  }`}>
                    {ins.type === 'ENTRY' ? 'Entrée' : 'Sortie'}
                  </span>
                  <span>{new Date(ins.date).toLocaleDateString('fr-FR')}</span>
                  <span>{ins.rooms.length} pièces</span>
                  {degradedCount > 0 && (
                    <span className="font-semibold text-amber-600">
                      ({degradedCount} dégradée{degradedCount > 1 ? 's' : ''})
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  {(ins.status === 'DRAFT' || ins.status === 'IN_PROGRESS') && (
                    <button type="button" onClick={() => openWizard(ins._id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition-colors">
                      <PenLine className="h-3 w-3" /> Éditer
                    </button>
                  )}
                  {(ins.status === 'COMPLETED' || ins.status === 'SIGNED') && (
                    <>
                      <button type="button" onClick={() => openWizard(ins._id)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                        <Eye className="inline h-3 w-3 mr-1" />Voir
                      </button>
                      {ins.type === 'EXIT' && (
                        <button type="button" onClick={() => setCompareId(ins._id)}
                          className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors">
                          <GitCompare className="inline h-3 w-3 mr-1" />Comparer
                        </button>
                      )}
                      {ins.pdfUrl && (
                        <a href={ins.pdfUrl} download className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                          <Download className="inline h-3 w-3 mr-1" />PDF
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateEdlModal
          leases={leases as typeof leases}
          existingInspections={inspections}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); if (id) openWizard(id); else fetchData(); }}
        />
      )}

      {compareId && (
        <ComparisonDrawer
          inspectionId={compareId}
          onClose={() => setCompareId(null)}
        />
      )}
    </div>
  );
}

// ─── Comparison Drawer ──────────────────────────────────────────

interface RoomComparison {
  name: string;
  entry: { wallCondition: string; floorCondition: string; ceilingCondition: string } | null;
  exit: { wallCondition: string; floorCondition: string; ceilingCondition: string };
  degradations: { item: string; entry: string; exit: string }[];
  hasDegradation: boolean;
}

function ComparisonDrawer({ inspectionId, onClose }: { inspectionId: string; onClose: () => void }) {
  const [data, setData] = useState<{
    roomComparisons: RoomComparison[];
    depositAmount: number;
    entryInspection: { date: string } | null;
    exitInspection: { date: string };
    totalDegradations: number;
    existingRetentions: { room: string; item: string; description: string; amount: number }[];
  } | null>(null);
  const [retentions, setRetentions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/inspections/${inspectionId}/compare`);
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
          // Pre-fill retentions from existing
          const ret: Record<string, number> = {};
          for (const r of json.data.existingRetentions || []) {
            ret[`${r.room}-${r.item}`] = r.amount;
          }
          setRetentions(ret);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [inspectionId]);

  const totalRetention = Object.values(retentions).reduce((s, v) => s + (v || 0), 0);
  const refundAmount = (data?.depositAmount || 0) - totalRetention;

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    const retentionList = Object.entries(retentions)
      .filter(([, amount]) => amount > 0)
      .map(([key, amount]) => {
        const [room, item] = key.split('-');
        return { room, item, description: `${item} dégradé(e)`, amount };
      });
    try {
      await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparison: {
            retentions: retentionList,
            totalRetention,
            depositAmount: data.depositAmount,
            refundAmount: Math.max(0, refundAmount),
          },
        }),
      });
      onClose();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="ml-auto flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Comparaison Entrée ↔ Sortie</h3>
            {data?.entryInspection && (
              <p className="text-xs text-slate-500">
                Entrée : {new Date(data.entryInspection.date).toLocaleDateString('fr-FR')} · Sortie : {new Date(data.exitInspection.date).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">Chargement…</div>
          ) : !data ? (
            <div className="py-16 text-center text-sm text-slate-500">Impossible de charger la comparaison.</div>
          ) : !data.entryInspection ? (
            <div className="py-16 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
              <p className="text-sm text-slate-600">Aucun EDL d&apos;entrée trouvé pour ce bail.</p>
              <p className="mt-1 text-xs text-slate-400">La comparaison nécessite un EDL d&apos;entrée complété.</p>
            </div>
          ) : (
            <>
              {/* Room comparison table */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Pièce / Élément</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-blue-500">Entrée</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-violet-500">Sortie</th>
                      <th className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Diff</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Retenue €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.roomComparisons.map((room) => {
                      const fields = [
                        { item: 'Murs', entry: room.entry?.wallCondition, exit: room.exit.wallCondition },
                        { item: 'Sol', entry: room.entry?.floorCondition, exit: room.exit.floorCondition },
                        { item: 'Plafond', entry: room.entry?.ceilingCondition, exit: room.exit.ceilingCondition },
                      ];
                      return fields.map((f, fi) => {
                        const isDegraded = f.exit !== f.entry && (f.exit === 'DEGRADED' || f.exit === 'NEEDS_RENOVATION');
                        const key = `${room.name}-${f.item}`;
                        return (
                          <tr key={`${room.name}-${fi}`} className={`border-t border-slate-100 ${isDegraded ? 'bg-amber-50/50' : ''}`}>
                            {fi === 0 && (
                              <td rowSpan={3} className="border-r border-slate-100 px-4 py-2 font-semibold text-slate-900 align-top">
                                {room.name}
                              </td>
                            )}
                            <td className="px-4 py-1.5 text-center">
                              <span className={CONDITION_COLOR[f.entry as ConditionType] || 'text-slate-500'}>
                                {CONDITION_LABEL[f.entry as ConditionType] || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-1.5 text-center">
                              <span className={CONDITION_COLOR[f.exit as ConditionType] || 'text-slate-500'}>
                                {CONDITION_LABEL[f.exit as ConditionType] || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-1.5 text-center">
                              {f.entry === f.exit ? (
                                <span className="text-emerald-500 text-xs">✓</span>
                              ) : isDegraded ? (
                                <span className="text-amber-600 text-xs font-semibold">⚠️</span>
                              ) : (
                                <span className="text-blue-500 text-xs">~</span>
                              )}
                            </td>
                            <td className="px-4 py-1.5 text-right">
                              {isDegraded && (
                                <input
                                  type="number"
                                  min={0}
                                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs focus:border-orange-300 outline-none"
                                  value={retentions[key] ?? ''}
                                  onChange={(e) => setRetentions((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                                  placeholder="0"
                                />
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>

              {/* Deposit summary */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Dépôt de garantie</span>
                  <span className="font-semibold text-slate-900">{data.depositAmount.toLocaleString('fr-FR')} €</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Total retenues</span>
                  <span className="font-semibold text-red-600">- {totalRetention.toLocaleString('fr-FR')} €</span>
                </div>
                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between text-sm">
                  <span className="font-bold text-slate-900">Restitution estimée</span>
                  <span className={`font-bold text-lg ${refundAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Math.max(0, refundAmount).toLocaleString('fr-FR')} €
                  </span>
                </div>
                {refundAmount < 0 && (
                  <p className="mt-2 text-xs text-red-600">
                    <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                    Les retenues dépassent le dépôt de garantie de {Math.abs(refundAmount).toLocaleString('fr-FR')} €.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Fermer</Btn>
          {data?.entryInspection && (
            <Btn variant="amber" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Valider les retenues
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </th>
  );
}
