import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '../db';
import { logger } from '@/lib/server-logger';
import { checkRateLimit } from '@/lib/rate-limit';
import IdentitySession from '@/models/IdentitySession';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  // Sécurité (pentest injection-3) : format strict (allowlist) — empêche l'injection de
  // chemin dans les URLs de l'API Didit et borne l'oracle (pentest public-10).
  if (!sessionId || !/^[A-Za-z0-9_-]{8,128}$/.test(sessionId)) {
    return NextResponse.json({ verified: false });
  }
  // Anti-abus (pentest public-10/injection-3) : la route interroge l'API Didit + renvoie un
  // statut d'identité — borner par IP.
  const rlIp = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
  if (!checkRateLimit(`didit-status:${rlIp}`, { windowMs: 60_000, max: 30 }).allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  try {
    await connectDiditDb();
  } catch (error) {
    logger.error('Erreur connexion DB Didit', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ verified: false });
  }

  // D'abord vérifier dans la DB locale
  let verification = await IdentitySession.findOne({ sessionId });
  
  // Si pas encore certifié, interroger l'API Didit directement
  if (!verification || verification.identityStatus !== 'CERTIFIEE') {
    try {
      const apiKey = process.env.DIDIT_API_KEY;
      
      // Utiliser l'endpoint v3 pour récupérer les données de session
      const endpoints = [
        `https://verification.didit.me/v3/session/${sessionId}/decision/`,
        `https://verification.didit.me/v3/session/${sessionId}/`,
        `https://apx.didit.me/verification/v2/session/${sessionId}`,
        `https://apx.didit.me/v2/session/${sessionId}`
      ];
      
      logger.info('[DIDIT STATUS] Interrogation API Didit pour session', { sessionId });
      
      let response: Response | null = null;
      let successEndpoint = '';
      
      for (const apiUrl of endpoints) {
        try {
          const tempResponse = await fetch(apiUrl, {
            headers: {
              'x-api-key': apiKey || '',
              'Accept': 'application/json'
            },
            cache: 'no-store'
          });
          
          if (tempResponse.ok) {
            response = tempResponse;
            successEndpoint = apiUrl;
            break;
          } else {
            const errorText = await tempResponse.text();
            logger.info('[DIDIT STATUS] Endpoint failed', { apiUrl, status: tempResponse.status, errorText });
          }
        } catch (e) {
          logger.error('[DIDIT STATUS] Endpoint error', { apiUrl, error: e instanceof Error ? e.message : e });
        }
      }
      
      if (!response) {
        logger.warn('[DIDIT STATUS] Tous les endpoints ont échoué');
      }
      
      if (response) {
        const data = await response.json();
        // Sécurité (pentest ChatGPT P2 — PII/KYC) : NE JAMAIS logger le payload Didit complet
        // (nom, prénom, date de naissance, n° de pièce d'identité). On ne trace que le statut.
        logger.info('[DIDIT STATUS] Réponse API Didit', { endpoint: successEndpoint, status: data?.status });
        
        // Vérifier si le statut est "Approved" ou équivalent
        // V3: data.status peut être "Approved", "Completed", etc.
        // V3 decision: data.decision peut être "approved", "rejected"
        const diditStatus = (data?.status || data?.decision || '').toLowerCase();
        const isApproved = diditStatus === 'approved' || diditStatus === 'completed' || diditStatus === 'verified' || diditStatus === 'success';
        
        if (isApproved) {
          // Extraire les informations d'identité (v3 et v2)
          // V3: data.decision.id_verifications[0].first_name, last_name, date_of_birth
          // V2: data.kyc.first_name, data.identity.first_name
          const idVerification = data?.decision?.id_verifications?.[0] || {};
          const idDocument = data?.id_document || data?.document || {};
          const identity = data?.kyc || data?.identity || data?.person || idDocument || {};
          const fullName = idVerification.full_name || identity.full_name || idDocument.full_name || data?.full_name || '';
          const nameParts = fullName.split(' ');
          
          const firstName = idVerification.first_name || idDocument.first_name || identity.first_name || identity.firstName || nameParts[0] || '';
          const lastName = idVerification.last_name || idDocument.last_name || identity.last_name || identity.lastName || nameParts.slice(1).join(' ') || '';
          const birthDate = idVerification.date_of_birth || idDocument.date_of_birth || identity.date_of_birth || identity.birthDate || data?.date_of_birth || '';
          
          // Mettre à jour la base de données locale
          verification = await IdentitySession.findOneAndUpdate(
            { sessionId },
            {
              sessionId,
              status: 'approved',
              identityStatus: 'CERTIFIEE',
              firstName,
              lastName,
              birthDate,
              humanVerified: true,
              verifiedAt: new Date()
            },
            { upsert: true, new: true }
          );
          
          logger.info('[DIDIT STATUS] Session mise à jour vers CERTIFIEE', { sessionId });
          
          return NextResponse.json({
            verified: true,
            firstName,
            lastName,
            birthDate,
            humanVerified: true,
          });
        } else {
          // Retourner le statut actuel de Didit
          return NextResponse.json({ 
            verified: false, 
            status: data?.status || 'PENDING',
            diditStatus: data?.status
          });
        }
      }
      // Si aucun endpoint n'a fonctionné, le log a déjà été fait dans la boucle
    } catch (apiError) {
      logger.error('[DIDIT STATUS] Erreur API Didit', { error: apiError instanceof Error ? apiError.message : apiError });
    }
    
    // Si l'API Didit ne répond pas mais la session locale est CERTIFIEE, retourner les données
    if (verification && verification.identityStatus === 'CERTIFIEE') {
      return NextResponse.json({
        verified: true,
        firstName: verification.firstName || '',
        lastName: verification.lastName || '',
        birthDate: verification.birthDate || '',
        humanVerified: Boolean(verification.humanVerified),
      });
    }
    
    // Fallback vers la DB locale
    return NextResponse.json({ verified: false, status: verification?.status || 'PENDING' });
  }

  return NextResponse.json({
    verified: true,
    firstName: verification.firstName,
    lastName: verification.lastName,
    birthDate: verification.birthDate,
    humanVerified: verification.humanVerified,
  });
}
