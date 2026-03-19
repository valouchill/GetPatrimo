#!/usr/bin/env node

require('dotenv').config();

const { spawnSync } = require('child_process');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run('node', ['scripts/seed-e2e.js']);

if (process.env.QA_SKIP_PHASE1 !== '1') {
  run('npm', ['run', 'smoke:phase1']);
}

run('npx', ['playwright', 'test']);
