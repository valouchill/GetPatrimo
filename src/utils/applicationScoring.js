const { normalizeAnalysisDocumentType } = require('./documentCertificationRules');

const SUPPORTED_PROFILES = ['Etudiant', 'Salarie', 'Independant', 'Retraite'];
const GUARANTEE_MODES = ['NONE', 'VISALE', 'PHYSICAL'];

const TENANT_WEIGHTS = {
  identity: 25,
  income: 25,
  activity: 10,
  domicile: 10,
};

const GUARANTOR_WEIGHTS = {
  identity: 10,
  income: 10,
  activity: 5,
  domicile: 5,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(Number(value || 0));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeProfile(value, fallback = 'Etudiant') {
  const normalized = String(value || '').trim();
  return SUPPORTED_PROFILES.includes(normalized) ? normalized : fallback;
}

function normalizeGuaranteeMode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return GUARANTEE_MODES.includes(normalized) ? normalized : 'NONE';
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthsBetween(from, to = new Date()) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return null;

  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const total = years * 12 + months;
  return total < 0 ? 0 : total;
}

function isCertifiedDocument(doc) {
  return doc && doc.status === 'certified' && !doc.flagged;
}

function getDocumentSearchText(doc) {
  return normalizeText([
    doc.type,
    doc.fileName,
    doc.name,
    doc.originalName,
    doc.category,
    doc.aiAnalysis?.documentType,
    doc.aiAnalysis?.ownerName,
    doc.aiAnalysis?.document_metadata?.owner_name,
  ].filter(Boolean).join(' '));
}

function inferEvidenceKind(doc) {
  const normalizedType = normalizeAnalysisDocumentType(
    doc.aiAnalysis?.documentType ||
      doc.type ||
      doc.documentType ||
      doc.fileName ||
      doc.name
  );
  const haystack = getDocumentSearchText(doc);

  if (normalizedType === 'CARTE_IDENTITE') return 'identity';
  if (normalizedType === 'CERTIFICAT_VISALE') return 'visale';
  if (normalizedType === 'BULLETIN_SALAIRE') return 'salary';
  if (normalizedType === 'AVIS_IMPOSITION') return 'tax';
  if (normalizedType === 'ATTESTATION_BOURSE') return 'student_aid';
  if (normalizedType === 'AIDE_LOGEMENT') return 'housing_aid';
  if (normalizedType === 'PENSION') {
    if (haystack.includes('RETRAITE')) return 'retirement';
    return 'pension';
  }
  if (normalizedType === 'JUSTIFICATIF_DOMICILE') {
    if (haystack.includes('QUITTANCE')) return 'rent_receipt';
    return 'domicile';
  }
  if (normalizedType === 'CONTRAT_TRAVAIL') {
    if (haystack.includes('SCOLARITE') || haystack.includes('INSCRIPTION') || haystack.includes('UNIVERSIT')) {
      return 'scolarite';
    }
    if (haystack.includes('URSSAF')) return 'urssaf';
    if (haystack.includes('KBIS') || haystack.includes('SIREN') || haystack.includes('SIRET')) return 'kbis';
    if (haystack.includes('ATTESTATION') || haystack.includes('EMPLOYEUR')) return 'employment_certificate';
    return 'employment_contract';
  }

  if (haystack.includes('SCOLARITE') || haystack.includes('INSCRIPTION') || haystack.includes('UNIVERSIT')) {
    return 'scolarite';
  }
  if (haystack.includes('URSSAF')) return 'urssaf';
  if (haystack.includes('BILAN') || haystack.includes('LIASSE')) return 'bilan';
  if (haystack.includes('KBIS') || haystack.includes('SIREN') || haystack.includes('SIRET')) return 'kbis';
  if (haystack.includes('RETRAITE')) return 'retirement';
  if (haystack.includes('VISALE')) return 'visale';
  if (haystack.includes('ATTESTATION') && haystack.includes('EMPLOYEUR')) return 'employment_certificate';
  if (haystack.includes('CONTRAT') || haystack.includes('EMBAUCHE')) return 'employment_contract';

  return 'other';
}

