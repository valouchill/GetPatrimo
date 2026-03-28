import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDiditDb } from '../../didit/db';
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
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
          const propertyFallbackFilters: Array<Record<string, unknown>> = [];

          if (email && normalizedSlot) {
            propertyFallbackFilters.push({ property: property._id, email: email.toLowerCase(), slot: normalizedSlot });
          }
          if (email) {
            propertyFallbackFilters.push({ property: property._id, email: email.toLowerCase() });
          }
          if (normalizedSlot) {
            propertyFallbackFilters.push({ property: property._id, slot: normalizedSlot });
          }
          propertyFallbackFilters.push({ property: property._id });

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

    // Si le garant a une session Didit, vérifier son statut
    let diditStatus = null;
    if (guarantor.diditSessionId) {
      try {
        const apiKey = process.env.DIDIT_API_KEY || process.env.DIDIT_CLIENT_SECRET;
        if (!apiKey) {
          console.warn('DIDIT_API_KEY non configuré');
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
        console.error('Erreur vérification statut Didit garant:', error);
      }
    }

    // Déterminer la méthode de certification
    const auditDetails = (guarantor as Record<string, unknown>).auditDetails;
    const certificationMethod = auditDetails ? 'AUDIT' : 
      (guarantor.diditSessionId && guarantor.status === 'CERTIFIED' ? 'DIDIT' : null);

    return NextResponse.json({
      guarantor: {
        id: guarantor._id,
        email: guarantor.email,
        firstName: guarantor.firstName,
        lastName: guarantor.lastName,
        slot: guarantor.slot || 1,
        status: guarantor.status,
        diditSessionId: guarantor.diditSessionId,
        identityVerification: guarantor.identityVerification,
        certifiedAt: guarantor.certifiedAt,
        isDirectCertification: guarantor.isDirectCertification,
        certificationMethod,
        auditDetails: auditDetails ? {
          score: (auditDetails as Record<string, unknown>).score,
          patrimometerPoints: (auditDetails as Record<string, unknown>).patrimometerPoints,
        } : undefined,
      },
      diditStatus,
      tenantName: guarantor.firstName && guarantor.lastName
        ? `${guarantor.firstName} ${guarantor.lastName}`
        : guarantor.email,
      propertyAddress: (guarantor.property as Record<string, unknown>)?.address || 
        (property as Record<string, unknown> | null)?.address || null,
    });
  } catch (error) {
    console.error('Erreur récupération statut garant:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
