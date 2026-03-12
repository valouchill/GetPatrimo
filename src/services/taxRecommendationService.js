/**
 * Algorithme de Recommandation & Optimisation Fiscale
 * Arbitrage : Réel vs Micro-BIC
 * Alertes Seuils : 10 000€ (compte bancaire), 23 000€ (statut LMP)
 * Conseils Proactifs : Déduction frais notaire, récupération TEOM
 */

/**
 * Compare les deux régimes et recommande le plus avantageux
 * @param {Object} compteResultatReel - Compte de résultat régime réel
 * @param {number} revenusBruts - Revenus bruts annuels
 * @returns {Object} - Comparaison et recommandation
 */
function compareRegimes(compteResultatReel, revenusBruts) {
  // Régime Micro-BIC : abattement 30%
  const revenusMicro = revenusBruts * 0.70; // Revenus nets après abattement
  
  // Régime Réel : revenus nets = recettes - charges - amortissements
  const revenusReel = compteResultatReel.resultat;
  
  // Calcul de l'économie d'impôt (taux marginal supposé 30% pour exemple)
  const tauxMarginal = 0.30; // À adapter selon la tranche d'imposition
  const impotMicro = revenusMicro * tauxMarginal;
  const impotReel = Math.max(0, revenusReel) * tauxMarginal;
  
  const economie = impotMicro - impotReel;
  
  // Recommandation
  let recommandation = 'micro';
  let raison = '';
  
  if (revenusReel < revenusMicro) {
    recommandation = 'reel';
    raison = `Le régime réel est plus avantageux : vous économisez ${economie.toFixed(2)}€ d'impôts par an.`;
  } else {
    recommandation = 'micro';
    raison = `Le régime micro-BIC est plus simple et suffisant pour votre situation.`;
  }
  
  return {
    micro: {
      revenusNets: revenusMicro,
      impotEstime: impotMicro,
      avantages: [
        "Déclaration simplifiée",
        "Pas de comptabilité détaillée",
        "Abattement automatique 30%"
      ],
      inconvenients: [
        "Pas de déduction des charges réelles",
        "Pas d'amortissement"
      ]
    },
    reel: {
      revenusNets: revenusReel,
      impotEstime: impotReel,
      avantages: [
        "Déduction de toutes les charges réelles",
        "Amortissements déductibles",
        "Déficit reportable sur 10 ans"
      ],
      inconvenients: [
        "Comptabilité détaillée requise",
        "Déclaration plus complexe"
      ]
    },
    recommandation,
    raison,
    economiePotentielle: economie > 0 ? economie : 0
  };
}

/**
 * Vérifie les seuils et génère des alertes
 * @param {Object} compteResultat - Compte de résultat
 * @param {number} revenusBruts - Revenus bruts annuels
 * @returns {Array} - Liste des alertes
 */
function checkSeuils(compteResultat, revenusBruts) {
  const alertes = [];
  
  // Seuil 10 000€ : compte bancaire professionnel recommandé
  if (revenusBruts >= 10000 && revenusBruts < 10000 * 1.1) {
    alertes.push({
      type: 'seuil',
      code: 'SEUIL_10000',
      niveau: 'warning',
      titre: 'Seuil 10 000€ approché',
      message: 'À partir de 10 000€ de revenus fonciers, l\'ouverture d\'un compte bancaire professionnel est recommandée.',
      action: 'Ouvrir un compte bancaire professionnel'
    });
  }
  
  if (revenusBruts >= 10000) {
    alertes.push({
      type: 'seuil',
      code: 'SEUIL_10000_DEPASSE',
      niveau: 'info',
      titre: 'Compte bancaire professionnel recommandé',
      message: 'Vous dépassez 10 000€ de revenus fonciers. Un compte bancaire professionnel facilite la gestion.',
      action: 'Consulter votre banque'
    });
  }
  
  // Seuil 23 000€ : statut LMP (Loueur en Meublé Professionnel)
  if (revenusBruts >= 23000 && revenusBruts < 23000 * 1.1) {
    alertes.push({
      type: 'seuil',
      code: 'SEUIL_23000',
      niveau: 'warning',
      titre: 'Seuil LMP (23 000€) approché',
      message: 'À partir de 23 000€ de revenus fonciers meublés, vous pouvez bénéficier du statut LMP (Loueur en Meublé Professionnel) avec des avantages fiscaux.',
      action: 'Consulter un expert-comptable pour le statut LMP'
    });
  }
  
  if (revenusBruts >= 23000) {
    alertes.push({
      type: 'seuil',
      code: 'SEUIL_23000_DEPASSE',
      niveau: 'success',
      titre: 'Éligible au statut LMP',
      message: 'Vous êtes éligible au statut LMP (Loueur en Meublé Professionnel). Avantages : BIC au lieu de BNC, possibilité de déduire un abattement forfaitaire de 50% ou 71%.',
      action: 'Demander le statut LMP à l\'administration fiscale'
    });
  }
  
  return alertes;
}

