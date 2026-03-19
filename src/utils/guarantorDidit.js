function normalizeValue(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeValue(value).toLowerCase();
}

function normalizeSlot(value) {
  if (value === 2 || value === '2') return 2;
  if (value === 1 || value === '1') return 1;
  return null;
}

function isVerifiedDiditStatus(status) {
  const normalizedStatus = normalizeValue(status).toLowerCase();
  return ['approved', 'completed', 'verified', 'success'].includes(normalizedStatus);
}

function extractIdentityFromDiditPayload(payload) {
  const data = payload || {};
  const decision = data.decision || {};
  const decisionIdentity = Array.isArray(decision.id_verifications) ? decision.id_verifications[0] || {} : {};
  const idDocument = data.id_document || data.document || {};
  const identity =
    data.kyc ||
    data.identity ||
    data.person ||
    data.data?.identity ||
    data.data?.person ||
    data.data?.kyc ||
    idDocument ||
    {};

  const fullName =
    decisionIdentity.full_name ||
    identity.full_name ||
    idDocument.full_name ||
    data.full_name ||
    '';
  const nameParts = normalizeValue(fullName).split(/\s+/).filter(Boolean);

  return {
    firstName:
      normalizeValue(decisionIdentity.first_name) ||
      normalizeValue(idDocument.first_name) ||
      normalizeValue(identity.first_name) ||
      normalizeValue(identity.firstName) ||
      nameParts[0] ||
      '',
    lastName:
      normalizeValue(decisionIdentity.last_name) ||
      normalizeValue(idDocument.last_name) ||
      normalizeValue(identity.last_name) ||
      normalizeValue(identity.lastName) ||
      nameParts.slice(1).join(' ') ||
      '',
    birthDate:
      normalizeValue(decisionIdentity.date_of_birth) ||
      normalizeValue(idDocument.date_of_birth) ||
      normalizeValue(identity.date_of_birth) ||
      normalizeValue(identity.birthDate) ||
      normalizeValue(data.date_of_birth) ||
      '',
  };
}

function normalizeDiditSessionPayload(payload) {
  const data = payload || {};
  const status = data.status || data.decision || data?.event?.status || data?.data?.status || '';
  const identity = extractIdentityFromDiditPayload(data);
  const humanVerified =
    Boolean(data.human_verified) ||
    Boolean(data.humanVerified) ||
    Boolean(data?.decision?.human_verified) ||
    Boolean(data?.decision?.humanVerified);

  return {
    verified: isVerifiedDiditStatus(status) || data.verified === true,
    status: normalizeValue(status),
    ...identity,
    humanVerified,
  };
}

async function fetchDiditSessionVerification(sessionId, apiKey) {
  const normalizedSessionId = normalizeValue(sessionId);
  if (!normalizedSessionId || !apiKey) {
    return null;
  }

  const endpoints = [
    `https://verification.didit.me/v3/session/${normalizedSessionId}/decision/`,
    `https://verification.didit.me/v3/session/${normalizedSessionId}/`,
    `https://apx.didit.me/verification/v2/session/${normalizedSessionId}`,
    `https://apx.didit.me/v2/session/${normalizedSessionId}`,
    `https://verification.didit.me/v2/session/${normalizedSessionId}`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': apiKey,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      return {
        ...normalizeDiditSessionPayload(payload),
        endpoint: url,
        raw: payload,
      };
    } catch (error) {
      console.warn('[GUARANTOR DIDIT] Endpoint inaccessible:', url, error);
    }
  }

  return null;
}

function buildGuarantorLookupFilters({ invitationToken, sessionId, applyToken, email, slot }) {
  const normalizedInvitationToken = normalizeValue(invitationToken);
  const normalizedSessionId = normalizeValue(sessionId);
  const normalizedApplyToken = normalizeValue(applyToken);
  const normalizedEmail = normalizeEmail(email);
  const normalizedSlot = normalizeSlot(slot);

  if (normalizedInvitationToken) {
    return [{ invitationToken: normalizedInvitationToken }];
  }

  const filters = [];

  if (normalizedSessionId) {
    filters.push({ diditSessionId: normalizedSessionId });
  }

  if (normalizedApplyToken) {
    if (normalizedEmail && normalizedSlot) {
      filters.push({ applyToken: normalizedApplyToken, email: normalizedEmail, slot: normalizedSlot });
    }
    if (normalizedEmail) {
      filters.push({ applyToken: normalizedApplyToken, email: normalizedEmail });
    }
    if (normalizedSlot) {
      filters.push({ applyToken: normalizedApplyToken, slot: normalizedSlot });
    }
    filters.push({ applyToken: normalizedApplyToken });
  }

  const seen = new Set();
  return filters.filter((filter) => {
    const key = JSON.stringify(filter);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveGuarantorWebhookUrl({ configuredGuarantorWebhookUrl, origin }) {
  const explicit = normalizeValue(configuredGuarantorWebhookUrl);
  if (explicit) {
    return explicit;
  }

  const normalizedOrigin = normalizeValue(origin).replace(/\/+$/, '');
  return `${normalizedOrigin}/api/webhooks/didit/guarantor`;
}

module.exports = {
  buildGuarantorLookupFilters,
  fetchDiditSessionVerification,
  isVerifiedDiditStatus,
  normalizeDiditSessionPayload,
  normalizeSlot,
  resolveGuarantorWebhookUrl,
};
