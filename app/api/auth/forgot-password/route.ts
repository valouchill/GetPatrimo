import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { connectDiditDb } from '@/app/api/didit/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateRequest } from '@/lib/validate-request';
import { ForgotPasswordSchema } from '@/lib/validations/auth';
import { logger } from '@/lib/server-logger';

const User = require('@/models/User');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS,
  },
});

function getBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://maisonpatrimo.com'
  ).replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de tentatives, réessayez dans 1 minute.' }, { status: 429 });
    }

    const body = await request.json();
    const result = validateRequest(ForgotPasswordSchema, body);
    if (!result.success) return result.response;

    const email = result.data.email.trim().toLowerCase();

    await connectDiditDb();
    const user = await User.findOne({ email });

    // Anti-énumération : la réponse est identique que le compte existe ou non,
    // et un échec d'envoi d'email ne doit pas la modifier.
    if (user) {
      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          logger.error('[forgot-password] JWT_SECRET manquant');
          return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
        }
        const token = jwt.sign(
          { user: { id: user._id.toString() }, type: 'password_reset' },
          jwtSecret,
          { expiresIn: '1h' }
        );
        const resetLink = `${getBaseUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;
        const rawFrom = (process.env.MAIL_FROM || '').replace(/^"|"$/g, '').trim();
        const fromAddr = rawFrom || 'Maison Patrimo <no-reply@maisonpatrimo.com>';

        await transporter.sendMail({
          to: email,
          from: fromAddr,
          subject: 'Réinitialisation de votre mot de passe Maison Patrimo',
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Segoe UI', sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #064E3B, #065F46); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 1px;">Maison Patrimo</h1>
      <p style="color: #a7f3d0; font-size: 12px; margin: 8px 0 0;">Coffre-fort Immobilier Intelligent</p>
    </div>
    <div style="padding: 40px 32px; text-align: center;">
      <p style="color: #334155; line-height: 1.6; margin: 0 0 8px; font-size: 16px; font-weight: 600;">
        Réinitialisation de votre mot de passe
      </p>
      <p style="color: #64748b; line-height: 1.6; margin: 0 0 28px;">
        Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
      </p>
      <a href="${resetLink}" style="display: inline-block; background: #F59E0B; color: white; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 12px; font-size: 15px;">
        Réinitialiser mon mot de passe
      </a>
      <p style="color: #94a3b8; font-size: 13px; margin: 28px 0 0;">
        Ce lien expire dans <strong>1 heure</strong>.<br/>
        Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.
      </p>
    </div>
    <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
        Maison Patrimo — Standard de Confiance Immobilier
      </p>
    </div>
  </div>
</body>
</html>`,
          text: `Réinitialisez votre mot de passe Maison Patrimo : ${resetLink}\nCe lien expire dans 1 heure.\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        });
      } catch (mailErr) {
        // On ne change PAS la réponse (anti-énumération) : on logge seulement.
        logger.error('[forgot-password] envoi email échoué', {
          error: mailErr instanceof Error ? mailErr.message : mailErr,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[forgot-password]', { error: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
