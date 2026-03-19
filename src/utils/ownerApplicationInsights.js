const { buildPassportViewModel } = require('./passportViewModel');
const { deriveLeaseType, computeSmartDeposit } = require('./leaseWizardShared');
const { deriveApplicationFinancialProfile } = require('./financialExtraction');

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(Number(value || 0));
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

function pickRiskBand({ effortRate, certifiedIncome, guarantee }) {
  const guaranteeMode = String(guarantee?.mode || 'NONE').toUpperCase();
  const guaranteeBoost = guaranteeMode === 'VISALE'
    ? -10
    : guaranteeMode === 'PHYSICAL' && Number(guarantee?.score || 0) >= 20
      ? -6
      : 0;
  const certificationPenalty = certifiedIncome ? 0 : 6;
  const effortPenalty = effortRate == null
    ? 35
    : effortRate <= 28
      ? 10
      : effortRate <= 33
        ? 22
        : effortRate <= 38
          ? 34
          : effortRate <= 45
            ? 52
            : 72;
  const score = clamp(round(effortPenalty + certificationPenalty + guaranteeBoost), 5, 95);

  if (score <= 20) {
    return { score, id: 'low', label: 'Faible', tone: 'emerald' };
  }
  if (score <= 40) {
    return { score, id: 'moderate', label: 'Maîtrisé', tone: 'blue' };
  }
  if (score <= 60) {
    return { score, id: 'elevated', label: 'A surveiller', tone: 'amber' };
  }
  return { score, id: 'high', label: 'Élevé', tone: 'rose' };
}

function pickQualityStatus(qualityScore) {
  if (qualityScore >= 85) {
    return { id: 'excellent', label: 'Dossier premium', tone: 'emerald' };
  }
  if (qualityScore >= 70) {
    return { id: 'solid', label: 'Dossier solide', tone: 'blue' };
  }
  if (qualityScore >= 50) {
    return { id: 'fragile', label: 'Dossier à consolider', tone: 'amber' };
  }
  return { id: 'weak', label: 'Dossier fragile', tone: 'rose' };
}

function dedupe(list) {
  return Array.from(new Set(safeArray(list).filter(Boolean)));
}

function boolLabel(value, truthyLabel, falsyLabel) {
  return value ? truthyLabel : falsyLabel;
}

