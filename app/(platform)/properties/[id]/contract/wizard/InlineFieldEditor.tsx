'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Lock } from 'lucide-react';
import { resolveFieldForVariable, type FieldMeta } from './fieldRegistry';
import { InfoBubble } from './InfoBubble';
import type { LeaseFormData } from './types';

interface Props {
  varName: string;
  anchorRect: DOMRect;
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number | boolean) => void;
  onClose: () => void;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], obj);
}

export function InlineFieldEditor({ varName, anchorRect, formData, onFieldChange, onClose }: Props) {
  const meta = resolveFieldForVariable(varName);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 1024);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!meta) return null;

  const currentValue = meta.formField ? getNestedValue(formData as unknown as Record<string, unknown>, meta.formField) : undefined;

  // Position: below the anchor on desktop, bottom drawer on mobile
  const top = isMobile ? undefined : Math.min(anchorRect.bottom + 8, window.innerHeight - 300);
  const left = isMobile ? undefined : Math.max(8, Math.min(anchorRect.left, window.innerWidth - 320));

  const content = (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">{meta.label}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
      </div>

      {/* Tooltip */}
      {meta.tooltip && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <InfoBubble text="" className="hidden" />
          <p>{meta.tooltip}</p>
        </div>
      )}

      {/* Editor widget */}
      {meta.type === 'readonly' && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          <span>Calculé automatiquement</span>
        </div>
      )}

      {meta.type === 'number' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={currentValue as number ?? ''}
            onChange={(e) => onFieldChange(meta.formField, e.target.value === '' ? 0 : Number(e.target.value))}
            min={meta.min}
            max={meta.max}
            autoFocus
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
          />
          {meta.suffix && <span className="text-xs text-slate-500 whitespace-nowrap">{meta.suffix}</span>}
        </div>
      )}

      {meta.type === 'text' && (
        <input
          type="text"
          value={(currentValue as string) ?? ''}
          onChange={(e) => onFieldChange(meta.formField, e.target.value)}
          autoFocus
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
        />
      )}

      {meta.type === 'date' && (
        <input
          type="date"
          value={(currentValue as string) ?? ''}
          onChange={(e) => onFieldChange(meta.formField, e.target.value)}
          autoFocus
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
        />
      )}

      {meta.type === 'select' && meta.options && (
        <div className="space-y-1.5">
          {meta.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onFieldChange(meta.formField, opt.value); onClose(); }}
              className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                currentValue === opt.value
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-medium'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span>{opt.label}</span>
              {opt.info && <span className="text-xs text-slate-400 ml-2">{opt.info}</span>}
            </button>
          ))}
        </div>
      )}

      {meta.type === 'pill' && meta.options && (
        <div className="flex flex-wrap gap-2">
          {meta.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onFieldChange(meta.formField, opt.value); onClose(); }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                currentValue === opt.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {meta.type === 'toggle' && (
        <button
          type="button"
          onClick={() => { onFieldChange(meta.formField, !currentValue); onClose(); }}
          className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            currentValue
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {currentValue ? 'Oui (cliquez pour désactiver)' : 'Non (cliquez pour activer)'}
        </button>
      )}
    </div>
  );

  // Mobile: bottom drawer
  if (isMobile) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/30"
          onClick={onClose}
        >
          <motion.div
            ref={popoverRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Desktop: popover
  return (
    <AnimatePresence>
      <motion.div
        ref={popoverRef}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        style={{ position: 'fixed', top, left, width: 310 }}
        className="z-50 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
