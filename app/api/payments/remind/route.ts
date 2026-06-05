import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { withErrorHandler } from '@/lib/with-error-handler';
import { validateRequest } from '@/lib/validate-request';
import { RemindSchema } from '@/lib/validations/payment';
import { checkLatePayments } from '@/lib/services/paymentService';
import { fillReminderTemplate, type ReminderType } from '@/lib/templates/rent-reminders';
import { connectDiditDb } from '@/app/api/didit/db';

 
const User = require('@/models/User');
 
const Payment = require('@/models/Payment');
 
const { sendEmail, isEmailConfigured } = require('@/src/services/emailService');
 
const { logEvent } = require('@/src/services/eventService');

function determineReminderLevel(daysLate: number, alreadySent: string[]): ReminderType | null {
  if (daysLate >= 45 && !alreadySent.includes('critical_alert')) return 'critical_alert';
  if (daysLate >= 30 && !alreadySent.includes('formal_notice')) return 'formal_notice';
  if (daysLate >= 15 && !alreadySent.includes('formal')) return 'formal';
  if (daysLate >= 5 && !alreadySent.includes('friendly')) return 'friendly';
  return null;
}

/**
 * POST /api/payments/remind — Send reminder emails for late payments
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
    // Empty body = remind all late payments
  }
  const result = validateRequest(RemindSchema, body);
  if (!result.success) return result.response;

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const targetPaymentId = result.data.paymentId;
  const allLatePayments = await checkLatePayments();
  const latePayments = targetPaymentId
    ? allLatePayments.filter((lp) => lp.paymentId === targetPaymentId)
    : allLatePayments;
  let sentCount = 0;
  const results: { paymentId: string; level: string; sent: boolean }[] = [];

  for (const lp of latePayments) {
    const alreadySent = lp.remindersSent.map((r) => {
      // Map EMAIL type reminders by looking at the delay ranges
      if (r.type === 'EMAIL') return 'friendly'; // fallback
      return r.type;
    });

    // More precise: check actual reminder types stored
    const sentTypes = lp.remindersSent.map((r) => r.type).filter(Boolean);
    const level = determineReminderLevel(lp.daysLate, sentTypes);

    if (!level) {
      results.push({ paymentId: lp.paymentId, level: 'none', sent: false });
      continue;
    }

    const { subject, body: emailBody } = fillReminderTemplate(level, {
      prenom: lp.tenantFirstName,
      nom: lp.tenantLastName,
      adresse: lp.propertyAddress,
      mois: lp.period,
      montant: `${lp.amount.toLocaleString('fr-FR')} €`,
      jours_retard: String(lp.daysLate),
    });

    const recipient = level === 'critical_alert' ? lp.ownerEmail : lp.tenantEmail;

    // Check email preferences (RGPD art. 21)
    if (level !== 'critical_alert') {
      const recipientUser = await User.findOne({ email: recipient }).lean();
      if (recipientUser?.emailPreferences?.reminders === false) {
        results.push({ paymentId: lp.paymentId, level, sent: false });
        continue;
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://getpatrimo.com';

    if (isEmailConfigured() && recipient) {
      try {
        await sendEmail({
          to: recipient,
          subject,
          text: emailBody + `\n\n---\nSe désinscrire : ${baseUrl}/api/user/unsubscribe`,
          html: `<div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#F97316,#EA580C);padding:20px 24px;border-radius:12px 12px 0 0;">
              <h2 style="color:white;margin:0;font-size:18px;">getpatrimo</h2>
            </div>
            <div style="padding:24px;border:1px solid #E2E8F0;border-top:0;border-radius:0 0 12px 12px;">
              ${emailBody.replace(/\n/g, '<br/>')}
              <p style="margin-top:24px;padding-top:16px;border-top:1px solid #E2E8F0;color:#9ca3af;font-size:11px;text-align:center;">
                <a href="${baseUrl}/api/user/unsubscribe?category=reminders" style="color:#9ca3af;text-decoration:underline;">Se désinscrire</a>
                &nbsp;|&nbsp;
                <a href="${baseUrl}/privacy" style="color:#9ca3af;text-decoration:underline;">Politique de confidentialité</a>
              </p>
            </div>
          </div>`,
        });

        // Record reminder in payment
        await Payment.updateOne(
          { _id: lp.paymentId },
          {
            $push: { remindersSent: { date: new Date(), type: level } },
            $set: { status: lp.daysLate >= 15 ? 'LATE' : 'PENDING' },
          }
        );

        sentCount++;
        results.push({ paymentId: lp.paymentId, level, sent: true });
      } catch {
        results.push({ paymentId: lp.paymentId, level, sent: false });
      }
    } else {
      results.push({ paymentId: lp.paymentId, level, sent: false });
    }
  }

  if (sentCount > 0) {
    logEvent(String(user._id), {
      type: 'reminders_sent',
      meta: { count: sentCount, levels: results.filter((r) => r.sent).map((r) => r.level) },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      total: allLatePayments.length,
      filtered: latePayments.length,
      sent: sentCount,
      details: results,
    },
  });
});
