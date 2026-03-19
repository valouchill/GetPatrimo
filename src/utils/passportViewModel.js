const crypto = require('crypto');
const { inferEvidenceKind } = require('./applicationScoring');

const PASSPORT_STATE_META = {
  draft: {
    label: 'Brouillon',
    shortLabel: 'Brouillon',
    accent: 'amber',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    watermark: 'BROUILLON',
  },
  review: {
    label: 'En revue',
    shortLabel: 'En revue',
    accent: 'blue',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    watermark: 'EN REVUE',
  },
  ready: {
    label: 'Prêt à partager',
    shortLabel: 'Prêt',
    accent: 'emerald',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    watermark: 'CERTIFIE',
  },
  sealed: {
    label: 'Scellé',
    shortLabel: 'Scellé',
    accent: 'slate',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    watermark: 'SCELLE',
  },
};

const BLOCKS = [
  {
    id: 'identity',
    label: 'Identité',
    max: 25,
    critical: true,
    matches(kind) {
      return kind === 'identity';
    },
  },
  {
    id: 'income',
    label: 'Revenus',
    max: 25,
    critical: true,
    matches(kind) {
      return ['salary', 'tax', 'student_aid', 'housing_aid', 'pension', 'retirement'].includes(kind);
    },
  },
  {
    id: 'activity',
    label: 'Activité / Stabilité',
    max: 10,
    critical: true,
    matches(kind) {
      return ['employment_contract', 'employment_certificate', 'scolarite', 'urssaf', 'kbis', 'bilan'].includes(kind);
    },
  },
  {
    id: 'domicile',
    label: 'Domicile / Administratif',
    max: 10,
    critical: true,
    matches(kind) {
      return ['domicile', 'rent_receipt'].includes(kind);
    },
  },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(Number(value || 0));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(values) {
  const dates = values.map(parseDate).filter(Boolean);
  if (dates.length === 0) return null;
  return dates.sort((a, b) => b.getTime() - a.getTime())[0];
}

function formatDate(value, locale = 'fr-FR') {
  const date = parseDate(value);
  if (!date) return null;
  return date.toLocaleDateString(locale);
}

function formatDateTime(value, locale = 'fr-FR') {
  const date = parseDate(value);
  if (!date) return null;
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roundToNearestHundred(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric / 100) * 100;
}

function formatCurrency(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
}

function buildPassportId(id) {
  if (!id) return `PT-${new Date().getFullYear()}-TEMP`;
  return `PT-${new Date().getFullYear()}-${String(id).slice(-8).toUpperCase()}`;
}

function buildPassportSlug(firstName = 'dossier') {
  const safeName = String(firstName || 'dossier')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12) || 'dossier';
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${safeName}-${suffix}`;
}

function ensurePassportSlug(application) {
  if (application && application.passportSlug) return application.passportSlug;
  return buildPassportSlug(application?.profile?.firstName);
}

function getBaseUrl(value) {
  return String(value || '').replace(/\/$/, '');
}

function getDocStatus(doc) {
  if (!doc) return 'pending';
  if (doc.flagged) return 'needs_review';
  return doc.status || 'pending';
}

function isCertified(doc) {
  return getDocStatus(doc) === 'certified' && !doc.flagged;
}

function isReview(doc) {
  return getDocStatus(doc) === 'needs_review';
}

function isRejected(doc) {
  const status = getDocStatus(doc);
  return status === 'rejected' || status === 'illegible';
}

function getDocumentSubject(doc) {
  if (doc?.subjectType === 'guarantor' || doc?.category === 'guarantor') {
    return {
      subjectType: 'guarantor',
      subjectSlot: doc?.subjectSlot === 2 ? 2 : 1,
    };
  }
  if (doc?.subjectType === 'visale' || inferEvidenceKind(doc) === 'visale') {
    return { subjectType: 'visale' };
  }
  return { subjectType: 'tenant' };
}

function getTenantDocuments(documents) {
  return safeArray(documents).filter((doc) => getDocumentSubject(doc).subjectType === 'tenant');
}

function getPropertyData(application) {
  const property = application?.property || {};
  const address = typeof property?.address === 'string'
    ? property.address
    : [property?.address?.city, property?.address?.region, property?.address?.department]
        .filter(Boolean)
        .join(', ');

  return {
    name: property?.name || '',
    rentAmount: Number(property?.rentAmount) || 0,
    address: address || '',
  };
}

function deriveRegion(property) {
  const raw = String(property?.address || '');
  if (!raw) return 'France métropolitaine';
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(', ');
  return parts[0];
}

function buildMaskedIdentity(profile, didit, audience) {
  const firstName = profile?.firstName || didit?.identityData?.firstName || 'Candidat';
  const lastName = profile?.lastName || didit?.identityData?.lastName || '';
  const lastInitial = lastName ? `${String(lastName).charAt(0).toUpperCase()}.` : '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  if (audience === 'public') {
    return {
      firstName,
      lastName: lastInitial,
      fullName: [firstName, lastInitial].filter(Boolean).join(' ').trim(),
      displayName: [firstName, lastInitial].filter(Boolean).join(' ').trim(),
    };
  }

  return {
    firstName,
    lastName,
    fullName: fullName || firstName,
    displayName: fullName || firstName,
  };
}

function inferProfession(candidateStatus, breakdown) {
  if (candidateStatus === 'Salarie') return 'Salarié';
  if (candidateStatus === 'Etudiant') return 'Étudiant';
  if (candidateStatus === 'Independant') return 'Indépendant';
  if (candidateStatus === 'Retraite') return 'Retraité';
  if (breakdown?.activity > 0) return 'Actif';
  return 'Profil en audit';
}

function getGuaranteeSummary(guarantee, guaranteeState) {
  const mode = guarantee?.mode || 'NONE';

  if (mode === 'VISALE') {
    const certified = Boolean(guarantee?.visale?.certified);
    const compatible = guarantee?.visale?.compatibleWithRent !== false;
    return {
      mode,
      label: 'Garantie Visale',
      score: Number(guarantee?.visale?.score || guaranteeState?.score || 0),
      status: certified ? (compatible ? 'Certifiée et compatible' : 'Certifiée à confirmer') : 'En attente',
      summary: certified
        ? compatible
          ? 'Visale couvre le loyer demandé.'
          : 'Visale détectée, mais le plafond doit être confirmé.'
        : 'Visale non certifiée ou non détectée.',
      shareBadge: certified && compatible ? 'Visale certifiée' : 'Visale en cours',
      guarantors: [],
    };
  }

  if (mode === 'PHYSICAL') {
    const guarantors = safeArray(guarantee?.guarantors).map((slot) => ({
      slot: slot?.slot === 2 ? 2 : 1,
      profile: slot?.profile || 'Salarie',
      score: Number(slot?.score || 0),
      status: slot?.status || 'PENDING',
      certificationMethod: slot?.certificationMethod || null,
      label: `Garant ${slot?.slot === 2 ? '2' : '1'}`,
    }));
    const activeCount = guarantors.filter((slot) => slot.status !== 'NONE' || slot.score > 0).length;
    return {
      mode,
      label: activeCount > 1 ? 'Deux garants physiques' : 'Garant physique',
      score: Number(guaranteeState?.score || guarantee?.total || 0),
      status: activeCount > 0 ? 'Garantie documentée' : 'En attente',
      summary: activeCount > 1
        ? 'Deux garants physiques renforcent le dossier.'
        : activeCount === 1
          ? 'Un garant physique est rattaché au dossier.'
          : 'Aucun garant physique complet pour l’instant.',
      shareBadge: activeCount > 1 ? '2 garants' : activeCount === 1 ? 'Garant 1 certifié' : 'Garant en attente',
      guarantors,
    };
  }

  return {
    mode: 'NONE',
    label: 'Sans garant',
    score: 0,
    status: 'Sans garantie externe',
    summary: 'Le dossier repose uniquement sur la solvabilité du locataire.',
    shareBadge: 'Sans garant',
    guarantors: [],
  };
}

function buildBlockSummaries(blocks, breakdownTenant, diditStatus, documents) {
  return BLOCKS.map((block) => {
    const relevantDocs = blocks[block.id] || [];
    const certifiedCount = relevantDocs.filter(isCertified).length;
    const reviewCount = relevantDocs.filter(isReview).length;
    const rejectedCount = relevantDocs.filter(isRejected).length;
    const latestDocumentAt = latestDate(
      relevantDocs.map((doc) => doc.dateEmission || doc.documentDate || doc.uploadedAt || doc.createdAt)
    );

    const scoreValue = block.id === 'identity'
      ? Number((diditStatus === 'VERIFIED' ? block.max : breakdownTenant?.identity) || 0)
      : Number(breakdownTenant?.[block.id] || 0);
    const covered = block.id === 'identity'
      ? diditStatus === 'VERIFIED' || certifiedCount > 0
      : certifiedCount > 0 && scoreValue > 0;

    const primaryReviewOnly = reviewCount > 0 && certifiedCount === 0;
    const primaryRejected = rejectedCount > 0 && certifiedCount === 0;

    return {
      id: block.id,
      label: block.label,
      max: block.max,
      score: clamp(round(scoreValue), 0, block.max),
      certifiedCount,
      reviewCount,
      rejectedCount,
      docCount: relevantDocs.length,
      covered,
      critical: block.critical,
      primaryReviewOnly,
      primaryRejected,
      latestDocumentAt,
      status: primaryRejected ? 'blocked' : primaryReviewOnly ? 'review' : covered ? 'complete' : 'missing',
      summary: primaryRejected
        ? `${block.label}: la pièce principale a été rejetée ou jugée illisible.`
        : primaryReviewOnly
          ? `${block.label}: une pièce a été déposée mais reste en revue.`
          : covered
            ? `${block.label}: bloc couvert.`
            : `${block.label}: bloc encore incomplet.`,
    };
  });
}

function buildAuditTimeline({ application, state, stateMeta, tenantBlocks, guaranteeSummary, documents }) {
  const didit = application?.didit || {};
  const updatedAt = application?.updatedAt || application?.createdAt || new Date();
  const verifiedAt = didit?.verifiedAt || latestDate(documents.map((doc) => doc.uploadedAt || doc.createdAt));
  const events = [];

  if (didit?.status === 'VERIFIED') {
    events.push({
      id: 'identity',
      title: 'Identité vérifiée',
      status: 'success',
      time: formatDateTime(verifiedAt),
      description: 'Vérification d’identité confirmée via Didit.',
    });
  } else {
    events.push({
      id: 'identity-pending',
      title: 'Identité à confirmer',
      status: 'warning',
      time: formatDateTime(updatedAt),
      description: 'Le passeport reste en brouillon tant que l’identité n’est pas validée.',
    });
  }

  tenantBlocks.forEach((block) => {
    if (block.status === 'complete') {
      events.push({
        id: `block-${block.id}`,
        title: `${block.label} couvert`,
        status: 'success',
        time: formatDateTime(block.latestDocumentAt || updatedAt),
        description: `${block.certifiedCount} pièce(s) certifiée(s) alimentent ce pilier.`,
      });
    } else if (block.status === 'review') {
      events.push({
        id: `block-review-${block.id}`,
        title: `${block.label} en revue`,
        status: 'warning',
        time: formatDateTime(block.latestDocumentAt || updatedAt),
        description: 'Une pièce déposée demande encore une vérification humaine.',
      });
    }
  });

  if (guaranteeSummary.mode !== 'NONE') {
    events.push({
      id: 'guarantee',
      title: guaranteeSummary.label,
      status: guaranteeSummary.score > 0 ? 'success' : 'info',
      time: formatDateTime(updatedAt),
      description: guaranteeSummary.summary,
    });
  }

  events.push({
    id: 'passport-state',
    title: `Passeport ${stateMeta.label.toLowerCase()}`,
    status: state === 'draft' ? 'warning' : state === 'review' ? 'info' : 'sealed',
    time: formatDateTime(application?.submittedAt || updatedAt),
    description: state === 'sealed'
      ? 'Le passeport a été transmis et scellé.'
      : state === 'ready'
        ? 'Le passeport peut être partagé.'
        : state === 'review'
          ? 'Le passeport est généré, mais quelques éléments restent en revue.'
          : 'Le passeport reste en préparation.',
  });

  return events;
}

function buildPassportSummary(state, displayName, reasons) {
  if (state === 'sealed') {
    return `${displayName} dispose d’un passeport scellé, prêt à être transmis et vérifié.`;
  }
  if (state === 'ready') {
    return `${displayName} peut partager son passeport dès maintenant.`;
  }
  if (state === 'review') {
    return `${displayName} dispose d’un dossier solide, avec encore quelques éléments secondaires à confirmer.`;
  }
  return `${displayName} doit encore compléter des pièces essentielles avant de partager son passeport.`;
}

function buildPassportViewModel({
  application,
  audience = 'candidate',
  baseUrl = '',
  slug,
} = {}) {
  const app = application || {};
  const profile = app.profile || {};
  const didit = app.didit || {};
  const patrimometer = app.patrimometer || {};
  const breakdown = patrimometer.breakdown || {};
  const breakdownTenant = breakdown.tenant || {};
  const chapterStates = patrimometer.chapterStates || {};
  const guaranteeState = chapterStates.guarantee || {};
  const guarantee = app.guarantee || {};
  const documents = safeArray(app.documents);
  const tenantDocuments = getTenantDocuments(documents);
  const property = getPropertyData(app);
  const rentAmount = Number(property.rentAmount || 0);
  const monthlyIncome = Number(app.financialSummary?.totalMonthlyIncome || 0);
  const effortRate = rentAmount > 0 && monthlyIncome > 0
    ? Number(((rentAmount / monthlyIncome) * 100).toFixed(1))
    : null;
  const readySlug = slug || ensurePassportSlug(app);
  const urls = {
    previewUrl: readySlug ? `${getBaseUrl(baseUrl)}/p/${readySlug}?preview=1` : null,
    shareUrl: readySlug ? `${getBaseUrl(baseUrl)}/p/${readySlug}` : null,
    downloadUrl: app?._id ? `${getBaseUrl(baseUrl)}/api/passport/pdf/${app._id}` : null,
    verificationUrl: readySlug ? `${getBaseUrl(baseUrl)}/p/${readySlug}` : null,
  };

  const guaranteeRequirement = guaranteeState.requirement || 'optional';
  const guaranteeSatisfied = guaranteeState.satisfied !== false;
  const identity = buildMaskedIdentity(profile, didit, audience);

  const blockDocs = BLOCKS.reduce((acc, block) => {
    acc[block.id] = tenantDocuments.filter((doc) => block.matches(inferEvidenceKind(doc)));
    return acc;
  }, {});

  const tenantBlocks = buildBlockSummaries(blockDocs, breakdownTenant, didit.status, tenantDocuments);
  const guaranteeSummary = getGuaranteeSummary(guarantee, guaranteeState);

  const readinessBlockers = [];
  const reviewReasons = [];

  tenantBlocks.forEach((block) => {
    if (block.primaryRejected) {
      readinessBlockers.push(`${block.label}: la pièce principale a été rejetée ou est illisible.`);
      return;
    }
    if (!block.covered) {
      readinessBlockers.push(`${block.label}: bloc à compléter avant partage.`);
      return;
    }
    if (block.primaryReviewOnly) {
      readinessBlockers.push(`${block.label}: une pièce en revue ne peut pas être l’unique justificatif.`);
      return;
    }
    if (block.reviewCount > 0) {
      reviewReasons.push(`${block.label}: une pièce secondaire reste en revue.`);
    }
  });

  if (guaranteeRequirement === 'required' && !guaranteeSatisfied) {
    readinessBlockers.push('Garantie: une garantie valide est requise pour ce dossier.');
  } else if (guaranteeRequirement === 'recommended' && guaranteeSummary.mode === 'NONE') {
    reviewReasons.push('Garantie: une Visale ou un garant renforcerait nettement ce dossier.');
  }

  const scoreWarnings = safeArray(patrimometer.warnings)
    .filter(Boolean)
    .filter((warning) => !readinessBlockers.includes(warning));
  scoreWarnings.slice(0, 3).forEach((warning) => {
    if (!reviewReasons.includes(warning)) {
      reviewReasons.push(warning);
    }
  });

  const assetReady = Boolean(urls.previewUrl && urls.downloadUrl && urls.shareUrl);
  if (!assetReady) {
    readinessBlockers.push('Les supports de partage ne sont pas encore générés.');
  }

  let state = 'ready';
  if (['SUBMITTED', 'ACCEPTED', 'REJECTED'].includes(String(app.status || '').toUpperCase())) {
    state = 'sealed';
  } else if (readinessBlockers.length > 0) {
    state = 'draft';
  } else if (reviewReasons.length > 0) {
    state = 'review';
  }

  const stateMeta = PASSPORT_STATE_META[state] || PASSPORT_STATE_META.draft;
  const grade = patrimometer.grade || 'F';
  const score = clamp(round(patrimometer.score || 0), 0, 100);
  const shareEnabled = state === 'ready' || state === 'sealed';
  const publicIncome = audience === 'public'
    ? roundToNearestHundred(monthlyIncome)
    : monthlyIncome;

  const counts = {
    totalDocuments: documents.length,
    tenantDocuments: tenantDocuments.length,
    certifiedDocuments: documents.filter(isCertified).length,
    reviewDocuments: documents.filter(isReview).length,
    rejectedDocuments: documents.filter(isRejected).length,
    viewCount: Number(app.passportViewCount || 0),
    shareCount: Number(app.passportShareCount || 0),
  };

  const displayProfession = inferProfession(profile.status, breakdownTenant);
  const summary = buildPassportSummary(state, identity.displayName, state === 'draft' ? readinessBlockers : reviewReasons);
  const readinessReasons = state === 'draft' ? readinessBlockers : state === 'review' ? reviewReasons : [];
  const generatedAt = formatDate(app.updatedAt || app.createdAt || new Date());
  const validUntil = parseDate(app.updatedAt || app.createdAt)
    ? new Date(new Date(app.updatedAt || app.createdAt).getTime() + 1000 * 60 * 60 * 24 * 90).toLocaleDateString('fr-FR')
    : null;

  return {
    id: app?._id ? String(app._id) : null,
    slug: readySlug,
    state,
    stateLabel: stateMeta.label,
    stateShortLabel: stateMeta.shortLabel,
    stateMeta,
    shareEnabled,
    previewUrl: urls.previewUrl,
    shareUrl: urls.shareUrl,
    downloadUrl: urls.downloadUrl,
    verificationUrl: urls.verificationUrl,
    score,
    grade,
    summary,
    readinessReasons,
    warnings: scoreWarnings,
    nextAction: patrimometer.nextAction?.action || null,
    hero: {
      name: identity.displayName,
      fullName: identity.fullName,
      profession: displayProfession,
      region: audience === 'public' ? deriveRegion(property) : property.address || 'Région non précisée',
      propertyName: property.name || '',
      gradeLabel: grade === 'SOUVERAIN' ? 'Souverain' : `Grade ${grade}`,
      badge: guaranteeSummary.shareBadge,
      candidateStatus: profile.status || null,
      identityVerified: didit.status === 'VERIFIED',
    },
    solvency: {
      monthlyIncome: publicIncome || 0,
      exactMonthlyIncome: monthlyIncome || 0,
      monthlyIncomeLabel: formatCurrency(publicIncome || monthlyIncome),
      exactMonthlyIncomeLabel: formatCurrency(monthlyIncome),
      rentAmount,
      rentAmountLabel: formatCurrency(rentAmount),
      effortRate,
      effortRateLabel: effortRate != null ? `${effortRate.toFixed(1)}%` : null,
      certifiedIncome: Boolean(app.financialSummary?.certifiedIncome),
    },
    guarantee: {
      ...guaranteeSummary,
      requirement: guaranteeRequirement,
      satisfied: guaranteeSatisfied,
    },
    pillars: tenantBlocks.map((block) => ({
      id: block.id,
      label: block.label,
      score: block.score,
      max: block.max,
      verified: block.covered,
      status: block.status,
      summary: block.summary,
      certifiedCount: block.certifiedCount,
      reviewCount: block.reviewCount,
      rejectedCount: block.rejectedCount,
    })),
    documentCoverage: {
      counts,
      blocks: tenantBlocks.map((block) => ({
        id: block.id,
        label: block.label,
        status: block.status,
        certifiedCount: block.certifiedCount,
        reviewCount: block.reviewCount,
        rejectedCount: block.rejectedCount,
        totalCount: block.docCount,
        latestDocumentAt: formatDate(block.latestDocumentAt),
      })),
    },
    auditTimeline: buildAuditTimeline({
      application: app,
      state,
      stateMeta,
      tenantBlocks,
      guaranteeSummary,
      documents,
    }),
    metrics: {
      viewCount: counts.viewCount,
      shareCount: counts.shareCount,
      passportId: buildPassportId(app?._id),
      generatedAt,
      validUntil,
      certificationDate: formatDate(app.submittedAt || app.updatedAt || new Date()),
    },
  };
}

module.exports = {
  PASSPORT_STATE_META,
  buildPassportSlug,
  ensurePassportSlug,
  buildPassportViewModel,
};