function buildFinancialSummary({
  monthlyIncome,
  rentAmount,
  certifiedIncome,
  incomeSource,
  riskBand,
  guarantee,
  basisLabel,
  components,
}) {
  const remainingIncome = monthlyIncome > 0 ? Math.max(0, monthlyIncome - rentAmount) : null;
  const effortRate = monthlyIncome > 0 && rentAmount > 0
    ? Number(((rentAmount / monthlyIncome) * 100).toFixed(1))
    : null;
  const ratio = rentAmount > 0 ? Number((monthlyIncome / rentAmount).toFixed(2)) : null;
  const guaranteeMode = guarantee?.mode || 'NONE';

  const remainingLabel = formatCurrency(remainingIncome);
  const incomeLabel = formatCurrency(monthlyIncome);
  const rentLabel = formatCurrency(rentAmount);

  let summary = 'Aucun revenu déclaré pour l\'instant. Le candidat doit téléverser ses justificatifs de revenus pour que l\'audit financier puisse être complété.';
  if (monthlyIncome > 0 && effortRate != null) {
    if (riskBand.id === 'low') {
      summary = `Solvabilité confortable. Le revenu net de ${incomeLabel}/mois couvre largement le loyer de ${rentLabel} avec un taux d'effort de ${effortRate.toFixed(1)}% — bien en dessous du seuil de 33% recommandé par les bailleurs. Le reste à vivre s'établit à ${remainingLabel || '—'}.`;
    } else if (riskBand.id === 'moderate') {
      summary = `Profil financier équilibré. Le revenu de ${incomeLabel}/mois supporte un loyer de ${rentLabel} avec un taux d'effort de ${effortRate.toFixed(1)}%. Reste à vivre : ${remainingLabel || '—'}. Le ratio est dans les standards du marché locatif.`;
    } else if (riskBand.id === 'elevated') {
      summary = `Taux d'effort élevé à ${effortRate.toFixed(1)}%. Le revenu de ${incomeLabel}/mois absorbe une part importante du loyer (${rentLabel}). Reste à vivre : ${remainingLabel || '—'}. Un garant ou une garantie Visale est recommandé pour sécuriser le bail.`;
    } else {
      summary = `Taux d'effort critique à ${effortRate.toFixed(1)}%. Le loyer de ${rentLabel} représente une charge très lourde par rapport au revenu de ${incomeLabel}/mois. Reste à vivre : ${remainingLabel || '—'}. Vigilance maximale — ce profil comporte un risque d'impayé significatif.`;
    }
  }

  if (!certifiedIncome && monthlyIncome > 0) {
    summary += ' Attention : les revenus déclarés n\'ont pas encore été intégralement certifiés par nos algorithmes. Le candidat peut consolider son dossier en téléversant des bulletins de salaire récents.';
  }

  if (basisLabel && monthlyIncome > 0) {
    summary += ` Base de calcul retenue : ${basisLabel}.`;
  }

  if (components?.benefits > 0) {
    const benefitsLabel = formatCurrency(components.benefits);
    summary += ` Les aides mensuelles récurrentes ajoutées au calcul représentent ${benefitsLabel}.`;
  }

  if (guaranteeMode === 'VISALE') {
    summary += ' La garantie Visale (Action Logement) est active sur ce dossier, ce qui élimine le risque d\'impayé pour le bailleur.';
  } else if (guaranteeMode === 'PHYSICAL') {
    summary += ' Un garant physique est rattaché au dossier — ses revenus seront sollicités en cas de défaillance du locataire.';
  }

  return {
    monthlyIncome,
    monthlyIncomeLabel: formatCurrency(monthlyIncome),
    rentAmount,
    rentAmountLabel: formatCurrency(rentAmount),
    remainingIncome,
    remainingIncomeLabel: formatCurrency(remainingIncome),
    effortRate,
    effortRateLabel: effortRate != null ? `${effortRate.toFixed(1)}%` : null,
    incomeToRentRatio: ratio,
    certifiedIncome: Boolean(certifiedIncome),
    incomeSource: incomeSource || '',
    basisLabel: basisLabel || '',
    components: components || null,
    riskBand,
    summary,
  };
}

