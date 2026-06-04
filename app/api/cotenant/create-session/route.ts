import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '../../didit/db';
import { logger } from '@/lib/server-logger';
import CoTenant from '@/models/CoTenant';
import Property from '@/models/Property';
 
const { normalizeSlot } = require('@/src/utils/guarantorDidit');

/** Crée une session Didit pour un colocataire (clone de guarantor/create-session). */
export async function POST(request: NextRequest) {
  let body: {
    invitationToken?: string;
    applyToken?: string;
    applicationId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    slot?: number | string;
  };
  try {
    body = await request.json();
  } catch (parseError) {
    logger.error('[COTENANT CREATE-SESSION] JSON invalide', {
      error: parseError instanceof Error ? parseError.message : parseError,
    });
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  try {
    await connectDiditDb();
    const { invitationToken, applyToken, applicationId, email, firstName, lastName, slot } = body;
    const normalizedSlot = normalizeSlot(slot) || 2;

    let coTenant;
    if (invitationToken) {
      coTenant = await CoTenant.findOne({ invitationToken });
      if (!coTenant) {
        return NextResponse.json({ error: 'Colocataire introuvable ou token invalide' }, { status: 404 });
      }
    } else if (applyToken && email) {
      // Option "En Direct" : créer/retrouver le colocataire pour ce bien + slot.
      const crypto = await import('crypto');
      const property = await Property.findOne({ applyToken });
      if (!property) {
        return NextResponse.json({ error: 'Bien immobilier introuvable' }, { status: 404 });
      }
      coTenant =
        (await CoTenant.findOne({ applyToken, email: email.toLowerCase(), slot: normalizedSlot })) ||
        (await CoTenant.findOne({ applyToken, email: email.toLowerCase() }));
      if (!coTenant) {
        coTenant = new CoTenant({
          applicationId: applicationId || undefined,
          property: property._id,
          applyToken,
          slot: normalizedSlot,
          email: email.toLowerCase(),
          firstName: firstName || '',
          lastName: lastName || '',
          status: 'PENDING',
          invitationToken: crypto.randomBytes(32).toString('hex'),
          isDirectCertification: true,
        });
        await coTenant.save();
      } else {
        coTenant.isDirectCertification = true;
        if (applicationId && !coTenant.applicationId) coTenant.applicationId = applicationId;
        if (firstName) coTenant.firstName = firstName;
        if (lastName) coTenant.lastName = lastName;
        await coTenant.save();
      }
    } else {
      return NextResponse.json(
        { error: "Token d'invitation ou applyToken + email requis" },
        { status: 400 },
      );
    }

    const apiKey = process.env.DIDIT_API_KEY || process.env.DIDIT_CLIENT_SECRET;
    const workflowId = process.env.DIDIT_WORKFLOW_ID || process.env.DIDIT_CLIENT_ID;
    const webhookUrl =
      process.env.DIDIT_COTENANT_WEBHOOK_URL ||
      `${process.env.NEXTAUTH_URL || request.nextUrl.origin}/api/webhooks/didit/cotenant`;

    if (!apiKey || !workflowId) {
      return NextResponse.json({
        sessionId: null,
        verificationUrl: null,
        fallbackMode: true,
        message: 'Vérification Didit non disponible.',
      });
    }

    const token = coTenant.invitationToken || invitationToken;
    const diditResponse = await fetch('https://verification.didit.me/v2/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        workflow_id: workflowId,
        reference: `cotenant-${coTenant._id}-slot-${coTenant.slot || normalizedSlot}`,
        redirect_url: `${request.nextUrl.origin}/verify-cotenant/${token}?didit_callback=1`,
        webhook_url: webhookUrl,
      }),
    });

    if (!diditResponse.ok) {
      const errorData = await diditResponse.json().catch(() => ({}));
      logger.error('Erreur création session Didit colocataire', { error: errorData });
      return NextResponse.json({ error: 'Erreur lors de la création de la session Didit' }, { status: 500 });
    }

    const diditData = await diditResponse.json();
    const sessionId = diditData.session_id || diditData.id;
    coTenant.diditSessionId = sessionId;
    await coTenant.save();

    return NextResponse.json({
      sessionId,
      slot: coTenant.slot || normalizedSlot,
      verificationUrl: diditData.verification_url || diditData.url,
      qrCode: diditData.qr_code,
      fallbackMode: false,
    });
  } catch (error) {
    logger.error('Erreur création session colocataire', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
