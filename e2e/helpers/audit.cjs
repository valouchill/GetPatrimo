const assert = require('node:assert/strict');

function attachDiagnostics(page, baseURL) {
  const diagnostics = {
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
  };

  const baseOrigin = new URL(baseURL).origin;

  page.on('console', (message) => {
    diagnostics.consoleMessages.push({
      type: message.type(),
      text: message.text(),
    });
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error?.message || String(error));
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    let sameOrigin = false;
    try {
      sameOrigin = new URL(url).origin === baseOrigin;
    } catch {
      sameOrigin = false;
    }

    diagnostics.requestFailures.push({
      url,
      method: request.method(),
      errorText: request.failure()?.errorText || 'unknown',
      sameOrigin,
    });
  });

  return diagnostics;
}

function sanitizeFileStem(value) {
  return String(value || 'capture').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-');
}

async function saveAuditScreenshot(page, testInfo, fileStem) {
  await page.screenshot({
    path: testInfo.outputPath(`${sanitizeFileStem(fileStem)}.png`),
    fullPage: true,
  });
}

async function collectLayoutAudit(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth || 0);
    const horizontalOverflow = Math.max(0, scrollWidth - viewportWidth);
    const offenders = [];

    const nodes = Array.from(document.querySelectorAll('body *'));
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (node.getAttribute('aria-hidden') === 'true') continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.right > viewportWidth + 2 || rect.left < -2) {
        offenders.push({
          tag: node.tagName.toLowerCase(),
          className: node.className?.toString().slice(0, 120) || '',
          text: (node.innerText || '').trim().slice(0, 120),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
      if (offenders.length >= 12) break;
    }

    return {
      horizontalOverflow,
      offenders,
      textLength: (document.body?.innerText || '').trim().length,
      headingCount: document.querySelectorAll('h1,h2,h3').length,
    };
  });
}

function isConsoleNoise(text) {
  return [
    'Download the React DevTools',
    'favicon.ico',
    'Source map',
    'CLIENT_FETCH_ERROR',
  ].some((fragment) => text.includes(fragment));
}

async function assertHealthyPage(page, diagnostics, baseURL, routeId) {
  const layout = await collectLayoutAudit(page);
  const pageErrors = diagnostics.pageErrors.filter(Boolean);
  const consoleProblems = diagnostics.consoleMessages.filter((entry) => {
    if (!['error', 'warning'].includes(entry.type)) return false;
    return !isConsoleNoise(entry.text);
  });
  const sameOriginFailures = diagnostics.requestFailures.filter((entry) => {
    if (!entry.sameOrigin) return false;
    return entry.errorText !== 'net::ERR_ABORTED';
  });

  assert.equal(pageErrors.length, 0, `[${routeId}] page errors detected:\n${pageErrors.join('\n')}`);
  assert.equal(
    sameOriginFailures.length,
    0,
    `[${routeId}] network failures detected:\n${sameOriginFailures.map((entry) => `${entry.method} ${entry.url} -> ${entry.errorText}`).join('\n')}`
  );
  assert.equal(
    consoleProblems.length,
    0,
    `[${routeId}] console problems detected:\n${consoleProblems.map((entry) => `[${entry.type}] ${entry.text}`).join('\n')}`
  );
  assert.ok(layout.textLength > 60, `[${routeId}] rendered content is unexpectedly thin.`);
  assert.ok(layout.headingCount > 0, `[${routeId}] no headings detected on the rendered surface.`);
  assert.ok(
    layout.horizontalOverflow <= 2,
    `[${routeId}] horizontal overflow detected (${layout.horizontalOverflow}px).\n${JSON.stringify(layout.offenders, null, 2)}`
  );
  return layout;
}

module.exports = {
  attachDiagnostics,
  assertHealthyPage,
  collectLayoutAudit,
  saveAuditScreenshot,
};