function buildDossierQuality(passport) {
  const pillars = safeArray(passport?.pillars);
  const counts = passport?.documentCoverage?.counts || {};
  const blocked = pillars.filter((pillar) => pillar.status === 'blocked');
  const missing = pillars.filter((pillar) => pillar.status === 'missing');
  const review = pillars.filter((pillar) => pillar.status === 'review');
  const complete = pillars.filter((pillar) => pillar.status === 'complete');

  const certifiedDocuments = Number(counts.certifiedDocuments || 0);
  const reviewDocuments = Number(counts.reviewDocuments || 0);
  const rejectedDocuments = Number(counts.rejectedDocuments || 0);
  const totalDocuments = Number(counts.totalDocuments || 0);

  const qualityScore = clamp(
    100
      - (blocked.length * 24)
      - (missing.length * 18)
      - (review.length * 8)
      - (rejectedDocuments * 10)
      - (reviewDocuments * 4)
      + (certifiedDocuments * 2),
    5,
    100
  );

  return {
    score: qualityScore,
    status: pickQualityStatus(qualityScore),
    certifiedDocuments,
    reviewDocuments,
    rejectedDocuments,
    totalDocuments,
    completedPillars: complete.length,
    missingCriticalBlocks: [...blocked, ...missing].map((pillar) => pillar.label),
    reviewBlocks: review.map((pillar) => pillar.label),
    summary: blocked.length > 0
      ? `Pièces critiques bloquées sur ${blocked.map((pillar) => pillar.label).join(', ')}. Ces éléments doivent être corrigés ou re-téléversés par le candidat avant que le dossier puisse être considéré comme complet. ${certifiedDocuments} pièce${certifiedDocuments > 1 ? 's' : ''} certifiée${certifiedDocuments > 1 ? 's' : ''} sur ${totalDocuments} au total.`
      : missing.length > 0
        ? `Les blocs suivants sont encore incomplets : ${missing.map((pillar) => pillar.label).join(', ')}. Le candidat doit compléter ces sections pour atteindre le seuil de contractualisation. ${certifiedDocuments}/${totalDocuments} pièces déjà validées.`
        : review.length > 0
          ? `Le dossier est quasi-complet. ${review.length} vérification${review.length > 1 ? 's' : ''} humaine${review.length > 1 ? 's' : ''} reste${review.length > 1 ? 'nt' : ''} en cours sur : ${review.map((pillar) => pillar.label).join(', ')}. ${certifiedDocuments}/${totalDocuments} pièces certifiées par l'algorithme.`
          : `Couverture documentaire complète et cohérente. ${certifiedDocuments} pièce${certifiedDocuments > 1 ? 's' : ''} certifiée${certifiedDocuments > 1 ? 's' : ''} sur ${totalDocuments} analysées — aucun bloc critique détecté.`,
  };
}

function buildContractReadiness({
  application,
  property,
  passport,
  financial,
  quality,
}) {
  const blockers = [];
  const warnings = [];
  const diditVerified = String(application?.didit?.status || '').toUpperCase() === 'VERIFIED';

  if (!diditVerified) {
    blockers.push("L'identité du locataire n'est pas vérifiée.");
  }

  safeArray(passport?.pillars).forEach((pillar) => {
    if (pillar.status === 'blocked' || pillar.status === 'missing') {
      blockers.push(`${pillar.label}: bloc incomplet pour la contractualisation.`);
    } else if (pillar.status === 'review') {
      warnings.push(`${pillar.label}: une pièce reste en revue avant signature.`);
    }
  });

  if (passport?.guarantee?.requirement === 'required' && passport?.guarantee?.satisfied === false) {
    blockers.push('Une garantie valide est requise avant de générer le bail.');
  } else if (passport?.guarantee?.requirement === 'recommended' && passport?.guarantee?.mode === 'NONE') {
    warnings.push('Une garantie complémentaire renforcerait la contractualisation.');
  }

  if (financial.effortRate != null && financial.effortRate > 45) {
    blockers.push("Le taux d'effort dépasse 45%.");
  } else if (financial.effortRate != null && financial.effortRate > 35) {
    warnings.push("Le taux d'effort est supérieur à 35%.");
  }

  if (quality.reviewDocuments > 0 && blockers.length === 0) {
    warnings.push('Le dossier est exploitable, mais une revue humaine finale reste recommandée.');
  }

  const leaseType = deriveLeaseType(property || {}, null);
  const suggestedDeposit = computeSmartDeposit(leaseType, Number(property?.rentAmount || 0));
  const guaranteeMode = passport?.guarantee?.mode || 'NONE';
  const primaryGuarantor = safeArray(application?.guarantee?.guarantors).find((slot) => slot?.slot === 1)
    || safeArray(application?.guarantee?.guarantors)[0]
    || null;
  const hasGuaranteeDocument = guaranteeMode === 'PHYSICAL' && Boolean(
    primaryGuarantor?.firstName || primaryGuarantor?.lastName || primaryGuarantor?.email
  );

  return {
    ready: blockers.length === 0,
    blockers: dedupe(blockers),
    warnings: dedupe(warnings),
    leaseType,
    suggestedDeposit,
    suggestedDepositLabel: formatCurrency(suggestedDeposit),
    hasGuaranteeDocument,
    guaranteeMode,
    signerRoles: hasGuaranteeDocument ? ['tenant', 'guarantor', 'owner'] : ['tenant', 'owner'],
  };
}

