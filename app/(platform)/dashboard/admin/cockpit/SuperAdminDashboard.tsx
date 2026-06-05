'use client';

/**
 * <SuperAdminDashboard> — Cockpit de pilotage du fondateur Maison Patrimo.
 *
 * Surface SOMBRE « Data Center / Cockpit » (bg-slate-950) centrée sur l'ÉCONOMIE
 * UNITAIRE : revenus vs coûts API, marge brute IA, coût par dossier (< overage).
 *
 * Données : `data` (prop) = agrégats RÉELS Mongo (lib/admin/cockpit-data) + coûts
 * API ESTIMÉS (dérivés du volume réel) + quelques séries mock (tendances, UTM).
 */

import { useState } from 'react';
import {
  Banknote,
  BrainCircuit,
  Coins,
  Gauge,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

import type { CockpitData } from '@/lib/admin/cockpit-data';

/* ───────────────────────────  Formatage  ─────────────────────────── */

const fmtEUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtEUR2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
// Coût unitaire d'un appel LLM (très petit) — 4 décimales.
const fmtEUR4 = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(n);
const fmtDateTime = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/* Styles recharts (thème sombre). */
const AXIS_TICK = { fill: '#94a3b8', fontSize: 12 } as const;
const GRID_STROKE = '#1e293b';
const TOOLTIP_STYLE = {
  backgroundColor: '#020617',
  border: '1px solid #334155',
  borderRadius: 12,
  color: '#e2e8f0',
  fontSize: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
} as const;
const TOOLTIP_ITEM = { color: '#e2e8f0' } as const;
const TOOLTIP_LABEL = { color: '#94a3b8', fontWeight: 600 } as const;

/* ───────────────────────────  Primitives sombres  ─────────────────────────── */

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs text-slate-500">— pas d&apos;historique</span>;
  }
  const positive = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
      }`}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}
      {delta.toFixed(1)}% vs M-1
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  valueClassName = 'text-white',
  footer,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
  valueClassName?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/30">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className={`mt-3 font-serif text-3xl font-bold tracking-tight tabular-nums ${valueClassName}`}>{value}</p>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = '',
  highlight = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-slate-900 p-5 shadow-lg shadow-black/30 ${
        highlight ? 'border-emerald-500/30 ring-1 ring-emerald-500/20' : 'border-slate-800'
      } ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {highlight && (
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            KPI vital
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function DataTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left">
            {head.map((h, i) => (
              <th
                key={h}
                className={`pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${
                  i === 0 ? '' : 'text-right'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">{children}</tbody>
      </table>
    </div>
  );
}

const TABS = ['Finance & Rentabilité', 'Acquisition & Tunnel', 'Moteur IA & Performance'] as const;

/* ───────────────────────────  Composant principal  ─────────────────────────── */

