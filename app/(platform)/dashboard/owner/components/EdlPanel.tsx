'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  GitCompare,
  Key,
  Loader2,
  PenLine,
  Plus,
  X,
} from 'lucide-react';
import { Btn, StatCard, Tag, Avatar } from './ui';
import type { TagType } from './ui';

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
  onCreated: () => void;
}) {
  const [leaseId, setLeaseId] = useState('');
  const [type, setType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [template, setTemplate] = useState('T2');
  const [loading, setLoading] = useState(false);

  const selectedLease = leases.find((l) => l._id === leaseId);
  const hasEntry = leaseId
    ? existingInspections.some((i) => String((i.lease as { _id?: string })?._id || i.lease) === leaseId && i.type === 'ENTRY')
    : false;

  const handleCreate = async () => {
    if (!leaseId || !selectedLease) return;
    setLoading(true);
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
          propertyId: selectedLease.property._id,
          leaseId,
          type,
          rooms,
        }),
      });

      if (res.ok) onCreated();
    } catch { /* silent */ }
    finally { setLoading(false); }
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

// ─── Room Editor Drawer ─────────────────────────────────────────

function RoomEditor({
  inspection,
  onClose,
  onSaved,
}: {
  inspection: InspectionRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rooms, setRooms] = useState(inspection.rooms);
  const [activeRoom, setActiveRoom] = useState(0);
  const [meters, setMeters] = useState<Record<string, number | null | undefined>>(inspection.meterReadings || {});
  const [saving, setSaving] = useState(false);

  const updateRoom = (idx: number, field: string, value: ConditionType | string) => {
    setRooms((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/inspections/${inspection._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms, meterReadings: meters, status: 'IN_PROGRESS' }),
      });
      onSaved();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await fetch(`/api/inspections/${inspection._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms, meterReadings: meters, status: 'COMPLETED' }),
      });
      onSaved();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const currentRoom = rooms[activeRoom];
  const conditions: ConditionType[] = ['GOOD', 'NORMAL_WEAR', 'DEGRADED', 'NEEDS_RENOVATION'];

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">
              EDL {inspection.type === 'ENTRY' ? "d'entrée" : 'de sortie'}
            </h3>
            <p className="text-sm text-slate-500">
              {inspection.property?.name || inspection.property?.address?.split(',')[0]}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Room tabs */}
        <div className="border-b border-slate-200 px-6 py-3 overflow-x-auto">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setActiveRoom(-1)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeRoom === -1 ? 'bg-orange-50 text-orange-700 border border-orange-300' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Compteurs
            </button>
            {rooms.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveRoom(i)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeRoom === i ? 'bg-orange-50 text-orange-700 border border-orange-300' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeRoom === -1 ? (
            <div>
              <h4 className="mb-4 font-semibold text-slate-900">Relevés de compteurs</h4>
              <div className="grid grid-cols-2 gap-4">
                {(['water', 'gas', 'electricity', 'heating'] as const).map((meter) => (
                  <div key={meter}>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 capitalize">
                      {meter === 'water' ? 'Eau' : meter === 'gas' ? 'Gaz' : meter === 'electricity' ? 'Électricité' : 'Chauffage'}
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
                      value={meters[meter] ?? ''}
                      onChange={(e) => setMeters((prev) => ({ ...prev, [meter]: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : currentRoom ? (
            <div>
              <h4 className="mb-4 font-semibold text-slate-900">{currentRoom.name}</h4>

              {/* Conditions */}
              {(['wallCondition', 'floorCondition', 'ceilingCondition'] as const).map((field) => {
                const label = field === 'wallCondition' ? 'Murs' : field === 'floorCondition' ? 'Sol' : 'Plafond';
                return (
                  <div key={field} className="mb-4">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
                    <div className="flex flex-wrap gap-2">
                      {conditions.map((c) => (
                        <button key={c} type="button" onClick={() => updateRoom(activeRoom, field, c)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            currentRoom[field] === c
                              ? c === 'GOOD' ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : c === 'NORMAL_WEAR' ? 'border-blue-300 bg-blue-50 text-blue-700'
                                : c === 'DEGRADED' ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-red-300 bg-red-50 text-red-700'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}>
                          {CONDITION_LABEL[c]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Comment */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Commentaire</label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
                  value={currentRoom.comment}
                  onChange={(e) => updateRoom(activeRoom, 'comment', e.target.value)}
                  placeholder="Observations…"
                />
              </div>

              {/* Navigation */}
              <div className="flex justify-between">
                {activeRoom > 0 && (
                  <button type="button" onClick={() => setActiveRoom(activeRoom - 1)}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700">← {rooms[activeRoom - 1]?.name}</button>
                )}
                <div />
                {activeRoom < rooms.length - 1 && (
                  <button type="button" onClick={() => setActiveRoom(activeRoom + 1)}
                    className="flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700">
                    {rooms[activeRoom + 1]?.name} <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex justify-between">
          <Btn variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sauvegarder brouillon
          </Btn>
          <Btn variant="amber" onClick={handleComplete} disabled={saving}>
            <CheckCircle2 className="h-4 w-4" /> Terminer l&apos;EDL
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────

export function EdlPanel() {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [leases, setLeases] = useState<{ _id: string; property: { _id: string; name?: string; address?: string }; tenantFirstName: string; tenantLastName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const editingInspection = editingId ? inspections.find((i) => i._id === editingId) : null;

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
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
                            <button type="button" onClick={() => setEditingId(ins._id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-orange-600 transition-colors">
                              <PenLine className="h-3 w-3" /> Éditer
                            </button>
                          )}
                          {(ins.status === 'COMPLETED' || ins.status === 'SIGNED') && (
                            <button type="button" onClick={() => setEditingId(ins._id)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                              <Eye className="inline h-3 w-3 mr-1" />Voir
                            </button>
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
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateEdlModal
          leases={leases as typeof leases}
          existingInspections={inspections}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchData(); }}
        />
      )}

      {/* Room editor */}
      {editingInspection && (
        <RoomEditor
          inspection={editingInspection}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </th>
  );
}
