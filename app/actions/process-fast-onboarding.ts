'use server';

import { connectDiditDb } from '@/app/api/didit/db';
import User from '@/models/User';
import Property from '@/models/Property';
import Application from '@/models/Application';
import crypto from 'crypto';

const MAGIC_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type FastOnboardingPayload = {
  address: string;
  surfaceM2: number;
  rentAmount: number;
  email: string;
  /** Slug du passeport (Cheval de Troie) — si fourni, on associe l'Application au nouveau bien */
  passportSlug?: string;
};

export type FastOnboardingResult =
  | { ok: true; email: string; token: string }
  | { ok: false; error: string };

/**
 * Traite l'onboarding Fast-Track : crée ou récupère l'utilisateur, crée le bien,
 * génère un token Magic Auth. Optionnellement associe une Application (passeport) au bien.
 */
export async function processFastOnboarding(
  payload: FastOnboardingPayload
): Promise<FastOnboardingResult> {
  try {
    await connectDiditDb();

    const { address, surfaceM2, rentAmount, email, passportSlug } = payload;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !address || !rentAmount) {
      return { ok: false, error: 'Email, adresse et loyer sont requis.' };
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

    if (passportSlug) {
      await Application.findOneAndUpdate(
        { passportSlug },
        {
          property: property._id,
          status: 'ACCEPTED',
          ownerDecision: 'ACCEPTED',
          viewedByOwnerAt: new Date(),
        }
      );
    }

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
