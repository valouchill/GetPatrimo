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

function toSigner(name, email, role, order) {
  return {
    name,
    email,
    role,
    order,
    requireAuthentication: true,
    signatureType: 'electronic',
  };
}

function buildSignersForDocument(kind, parties) {
  if (kind === 'GUARANTEE') {
    const signers = [];
    if (parties.guarantor?.email) {
      signers.push(toSigner(
        `${parties.guarantor.firstName || ''} ${parties.guarantor.lastName || ''}`.trim(),
        parties.guarantor.email,
        'guarantor',
        1
      ));
    }
    signers.push(toSigner(
      `${parties.owner.firstName || ''} ${parties.owner.lastName || ''}`.trim(),
      parties.owner.email,
      'owner',
      signers.length + 1
    ));
    return signers;
  }

  return [
    toSigner(
      `${parties.tenant.firstName || ''} ${parties.tenant.lastName || ''}`.trim(),
      parties.tenant.email,
      'tenant',
      1
    ),
    toSigner(
      `${parties.owner.firstName || ''} ${parties.owner.lastName || ''}`.trim(),
      parties.owner.email,
      'owner',
      2
    ),
  ];
}

async function sendDocumentForSignature({ lease, property, parties, document, index }) {
  if (!OPENSIGN_API_KEY) {
    throw new Error('OpenSign API Key non configurée');
  }

  const signers = buildSignersForDocument(document.kind, parties);
  const documentData = {
    name: document.kind === 'GUARANTEE'
      ? `Acte de caution - ${property.address}`
      : `Bail de location - ${property.address}`,
    description: document.kind === 'GUARANTEE'
      ? `Acte de caution solidaire pour le bien situé à ${property.address}`
      : `Contrat de location pour le bien situé à ${property.address}`,
    file: {
      name: document.kind === 'GUARANTEE'
        ? `caution_${lease._id || lease.id}.pdf`
        : `bail_${lease._id || lease.id}.pdf`,
      content: document.pdfBuffer.toString('base64'),
      mimeType: 'application/pdf',
    },
    signers: signers.map((signer) => ({
      name: signer.name,
      email: signer.email,
      role: signer.role,
      order: signer.order,
      requireAuthentication: signer.requireAuthentication,
      signatureType: signer.signatureType,
    })),
    settings: {
      reminders: {
        enabled: true,
        interval: 48,
        maxReminders: 3,
      },
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      webhook: {
        url: `${process.env.APP_URL || 'http://localhost:3000'}/api/webhooks/opensign`,
        events: ['document.signed', 'document.completed', 'document.expired', 'document.declined'],
      },
      metadata: {
        leaseId: String(lease._id || lease.id),
        propertyId: String(property._id || property.id),
        type: 'lease_bundle',
        kind: document.kind,
        bundleIndex: index,
      },
    },
  };

  const response = await opensignClient.post('/v1.1/documents', documentData);
  if (!response.data?.documentId) {
    throw new Error('Réponse OpenSign invalide: documentId manquant');
  }

  const { documentId, signingLinks } = response.data;
  await logEvent(parties.owner._id || parties.owner.id, {
    property: property._id || property.id,
    type: 'opensign_document_created',
    meta: {
      leaseId: String(lease._id || lease.id),
      documentId,
      kind: document.kind,
      signersCount: signers.length,
    },
  });

  return {
    kind: document.kind,
    documentId,
    status: 'PENDING',
    signingLinks,
    signers: signers.map((signer) => ({ role: signer.role, email: signer.email })),
  };
}

async function sendDocumentsForSignature({ lease, property, parties, documents }) {
  try {
    const results = [];
    for (const [index, document] of documents.entries()) {
      results.push(await sendDocumentForSignature({
        lease,
        property,
        parties,
        document,
        index,
      }));
    }

    return {
      success: true,
      documents: results,
    };
  } catch (error) {
    console.error('❌ Erreur sendDocumentsForSignature:', error);
    if (parties?.owner) {
      await logEvent(parties.owner._id || parties.owner.id, {
        property: property?._id || property?.id,
        type: 'opensign_error',
        meta: {
          leaseId: String(lease?._id || lease?.id),
          error: error.message,
        },
      }).catch(() => {});
    }
    throw error;
  }
}

async function sendLeaseForSignature(leaseData, property, parties, pdfPath) {
  const absolutePdfPath = path.join(__dirname, '../../', pdfPath);
  if (!fs.existsSync(absolutePdfPath)) {
    throw new Error(`Fichier PDF introuvable: ${absolutePdfPath}`);
  }

  const pdfBuffer = fs.readFileSync(absolutePdfPath);
  const result = await sendDocumentsForSignature({
    lease: leaseData,
    property,
    parties,
    documents: [{ kind: 'LEASE', pdfBuffer }],
  });

  const first = result.documents[0];
  return {
    success: true,
    documentId: first.documentId,
    signingLinks: first.signingLinks,
    signers: first.signers,
  };
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

    const OPENSIGN_STATUS_MAP = {
      pending: 'PENDING',
      signed: 'SIGNED',
      completed: 'COMPLETED',
      expired: 'EXPIRED',
      declined: 'DECLINED',
    };
    const rawStatus = String(response.data.status || '').toLowerCase();
    const normalizedStatus = OPENSIGN_STATUS_MAP[rawStatus] || 'PENDING';

    return {
      success: true,
      status: normalizedStatus,
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
  sendDocumentsForSignature,
  sendLeaseForSignature,
  getDocumentStatus,
  downloadSignedPdf,
  resendSigningLink
};
