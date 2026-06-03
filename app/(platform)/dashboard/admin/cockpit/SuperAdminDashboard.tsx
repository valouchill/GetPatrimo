'use client';

/**
 * <SuperAdminDashboard> — Cockpit de pilotage du fondateur PatrimoTrust.
 *
 * Surface SOMBRE et « data-oriented » (bg-slate-900) qui tranche volontairement
 * avec l'interface client lumineuse. Regroupe les KPI vitaux : finance/croissance,
 * marketing/acquisition, moteur IA/forensic.
 *
 * Données : 100 % mockées (cf. ./mockData) pour visualiser le rendu. Le câblage
 * des agrégats réels (Mongo) est l'étape suivante — la forme des données est déjà
 * prête pour un swap propre.
 */

import { useState } from 'react';
import {
  Banknote,
  Home,
  Users,
  BrainCircuit,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
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

import {
  northStar,
  subscriptionBreakdown,
  overageRevenue,
  stripePayments,
  dailySignups,
  activationRate,
  utmSources,
  gradeDistribution,
  fraudWall,
  llmCosts,
  type NorthStarMetric,
} from './mockData';

/* ───────────────────────────  Helpers de formatage  ─────────────────────────── */

const fmtEUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const fmtEUR2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

/* Styles recharts partagés (thème sombre). */
const AXIS_TICK = { fill: '#94a3b8', fontSize: 12 } as const;
const GRID_STROKE = '#1e293b';
const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
  color: '#e2e8f0',
  fontSize: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
} as const;
const TOOLTIP_ITEM = { color: '#e2e8f0' } as const;
const TOOLTIP_LABEL = { color: '#94a3b8', fontWeight: 600 } as const;

/* ───────────────────────────  Primitives d'UI sombres  ─────────────────────────── */

