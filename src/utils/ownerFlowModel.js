function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

const STAGE_CONFIG = {
  search: {
    id: 'search',
    label: 'Recherche',
    tone: 'neutral',
    order: 0,
    progress: 12,
  },
  analysis: {
    id: 'analysis',
    label: 'Analyse',
    tone: 'info',
    order: 1,
    progress: 34,
  },
  selection: {
    id: 'selection',
    label: 'Sélection',
    tone: 'warning',
    order: 2,
    progress: 58,
  },
  contract: {
    id: 'contract',
    label: 'Contractualisation',
    tone: 'success',
    order: 3,
    progress: 80,
  },
  management: {
    id: 'management',
    label: 'Gestion',
    tone: 'dark',
    order: 4,
    progress: 100,
  },
};

function dedupe(values) {
  return Array.from(new Set(safeArray(values).filter(Boolean)));
}

function toDisplayName(candidate) {
  if (!candidate) return 'Aucun dossier';
  if (candidate.isSealed) {
    return candidate.sealedLabel || candidate.sealedId || 'Profil masqué';
  }
  return [candidate.profile?.firstName, candidate.profile?.lastName].filter(Boolean).join(' ').trim() || 'Candidat';
}

function propertyTabHref(propertyId, tab = 'overview', applicationId) {
  const url = new URL(`https://doc2loc.local/dashboard/owner/property/${propertyId}`);
  if (tab) url.searchParams.set('tab', tab);
  if (applicationId) url.searchParams.set('applicationId', applicationId);
  return `${url.pathname}${url.search}`;
}

function contractHref(propertyId, applicationId) {
  const url = new URL(`https://doc2loc.local/properties/${propertyId}/contract`);
  if (applicationId) url.searchParams.set('applicationId', applicationId);
  return `${url.pathname}${url.search}`;
}

function getCandidatePriority(candidate, acceptedTenantId) {
  if (!candidate) return -Infinity;

  let score = Number(candidate?.patrimometer?.score || 0);

  if (candidate.id && acceptedTenantId && String(candidate.id) === String(acceptedTenantId)) {
    score += 1000;
  }

  if (!candidate.isSealed) score += 120;
  if (candidate.ownerInsights?.contractReadiness?.ready) score += 90;
  if (candidate.passport?.state === 'sealed') score += 30;
  if (candidate.passport?.state === 'ready') score += 24;

  const auditStatus = String(candidate.ownerInsights?.aiAudit?.status || '');
  if (auditStatus === 'CLEAR') score += 32;
  if (auditStatus === 'REVIEW') score += 12;
  if (auditStatus === 'ALERT') score -= 18;

  if (candidate.guarantee?.mode === 'VISALE') score += 12;
  if (candidate.guarantee?.mode === 'PHYSICAL') score += 6;

  return score;
}

function sortCandidatesForOwner(candidates = [], acceptedTenantId = '') {
  return [...safeArray(candidates)].sort(
    (left, right) => getCandidatePriority(right, acceptedTenantId) - getCandidatePriority(left, acceptedTenantId)
  );
}

function pickPrimaryCandidate(candidates = [], acceptedTenantId = '') {
  return sortCandidatesForOwner(candidates, acceptedTenantId)[0] || null;
}

function decorateCandidatesForOwner(candidates = [], acceptedTenantId = '', isUnlocked = false) {
  const ordered = sortCandidatesForOwner(candidates, acceptedTenantId);

  return ordered.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    isTop3: index < 3,
    isOwnerSelected: Boolean(candidate?.id && acceptedTenantId && String(candidate.id) === String(acceptedTenantId)),
    isUnlocked: Boolean(isUnlocked),
  }));
}

