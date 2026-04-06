import Link from 'next/link';

import { connectDiditDb } from '@/app/api/didit/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Payment = require('@/models/Payment');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Application = require('@/models/Application');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdminAuditLog = require('@/models/AdminAuditLog');

export const dynamic = 'force-dynamic';

function Kpi({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition">
      <div className="text-xs text-gray-500 uppercase font-semibold">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
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
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin — Vue d&apos;ensemble</h1>
        <p className="text-sm text-gray-600">Supervision globale de la plateforme</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Utilisateurs" value={usersTotal} href="/dashboard/admin/users" />
        <Kpi label="Suspendus" value={usersSuspended} href="/dashboard/admin/users?suspended=true" />
        <Kpi label="Propriétaires" value={byRole.owner || 0} />
        <Kpi label="Locataires" value={byRole.tenant || 0} />
        <Kpi label="Biens" value={propertiesTotal} href="/dashboard/admin/properties" />
        <Kpi label="Biens archivés" value={propertiesArchived} />
        <Kpi label="Baux actifs" value={leasesActive} href="/dashboard/admin/leases" />
        <Kpi label="Candidatures" value={applicationsTotal} href="/dashboard/admin/applications" />
        <Kpi label="Paiements en retard" value={paymentsLate} href="/dashboard/admin/payments?status=LATE" />
        <Kpi label="Paiements impayés" value={paymentsUnpaid} href="/dashboard/admin/payments?status=UNPAID" />
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Dernières actions admin</h2>
          <Link href="/dashboard/admin/audit" className="text-sm text-indigo-600 hover:underline">
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
