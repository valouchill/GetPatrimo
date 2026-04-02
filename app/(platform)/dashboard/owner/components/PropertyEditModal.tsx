'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, X } from 'lucide-react';
import type { LocalBien } from './ui';

const PROPERTY_TYPES = [
  { value: 'APPARTEMENT', label: 'Appartement' },
  { value: 'MAISON', label: 'Maison' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'LOFT', label: 'Loft' },
  { value: 'LOCAL_COMMERCIAL', label: 'Local commercial' },
  { value: 'GARAGE', label: 'Garage' },
  { value: 'AUTRE', label: 'Autre' },
];

type FormState = {
  name: string;
  address: string;
  rentAmount: string;
  chargesAmount: string;
  surfaceM2: string;
  propertyType: string;
  rooms: string;
  floor: string;
};

export function PropertyEditModal({
  bien,
  onClose,
  onSaved,
}: {
  bien: LocalBien;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: bien.label || '',
    address: bien.adresse || '',
    rentAmount: bien.loyer > 0 ? String(bien.loyer) : '',
    chargesAmount: bien.charges != null && bien.charges > 0 ? String(bien.charges) : '',
    surfaceM2: bien.surface > 0 ? String(bien.surface) : '',
    propertyType: bien.propertyType || '',
    rooms: bien.rooms != null ? String(bien.rooms) : '',
    floor: bien.floor != null ? String(bien.floor) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const body: Record<string, unknown> = {};
    const name = form.name.trim();
    const address = form.address.trim();
    if (name && name !== bien.label) body.name = name;
    if (address && address !== bien.adresse) body.address = address;
    const rent = parseFloat(form.rentAmount);
    if (!isNaN(rent) && rent !== bien.loyer) body.rentAmount = rent;
    const charges = parseFloat(form.chargesAmount);
    if (!isNaN(charges) && charges !== (bien.charges ?? 0)) body.chargesAmount = charges;
    const surface = parseFloat(form.surfaceM2);
    if (!isNaN(surface) && surface !== bien.surface) body.surfaceM2 = surface;
    if (form.propertyType && form.propertyType !== bien.propertyType) body.propertyType = form.propertyType;
    const rooms = parseInt(form.rooms, 10);
    if (!isNaN(rooms) && rooms !== (bien.rooms ?? null)) body.rooms = rooms;
    const floor = parseInt(form.floor, 10);
    if (!isNaN(floor) && floor !== (bien.floor ?? null)) body.floor = floor;

    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }

    try {
      const res = await fetch(`/api/owner/properties/${bien.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Erreur lors de la sauvegarde');
        return;
      }
      onSaved();
    } catch {
      setError('Erreur réseau — veuillez réessayer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[201] flex items-end md:items-center justify-center md:p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-h-[92vh] md:max-h-[85vh] md:max-w-lg overflow-hidden rounded-t-3xl md:rounded-3xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-property-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                <Building2 className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <div id="edit-property-title" className="font-bold text-slate-900">Modifier le bien</div>
                <div className="text-xs text-slate-500">{bien.label}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-5 space-y-4">

              <Field label="Nom du bien">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Ex : Appartement Paris 11e"
                  className={INPUT_CLS}
                />
              </Field>

              <Field label="Adresse">
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="Ex : 12 rue de la Paix, 75002 Paris"
                  className={INPUT_CLS}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Loyer (€/mois)">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.rentAmount}
                    onChange={(e) => set('rentAmount', e.target.value)}
                    placeholder="900"
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Charges (€/mois)">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.chargesAmount}
                    onChange={(e) => set('chargesAmount', e.target.value)}
                    placeholder="80"
                    className={INPUT_CLS}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Surface (m²)">
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={form.surfaceM2}
                    onChange={(e) => set('surfaceM2', e.target.value)}
                    placeholder="42"
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Type de bien">
                  <select
                    value={form.propertyType}
                    onChange={(e) => set('propertyType', e.target.value)}
                    className={INPUT_CLS}
                  >
                    <option value="">— Sélectionner —</option>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nombre de pièces">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.rooms}
                    onChange={(e) => set('rooms', e.target.value)}
                    placeholder="3"
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Étage">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.floor}
                    onChange={(e) => set('floor', e.target.value)}
                    placeholder="0 = RDC"
                    className={INPUT_CLS}
                  />
                </Field>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
}

const INPUT_CLS = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}
