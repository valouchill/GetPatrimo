import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { OwnerProvider } from './OwnerContext';
import { NotificationsProvider } from './NotificationsContext';
import OwnerHeader from './OwnerHeader';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session: any = await getServerSession(authOptions as any);

  if (!session?.user?.email) {
    redirect('/auth/login');
  }

  return (
    <OwnerProvider userEmail={session.user.email}>
      {/* V7.9 — NotificationsProvider wrappe TOUT /dashboard/owner/* :
          un seul fetch + polling pour Bell sidebar + badges NAV +
          futurs consumers (header global, etc.) */}
      <NotificationsProvider>
        {children}
      </NotificationsProvider>
    </OwnerProvider>
  );
}
