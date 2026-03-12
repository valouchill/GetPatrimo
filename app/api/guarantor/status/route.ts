import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '../../didit/db';
import Guarantor from '@/models/Guarantor';
import Property from '@/models/Property';

/**
 * Vérifie le statut de certification d'un garant
 */
export async function GET(request: NextRequest) {
  try {
    await connectDiditDb();
    
    const searchParams = request.nextUrl.searchParams;
    const invitationToken = searchParams.get('token');
    const applyToken = searchParams.get('applyToken'); // Token de la page apply (Property.applyToken)

    if (!invitationToken && !applyToken) {
      return NextResponse.json(
        { error: 'Token d\'invitation ou applyToken requis' },
        { status: 400 }
      );
    }

    let guarantor;
    let property = null;
    
    if (invitationToken) {
      guarantor = await Guarantor.findOne({ invitationToken }).populate('property');
      if (guarantor?.property) {
        property = guarantor.property;
      }
    } else if (applyToken) {
      // Chercher par applyToken
      guarantor = await Guarantor.findOne({ applyToken }).populate('property');
      if (!guarantor) {
        // Fallback: chercher la property et ensuite le garant
        property = await Property.findOne({ applyToken });
        if (property) {
          guarantor = await Guarantor.findOne({ property: property._id });
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
          const statusResponse = await fetch(
            `https://verification.didit.me/v2/session/${guarantor.diditSessionId}`,
            {
              headers: {
                'x-api-key': apiKey as string,
              },
            }
          );

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            diditStatus = {
              verified: statusData.status === 'VERIFIED' || statusData.verified === true,
              firstName: statusData.first_name || statusData.firstName,
              lastName: statusData.last_name || statusData.lastName,
              birthDate: statusData.birth_date || statusData.birthDate,
              humanVerified: statusData.human_verified || statusData.humanVerified,
            };

            // Si vérifié, mettre à jour le garant
            if (diditStatus.verified) {
              guarantor.status = 'CERTIFIED';
              guarantor.identityVerification = {
                status: 'CERTIFIEE',
                firstName: diditStatus.firstName || '',
                lastName: diditStatus.lastName || '',
                birthDate: diditStatus.birthDate || '',
                humanVerified: diditStatus.humanVerified || false,
                verifiedAt: new Date(),
              };
              guarantor.certifiedAt = new Date();
              await guarantor.save();
            }
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
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
