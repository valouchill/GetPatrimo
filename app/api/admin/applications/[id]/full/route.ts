import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, AdminHttpError } from '@/lib/auth-admin';

 
const Application = require('@/models/Application');
 
const Property = require('@/models/Property');
 
const User = require('@/models/User');
 
const Guarantor = require('@/models/Guarantor');
 
const AdminAuditLog = require('@/models/AdminAuditLog');

export const GET = withAdmin(async (_req: NextRequest, ctx: any) => {
  await connectDiditDb();
  const { id } = await ctx.params;

  const app = await Application.findById(id).lean();
  if (!app) throw new AdminHttpError(404, 'Candidature introuvable');

  const [property, owner, guarantors, auditTrail] = await Promise.all([
    (app as any).property ? Property.findById((app as any).property).select('name address city user rentAmount chargesAmount').lean() : null,
    (app as any).userId ? User.findById((app as any).userId).select('email firstName lastName phone').lean() : null,
    Guarantor.find({ applicationId: id }).lean().catch(() => []),
    AdminAuditLog.find({ targetType: 'Application', targetId: id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  return NextResponse.json({
    application: { ...app, _id: String((app as any)._id) },
    property: property ? { ...property, _id: String((property as any)._id) } : null,
    candidate: owner ? { ...owner, _id: String((owner as any)._id) } : null,
    guarantors: guarantors.map((g: any) => ({ ...g, _id: String(g._id) })),
    auditTrail: auditTrail.map((e: any) => ({ ...e, _id: String(e._id) })),
  });
});
