import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { withErrorHandler } from '@/lib/with-error-handler';
import { validateRequest } from '@/lib/validate-request';
import { RemindSchema } from '@/lib/validations/payment';
import { checkLatePayments } from '@/lib/services/paymentService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

/**
 * POST /api/payments/remind — Envoie les relances impayés
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Body vide = relancer tous les impayés
  }
  const result = validateRequest(RemindSchema, body);
  if (!result.success) return result.response;

  const latePayments = await checkLatePayments();

  // TODO: intégrer avec emailService pour envoyer les relances
  // Pour l'instant, retourne la liste des impayés à relancer
  return NextResponse.json({
    success: true,
    data: {
      count: latePayments.length,
      payments: latePayments,
    },
  });
});
