import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateRequest } from '@/lib/validate-request';
import { VerifyOtpSchema } from '@/lib/validations/auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const User = require('@/models/User');
const Property = require('@/models/Property');

const MAX_ATTEMPTS = 5;

 
const OtpToken = require('@/models/OtpToken');

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de tentatives, réessayez dans 1 minute.' }, { status: 429 });
    }

    const body = await request.json();
    const result = validateRequest(VerifyOtpSchema, body);
    if (!result.success) return result.response;

    const { propertyData } = result.data;
    const normalizedEmail = result.data.email.trim().toLowerCase();
    const code = result.data.otp.trim();

    await connectDiditDb();
    const Token = OtpToken;

    const tokenDoc = await Token.findOne({
      email: normalizedEmail,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      return NextResponse.json({ error: 'Code expiré. Veuillez en demander un nouveau.' }, { status: 401 });
    }

    if (tokenDoc.attempts >= MAX_ATTEMPTS) {
      await Token.deleteMany({ email: normalizedEmail });
      return NextResponse.json({ error: 'Trop de tentatives. Veuillez recommencer.' }, { status: 429 });
    }

    const codeBuffer = Buffer.from(code.padEnd(6, '\0'));
    const storedBuffer = Buffer.from(tokenDoc.code.padEnd(6, '\0'));
    const codeMatch = codeBuffer.length === storedBuffer.length && crypto.timingSafeEqual(codeBuffer, storedBuffer);
    if (!codeMatch) {
      await Token.findByIdAndUpdate(tokenDoc._id, { $inc: { attempts: 1 } });
      const remaining = MAX_ATTEMPTS - tokenDoc.attempts - 1;
      return NextResponse.json(
        { error: `Code incorrect. ${remaining > 0 ? `${remaining} tentative(s) restante(s).` : 'Dernière tentative.'}` },
        { status: 401 }
      );
    }

    await Token.deleteMany({ email: normalizedEmail });

    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        password: '',
        firstName: '',
        lastName: '',
        plan: 'FREE',
      });
    }

    const userId = user._id;

    if (propertyData?.address) {
      await Property.create({
        user: userId,
        name: (propertyData.address || '').slice(0, 80) || 'Mon bien',
        address: propertyData.address,
        rentAmount: Number(propertyData.rentAmount) || 0,
        chargesAmount: 0,
        surfaceM2: propertyData.surfaceM2 ? Number(propertyData.surfaceM2) : null,
        status: 'AVAILABLE',
      });

      // Sécurité (audit passe-5, CRITICAL IDOR/BOLA) : on NE re-parente PLUS une
      // candidature par `passportSlug` ici. Le slug est un identifiant PUBLIC (présent
      // dans les URLs `/p/{slug}` et les routes dossier publiques) ; quiconque vérifie
      // SON propre OTP pouvait rattacher la candidature d'autrui à SA propriété et la
      // passer ACCEPTED → exfiltration du dossier complet (PII/KYC) dans son tableau de
      // bord bailleur + forge d'acceptation. Bloc déjà retiré de process-fast-onboarding.ts
      // (même faille « forge d'acceptation bailleur ») — verify-otp avait été oublié.
    }

    const magicToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
    const hashedToken = await bcrypt.hash(magicToken, 10);
    await User.findByIdAndUpdate(userId, {
      magicSignInToken: hashedToken,
      magicSignInExpiresAt: expiresAt,
      // Sécurité (audit passe-5) : nouveau magic token → réinitialise le compteur d'essais TOTP.
      magicTotpAttempts: 0,
    });

    return NextResponse.json({
      ok: true,
      email: normalizedEmail,
      token: magicToken,
      requires2fa: Boolean(user.totpEnabled),
    });
  } catch (e) {
    logger.error('[verify-otp]', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
