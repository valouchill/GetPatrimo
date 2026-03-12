/**
 * Service OpenSign - Intégration de la signature électronique
 * Gère l'envoi de documents à OpenSign et le suivi des signatures
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { logEvent } = require('./eventService');

const OPENSIGN_API_KEY = process.env.OPENSIGN_API_KEY;
const OPENSIGN_BASE_URL = process.env.OPENSIGN_BASE_URL || 'https://api.opensignlabs.com';

if (!OPENSIGN_API_KEY) {
  console.warn('⚠️ OPENSIGN_API_KEY non configurée. La signature électronique ne fonctionnera pas.');
}

/**
 * Client HTTP pour OpenSign avec authentification
 */
const opensignClient = axios.create({
  baseURL: OPENSIGN_BASE_URL,
  headers: {
    'Authorization': `Bearer ${OPENSIGN_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 secondes
});

/**
 * Envoie un bail pour signature via OpenSign
 * @param {Object} leaseData - Données du bail
 * @param {Object} property - Données du bien
 * @param {Object} parties - Objet contenant tenant, owner, guarantor (optionnel)
 * @param {string} pdfPath - Chemin vers le PDF du bail
 * @returns {Promise<Object>} - Réponse OpenSign avec documentId et liens de signature
 */
async function sendLeaseForSignature(leaseData, property, parties, pdfPath) {
  try {
    if (!OPENSIGN_API_KEY) {
      throw new Error('OpenSign API Key non configurée');
    }

    // Vérifie que le fichier PDF existe
    const absolutePdfPath = path.join(__dirname, '../../', pdfPath);
    if (!fs.existsSync(absolutePdfPath)) {
      throw new Error(`Fichier PDF introuvable: ${absolutePdfPath}`);
    }

    // Lit le fichier PDF en base64
    const pdfBuffer = fs.readFileSync(absolutePdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Construit la liste des signataires
    const signers = [];

    // 1. Locataire (premier signataire)
    signers.push({
      name: `${parties.tenant.firstName} ${parties.tenant.lastName}`,
      email: parties.tenant.email,
      role: 'tenant',
      order: 1,
      requireAuthentication: true, // Requiert authentification par email
      signatureType: 'electronic'
    });

    // 2. Garant (si présent et pas Visale)
    if (parties.guarantor && parties.guarantor.email && !parties.guarantor.visaleNumber) {
      signers.push({
        name: `${parties.guarantor.firstName} ${parties.guarantor.lastName}`,
        email: parties.guarantor.email,
        role: 'guarantor',
        order: 2,
        requireAuthentication: true,
        signatureType: 'electronic'
      });
    }

    // 3. Propriétaire (dernier signataire)
    signers.push({
      name: `${parties.owner.firstName} ${parties.owner.lastName}`,
      email: parties.owner.email,
      role: 'owner',
      order: signers.length + 1,
      requireAuthentication: true,
      signatureType: 'electronic'
    });

    // Prépare la requête OpenSign selon l'API v1.1
    // Note: Pour l'instant, on envoie uniquement le bail principal
    // Les annexes seront disponibles séparément et pourront être jointes manuellement
    // ou via une fonctionnalité future de fusion PDF côté serveur
    const documentData = {
      name: `Bail de location - ${property.address}`,
      description: `Contrat de location pour le bien situé à ${property.address}${annexesPdfPath ? ' (annexes DDT disponibles)' : ''}`,
      file: {
        name: `bail_${leaseData._id || leaseData.id}.pdf`,
        content: pdfBase64,
        mimeType: 'application/pdf'
      },
      signers: signers.map(s => ({
        name: s.name,
        email: s.email,
        role: s.role,
        order: s.order,
        requireAuthentication: s.requireAuthentication,
        signatureType: s.signatureType
      })),
      settings: {
        // Rappels automatiques après 48h si non signé
        reminders: {
          enabled: true,
          interval: 48, // heures
          maxReminders: 3
        },
        // Expiration du document après 7 jours
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 jours à partir de maintenant
        // Notifications webhook
        webhook: {
          url: `${process.env.APP_URL || 'http://localhost:3000'}/api/webhooks/opensign`,
          events: ['document.signed', 'document.completed', 'document.expired', 'document.declined']
        },
        // Métadonnées pour identifier le bail
        metadata: {
          leaseId: String(leaseData._id || leaseData.id),
          propertyId: String(property._id || property.id),
          type: 'lease'
        }
      }
    };

    // Envoie la requête à OpenSign API v1.1
    const response = await opensignClient.post('/v1.1/documents', documentData);

    if (!response.data || !response.data.documentId) {
      throw new Error('Réponse OpenSign invalide: documentId manquant');
    }

    const { documentId, signingLinks } = response.data;

    // Log l'événement
    await logEvent(parties.owner._id || parties.owner.id, {
      property: property._id || property.id,
      type: 'opensign_document_created',
      meta: {
        leaseId: String(leaseData._id || leaseData.id),
        documentId: documentId,
        signersCount: signers.length
      }
    });

    return {
      success: true,
      documentId: documentId,
      signingLinks: signingLinks, // { tenant: url, guarantor: url, owner: url }
      signers: signers.map(s => ({ role: s.role, email: s.email }))
    };

  } catch (error) {
    console.error('❌ Erreur sendLeaseForSignature:', error);
    
    // Log l'erreur
    if (parties && parties.owner) {
      await logEvent(parties.owner._id || parties.owner.id, {
        property: property?._id || property?.id,
        type: 'opensign_error',
        meta: {
          leaseId: String(leaseData?._id || leaseData?.id),
          error: error.message
        }
      }).catch(() => {}); // Ignore les erreurs de log
    }

    throw error;
  }
}

/**
 * Récupère le statut d'un document OpenSign
 * @param {string} documentId - ID du document OpenSign
 * @returns {Promise<Object>} - Statut du document
 */
async function getDocumentStatus(documentId) {
  try {
    if (!OPENSIGN_API_KEY) {
      throw new Error('OpenSign API Key non configurée');
    }

    const response = await opensignClient.get(`/v1.1/documents/${documentId}`);

    return {
      success: true,
      status: response.data.status, // 'pending', 'signed', 'completed', 'expired', 'declined'
      signers: response.data.signers || [],
      completedAt: response.data.completedAt,
      signedPdfUrl: response.data.signedPdfUrl
    };
  } catch (error) {
    console.error('❌ Erreur getDocumentStatus:', error);
    throw error;
  }
}

/**
 * Télécharge le PDF final certifié depuis OpenSign
 * @param {string} documentId - ID du document OpenSign
 * @param {string} savePath - Chemin où sauvegarder le PDF (relatif à /uploads)
 * @returns {Promise<string>} - Chemin relatif du PDF téléchargé
 */
async function downloadSignedPdf(documentId, savePath) {
  try {
    if (!OPENSIGN_API_KEY) {
      throw new Error('OpenSign API Key non configurée');
    }

    // Récupère l'URL du PDF signé
    const statusResponse = await getDocumentStatus(documentId);
    if (!statusResponse.signedPdfUrl) {
      throw new Error('PDF signé non disponible');
    }

    // Télécharge le PDF
    const pdfResponse = await axios.get(statusResponse.signedPdfUrl, {
      responseType: 'arraybuffer',
      headers: {
        'x-api-token': OPENSIGN_API_KEY
      }
    });

    // Sauvegarde le PDF
    const absolutePath = path.join(__dirname, '../../', savePath);
    const dir = path.dirname(absolutePath);
    
    // Crée le dossier s'il n'existe pas
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(absolutePath, pdfResponse.data);

    return savePath;
  } catch (error) {
    console.error('❌ Erreur downloadSignedPdf:', error);
    throw error;
  }
}

/**
 * Renvoie le lien de signature pour un signataire
 * @param {string} documentId - ID du document OpenSign
 * @param {string} signerEmail - Email du signataire
 * @returns {Promise<string>} - URL de signature
 */
async function resendSigningLink(documentId, signerEmail) {
  try {
    if (!OPENSIGN_API_KEY) {
      throw new Error('OpenSign API Key non configurée');
    }

    const response = await opensignClient.post(`/api/v1/documents/${documentId}/resend`, {
      email: signerEmail
    });

    return {
      success: true,
      signingLink: response.data.signingLink
    };
  } catch (error) {
    console.error('❌ Erreur resendSigningLink:', error);
    throw error;
  }
}

module.exports = {
  sendLeaseForSignature,
  getDocumentStatus,
  downloadSignedPdf,
  resendSigningLink
};
