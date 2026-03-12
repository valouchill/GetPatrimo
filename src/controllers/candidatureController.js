// Controller pour la gestion des candidatures
const Candidature = require('../../models/Candidature');
const Property = require('../../models/Property');
const path = require('path');
const fs = require('fs');
const { uploadsDir } = require('../config/app');

/**
 * Récupère toutes les candidatures de tous les biens d'un propriétaire
 */
async function getAllCandidatures(req, res) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      console.error('❌ getAllCandidatures: userId manquant dans req.user');
      return res.status(401).json({ msg: 'Non authentifié' });
    }

    console.log('📋 getAllCandidatures appelé pour userId:', userId);

    // Récupère tous les biens du propriétaire
    const properties = await Property.find({ user: userId }).select('_id name').lean();
    const propertyIds = properties.map(p => p._id);

    console.log(`🏠 ${properties.length} bien(s) trouvé(s) pour l'utilisateur`);

    if (propertyIds.length === 0) {
      console.log('ℹ️ Aucun bien trouvé, retourne tableau vide');
      return res.json([]);
    }

    // Récupère toutes les candidatures avec les infos du bien
    const candidatures = await Candidature.find({ property: { $in: propertyIds } })
      .populate('property', 'name address addressLine zipCode city rentAmount')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`📄 ${candidatures.length} candidature(s) trouvée(s)`);

    // Enrichit avec les infos du bien
    const enriched = candidatures.map(c => ({
      ...c,
      propertyName: c.property?.name || 'Bien supprimé',
      propertyAddress: c.property?.address || [c.property?.addressLine, c.property?.zipCode, c.property?.city].filter(Boolean).join(', ') || '',
      propertyRent: c.property?.rentAmount || 0
    }));

    console.log('✅ getAllCandidatures: retourne', enriched.length, 'candidature(s)');
    return res.json(enriched);
  } catch (error) {
    console.error('❌ Erreur getAllCandidatures:', error);
    console.error('Stack:', error.stack);
    
    // Répond toujours avec un JSON valide, même en cas d'erreur
    if (!res.headersSent) {
      return res.status(500).json({ 
        msg: 'Erreur serveur',
        error: error.message 
      });
    }
  }
}

/**
 * Récupère une candidature par son ID (vérifie qu'elle appartient au propriétaire)
 */
