import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { connectDiditDb } from '@/app/api/didit/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateRequest } from '@/lib/validate-request';
import { ResetPasswordSchema } from '@/lib/validations/auth';
import { logger } from '@/lib/server-logger';

const User = require('@/models/User');

const INVALID = 'Lien invalide ou expiré. Veuillez refaire une demande de réinitialisation.';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).pop() || 'unknown'; // pentest config-1 : dernier hop
    const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de tentatives, réessayez dans 1 minute.' }, { status: 429 });
    }

    const body = await request.json();
    const result = validateRequest(ResetPasswordSchema, body);
    if (!result.success) return result.response;

    const { token, password } = result.data;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('[reset-password] JWT_SECRET manquant');
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    let decoded: { user?: { id?: string }; type?: string; jti?: string };
    try {
      decoded = jwt.verify(token, jwtSecret) as typeof decoded;
    } catch {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }
    if (!decoded || decoded.type !== 'password_reset' || !decoded.user?.id || !decoded.jti) {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }

    await connectDiditDb();
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }

    // Sécurité (pentest auth-3) : usage unique — le jti du token doit correspondre au nonce
    // courant en base. Après une réinitialisation réussie (ou une nouvelle demande), il ne
    // correspond plus → token rejouable invalidé.
    if (!user.passwordResetJti || user.passwordResetJti !== decoded.jti) {
      return NextResponse.json({ error: INVALID }, { status: 400 });
    }

    // Le hook pre-save du modèle valide le mot de passe EN CLAIR uniquement ; comme
    // on stocke un hash bcrypt ($2…) il saute la validation — la complexité est donc
    // garantie par ResetPasswordSchema (Zod) ci-dessus.
    user.password = await bcrypt.hash(password, 12);
    user.passwordResetJti = '';            // consommé → token désormais inutilisable
    user.magicSignInToken = '';            // invalide tout magic token en vol
    user.magicSignInImpersonatorId = null;
    await user.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[reset-password]', { error: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
