#!/usr/bin/env node
/**
 * Migration: normalise TOUS les enums en UPPER_SNAKE_CASE dans MongoDB.
 *
 * Collections affectées:
 *   - documents.type         (bail → BAIL, dpe → DPE, etc.)
 *   - properties.diagnostics[].type  (dpe → DPE, etc.)
 *
 * Usage:
 *   MONGO_URI=mongodb://... node scripts/migrate-enum-to-uppercase.js
 *
 * Safe to run multiple times — already-uppercase values are skipped.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGO_URI is required'); process.exit(1); }

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  // 1. Normalize documents.type to UPPER_SNAKE_CASE
  console.log('\n--- documents.type ---');
  const docs = db.collection('documents');
  const docCursor = docs.find({ type: { $regex: /[a-z]/ } });
  let docUpdated = 0;
  for await (const doc of docCursor) {
    if (doc.type && doc.type !== doc.type.toUpperCase()) {
      await docs.updateOne({ _id: doc._id }, { $set: { type: doc.type.toUpperCase() } });
      docUpdated++;
    }
  }
  console.log(`documents.type updated: ${docUpdated}`);

  // 2. Normalize properties.diagnostics[].type
  console.log('\n--- properties.diagnostics[].type ---');
  const props = db.collection('properties');
  const propCursor = props.find({ 'diagnostics.type': { $regex: /[a-z]/ } });
  let propUpdated = 0;
  for await (const prop of propCursor) {
    let changed = false;
    for (const diag of (prop.diagnostics || [])) {
      if (diag.type && diag.type !== diag.type.toUpperCase()) {
        diag.type = diag.type.toUpperCase();
        changed = true;
      }
    }
    if (changed) {
      await props.updateOne({ _id: prop._id }, { $set: { diagnostics: prop.diagnostics } });
      propUpdated++;
    }
  }
  console.log(`properties with diagnostics updated: ${propUpdated}`);

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => { console.error(err); process.exit(1); });
