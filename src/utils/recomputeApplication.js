const { computeApplicationPatrimometer } = require('./applicationScoring');
const { deriveApplicationFinancialProfile } = require('./financialExtraction');
const { buildPassportViewModel } = require('./passportViewModel');

/**
 * Recalcule solvabilité + PatrimoMeter + état passeport d'une Application À PARTIR
 * DE SON ÉTAT COURANT (documents, didit, coTenants, guarantee…), sans dépendre des
 * `data` du tunnel. Mute l'application EN PLACE ; l'appelant se charge du save().
 *
 * Miroir fidèle de la section de recalcul de saveApplicationProgress (lecture
 * depuis `application` au lieu de `data`). Réutilisé par le webhook colocataire :
 * quand un colocataire certifie son identité, on rejoue ce calcul pour refléter
 * le nouveau score du foyer (ce que le flux garant ne faisait jamais).
 *
 * @param {object} application - document Mongoose Application (muté en place)
 * @param {object} opts - { propertyRentAmount?: number, fallbackIncome?: number }
 * @returns {{score:number, grade:string, progress:number, passportState:string}}
 */
function recomputeApplicationScore(application, { propertyRentAmount = 0, fallbackIncome = 0 } = {}) {
  const rent = Number(propertyRentAmount) || 0;

  const derivedFinancialSummary = deriveApplicationFinancialProfile({
    application: {
      ...application.toObject(),
      documents: application.documents,
      financialSummary: application.financialSummary,
    },
    fallbackIncome,
  });
  application.financialSummary.totalMonthlyIncome = derivedFinancialSummary.totalMonthlyIncome;
  application.financialSummary.certifiedIncome = derivedFinancialSummary.certifiedIncome;
  application.financialSummary.incomeSource = derivedFinancialSummary.incomeSource;
  application.financialSummary.perSlot = derivedFinancialSummary.perSlot || [];

  const computedPatrimometer = computeApplicationPatrimometer({
    candidateStatus: application.profile && application.profile.status,
    diditStatus: application.didit && application.didit.status,
    propertyRentAmount: rent,
    detectedIncome: derivedFinancialSummary.totalMonthlyIncome,
    documents: application.documents,
    coTenants: application.coTenants,
    guarantee: application.guarantee || null,
    legacyGuarantor: {
      hasGuarantor: application.guarantor && application.guarantor.hasGuarantor,
      status: application.guarantor && application.guarantor.status,
      certificationMethod: application.guarantor && application.guarantor.certificationMethod,
    },
  });

  application.patrimometer.score = computedPatrimometer.score;
  application.patrimometer.breakdown = computedPatrimometer.breakdown;
  application.patrimometer.warnings = computedPatrimometer.warnings;
  application.patrimometer.nextAction = computedPatrimometer.nextAction;
  application.patrimometer.chapterStates = computedPatrimometer.chapterStates;
  application.patrimometer.grade = application.calculateGrade();
  application.patrimometer.lastCalculatedAt = new Date();

  if (computedPatrimometer.guarantee) {
    application.guarantee = computedPatrimometer.guarantee;
  }
  const legacyGuarantor = computedPatrimometer.legacyGuarantor || null;
  if (legacyGuarantor) {
    application.guarantor.hasGuarantor = Boolean(legacyGuarantor.hasGuarantor);
    application.guarantor.status = legacyGuarantor.status || 'NONE';
    if (legacyGuarantor.certificationMethod) {
      application.guarantor.certificationMethod = legacyGuarantor.certificationMethod;
    }
  }

  application.tunnel.lastActiveAt = new Date();
  application.tunnel.chapterStates = computedPatrimometer.chapterStates;

  const passportBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://getpatrimo.com';
  const passportView = buildPassportViewModel({
    application: {
      _id: application._id,
      status: application.status,
      profile: application.profile,
      didit: application.didit,
      documents: application.documents,
      coTenants: application.coTenants,
      guarantee: application.guarantee || computedPatrimometer.guarantee,
      financialSummary: application.financialSummary,
      passportSlug: application.passportSlug,
      passportViewCount: application.passportViewCount,
      passportShareCount: application.passportShareCount,
      property: { rentAmount: rent },
      patrimometer: {
        score: computedPatrimometer.score,
        grade: application.patrimometer.grade,
        breakdown: computedPatrimometer.breakdown,
        warnings: computedPatrimometer.warnings,
        nextAction: computedPatrimometer.nextAction,
        chapterStates: computedPatrimometer.chapterStates,
      },
      submittedAt: application.submittedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      aiAuditV2: application.aiAuditV2,
    },
    audience: 'candidate',
    baseUrl: passportBaseUrl,
  });

  const passportChapter = {
    state: passportView.state,
    ready: passportView.state === 'ready' || passportView.state === 'sealed',
    shareEnabled: passportView.shareEnabled,
  };
  application.patrimometer.chapterStates = {
    ...(application.patrimometer.chapterStates || {}),
    passport: { ...((application.patrimometer.chapterStates || {}).passport || {}), ...passportChapter },
  };
  application.tunnel.chapterStates = {
    ...(application.tunnel.chapterStates || {}),
    passport: { ...((application.tunnel.chapterStates || {}).passport || {}), ...passportChapter },
  };
  application.tunnel.progress = application.calculateProgress();

  if (application.tunnel.progress > 0 && application.status === 'DRAFT') {
    application.status = 'IN_PROGRESS';
  }
  // Ne JAMAIS rétrograder une candidature déjà soumise/acceptée/refusée.
  if (passportView.state === 'ready' && !['SUBMITTED', 'ACCEPTED', 'REJECTED'].includes(application.status)) {
    application.status = 'COMPLETE';
    application.tunnel.completedAt = new Date();
  }

  return {
    score: application.patrimometer.score,
    grade: application.patrimometer.grade,
    progress: application.tunnel.progress,
    passportState: passportView.state,
  };
}

module.exports = { recomputeApplicationScore };
