/**
 * Assistant Déclaration & Pré-remplissage 2042C PRO
 * Réplique le document 2042C PRO et indique précisément les montants à saisir
 */

/**
 * Structure de la déclaration 2042C PRO
 * Réplique les cases du formulaire officiel
 */
class Declaration2042C {
  constructor(anneeFiscale) {
    this.anneeFiscale = anneeFiscale;
    
    // SECTION 5 : REVENUS FONCIERS
    this.section5 = {
      // 5NA : Revenus bruts (loyers)
      revenusBruts: 0,
      
      // 5NB : Charges déductibles
      chargesDeductibles: 0,
      
      // 5NC : Amortissements
      amortissements: 0,
      
      // 5ND : Déficit imputable sur le revenu global
      deficitImputable: 0,
      
      // 5NE : Déficit reportable
      deficitReportable: 0,
      
      // 5NF : Revenus nets imposables
      revenusNets: 0,
      
      // 5NG : Abattement 30% (si Micro-BIC)
      abattement30: 0,
      
      // 5NH : Revenus nets après abattement
      revenusNetsApresAbattement: 0,
      
      // 5NY : Déficit foncier (si régime réel)
      deficitFoncier: 0
    };
  }

  /**
   * Remplit la déclaration à partir du compte de résultat
   * @param {Object} compteResultat - Compte de résultat généré
   * @param {string} regime - 'reel' ou 'micro'
   */
  fillFromCompteResultat(compteResultat, regime = 'reel') {
    // 5NA : Revenus bruts
    this.section5.revenusBruts = compteResultat.recettes.total;
    
    if (regime === 'reel') {
      // Régime réel : charges déductibles + amortissements
      this.section5.chargesDeductibles = compteResultat.charges.total;
      this.section5.amortissements = compteResultat.amortissements.total;
      
      // 5NF : Revenus nets = Recettes - Charges - Amortissements
      this.section5.revenusNets = compteResultat.resultat;
      
      // Si déficit (revenusNets < 0)
      if (this.section5.revenusNets < 0) {
        // 5NY : Déficit foncier (reportable sur 10 ans)
        this.section5.deficitFoncier = Math.abs(this.section5.revenusNets);
        this.section5.revenusNets = 0;
      }
    } else {
      // Régime Micro-BIC : abattement 30%
      this.section5.abattement30 = compteResultat.recettes.total * 0.30;
      this.section5.revenusNetsApresAbattement = compteResultat.recettes.total * 0.70;
      this.section5.revenusNets = this.section5.revenusNetsApresAbattement;
    }
    
    return this;
  }

  /**
   * Génère le guide de saisie pour impots.gouv.fr
   */
  generateSaisieGuide() {
    const guide = [];
    
    guide.push({
      etape: 1,
      titre: "Accéder à la déclaration en ligne",
      instruction: "Connectez-vous sur impots.gouv.fr et accédez à votre espace personnel",
      lien: "https://www.impots.gouv.fr"
    });
    
    guide.push({
      etape: 2,
      titre: "Section Revenus Fonciers",
      instruction: "Rendez-vous dans la section 'Revenus fonciers' (formulaire 2042C PRO)",
      cases: [
        {
          numero: "5NA",
          libelle: "Revenus bruts (loyers perçus)",
          montant: this.section5.revenusBruts,
          instruction: `Saisissez ${this.section5.revenusBruts.toFixed(2)}€ dans la case 5NA`
        },
        {
          numero: "5NB",
          libelle: "Charges déductibles",
          montant: this.section5.chargesDeductibles,
          instruction: this.section5.chargesDeductibles > 0 
            ? `Saisissez ${this.section5.chargesDeductibles.toFixed(2)}€ dans la case 5NB`
            : "Laissez vide (0€)"
        },
        {
          numero: "5NC",
          libelle: "Amortissements",
          montant: this.section5.amortissements,
          instruction: this.section5.amortissements > 0
            ? `Saisissez ${this.section5.amortissements.toFixed(2)}€ dans la case 5NC`
            : "Laissez vide (0€)"
        }
      ]
    });
    
    if (this.section5.revenusNets < 0) {
      guide.push({
        etape: 3,
        titre: "Déficit foncier",
        instruction: "Vous avez un déficit foncier reportable sur 10 ans",
        cases: [
          {
            numero: "5NY",
            libelle: "Déficit foncier",
            montant: this.section5.deficitFoncier,
            instruction: `Saisissez ${this.section5.deficitFoncier.toFixed(2)}€ dans la case 5NY`
          }
        ]
      });
    } else {
      guide.push({
        etape: 3,
        titre: "Revenus nets imposables",
        instruction: "Vérifiez que le montant calculé correspond",
        cases: [
          {
            numero: "5NF",
            libelle: "Revenus nets imposables",
            montant: this.section5.revenusNets,
            instruction: `Le montant ${this.section5.revenusNets.toFixed(2)}€ doit apparaître automatiquement dans la case 5NF`
          }
        ]
      });
    }
    
    guide.push({
      etape: 4,
      titre: "Validation",
      instruction: "Vérifiez tous les montants et validez votre déclaration",
      important: "Conservez tous vos justificatifs (factures, quittances) pendant 3 ans"
    });
    
    return guide;
  }

  /**
   * Génère le récapitulatif pour affichage
   */
  generateRecap() {
    return {
      annee: this.anneeFiscale,
      section5: this.section5,
      guide: this.generateSaisieGuide()
    };
  }
}

/**
 * Crée une déclaration pré-remplie à partir des données d'un bien
 * @param {Object} compteResultat - Compte de résultat
 * @param {string} regime - 'reel' ou 'micro'
 * @param {number} anneeFiscale - Année fiscale
 * @returns {Object} - Déclaration pré-remplie avec guide
 */
function createDeclaration(compteResultat, regime, anneeFiscale) {
  const declaration = new Declaration2042C(anneeFiscale);
  declaration.fillFromCompteResultat(compteResultat, regime);
  return declaration.generateRecap();
}

module.exports = {
  Declaration2042C,
  createDeclaration
};
