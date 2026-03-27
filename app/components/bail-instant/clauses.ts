import { Clause } from "./types";

/**
 * Liste complète des clauses optionnelles disponibles
 */
export function getAllClauses(): Clause[] {
  return [
    // Équipements Tech
    {
      id: "clause-wifi",
      title: "Wi-Fi Haut Débit",
      description: "Connexion internet fibre incluse",
      category: "TECH",
      content: "Le logement dispose d'une connexion internet haut débit (fibre optique) incluse dans les charges. Le locataire s'engage à utiliser cette connexion de manière raisonnable et à ne pas effectuer d'activités illégales.",
      isPremium: true
    },
    {
      id: "clause-climatisation",
      title: "Climatisation Réversible",
      description: "Système de climatisation réversible",
      category: "TECH",
      content: "Le logement est équipé d'un système de climatisation réversible. L'entretien et la maintenance sont à la charge du locataire. En cas de panne, le locataire doit en informer le propriétaire dans les 48 heures.",
      isPremium: true
    },
    {
      id: "clause-ventilation",
      title: "Ventilation Mécanique",
      description: "VMC double flux avec récupération de chaleur",
      category: "TECH",
      content: "Le logement dispose d'une ventilation mécanique contrôlée (VMC) double flux avec récupération de chaleur. Le locataire s'engage à maintenir les bouches d'aération dégagées et à signaler tout dysfonctionnement.",
      isPremium: true
    },
    {
      id: "clause-domotique",
      title: "Domotique Intelligente",
      description: "Système domotique pour la gestion du logement",
      category: "TECH",
      content: "Le logement est équipé d'un système domotique permettant la gestion à distance de l'éclairage, du chauffage et de la sécurité. Le locataire s'engage à utiliser ce système conformément aux instructions fournies.",
      isPremium: true
    },

    // Matériaux & Luxe
    {
      id: "clause-parquet",
      title: "Parquet Massif",
      description: "Parquet en bois massif de qualité",
      category: "LUXE",
      content: "Le logement dispose d'un parquet en bois massif de qualité. Le locataire s'engage à entretenir ce parquet selon les recommandations du propriétaire et à utiliser des protections adaptées sous les meubles.",
      isPremium: true
    },
    {
      id: "clause-electromenager",
      title: "Électroménager Premium",
      description: "Électroménager haut de gamme inclus",
      category: "LUXE",
      content: "Le logement est équipé d'électroménager haut de gamme (lave-linge, lave-vaisselle, réfrigérateur). Le locataire s'engage à utiliser ces équipements conformément aux instructions et à signaler toute anomalie.",
      isPremium: true
    },
    {
      id: "clause-securite",
      title: "Système de Sécurité",
      description: "Alarme et vidéosurveillance",
      category: "LUXE",
      content: "Le logement est équipé d'un système d'alarme et de vidéosurveillance. Le locataire s'engage à activer ce système en cas d'absence prolongée et à respecter les consignes de sécurité.",
      isPremium: true
    },

    // Entretien Système
    {
      id: "clause-chaudiere",
      title: "Entretien Chaudière",
      description: "Entretien annuel de la chaudière inclus",
      category: "ENTRETIEN",
      content: "L'entretien annuel de la chaudière est pris en charge par le propriétaire. Le locataire doit permettre l'accès aux techniciens pour les interventions programmées et signaler toute anomalie.",
    },
    {
      id: "clause-ascenseur",
      title: "Ascenseur",
      description: "Ascenseur avec maintenance incluse",
      category: "ENTRETIEN",
      content: "Le logement dispose d'un ascenseur dont la maintenance est assurée par le propriétaire. Le locataire s'engage à utiliser l'ascenseur de manière responsable et à signaler tout dysfonctionnement.",
    },
    {
      id: "clause-volets",
      title: "Volets Automatiques",
      description: "Volets roulants électriques",
      category: "ENTRETIEN",
      content: "Le logement est équipé de volets roulants électriques. Le locataire s'engage à utiliser ces volets de manière raisonnable et à signaler toute panne dans les 48 heures.",
    },

    // Usage & Vie
    {
      id: "clause-animaux",
      title: "Animaux Autorisés",
      description: "Autorisation d'animaux de compagnie",
      category: "USAGE",
      content: "Les animaux de compagnie sont autorisés sous réserve d'une déclaration préalable au propriétaire. Le locataire s'engage à maintenir les lieux propres et à réparer tout dommage causé par l'animal.",
    },
    {
      id: "clause-teletravail",
      title: "Télétravail Autorisé",
      description: "Autorisation de télétravail à domicile",
      category: "USAGE",
      content: "Le télétravail est autorisé dans le logement. Le locataire s'engage à utiliser le logement à des fins professionnelles de manière raisonnable et à respecter les règles de copropriété.",
    },
    {
      id: "clause-parking",
      title: "Place de Parking",
      description: "Place de parking privée incluse",
      category: "USAGE",
      content: "Une place de parking privée est mise à disposition du locataire. Cette place est réservée exclusivement au véhicule du locataire et ne peut être sous-louée sans autorisation écrite du propriétaire.",
      isPremium: true
    },
  ];
}

/**
 * Formate les clauses pour l'envoi au backend
 */
export function formatClausesForBackend(selectedClauses: string[], customClause: string): string {
  const allClauses = getAllClauses();
  const clausesText: string[] = [];

  selectedClauses.forEach((clauseId) => {
    const clause = allClauses.find(c => c.id === clauseId);
    if (clause) {
      clausesText.push(`${clause.title}\n${clause.content}`);
    }
  });

  if (customClause.trim().length > 0) {
    clausesText.push(customClause);
  }

  return clausesText.join("\n\n");
}
