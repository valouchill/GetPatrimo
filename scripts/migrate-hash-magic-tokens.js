#!/usr/bin/env node
/**
 * Migration: hash existing plaintext magicSignInToken values with bcrypt.
 *
 * Usage:
 *   MONGO_URI=mongodb://... node scripts/migrate-hash-magic-tokens.js
 *
 * Safe to run multiple times — already-hashed tokens (starting with "$2") are skipped.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is required');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const users = mongoose.connection.db.collection('users');
  const cursor = users.find({
    magicSignInToken: { $exists: true, $ne: '' },
  });

  let updated = 0;
  let skipped = 0;

  for await (const user of cursor) {
    const token = user.magicSignInToken;
    // Skip already-hashed tokens (bcrypt hashes start with $2)
    if (token.startsWith('$2')) {
      skipped++;
      continue;
    }

    const hashed = await bcrypt.hash(token, 10);
    await users.updateOne({ _id: user._id }, { $set: { magicSignInToken: hashed } });
    updated++;
  }

  console.log(`Done. Updated: ${updated}, Skipped (already hashed): ${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
