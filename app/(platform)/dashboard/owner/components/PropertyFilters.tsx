'use client';

import { Search, LayoutGrid, List, ChevronDown } from 'lucide-react';

export type PropertyStatusFilter = 'all' | 'OCCUPIED' | 'VACANT' | 'AVAILABLE' | 'CANDIDATE_SELECTION' | 'LEASE_IN_PROGRESS';
export type PropertySort = 'recent' | 'rent-asc' | 'rent-desc' | 'occupancy';
export type PropertyView = 'grid' | 'list';

const STATUS_OPTIONS: { value: PropertyStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'OCCUPIED', label: 'Occupé' },
  { value: 'VACANT', label: 'Vacant' },
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'CANDIDATE_SELECTION', label: 'Sélection / bail' },
  { value: 'LEASE_IN_PROGRESS', label: 'Bail en cours' },
];

const SORT_OPTIONS: { value: PropertySort; label: string }[] = [
  { value: 'recent', label: 'Plus récent' },
  { value: 'rent-asc', label: 'Loyer croissant' },
  { value: 'rent-desc', label: 'Loyer décroissant' },
];

export function PropertyFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: PropertyStatusFilter;
  onStatusChange: (v: PropertyStatusFilter) => void;
  sort: PropertySort;
  onSortChange: (v: PropertySort) => void;
  view: PropertyView;
  onViewChange: (v: PropertyView) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher un bien..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100 transition"
        />
      </div>

      {/* Status filter */}
      <div className="relative">
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as PropertyStatusFilter)}
          className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100 transition cursor-pointer"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Sort */}
      <div className="relative">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as PropertySort)}
          className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100 transition cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => onViewChange('grid')}
          className={`rounded-lg p-2.5 transition-colors ${view === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
          aria-label="Vue grille"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange('list')}
          className={`rounded-lg p-2.5 transition-colors ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
          aria-label="Vue liste"
        >
          <List className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
