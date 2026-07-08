import Link from 'next/link';

import { connectDiditDb } from '@/app/api/didit/db';

 
const User = require('@/models/User');
 
const Property = require('@/models/Property');
 
const Lease = require('@/models/Lease');
 
const Payment = require('@/models/Payment');
 
const Application = require('@/models/Application');
 
const AdminAuditLog = require('@/models/AdminAuditLog');

export const dynamic = 'force-dynamic';

function Kpi({
  label,
  value,
  href,
  alert = false,
}: {
  label: string;
  value: number | string;
  href?: string;
  /** Rouge quand la valeur signale un problème (impayés, suspendus…). */
  alert?: boolean;
}) {
  const isAlert = alert && Number(value) > 0;
  const body = (
    <div
      className={`rounded-xl border bg-white p-4 transition-all ${
        href ? 'hover:-translate-y-0.5 hover:shadow-md' : ''
      } ${isAlert ? 'border-red-200 bg-red-50/50' : 'border-slate-200'}`}
    >
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${isAlert ? 'text-red-600' : 'text-slate-500'}`}>
        {label}
      </div>
      <div className={`mt-1 font-serif text-2xl font-bold tabular-nums ${isAlert ? 'text-red-700' : 'text-emerald-950'}`}>
        {value}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminOverviewPage() {
  await connectDiditDb();

  const [
    usersTotal,
    usersSuspended,
    usersByRole,
    propertiesTotal,
    propertiesArchived,
    leasesActive,
    paymentsLate,
    paymentsUnpaid,
    applicationsTotal,
    recentAudit,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ suspended: true }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Property.countDocuments({}),
    Property.countDocuments({ archived: true }),
    Lease.countDocuments({ leaseStatus: 'ACTIVE' }),
    Payment.countDocuments({ status: 'LATE' }),
    Payment.countDocuments({ status: 'UNPAID' }),
    Application.countDocuments({}),
    AdminAuditLog.find({}).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const byRole: Record<string, number> = {};
  for (const r of usersByRole) byRole[r._id] = r.count;

  return (
    <div>
      <header className="mb-7">
        <h1 className="font-serif text-2xl font-bold text-emerald-950">Vue d&apos;ensemble</h1>
        <p className="mt-0.5 text-sm text-slate-500">Supervision globale de la plateforme</p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Utilisateurs" value={usersTotal} href="/dashboard/admin/users" />
        <Kpi label="Suspendus" value={usersSuspended} href="/dashboard/admin/users?suspended=true" alert />
        <Kpi label="Propriétaires" value={byRole.owner || 0} />
        <Kpi label="Locataires" value={byRole.tenant || 0} />
        <Kpi label="Biens" value={propertiesTotal} href="/dashboard/admin/properties" />
        <Kpi label="Biens archivés" value={propertiesArchived} />
        <Kpi label="Baux actifs" value={leasesActive} href="/dashboard/admin/leases" />
        <Kpi label="Candidatures" value={applicationsTotal} href="/dashboard/admin/applications" />
        <Kpi label="Paiements en retard" value={paymentsLate} href="/dashboard/admin/payments?status=LATE" alert />
        <Kpi label="Paiements impayés" value={paymentsUnpaid} href="/dashboard/admin/payments?status=UNPAID" alert />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Dernières actions admin</h2>
          <Link href="/dashboard/admin/audit" className="text-sm font-medium text-emerald-800 hover:underline">
            Voir tout →
          </Link>
        </div>
        {recentAudit.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune action enregistrée.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentAudit.map((e: any) => (
              <li key={String(e._id)} className="py-2 text-sm flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-2">{e.action}</span>
                  <span className="text-gray-600">{e.targetType}</span>
                  <span className="text-gray-400 ml-2">par {e.actorEmail}</span>
                </div>
                <span className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleString('fr-FR')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
