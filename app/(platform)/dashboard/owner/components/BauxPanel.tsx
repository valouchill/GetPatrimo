'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock, FileSignature, FileText, PenLine, Plus, RefreshCw, UserCheck, UserX, X } from 'lucide-react';
import { SignatureQueue } from './SignatureQueue';
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
  tenantSignedAt?: string;
  ownerSignedAt?: string;
  opensignDocuments?: Array<{ kind: string; status: string }>;
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

interface PropertyOption {
  _id: string;
  name?: string;
  address?: string;
  selectedApplicationId?: string;
  selectedCandidateName?: string;
}

export function BauxPanel({
  onNavigate,
  properties = [],
}: {
  onNavigate: (target: string, id?: string, applicationId?: string) => void;
  properties?: PropertyOption[];
}) {
  const [leases, setLeases] = useState<LeaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [terminateId, setTerminateId] = useState<string | null>(null);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  // Les échecs de renouvellement/résiliation étaient totalement muets : le
  // bailleur cliquait, rien ne se passait, il ne savait pas pourquoi.
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchLeases = useCallback(async () => {
    try {
      const res = await fetch('/api/leases');
      if (res.ok) {
        const json = await res.json();
        setLeases(json.data || []);
      } else {
        setActionError('Impossible de charger vos baux — rechargez la page.');
      }
    } catch {
      setActionError('Connexion impossible — vérifiez votre réseau.');
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLeases(); }, [fetchLeases]);

  const handleRenew = async (leaseId: string) => {
    setRenewingId(leaseId);
    setActionError(null);
    try {
      const res = await fetch(`/api/leases/${leaseId}/renew`, { method: 'POST' });
      if (res.ok) {
        await fetchLeases();
      } else {
        const json = await res.json().catch(() => ({}));
        setActionError(json?.error || 'Le renouvellement a échoué. Réessayez.');
      }
    } catch {
      setActionError('Connexion impossible — le renouvellement n\'a pas été enregistré.');
    }
    finally { setRenewingId(null); }
  };

  const handleTerminate = async (leaseId: string, initiatedBy: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/leases/${leaseId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initiatedBy }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setActionError(json?.error || 'La résiliation a échoué. Réessayez.');
        return;
      }
      setTerminateId(null);
      await fetchLeases();
    } catch {
      setActionError('Connexion impossible — la résiliation n\'a pas été enregistrée.');
    }
  };

  // Compute KPIs
  const active = leases.filter((l) => deriveStatus(l) === 'ACTIVE').length;
  const expiring = leases.filter((l) => deriveStatus(l) === 'EXPIRING').length;
  const pendingSig = leases.filter((l) => deriveStatus(l) === 'PENDING_SIGNATURE').length;
  const totalRent = leases
    .filter((l) => ['ACTIVE', 'EXPIRING'].includes(deriveStatus(l)))
    .reduce((s, l) => s + l.rentAmount, 0);
  const contractsToPrepare = properties.filter((p) => Boolean(p.selectedApplicationId));
  const pickerProperties = contractsToPrepare.length > 0 ? contractsToPrepare : properties;

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">Chargement des baux...</div>
    );
  }

  return (
    <div>
      {actionError && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="shrink-0 text-xs font-semibold underline">
            Fermer
          </button>
        </div>
      )}

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} value={active} label="Baux actifs" bg="bg-emerald-50" />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} value={expiring} label="Expirent bientôt" bg="bg-red-50" />
        <StatCard icon={<FileSignature className="h-5 w-5 text-amber-500" />} value={pendingSig} label="En signature" bg="bg-amber-50" />
        <StatCard icon={<CalendarDays className="h-5 w-5 text-violet-500" />} value={`${totalRent.toLocaleString('fr-FR')} €`} label="Loyers actifs" bg="bg-violet-50" />
      </div>

      {/* Action button */}
      <div className="mb-5 flex justify-end">
        <Btn variant="amber" onClick={() => {
          if (pickerProperties.length === 1) {
            onNavigate('contract', pickerProperties[0]._id, pickerProperties[0].selectedApplicationId);
          } else {
            setShowPropertyPicker(true);
          }
        }}>
          <Plus className="h-4 w-4" /> {contractsToPrepare.length > 0 ? 'Reprendre un bail' : 'Nouveau bail'}
        </Btn>
      </div>

      {contractsToPrepare.length > 0 && (
        <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                Contrats à préparer
              </p>
              <h2 className="mt-1 font-serif text-xl font-semibold text-emerald-950">
                Locataires retenus
              </h2>
              <p className="mt-1 text-sm text-emerald-900/75">
                Ces dossiers restent accessibles ici tant que le bail n&apos;est pas finalisé.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {contractsToPrepare.map((property) => (
              <button
                key={`${property._id}-${property.selectedApplicationId}`}
                type="button"
                onClick={() => onNavigate('contract', property._id, property.selectedApplicationId)}
                className="group flex min-w-0 items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-amber-300">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-950">
                    {property.selectedCandidateName || 'Locataire retenu'}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {property.name || property.address || 'Bien sélectionné'}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700">
                  Reprendre
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {leases.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-6 w-6 text-slate-500" />
          </div>
          <p className="mb-2 text-slate-500">Aucun bail généré pour le moment.</p>
          <p className="text-xs text-slate-500">
            {contractsToPrepare.length > 0
              ? 'Reprenez un contrat à préparer ci-dessus pour lancer la génération.'
              : 'Sélectionnez un locataire depuis vos candidatures pour créer un bail.'}
          </p>
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
                          <span className="text-xs text-slate-500 ml-1">+ {lease.chargesAmount} €</span>
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
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`h-3 w-3 ${renewingId === lease._id ? 'animate-spin' : ''}`} />
                              Renouveler
                            </button>
                          )}
                          {(status === 'ACTIVE' || status === 'EXPIRING') && (
                            <button
                              type="button"
                              onClick={() => setTerminateId(lease._id)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              Résilier
                            </button>
                          )}
                          {status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => onNavigate('contract', lease.property?._id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
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

        {/* Mobile cards */}
        <div className="block md:hidden space-y-3">
          {leases.map((lease) => {
            const status = deriveStatus(lease);
            const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
            const days = daysUntilEnd(lease.endDate);
            const Icon = config.icon;

            return (
              <div key={lease._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                {/* Header: tenant + status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={`${lease.tenantFirstName} ${lease.tenantLastName}`} id={lease._id} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{lease.tenantFirstName} {lease.tenantLastName}</div>
                      <div className="text-xs text-slate-500 truncate">{lease.tenantEmail}</div>
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
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
                </div>

                {/* File de signature en direct : qui bloque, renvoi du lien,
                    téléchargement du bail signé (PDF + certificat) une fois complet */}
                {(status === 'PENDING_SIGNATURE' || lease.signatureStatus === 'SIGNED_BOTH') && (
                  <SignatureQueue leaseId={lease._id} />
                )}
                {status === 'PENDING_SIGNATURE' && (
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${lease.tenantSignedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      Locataire {lease.tenantSignedAt ? 'a signé' : 'en attente'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${lease.ownerSignedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      Propriétaire {lease.ownerSignedAt ? 'a signé' : 'en attente'}
                    </span>
                    {lease.opensignDocuments?.some(d => d.kind === 'GUARANTEE') && (
                      <span className={`rounded-full px-2 py-0.5 ${
                        lease.opensignDocuments.find(d => d.kind === 'GUARANTEE')?.status === 'SIGNED'
                          ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        Garant {lease.opensignDocuments.find(d => d.kind === 'GUARANTEE')?.status === 'SIGNED' ? 'a signé' : 'en attente'}
                      </span>
                    )}
                  </div>
                )}

                {/* Property + type */}
                <div className="mb-3 text-sm text-slate-600">
                  {lease.property?.name || lease.property?.address?.split(',')[0] || '—'}
                  <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {LEASE_TYPE_LABEL[lease.leaseType] || lease.leaseType}
                  </span>
                </div>

                {/* Rent */}
                <div className="mb-3 flex items-baseline gap-1">
                  <span className="text-sm font-semibold text-slate-900">{lease.rentAmount.toLocaleString('fr-FR')} €</span>
                  {lease.chargesAmount > 0 && (
                    <span className="text-xs text-slate-500">+ {lease.chargesAmount} €</span>
                  )}
                  <span className="text-xs text-slate-500">/ mois</span>
                </div>

                {/* Dates */}
                <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                  <span>Début : {lease.startDate ? new Date(lease.startDate).toLocaleDateString('fr-FR') : '—'}</span>
                  <span>Fin : {lease.endDate ? new Date(lease.endDate).toLocaleDateString('fr-FR') : '—'}</span>
                </div>
                {days !== null && days > 0 && days < 90 && (
                  <div className="mb-3 flex items-center gap-1 text-xs font-semibold text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {days}j restants
                  </div>
                )}
                {days !== null && days <= 0 && (
                  <div className="mb-3 text-xs font-semibold text-red-600">Expiré</div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  {(status === 'EXPIRING' || status === 'EXPIRED') && (
                    <button
                      type="button"
                      onClick={() => handleRenew(lease._id)}
                      disabled={renewingId === lease._id}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${renewingId === lease._id ? 'animate-spin' : ''}`} />
                      Renouveler
                    </button>
                  )}
                  {(status === 'ACTIVE' || status === 'EXPIRING') && (
                    <button
                      type="button"
                      onClick={() => setTerminateId(lease._id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Résilier
                    </button>
                  )}
                  {status === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={() => onNavigate('contract', lease.property?._id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
                    >
                      <PenLine className="h-3 w-3" />
                      Rédiger
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Property picker modal */}
      {showPropertyPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPropertyPicker(false)}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Sélectionner un bien</h3>
              <button type="button" onClick={() => setShowPropertyPicker(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {pickerProperties.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">Aucun bien disponible. Ajoutez un bien d&apos;abord.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {pickerProperties.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => { setShowPropertyPicker(false); onNavigate('contract', p._id, p.selectedApplicationId); }}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{p.name || 'Bien sans nom'}</p>
                      <p className="truncate text-xs text-slate-500">{p.address || ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
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
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
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
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
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
    <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </th>
  );
}
