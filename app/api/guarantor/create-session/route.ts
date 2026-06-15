import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '../../didit/db';
import { logger } from '@/lib/server-logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { isInvitationClosed } from '@/lib/invitation-validity';
import Guarantor from '@/models/Guarantor';
import Property from '@/models/Property';
 
const {
  normalizeSlot,
  resolveGuarantorWebhookUrl,
} = require('@/src/utils/guarantorDidit');

/**
 * Crée une session Didit pour un garant
 * Utilise la même logique que la session locataire mais enregistre dans Guarantor
 */
export async function POST(request: NextRequest) {
  // Anti-abus (pré-lancement) : création de session KYC garant (endpoint public). Borne par IP.
  // Sécurité (pentest public-7/config-1) : on prend le DERNIER hop du X-Forwarded-For (ajouté
  // par NPM) — le premier élément est contrôlé par le client (rotation d'IP pour contourner).
  const ip = request.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).pop() || 'unknown';
  if (!checkRateLimit(`guarantor-session:${ip}`, { windowMs: 60_000, max: 10 }).allowed) {
    return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
  }
  // Lire le body une seule fois au début
  let body: { invitationToken?: string; applyToken?: string; email?: string; firstName?: string; lastName?: string; slot?: number | string };
  try {
    body = await request.json();
    // Sécurité (pentest ChatGPT P2 — PII) : ne pas logger le body (email/nom/prénom du garant).
    // On ne trace que la forme de la requête (présence de tokens / slot), jamais les valeurs PII.
    logger.info('[GUARANTOR CREATE-SESSION] Body reçu', {
      hasInvitationToken: !!body?.invitationToken,
      hasApplyToken: !!(body?.applyToken || (body as { candidatureId?: string })?.candidatureId),
      hasEmail: !!body?.email,
      slot: body?.slot,
    });
  } catch (parseError) {
    logger.error('[GUARANTOR CREATE-SESSION] Erreur parsing JSON', { error: parseError instanceof Error ? parseError.message : parseError });
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  try {
    await connectDiditDb();
    // Accepter candidatureId comme alias de applyToken pour compatibilité
    const { invitationToken, applyToken, candidatureId, email, firstName, lastName, slot } = body as { 
      invitationToken?: string; 
      applyToken?: string; 
      candidatureId?: string;
      email?: string; 
      firstName?: string; 
      lastName?: string;
      slot?: number | string;
    };
    // Sécurité (revue V1 — S9) : endpoint public + mongoSanitize est Express-only →
    // on rejette tout champ non-string (anti-injection d'opérateur NoSQL).
    for (const [k, v] of Object.entries({ invitationToken, applyToken, candidatureId, email })) {
      if (v != null && typeof v !== 'string') {
        return NextResponse.json({ error: `Paramètre invalide: ${k}` }, { status: 400 });
      }
    }
    const effectiveApplyToken = applyToken || candidatureId;
    const normalizedSlot = normalizeSlot(slot) || 1;
    logger.info('[GUARANTOR CREATE-SESSION] Tokens', { invitationToken, applyToken: effectiveApplyToken });

    // Si invitationToken, chercher le garant existant
    // Sinon, créer un nouveau garant pour l'option "En Direct"
    let guarantor;
    
    if (invitationToken) {
      guarantor = await Guarantor.findOne({ invitationToken });
      if (!guarantor) {
        return NextResponse.json(
          { error: 'Garant introuvable ou token invalide' },
          { status: 404 }
        );
      }
      // Sécurité (pentest ChatGPT P2) : un token expiré/révoqué ne peut plus ouvrir de session KYC.
      if (isInvitationClosed(guarantor)) {
        return NextResponse.json({ error: 'Invitation expirée ou révoquée.' }, { status: 410 });
      }
    } else if (effectiveApplyToken && email) {
      // Option "En Direct" : créer ou trouver le garant pour cette Property
      const crypto = await import('crypto');
      const invitationTokenNew = crypto.randomBytes(32).toString('hex');
      
      // Trouver la Property
      const property = await Property.findOne({ applyToken: effectiveApplyToken });
      if (!property) {
        return NextResponse.json(
          { error: 'Bien immobilier introuvable' },
          { status: 404 }
        );
      }
      
      guarantor = await Guarantor.findOne({
        applyToken: effectiveApplyToken,
        email: email.toLowerCase(),
        slot: normalizedSlot,
      });

      if (!guarantor) {
        guarantor = await Guarantor.findOne({
          applyToken: effectiveApplyToken,
          email: email.toLowerCase(),
        });
      }
      
      if (!guarantor) {
        guarantor = new Guarantor({
          property: property._id,
          applyToken: effectiveApplyToken,
          slot: normalizedSlot,
          email: email.toLowerCase(),
          firstName: firstName || '',
          lastName: lastName || '',
          status: 'PENDING',
          invitationToken: invitationTokenNew,
          isDirectCertification: true,
        });
        await guarantor.save();
      } else {
        guarantor.slot = guarantor.slot === 2 ? 2 : normalizedSlot;
        guarantor.isDirectCertification = true;
        if (firstName) guarantor.firstName = firstName;
        if (lastName) guarantor.lastName = lastName;
        await guarantor.save();
      }
    } else {
      return NextResponse.json(
        { error: 'Token d\'invitation ou applyToken/candidatureId + email requis' },
        { status: 400 }
      );
    }

    // Créer une session Didit pour le garant
    const apiKey = process.env.DIDIT_API_KEY || process.env.DIDIT_CLIENT_SECRET;
    const workflowId = process.env.DIDIT_WORKFLOW_ID || process.env.DIDIT_CLIENT_ID;
    const webhookUrl = resolveGuarantorWebhookUrl({
      configuredGuarantorWebhookUrl: process.env.DIDIT_GUARANTOR_WEBHOOK_URL,
      origin: process.env.NEXTAUTH_URL || request.nextUrl.origin,
    });

    if (!apiKey || !workflowId) {
      return NextResponse.json({
        sessionId: null,
        verificationUrl: null,
        fallbackMode: true,
        message: 'Vérification Didit non disponible.'
      });
    }

    // Sécurité (pentest public-7) : quota DUR par bien sur les sessions KYC Didit (facturées),
    // vérifié AVANT l'appel Didit — anti-DoS de coût via création anonyme en masse.
    const quotaKey = `guarantor-kyc-quota:${guarantor.applyToken || 'unknown'}`;
    if (!checkRateLimit(quotaKey, { windowMs: 86_400_000, max: 15 }).allowed) {
      return NextResponse.json({ error: 'Quota de vérifications atteint pour ce dossier. Réessayez demain.' }, { status: 429 });
    }

    // Récupérer le token du garant
    const guarantorToken = guarantor.invitationToken || invitationToken;

    // Appeler l'API Didit pour créer une session
    const diditResponse = await fetch('https://verification.didit.me/v2/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        reference: `guarantor-${guarantor._id}-slot-${guarantor.slot || normalizedSlot}`,
        redirect_url: `${request.nextUrl.origin}/verify-guarantor/${guarantorToken}?didit_callback=1`,
        webhook_url: webhookUrl,
      }),
    });

    if (!diditResponse.ok) {
      const errorData = await diditResponse.json().catch(() => ({}));
      logger.error('Erreur création session Didit garant', { error: errorData });
      return NextResponse.json(
        { error: 'Erreur lors de la création de la session Didit' },
        { status: 500 }
      );
    }

    const diditData = await diditResponse.json();
    const sessionId = diditData.session_id || diditData.id;

    // Enregistrer la session Didit dans le garant
    guarantor.diditSessionId = sessionId;
    await guarantor.save();

    return NextResponse.json({
      sessionId,
      slot: guarantor.slot || normalizedSlot,
      verificationUrl: diditData.verification_url || diditData.url,
      qrCode: diditData.qr_code,
      fallbackMode: false,
    });
  } catch (error) {
    logger.error('Erreur création session garant', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
