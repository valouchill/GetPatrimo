import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '../db';
import IdentitySession from '@/models/IdentitySession';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ verified: false });
  }

  try {
    await connectDiditDb();
  } catch (error) {
    console.error('Erreur connexion DB Didit:', error);
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
      
      console.log('[DIDIT STATUS] Interrogation API Didit pour session:', sessionId);
      
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
            console.log(`[DIDIT STATUS] Endpoint ${apiUrl} failed:`, tempResponse.status, errorText);
          }
        } catch (e) {
          console.log(`[DIDIT STATUS] Endpoint ${apiUrl} error:`, e);
        }
      }
      
      if (!response) {
        console.log('[DIDIT STATUS] Tous les endpoints ont échoué');
      }
      
      if (response) {
        const data = await response.json();
        console.log('[DIDIT STATUS] Réponse API Didit via', successEndpoint, ':', JSON.stringify(data, null, 2));
        
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
          
          console.log('[DIDIT STATUS] Session mise à jour vers CERTIFIEE:', sessionId);
          
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
      console.error('[DIDIT STATUS] Erreur API Didit:', apiError);
    }
    
    // Si l'API Didit ne répond pas mais la session locale est CERTIFIEE, retourner les données
    if (verification && verification.identityStatus === 'CERTIFIEE') {
      return NextResponse.json({
        verified: true,
        firstName: verification.firstName || '',
        lastName: verification.lastName || '',
        birthDate: verification.birthDate || '',
        humanVerified: verification.humanVerified || true,
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
