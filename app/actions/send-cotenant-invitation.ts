'use server';

import crypto from 'crypto';
import { sendMailWithRetry } from '@/lib/email-retry';
import CoTenant from '@/models/CoTenant';
import Property from '@/models/Property';
import Application from '@/models/Application';
import { connectDiditDb } from '@/app/api/didit/db';
import { actionRateLimited } from '@/lib/action-rate-limit';

/**
 * Server Action — invite un colocataire (slot 2-4) à certifier son identité.
 *
 * Clone de sendGuarantorInvitation, mais : (1) écrit dans CoTenant avec
 * `applicationId` (pour le re-sync webhook→score), et (2) met à jour le miroir
 * `application.coTenants[slot]` (status INVITED) pour l'affichage immédiat.
 */
export async function sendCoTenantInvitation(params: {
  applyToken: string;
  applicationId?: string;
  coTenantEmail: string;
  slot: number;
  firstName?: string;
  lastName?: string;
  profile?: string;
  initiator?: { firstName?: string; lastName?: string; email?: string };
}): Promise<{ success: boolean; token?: string; error?: string }> {
  const { applyToken, applicationId, coTenantEmail, slot, firstName, lastName, profile, initiator } = params;
  try {
    // Anti-abus (re-audit V1) : action login-less qui envoie un email via le domaine.
    // Borne par IP + applyToken pour empêcher le spam / phishing en masse.
    if (await actionRateLimited('cotenant-invite', applyToken)) {
      return { success: false, error: 'Trop de demandes. Réessayez dans quelques minutes.' };
    }

    await connectDiditDb();

    const property = await Property.findOne({ applyToken });
    if (!property) {
      return { success: false, error: 'Bien immobilier introuvable (token invalide)' };
    }

    const normalizedSlot = Number(slot);
    if (![2, 3, 4].includes(normalizedSlot)) {
      return { success: false, error: 'Slot colocataire invalide (2-4)' };
    }

    // Résoudre l'Application de l'initiateur (clé du re-sync).
    let application = null as { _id: unknown; coTenants?: unknown[]; isColocation?: boolean; save: () => Promise<unknown> } | null;
    if (applicationId) {
      application = await Application.findById(applicationId);
    }
    if (!application && initiator?.email) {
      application = await Application.findOne({ applyToken, userEmail: initiator.email.toLowerCase() });
    }

    const invitationToken = crypto.randomBytes(32).toString('hex');
    const email = coTenantEmail.toLowerCase();

    // Créer / mettre à jour le CoTenant pour ce slot.
    let coTenant = await CoTenant.findOne({ applyToken, email, slot: normalizedSlot });
    if (!coTenant) {
      coTenant = await CoTenant.findOne({ applyToken, email });
    }
    if (coTenant) {
      coTenant.slot = normalizedSlot;
      coTenant.invitationToken = invitationToken;
      coTenant.invitationSentAt = new Date();
      coTenant.status = 'INVITED';
      if (application) coTenant.applicationId = application._id;
      if (property) coTenant.property = property._id;
      if (firstName) coTenant.firstName = firstName;
      if (lastName) coTenant.lastName = lastName;
      if (profile) coTenant.profile = profile;
    } else {
      coTenant = new CoTenant({
        applicationId: application ? application._id : undefined,
        property: property._id,
        applyToken,
        slot: normalizedSlot,
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        profile: profile || 'Etudiant',
        status: 'INVITED',
        invitationToken,
        invitationSentAt: new Date(),
      });
    }
    await coTenant.save();

    // Miroir sur l'Application (affichage immédiat ; statut affiné par le webhook).
    if (application) {
      const coTenants = (application.coTenants || []) as Array<Record<string, unknown>>;
      const mirror = coTenants.find((c) => Number(c.slot) === normalizedSlot);
      const fields = {
        slot: normalizedSlot,
        coTenantId: coTenant._id,
        firstName: firstName || (mirror?.firstName as string) || '',
        lastName: lastName || (mirror?.lastName as string) || '',
        email,
        profile: profile || (mirror?.profile as string) || 'Etudiant',
        status: 'INVITED',
        invitationSent: true,
      };
      if (mirror) {
        Object.assign(mirror, fields);
      } else {
        coTenants.push(fields);
      }
      (application as { coTenants?: unknown[] }).coTenants = coTenants;
      (application as { isColocation?: boolean }).isColocation = true;
      await application.save();
    }

    const initiatorName = initiator?.firstName && initiator?.lastName
      ? `${initiator.firstName} ${initiator.lastName}`
      : initiator?.email || 'Un colocataire';
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://doc2loc.com';
    const verificationUrl = `${baseUrl}/verify-cotenant/${invitationToken}`;

    const emailSent = await sendCoTenantInvitationEmail(
      email,
      initiatorName,
      verificationUrl,
      firstName || 'Bonjour',
    );
    if (!emailSent) {
      return { success: false, error: "Erreur lors de l'envoi de l'email" };
    }

    return { success: true, token: invitationToken };
  } catch (error) {
    console.error('Erreur sendCoTenantInvitation:', error);
    return { success: false, error: error instanceof Error ? error.message : "Erreur lors de l'envoi" };
  }
}

