'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { Download, Loader2, Link as LinkIcon, Copy, Check } from 'lucide-react';

interface TrustCardPreviewProps {
  applyUrl: string;
  privilegeCode: string;
}

export default function TrustCardPreview({ applyUrl, privilegeCode }: TrustCardPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shortDomain = 'doc2loc.com';
  const shortPath = `/p/${privilegeCode}`;
  const shortLinkDisplay = `${shortDomain}${shortPath}`;
  const shortLinkFull = `https://${shortLinkDisplay}`;

  useEffect(() => {
    QRCode.toDataURL(shortLinkFull, {
      width: 180,
      margin: 1,
      color: { dark: '#064e3b', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }).then(setQrDataUrl);
  }, [applyUrl]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `patrimotrust-acces-${privilegeCode}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Erreur génération PNG', e);
    } finally {
      setDownloading(false);
    }
  }, [privilegeCode]);

  return (
    <div className="flex flex-col items-center">
      {/* La carte elle-même — ratio carte de crédit ~1.586:1 */}
      <div
        ref={cardRef}
        className="relative w-full overflow-hidden rounded-2xl"
        style={{
          aspectRatio: '85.6 / 53.98',
          background: 'linear-gradient(145deg, #022c22 0%, #064e3b 30%, #022c22 100%)',
        }}
      >
        {/* Grain / texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '120px 120px',
          }}
        />

        {/* Liseré doré supérieur */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

        {/* Contenu de la carte */}
        <div className="relative flex flex-col items-center justify-between h-full px-6 py-5">
          {/* Header */}
          <div className="text-center w-full">
            <p
              className="text-amber-400/90 text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              PatrimoTrust™
            </p>
            <p
              className="text-amber-400 text-sm font-semibold mt-0.5"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Invitation à Candidater
            </p>
          </div>

          {/* QR Code central dans un anneau doré */}
          <div className="flex items-center justify-center my-2">
            <div className="p-[3px] rounded-xl bg-gradient-to-br from-amber-400/50 via-amber-500/30 to-amber-400/50">
              <div className="bg-white p-2 rounded-[9px]">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code d'accès"
                    className="w-[80px] h-[80px]"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="w-[80px] h-[80px] bg-slate-100 rounded animate-pulse" />
                )}
              </div>
            </div>
          </div>

          {/* Shortlink sous le QR Code */}
          <div
            className="flex items-center justify-center gap-1.5 -mt-1 mb-0.5"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            <LinkIcon className="w-[11px] h-[11px] text-emerald-300/70" />
            <p className="text-emerald-100/70 text-[10px] font-medium tracking-wide">
              {shortLinkDisplay}
            </p>
          </div>

          {/* Code Privilège — bas de carte */}
          <div className="text-center w-full">
            <p className="text-white/50 text-[9px] uppercase tracking-wider mb-0.5">
              Code Privilège
            </p>
            <p
              className="text-white font-mono text-lg tracking-[0.3em] font-bold"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
            >
              ❖ {privilegeCode} ❖
            </p>
          </div>
        </div>

        {/* Liseré doré inférieur */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
      </div>

      {/* Bouton de téléchargement sous la carte */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-800 text-white rounded-xl font-medium hover:bg-emerald-900 disabled:opacity-60 transition-colors shadow-md"
      >
        {downloading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Génération...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Télécharger le Sésame (PNG)
          </>
        )}
      </button>

      {/* Quick Copy : lien direct */}
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(shortLinkFull);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="w-full mt-3 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors group"
      >
        <span className="truncate text-slate-600 text-sm font-mono">
          {shortLinkFull}
        </span>
        {copied ? (
          <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium whitespace-nowrap ml-2">
            <Check className="w-4 h-4" />
            Copié
          </span>
        ) : (
          <Copy className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors flex-shrink-0 ml-2" />
        )}
      </button>
    </div>
  );
}