function buildManagementSummary({ property, primaryCandidate, acceptedCandidate } = {}) {
  const status = String(property?.status || '').toUpperCase();
  const managedCandidate = acceptedCandidate || primaryCandidate || null;
  const tenantLabel = toDisplayName(managedCandidate);
  const leaseStatusLabel =
    status === 'OCCUPIED'
      ? 'Bail actif'
      : status === 'LEASE_IN_PROGRESS'
        ? 'Signature en cours'
        : property?.acceptedTenantId
          ? 'Locataire retenu'
          : property?.managed
            ? 'Bien géré'
            : 'Prospection';

  const nextMilestone =
    status === 'OCCUPIED'
      ? 'Suivre les pièces clés du bail, les échéances et la relation locative.'
      : status === 'LEASE_IN_PROGRESS'
        ? 'Finaliser la signature et consolider les documents du bail.'
        : property?.acceptedTenantId
          ? 'Préparer ou reprendre la contractualisation du dossier retenu.'
          : 'Aucune gestion active tant qu’un locataire n’est pas retenu.';

  const nextActions = dedupe([
    status === 'OCCUPIED' ? 'Vérifier les documents du bail' : null,
    property?.acceptedTenantId ? 'Suivre le locataire retenu' : null,
    managedCandidate?.passport?.downloadUrl ? 'Archiver le PDF du passeport' : null,
    managedCandidate?.ownerInsights?.contractReadiness?.ready && status !== 'OCCUPIED'
      ? 'Finaliser la contractualisation'
      : null,
  ]);

  const documentsLabel = managedCandidate
    ? `${Number(managedCandidate.documentsCount || 0)} pièce(s) · ${Number(managedCandidate.certifiedDocumentsCount || 0)} certifiée(s)`
    : 'Aucun document sélectionné';

  const summary =
    managedCandidate
      ? `${tenantLabel} porte actuellement la phase ${leaseStatusLabel.toLowerCase()} dans la gestion locative. ${nextMilestone}`
      : 'Le bien n’a pas encore basculé vers un suivi locatif actif.';

  return {
    tenantLabel,
    leaseStatusLabel,
    documentsLabel,
    nextMilestone,
    nextActions,
    summary,
  };
}

function derivePropertyStage({ property, candidates, primaryCandidate } = {}) {
  const status = String(property?.status || '').toUpperCase();
  const acceptedTenantId = String(property?.acceptedTenantId || '');
  const hasCandidates = safeArray(candidates).length > 0;
  const hasStrongSelectionMaterial = safeArray(candidates).some((candidate) => {
    const score = Number(candidate?.patrimometer?.score || 0);
    const auditStatus = String(candidate?.ownerInsights?.aiAudit?.status || '');
    const passportState = String(candidate?.passport?.state || '');
    return auditStatus === 'CLEAR' || passportState === 'ready' || passportState === 'sealed' || score >= 70;
  });

  if (status === 'OCCUPIED') return STAGE_CONFIG.management;
  if (status === 'LEASE_IN_PROGRESS' || acceptedTenantId) {
    return STAGE_CONFIG.contract;
  }
  if (!hasCandidates) return STAGE_CONFIG.search;
  if (hasStrongSelectionMaterial || primaryCandidate || property?.managed) return STAGE_CONFIG.selection;
  return STAGE_CONFIG.analysis;
}

