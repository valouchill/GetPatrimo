import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

 
const User = require('@/models/User');
 
const Application = require('@/models/Application');
 
const { sendEmail, isEmailConfigured } = require('@/src/services/emailService');
 
const { logEvent } = require('@/src/services/eventService');

/**
 * POST /api/applications/[id]/contact
 * Send a message to a candidate via email.
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { templateId, subject, message } = body;

  if (!message || !subject) {
    return NextResponse.json({ error: 'Message et sujet requis' }, { status: 400 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const application = await Application.findById(id).lean();
  if (!application) return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });

  const candidateEmail = application.userEmail;
  if (!candidateEmail) {
    return NextResponse.json({ error: 'Email du candidat non disponible' }, { status: 400 });
  }

  // Send email
  if (isEmailConfigured()) {
    await sendEmail({
      to: candidateEmail,
      subject,
      text: message,
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #F97316, #EA580C); padding: 20px 24px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0; font-size: 18px;">Maison Patrimo</h2>
          </div>
          <div style="padding: 24px; border: 1px solid #E2E8F0; border-top: 0; border-radius: 0 0 12px 12px;">
            ${message.replace(/\n/g, '<br/>')}
            <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 24px 0;">
            <p style="color: #94A3B8; font-size: 12px;">Ce message vous a été envoyé via la plateforme Maison Patrimo.</p>
          </div>
        </div>
      `,
    });
  }

  // Log event
  logEvent(String(user._id), {
    property: application.property || null,
    type: 'candidate_contacted',
    meta: { applicationId: id, templateId, candidateEmail },
  });

  return NextResponse.json({ success: true, message: 'Message envoyé' });
});
