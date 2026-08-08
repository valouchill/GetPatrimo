// Configuration de la connexion MongoDB
const mongoose = require('mongoose');

/**
 * Connecte l'application à MongoDB.
 *
 * Ne fait JAMAIS `process.exit()` : cette fonction est appelée par les crons,
 * qui tournent DANS le process du serveur web. Un incident MongoDB passager
 * pendant une tâche nocturne tuait donc le site entier. On lève désormais
 * l'erreur : le wrapper `safeCron` la journalise (et la remonte dans Sentry),
 * le cron échoue seul, le serveur continue de servir.
 *
 * Idempotent : si une connexion est déjà établie (readyState 1), on ne
 * reconnecte pas — les crons partagent le pool du serveur.
 *
 * @returns {Promise<void>}
 * @throws {Error} si MONGO_URI est absent ou si la connexion échoue
 */
async function connectDB() {
  if (mongoose.connection?.readyState === 1) return;

  const MONGO_URI = process.env.MONGO_URI || '';
  if (!MONGO_URI) {
    throw new Error('MONGO_URI manquant (dans .env)');
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB Connecté');
  } catch (error) {
    // On enrichit sans masquer : l'appelant décide quoi faire de l'échec.
    throw new Error(`Connexion MongoDB impossible : ${error?.message || error}`);
  }
}

module.exports = { connectDB };
