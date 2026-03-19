const { test } = require('@playwright/test');

const { DEVICES, ROUTE_AUDIT_MATRIX } = require('./route-matrix.cjs');
const { readSeed } = require('./helpers/seed.cjs');
const { loginAs } = require('./helpers/auth.cjs');
const { attachDiagnostics, assertHealthyPage, saveAuditScreenshot } = require('./helpers/audit.cjs');

for (const entry of ROUTE_AUDIT_MATRIX) {
  for (const deviceKey of entry.devices) {
    const device = DEVICES[deviceKey];

    test(`${entry.id} renders cleanly on ${device.label}`, async ({ page, baseURL }, testInfo) => {
      const seed = readSeed();
      const diagnostics = attachDiagnostics(page, baseURL);

      await page.setViewportSize(device.viewport);

      const route = entry.route(seed);
      if (entry.persona === 'tenant' || entry.persona === 'owner') {
        const dashboardPath = entry.persona === 'owner' ? seed.routes.ownerDashboard : seed.routes.tenantDashboard;
        await loginAs(page, entry.persona, dashboardPath);
        if (route !== dashboardPath) {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
        }
      } else {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
      }

      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await saveAuditScreenshot(page, testInfo, `${entry.id}-${device.label}`);
      await assertHealthyPage(page, diagnostics, baseURL, `${entry.id}:${device.label}`);
    });
  }
}