function buildAuditSummary({ application, passport, financial, quality, contractReadiness }) {
  const diditVerified = String(application?.didit?.status || '').toUpperCase() === 'VERIFIED';
  const hasCriticalIssue = contractReadiness.blockers.length > 0 || quality.missingCriticalBlocks.length > 0;
  const hasReview = passport?.state === 'review' || quality.reviewDocuments > 0 || contractReadiness.warnings.length > 0;

  const status = hasCriticalIssue ? 'ALERT' : hasReview ? 'REVIEW' : 'CLEAR';
  const score = clamp(
    quality.score - round(financial.riskBand.score * 0.45) + (diditVerified ? 8 : -12),
    0,
    100
  );

  const highlights = [];
  if (diditVerified) {
    highlights.push("Identité vérifiée via Didit.");
  } else {
    highlights.push("Identité non vérifiée, le dossier reste fragile.");
  }

  if (financial.summary) {
    highlights.push(financial.summary);
  }

  if (passport?.guarantee?.mode === 'VISALE') {
    highlights.push('Garantie Visale détectée dans le dossier.');
  } else if (passport?.guarantee?.mode === 'PHYSICAL') {
    highlights.push('Garant physique rattaché au dossier.');
  } else {
    highlights.push('Aucune garantie externe rattachée au dossier.');
  }

  if (quality.summary) {
    highlights.push(quality.summary);
  }

  const firstName = application?.profile?.firstName || '';
  const incomeLabel = financial.monthlyIncomeLabel || '';
  const effortLabel = financial.effortRateLabel || '';
  const remainLabel = financial.remainingIncomeLabel || '';
  const rentLabel = financial.rentAmountLabel || '';
  const grade = application?.patrimometer?.grade || '';
  const patrimoScore = round(application?.patrimometer?.score || 0);
  const guaranteeMode = String(passport?.guarantee?.mode || 'NONE').toUpperCase();
  const qualityLabel = quality.status?.label || '';
  const certDocs = quality.certifiedDocuments || 0;
  const totalDocs = quality.totalDocuments || 0;
  const incomeSource = String(financial.incomeSource || '').toLowerCase();

  const summaryParts = [];

  if (status === 'CLEAR') {
    summaryParts.push(`L'audit automatisé ne révèle aucun blocage sur ce profil${firstName ? ` (${firstName})` : ''}.`);
    if (incomeLabel && effortLabel) {
      summaryParts.push(`Le revenu net déclaré s'élève à ${incomeLabel}/mois pour un loyer de ${rentLabel}, soit un taux d'effort de ${effortLabel} — ${financial.riskBand.id === 'low' ? 'largement en dessous du seuil critique de 33%' : financial.riskBand.id === 'moderate' ? 'dans la zone d\'équilibre standard' : 'à surveiller sur la durée du bail'}.`);
    }
    if (remainLabel) {
      summaryParts.push(`Le reste à vivre après loyer est de ${remainLabel}, ce qui ${financial.remainingIncome >= 1200 ? 'offre une marge de sécurité confortable' : financial.remainingIncome >= 800 ? 'reste dans une zone acceptable' : 'laisse peu de marge en cas d\'imprévu'}.`);
    }
    if (diditVerified) {
      summaryParts.push('L\'identité a été vérifiée par notre partenaire Didit (contrôle biométrique + pièce d\'identité).');
    }
    if (certDocs > 0) {
      summaryParts.push(`${certDocs} pièce${certDocs > 1 ? 's' : ''} sur ${totalDocs} certifiée${certDocs > 1 ? 's' : ''} par l'algorithme de détection documentaire.`);
    }
    if (guaranteeMode === 'VISALE') {
      summaryParts.push('Le dispositif Visale couvre les risques d\'impayés — votre exposition locative est quasi-nulle.');
    } else if (guaranteeMode === 'PHYSICAL') {
      summaryParts.push('Un garant physique est rattaché au dossier, ce qui renforce la sécurité contractuelle.');
    }
    if (grade) {
      summaryParts.push(`Score de confiance : ${patrimoScore}/100 (grade ${grade}). Ce profil se positionne ${patrimoScore >= 75 ? 'dans le haut de la distribution' : patrimoScore >= 55 ? 'dans la moyenne des candidats' : 'en dessous de la médiane'}.`);
    }
    summaryParts.push('Le dossier est prêt pour une décision propriétaire. Vous pouvez sélectionner ce candidat ou comparer avec les autres profils reçus.');
  } else if (status === 'REVIEW') {
    summaryParts.push(`Le dossier${firstName ? ` de ${firstName}` : ''} est exploitable, mais certains points méritent votre attention avant de vous engager.`);
    if (incomeLabel && effortLabel) {
      summaryParts.push(`Revenu déclaré : ${incomeLabel}/mois. Taux d'effort : ${effortLabel}. ${financial.riskBand.id === 'elevated' ? 'Ce niveau de charge est élevé mais pas rédhibitoire si un garant complète le montage.' : 'Le ratio revenus/loyer est dans les standards.'}`);
    }
    if (contractReadiness.warnings.length > 0) {
      summaryParts.push(`Point${contractReadiness.warnings.length > 1 ? 's' : ''} de vigilance : ${contractReadiness.warnings.join(' · ')}`);
    }
    if (!diditVerified) {
      summaryParts.push('L\'identité n\'a pas encore été vérifiée par Didit. Tant que cette étape n\'est pas franchie, le dossier reste classé en revue.');
    }
    if (grade) {
      summaryParts.push(`Score de confiance : ${patrimoScore}/100 (grade ${grade}).`);
    }
    summaryParts.push('Recommandation : demandez les pièces manquantes ou la vérification d\'identité avant de finaliser votre choix.');
  } else {
    summaryParts.push(`⚠ Le dossier${firstName ? ` de ${firstName}` : ''} présente des blocages critiques qui empêchent la contractualisation en l'état.`);
    if (contractReadiness.blockers.length > 0) {
      summaryParts.push(`Blocage${contractReadiness.blockers.length > 1 ? 's' : ''} détecté${contractReadiness.blockers.length > 1 ? 's' : ''} : ${contractReadiness.blockers.join(' · ')}`);
    }
    if (incomeLabel && effortLabel) {
      summaryParts.push(`Revenu déclaré : ${incomeLabel}/mois. Taux d'effort : ${effortLabel}.`);
    }
    if (!diditVerified) {
      summaryParts.push('Identité non vérifiée — critère bloquant pour la génération du bail.');
    }
    summaryParts.push('Recommandation : attendez que le candidat complète son dossier ou orientez votre choix vers un autre profil.');
  }

  const summary = summaryParts.join(' ');

  // Enriched highlights
  if (incomeSource) {
    const sourceMap = {
      cdi: 'Contrat CDI détecté — stabilité professionnelle.',
      cdd: 'Contrat CDD — durée limitée, vérifiez la fin de contrat.',
      freelance: 'Indépendant/Freelance — revenus variables possibles.',
      retirement: 'Retraité — revenus stables et prévisibles.',
      student: 'Étudiant — revenus à compléter par un garant.',
    };
    const srcLabel = Object.entries(sourceMap).find(([k]) => incomeSource.includes(k));
    if (srcLabel) highlights.push(srcLabel[1]);
  }

  if (financial.incomeToRentRatio != null && financial.incomeToRentRatio > 0) {
    highlights.push(`Ratio revenus/loyer : ${financial.incomeToRentRatio}x (${financial.incomeToRentRatio >= 3 ? 'seuil de confort atteint' : financial.incomeToRentRatio >= 2.5 ? 'acceptable' : 'inférieur au standard de 3x'}).`);
  }

  if (certDocs > 0 && totalDocs > 0) {
    highlights.push(`Couverture documentaire : ${certDocs}/${totalDocs} pièces certifiées (${round((certDocs / totalDocs) * 100)}%).`);
  }

  if (contractReadiness.ready) {
    highlights.push('✓ Dossier éligible à la génération de bail automatique.');
  }

  return {
    status,
    score,
    summary,
    highlights: dedupe(highlights).slice(0, 8),
    blockers: contractReadiness.blockers,
    reviewReasons: contractReadiness.warnings,
  };
}

