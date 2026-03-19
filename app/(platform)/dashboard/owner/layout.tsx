import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { OwnerProvider } from './OwnerContext';
import OwnerHeader from './OwnerHeader';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session: any = await getServerSession(authOptions as any);

  if (!session?.user?.email) {
    redirect('/auth/login');
  }

  return (
    <OwnerProvider userEmail={session.user.email}>
      <div className="min-h-screen bg-slate-50">
        <OwnerHeader />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </OwnerProvider>
  );
}
