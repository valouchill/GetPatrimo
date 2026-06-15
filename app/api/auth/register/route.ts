import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDiditDb } from '@/app/api/didit/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateRequest } from '@/lib/validate-request';
import { RegisterSchema } from '@/lib/validations/auth';
import { logger } from '@/lib/server-logger';
import { CONSENT_VERSION } from '@/lib/legal/consent';
 
const User = require('@/models/User');
 
const Property = require('@/models/Property');

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).pop() || 'unknown'; // pentest config-1 : dernier hop
    const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de tentatives, réessayez dans 1 minute.' }, { status: 429 });
    }

    const body = await req.json();
    const result = validateRequest(RegisterSchema, body);
    if (!result.success) return result.response;

    const email = result.data.email.trim().toLowerCase();
    const password = result.data.password;
    const role = result.data.role || 'owner';
    const propertyCode = result.data.propertyCode;

    await connectDiditDb();

    // Locataire : si un code est fourni, le valider ; sinon → Passeport Locatif
    // universel (codeless). L'auto-candidature reçoit un self-token PT-SELF-*.
    let property: { _id: unknown; address?: string; city?: string } | null = null;
    let selfToken: string | undefined;
    if (role === 'tenant') {
      if (propertyCode) {
        property = await Property.findOne({ applyToken: propertyCode }).lean();
        if (!property) {
          return NextResponse.json({ error: 'Code de bien introuvable' }, { status: 400 });
        }
      } else {
        selfToken = `PT-SELF-${crypto.randomBytes(6).toString('hex')}`;
      }
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email' }, { status: 409 });
    }

    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);

    // Générer magic token pour auto-login
    const magicToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(magicToken, 10);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    const now = new Date();
    const marketingConsent = result.data.marketingConsent === true;
    const partnerSharingConsent = result.data.partnerSharingConsent === true;
    const user = await User.create({
      email,
      password: hashed,
      plan: 'FREE',
      role,
      magicSignInToken: hashedToken,
      magicSignInExpiresAt: expiresAt,
      // RGPD : le marketing devient opt-in, piloté par la case d'inscription.
      emailPreferences: { reminders: true, marketing: marketingConsent },
      legalConsent: {
        termsAcceptedAt: now,
        termsVersion: CONSENT_VERSION,
        marketingConsent,
        marketingConsentAt: marketingConsent ? now : undefined,
        partnerSharingConsent,
        partnerSharingConsentAt: partnerSharingConsent ? now : undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      email,
      token: magicToken,
      role,
      userId: String(user._id),
      propertyId: property ? String(property._id) : undefined,
      selfToken,
    });
  } catch (err) {
    logger.error('[register]', { error: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
