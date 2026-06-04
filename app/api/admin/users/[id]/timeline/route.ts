import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, AdminHttpError } from '@/lib/auth-admin';

 
const User = require('@/models/User');
 
const AdminAuditLog = require('@/models/AdminAuditLog');
 
const Event = require('@/models/Event');
 
const Payment = require('@/models/Payment');
 
const Application = require('@/models/Application');
 
const Lease = require('@/models/Lease');

interface TimelineEntry {
  type: string;
  at: string;
  label: string;
  meta?: Record<string, any>;
}

export const GET = withAdmin(async (_req: NextRequest, ctx: any) => {
  await connectDiditDb();
  const { id } = await ctx.params;

  const user = await User.findById(id).select('email').lean();
  if (!user) throw new AdminHttpError(404, 'Utilisateur introuvable');

  const [adminAudits, events, payments, applications, leases] = await Promise.all([
    AdminAuditLog.find({ targetType: 'User', targetId: id }).sort({ createdAt: -1 }).limit(50).lean(),
    Event.find({ user: id }).sort({ createdAt: -1 }).limit(50).lean(),
    Payment.find({ $or: [{ owner: id }, { tenant: id }] }).sort({ createdAt: -1 }).limit(30).select('status amounts period createdAt').lean(),
    Application.find({ userId: id }).sort({ createdAt: -1 }).limit(20).select('status applyToken createdAt').lean(),
    Lease.find({ $or: [{ user: id }, { tenantEmail: (user as any).email }] }).sort({ createdAt: -1 }).limit(20).select('leaseStatus tenantEmail startDate endDate createdAt').lean(),
  ]);

  const timeline: TimelineEntry[] = [];

  for (const a of adminAudits) {
    timeline.push({
      type: 'admin',
      at: (a as any).createdAt,
      label: `[admin] ${a.action} par ${a.actorEmail}`,
      meta: { before: a.before, after: a.after, ip: a.ip },
    });
  }
  for (const e of events) {
    timeline.push({
      type: 'event',
      at: (e as any).createdAt,
      label: `[event] ${e.type}`,
      meta: e.meta ? Object.fromEntries(e.meta) : undefined,
    });
  }
  for (const p of payments) {
    timeline.push({
      type: 'payment',
      at: (p as any).createdAt,
      label: `[payment] ${String(p.period.month).padStart(2, '0')}/${p.period.year} · ${p.status} · ${p.amounts?.totalTTC || 0}€`,
      meta: { paymentId: String(p._id) },
    });
  }
  for (const a of applications) {
    timeline.push({
      type: 'application',
      at: (a as any).createdAt,
      label: `[application] ${a.status} · ${a.applyToken || ''}`,
      meta: { applicationId: String(a._id) },
    });
  }
  for (const l of leases) {
    timeline.push({
      type: 'lease',
      at: (l as any).createdAt,
      label: `[lease] ${l.leaseStatus} · ${l.tenantEmail || ''}`,
      meta: { leaseId: String(l._id) },
    });
  }

  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return NextResponse.json({ timeline: timeline.slice(0, 100) });
});
