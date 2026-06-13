import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/server-logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { connectDiditDb } from '../../didit/db';
import IdentitySession from '@/models/IdentitySession';
import Property from '@/models/Property';
import Candidature from '@/models/Candidature';
 
const {
  buildDiditCompletionUrl,
  renderDiditCompletionHtml,
} = require('@/src/utils/diditCompletion');

function verifySignature(rawBody: string, signature: string | null, secret?: string) {
  if (!secret || !signature) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

// Handle GET redirects from Didit (status updates via URL params)
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
  const { allowed } = checkRateLimit(`webhook-get:${ip}`, { windowMs: 60_000, max: 30 });
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  const allParams: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    allParams[key] = value;
  });
  
  const sessionId = allParams.verificationSessionId || allParams.session_id || allParams.sessionId;
  const status = allParams.status;

  logger.info('[DIDIT WEBHOOK GET] Paramètres', { sessionId, status });
  
  // Sécurité (audit passe-5) : sessionId est interpolé dans 4 URLs fetch vers l'API Didit.
  // Sans validation de format, des caractères de chemin (« / », « .. », « @ »…) permettaient
  // une path-injection / SSRF. On impose la même allowlist stricte que /api/didit/status.
  if (!sessionId || !/^[A-Za-z0-9_-]{8,128}$/.test(sessionId)) {
    return NextResponse.json({ error: 'Session ID manquant ou invalide' }, { status: 400 });
  }

  // Si le statut est "Approved", on met à jour la DB
  let existingSession = null;

  if (status?.toLowerCase() === 'approved') {
    try {
      await connectDiditDb();
      
      // Récupérer la session existante pour avoir l'applyToken
      existingSession = await IdentitySession.findOne({ sessionId });

      // Récupérer les infos d'identité UNIQUEMENT depuis l'API Didit (source de confiance)
      // Ne JAMAIS utiliser les query params comme source de données d'identité
      let extractedFirstName = '';
      let extractedLastName = '';
      let extractedBirthDate = '';

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
            logger.info('[DIDIT WEBHOOK GET] Réponse API', { apiUrl });

            const idVerification = data?.decision?.id_verifications?.[0] || {};
            const idDocument = data?.id_document || data?.document || {};
            const identity = data?.kyc || data?.identity || data?.person || data?.data?.identity || idDocument || {};
            const apiFullName = idVerification.full_name || identity.full_name || idDocument.full_name || data?.full_name || '';

            extractedFirstName = idVerification.first_name || identity.first_name || identity.firstName || (apiFullName ? apiFullName.split(' ')[0] : '');
            extractedLastName = idVerification.last_name || identity.last_name || identity.lastName || (apiFullName ? apiFullName.split(' ').slice(1).join(' ') : '');
            extractedBirthDate = idVerification.date_of_birth || identity.date_of_birth || identity.birthDate || data?.date_of_birth || '';

            if (extractedFirstName || extractedLastName) break;
          }
        } catch (e) {
          logger.info('[DIDIT WEBHOOK GET] Endpoint échoué', { apiUrl });
        }
      }

      // Utiliser les données API, puis les données existantes en session
      const finalFirstName = extractedFirstName || existingSession?.firstName || '';
      const finalLastName = extractedLastName || existingSession?.lastName || '';
      const finalBirthDate = extractedBirthDate || existingSession?.birthDate || '';

      // SÉCURITÉ : ne marquer CERTIFIEE que si l'API Didit a confirmé l'identité
      // (au moins un nom extrait de l'API). Sinon, on ne fait confiance qu'au POST signé.
      if (extractedFirstName || extractedLastName) {
        await IdentitySession.findOneAndUpdate(
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
        logger.info('[DIDIT WEBHOOK GET] Session certifiée via API Didit', { sessionId });
      } else {
        // L'API n'a pas confirmé — on met à jour le statut redirect seulement (pas CERTIFIEE)
        // La certification se fera via le webhook POST signé
        await IdentitySession.findOneAndUpdate(
          { sessionId },
          {
            sessionId,
            status: 'pending_confirmation',
          },
          { upsert: true, new: true }
        );
        logger.info('[DIDIT WEBHOOK GET] API non confirmée, en attente du webhook POST signé', { sessionId });
      }
    } catch (error) {
      logger.error('[DIDIT WEBHOOK GET] Erreur', { error: error instanceof Error ? error.message : error });
    }
  }
  
  if (!existingSession) {
    try {
      await connectDiditDb();
      existingSession = await IdentitySession.findOne({ sessionId });
    } catch (error) {
      logger.error('[DIDIT WEBHOOK GET] Impossible de relire la session', { error: error instanceof Error ? error.message : error });
    }
  }

  const baseUrl = (process.env.NEXTAUTH_URL || request.nextUrl.origin).replace(/\/+$/, '');
  const appOrigin = new URL(baseUrl).origin;
  const applyToken =
    existingSession?.applyToken ||
    allParams.vendor_data ||
    allParams.reference ||
    allParams.token ||
    '';
  const redirectUrl = buildDiditCompletionUrl(baseUrl, applyToken, status, sessionId);
  const acceptsHtml = (request.headers.get('accept') || '').includes('text/html');

  if (acceptsHtml) {
    const html = renderDiditCompletionHtml({
      status,
      sessionId,
      redirectUrl,
      appOrigin,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
  const { allowed } = checkRateLimit(`webhook-post:${ip}`, { windowMs: 60_000, max: 30 });
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
  }

  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  const signatureHeader = process.env.DIDIT_WEBHOOK_HEADER?.toLowerCase() || 'x-didit-signature';

  const rawBody = await request.text();
  const signature = request.headers.get(signatureHeader);

  const signatureValid = verifySignature(rawBody, signature, secret);
  logger.info('[DIDIT WEBHOOK POST] Signature valide', { signatureValid });

  if (!signatureValid) {
    logger.warn('[DIDIT WEBHOOK POST] Signature invalide — requête rejetée');
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    logger.error('[DIDIT WEBHOOK POST] Erreur parsing JSON', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: 'Body invalide.' }, { status: 400 });
  }
  
  const status = payload?.status || payload?.event?.status || payload?.data?.status;
  const sessionId = payload?.session_id || payload?.sessionId || payload?.data?.session_id || payload?.data?.sessionId;

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId manquant.' }, { status: 400 });
  }

  // Vérifier le statut (case-insensitive)
  const normalizedStatus = status?.toLowerCase();
  if (normalizedStatus !== 'approved' && normalizedStatus !== 'completed' && normalizedStatus !== 'verified') {
    logger.info('[DIDIT WEBHOOK POST] Statut non-approved', { status });
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
  
  // Sécurité (re-audit V1 — N7) : ne PAS forcer humanVerified à true (le « || true »
  // rendait le signal de vérification humaine toujours vrai). Dérivé du résultat réel.
  const humanVerified = Boolean(idVerification.status === 'Approved' || identity.human_verified || payload?.human_verified);

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
        // Sécurité (revue V1 — S26) : échapper les métacaractères regex (les noms
        // viennent de la vérification Didit) — évite ReDoS / sur-correspondance.
        const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cand = await Candidature.findOne({
          property: property._id,
          firstName: new RegExp(`^${escRe(String(firstName || ''))}$`, 'i'),
          lastName: new RegExp(`^${escRe(String(lastName || ''))}$`, 'i')
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
          // Sécurité (pentest webhooks-3) : idempotence — un event signé rejoué ne doit pas
          // empiler plusieurs fois le check didit_identity.
          if (!cand.trustAnalysis.checks.some((c: any) => c && c.id === 'didit_identity')) {
            cand.trustAnalysis.checks.push({
              id: 'didit_identity',
              label: 'Identité certifiée Didit',
              status: 'PASS',
              details: 'Identité confirmée via Didit',
              metadata: { firstName, lastName, birthDate, humanVerified }
            });
          }
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
    logger.error('Erreur mise à jour Didit', { error: error instanceof Error ? error.message : error });
  }

  return NextResponse.json({ received: true });
}