function buildDecisionSummary({
  application,
  aiAudit,
  financial,
  quality,
  contractReadiness,
  passport,
  isSealed,
}) {
  const firstName = application?.profile?.firstName || '';
  const diditVerified = String(application?.didit?.status || '').toUpperCase() === 'VERIFIED';
  const readyToLease = !isSealed && Boolean(contractReadiness?.ready);
  const guaranteeLabel = passport?.guarantee?.label || 'Sans garantie';
  const qualityLabel = quality?.status?.label || 'Dossier en cours';

  let headline = 'Profil à clarifier avant toute décision.';
  if (isSealed) {
    headline = 'Profil prometteur, détail complet accessible après déverrouillage.';
  } else if (aiAudit?.status === 'CLEAR') {
    headline = `Profil ${firstName ? `de ${firstName} ` : ''}rassurant pour une mise en location fluide.`;
  } else if (aiAudit?.status === 'REVIEW') {
    headline = `Profil ${firstName ? `de ${firstName} ` : ''}intéressant avec quelques points à valider.`;
  } else if (aiAudit?.status === 'ALERT') {
    headline = `Profil ${firstName ? `de ${firstName} ` : ''}fragile à traiter avec prudence.`;
  }

  const strengths = dedupe([
    diditVerified ? 'Identité vérifiée' : null,
    financial?.monthlyIncomeLabel && financial?.effortRateLabel
      ? `${financial.monthlyIncomeLabel}/mois · taux d'effort ${financial.effortRateLabel}`
      : financial?.monthlyIncomeLabel
        ? `${financial.monthlyIncomeLabel}/mois`
        : null,
    financial?.remainingIncomeLabel ? `Reste à vivre ${financial.remainingIncomeLabel}` : null,
    qualityLabel,
    guaranteeLabel,
    readyToLease ? 'Prêt pour le bail' : null,
  ]).slice(0, 4);

  const watchouts = dedupe([
    ...(aiAudit?.blockers || []),
    ...(aiAudit?.reviewReasons || []),
    !diditVerified ? "Identité à vérifier avant la signature." : null,
    isSealed ? 'Profil actuellement masqué.' : null,
  ]).slice(0, 4);

  return {
    headline,
    strengths,
    watchouts,
    identityVerified: diditVerified,
    readyToLease,
    riskLabel: financial?.riskBand?.label || 'À confirmer',
  };
}

