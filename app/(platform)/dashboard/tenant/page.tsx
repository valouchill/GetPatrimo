import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import TenantDashboardClient from './TenantDashboardClient';
import { getUserApplications, getApplication } from '@/app/actions/application-actions';

export default async function TenantDashboardPage() {
  const session = await getServerSession();

  if (!session?.user?.email) {
    redirect('/auth/login');
  }

  // Récupérer les candidatures de l'utilisateur
  const { applications } = await getUserApplications(session.user.email);
  
  // Récupérer la dernière application active
  const { application: latestApplication } = await getApplication(session.user.email);

  return (
    <TenantDashboardClient 
      userEmail={session.user.email}
      userName={session.user.name || undefined}
      applications={applications || []}
      latestApplication={latestApplication}
    />
  );
}
