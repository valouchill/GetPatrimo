'use client';

import { memo, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, Download, Loader2, Send, X } from 'lucide-react';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

interface QuittanceActionsProps {
  paymentId: string;
  period: { month: number; year: number };
  variant?: 'row' | 'modal';
  onSent?: (sentTo: string) => void;
}

const QuittanceActions = memo(function QuittanceActions({
  paymentId, period, variant = 'row', onSent,
}: QuittanceActionsProps) {
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendState, setSendState] = useState<'idle' | 'success' | 'error'>('idle');
  const [sentTo, setSentTo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDownload = useCallback(async () => {
    setDownloadLoading(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/receipt`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quittance_${MONTHS[period.month - 1].toLowerCase()}_${period.year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadLoading(false);
    }
  }, [paymentId, period]);

  const handleSend = useCallback(async () => {
    setSendLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/payments/${paymentId}/send-receipt`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        setSentTo(json.data?.sentTo || '');
        setSendState('success');
        onSent?.(json.data?.sentTo || '');
      } else {
        setErrorMsg(json.error || "Erreur lors de l'envoi");
        setSendState('error');
      }
    } catch {
      setErrorMsg('Erreur réseau');
      setSendState('error');
    } finally {
      setSendLoading(false);
    }
  }, [paymentId, onSent]);

  if (variant === 'modal') {
    return (
      <div className="space-y-2">
        <button
          onClick={handleDownload}
          disabled={downloadLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {downloadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Télécharger la quittance
        </button>

        {sendState === 'success' ? (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>Envoyée à <span className="font-semibold">{sentTo}</span></span>
          </motion.div>
        ) : (
          <button
            onClick={handleSend}
            disabled={sendLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {sendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer au locataire
          </button>
        )}

        <AnimatePresence>
          {sendState === 'error' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Row variant
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleDownload}
        disabled={downloadLoading}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        title="Télécharger la quittance"
      >
        {downloadLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        <span className="hidden lg:inline">Quittance</span>
      </button>

      {sendState === 'success' ? (
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
          <CheckCircle className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Envoyée</span>
        </span>
      ) : (
        <button
          onClick={handleSend}
          disabled={sendLoading}
          className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
          title={sendState === 'error' ? errorMsg : 'Envoyer au locataire par email'}
        >
          {sendLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          <span className="hidden lg:inline">{sendState === 'error' ? 'Réessayer' : 'Envoyer'}</span>
        </button>
      )}
    </div>
  );
});

export { QuittanceActions };