function buildNextAction({ stage, property, primaryCandidate, candidates } = {}) {
  const propertyId = String(property?.id || property?._id || '');
  const acceptedTenantId = String(property?.acceptedTenantId || '');
  const primaryCandidateId = primaryCandidate?.id || '';
  const acceptedCandidate = safeArray(candidates).find(
    (candidate) => candidate?.id && acceptedTenantId && String(candidate.id) === acceptedTenantId
  ) || null;
  const candidateCount = safeArray(candidates).length;
  const sealedCount = safeArray(candidates).filter((candidate) => candidate?.isSealed).length;

  if (!propertyId) {
    return {
      id: 'review',
      label: 'Voir les dossiers',
      href: '/dashboard/owner',
      kind: 'navigate',
    };
  }

  if (sealedCount > 0 && !property?.managed) {
    return {
      id: 'unlock',
      label: sealedCount > 1 ? 'Accéder aux dossiers complets' : 'Accéder au dossier complet',
      description: sealedCount > 1
        ? `${sealedCount} dossiers restent masqués. Déverrouillez-les pour voir les coordonnées, les pièces et l'analyse complète.`
        : 'Ce dossier reste masqué. Déverrouillez-le pour voir les coordonnées, les pièces et l’analyse complète.',
      href: propertyTabHref(propertyId, 'compare'),
      kind: 'unlock',
      applicationId: null,
    };
  }

  if (stage.id === 'management') {
    return {
      id: 'manage',
      label: 'Ouvrir la gestion',
      description: 'Accédez au suivi du bail, aux documents et aux prochaines échéances.',
      href: propertyTabHref(propertyId, 'selected', acceptedCandidate?.id || primaryCandidateId),
      kind: 'manage',
      applicationId: acceptedCandidate?.id || primaryCandidateId || null,
    };
  }

  if (stage.id === 'contract') {
    const label = acceptedCandidate ? toDisplayName(acceptedCandidate) : 'le locataire retenu';
    return {
      id: 'prepare_lease',
      label: 'Préparer le bail',
      description: `Passez à la contractualisation pour ${label}. Les données vérifiées du dossier seront reprises automatiquement.`,
      href: acceptedCandidate?.id ? contractHref(propertyId, acceptedCandidate.id) : propertyTabHref(propertyId, 'selected'),
      kind: 'contract',
      applicationId: acceptedCandidate?.id || null,
    };
  }

  if (stage.id === 'search') {
    return {
      id: 'invite_candidates',
      label: 'Partager le lien candidat',
      description: 'Diffusez votre lien candidat sur vos annonces pour recevoir des dossiers vérifiés.',
      href: propertyTabHref(propertyId, 'overview'),
      kind: 'invite',
      applicationId: null,
    };
  }

  if (stage.id === 'selection') {
    return {
      id: candidateCount > 1 ? 'compare' : 'review',
      label: candidateCount > 1 ? 'Comparer les finalistes' : 'Vérifier le dossier',
      description: candidateCount > 1
        ? `${candidateCount} dossiers sont prêts à être arbitrés. Comparez-les puis choisissez votre locataire.`
        : 'Un dossier exploitable est disponible. Vérifiez-le puis validez votre choix.',
      href: propertyTabHref(propertyId, candidateCount > 1 ? 'compare' : 'overview', primaryCandidateId),
      kind: candidateCount > 1 ? 'compare' : 'choose',
      applicationId: primaryCandidateId || null,
    };
  }

  return {
    id: 'review',
    label: 'Suivre les audits',
    description: 'Consultez les dossiers reçus et laissez l’analyse se finaliser avant de décider.',
    href: propertyTabHref(propertyId, 'overview', primaryCandidateId),
    kind: 'review',
    applicationId: primaryCandidateId || null,
  };
}

function buildStageSummary({ stage, property, candidates, primaryCandidate } = {}) {
  const count = safeArray(candidates).length;
  const acceptedTenantId = String(property?.acceptedTenantId || '');
  const acceptedCandidate = safeArray(candidates).find(
    (candidate) => candidate?.id && acceptedTenantId && String(candidate.id) === acceptedTenantId
  ) || null;
  const tenantLabel = toDisplayName(acceptedCandidate || primaryCandidate);

  if (stage.id === 'management') {
    return count > 0
      ? `${tenantLabel} est désormais votre locataire en gestion active. Les documents du bail, les échéances et le suivi courant sont accessibles ici.`
      : 'Le bien est entré en phase de gestion locative. Le suivi des échéances et des documents est actif.';
  }

  if (stage.id === 'contract') {
    return count > 0
      ? `${tenantLabel} a été retenu pour ce bien. La prochaine étape consiste à préparer le bail à partir des données déjà vérifiées.`
      : 'Un locataire a été retenu pour ce bien. Vous pouvez lancer la préparation du bail dès que le dossier est complet.';
  }

  if (stage.id === 'selection') {
    const topScore = primaryCandidate?.patrimometer?.score || 0;
    return count > 1
      ? `${count} dossiers sont maintenant comparables. Le meilleur score de confiance est de ${topScore}/100. Comparez les finalistes puis choisissez votre locataire.`
      : `Le dossier de ${tenantLabel} est exploitable (score de confiance : ${topScore}/100). Vérifiez-le puis passez à la sélection.`;
  }

  if (stage.id === 'analysis') {
    const reviewCount = safeArray(candidates).filter(
      (c) => String(c?.ownerInsights?.aiAudit?.status || '') === 'REVIEW'
    ).length;
    return count > 0
      ? `${count} candidature${count > 1 ? 's' : ''} est${count > 1 ? 'sont' : ''} en cours d'analyse. ${reviewCount > 0 ? `${reviewCount} dossier${reviewCount > 1 ? 's demandent' : ' demande'} une relecture.` : 'Les vérifications automatiques sont en cours.'}`
      : 'Les premiers dossiers candidats sont attendus. Dès leur réception, l’analyse démarre automatiquement.';
  }

  const token = property?.applyToken || '';
  return `Votre bien est prêt à recevoir des candidatures. ${token ? 'Partagez le lien candidat sur vos annonces pour lancer le dépôt de dossier. ' : ''}Chaque dossier reçu sera automatiquement vérifié sur l’identité, les revenus et la qualité documentaire.`;
}

