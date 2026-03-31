'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, FileSignature, FileText, PenLine, Plus, RefreshCw, UserX, X } from 'lucide-react';
import { Btn, Tag, Avatar, StatCard } from './ui';
import type { TagType } from './ui';

interface LeaseRecord {
  _id: string;
  tenantFirstName: string;
  tenantLastName: string;
  tenantEmail: string;
  property?: { _id: string; name?: string; address?: string };
  startDate?: string;
  endDate?: string;
  rentAmount: number;
  chargesAmount: number;
  depositAmount: number;
  leaseType: string;
  leaseStatus: string;
  signatureStatus: string;
  opensignStatus?: string;
  durationMonths: number;
  irlRevision?: { enabled: boolean };
  termination?: { initiatedBy?: string; estimatedExitDate?: string };
}

const STATUS_CONFIG: Record<string, { label: string; tag: TagType; icon: React.ElementType }> = {
  DRAFT: { label: 'Brouillon', tag: 'slate', icon: PenLine },
  PENDING_SIGNATURE: { label: 'En signature', tag: 'amber', icon: FileSignature },
  ACTIVE: { label: 'Actif', tag: 'green', icon: CheckCircle2 },
  EXPIRING: { label: 'Expire bientôt', tag: 'red', icon: AlertTriangle },
  EXPIRED: { label: 'Expiré', tag: 'red', icon: Clock },
  TERMINATED: { label: 'Résilié', tag: 'slate', icon: UserX },
};

const LEASE_TYPE_LABEL: Record<string, string> = {
  VIDE: 'Nu', MEUBLE: 'Meublé', MOBILITE: 'Mobilité', GARAGE_PARKING: 'Garage',
};

function deriveStatus(lease: LeaseRecord): string {
  if (lease.leaseStatus && lease.leaseStatus !== 'DRAFT') return lease.leaseStatus;
  // Derive from signature & dates
  if (lease.signatureStatus === 'SIGNED_BOTH' || lease.opensignStatus === 'SIGNED') {
    if (lease.endDate) {
      const end = new Date(lease.endDate);
      const now = new Date();
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (86400000));
      if (daysLeft < 0) return 'EXPIRED';
      if (daysLeft < 90) return 'EXPIRING';
    }
    return 'ACTIVE';
  }
  if (lease.signatureStatus === 'PENDING' || lease.opensignStatus === 'PENDING') return 'PENDING_SIGNATURE';
  return 'DRAFT';
}

function daysUntilEnd(endDate?: string): number | null {
  if (!endDate) return null;
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
}

