#!/usr/bin/env node
/**
 * Migration: normalise opensignStatus dans les leases.
 *
 * Mappings:
 *   COMPLETED → SIGNED
 *   DECLINED  → CANCELLED
 *
 * Affecte: leases.opensignStatus et leases.opensignDocuments[].status
 *
 * Usage:
 *   MONGO_URI=mongodb://... node scripts/migrate-lease-opensign-status.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGO_URI is required'); process.exit(1); }

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const leases = mongoose.connection.db.collection('leases');

  // 1. Migrate opensignStatus top-level
  const r1 = await leases.updateMany(
    { opensignStatus: 'COMPLETED' },
    { $set: { opensignStatus: 'SIGNED' } }
  );
  console.log(`opensignStatus COMPLETED→SIGNED: ${r1.modifiedCount}`);

  const r2 = await leases.updateMany(
    { opensignStatus: 'DECLINED' },
    { $set: { opensignStatus: 'CANCELLED' } }
  );
  console.log(`opensignStatus DECLINED→CANCELLED: ${r2.modifiedCount}`);

  // 2. Migrate opensignDocuments[].status
  const cursor = leases.find({
    'opensignDocuments.status': { $in: ['COMPLETED', 'DECLINED'] }
  });

  let updated = 0;
  for await (const lease of cursor) {
    let changed = false;
    for (const doc of (lease.opensignDocuments || [])) {
      if (doc.status === 'COMPLETED') { doc.status = 'SIGNED'; changed = true; }
      if (doc.status === 'DECLINED') { doc.status = 'CANCELLED'; changed = true; }
    }
    if (changed) {
      await leases.updateOne({ _id: lease._id }, { $set: { opensignDocuments: lease.opensignDocuments } });
      updated++;
    }
  }
  console.log(`opensignDocuments sub-docs updated: ${updated}`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
