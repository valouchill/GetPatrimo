import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import AdminSidebar from './_components/AdminSidebar';

 
const User = require('@/models/User');

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session: any = await getServerSession(authOptions as any);

  if (!session?.user?.email) {
    redirect('/auth/login');
  }

  await connectDiditDb();
  const user = await User.findOne({ email: session.user.email })
    .select('email role firstName lastName suspended')
    .lean();

  if (!user || user.suspended) {
    redirect('/auth/login');
  }
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    redirect('/dashboard/owner');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <AdminSidebar
          role={user.role as 'admin' | 'superadmin'}
          email={user.email}
        />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
