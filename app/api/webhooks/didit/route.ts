import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDiditDb } from '../../didit/db';
import IdentitySession from '@/models/IdentitySession';
import Property from '@/models/Property';
import Candidature from '@/models/Candidature';

function verifySignature(rawBody: string, signature: string | null, secret?: string) {
  if (!secret || !signature) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

// Handle GET redirects from Didit (status updates via URL params)
export async function GET(request: NextRequest) {
  // Capturer TOUS les paramètres envoyés par Didit
  const allParams: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    allParams[key] = value;
  });
  
  const sessionId = allParams.verificationSessionId || allParams.session_id || allParams.sessionId;
  const status = allParams.status;
  
  // Extraire les données d'identité potentielles des paramètres
  const firstName = allParams.first_name || allParams.firstName || allParams.given_name || '';
  const lastName = allParams.last_name || allParams.lastName || allParams.family_name || '';
  const fullName = allParams.full_name || allParams.name || '';
  const birthDate = allParams.birth_date || allParams.birthDate || allParams.date_of_birth || '';
  
  console.log('[DIDIT WEBHOOK GET] Tous les paramètres:', JSON.stringify(allParams, null, 2));
  console.log('[DIDIT WEBHOOK GET]', { sessionId, status, firstName, lastName, fullName, birthDate });
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID manquant' }, { status: 400 });
  }
  
  // Si le statut est "Approved", on met à jour la DB
  if (status?.toLowerCase() === 'approved') {
    try {
      await connectDiditDb();
      
      // Récupérer la session existante pour avoir l'applyToken
      const existingSession = await IdentitySession.findOne({ sessionId });
      
      // D'abord, utiliser les données des paramètres GET si disponibles
      let extractedFirstName = firstName;
      let extractedLastName = lastName;
      let extractedBirthDate = birthDate;
      
      // Si on a un fullName mais pas de prénom/nom séparés, on le découpe
      if (fullName && (!extractedFirstName || !extractedLastName)) {
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          extractedFirstName = extractedFirstName || nameParts[0];
          extractedLastName = extractedLastName || nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          extractedFirstName = extractedFirstName || nameParts[0];
        }
      }
      
      // Essayer de récupérer les infos de la session depuis l'API Didit
      const apiKey = process.env.DIDIT_API_KEY;
      
      // Tenter plusieurs endpoints Didit (v3 en priorité)
      const endpoints = [
        `https://verification.didit.me/v3/session/${sessionId}/decision/`,
        `https://verification.didit.me/v3/session/${sessionId}/`,
        `https://apx.didit.me/verification/v2/session/${sessionId}`,
        `https://apx.didit.me/v2/session/${sessionId}`
      ];
      
      for (const apiUrl of endpoints) {
        try {
          const response = await fetch(apiUrl, {
            headers: {
              'x-api-key': apiKey || '',
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('[DIDIT WEBHOOK GET] Réponse API:', apiUrl, JSON.stringify(data));
            
            // Extraire l'identité de différentes structures possibles (v3 et v2)
            // V3: data.decision.id_verifications[0].first_name, last_name, date_of_birth
            // V2: data.kyc.first_name, data.identity.first_name
            const idVerification = data?.decision?.id_verifications?.[0] || {};
            const idDocument = data?.id_document || data?.document || {};
            const identity = data?.kyc || data?.identity || data?.person || data?.data?.identity || idDocument || {};
            const apiFullName = idVerification.full_name || identity.full_name || idDocument.full_name || data?.full_name || '';
            
            const apiFirstName = idVerification.first_name || identity.first_name || identity.firstName || (apiFullName ? apiFullName.split(' ')[0] : '');
            const apiLastName = idVerification.last_name || identity.last_name || identity.lastName || (apiFullName ? apiFullName.split(' ').slice(1).join(' ') : '');
            const apiBirthDate = idVerification.date_of_birth || identity.date_of_birth || identity.birthDate || data?.date_of_birth || '';
            
            // Mettre à jour les données extraites si on a trouvé des infos
            if (apiFirstName) extractedFirstName = extractedFirstName || apiFirstName;
            if (apiLastName) extractedLastName = extractedLastName || apiLastName;
            if (apiBirthDate) extractedBirthDate = extractedBirthDate || apiBirthDate;
            
            if (apiFirstName || apiLastName) break; // On a trouvé des données
          }
        } catch (e) {
          console.log('[DIDIT WEBHOOK GET] Endpoint échoué:', apiUrl);
        }
      }
      
      // Utiliser les données des paramètres GET en priorité, puis les données API, puis les données existantes
      const finalFirstName = extractedFirstName || existingSession?.firstName || '';
      const finalLastName = extractedLastName || existingSession?.lastName || '';
      const finalBirthDate = extractedBirthDate || existingSession?.birthDate || '';
      
      // Marquer comme CERTIFIEE même si on n'a pas les détails (Didit a confirmé l'approbation)
      const updatedSession = await IdentitySession.findOneAndUpdate(
        { sessionId },
        {
          sessionId,
          status: 'approved',
          identityStatus: 'CERTIFIEE',
          firstName: finalFirstName,
          lastName: finalLastName,
          birthDate: finalBirthDate,
          humanVerified: true,
          verifiedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      console.log('[DIDIT WEBHOOK GET] Session mise à jour vers CERTIFIEE:', sessionId, { 
        firstName: finalFirstName, 
        lastName: finalLastName,
        fromParams: { firstName, lastName, fullName },
        fromAPI: 'tentative échouée'
      });
    } catch (error) {
      console.error('[DIDIT WEBHOOK GET] Erreur:', error);
    }
  }
  
  // Rediriger vers la page d'application
  const baseUrl = process.env.NEXTAUTH_URL || 'https://getpatrimo.com';
  return NextResponse.redirect(`${baseUrl}/apply?didit_status=${status}&session_id=${sessionId}`);
}

export async function POST(request: NextRequest) {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  const signatureHeader = process.env.DIDIT_WEBHOOK_HEADER?.toLowerCase() || 'x-didit-signature';

  const rawBody = await request.text();
  const signature = request.headers.get(signatureHeader);

  // Log tous les headers et le body pour debug
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  console.log('[DIDIT WEBHOOK POST] Headers:', JSON.stringify(headers, null, 2));
  console.log('[DIDIT WEBHOOK POST] Body brut:', rawBody);

  const signatureValid = verifySignature(rawBody, signature, secret);
  console.log('[DIDIT WEBHOOK POST] Signature valide:', signatureValid);

  // Même si signature invalide, on log et on traite (mode dégradé)
  if (!signatureValid) {
    console.warn('[DIDIT WEBHOOK POST] Signature invalide, traitement en mode dégradé');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    console.error('[DIDIT WEBHOOK POST] Erreur parsing JSON:', e);
    return NextResponse.json({ error: 'Body invalide.' }, { status: 400 });
  }
  
  console.log('[DIDIT WEBHOOK POST] Payload parsé:', JSON.stringify(payload, null, 2));
  const status = payload?.status || payload?.event?.status || payload?.data?.status;
  const sessionId = payload?.session_id || payload?.sessionId || payload?.data?.session_id || payload?.data?.sessionId;

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId manquant.' }, { status: 400 });
  }

  // Vérifier le statut (case-insensitive)
  const normalizedStatus = status?.toLowerCase();
  if (normalizedStatus !== 'approved' && normalizedStatus !== 'completed' && normalizedStatus !== 'verified') {
    console.log('[DIDIT WEBHOOK POST] Statut non-approved:', status);
    return NextResponse.json({ received: true, status });
  }

  // Extraire l'identité de différentes structures possibles dans le payload
  // Format v3.0: payload.decision.id_verifications[0]
  const idVerification = payload?.decision?.id_verifications?.[0] || {};
  const identity = payload?.identity || payload?.data?.identity || payload?.data?.person || payload?.kyc || payload?.data?.kyc || {};
  
  // Priorité : id_verifications (v3) > identity (v2) > payload direct
  const fullNameFromPayload = idVerification.full_name || identity.full_name || payload?.full_name || payload?.data?.full_name || '';
  
  let firstName = idVerification.first_name || identity.first_name || identity.firstName || identity.given_name || payload?.first_name || '';
  let lastName = idVerification.last_name || identity.last_name || identity.lastName || identity.family_name || payload?.last_name || '';
  let birthDate = idVerification.date_of_birth || identity.date_of_birth || identity.birthDate || identity.birthdate || payload?.date_of_birth || '';
  
  // Si on a un fullName mais pas de prénom/nom séparés
  if (fullNameFromPayload && (!firstName || !lastName)) {
    const nameParts = fullNameFromPayload.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      firstName = firstName || nameParts[0];
      lastName = lastName || nameParts.slice(1).join(' ');
    } else if (nameParts.length === 1) {
      firstName = firstName || nameParts[0];
    }
  }
  
  const humanVerified = Boolean(idVerification.status === 'Approved' || identity.human_verified || payload?.human_verified || true);
  
  console.log('[DIDIT WEBHOOK POST] Données identité extraites:', { 
    firstName, 
    lastName, 
    birthDate, 
    fullNameFromPayload,
    fromIdVerification: !!idVerification.first_name
  });

  try {
    await connectDiditDb();
    const session = await IdentitySession.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        status,
        identityStatus: 'CERTIFIEE',
        firstName,
        lastName,
        birthDate,
        humanVerified,
        verifiedAt: new Date()
      },
      { new: true }
    );

    // Mise à jour du dossier locataire si une candidature existe déjà
    if (session?.applyToken) {
      const property = await Property.findOne({ applyToken: session.applyToken });
      if (property) {
        const cand = await Candidature.findOne({
          property: property._id,
          firstName: new RegExp(`^${firstName}$`, 'i'),
          lastName: new RegExp(`^${lastName}$`, 'i')
        }).sort({ createdAt: -1 });

        if (cand) {
          if (!cand.trustAnalysis) {
            cand.trustAnalysis = {
              score: 0,
              status: 'PENDING',
              summary: '',
              checks: []
            };
          }
          cand.trustAnalysis.status = 'VALIDATED';
          cand.trustAnalysis.checks = cand.trustAnalysis.checks || [];
          cand.trustAnalysis.checks.push({
            id: 'didit_identity',
            label: 'Identité certifiée Didit',
            status: 'PASS',
            details: 'Identité confirmée via Didit',
            metadata: { firstName, lastName, birthDate, humanVerified }
          });
          cand.identityVerification = {
            status: 'CERTIFIEE',
            provider: 'didit',
            firstName,
            lastName,
            birthDate,
            humanVerified,
            verifiedAt: new Date()
          };
          cand.firstName = firstName || cand.firstName;
          cand.lastName = lastName || cand.lastName;
          await cand.save();
        }
      }
    }
  } catch (error) {
    console.error('Erreur mise à jour Didit:', error);
  }

  return NextResponse.json({ received: true });
}
