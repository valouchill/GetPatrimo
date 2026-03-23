/**
 * Contrôleur pour les webhooks OpenSign
 * Gère les notifications de signature électronique
 */

const Lease = require('../../models/Lease');
const Property = require('../../models/Property');
const Candidature = require('../../models/Candidature');
const { downloadSignedPdf } = require('../services/opensignService');
const { logEvent } = require('../services/eventService');
const path = require('path');

/**
 * Webhook OpenSign - Reçoit les notifications de signature
 * POST /api/webhooks/opensign
 */
async function handleOpenSignWebhook(req, res) {
  try {
    const { event, documentId, metadata, signers, signedPdfUrl } = req.body;

    // Validation basique
    if (!event || !documentId) {
      console.warn('⚠️ Webhook OpenSign invalide: event ou documentId manquant');
      return res.status(400).json({ msg: 'Données invalides' });
    }

    // Sécurité : Vérifie que le webhook vient bien d'OpenSign
    // En production, vous devriez vérifier la signature HMAC du webhook
    const webhookSecret = process.env.OPENSIGN_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-opensign-signature'];
      if (!signature) {
        console.warn('⚠️ Webhook OpenSign: signature manquante');
        return res.status(401).json({ msg: 'Signature invalide' });
      }
      // TODO: Implémenter la vérification HMAC si nécessaire
    }

    // Récupère le bail via les métadonnées (plus sécurisé que via documentId)
    const leaseId = metadata?.leaseId;
    if (!leaseId) {
      console.warn('⚠️ Webhook OpenSign: leaseId manquant dans metadata');
      return res.status(400).json({ msg: 'leaseId manquant' });
    }

    const lease = await Lease.findById(leaseId)
      .populate('property')
      .populate('user');

    if (!lease) {
      console.error(`❌ Bail introuvable: ${leaseId}`);
      return res.status(404).json({ msg: 'Bail introuvable' });
    }

    const documentKind = metadata?.kind
      || (lease.opensignDocuments || []).find((item) => item.documentId === documentId)?.kind
      || 'LEASE';

    // Traite selon le type d'événement
    switch (event) {
      case 'document.signed':
        await handleDocumentSigned(lease, signers, documentId, documentKind);
        break;

      case 'document.completed':
        await handleDocumentCompleted(lease, documentId, signedPdfUrl, documentKind);
        break;

      case 'document.expired':
        await handleDocumentExpired(lease, documentId);
        break;

      case 'document.declined':
        await handleDocumentDeclined(lease, documentId);
        break;

      default:
        console.log(`ℹ️ Événement OpenSign non géré: ${event}`);
    }

    // Répond immédiatement à OpenSign (200 OK)
    return res.status(200).json({ success: true, received: true });

  } catch (error) {
    console.error('❌ Erreur handleOpenSignWebhook:', error);
    // Répond quand même 200 pour éviter que OpenSign réessaie indéfiniment
    return res.status(200).json({ success: false, error: error.message });
  }
}

/**
 * Gère l'événement 'document.signed' - Un signataire a signé
 */
function updateTrackedDocument(lease, documentId, patch) {
  const tracked = Array.isArray(lease.opensignDocuments) ? lease.opensignDocuments : [];
  const existing = tracked.find((item) => item.documentId === documentId);
  if (existing) {
    Object.assign(existing, patch);
    return existing;
  }

  tracked.push({
    kind: patch.kind || 'LEASE',
    documentId,
    status: patch.status || 'PENDING',
    signingLinks: patch.signingLinks || {},
    signedPdfPath: patch.signedPdfPath || '',
    completedAt: patch.completedAt,
  });
  lease.opensignDocuments = tracked;
  return tracked[tracked.length - 1];
}

function computeAggregateStatus(lease) {
  const statuses = (lease.opensignDocuments || []).map((item) => item.status).filter(Boolean);
  if (!statuses.length) return lease.opensignStatus || 'PENDING';
  if (statuses.includes('DECLINED')) return 'DECLINED';
  if (statuses.includes('EXPIRED')) return 'EXPIRED';
  if (statuses.every((status) => status === 'COMPLETED')) return 'COMPLETED';
  if (statuses.includes('SIGNED') || statuses.includes('COMPLETED')) return 'SIGNED';
  return 'PENDING';
}

