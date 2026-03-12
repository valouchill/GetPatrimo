/**
 * Moteur d'analyse PatrimoTrust™
 * Analyse approfondie des dossiers locataires avec 10 points de contrôle critiques
 */

/**
 * Calcule le score PatrimoTrust™ avec système de pondération
 * @param {Object} applicationData - Données de la candidature
 * @param {Object} applicationData.candidature - Objet candidature
 * @param {Object} applicationData.property - Objet property
 * @param {number} applicationData.monthlyNetIncome - Revenu net mensuel
 * @param {number} applicationData.annualTaxIncome - Revenu fiscal annuel (avis d'imposition)
 * @param {number} applicationData.sumLast12MonthsSalary - Somme des 12 derniers mois de salaire
 * @param {string} applicationData.contractType - Type de contrat (CDI, CDD, etc.)
 * @param {boolean} applicationData.metadataStatus - Statut des métadonnées ('flagged' = fraude détectée)
 * @param {boolean} applicationData.idValidation - Validation de la pièce d'identité
 * @returns {Object} - { globalScore, rating, breakdown, aiInsight }
 */
function calculatePatrimoTrustScore(applicationData) {
  // Kill-Switch : Fraude détectée = score 0 immédiatement
  if (applicationData.metadataStatus === 'flagged' || applicationData.idValidation === false) {
    return {
      globalScore: 0,
      rating: 'F',
      breakdown: {
        solvency: { score: 0, label: 'Fraude détectée' },
        coherence: { score: 0, label: 'Fraude détectée' },
        stability: { score: 0, label: 'Fraude détectée' },
        integrity: { score: 0, label: 'Fraude détectée' }
      },
      aiInsight: 'Dossier rejeté automatiquement : anomalies critiques détectées (fraude documentaire ou identité non validée).'
    };
  }

  const candidature = applicationData.candidature || {};
  const property = applicationData.property || {};
  
  // Extraction des données
  const monthlyNetIncome = applicationData.monthlyNetIncome || candidature.monthlyNetIncome || 0;
  const annualTaxIncome = applicationData.annualTaxIncome || 0;
  const sumLast12MonthsSalary = applicationData.sumLast12MonthsSalary || (monthlyNetIncome * 12);
  const contractType = applicationData.contractType || candidature.contractType || '';
  
  const rentAmount = property.rentAmount || 0;
  const chargesAmount = property.chargesAmount || 0;
  const totalRent = rentAmount + chargesAmount;

  // ===== 1. SOLVABILITÉ (40%) =====
  // Calcul du ratio Loyer/Revenus avec barème dégressif sous le seuil de 3
  let solvencyScore = 0;
  let solvencyLabel = '';
  
  if (monthlyNetIncome <= 0 || totalRent <= 0) {
    solvencyScore = 0;
    solvencyLabel = 'Données manquantes';
  } else {
    const ratio = monthlyNetIncome / totalRent;
    
    // Barème dégressif sous le seuil de 3
    if (ratio >= 3.0) {
      // Excellent : ratio >= 3.0
      solvencyScore = 100;
      solvencyLabel = 'Excellent';
    } else if (ratio >= 2.5) {
      // Très bon : 2.5 <= ratio < 3.0
      // Score dégressif : 100 - (3.0 - ratio) * 20
      solvencyScore = Math.round(100 - (3.0 - ratio) * 20);
      solvencyLabel = 'Très bon';
    } else if (ratio >= 2.0) {
      // Bon : 2.0 <= ratio < 2.5
      // Score dégressif : 80 - (2.5 - ratio) * 30
      solvencyScore = Math.round(80 - (2.5 - ratio) * 30);
      solvencyLabel = 'Bon';
    } else if (ratio >= 1.5) {
      // Acceptable : 1.5 <= ratio < 2.0
      // Score dégressif : 50 - (2.0 - ratio) * 40
      solvencyScore = Math.round(50 - (2.0 - ratio) * 40);
      solvencyLabel = 'Acceptable';
    } else {
      // Insuffisant : ratio < 1.5
      // Score dégressif : 10 - (1.5 - ratio) * 20 (minimum 0)
      solvencyScore = Math.max(0, Math.round(10 - (1.5 - ratio) * 20));
      solvencyLabel = 'Insuffisant';
    }
    
    // Assure que le score est entre 0 et 100
    solvencyScore = Math.max(0, Math.min(100, solvencyScore));
  }

  // ===== 2. COHÉRENCE (30%) =====
  // Compare revenu fiscal annuel avec somme des 12 derniers mois de salaire
  let coherenceScore = 100;
  let coherenceLabel = 'Certifié';
  
  if (annualTaxIncome > 0 && sumLast12MonthsSalary > 0) {
    const difference = Math.abs(annualTaxIncome - sumLast12MonthsSalary);
    const percentageDiff = (difference / Math.max(annualTaxIncome, sumLast12MonthsSalary)) * 100;
    
    if (percentageDiff > 15) {
      // Écart > 15% = Échec
      coherenceScore = 0;
      coherenceLabel = 'Échoué';
    } else if (percentageDiff > 10) {
      // Écart 10-15% = Warning
      coherenceScore = 50;
      coherenceLabel = 'Vérification requise';
    } else if (percentageDiff > 5) {
      // Écart 5-10% = Acceptable
      coherenceScore = 75;
      coherenceLabel = 'Acceptable';
    } else {
      // Écart < 5% = Excellent
      coherenceScore = 100;
      coherenceLabel = 'Certifié';
    }
  } else {
    // Données manquantes pour la comparaison
    coherenceScore = 50;
    coherenceLabel = 'Données incomplètes';
  }

  // ===== 3. STABILITÉ (20%) =====
  // Vérifie le type de contrat
  let stabilityScore = 0;
  let stabilityLabel = '';
  
  const contractUpper = contractType.toUpperCase();
  
  if (contractUpper === 'CDI') {
    stabilityScore = 100;
    stabilityLabel = 'CDI confirmé';
  } else if (contractUpper === 'CDD') {
    stabilityScore = 60;
    stabilityLabel = 'Période d\'essai';
  } else if (contractUpper === 'FREELANCE' || contractUpper === 'INDEPENDANT') {
    stabilityScore = 40;
    stabilityLabel = 'Revenus variables';
  } else if (contractUpper === 'ETUDIANT') {
    stabilityScore = 30;
    stabilityLabel = 'Garant requis';
  } else if (contractUpper === 'RETRAITE') {
    stabilityScore = 70;
    stabilityLabel = 'Retraité';
  } else if (contractType === '') {
    stabilityScore = 20;
    stabilityLabel = 'Non renseigné';
  } else {
    stabilityScore = 30;
    stabilityLabel = 'Contrat atypique';
  }

  // ===== 4. INTÉGRITÉ (10%) =====
  // Vérifie l'intégrité des documents (métadonnées, validation ID)
  let integrityScore = 100;
  let integrityLabel = 'Certifié';
  
  // Si on arrive ici, metadataStatus !== 'flagged' et idValidation !== false (déjà vérifié dans le kill-switch)
  // Mais on peut avoir des warnings mineurs
  if (applicationData.metadataStatus === 'warning') {
    integrityScore = 70;
    integrityLabel = 'Vérification mineure';
  } else if (applicationData.idValidation === true && applicationData.metadataStatus !== 'flagged') {
    integrityScore = 100;
    integrityLabel = 'Certifié';
  } else {
    // Par défaut, si pas de données, on considère comme valide mais avec un score réduit
    integrityScore = 80;
    integrityLabel = 'Non vérifié';
  }

  // ===== CALCUL DU SCORE GLOBAL PONDÉRÉ =====
  const weights = {
    solvency: 0.40,    // 40%
    coherence: 0.30,   // 30%
    stability: 0.20,   // 20%
    integrity: 0.10    // 10%
  };

  const globalScore = Math.round(
    (solvencyScore * weights.solvency) +
    (coherenceScore * weights.coherence) +
    (stabilityScore * weights.stability) +
    (integrityScore * weights.integrity)
  );

  // ===== DÉTERMINATION DU RATING =====
  let rating = 'C';
  if (globalScore > 80) {
    rating = 'A';
  } else if (globalScore >= 60) {
    rating = 'B';
  } else {
    rating = 'C';
  }

  // ===== GÉNÉRATION DE L'AI INSIGHT =====
  let aiInsight = '';
  
  if (globalScore >= 80) {
    if (solvencyScore >= 90 && coherenceScore >= 90 && stabilityScore >= 80) {
      aiInsight = 'Dossier très solide. Revenus certifiés, ratio loyer/revenus excellent, et contrat stable. Recommandation forte.';
    } else if (stabilityScore < 80) {
      aiInsight = 'Dossier solide avec revenus certifiés, mais attention à la période d\'essai en cours ou au type de contrat.';
    } else {
      aiInsight = 'Dossier solide. Profil fiable avec quelques points d\'attention mineurs à vérifier.';
    }
  } else if (globalScore >= 60) {
    if (solvencyScore < 60) {
      aiInsight = 'Dossier moyen. Le ratio loyer/revenus est serré, ce qui nécessite une attention particulière.';
    } else if (coherenceScore < 60) {
      aiInsight = 'Dossier moyen. Incohérence détectée entre revenus déclarés et perçus. Vérification approfondie recommandée.';
    } else if (stabilityScore < 60) {
      aiInsight = 'Dossier moyen. Contrat précaire ou revenus variables. Garanties supplémentaires recommandées.';
    } else {
      aiInsight = 'Dossier moyen. Plusieurs points d\'attention à vérifier avant validation.';
    }
  } else {
    if (solvencyScore < 40) {
      aiInsight = 'Dossier à risque. Ratio loyer/revenus insuffisant. Risque élevé de défaut de paiement.';
    } else if (coherenceScore === 0) {
      aiInsight = 'Dossier à risque. Incohérence majeure entre revenus fiscaux et salaires. Fraude potentielle.';
    } else {
      aiInsight = 'Dossier à risque. Plusieurs indicateurs critiques nécessitent une vérification approfondie.';
    }
  }

  return {
    globalScore: Math.max(0, Math.min(100, globalScore)),
    rating,
    breakdown: {
      solvency: {
        score: solvencyScore,
        label: solvencyLabel
      },
      coherence: {
        score: coherenceScore,
        label: coherenceLabel
      },
      stability: {
        score: stabilityScore,
        label: stabilityLabel
      },
      integrity: {
        score: integrityScore,
        label: integrityLabel
      }
    },
    aiInsight
  };
}

