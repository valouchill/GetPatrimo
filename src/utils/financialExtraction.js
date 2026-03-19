function normalizeDocumentType(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeIncomeAmount(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  let cleaned = String(value)
    .trim()
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.');

  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value) {
  const numeric = normalizeIncomeAmount(value);
  return Number(numeric.toFixed(2));
}

function isReasonableMonthlyIncome(value) {
  const amount = normalizeIncomeAmount(value);
  return amount > 0 && amount < 50000;
}

function parseDateValue(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortByRecentDate(entries = []) {
  return [...entries].sort((left, right) => parseDateValue(right.date) - parseDateValue(left.date));
}

function average(values = []) {
  if (!values.length) return 0;
  return roundCurrency(values.reduce((sum, value) => sum + normalizeIncomeAmount(value), 0) / values.length);
}

function pickClosest(values = [], target = 0) {
  if (!values.length) return 0;
  return values.reduce((best, current) => {
    if (!best) return current;
    const bestGap = Math.abs(best - target);
    const currentGap = Math.abs(current - target);
    return currentGap < bestGap ? current : best;
  }, 0);
}

function pickBestDocumentNetIncome({ documentType, financialData, extractedData } = {}) {
  const normalizedType = normalizeDocumentType(documentType);
  const extraDetails = financialData?.extra_details || {};
  const directMonthlyNet = roundCurrency(financialData?.monthly_net_income);
  const directLegacyNet = roundCurrency(extractedData?.salaireNet || extractedData?.netSalary);
  const gross = roundCurrency(extraDetails.salaire_brut_mensuel || extractedData?.salaireBrut || extractedData?.grossSalary);
  const deductions = roundCurrency(extraDetails.cotisations_mensuelles || extractedData?.cotisations || extractedData?.totalDeductions);
  const computedNet = gross > 0 ? roundCurrency(gross - Math.max(0, deductions)) : 0;
  const monthlyTaxEquivalent = roundCurrency(extraDetails.revenu_fiscal_reference) > 0
    ? roundCurrency(roundCurrency(extraDetails.revenu_fiscal_reference) / 12)
    : 0;
  const typedAmount = roundCurrency(
    extraDetails.montant_bourse ||
      extraDetails.montant_apl ||
      extraDetails.montant_pension
  );
  const rawAmounts = Array.isArray(extractedData?.montants)
    ? extractedData.montants.map((value) => roundCurrency(value)).filter(isReasonableMonthlyIncome)
    : [];

  if (normalizedType === 'BULLETIN_SALAIRE') {
    const plausibleRawAmounts = rawAmounts.filter((value) => {
      if (gross > 0 && value > gross + 1) return false;
      if (computedNet > 0 && Math.abs(value - computedNet) > Math.max(2, gross * 0.12)) return false;
      return value > 0;
    });

    if (directMonthlyNet > 0 && gross > 0 && directMonthlyNet <= gross + 1) {
      if (!computedNet || Math.abs(directMonthlyNet - computedNet) <= Math.max(1.5, gross * 0.06)) {
        return { amount: directMonthlyNet, source: 'financial_data.monthly_net_income', confidence: 'high' };
      }
    }

    if (directLegacyNet > 0 && gross > 0 && directLegacyNet <= gross + 1) {
      if (!computedNet || Math.abs(directLegacyNet - computedNet) <= Math.max(1.5, gross * 0.06)) {
        return { amount: directLegacyNet, source: 'extractedData.salaireNet', confidence: 'high' };
      }
    }

    if (computedNet > 0 && gross > 0 && computedNet <= gross + 1) {
      return { amount: computedNet, source: 'gross_minus_deductions', confidence: directMonthlyNet > 0 || directLegacyNet > 0 ? 'medium' : 'high' };
    }

    if (plausibleRawAmounts.length > 0) {
      const fallback = computedNet > 0 ? pickClosest(plausibleRawAmounts, computedNet) : Math.max(...plausibleRawAmounts);
      return { amount: roundCurrency(fallback), source: 'extractedData.montants', confidence: 'medium' };
    }

    if (directMonthlyNet > 0) {
      return { amount: directMonthlyNet, source: 'financial_data.monthly_net_income', confidence: 'low' };
    }

    if (directLegacyNet > 0) {
      return { amount: directLegacyNet, source: 'extractedData.salaireNet', confidence: 'low' };
    }

    return { amount: 0, source: 'missing', confidence: 'low' };
  }

  if (normalizedType === 'AVIS_IMPOSITION') {
    const amount = directMonthlyNet || monthlyTaxEquivalent;
    return { amount, source: amount === directMonthlyNet ? 'financial_data.monthly_net_income' : 'revenue_fiscal_reference', confidence: amount > 0 ? 'medium' : 'low' };
  }

  if (['ATTESTATION_BOURSE', 'AIDE_LOGEMENT', 'PENSION'].includes(normalizedType)) {
    const amount = typedAmount || directMonthlyNet || directLegacyNet || Math.max(0, ...rawAmounts);
    return { amount, source: typedAmount ? 'typed_extra_details' : directMonthlyNet ? 'financial_data.monthly_net_income' : directLegacyNet ? 'legacy_net' : 'extractedData.montants', confidence: amount > 0 ? 'high' : 'low' };
  }

  if (normalizedType === 'CONTRAT_TRAVAIL') {
    const contractAmount = directMonthlyNet || directLegacyNet || (gross > 0 ? gross : 0) || Math.max(0, ...rawAmounts);
    return { amount: contractAmount, source: directMonthlyNet ? 'financial_data.monthly_net_income' : directLegacyNet ? 'legacy_net' : gross > 0 ? 'gross_salary' : 'extractedData.montants', confidence: contractAmount > 0 ? 'medium' : 'low' };
  }

  const genericAmount = directMonthlyNet || directLegacyNet || Math.max(0, ...rawAmounts);
  return { amount: genericAmount, source: genericAmount > 0 ? 'generic' : 'missing', confidence: genericAmount > 0 ? 'low' : 'low' };
}

function deriveApplicationFinancialProfile({ application, fallbackIncome = 0 } = {}) {
  const documents = Array.isArray(application?.documents) ? application.documents : [];
  const incomeDocs = documents.filter((document) => {
    const type = normalizeDocumentType(document?.type || document?.aiAnalysis?.documentType);
    if (document?.subjectType && document.subjectType !== 'tenant') return false;
    return [
      'BULLETIN_SALAIRE',
      'AVIS_IMPOSITION',
      'ATTESTATION_BOURSE',
      'AIDE_LOGEMENT',
      'PENSION',
      'CONTRAT_TRAVAIL',
    ].includes(type);
  });

  const salaryDocs = [];
  const pensionDocs = [];
  const benefitDocs = [];
  const taxDocs = [];
  const contractDocs = [];

  incomeDocs.forEach((document) => {
    const type = normalizeDocumentType(document?.type || document?.aiAnalysis?.documentType);
    const resolved = pickBestDocumentNetIncome({
      documentType: type,
      financialData: document?.aiAnalysis?.financial_data,
      extractedData: document?.aiAnalysis?.extractedData,
    });

    if (!resolved.amount || resolved.amount <= 0) return;

    const payload = {
      amount: resolved.amount,
      date: document?.dateEmission || document?.uploadedAt || null,
      status: String(document?.status || 'pending'),
      type,
    };

    if (type === 'BULLETIN_SALAIRE') {
      salaryDocs.push(payload);
    } else if (type === 'PENSION') {
      pensionDocs.push(payload);
    } else if (type === 'AVIS_IMPOSITION') {
      taxDocs.push(payload);
    } else if (type === 'CONTRAT_TRAVAIL') {
      contractDocs.push(payload);
    } else {
      benefitDocs.push(payload);
    }
  });

  const certifiedSalaryDocs = sortByRecentDate(salaryDocs.filter((document) => document.status === 'certified')).slice(0, 3);
  const reviewSalaryDocs = sortByRecentDate(salaryDocs.filter((document) => document.status !== 'certified')).slice(0, 3);
  const chosenSalaryDocs = certifiedSalaryDocs.length > 0 ? certifiedSalaryDocs : reviewSalaryDocs;
  const monthlySalaryNet = average(chosenSalaryDocs.map((document) => document.amount));

  const certifiedPension = sortByRecentDate(pensionDocs.filter((document) => document.status === 'certified'))[0];
  const fallbackPension = sortByRecentDate(pensionDocs)[0];
  const pensionNet = certifiedPension?.amount || fallbackPension?.amount || 0;

  const certifiedContract = sortByRecentDate(contractDocs.filter((document) => document.status === 'certified'))[0];
  const fallbackContract = sortByRecentDate(contractDocs)[0];
  const contractNet = certifiedContract?.amount || fallbackContract?.amount || 0;

  const certifiedTax = sortByRecentDate(taxDocs.filter((document) => document.status === 'certified'))[0];
  const fallbackTax = sortByRecentDate(taxDocs)[0];
  const taxMonthlyEquivalent = certifiedTax?.amount || fallbackTax?.amount || 0;

  const benefitByType = new Map();
  sortByRecentDate(benefitDocs).forEach((document) => {
    if (!benefitByType.has(document.type)) {
      benefitByType.set(document.type, document.amount);
    }
  });
  const monthlyBenefits = Array.from(benefitByType.values()).reduce((sum, value) => sum + normalizeIncomeAmount(value), 0);

  const primaryIncome =
    monthlySalaryNet ||
    pensionNet ||
    contractNet ||
    taxMonthlyEquivalent ||
    normalizeIncomeAmount(application?.financialSummary?.totalMonthlyIncome) ||
    normalizeIncomeAmount(fallbackIncome);

  const totalMonthlyIncome = roundCurrency(primaryIncome + monthlyBenefits);
  const certifiedIncome = Boolean(
    certifiedSalaryDocs.length > 0 ||
      certifiedPension ||
      certifiedContract ||
      certifiedTax ||
      benefitDocs.some((document) => document.status === 'certified')
  );

  let incomeSource = 'UNVERIFIED';
  let basisLabel = 'Aucun revenu fiable extrait pour le moment.';

  if (monthlySalaryNet > 0) {
    incomeSource = 'SALARY';
    basisLabel = certifiedSalaryDocs.length > 0
      ? `Moyenne de ${certifiedSalaryDocs.length} bulletin(s) certifié(s)`
      : `Moyenne de ${chosenSalaryDocs.length} bulletin(s) en revue`;
  } else if (pensionNet > 0) {
    incomeSource = 'PENSION';
    basisLabel = 'Montant mensuel issu du justificatif de pension';
  } else if (contractNet > 0) {
    incomeSource = 'CONTRACT';
    basisLabel = 'Montant mensuel issu du contrat de travail';
  } else if (taxMonthlyEquivalent > 0) {
    incomeSource = 'TAX_FALLBACK';
    basisLabel = "Approximation mensuelle issue de l'avis d'imposition";
  } else if (totalMonthlyIncome > 0) {
    incomeSource = certifiedIncome ? 'DECLARED_CERTIFIED' : 'DECLARED';
    basisLabel = certifiedIncome
      ? 'Montant agrégé depuis les justificatifs disponibles'
      : 'Montant déclaré en attente de certification';
  }

  const components = {
    salary: monthlySalaryNet,
    pension: pensionNet,
    contract: contractNet,
    taxFallback: taxMonthlyEquivalent,
    benefits: roundCurrency(monthlyBenefits),
  };

  return {
    totalMonthlyIncome,
    certifiedIncome,
    incomeSource,
    basisLabel,
    primaryIncome: roundCurrency(primaryIncome),
    payslipCount: salaryDocs.length,
    certifiedPayslipCount: certifiedSalaryDocs.length,
    components,
  };
}

function getDocumentIncomeContribution({ documentType, analysis } = {}) {
  return pickBestDocumentNetIncome({
    documentType,
    financialData: analysis?.financial_data,
    extractedData: analysis?.extractedData,
  });
}

module.exports = {
  deriveApplicationFinancialProfile,
  getDocumentIncomeContribution,
  normalizeDocumentType,
  normalizeIncomeAmount,
  pickBestDocumentNetIncome,
};
