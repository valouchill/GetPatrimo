/**
 * Cron Job pour la purge automatique RGPD
 * Exécute la purge tous les jours à 2h du matin
 *
 * Règles de purge :
 * 1. Candidatures refusées > 3 mois : anonymisation des données personnelles
 * 2. Pièces d'identité des candidats non retenus : suppression immédiate après décision
 * 2bis. Dossiers (Application) non retenus : purge complète (pièces + PII) 3 mois après
 *       l'attribution du bien — AIPD §1.1 / plan d'action n°1
 * 3. Données biométriques Didit : suppression après vérification terminée
 * 4. Leads marketing sans interaction > 3 ans : suppression
 */

const { connectDB } = require('../config/db');
const { logger } = require('../../lib/logger');

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
    applicationsPurged: 0,
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
      logger.info('[RGPD] Candidature purgee', { candidatureId: candidature._id, refusedSince: candidature.updatedAt?.toISOString() });
    } catch (err) {
      const msg = `Erreur purge candidature ${candidature._id}: ${err.message}`;
      report.errors.push(msg);
      logger.error(`[RGPD] ${msg}`);
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
              logger.info('[RGPD] Fichier identite supprime', { path: fullPath });
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
        logger.info('[RGPD] Docs identite supprimes', { applicationId: app._id, propertyId: prop._id });
      } catch (err) {
        const msg = `Erreur purge identité application ${app._id}: ${err.message}`;
        report.errors.push(msg);
        logger.error(`[RGPD] ${msg}`);
      }
    }
  }
}

/**
 * 2bis. Purge complète des dossiers (Application) non retenus, 3 mois après l'attribution
 * du bien (AIPD §1.1 : « suppression ≤ 3 mois après attribution »).
 *
 * L'étape 2 supprime les pièces d'identité IMMÉDIATEMENT après la décision ; ici, passé
 * 3 mois, on supprime TOUTES les pièces restantes (avis d'imposition, bulletins, domicile —
 * fichiers physiques inclus) + les PII du profil et l'identité Didit extraite.
 * On conserve volontairement userEmail : c'est la clé du compte du candidat (ses autres
 * candidatures et la suppression self-service de son compte couvrent ce reliquat).
 */
async function purgeNonSelectedApplications(report) {
  const Application = require('../../models/Application');
  const Property = require('../../models/Property');
  const cutoffDate = new Date(Date.now() - THREE_MONTHS_MS);

  const propertiesWithSelection = await Property.find({
    acceptedTenantId: { $ne: null },
  }).select('_id acceptedTenantId').lean();

  for (const prop of propertiesWithSelection) {
    const nonSelected = await Application.find({
      property: prop._id,
      _id: { $ne: prop.acceptedTenantId },
      rgpdPurged: { $ne: true },
      updatedAt: { $lt: cutoffDate },
    });

    for (const app of nonSelected) {
      try {
        await purgeCandidateFiles(app.documents || []);

        await Application.updateOne(
          { _id: app._id },
          {
            $set: {
              documents: [],
              'profile.firstName': '',
              'profile.lastName': '',
              'profile.phone': '',
              'profile.presentationText': '',
              financialSummary: {},
              rgpdPurged: true,
              rgpdPurgedAt: new Date(),
            },
            $unset: { 'didit.identityData': '' },
          }
        );

        report.applicationsPurged += 1;
        logger.info('[RGPD] Dossier non retenu purgé (3 mois post-attribution)', {
          applicationId: app._id,
          propertyId: prop._id,
        });
      } catch (err) {
        const msg = `Erreur purge dossier ${app._id}: ${err.message}`;
        report.errors.push(msg);
        logger.error(`[RGPD] ${msg}`);
      }
    }
  }
}

/**
 * 3. Purge des données biométriques Didit après vérification
 */
// Rétention légale de l'identité KYC après vérification (art. 5 RGPD, minimisation).
// Au-delà, on efface nom/prénom/date de naissance ; la preuve de vérification
// (humanVerified, verifiedAt) est conservée sans donnée personnelle.
const IDENTITY_RETENTION_DAYS = 90;

async function purgeDiditBiometricData(report) {
  const IdentitySession = require('../../models/IdentitySession');

  const cutoff = new Date(Date.now() - IDENTITY_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Sessions Didit terminées et anciennes, encore porteuses d'identité en clair.
  // Correctifs (audit) : (a) statut comparé en insensible à la casse — le webhook
  // écrit 'approved'/'declined' en minuscules, l'ancien filtre en MAJUSCULES ne
  // matchait JAMAIS ; (b) on cible les VRAIS champs (firstName/lastName/birthDate),
  // pas des `verificationData.*` inexistants dans le schéma.
  const sessions = await IdentitySession.find({
    status: { $in: [/^approved$/i, /^declined$/i, /^expired$/i, /^verified$/i] },
    $or: [
      { firstName: { $nin: ['', null] } },
      { lastName: { $nin: ['', null] } },
      { birthDate: { $nin: ['', null] } },
    ],
    $and: [{ $or: [{ verifiedAt: { $lte: cutoff } }, { verifiedAt: null, updatedAt: { $lte: cutoff } }] }],
  });

  for (const session of sessions) {
    try {
      // Efface l'identité en clair ; conserve la preuve de vérification.
      await IdentitySession.updateOne(
        { _id: session._id },
        {
          $set: {
            firstName: '',
            lastName: '',
            birthDate: '',
            biometricPurgedAt: new Date(),
          },
        },
        { strict: false }, // biometricPurgedAt hors schéma : forcer l'écriture
      );

      report.diditDataPurged += 1;
      logger.info('[RGPD] Identite KYC purgee (retention depassee)', { sessionId: session._id });
    } catch (err) {
      const msg = `Erreur purge biométrique session ${session._id}: ${err.message}`;
      report.errors.push(msg);
      logger.error(`[RGPD] ${msg}`);
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
    logger.info('[RGPD] Leads marketing supprimes', { count: report.leadsPurged });
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
        logger.info('[RGPD] Fichier supprime', { path: fullPath });
      }
    } catch (err) {
      logger.error('[RGPD] Erreur suppression fichier', { filePath, error: err?.message || err });
    }
  }
}

/**
 * Exécute la purge RGPD complète
 */
async function runRGPDPurge() {
  const report = createReport();

  try {
    logger.info('[RGPD] Demarrage purge automatique');

    await connectDB();

    await purgeRejectedCandidatures(report);
    await purgeNonSelectedIdentityDocs(report);
    await purgeNonSelectedApplications(report);
    await purgeDiditBiometricData(report);
    await purgeInactiveLeads(report);

    report.completedAt = new Date().toISOString();

    logger.info('[RGPD] Rapport de purge', { report });
    return report;
  } catch (error) {
    report.errors.push(`Erreur fatale: ${error.message}`);
    report.completedAt = new Date().toISOString();
    logger.error('[RGPD] Erreur fatale', { error: error?.message || error, report });
    return report;
  }
}

// Exécution si appelé directement
if (require.main === module) {
  runRGPDPurge().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runRGPDPurge };
