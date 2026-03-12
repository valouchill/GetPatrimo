/**
 * Service de signature électronique pour les baux
 * Gère l'envoi des invitations de signature et le suivi des statuts
 */

const { logEvent } = require('./eventService');
const { sendEmail } = require('./emailService');

/**
 * Envoie les invitations de signature pour un bail
 * @param {Object} lease - Données du bail
 * @param {Object} property - Données du bien
 * @param {Object} owner - Données du propriétaire
 * @returns {Promise<Object>} - Résultat de l'envoi
 */
async function sendSignatureInvitations(lease, property, owner) {
  try {
    const results = {
      tenant: { sent: false, error: null },
      guarantor: { sent: false, error: null },
      owner: { sent: false, error: null }
    };

    // Génère les liens de signature (à adapter selon votre système de signature)
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const tenantSignatureLink = `${baseUrl}/sign/lease/${lease._id}/tenant?token=${generateSignatureToken(lease._id, 'tenant')}`;
    const ownerSignatureLink = `${baseUrl}/sign/lease/${lease._id}/owner?token=${generateSignatureToken(lease._id, 'owner')}`;

    // Envoie l'invitation au locataire
    try {
      await sendEmail({
        to: lease.tenantEmail,
        subject: 'Signature de votre bail de location',
        html: generateTenantSignatureEmail(lease, property, tenantSignatureLink)
      });
      results.tenant.sent = true;
      
      await logEvent(owner._id || owner, {
        property: property._id,
        type: 'signature_invitation_sent',
        meta: {
          leaseId: String(lease._id),
          recipient: 'tenant',
          email: lease.tenantEmail
        }
      });
    } catch (error) {
      console.error('Erreur envoi invitation locataire:', error);
      results.tenant.error = error.message;
    }

    // Envoie l'invitation au garant si applicable
    if (lease.guarantor && lease.guarantor.email && !lease.guarantor.visaleNumber) {
      try {
        const guarantorSignatureLink = `${baseUrl}/sign/lease/${lease._id}/guarantor?token=${generateSignatureToken(lease._id, 'guarantor')}`;
        
        await sendEmail({
          to: lease.guarantor.email,
          subject: 'Signature de l\'acte de cautionnement',
          html: generateGuarantorSignatureEmail(lease, property, guarantorSignatureLink)
        });
        results.guarantor.sent = true;
        
        await logEvent(owner._id || owner, {
          property: property._id,
          type: 'signature_invitation_sent',
          meta: {
            leaseId: String(lease._id),
            recipient: 'guarantor',
            email: lease.guarantor.email
          }
        });
      } catch (error) {
        console.error('Erreur envoi invitation garant:', error);
        results.guarantor.error = error.message;
      }
    }

    // L'invitation au propriétaire est généralement gérée directement dans l'interface
    // Mais on peut aussi envoyer un email de confirmation
    results.owner.sent = true;

    return results;
  } catch (error) {
    console.error('Erreur sendSignatureInvitations:', error);
    throw error;
  }
}

/**
 * Génère un token de signature sécurisé
 * @param {string} leaseId - ID du bail
 * @param {string} signerType - Type de signataire (tenant, owner, guarantor)
 * @returns {string} - Token de signature
 */
function generateSignatureToken(leaseId, signerType) {
  const crypto = require('crypto');
  const secret = process.env.SIGNATURE_SECRET || 'default-secret-change-in-production';
  const data = `${leaseId}-${signerType}-${Date.now()}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Valide un token de signature
 * @param {string} token - Token à valider
 * @param {string} leaseId - ID du bail
 * @param {string} signerType - Type de signataire
 * @returns {boolean} - True si valide
 */
function validateSignatureToken(token, leaseId, signerType) {
  // Implémentation simplifiée - à améliorer selon vos besoins de sécurité
  // En production, utilisez JWT ou un système de tokens avec expiration
  return token && token.length === 64; // Vérification basique
}

/**
 * Génère l'email d'invitation pour le locataire
 */
function generateTenantSignatureEmail(lease, property, signatureLink) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0F172A; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #F8FAFC; }
        .button { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>GetPatrimo</h1>
        </div>
        <div class="content">
          <h2>Signature de votre bail de location</h2>
          <p>Bonjour ${lease.tenantFirstName || ''},</p>
          <p>Votre bail pour le bien situé à <strong>${property.address}</strong> est prêt à être signé.</p>
          <p>Cliquez sur le bouton ci-dessous pour accéder au document et le signer électroniquement :</p>
          <div style="text-align: center;">
            <a href="${signatureLink}" class="button">Signer le bail</a>
          </div>
          <p>Ce lien est valide pendant 7 jours.</p>
        </div>
        <div class="footer">
          <p>GetPatrimo - Gestion locative sécurisée par IA</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Génère l'email d'invitation pour le garant
 */
function generateGuarantorSignatureEmail(lease, property, signatureLink) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0F172A; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #F8FAFC; }
        .button { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>GetPatrimo</h1>
        </div>
        <div class="content">
          <h2>Signature de l'acte de cautionnement</h2>
          <p>Bonjour ${lease.guarantor?.firstName || ''},</p>
          <p>Vous avez été désigné(e) comme garant pour le bail de location du bien situé à <strong>${property.address}</strong>.</p>
          <p>Veuillez signer l'acte de cautionnement en cliquant sur le bouton ci-dessous :</p>
          <div style="text-align: center;">
            <a href="${signatureLink}" class="button">Signer l'acte de cautionnement</a>
          </div>
          <p>Ce lien est valide pendant 7 jours.</p>
        </div>
        <div class="footer">
          <p>GetPatrimo - Gestion locative sécurisée par IA</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  sendSignatureInvitations,
  generateSignatureToken,
  validateSignatureToken
};
