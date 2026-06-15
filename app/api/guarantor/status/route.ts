import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { isInvitationClosed } from '@/lib/invitation-validity';
import { connectDiditDb } from '../../didit/db';
import { logger } from '@/lib/server-logger';
import Guarantor from '@/models/Guarantor';
import Property from '@/models/Property';

const QueryParamsSchema = z.object({
  token: z.string().optional(),
  applyToken: z.string().optional(),
  sessionId: z.string().optional(),
  email: z.string().optional(),
  slot: z.string().optional(),
}).refine(
  (data) => data.token || data.applyToken || data.sessionId,
  { message: "Token d'invitation, applyToken ou sessionId requis" }
);
 
const {
  buildGuarantorLookupFilters,
  fetchDiditSessionVerification,
  normalizeSlot,
} = require('@/src/utils/guarantorDidit');

/**
 * Vérifie le statut de certification d'un garant
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
    const { allowed } = checkRateLimit(`guarantor-status:${ip}`, { windowMs: 60_000, max: 20 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
    }

    await connectDiditDb();

    const searchParams = request.nextUrl.searchParams;
    const rawParams = {
      token: searchParams.get('token') || undefined,
      applyToken: searchParams.get('applyToken') || undefined,
      sessionId: searchParams.get('sessionId') || undefined,
      email: searchParams.get('email') || undefined,
      slot: searchParams.get('slot') || undefined,
    };

    const parsed = QueryParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Paramètres invalides' },
        { status: 400 }
      );
    }

    const { token: invitationToken, applyToken, sessionId, email, slot } = parsed.data;
    const normalizedSlot = normalizeSlot(slot);

    let guarantor;
    let property = null;
    
    if (invitationToken) {
      guarantor = await Guarantor.findOne({ invitationToken }).populate('property');
      if (guarantor?.property) {
        property = guarantor.property;
      }
    } else {
      const lookupFilters = buildGuarantorLookupFilters({
        sessionId,
        applyToken,
        email,
        slot,
      });

      for (const filter of lookupFilters) {
        guarantor = await Guarantor.findOne(filter).populate('property');
        if (guarantor) {
          break;
        }
      }

      if (!guarantor && applyToken) {
        // Fallback: chercher la property et ensuite le garant
        property = await Property.findOne({ applyToken });
        if (property) {
          // Sécurité (pentest access-1) : ne résoudre que via un email connu (jamais le bien
          // seul ou le slot seul, qui matchent un garant tiers).
          const propertyFallbackFilters: Array<Record<string, unknown>> = [];

          if (email && normalizedSlot) {
            propertyFallbackFilters.push({ property: property._id, email: email.toLowerCase(), slot: normalizedSlot });
          }
          if (email) {
            propertyFallbackFilters.push({ property: property._id, email: email.toLowerCase() });
          }

          for (const filter of propertyFallbackFilters) {
            guarantor = await Guarantor.findOne(filter);
            if (guarantor) break;
          }
        }
      }
    }

    if (!guarantor) {
      return NextResponse.json(
        { error: 'Garant introuvable' },
        { status: 404 }
      );
    }

    // Sécurité (pentest ChatGPT P2) : un lien d'invitation expiré/révoqué n'ouvre plus le statut
    // (sauf dossier déjà CERTIFIED). Empêche l'usage indéfini d'un token d'invitation fuité.
    if (isInvitationClosed(guarantor)) {
      return NextResponse.json({ error: 'Invitation expirée ou révoquée.' }, { status: 410 });
    }

    // Si le garant a une session Didit, vérifier son statut
    let diditStatus = null;
    if (guarantor.diditSessionId) {
      try {
        const apiKey = process.env.DIDIT_API_KEY || process.env.DIDIT_CLIENT_SECRET;
        if (!apiKey) {
          logger.warn('DIDIT_API_KEY non configuré');
        } else {
          diditStatus = await fetchDiditSessionVerification(guarantor.diditSessionId, apiKey as string);

          // Si vérifié, mettre à jour le garant
          if (diditStatus?.verified) {
            guarantor.status = 'CERTIFIED';
            guarantor.firstName = diditStatus.firstName || guarantor.firstName;
            guarantor.lastName = diditStatus.lastName || guarantor.lastName;
            guarantor.identityVerification = {
              status: 'CERTIFIEE',
              firstName: diditStatus.firstName || guarantor.firstName || '',
              lastName: diditStatus.lastName || guarantor.lastName || '',
              birthDate: diditStatus.birthDate || '',
              humanVerified: diditStatus.humanVerified || false,
              verifiedAt: new Date(),
            };
            guarantor.certifiedAt = new Date();
            await guarantor.save();
          }
        }
      } catch (error) {
        logger.error('Erreur vérification statut Didit garant', { error: error instanceof Error ? error.message : error });
      }
    }

    // Déterminer la méthode de certification
    const auditDetails = (guarantor as Record<string, unknown>).auditDetails;
    const certificationMethod = auditDetails ? 'AUDIT' : 
      (guarantor.diditSessionId && guarantor.status === 'CERTIFIED' ? 'DIDIT' : null);

    // Masquer les données sensibles : ne pas exposer l'email complet ni les détails internes
    const maskedEmail = guarantor.email
      ? guarantor.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3')
      : undefined;

    // Sécurité (pentest ChatGPT P2) : ne renvoyer nom/prénom en clair QUE via le token
    // d'invitation personnel (le garant lui-même). Sur les chemins applyToken+email / sessionId,
    // on masque pour ne pas sur-divulguer l'identité d'un tiers à quiconque détient un identifiant.
    const viaInvitationToken = !!invitationToken;
    const maskName = (s?: string) => (s ? `${s.charAt(0)}***` : s);
    const outFirstName = viaInvitationToken ? guarantor.firstName : maskName(guarantor.firstName);
    const outLastName = viaInvitationToken ? guarantor.lastName : maskName(guarantor.lastName);

    return NextResponse.json({
      guarantor: {
        id: guarantor._id,
        email: maskedEmail,
        firstName: outFirstName,
        lastName: outLastName,
        slot: guarantor.slot || 1,
        status: guarantor.status,
        identityVerification: guarantor.identityVerification
          ? { status: guarantor.identityVerification.status }
          : undefined,
        certifiedAt: guarantor.certifiedAt,
        certificationMethod,
      },
      diditStatus: diditStatus ? { verified: diditStatus.verified } : null,
      tenantName: outFirstName && outLastName
        ? `${outFirstName} ${outLastName}`
        : maskedEmail,
    });
  } catch (error) {
    logger.error('Erreur récupération statut garant', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
