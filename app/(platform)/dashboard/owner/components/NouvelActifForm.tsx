'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowRight, CheckCircle2, MapPin, ShieldCheck, Building2, Euro, Ruler } from 'lucide-react';
import { Btn } from './ui';

interface AddressSuggestion {
  label: string;
  context: string;
  postcode: string;
  city: string;
  name: string;
}

const PROPERTY_TYPES = [
  { value: 'APPARTEMENT', label: 'Appartement' },
  { value: 'MAISON', label: 'Maison' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'LOFT', label: 'Loft' },
  { value: 'LOCAL_COMMERCIAL', label: 'Local commercial' },
  { value: 'GARAGE', label: 'Garage / Parking' },
  { value: 'AUTRE', label: 'Autre' },
];

const EQUIPMENT_OPTIONS = [
  'Ascenseur', 'Balcon', 'Terrasse', 'Parking', 'Cave',
  'Gardien', 'Interphone', 'Digicode', 'Fibre optique',
  'Cuisine équipée', 'Lave-linge', 'Lave-vaisselle',
];

const STEPS = [
  { label: 'Adresse', icon: MapPin },
  { label: 'Caractéristiques', icon: Building2 },
  { label: 'Financier', icon: Euro },
  { label: 'Récapitulatif', icon: CheckCircle2 },
];