function buildComparisonSnapshot({
  application,
  aiAudit,
  financial,
  quality,
  contractReadiness,
  passport,
  isSealed,
}) {
  const diditVerified = String(application?.didit?.status || '').toUpperCase() === 'VERIFIED';
  const scoreValue = round(application?.patrimometer?.score || aiAudit?.score || 0);
  const grade = application?.patrimometer?.grade || '';
  const readyToLease = !isSealed && Boolean(contractReadiness?.ready);

  return {
    scoreValue,
    scoreLabel: `${scoreValue}/100${grade ? ` · ${grade}` : ''}`,
    identityVerified: diditVerified,
    identityVerifiedLabel: boolLabel(diditVerified, 'Oui', 'À vérifier'),
    monthlyIncomeLabel: financial?.monthlyIncomeLabel || '—',
    remainingIncomeLabel: financial?.remainingIncomeLabel || '—',
    effortRateLabel: financial?.effortRateLabel || '—',
    qualityLabel: quality?.status?.label || 'En audit',
    qualityScore: Number(quality?.score || 0),
    guaranteeLabel: passport?.guarantee?.label || 'Sans garantie',
    readyToLease,
    readyToLeaseLabel: isSealed
      ? 'Après accès complet'
      : boolLabel(readyToLease, 'Oui', 'À compléter'),
    riskLabel: financial?.riskBand?.label || 'À confirmer',
    auditLabel:
      aiAudit?.status === 'CLEAR'
        ? 'Lecture fluide'
        : aiAudit?.status === 'REVIEW'
          ? 'Revue conseillée'
          : 'Point bloquant',
    masked: Boolean(isSealed),
  };
}

