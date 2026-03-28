/**
 * Cron Job — Nettoyage des tokens expirés
 *
 * Supprime les tokens OTP, magic links et sessions temporaires expirées.
 * À exécuter toutes les heures via cron ou orchestrateur.
 */

const { connectDB } = require('../config/db');

async function cleanupExpiredTokens() {
  const now = new Date();
  const report = { otpCleaned: 0, magicLinksCleaned: 0, errors: [] };

  try {
    await connectDB();
    const User = require('../../models/User');

    // 1. Nettoyer les OTP expirés
    const otpResult = await User.updateMany(
      {
        otpCode: { $exists: true, $ne: '' },
        otpExpiresAt: { $lt: now },
      },
      { $unset: { otpCode: 1, otpExpiresAt: 1 } }
    );
    report.otpCleaned = otpResult.modifiedCount || 0;

    // 2. Nettoyer les magic sign-in tokens expirés
    const magicResult = await User.updateMany(
      {
        magicSignInToken: { $exists: true, $ne: '' },
        magicSignInExpiresAt: { $lt: now },
      },
      { $unset: { magicSignInToken: 1, magicSignInExpiresAt: 1 } }
    );
    report.magicLinksCleaned = magicResult.modifiedCount || 0;

    console.log('[cleanup] Tokens expirés nettoyés:', JSON.stringify(report));
  } catch (err) {
    report.errors.push(err?.message || String(err));
    console.error('[cleanup] Erreur:', err?.message || err);
  }

  return report;
}

// Exécution directe si lancé en standalone
if (require.main === module) {
  cleanupExpiredTokens()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { cleanupExpiredTokens };