function DeltaBadge({ delta }: { delta: number }) {
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
  metric,
  display,
  icon: Icon,
  accent,
}: {
  label: string;
  metric: NorthStarMetric;
  display: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800 p-5 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 font-serif text-3xl font-bold tracking-tight text-white tabular-nums">{display}</p>
      <div className="mt-2">
        <DeltaBadge delta={metric.delta} />
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-700/60 bg-slate-800 p-5 shadow-lg shadow-black/20 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* Tableau sombre minimal. */
function DataTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-700/60 text-left">
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
        <tbody className="divide-y divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

/* ───────────────────────────  Onglets (switcher sombre)  ─────────────────────────── */

const TABS = ['Finance & Croissance', 'Marketing & Acquisition', 'Moteur IA & Usage'] as const;

/* ───────────────────────────  Composant principal  ─────────────────────────── */

export default function SuperAdminDashboard() {
  const [tab, setTab] = useState(0);

  const fraudRate = fraudWall.analyzed > 0 ? (fraudWall.blocked / fraudWall.analyzed) * 100 : 0;
  const llmTotal = llmCosts.reduce((s, r) => s + r.estCost, 0);

  return (
    // -m-6/-m-8 : on casse le padding clair du <main> admin pour un canevas sombre plein cadre.
    <div className="-m-6 min-h-screen bg-slate-900 p-6 text-slate-100 lg:-m-8 lg:p-8">
      {/* En-tête */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-400">Cockpit · SuperAdmin</p>
          <h1 className="mt-1 font-serif text-2xl font-bold text-white sm:text-3xl">Pilotage PatrimoTrust</h1>
          <p className="mt-1 text-sm text-slate-400">
            North Star metrics, finance, acquisition et moteur IA — en un coup d'œil.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">
          <Activity className="h-3.5 w-3.5" /> Données de démonstration (mock)
        </span>
      </header>

      {/* 1. Top bar — North Star Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="MRR (Revenu mensuel)"
          metric={northStar.mrr}
          display={fmtEUR(northStar.mrr.value)}
          icon={Banknote}
          accent="bg-emerald-500/15 text-emerald-400"
        />
        <MetricCard
          label="Nouveaux propriétaires"
          metric={northStar.newOwners}
          display={fmtNum(northStar.newOwners.value)}
          icon={Home}
          accent="bg-sky-500/15 text-sky-400"
        />
        <MetricCard
          label="Nouveaux locataires"
          metric={northStar.newTenants}
          display={fmtNum(northStar.newTenants.value)}
          icon={Users}
          accent="bg-violet-500/15 text-violet-400"
        />
        <MetricCard
          label="Dossiers analysés (IA)"
          metric={northStar.aiDossiers}
          display={fmtNum(northStar.aiDossiers.value)}
          icon={BrainCircuit}
          accent="bg-amber-500/15 text-amber-400"
        />
      </section>

      {/* 2. Navigation par onglets */}
      <nav className="mt-8 inline-flex flex-wrap gap-1 rounded-2xl border border-slate-700/60 bg-slate-800 p-1">
        {TABS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === i ? 'bg-emerald-500 text-slate-900' : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {tab === 0 && <FinanceTab />}
        {tab === 1 && <MarketingTab />}
        {tab === 2 && <AiTab fraudRate={fraudRate} llmTotal={llmTotal} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════  Onglet A — Finance & Croissance  ═══════════════════════════ */

function FinanceTab() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Abonnements actifs" subtitle="Répartition par palier">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={subscriptionBreakdown} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="plan" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM}
              labelStyle={TOOLTIP_LABEL}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="count" name="Comptes" radius={[6, 6, 0, 0]} fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Revenus de dépassement" subtitle="Overage 0,49 € · 6 derniers mois">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={overageRevenue} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}€`} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM}
              labelStyle={TOOLTIP_LABEL}
              formatter={(value) => [fmtEUR(Number(value)), 'Overage']}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#f59e0b' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Derniers paiements Stripe" subtitle="Réussis & échoués" className="lg:col-span-2">
        <DataTable head={['Client', 'Palier', 'Montant', 'Statut', 'Date']}>
          {stripePayments.map((p) => (
            <tr key={p.id} className="text-slate-200">
              <td className="py-2.5 font-medium">{p.customer}</td>
              <td className="py-2.5 text-right text-slate-400">{p.plan}</td>
              <td className="py-2.5 text-right tabular-nums">{fmtEUR2(p.amount)}</td>
              <td className="py-2.5 text-right">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    p.status === 'réussi'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {p.status}
                </span>
              </td>
              <td className="py-2.5 text-right text-slate-400">{p.date}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  );
}

/* ═══════════════════════════  Onglet B — Marketing & Acquisition  ═══════════════════════════ */

function MarketingTab() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Inscriptions quotidiennes" subtitle="Propriétaires vs locataires" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dailySignups} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="owners" name="Propriétaires" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="tenants" name="Locataires" stroke="#34d399" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Taux d'activation" subtitle="≥ 1 lien de location créé">
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart
              innerRadius="72%"
              outerRadius="100%"
              data={[{ name: 'Activation', value: activationRate, fill: '#34d399' }]}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background={{ fill: '#1e293b' }} dataKey="value" cornerRadius={16} angleAxisId={0} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-serif text-4xl font-bold text-white tabular-nums">{activationRate}%</span>
            <span className="mt-1 text-xs text-slate-400">activés</span>
          </div>
        </div>
      </Panel>

      <Panel title="Sources d'acquisition" subtitle="Origine des inscriptions & conversion" className="lg:col-span-3">
        <DataTable head={['Source / Campagne', 'Inscrits', 'Conversion']}>
          {utmSources.map((s) => (
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

/* ═══════════════════════════  Onglet C — Moteur IA & Forensic  ═══════════════════════════ */

function AiTab({ fraudRate, llmTotal }: { fraudRate: number; llmTotal: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Grades attribués par l'IA" subtitle="Répartition globale">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={gradeDistribution}
              dataKey="value"
              nameKey="grade"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
              stroke="#0f172a"
              strokeWidth={2}
            >
              {gradeDistribution.map((g) => (
                <Cell key={g.grade} fill={g.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      </Panel>

      {/* Mur de protection anti-fraude */}
      <Panel title="Mur de protection" subtitle="Anti-fraude · ce mois-ci" className="lg:col-span-2">
        <div className="flex h-full flex-col justify-center gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-red-500/15">
              <ShieldAlert className="h-8 w-8 text-red-400" />
            </span>
            <div>
              <p className="font-serif text-5xl font-bold text-white tabular-nums">{fraudWall.blocked}</p>
              <p className="mt-1 text-sm text-slate-300">fraudes bloquées</p>
            </div>
          </div>
          <div className="sm:ml-auto sm:text-right">
            <p className="text-3xl font-bold text-red-400 tabular-nums">{fraudRate.toFixed(1)}%</p>
            <p className="mt-1 text-sm text-slate-400">
              des {fmtNum(fraudWall.analyzed)} dossiers
              <br className="hidden sm:block" /> analysés ce mois
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Coûts LLM estimés" subtitle="Surveillance de la rentabilité vs abonnements" className="lg:col-span-3">
        <DataTable head={['Modèle', 'Usage', 'Requêtes', 'Coût estimé']}>
          {llmCosts.map((r) => (
            <tr key={r.model} className="text-slate-200">
              <td className="py-2.5 font-medium">{r.model}</td>
              <td className="py-2.5 text-right text-slate-400">{r.usage}</td>
              <td className="py-2.5 text-right tabular-nums">{fmtNum(r.requests)}</td>
              <td className="py-2.5 text-right tabular-nums font-semibold text-amber-400">{fmtEUR2(r.estCost)}</td>
            </tr>
          ))}
          <tr className="text-slate-100">
            <td className="pt-3 font-semibold" colSpan={3}>
              Total estimé / mois
            </td>
            <td className="pt-3 text-right font-bold tabular-nums text-amber-300">{fmtEUR2(llmTotal)}</td>
          </tr>
        </DataTable>
      </Panel>
    </div>
  );
}
