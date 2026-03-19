const fs = require('fs');
const path = require('path');

const SEED_FILE = path.join(__dirname, '..', '..', '.e2e', 'seed-output.json');

function readSeed() {
  if (!fs.existsSync(SEED_FILE)) {
    throw new Error(`Seed file not found: ${SEED_FILE}. Run npm run e2e:seed first.`);
  }

  return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
}

module.exports = {
  SEED_FILE,
  readSeed,
};
