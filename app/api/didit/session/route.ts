import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '../db';
import { logger } from '@/lib/server-logger';
import IdentitySession from '@/models/IdentitySession';

// Liste des endpoints Didit à essayer (ordre de priorité)
const DIDIT_ENDPOINTS = [
  'https://apx.didit.me/verification/v2/session',
  'https://verification.didit.me/v2/session',
  'https://api.didit.me/v2/session',
  'https://apx.didit.me/v2/session',
];

export async function POST(request: NextRequest) {
  // Nouveau format de configuration Didit
  const apiKey = process.env.DIDIT_API_KEY || process.env.DIDIT_CLIENT_SECRET;
  const workflowId = process.env.DIDIT_WORKFLOW_ID || process.env.DIDIT_CLIENT_ID;
  const webhookUrl = process.env.DIDIT_WEBHOOK_URL || `${request.nextUrl.origin}/api/webhooks/didit`;

  let body: { reference?: string; token?: string } = {};
  try {
    body = await request.json();
  } catch (error) {
    // Body vide ou invalide, on continue avec un objet vide
    logger.warn('Body Didit session vide ou invalide', { error: error instanceof Error ? error.message : error });
  }
  
  const reference = body.reference || body.token || 'apply-session';

  // Si les credentials Didit ne sont pas configurées, mode dégradé
  if (!apiKey || !workflowId) {
    logger.warn('Didit non configuré (API_KEY ou WORKFLOW_ID manquant), mode dégradé activé');
    return NextResponse.json({
      sessionId: null,
      clientId: null,
      verificationUrl: null,
      qrCode: null,
      fallbackMode: true,
      message: 'Vérification Didit non disponible. Veuillez télécharger votre pièce d\'identité manuellement.'
    });
  }

  // Essayer chaque endpoint jusqu'à ce qu'un fonctionne
  let lastError: string = '';
  
  for (const endpoint of DIDIT_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      logger.info('Tentative Didit', { endpoint });
      
      const sessionResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          workflow_id: workflowId,
          callback: webhookUrl,
          vendor_data: reference,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (sessionResponse.ok) {
        const data = await sessionResponse.json();
        const sessionId = data?.session_id || data?.id || data?.uuid;
        const verificationUrl = data?.verification_url || data?.url || data?.redirect_url;

        if (sessionId) {
          logger.info('Session Didit créée', { endpoint, sessionId });

          // Coût RÉEL d'une vérification Didit (forfait eIDAS) — fire-and-forget,
          // n'interrompt jamais la création de session.
          try {
             
            const { recordFlatCost, FLAT_COST_EUR } = require('@/src/services/api-cost-logger');
            recordFlatCost({
              provider: 'Didit',
              category: 'KYC',
              costEur: FLAT_COST_EUR.diditKyc,
              model: 'eIDAS',
              meta: { sessionId, applyToken: reference },
            });
          } catch {
            /* fire-and-forget */
          }

          try {
            await connectDiditDb();
            await IdentitySession.findOneAndUpdate(
              { sessionId },
              { sessionId, applyToken: reference, status: 'PENDING', identityStatus: 'PENDING' },
              { upsert: true, new: true }
            );
          } catch (dbError) {
            logger.error('Erreur DB Didit', { error: dbError instanceof Error ? dbError.message : dbError });
          }

          return NextResponse.json({
            sessionId,
            clientId: workflowId,
            verificationUrl,
            qrCode: data?.qr_code || data?.qrCode,
            fallbackMode: false,
          });
        }
      }
      
      const errorData = await sessionResponse.json().catch(() => ({}));
      lastError = `${endpoint}: ${sessionResponse.status} - ${JSON.stringify(errorData)}`;
      logger.warn('Endpoint Didit échoué', { error: lastError });
      
    } catch (error) {
      lastError = `${endpoint}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
      logger.warn('Erreur endpoint Didit', { error: lastError });
    }
  }

  // Tous les endpoints ont échoué, mode dégradé
  logger.error('Tous les endpoints Didit ont échoué', { lastError });
  
  return NextResponse.json({
    sessionId: null,
    clientId: null,
    verificationUrl: null,
    qrCode: null,
    fallbackMode: true,
    message: 'Service Didit non disponible. Veuillez télécharger votre pièce d\'identité manuellement.'
  });
}
