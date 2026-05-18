'use client';

import { useRef, useCallback, useEffect } from 'react';
import { Eraser, PenLine } from 'lucide-react';

interface SignatureData {
  data?: string;
  date?: string;
  name?: string;
}

interface Signatures {
  owner?: SignatureData;
  tenant?: SignatureData;
}

function SignaturePad({
  label,
  signature,
  onChange,
}: {
  label: string;
  signature?: SignatureData;
  onChange: (sig: SignatureData) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    lastPos.current = getPos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    const data = canvasRef.current?.toDataURL();
    if (data) onChange({ ...signature, data, date: new Date().toISOString() });
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange({ ...signature, data: undefined, date: undefined });
  }

  // Restore existing signature on mount
  useEffect(() => {
    if (!signature?.data || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = signature.data;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenLine className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900">{label}</h3>
        </div>
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          <Eraser className="h-3.5 w-3.5" /> Effacer
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        className="w-full rounded-xl border-2 border-slate-200 bg-slate-50/50"
        style={{ touchAction: 'none', height: 150 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      <input
        type="text"
        value={signature?.name || ''}
        onChange={(e) => onChange({ ...signature, name: e.target.value })}
        placeholder="Nom et prénom"
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
      />
    </div>
  );
}

export default function SignaturesStep({
  signatures,
  onUpdate,
}: {
  signatures?: Signatures;
  onUpdate: (signatures: Signatures) => void;
}) {
  const sigs = signatures || {};

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Signatures</h2>
        <p className="mt-1 text-sm text-slate-500">Signez directement sur l'écran avec votre doigt</p>
      </div>

      <SignaturePad
        label="Propriétaire"
        signature={sigs.owner}
        onChange={(owner) => onUpdate({ ...sigs, owner })}
      />

      <div className="border-t border-slate-100" />

      <SignaturePad
        label="Locataire"
        signature={sigs.tenant}
        onChange={(tenant) => onUpdate({ ...sigs, tenant })}
      />
    </div>
  );
}