async function getCandidatureById(req, res) {
  try {
    const userId = req.user.id;
    const candId = req.params.id;

    const cand = await Candidature.findById(candId)
      .populate('property', 'name address addressLine zipCode city rentAmount chargesAmount')
      .lean();

    if (!cand) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    // Vérifie que le bien appartient au propriétaire
    const prop = await Property.findById(cand.property?._id || cand.property);
    if (!prop || String(prop.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // Enrichit avec les infos du bien
    const enriched = {
      ...cand,
      propertyName: cand.property?.name || 'Bien supprimé',
      propertyAddress: cand.property?.address || [cand.property?.addressLine, cand.property?.zipCode, cand.property?.city].filter(Boolean).join(', ') || ''
    };

    return res.json(enriched);
  } catch (error) {
    console.error('Erreur getCandidatureById:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Récupère les candidatures d'un bien spécifique
 */
async function getCandidaturesByProperty(req, res) {
  try {
    console.log('🔍 getCandidaturesByProperty appelée avec propertyId:', req.params.propertyId);
    const userId = req.user.id;
    const propertyId = req.params.propertyId;

    if (!propertyId) {
      console.error('❌ propertyId manquant');
      return res.status(400).json({ msg: 'ID du bien manquant' });
    }

    const prop = await Property.findOne({ _id: propertyId, user: userId });
    if (!prop) {
      console.error('❌ Bien introuvable:', propertyId, 'pour user:', userId);
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    const candidatures = await Candidature.find({ property: propertyId })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ getCandidaturesByProperty: ${candidatures.length} candidature(s) trouvée(s) pour le bien ${propertyId}`);
    
    return res.json(candidatures);
  } catch (error) {
    console.error('Erreur getCandidaturesByProperty:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Télécharge un document de candidature
 */
async function downloadCandidatureFile(req, res) {
  try {
    const userId = req.user.id;
    const candId = req.params.candId;
    const docId = req.params.docId;

    const cand = await Candidature.findById(candId);
    if (!cand) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    // Vérifie que le bien appartient au propriétaire
    const prop = await Property.findById(cand.property);
    if (!prop || String(prop.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    const doc = (cand.docs || []).find(d => String(d._id) === String(docId));
    if (!doc) {
      return res.status(404).json({ msg: 'Document introuvable' });
    }

    const root = path.resolve(uploadsDir);
    const abs = path.resolve(uploadsDir, doc.relPath || '');
    
    if (!abs.startsWith(root)) {
      return res.status(400).json({ msg: 'Chemin invalide' });
    }

    if (!fs.existsSync(abs)) {
      return res.status(404).json({ msg: 'Fichier manquant' });
    }

    return res.download(abs, doc.originalName || 'document');
  } catch (error) {
    console.error('Erreur downloadCandidatureFile:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Accepte une candidature et génère le bail
 */
async function acceptCandidature(req, res) {
  try {
    const userId = req.user.id;
    const candId = req.params.id;

    const cand = await Candidature.findById(candId);
    if (!cand) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    // Vérifie que le bien appartient au propriétaire
    const prop = await Property.findById(cand.property);
    if (!prop || String(prop.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // 1. Passe le candidat choisi à SELECTED_FOR_LEASE
    cand.status = 'SELECTED_FOR_LEASE';
    cand.shortlisted = true;
    await cand.save();

    // 1.5. Met le bien en statut "Bail en cours"
    prop.status = 'LEASE_IN_PROGRESS';
    await prop.save();

    // 2. Archive tous les autres candidats du bien en ARCHIVED_REFUSED
    const otherCands = await Candidature.find({
      property: prop._id,
      _id: { $ne: cand._id },
      status: { $nin: ['ARCHIVED_REFUSED'] }
    });

    const archivedEmails = [];
    for (const otherCand of otherCands) {
      otherCand.status = 'ARCHIVED_REFUSED';
      await otherCand.save();
      
      // 3. Envoie un email de refus élégant (mocké pour l'instant)
      if (otherCand.email) {
        try {
          const { sendEmail, isEmailConfigured } = require('../services/emailService');
          if (isEmailConfigured()) {
            await sendEmail({
              to: otherCand.email,
              subject: `Candidature pour ${prop.name || 'votre bien'}`,
              html: `
                <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                  <h2 style="color: #0F172A; margin-bottom: 24px;">Bonjour ${otherCand.firstName || ''},</h2>
                  <p style="color: #64748B; line-height: 1.6; margin-bottom: 24px;">
                    Nous vous remercions de l'intérêt que vous avez porté à notre bien immobilier.
                  </p>
                  <p style="color: #64748B; line-height: 1.6; margin-bottom: 24px;">
                    Après avoir examiné attentivement votre dossier, nous avons le regret de vous informer que nous avons retenu un autre candidat pour cette location.
                  </p>
                  <p style="color: #64748B; line-height: 1.6; margin-bottom: 32px;">
                    Nous vous souhaitons bonne chance dans vos recherches et restons à votre disposition pour de futures opportunités.
                  </p>
                  <p style="color: #64748B; line-height: 1.6;">
                    Cordialement,<br>
                    <strong style="color: #0F172A;">L'équipe GetPatrimo</strong>
                  </p>
                </div>
              `
            });
          } else {
            // Mode mocké : log seulement
            console.log(`📧 [MOCK] Email de refus envoyé à ${otherCand.email}`);
          }
          archivedEmails.push(otherCand.email);
        } catch (emailError) {
          console.error(`Erreur envoi email refus à ${otherCand.email}:`, emailError);
        }
      }
    }

    // 4. Crée le bail (Lease)
    const Lease = require('../../models/Lease');
    const existingLease = await Lease.findOne({ candidature: cand._id });
    
    let lease;
    if (existingLease) {
      lease = existingLease;
    } else {
      lease = await Lease.create({
        user: userId,
        property: prop._id,
        candidature: cand._id,
        tenantFirstName: cand.firstName || '',
        tenantLastName: cand.lastName || '',
        tenantEmail: cand.email,
        tenantPhone: cand.phone || '',
        startDate: new Date(),
        rentAmount: prop.rentAmount || 0,
        chargesAmount: prop.chargesAmount || 0,
        depositAmount: (prop.rentAmount || 0) * 2, // 2 mois de loyer par défaut
        signatureStatus: 'PENDING',
        edlStatus: 'PENDING'
      });
    }

    return res.json({
      success: true,
      msg: 'Candidature sélectionnée. Le bail a été créé.',
      candidature: cand,
      lease: {
        id: lease._id,
        signatureStatus: lease.signatureStatus,
        edlStatus: lease.edlStatus
      },
      archived: {
        count: otherCands.length,
        emailsSent: archivedEmails.length
      }
    });
  } catch (error) {
    console.error('Erreur acceptCandidature:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Refuse une candidature et envoie un email de refus
 */
async function rejectCandidature(req, res) {
  try {
    const userId = req.user.id;
    const candId = req.params.id;

    const cand = await Candidature.findById(candId);
    if (!cand) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    // Vérifie que le bien appartient au propriétaire
    const prop = await Property.findById(cand.property);
    if (!prop || String(prop.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // Met à jour le statut
    cand.status = 'REJECTED';
    await cand.save();

    // Envoie l'email de refus
    try {
      const { sendEmail } = require('../services/emailService');
      await sendEmail({
        to: cand.email,
        subject: 'Votre candidature pour ' + (prop.name || 'le bien'),
        html: `
          <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#F8FAFC">
            <div style="background:#0F172A;color:#fff;padding:24px;border-radius:12px 12px 0 0">
              <h1 style="margin:0;font-size:24px">GetPatrimo</h1>
            </div>
            <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px">
              <h2 style="color:#0F172A;margin-bottom:16px">Bonjour ${cand.firstName || 'Madame, Monsieur'},</h2>
              <p style="color:#64748B;line-height:1.6;margin-bottom:16px">
                Nous vous remercions de votre candidature pour le bien <strong>${prop.name || ''}</strong>.
              </p>
              <p style="color:#64748B;line-height:1.6;margin-bottom:24px">
                Après examen de votre dossier, nous sommes au regret de vous informer que votre candidature n'a pas été retenue pour ce bien.
              </p>
              <p style="color:#64748B;line-height:1.6;margin-bottom:0">
                Nous vous souhaitons bonne chance dans vos recherches.
              </p>
              <p style="color:#64748B;line-height:1.6;margin-top:24px;margin-bottom:0">
                Cordialement,<br>
                L'équipe GetPatrimo
              </p>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Erreur envoi email refus:', emailError);
      // Continue même si l'email échoue
    }

    return res.json({
      success: true,
      msg: 'Candidature refusée. Un email de refus a été envoyé.',
      candidature: cand
    });
  } catch (error) {
    console.error('Erreur rejectCandidature:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Met à jour le statut d'une candidature
 */
async function updateCandidatureStatus(req, res) {
  try {
    const userId = req.user.id;
    const candId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ msg: 'Statut manquant' });
    }

    const validStatuses = ['NEW', 'REVIEWED', 'ACCEPTED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: 'Statut invalide' });
    }

    const cand = await Candidature.findById(candId)
      .populate('property', 'user');

    if (!cand) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    // Vérifie que le bien appartient au propriétaire
    const prop = cand.property;
    if (!prop || String(prop.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    cand.status = status;
    await cand.save();

    return res.json(cand);
  } catch (error) {
    console.error('Erreur updateCandidatureStatus:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Génère l'insight IA pour une candidature
 */
async function getCandidatureInsight(req, res) {
  try {
    const userId = req.user.id;
    const candId = req.params.id;

    const cand = await Candidature.findById(candId);

    if (!cand) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    // Vérifie que le bien appartient au propriétaire
    const Property = require('../../models/Property');
    const prop = await Property.findOne({ _id: cand.property, user: userId });
    
    if (!prop) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // Génère l'insight IA
    const { generateCandidatureInsight } = require('../services/aiService');
    const insight = await generateCandidatureInsight(cand, prop);

    return res.json(insight);
  } catch (error) {
    console.error('Erreur getCandidatureInsight:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Annule l'acceptation d'une candidature (Revenir sur la décision)
 * Remet le bien en statut de sélection de candidat
 */
async function cancelAcceptance(req, res) {
  try {
    const userId = req.user.id;
    const candId = req.params.id;

    const cand = await Candidature.findById(candId);
    if (!cand) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    // Vérifie que le bien appartient au propriétaire
    const prop = await Property.findById(cand.property);
    if (!prop || String(prop.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // Remet le statut de la candidature à REVIEWED si SELECTED_FOR_LEASE ou ACCEPTED
    if (cand.status === 'SELECTED_FOR_LEASE' || cand.status === 'ACCEPTED') {
      cand.status = 'REVIEWED';
      cand.shortlisted = false;
      await cand.save();

      // Remet le bien en statut de sélection de candidat
      if (prop.status === 'LEASE_IN_PROGRESS') {
        prop.status = 'CANDIDATE_SELECTION';
        await prop.save();
      }

      // Supprime le bail associé s'il existe
      const Lease = require('../../models/Lease');
      const lease = await Lease.findOne({ candidature: cand._id });
      if (lease) {
        await lease.deleteOne();
      }
    }

    return res.json({
      success: true,
      msg: 'Décision annulée. Le bien est de nouveau disponible pour la sélection de candidats.',
      candidature: cand,
      property: {
        id: prop._id,
        status: prop.status
      }
    });
  } catch (error) {
    console.error('Erreur cancelAcceptance:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Met à jour le statut shortlist (favori) d'une candidature
 */
async function toggleShortlist(req, res) {
  try {
    const userId = req.user.id;
    const candId = req.params.id;
    const { shortlisted } = req.body;

    const cand = await Candidature.findById(candId);
    if (!cand) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    // Vérifie que le bien appartient au propriétaire
    const prop = await Property.findById(cand.property);
    if (!prop || String(prop.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // Met à jour le statut shortlist
    const newShortlisted = typeof shortlisted !== 'undefined' ? !!shortlisted : !cand.shortlisted;
    cand.shortlisted = newShortlisted;
    await cand.save();

    return res.json({
      msg: newShortlisted ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris',
      shortlisted: newShortlisted,
      candidature: cand
    });
  } catch (error) {
    console.error('Erreur toggleShortlist:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Lance l'analyse PatrimoTrust™ sur une candidature
 */
async function runTrustAnalysis(req, res) {
  try {
    const userId = req.user.id;
    const candId = req.params.id;

    const cand = await Candidature.findById(candId);
    if (!cand) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    // Vérifie que le bien appartient au propriétaire
    const prop = await Property.findById(cand.property);
    if (!prop || String(prop.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    const { analyzeCandidatureTrust } = require('../services/trustEngineService');
    const analysis = await analyzeCandidatureTrust(cand, prop);

    cand.trustAnalysis = analysis;
    await cand.save();

    return res.json(analysis);
  } catch (error) {
    console.error('Erreur runTrustAnalysis:', error);
    return res.status(500).json({ msg: 'Erreur analyse' });
  }
}

module.exports = {
  getAllCandidatures,
  getCandidatureById,
  getCandidaturesByProperty,
  downloadCandidatureFile,
  acceptCandidature,
  rejectCandidature,
  getCandidatureInsight,
  cancelAcceptance,
  updateCandidatureStatus,
  toggleShortlist,
  runTrustAnalysis
};
