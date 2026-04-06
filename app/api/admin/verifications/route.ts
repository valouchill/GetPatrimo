import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin } from '@/lib/auth-admin';
import { getPagination } from '@/lib/pagination';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const IdentitySession = require('@/models/IdentitySession');

export const GET = withAdmin(async (req: NextRequest) => {
  await connectDiditDb();
  const url = new URL(req.url);
  const { limit, skip } = getPagination(url);

  const identityStatus = url.searchParams.get('identityStatus') || '';
  const q = (url.searchParams.get('q') || '').trim();

  const filter: Record<string, any> = {};
  if (identityStatus) filter.identityStatus = identityStatus;
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { sessionId: regex },
      { applyToken: regex },
      { firstName: regex },
      { lastName: regex },
    ];
  }

  const [items, total] = await Promise.all([
    IdentitySession.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    IdentitySession.countDocuments(filter),
  ]);

  return NextResponse.json({
    items: items.map((s: any) => ({ ...s, _id: String(s._id) })),
    total,
    limit,
    skip,
  });
});
