'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { getEquipmentForRoom } from '../data/equipmentTemplates';

export default function EquipmentPicker({
  roomName,
  existingNames,
  onConfirm,
  onClose,
}: {
  roomName: string;
  existingNames: string[];
  onConfirm: (names: string[]) => void;
  onClose: () => void;
}) {
  const suggestions = getEquipmentForRoom(roomName).filter((n) => !existingNames.includes(n));
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState('');

  function toggle(name: string) {
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function addCustom() {
    const trimmed = custom.trim();
    if (trimmed && !selected.includes(trimmed) && !existingNames.includes(trimmed)) {
      setSelected((prev) => [...prev, trimmed]);
      setCustom('');
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="max-h-[75vh] overflow-hidden rounded-t-3xl bg-white"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-slate-300" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3">
            <h3 className="text-base font-bold text-slate-900">Ajouter des équipements</h3>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>

          {/* Suggestions */}
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            {suggestions.length > 0 && (
              <div className="space-y-1.5">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggle(name)}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                      selected.includes(name) ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 text-xs ${
                      selected.includes(name) ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300'
                    }`}>
                      {selected.includes(name) && '✓'}
                    </div>
                    {name}
                  </button>
                ))}
              </div>
            )}

            {/* Custom input */}
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                placeholder="Équipement personnalisé..."
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!custom.trim()}
                className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-orange-500 text-white disabled:opacity-30"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div className="border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={() => onConfirm(selected)}
              disabled={selected.length === 0}
              className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-orange-600 disabled:opacity-40"
            >
              Ajouter {selected.length > 0 ? `(${selected.length})` : ''}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