async function handleDocumentSigned(lease, signers, documentId, documentKind) {
  try {
    updateTrackedDocument(lease, documentId, {
      kind: documentKind,
      status: 'SIGNED',
    });
    lease.opensignDocumentId = documentId;
    lease.opensignStatus = computeAggregateStatus(lease);

    // Identifie quel signataire a signé
    const signedSigners = signers?.filter(s => s.signedAt) || [];
    
    for (const signer of signedSigners) {
      if (signer.role === 'tenant' && !lease.tenantSignedAt) {
        lease.tenantSignedAt = new Date(signer.signedAt);
        if (lease.signatureStatus === 'PENDING' || lease.signatureStatus === 'SIGNED_BY_OWNER') {
          lease.signatureStatus = lease.signatureStatus === 'SIGNED_BY_OWNER' ? 'SIGNED_BOTH' : 'SIGNED_BY_TENANT';
        }
      } else if (signer.role === 'owner' && !lease.ownerSignedAt) {
        lease.ownerSignedAt = new Date(signer.signedAt);
        if (lease.signatureStatus === 'PENDING' || lease.signatureStatus === 'SIGNED_BY_TENANT') {
          lease.signatureStatus = lease.signatureStatus === 'SIGNED_BY_TENANT' ? 'SIGNED_BOTH' : 'SIGNED_BY_OWNER';
        }
      }
    }

    await lease.save();

    // Log l'événement
    await logEvent(lease.user._id || lease.user, {
      property: lease.property._id || lease.property,
      type: 'opensign_document_signed',
      meta: {
        leaseId: String(lease._id),
        documentId: documentId,
        signedBy: signedSigners.map(s => s.role).join(', ')
      }
    });

    console.log(`✅ Document signé: ${documentId} - Bail: ${lease._id}`);
  } catch (error) {
    console.error('❌ Erreur handleDocumentSigned:', error);
    throw error;
  }
}

/**
 * Gère l'événement 'document.completed' - Tous les signataires ont signé
 */
async function handleDocumentCompleted(lease, documentId, signedPdfUrl, documentKind) {
  try {
    // Met à jour le statut
    updateTrackedDocument(lease, documentId, {
      kind: documentKind,
      status: 'COMPLETED',
      completedAt: new Date(),
    });
    lease.opensignStatus = computeAggregateStatus(lease);
    lease.opensignDocumentId = documentId;
    if (documentKind === 'LEASE') {
      lease.signatureStatus = 'SIGNED_BOTH';
      lease.opensignCompletedAt = new Date();
    }

    // Télécharge le PDF final certifié
    const signedPdfPath = `uploads/leases/signed/${documentKind}_${lease._id}_signed_${Date.now()}.pdf`;
    
    try {
      const downloadedPath = await downloadSignedPdf(documentId, signedPdfPath);
      if (documentKind === 'LEASE') {
        lease.signedPdfPath = downloadedPath;
      }
      updateTrackedDocument(lease, documentId, {
        kind: documentKind,
        status: 'COMPLETED',
        signedPdfPath: downloadedPath,
        completedAt: new Date(),
      });
      console.log(`✅ PDF signé téléchargé: ${downloadedPath}`);
    } catch (downloadError) {
      console.error('❌ Erreur téléchargement PDF signé:', downloadError);
      // Continue même si le téléchargement échoue
    }

    await lease.save();

    // Met à jour le statut du bien en 'Loué'
    const property = await Property.findById(lease.property._id || lease.property);
    if (property && computeAggregateStatus(lease) === 'COMPLETED') {
      property.status = 'OCCUPIED';
      await property.save();
      console.log(`✅ Bien ${property._id} mis à jour: OCCUPIED`);
    }

    // Met à jour le statut de la candidature
    const candidature = await Candidature.findById(lease.candidature);
    if (candidature) {
      candidature.status = 'SELECTED_FOR_LEASE';
      await candidature.save();
      console.log(`✅ Candidature ${candidature._id} confirmée en SELECTED_FOR_LEASE`);
    }

    // Log l'événement
    await logEvent(lease.user._id || lease.user, {
      property: lease.property._id || lease.property,
      type: 'opensign_document_completed',
      meta: {
        leaseId: String(lease._id),
        documentId: documentId,
        signedPdfPath: lease.signedPdfPath
      }
    });

    console.log(`✅ Document complété: ${documentId} - Bail: ${lease._id}`);
  } catch (error) {
    console.error('❌ Erreur handleDocumentCompleted:', error);
    throw error;
  }
}

/**
 * Gère l'événement 'document.expired' - Le document a expiré
 */
async function handleDocumentExpired(lease, documentId) {
  try {
    updateTrackedDocument(lease, documentId, { status: 'EXPIRED' });
    lease.opensignStatus = computeAggregateStatus(lease);
    await lease.save();

    await logEvent(lease.user._id || lease.user, {
      property: lease.property._id || lease.property,
      type: 'opensign_document_expired',
      meta: {
        leaseId: String(lease._id),
        documentId: documentId
      }
    });

    console.log(`⚠️ Document expiré: ${documentId} - Bail: ${lease._id}`);
  } catch (error) {
    console.error('❌ Erreur handleDocumentExpired:', error);
    throw error;
  }
}

/**
 * Gère l'événement 'document.declined' - Un signataire a refusé de signer
 */
async function handleDocumentDeclined(lease, documentId) {
  try {
    updateTrackedDocument(lease, documentId, { status: 'DECLINED' });
    lease.opensignStatus = computeAggregateStatus(lease);
    await lease.save();

    await logEvent(lease.user._id || lease.user, {
      property: lease.property._id || lease.property,
      type: 'opensign_document_declined',
      meta: {
        leaseId: String(lease._id),
        documentId: documentId
      }
    });

    console.log(`❌ Document refusé: ${documentId} - Bail: ${lease._id}`);
  } catch (error) {
    console.error('❌ Erreur handleDocumentDeclined:', error);
    throw error;
  }
}

module.exports = {
  handleOpenSignWebhook
};
