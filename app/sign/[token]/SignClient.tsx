'use client';

/**
 * Parcours PUBLIC de signature du bail (mobile-first).
 * 3 étapes : lecture du bail → code de confirmation par email (consentement)
 * → signature manuscrite. Aucune session requise : le token EST le secret.
 *
 * Pattern canvas repris de l'EDL (SignaturesStep) ; DA alignée sur le produit
 * (émeraude/or, titres serif).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eraser,
  FileText,
  Loader2,
  Lock,
  PenLine,
  ShieldCheck,
} from 'lucide-react';

interface SignerInfo {
  fullName: string;
  email: string;
  role: 'OWNER' | 'TENANT' | 'COTENANT' | 'GUARANTOR';
  otpVerified: boolean;
}
interface GuaranteeInfo {
  amount: number;
  durationMonths?: number;
}
interface PartyInfo {
  role: 'OWNER' | 'TENANT' | 'COTENANT' | 'GUARANTOR';
  signed: boolean;
  you: boolean;
}
interface LeaseInfo {
  tenantName: string;
  address: string;
  rentAmount?: number;
  chargesAmount?: number;
  depositAmount?: number;
  startDate?: string;
  durationMonths?: number;
  leaseType?: string;
  documentUrl: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'bailleur',
  TENANT: 'locataire',
  COTENANT: 'colocataire',
  GUARANTOR: 'garant',
};

const LEASE_TYPE_LABEL: Record<string, string> = {
  FURNISHED: 'Meublé',
  UNFURNISHED: 'Non meublé',
  MOBILITY: 'Bail mobilité',
  MEUBLE: 'Meublé',
  VIDE: 'Non meublé',
  MOBILITE: 'Bail mobilité',
};

function euro(n?: number): string {
  return typeof n === 'number' ? `${n.toLocaleString('fr-FR')} €` : '—';
}

export function SignClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signer, setSigner] = useState<SignerInfo | null>(null);
  const [lease, setLease] = useState<LeaseInfo | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [done, setDone] = useState<{ complete: boolean } | null>(null);
  const [parties, setParties] = useState<PartyInfo[]>([]);
  // Art. 2297 C. civ. : la caution écrit elle-même sa mention d'engagement.
  const [guarantee, setGuarantee] = useState<GuaranteeInfo | null>(null);
  const [guaranteeMention, setGuaranteeMention] = useState('');
  const [expiredLink, setExpiredLink] = useState(false);

  const [step, setStep] = useState<'read' | 'otp' | 'sign'>('read');
  const [otpSent, setOtpSent] = useState(false);
  const [otpFeedback, setOtpFeedback] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasReadConfirmed, setHasReadConfirmed] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [hasDrawn, setHasDrawn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/sign/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Lien invalide.');
        setExpiredLink(data?.reason === 'expired');
      } else if (data.alreadySigned) {
        setAlreadySigned(true);
        if (data.complete) setDone({ complete: true });
      } else {
        setSigner(data.signer);
        setLease(data.lease);
        setParties(Array.isArray(data.parties) ? data.parties : []);
        setGuarantee(data.guarantee || null);
        if (data.signer?.otpVerified) setStep('sign');
      }
    } catch {
      setError('Impossible de charger le document.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(action: string, payload: Record<string, unknown> = {}) {
    const res = await fetch(`/api/public/sign/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Erreur');
    return data;
  }

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendCooldown]);

  async function handleSendOtp(isResend = false) {
    setBusy(true);
    setError(null);
    setOtpFeedback(null);
    try {
      await post('send-otp');
      setOtpSent(true);
      setStep('otp');
      setResendCooldown(45);
      if (isResend) setOtpFeedback(`Code renvoyé à ${signer?.email || 'votre adresse'}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    setError(null);
    try {
      await post('verify', { code: code.trim() });
      setStep('sign');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Code invalide');
    } finally {
      setBusy(false);
    }
  }

  async function handleSign() {
    const image = canvasRef.current?.toDataURL('image/png');
    if (!image || !hasDrawn) {
      setError('Merci de tracer votre signature.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await post('sign', { signatureImage: image, guaranteeMention });
      setDone({ complete: Boolean(r.complete) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  // ── Canvas ──
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    // Le buffer fait 520×200 mais le canvas est affiché en w-full : sans mise à
    // l'échelle, le trait était décalé et étiré sur mobile.
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (c.width / rect.width),
      y: (e.clientY - rect.top) * (c.height / rect.height),
    };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    lastPos.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();
    lastPos.current = p;
    if (!hasDrawn) setHasDrawn(true);
  }
  function up() {
    drawing.current = false;
  }
  function clearPad() {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
  }

  // ── Rendus ──
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (error && !signer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-serif text-xl font-bold text-emerald-950">
            {expiredLink ? 'Lien expiré' : 'Lien indisponible'}
          </p>
          <p className="mt-2 text-sm text-slate-600" role="alert">{error}</p>
          <p className="mt-4 text-sm text-slate-600">
            {expiredLink
              ? 'Les liens de signature sont valables 7 jours. Demandez au bailleur de vous renvoyer un nouveau lien — il le fait en un clic depuis son espace.'
              : 'Ouvrez le lien directement depuis votre email, ou demandez au bailleur de vous le renvoyer.'}
          </p>
        </div>
      </div>
    );
  }

  if (alreadySigned || done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <p className="mt-4 font-serif text-2xl font-bold text-emerald-950">
            {done?.complete ? 'Bail signé par toutes les parties 🎉' : 'Signature enregistrée'}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {done?.complete
              ? 'Le contrat définitif, accompagné de son certificat de signature, est disponible pour toutes les parties.'
              : 'Merci ! Les autres signataires ont été invités à signer à leur tour. Vous recevrez le contrat définitif une fois toutes les signatures recueillies.'}
          </p>
          {done?.complete && (
            <a
              href={`/api/public/sign/${encodeURIComponent(token)}/document`}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white"
            >
              <FileText className="h-4 w-4" />
              Télécharger le contrat signé (PDF)
            </a>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {done?.complete
              ? 'Votre exemplaire vous a également été envoyé par email.'
              : parties.filter((p) => !p.signed && !p.you).length > 0
                ? `En attente : ${parties.filter((p) => !p.signed && !p.you).map((p) => ROLE_LABEL[p.role]).join(', ')}.`
                : ''}
          </p>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Signature électronique horodatée, conforme à l&rsquo;article 1367 du Code civil
            (règlement eIDAS). Une copie du certificat de preuve est jointe au contrat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* En-tête */}
      <div className="bg-emerald-950 px-6 py-6 text-center">
        <p className="font-serif text-lg font-bold text-white">Maison Patrimo</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400">
          Signature électronique
        </p>
      </div>

      <div className="mx-auto max-w-lg px-5 py-6">
        <p className="text-center text-sm text-slate-600">
          Bonjour <strong>{signer?.fullName || signer?.email}</strong>, vous signez ce bail en tant
          que <strong>{ROLE_LABEL[signer?.role || 'TENANT']}</strong>.
        </p>

        {/* Étapes */}
        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-semibold">
          {(['read', 'otp', 'sign'] as const).map((s, i) => (
            <span
              key={s}
              className={`rounded-full px-2.5 py-1 ${
                step === s
                  ? 'bg-emerald-900 text-white'
                  : i < ['read', 'otp', 'sign'].indexOf(step)
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i + 1}. {s === 'read' ? 'Lire' : s === 'otp' ? 'Confirmer' : 'Signer'}
            </span>
          ))}
        </div>

        {/* Récap du bail */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Contrat de location
          </p>
          <p className="mt-1 font-serif text-lg font-semibold text-emerald-950">{lease?.address}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] text-slate-400">Loyer</dt>
              <dd className="font-semibold text-slate-900">{euro(lease?.rentAmount)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Charges</dt>
              <dd className="font-semibold text-slate-900">{euro(lease?.chargesAmount)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Dépôt de garantie</dt>
              <dd className="font-semibold text-slate-900">{euro(lease?.depositAmount)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-400">Début</dt>
              <dd className="font-semibold text-slate-900">
                {lease?.startDate ? new Date(lease.startDate).toLocaleDateString('fr-FR') : '—'}
              </dd>
            </div>
          </dl>
          <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
            <div>
              <dt className="text-[11px] text-slate-500">Durée</dt>
              <dd className="font-semibold text-slate-900">
                {lease?.durationMonths ? `${lease.durationMonths} mois` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">Type de bail</dt>
              <dd className="font-semibold text-slate-900">
                {LEASE_TYPE_LABEL[lease?.leaseType || ''] || lease?.leaseType || '—'}
              </dd>
            </div>
          </dl>

          {parties.length > 1 && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
              Signatures : {parties.filter((p) => p.signed).length}/{parties.length}
              {parties.some((p) => !p.signed && !p.you)
                ? ` — signeront après vous : ${parties.filter((p) => !p.signed && !p.you).map((p) => ROLE_LABEL[p.role]).join(', ')}`
                : ''}
            </p>
          )}

          {lease?.documentUrl ? (
            <>
              <button
                type="button"
                onClick={() => setShowPdfViewer((v) => !v)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
              >
                <FileText className="h-4 w-4" />
                {showPdfViewer ? 'Replier le contrat' : 'Lire le contrat en entier'}
              </button>
              {showPdfViewer && (
                <>
                  {/* Lecture SANS quitter la page : quitter = perdre le signataire */}
                  <iframe
                    src={lease.documentUrl}
                    title="Contrat de bail"
                    className="mt-3 h-[60vh] w-full rounded-xl border border-slate-200 bg-white"
                  />
                  <a
                    href={lease.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-center text-xs text-slate-500 underline"
                  >
                    Ouvrir dans un nouvel onglet
                  </a>
                </>
              )}
            </>
          ) : (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
              Le document n&rsquo;est pas encore disponible — contactez votre bailleur avant de signer.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}

        {/* Étape 1 → 2 */}
        {step === 'read' && (
          <div className="mt-5">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={hasReadConfirmed}
                onChange={(e) => setHasReadConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-700"
              />
              <span>
                Je reconnais avoir pris connaissance de l&rsquo;intégralité du contrat de bail et de
                ses annexes.
              </span>
            </label>
            <button
              type="button"
              onClick={() => handleSendOtp()}
              disabled={busy || !hasReadConfirmed || !lease?.documentUrl}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Recevoir mon code de signature
            </button>
          </div>
        )}

        {/* Étape 2 : OTP */}
        {step === 'otp' && (
          <form
            className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && code.length === 6) handleVerify();
            }}
          >
            <p className="text-sm text-slate-700">
              Un code à 6 chiffres vient d&rsquo;être envoyé à <strong>{signer?.email}</strong>.
              Il vaut consentement à signer.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-label="Code de confirmation à 6 chiffres"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="mt-3 w-full rounded-xl border-2 border-slate-200 py-3.5 text-center text-2xl font-bold tracking-[0.4em] text-slate-900 outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={busy || code.length < 6}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Valider le code
            </button>
            {otpFeedback && (
              <p className="mt-2 text-center text-xs text-emerald-700" role="status">{otpFeedback}</p>
            )}
            <button
              type="button"
              onClick={() => handleSendOtp(true)}
              disabled={busy || resendCooldown > 0}
              className="mt-2 w-full text-xs text-slate-500 underline disabled:no-underline disabled:opacity-60"
            >
              {resendCooldown > 0 ? `Renvoyer le code (${resendCooldown} s)` : 'Renvoyer le code'}
            </button>
            <p className="mt-1.5 text-center text-[11px] text-slate-500">
              Pas reçu ? Vérifiez vos courriers indésirables.
            </p>
          </form>
        )}

        {/* Étape 3 : signature */}
        {step === 'sign' && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
            {guarantee && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Recopiez cette mention de votre main
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  La loi exige que vous écriviez vous-même l&rsquo;étendue de votre engagement
                  (art. 2297 du Code civil) — une mention pré-remplie rendrait votre
                  cautionnement <strong>nul</strong>.
                </p>
                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-700">
                  Votre engagement porte sur <strong>{guarantee.amount.toLocaleString('fr-FR')} €</strong>
                  {guarantee.durationMonths ? ` (loyer et charges sur ${guarantee.durationMonths} mois)` : ''}.
                  Écrivez une phrase qui l&rsquo;exprime clairement et mentionnez ce montant.
                </p>
                <textarea
                  value={guaranteeMention}
                  onChange={(e) => setGuaranteeMention(e.target.value)}
                  rows={3}
                  aria-label="Mention d'engagement de la caution"
                  placeholder={`Exemple : je me porte caution solidaire dans la limite de ${guarantee.amount.toLocaleString('fr-FR')} €, couvrant le paiement des loyers et charges.`}
                  className="mt-2 w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400"
                />
              </div>
            )}

            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <PenLine className="h-4 w-4 text-emerald-700" />
              Signez dans le cadre
            </p>
            <canvas
              ref={canvasRef}
              width={520}
              height={200}
              aria-label="Zone de signature manuscrite — tracez votre signature au doigt ou à la souris"
              role="img"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerLeave={up}
              className="mt-3 h-[200px] w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-slate-50"
            />
            <button
              type="button"
              onClick={clearPad}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500"
            >
              <Eraser className="h-3.5 w-3.5" /> Effacer
            </button>
            <button
              type="button"
              onClick={handleSign}
              disabled={busy || !hasDrawn || (Boolean(guarantee) && guaranteeMention.trim().length < 20)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-sm font-bold text-emerald-950 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Signer le bail
            </button>
          </div>
        )}

        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          Signature électronique simple (règlement eIDAS, art. 1367 C. civ.) : votre consentement
          est recueilli par code email, la signature est horodatée et l&rsquo;empreinte du document
          est scellée. Un certificat de preuve est annexé au contrat.
        </p>
      </div>
    </div>
  );
}