export default function SuperAdminDashboard({ data }: { data: CockpitData }) {
  const [tab, setTab] = useState(0);

  const marginHealthy = data.northStar.marginBrutIA >= 0;
  const costHealthy = data.northStar.costPerDossier < data.overagePriceEur;

  return (
    // -m-* : on casse le padding clair du <main> admin pour un canevas sombre plein cadre.
    <div className="-m-6 min-h-screen bg-slate-950 p-6 text-slate-100 lg:-m-8 lg:p-8">
      {/* En-tête */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-400">Cockpit · SuperAdmin</p>
          <h1 className="mt-1 font-serif text-2xl font-bold text-white sm:text-3xl">Économie Unitaire & Pilotage</h1>
          <p className="mt-1 text-sm text-slate-400">
            Revenus vs coûts API, rentabilité de l&apos;IA, acquisition et moteur forensic.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
          <Activity className="h-3.5 w-3.5" />
          {data.costSource === 'estimated' ? 'Données réelles · coûts API estimés' : 'Données + coûts API réels (loggés)'}
        </span>
      </header>

      {/* 1. North Star Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="MRR (Revenu récurrent)"
          value={fmtEUR(data.northStar.mrr)}
          icon={Banknote}
          accent="bg-emerald-500/15 text-emerald-400"
          footer={<span className="text-xs text-slate-400">{fmtEUR(data.revenueTotal)} avec overage</span>}
        />
        <MetricCard
          label="Marge Brute IA"
          value={fmtEUR(data.northStar.marginBrutIA)}
          icon={Coins}
          accent={marginHealthy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}
          valueClassName={marginHealthy ? 'text-emerald-400' : 'text-red-400'}
          footer={<span className="text-xs text-slate-400">Revenus − {fmtEUR(data.apiCostTotal)} coûts API</span>}
        />
        <MetricCard
          label="Coût moyen / dossier"
          value={fmtEUR2(data.northStar.costPerDossier)}
          icon={Gauge}
          accent={costHealthy ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}
          valueClassName={costHealthy ? 'text-emerald-400' : 'text-red-400'}
          footer={
            <span className={`text-xs font-medium ${costHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
              {costHealthy ? '✓' : '⚠'} &lt; overage {fmtEUR2(data.overagePriceEur)} ·{' '}
              {data.costPerDossierReal ? 'réel' : 'estimé'}
            </span>
          }
        />
        <MetricCard
          label="Dossiers analysés (mois)"
          value={fmtNum(data.northStar.dossiersAnalyzed.value)}
          icon={BrainCircuit}
          accent="bg-violet-500/15 text-violet-400"
          footer={<DeltaBadge delta={data.northStar.dossiersAnalyzed.delta} />}
        />
      </section>

      {/* 2. Onglets */}
      <nav className="mt-8 inline-flex flex-wrap gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1">
        {TABS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === i ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === 0 && <FinanceTab data={data} />}
        {tab === 1 && <AcquisitionTab data={data} />}
        {tab === 2 && <AiTab data={data} />}
      </div>
    </div>
  );
}

/* ═══════════════════════  Onglet A — Finance & Rentabilité  ═══════════════════════ */

function FinanceTab({ data }: { data: CockpitData }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {/* KPI VITAL — Corrélation Revenus vs Coûts (central, mis en avant) */}
      <Panel
        title="Corrélation Revenus vs Coûts API"
        subtitle="Barres = revenus (abonnements + overage) · Ligne = coût total des API"
        highlight
      >
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data.revenueVsCost} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="rev"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k€`}
            />
            <YAxis
              yAxisId="cost"
              orientation="right"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}€`}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM}
              labelStyle={TOOLTIP_LABEL}
              formatter={(value, name) => [fmtEUR(Number(value)), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Bar yAxisId="rev" dataKey="revenue" name="Revenus" fill="#10b981" radius={[6, 6, 0, 0]} barSize={38} />
            <Line
              yAxisId="cost"
              type="monotone"
              dataKey="apiCost"
              name="Coût API"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#ef4444' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Coût par dossier — 30 jours" subtitle="Détection d'anomalie de consommation de tokens">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.costPerDossier30d} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={28} />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Number(v).toFixed(2)}€`}
                domain={[0, 'auto']}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM}
                labelStyle={TOOLTIP_LABEL}
                formatter={(value) => [fmtEUR2(Number(value)), 'Coût/dossier']}
              />
              <Line type="monotone" dataKey="cost" stroke="#38bdf8" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Abonnements & Overage" subtitle="Répartition des paliers + CA des dépassements">
          <DataTable head={['Palier', 'Comptes', 'Prix', 'MRR']}>
            {data.subscriptionBreakdown.map((s) => (
              <tr key={s.tier} className="text-slate-200">
                <td className="py-2.5 font-medium">{s.plan}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtNum(s.count)}</td>
                <td className="py-2.5 text-right text-slate-400 tabular-nums">
                  {s.priceEur > 0 ? fmtEUR2(s.priceEur) : '—'}
                </td>
                <td className="py-2.5 text-right tabular-nums font-semibold text-emerald-400">{fmtEUR(s.mrr)}</td>
              </tr>
            ))}
            <tr className="text-slate-200">
              <td className="py-2.5 font-medium">
                Overage <span className="text-slate-500">({fmtNum(data.overageUnits)} × {fmtEUR2(data.overagePriceEur)})</span>
              </td>
              <td className="py-2.5 text-right tabular-nums">{fmtNum(data.overageUnits)}</td>
              <td className="py-2.5 text-right text-slate-400">—</td>
              <td className="py-2.5 text-right tabular-nums font-semibold text-emerald-400">{fmtEUR(data.overageRevenue)}</td>
            </tr>
            <tr className="text-white">
              <td className="pt-3 font-semibold" colSpan={3}>
                Revenu total
              </td>
              <td className="pt-3 text-right font-bold tabular-nums text-emerald-300">{fmtEUR(data.revenueTotal)}</td>
            </tr>
          </DataTable>
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════════  Onglet B — Acquisition & Tunnel  ═══════════════════════ */

