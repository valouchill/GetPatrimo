import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import TenantDashboardClient from './TenantDashboardClient';
import { getUserApplications, getApplication } from '@/app/actions/application-actions';
import { connectDiditDb } from '@/app/api/didit/db';

const User = require('@/models/User');
const Payment = require('@/models/Payment');
const Lease = require('@/models/Lease');

export default async function TenantDashboardPage() {
  const session = await getServerSession();

  if (!session?.user?.email) {
    redirect('/auth/login');
  }

  // Récupérer les candidatures de l'utilisateur
  const { applications } = await getUserApplications(session.user.email);

  // Récupérer la dernière application active
  const { application: latestApplication } = await getApplication(session.user.email);

  // Récupérer le bail actif et les paiements du locataire
  let activeLease = null;
  let recentPayments: any[] = [];
  try {
    await connectDiditDb();
    const user = await User.findOne({ email: session.user.email }).lean();
    if (user) {
      const now = new Date();
      activeLease = await Lease.findOne({
        tenantEmail: session.user.email,
        startDate: { $lte: now },
        $or: [{ endDate: null }, { endDate: { $gte: now } }],
      }).populate('property', 'address name').lean();

      recentPayments = await Payment.find({ tenant: user._id })
        .populate('property', 'address name')
        .sort({ 'period.year': -1, 'period.month': -1 })
        .limit(6)
        .lean();
    }
  } catch (e) {
    console.error('[tenant-dashboard] Error fetching lease/payments:', e);
  }

  return (
    <TenantDashboardClient
      userEmail={session.user.email}
      userName={session.user.name || undefined}
      applications={applications || []}
      latestApplication={latestApplication}
      activeLease={activeLease ? JSON.parse(JSON.stringify(activeLease)) : null}
      recentPayments={JSON.parse(JSON.stringify(recentPayments || []))}
    />
  );
}
