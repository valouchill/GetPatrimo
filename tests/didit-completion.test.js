const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDiditCompletionUrl,
  renderDiditCompletionHtml,
} = require('../src/utils/diditCompletion');

test('buildDiditCompletionUrl targets the tokenized apply route', () => {
  const url = buildDiditCompletionUrl(
    'https://getpatrimo.com',
    'abc123',
    'approved',
    'sess_42'
  );

  assert.equal(
    url,
    'https://getpatrimo.com/apply/abc123?didit_status=approved&session_id=sess_42'
  );
});

test('buildDiditCompletionUrl falls back to the homepage when token is absent', () => {
  const url = buildDiditCompletionUrl(
    'https://getpatrimo.com/',
    '',
    'approved',
    'sess_42'
  );

  assert.equal(
    url,
    'https://getpatrimo.com/?didit_status=approved&session_id=sess_42'
  );
});

test('renderDiditCompletionHtml emits a friendly completion page with parent messaging', () => {
  const html = renderDiditCompletionHtml({
    status: 'approved',
    sessionId: 'sess_42',
    redirectUrl: 'https://getpatrimo.com/apply/abc123?didit_status=approved&session_id=sess_42',
    appOrigin: 'https://getpatrimo.com',
  });

  assert.match(html, /Verification terminee/i);
  assert.match(html, /window\.parent\.postMessage/);
  assert.match(html, /doc2loc-didit/);
  assert.match(html, /Retourner au dossier/);
  assert.match(html, /apply\/abc123/);
});
