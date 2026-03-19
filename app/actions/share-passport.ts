'use server';

import crypto from 'crypto';
import Application from '@/models/Application';
import { connectDiditDb } from '@/app/api/didit/db';

// Types
interface ShareResult {
  success: boolean;
  shareToken?: string;
  error?: string;
}

interface ShareData {
  recipientEmail: string;
  recipientName?: string;
  personalMessage?: string;
}

// Modèle pour stocker les partages (tracking)
interface PassportShare {
  applicationId: string;
  shareToken: string;
  recipientEmail: string;
  recipientName?: string;
  personalMessage?: string;
  sharedAt: Date;
  openedAt?: Date;
  viewCount: number;
}

/**
 * Server Action pour partager le passeport par email à un propriétaire
 */
export async function sharePassportByEmail(
  applicationId: string,
  shareData: ShareData
): Promise<ShareResult> {
  try {
    await connectDiditDb();
    
    // Récupérer l'application
    const app = await Application.findById(applicationId).lean();
    if (!app) {
      return { success: false, error: 'Candidature introuvable' };
    }
    
    const appData = app as any;
    const profile = appData.profile || {};
    const patrimometer = appData.patrimometer || {};
    const didit = appData.didit || {};
    const guarantor = appData.guarantor || {};
    
    // Générer un token de partage unique
    const shareToken = crypto.randomBytes(16).toString('hex');
    
    // S'assurer qu'on a un slug
    let slug = appData.passportSlug;
    if (!slug) {
      const safeName = (profile.firstName || 'dossier').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 12);
      const suffix = crypto.randomBytes(4).toString('hex');
      slug = safeName + '-' + suffix;
      await Application.findByIdAndUpdate(applicationId, { passportSlug: slug });
    }
    
    // Incrémenter le compteur de partages
    await Application.findByIdAndUpdate(applicationId, {
      $inc: { passportShareCount: 1 }
    });
    
    // Construire l'URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://doc2loc.com';
    const passportUrl = `${baseUrl}/p/${slug}`;
    const verifyUrl = passportUrl;
    
    // Préparer les données pour l'email
    const tenantName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Le candidat';
    const grade = patrimometer.grade || 'EN COURS';
    const gradeLabel = getGradeLabel(grade);
    
    const identityVerified = didit.status === 'VERIFIED';
    const incomeVerified = appData.financialSummary?.certifiedIncome || false;
    const guarantorCertified = guarantor.status === 'CERTIFIED' || guarantor.status === 'AUDITED';
    
    // Stocker le partage en base (pour tracking)
    // TODO: Créer un modèle PassportShare si nécessaire
    // Pour l'instant, on stocke dans un champ de l'application
    
    // Envoyer l'email
    const emailSent = await sendPassportShareEmail({
      recipientEmail: shareData.recipientEmail,
      recipientName: shareData.recipientName,
      personalMessage: shareData.personalMessage,
      tenantName,
      grade,
      gradeLabel,
      identityVerified,
      incomeVerified,
      guarantorCertified,
      verifyUrl,
      passportUrl,
      shareToken,
    });
    
    if (!emailSent) {
      return { success: false, error: 'Erreur lors de l\'envoi de l\'email' };
    }
    
    return { success: true, shareToken };
    
  } catch (error) {
    console.error('Erreur sharePassportByEmail:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur lors du partage' 
    };
  }
}

function getGradeLabel(grade: string): string {
  const labels: Record<string, string> = {
    'SOUVERAIN': 'SOUVERAIN',
    'A': 'EXCELLENCE',
    'B': 'CONFIANCE',
    'C': 'SOLIDE',
    'D': 'STANDARD',
    'E': 'À COMPLÉTER',
    'F': 'EN COURS',
  };
  return labels[grade] || grade;
}

interface EmailData {
  recipientEmail: string;
  recipientName?: string;
  personalMessage?: string;
  tenantName: string;
  grade: string;
  gradeLabel: string;
  identityVerified: boolean;
  incomeVerified: boolean;
  guarantorCertified: boolean;
  verifyUrl: string;
  passportUrl: string;
  shareToken: string;
}

