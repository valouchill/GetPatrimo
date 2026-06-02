function normalizeDocumentType(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Un document compte comme revenu \u00ab locataire \u00bb si son subjectType est absent
// ou vaut TENANT \u2014 insensible \u00e0 la casse, car buildPortalDocuments \u00e9met 'tenant'
// (minuscule) tandis que le reste du scoring raisonne en 'TENANT'. Les pi\u00e8ces
// garant / Visale sont exclues du revenu locataire (et de la somme du foyer).
function isTenantSubject(doc) {
  const st = doc && doc.subjectType;
  return !st || String(st).toUpperCase() === 'TENANT';
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

function median(values = []) {
  if (!values.length) return 0;
  const numeric = values.map((v) => normalizeIncomeAmount(v)).filter((v) => v > 0).sort((a, b) => a - b);
  if (!numeric.length) return 0;
  const mid = Math.floor(numeric.length / 2);
  if (numeric.length % 2 === 0) {
    return roundCurrency((numeric[mid - 1] + numeric[mid]) / 2);
  }
  return roundCurrency(numeric[mid]);
}

function stdDeviation(values = []) {
  if (values.length < 2) return 0;
  const numeric = values.map((v) => normalizeIncomeAmount(v)).filter((v) => v > 0);
  if (numeric.length < 2) return 0;
  const mean = numeric.reduce((sum, v) => sum + v, 0) / numeric.length;
  const variance = numeric.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / numeric.length;
  return roundCurrency(Math.sqrt(variance));
}

/**
 * Agrège plusieurs bulletins de paie en une vue consolidée.
 * @param {Array} payslipDocs - [{ amount, date, status, source?, confidence?, period? }]
 * @returns {Object} { mean, median, stdDev, varianceRatio, varianceHigh,
 *                     usedMethod, primaryAmount, breakdown[], certifiedCount, totalCount }
 */
function aggregatePayslips(payslipDocs = []) {
  if (!Array.isArray(payslipDocs) || payslipDocs.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      varianceRatio: 0,
      varianceHigh: false,
      usedMethod: 'none',
      primaryAmount: 0,
      breakdown: [],
      certifiedCount: 0,
      totalCount: 0,
    };
  }

  const sorted = sortByRecentDate(payslipDocs);
  const certified = sorted.filter((d) => d.status === 'CERTIFIED');
  const reviewOnly = sorted.filter((d) => d.status !== 'CERTIFIED');
  // Préférer 3 derniers CERTIFIED, sinon compléter avec REVIEW (max 3 au total)
  const chosen = certified.length >= 3
    ? certified.slice(0, 3)
    : [...certified, ...reviewOnly].slice(0, 3);

  const amounts = chosen.map((d) => normalizeIncomeAmount(d.amount)).filter((v) => v > 0);

  if (amounts.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      varianceRatio: 0,
      varianceHigh: false,
      usedMethod: 'none',
      primaryAmount: 0,
      breakdown: chosen.map((d) => ({
        amount: roundCurrency(d.amount),
        period: d.period || null,
        date: d.date || null,
        status: d.status || 'PENDING',
        source: d.source || null,
        confidence: d.confidence || null,
      })),
      certifiedCount: certified.length,
      totalCount: payslipDocs.length,
    };
  }

  const mn = average(amounts);
  const md = median(amounts);
  const sd = stdDeviation(amounts);
  const varianceRatio = mn > 0 ? Number((sd / mn).toFixed(4)) : 0;
  const varianceHigh = varianceRatio > 0.05;
  // Si variance haute, privilégier la médiane (anti-outlier prime/régul)
  const usedMethod = varianceHigh ? 'median' : 'mean';
  const primaryAmount = usedMethod === 'median' ? md : mn;

  const breakdown = chosen.map((d) => ({
    amount: roundCurrency(d.amount),
    period: d.period || null,
    date: d.date || null,
    status: d.status || 'PENDING',
    source: d.source || null,
    confidence: d.confidence || null,
  }));

  return {
    mean: mn,
    median: md,
    stdDev: sd,
    varianceRatio,
    varianceHigh,
    usedMethod,
    primaryAmount,
    breakdown,
    certifiedCount: certified.length,
    totalCount: payslipDocs.length,
  };
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

  // ── Colocation : si plusieurs slots locataires (subjectType:'TENANT' +
  // subjectSlot 2-4), calculer le revenu PAR SLOT (récursivement, via le chemin
  // mono ci-dessous) puis SOMMER au niveau du foyer. Pour 1 slot, on n'entre
  // jamais dans cette branche → le code mono s'exécute à l'identique. ──
  const tenantSlots = [...new Set(
    documents
      .filter((doc) => isTenantSubject(doc))
      .map((doc) => Number(doc?.subjectSlot) || 1)
  )].sort((a, b) => a - b);
  if (tenantSlots.length > 1) {
    const perSlotProfiles = tenantSlots.map((slot) => {
      const slotDocs = documents.filter(
        (doc) => isTenantSubject(doc) && (Number(doc?.subjectSlot) || 1) === slot
      );
      return { slot, prof: deriveApplicationFinancialProfile({ application: { documents: slotDocs }, fallbackIncome: 0 }) };
    });
    const totalMonthlyIncome = roundCurrency(
      perSlotProfiles.reduce((sum, { prof }) => sum + (prof.totalMonthlyIncome || 0), 0)
    );
    return {
      ...perSlotProfiles[0].prof, // slot 1 → champs breakdown/payslips peuplés
      totalMonthlyIncome,
      certifiedIncome: perSlotProfiles.every(({ prof }) => prof.certifiedIncome),
      incomeSource: 'HOUSEHOLD',
      basisLabel: `Revenu cumulé du foyer (${perSlotProfiles.length} personnes)`,
      primaryIncome: totalMonthlyIncome,
      perSlot: perSlotProfiles.map(({ slot, prof }) => ({
        slot,
        monthlyIncome: prof.totalMonthlyIncome || 0,
        certified: Boolean(prof.certifiedIncome),
        incomeSource: prof.incomeSource,
      })),
    };
  }

  const incomeDocs = documents.filter((document) => {
    const ai = document?.aiAnalysis || {};
    const type = normalizeDocumentType(document?.type || ai?.documentType || ai?.document_metadata?.type);
    if (document?.subjectType && !isTenantSubject(document)) return false;
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
    const ai = document?.aiAnalysis || {};
    const type = normalizeDocumentType(document?.type || ai?.documentType || ai?.document_metadata?.type);
    const fd = ai?.financial_data || ai?.financialData || {};
    const ed = ai?.extractedData || ai?.extracted_data || {};
    const resolved = pickBestDocumentNetIncome({
      documentType: type,
      financialData: fd,
      extractedData: ed,
    });

    if (!resolved.amount || resolved.amount <= 0) return;

    // Période depuis l'IA si dispo
    const periodMonth = fd?.extra_details?.period_month || fd?.period_month || ed?.periodMonth;
    const periodYear = fd?.extra_details?.period_year || fd?.period_year || ed?.periodYear;
    const periodLabel = periodMonth
      ? (periodYear ? `${periodMonth} ${periodYear}` : String(periodMonth))
      : null;

    // Confidence : prefer numeric from IA, fallback string label
    const confidence = (typeof fd?.confidence_net_income === 'number')
      ? fd.confidence_net_income
      : (typeof ai?.confidence === 'number' ? ai.confidence : null);

    const payload = {
      amount: resolved.amount,
      date: document?.dateEmission || document?.uploadedAt || null,
      status: String(document?.status || 'PENDING'),
      type,
      source: resolved.source,
      confidence: confidence ?? (resolved.confidence === 'high' ? 0.9 : resolved.confidence === 'medium' ? 0.75 : 0.5),
      period: periodLabel,
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

  // Agrégation enrichie : moyenne + médiane + écart-type + breakdown
  const payslipAggregate = aggregatePayslips(salaryDocs);
  const certifiedSalaryDocs = sortByRecentDate(salaryDocs.filter((document) => document.status === 'CERTIFIED')).slice(0, 3);
  const monthlySalaryNet = payslipAggregate.primaryAmount;

  const certifiedPension = sortByRecentDate(pensionDocs.filter((document) => document.status === 'CERTIFIED'))[0];
  const fallbackPension = sortByRecentDate(pensionDocs)[0];
  const pensionNet = certifiedPension?.amount || fallbackPension?.amount || 0;

  const certifiedContract = sortByRecentDate(contractDocs.filter((document) => document.status === 'CERTIFIED'))[0];
  const fallbackContract = sortByRecentDate(contractDocs)[0];
  const contractNet = certifiedContract?.amount || fallbackContract?.amount || 0;

  const certifiedTax = sortByRecentDate(taxDocs.filter((document) => document.status === 'CERTIFIED'))[0];
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
      benefitDocs.some((document) => document.status === 'CERTIFIED')
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
    // V1.4 — Détail bulletins de paie pour visibilité propriétaire
    payslipsBreakdown: payslipAggregate.breakdown,
    monthlyIncomeMean: payslipAggregate.mean,
    monthlyIncomeMedian: payslipAggregate.median,
    monthlyIncomeStdDev: payslipAggregate.stdDev,
    monthlyIncomeMethod: payslipAggregate.usedMethod,
    varianceRatio: payslipAggregate.varianceRatio,
    varianceHigh: payslipAggregate.varianceHigh,
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
  aggregatePayslips,
  median,
  stdDeviation,
};
