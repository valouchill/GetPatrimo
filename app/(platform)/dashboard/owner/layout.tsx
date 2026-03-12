import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
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
        <div className="max-w-5xl mx-auto py-12 px-6">
          {children}
        </div>
      </div>
    </OwnerProvider>
  );
}
