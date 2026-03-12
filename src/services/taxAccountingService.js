/**
 * Moteur Comptable BIC (Bénéfices Industriels et Commerciaux)
 * Reproduit la logique de la Plaquette BIC
 * Ventilation : Terrain (non amortissable), Construction, Mobilier
 * Génère le Compte de Résultat (Recettes - Charges - Amortissements)
 */

/**
 * Structure comptable d'un bien immobilier locatif
 */
class PropertyAccounting {
  constructor(propertyId, anneeFiscale) {
    this.propertyId = propertyId;
    this.anneeFiscale = anneeFiscale;
    
    // RECETTES
    this.recettes = {
      loyers: 0, // Loyers perçus
      chargesRecuperees: 0, // Charges récupérées sur locataire
      autres: 0 // Autres recettes (ex: parking, garage)
    };
    
    // CHARGES
    this.charges = {
      // Charges déductibles
      travaux: 0, // Travaux < 500€ (non amortissables)
      mobilier: 0, // Mobilier (amortissable)
      taxeFonciere: 0, // Taxe foncière
      teom: 0, // TEOM (déductible)
      assurance: 0, // Assurance PNO
      gestion: 0, // Frais de gestion
      comptabilite: 0, // Frais comptables
      publicite: 0, // Publicité
      fraisNotaire: 0, // Frais de notaire (amortissable 1ère année)
      autres: 0 // Autres charges déductibles
    };
    
    // AMORTISSEMENTS
    this.amortissements = {
      construction: 0, // Construction (2.5% / an sur 40 ans)
      mobilier: 0, // Mobilier (10% / an sur 10 ans)
      fraisNotaire: 0 // Frais de notaire (amortissable sur 5 ans)
    };
    
    // VENTILATION DU PRIX D'ACHAT
    this.ventilationAchat = {
      terrain: 0, // Terrain (non amortissable)
      construction: 0, // Construction (amortissable)
      fraisNotaire: 0 // Frais de notaire (amortissable)
    };
  }

  /**
   * Ajoute une recette
   */
  addRecette(type, montant) {
    if (type === 'loyer') {
      this.recettes.loyers += Number(montant || 0);
    } else if (type === 'charges') {
      this.recettes.chargesRecuperees += Number(montant || 0);
    } else {
      this.recettes.autres += Number(montant || 0);
    }
  }

  /**
   * Ajoute une charge
   */
  addCharge(type, montant) {
    const m = Number(montant || 0);
    
    switch (type) {
      case 'travaux':
        this.charges.travaux += m;
        break;
      case 'mobilier':
        this.charges.mobilier += m;
        break;
      case 'taxe_fonciere':
        this.charges.taxeFonciere += m;
        break;
      case 'teom':
        this.charges.teom += m;
        break;
      case 'assurance':
        this.charges.assurance += m;
        break;
      case 'gestion':
        this.charges.gestion += m;
        break;
      case 'comptabilite':
        this.charges.comptabilite += m;
        break;
      case 'publicite':
        this.charges.publicite += m;
        break;
      case 'frais_notaire':
        this.charges.fraisNotaire += m;
        break;
      default:
        this.charges.autres += m;
    }
  }

  /**
   * Calcule les amortissements annuels
   * @param {Object} ventilationAchat - { terrain, construction, fraisNotaire }
   * @param {number} anneeAcquisition - Année d'acquisition
   */
  calculateAmortissements(ventilationAchat, anneeAcquisition) {
    const anneeCourante = this.anneeFiscale;
    const anneesDepuisAcquisition = anneeCourante - anneeAcquisition + 1;
    
    // Construction : 2.5% / an sur 40 ans
    if (ventilationAchat.construction > 0 && anneesDepuisAcquisition <= 40) {
      this.amortissements.construction = ventilationAchat.construction * 0.025;
    }
    
    // Mobilier : 10% / an sur 10 ans (déjà comptabilisé dans charges.mobilier)
    // L'amortissement du mobilier se fait sur les achats de mobilier
    // Ici on calcule l'amortissement du mobilier acheté cette année
    if (this.charges.mobilier > 0) {
      this.amortissements.mobilier = this.charges.mobilier * 0.10;
    }
    
    // Frais de notaire : amortissable sur 5 ans (20% / an)
    if (ventilationAchat.fraisNotaire > 0 && anneesDepuisAcquisition <= 5) {
      this.amortissements.fraisNotaire = ventilationAchat.fraisNotaire * 0.20;
    }
    
    // Amortissement mobilier existant (si base de données)
    // Pour simplifier, on suppose que le mobilier existant est déjà amorti
  }