function getDocumentSubject(doc) {
  if (doc.subjectType === 'guarantor') {
    return {
      subjectType: 'guarantor',
      subjectSlot: doc.subjectSlot === 2 ? 2 : 1,
    };
  }

  if (doc.subjectType === 'visale') {
    return { subjectType: 'visale' };
  }

  if (doc.category === 'guarantor') {
    return {
      subjectType: 'guarantor',
      subjectSlot: doc.subjectSlot === 2 ? 2 : 1,
    };
  }

  if (inferEvidenceKind(doc) === 'visale') {
    return { subjectType: 'visale' };
  }

  return { subjectType: 'tenant' };
}

function extractVisaleMaxRent(doc) {
  const maybeValues = [
    doc.aiAnalysis?.financialData?.extra_details?.visale?.loyer_maximum_garanti,
    doc.aiAnalysis?.financial_data?.extra_details?.visale?.loyer_maximum_garanti,
    doc.aiAnalysis?.financial_data?.extraDetails?.visale?.loyerMaximumGaranti,
    doc.financialData?.extra_details?.visale?.loyer_maximum_garanti,
  ];

  const value = maybeValues.find((item) => Number.isFinite(Number(item)));
  return value != null ? Number(value) : null;
}

function hasDigitalSeal(doc) {
  return doc.aiAnalysis?.trustAndSecurity?.digital_seal_authenticated === true ||
    doc.aiAnalysis?.trust_and_security?.digital_seal_authenticated === true ||
    doc.aiAnalysis?.trust_and_security?.digital_seal_status === 'AUTHENTIFIÉ_PAR_SCELLEMENT_NUMÉRIQUE';
}

function hasExpiredIdentity(documents) {
  return documents.some((doc) => {
    const expirationDate = parseDate(doc.dateExpiration || doc.expirationDate || doc.aiAnalysis?.document_metadata?.date_validite);
    return expirationDate && expirationDate < new Date();
  });
}

function latestMonthsForKind(documents, kind) {
  const dates = documents
    .filter((doc) => inferEvidenceKind(doc) === kind)
    .map((doc) => parseDate(doc.dateEmission || doc.documentDate || doc.uploadedAt || doc.createdAt))
    .filter(Boolean);

  if (dates.length === 0) return null;
  const latest = dates.reduce((current, candidate) => (candidate > current ? candidate : current), dates[0]);
  return monthsBetween(latest, new Date());
}

function buildKindCounters(documents) {
  return documents.reduce((acc, doc) => {
    const kind = inferEvidenceKind(doc);
    acc[kind] = (acc[kind] || 0) + 1;
    return acc;
  }, {});
}

function scoreIdentityBlock({ documents, maxScore, verified, warnings, label }) {
  const certified = documents.filter(isCertifiedDocument);
  const hasIdentityDoc = certified.some((doc) => inferEvidenceKind(doc) === 'identity');
  const expired = hasExpiredIdentity(certified);

  if (expired) {
    warnings.push(`${label}: la pièce d'identité fournie est expirée.`);
    return 0;
  }

  if (verified || hasIdentityDoc) {
    return maxScore;
  }

  warnings.push(`${label}: la pièce d'identité n'est pas encore validée.`);
  return 0;
}

function scoreDomicileBlock({ documents, maxScore, warnings, label }) {
  const certified = documents.filter(isCertifiedDocument);
  const hasDomicile = certified.some((doc) => {
    const kind = inferEvidenceKind(doc);
    return kind === 'domicile' || kind === 'rent_receipt';
  });

  if (hasDomicile) {
    return maxScore;
  }

  warnings.push(`${label}: justificatif de domicile manquant ou non certifié.`);
  return 0;
}

