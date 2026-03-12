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

    // Vérifie que le documentId correspond
    if (lease.opensignDocumentId !== documentId) {
      console.warn(`⚠️ DocumentId mismatch: ${lease.opensignDocumentId} !== ${documentId}`);
      // Continue quand même, peut-être que le documentId n'a pas encore été sauvegardé
    }

    // Traite selon le type d'événement
    switch (event) {
      case 'document.signed':
        await handleDocumentSigned(lease, signers, documentId);
        break;

      case 'document.completed':
        await handleDocumentCompleted(lease, documentId, signedPdfUrl);
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
async function handleDocumentSigned(lease, signers, documentId) {
  try {
    // Met à jour le statut OpenSign
    lease.opensignStatus = 'signed';
    lease.opensignDocumentId = documentId;

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
async function handleDocumentCompleted(lease, documentId, signedPdfUrl) {
  try {
    // Met à jour le statut
    lease.opensignStatus = 'completed';
    lease.opensignDocumentId = documentId;
    lease.signatureStatus = 'SIGNED_BOTH';
    lease.opensignCompletedAt = new Date();

    // Télécharge le PDF final certifié
    const signedPdfPath = `uploads/leases/signed/bail_${lease._id}_signed_${Date.now()}.pdf`;
    
    try {
      const downloadedPath = await downloadSignedPdf(documentId, signedPdfPath);
      lease.signedPdfPath = downloadedPath;
      console.log(`✅ PDF signé téléchargé: ${downloadedPath}`);
    } catch (downloadError) {
      console.error('❌ Erreur téléchargement PDF signé:', downloadError);
      // Continue même si le téléchargement échoue
    }

    await lease.save();

    // Met à jour le statut du bien en 'Loué'
    const property = await Property.findById(lease.property._id || lease.property);
    if (property) {
      property.status = 'RENTED';
      await property.save();
      console.log(`✅ Bien ${property._id} mis à jour: RENTED`);
    }

    // Met à jour le statut de la candidature
    const candidature = await Candidature.findById(lease.candidature);
    if (candidature) {
      candidature.status = 'LEASE_SIGNED';
      await candidature.save();
      console.log(`✅ Candidature ${candidature._id} mise à jour: LEASE_SIGNED`);
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
    lease.opensignStatus = 'expired';
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
    lease.opensignStatus = 'declined';
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