function buildStageGuidance({ stage, property, candidates, nextAction } = {}) {
  const count = safeArray(candidates).length;
  const maskedCount = safeArray(candidates).filter((c) => c?.isSealed).length;

  const stagesOverview = [
    { id: 'search', label: 'Recherche', tip: 'Diffusez votre lien candidat pour recevoir des dossiers.' },
    { id: 'analysis', label: 'Analyse', tip: 'L’IA audite automatiquement chaque dossier reçu.' },
    { id: 'selection', label: 'Sélection', tip: 'Comparez les finalistes puis choisissez votre locataire.' },
    { id: 'contract', label: 'Contrat', tip: 'Préparez le bail à partir des données déjà vérifiées.' },
    { id: 'management', label: 'Gestion', tip: 'Suivez votre relation locative et archivez les documents.' },
  ];

  const currentIndex = stagesOverview.findIndex((s) => s.id === stage.id);
  const completedStages = stagesOverview.slice(0, currentIndex);
  const currentStage = stagesOverview[currentIndex] || stagesOverview[0];
  const upcomingStages = stagesOverview.slice(currentIndex + 1);

  let contextualAdvice = '';
  if (stage.id === 'search') {
    contextualAdvice = 'Copiez le lien candidat et collez-le dans vos annonces. Plus il est visible, plus vous recevez de dossiers comparables rapidement.';
  } else if (stage.id === 'analysis') {
    contextualAdvice = `${count} dossier${count > 1 ? 's' : ''} en cours de traitement. L’IA vérifie l’identité, les revenus et la cohérence des pièces.`;
  } else if (stage.id === 'selection') {
    contextualAdvice = maskedCount > 0 && !property?.managed
      ? `${maskedCount} dossier${maskedCount > 1 ? 's restent masqués' : ' reste masqué'}. Comparez d’abord les indicateurs visibles, puis déverrouillez pour lire le détail complet au moment de décider.`
      : 'Ouvrez le comparateur, regardez les finalistes sur les mêmes critères, puis confirmez explicitement votre choix.';
  } else if (stage.id === 'contract') {
    contextualAdvice = 'Le locataire est retenu. Votre prochain geste utile est de préparer le bail, sans repasser par une revue complète du dossier.';
  } else if (stage.id === 'management') {
    contextualAdvice = 'Le bien est loué. Continuez avec la gestion documentaire et le suivi locatif depuis cet espace.';
  }

  let whyThisStage = '';
  if (stage.id === 'search') {
    whyThisStage = 'Aucun dossier n’a encore été reçu pour ce bien.';
  } else if (stage.id === 'analysis') {
    whyThisStage = 'Des dossiers ont été reçus mais l’analyse n’est pas encore totalement exploitable.';
  } else if (stage.id === 'selection') {
    whyThisStage = 'Au moins un dossier est suffisamment avancé pour être comparé et choisi.';
  } else if (stage.id === 'contract') {
    whyThisStage = 'Un locataire a été retenu et peut maintenant basculer vers le bail.';
  } else if (stage.id === 'management') {
    whyThisStage = 'Le bail est en place et la gestion locative est active.';
  }

  return {
    currentStage: {
      ...currentStage,
      progress: stage.progress,
    },
    completedStages,
    upcomingStages,
    contextualAdvice,
    whyThisStage,
    nextAction: nextAction ? {
      label: nextAction.label,
      href: nextAction.href,
      kind: nextAction.kind,
      advice:
        stage.id === 'search'
          ? 'Ouvrez la fiche bien pour copier et partager le lien candidat.'
          : stage.id === 'analysis'
            ? 'Ouvrez la fiche bien pour voir les audits en cours.'
            : stage.id === 'selection'
              ? 'Ouvrez le comparateur pour arbitrer entre les finalistes.'
              : stage.id === 'contract'
                ? 'Passez à la contractualisation.'
                : 'Ouvrez la gestion de votre bien.',
    } : null,
  };
}

