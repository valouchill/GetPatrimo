'use server';

import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import Property from '@/models/Property';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Configuration du transporteur email Brevo
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASS,
  },
});

interface CreateAccountResult {
  success: boolean;
  error?: string;
  applicationId?: string;
  magicLinkSent?: boolean;
}

/**
 * Crée un compte locataire silencieusement et envoie un Magic Link
 */
export async function createTenantAccount(
  applyToken: string,
  contactInfo: {
    email: string;
    phone: string;
    firstName?: string;
    lastName?: string;
  },
  diditIdentity?: {
    firstName?: string;
    lastName?: string;
    birthDate?: string;
  }
): Promise<CreateAccountResult> {
  try {
    await connectDiditDb();

    const email = contactInfo.email.toLowerCase().trim();
    const phone = contactInfo.phone.trim();

    // Validation du format téléphone (format français)
    const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
    const cleanPhone = phone.replace(/[\s.-]/g, '');
    if (!phoneRegex.test(phone) && !/^[0-9]{10,14}$/.test(cleanPhone)) {
      return { success: false, error: 'Format de téléphone invalide' };
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Format d\'email invalide' };
    }

    // Trouver ou créer l'application
    let application = await Application.findOne({
      userEmail: email,
      applyToken,
    });

    if (!application) {
      application = new Application({
        userEmail: email,
        applyToken,
        status: 'IN_PROGRESS',
      });
    }

    if (!application.property) {
      const property = await Property.findOne({ applyToken }).select('_id').lean() as { _id?: unknown } | null;
      if (property?._id) {
        application.property = property._id as any;
      }
    }

    // Mettre à jour les informations de contact
    application.profile = {
      ...application.profile,
      firstName: contactInfo.firstName || diditIdentity?.firstName || application.profile?.firstName || '',
      lastName: contactInfo.lastName || diditIdentity?.lastName || application.profile?.lastName || '',
      phone: cleanPhone,
      birthDate: diditIdentity?.birthDate || application.profile?.birthDate || '',
    };

    // Marquer les coordonnées comme vérifiées
    application.contactVerified = {
      email: true,
      emailVerifiedAt: new Date(),
      phone: true,
      phoneVerifiedAt: new Date(),
    };

    // Mettre à jour le statut Didit si fourni
    if (diditIdentity) {
      application.didit = {
        ...application.didit,
        status: 'VERIFIED',
        verifiedAt: new Date(),
        identityData: diditIdentity,
      };
    }

    application.tunnel.lastActiveAt = new Date();
    await application.save();

    // Générer un Magic Link
    const magicToken = crypto.randomBytes(32).toString('hex');
    
    // Sauvegarder le token temporaire (expire dans 7 jours)
    application.magicLinkToken = magicToken;
    application.magicLinkExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await application.save();

    // Envoyer l'email de bienvenue avec Magic Link
    const baseUrl = process.env.NEXTAUTH_URL || 'https://getpatrimo.com';
    const magicLinkUrl = `${baseUrl}/auth/magic-link?token=${magicToken}&email=${encodeURIComponent(email)}`;
    const dashboardUrl = `${baseUrl}/dashboard/tenant`;

    const firstName = application.profile.firstName || 'Locataire';

    try {
      await transporter.sendMail({
        to: email,
        from: process.env.MAIL_FROM || 'PatrimoTrust <no-reply@getpatrimo.com>',
        subject: `🎉 Bienvenue ${firstName} - Votre espace PatrimoTrust est créé`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">PatrimoTrust™</h1>
                <p style="color: #10b981; margin: 8px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">✓ Compte créé avec succès</p>
              </div>
              
              <div style="padding: 40px 32px;">
                <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 20px;">Bienvenue ${firstName} ! 👋</h2>
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">
                  Votre espace PatrimoTrust est maintenant créé. Vous pouvez revenir à votre dossier à tout moment en cliquant sur le bouton ci-dessous.
                </p>
                
                <a href="${magicLinkUrl}" style="display: block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">
                  Accéder à mon espace
                </a>
                
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-top: 24px;">
                  <p style="color: #166534; font-size: 13px; margin: 0; font-weight: 600;">
                    📱 Votre téléphone vérifié : ${phone}
                  </p>
                  <p style="color: #166534; font-size: 12px; margin: 8px 0 0 0;">
                    Le propriétaire pourra vous contacter après l'audit de votre dossier.
                  </p>
                </div>
              </div>
              
              <div style="background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0;">
                <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
                  Ce lien expire dans 7 jours. Conservez cet email précieusement.<br/>
                  © PatrimoTrust - Dossier Locataire Souverain
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Bienvenue ${firstName} ! Votre espace PatrimoTrust est créé. Accédez-y ici : ${magicLinkUrl}`,
      });

      return {
        success: true,
        applicationId: application._id.toString(),
        magicLinkSent: true,
      };
    } catch (emailError) {
      console.error('Erreur envoi email bienvenue:', emailError);
      // On continue même si l'email échoue
      return {
        success: true,
        applicationId: application._id.toString(),
        magicLinkSent: false,
      };
    }
  } catch (error) {
    console.error('Erreur createTenantAccount:', error);
    return { success: false, error: 'Erreur lors de la création du compte' };
  }
}
