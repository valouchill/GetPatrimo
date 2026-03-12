/**
 * Cron Job pour la purge automatique RGPD
 * Exécute la purge tous les jours à 2h du matin
 * Purge les dossiers > 30 jours avec Bail signé = true
 */

const { autoPurgeRGPD } = require('../services/trustEngineService');
const { connectDB } = require('../config/db');

/**
 * Exécute la purge RGPD automatique
 */
async function runRGPDPurge() {
  try {
    console.log('🔄 Démarrage purge RGPD automatique...');
    
    await connectDB();
    const result = await autoPurgeRGPD();
    
    if (result.success) {
      console.log(`✅ Purge RGPD terminée : ${result.purgedCount} dossier(s) purgé(s)`);
    } else {
      console.error('❌ Erreur purge RGPD:', result.error);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur fatale purge RGPD:', error);
    process.exit(1);
  }
}

// Exécution si appelé directement
if (require.main === module) {
  runRGPDPurge();
}

module.exports = { runRGPDPurge };
