/**
 * PatrimoScore™ - Moteur de Scoring avec Règles de Dépréciation Temporelle
 * 
 * Algorithme de calcul par blocs avec gestion de la péremption documentaire.
 * Le grade 'SOUVERAIN' (90-100) est verrouillé si un malus de péremption est actif.
 */

/**
 * Calcule le nombre de mois entre deux dates
 */
function monthsBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const years = d2.getFullYear() - d1.getFullYear();
  const months = d2.getMonth() - d1.getMonth();
  return years * 12 + months;
}

/**
 * Vérifie si une date est dans le mois courant (M) ou le mois précédent (M-1)
 */
function isCurrentOrPreviousMonth(date) {
  const docDate = new Date(date);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const docMonth = docDate.getMonth();
  const docYear = docDate.getFullYear();
  
  // Mois courant
  if (docMonth === currentMonth && docYear === currentYear) return true;
  
  // Mois précédent
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  if (docMonth === prevMonth && docYear === prevYear) return true;
  
  return false;
}

/**
 * Calcule le score du Bloc Identité (40 pts max)
 * Règle: Si date expiration < aujourd'hui, score = 0 (dossier bloqué)
 */
function calculateIdentityBlock(documents) {
  const identityDocs = documents.filter(doc => 
    doc.type === 'piece_identite' || 
    doc.type === 'cni' || 
    doc.type === 'passeport' ||
    (doc.metadata && doc.metadata.documentType === 'identity')
  );
  
  if (identityDocs.length === 0) {
    return {
      score: 0,
      maxScore: 40,
      warnings: ['Aucune pièce d\'identité fournie. Le bloc Identité est à 0.'],
      blocked: false
    };
  }
  
  // Chercher la pièce d'identité la plus récente avec date d'expiration
  let validIdentity = null;
  let expiredIdentity = null;
  
  for (const doc of identityDocs) {
    const expirationDate = doc.expirationDate || doc.metadata?.expirationDate;
    if (!expirationDate) continue;
    
    const expDate = new Date(expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expDate.setHours(0, 0, 0, 0);
    
    if (expDate >= today) {
      if (!validIdentity || new Date(doc.createdAt || doc.uploadedAt) > new Date(validIdentity.createdAt || validIdentity.uploadedAt)) {
        validIdentity = doc;
      }
    } else {
      if (!expiredIdentity || new Date(doc.createdAt || doc.uploadedAt) > new Date(expiredIdentity.createdAt || expiredIdentity.uploadedAt)) {
        expiredIdentity = doc;
      }
    }
  }
  
  // Si seule une pièce expirée existe
  if (!validIdentity && expiredIdentity) {
    return {
      score: 0,
      maxScore: 40,
      warnings: ['⚠️ Votre pièce d\'identité est expirée. Le score d\'identité est à 0 et le dossier est bloqué.'],
      blocked: true
    };
  }
  
  // Si aucune date d'expiration trouvée mais document présent
  if (!validIdentity && !expiredIdentity) {
    return {
      score: 40,
      maxScore: 40,
      warnings: [],
      blocked: false
    };
  }
  
  // Identité valide
  return {
    score: 40,
    maxScore: 40,
    warnings: [],
    blocked: false
  };
}

/**
 * Calcule le score du Bloc Revenus (20 pts max)
 * Règle: Requiert 3 bulletins. Si le plus récent a > 2 mois, malus de -10 pts
 */
function calculateIncomeBlock(documents) {
  const paySlips = documents.filter(doc => 
    doc.type === 'bulletin_salaire' || 
    doc.type === 'avis_imposition' ||
    (doc.metadata && doc.metadata.documentType === 'income')
  );
  
  if (paySlips.length === 0) {
    return {
      score: 0,
      maxScore: 20,
      warnings: ['Aucun document de revenus fourni. Le bloc Revenus est à 0.'],
      malus: 0
    };
  }
  
  // Trier par date (plus récent en premier)
  const sortedPaySlips = paySlips.sort((a, b) => {
    const dateA = new Date(a.documentDate || a.createdAt || a.uploadedAt);
    const dateB = new Date(b.documentDate || b.createdAt || b.uploadedAt);
    return dateB - dateA;
  });
  
  // Vérifier si on a au moins 3 bulletins
  if (sortedPaySlips.length < 3) {
    return {
      score: 0,
      maxScore: 20,
      warnings: [`Seulement ${sortedPaySlips.length} document(s) de revenus fourni(s). 3 bulletins sont requis pour valider le bloc Revenus.`],
      malus: 0
    };
  }
  
  // Vérifier la fraîcheur du dernier bulletin
  const mostRecent = sortedPaySlips[0];
  const docDate = new Date(mostRecent.documentDate || mostRecent.createdAt || mostRecent.uploadedAt);
  const now = new Date();
  const monthsDiff = monthsBetween(docDate, now);
  
  let score = 20;
  let malus = 0;
  const warnings = [];
  
  // Si le dernier bulletin a plus de 2 mois
  if (monthsDiff > 2) {
    malus = 10;
    score = 10;
    warnings.push(`⚠️ Votre dernier bulletin de salaire date de plus de 2 mois (${monthsDiff} mois). Malus de -10 pts appliqué sur le bloc Revenus.`);
  } else if (!isCurrentOrPreviousMonth(docDate)) {
    // Si pas dans M ou M-1, avertissement mais pas de malus
    warnings.push(`ℹ️ Votre dernier bulletin n'est pas du mois courant ou du mois précédent. Pensez à ajouter le plus récent pour maximiser votre score.`);
  }
  
  return {
    score,
    maxScore: 20,
    warnings,
    malus
  };
}

/**
 * Calcule le score du Bloc Activité (10 pts max)
 * Règle: Si attestation employeur > 1 mois: warning, si > 3 mois: score = 0
 */
function calculateActivityBlock(documents) {
  const employmentDocs = documents.filter(doc => 
    doc.type === 'attestation_employeur' || 
    doc.type === 'contrat_travail' ||
    (doc.metadata && doc.metadata.documentType === 'employment')
  );
  
  if (employmentDocs.length === 0) {
    return {
      score: 0,
      maxScore: 10,
      warnings: ['Aucune attestation employeur fournie. Le bloc Activité est à 0.'],
      blocked: false
    };
  }
  
  // Prendre la plus récente
  const sorted = employmentDocs.sort((a, b) => {
    const dateA = new Date(a.documentDate || a.createdAt || a.uploadedAt);
    const dateB = new Date(b.documentDate || b.createdAt || b.uploadedAt);
    return dateB - dateA;
  });
  
  const mostRecent = sorted[0];
  const docDate = new Date(mostRecent.documentDate || mostRecent.createdAt || mostRecent.uploadedAt);
  const now = new Date();
  const monthsDiff = monthsBetween(docDate, now);
  
  const warnings = [];
  
  // Si > 3 mois: bloc à 0
  if (monthsDiff > 3) {
    return {
      score: 0,
      maxScore: 10,
      warnings: [`⚠️ Votre attestation employeur a plus de 3 mois (${monthsDiff} mois). Elle n'est plus considérée comme une preuve de stabilité. Le bloc Activité tombe à 0. Renouvelez-la pour récupérer vos 10 points.`],
      blocked: true
    };
  }
  
  // Si > 1 mois: warning mais score conservé
  if (monthsDiff > 1) {
    warnings.push(`⚠️ Attention, votre attestation employeur a plus d'1 mois (${monthsDiff} mois). Elle commence à dater. Renouvelez-la pour éviter que le bloc Activité ne tombe à 0.`);
  }
  
  return {
    score: 10,
    maxScore: 10,
    warnings,
    blocked: false
  };
}

/**
 * Calcule le malus pour les quittances de loyer
 * Règle: Si la dernière quittance a plus de 2 mois, -5 pts
 */
function calculateRentReceiptsMalus(documents) {
  const receipts = documents.filter(doc => 
    doc.type === 'quittance' || 
    doc.type === 'quittance_loyer' ||
    (doc.metadata && doc.metadata.documentType === 'rent_receipt')
  );
  
  if (receipts.length === 0) {
    return {
      malus: 0,
      warnings: []
    };
  }
  
  // Trier par date (plus récent en premier)
  const sorted = receipts.sort((a, b) => {
    const dateA = new Date(a.documentDate || a.createdAt || a.uploadedAt);
    const dateB = new Date(b.documentDate || b.createdAt || b.uploadedAt);
    return dateB - dateA;
  });
  
  const mostRecent = sorted[0];
  const docDate = new Date(mostRecent.documentDate || mostRecent.createdAt || mostRecent.uploadedAt);
  const now = new Date();
  const monthsDiff = monthsBetween(docDate, now);
  
  if (monthsDiff > 2) {
    return {
      malus: 5,
      warnings: [`⚠️ Votre dernière quittance de loyer date de plus de 2 mois (${monthsDiff} mois). Malus de -5 pts appliqué.`]
    };
  }
  
  return {
    malus: 0,
    warnings: []
  };
}

/**
 * Détermine le grade selon le score total
 */
function getGrade(score) {
  if (score >= 90) return { grade: 'S', label: 'Souverain', color: 'amber' };
  if (score >= 80) return { grade: 'A', label: 'Excellent', color: 'emerald' };
  if (score >= 60) return { grade: 'B', label: 'Solide', color: 'blue' };
  if (score >= 40) return { grade: 'C', label: 'En cours', color: 'slate' };
  return { grade: 'D', label: 'Incomplet', color: 'red' };
}

/**
 * Calcule le PatrimoScore™ complet avec toutes les règles de péremption
 * 
 * @param {Array} documents - Liste des documents du locataire
 * @param {Object} options - Options supplémentaires (nom du locataire pour messages personnalisés)
 * @returns {Object} Résultat du scoring avec score, blocs, warnings, grade, etc.
 */
function calculatePatrimoScore(documents = [], options = {}) {
  const tenantName = options.tenantName || 'Candidat';
  
  // Calculer chaque bloc
  const identityBlock = calculateIdentityBlock(documents);
  const incomeBlock = calculateIncomeBlock(documents);
  const activityBlock = calculateActivityBlock(documents);
  const rentMalus = calculateRentReceiptsMalus(documents);
  
  // Calculer le score total
  let totalScore = identityBlock.score + incomeBlock.score + activityBlock.score;
  
  // Appliquer les malus
  totalScore -= incomeBlock.malus;
  totalScore -= rentMalus.malus;
  
  // S'assurer que le score ne peut pas être négatif
  totalScore = Math.max(0, totalScore);
  
  // Vérifier si un malus de péremption est actif
  const hasExpirationMalus = 
    incomeBlock.malus > 0 || 
    rentMalus.malus > 0 || 
    activityBlock.blocked || 
    identityBlock.blocked;
  
  // Verrouiller le grade SOUVERAIN si malus actif
  let finalScore = totalScore;
  let grade = getGrade(finalScore);
  
  if (hasExpirationMalus && grade.grade === 'S') {
    // Forcer le grade A maximum si malus actif
    finalScore = Math.min(finalScore, 89);
    grade = getGrade(finalScore);
  }
  
  // Compiler tous les warnings
  const allWarnings = [
    ...identityBlock.warnings,
    ...incomeBlock.warnings,
    ...activityBlock.warnings,
    ...rentMalus.warnings
  ];
  
  // Ajouter un message spécial si le grade S est verrouillé
  if (hasExpirationMalus && totalScore >= 90) {
    allWarnings.push(`🔒 Le grade Souverain (S) est verrouillé car certains documents sont périmés. Résolvez les problèmes de péremption pour débloquer ce grade.`);
  }
  
  // Messages personnalisés de l'Expert IA
  const expertMessages = [];
  
  if (incomeBlock.malus > 0) {
    expertMessages.push({
      type: 'warning',
      message: `${tenantName}, votre bulletin de salaire de ${new Date(incomeBlock.malus > 0 ? documents.find(d => d.type === 'bulletin_salaire')?.documentDate : null).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} commence à dater. Ajoutez celui du mois courant pour passer en Grade ${grade.grade === 'A' ? 'Souverain' : 'A'} et rassurer le propriétaire sur votre situation actuelle.`
    });
  }
  
  if (activityBlock.blocked) {
    expertMessages.push({
      type: 'critical',
      message: `Attention ${tenantName}, votre attestation employeur a plus de 3 mois. Elle n'est plus considérée comme une preuve de stabilité. Renouvelez-la pour récupérer vos 10 points.`
    });
  }
  
  if (identityBlock.blocked) {
    expertMessages.push({
      type: 'critical',
      message: `🚨 ${tenantName}, votre pièce d'identité est expirée. Le dossier est bloqué jusqu'à renouvellement.`
    });
  }
  
  // Détails par bloc pour l'affichage dans le cockpit
  const blockDetails = {
    identity: {
      score: identityBlock.score,
      maxScore: identityBlock.maxScore,
      percentage: Math.round((identityBlock.score / identityBlock.maxScore) * 100),
      status: identityBlock.blocked ? 'blocked' : (identityBlock.score === identityBlock.maxScore ? 'valid' : 'incomplete'),
      warnings: identityBlock.warnings
    },
    income: {
      score: incomeBlock.score - incomeBlock.malus,
      maxScore: incomeBlock.maxScore,
      percentage: Math.round(((incomeBlock.score - incomeBlock.malus) / incomeBlock.maxScore) * 100),
      status: incomeBlock.malus > 0 ? 'expired' : (incomeBlock.score === incomeBlock.maxScore ? 'valid' : 'incomplete'),
      warnings: incomeBlock.warnings,
      malus: incomeBlock.malus
    },
    activity: {
      score: activityBlock.score,
      maxScore: activityBlock.maxScore,
      percentage: Math.round((activityBlock.score / activityBlock.maxScore) * 100),
      status: activityBlock.blocked ? 'blocked' : (activityBlock.score === activityBlock.maxScore ? 'valid' : 'incomplete'),
      warnings: activityBlock.warnings
    }
  };
  
  return {
    totalScore: finalScore,
    maxScore: 70, // 40 + 20 + 10
    grade: grade.grade,
    gradeLabel: grade.label,
    gradeColor: grade.color,
    blocks: blockDetails,
    warnings: allWarnings,
    expertMessages,
    hasExpirationMalus,
    isBlocked: identityBlock.blocked, // Dossier bloqué si identité expirée
    breakdown: {
      identity: identityBlock.score,
      income: incomeBlock.score - incomeBlock.malus,
      activity: activityBlock.score,
      malus: {
        income: incomeBlock.malus,
        rentReceipts: rentMalus.malus,
        total: incomeBlock.malus + rentMalus.malus
      }
    },
    calculatedAt: new Date().toISOString()
  };
}

module.exports = {
  calculatePatrimoScore,
  calculateIdentityBlock,
  calculateIncomeBlock,
  calculateActivityBlock,
  calculateRentReceiptsMalus,
  getGrade,
  monthsBetween,
  isCurrentOrPreviousMonth
};
