"use client";

import BailInstant from "./BailInstant";

/**
 * Exemple d'utilisation du module BailInstant
 */
export default function BailInstantExample() {
  // Données mockées pour l'exemple
  const mockProperty = {
    _id: "123",
    name: "Appartement T3",
    address: "123 Rue de la République, 75001 Paris",
    addressLine: "123 Rue de la République",
    zipCode: "75001",
    city: "Paris",
    rentAmount: 1200,
    chargesAmount: 150,
    surfaceM2: 65,
  };

  const mockTenant = {
    _id: "456",
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean.dupont@example.com",
    phone: "+33 6 12 34 56 78",
    monthlyNetIncome: 3500,
    contractType: "CDI",
    hasGuarantor: true,
    guarantorType: "VISALE",
    trustAnalysis: {
      score: 85,
      status: "VALIDATED",
    },
  };

  const handleGenerate = (leaseData: any) => {
    console.log("Bail généré avec succès :", leaseData);
    // Rediriger vers la page de suivi du bail ou afficher un message de succès
    console.log("Bail généré avec succès !");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <BailInstant
        property={mockProperty}
        tenant={mockTenant}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
