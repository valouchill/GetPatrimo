const LEASE_TYPES = ['vide', 'meuble', 'mobilite', 'garage_parking'];

function normalizeLeaseType(value) {
  if (!value) return null;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (LEASE_TYPES.includes(normalized)) return normalized;
  if (normalized === 'garage' || normalized === 'parking' || normalized === 'box') {
    return 'garage_parking';
  }
  if (normalized === 'meublee') return 'meuble';
  if (normalized === 'mobilite') return 'mobilite';
  if (normalized === 'nu') return 'vide';
  if (normalized.includes('garage') || normalized.includes('parking')) return 'garage_parking';
  if (normalized.includes('mobilit')) return 'mobilite';
  if (normalized.includes('meubl')) return 'meuble';
  if (normalized.includes('vide') || normalized.includes('nu')) return 'vide';
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

  return 'vide';
}

function computeSmartDeposit(leaseType, rentHC) {
  const normalized = normalizeLeaseType(leaseType) || 'vide';
  const rent = Number(rentHC) || 0;

  if (normalized === 'meuble') return rent * 2;
  if (normalized === 'mobilite') return 0;
  if (normalized === 'vide') return rent;
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
  return (normalizeLeaseType(leaseType) || 'vide') !== 'mobilite' && hasUsableGuarantor(guarantor);
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
