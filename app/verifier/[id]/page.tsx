/**
 * Vérification publique d'une attestation de contrôle.
 *
 * C'est ce qui donne sa valeur à la pièce : un tiers — assureur, garant,
 * juge, locataire — peut confirmer qu'une attestation présentée existe bien,
 * quand elle a été émise et ce qu'elle conclut.
 *
 * PRINCIPE DE DIVULGATION MINIMALE : cette page ne montre AUCUNE donnée
 * personnelle et aucune pièce. Elle confirme l'existence, la date et le
 * verdict — rien de plus. Le nom du candidat n'y figure pas : l'identifiant
 * circule dans des mains inconnues, et une attestation ne doit jamais devenir
 * un canal de fuite sur le dossier qu'elle protège.
 */

import { connectDiditDb } from '@/app/api/didit/db';
import { PROTOCOL_CHECKS } from '@/lib/attestation/protocol';

const DossierAttestation = require('@/models/DossierAttestation');

export const metadata = {
  title: 'Vérifier une attestation — Maison Patrimo',
  robots: { index: false, follow: false },
};

const VERDICT_UI: Record<string, { bg: string; ring: string; fg: string; label: string; note: string }> = {
  CONFORME: {
    bg: 'bg-emerald-50', ring: 'ring-emerald-200', fg: 'text-emerald-800',
    label: 'Conforme au protocole',
    note: 'Tous les contrôles prévus ont été exécutés et aucun n’a échoué.',
  },
  NON_CONFORME: {
    bg: 'bg-red-50', ring: 'ring-red-200', fg: 'text-red-800',
    label: 'Non conforme au protocole',
    note: 'Au moins un contrôle bloquant a échoué.',
  },
  INCOMPLET: {
    bg: 'bg-amber-50', ring: 'ring-amber-200', fg: 'text-amber-800',
    label: 'Dossier incomplet',
    note: 'Un ou plusieurs contrôles bloquants n’ont pas pu être exécutés.',
  },
};

export default async function VerifyAttestationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await connectDiditDb();

  // Recherche insensible à la casse et aux tirets : l'identifiant est souvent
  // recopié à la main depuis une feuille imprimée.
  const normalized = String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formatted = normalized.length === 12
    ? `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`
    : String(id || '').toUpperCase();

  const attestation = await DossierAttestation.findOne({ verificationId: formatted })
    .select('verificationId verdict protocolVersion checks issuedAt revokedAt documentsCount')
    .lean();

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
        Maison Patrimo
      </p>
      <h1 className="mt-1 font-serif text-2xl font-bold text-emerald-950">
        Vérification d’une attestation
      </h1>

      {!attestation ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="font-semibold text-slate-900">Aucune attestation ne correspond</p>
          <p className="mt-1 text-sm text-slate-600">
            L’identifiant <span className="font-mono">{formatted}</span> n’existe pas. Vérifiez la
            saisie — il comporte douze caractères, sans les lettres I et O ni les chiffres 0 et 1.
          </p>
        </div>
      ) : attestation.revokedAt ? (
        <div className="mt-6 rounded-2xl bg-red-50 p-6 ring-1 ring-red-200">
          <p className="font-semibold text-red-800">Attestation révoquée</p>
          <p className="mt-1 text-sm text-red-700">
            Cette attestation a été annulée le{' '}
            {new Date(attestation.revokedAt).toLocaleDateString('fr-FR')} et ne doit plus être opposée.
          </p>
        </div>
      ) : (
        <>
          <div className={`mt-6 rounded-2xl p-6 ring-1 ${VERDICT_UI[attestation.verdict]?.bg} ${VERDICT_UI[attestation.verdict]?.ring}`}>
            <p className={`text-lg font-bold ${VERDICT_UI[attestation.verdict]?.fg}`}>
              {VERDICT_UI[attestation.verdict]?.label}
            </p>
            <p className="mt-1 text-sm text-slate-700">{VERDICT_UI[attestation.verdict]?.note}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] text-slate-500">Émise le</dt>
                <dd className="font-semibold text-slate-900">
                  {new Date(attestation.issuedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Protocole</dt>
                <dd className="font-semibold text-slate-900">{attestation.protocolVersion}</dd>
              </div>
            </dl>
          </div>

          <h2 className="mt-8 font-serif text-lg font-semibold text-emerald-950">Contrôles exécutés</h2>
          <ul className="mt-2 space-y-1.5">
            {(attestation.checks || []).map((c: { code: string; label: string; status: string }) => (
              <li key={c.code} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={
                    c.status === 'PASSED' ? 'text-emerald-600'
                      : c.status === 'FAILED' ? 'text-red-600' : 'text-slate-400'
                  }
                >
                  {c.status === 'PASSED' ? '✓' : c.status === 'FAILED' ? '✗' : '—'}
                </span>
                <span className="text-slate-700">{c.label}</span>
              </li>
            ))}
          </ul>

          <details className="mt-6 rounded-xl bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Que vérifie chaque contrôle ?
            </summary>
            <ul className="mt-2 space-y-2 text-xs text-slate-600">
              {PROTOCOL_CHECKS.map((c) => (
                <li key={c.code}>
                  <strong>{c.label}</strong> — {c.description}
                  {c.kind === 'model' && ' (contrôle indicatif)'}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}

      <p className="mt-8 text-xs leading-relaxed text-slate-500">
        Cette page confirme l’existence, la date et le résultat d’une attestation. Elle ne divulgue
        aucune donnée personnelle et aucune pièce du dossier. L’attestation établit que des contrôles
        ont été exécutés à une date donnée&nbsp;; elle ne constitue ni une certification
        d’authenticité des documents, ni un avis juridique, ni une garantie de solvabilité.
      </p>
    </div>
  );
}
