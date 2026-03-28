/**
 * Calcul de la Note d'Intégrité pour les propriétaires
 *
 * Note 100/100 : Documents certifiés source (2D-Doc & Math check OK)
 * Note 60/100 : Alerte sur la fraîcheur ou la lisibilité
 * Note < 40/100 : "Dossier non recommandé - Incohérences majeures détectées"
 */

export interface DocumentAnalysisForIntegrity {
  status?: string;
  trustAndSecurity?: {
    fraud_score?: number;
    math_validation?: boolean;
    digital_seal_authenticated?: boolean;
    forensic_alerts?: string[];
    anomalies?: string[];
  };
  documentMetadata?: {
    date_emission?: string;
    date_validite?: string;
  };
}

export interface IntegrityScoreResult {
  score: number; // 0-100
  category: 'EXCELLENT' | 'BON' | 'ACCEPTABLE' | 'DOUTEUX' | 'NON_RECOMMANDÉ';
  label: string;
  details: {
    fraudScorePenalty: number;   // Pénalité basée sur le fraud_score moyen
    freshnessPenalty: number;    // Pénalité basée sur la fraîcheur des documents
    mathValidationBonus: number; // Bonus si tous les calculs sont OK
    sealBonus: number;           // Bonus si 2D-Doc authentifié
    anomalies: string[];         // Liste des anomalies détectées
  };
}

/**
 * Calcule la Note d'Intégrité d'une candidature basée sur ses documents
 */
export function calculateIntegrityScore(
  documents: DocumentAnalysisForIntegrity[],
  diditStatus?: 'VERIFIED' | 'PENDING' | 'FAILED'
): IntegrityScoreResult {
  const certifiedDocs = documents.filter((doc) => doc.status === 'CERTIFIED');

  if (certifiedDocs.length === 0) {
    return {
      score: 0,
      category: 'NON_RECOMMANDÉ',
      label: 'Aucun document certifié',
      details: {
        fraudScorePenalty: 0,
        freshnessPenalty: 0,
        mathValidationBonus: 0,
        sealBonus: 0,
        anomalies: ['Aucun document certifié dans le dossier'],
      },
    };
  }

  // 1. Pénalité moyenne basée sur fraud_score
  const fraudScores = certifiedDocs
    .map((doc) => doc.trustAndSecurity?.fraud_score || 0)
    .filter((score) => score > 0);

  const avgFraudScore =
    fraudScores.length > 0
      ? fraudScores.reduce((sum, s) => sum + s, 0) / fraudScores.length
      : 0;

  const fraudScorePenalty = avgFraudScore; // 1 point de pénalité par point de fraud_score moyen

  // 2. Pénalité de fraîcheur (documents expirés / trop anciens)
  const now = new Date();
  let freshnessPenalty = 0;
  const freshnessIssues: string[] = [];

  for (const doc of certifiedDocs) {
    const expDate = doc.documentMetadata?.date_validite;
    if (expDate) {
      const exp = new Date(expDate);
      if (!Number.isNaN(exp.getTime()) && exp < now) {
        freshnessPenalty += 20;
        freshnessIssues.push(`Document expiré (validité ${expDate})`);
      }
    }

    const emissionDate = doc.documentMetadata?.date_emission;
    if (emissionDate) {
      const emission = new Date(emissionDate);
      if (!Number.isNaN(emission.getTime())) {
        const monthsDiff =
          (now.getTime() - emission.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsDiff > 2) {
          freshnessPenalty += 5;
          freshnessIssues.push(
            `Document ancien (≈ ${Math.round(monthsDiff)} mois)`
          );
        }
      }
    }
  }

  // 3. Bonus validation mathématique
  const mathValidDocs = certifiedDocs.filter(
    (doc) => doc.trustAndSecurity?.math_validation === true
  ).length;
  const totalDocsWithMath = certifiedDocs.filter(
    (doc) => doc.trustAndSecurity?.math_validation !== undefined
  ).length;

  const mathValidationBonus =
    totalDocsWithMath > 0 ? (mathValidDocs / totalDocsWithMath) * 10 : 0;

  // 4. Bonus sceau numérique 2D-Doc
  const sealAuthenticatedDocs = certifiedDocs.filter(
    (doc) => doc.trustAndSecurity?.digital_seal_authenticated === true
  ).length;
  const sealBonus = sealAuthenticatedDocs > 0 ? 10 : 0;

  // 5. Collecter toutes les anomalies
  const allAnomalies: string[] = [];
  for (const doc of certifiedDocs) {
    const alerts = doc.trustAndSecurity?.forensic_alerts || [];
    const anomalies = doc.trustAndSecurity?.anomalies || [];
    allAnomalies.push(...alerts, ...anomalies);
  }
  allAnomalies.push(...freshnessIssues);

  // 6. Score final (base 100)
  let score = 100;
  score -= fraudScorePenalty;
  score -= freshnessPenalty;
  score += mathValidationBonus;
  score += sealBonus;

  if (diditStatus === 'VERIFIED') {
    score += 5;
  }

  score = Math.max(0, Math.min(100, score));

  // 7. Catégorie / label
  let category: IntegrityScoreResult['category'];
  let label: string;

  if (score >= 90) {
    category = 'EXCELLENT';
    label = 'Documents certifiés source (2D-Doc & Math check OK)';
  } else if (score >= 70) {
    category = 'BON';
    label = 'Dossier fiable avec quelques vérifications mineures';
  } else if (score >= 60) {
    category = 'ACCEPTABLE';
    label = 'Alerte sur la fraîcheur ou la lisibilité';
  } else if (score >= 40) {
    category = 'DOUTEUX';
    label =
      'Incohérences modérées détectées – Vérification approfondie recommandée';
  } else {
    category = 'NON_RECOMMANDÉ';
    label = 'Dossier non recommandé – Incohérences majeures détectées';
  }

  return {
    score: Math.round(score),
    category,
    label,
    details: {
      fraudScorePenalty: Math.round(fraudScorePenalty),
      freshnessPenalty: Math.round(freshnessPenalty),
      mathValidationBonus: Math.round(mathValidationBonus),
      sealBonus,
      anomalies: [...new Set(allAnomalies)],
    },
  };
}
