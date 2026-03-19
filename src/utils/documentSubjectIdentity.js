function normalizeNamePart(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeName(value) {
  return normalizeNamePart(value)
    .split(/[\s-]+/)
    .map(part => part.trim())
    .filter(part => part.length >= 2);
}

function valuesOverlap(left, right) {
  if (!left || !right) {
    return false;
  }

  return (
    left === right ||
    left.includes(right) ||
    right.includes(left)
  );
}

function firstNamesMatch(actualFirstName, expectedFirstName) {
  if (!actualFirstName || !expectedFirstName) {
    return true;
  }

  if (valuesOverlap(actualFirstName, expectedFirstName)) {
    return true;
  }

  const actualTokens = tokenizeName(actualFirstName);
  const expectedTokens = tokenizeName(expectedFirstName);

  if (actualTokens.length === 0 || expectedTokens.length === 0) {
    return false;
  }

  return actualTokens.some(actualToken =>
    expectedTokens.some(expectedToken => valuesOverlap(actualToken, expectedToken))
  );
}

function splitOwnerName(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return { firstName: '', lastName: '', fullName: '' };
  }

  const parts = raw.split(' ').filter(Boolean);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0], fullName: raw };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    fullName: raw,
  };
}

function hasUsableIdentity(identity) {
  return Boolean(identity && (String(identity.firstName || '').trim() || String(identity.lastName || '').trim()));
}

function extractIdentityCandidate(source = {}) {
  const extractedData = source.extractedData || source;
  const metadata = source.document_metadata || source.documentMetadata || {};
  const ownerName = metadata.owner_name || source.ownerName || source.owner_name || '';

  const firstName = String(extractedData.prenom || extractedData.firstName || '').trim();
  const lastName = String(extractedData.nom || extractedData.lastName || '').trim();

  if (firstName || lastName) {
    return {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
    };
  }

  return splitOwnerName(ownerName);
}

function buildExpectedIdentityTarget({
  subjectType,
  subjectSlot,
  tenant,
  guarantorOne,
  guarantorTwo,
}) {
  if (subjectType === 'guarantor') {
    const guarantor = subjectSlot === 2 ? guarantorTwo || {} : guarantorOne || {};
    return {
      firstName: String(guarantor.firstName || '').trim(),
      lastName: String(guarantor.lastName || '').trim(),
      label: subjectSlot === 2 ? 'garant 2' : 'garant 1',
    };
  }

  return {
    firstName: String(tenant?.firstName || '').trim(),
    lastName: String(tenant?.lastName || '').trim(),
    label: 'locataire',
  };
}

function compareIdentityToExpected(actual, expected) {
  if (!hasUsableIdentity(actual) || !hasUsableIdentity(expected)) {
    return {
      comparable: false,
      matches: true,
      confidence: 0,
      message: "Identité insuffisante pour comparer les noms.",
    };
  }

  const actualLastName = normalizeNamePart(actual.lastName);
  const actualFirstName = normalizeNamePart(actual.firstName);
  const expectedLastName = normalizeNamePart(expected.lastName);
  const expectedFirstName = normalizeNamePart(expected.firstName);

  const lastNameMatches =
    !expectedLastName ||
    !actualLastName ||
    valuesOverlap(actualLastName, expectedLastName);

  const firstNameMatches =
    !expectedFirstName ||
    !actualFirstName ||
    firstNamesMatch(actualFirstName, expectedFirstName);

  const matches = lastNameMatches && firstNameMatches;
  const confidence = matches ? 100 : lastNameMatches || firstNameMatches ? 50 : 0;

  let message = 'Les noms correspondent.';
  if (matches && actualFirstName && expectedFirstName && actualFirstName !== expectedFirstName && lastNameMatches) {
    message = 'Le nom correspond et au moins un prénom officiel correspond.';
  }
  if (!matches && lastNameMatches && !firstNameMatches) {
    message = 'Le nom correspond, mais le prénom diffère.';
  } else if (!matches && !lastNameMatches && firstNameMatches) {
    message = 'Le prénom correspond, mais le nom diffère.';
  } else if (!matches) {
    message = 'Les noms ne correspondent pas.';
  }

  return {
    comparable: true,
    matches,
    confidence,
    message,
  };
}

module.exports = {
  buildExpectedIdentityTarget,
  compareIdentityToExpected,
  extractIdentityCandidate,
  hasUsableIdentity,
  normalizeNamePart,
  tokenizeName,
};
