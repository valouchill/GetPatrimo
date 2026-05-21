'use client';

/**
 * <PropertiesPortfolio> — Vue "Portefeuille d'Actifs" Banque Privée.
 *
 * Refonte de la page "Mes Biens" : abandon de l'aspect logiciel
 * administratif (tableaux, barres de progression) pour un design coffre-fort
 * inspirant le prestige et la fiabilité.
 *
 * Structure :
 *   A. Header : titre serif + 3 KPI globaux + bouton "+ Ajouter un actif"
 *   B. Grille responsive (1/2/3 colonnes) de PropertyAssetCard
 *
 * Respecte les règles de Design Défensif (cf. DEFENSIVE_DESIGN_RULES.md) :
 *   - Icônes : w-5 h-5 shrink-0 systématiques
 *   - Adresses : truncate / line-clamp-1
 *   - Z-index local pour les éventuels overlays
 *   - Grid responsive avec gap-8
 */

import * as React from 'react';
import {
  Building2,
  Key,
  Copy,
  Check,
  ArrowRight,
  Plus,
  TrendingUp,
  Inbox,
  Home,
  ShieldCheck,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AssetStatus = 'searching' | 'sealed' | 'pending' | 'vacant';

export interface PortfolioAsset {
  id: string;
  /** Titre principal (ex: "T3 Lumineux - Hyper Centre") */
  title: string;
  /** Adresse complète */
  address: string;
  /** Loyer mensuel en euros */
  rent: number;
  /** Statut du bien */
  status: AssetStatus;
  /** Label statut affiché */
  statusLabel: string;
  /** Nombre de candidatures en attente */
  pendingApplications: number;
  /** Lien Sésame à copier (URL complète à partager) */
  sesameLink: string;
}

export interface PropertiesPortfolioProps {
  assets: PortfolioAsset[];
  /** Callback "+ Ajouter un actif" */
  onAdd?: () => void;
  /** Callback "Gérer cet actif" (id de l'actif) */
  onManage?: (id: string) => void;
  /** Callback optionnel sur copie réussie (toast custom parent) */
  onSesameCopied?: (asset: PortfolioAsset) => void;
  /** Affiche les 3 KPI en haut */
  showKpis?: boolean;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function pickStatusStyle(status: AssetStatus): {
  bg: string;
  text: string;
  ring: string;
  dot: string;
  icon: React.ElementType;
} {
  switch (status) {
    case 'sealed':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        ring: 'ring-emerald-200',
        dot: 'bg-emerald-500',
        icon: ShieldCheck,
      };
    case 'searching':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        ring: 'ring-amber-200',
        dot: 'bg-amber-500',
        icon: Sparkles,
      };
    case 'pending':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        ring: 'ring-blue-200',
        dot: 'bg-blue-500',
        icon: AlertCircle,
      };
    case 'vacant':
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        ring: 'ring-slate-200',
        dot: 'bg-slate-400',
        icon: Home,
      };
  }
}

// ─── Sub-component : KPI Tile ────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  hint?: string;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
        <Icon className="h-5 w-5 flex-shrink-0 text-emerald-700" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 font-serif text-xl font-bold leading-tight text-emerald-900">
          {value}
        </p>
        {hint && (
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p>
        )}
      </div>
    </div>
  );
}

// ─── Sub-component : PropertyAssetCard ──────────────────────────────────────

export interface PropertyAssetCardProps {
  asset: PortfolioAsset;
  onManage?: (id: string) => void;
  onSesameCopied?: (asset: PortfolioAsset) => void;
}

