function encodeQueryValue(value) {
  return encodeURIComponent(String(value || ''));
}

function buildDiditCompletionUrl(baseUrl, applyToken, status, sessionId) {
  const normalizedBaseUrl = String(baseUrl || '').replace(/\/+$/, '') || '';
  const safeStatus = String(status || '');
  const safeSessionId = String(sessionId || '');
  const query = `didit_status=${encodeQueryValue(safeStatus)}&session_id=${encodeQueryValue(safeSessionId)}`;

  if (applyToken) {
    return `${normalizedBaseUrl}/apply/${encodeQueryValue(applyToken)}?${query}`;
  }

  return `${normalizedBaseUrl}/?${query}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDiditCompletionHtml({
  status,
  sessionId,
  redirectUrl,
  appOrigin,
}) {
  const approved = String(status || '').toLowerCase() === 'approved';
  const title = approved ? 'Verification terminee' : 'Verification en cours';
  const message = approved
    ? 'Votre identite a bien ete transmise. Retour au dossier en cours...'
    : 'La verification Didit est terminee. Retour au dossier en cours...';
  const safeRedirectUrl = escapeHtml(redirectUrl);
  const safeAppOrigin = escapeHtml(appOrigin);
  const payload = JSON.stringify({
    source: 'doc2loc-didit',
    type: 'didit_completed',
    status: String(status || ''),
    sessionId: String(sessionId || ''),
    redirectUrl: String(redirectUrl || ''),
  });

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background: linear-gradient(180deg, #f4efe4 0%, #ffffff 100%);
        color: #0f172a;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }
      .card {
        width: min(92vw, 560px);
        background: rgba(255,255,255,0.94);
        border: 1px solid rgba(15,23,42,0.08);
        border-radius: 24px;
        box-shadow: 0 24px 80px rgba(15,23,42,0.12);
        padding: 32px 28px;
        text-align: center;
      }
      .badge {
        display: inline-block;
        padding: 8px 14px;
        border-radius: 999px;
        background: #dcfce7;
        color: #166534;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 {
        margin: 18px 0 12px;
        font-size: 28px;
        line-height: 1.1;
      }
      p {
        margin: 0;
        color: #475569;
        line-height: 1.6;
      }
      a {
        display: inline-block;
        margin-top: 22px;
        padding: 12px 18px;
        border-radius: 999px;
        background: #0f172a;
        color: #ffffff;
        text-decoration: none;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">Didit</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a href="${safeRedirectUrl}">Retourner au dossier</a>
    </div>
    <script>
      (function () {
        var payload = ${payload};
        var redirectUrl = ${JSON.stringify(String(redirectUrl || ''))};
        var targetOrigin = ${JSON.stringify(String(appOrigin || ''))};

        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, targetOrigin || '*');
          }
        } catch (error) {}

        if (window.top === window.self && redirectUrl) {
          setTimeout(function () {
            window.location.replace(redirectUrl);
          }, 1200);
        }
      })();
    </script>
  </body>
</html>`;
}

module.exports = {
  buildDiditCompletionUrl,
  renderDiditCompletionHtml,
};
