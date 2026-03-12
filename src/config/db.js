// Configuration de la connexion MongoDB
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || '';

if (!MONGO_URI) {
  console.error("❌ MONGO_URI manquant (dans .env)");
  process.exit(1);
}

/**
 * Connecte l'application à MongoDB
 * @returns {Promise<void>}
 */
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB Connecté");
  } catch (error) {
    console.error("❌ MongoDB error:", error?.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