function scoreIncomeAndActivity(profile, documents, weights, warnings, label) {
  const certified = documents.filter(isCertifiedDocument);
  const counters = buildKindCounters(certified);

  let income = 0;
  let activity = 0;

  if (profile === 'Etudiant') {
    const incomePieces =
      (counters.student_aid || 0) +
      (counters.housing_aid || 0) +
      (counters.salary || 0) +
      (counters.pension || 0) +
      (counters.tax || 0);

    if (incomePieces >= 2) {
      income = weights.income;
    } else if (incomePieces === 1) {
      income = round(weights.income * 0.72);
      warnings.push(`${label}: ajoutez une seconde preuve de revenus ou d'aides pour consolider le bloc Revenus.`);
    } else {
      warnings.push(`${label}: revenus ou aides étudiantes manquants.`);
    }

    if ((counters.scolarite || 0) > 0) {
      activity = weights.activity;
    } else {
      warnings.push(`${label}: certificat de scolarité manquant.`);
    }

    return { income, activity };
  }

  if (profile === 'Salarie') {
    const salaryCount = counters.salary || 0;
    const hasTax = (counters.tax || 0) > 0;
    const hasEmploymentCertificate = (counters.employment_certificate || 0) > 0;
    const hasContract = (counters.employment_contract || 0) > 0;

    if (salaryCount >= 3 && hasTax) {
      income = weights.income;
    } else if (salaryCount >= 3 || hasTax) {
      income = round(weights.income * 0.68);
      warnings.push(`${label}: il manque soit l'avis d'imposition, soit une série complète de 3 bulletins.`);
    } else if (salaryCount > 0) {
      income = round(weights.income * 0.4);
      warnings.push(`${label}: ajoutez les 3 bulletins et l'avis d'imposition pour compléter le bloc Revenus.`);
    } else {
      warnings.push(`${label}: bloc Revenus incomplet.`);
    }

    const latestSalaryMonths = latestMonthsForKind(certified, 'salary');
    if (income > 0 && latestSalaryMonths != null && latestSalaryMonths > 2) {
      income = round(income * 0.6);
      warnings.push(`${label}: les bulletins de salaire du bloc Revenus commencent à dater.`);
    }

    if (hasEmploymentCertificate) {
      const latestEmployment = certified
        .filter((doc) => inferEvidenceKind(doc) === 'employment_certificate')
        .map((doc) => parseDate(doc.dateEmission || doc.documentDate || doc.uploadedAt || doc.createdAt))
        .filter(Boolean)
        .sort((a, b) => b - a)[0];
      const employmentMonths = latestEmployment ? monthsBetween(latestEmployment, new Date()) : null;

      if (employmentMonths != null && employmentMonths > 3) {
        activity = 0;
        warnings.push(`${label}: l'attestation employeur a plus de 3 mois.`);
      } else if (employmentMonths != null && employmentMonths > 1) {
        activity = round(weights.activity * 0.7);
        warnings.push(`${label}: l'attestation employeur doit être rafraîchie.`);
      } else {
        activity = weights.activity;
      }
    } else if (hasContract) {
      activity = round(weights.activity * 0.7);
      warnings.push(`${label}: ajoutez une attestation employeur récente pour maximiser le bloc Activité.`);
    } else {
      warnings.push(`${label}: justificatif d'activité salariale manquant.`);
    }

    return { income, activity };
  }

  if (profile === 'Independant') {
    const hasTax = (counters.tax || 0) > 0;
    const urssaf = (counters.urssaf || 0) > 0;
    const bilanCount = counters.bilan || 0;
    const hasKbis = (counters.kbis || 0) > 0;

    if (hasTax && (urssaf || bilanCount >= 2)) {
      income = weights.income;
    } else if (hasTax && (bilanCount === 1 || hasKbis)) {
      income = round(weights.income * 0.72);
      warnings.push(`${label}: ajoutez un second bilan ou une attestation URSSAF pour compléter les revenus indépendants.`);
    } else if (hasTax || urssaf || bilanCount > 0) {
      income = round(weights.income * 0.4);
      warnings.push(`${label}: avis d'imposition et preuves d'activité indépendante attendus.`);
    } else {
      warnings.push(`${label}: revenus indépendants non documentés.`);
    }

    if (urssaf || bilanCount >= 2) {
      activity = weights.activity;
    } else if (bilanCount === 1 || hasKbis) {
      activity = round(weights.activity * 0.6);
      warnings.push(`${label}: activité partiellement documentée, ajoutez URSSAF ou un second bilan.`);
    } else {
      warnings.push(`${label}: justificatif d'activité indépendante manquant.`);
    }

    return { income, activity };
  }

  // Retraite
  const retirementProofs = (counters.retirement || 0) + (counters.pension || 0);
  const hasTax = (counters.tax || 0) > 0;

  if (retirementProofs > 0 && hasTax) {
    income = weights.income;
  } else if (retirementProofs > 0 || hasTax) {
    income = round(weights.income * 0.6);
    warnings.push(`${label}: ajoutez le second justificatif entre pension/retraite et avis d'imposition.`);
  } else {
    warnings.push(`${label}: justificatifs de retraite manquants.`);
  }

  if (retirementProofs > 0) {
    activity = weights.activity;
  } else {
    warnings.push(`${label}: preuve de pension ou de retraite manquante.`);
  }

  return { income, activity };
}

