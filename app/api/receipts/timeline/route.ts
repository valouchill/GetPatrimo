import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

 
const Lease = require('@/models/Lease');
 
const Payment = require('@/models/Payment');
 
const User = require('@/models/User');

/**
 * GET /api/receipts/timeline?propertyId=X  (or ?leaseId=X)
 * Returns lease metadata + all payments for the timeline view.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId');
  const leaseIdParam = searchParams.get('leaseId');

  if (!propertyId && !leaseIdParam) {
    return NextResponse.json({ error: 'propertyId ou leaseId requis' }, { status: 400 });
  }

  await connectDiditDb();

  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

  // Find lease — either by ID or by property (most recent active lease)
  let lease;
  if (leaseIdParam) {
    lease = await Lease.findById(leaseIdParam).lean();
  } else {
    // Find the most recent non-terminated lease for this property
    lease = await Lease.findOne({
      property: propertyId,
      leaseStatus: { $nin: ['EXPIRED', 'TERMINATED'] },
    }).sort({ startDate: -1 }).lean();

    // Fallback: any lease for this property
    if (!lease) {
      lease = await Lease.findOne({ property: propertyId }).sort({ startDate: -1 }).lean();
    }
  }

  if (!lease) {
    return NextResponse.json({ success: true, data: { lease: null, payments: [] } });
  }

  // Verify ownership
  if (String(lease.user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
  }

  const payments = await Payment.find({ lease: lease._id })
    .sort({ 'period.year': 1, 'period.month': 1 })
    .lean();

  // ── Compute metrics ──
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  let totalPaid = 0;
  let totalDue = 0;
  let overdueCount = 0;
  let receiptsSentCount = 0;

  const paymentMap = new Map<string, Record<string, unknown>>();
  for (const p of payments) {
    const per = p.period as { month: number; year: number };
    paymentMap.set(`${per.year}-${per.month}`, p);

    const isPast = per.year < currentYear || (per.year === currentYear && per.month <= currentMonth);
    if (isPast) {
      const amounts = p.amounts as { totalTTC: number; paidAmount: number };
      totalDue += amounts.totalTTC;
      if (p.status === 'CONFIRMED' || p.status === 'PARTIAL') {
        totalPaid += amounts.paidAmount;
      }
    }
    if (p.receiptSentAt) receiptsSentCount++;
  }

  // Check overdue: past months from lease start with no CONFIRMED payment
  const leaseStart = new Date(lease.startDate);
  let mCheck = leaseStart.getMonth() + 1;
  let yCheck = leaseStart.getFullYear();
  const monthlyTotal = (lease.rentAmount || 0) + (lease.chargesAmount || 0);

  while (yCheck < currentYear || (yCheck === currentYear && mCheck <= currentMonth)) {
    const key = `${yCheck}-${mCheck}`;
    const payment = paymentMap.get(key);
    if (!payment || (payment.status !== 'CONFIRMED' && payment.status !== 'PARTIAL')) {
      overdueCount++;
      totalDue += payment ? 0 : monthlyTotal; // add due if no payment record
    }
    mCheck++;
    if (mCheck > 12) { mCheck = 1; yCheck++; }
    // Respect lease endDate
    if (lease.endDate) {
      const endDate = new Date(lease.endDate);
      if (yCheck > endDate.getFullYear() || (yCheck === endDate.getFullYear() && mCheck > endDate.getMonth() + 1)) break;
    }
  }

  // Next due date: first future unpaid month
  let nextDueDate: string | null = null;
  let mNext = currentMonth;
  let yNext = currentYear;
  for (let i = 0; i < 3; i++) {
    const key = `${yNext}-${mNext}`;
    const payment = paymentMap.get(key);
    if (!payment || payment.status === 'PENDING') {
      const daysInMonth = new Date(yNext, mNext, 0).getDate();
      nextDueDate = `${String(mNext).padStart(2, '0')}/${yNext}`;
      break;
    }
    mNext++;
    if (mNext > 12) { mNext = 1; yNext++; }
  }

  return NextResponse.json({
    success: true,
    data: {
      lease: {
        _id: lease._id,
        startDate: lease.startDate,
        endDate: lease.endDate,
        rentAmount: lease.rentAmount,
        chargesAmount: lease.chargesAmount || 0,
        tenantFirstName: lease.tenantFirstName,
        tenantLastName: lease.tenantLastName,
        tenantEmail: lease.tenantEmail,
        leaseStatus: lease.leaseStatus,
      },
      payments,
      metrics: {
        totalPaid,
        totalDue,
        overdueCount,
        nextDueDate,
        receiptsSentCount,
      },
    },
  });
});