async function sendPassportShareEmail(data: EmailData): Promise<boolean> {
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
      auth: { user: BREVO_USER, pass: BREVO_PASS }
    });
    
    const recipientGreeting = data.recipientName 
      ? `Bonjour ${data.recipientName},`
      : 'Bonjour,';
    
    // Couleurs selon le grade
    const gradeColors: Record<string, { bg: string; text: string }> = {
      'SOUVERAIN': { bg: '#D4AF37', text: '#1A1A2E' },
      'A': { bg: '#059669', text: '#FFFFFF' },
      'B': { bg: '#3B82F6', text: '#FFFFFF' },
      'C': { bg: '#8B5CF6', text: '#FFFFFF' },
      'D': { bg: '#F59E0B', text: '#1A1A2E' },
      'E': { bg: '#F97316', text: '#FFFFFF' },
      'F': { bg: '#9CA3AF', text: '#1A1A2E' },
    };
    const gradeColor = gradeColors[data.grade] || gradeColors['F'];
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dossier de candidature certifié - PatrimoTrust™</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12); overflow: hidden;">
          
          <!-- Header avec gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #1A1A2E 0%, #0F172A 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #D4AF37; font-size: 28px; font-weight: 700; letter-spacing: 2px;">
                PatrimoTrust™
              </h1>
              <p style="margin: 10px 0 0; color: #94A3B8; font-size: 11px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase;">
                Standard de Confiance Immobilier
              </p>
            </td>
          </tr>
          
          <!-- Badge Grade -->
          <tr>
            <td style="padding: 0; text-align: center;">
              <table cellpadding="0" cellspacing="0" style="margin: -25px auto 0;">
                <tr>
                  <td style="background-color: ${gradeColor.bg}; color: ${gradeColor.text}; padding: 12px 32px; border-radius: 50px; font-weight: 800; font-size: 14px; letter-spacing: 2px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                    🛡️ GRADE ${data.grade} — ${data.gradeLabel}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Contenu principal -->
          <tr>
            <td style="padding: 50px 40px 30px;">
              <p style="margin: 0 0 25px; color: #0F172A; font-size: 18px; line-height: 1.6; font-weight: 500;">
                ${recipientGreeting}
              </p>
              
              <p style="margin: 0 0 25px; color: #334155; font-size: 16px; line-height: 1.7;">
                Vous avez reçu une candidature de la part de <strong style="color: #0F172A;">${data.tenantName}</strong> pour votre bien immobilier.
              </p>
              
              <p style="margin: 0 0 30px; color: #334155; font-size: 15px; line-height: 1.7;">
                Pour vous faire gagner un temps précieux et sécuriser votre mise en location, ce candidat a fait <strong>auditer son dossier par PatrimoTrust™</strong>, le standard de confiance immobilier.
              </p>
              
              ${data.personalMessage ? `
              <div style="background-color: #F8FAFC; border-left: 4px solid #D4AF37; padding: 16px 20px; margin: 0 0 30px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #64748B; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">Message personnel</p>
                <p style="margin: 8px 0 0; color: #334155; font-size: 14px; line-height: 1.6; font-style: italic;">"${data.personalMessage}"</p>
              </div>
              ` : ''}
              
              <!-- Points clés -->
              <div style="background-color: #F8FAFC; border-radius: 12px; padding: 24px; margin: 0 0 30px;">
                <p style="margin: 0 0 16px; color: #0F172A; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
                  Points clés du dossier
                </p>
                
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: ${data.identityVerified ? '#10B981' : '#F59E0B'}; font-size: 16px;">
                        ${data.identityVerified ? '✅' : '⏳'}
                      </span>
                      <span style="color: #334155; font-size: 14px; margin-left: 8px;">
                        <strong>Identité Certifiée</strong> — Vérification biométrique ${data.identityVerified ? 'effectuée' : 'en cours'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: ${data.incomeVerified ? '#10B981' : '#F59E0B'}; font-size: 16px;">
                        ${data.incomeVerified ? '✅' : '⏳'}
                      </span>
                      <span style="color: #334155; font-size: 14px; margin-left: 8px;">
                        <strong>Solvabilité Auditée</strong> — Revenus et avis fiscaux vérifiés par IA
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: ${data.guarantorCertified ? '#10B981' : '#F59E0B'}; font-size: 16px;">
                        ${data.guarantorCertified ? '✅' : '⏳'}
                      </span>
                      <span style="color: #334155; font-size: 14px; margin-left: 8px;">
                        <strong>Garantie Scellée</strong> — Dossier garant ${data.guarantorCertified ? 'complet et certifié' : 'en cours de certification'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #10B981; font-size: 16px;">🛡️</span>
                      <span style="color: #334155; font-size: 14px; margin-left: 8px;">
                        <strong>Protection</strong> — Ce dossier est éligible à notre protection contre les impayés
                      </span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${data.verifyUrl}" style="display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); color: #1A1A2E; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 14px; letter-spacing: 0.15em; text-transform: uppercase; box-shadow: 0 4px 16px rgba(212, 175, 55, 0.4);">
                      🛡️ Accéder au Passeport Souverain
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #64748B; font-size: 13px; text-align: center; line-height: 1.6;">
                En un clic, accédez aux pièces justificatives sans téléchargement lourd<br>
                et en totale conformité avec la <strong>Loi Alur</strong>.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0F172A; text-align: center;">
              <p style="margin: 0 0 8px; color: #D4AF37; font-size: 14px; font-weight: 600;">
                L'Expert PatrimoTrust™
              </p>
              <p style="margin: 0; color: #64748B; font-size: 12px; line-height: 1.6;">
                La technologie au service de votre patrimoine
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Disclaimer -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="padding: 0 20px; text-align: center;">
              <p style="margin: 0; color: #94A3B8; font-size: 11px; line-height: 1.6;">
                Cet email vous a été envoyé par ${data.tenantName} via PatrimoTrust™.<br>
                Vous recevez ce message car un candidat souhaite partager son dossier avec vous.
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
${recipientGreeting}

Vous avez reçu une candidature de la part de ${data.tenantName} pour votre bien immobilier.

Pour vous faire gagner un temps précieux et sécuriser votre mise en location, ce candidat a fait auditer son dossier par PatrimoTrust™, le standard de confiance immobilier.

${data.personalMessage ? `Message personnel: "${data.personalMessage}"\n` : ''}

Points clés du dossier :
${data.identityVerified ? '✅' : '⏳'} Identité Certifiée — Vérification biométrique ${data.identityVerified ? 'effectuée' : 'en cours'}
${data.incomeVerified ? '✅' : '⏳'} Solvabilité Auditée — Revenus et avis fiscaux vérifiés par IA
${data.guarantorCertified ? '✅' : '⏳'} Garantie Scellée — Dossier garant ${data.guarantorCertified ? 'complet et certifié' : 'en cours de certification'}
🛡️ Protection — Ce dossier est éligible à notre protection contre les impayés

Consulter le dossier complet : ${data.verifyUrl}

En un clic, accédez aux pièces justificatives sans téléchargement lourd et en totale conformité avec la Loi Alur.

Cordialement,
L'Expert PatrimoTrust™
La technologie au service de votre patrimoine
    `;
    
    await transporter.sendMail({
      from: `"PatrimoTrust™" <${process.env.BREVO_FROM_EMAIL || 'noreply@doc2loc.com'}>`,
      to: data.recipientEmail,
      subject: `🛡️ Dossier de candidature certifié : ${data.tenantName} — Grade ${data.grade}`,
      text: emailText,
      html: emailHtml,
    });
    
    console.log(`✅ Email de partage Passeport envoyé à ${data.recipientEmail}`);
    return true;
    
  } catch (error) {
    console.error('Erreur envoi email partage passeport:', error);
    return false;
  }
}

/**
 * Notifie le locataire quand son passeport est consulté
 */
export async function notifyPassportViewed(
  applicationId: string,
  viewerInfo?: { email?: string; name?: string }
): Promise<boolean> {
  try {
    await connectDiditDb();
    
    const app = await Application.findById(applicationId).lean();
    if (!app) return false;
    
    const appData = app as any;
    const tenantEmail = appData.userEmail;
    const tenantName = appData.profile?.firstName || 'Candidat';
    
    if (!tenantEmail) return false;
    
    const nodemailer = (await import('nodemailer')).default;
    
    const BREVO_USER = process.env.BREVO_USER;
    const BREVO_PASS = process.env.BREVO_PASS;
    
    if (!BREVO_USER || !BREVO_PASS) {
      console.warn('⚠️ BREVO manquant: notification non envoyée');
      return false;
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
  <title>Votre Passeport a été consulté - PatrimoTrust™</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
              <h1 style="margin: 0 0 16px; color: #0F172A; font-size: 22px;">
                Bonne nouvelle ${tenantName} !
              </h1>
              <p style="margin: 0 0 24px; color: #334155; font-size: 16px; line-height: 1.6;">
                Un propriétaire vient de consulter votre<br>
                <strong style="color: #D4AF37;">Passeport Souverain</strong>
              </p>
              <div style="background-color: #F0FDF4; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
                <p style="margin: 0; color: #166534; font-size: 14px;">
                  Votre dossier fait son effet ! 🚀<br>
                  Restez attentif à vos emails pour d'éventuelles demandes.
                </p>
              </div>
              <p style="margin: 0; color: #64748B; font-size: 12px;">
                PatrimoTrust™ — Votre succès locatif, notre mission
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
    
    await transporter.sendMail({
      from: `"PatrimoTrust™" <${process.env.BREVO_FROM_EMAIL || 'noreply@doc2loc.com'}>`,
      to: tenantEmail,
      subject: `🎉 Bonne nouvelle ${tenantName} ! Un propriétaire consulte votre Passeport`,
      html: emailHtml,
    });
    
    console.log(`✅ Notification vue passeport envoyée à ${tenantEmail}`);
    return true;
    
  } catch (error) {
    console.error('Erreur notification vue passeport:', error);
    return false;
  }
}
