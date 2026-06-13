const crypto = require('crypto');
const { inferEvidenceKind } = require('./applicationScoring');
const { resolveResilienceScore } = require('./resilienceScore');
const { deriveApplicationFinancialProfile } = require('./financialExtraction');

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

/**
 * Append UTM (or arbitrary query) params to an absolute URL without losing
 * existing query strings. Returns null if input URL is falsy.
 * Used by the Passeport Locatif PDF to track acquisition channels from CTAs.
 */
function appendUtm(url, params) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        parsed.searchParams.set(key, String(value));
      }
    });
    return parsed.toString();
  } catch (err) {
    // URL relative ou mal formée — on retourne tel quel
    return url;
  }
}

/**
 * Construit le bloc `marketing` exposé dans le ViewModel pour le PDF.
 * Contient les URLs absolues + UTM pour les CTAs marketing du Passeport Locatif :
 *  - ownerSignupUrl : "Créer mon Coffre-Fort gratuit" → /auth/register?role=owner
 *  - verifyUrl      : "Vérifier ce passeport en ligne" → /p/{slug}
 *  - requestAuditUrl: "Auditer un dossier" → /owner/request-audit
 *  - homepage       : fallback marque
 *
 * Tous les liens sont taggés `utm_source=passport_pdf` pour analytics.
 */
function buildMarketingLinks({ baseUrl, slug, shareUrl, candidateFirstName, propertyName }) {
  const base = getBaseUrl(baseUrl) || 'https://maisonpatrimo.com';
  const utmBase = {
    utm_source: 'passport_pdf',
    utm_medium: 'pdf',
    utm_content: slug || 'passport',
  };

  return {
    ownerSignupUrl: appendUtm(`${base}/auth/register?role=owner`, {
      ...utmBase,
      utm_campaign: 'owner_acq',
    }),
    verifyUrl: shareUrl
      ? appendUtm(shareUrl, { ...utmBase, utm_campaign: 'verify' })
      : null,
    requestAuditUrl: appendUtm(`${base}/owner/request-audit`, {
      ...utmBase,
      utm_campaign: 'audit_request',
    }),
    homepageUrl: appendUtm(`${base}/`, { ...utmBase, utm_campaign: 'brand' }),
    candidateFirstName: candidateFirstName || null,
    propertyName: propertyName || null,
  };
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
  const suffix = crypto.randomBytes(8).toString('hex'); // 64 bits — anti-énumération du slug public
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
  if (!doc) return 'PENDING';
  if (doc.flagged) return 'NEEDS_REVIEW';
  return doc.status || 'PENDING';
}

function isCertified(doc) {
  return getDocStatus(doc) === 'CERTIFIED' && !doc.flagged;
}

function isReview(doc) {
  return getDocStatus(doc) === 'NEEDS_REVIEW';
}

function isRejected(doc) {
  const status = getDocStatus(doc);
  return status === 'REJECTED' || status === 'ILLEGIBLE';
}

function getDocumentSubject(doc) {
  const subjectType = String(doc?.subjectType || '').toUpperCase();
  const category = String(doc?.category || '').toUpperCase();
  const type = String(doc?.type || '').toUpperCase();

  if (subjectType === 'GUARANTOR' || category === 'GUARANTOR' || type === 'GUARANTOR') {
    return {
      subjectType: 'guarantor',
      subjectSlot: doc?.subjectSlot === 2 ? 2 : 1,
    };
  }
  if (subjectType === 'VISALE' || category === 'VISALE' || type === 'VISALE' || inferEvidenceKind(doc) === 'visale') {
    return { subjectType: 'visale' };
  }
  return { subjectType: 'tenant' };
}

function getTenantDocuments(documents) {
  return safeArray(documents).filter((doc) => getDocumentSubject(doc).subjectType === 'tenant');
}

function getPrimaryTenantDocuments(documents) {
  return getTenantDocuments(documents).filter((doc) => {
    const slot = Number(doc?.subjectSlot || 1);
    return !Number.isFinite(slot) || slot <= 1;
  });
}

function getDocumentRawId(doc) {
  const raw = doc?.id || doc?._id;
  return raw ? String(raw).trim() : '';
}

