'use client';

import { Droplets, Flame, Zap, Thermometer, Home, User, Calendar, Key, Plus, Trash2 } from 'lucide-react';

interface MeterReadings {
  water?: number;
  gas?: number;
  electricity?: number;
  heating?: number;
}

interface KeyDelivered {
  type: string;
  quantity: number;
  description: string;
}

interface InspectionData {
  type: 'ENTRY' | 'EXIT';
  date: string;
  property?: { name?: string; address?: string };
  lease?: { tenantFirstName?: string; tenantLastName?: string };
  meterReadings?: MeterReadings;
  keysDelivered?: KeyDelivered[];
  [key: string]: unknown;
}

const METERS: { key: keyof MeterReadings; label: string; icon: React.ElementType; unit: string }[] = [
  { key: 'water', label: 'Eau', icon: Droplets, unit: 'm³' },
  { key: 'gas', label: 'Gaz', icon: Flame, unit: 'm³' },
  { key: 'electricity', label: 'Électricité', icon: Zap, unit: 'kWh' },
  { key: 'heating', label: 'Chauffage', icon: Thermometer, unit: 'kWh' },
];

export default function InfoMetersStep({
  inspection,
  onUpdate,
}: {
  inspection: InspectionData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate: (changes: any) => void;
}) {
  const meters = inspection.meterReadings || {};

  function setMeter(key: keyof MeterReadings, val: string) {
    onUpdate({
      meterReadings: { ...meters, [key]: val === '' ? undefined : Number(val) },
    });
  }

  const keys: KeyDelivered[] = inspection.keysDelivered || [];

  function addKey() {
    onUpdate({ keysDelivered: [...keys, { type: 'Clé', quantity: 1, description: '' }] });
  }

  function removeKey(idx: number) {
    onUpdate({ keysDelivered: keys.filter((_, i) => i !== idx) });
  }

  function updateKey(idx: number, field: keyof KeyDelivered, val: string | number) {
    const updated = keys.map((k, i) => (i === idx ? { ...k, [field]: val } : k));
    onUpdate({ keysDelivered: updated });
  }

  const tenant = [inspection.lease?.tenantFirstName, inspection.lease?.tenantLastName].filter(Boolean).join(' ') || '—';

  return (
    <div className="space-y-6">
      {/* Type badge */}
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center rounded-2xl px-4 py-2 text-sm font-bold ${
          inspection.type === 'ENTRY'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {inspection.type === 'ENTRY' ? "État des lieux d'entrée" : "État des lieux de sortie"}
        </span>
      </div>

      {/* Info cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <Home className="h-5 w-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Bien</p>
            <p className="text-sm font-semibold text-slate-900">{inspection.property?.name || inspection.property?.address || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <User className="h-5 w-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Locataire</p>
            <p className="text-sm font-semibold text-slate-900">{tenant}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <Calendar className="h-5 w-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Date</p>
            <p className="text-sm font-semibold text-slate-900">
              {new Date(inspection.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Meter readings */}
      <div>
        <h3 className="mb-3 text-base font-bold text-slate-900">Relevés des compteurs</h3>
        <div className="grid grid-cols-2 gap-3">
          {METERS.map(({ key, label, icon: Icon, unit }) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">{label}</span>
              </div>
              <div className="flex items-end gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={meters[key] ?? ''}
                  onChange={(e) => setMeter(key, e.target.value)}
                  placeholder="—"
                  className="h-12 w-full rounded-xl border border-slate-200 px-3 text-lg font-bold text-slate-900 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                />
                <span className="pb-3 text-xs text-slate-400">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Keys delivered (décret n°2016-382) */}
      <div>
        <h3 className="mb-3 text-base font-bold text-slate-900">Clés et moyens d&apos;accès remis</h3>
        <p className="mb-3 text-xs text-slate-500">Décret n°2016-382 — Détail des clés, badges, télécommandes et digicodes remis.</p>
        <div className="space-y-2">
          {keys.map((k, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <Key className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={k.type}
                onChange={(e) => updateKey(i, 'type', e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-2 text-sm text-slate-700 outline-none focus:border-amber-300"
              >
                <option value="Clé">Clé</option>
                <option value="Badge">Badge</option>
                <option value="Télécommande">Télécommande</option>
                <option value="Bip">Bip</option>
                <option value="Digicode">Digicode</option>
                <option value="Autre">Autre</option>
              </select>
              <input
                type="number"
                min="1"
                value={k.quantity}
                onChange={(e) => updateKey(i, 'quantity', Math.max(1, Number(e.target.value)))}
                className="h-10 w-16 rounded-lg border border-slate-200 px-2 text-center text-sm font-bold text-slate-900 outline-none focus:border-amber-300"
              />
              <input
                type="text"
                value={k.description}
                onChange={(e) => updateKey(i, 'description', e.target.value)}
                placeholder="Description"
                className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-amber-300"
              />
              <button
                type="button"
                onClick={() => removeKey(i)}
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addKey}
          className="mt-2 flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-sm font-semibold text-slate-500 hover:border-amber-300 hover:text-amber-600 transition-colors w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Ajouter une clé / un accès
        </button>
      </div>
    </div>
  );
}
