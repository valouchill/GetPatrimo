const { readSeed } = require('./seed');

async function loginAs(page, persona, callbackPath) {
  const seed = readSeed();
  const personaRecord = seed.personas[persona];
  if (!personaRecord?.email) {
    throw new Error(`Unknown E2E persona: ${persona}`);
  }

  const target = `/auth/e2e?persona=${encodeURIComponent(persona)}&email=${encodeURIComponent(personaRecord.email)}&callbackUrl=${encodeURIComponent(callbackPath)}`;
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/e2e'), { timeout: 30_000 });
}

module.exports = {
  loginAs,
};
