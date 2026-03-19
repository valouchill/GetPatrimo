require('dotenv').config();

const { defineConfig } = require('@playwright/test');

const { resolveLocalMongoUri } = require('./scripts/resolve-local-mongo-uri');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3101';
const LOCAL_MONGO_URI = resolveLocalMongoUri(process.env.MONGO_URI);

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results/playwright',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npx next dev -H 127.0.0.1 -p 3101',
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: true,
    env: {
      ...process.env,
      PORT: '3101',
      NODE_ENV: 'development',
      NEXTAUTH_URL: BASE_URL,
      NEXT_PUBLIC_BASE_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      MONGO_URI: LOCAL_MONGO_URI || process.env.MONGO_URI,
      E2E_TEST_MODE: 'true',
      E2E_BASE_URL: BASE_URL,
      E2E_OWNER_EMAIL: process.env.E2E_OWNER_EMAIL || 'e2e.owner@doc2loc.local',
      E2E_TENANT_EMAIL: process.env.E2E_TENANT_EMAIL || 'e2e.tenant@doc2loc.local',
      E2E_GUARANTOR_EMAIL: process.env.E2E_GUARANTOR_EMAIL || 'e2e.guarantor@doc2loc.local',
    },
  },
});
