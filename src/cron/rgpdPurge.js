/**
 * Cron Job pour la purge automatique RGPD
 * Exécute la purge tous les jours à 2h du matin
 *
 * Règles de purge :
 * 1. Candidatures refusées > 3 mois : anonymisation des données personnelles
 * 2. Pièces d'identité des candidats non retenus : suppression immédiate après décision
 * 3. Données biométriques Didit : suppression après vérification terminée
 * 4. Leads marketing sans interaction > 3 ans : suppression
 */

const { connectDB } = require('../config/db');

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;

/**
 * Rapport de purge
 */
function createReport() {
  return {
    startedAt: new Date().toISOString(),
    candidaturesPurged: 0,
    identityDocsPurged: 0,
    diditDataPurged: 0,
    leadsPurged: 0,
    errors: [],
  };
}

/**
 * 1. Purge des candidatures refusées après 3 mois
 */
async function purgeRejectedCandidatures(report) {
  const Candidature = require('../../models/Candidature');
  const cutoffDate = new Date(Date.now() - THREE_MONTHS_MS);

  const candidates = await Candidature.find({
    rgpdPurged: { $ne: true },
    status: { $in: ['REJECTED', 'ARCHIVED_REFUSED', 'REFUSED'] },
    updatedAt: { $lt: cutoffDate },
  });

  for (const candidature of candidates) {
    try {
      // Supprimer les fichiers physiques
      await purgeCandidateFiles(candidature.docs || []);

      // Anonymiser les données personnelles
      candidature.firstName = '';
      candidature.lastName = '';
      candidature.email = '';
      candidature.phone = '';
      candidature.message = '';
      candidature.docs = [];
      candidature.monthlyNetIncome = 0;
      candidature.contractType = '';
      candidature.hasGuarantor = false;
      candidature.guarantorType = '';
      candidature.rgpdPurged = true;
      candidature.rgpdPurgedAt = new Date();

      await candidature.save();
      report.candidaturesPurged += 1;
      console.log(`[RGPD] Candidature ${candidature._id} purgée (refusée depuis ${candidature.updatedAt?.toISOString()})`);
    } catch (err) {
      const msg = `Erreur purge candidature ${candidature._id}: ${err.message}`;
      report.errors.push(msg);
      console.error(`[RGPD] ${msg}`);
    }
  }
}

/**
 * 2. Purge des pièces d'identité des candidats non retenus (immédiat après décision)
 */
async function purgeNonSelectedIdentityDocs(report) {
  const Application = require('../../models/Application');
  const Property = require('../../models/Property');
  const fs = require('fs');
  const path = require('path');

  // Trouver les propriétés qui ont un candidat accepté
  const propertiesWithSelection = await Property.find({
    acceptedTenantId: { $ne: null },
  }).select('_id acceptedTenantId').lean();

  for (const prop of propertiesWithSelection) {
    // Trouver les applications NON retenues pour cette propriété
    const nonSelected = await Application.find({
      property: prop._id,
      _id: { $ne: prop.acceptedTenantId },
      'identityDocsPurged': { $ne: true },
      ownerDecision: { $in: ['REJECTED', 'PENDING'] },
    });

    for (const app of nonSelected) {
      try {
        // Supprimer les documents d'identité (CNI, passeport)
        const identityDocs = (app.documents || []).filter(
          (d) => ['CNI', 'PASSEPORT', 'CARTE_IDENTITE', 'PASSPORT', 'ID_CARD'].includes(String(d.type || '').toUpperCase())
        );

        for (const doc of identityDocs) {
          if (doc.filePath) {
            const fullPath = path.resolve(doc.filePath);
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
              console.log(`[RGPD] Fichier identité supprimé: ${fullPath}`);
            }
          }
        }

        await Application.updateOne(
          { _id: app._id },
          {
            $set: { identityDocsPurged: true, identityDocsPurgedAt: new Date() },
            $pull: { documents: { type: { $in: ['CNI', 'PASSEPORT', 'CARTE_IDENTITE', 'PASSPORT', 'ID_CARD'] } } },
          }
        );

        report.identityDocsPurged += 1;
        console.log(`[RGPD] Docs identité supprimés pour application ${app._id} (propriété ${prop._id})`);
      } catch (err) {
        const msg = `Erreur purge identité application ${app._id}: ${err.message}`;
        report.errors.push(msg);
        console.error(`[RGPD] ${msg}`);
      }
    }
  }
}

