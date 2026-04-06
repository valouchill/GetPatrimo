import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin } from '@/lib/auth-admin';
import { getPagination } from '@/lib/pagination';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Payment = require('@/models/Payment');

export const GET = withAdmin(async (req: NextRequest) => {
  await connectDiditDb();
  const url = new URL(req.url);
  const { limit, skip } = getPagination(url);

  const status = url.searchParams.get('status') || '';
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');

  const filter: Record<string, any> = {};
  if (status) filter.status = status;
  if (year) filter['period.year'] = Number(year);
  if (month) filter['period.month'] = Number(month);

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('owner', 'email')
      .populate('tenant', 'email firstName lastName')
      .populate('property', 'name address')
      .sort({ 'period.year': -1, 'period.month': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return NextResponse.json({
    items: items.map((p: any) => ({ ...p, _id: String(p._id) })),
    total,
    limit,
    skip,
  });
});
