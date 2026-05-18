'use client';

import { useState } from 'react';
import { CheckCircle2, Download, FileText, Loader2, AlertTriangle, Camera, Key } from 'lucide-react';

// Labels conformes au décret n°2016-382
type ConditionType = 'TRES_BON' | 'BON' | 'USAGE_NORMAL' | 'MAUVAIS_ETAT' | 'HORS_SERVICE' | 'GOOD' | 'NORMAL_WEAR' | 'DEGRADED' | 'NEEDS_RENOVATION';

const CONDITION_LABEL: Record<string, string> = {
  TRES_BON: 'Très bon',
  BON: 'Bon',
  USAGE_NORMAL: 'Usure normale',
  MAUVAIS_ETAT: 'Mauvais état',
  HORS_SERVICE: 'Hors service',
  // Legacy
  GOOD: 'Bon',
  NORMAL_WEAR: 'Usure normale',
  DEGRADED: 'Mauvais état',
  NEEDS_RENOVATION: 'Hors service',
};

const CONDITION_STYLE: Record<string, string> = {
  TRES_BON: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BON: 'bg-teal-50 text-teal-700 border-teal-200',
  USAGE_NORMAL: 'bg-blue-50 text-blue-700 border-blue-200',
  MAUVAIS_ETAT: 'bg-amber-50 text-amber-700 border-amber-200',
  HORS_SERVICE: 'bg-red-50 text-red-700 border-red-200',
  // Legacy
  GOOD: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NORMAL_WEAR: 'bg-blue-50 text-blue-700 border-blue-200',
  DEGRADED: 'bg-amber-50 text-amber-700 border-amber-200',
  NEEDS_RENOVATION: 'bg-red-50 text-red-700 border-red-200',
};

const BAD_CONDITIONS = ['MAUVAIS_ETAT', 'HORS_SERVICE', 'DEGRADED', 'NEEDS_RENOVATION'];

interface Room {
  name: string;
  wallCondition: string;
  floorCondition: string;
  ceilingCondition: string;
  equipment: { name: string; condition: string }[];
  photos: { url: string }[];
  comment: string;
}

interface InspectionData {
  _id: string;
  type: 'ENTRY' | 'EXIT';
  status: string;
  rooms: Room[];
  meterReadings?: { water?: number; gas?: number; electricity?: number; heating?: number };
  keysDelivered?: { type: string; quantity: number; description?: string }[];
  signatures?: { owner?: { data?: string }; tenant?: { data?: string } };
  pdfUrl?: string;
  [key: string]: unknown;
}

function ConditionBadge({ condition }: { condition?: string }) {
  if (!condition) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CONDITION_STYLE[condition] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
      {CONDITION_LABEL[condition] || condition}
    </span>
  );
}

export default function SummaryStep({
  inspection,
  onFinalize,
}: {
  inspection: InspectionData;
  onFinalize: (status: 'IN_PROGRESS' | 'COMPLETED') => Promise<void>;
}) {
  const [finalizing, setFinalizing] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOwnerSig = !!inspection.signatures?.owner?.data;
  const hasTenantSig = !!inspection.signatures?.tenant?.data;
  const bothSigned = hasOwnerSig && hasTenantSig;
  const totalPhotos = inspection.rooms.reduce((sum, r) => sum + (r.photos?.length || 0), 0);
  const degradedRooms = inspection.rooms.filter(
    (r) => BAD_CONDITIONS.includes(r.wallCondition)
      || BAD_CONDITIONS.includes(r.floorCondition)
      || BAD_CONDITIONS.includes(r.ceilingCondition)
  );
  const totalKeys = (inspection.keysDelivered || []).reduce((sum, k) => sum + k.quantity, 0);

  async function handleFinalize(status: 'IN_PROGRESS' | 'COMPLETED') {
    setError(null);
    setFinalizing(status);
    try {
      await onFinalize(status);
      if (status === 'COMPLETED') setDone(true);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setFinalizing(null);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">EDL terminé !</h2>
          <p className="mt-2 text-sm text-slate-500">Le PDF a été généré avec succès.</p>
          {inspection.type === 'ENTRY' && (
            <p className="mt-2 text-xs text-slate-400">
              Le locataire dispose de 10 jours pour formuler ses observations (loi ALUR art. 3-2).
            </p>
          )}
        </div>
        {inspection.pdfUrl && (
          <a
            href={inspection.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-amber-600"
          >
            <Download className="h-4 w-4" /> Télécharger le PDF
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">Résumé</h2>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{inspection.rooms.length}</p>
          <p className="text-xs text-slate-500">Pièces</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalPhotos}</p>
          <p className="flex items-center justify-center gap-1 text-xs text-slate-500"><Camera className="h-3 w-3" /> Photos</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className={`text-2xl font-bold ${degradedRooms.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {degradedRooms.length}
          </p>
          <p className="text-xs text-slate-500">Dégradations</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalKeys}</p>
          <p className="flex items-center justify-center gap-1 text-xs text-slate-500"><Key className="h-3 w-3" /> Clés</p>
        </div>
      </div>

      {/* Room summaries */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-700">Par pièce</h3>
        {inspection.rooms.map((room, i) => (
          <div key={room.name + i} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{room.name}</p>
              <span className="text-xs text-slate-400">{room.photos?.length || 0} photo{(room.photos?.length || 0) > 1 ? 's' : ''}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <ConditionBadge condition={room.wallCondition} />
              <ConditionBadge condition={room.floorCondition} />
              <ConditionBadge condition={room.ceilingCondition} />
            </div>
            {room.equipment.length > 0 && (
              <p className="mt-1.5 text-xs text-slate-400">{room.equipment.length} équipement{room.equipment.length > 1 ? 's' : ''}</p>
            )}
          </div>
        ))}
      </div>

      {/* Signatures status */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-slate-700">Signatures</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {hasOwnerSig ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
            <span className="text-sm text-slate-700">Propriétaire : {hasOwnerSig ? 'Signé' : 'Non signé'}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasTenantSig ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
            <span className="text-sm text-slate-700">Locataire : {hasTenantSig ? 'Signé' : 'Non signé'}</span>
          </div>
        </div>
        {!bothSigned && (
          <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
            Les deux signatures sont requises pour finaliser l&apos;état des lieux (loi ALUR art. 3-2 — état des lieux contradictoire).
          </p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleFinalize('COMPLETED')}
          disabled={!!finalizing || !bothSigned}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-sm font-bold text-white shadow-md transition-colors hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {finalizing === 'COMPLETED' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Terminer et générer le PDF
        </button>

        <button
          type="button"
          onClick={() => handleFinalize('IN_PROGRESS')}
          disabled={!!finalizing}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {finalizing === 'IN_PROGRESS' && <Loader2 className="h-4 w-4 animate-spin" />}
          Sauvegarder le brouillon
        </button>
      </div>
    </div>
  );
}
