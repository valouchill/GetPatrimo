'use server';

/**
 * Server Action pour calculer la solvabilité d'un locataire par rapport à un loyer
 * 
 * SÉCURITÉ: Ce calcul doit être effectué côté serveur pour éviter que le locataire
 * ne puisse manipuler son grade en modifiant le loyer cible dans le navigateur.
 * 
 * @param totalCertifiedIncome - Revenu mensuel total certifié (extrait du Passeport PatrimoTrust)
 * @param rentAmount - Montant du loyer de l'annonce du propriétaire
 * @param profile - Profil du locataire (STUDENT, SALARIED, INDEPENDENT, RETIRED)
 * @param guarantorIncome - Revenu mensuel du garant (optionnel)
 * @param aplAmount - Montant APL mensuel (optionnel, pour étudiants)
 * @param bourseAmount - Montant bourse mensuel (optionnel, pour étudiants)
 * @returns Résultat du calcul de solvabilité avec grade et conseil expert
 */

export interface SolvencyCalculationResult {
  ratio: number;
  zone: 'green' | 'amber' | 'red';
  grade: 'Souverain' | 'Excellent' | 'Bon' | 'Suffisant' | 'Insuffisant';
  status: string;
  message: string;
  personalRatio?: number;
  combinedRatio?: number;
  expertAdvice: string;
}

export async function calculateSolvency(
  totalCertifiedIncome: number,
  rentAmount: number,
  profile: 'STUDENT' | 'SALARIED' | 'INDEPENDENT' | 'RETIRED' | 'UNKNOWN',
  guarantorIncome?: number,
  aplAmount?: number,
  bourseAmount?: number
): Promise<SolvencyCalculationResult> {
  // Validation des entrées
  if (rentAmount <= 0) {
    return {
      ratio: 0,
      zone: 'red',
      grade: 'Insuffisant',
      status: 'Non calculable',
      message: 'Le loyer doit être défini pour calculer la solvabilité.',
      expertAdvice: 'Veuillez définir un montant de loyer valide pour effectuer le calcul de solvabilité.',
    };
  }

  if (totalCertifiedIncome < 0) {
    totalCertifiedIncome = 0;
  }

  let effectiveIncome = totalCertifiedIncome;
  let personalRatio = totalCertifiedIncome / rentAmount;
  let combinedRatio = personalRatio;

  // Intelligence Étudiante : cumul des revenus
  if (profile === 'STUDENT') {
    const studentIncome = (bourseAmount || 0) + (aplAmount || 0);
    const guarantorContribution = guarantorIncome || 0;
    effectiveIncome = studentIncome + guarantorContribution;
    personalRatio = studentIncome > 0 ? studentIncome / rentAmount : 0;
    combinedRatio = effectiveIncome / rentAmount;
  } else {
    // Pour Salarié/Indépendant/Retraité, on ajoute le garant si présent
    if (guarantorIncome) {
      combinedRatio = (totalCertifiedIncome + guarantorIncome) / rentAmount;
    }
  }

  const ratio = combinedRatio;

  // Détermination de la zone et du grade
  let zone: 'green' | 'amber' | 'red';
  let grade: 'Souverain' | 'Excellent' | 'Bon' | 'Suffisant' | 'Insuffisant';
  let status: string;
  let message: string;
  let expertAdvice: string;

  if (ratio >= 3.5) {
    zone = 'green';
    grade = 'Souverain';
    status = 'Souverain';
    message = `Ratio exceptionnel de ${ratio.toFixed(1)}x. Ce profil présente une solvabilité exemplaire et une marge de sécurité très confortable.`;
    expertAdvice = 'Profil souverain. Ce candidat présente une solvabilité exceptionnelle avec une marge de sécurité très confortable. Recommandation forte pour ce bien.';
  } else if (ratio >= 3.0) {
    zone = 'green';
    grade = 'Excellent';
    status = 'Excellent';
    message = `Ratio excellent de ${ratio.toFixed(1)}x. Le candidat dispose d'une solvabilité solide avec une marge de sécurité confortable.`;
    expertAdvice = 'Profil excellent. Solvabilité solide avec une marge de sécurité confortable. Recommandation forte pour ce bien.';
  } else if (ratio >= 2.5) {
    zone = 'amber';
    grade = 'Bon';
    status = 'Bon';
    message = `Ratio de ${ratio.toFixed(1)}x. Solvabilité correcte, mais proche du seuil recommandé. Une garantie supplémentaire pourrait rassurer.`;
    expertAdvice = 'Profil bon. Solvabilité correcte mais proche du seuil recommandé. Une garantie supplémentaire ou un garant pourrait renforcer la candidature.';
  } else if (ratio >= 2.0) {
    zone = 'amber';
    grade = 'Suffisant';
    status = 'Suffisant';
    message = `Ratio de ${ratio.toFixed(1)}x. Solvabilité suffisante mais en deçà des recommandations standards. Une garantie est fortement recommandée.`;
    expertAdvice = 'Profil suffisant. Solvabilité en deçà des recommandations standards. Une garantie est fortement recommandée pour sécuriser le dossier.';
  } else {
    zone = 'red';
    grade = 'Insuffisant';
    status = 'Insuffisant';
    message = `Ratio de ${ratio.toFixed(1)}x. Solvabilité insuffisante. Ce profil nécessite impérativement une garantie solide ou un garant avec revenus significatifs.`;
    expertAdvice = 'Profil insuffisant. Solvabilité en deçà du seuil minimum. Une garantie solide ou un garant avec revenus significatifs est impératif.';
  }

  // Conseils spécifiques selon le profil
  if (profile === 'STUDENT' && ratio < 3.0) {
    expertAdvice += ' Pour les étudiants, la présence d\'un garant avec revenus stables est essentielle pour compenser la solvabilité.';
  } else if (profile === 'INDEPENDENT' && ratio < 3.0) {
    expertAdvice += ' Pour les indépendants, un historique de revenus stable et une garantie bancaire peuvent renforcer le dossier.';
  }

  return {
    ratio,
    zone,
    grade,
    status,
    message,
    personalRatio,
    combinedRatio,
    expertAdvice,
  };
}
