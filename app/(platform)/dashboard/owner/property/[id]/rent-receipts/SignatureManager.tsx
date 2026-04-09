'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { useNotification } from '@/app/hooks/useNotification';
import { Loader2, X, Trash2, Upload, Pen } from 'lucide-react';
import SignaturePad from 'signature_pad';

interface SignatureManagerProps {
  onClose: () => void;
}

export default function SignatureManager({ onClose }: SignatureManagerProps) {
  const { success: notifySuccess, error: notifyError } = useNotification();
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  // Fetch current signature
  useEffect(() => {
    fetch('/api/owner/signature')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data.hasSignature) {
          setCurrentSignature(data.data.signatureDataUrl);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Init signature pad
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      penColor: '#111827',
      backgroundColor: 'rgba(255, 255, 255, 0)',
    });
    padRef.current = pad;

    return () => { pad.off(); };
  }, [loading]); // re-init after loading complete

  const clearPad = useCallback(() => {
    padRef.current?.clear();
  }, []);

  const saveFromPad = useCallback(async () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      notifyError('Veuillez dessiner votre signature');
      return;
    }

    setSaving(true);
    try {
      const dataUrl = pad.toDataURL('image/png');
      const res = await fetch('/api/owner/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: dataUrl }),
      });
      if (res.ok) {
        setCurrentSignature(dataUrl);
        notifySuccess('Signature enregistree');
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        notifyError(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch {
      notifyError('Erreur reseau');
    } finally {
      setSaving(false);
    }
  }, [notifySuccess, notifyError, onClose]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      notifyError('Format invalide. Utilisez PNG ou JPG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notifyError('Image trop volumineuse (max 2 Mo)');
      return;
    }

    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, [notifyError]);

  const saveFromUpload = useCallback(async () => {
    if (!uploadPreview) return;

    setSaving(true);
    try {
      const res = await fetch('/api/owner/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData: uploadPreview }),
      });
      if (res.ok) {
        setCurrentSignature(uploadPreview);
        notifySuccess('Signature enregistree');
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        notifyError(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch {
      notifyError('Erreur reseau');
    } finally {
      setSaving(false);
    }
  }, [uploadPreview, notifySuccess, notifyError, onClose]);

  const deleteSignature = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/owner/signature', { method: 'DELETE' });
      if (res.ok) {
        setCurrentSignature(null);
        notifySuccess('Signature supprimee');
      }
    } catch {
      notifyError('Erreur reseau');
    } finally {
      setSaving(false);
    }
  }, [notifySuccess, notifyError]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-slate-900">Votre signature</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Current signature preview */}
            {currentSignature && (
              <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 mb-2">
                  Signature actuelle
                </p>
                <div className="flex items-center justify-between">
                  <img
                    src={currentSignature}
                    alt="Signature"
                    className="h-14 object-contain"
                  />
                  <button
                    onClick={deleteSignature}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                </div>
              </div>
            )}

            <Tabs defaultValue="draw">
              <TabsList className="mb-4">
                <TabsTrigger value="draw">
                  <Pen className="h-3.5 w-3.5 mr-1.5" />
                  Dessiner
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Importer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="draw">
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-[160px] cursor-crosshair touch-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={clearPad}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Effacer
                  </button>
                  <button
                    onClick={saveFromPad}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Valider
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="upload">
                {uploadPreview ? (
                  <div className="mb-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-center">
                      <img src={uploadPreview} alt="Preview" className="h-[120px] object-contain" />
                    </div>
                    <button
                      onClick={() => { setUploadPreview(null); setUploadFile(null); }}
                      className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                    >
                      Changer d&apos;image
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-10 mb-4 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
                    <Upload className="h-8 w-8 text-slate-300" />
                    <span className="text-sm text-slate-500">PNG ou JPG — max 2 Mo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
                <button
                  onClick={saveFromUpload}
                  disabled={saving || !uploadPreview}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enregistrer
                </button>
              </TabsContent>
            </Tabs>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
