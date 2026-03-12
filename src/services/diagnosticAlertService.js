/**
 * Service d'alerte pour les diagnostics périmés
 * Vérifie périodiquement les diagnostics et envoie des notifications email
 */

const Document = require('../../models/Document');
const Property = require('../../models/Property');
const User = require('../../models/User');
const { sendEmail } = require('./emailService');
const { logEvent } = require('./eventService');

/**
 * Vérifie si un diagnostic est périmé selon son type
 * @param {Object} doc - Document de diagnostic
 * @returns {Object} - { isExpired: boolean, daysUntilExpiry: number, expiryDate: Date }
 */
function checkDiagnosticExpiry(doc) {
  if (!doc.createdAt) {
    return { isExpired: false, daysUntilExpiry: null, expiryDate: null };
  }

  const docDate = new Date(doc.createdAt);
  const now = new Date();
  const ageDays = (now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24);
  
  let maxAgeDays = null;
  
  switch (doc.type) {
    case 'dpe':
      maxAgeDays = 10 * 365; // 10 ans
      break;
    case 'erp':
      maxAgeDays = 180; // 6 mois
      break;
    case 'plomb':
      // Pour le plomb, on considère 6 ans par défaut (1 an si positif, mais on ne peut pas le savoir sans analyse)
      maxAgeDays = 6 * 365;
      break;
    case 'electricite':
    case 'gaz':
    case 'amiante':
      maxAgeDays = 6 * 365; // 6 ans
      break;
    default:
      maxAgeDays = 6 * 365; // Par défaut 6 ans
  }

  if (maxAgeDays === null) {
    return { isExpired: false, daysUntilExpiry: null, expiryDate: null };
  }

  const expiryDate = new Date(docDate.getTime() + maxAgeDays * 24 * 60 * 60 * 1000);
  const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const isExpired = daysUntilExpiry < 0;
  const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 30; // Alerte 30 jours avant expiration

  return {
    isExpired,
    isExpiringSoon,
    daysUntilExpiry: Math.round(daysUntilExpiry),
    expiryDate
  };
}

/**
 * Génère le template HTML pour l'email d'alerte de diagnostic périmé
 * @param {Object} property - Données du bien
 * @param {Object} doc - Document de diagnostic
 * @param {Object} expiryInfo - Informations d'expiration
 * @returns {string} - HTML de l'email
 */
