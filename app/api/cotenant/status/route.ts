import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { isInvitationClosed } from '@/lib/invitation-validity';
import { connectDiditDb } from '../../didit/db';
import { logger } from '@/lib/server-logger';
import CoTenant from '@/models/CoTenant';
import { syncCoTenantCertification } from '@/lib/cotenant-sync';
 
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
    const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
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

    // Sécurité (pentest ChatGPT P2) : lien d'invitation expiré/révoqué → plus d'accès statut
    // (sauf dossier déjà CERTIFIED).
    if (isInvitationClosed(coTenant)) {
      return NextResponse.json({ error: 'Invitation expirée ou révoquée.' }, { status: 410 });
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

    // Sécurité (pentest ChatGPT P2) : nom/prénom en clair uniquement via le token d'invitation
    // personnel ; masqués sur les autres chemins de résolution (applyToken+email / sessionId).
    const viaInvitationToken = !!invitationToken;
    const maskName = (s?: string) => (s ? `${s.charAt(0)}***` : s);
    const outFirstName = viaInvitationToken ? coTenant.firstName : maskName(coTenant.firstName);
    const outLastName = viaInvitationToken ? coTenant.lastName : maskName(coTenant.lastName);

    return NextResponse.json({
      coTenant: {
        id: coTenant._id,
        email: maskedEmail,
        firstName: outFirstName,
        lastName: outLastName,
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