/**
 * Génère des conseils proactifs selon la situation
 * @param {Object} property - Données du bien
 * @param {Object} compteResultat - Compte de résultat
 * @param {Array} documents - Documents fiscaux
 * @returns {Array} - Liste des conseils
 */
function generateConseils(property, compteResultat, documents) {
  const conseils = [];
  
  // Vérifier si frais de notaire déductibles (1ère année)
  const anneeAcquisition = property.purchaseDate 
    ? new Date(property.purchaseDate).getFullYear()
    : null;
  const anneeCourante = new Date().getFullYear();
  
  if (anneeAcquisition === anneeCourante) {
    const fraisNotaire = Number(property.purchasePrice || 0) * 0.08; // Estimation 8%
    
    conseils.push({
      type: 'conseil',
      code: 'FRAIS_NOTAIRE_1ERE_ANNEE',
      niveau: 'info',
      titre: 'Déduction frais de notaire',
      message: `Vous pouvez déduire les frais de notaire (estimés à ${fraisNotaire.toFixed(2)}€) en amortissement sur 5 ans (20% par an).`,
      montant: fraisNotaire,
      action: 'Ajouter les frais de notaire dans vos charges déductibles'
    });
  }
  
  // Vérifier si TEOM récupérable
  const taxeFonciereDoc = documents.find(d => d.documentType === 'taxe_fonciere');
  if (taxeFonciereDoc && taxeFonciereDoc.processed?.montantTEOM > 0) {
    conseils.push({
      type: 'conseil',
      code: 'RECUPERATION_TEOM',
      niveau: 'success',
      titre: 'Récupération TEOM',
      message: `La TEOM (Taxe d'Enlèvement des Ordures Ménagères) de ${taxeFonciereDoc.processed.montantTEOM.toFixed(2)}€ est déductible de vos revenus fonciers.`,
      montant: taxeFonciereDoc.processed.montantTEOM,
      action: 'Vérifier que la TEOM est bien incluse dans vos charges déductibles'
    });
  }
  
  // Vérifier si travaux amortissables non déclarés
  const travauxDocs = documents.filter(d => d.documentType === 'facture_travaux');
  const travauxAmortissables = travauxDocs.filter(d => {
    const montant = d.processed?.montantAmortissable || 0;
    return montant >= 500;
  });
  
  if (travauxAmortissables.length > 0) {
    conseils.push({
      type: 'conseil',
      code: 'TRAVAUX_AMORTISSABLES',
      niveau: 'info',
      titre: 'Travaux amortissables',
      message: `Vous avez ${travauxAmortissables.length} facture(s) de travaux >= 500€ qui peuvent être amorties sur plusieurs années.`,
      action: 'Consulter un expert-comptable pour l\'amortissement des travaux'
    });
  }
  
  // Vérifier si déficit reportable
  if (compteResultat.resultat < 0) {
    conseils.push({
      type: 'conseil',
      code: 'DEFICIT_REPORTABLE',
      niveau: 'success',
      titre: 'Déficit foncier reportable',
      message: `Vous avez un déficit foncier de ${Math.abs(compteResultat.resultat).toFixed(2)}€ reportable sur 10 ans et imputable sur vos autres revenus.`,
      montant: Math.abs(compteResultat.resultat),
      action: 'Déclarer le déficit dans la case 5NY de votre déclaration'
    });
  }
  
  return conseils;
}

/**
 * Génère un rapport complet d'optimisation fiscale
 * @param {Object} property - Données du bien
 * @param {Object} compteResultatReel - Compte de résultat régime réel
 * @param {Array} documents - Documents fiscaux
 * @param {number} anneeFiscale - Année fiscale
 * @returns {Object} - Rapport complet
 */
function generateOptimizationReport(property, compteResultatReel, documents, anneeFiscale) {
  const revenusBruts = compteResultatReel.recettes.total;
  
  const comparaison = compareRegimes(compteResultatReel, revenusBruts);
  const alertes = checkSeuils(compteResultatReel, revenusBruts);
  const conseils = generateConseils(property, compteResultatReel, documents);
  
  return {
    annee: anneeFiscale,
    revenusBruts,
    comparaisonRegimes: comparaison,
    alertes,
    conseils,
    scoreOptimisation: calculateOptimizationScore(comparaison, alertes, conseils)
  };
}

/**
 * Calcule un score d'optimisation fiscale (0-100)
 */
function calculateOptimizationScore(comparaison, alertes, conseils) {
  let score = 50; // Base
  
  // Bonus si régime réel recommandé et avantageux
  if (comparaison.recommandation === 'reel' && comparaison.economiePotentielle > 0) {
    score += 20;
  }
  
  // Bonus si conseils applicables
  score += Math.min(conseils.length * 5, 20);
  
  // Bonus si seuils respectés
  if (alertes.some(a => a.niveau === 'success')) {
    score += 10;
  }
  
  return Math.min(100, score);
}

module.exports = {
  compareRegimes,
  checkSeuils,
  generateConseils,
  generateOptimizationReport
};
