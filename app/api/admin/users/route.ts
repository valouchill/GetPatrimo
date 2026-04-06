import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin } from '@/lib/auth-admin';
import { getPagination } from '@/lib/pagination';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

const USER_SELECT = '-password -totpSecret -totpBackupCodes -magicSignInToken';

export const GET = withAdmin(async (req: NextRequest) => {
  await connectDiditDb();
  const url = new URL(req.url);
  const { limit, skip } = getPagination(url);

  const q = (url.searchParams.get('q') || '').trim();
  const role = url.searchParams.get('role') || '';
  const plan = url.searchParams.get('plan') || '';
  const suspendedParam = url.searchParams.get('suspended');

  const filter: Record<string, any> = {};
  if (role) filter.role = role;
  if (plan) filter.plan = plan;
  if (suspendedParam === 'true') filter.suspended = true;
  else if (suspendedParam === 'false') filter.suspended = { $ne: true };
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { email: regex },
      { firstName: regex },
      { lastName: regex },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select(USER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return NextResponse.json({
    items: items.map((u: any) => ({ ...u, _id: String(u._id) })),
    total,
    limit,
    skip,
  });
});
