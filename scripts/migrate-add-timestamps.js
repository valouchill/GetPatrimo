#!/usr/bin/env node
/**
 * Migration: ajoute createdAt/updatedAt aux documents existants qui n'en ont pas.
 *
 * Pour les documents ayant un _id ObjectId, on utilise le timestamp intégré
 * dans l'ObjectId comme valeur de createdAt.
 *
 * Usage:
 *   MONGO_URI=mongodb://... node scripts/migrate-add-timestamps.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGO_URI is required'); process.exit(1); }

const COLLECTIONS = [
  'users',
  'properties',
  'tenants',
  'leases',
  'applications',
  'candidatures',
  'documents',
  'events',
  'guarantors',
  'identitysessions',
  'leads',
];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const now = new Date();

  for (const name of COLLECTIONS) {
    const col = db.collection(name);
    const exists = await col.countDocuments();
    if (!exists) {
      console.log(`${name}: empty, skip`);
      continue;
    }

    // Find docs missing createdAt
    const missingCreated = await col.countDocuments({ createdAt: { $exists: false } });
    if (missingCreated > 0) {
      const cursor = col.find({ createdAt: { $exists: false } });
      let updated = 0;
      for await (const doc of cursor) {
        // Use ObjectId timestamp as createdAt when available
        const createdAt = doc._id.getTimestamp ? doc._id.getTimestamp() : now;
        await col.updateOne({ _id: doc._id }, {
          $set: { createdAt, updatedAt: createdAt }
        });
        updated++;
      }
      console.log(`${name}: added createdAt/updatedAt to ${updated} docs`);
    }

    // Find docs missing updatedAt but having createdAt
    const missingUpdated = await col.countDocuments({
      createdAt: { $exists: true },
      updatedAt: { $exists: false },
    });
    if (missingUpdated > 0) {
      const res = await col.updateMany(
        { createdAt: { $exists: true }, updatedAt: { $exists: false } },
        [{ $set: { updatedAt: '$createdAt' } }]
      );
      console.log(`${name}: added updatedAt to ${res.modifiedCount} docs`);
    }

    if (missingCreated === 0 && missingUpdated === 0) {
      console.log(`${name}: all docs already have timestamps`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => { console.error(err); process.exit(1); });