function generateExpiryAlertEmail(property, doc, expiryInfo) {
  const diagnosticNames = {
    'dpe': 'Diagnostic de Performance Énergétique (DPE)',
    'electricite': 'Diagnostic Électricité',
    'gaz': 'Diagnostic Gaz',
    'erp': 'État des Risques et Pollutions (ERP)',
    'plomb': 'Constat de Risque d\'Exposition au Plomb (CREP)',
    'amiante': 'Diagnostic Amiante',
    'surface': 'Surface Boutin'
  };

  const docName = diagnosticNames[doc.type] || doc.originalName || 'Document de diagnostic';
  const status = expiryInfo.isExpired ? 'périmé' : 'expire bientôt';
  const urgency = expiryInfo.isExpired ? 'urgent' : 'important';
  const color = expiryInfo.isExpired ? '#EF4444' : '#F59E0B';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.6; color: #0F172A; }
        .container { max-width: 600px; margin: 0 auto; padding: 24px; }
        .header { background: linear-gradient(135deg, #0F172A, #1E293B); color: #fff; padding: 32px; border-radius: 12px 12px 0 0; }
        .content { background: #fff; padding: 32px; border: 2px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; }
        .alert-box { background: ${color}15; border-left: 4px solid ${color}; padding: 20px; border-radius: 8px; margin: 24px 0; }
        .alert-title { font-size: 18px; font-weight: 700; color: ${color}; margin-bottom: 8px; }
        .btn { display: inline-block; padding: 12px 24px; background: #10B981; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
        .footer { margin-top: 32px; padding-top: 24px; border-top: 2px solid #E2E8F0; font-size: 12px; color: #64748B; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px; font-weight: 300;">GetPatrimo</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Alerte Diagnostic</p>
        </div>
        <div class="content">
          <h2 style="color: #0F172A; margin-top: 0;">Alerte : Diagnostic ${status}</h2>
          
          <div class="alert-box">
            <div class="alert-title">⚠️ Action ${urgency} requise</div>
            <p style="margin: 0; color: #0F172A;">
              Le diagnostic <strong>${docName}</strong> pour le bien situé à <strong>${property.address}</strong> ${expiryInfo.isExpired ? 'est périmé' : `expire dans ${expiryInfo.daysUntilExpiry} jour(s)`}.
            </p>
          </div>

          <p><strong>Détails :</strong></p>
          <ul>
            <li>Document : ${doc.originalName || 'Non spécifié'}</li>
            <li>Date d'upload : ${new Date(doc.createdAt).toLocaleDateString('fr-FR')}</li>
            <li>${expiryInfo.isExpired ? 'Date d\'expiration : ' + expiryInfo.expiryDate.toLocaleDateString('fr-FR') + ' (dépassée)' : 'Expire le : ' + expiryInfo.expiryDate.toLocaleDateString('fr-FR')}</li>
          </ul>

          <p>Pour continuer à sécuriser vos baux, veuillez uploader un nouveau diagnostic à jour.</p>

          <a href="${process.env.APP_URL || 'http://localhost:3000'}/property-luxe.html?id=${property._id}" class="btn">
            Mettre à jour le diagnostic
          </a>

          <div class="footer">
            <p>Cet email a été envoyé automatiquement par GetPatrimo pour vous informer de l'état de vos diagnostics.</p>
            <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Vérifie tous les diagnostics et envoie des alertes pour ceux qui sont périmés ou expirent bientôt
 * @returns {Promise<Object>} - Résultat de la vérification
 */
async function checkAllDiagnosticsAndAlert() {
  try {
    // Récupère tous les documents de diagnostic
    const diagnosticDocs = await Document.find({
      type: { $in: ['dpe', 'electricite', 'gaz', 'erp', 'plomb', 'amiante', 'surface'] }
    }).populate('property').populate('user');

    let expiredCount = 0;
    let expiringSoonCount = 0;
    let alertsSent = 0;
    const errors = [];

    for (const doc of diagnosticDocs) {
      try {
        if (!doc.property || !doc.user) continue;

        const expiryInfo = checkDiagnosticExpiry(doc);
        
        if (expiryInfo.isExpired) {
          expiredCount++;
        } else if (expiryInfo.isExpiringSoon) {
          expiringSoonCount++;
        }

        // Envoie une alerte si périmé ou expire bientôt
        if (expiryInfo.isExpired || expiryInfo.isExpiringSoon) {
          try {
            const property = doc.property;
            const user = doc.user;
            
            // Vérifie si une alerte a déjà été envoyée récemment (évite le spam)
            const lastAlertKey = `lastExpiryAlert_${doc._id}`;
            // En production, vous pourriez stocker cela dans une collection séparée
            
            const emailHtml = generateExpiryAlertEmail(property, doc, expiryInfo);
            const subject = expiryInfo.isExpired 
              ? `⚠️ Diagnostic périmé pour ${property.address}`
              : `⏰ Diagnostic expire bientôt pour ${property.address}`;

            await sendEmail({
              to: user.email,
              subject: subject,
              html: emailHtml
            });

            // Log l'événement
            await logEvent(user._id || user, {
              property: property._id || property,
              type: 'diagnostic_expiry_alert',
              meta: {
                documentId: String(doc._id),
                documentType: doc.type,
                isExpired: expiryInfo.isExpired,
                daysUntilExpiry: expiryInfo.daysUntilExpiry
              }
            });

            alertsSent++;
          } catch (emailError) {
            console.error(`Erreur envoi email pour doc ${doc._id}:`, emailError);
            errors.push({ docId: doc._id, error: emailError.message });
          }
        }
      } catch (error) {
        console.error(`Erreur traitement doc ${doc._id}:`, error);
        errors.push({ docId: doc._id, error: error.message });
      }
    }

    return {
      success: true,
      totalChecked: diagnosticDocs.length,
      expiredCount,
      expiringSoonCount,
      alertsSent,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('Erreur checkAllDiagnosticsAndAlert:', error);
    throw error;
  }
}

module.exports = {
  checkDiagnosticExpiry,
  checkAllDiagnosticsAndAlert,
  generateExpiryAlertEmail
};
