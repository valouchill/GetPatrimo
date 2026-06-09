/**
 * Vérification d'un second facteur 2FA au login (revue V1 — S10).
 * Accepte un code TOTP (6 chiffres) OU un code de secours (consommé à l'usage).
 * Logique identique à /api/auth/totp (action 'verify'), factorisée pour être
 * réutilisée par le provider NextAuth `magic-fast`.
 */

const bcrypt = require('bcryptjs');

interface TotpUser {
  totpSecret?: string;
  totpEnabled?: boolean;
  totpBackupCodes?: string[];
  save: () => Promise<unknown>;
}

export async function verifyUserTotp(user: TotpUser, code: unknown): Promise<boolean> {
  const trimmed = String(code ?? '').trim();
  if (!trimmed || !user?.totpSecret || !user?.totpEnabled) return false;

  const { TOTP, Secret } = await import('otpauth');
  const totp = new TOTP({
    issuer: 'Maison Patrimo',
    label: 'login',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(user.totpSecret),
  });
  // window:1 tolère un décalage d'horloge d'une période (±30s).
  if (totp.validate({ token: trimmed, window: 1 }) !== null) return true;

  // Repli sur les codes de secours (stockés hashés) — consommé si valide.
  const codes = user.totpBackupCodes || [];
  for (let i = 0; i < codes.length; i++) {
    if (await bcrypt.compare(trimmed, codes[i])) {
      codes.splice(i, 1);
      await user.save();
      return true;
    }
  }
  return false;
}
