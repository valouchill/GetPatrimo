import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { connectDiditDb } from '../../didit/db';
import { logger } from '@/lib/server-logger';
import CoTenant from '@/models/CoTenant';
import { syncCoTenantCertification } from '@/lib/cotenant-sync';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  buildGuarantorLookupFilters,
  fetchDiditSessionVerification,
} = require('@/src/utils/guarantorDidit');

const QueryParamsSchema = z
  .object({
    token: z.string().optional(),
    applyToken: z.string().optional(),
    sessionId: z.string().optional(),
    email: z.string().optional(),
    slot: z.string().optional(),
  })
  .refine((data) => data.token || data.applyToken || data.sessionId, {
    message: "Token d'invitation, applyToken ou sessionId requis",
  });

/** Statut de certification d'un colocataire (clone de guarantor/status) + re-sync. */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(`cotenant-status:${ip}`, { windowMs: 60_000, max: 20 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
    }

    await connectDiditDb();

    const sp = request.nextUrl.searchParams;
    const parsed = QueryParamsSchema.safeParse({
      token: sp.get('token') || undefined,
      applyToken: sp.get('applyToken') || undefined,
      sessionId: sp.get('sessionId') || undefined,
      email: sp.get('email') || undefined,
      slot: sp.get('slot') || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Paramètres invalides' },
        { status: 400 },
      );
    }

    const { token: invitationToken, applyToken, sessionId, email, slot } = parsed.data;

    let coTenant;
    if (invitationToken) {
      coTenant = await CoTenant.findOne({ invitationToken });
    } else {
      const filters = buildGuarantorLookupFilters({ sessionId, applyToken, email, slot });
      for (const filter of filters) {
        coTenant = await CoTenant.findOne(filter);
        if (coTenant) break;
      }
    }

    if (!coTenant) {
      return NextResponse.json({ error: 'Colocataire introuvable' }, { status: 404 });
    }

    let diditStatus = null;
    if (coTenant.diditSessionId) {
      try {
        const apiKey = process.env.DIDIT_API_KEY || process.env.DIDIT_CLIENT_SECRET;
        if (apiKey) {
          diditStatus = await fetchDiditSessionVerification(coTenant.diditSessionId, apiKey as string);
          if (diditStatus?.verified && coTenant.status !== 'CERTIFIED') {
            coTenant.status = 'CERTIFIED';
            coTenant.firstName = diditStatus.firstName || coTenant.firstName;
            coTenant.lastName = diditStatus.lastName || coTenant.lastName;
            coTenant.identityVerification = {
              status: 'CERTIFIEE',
              firstName: diditStatus.firstName || coTenant.firstName || '',
              lastName: diditStatus.lastName || coTenant.lastName || '',
              birthDate: diditStatus.birthDate || '',
              humanVerified: diditStatus.humanVerified || false,
              verifiedAt: new Date(),
            };
            coTenant.certifiedAt = new Date();
            await coTenant.save();
            // Re-sync (le polling ferme la boucle même si le webhook tarde).
            await syncCoTenantCertification(coTenant, {
              firstName: diditStatus.firstName,
              lastName: diditStatus.lastName,
              birthDate: diditStatus.birthDate,
            });
          }
        }
      } catch (error) {
        logger.error('Erreur vérification statut Didit colocataire', {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    const maskedEmail = coTenant.email
      ? coTenant.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3')
      : undefined;

    return NextResponse.json({
      coTenant: {
        id: coTenant._id,
        email: maskedEmail,
        firstName: coTenant.firstName,
        lastName: coTenant.lastName,
        slot: coTenant.slot || 2,
        status: coTenant.status,
        identityVerification: coTenant.identityVerification
          ? { status: coTenant.identityVerification.status }
          : undefined,
        certifiedAt: coTenant.certifiedAt,
        certificationMethod:
          coTenant.diditSessionId && coTenant.status === 'CERTIFIED' ? 'DIDIT' : null,
      },
      diditStatus: diditStatus ? { verified: diditStatus.verified } : null,
    });
  } catch (error) {
    logger.error('Erreur récupération statut colocataire', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
