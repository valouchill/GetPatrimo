'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, MapPin, Ruler, Euro } from 'lucide-react';

interface EditPropertyModalProps {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  currentAddress: string;
  currentSurface?: number;
  currentRent?: number;
  isArchived?: boolean;
  onSaved: () => void;
}

export default function EditPropertyModal({
  open,
  onClose,
  propertyId,
  currentAddress,
  currentSurface,
  currentRent,
  isArchived = false,
  onSaved,
}: EditPropertyModalProps) {
  const [address, setAddress] = useState(currentAddress);
  const [surfaceM2, setSurfaceM2] = useState<string>(String(currentSurface ?? ''));
  const [rentAmount, setRentAmount] = useState<string>(String(currentRent ?? ''));
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ label: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAddress(currentAddress);
    setSurfaceM2(String(currentSurface ?? ''));
    setRentAmount(String(currentRent ?? ''));
    setError(null);
    setConfirmArchive(false);
  }, [open, currentAddress, currentSurface, currentRent]);

  useEffect(() => {
    if (address.length < 3 || address === currentAddress) {
      setSuggestions([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=4`)
        .then((r) => r.json())
        .then((data: { features?: { properties: { label: string } }[] }) => {
          const items = data.features?.map((f: { properties: { label: string } }) => ({ label: f.properties.label })) ?? [];
          setSuggestions(items);
          setShowSuggestions(items.length > 0);
        })
        .catch(() => setSuggestions([]));
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [address, currentAddress]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/owner/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          surfaceM2: surfaceM2 ? Number(surfaceM2) : undefined,
          rentAmount: rentAmount ? Number(rentAmount) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur');
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }, [address, surfaceM2, rentAmount, propertyId, onSaved, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3
                className="text-lg font-semibold text-slate-900"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Modifier les informations
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Adresse
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 mt-1 py-1 bg-white rounded-xl border border-slate-200 shadow-lg z-10 max-h-40 overflow-auto">
                      {suggestions.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50 transition-colors"
                            onClick={() => { setAddress(s.label); setShowSuggestions(false); }}
                          >
                            {s.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                    <Ruler className="w-3 h-3" /> Surface (m²)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={surfaceM2}
                    onChange={(e) => setSurfaceM2(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                    <Euro className="w-3 h-3" /> Loyer CC (€)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            <div className="px-6 pb-5 space-y-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !address.trim()}
                className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                ) : (
                  'Mettre à jour'
                )}
              </button>

              {/* Zone de danger : archivage */}
              <div className="pt-3 border-t border-slate-100">
                {!confirmArchive ? (
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(true)}
                    className="w-full text-sm text-red-700/70 hover:text-red-700 hover:bg-red-50 py-2 rounded-lg transition-colors"
                  >
                    {isArchived ? 'Réactiver cet actif' : 'Mettre cet actif en sommeil (Archiver)'}
                  </button>
                ) : (
                  <div className="bg-red-50 rounded-xl p-4 space-y-3">
                    <p className="text-sm text-red-800">
                      {isArchived
                        ? 'Cet actif sera réactivé et acceptera de nouveau les candidatures.'
                        : 'Cet actif n\'acceptera plus de candidatures. L\'historique est conservé.'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmArchive(false)}
                        className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        disabled={archiving}
                        onClick={async () => {
                          setArchiving(true);
                          try {
                            const res = await fetch(`/api/owner/properties/${propertyId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ archived: !isArchived }),
                            });
                            if (res.ok) { onSaved(); onClose(); }
                            else setError('Erreur lors de l\'archivage.');
                          } catch {
                            setError('Erreur réseau.');
                          } finally {
                            setArchiving(false);
                          }
                        }}
                        className="flex-1 py-2 text-sm text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        {archiving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Confirmer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
