import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import UserActionsPanel from '../../_components/UserActionsPanel';
import UserTimeline from '../../_components/UserTimeline';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Payment = require('@/models/Payment');

export const dynamic = 'force-dynamic';

const USER_SELECT = '-password -totpSecret -totpBackupCodes -magicSignInToken';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectDiditDb();

  const session: any = await getServerSession(authOptions as any);
  const current = session?.user?.email
    ? await User.findOne({ email: session.user.email }).select('_id role').lean()
    : null;
  const currentRole: 'admin' | 'superadmin' = current?.role === 'superadmin' ? 'superadmin' : 'admin';
  const isSelf = current && String(current._id) === String(id);

  const user = await User.findById(id).select(USER_SELECT).lean();
  if (!user) return notFound();

  const [propertiesCount, leasesCount, paymentsLate] = await Promise.all([
    Property.countDocuments({ user: id }),
    Lease.countDocuments({ $or: [{ user: id }, { tenantEmail: user.email }] }),
    Payment.countDocuments({
      $or: [{ owner: id }, { tenant: id }],
      status: { $in: ['LATE', 'UNPAID'] },
    }),
  ]);

  return (
    <div>
      <Link href="/dashboard/admin/users" className="text-sm text-indigo-600 hover:underline">
        ← Utilisateurs
      </Link>
      <header className="my-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
        </h1>
        <p className="text-sm text-gray-600 font-mono">{user.email}</p>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Informations</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Rôle</dt>
            <dd>{user.role}</dd>
            <dt className="text-gray-500">Plan</dt>
            <dd>{user.plan}</dd>
            <dt className="text-gray-500">Crédits</dt>
            <dd>{user.credits}</dd>
            <dt className="text-gray-500">2FA activée</dt>
            <dd>{user.totpEnabled ? 'Oui' : 'Non'}</dd>
            <dt className="text-gray-500">Statut</dt>
            <dd>{user.suspended ? <span className="text-red-600">Suspendu</span> : 'Actif'}</dd>
            {user.suspendedReason && (
              <>
                <dt className="text-gray-500">Motif suspension</dt>
                <dd>{user.suspendedReason}</dd>
              </>
            )}
            <dt className="text-gray-500">Téléphone</dt>
            <dd>{user.phone || '—'}</dd>
            <dt className="text-gray-500">Adresse</dt>
            <dd>{[user.address, user.zipCode, user.city].filter(Boolean).join(' ') || '—'}</dd>
            <dt className="text-gray-500">Créé le</dt>
            <dd>{new Date(user.createdAt).toLocaleString('fr-FR')}</dd>
          </dl>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
            <div>
              <div className="text-xs text-gray-500 uppercase">Biens</div>
              <div className="text-xl font-semibold">{propertiesCount}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Baux</div>
              <div className="text-xl font-semibold">{leasesCount}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Paiements LATE/UNPAID</div>
              <div className="text-xl font-semibold">{paymentsLate}</div>
            </div>
          </div>
        </div>

        <UserActionsPanel
          userId={id}
          userEmail={user.email}
          userRole={user.role}
          suspended={Boolean(user.suspended)}
          totpEnabled={Boolean(user.totpEnabled)}
          currentRole={currentRole}
          isSelf={Boolean(isSelf)}
        />
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
        <h2 className="font-semibold mb-3">Timeline d&apos;activité</h2>
        <UserTimeline userId={id} />
      </section>
    </div>
  );
}
