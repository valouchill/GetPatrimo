'use client';

import { Fragment, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Crown,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  LayoutDashboard,
  Lock,
  PenLine,
  Plus,
  ScrollText,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  'from-emerald-500 to-teal-600',
  'from-teal-500 to-cyan-600',
  'from-cyan-500 to-blue-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-emerald-600',
  'from-slate-500 to-slate-700',
];
const palette = (id: number) => AVATAR_PALETTE[id % AVATAR_PALETTE.length];

function Avatar({ name, id = 0, size = 'md' }: { name: string; id?: number; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const ini = (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const cls = {
    xs: 'h-7 w-7 rounded-lg text-[10px]',
    sm: 'h-9 w-9 rounded-xl text-xs',
    md: 'h-11 w-11 rounded-xl text-sm',
    lg: 'h-14 w-14 rounded-2xl text-base',
  }[size];
  return (
    <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white ${cls} bg-gradient-to-br ${palette(id)}`}>
      {ini}
    </div>
  );
}

// ── Score pill ────────────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const cls = score >= 70
    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    : score >= 45
    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    : 'bg-red-50 text-red-700 ring-1 ring-red-200';
  const dot = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {score}/100
    </span>
  );
}

// ── Tag ───────────────────────────────────────────────────────────────────────

type TagType = 'slate' | 'green' | 'amber' | 'red' | 'indigo' | 'violet';
const TAG_CLS: Record<TagType, string> = {
  slate:  'bg-slate-100 text-slate-700',
  green:  'bg-emerald-50 text-emerald-700',
  amber:  'bg-amber-50 text-amber-700',
  red:    'bg-red-50 text-red-700',
  indigo: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-teal-50 text-teal-700',
};
function Tag({ children, type = 'slate' }: { children: React.ReactNode; type?: TagType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_CLS[type] || TAG_CLS.slate}`}>
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'amber';
const BTN_CLS: Record<BtnVariant, string> = {
  primary:   'bg-slate-950 text-white hover:bg-slate-800',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  ghost:     'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
  success:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  danger:    'bg-red-50 text-red-700 border border-red-200',
  amber:     'bg-amber-500 text-slate-950 hover:bg-amber-400',
};
function Btn({
  children, variant = 'primary', onClick, disabled, className = '',
}: { children: React.ReactNode; variant?: BtnVariant; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${BTN_CLS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, bg = 'bg-emerald-50' }: { icon: string; value: string | number; label: string; bg?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg ${bg}`}>{icon}</div>
      <div className="text-[1.75rem] font-bold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function Bar({ value, color = 'bg-emerald-500' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

// ── Tunnel step bar ───────────────────────────────────────────────────────────

function StepBar({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => (
        <Fragment key={label}>
          <div className="flex flex-col items-center gap-1.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              i < step ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-500/30'
              : i === step ? 'border-2 border-emerald-500 bg-white text-emerald-600 ring-4 ring-emerald-50'
              : 'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-[10px] font-semibold whitespace-nowrap ${
              i === step ? 'text-slate-900' : i < step ? 'text-emerald-700' : 'text-slate-400'
            }`}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mb-5 mx-2 h-px flex-1 rounded-full transition-colors ${i < step ? 'bg-emerald-300' : 'bg-slate-200'}`} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const BIENS = [
  { id: 1, label: 'Apt T3', adresse: '42 rue de la Roquette, Paris 11e', loyer: 1200, surface: 68, dpe: 'B', pieces: 3 },
  { id: 2, label: 'Studio', adresse: '7 rue Mercière, Lyon 2e',           loyer: 650,  surface: 24, dpe: 'C', pieces: 1 },
  { id: 3, label: 'Apt T2', adresse: '18 rue Ordener, Paris 18e',         loyer: 900,  surface: 45, dpe: 'C', pieces: 2 },
  { id: 4, label: 'Studio', adresse: '14 cours Victor Hugo, Bordeaux',    loyer: 550,  surface: 22, dpe: 'D', pieces: 1 },
];

type Dossier = {
  id: number; prenom: string; nom: string; age: number; bien_id: number;
  loyer: number; revenus: number; profession: string; contrat: string; anciennete: number;
  score: number; statut: string; date: string; bail: { type: string; signe: boolean; date: string } | null;
  note: string; garant: boolean; animaux: boolean; fumeur: boolean;
  docs: Record<string, boolean>; employeur: string;
};

const DOSSIERS_INIT: Dossier[] = [
  { id:1, prenom:"Sophie",  nom:"Martin",   age:31, bien_id:1, loyer:1200, revenus:3800, profession:"Ingénieure logiciel",  contrat:"CDI",        anciennete:5,   score:82, statut:"en_attente",  date:"12/03/2026", bail:null,                                          note:"Dossier complet, situation très stable.", garant:true,  animaux:false, fumeur:false, docs:{identite:true,salaires:true,imposition:true,contrat_travail:true,domicile:true},   employeur:"Thales Group" },
  { id:2, prenom:"Thomas",  nom:"Durand",   age:27, bien_id:2, loyer:650,  revenus:1700, profession:"Commercial B2B",       contrat:"CDD",        anciennete:1,   score:54, statut:"en_attente",  date:"14/03/2026", bail:null,                                          note:"CDD en cours de CDIsation.",             garant:true,  animaux:true,  fumeur:false, docs:{identite:true,salaires:true,imposition:true,contrat_travail:true,domicile:false},  employeur:"Salesforce" },
  { id:3, prenom:"Amina",   nom:"Benali",   age:34, bien_id:3, loyer:900,  revenus:2600, profession:"Responsable RH",       contrat:"CDI",        anciennete:3,   score:74, statut:"selectionne", date:"15/03/2026", bail:{ type:"non-meuble", signe:true,  date:"18/03/2026" }, note:"Dossier solide.",                        garant:false, animaux:false, fumeur:false, docs:{identite:true,salaires:true,imposition:true,contrat_travail:true,domicile:true},   employeur:"L'Oréal" },
  { id:4, prenom:"Lucas",   nom:"Petit",    age:24, bien_id:1, loyer:1200, revenus:1800, profession:"Designer freelance",   contrat:"Indépendant",anciennete:0.5, score:34, statut:"en_attente",  date:"16/03/2026", bail:null,                                          note:"Revenus variables, garant solide.",       garant:true,  animaux:false, fumeur:true,  docs:{identite:true,salaires:false,imposition:true,contrat_travail:false,domicile:true},  employeur:"Freelance" },
  { id:5, prenom:"Clara",   nom:"Fontaine", age:38, bien_id:1, loyer:1200, revenus:2650, profession:"Enseignante",          contrat:"CDI",        anciennete:8,   score:76, statut:"en_attente",  date:"17/03/2026", bail:null,                                          note:"Fonctionnaire, très bonne stabilité.",   garant:false, animaux:false, fumeur:false, docs:{identite:true,salaires:true,imposition:true,contrat_travail:true,domicile:true},   employeur:"Éducation Nationale" },
  { id:6, prenom:"Mehdi",   nom:"Larbi",    age:29, bien_id:1, loyer:1200, revenus:3200, profession:"Dev fullstack",        contrat:"CDI",        anciennete:2,   score:78, statut:"en_attente",  date:"17/03/2026", bail:null,                                          note:"Profil tech stable, très bon dossier.",  garant:false, animaux:false, fumeur:false, docs:{identite:true,salaires:true,imposition:true,contrat_travail:true,domicile:true},   employeur:"Doctolib" },
];

const LOYERS_INIT = [
  { id:1, locataire:"Amina Benali",  bien:"Apt T2 — Paris 18e", loyer:900,  mois:"Mars 2026",  statut:"paye",    date:"05/03/2026" },
  { id:2, locataire:"Amina Benali",  bien:"Apt T2 — Paris 18e", loyer:900,  mois:"Fév 2026",   statut:"paye",    date:"05/02/2026" },
  { id:3, locataire:"Sophie Martin", bien:"Apt T3 — Paris 11e", loyer:1200, mois:"Mars 2026",  statut:"attente", date:"—" },
];

const EDL_INIT = [
  { id:1, locataire:"Amina Benali",  bien:"Apt T2 — Paris 18e", type:"Entrée", date:"01/01/2026", statut:"signe" },
  { id:2, locataire:"Sophie Martin", bien:"Apt T3 — Paris 11e", type:"Entrée", date:"01/04/2026", statut:"planifie" },
];

const computeScore = (rev: number, loyer: number, anc: number, contrat: string) => {
  let s = 0; const r = rev / loyer;
  s += (r >= 3 ? 40 : r >= 2.5 ? 28 : r >= 2 ? 15 : 5);
  s += (contrat === 'CDI' || contrat === 'Fonctionnaire' ? 30 : contrat === 'CDD' ? 15 : 8);
  s += (parseFloat(String(anc)) >= 3 ? 20 : parseFloat(String(anc)) >= 1 ? 12 : 4);
  if (rev > 0) s += 10;
  return Math.min(s, 100);
};

// ── Candidat card (tunnel sélection) ─────────────────────────────────────────

function CandidatCard({
  c, bienLoyer, onSelect, onDetail, compareMode, inCompare, onToggleCompare,
}: {
  c: Dossier; bienLoyer: number; onSelect: (c: Dossier) => void; onDetail: (c: Dossier) => void;
  compareMode: boolean; inCompare: boolean; onToggleCompare: (id: number) => void;
}) {
  const ratio = c.revenus / bienLoyer;
  const ratioColor = ratio >= 3 ? 'text-emerald-600' : ratio >= 2 ? 'text-amber-600' : 'text-red-600';
  const metrics: [string, number, string][] = [
    ['Solvabilité', Math.min((ratio / 3) * 100, 100), ratio >= 3 ? 'bg-emerald-500' : ratio >= 2 ? 'bg-amber-500' : 'bg-red-500'],
    ['Stabilité pro', c.contrat === 'CDI' ? 100 : c.contrat === 'CDD' ? 55 : 35, c.contrat === 'CDI' ? 'bg-emerald-500' : 'bg-amber-500'],
    ['Ancienneté', Math.min((c.anciennete / 5) * 100, 100), c.anciennete >= 3 ? 'bg-emerald-500' : 'bg-amber-500'],
    ['Dossier', (Object.values(c.docs).filter(Boolean).length / 5) * 100, 'bg-emerald-500'],
  ];
  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 bg-white p-5 transition-all ${
      inCompare ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
    }`}>
      {inCompare && <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />}
      <div className="mb-4 flex items-start gap-3">
        <Avatar name={`${c.prenom} ${c.nom}`} id={c.id} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-900">{c.prenom} {c.nom}</span>
            <span className="text-xs text-slate-400">{c.age} ans</span>
            <ScorePill score={c.score} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{c.profession} · {c.employeur}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag type={c.contrat === 'CDI' ? 'green' : 'amber'}>{c.contrat}</Tag>
            {c.garant && <Tag type="indigo">Garant</Tag>}
            {c.animaux && <Tag type="amber">Animaux</Tag>}
            {c.fumeur && <Tag type="red">Fumeur</Tag>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold text-emerald-700">{c.revenus.toLocaleString()} €</div>
          <div className="text-[10px] text-slate-400">nets/mois</div>
          <div className={`mt-1 text-xs font-bold ${ratioColor}`}>Ratio {ratio.toFixed(1)}x</div>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {metrics.map(([label, val, color]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-[11px] font-semibold">
              <span className="text-slate-500">{label}</span>
              <span className="text-slate-700">{Math.round(val)}%</span>
            </div>
            <Bar value={val} color={color} />
          </div>
        ))}
      </div>
      <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{c.note}</p>
      <div className="flex gap-2">
        {compareMode ? (
          <button
            type="button"
            onClick={() => onToggleCompare(c.id)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${
              inCompare ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {inCompare ? '✓ Sélectionné' : 'Ajouter à la comparaison'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onDetail(c)}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Voir le dossier
            </button>
            <button
              type="button"
              onClick={() => onSelect(c)}
              className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              Sélectionner →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Compare view ──────────────────────────────────────────────────────────────

function CompareView({ ids, candidats, bienLoyer, onSelect }: { ids: number[]; candidats: Dossier[]; bienLoyer: number; onSelect: (c: Dossier) => void }) {
  const cs = candidats.filter((c) => ids.includes(c.id));
  const rows: { label: string; fn: (c: Dossier) => React.ReactNode }[] = [
    { label: 'Score IA',    fn: (c) => <ScorePill score={c.score} /> },
    { label: 'Revenus',     fn: (c) => <b className="text-emerald-700">{c.revenus.toLocaleString()} €</b> },
    { label: 'Ratio loyer', fn: (c) => { const r = c.revenus / bienLoyer; return <span className={`font-bold ${r >= 3 ? 'text-emerald-600' : r >= 2 ? 'text-amber-600' : 'text-red-600'}`}>{r.toFixed(1)}x</span>; } },
    { label: 'Contrat',     fn: (c) => <Tag type={c.contrat === 'CDI' ? 'green' : 'amber'}>{c.contrat}</Tag> },
    { label: 'Ancienneté',  fn: (c) => <span>{c.anciennete} an(s)</span> },
    { label: 'Employeur',   fn: (c) => <span className="text-xs">{c.employeur}</span> },
    { label: 'Garant',      fn: (c) => <span className={c.garant ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>{c.garant ? '✓ Oui' : '✗ Non'}</span> },
    { label: 'Documents',   fn: (c) => { const n = Object.values(c.docs).filter(Boolean).length; return <span className={n === 5 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>{n}/5 pièces</span>; } },
  ];
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[500px] border-collapse">
        <thead>
          <tr>
            <th className="w-36 bg-slate-50 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Critères</th>
            {cs.map((c) => (
              <th key={c.id} className="border-l border-slate-100 bg-emerald-50 px-4 py-3 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Avatar name={`${c.prenom} ${c.nom}`} id={c.id} size="sm" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">{c.prenom} {c.nom}</div>
                    <div className="text-xs text-slate-500">{c.profession}</div>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, ri) => (
            <tr key={row.label} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="px-4 py-3 text-sm font-medium text-slate-600">{row.label}</td>
              {cs.map((c) => (
                <td key={c.id} className="border-l border-slate-100 px-4 py-3 text-center text-sm">{row.fn(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="px-4 py-3" />
            {cs.map((c) => (
              <td key={c.id} className="border-l border-slate-100 px-3 py-3">
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="w-full rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
                >
                  Choisir {c.prenom} →
                </button>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Tunnel sélection (modal) ──────────────────────────────────────────────────

const SEL_STEPS = ['Dossiers', 'Comparaison', 'Confirmation', 'Bail'];

function TunnelSelection({ bienId, dossiers, onClose, onBailCreated }: {
  bienId: number; dossiers: Dossier[];
  onClose: () => void; onBailCreated: (c: Dossier, b: typeof BIENS[0], type: string) => void;
}) {
  const bien = BIENS.find((b) => b.id === bienId)!;
  const cands = dossiers.filter((d) => d.bien_id === bienId).sort((a, b) => b.score - a.score);
  const [step, setStep] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [selected, setSelected] = useState<Dossier | null>(null);
  const [detail, setDetail] = useState<Dossier | null>(null);
  const [bailType, setBailType] = useState('non-meuble');
  const [done, setDone] = useState(false);

  const toggleCompare = (id: number) =>
    setCompareIds((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p);
  const handleSelect = (c: Dossier) => { setSelected(c); setStep(2); setCompareMode(false); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/50 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4 px-6 py-4">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <X className="h-4 w-4" /> Fermer
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-slate-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">🏠 {bien.label}</span>
            <span className="text-sm text-slate-500">{bien.adresse}</span>
            <Tag type="slate">{bien.loyer} €/mois</Tag>
          </div>
          <div className="ml-auto w-80">
            <StepBar step={step} steps={SEL_STEPS} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-8">
        <div className="mx-auto max-w-5xl">

          {/* Step 0 — liste */}
          {step === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-slate-950">{cands.length} candidatures · {bien.label}</h2>
                  <p className="mt-1 text-sm text-slate-500">Analysées et scorées par IA · Triées par score</p>
                </div>
                <div className="flex gap-2">
                  {compareMode ? (
                    <>
                      <Btn variant="secondary" onClick={() => { setCompareMode(false); setCompareIds([]); }}>Annuler</Btn>
                      <Btn variant="amber" disabled={compareIds.length < 2} onClick={() => setStep(1)}>Comparer ({compareIds.length}) →</Btn>
                    </>
                  ) : (
                    <Btn variant="ghost" onClick={() => setCompareMode(true)}>Comparer des dossiers</Btn>
                  )}
                </div>
              </div>
              {compareMode && (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Sélectionnez 2 ou 3 candidats à comparer. {compareIds.length}/3 sélectionnés.
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {cands.map((c) => (
                  <CandidatCard key={c.id} c={c} bienLoyer={bien.loyer} onSelect={handleSelect} onDetail={setDetail} compareMode={compareMode} inCompare={compareIds.includes(c.id)} onToggleCompare={toggleCompare} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 1 — comparaison */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-slate-950">Comparaison côte à côte</h2>
                  <p className="mt-1 text-sm text-slate-500">Analysez les critères clés</p>
                </div>
                <Btn variant="secondary" onClick={() => setStep(0)}>← Retour à la liste</Btn>
              </div>
              <CompareView ids={compareIds} candidats={cands} bienLoyer={bien.loyer} onSelect={handleSelect} />
            </motion.div>
          )}

          {/* Step 2 — confirmation */}
          {step === 2 && selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg">
              <div className="mb-8 text-center">
                <div className="mb-3 text-5xl">🏆</div>
                <h2 className="font-serif text-2xl font-bold text-slate-950">Votre locataire sélectionné</h2>
                <p className="mt-2 text-sm text-slate-500">Confirmez pour lancer la rédaction du bail</p>
              </div>
              <div className="mb-4 rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-lg shadow-emerald-500/10">
                <div className="mb-5 flex items-center gap-4">
                  <Avatar name={`${selected.prenom} ${selected.nom}`} id={selected.id} size="lg" />
                  <div>
                    <div className="text-lg font-bold text-slate-950">{selected.prenom} {selected.nom}</div>
                    <div className="text-sm text-slate-500">{selected.profession} · {selected.employeur}</div>
                    <div className="mt-2 flex gap-2">
                      <ScorePill score={selected.score} />
                      <Tag type={selected.contrat === 'CDI' ? 'green' : 'amber'}>{selected.contrat}</Tag>
                    </div>
                  </div>
                </div>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {[['Revenus', `${selected.revenus.toLocaleString()} €`, 'text-emerald-700'],
                    ['Ratio', `${(selected.revenus / bien.loyer).toFixed(1)}x`, selected.revenus / bien.loyer >= 3 ? 'text-emerald-600' : 'text-amber-600'],
                    ['Ancienneté', `${selected.anciennete} an(s)`, 'text-slate-700']].map(([l, v, c]) => (
                    <div key={l} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <div className={`text-lg font-bold ${c}`}>{v}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                  ✓ {Object.values(selected.docs).filter(Boolean).length}/5 pièces vérifiées
                </div>
              </div>
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Les autres candidats seront notifiés automatiquement par e-mail.
              </div>
              <div className="flex gap-3">
                <Btn variant="secondary" onClick={() => setStep(0)} className="flex-1">← Modifier</Btn>
                <Btn variant="amber" onClick={() => setStep(3)} className="flex-[2]">Confirmer et rédiger le bail →</Btn>
              </div>
            </motion.div>
          )}

          {/* Step 3 — bail */}
          {step === 3 && selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl">
              {done ? (
                <div className="py-12 text-center">
                  <div className="mb-4 text-6xl">🎉</div>
                  <h2 className="font-serif text-2xl font-bold text-slate-950">Bail généré et envoyé !</h2>
                  <p className="mt-2 mb-8 text-sm text-slate-500">Le bail a été envoyé à {selected.prenom} pour signature électronique.</p>
                  <Btn variant="primary" onClick={() => { onBailCreated(selected, bien, bailType); onClose(); }}>Retour au tableau de bord</Btn>
                </div>
              ) : (
                <>
                  <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <Avatar name={`${selected.prenom} ${selected.nom}`} id={selected.id} size="sm" />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">{selected.prenom} {selected.nom}</div>
                      <div className="text-xs text-slate-500">{bien.label} · {bien.adresse}</div>
                    </div>
                    <ScorePill score={selected.score} />
                  </div>
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 font-semibold text-slate-900">Paramètres du bail</div>
                    <div className="mb-5 flex gap-3">
                      {[['non-meuble', 'Non meublé — 3 ans'], ['meuble', 'Meublé — 1 an']].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setBailType(v)} className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition-all ${bailType === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{l}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[["Date d'entrée", '01/05/2026'], ["Loyer (€/mois)", String(bien.loyer)], ['Charges (€/mois)', '80'], ['Dépôt de garantie (€)', String(bien.loyer)]].map(([l, v]) => (
                        <div key={l}>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-700">{l}</label>
                          <input defaultValue={v} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-3 font-semibold text-slate-900">Clauses particulières</div>
                    <textarea rows={3} placeholder="Ex : Interdiction de sous-location, animaux autorisés sous conditions…" className="w-full resize-vertical rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50" />
                  </div>
                  <div className="flex gap-3">
                    <Btn variant="secondary" className="flex-1"><FileText className="h-4 w-4" /> Prévisualiser</Btn>
                    <Btn variant="amber" onClick={() => setDone(true)} className="flex-[2]">Générer et envoyer pour signature →</Btn>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Détail candidat (modale secondaire) */}
      <AnimatePresence>
        {detail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4"
            onClick={() => setDetail(null)}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={`${detail.prenom} ${detail.nom}`} id={detail.id} />
                  <div>
                    <div className="font-bold text-slate-950">{detail.prenom} {detail.nom}</div>
                    <div className="text-xs text-slate-500">{detail.profession}</div>
                    <div className="mt-1"><ScorePill score={detail.score} /></div>
                  </div>
                </div>
                <button type="button" onClick={() => setDetail(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-4 divide-y divide-slate-100">
                {[['Employeur', detail.employeur], ['Contrat', detail.contrat], ['Ancienneté', `${detail.anciennete} an(s)`], ['Revenus', `${detail.revenus.toLocaleString()} €/mois`], ['Ratio', `${(detail.revenus / bien.loyer).toFixed(2)}x`], ['Garant', detail.garant ? 'Oui' : 'Non'], ['Animaux', detail.animaux ? 'Oui' : 'Non']].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between py-2.5 text-sm">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-semibold text-slate-900">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Documents fournis</div>
                {[['identite', "Pièce d'identité"], ['salaires', 'Bulletins de salaire'], ['imposition', "Avis d'imposition"], ['contrat_travail', 'Contrat de travail'], ['domicile', 'Justif. de domicile']].map(([k, l]) => (
                  <div key={String(k)} className={`mb-1.5 flex items-center gap-2 text-xs ${detail.docs[k] ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span>{detail.docs[k] ? '✓' : '○'}</span>{l}
                  </div>
                ))}
              </div>
              <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs italic leading-5 text-slate-600">{detail.note}</div>
              <button type="button" onClick={() => { handleSelect(detail); setDetail(null); }} className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400">
                Sélectionner {detail.prenom} →
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tunnel dépôt dossier ──────────────────────────────────────────────────────

const DEP_STEPS = ['Bien visé', 'Identité', 'Situation', 'Revenus', 'Récap'];

function DepotTunnel({ onDone }: { onDone: (data: any) => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', tel: '', profession: '', contrat: 'CDI', anciennete: '', revenus: '', bien: '1' });
  const f = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const bien = BIENS.find((b) => b.id === parseInt(form.bien));
  const score = computeScore(parseFloat(form.revenus) || 0, bien?.loyer || 0, parseFloat(form.anciennete), form.contrat);
  const ratio = bien ? (parseFloat(form.revenus) || 0) / bien.loyer : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
        <StepBar step={step} steps={DEP_STEPS} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        {step === 0 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Quel bien vous intéresse ?</h3>
            <p className="mb-5 text-sm text-slate-500">Sélectionnez le logement pour lequel vous souhaitez candidater.</p>
            <div className="mb-6 grid grid-cols-2 gap-3">
              {BIENS.map((b) => (
                <div key={b.id} onClick={() => f('bien', String(b.id))} className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${form.bien === String(b.id) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div className="font-semibold text-slate-900">{b.label}</div>
                  <div className="mt-1 mb-3 text-xs text-slate-500">{b.adresse}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Tag type="indigo">{b.loyer} €/mois</Tag><Tag>{b.surface} m²</Tag><Tag>DPE {b.dpe}</Tag>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end"><Btn variant="amber" onClick={() => setStep(1)}>Continuer <ArrowRight className="h-4 w-4" /></Btn></div>
          </>
        )}
        {step === 1 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Informations personnelles</h3>
            <p className="mb-5 text-sm text-slate-500">Ces informations permettent d&apos;identifier votre candidature.</p>
            <div className="mb-6 grid grid-cols-2 gap-4">
              {[['Nom', 'nom', 'text'], ['Prénom', 'prenom', 'text'], ['Email', 'email', 'email'], ['Téléphone', 'tel', 'tel']].map(([l, k, t]) => (
                <div key={k}>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">{l}</label>
                  <input type={t} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50" value={(form as any)[k]} onChange={(e) => f(k, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="flex justify-between"><Btn variant="secondary" onClick={() => setStep(0)}>← Retour</Btn><Btn variant="amber" onClick={() => setStep(2)}>Continuer →</Btn></div>
          </>
        )}
        {step === 2 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Situation professionnelle</h3>
            <p className="mb-5 text-sm text-slate-500">Nous évaluons la stabilité de votre emploi.</p>
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Profession</label>
                <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50" value={form.profession} onChange={(e) => f('profession', e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Type de contrat</label>
                <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400" value={form.contrat} onChange={(e) => f('contrat', e.target.value)}>
                  {['CDI', 'CDD', 'Fonctionnaire', 'Auto-entrepreneur', 'Étudiant', 'Sans emploi'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Ancienneté (années)</label>
                <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" value={form.anciennete} onChange={(e) => f('anciennete', e.target.value)} />
              </div>
            </div>
            <div className="flex justify-between"><Btn variant="secondary" onClick={() => setStep(1)}>← Retour</Btn><Btn variant="amber" onClick={() => setStep(3)}>Continuer →</Btn></div>
          </>
        )}
        {step === 3 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Ressources financières</h3>
            <p className="mb-5 text-sm text-slate-500">Le propriétaire requiert généralement 3× le loyer.</p>
            <div className="mb-4 max-w-xs">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Revenus mensuels nets (€)</label>
              <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400" value={form.revenus} onChange={(e) => f('revenus', e.target.value)} />
            </div>
            {form.revenus && bien && (
              <div className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${ratio >= 3 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                {ratio >= 3 ? '✓ Ratio suffisant' : '⚠ Ratio limite'} — {ratio.toFixed(1)}× le loyer
              </div>
            )}
            <div className="flex justify-between"><Btn variant="secondary" onClick={() => setStep(2)}>← Retour</Btn><Btn variant="amber" onClick={() => setStep(4)}>Continuer →</Btn></div>
          </>
        )}
        {step === 4 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Récapitulatif</h3>
            <p className="mb-5 text-sm text-slate-500">Vérifiez vos informations avant de soumettre.</p>
            <div className="mb-5 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50">
              {[['Bien', bien?.label || ''], ['Loyer', `${bien?.loyer || 0} €/mois`], ['Nom', `${form.prenom} ${form.nom}`], ['Contrat', form.contrat], ['Revenus', `${parseFloat(form.revenus) || 0} €`]].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-semibold text-slate-900">{v}</span>
                </div>
              ))}
            </div>
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Vos documents sont sécurisés et partagés uniquement avec le gestionnaire.</span>
            </div>
            <div className="flex justify-between">
              <Btn variant="secondary" onClick={() => setStep(3)}>← Retour</Btn>
              <Btn variant="amber" onClick={() => onDone({ ...form, score, statut: 'en_attente', date: new Date().toLocaleDateString('fr-FR'), bail: null, bien_id: parseInt(form.bien), loyer: bien?.loyer || 0, revenus: parseFloat(form.revenus) || 0, anciennete: parseFloat(form.anciennete) || 0, profession: `${form.contrat} · ${form.profession}`, docs: { identite: false, salaires: false, imposition: false, contrat_travail: false, domicile: false }, note: 'Nouveau dossier.', garant: false, animaux: false, fumeur: false, employeur: '-', age: 30 })}>
                <CheckCircle2 className="h-4 w-4" /> Soumettre mon dossier
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Navigation sidebar ────────────────────────────────────────────────────────

type NavId = 'dashboard' | 'candidatures' | 'biens' | 'depot' | 'baux' | 'gestion' | 'edl';
const NAV: { id: NavId; label: string; Icon: React.ElementType; group: string; badge?: boolean }[] = [
  { id: 'dashboard',    label: "Vue d'ensemble",    Icon: LayoutDashboard, group: 'Principal' },
  { id: 'candidatures', label: 'Candidatures',       Icon: Users,           group: 'Principal', badge: true },
  { id: 'biens',        label: 'Mes actifs',         Icon: Building2,       group: 'Principal' },
  { id: 'depot',        label: 'Nouveau dossier',    Icon: Plus,            group: 'Actions' },
  { id: 'baux',         label: 'Baux & Signatures',  Icon: FileSignature,   group: 'Actions' },
  { id: 'gestion',      label: 'Gestion locative',   Icon: ScrollText,      group: 'Actions' },
  { id: 'edl',          label: 'États des lieux',    Icon: ClipboardList,   group: 'Actions' },
];

// ── Main app ──────────────────────────────────────────────────────────────────

export default function OwnerDashboardClient() {
  const [page, setPage] = useState<NavId>('dashboard');
  const [dossiers, setDossiers] = useState<Dossier[]>(DOSSIERS_INIT);
  const [loyers, setLoyers] = useState(LOYERS_INIT);
  const [edl, setEdl] = useState(EDL_INIT);
  const [selBienId, setSelBienId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const go = (p: NavId) => { setPage(p); setDetailId(null); };
  const addDossier = (data: any) => {
    setDossiers((p) => [...p, { ...data, id: p.length + 1 }]);
    go('candidatures');
  };
  const onBailCreated = (candidat: Dossier, bien: typeof BIENS[0], type: string) => {
    setDossiers((p) => p.map((d) => d.id === candidat.id ? { ...d, statut: 'selectionne', bail: { type, signe: true, date: new Date().toLocaleDateString('fr-FR') } } : d));
    setLoyers((p) => [...p, { id: p.length + 1, locataire: `${candidat.prenom} ${candidat.nom}`, bien: `${bien.label} — ${bien.adresse.split(',')[1]?.trim() || ''}`, loyer: bien.loyer, mois: 'Avril 2026', statut: 'attente', date: '—' }]);
  };

  const encaisse = loyers.filter((l) => l.statut === 'paye').reduce((a, b) => a + b.loyer, 0);
  const acceptes = dossiers.filter((d) => d.statut === 'selectionne').length;
  const signes   = dossiers.filter((d) => d.bail?.signe).length;
  const pending  = dossiers.filter((d) => d.statut === 'en_attente').length;
  const detailDossier = dossiers.find((d) => d.id === detailId);

  // ── Table helper ────────────────────────────────────────────
  function Th({ children }: { children?: React.ReactNode }) {
    return <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</th>;
  }
  function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <td className={`border-t border-slate-100 px-5 py-4 text-sm ${className}`}>{children}</td>;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 font-sans">

      {/* ── SIDEBAR ───────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-slate-200 bg-white/90 backdrop-blur-xl">
        {/* Logo */}
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-lg">
              🛡️
            </div>
            <div>
              <div className="font-serif text-base font-bold tracking-tight text-slate-950">PatrimoTrust™</div>
              <div className="mt-0.5 inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Propriétaire</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {[...new Set(NAV.map((n) => n.group))].map((grp) => (
            <div key={grp} className="mb-4">
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{grp}</div>
              {NAV.filter((n) => n.group === grp).map(({ id, label, Icon, badge }) => {
                const active = page === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => go(id)}
                    className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                      active
                        ? 'bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-200'
                        : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    {badge && pending > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{pending}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-800 to-emerald-600 text-xs font-bold text-white">P</div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Propriétaire</div>
              <div className="text-[11px] text-slate-500">Espace sécurisé</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────── */}
      <main className="ml-60 flex-1 px-8 py-8">

        {/* ─ DASHBOARD ─ */}
        {page === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold text-slate-950">Bonjour 👋</h1>
                <p className="mt-1 text-sm text-slate-500">Tableau de bord · Mars 2026</p>
              </div>
              <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Nouveau dossier</Btn>
            </div>

            <div className="mb-6 grid grid-cols-4 gap-4">
              <StatCard icon="📋" value={dossiers.length}                         label="Dossiers reçus"          bg="bg-emerald-50" />
              <StatCard icon="✓"  value={acceptes}                                label="Locataires sélectionnés" bg="bg-teal-50" />
              <StatCard icon="◎"  value={signes}                                  label="Baux signés"             bg="bg-blue-50" />
              <StatCard icon="💳" value={`${encaisse.toLocaleString()} €`}        label="Encaissé ce mois"        bg="bg-amber-50" />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 font-semibold text-slate-900">Dernières candidatures</div>
                <div className="divide-y divide-slate-100">
                  {dossiers.slice(-4).reverse().map((d) => (
                    <button key={d.id} type="button" onClick={() => { setDetailId(d.id); go('candidatures'); }}
                      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-slate-50 -mx-1 px-1 rounded-xl"
                    >
                      <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{d.prenom} {d.nom}</div>
                        <div className="text-xs text-slate-500">{BIENS.find((b) => b.id === d.bien_id)?.label}</div>
                      </div>
                      <ScorePill score={d.score} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 font-semibold text-slate-900">Loyers · Mars 2026</div>
                <div className="divide-y divide-slate-100">
                  {loyers.filter((l) => l.mois === 'Mars 2026').map((l) => (
                    <div key={l.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={l.locataire} id={1} size="sm" />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{l.locataire}</div>
                          <div className="text-xs text-slate-500">{l.loyer} €/mois</div>
                        </div>
                      </div>
                      <Tag type={l.statut === 'paye' ? 'green' : 'amber'}>{l.statut === 'paye' ? 'Payé' : 'En attente'}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─ CANDIDATURES ─ */}
        {page === 'candidatures' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold text-slate-950">Candidatures</h1>
                <p className="mt-1 text-sm text-slate-500">{dossiers.length} dossiers · Analyse IA activée</p>
              </div>
              <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Nouveau dossier</Btn>
            </div>

            <div className="space-y-5">
              {BIENS.map((bien) => {
                const cands = dossiers.filter((d) => d.bien_id === bien.id);
                if (!cands.length) return null;
                const hasSel = cands.some((d) => d.statut === 'selectionne');
                return (
                  <div key={bien.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl">🏠</div>
                        <div>
                          <div className="font-semibold text-slate-900">{bien.label} — {bien.adresse}</div>
                          <div className="text-xs text-slate-500">{bien.loyer} €/mois · {cands.length} candidature(s)</div>
                        </div>
                      </div>
                      {hasSel ? <Tag type="green">✓ Locataire sélectionné</Tag> : (
                        <Btn variant="amber" onClick={() => setSelBienId(bien.id)}>Sélectionner un locataire <ArrowRight className="h-4 w-4" /></Btn>
                      )}
                    </div>
                    <table className="w-full border-collapse">
                      <thead className="bg-slate-50">
                        <tr>
                          <Th>Candidat</Th><Th>Revenus</Th><Th>Score IA</Th><Th>Statut</Th><Th>Bail</Th><Th></Th>
                        </tr>
                      </thead>
                      <tbody>
                        {cands.sort((a, b) => b.score - a.score).map((d) => (
                          <>
                            <tr key={d.id} onClick={() => setDetailId(detailId === d.id ? null : d.id)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                              <Td>
                                <div className="flex items-center gap-3">
                                  <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                                  <div>
                                    <div className="font-semibold text-slate-900">{d.prenom} {d.nom}</div>
                                    <div className="text-xs text-slate-400">{d.date}</div>
                                  </div>
                                </div>
                              </Td>
                              <Td><b className="text-slate-900">{d.revenus.toLocaleString()} €</b></Td>
                              <Td><ScorePill score={d.score} /></Td>
                              <Td><Tag type={d.statut === 'selectionne' ? 'green' : d.statut === 'en_attente' ? 'indigo' : 'red'}>{d.statut === 'selectionne' ? 'Sélectionné' : d.statut === 'en_attente' ? 'En attente' : 'Refusé'}</Tag></Td>
                              <Td>{!d.bail ? <Tag>Non généré</Tag> : d.bail.signe ? <Tag type="green">Signé</Tag> : <Tag type="amber">En attente</Tag>}</Td>
                              <Td><Btn variant="ghost" className="py-1.5 text-xs">Détail</Btn></Td>
                            </tr>
                            {detailDossier?.id === d.id && (
                              <tr key={`detail-${d.id}`}>
                                <td colSpan={6} className="border-t border-slate-100 bg-slate-50 px-5 py-5">
                                  <div className="grid gap-5 xl:grid-cols-2">
                                    <div>
                                      <div className="mb-3 font-semibold text-slate-900">Analyse IA — {detailDossier.prenom} {detailDossier.nom}</div>
                                      {[['Solvabilité', Math.min((detailDossier.revenus / detailDossier.loyer / 3) * 100, 100), detailDossier.revenus / detailDossier.loyer >= 3 ? 'bg-emerald-500' : 'bg-amber-500'], ['Stabilité', detailDossier.contrat === 'CDI' ? 100 : 50, detailDossier.contrat === 'CDI' ? 'bg-emerald-500' : 'bg-amber-500'], ['Ancienneté', Math.min((detailDossier.anciennete / 5) * 100, 100), detailDossier.anciennete >= 3 ? 'bg-emerald-500' : 'bg-amber-500']].map(([l, v, c]) => (
                                        <div key={String(l)} className="mb-3">
                                          <div className="mb-1 flex justify-between text-xs font-semibold">
                                            <span className="text-slate-500">{l}</span>
                                            <span className="text-slate-700">{Math.round(Number(v))}%</span>
                                          </div>
                                          <Bar value={Number(v)} color={String(c)} />
                                        </div>
                                      ))}
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                      {[['Profession', detailDossier.profession], ['Employeur', detailDossier.employeur || '—'], ['Revenus', `${detailDossier.revenus.toLocaleString()} €`], ['Ratio', `${(detailDossier.revenus / detailDossier.loyer).toFixed(1)}×`]].map(([k, v]) => (
                                        <div key={String(k)} className="flex justify-between py-2 text-sm">
                                          <span className="text-slate-500">{k}</span>
                                          <span className="font-semibold text-slate-900">{v}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ─ MES ACTIFS ─ */}
        {page === 'biens' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-3xl font-bold text-slate-950">Mes actifs</h1>
              <p className="mt-1 text-sm text-slate-500">{BIENS.length} biens en portefeuille</p>
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              {BIENS.map((b) => {
                const loc = dossiers.find((d) => d.bien_id === b.id && d.bail?.signe);
                const nb = dossiers.filter((d) => d.bien_id === b.id).length;
                return (
                  <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-xl">🏠</div>
                      <Tag type={loc ? 'green' : 'indigo'}>{loc ? 'Loué' : 'Disponible'}</Tag>
                    </div>
                    <div className="font-bold text-slate-950">{b.label}</div>
                    <div className="mt-0.5 mb-4 text-sm text-slate-500">{b.adresse}</div>
                    <div className="mb-4 text-[1.75rem] font-bold text-emerald-700">
                      {b.loyer.toLocaleString()} <span className="text-sm font-normal text-slate-400">€/mois</span>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      <Tag>{b.surface} m²</Tag><Tag>DPE {b.dpe}</Tag><Tag>{b.pieces} pièce{b.pieces > 1 ? 's' : ''}</Tag>
                    </div>
                    {loc && <div className="mb-3 text-sm"><span className="text-slate-500">Locataire · </span><b>{loc.prenom} {loc.nom}</b></div>}
                    <div className="text-xs text-slate-400">
                      {nb} candidature(s) ·{' '}
                      <button type="button" onClick={() => setSelBienId(b.id)} className="font-semibold text-emerald-600 hover:underline">Voir les dossiers →</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ─ NOUVEAU DOSSIER ─ */}
        {page === 'depot' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <h1 className="font-serif text-3xl font-bold text-slate-950">Nouveau dossier</h1>
              <p className="mt-1 text-sm text-slate-500">Soumission et analyse automatique</p>
            </div>
            <DepotTunnel onDone={addDossier} />
          </motion.div>
        )}

        {/* ─ BAUX ─ */}
        {page === 'baux' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-3xl font-bold text-slate-950">Baux &amp; Signatures</h1>
              <p className="mt-1 text-sm text-slate-500">Suivi des contrats générés</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr><Th>Locataire</Th><Th>Bien</Th><Th>Type</Th><Th>Loyer</Th><Th>Statut</Th><Th>Date</Th><Th>Actions</Th></tr>
                </thead>
                <tbody>
                  {dossiers.filter((d) => d.bail).map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <Td><div className="flex items-center gap-3"><Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" /><b>{d.prenom} {d.nom}</b></div></Td>
                      <Td><span className="text-slate-500">{BIENS.find((b) => b.id === d.bien_id)?.label}</span></Td>
                      <Td>{d.bail?.type === 'meuble' ? 'Meublé — 1 an' : 'Non meublé — 3 ans'}</Td>
                      <Td><b className="text-emerald-700">{d.loyer} €</b></Td>
                      <Td>{d.bail?.signe ? <Tag type="green">Signé</Tag> : <Tag type="amber">En attente</Tag>}</Td>
                      <Td className="text-slate-500">{d.bail?.date || '—'}</Td>
                      <Td>{d.bail?.signe ? <Btn variant="ghost" className="py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Télécharger</Btn> : <Btn variant="primary" className="py-1.5 text-xs"><PenLine className="h-3.5 w-3.5" /> Signer</Btn>}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!dossiers.filter((d) => d.bail).length && (
                <p className="py-12 text-center text-sm text-slate-400">Aucun bail généré pour le moment.</p>
              )}
            </div>
          </motion.div>
        )}

        {/* ─ GESTION LOCATIVE ─ */}
        {page === 'gestion' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-3xl font-bold text-slate-950">Gestion locative</h1>
              <p className="mt-1 text-sm text-slate-500">Loyers · Quittances · Encaissements</p>
            </div>
            <div className="mb-6 grid grid-cols-4 gap-4">
              <StatCard icon="✓"  value={`${encaisse.toLocaleString()} €`}                                              label="Encaissé"          bg="bg-emerald-50" />
              <StatCard icon="⏳" value={`${loyers.filter((l) => l.statut === 'attente').reduce((a, b) => a + b.loyer, 0)} €`} label="En attente"        bg="bg-amber-50" />
              <StatCard icon="📄" value={loyers.filter((l) => l.statut === 'paye').length}                               label="Quittances"         bg="bg-blue-50" />
              <StatCard icon="🏠" value={dossiers.filter((d) => d.bail?.signe).length}                                   label="Locataires actifs"  bg="bg-teal-50" />
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900">Historique des loyers</div>
              <table className="w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr><Th>Locataire</Th><Th>Bien</Th><Th>Période</Th><Th>Montant</Th><Th>Statut</Th><Th>Date</Th><Th>Actions</Th></tr>
                </thead>
                <tbody>
                  {loyers.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <Td><div className="flex items-center gap-3"><Avatar name={l.locataire} id={l.id} size="sm" /><b>{l.locataire}</b></div></Td>
                      <Td><span className="text-slate-500">{l.bien}</span></Td>
                      <Td>{l.mois}</Td>
                      <Td><b className="text-emerald-700">{l.loyer} €</b></Td>
                      <Td><Tag type={l.statut === 'paye' ? 'green' : 'amber'}>{l.statut === 'paye' ? 'Payé' : 'En attente'}</Tag></Td>
                      <Td className="text-slate-500">{l.date}</Td>
                      <Td>
                        {l.statut === 'paye'
                          ? <Btn variant="ghost" className="py-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Quittance</Btn>
                          : <Btn variant="success" className="py-1.5 text-xs" onClick={() => setLoyers((p) => p.map((x) => x.id === l.id ? { ...x, statut: 'paye', date: new Date().toLocaleDateString('fr-FR') } : x))}><CheckCircle2 className="h-3.5 w-3.5" /> Marquer payé</Btn>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ─ ÉTATS DES LIEUX ─ */}
        {page === 'edl' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold text-slate-950">États des lieux</h1>
                <p className="mt-1 text-sm text-slate-500">Entrées &amp; sorties · Signature numérique</p>
              </div>
              <Btn variant="amber" onClick={() => setEdl((p) => [...p, { id: p.length + 1, locataire: 'Nouveau locataire', bien: 'À définir', type: 'Entrée', date: new Date().toLocaleDateString('fr-FR'), statut: 'planifie' }])}>
                <Plus className="h-4 w-4" /> Planifier un EDL
              </Btn>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr><Th>Locataire</Th><Th>Bien</Th><Th>Type</Th><Th>Date</Th><Th>Statut</Th><Th>Actions</Th></tr>
                </thead>
                <tbody>
                  {edl.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <Td><div className="flex items-center gap-3"><Avatar name={e.locataire} id={e.id} size="sm" /><b>{e.locataire}</b></div></Td>
                      <Td><span className="text-slate-500">{e.bien}</span></Td>
                      <Td><Tag type={e.type === 'Entrée' ? 'indigo' : 'amber'}>{e.type}</Tag></Td>
                      <Td>{e.date}</Td>
                      <Td><Tag type={e.statut === 'signe' ? 'green' : 'amber'}>{e.statut === 'signe' ? 'Signé' : 'Planifié'}</Tag></Td>
                      <Td>
                        {e.statut !== 'signe'
                          ? <Btn variant="primary" className="py-1.5 text-xs" onClick={() => setEdl((p) => p.map((x) => x.id === e.id ? { ...x, statut: 'signe' } : x))}><PenLine className="h-3.5 w-3.5" /> Valider &amp; Signer</Btn>
                          : <Btn variant="ghost" className="py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Télécharger</Btn>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </main>

      {/* ── TUNNEL SÉLECTION (overlay) ─────────────────────────── */}
      <AnimatePresence>
        {selBienId && (
          <motion.div key="tunnel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TunnelSelection
              bienId={selBienId}
              dossiers={dossiers}
              onClose={() => setSelBienId(null)}
              onBailCreated={(c, b, t) => { onBailCreated(c, b, t); setSelBienId(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