function buildAlerts({ property, candidates, primaryCandidate } = {}) {
  const alerts = [];
  const blockers = [];
  const acceptedTenantId = String(property?.acceptedTenantId || '');
  const maskedCount = safeArray(candidates).filter((candidate) => candidate?.isSealed).length;
  const reviewCount = safeArray(candidates).filter(
    (candidate) => String(candidate?.ownerInsights?.aiAudit?.status || '') === 'REVIEW'
  ).length;

  if (maskedCount > 0 && !property?.managed) {
    alerts.push(`${maskedCount} dossier${maskedCount > 1 ? 's sont encore masqués' : ' est encore masqué'}. Comparez les signaux visibles, puis ouvrez le détail complet si nécessaire.`);
  }

  if (reviewCount > 0) {
    alerts.push(`${reviewCount} dossier${reviewCount > 1 ? 's demandent' : ' demande'} une vérification complémentaire avant une décision sereine.`);
  }

  if (property?.managed && safeArray(candidates).length > 0 && !acceptedTenantId) {
    alerts.push('Aucun locataire n’a encore été retenu. Comparez les profils puis confirmez explicitement votre choix.');
  }

  if (primaryCandidate?.ownerInsights?.decisionSummary?.headline) {
    alerts.push(primaryCandidate.ownerInsights.decisionSummary.headline);
  }

  blockers.push(...safeArray(primaryCandidate?.ownerInsights?.aiAudit?.blockers));
  blockers.push(...safeArray(primaryCandidate?.ownerInsights?.contractReadiness?.blockers));

  return {
    alerts: dedupe(alerts).slice(0, 3),
    blockers: dedupe(blockers).slice(0, 3),
  };
}

function buildPrimaryCandidateSummary(candidate) {
  if (!candidate) return null;
  return {
    id: candidate.id || null,
    label: toDisplayName(candidate),
    rank: Number(candidate?.rank || 0) || null,
    isTop3: Boolean(candidate?.isTop3),
    isOwnerSelected: Boolean(candidate?.isOwnerSelected),
    isUnlocked: Boolean(candidate?.isUnlocked),
    sealed: Boolean(candidate.isSealed),
    score: Number(candidate?.patrimometer?.score || 0),
    grade: candidate?.patrimometer?.grade || 'F',
    passportState: candidate?.passport?.state || 'draft',
    passportStateLabel: candidate?.passport?.stateLabel || 'Brouillon',
    guaranteeLabel: candidate?.ownerInsights?.guarantee?.label || candidate?.passport?.guarantee?.label || 'Sans garant',
    contractReady: Boolean(candidate?.ownerInsights?.contractReadiness?.ready),
    auditStatus: candidate?.ownerInsights?.aiAudit?.status || 'REVIEW',
    auditSummary: candidate?.ownerInsights?.decisionSummary?.headline || candidate?.ownerInsights?.aiAudit?.summary || '',
    remainingIncomeLabel: candidate?.ownerInsights?.financial?.remainingIncomeLabel || null,
    effortRateLabel: candidate?.ownerInsights?.financial?.effortRateLabel || null,
  };
}

