import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

 
const User = require('@/models/User');
 
const bcrypt = require('bcryptjs');

// Use dynamic import for ESM-only otpauth
async function getOTPAuth() {
  const { TOTP, Secret } = await import('otpauth');
  return { TOTP, Secret };
}

/** Valide un code TOTP courant (ou un backup code) contre le secret actif de l'utilisateur. */
async function verifyCurrentTotp(user: any, code: unknown): Promise<boolean> {
  if (!code || !user.totpSecret) return false;
  const { TOTP, Secret } = await getOTPAuth();
  const totp = new TOTP({
    issuer: 'Maison Patrimo', label: user.email, algorithm: 'SHA1', digits: 6, period: 30,
    secret: Secret.fromBase32(user.totpSecret),
  });
  if (totp.validate({ token: String(code), window: 1 }) !== null) return true;
  for (const hashed of user.totpBackupCodes || []) {
    if (await bcrypt.compare(String(code), hashed)) return true;
  }
  return false;
}

/**
 * POST /api/auth/totp — Setup or verify TOTP
 * Body: { action: 'setup' | 'enable' | 'disable' | 'verify', code?: string }
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Sécurité (revue V1 — S27) : plafond dédié sur cette route 2FA sensible (en plus du
  // globalLimiter Express 20/min) — anti-brute-force des codes.
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (!checkRateLimit(`totp:${ip}`, { windowMs: 60_000, max: 10 }).allowed) {
    return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans une minute.' }, { status: 429 });
  }
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const body = await request.json();
  const { action, code } = body;

  await connectDiditDb();
  const user = await User.findOne({ email: session.user.email });
  if (!user) {
    return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });
  }

  const { TOTP, Secret } = await getOTPAuth();

  if (action === 'setup') {
    // Sécurité (pentest auth-6) : si une 2FA est DÉJÀ active, exiger une re-preuve du
    // facteur courant avant de régénérer le secret (sinon un session hijack désactive
    // silencieusement la 2FA de la victime). Symétrique de l'action 'disable'.
    if (user.totpEnabled && user.totpSecret) {
      const okCurrent = await verifyCurrentTotp(user, code);
      if (!okCurrent) {
        return NextResponse.json({ error: 'Code 2FA actuel requis pour reconfigurer la double authentification' }, { status: 400 });
      }
    }
    // Generate a new TOTP secret
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({
      issuer: 'Maison Patrimo',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    // Store secret temporarily (not yet enabled)
    user.totpSecret = secret.base32;
    user.totpEnabled = false;
    await user.save();

    const otpauthUrl = totp.toString();

    // Generate QR code as data URL
    const QRCode = await import('qrcode');
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    return NextResponse.json({
      secret: secret.base32,
      qrCode: qrDataUrl,
      otpauthUrl,
    });
  }

  if (action === 'enable') {
    // Verify the code and enable 2FA
    if (!code || !user.totpSecret) {
      return NextResponse.json({ error: 'Code et secret requis' }, { status: 400 });
    }

    const totp = new TOTP({
      issuer: 'Maison Patrimo',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(user.totpSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
    }

    // Generate backup codes
    const backupCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const raw = crypto.randomBytes(4).toString('hex'); // 8-char hex code
      backupCodes.push(raw);
      hashedCodes.push(await bcrypt.hash(raw, 10));
    }

    user.totpEnabled = true;
    user.totpBackupCodes = hashedCodes;
    await user.save();

    return NextResponse.json({
      enabled: true,
      backupCodes, // Show once, user must save them
    });
  }

  if (action === 'disable') {
    if (!code) {
      return NextResponse.json({ error: 'Code requis pour desactiver le 2FA' }, { status: 400 });
    }

    // Verify current TOTP before disabling
    if (user.totpEnabled && user.totpSecret) {
      const totp = new TOTP({
        issuer: 'Maison Patrimo',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(user.totpSecret),
      });

      const delta = totp.validate({ token: code, window: 1 });
      if (delta === null) {
        return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
      }
    }

    user.totpSecret = '';
    user.totpEnabled = false;
    user.totpBackupCodes = [];
    await user.save();

    return NextResponse.json({ enabled: false });
  }

  if (action === 'verify') {
    // Verify a TOTP code (used during login flow)
    if (!code || !user.totpSecret || !user.totpEnabled) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    const totp = new TOTP({
      issuer: 'Maison Patrimo',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(user.totpSecret),
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta !== null) {
      return NextResponse.json({ valid: true });
    }

    // Check backup codes
    for (let i = 0; i < (user.totpBackupCodes || []).length; i++) {
      const match = await bcrypt.compare(code, user.totpBackupCodes[i]);
      if (match) {
        // Remove used backup code
        user.totpBackupCodes.splice(i, 1);
        await user.save();
        return NextResponse.json({ valid: true, backupCodeUsed: true });
      }
    }

    return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
});