export function BauxPanel({
  onNavigate,
}: {
  onNavigate: (target: string, id?: string) => void;
}) {
  const [leases, setLeases] = useState<LeaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [terminateId, setTerminateId] = useState<string | null>(null);

  const fetchLeases = useCallback(async () => {
    try {
      const res = await fetch('/api/leases');
      if (res.ok) {
        const json = await res.json();
        setLeases(json.data || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLeases(); }, [fetchLeases]);

  const handleRenew = async (leaseId: string) => {
    setRenewingId(leaseId);
    try {
      const res = await fetch(`/api/leases/${leaseId}/renew`, { method: 'POST' });
      if (res.ok) {
        await fetchLeases();
      }
    } catch { /* silent */ }
    finally { setRenewingId(null); }
  };

  const handleTerminate = async (leaseId: string, initiatedBy: string) => {
    try {
      await fetch(`/api/leases/${leaseId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initiatedBy }),
      });
      setTerminateId(null);
      await fetchLeases();
    } catch { /* silent */ }
  };

  // Compute KPIs
  const active = leases.filter((l) => deriveStatus(l) === 'ACTIVE').length;
  const expiring = leases.filter((l) => deriveStatus(l) === 'EXPIRING').length;
  const pendingSig = leases.filter((l) => deriveStatus(l) === 'PENDING_SIGNATURE').length;
  const totalRent = leases
    .filter((l) => ['ACTIVE', 'EXPIRING'].includes(deriveStatus(l)))
    .reduce((s, l) => s + l.rentAmount, 0);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">Chargement des baux...</div>
    );
  }

  return (
    <div>
      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} value={active} label="Baux actifs" bg="bg-emerald-50" />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} value={expiring} label="Expirent bientôt" bg="bg-red-50" />
        <StatCard icon={<FileSignature className="h-5 w-5 text-amber-500" />} value={pendingSig} label="En signature" bg="bg-amber-50" />
        <StatCard icon={<CalendarDays className="h-5 w-5 text-violet-500" />} value={`${totalRent.toLocaleString('fr-FR')} €`} label="Loyers actifs" bg="bg-violet-50" />
      </div>

      {leases.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-6 w-6 text-slate-400" />
          </div>
          <p className="mb-2 text-slate-500">Aucun bail enregistré.</p>
          <p className="text-xs text-slate-400">Sélectionnez un locataire depuis vos candidatures pour créer un bail.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <Th>Locataire</Th>
                  <Th>Bien</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Loyer</Th>
                  <Th>Début</Th>
                  <Th>Fin</Th>
                  <Th>Statut</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {leases.map((lease) => {
                  const status = deriveStatus(lease);
                  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
                  const days = daysUntilEnd(lease.endDate);
                  const Icon = config.icon;

                  return (
                    <tr key={lease._id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={`${lease.tenantFirstName} ${lease.tenantLastName}`} id={lease._id} size="sm" />
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{lease.tenantFirstName} {lease.tenantLastName}</div>
                            <div className="text-xs text-slate-500">{lease.tenantEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">
                        {lease.property?.name || lease.property?.address?.split(',')[0] || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {LEASE_TYPE_LABEL[lease.leaseType] || lease.leaseType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-semibold text-slate-900">{lease.rentAmount.toLocaleString('fr-FR')} €</span>
                        {lease.chargesAmount > 0 && (
                          <span className="text-xs text-slate-400 ml-1">+ {lease.chargesAmount} €</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">
                        {lease.startDate ? new Date(lease.startDate).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-sm text-slate-600">
                          {lease.endDate ? new Date(lease.endDate).toLocaleDateString('fr-FR') : '—'}
                        </div>
                        {days !== null && days > 0 && days < 90 && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs font-semibold text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            {days}j restants
                          </div>
                        )}
                        {days !== null && days <= 0 && (
                          <div className="text-xs font-semibold text-red-600 mt-0.5">Expiré</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                          status === 'EXPIRING' ? 'border-red-200 bg-red-50 text-red-700' :
                          status === 'PENDING_SIGNATURE' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                          status === 'EXPIRED' ? 'border-red-200 bg-red-50 text-red-600' :
                          status === 'TERMINATED' ? 'border-slate-200 bg-slate-50 text-slate-500' :
                          'border-slate-200 bg-slate-50 text-slate-600'
                        }`}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {(status === 'EXPIRING' || status === 'EXPIRED') && (
                            <button
                              type="button"
                              onClick={() => handleRenew(lease._id)}
                              disabled={renewingId === lease._id}
                              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`h-3 w-3 ${renewingId === lease._id ? 'animate-spin' : ''}`} />
                              Renouveler
                            </button>
                          )}
                          {(status === 'ACTIVE' || status === 'EXPIRING') && (
                            <button
                              type="button"
                              onClick={() => setTerminateId(lease._id)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              Résilier
                            </button>
                          )}
                          {status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => onNavigate('contract', lease.property?._id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-orange-600 transition-colors"
                            >
                              <PenLine className="h-3 w-3" />
                              Rédiger
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Terminate modal */}
      {terminateId && (
        <TerminateModal
          leaseId={terminateId}
          onClose={() => setTerminateId(null)}
          onConfirm={handleTerminate}
        />
      )}
    </div>
  );
}

function TerminateModal({
  leaseId,
  onClose,
  onConfirm,
}: {
  leaseId: string;
  onClose: () => void;
  onConfirm: (id: string, initiatedBy: string) => void;
}) {
  const [initiatedBy, setInitiatedBy] = useState<'OWNER' | 'TENANT'>('TENANT');
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Résiliation du bail</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm font-semibold text-slate-700">Qui initie la résiliation ?</label>
          <div className="flex gap-3">
            {(['TENANT', 'OWNER'] as const).map((who) => (
              <button
                key={who}
                type="button"
                onClick={() => setInitiatedBy(who)}
                className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                  initiatedBy === who
                    ? 'border-orange-300 bg-orange-50 text-orange-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {who === 'TENANT' ? 'Le locataire' : 'Le propriétaire'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="inline h-4 w-4 mr-1" />
          {initiatedBy === 'TENANT'
            ? 'Préavis : 1 mois (meublé/zone tendue) ou 3 mois (nu). Le calcul sera automatique.'
            : 'Préavis propriétaire : 6 mois avant la fin du bail. Motif obligatoire (reprise, vente, motif légitime).'}
        </div>

        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await onConfirm(leaseId, initiatedBy);
              setLoading(false);
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'En cours…' : 'Confirmer la résiliation'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </th>
  );
}