function buildTunnel({ isSealed, passport, aiAudit, contractReadiness }) {
  const steps = [
    {
      id: 'audit',
      label: 'Audit IA',
      status: aiAudit.status === 'CLEAR' ? 'complete' : aiAudit.status === 'REVIEW' ? 'review' : 'blocked',
      description: aiAudit.status === 'CLEAR'
        ? 'L\'audit automatisé est terminé. Aucune anomalie majeure détectée. Le dossier peut avancer vers la phase de sélection.'
        : aiAudit.status === 'REVIEW'
          ? 'L\'audit a identifié des points de vigilance. Des vérifications humaines sont nécessaires avant de valider ce profil.'
          : 'L\'audit a détecté des blocages critiques. Le candidat doit corriger son dossier avant de pouvoir être considéré.',
      advice: aiAudit.status === 'CLEAR'
        ? 'Consultez le résumé détaillé ci-dessous pour connaître les forces du profil.'
        : aiAudit.status === 'REVIEW'
          ? 'Lisez les points de vigilance et décidez si vous souhaitez demander des compléments au candidat.'
          : 'Attendez que le candidat mette à jour son dossier ou orientez votre recherche vers d\'autres profils.',
    },
    {
      id: 'unlock',
      label: 'Déverrouillage',
      status: isSealed ? 'action_required' : 'complete',
      description: isSealed
        ? 'Ce profil est encore masqué. Déverrouillez-le pour accéder aux coordonnées, aux pièces justificatives et à l\'analyse détaillée du dossier.'
        : 'Profil déverrouillé. Vous avez accès à l\'ensemble des informations du candidat : coordonnées, documents certifiés et détail de l\'audit.',
      advice: isSealed
        ? 'Cliquez sur "Déverrouiller" pour accéder au dossier complet. Cette action active votre abonnement Souverain.'
        : null,
    },
    {
      id: 'passport',
      label: 'Passeport Locataire',
      status: passport?.state === 'sealed'
        ? 'complete'
        : passport?.state === 'ready'
          ? 'ready'
          : passport?.state === 'review'
            ? 'review'
            : 'blocked',
      description: passport?.state === 'sealed'
        ? 'Le passeport locataire est complet et verrouillé. Toutes les pièces ont été analysées et certifiées par notre algorithme.'
        : passport?.state === 'ready'
          ? 'Le passeport est prêt et peut être verrouillé. Les documents principaux ont été collectés et vérifiés.'
          : passport?.state === 'review'
            ? 'Le passeport est en cours de revue. Certaines pièces doivent encore être validées manuellement.'
            : 'Le passeport est incomplet. Le candidat doit fournir les pièces manquantes pour que son dossier soit exploitable.',
      advice: passport?.state === 'sealed' || passport?.state === 'ready'
        ? null
        : 'Le candidat recevra une notification pour compléter les pièces manquantes.',
    },
    {
      id: 'lease',
      label: 'Génération du Bail',
      status: isSealed
        ? 'locked'
        : contractReadiness.ready
          ? 'ready'
          : 'blocked',
      description: isSealed
        ? 'La génération de bail sera disponible après déverrouillage du profil et sélection du candidat.'
        : contractReadiness.ready
          ? 'Toutes les conditions sont réunies pour générer le bail. Vous pouvez lancer la contractualisation en un clic.'
          : `Le bail ne peut pas encore être généré. ${contractReadiness.blockers[0] || 'Des éléments du dossier doivent être complétés au préalable.'}`,
      advice: contractReadiness.ready
        ? 'Sélectionnez ce candidat puis cliquez sur "Préparer le bail" pour lancer la génération automatique.'
        : contractReadiness.blockers.length > 0
          ? `Blocage${contractReadiness.blockers.length > 1 ? 's' : ''} à lever : ${contractReadiness.blockers.join(' · ')}`
          : null,
    },
  ];

  const currentStep = steps.find((step) => !['complete', 'ready'].includes(step.status))?.id || 'lease';
  return { currentStep, steps };
}