function buildSelectionState({ property, candidates, primaryCandidate, acceptedCandidate, nextAction } = {}) {
  const propertyId = String(property?.id || property?._id || '');
  const finalists = safeArray(candidates).slice(0, 3);
  const selected = acceptedCandidate || null;
  const compareCandidate = selected || primaryCandidate || finalists[0] || null;

  const mode = selected
    ? 'selected'
    : finalists.length >= 2
      ? 'compare'
      : finalists.length === 1
        ? 'review'
        : 'empty';

  const headline =
    mode === 'selected'
      ? `${toDisplayName(selected)} a été retenu pour ce bien.`
      : mode === 'compare'
        ? `${finalists.length} finalistes à comparer avant décision.`
        : mode === 'review'
          ? `Un dossier exploitable à valider.`
          : 'Commencez par recevoir des dossiers.';

  const body =
    mode === 'selected'
      ? selected?.ownerInsights?.decisionSummary?.headline || 'Le prochain geste utile est de préparer le bail.'
      : mode === 'compare'
        ? 'Comparez les finalistes sur les mêmes critères, puis confirmez explicitement votre choix.'
        : mode === 'review'
          ? 'Vérifiez le dossier disponible, puis validez votre choix si le profil vous convient.'
          : 'Partagez le lien candidat pour faire entrer ce bien dans le tunnel de sélection.';

  return {
    mode,
    defaultTab: mode === 'selected' ? 'selected' : mode === 'compare' ? 'compare' : 'overview',
    compareHref: propertyId ? propertyTabHref(propertyId, mode === 'empty' ? 'overview' : mode === 'selected' ? 'selected' : 'compare', compareCandidate?.id || null) : '/dashboard/owner',
    selectedCandidateId: selected?.id || null,
    selectedCandidateLabel: selected ? toDisplayName(selected) : null,
    selectionReason: selected?.ownerInsights?.decisionSummary?.headline || null,
    finalistsCount: finalists.length,
    otherCandidatesCount: Math.max(0, safeArray(candidates).length - finalists.length),
    headline,
    body,
    primaryAction: nextAction
      ? {
          label: nextAction.label,
          href: nextAction.href,
          kind: nextAction.kind,
        }
      : null,
  };
}

function buildFocusCard({ stage, property, candidates, primaryCandidate, acceptedCandidate, nextAction, summary, alerts, blockers } = {}) {
  const propertyId = String(property?.id || property?._id || '');
  const candidateCount = safeArray(candidates).length;
  const reviewCount = safeArray(candidates).filter(
    (candidate) => String(candidate?.ownerInsights?.aiAudit?.status || '') === 'REVIEW'
  ).length;
  const maskedCount = safeArray(candidates).filter((candidate) => candidate?.isSealed).length;
  const selectedCandidate = acceptedCandidate || null;

  let priority = 100;
  let eyebrow = stage.label;
  let title = 'Bien à suivre';
  let reason = alerts?.[0] || blockers?.[0] || summary;
  let metricLabel = 'Dossiers';
  let metricValue = candidateCount;
  let tone = stage.tone;

  if (stage.id === 'selection' && !selectedCandidate) {
    priority = 500 + candidateCount;
    title = candidateCount > 1 ? 'Décision à prendre' : 'Vérification finale';
    reason = candidateCount > 1
      ? `${candidateCount} finalistes comparables pour ce bien.`
      : 'Un dossier est prêt à être arbitré.';
    metricLabel = 'Finalistes';
    metricValue = Math.min(candidateCount, 3);
  } else if (stage.id === 'analysis') {
    priority = 400 + reviewCount;
    title = 'Analyses à relire';
    reason = reviewCount > 0
      ? `${reviewCount} dossier${reviewCount > 1 ? 's demandent' : ' demande'} une relecture.`
      : 'Les vérifications automatiques sont en cours.';
    metricLabel = 'En revue';
    metricValue = reviewCount || candidateCount;
  } else if (stage.id === 'search') {
    priority = 300;
    title = 'Recevoir des dossiers';
    reason = property?.applyToken
      ? 'Le lien candidat est prêt à être partagé.'
      : 'Complétez ce bien pour commencer à recevoir des candidatures.';
    metricLabel = 'Lien';
    metricValue = property?.applyToken ? 'Prêt' : 'À créer';
  } else if (stage.id === 'contract') {
    priority = 200;
    title = 'Passer au bail';
    reason = selectedCandidate
      ? `${toDisplayName(selectedCandidate)} a déjà été retenu.`
      : 'Un locataire est prêt à basculer vers la contractualisation.';
    metricLabel = 'Statut';
    metricValue = 'Locataire retenu';
    tone = 'success';
  } else if (stage.id === 'management') {
    priority = 120;
    title = 'Bien en gestion';
    reason = selectedCandidate
      ? `${toDisplayName(selectedCandidate)} est suivi dans la phase locative.`
      : 'Le suivi locatif est actif.';
    metricLabel = 'Gestion';
    metricValue = 'Active';
    tone = 'dark';
  }

  if (maskedCount > 0 && !property?.managed && stage.id !== 'search') {
    reason = `${maskedCount} dossier${maskedCount > 1 ? 's restent masqués' : ' reste masqué'} pour ce bien.`;
  }

  return {
    propertyId,
    priority,
    tone,
    eyebrow,
    title,
    reason,
    summary,
    metricLabel,
    metricValue,
    ctaLabel: nextAction?.label || 'Ouvrir',
    ctaHref: nextAction?.href || propertyTabHref(propertyId, 'overview'),
  };
}