function computeGuarantorSlotScore(slot, documents, warnings) {
  const slotWarnings = [];
  const profile = normalizeProfile(slot.profile, 'Salarie');
  const certified = documents.filter(isCertifiedDocument);
  const identity = scoreIdentityBlock({
    documents: certified,
    maxScore: GUARANTOR_WEIGHTS.identity,
    verified: ['CERTIFIED', 'AUDITED'].includes(String(slot.status || '').toUpperCase()),
    warnings: slotWarnings,
    label: `Garant ${slot.slot}`,
  });
  const incomeAndActivity = scoreIncomeAndActivity(
    profile,
    certified,
    GUARANTOR_WEIGHTS,
    slotWarnings,
    `Garant ${slot.slot}`
  );
  const domicile = scoreDomicileBlock({
    documents: certified,
    maxScore: GUARANTOR_WEIGHTS.domicile,
    warnings: slotWarnings,
    label: `Garant ${slot.slot}`,
  });

  warnings.push(...slotWarnings);

  return {
    slot: slot.slot,
    profile,
    identity,
    income: incomeAndActivity.income,
    activity: incomeAndActivity.activity,
    domicile,
    total:
      identity +
      incomeAndActivity.income +
      incomeAndActivity.activity +
      domicile,
    warnings: slotWarnings,
    status: slot.status || 'NONE',
    certificationMethod: slot.certificationMethod || null,
  };
}

function buildDefaultGuarantors(guarantors = []) {
  const slots = safeArray(guarantors)
    .map((slot, index) => ({
      slot: slot.slot === 2 ? 2 : index === 1 ? 2 : 1,
      profile: normalizeProfile(slot.profile, 'Salarie'),
      firstName: slot.firstName || '',
      lastName: slot.lastName || '',
      email: slot.email || '',
      status: slot.status || 'NONE',
      certificationMethod: slot.certificationMethod || null,
      score: Number.isFinite(Number(slot.score)) ? Number(slot.score) : 0,
    }))
    .slice(0, 2);

  if (!slots.some((slot) => slot.slot === 1)) {
    slots.unshift({
      slot: 1,
      profile: 'Salarie',
      firstName: '',
      lastName: '',
      email: '',
      status: 'NONE',
      certificationMethod: null,
      score: 0,
    });
  }

  return slots
    .sort((a, b) => a.slot - b.slot)
    .slice(0, 2);
}

function normalizeGuaranteeState(guarantee = {}, legacyGuarantor = {}) {
  const inferredMode = guarantee.mode ||
    (legacyGuarantor?.certificationMethod === 'VISALE'
      ? 'VISALE'
      : legacyGuarantor?.hasGuarantor
        ? 'PHYSICAL'
        : 'NONE');
  const mode = normalizeGuaranteeMode(inferredMode);
  const guarantors = buildDefaultGuarantors(
    guarantee.guarantors && guarantee.guarantors.length > 0
      ? guarantee.guarantors
      : legacyGuarantor?.hasGuarantor
        ? [{
            slot: 1,
            status: legacyGuarantor.status || 'PENDING',
            certificationMethod: legacyGuarantor.certificationMethod || null,
          }]
        : []
  );

  const visale = {
    status: guarantee.visale?.status || 'NONE',
    fileId: guarantee.visale?.fileId || null,
    certified: Boolean(guarantee.visale?.certified),
    maxRent: Number.isFinite(Number(guarantee.visale?.maxRent)) ? Number(guarantee.visale.maxRent) : null,
    compatibleWithRent: guarantee.visale?.compatibleWithRent !== false,
    digitalSeal: Boolean(guarantee.visale?.digitalSeal),
  };

  return {
    mode,
    visale,
    guarantors,
  };
}

