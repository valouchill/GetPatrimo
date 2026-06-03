import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import SuperAdminDashboard from './SuperAdminDashboard';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

export const dynamic = 'force-dynamic';

/**
 * Cockpit SuperAdmin — réservé au rôle `superadmin`.
 *
 * Le layout admin (app/(platform)/dashboard/admin/layout.tsx) garantit déjà une
 * session valide, non suspendue, de rôle admin OU superadmin. On RESSERRE ici au
 * seul `superadmin` ; un `admin` simple est renvoyé vers l'overview admin.
 */
export default async function CockpitPage() {
  const session: any = await getServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect('/auth/login');
  }

  await connectDiditDb();
  const user = await User.findOne({ email: session.user.email }).select('role suspended').lean();

  if (!user || user.suspended || user.role !== 'superadmin') {
    redirect('/dashboard/admin');
  }

  return <SuperAdminDashboard />;
}
