'use client';

import { useEffect, useState } from 'react';

interface BillingData {
  managed: boolean;
  customer: { id: string; email?: string; name?: string } | null;
  subscription: {
    id: string;
    status: string;
    cancel_at_period_end: boolean;
    current_period_start: number;
    current_period_end: number;
    items: Array<{ priceId: string; amount: number | null; currency: string; interval?: string }>;
  } | null;
  invoices: Array<{
    id: string;
    number?: string;
    status: string;
    amount_paid: number;
    currency: string;
    created: number;
    hosted_invoice_url?: string;
  }>;
  customerError?: string;
  subscriptionError?: string;
  invoicesError?: string;
}

interface Props {
  propertyId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  managed: boolean;
}

export default function BillingPanel({ propertyId, stripeSubscriptionId, managed }: Props) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showRefund, setShowRefund] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing/properties/${propertyId}/stripe`);
      if (res.ok) setData(await res.json());
      else setInfo(`❌ ${(await res.json()).error || 'Erreur Stripe'}`);
    } finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées (chargement au montage / sur changement ciblé)
  useEffect(() => { load();   }, [propertyId]);

  async function runAction(name: string, url: string, method = 'POST', body?: any) {
    if (!confirm(`Confirmer : ${name} ?`)) return;
    setAction(name);
    setInfo(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setInfo(`❌ ${json.error || 'Erreur'}`);
      else {
        setInfo(`✓ ${name}`);
        await load();
        setTimeout(() => setInfo(null), 4000);
      }
    } finally { setAction(null); }
  }

  const fmtMoney = (cents: number | null, cur: string) =>
    cents == null ? '—' : `${(cents / 100).toFixed(2)} ${cur.toUpperCase()}`;
  const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('fr-FR');

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Billing Stripe</h2>
        <button onClick={load} className="text-xs text-indigo-600 hover:underline">Rafraîchir</button>
      </div>

      {info && <div className="mb-3 text-sm p-2 rounded bg-gray-50">{info}</div>}

      {loading && <div className="text-sm text-gray-500">Chargement Stripe…</div>}

      {!loading && data && (
        <>
          <div className="text-sm mb-3">
            <span className="text-gray-500">Statut :</span>{' '}
            {managed
              ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Managed</span>
              : <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Non managed</span>}
          </div>

          {data.customer ? (
            <div className="text-sm mb-3 text-gray-700">
              <span className="text-gray-500">Customer :</span>{' '}
              <span className="font-mono">{data.customer.id}</span>
              {data.customer.email && <> · {data.customer.email}</>}
            </div>
          ) : (
            <div className="text-sm mb-3 text-gray-500">Pas de customer Stripe lié</div>
          )}
          {data.customerError && <div className="text-xs text-red-600 mb-2">Erreur customer: {data.customerError}</div>}

          {data.subscription ? (
            <div className="mb-3 p-3 rounded border border-gray-200 bg-gray-50">
              <div className="text-sm">
                <span className="font-mono text-xs">{data.subscription.id}</span>{' '}
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  data.subscription.status === 'active' ? 'bg-green-100 text-green-700' :
                  data.subscription.status === 'canceled' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{data.subscription.status}</span>
                {data.subscription.cancel_at_period_end && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">annulation programmée</span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Période : {fmtDate(data.subscription.current_period_start)} → {fmtDate(data.subscription.current_period_end)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {data.subscription.items.map((it) => (
                  <div key={it.priceId} className="font-mono">
                    {it.priceId} — {fmtMoney(it.amount, it.currency)} {it.interval && `/ ${it.interval}`}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-3 text-sm text-gray-500">Pas d&apos;abonnement actif</div>
          )}
          {data.subscriptionError && <div className="text-xs text-red-600 mb-2">Erreur sub: {data.subscriptionError}</div>}

          <div className="flex flex-wrap gap-2 mb-4">
            {!stripeSubscriptionId && (
              <button
                onClick={() => runAction('Upgrade PRO', `/api/admin/billing/properties/${propertyId}/upgrade`)}
                disabled={action !== null}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                🚀 Upgrade PRO
              </button>
            )}
            {data.subscription && !data.subscription.cancel_at_period_end && data.subscription.status === 'active' && (
              <button
                onClick={() => runAction('Annuler fin de période', `/api/admin/billing/properties/${propertyId}/cancel`)}
                disabled={action !== null}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler (fin de période)
              </button>
            )}
            {data.subscription && data.subscription.cancel_at_period_end && (
              <button
                onClick={() => runAction('Réactiver', `/api/admin/billing/properties/${propertyId}/reactivate`)}
                disabled={action !== null}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Réactiver
              </button>
            )}
            {data.subscription && data.subscription.status === 'active' && (
              <button
                onClick={() => runAction('Annulation IMMÉDIATE', `/api/admin/billing/properties/${propertyId}/cancel?immediate=true`)}
                disabled={action !== null}
                className="px-3 py-1.5 text-sm border border-red-200 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
              >
                Annuler maintenant
              </button>
            )}
            {data.invoices.length > 0 && (
              <button
                onClick={() => setShowRefund((v) => !v)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                Refund (superadmin)
              </button>
            )}
          </div>

          {showRefund && <RefundForm propertyId={propertyId} invoices={data.invoices} onDone={() => { setShowRefund(false); load(); }} />}

          {data.invoices.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Factures récentes</h3>
              <ul className="text-xs divide-y divide-gray-100">
                {data.invoices.map((inv) => (
                  <li key={inv.id} className="py-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono">{inv.number || inv.id.slice(-10)}</span>{' '}
                      <span className="text-gray-500">· {fmtDate(inv.created)}</span>{' '}
                      <span className={`px-1.5 py-0.5 rounded ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{inv.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{fmtMoney(inv.amount_paid, inv.currency)}</span>
                      {inv.hosted_invoice_url && (
                        <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Voir</a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RefundForm({ propertyId, invoices, onDone }: {
  propertyId: string;
  invoices: Array<{ id: string; amount_paid: number; currency: string }>;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('requested_by_customer');
  const [chargeId, setChargeId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!chargeId) { setErr('chargeId requis'); return; }
    if (!confirm(`Rembourser ${amount || '(total)'} sur charge ${chargeId} ?`)) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/billing/properties/${propertyId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargeId,
          amount: amount ? Number(amount) : undefined,
          reason,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.error || 'Erreur');
      else onDone();
    } finally { setBusy(false); }
  }

  return (
    <div className="p-3 rounded border border-red-200 bg-red-50 mb-4">
      <div className="text-sm font-semibold text-red-900 mb-2">Refund manuel (superadmin)</div>
      {err && <div className="text-xs text-red-700 mb-2">{err}</div>}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <input placeholder="chargeId (ch_...)" value={chargeId} onChange={(e) => setChargeId(e.target.value)} className="border border-gray-300 rounded px-2 py-1" />
        <input type="number" placeholder="Montant € (vide = total)" value={amount} onChange={(e) => setAmount(e.target.value)} className="border border-gray-300 rounded px-2 py-1" />
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="border border-gray-300 rounded px-2 py-1">
          <option value="requested_by_customer">requested_by_customer</option>
          <option value="duplicate">duplicate</option>
          <option value="fraudulent">fraudulent</option>
        </select>
        <button onClick={submit} disabled={busy} className="bg-red-600 text-white rounded px-3 py-1 hover:bg-red-700 disabled:opacity-50">
          {busy ? '…' : 'Rembourser'}
        </button>
      </div>
      {invoices.length > 0 && (
        <div className="text-xs text-gray-600 mt-2">
          Astuce : ouvre une facture Stripe pour récupérer le chargeId (ch_...).
        </div>
      )}
    </div>
  );
}
