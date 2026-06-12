import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDiditDb } from '@/app/api/didit/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateRequest } from '@/lib/validate-request';
import { LoginPasswordSchema } from '@/lib/validations/auth';
import { logger } from '@/lib/server-logger';
 
const User = require('@/models/User');

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de tentatives, réessayez dans 1 minute.' }, { status: 429 });
    }

    const body = await req.json();
    const result = validateRequest(LoginPasswordSchema, body);
    if (!result.success) return result.response;

    const email = result.data.email.trim().toLowerCase();
    const password = result.data.password;

    await connectDiditDb();

    const user = await User.findOne({ email });
    // Message générique pour éviter l'énumération d'emails
    const genericError = { error: 'Email ou mot de passe incorrect' };

    // Sécurité (pentest auth-5) : égaliser le temps de réponse entre compte existant et
    // inexistant — sans ce compare factice, l'absence de bcrypt révèle un compte inconnu
    // (oracle de timing). DUMMY_HASH est un hash bcrypt valide d'une valeur quelconque.
    const DUMMY_HASH = '$2a$12$n/fu1m215HBba48Y7Kjme.xlLgy1KOqpQoMENRx8Psvw2dxAPZzPW';
    if (!user || !user.password) {
      await bcrypt.compare(password, DUMMY_HASH);
      return NextResponse.json(genericError, { status: 401 });
    }

    if (user.suspended) {
      // Compte suspendu : même message générique, pas de magic token émis.
      await bcrypt.compare(password, DUMMY_HASH);
      return NextResponse.json(genericError, { status: 401 });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return NextResponse.json(genericError, { status: 401 });
    }

    // Générer magic token pour signIn('magic-fast')
    const magicToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(magicToken, 10);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      magicSignInToken: hashedToken,
      magicSignInExpiresAt: expiresAt,
    });

    return NextResponse.json({
      ok: true,
      email,
      token: magicToken,
      role: user.role || 'owner',
      requires2fa: Boolean(user.totpEnabled),
    });
  } catch (err) {
    logger.error('[login-password]', { error: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
