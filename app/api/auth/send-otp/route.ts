import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateRequest } from '@/lib/validate-request';
import { SendOtpSchema } from '@/lib/validations/auth';
import nodemailer from 'nodemailer';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

const OtpStore = (() => {
  let model: any = null;
  return async () => {
    if (model) return model;
    const mongoose = await import('mongoose');
    const schema = new mongoose.Schema({
      email: { type: String, required: true, index: true },
      code: { type: String, required: true },
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
      attempts: { type: Number, default: 0 },
    });
    model = mongoose.models.OtpToken || mongoose.model('OtpToken', schema);
    return model;
  };
})();

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, '0');
}

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS,
  },
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de tentatives, réessayez dans 1 minute.' }, { status: 429 });
    }

    const body = await request.json();
    const result = validateRequest(SendOtpSchema, body);
    if (!result.success) return result.response;

    const normalizedEmail = result.data.email.trim().toLowerCase();

    await connectDiditDb();
    const Token = await OtpStore();

    await Token.deleteMany({ email: normalizedEmail });

    const code = generateOtp();
    await Token.create({
      email: normalizedEmail,
      code,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
    });

    const rawFrom = (process.env.MAIL_FROM || '').replace(/^"|"$/g, '').trim();
    const fromAddr = rawFrom || 'PatrimoTrust <no-reply@doc2loc.com>';
    await transporter.sendMail({
      to: normalizedEmail,
      from: fromAddr,
      subject: `Votre code d'accès PatrimoTrust : ${code}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Segoe UI', sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 1px;">PatrimoTrust</h1>
      <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0;">Coffre-fort Immobilier Intelligent</p>
    </div>
    <div style="padding: 40px 32px; text-align: center;">
      <p style="color: #64748b; line-height: 1.6; margin: 0 0 24px;">
        Votre code de vérification :
      </p>
      <div style="background: #f1f5f9; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 0 auto; max-width: 280px;">
        <span style="font-family: 'SF Mono', 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">
          ${code}
        </span>
      </div>
      <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0;">
        Ce code expire dans <strong>10 minutes</strong>.<br/>
        Si vous n'avez pas demandé ce code, ignorez cet email.
      </p>
    </div>
    <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
        PatrimoTrust™ — Standard de Confiance Immobilier
      </p>
    </div>
  </div>
</body>
</html>`,
      text: `Votre code d'accès PatrimoTrust : ${code} — Ce code expire dans 10 minutes.`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[send-otp]', e);
    return NextResponse.json({ error: 'Erreur lors de l\'envoi du code.' }, { status: 500 });
  }
}
