/**
 * Migration : normaliser tous les enums lowercase → UPPER_SNAKE_CASE
 *
 * Collections concernées :
 *   leases   : leaseType, opensignStatus, opensignDocuments[].kind/status, generatedDocuments[].kind
 *   applications : documents[].status, documents[].category, documents[].subjectType
 *
 * Idempotent : ne touche que les documents dont au moins un champ est encore en lowercase.
 *
 * Usage : node scripts/migrate-enum-uppercase.js
 * Options :
 *   --dry-run   Affiche les stats sans écrire en base
 *   --mongo-uri <uri>  Surcharge MONGODB_URI
 */

'use strict';

const mongoose = require('mongoose');
require('dotenv').config();

const DRY_RUN = process.argv.includes('--dry-run');
const MONGO_URI_ARG = (() => {
  const idx = process.argv.indexOf('--mongo-uri');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();
const MONGO_URI = MONGO_URI_ARG || process.env.MONGODB_URI || 'mongodb://localhost:27017/doc2loc';

// ---------------------------------------------------------------------------
// Mappings exhaustifs
// ---------------------------------------------------------------------------

const LEASE_TYPE_MAP = {
  vide: 'VIDE',
  meuble: 'MEUBLE',
  mobilite: 'MOBILITE',
  garage_parking: 'GARAGE_PARKING',
};

const OPENSIGN_STATUS_MAP = {
  draft: 'DRAFT',
  pending: 'PENDING',
  signed: 'SIGNED',
  completed: 'SIGNED',
  expired: 'EXPIRED',
  declined: 'CANCELLED',
};

const DOC_KIND_MAP = {
  lease: 'LEASE',
  guarantee: 'GUARANTEE',
};

const APP_DOC_STATUS_MAP = {
  pending: 'PENDING',
  analyzing: 'ANALYZING',
  certified: 'CERTIFIED',
  flagged: 'FLAGGED',
  rejected: 'REJECTED',
  illegible: 'ILLEGIBLE',
  needs_review: 'NEEDS_REVIEW',
};

const APP_CATEGORY_MAP = {
  identity: 'IDENTITY',
  income: 'INCOME',
  address: 'ADDRESS',
  guarantor: 'GUARANTOR',
};

const APP_SUBJECT_TYPE_MAP = {
  tenant: 'TENANT',
  guarantor: 'GUARANTOR',
  visale: 'VISALE',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retourne la valeur uppercase si le mapping existe, sinon la valeur originale. */
function up(map, value) {
  if (value == null) return value;
  return map[value] ?? value;
}

/** true si la valeur est une clé lowercase du mapping (= pas encore migrée) */
function needsMigration(map, value) {
  return value != null && Object.prototype.hasOwnProperty.call(map, value);
}

// ---------------------------------------------------------------------------
// Leases
// ---------------------------------------------------------------------------

async function migrateLeases(db) {
  const collection = db.collection('leases');

  // Filtre : au moins un champ encore en lowercase
  const filter = {
    $or: [
      { leaseType: { $in: Object.keys(LEASE_TYPE_MAP) } },
      { opensignStatus: { $in: Object.keys(OPENSIGN_STATUS_MAP) } },
      { 'opensignDocuments.kind': { $in: Object.keys(DOC_KIND_MAP) } },
      { 'opensignDocuments.status': { $in: Object.keys(OPENSIGN_STATUS_MAP) } },
      { 'generatedDocuments.kind': { $in: Object.keys(DOC_KIND_MAP) } },
    ],
  };

  const total = await collection.countDocuments(filter);
  console.log(`\n[leases] ${total} document(s) à migrer`);

  if (DRY_RUN || total === 0) return { total, updated: 0 };

  let updated = 0;
  const cursor = collection.find(filter);

  for await (const lease of cursor) {
    const updateDoc = { $set: {} };

    // leaseType
    if (needsMigration(LEASE_TYPE_MAP, lease.leaseType)) {
      updateDoc.$set.leaseType = up(LEASE_TYPE_MAP, lease.leaseType);
    }

    // opensignStatus
    if (needsMigration(OPENSIGN_STATUS_MAP, lease.opensignStatus)) {
      updateDoc.$set.opensignStatus = up(OPENSIGN_STATUS_MAP, lease.opensignStatus);
    }

    // opensignDocuments[].kind + status
    if (Array.isArray(lease.opensignDocuments)) {
      lease.opensignDocuments.forEach((doc, i) => {
        if (needsMigration(DOC_KIND_MAP, doc.kind)) {
          updateDoc.$set[`opensignDocuments.${i}.kind`] = up(DOC_KIND_MAP, doc.kind);
        }
        if (needsMigration(OPENSIGN_STATUS_MAP, doc.status)) {
          updateDoc.$set[`opensignDocuments.${i}.status`] = up(OPENSIGN_STATUS_MAP, doc.status);
        }
      });
    }

    // generatedDocuments[].kind
    if (Array.isArray(lease.generatedDocuments)) {
      lease.generatedDocuments.forEach((doc, i) => {
        if (needsMigration(DOC_KIND_MAP, doc.kind)) {
          updateDoc.$set[`generatedDocuments.${i}.kind`] = up(DOC_KIND_MAP, doc.kind);
        }
      });
    }

    if (Object.keys(updateDoc.$set).length === 0) continue;

    await collection.updateOne({ _id: lease._id }, updateDoc);
    updated++;
  }

  console.log(`[leases] ${updated} document(s) mis à jour`);
  return { total, updated };
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

async function migrateApplications(db) {
  const collection = db.collection('applications');

  const filter = {
    $or: [
      { 'documents.status': { $in: Object.keys(APP_DOC_STATUS_MAP) } },
      { 'documents.category': { $in: Object.keys(APP_CATEGORY_MAP) } },
      { 'documents.subjectType': { $in: Object.keys(APP_SUBJECT_TYPE_MAP) } },
    ],
  };

  const total = await collection.countDocuments(filter);
  console.log(`\n[applications] ${total} document(s) à migrer`);

  if (DRY_RUN || total === 0) return { total, updated: 0 };

  let updated = 0;
  const cursor = collection.find(filter);

  for await (const app of cursor) {
    const updateDoc = { $set: {} };

    if (Array.isArray(app.documents)) {
      app.documents.forEach((doc, i) => {
        if (needsMigration(APP_DOC_STATUS_MAP, doc.status)) {
          updateDoc.$set[`documents.${i}.status`] = up(APP_DOC_STATUS_MAP, doc.status);
        }
        if (needsMigration(APP_CATEGORY_MAP, doc.category)) {
          updateDoc.$set[`documents.${i}.category`] = up(APP_CATEGORY_MAP, doc.category);
        }
        if (needsMigration(APP_SUBJECT_TYPE_MAP, doc.subjectType)) {
          updateDoc.$set[`documents.${i}.subjectType`] = up(APP_SUBJECT_TYPE_MAP, doc.subjectType);
        }
      });
    }

    if (Object.keys(updateDoc.$set).length === 0) continue;

    await collection.updateOne({ _id: app._id }, updateDoc);
    updated++;
  }

  console.log(`[applications] ${updated} document(s) mis à jour`);
  return { total, updated };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (DRY_RUN) console.log('MODE DRY-RUN — aucune écriture en base\n');

  await mongoose.connect(MONGO_URI);
  console.log(`Connecté à MongoDB : ${MONGO_URI}`);

  const db = mongoose.connection.db;

  const leasesResult = await migrateLeases(db);
  const applicationsResult = await migrateApplications(db);

  console.log('\n=== Résumé ===');
  console.log(`leases       : ${leasesResult.updated}/${leasesResult.total} mis à jour`);
  console.log(`applications : ${applicationsResult.updated}/${applicationsResult.total} mis à jour`);
  if (DRY_RUN) console.log('\nDRY-RUN : relancer sans --dry-run pour appliquer.');

  await mongoose.disconnect();
  console.log('\nDéconnecté. Migration terminée.');
}

main().catch((err) => {
  console.error('Erreur migration :', err);
  process.exit(1);
});