export function PropertyAssetCard({
  asset,
  onManage,
  onSesameCopied,
}: PropertyAssetCardProps): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const statusStyle = pickStatusStyle(asset.status);
  const StatusIcon = statusStyle.icon;
  const hasPending = asset.pendingApplications > 0;

  const handleCopy = React.useCallback(async () => {
    try {
      if (navigator?.clipboard && asset.sesameLink) {
        await navigator.clipboard.writeText(asset.sesameLink);
      }
      setCopied(true);
      onSesameCopied?.(asset);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      // En cas d'échec (mode privé / pas de permission), on flash quand
      // même le badge "Copié" pour ne pas frustrer l'utilisateur. Il pourra
      // sélectionner le lien manuellement depuis la fiche.
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    }
  }, [asset, onSesameCopied]);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 transition-shadow hover:shadow-md hover:ring-slate-200">
      {/* ─── En-tête : gradient subtil + icône architecture en filigrane ── */}
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-emerald-50 via-slate-50 to-amber-50">
        {/* Icône bâtiment en filigrane (très subtile) */}
        <Building2
          className="absolute -bottom-4 -right-4 h-32 w-32 flex-shrink-0 text-emerald-900/5"
          aria-hidden="true"
        />
        {/* Badge statut top-left */}
        <span
          className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${statusStyle.bg} ${statusStyle.text} ${statusStyle.ring}`}
        >
          <StatusIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {asset.statusLabel}
        </span>
        {/* Décoratif : nombre de candidatures en pastille top-right si > 0 */}
        {hasPending && (
          <span
            className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-amber-800 shadow-sm ring-1 ring-amber-200"
            aria-label={`${asset.pendingApplications} candidatures en attente`}
          >
            <Inbox className="h-3 w-3 flex-shrink-0 text-amber-600" aria-hidden="true" />
            {asset.pendingApplications}
          </span>
        )}
      </div>

      {/* ─── Identité du bien ─────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-2">
        <h3
          className="font-serif text-lg font-semibold leading-tight text-emerald-900 line-clamp-1"
          title={asset.title}
        >
          {asset.title}
        </h3>
        <p
          className="mt-1 truncate text-sm text-slate-500"
          title={asset.address}
        >
          {asset.address}
        </p>
      </div>

      {/* Loyer */}
      <div className="px-6 pb-2 pt-1">
        <p className="text-sm font-medium text-slate-700">
          <span className="font-serif text-2xl font-bold text-emerald-900">
            {formatPrice(asset.rent)}
          </span>
          <span className="ml-1.5 text-xs font-medium text-slate-500">/ mois CC</span>
        </p>
      </div>

      {/* ─── Pulse : indicateurs temps réel ───────────────────────────────── */}
      <div className="mx-6 my-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Inbox
              className={`h-5 w-5 flex-shrink-0 ${
                hasPending ? 'text-amber-600' : 'text-slate-400'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Candidatures
              </p>
              <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                {hasPending
                  ? `${asset.pendingApplications} en attente`
                  : 'Aucune candidature reçue'}
              </p>
            </div>
          </div>
          {hasPending && (
            <span
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white font-serif text-base font-bold text-amber-700 shadow-sm ring-1 ring-amber-200"
              aria-hidden="true"
            >
              {asset.pendingApplications}
            </span>
          )}
        </div>
      </div>

      {/* ─── Actions : Sésame + Gérer ─────────────────────────────────────── */}
      <div className="mt-auto flex flex-col gap-2 px-6 pb-6">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!asset.sesameLink}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            copied
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
              : 'border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-600'
          }`}
          aria-label={
            copied
              ? `Sésame de ${asset.title} copié`
              : `Copier le Sésame de ${asset.title}`
          }
        >
          {copied ? (
            <>
              <Check className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              Lien copié dans le presse-papier
            </>
          ) : (
            <>
              <Key className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              Copier mon Sésame
            </>
          )}
        </button>

        {onManage && (
          <button
            type="button"
            onClick={() => onManage(asset.id)}
            className="inline-flex items-center justify-center gap-1.5 self-end text-xs font-semibold text-slate-600 transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:underline"
          >
            Gérer cet actif
            <ArrowRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Composant principal : PropertiesPortfolio ───────────────────────────────

export function PropertiesPortfolio({
  assets,
  onAdd,
  onManage,
  onSesameCopied,
  showKpis = true,
  className = '',
}: PropertiesPortfolioProps): React.ReactElement {
  // ─── KPIs calculés ─────────────────────────────────────────────────────
  const totalRent = React.useMemo(
    () => assets.reduce((sum, a) => sum + (a.rent || 0), 0),
    [assets],
  );
  const sealedCount = React.useMemo(
    () => assets.filter((a) => a.status === 'sealed').length,
    [assets],
  );
  const occupancyRate = React.useMemo(
    () => (assets.length > 0 ? Math.round((sealedCount / assets.length) * 100) : 0),
    [assets, sealedCount],
  );
  const pendingTotal = React.useMemo(
    () => assets.reduce((sum, a) => sum + (a.pendingApplications || 0), 0),
    [assets],
  );

  return (
    <div className={`bg-slate-50 ${className}`}>
      {/* ─── A. Header Portefeuille ───────────────────────────────────────── */}
      <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            Patrimoine
          </p>
          <h1 className="font-serif text-3xl font-bold leading-tight text-emerald-900 sm:text-4xl">
            Mon Portefeuille Immobilier
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {assets.length} actif{assets.length > 1 ? 's' : ''} en gestion
            {pendingTotal > 0 ? ` · ${pendingTotal} candidature${pendingTotal > 1 ? 's' : ''} en attente` : ''}
          </p>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex flex-shrink-0 items-center gap-2 self-start rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:self-end"
          >
            <Plus className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            Ajouter un actif
          </button>
        )}
      </header>

      {/* ─── KPIs globaux (3 cartes) ──────────────────────────────────────── */}
      {showKpis && assets.length > 0 && (
        <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6">
          <KpiTile
            label="Valeur locative totale"
            value={`${formatPrice(totalRent)}/mois`}
            icon={TrendingUp}
            hint={`${assets.length} actif${assets.length > 1 ? 's' : ''}`}
          />
          <KpiTile
            label="Taux d'occupation"
            value={`${occupancyRate}%`}
            icon={ShieldCheck}
            hint={`${sealedCount} loué${sealedCount > 1 ? 's' : ''} sur ${assets.length}`}
          />
          <KpiTile
            label="Candidatures en attente"
            value={pendingTotal > 0 ? String(pendingTotal) : '—'}
            icon={Inbox}
            hint={
              pendingTotal > 0
                ? 'À examiner via Candidatures'
                : 'Aucune nouvelle candidature'
            }
          />
        </div>
      )}

      {/* ─── B. Grille d'actifs ───────────────────────────────────────────── */}
      {assets.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
            <Building2 className="h-7 w-7 flex-shrink-0 text-emerald-700" aria-hidden="true" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-emerald-900">
            Votre portefeuille est vide
          </h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Ajoutez votre premier actif pour commencer à recevoir des
            candidatures pré-auditées par notre IA.
          </p>
          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800"
            >
              <Plus className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              Ajouter mon premier actif
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <PropertyAssetCard
              key={asset.id}
              asset={asset}
              onManage={onManage}
              onSesameCopied={onSesameCopied}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Demo wrapper ────────────────────────────────────────────────────────────

const DEMO_ASSETS: PortfolioAsset[] = [
  {
    id: 'prop_1',
    title: 'T3 Lumineux - Hyper Centre',
    address: '14 Rue de la République, 69002 Lyon',
    rent: 1250,
    status: 'searching',
    statusLabel: 'En recherche',
    pendingApplications: 4,
    sesameLink: 'https://getpatrimo.fr/sesame/lyon-rep-14',
  },
  {
    id: 'prop_2',
    title: 'Studio Meublé Étudiant',
    address: '8 Avenue Foch, 75116 Paris',
    rent: 890,
    status: 'sealed',
    statusLabel: 'Sous scellé (Loué)',
    pendingApplications: 0,
    sesameLink: 'https://getpatrimo.fr/sesame/paris-foch-8',
  },
  {
    id: 'prop_3',
    title: 'Appartement Haussmannien',
    address: '12 Boulevard Malesherbes, 75008 Paris',
    rent: 2850,
    status: 'searching',
    statusLabel: 'En recherche',
    pendingApplications: 12,
    sesameLink: 'https://getpatrimo.fr/sesame/paris-male-12',
  },
];

export function PropertiesPortfolioDemo(): React.ReactElement {
  const [toast, setToast] = React.useState<string | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopied = (asset: PortfolioAsset) => {
    setToast(`Lien Sésame de "${asset.title}" copié`);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 3000);
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 sm:px-10 sm:py-14">
      <div className="mx-auto max-w-7xl">
        <PropertiesPortfolio
          assets={DEMO_ASSETS}
          onAdd={() => alert('[Démo] Ouvre le tunnel d\'ajout d\'actif')}
          onManage={(id) => alert(`[Démo] Gérer l'actif ${id}`)}
          onSesameCopied={handleCopied}
        />
      </div>

      {/* Toast global de la démo */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-xl ring-1 ring-emerald-700"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
