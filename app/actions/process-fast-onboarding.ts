'use server';

import { connectDiditDb } from '@/app/api/didit/db';
import { getSessionEmail } from '@/lib/server-action-auth';
import User from '@/models/User';
import Property from '@/models/Property';
import crypto from 'crypto';

const MAGIC_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type FastOnboardingPayload = {
  address: string;
  surfaceM2: number;
  rentAmount: number;
  email: string;
};

export type FastOnboardingResult =
  | { ok: true; email: string; token: string }
  | { ok: false; error: string };

/**
 * Traite l'onboarding Fast-Track : crée ou récupère l'utilisateur, crée le bien,
 * génère un token Magic Auth.
 */
export async function processFastOnboarding(
  payload: FastOnboardingPayload
): Promise<FastOnboardingResult> {
  try {
    await connectDiditDb();

    const { address, surfaceM2, rentAmount, email } = payload;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !address || !rentAmount) {
      return { ok: false, error: 'Email, adresse et loyer sont requis.' };
    }

    // Sécurité (re-audit V1 — 3e passe) : exiger une session dont l'email correspond
    // (sinon : création de compte/bien + écrasement de magic-token pour un email
    // arbitraire). Le bloc passportSlug→ACCEPTED (forge d'acceptation bailleur) est retiré.
    const sessionEmail = await getSessionEmail();
    if (!sessionEmail || sessionEmail !== normalizedEmail) {
      return { ok: false, error: 'Non autorisé.' };
    }

    let user = await User.findOne({ email: normalizedEmail }).lean();
    if (!user) {
      const newUser = await User.create({
        email: normalizedEmail,
        password: '',
        firstName: '',
        lastName: '',
        plan: 'FREE',
      });
      user = newUser.toObject ? newUser.toObject() : (newUser as any);
    }

    const userId = (user as any)._id;
    const magicToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + MAGIC_TOKEN_TTL_MS);

    await User.findByIdAndUpdate(userId, {
      magicSignInToken: magicToken,
      magicSignInExpiresAt: expiresAt,
    });

    const name = address.slice(0, 80) || 'Mon bien';
    const property = await Property.create({
      user: userId,
      name,
      address,
      rentAmount: Number(rentAmount),
      chargesAmount: 0,
      surfaceM2: surfaceM2 ? Number(surfaceM2) : null,
      status: 'AVAILABLE',
    });

    return {
      ok: true,
      email: normalizedEmail,
      token: magicToken,
    };
  } catch (e) {
    console.error('processFastOnboarding', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Erreur lors de la création du compte.',
    };
  }
}