/** Email d'invitation colocataire (clone du mail garant, wording colocation). */
async function sendCoTenantInvitationEmail(
  coTenantEmail: string,
  initiatorName: string,
  verificationUrl: string,
  coTenantName: string,
): Promise<boolean> {
  try {
    const nodemailer = (await import('nodemailer')).default;
    const BREVO_USER = process.env.BREVO_USER;
    const BREVO_PASS = process.env.BREVO_PASS;
    if (!BREVO_USER || !BREVO_PASS) {
      console.warn('⚠️ BREVO_USER/BREVO_PASS manquant: email non envoyé');
      return process.env.NODE_ENV === 'development';
    }
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: BREVO_USER, pass: BREVO_PASS },
    });

    const emailHtml = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,.1);">
      <tr><td style="padding:40px 40px 20px;text-align:center;border-bottom:2px solid #064E3B;">
        <h1 style="margin:0;color:#064E3B;font-size:28px;font-weight:700;font-family:'Playfair Display',serif;">Maison Patrimo</h1>
        <p style="margin:8px 0 0;color:#64748b;font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;">Colocation — Certification d'identité</p>
      </td></tr>
      <tr><td style="padding:40px;">
        <p style="margin:0 0 20px;color:#0F172A;font-size:16px;line-height:1.6;">Bonjour ${coTenantName},</p>
        <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.7;"><strong>${initiatorName}</strong> vous invite à rejoindre sa <strong>colocation</strong> sur Maison Patrimo et à certifier votre identité.</p>
        <p style="margin:0 0 30px;color:#334155;font-size:15px;line-height:1.7;">Cette vérification eIDAS (via Didit) prend moins de 30 secondes et renforce le dossier commun de la colocation auprès du propriétaire.</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 0;">
          <a href="${verificationUrl}" style="display:inline-block;padding:16px 40px;background:#064E3B;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:.1em;text-transform:uppercase;">Certifier mon identité (Didit)</a>
        </td></tr></table>
        <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.6;">Si vous n'êtes pas concerné par cette colocation, vous pouvez ignorer cet email.</p>
      </td></tr>
      <tr><td style="padding:30px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;">
        <p style="margin:0;color:#64748b;font-size:11px;text-align:center;line-height:1.6;">Maison Patrimo — Certification immobilière<br>Email envoyé à ${coTenantEmail}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

    const sent = await sendMailWithRetry(transporter, {
      from: process.env.MAIL_FROM || `"Maison Patrimo" <${process.env.BREVO_FROM_EMAIL || 'no-reply@doc2loc.com'}>`,
      to: coTenantEmail,
      subject: `Colocation Maison Patrimo — ${initiatorName} vous invite à certifier votre identité`,
      text: `Bonjour ${coTenantName},\n\n${initiatorName} vous invite à rejoindre sa colocation sur Maison Patrimo et à certifier votre identité (eIDAS via Didit, < 30s).\n\nLien : ${verificationUrl}\n\nMaison Patrimo`,
      html: emailHtml,
    }, { label: 'invitation-colocataire' });
    return sent;
  } catch (error) {
    console.error('Erreur envoi email colocataire:', error);
    return false;
  }
}