function buildOwnerApplicationInsights({
  application,
  property,
  baseUrl = '',
  isSealed = false,
} = {}) {
  const app = application || {};
  const mergedApplication = {
    ...app,
    property: property || app.property || {},
  };
  const derivedFinancialProfile = deriveApplicationFinancialProfile({
    application: mergedApplication,
    fallbackIncome: Number(app?.financialSummary?.totalMonthlyIncome || 0),
  });

  const passport = buildPassportViewModel({
    application: mergedApplication,
    audience: 'candidate',
    baseUrl,
    slug: app.passportSlug,
  });

  const financial = buildFinancialSummary({
    monthlyIncome: derivedFinancialProfile.totalMonthlyIncome,
    rentAmount: Number((property || app.property || {}).rentAmount || 0),
    certifiedIncome: derivedFinancialProfile.certifiedIncome,
    incomeSource: derivedFinancialProfile.incomeSource || app?.financialSummary?.incomeSource || '',
    riskBand: pickRiskBand({
      effortRate: passport?.solvency?.effortRate,
      certifiedIncome: derivedFinancialProfile.certifiedIncome,
      guarantee: {
        mode: passport?.guarantee?.mode,
        score: passport?.guarantee?.score,
      },
    }),
    guarantee: passport?.guarantee,
    basisLabel: derivedFinancialProfile.basisLabel,
    components: derivedFinancialProfile.components,
  });

  const quality = buildDossierQuality(passport);
  const contractReadiness = buildContractReadiness({
    application: app,
    property: property || app.property || {},
    passport,
    financial,
    quality,
  });
  const aiAudit = buildAuditSummary({
    application: app,
    passport,
    financial,
    quality,
    contractReadiness,
  });
  const tunnel = buildTunnel({
    isSealed,
    passport,
    aiAudit,
    contractReadiness,
  });
  const decisionSummary = buildDecisionSummary({
    application: app,
    aiAudit,
    financial,
    quality,
    contractReadiness,
    passport,
    isSealed,
  });
  const comparison = buildComparisonSnapshot({
    application: app,
    aiAudit,
    financial,
    quality,
    contractReadiness,
    passport,
    isSealed,
  });

  return {
    aiAudit,
    financial,
    quality,
    contractReadiness,
    decisionSummary,
    comparison,
    tunnel,
    passport: {
      state: passport.state,
      stateLabel: passport.stateLabel,
      stateShortLabel: passport.stateShortLabel,
      summary: passport.summary,
      previewUrl: passport.previewUrl,
      shareUrl: passport.shareUrl,
      downloadUrl: passport.downloadUrl,
      shareEnabled: passport.shareEnabled,
      readinessReasons: passport.readinessReasons,
    },
    guarantee: passport.guarantee,
    pillars: passport.pillars,
    metrics: passport.metrics,
    timeline: passport.auditTimeline,
  };
}

module.exports = {
  buildOwnerApplicationInsights,
};