function AcquisitionTab({ data }: { data: CockpitData }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Inscriptions quotidiennes" subtitle="Propriétaires vs locataires · 30 jours" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.dailySignups} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={20} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="owners" name="Propriétaires" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="tenants" name="Locataires" stroke="#34d399" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        {data.dailySignups.length === 0 && (
          <p className="mt-2 text-center text-xs text-slate-500">Aucune inscription sur la période.</p>
        )}
      </Panel>

      <Panel title="Taux d'activation" subtitle="Propriétaires avec ≥ 1 lien de location">
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart
              innerRadius="72%"
              outerRadius="100%"
              data={[{ name: 'Activation', value: data.activationRate, fill: '#34d399' }]}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background={{ fill: '#1e293b' }} dataKey="value" cornerRadius={16} angleAxisId={0} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-4xl font-bold text-white tabular-nums">{data.activationRate}%</span>
            <span className="mt-1 text-xs text-slate-400">activés</span>
          </div>
        </div>
      </Panel>

      <Panel title="Sources d'acquisition" subtitle="Origine des inscriptions & conversion (mock — UTM non tracké)" className="lg:col-span-3">
        <DataTable head={['Source / Campagne', 'Inscrits', 'Conversion']}>
          {data.utmSources.map((s) => (
            <tr key={s.source} className="text-slate-200">
              <td className="py-2.5 font-medium">{s.source}</td>
              <td className="py-2.5 text-right tabular-nums">{fmtNum(s.signups)}</td>
              <td className="py-2.5 text-right">
                <span
                  className={`tabular-nums font-semibold ${
                    s.conversion >= 6 ? 'text-emerald-400' : s.conversion >= 4 ? 'text-amber-400' : 'text-slate-300'
                  }`}
                >
                  {s.conversion.toFixed(1)}%
                </span>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}

/* ═══════════════════════  Onglet C — Moteur IA & Performance  ═══════════════════════ */

function AiTab({ data }: { data: CockpitData }) {
  const fraudRate = data.fraudShield.analyzed > 0 ? (data.fraudShield.blocked / data.fraudShield.analyzed) * 100 : 0;
  const totalGrades = data.gradeDistribution.reduce((s, g) => s + g.value, 0);
  const apiTotal = data.apiCostsByProvider.reduce((s, r) => s + r.estCost, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Grades attribués par l'IA" subtitle={`Sévérité du scoring · ${fmtNum(totalGrades)} dossiers`}>
        {totalGrades === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">Aucun dossier analysé.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.gradeDistribution}
                dataKey="value"
                nameKey="grade"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                stroke="#020617"
                strokeWidth={2}
              >
                {data.gradeDistribution.map((g) => (
                  <Cell key={g.grade} fill={g.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Bouclier anti-fraude */}
      <Panel title="Bouclier anti-fraude" subtitle="Dossiers écartés pour suspicion forensic · ce mois" className="lg:col-span-2">
        <div className="flex h-full flex-col justify-center gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-red-500/15">
              <ShieldAlert className="h-8 w-8 text-red-400" />
            </span>
            <div>
              <p className="font-serif text-5xl font-bold text-white tabular-nums">{data.fraudShield.blocked}</p>
              <p className="mt-1 text-sm text-slate-300">dossiers écartés</p>
            </div>
          </div>
          <div className="sm:ml-auto sm:text-right">
            <p className="text-3xl font-bold text-red-400 tabular-nums">{fraudRate.toFixed(1)}%</p>
            <p className="mt-1 text-sm text-slate-400">
              des {fmtNum(data.fraudShield.analyzed)} dossiers
              <br className="hidden sm:block" /> analysés ce mois
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Consommation API par fournisseur" subtitle="Coût réel (loggé) ou estimé — ce mois" className="lg:col-span-3">
        <DataTable head={['Fournisseur', 'Source', 'Requêtes', 'Coût']}>
          {data.apiCostsByProvider.map((r) => (
            <tr key={r.provider} className="text-slate-200">
              <td className="py-2.5 font-medium">
                {r.provider} <span className="text-slate-500">· {r.category}</span>
              </td>
              <td className="py-2.5 text-right">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    r.real ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-400'
                  }`}
                >
                  {r.real ? 'réel' : 'estimé'}
                </span>
              </td>
              <td className="py-2.5 text-right tabular-nums">{fmtNum(r.requests)}</td>
              <td className="py-2.5 text-right tabular-nums font-semibold text-amber-400">{fmtEUR2(r.estCost)}</td>
            </tr>
          ))}
          <tr className="text-white">
            <td className="pt-3 font-semibold" colSpan={3}>
              Total / mois
            </td>
            <td className="pt-3 text-right font-bold tabular-nums text-amber-300">{fmtEUR2(apiTotal)}</td>
          </tr>
        </DataTable>
      </Panel>

      {/* Détail de CHAQUE appel API (journal temps réel ApiCostLog) */}
      <Panel
        title="Derniers appels API"
        subtitle="Journal des coûts unitaires mesurés (ApiCostLog)"
        className="lg:col-span-3"
      >
        {data.recentApiCalls.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Aucun appel encore loggé. Les coûts unitaires réels apparaîtront ici dès la première analyse de
            dossier / vérification d&apos;identité.
          </p>
        ) : (
          <DataTable head={['Quand', 'Fournisseur', 'Modèle', 'Tokens', 'Coût réel']}>
            {data.recentApiCalls.map((c, i) => (
              <tr key={`${c.createdAt}-${i}`} className="text-slate-200">
                <td className="py-2.5 text-slate-400">{fmtDateTime(c.createdAt)}</td>
                <td className="py-2.5 text-right font-medium">
                  {c.provider} <span className="text-slate-500">· {c.category}</span>
                </td>
                <td className="py-2.5 text-right text-slate-400">{c.model || '—'}</td>
                <td className="py-2.5 text-right tabular-nums">{c.tokens > 0 ? fmtNum(c.tokens) : '—'}</td>
                <td className="py-2.5 text-right tabular-nums font-semibold text-amber-400">{fmtEUR4(c.costEur)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}