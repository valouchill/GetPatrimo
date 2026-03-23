const LEASE_TYPES = ['VIDE', 'MEUBLE', 'MOBILITE', 'GARAGE_PARKING'];

function normalizeLeaseType(value) {
  if (!value) return null;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Accept already-uppercase values
  const upper = String(value).trim().toUpperCase();
  if (LEASE_TYPES.includes(upper)) return upper;

  if (normalized === 'vide' || normalized === 'nu') return 'VIDE';
  if (normalized === 'garage' || normalized === 'parking' || normalized === 'box') {
    return 'GARAGE_PARKING';
  }
  if (normalized === 'meublee' || normalized === 'meuble') return 'MEUBLE';
  if (normalized === 'mobilite') return 'MOBILITE';
  if (normalized === 'garage_parking') return 'GARAGE_PARKING';
  if (normalized.includes('garage') || normalized.includes('parking')) return 'GARAGE_PARKING';
  if (normalized.includes('mobilit')) return 'MOBILITE';
  if (normalized.includes('meubl')) return 'MEUBLE';
  if (normalized.includes('vide') || normalized.includes('nu')) return 'VIDE';
  return null;
}

function deriveLeaseType(property, explicitLeaseType) {
  const candidates = [
    explicitLeaseType,
    property?.type,
    property?.propertyType,
    property?.leaseType,
    property?.furnished,
    property?.furnishedType,
    property?.name,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeLeaseType(candidate);
    if (normalized) return normalized;
  }

  return 'VIDE';
}

function computeSmartDeposit(leaseType, rentHC) {
  const normalized = normalizeLeaseType(leaseType) || 'VIDE';
  const rent = Number(rentHC) || 0;

  if (normalized === 'MEUBLE') return rent * 2;
  if (normalized === 'MOBILITE') return 0;
  if (normalized === 'VIDE') return rent;
  return rent;
}

function getTomorrowDateInputValue(baseDate = new Date()) {
  const tomorrow = new Date(baseDate);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function hasUsableGuarantor(guarantor) {
  if (!guarantor || typeof guarantor !== 'object') return false;
  if (guarantor.visaleNumber) return true;
  return Boolean(guarantor.firstName || guarantor.lastName || guarantor.email);
}

function shouldGenerateGuaranteeDocument(leaseType, guarantor) {
  return (normalizeLeaseType(leaseType) || 'VIDE') !== 'MOBILITE' && hasUsableGuarantor(guarantor);
}

module.exports = {
  LEASE_TYPES,
  normalizeLeaseType,
  deriveLeaseType,
  computeSmartDeposit,
  getTomorrowDateInputValue,
  hasUsableGuarantor,
  shouldGenerateGuaranteeDocument,
};
