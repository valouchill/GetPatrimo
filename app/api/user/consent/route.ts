import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { z } from 'zod';
import { validateRequest } from '@/lib/validate-request';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Event = require('@/models/Event');

const ConsentSchema = z.object({
  diditConsent: z.boolean({ error: 'Consentement Didit requis (true/false)' }),
  marketingConsent: z.boolean().optional(),
});

/**
 * PUT /api/user/consent
 * RGPD : gère le consentement utilisateur (Didit, marketing).
 */
export async function PUT(req: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const result = validateRequest(ConsentSchema, body);
    if (!result.success) return result.response;

    await connectDiditDb();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      'consent.didit': result.data.diditConsent,
      'consent.diditUpdatedAt': new Date(),
    };

    if (result.data.marketingConsent !== undefined) {
      update['consent.marketing'] = result.data.marketingConsent;
      update['consent.marketingUpdatedAt'] = new Date();
    }

    await User.updateOne({ _id: user._id }, { $set: update });

    await Event.create({
      user: user._id,
      type: 'RGPD_CONSENT_UPDATE',
      meta: new Map([
        ['diditConsent', String(result.data.diditConsent)],
        ['marketingConsent', String(result.data.marketingConsent ?? 'unchanged')],
        ['date', new Date().toISOString()],
      ]),
    });

    return NextResponse.json({
      success: true,
      consent: {
        didit: result.data.diditConsent,
        marketing: result.data.marketingConsent,
      },
    });
  } catch (err) {
    console.error('[PUT /api/user/consent] Erreur:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