export function NouvelActifForm({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    address: '',
    addressLine: '',
    zipCode: '',
    city: '',
    propertyType: 'APPARTEMENT',
    surfaceM2: '',
    rooms: '',
    bedrooms: '',
    floor: '',
    totalFloors: '',
    equipment: [] as string[],
    description: '',
    rentAmount: '',
    chargesAmount: '',
    purchasePrice: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const f = (k: keyof typeof form, v: string | string[]) => setForm((p) => ({ ...p, [k]: v }));

  // Address autocomplete via API gouv
  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 5) { setSuggestions([]); return; }
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`);
      if (!res.ok) return;
      const data = await res.json();
      const results: AddressSuggestion[] = (data.features || []).map((f: { properties: { label: string; context: string; postcode: string; city: string; name: string } }) => ({
        label: f.properties.label,
        context: f.properties.context,
        postcode: f.properties.postcode,
        city: f.properties.city,
        name: f.properties.name,
      }));
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch { /* silent */ }
  }, []);

  const onAddressInput = (v: string) => {
    f('address', v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(v), 300);
  };

  const selectSuggestion = (s: AddressSuggestion) => {
    setForm((p) => ({
      ...p,
      address: s.label,
      addressLine: s.name,
      zipCode: s.postcode,
      city: s.city,
    }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleEquipment = (item: string) => {
    setForm((p) => ({
      ...p,
      equipment: p.equipment.includes(item)
        ? p.equipment.filter((e) => e !== item)
        : [...p.equipment, item],
    }));
  };

  const handleSubmit = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/owner/properties', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: form.address,
          rentAmount: parseFloat(form.rentAmount) || 0,
          surfaceM2: parseFloat(form.surfaceM2) || undefined,
          chargesAmount: parseFloat(form.chargesAmount) || 0,
          propertyType: form.propertyType,
          rooms: form.rooms ? parseInt(form.rooms) : undefined,
          bedrooms: form.bedrooms ? parseInt(form.bedrooms) : undefined,
          floor: form.floor ? parseInt(form.floor) : undefined,
          totalFloors: form.totalFloors ? parseInt(form.totalFloors) : undefined,
          equipment: form.equipment,
          description: form.description,
          purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : undefined,
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Erreur lors de la création.'); return; }
      onDone();
    } catch { setError('Erreur réseau. Vérifiez votre connexion.'); }
    finally { setLoading(false); }
  };

  const canNext = (s: number): boolean => {
    switch (s) {
      case 0: return form.address.trim().length >= 5;
      case 1: return true; // all optional
      case 2: return !!form.rentAmount && parseFloat(form.rentAmount) > 0;
      default: return true;
    }
  };

  const InputCls = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition";
  const LabelCls = "mb-1.5 block text-xs font-semibold text-slate-700";

  return (
    <div className="mx-auto max-w-2xl">
      {/* Stepper */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div key={s.label} className="flex items-center gap-2">
                {i > 0 && <div className={`hidden sm:block h-px w-8 ${done ? 'bg-orange-500' : 'bg-slate-200'}`} />}
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-orange-50 text-orange-600' : done ? 'text-emerald-600 hover:bg-slate-50' : 'text-slate-400'
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    active ? 'bg-orange-500 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        {/* Step 0: Address */}
        {step === 0 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Adresse du bien</h3>
            <p className="mb-5 text-sm text-slate-500">Commencez à saisir et sélectionnez dans la liste.</p>
            <div className="relative mb-6" ref={suggestionsRef}>
              <label htmlFor="actif-address" className={LabelCls}>Adresse complète</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="actif-address" type="text"
                  placeholder="Ex : 42 rue de la Roquette, 75011 Paris"
                  className={`${InputCls} pl-10`}
                  value={form.address}
                  onChange={(e) => onAddressInput(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  aria-required="true" autoComplete="off"
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {suggestions.map((s, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => selectSuggestion(s)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors">
                        <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-900">{s.label}</div>
                          <div className="text-xs text-slate-500">{s.context}</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {form.city && (
              <div className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {form.addressLine}, {form.zipCode} {form.city}
              </div>
            )}
            <div className="flex justify-end">
              <Btn variant="amber" disabled={!canNext(0)} onClick={() => setStep(1)}>
                Continuer <ArrowRight className="h-4 w-4" />
              </Btn>
            </div>
          </>
        )}

        {/* Step 1: Characteristics */}
        {step === 1 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Caractéristiques</h3>
            <p className="mb-5 text-sm text-slate-500">Décrivez votre bien. Ces infos enrichissent la fiche candidat.</p>
            <div className="mb-5">
              <label className={LabelCls}>Type de bien</label>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => f('propertyType', t.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      form.propertyType === t.value
                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label htmlFor="actif-surface" className={LabelCls}>Surface (m²)</label>
                <input id="actif-surface" type="number" min={0} placeholder="45" className={InputCls}
                  value={form.surfaceM2} onChange={(e) => f('surfaceM2', e.target.value)} />
              </div>
              <div>
                <label htmlFor="actif-rooms" className={LabelCls}>Pièces</label>
                <input id="actif-rooms" type="number" min={1} placeholder="3" className={InputCls}
                  value={form.rooms} onChange={(e) => f('rooms', e.target.value)} />
              </div>
              <div>
                <label htmlFor="actif-bedrooms" className={LabelCls}>Chambres</label>
                <input id="actif-bedrooms" type="number" min={0} placeholder="2" className={InputCls}
                  value={form.bedrooms} onChange={(e) => f('bedrooms', e.target.value)} />
              </div>
              <div>
                <label htmlFor="actif-floor" className={LabelCls}>Étage</label>
                <input id="actif-floor" type="number" min={0} placeholder="3" className={InputCls}
                  value={form.floor} onChange={(e) => f('floor', e.target.value)} />
              </div>
            </div>
            <div className="mb-5">
              <label className={LabelCls}>Équipements</label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <button key={eq} type="button" onClick={() => toggleEquipment(eq)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      form.equipment.includes(eq)
                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    {eq}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <label htmlFor="actif-desc" className={LabelCls}>Description <span className="font-normal text-slate-400">optionnel</span></label>
              <textarea id="actif-desc" rows={3} placeholder="Description libre du bien..."
                className={`${InputCls} resize-none`}
                value={form.description} onChange={(e) => f('description', e.target.value)} />
            </div>
            <div className="flex justify-between">
              <Btn variant="secondary" onClick={() => setStep(0)}>← Retour</Btn>
              <Btn variant="amber" onClick={() => setStep(2)}>Continuer <ArrowRight className="h-4 w-4" /></Btn>
            </div>
          </>
        )}

        {/* Step 2: Financial */}
        {step === 2 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Paramètres financiers</h3>
            <p className="mb-5 text-sm text-slate-500">Le loyer alimente le scoring automatique des candidatures.</p>
            <div className="mb-5 grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="actif-rent" className={LabelCls}>Loyer HC (€/mois) *</label>
                <input id="actif-rent" type="number" min={0} placeholder="1 200" className={InputCls}
                  value={form.rentAmount} onChange={(e) => f('rentAmount', e.target.value)} aria-required="true" />
              </div>
              <div>
                <label htmlFor="actif-charges" className={LabelCls}>Charges (€/mois)</label>
                <input id="actif-charges" type="number" min={0} placeholder="150" className={InputCls}
                  value={form.chargesAmount} onChange={(e) => f('chargesAmount', e.target.value)} />
              </div>
            </div>
            <div className="mb-5">
              <label htmlFor="actif-price" className={LabelCls}>Prix d&apos;achat (€) <span className="font-normal text-slate-400">pour la rentabilité</span></label>
              <input id="actif-price" type="number" min={0} placeholder="250 000" className={InputCls}
                value={form.purchasePrice} onChange={(e) => f('purchasePrice', e.target.value)} />
              {form.purchasePrice && form.rentAmount && parseFloat(form.purchasePrice) > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                  <Ruler className="h-4 w-4" />
                  Rentabilité brute estimée : {((parseFloat(form.rentAmount) * 12 / parseFloat(form.purchasePrice)) * 100).toFixed(1)}%
                </p>
              )}
            </div>
            <div className="flex justify-between">
              <Btn variant="secondary" onClick={() => setStep(1)}>← Retour</Btn>
              <Btn variant="amber" disabled={!canNext(2)} onClick={() => setStep(3)}>Continuer <ArrowRight className="h-4 w-4" /></Btn>
            </div>
          </>
        )}

        {/* Step 3: Summary */}
        {step === 3 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Récapitulatif</h3>
            <p className="mb-5 text-sm text-slate-500">Vérifiez avant de créer la fiche.</p>
            <div className="mb-5 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50">
              {([
                ['Adresse', form.address],
                ['Type', PROPERTY_TYPES.find(t => t.value === form.propertyType)?.label || '—'],
                ['Surface', form.surfaceM2 ? `${parseFloat(form.surfaceM2)} m²` : '—'],
                ['Pièces', form.rooms || '—'],
                ['Étage', form.floor ? (form.floor === '0' ? 'RDC' : `${form.floor}e`) : '—'],
                ['Loyer HC', `${parseFloat(form.rentAmount) || 0} €/mois`],
                ['Charges', form.chargesAmount ? `${parseFloat(form.chargesAmount)} €/mois` : '—'],
                ['Prix d\'achat', form.purchasePrice ? `${parseFloat(form.purchasePrice).toLocaleString('fr-FR')} €` : '—'],
              ] as [string, string][]).filter(([, v]) => v !== '—').map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500">{k}</span><span className="font-semibold text-slate-900">{v}</span>
                </div>
              ))}
              {form.equipment.length > 0 && (
                <div className="px-4 py-3">
                  <div className="text-sm text-slate-500 mb-1.5">Équipements</div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.equipment.map(eq => (
                      <span key={eq} className="rounded-md bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-medium text-orange-700">{eq}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Un lien Sésame unique sera généré pour partager aux candidats.</span>
            </div>
            {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="flex justify-between">
              <Btn variant="secondary" onClick={() => setStep(2)}>← Retour</Btn>
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