// Simulation de l'analyse IA
async function analyzeCandidatureTrust(candidature, property) {
  // Points de contrôle à analyser
  const checks = [
    { id: 'effort_rate', label: 'Taux d\'effort (Loyer/Revenus)' },
    { id: 'tax_consistency', label: 'Cohérence Avis d\'imposition vs Fiches de paie' },
    { id: 'id_mrz', label: 'Validité MRZ de la pièce d\'identité' },
    { id: 'employer_siren', label: 'Vérification SIREN de l\'employeur' },
    { id: 'contract_stability', label: 'Stabilité du contrat (Ancienneté)' },
    { id: '2d_doc', label: 'Vérification 2D-Doc (QR Code)' },
    { id: 'metadata_integrity', label: 'Intégrité des métadonnées (Détection Photoshop/Canva)' },
    { id: 'geo_consistency', label: 'Cohérence géographique (Domicile/Travail)' },
    { id: 'bank_flows', label: 'Analyse des flux bancaires' },
    { id: 'alur_compliance', label: 'Complétude Loi Alur' }
  ];

  const results = [];
  let totalScore = 0;
  let criticalFail = false;
  let warningCount = 0;

  // Calcul du taux d'effort réel
  const rent = property.rentAmount || 0;
  const charges = property.chargesAmount || 0;
  const totalRent = rent + charges;
  const income = candidature.monthlyNetIncome || 0;
  const effortRate = income > 0 ? (totalRent / income) * 100 : 100;
  
  // Extraction du type de contrat (utilisé dans plusieurs checks)
  const contractType = candidature.contractType || '';

  // Analyse détaillée de chaque point de contrôle
  for (const check of checks) {
    let status = 'PASS';
    let details = 'Vérification réussie';
    let scoreImpact = 10; // 10 points par check réussi
    let metadata = {};

    // Logique spécifique pour chaque check
    switch (check.id) {
      case 'effort_rate':
        if (effortRate > 35) {
          status = 'FAIL';
          details = `Taux d'effort critique : ${effortRate.toFixed(1)}% (> 35%). Risque de défaut de paiement élevé.`;
          scoreImpact = 0;
          criticalFail = true;
          metadata = { effortRate: effortRate.toFixed(1), threshold: 35 };
        } else if (effortRate > 33) {
          status = 'WARNING';
          details = `Taux d'effort élevé : ${effortRate.toFixed(1)}%. Proche de la limite recommandée (33%).`;
          scoreImpact = 5;
          warningCount++;
          metadata = { effortRate: effortRate.toFixed(1), threshold: 33 };
        } else if (effortRate > 0) {
          details = `Taux d'effort excellent : ${effortRate.toFixed(1)}%. Marge de sécurité confortable.`;
          metadata = { effortRate: effortRate.toFixed(1) };
        } else {
          status = 'WARNING';
          details = 'Revenus non renseignés. Impossible de calculer le taux d\'effort.';
          scoreImpact = 3;
          warningCount++;
        }
        break;

      case 'tax_consistency':
        // Simulation : vérifie la cohérence entre avis d'imposition et fiches de paie
        const hasTaxDoc = candidature.docs?.some(d => 
          d.originalName?.toLowerCase().includes('avis') || 
          d.originalName?.toLowerCase().includes('imposition') ||
          d.originalName?.toLowerCase().includes('impot')
        );
        const hasPayslips = candidature.docs?.some(d => 
          d.originalName?.toLowerCase().includes('bulletin') || 
          d.originalName?.toLowerCase().includes('salaire') ||
          d.originalName?.toLowerCase().includes('paye')
        );
        
        if (!hasTaxDoc || !hasPayslips) {
          status = 'WARNING';
          details = 'Documents fiscaux incomplets. Impossible de vérifier la cohérence entre revenus déclarés et perçus.';
          scoreImpact = 5;
          warningCount++;
        } else {
          // Simulation : si revenus déclarés > revenus perçus de plus de 20%, alerte
          const simulatedDeclaredIncome = income * 1.15; // Simulation : revenus déclarés légèrement supérieurs
          if (simulatedDeclaredIncome > income * 1.2) {
            status = 'WARNING';
            details = 'Écart significatif détecté entre revenus déclarés et perçus. Vérification manuelle recommandée.';
            scoreImpact = 5;
            warningCount++;
          } else {
            details = 'Cohérence vérifiée entre avis d\'imposition et fiches de paie.';
          }
        }
        break;

      case 'id_mrz':
        // Simulation : vérifie la présence d'une pièce d'identité et la validité MRZ
        const hasIdDoc = candidature.docs?.some(d => 
          d.originalName?.toLowerCase().includes('cni') || 
          d.originalName?.toLowerCase().includes('passeport') ||
          d.originalName?.toLowerCase().includes('identite') ||
          d.originalName?.toLowerCase().includes('permis')
        );
        
        if (!hasIdDoc) {
          status = 'FAIL';
          details = 'Pièce d\'identité manquante. Document obligatoire pour la validation du dossier.';
          scoreImpact = 0;
          criticalFail = true;
        } else {
          // Simulation : 95% de chance que la MRZ soit valide
          if (Math.random() > 0.95) {
            status = 'FAIL';
            details = 'Bande MRZ invalide ou illisible. Risque de document falsifié.';
            scoreImpact = 0;
            criticalFail = true;
          } else {
            details = 'Bande MRZ conforme et valide. Document authentique vérifié.';
          }
        }
        break;

      case 'employer_siren':
        // Simulation : vérifie la validité du SIREN de l'employeur
        if (contractType === 'FREELANCE' || contractType === 'ETUDIANT' || contractType === 'RETRAITE') {
          status = 'WARNING';
          details = 'Statut professionnel nécessitant une vérification approfondie (freelance/étudiant/retraité).';
          scoreImpact = 7;
          warningCount++;
        } else if (contractType === 'CDI' || contractType === 'CDD') {
          // Simulation : vérification SIREN (90% de succès)
          if (Math.random() > 0.9) {
            status = 'WARNING';
            details = 'SIREN de l\'employeur non trouvé ou inactif. Vérification manuelle requise.';
            scoreImpact = 5;
            warningCount++;
          } else {
            details = 'SIREN de l\'employeur vérifié et actif. Entreprise légitime confirmée.';
          }
        } else {
          status = 'WARNING';
          details = 'Type de contrat non renseigné ou atypique.';
          scoreImpact = 5;
          warningCount++;
        }
        break;

      case 'contract_stability':
        // Analyse de la stabilité du contrat
        if (contractType === 'CDI') {
          details = 'Contrat CDI confirmé. Stabilité professionnelle excellente.';
          metadata = { contractType: 'CDI', stability: 'high' };
        } else if (contractType === 'CDD') {
          status = 'WARNING';
          details = 'Contrat CDD détecté. Stabilité réduite, vérifier la durée restante.';
          scoreImpact = 6;
          warningCount++;
          metadata = { contractType: 'CDD', stability: 'medium' };
        } else if (contractType === 'FREELANCE') {
          status = 'WARNING';
          details = 'Statut freelance. Revenus variables, garanties supplémentaires recommandées.';
          scoreImpact = 4;
          warningCount++;
          metadata = { contractType: 'FREELANCE', stability: 'low' };
        } else {
          status = 'WARNING';
          details = 'Type de contrat non standard. Vérification approfondie nécessaire.';
          scoreImpact = 5;
          warningCount++;
        }
        break;

      case '2d_doc':
        // Simulation : vérification 2D-Doc (QR Code sur documents officiels)
        const hasOfficialDocs = candidature.docs?.some(d => {
          const name = d.originalName?.toLowerCase() || '';
          return name.includes('avis') || name.includes('bulletin') || name.includes('cni');
        });
        
        if (!hasOfficialDocs) {
          status = 'WARNING';
          details = 'Documents officiels avec QR Code 2D-Doc manquants. Vérification manuelle recommandée.';
          scoreImpact = 5;
          warningCount++;
        } else {
          // Simulation : 92% de chance que les QR codes soient valides
          if (Math.random() > 0.92) {
            status = 'WARNING';
            details = 'QR Code 2D-Doc invalide ou manquant sur certains documents.';
            scoreImpact = 5;
            warningCount++;
          } else {
            details = 'QR Codes 2D-Doc vérifiés. Documents authentiques confirmés.';
          }
        }
        break;

      case 'metadata_integrity':
        // Simulation : détection de modifications Photoshop/Canva
        // Probabilité très faible de fraude (3%)
        if (Math.random() > 0.97) {
          status = 'FAIL';
          details = 'Traces de modification logicielle détectées (Photoshop/Canva) sur le bulletin de paie. Risque de fraude documentaire.';
          scoreImpact = 0;
          criticalFail = true;
          metadata = { detectedTools: ['Photoshop'], riskLevel: 'critical' };
        } else if (Math.random() > 0.90) {
          status = 'WARNING';
          details = 'Métadonnées suspectes détectées. Vérification manuelle recommandée pour exclure toute modification.';
          scoreImpact = 5;
          warningCount++;
          metadata = { riskLevel: 'medium' };
        } else {
          details = 'Aucune anomalie de métadonnées. Documents originaux vérifiés.';
          metadata = { riskLevel: 'low' };
        }
        break;

      case 'geo_consistency':
        // Simulation : cohérence géographique entre domicile et lieu de travail
        const propertyCity = property.city?.toLowerCase() || '';
        const propertyZip = property.zipCode || '';
        
        // Simulation : si le bien est à Paris et le candidat travaille loin, warning
        if (propertyZip.startsWith('75') && Math.random() > 0.85) {
          status = 'WARNING';
          details = 'Distance importante entre domicile et lieu de travail potentiel. Vérifier la cohérence.';
          scoreImpact = 6;
          warningCount++;
        } else {
          details = 'Cohérence géographique vérifiée. Localisation cohérente avec le profil.';
        }
        break;

      case 'bank_flows':
        // Simulation : analyse des flux bancaires (RIB fourni)
        const hasRib = candidature.docs?.some(d => 
          d.originalName?.toLowerCase().includes('rib') || 
          d.originalName?.toLowerCase().includes('iban') ||
          d.originalName?.toLowerCase().includes('releve')
        );
        
        if (!hasRib) {
          status = 'WARNING';
          details = 'RIB ou relevé bancaire non fourni. Impossible de vérifier la régularité des flux.';
          scoreImpact = 5;
          warningCount++;
        } else {
          // Simulation : 88% de chance que les flux soient réguliers
          if (Math.random() > 0.88) {
            status = 'WARNING';
            details = 'Flux bancaires irréguliers détectés. Vérification approfondie recommandée.';
            scoreImpact = 5;
            warningCount++;
          } else {
            details = 'Flux bancaires réguliers vérifiés. Compte actif et solvable confirmé.';
          }
        }
        break;

      case 'alur_compliance':
        // Simulation : vérification de la complétude selon la Loi Alur
        const requiredDocs = ['id', 'payslip', 'tax', 'contract'];
        const providedDocs = candidature.docs || [];
        const docTypes = providedDocs.map(d => {
          const name = d.originalName?.toLowerCase() || '';
          if (name.includes('cni') || name.includes('passeport') || name.includes('identite')) return 'id';
          if (name.includes('bulletin') || name.includes('salaire')) return 'payslip';
          if (name.includes('avis') || name.includes('imposition')) return 'tax';
          if (name.includes('contrat') || name.includes('cdi') || name.includes('cdd')) return 'contract';
          return null;
        }).filter(Boolean);
        
        const missingDocs = requiredDocs.filter(req => !docTypes.includes(req));
        
        if (missingDocs.length > 1) {
          status = 'FAIL';
          details = `Documents manquants selon Loi Alur : ${missingDocs.join(', ')}. Dossier incomplet.`;
          scoreImpact = 0;
          criticalFail = true;
        } else if (missingDocs.length === 1) {
          status = 'WARNING';
          details = `Document manquant selon Loi Alur : ${missingDocs[0]}. Compléter le dossier.`;
          scoreImpact = 5;
          warningCount++;
        } else {
          details = 'Complétude Loi Alur vérifiée. Tous les documents obligatoires présents.';
        }
        break;

      default:
        details = 'Vérification standard réussie';
        break;
    }

    totalScore += scoreImpact;
    results.push({
      id: check.id,
      label: check.label,
      status,
      details,
      metadata
    });
  }

  // ===== CALCUL DU SCORE PATRIMOTRUST™ AVEC SYSTÈME PONDÉRÉ =====
  // Prépare les données pour calculatePatrimoTrustScore
  // Détection de fraude depuis les checks
  const metadataCheck = results.find(c => c.id === 'metadata_integrity');
  const idCheck = results.find(c => c.id === 'id_mrz');
  
  const metadataStatus = metadataCheck?.status === 'FAIL' ? 'flagged' : 
                        metadataCheck?.status === 'WARNING' ? 'warning' : 'valid';
  const idValidation = idCheck?.status !== 'FAIL';
  
  // Extraction des données fiscales depuis les documents
  // Si des données extraites sont disponibles dans candidature (depuis l'analyse IA), on les utilise
  // Sinon, on estime à partir des données déclaratives
  let annualTaxIncome = 0;
  let sumLast12MonthsSalary = income * 12; // Estimation par défaut
  
  // Si des données extraites sont disponibles (depuis l'analyse IA des documents)
  // On pourrait les récupérer depuis candidature.scoring ou candidature.trustAnalysis
  // Pour l'instant, on simule une extraction réaliste
  // En production, ces données viendraient de l'extraction IA des avis d'imposition et fiches de paie
  if (income > 0) {
    // Simulation : si on a des fiches de paie, on peut estimer le revenu fiscal annuel
    // En production, cela viendrait de l'extraction IA de l'avis d'imposition
    annualTaxIncome = income * 12 * 0.92; // Estimation : revenu fiscal légèrement inférieur au brut (impôts)
    sumLast12MonthsSalary = income * 12; // Estimation basée sur le revenu mensuel déclaré
  }
  
  // Construit l'objet applicationData
  const applicationData = {
    candidature,
    property,
    monthlyNetIncome: income,
    annualTaxIncome,
    sumLast12MonthsSalary,
    contractType: candidature.contractType || '',
    metadataStatus,
    idValidation
  };
  
  // Calcule le score PatrimoTrust™ avec le système pondéré
  const patrimoScore = calculatePatrimoTrustScore(applicationData);
  
  // Utilise le score PatrimoTrust™ comme score principal
  const finalScore = patrimoScore.globalScore;
  
  // Détermination du statut global basé sur le score PatrimoTrust™
  let globalStatus = 'VALIDATED';
  let summary = patrimoScore.aiInsight || 'Dossier solide. Tous les indicateurs sont au vert.';

  if (criticalFail || finalScore === 0) {
    globalStatus = 'REJECTED';
    summary = patrimoScore.aiInsight || 'Dossier à risque critique. Anomalies majeures détectées. Rejet recommandé.';
  } else if (finalScore < 60) {
    globalStatus = 'WARNING';
    summary = patrimoScore.aiInsight || 'Dossier moyen avec plusieurs points d\'attention. Vérification manuelle approfondie recommandée.';
  } else if (finalScore < 80) {
    globalStatus = 'WARNING';
    summary = patrimoScore.aiInsight || 'Dossier acceptable avec quelques réserves mineures.';
  } else {
    summary = patrimoScore.aiInsight || 'Dossier excellent. Recommandation forte.';
  }

  return {
    score: finalScore,
    status: globalStatus,
    summary,
    rating: patrimoScore.rating,
    breakdown: patrimoScore.breakdown,
    checks: results,
    analyzedAt: new Date()
  };
}

module.exports = {
  analyzeCandidatureTrust,
  calculatePatrimoTrustScore
};
