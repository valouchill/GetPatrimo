const { test, expect } = require('@playwright/test');

const { readSeed } = require('./helpers/seed.cjs');
const { loginAs } = require('./helpers/auth.cjs');
const { attachDiagnostics, assertHealthyPage, saveAuditScreenshot } = require('./helpers/audit.cjs');

async function settleGuaranteeUi(page) {
  await page.locator('.fixed.inset-0.z-\\[60\\]').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  await page.locator('.fixed.inset-0.z-\\[100\\]').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});

  const consistencyModal = page.locator('.fixed.inset-0.z-\\[90\\]');
  if (await consistencyModal.isVisible().catch(() => false)) {
    const closeButton = consistencyModal.locator('button').first();
    if (await closeButton.count()) {
      await closeButton.click({ force: true });
    }
  }

  await consistencyModal.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
}

async function openGuaranteeChapter(page) {
  const startAuditButton = page.getByRole('button', { name: /Démarrer mon Audit Sécurisé/i });
  if (await startAuditButton.isVisible().catch(() => false)) {
    await startAuditButton.click({ force: true });
  }

  const onboardingCta = page.getByRole('button', { name: /Commencer ma certification/i });
  if (await onboardingCta.isVisible().catch(() => false)) {
    await onboardingCta.click({ force: true });
  }

  await settleGuaranteeUi(page);
  await expect(page.getByRole('heading', { name: /Garantie Souveraine/i })).toBeVisible({ timeout: 30_000 });
}

test('tenant guarantee chapter supports NONE, VISALE and PHYSICAL with working uploads', async ({ page, baseURL }, testInfo) => {
  const seed = readSeed();
  const diagnostics = attachDiagnostics(page, baseURL);

  await page.setViewportSize({ width: 1280, height: 960 });
  await loginAs(page, 'tenant', seed.routes.tenantDashboard);
  await page.goto(seed.routes.applyReview, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await openGuaranteeChapter(page);
  await expect(page.getByRole('button', { name: /Sans garant/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Visale/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /1 garant physique/i })).toBeVisible();
  await expect(page.getByText(/Documents du garant 1/i)).toBeVisible();

  await page.locator('#guarantor-file-input').setInputFiles({
    name: 'guarantor-domicile.png',
    mimeType: 'image/png',
    buffer: Buffer.from('E2E domicile mock'),
  });
  await settleGuaranteeUi(page);
  await expect(page.getByText(/guarantor-domicile\.png/i)).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: /Sans garant/i }).click({ force: true });
  await expect(page.getByText(/Vous pouvez continuer sans garant/i)).toBeVisible();

  await page.getByRole('button', { name: /Visale/i }).click({ force: true });
  await page.locator('#visale-file-input').setInputFiles({
    name: 'visale-ready.png',
    mimeType: 'image/png',
    buffer: Buffer.from('E2E visale mock'),
  });
  await settleGuaranteeUi(page);
  await expect(page.getByText(/Visale certifiée/i)).toBeVisible({ timeout: 20_000 });

  await saveAuditScreenshot(page, testInfo, 'tenant-guarantee-flow');
  await assertHealthyPage(page, diagnostics, baseURL, 'tenant-guarantee-flow');
});