function isUsableDocumentId(id) {
  return /^[A-Za-z0-9_-]{3,80}$/.test(String(id || ''));
}

function getDocumentLinkLabel(doc) {
  const aiType = doc?.aiAnalysis?.documentType;
  if (typeof aiType === 'string' && aiType.trim()) return aiType.trim();
  if (doc?.fileName) return String(doc.fileName);
  if (doc?.type) return String(doc.type);
  return 'Document vérifié';
}

function mapDocumentAuditStatus(doc) {
  const status = String(getDocStatus(doc) || '').toUpperCase();
  if (status === 'CERTIFIED' && !doc?.flagged) return 'verified';
  if (status === 'REJECTED' || status === 'ILLEGIBLE') return 'altered';
  if (status === 'NEEDS_REVIEW' || status === 'FLAGGED' || doc?.flagged) return 'manual_review';
  return 'pending';
}

function buildDocumentLinks({ documents, baseUrl, slug }) {
  const base = getBaseUrl(baseUrl);
  if (!base || !slug) return [];

  const primaryDocuments = getPrimaryTenantDocuments(documents);
  const idCounts = primaryDocuments.reduce((acc, doc) => {
    const rawId = getDocumentRawId(doc);
    if (rawId) acc[rawId] = (acc[rawId] || 0) + 1;
    return acc;
  }, {});

  return primaryDocuments
    .map((doc, index) => {
      const rawId = getDocumentRawId(doc);
      const id = isUsableDocumentId(rawId) && idCounts[rawId] === 1
        ? rawId
        : `doc-${index + 1}`;
      return {
        id,
        label: getDocumentLinkLabel(doc),
        category: doc?.category || null,
        type: doc?.type || null,
        fileName: doc?.fileName || null,
        auditStatus: mapDocumentAuditStatus(doc),
        url: `${base}/dossier/${encodeURIComponent(slug)}/document/${encodeURIComponent(id)}`,
      };
    })
    .filter(Boolean);
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

// Masque un nom complet « Prénom Nom » → « Prénom N. ». Sécurité (audit passe-5) :
// l'identité d'un TIERS (garant) ne doit pas fuiter en clair à l'audience publique.
function maskNameToInitial(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0];
  const lastInitial = parts.length > 1 ? `${parts[parts.length - 1].charAt(0).toUpperCase()}.` : '';
  return [first, lastInitial].filter(Boolean).join(' ').trim();
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
  // Passeport universel (sans bien) : on substitue au taux d'effort un "loyer
  // éligible" = revenus / 3,03 (inverse du seuil PLATINUM, taux d'effort ~33%).
  const isUniversalPassport = rentAmount === 0;
  const eligibleRent = isUniversalPassport && monthlyIncome > 0
    ? Math.floor(monthlyIncome / 3.03)
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

  // ── Garant : NOM réel (collection Guarantor populée via app.guarantor.guarantorId)
  // + REVENUS dérivés de ses pièces. Tout est gracieux (null si indisponible). ──
  const populatedGuarantor =
    app.guarantor && app.guarantor.guarantorId && typeof app.guarantor.guarantorId === 'object'
      ? app.guarantor.guarantorId
      : null;
  const guarantorRealName = populatedGuarantor
    ? `${(populatedGuarantor.identityVerification && populatedGuarantor.identityVerification.firstName) || populatedGuarantor.firstName || ''} ${(populatedGuarantor.identityVerification && populatedGuarantor.identityVerification.lastName) || populatedGuarantor.lastName || ''}`.trim()
    : '';
  // Revenus du garant : dérivés de ses pièces (subjectType GUARANTOR). On neutralise
  // subjectType car deriveApplicationFinancialProfile ne compte que les pièces locataire.
  let guarantorMonthlyIncome = 0;
  const guarantorIncomeDocs = documents
    .filter(
      (d) =>
        String((d && d.subjectType) || '').toUpperCase() === 'GUARANTOR' ||
        String((d && d.category) || '').toUpperCase() === 'GUARANTOR',
    )
    .map((d) => ({ ...(d && d.toObject ? d.toObject() : d), subjectType: undefined, category: undefined }));
  if (guarantorIncomeDocs.length) {
    try {
      const prof = deriveApplicationFinancialProfile({ application: { documents: guarantorIncomeDocs } });
      guarantorMonthlyIncome = Number((prof && prof.totalMonthlyIncome) || 0);
    } catch (_e) {
      guarantorMonthlyIncome = 0;
    }
  }

  // ── Employeur : meilleure source disponible dans les pièces OCR du locataire
  // (extra_details / extractedData / metadata) ou l'analyse V2. Gracieux (vide si
  // l'OCR ne l'a pas capturé → la ligne Employeur est masquée dans le PDF). ──
  const tenantEmployer = (() => {
    for (const d of documents) {
      const ai = (d && d.aiAnalysis) || {};
      const ed = (ai.financial_data && ai.financial_data.extra_details) || {};
      const ex = ai.extractedData || ai.extracted_data || {};
      const meta = ai.document_metadata || {};
      const v =
        ed.employeur || ed.employer_name || ed.companyName ||
        ex.employerName || ex.employer_name || ex.employeur || ex.companyName ||
        meta.employer || meta.employeur;
      if (v && String(v).trim()) return String(v).trim();
    }
    const v2 = app.aiAuditV2 && app.aiAuditV2.ai && app.aiAuditV2.ai.candidate && app.aiAuditV2.ai.candidate.employer;
    return v2 && String(v2).trim() ? String(v2).trim() : '';
  })();

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
  const resilience = resolveResilienceScore(app);
  const grade = resilience.level;
  const score = resilience.score;
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

  // Colocation — composition du foyer pour le passeport (mono → household null).
  const coTenantsRaw = safeArray(app.coTenants);
  const isColocation = Boolean(app.isColocation) && coTenantsRaw.length > 0;
  const household = isColocation
    ? {
        isColocation: true,
        size: 1 + coTenantsRaw.length,
        label: `${identity.displayName} + ${coTenantsRaw.length} ${
          coTenantsRaw.length > 1 ? 'colocataires' : 'colocataire'
        }`,
        certifiedCount:
          (didit.status === 'VERIFIED' ? 1 : 0) +
          coTenantsRaw.filter((c) => c.status === 'CERTIFIED' || c.didit?.status === 'VERIFIED')
            .length,
        members: [
          {
            slot: 1,
            name: identity.displayName,
            profile: profile.status || null,
            identityVerified: didit.status === 'VERIFIED',
            isPrimary: true,
          },
          ...coTenantsRaw.map((c) => ({
            slot: Number(c.slot) || 2,
            name: c.firstName
              ? `${c.firstName} ${(c.lastName || '').charAt(0)}${c.lastName ? '.' : ''}`.trim()
              : `Colocataire ${Number(c.slot) || 2}`,
            profile: c.profile || null,
            identityVerified: c.status === 'CERTIFIED' || c.didit?.status === 'VERIFIED',
            isPrimary: false,
          })),
        ],
      }
    : null;

  return {
    id: app?._id ? String(app._id) : null,
    slug: readySlug,
    passportSlug: readySlug,
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
    resilience,
    summary,
    readinessReasons,
    warnings: scoreWarnings,
    nextAction: patrimometer.nextAction?.action || null,
    // Mot du locataire — présentation libre (optionnel), affichée en en-tête du passeport.
    presentationText: String(profile.presentationText || '').slice(0, 500),
    household,
    householdLabel: household ? household.label : identity.displayName,
    hero: {
      name: identity.displayName,
      fullName: identity.fullName,
      profession: displayProfession,
      region: audience === 'public' ? deriveRegion(property) : property.address || 'Région non précisée',
      propertyName: property.name || '',
      gradeLabel: resilience.label,
      badge: guaranteeSummary.shareBadge,
      candidateStatus: profile.status || null,
      // Sécurité (audit passe-5) : l'employeur n'est pas exposé à l'audience publique
      // (lien de passeport partageable/transférable → fuite hors destinataire voulu).
      employer: audience === 'public' ? null : (tenantEmployer || null),
      identityVerified: didit.status === 'VERIFIED',
    },
    solvency: {
      // Sécurité (pentest public-6/access-5) : l'audience PUBLIQUE ne reçoit que le revenu
      // ARRONDI — les champs exacts sont omis (ils fuitaient le revenu mensuel précis du
      // candidat sans authentification).
      monthlyIncome: publicIncome || 0,
      monthlyIncomeLabel: formatCurrency((audience === 'public' ? publicIncome : monthlyIncome) || 0),
      ...(audience !== 'public' ? {
        exactMonthlyIncome: monthlyIncome || 0,
        exactMonthlyIncomeLabel: formatCurrency(monthlyIncome),
      } : {}),
      rentAmount,
      rentAmountLabel: formatCurrency(rentAmount),
      effortRate,
      effortRateLabel: effortRate != null ? `${effortRate.toFixed(1)}%` : null,
      universal: isUniversalPassport,
      eligibleRent,
      eligibleRentLabel: eligibleRent != null ? formatCurrency(eligibleRent) : null,
      certifiedIncome: Boolean(app.financialSummary?.certifiedIncome),
    },
    guarantee: {
      ...guaranteeSummary,
      requirement: guaranteeRequirement,
      satisfied: guaranteeSatisfied,
      // Enrichissements pour la Synthèse Exécutive du passeport (colonne Caution) :
      // type lisible + nom/revenus du garant si disponibles (sinon null → rendu gracieux).
      typeLabel:
        guaranteeSummary.mode === 'VISALE'
          ? 'Visale'
          : guaranteeSummary.mode === 'PHYSICAL'
            ? 'Garant physique'
            : 'Aucune',
      // Sécurité (audit passe-5, HIGH) : le NOM RÉEL du garant est une PII de TIERS — masqué
      // en « Prénom N. » pour l'audience publique (jamais en clair sans authentification).
      guarantorName:
        (audience === 'public' ? maskNameToInitial(guarantorRealName) : guarantorRealName) ||
        (guaranteeSummary.mode === 'VISALE'
          ? 'Organisme Visale (Action Logement)'
          : guaranteeSummary.guarantors[0]
            ? `Garant ${guaranteeSummary.guarantors[0].profile || ''}`.trim()
            : null),
      // Revenus du garant (PII financière de tiers) : omis pour l'audience publique.
      guarantorIncomeLabel:
        audience !== 'public' && guarantorMonthlyIncome > 0 ? formatCurrency(guarantorMonthlyIncome) : null,
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
    documentLinks: buildDocumentLinks({
      documents,
      baseUrl,
      slug: readySlug,
    }),
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
    // Liens marketing tagués UTM pour les CTAs du PDF (acquisition propriétaire,
    // vérification web, demande d'audit ponctuel). Voir buildMarketingLinks().
    marketing: buildMarketingLinks({
      baseUrl,
      slug: readySlug,
      shareUrl: urls.shareUrl,
      candidateFirstName: identity.firstName,
      propertyName: property.name || null,
    }),
    // V6.5 — Audit neuro-symbolique persisté (cf. Application.aiAuditV2).
    // Optionnel : présent seulement si l'analyse V2 a déjà été lancée.
    // Le PDF utilise ces données pour la section anti-fraude enrichie et
    // le badge métal du hero.
    // Sécurité (audit passe-5) : l'audience PUBLIQUE ne reçoit qu'un SOUS-ENSEMBLE curaté
    // (badge `resilience.level` + Trust-List `ai.forensicAudit` conçus pour l'affichage) —
    // jamais l'objet d'analyse interne complet (revenus bruts, raisonnement, PII détaillée).
    aiAuditV2:
      audience === 'public'
        ? (app.aiAuditV2
            ? {
                resilience: app.aiAuditV2.resilience
                  ? { level: app.aiAuditV2.resilience.level }
                  : undefined,
                ai:
                  app.aiAuditV2.ai && Array.isArray(app.aiAuditV2.ai.forensicAudit)
                    ? { forensicAudit: app.aiAuditV2.ai.forensicAudit }
                    : undefined,
              }
            : null)
        : (app.aiAuditV2 || null),
  };
}

module.exports = {
  PASSPORT_STATE_META,
  buildPassportSlug,
  ensurePassportSlug,
  buildPassportViewModel,
  appendUtm,
  buildMarketingLinks,
};
