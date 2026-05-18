'use client';

import { Building2, FileText, CreditCard, Mail, Upload, Trash2, UserPlus, Bell, ClipboardList } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  date: string;
  propertyLabel: string | null;
  meta: Record<string, unknown>;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  property_created:         { icon: Building2,     label: 'Bien ajouté',             color: 'bg-emerald-50 text-emerald-600' },
  property_updated:         { icon: Building2,     label: 'Bien modifié',            color: 'bg-blue-50 text-blue-600' },
  property_deleted:         { icon: Trash2,        label: 'Bien supprimé',           color: 'bg-red-50 text-red-600' },
  tenant_created:           { icon: UserPlus,      label: 'Locataire ajouté',        color: 'bg-emerald-50 text-emerald-600' },
  tenant_updated:           { icon: UserPlus,      label: 'Locataire modifié',       color: 'bg-blue-50 text-blue-600' },
  tenant_deleted:           { icon: Trash2,        label: 'Locataire supprimé',      color: 'bg-red-50 text-red-600' },
  pdf_quittance_generated:  { icon: FileText,      label: 'Quittance générée',       color: 'bg-amber-50 text-amber-600' },
  email_quittance_sent:     { icon: Mail,          label: 'Quittance envoyée',       color: 'bg-blue-50 text-blue-600' },
  document_uploaded:        { icon: Upload,        label: 'Document uploadé',        color: 'bg-slate-100 text-slate-600' },
  document_deleted:         { icon: Trash2,        label: 'Document supprimé',       color: 'bg-red-50 text-red-600' },
  reminder_sent:            { icon: Bell,          label: 'Relance envoyée',         color: 'bg-amber-50 text-amber-600' },
  payment_confirmed:        { icon: CreditCard,    label: 'Paiement confirmé',       color: 'bg-emerald-50 text-emerald-600' },
  payments_generated:       { icon: CreditCard,    label: 'Loyers générés',          color: 'bg-amber-50 text-amber-600' },
  candidature_received:     { icon: ClipboardList, label: 'Candidature reçue',       color: 'bg-blue-50 text-blue-600' },
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events || events.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="font-semibold text-slate-900 mb-4">Activité récente</div>
        <p className="py-6 text-center text-sm text-slate-500">Aucune activité récente.</p>
      </div>
    );
  }

  // Group events by relative date
  const grouped: Record<string, TimelineEvent[]> = {};
  for (const ev of events) {
    const key = formatRelativeDate(ev.date);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="font-semibold text-slate-900 mb-4">Activité récente</div>
      <div className="space-y-4">
        {Object.entries(grouped).map(([dateLabel, evts]) => (
          <div key={dateLabel}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{dateLabel}</div>
            <div className="space-y-2">
              {evts.map((ev) => {
                const config = EVENT_CONFIG[ev.type] || { icon: FileText, label: ev.type, color: 'bg-slate-100 text-slate-600' };
                const Icon = config.icon;
                return (
                  <div key={ev.id} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 transition-colors">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-800">
                        <span className="font-medium">{config.label}</span>
                        {ev.propertyLabel && (
                          <span className="text-slate-500"> — {ev.propertyLabel}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatTime(ev.date)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