function buildOwnerPropertyFlow({ property, candidates = [] } = {}) {
  const normalizedCandidates = safeArray(candidates);
  const acceptedTenantId = String(property?.acceptedTenantId || '');
  const orderedCandidates = decorateCandidatesForOwner(
    normalizedCandidates,
    acceptedTenantId,
    Boolean(property?.managed)
  );
  const primaryCandidate = pickPrimaryCandidate(orderedCandidates, acceptedTenantId);
  const acceptedCandidate = orderedCandidates.find(
    (candidate) => candidate?.id && acceptedTenantId && String(candidate.id) === acceptedTenantId
  ) || null;
  const stage = derivePropertyStage({
    property,
    candidates: orderedCandidates,
    primaryCandidate,
  });
  const readyToContractCount = orderedCandidates.filter(
    (candidate) => !candidate?.isSealed && candidate?.ownerInsights?.contractReadiness?.ready
  ).length;
  const maskedCount = orderedCandidates.filter((candidate) => candidate?.isSealed).length;
  const managementSummary = buildManagementSummary({
    property,
    primaryCandidate,
    acceptedCandidate,
  });
  const summary = buildStageSummary({
    stage,
    property,
    candidates: orderedCandidates,
    primaryCandidate,
  });
  const alertSummary = buildAlerts({
    property,
    candidates: orderedCandidates,
    primaryCandidate,
  });
  const nextAction = buildNextAction({
    stage,
    property,
    primaryCandidate,
    candidates: orderedCandidates,
  });
  const guidance = buildStageGuidance({
    stage,
    property,
    candidates: orderedCandidates,
    nextAction,
  });
  const selectionState = buildSelectionState({
    property,
    candidates: orderedCandidates,
    primaryCandidate,
    acceptedCandidate,
    nextAction,
  });
  const focusCard = buildFocusCard({
    stage,
    property,
    candidates: orderedCandidates,
    primaryCandidate,
    acceptedCandidate,
    nextAction,
    summary,
    alerts: alertSummary.alerts,
    blockers: alertSummary.blockers,
  });

  return {
    stage: stage.id,
    stageLabel: stage.label,
    stageTone: stage.tone,
    stageOrder: stage.order,
    progress: stage.progress,
    unlocked: Boolean(property?.managed),
    summary,
    nextAction,
    compareHref: selectionState.compareHref,
    guidance,
    focusCard,
    selectionState,
    primaryCandidateId: primaryCandidate?.id || null,
    selectedCandidateId: acceptedCandidate?.id || null,
    selectionRequired: orderedCandidates.length > 0 && !acceptedCandidate,
    sealedCount: maskedCount,
    readyToContractCount,
    totalCandidates: orderedCandidates.length,
    topCandidates: orderedCandidates.slice(0, 3).map(buildPrimaryCandidateSummary),
    managementSummary,
    alerts: alertSummary.alerts,
    blockers: alertSummary.blockers,
    primaryCandidate: buildPrimaryCandidateSummary(primaryCandidate),
  };
}

module.exports = {
  STAGE_CONFIG,
  buildOwnerPropertyFlow,
  decorateCandidatesForOwner,
  sortCandidatesForOwner,
};