/**
 * 3. Purge des données biométriques Didit après vérification
 */
async function purgeDiditBiometricData(report) {
  const IdentitySession = require('../../models/IdentitySession');

  // Sessions Didit terminées (vérifiées ou expirées) non encore purgées
  const sessions = await IdentitySession.find({
    status: { $in: ['VERIFIED', 'APPROVED', 'DECLINED', 'EXPIRED'] },
    biometricPurged: { $ne: true },
  });

  for (const session of sessions) {
    try {
      // Supprimer les données biométriques brutes (selfie, liveness data)
      await IdentitySession.updateOne(
        { _id: session._id },
        {
          $set: {
            biometricPurged: true,
            biometricPurgedAt: new Date(),
          },
          $unset: {
            'verificationData.selfie': '',
            'verificationData.livenessData': '',
            'verificationData.faceMatch': '',
            'verificationData.rawResponse': '',
          },
        }
      );

      report.diditDataPurged += 1;
      console.log(`[RGPD] Données biométriques purgées pour session ${session._id}`);
    } catch (err) {
      const msg = `Erreur purge biométrique session ${session._id}: ${err.message}`;
      report.errors.push(msg);
      console.error(`[RGPD] ${msg}`);
    }
  }
}

/**
 * 4. Purge des leads marketing sans interaction depuis 3 ans
 */
async function purgeInactiveLeads(report) {
  const Lead = require('../../models/Lead');
  const cutoffDate = new Date(Date.now() - THREE_YEARS_MS);

  const result = await Lead.deleteMany({
    updatedAt: { $lt: cutoffDate },
  });

  report.leadsPurged = result.deletedCount || 0;
  if (report.leadsPurged > 0) {
    console.log(`[RGPD] ${report.leadsPurged} lead(s) marketing supprimé(s) (inactifs > 3 ans)`);
  }
}

/**
 * Supprime les fichiers physiques d'une candidature
 */
async function purgeCandidateFiles(docs) {
  const fs = require('fs');
  const path = require('path');

  for (const doc of docs) {
    const filePath = doc.filePath || doc.path;
    if (!filePath) continue;
    try {
      const fullPath = path.resolve(filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`[RGPD] Fichier supprimé: ${fullPath}`);
      }
    } catch (err) {
      console.error(`[RGPD] Erreur suppression fichier ${filePath}: ${err.message}`);
    }
  }
}

/**
 * Exécute la purge RGPD complète
 */
async function runRGPDPurge() {
  const report = createReport();

  try {
    console.log('========================================');
    console.log('[RGPD] Démarrage purge automatique');
    console.log('========================================');

    await connectDB();

    await purgeRejectedCandidatures(report);
    await purgeNonSelectedIdentityDocs(report);
    await purgeDiditBiometricData(report);
    await purgeInactiveLeads(report);

    report.completedAt = new Date().toISOString();

    console.log('========================================');
    console.log('[RGPD] Rapport de purge :');
    console.log(JSON.stringify(report, null, 2));
    console.log('========================================');

    process.exit(0);
  } catch (error) {
    report.errors.push(`Erreur fatale: ${error.message}`);
    report.completedAt = new Date().toISOString();
    console.error('[RGPD] Erreur fatale:', error);
    console.error('[RGPD] Rapport partiel:', JSON.stringify(report, null, 2));
    process.exit(1);
  }
}

// Exécution si appelé directement
if (require.main === module) {
  runRGPDPurge();
}

module.exports = { runRGPDPurge };
