/**
 * Cron Job — Backup MongoDB
 *
 * Creates a mongodump archive in /opt/doc2loc/backups/
 * Retains last 7 daily backups.
 *
 * Requires: mongodump binary installed in the container/host.
 * Usage standalone: node src/cron/mongoBackup.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { logger } = require('../../lib/logger');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 7);

async function runMongoBackup() {
  const report = { success: false, file: '', size: 0, errors: [] };

  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI not configured');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `doc2loc-backup-${timestamp}.gz`;
    const filePath = path.join(BACKUP_DIR, fileName);

    // Check if mongodump is available
    try {
      execSync('which mongodump', { encoding: 'utf8' });
    } catch {
      logger.warn('[backup] mongodump not found — skipping backup. Install mongodb-database-tools.');
      report.errors.push('mongodump binary not found');
      return report;
    }

    // Run mongodump
    logger.info('[backup] Starting MongoDB backup', { output: filePath });
    execSync(
      `mongodump --uri="${mongoUri}" --archive="${filePath}" --gzip`,
      { encoding: 'utf8', timeout: 300_000 } // 5 min timeout
    );

    const stats = fs.statSync(filePath);
    report.success = true;
    report.file = fileName;
    report.size = stats.size;

    logger.info('[backup] Backup complete', {
      file: fileName,
      sizeMB: (stats.size / 1024 / 1024).toFixed(2),
    });

    // Cleanup old backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('doc2loc-backup-') && f.endsWith('.gz'))
      .sort()
      .reverse();

    const toDelete = files.slice(RETENTION_DAYS);
    for (const old of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
      logger.info('[backup] Deleted old backup', { file: old });
    }

    if (toDelete.length > 0) {
      logger.info('[backup] Cleanup complete', { deleted: toDelete.length, retained: RETENTION_DAYS });
    }
  } catch (err) {
    report.errors.push(err?.message || String(err));
    logger.error('[backup] Backup failed', { error: err?.message || err });
  }

  return report;
}

if (require.main === module) {
  require('dotenv').config();
  runMongoBackup()
    .then((r) => { console.log(JSON.stringify(r)); process.exit(r.success ? 0 : 1); })
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { runMongoBackup };