function buildLegacyGuarantorSummary(guarantee, breakdown) {
  if (guarantee.mode === 'VISALE') {
    return {
      hasGuarantor: true,
      status: guarantee.visale.certified ? 'CERTIFIED' : guarantee.visale.status || 'PENDING',
      certificationMethod: 'VISALE',
    };
  }

  if (guarantee.mode === 'PHYSICAL') {
    const primary = safeArray(guarantee.guarantors).find((slot) => slot.slot === 1) || safeArray(guarantee.guarantors)[0];
    const hasGuarantor = breakdown?.guarantee?.total > 0 || ['CERTIFIED', 'AUDITED', 'PENDING'].includes(String(primary?.status || ''));
    return {
      hasGuarantor,
      status: hasGuarantor ? primary?.status || 'PENDING' : 'NONE',
      certificationMethod: primary?.certificationMethod || 'AUDIT',
    };
  }

  return {
    hasGuarantor: false,
    status: 'NONE',
    certificationMethod: undefined,
  };
}

function buildNextAction(context) {
  const {
    tenant,
    guarantee,
    chapterStates,
    diditStatus,
    guaranteeRequirement,
  } = context;

  if (diditStatus !== 'verified' && tenant.identity < TENANT_WEIGHTS.identity) {
    return { action: "Validez d'abord votre identité", points: TENANT_WEIGHTS.identity - tenant.identity };
  }

  if (tenant.income < TENANT_WEIGHTS.income) {
    return { action: 'Complétez vos justificatifs de revenus', points: TENANT_WEIGHTS.income - tenant.income };
  }

  if (tenant.activity < TENANT_WEIGHTS.activity) {
    return { action: "Ajoutez votre justificatif d'activité ou de stabilité", points: TENANT_WEIGHTS.activity - tenant.activity };
  }

  if (tenant.domicile < TENANT_WEIGHTS.domicile) {
    return { action: 'Ajoutez un justificatif de domicile récent', points: TENANT_WEIGHTS.domicile - tenant.domicile };
  }

  if (guaranteeRequirement === 'required' && !chapterStates.guarantee.satisfied) {
    return { action: 'Activez une Visale valide ou ajoutez un garant physique complet', points: 30 - guarantee.total };
  }

  if (guaranteeRequirement === 'recommended' && guarantee.total < 30) {
    return { action: 'Ajoutez une garantie pour renforcer votre dossier', points: 30 - guarantee.total };
  }

  if (!chapterStates.passport.ready) {
    return { action: 'Finalisez le dernier chapitre pour générer votre passeport', points: 100 - (tenant.total + guarantee.total) };
  }

  return { action: 'Votre passeport peut etre genere', points: 0 };
}

