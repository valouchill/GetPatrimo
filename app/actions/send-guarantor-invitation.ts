'use server';

import crypto from 'crypto';
import Guarantor from '@/models/Guarantor';
import Property from '@/models/Property';
import mongoose from 'mongoose';
import { connectDiditDb } from '@/app/api/didit/db';

/**
 * Server Action pour envoyer une invitation au garant
 * 
 * @param applyToken - Token de la page apply (applyToken de Property)
 * @param guarantorEmail - Email du garant
 * @param guarantorFirstName - Prénom du garant (optionnel)
 * @param guarantorLastName - Nom du garant (optionnel)
 * @param tenantInfo - Informations du locataire (optionnel)
 * @returns Résultat de l'envoi avec token d'invitation
 */
export async function sendGuarantorInvitation(
  applyToken: string,
  guarantorEmail: string,
  guarantorFirstName?: string,
  guarantorLastName?: string,
  tenantInfo?: { firstName?: string; lastName?: string; email?: string }
): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    // Connexion à la base de données
    await connectDiditDb();

    // Trouver la Property par son applyToken
    const property = await Property.findOne({ applyToken });
    if (!property) {
      return {
        success: false,
        error: 'Bien immobilier introuvable (token invalide)',
      };
    }

    // Générer un token unique pour l'invitation
    const invitationToken = crypto.randomBytes(32).toString('hex');

    // Créer ou mettre à jour le garant (lié à la Property via applyToken)
    let guarantor = await Guarantor.findOne({ 
      applyToken: applyToken,
      email: guarantorEmail.toLowerCase()
    });

    if (guarantor) {
      // Mettre à jour le token si le garant existe déjà
      guarantor.invitationToken = invitationToken;
      guarantor.invitationSentAt = new Date();
      if (guarantorFirstName) guarantor.firstName = guarantorFirstName;
      if (guarantorLastName) guarantor.lastName = guarantorLastName;
    } else {
      // Créer un nouveau garant
      guarantor = new Guarantor({
        property: property._id, // Référence à la Property
        applyToken: applyToken, // Token de la page apply
        email: guarantorEmail.toLowerCase(),
        firstName: guarantorFirstName || '',
        lastName: guarantorLastName || '',
        status: 'PENDING',
        invitationToken,
        invitationSentAt: new Date(),
      });
    }

    await guarantor.save();

    // Récupérer les informations du locataire pour l'email
    const tenantName = tenantInfo?.firstName && tenantInfo?.lastName
      ? `${tenantInfo.firstName} ${tenantInfo.lastName}`
      : tenantInfo?.email || 'Le candidat';

    // Construire l'URL de vérification
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://doc2loc.com';
    const verificationUrl = `${baseUrl}/verify-guarantor/${invitationToken}`;

    // Envoyer l'email d'invitation
    const emailSent = await sendGuarantorInvitationEmail(
      guarantorEmail,
      tenantName,
      verificationUrl,
      guarantorFirstName || 'Cher garant'
    );

    if (!emailSent) {
      return {
        success: false,
        error: 'Erreur lors de l\'envoi de l\'email',
      };
    }

    return {
      success: true,
      token: invitationToken,
    };
  } catch (error) {
    console.error('Erreur sendGuarantorInvitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'envoi de l\'invitation',
    };
  }
}

/**
 * Envoie l'email d'invitation au garant
 */
async function sendGuarantorInvitationEmail(
  guarantorEmail: string,
  tenantName: string,
  verificationUrl: string,
  guarantorName: string
): Promise<boolean> {
  try {
    const nodemailer = (await import('nodemailer')).default;
    
    const BREVO_USER = process.env.BREVO_USER;
    const BREVO_PASS = process.env.BREVO_PASS;

    if (!BREVO_USER || !BREVO_PASS) {
      console.warn('⚠️ BREVO_USER/BREVO_PASS manquant: email non envoyé');
      // En développement, on peut retourner true pour continuer
      return process.env.NODE_ENV === 'development';
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: BREVO_USER, pass: BREVO_PASS }
    });

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation Garant - PatrimoTrust™</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 2px solid #0F172A;">
              <h1 style="margin: 0; color: #0F172A; font-size: 28px; font-weight: 700; font-family: 'Playfair Display', serif;">
                PatrimoTrust™
              </h1>
              <p style="margin: 8px 0 0; color: #64748b; font-size: 12px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase;">
                Certification Garant Souverain
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #0F172A; font-size: 16px; line-height: 1.6;">
                Bonjour ${guarantorName},
              </p>
              
              <p style="margin: 0 0 20px; color: #334155; font-size: 15px; line-height: 1.7;">
                <strong>${tenantName}</strong> a besoin de votre garantie pour sécuriser sa candidature PatrimoTrust™.
              </p>
              
              <p style="margin: 0 0 30px; color: #334155; font-size: 15px; line-height: 1.7;">
                Pour certifier votre identité et activer la <strong>Garantie Souveraine</strong>, merci de suivre notre protocole sécurisé via Didit. Cette certification prend moins de 30 secondes et renforce significativement le dossier du locataire.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="${verificationUrl}" style="display: inline-block; padding: 16px 40px; background-color: #0F172A; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase;">
                      Certifier mon identité (Didit)
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                <strong>Pourquoi certifier ?</strong><br>
                La certification Didit garantit votre identité sans stockage de vos documents sensibles. Elle permet d'activer la <strong>Garantie Souveraine</strong> qui ajoute +30 points au PatrimoMeter™ du locataire, maximisant ses chances d'obtenir le bien.
              </p>
              
              <p style="margin: 20px 0 0; color: #64748b; font-size: 12px; line-height: 1.6;">
                Si vous ne souhaitez pas certifier votre identité, vous pouvez ignorer cet email. Le locataire pourra toujours compléter son dossier avec d'autres garanties.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #64748b; font-size: 11px; text-align: center; line-height: 1.6;">
                PatrimoTrust™ - Plateforme de certification immobilière<br>
                Cet email a été envoyé à ${guarantorEmail}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailText = `
Bonjour ${guarantorName},

${tenantName} a besoin de votre garantie pour sécuriser sa candidature PatrimoTrust™.

Pour certifier votre identité et activer la Garantie Souveraine, merci de suivre notre protocole sécurisé via Didit. Cette certification prend moins de 30 secondes.

Lien de certification : ${verificationUrl}

Pourquoi certifier ?
La certification Didit garantit votre identité sans stockage de vos documents sensibles. Elle permet d'activer la Garantie Souveraine qui ajoute +30 points au PatrimoMeter™ du locataire.

PatrimoTrust™ - Plateforme de certification immobilière
    `;

    await transporter.sendMail({
      from: `"PatrimoTrust™" <${process.env.BREVO_FROM_EMAIL || 'noreply@doc2loc.com'}>`,
      to: guarantorEmail,
      subject: `Invitation Garant - ${tenantName} a besoin de votre garantie`,
      text: emailText,
      html: emailHtml,
    });

    console.log(`✅ Email d'invitation envoyé à ${guarantorEmail}`);
    return true;
  } catch (error) {
    console.error('Erreur envoi email garant:', error);
    return false;
  }
}