  /**
   * Génère le Compte de Résultat
   */
  generateCompteResultat() {
    const totalRecettes = 
      this.recettes.loyers + 
      this.recettes.chargesRecuperees + 
      this.recettes.autres;
    
    const totalCharges = 
      this.charges.travaux +
      this.charges.mobilier +
      this.charges.taxeFonciere +
      this.charges.teom +
      this.charges.assurance +
      this.charges.gestion +
      this.charges.comptabilite +
      this.charges.publicite +
      this.charges.fraisNotaire +
      this.charges.autres;
    
    const totalAmortissements = 
      this.amortissements.construction +
      this.amortissements.mobilier +
      this.amortissements.fraisNotaire;
    
    const resultatAvantImpot = totalRecettes - totalCharges - totalAmortissements;
    
    return {
      recettes: {
        total: totalRecettes,
        detail: this.recettes
      },
      charges: {
        total: totalCharges,
        detail: this.charges
      },
      amortissements: {
        total: totalAmortissements,
        detail: this.amortissements
      },
      resultat: resultatAvantImpot,
      resultatNet: resultatAvantImpot // Avant impôt sur le revenu
    };
  }

  /**
   * Ventile le prix d'achat entre Terrain et Construction
   * Règle : Terrain = 20% du prix (estimation), Construction = 80%
   * @param {number} prixAchat - Prix d'achat total
   * @param {number} fraisNotaire - Frais de notaire
   * @param {number} [pourcentageTerrain=20] - % terrain (défaut 20%)
   */
  ventilerPrixAchat(prixAchat, fraisNotaire, pourcentageTerrain = 20) {
    const prixHT = Number(prixAchat || 0);
    const frais = Number(fraisNotaire || 0);
    
    this.ventilationAchat.terrain = prixHT * (pourcentageTerrain / 100);
    this.ventilationAchat.construction = prixHT * ((100 - pourcentageTerrain) / 100);
    this.ventilationAchat.fraisNotaire = frais;
    
    return this.ventilationAchat;
  }
}

/**
 * Calcule le résultat fiscal pour un bien
 * @param {Object} property - Données du bien
 * @param {Array} documents - Documents fiscaux de l'année
 * @param {number} anneeFiscale - Année fiscale
 * @returns {Object} - Compte de résultat
 */
function calculateFiscalResult(property, documents, anneeFiscale) {
  const accounting = new PropertyAccounting(property._id, anneeFiscale);
  
  // Ventilation du prix d'achat
  const prixAchat = Number(property.purchasePrice || property.estimatedValue || 0);
  const fraisNotaire = prixAchat * 0.08; // Estimation 8% frais de notaire
  accounting.ventilerPrixAchat(prixAchat, fraisNotaire);
  
  // Traitement des documents
  documents.forEach(doc => {
    const processed = doc.processed || {};
    
    switch (doc.documentType) {
      case 'facture_travaux':
        // Travaux < 500€ : charge directe
        // Travaux >= 500€ : amortissable (géré séparément)
        if (processed.montantAmortissable) {
          // Pour simplifier, on considère comme charge cette année
          // En réalité, les travaux >= 500€ sont amortis sur plusieurs années
          accounting.addCharge('travaux', processed.montantAmortissable);
        } else {
          accounting.addCharge('travaux', processed.montantTotalHT);
        }
        break;
        
      case 'facture_mobilier':
        accounting.addCharge('mobilier', processed.montantHT);
        break;
        
      case 'taxe_fonciere':
        accounting.addCharge('taxe_fonciere', processed.montantTaxeFonciere);
        accounting.addCharge('teom', processed.montantTEOM);
        break;
        
      case 'quittance':
        // Les quittances sont des recettes (loyers perçus)
        accounting.addRecette('loyer', processed.montantLoyerHC);
        accounting.addRecette('charges', processed.montantCharges);
        break;
    }
  });
  
  // Ajout des recettes de loyer mensuel
  const loyerMensuel = Number(property.rentAmount || 0);
  const chargesMensuelles = Number(property.chargesAmount || 0);
  const moisLoues = 12; // Simplification : 12 mois
  
  accounting.addRecette('loyer', loyerMensuel * moisLoues);
  accounting.addRecette('charges', chargesMensuelles * moisLoues);
  
  // Calcul des amortissements
  const anneeAcquisition = property.purchaseDate 
    ? new Date(property.purchaseDate).getFullYear()
    : anneeFiscale;
  
  accounting.calculateAmortissements(accounting.ventilationAchat, anneeAcquisition);
  
  return accounting.generateCompteResultat();
}

module.exports = {
  PropertyAccounting,
  calculateFiscalResult
};