function computeApplicationPatrimometer(input = {}) {
  const candidateStatus = normalizeProfile(input.candidateStatus, 'Etudiant');
  const diditStatus = String(input.diditStatus || 'idle').toLowerCase();
  const propertyRentAmount = Number(input.propertyRentAmount) || 0;
  const detectedIncome = Number(input.detectedIncome) || 0;
  const documents = safeArray(input.documents).map((doc) => ({
    ...doc,
    status: doc.status || 'pending',
  }));
  const warnings = [];

  const grouped = {
    tenant: [],
    visale: [],
    guarantor: {
      1: [],
      2: [],
    },
  };

  documents.forEach((doc) => {
    const subject = getDocumentSubject(doc);
    if (subject.subjectType === 'visale') {
      grouped.visale.push(doc);
      return;
    }
    if (subject.subjectType === 'guarantor') {
      grouped.guarantor[subject.subjectSlot === 2 ? 2 : 1].push(doc);
      return;
    }
    grouped.tenant.push(doc);
  });

  const normalizedGuarantee = normalizeGuaranteeState(input.guarantee, input.legacyGuarantor);

  const tenantIdentity = scoreIdentityBlock({
    documents: grouped.tenant.filter(isCertifiedDocument),
    maxScore: TENANT_WEIGHTS.identity,
    verified: diditStatus === 'verified',
    warnings,
    label: 'Locataire',
  });
  const tenantIncomeAndActivity = scoreIncomeAndActivity(
    candidateStatus,
    grouped.tenant.filter(isCertifiedDocument),
    TENANT_WEIGHTS,
    warnings,
    'Locataire'
  );
  const tenantDomicile = scoreDomicileBlock({
    documents: grouped.tenant.filter(isCertifiedDocument),
    maxScore: TENANT_WEIGHTS.domicile,
    warnings,
    label: 'Locataire',
  });

  const tenant = {
    identity: tenantIdentity,
    income: tenantIncomeAndActivity.income,
    activity: tenantIncomeAndActivity.activity,
    domicile: tenantDomicile,
  };
  tenant.total = tenant.identity + tenant.income + tenant.activity + tenant.domicile;

  const guaranteeWarnings = [];
  let guarantee = {
    mode: normalizedGuarantee.mode,
    visale: {
      score: 0,
      certified: false,
      compatibleWithRent: false,
      maxRent: normalizedGuarantee.visale.maxRent,
      digitalSeal: normalizedGuarantee.visale.digitalSeal,
      status: normalizedGuarantee.visale.status,
    },
    guarantors: [],
    identity: 0,
    income: 0,
    activity: 0,
    domicile: 0,
    total: 0,
  };

  if (normalizedGuarantee.mode === 'VISALE') {
    const visaleDocs = grouped.visale.filter(isCertifiedDocument);
    const visaleDoc = visaleDocs[0] || null;
    const maxRent = normalizedGuarantee.visale.maxRent || (visaleDoc ? extractVisaleMaxRent(visaleDoc) : null);
    const compatibleWithRent = propertyRentAmount > 0 && maxRent != null
      ? maxRent >= propertyRentAmount
      : normalizedGuarantee.visale.compatibleWithRent;
    const certified = Boolean(visaleDoc) || normalizedGuarantee.visale.certified;
    const digitalSeal = normalizedGuarantee.visale.digitalSeal || (visaleDoc ? hasDigitalSeal(visaleDoc) : false);

    let visaleScore = 0;
    if (certified && compatibleWithRent) {
      visaleScore = 30;
    } else if (certified && maxRent == null) {
      visaleScore = 22;
      guaranteeWarnings.push('Garantie Visale detectee, mais le plafond de loyer garanti reste a confirmer.');
    } else if (certified) {
      visaleScore = 10;
      guaranteeWarnings.push('La Visale fournie ne couvre pas le loyer demande.');
    } else {
      guaranteeWarnings.push('Certificat Visale manquant ou non certifie.');
    }

    guarantee = {
      ...guarantee,
      visale: {
        score: visaleScore,
        certified,
        compatibleWithRent,
        maxRent,
        digitalSeal,
        status: certified ? 'CERTIFIED' : normalizedGuarantee.visale.status || 'PENDING',
      },
      total: visaleScore,
    };
  } else if (normalizedGuarantee.mode === 'PHYSICAL') {
    const slotScores = normalizedGuarantee.guarantors.map((slot) =>
      computeGuarantorSlotScore(slot, grouped.guarantor[slot.slot] || [], guaranteeWarnings)
    );

    guarantee.identity = Math.max(0, ...slotScores.map((slot) => slot.identity));
    guarantee.income = Math.max(0, ...slotScores.map((slot) => slot.income));
    guarantee.activity = Math.max(0, ...slotScores.map((slot) => slot.activity));
    guarantee.domicile = Math.max(0, ...slotScores.map((slot) => slot.domicile));
    guarantee.total = clamp(
      guarantee.identity + guarantee.income + guarantee.activity + guarantee.domicile,
      0,
      30
    );
    guarantee.guarantors = slotScores;
  }

  warnings.push(...guaranteeWarnings);

  const guaranteeRequirement =
    propertyRentAmount > 0 && detectedIncome > 0 && detectedIncome < propertyRentAmount * 3
      ? 'required'
      : candidateStatus === 'Etudiant' || tenant.total < 55
        ? 'recommended'
        : 'optional';

  const guaranteeSatisfied = guaranteeRequirement === 'required'
    ? guarantee.total >= 20
    : guaranteeRequirement === 'recommended'
      ? guarantee.mode === 'NONE' ? false : guarantee.total > 0
      : guarantee.mode === 'NONE' ? true : guarantee.total > 0;

  const identityStarted =
    diditStatus !== 'idle' ||
    grouped.tenant.some((doc) => inferEvidenceKind(doc) === 'identity') ||
    documents.some((doc) => doc.category === 'identity');

  const tenantComplete = tenant.identity === TENANT_WEIGHTS.identity &&
    tenant.income >= round(TENANT_WEIGHTS.income * 0.68) &&
    tenant.activity > 0 &&
    tenant.domicile === TENANT_WEIGHTS.domicile;

  const chapterStates = {
    identity: {
      engaged: identityStarted,
      complete: tenant.identity === TENANT_WEIGHTS.identity,
    },
    tenant: {
      complete: tenantComplete,
      score: tenant.total,
      max: 70,
    },
    guarantee: {
      accessible: identityStarted,
      requirement: guaranteeRequirement,
      complete: guarantee.mode === 'VISALE'
        ? guarantee.total >= 30
        : guarantee.mode === 'PHYSICAL'
          ? guarantee.total >= 20
          : guaranteeRequirement !== 'required',
      satisfied: guaranteeSatisfied,
      score: guarantee.total,
      max: 30,
      mode: guarantee.mode,
    },
    passport: {
      ready: tenantComplete && (guaranteeRequirement === 'required' ? guaranteeSatisfied : true),
    },
  };

  const totalScore = clamp(tenant.total + guarantee.total, 0, 100);
  const grade = totalScore >= 90 ? 'SOUVERAIN'
    : totalScore >= 80 ? 'A'
    : totalScore >= 70 ? 'B'
    : totalScore >= 60 ? 'C'
    : totalScore >= 50 ? 'D'
    : totalScore >= 40 ? 'E'
    : 'F';

  const nextAction = buildNextAction({
    tenant,
    guarantee,
    chapterStates,
    diditStatus,
    guaranteeRequirement,
  });

  const breakdown = {
    identity: tenant.identity,
    income: tenant.income,
    documents: tenant.activity + tenant.domicile,
    guarantor: guarantee.total,
    tenant: {
      ...tenant,
      total: tenant.total,
      max: 70,
    },
    guarantee: {
      ...guarantee,
      max: 30,
    },
  };

  return {
    score: totalScore,
    grade,
    breakdown,
    warnings: Array.from(new Set(warnings.filter(Boolean))),
    nextAction,
    chapterStates,
    guarantee: {
      ...normalizedGuarantee,
      mode: guarantee.mode,
      visale: {
        ...normalizedGuarantee.visale,
        ...guarantee.visale,
      },
      guarantors: normalizedGuarantee.guarantors.map((slot) => {
        const slotScore = safeArray(guarantee.guarantors).find((entry) => entry.slot === slot.slot);
        return {
          ...slot,
          score: slotScore ? slotScore.total : slot.score || 0,
          status: slotScore ? slotScore.status : slot.status || 'NONE',
          certificationMethod: slotScore ? slotScore.certificationMethod : slot.certificationMethod || null,
        };
      }),
    },
    legacyGuarantor: buildLegacyGuarantorSummary(
      {
        ...normalizedGuarantee,
        mode: guarantee.mode,
        visale: {
          ...normalizedGuarantee.visale,
          ...guarantee.visale,
        },
        guarantors: normalizedGuarantee.guarantors.map((slot) => {
          const slotScore = safeArray(guarantee.guarantors).find((entry) => entry.slot === slot.slot);
          return {
            ...slot,
            score: slotScore ? slotScore.total : slot.score || 0,
            status: slotScore ? slotScore.status : slot.status || 'NONE',
            certificationMethod: slotScore ? slotScore.certificationMethod : slot.certificationMethod || null,
          };
        }),
      },
      breakdown
    ),
  };
}

module.exports = {
  SUPPORTED_PROFILES,
  GUARANTEE_MODES,
  TENANT_WEIGHTS,
  GUARANTOR_WEIGHTS,
  inferEvidenceKind,
  normalizeGuaranteeState,
  buildLegacyGuarantorSummary,
  computeApplicationPatrimometer,
};
