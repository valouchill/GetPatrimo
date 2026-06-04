import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin } from '@/lib/auth-admin';

 
const User = require('@/models/User');
 
const Property = require('@/models/Property');
 
const Lease = require('@/models/Lease');
 
const Payment = require('@/models/Payment');
 
const Application = require('@/models/Application');
 
const AdminAuditLog = require('@/models/AdminAuditLog');

export const GET = withAdmin(async (_req: NextRequest) => {
  await connectDiditDb();

  const [
    usersTotal,
    usersByRole,
    usersSuspended,
    propertiesTotal,
    propertiesArchived,
    leasesTotal,
    leasesActive,
    paymentsTotal,
    paymentsLate,
    paymentsUnpaid,
    applicationsTotal,
    recentAudit,
  ] = await Promise.all([
    User.countDocuments({}),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ suspended: true }),
    Property.countDocuments({}),
    Property.countDocuments({ archived: true }),
    Lease.countDocuments({}),
    Lease.countDocuments({ leaseStatus: 'ACTIVE' }),
    Payment.countDocuments({}),
    Payment.countDocuments({ status: 'LATE' }),
    Payment.countDocuments({ status: 'UNPAID' }),
    Application.countDocuments({}),
    AdminAuditLog.find({}).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const byRole: Record<string, number> = {};
  for (const row of usersByRole) byRole[row._id] = row.count;

  return NextResponse.json({
    users: {
      total: usersTotal,
      suspended: usersSuspended,
      byRole,
    },
    properties: { total: propertiesTotal, archived: propertiesArchived },
    leases: { total: leasesTotal, active: leasesActive },
    payments: { total: paymentsTotal, late: paymentsLate, unpaid: paymentsUnpaid },
    applications: { total: applicationsTotal },
    recentAudit: recentAudit.map((e: any) => ({
      id: String(e._id),
      actorEmail: e.actorEmail,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId ? String(e.targetId) : null,
      createdAt: e.createdAt,
    })),
  });
});
