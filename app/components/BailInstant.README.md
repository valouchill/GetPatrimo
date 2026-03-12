# Module BailInstant

Module de génération automatique de bail et d'acte de cautionnement avec interface split-view Luxe-Tech.

## Vue d'ensemble

Le module BailInstant permet de générer automatiquement un bail de location et un acte de cautionnement sans aucune saisie manuelle, en héritant intelligemment des données du bien, du locataire et du garant.

## Fonctionnalités

### 1. Interface Split-View (Prestige Design)
- **Panneau de Configuration (Gauche - 40%)** : Smart Cards interactives pour la configuration
- **Prévisualisation PDF (Droite - 60%)** : Affichage élégant du bail en temps réel

### 2. Smart Fill Automatique
Le système hérite automatiquement des données :
- **Du Bien** : Adresse, loyer, charges via l'annonce
- **Du Locataire** : Nom, prénom, email, téléphone, revenus via PatrimoTrust™
- **Du Garant** : Si applicable, informations du garant

### 3. Sélecteur de Garantie Intelligent
- **Visale** : Champ pour le numéro de Visa (pré-rempli si trouvé)
- **Physique** : Carte résumé du garant avec nom et revenus certifiés
- **Aucun** : Option pour location sans garant

### 4. Date d'Entrée
- Sélecteur de date via calendrier minimaliste
- Validation automatique (date future uniquement)

### 5. Bouton d'Action Luxe
- Animation Framer Motion lors du clic
- Affichage des étapes visuelles : Locataire → Garant → Vous
- États : Idle → Sending → Sent

## Utilisation

```tsx
import BailInstant from "./components/BailInstant";

function MyPage() {
  const property = {
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

  const tenant = {
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

  const handleGenerate = (leaseData) => {
    // Appeler votre API pour créer le bail
    console.log("Bail généré :", leaseData);
  };

  return (
    <BailInstant
      property={property}
      tenant={tenant}
      onGenerate={handleGenerate}
    />
  );
}
```

## Props

| Prop | Type | Description | Requis |
|------|------|-------------|--------|
| `property` | `Property` | Objet contenant les informations du bien | ✅ |
| `tenant` | `Tenant` | Objet contenant les informations du locataire | ✅ |
| `onGenerate` | `(leaseData: LeaseData) => void` | Callback appelé lors de la génération | ❌ |

## Structure des Données

### Property
```typescript
interface Property {
  _id: string;
  name: string;
  address: string;
  addressLine: string;
  zipCode: string;
  city: string;
  rentAmount: number;
  chargesAmount: number;
  surfaceM2?: number;
}
```

### Tenant
```typescript
interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  monthlyNetIncome: number;
  contractType: string;
  hasGuarantor: boolean;
  guarantorType: string;
  trustAnalysis?: {
    score: number;
    status: string;
  };
}
```

### LeaseData (retourné par onGenerate)
```typescript
interface LeaseData {
  startDate: Date;
  endDate?: Date;
  rentAmount: number;
  chargesAmount: number;
  depositAmount: number;
  guarantorType: "VISALE" | "PHYSIQUE" | "NONE";
  guarantor?: Guarantor;
  additionalClauses: string;
}
```

## Design System

- **Palette** : Navy (#0F172A), Emerald (#10B981), Slate (#F8FAFC)
- **Typographie** : Serif (Playfair Display) pour les titres, Sans (Inter) pour le texte
- **Bordures** : Fines (1-2px), arrondies (rounded-xl)
- **Espacements** : Généreux (p-6, gap-6, space-y-4)
- **Animations** : Framer Motion pour les transitions fluides

## Composants Internes

### SmartCard
Carte interactive avec icône, titre et indicateur de complétude.

### GuarantorSelector
Sélecteur graphique pour le type de garantie avec formulaires conditionnels.

### PDFPreview
Prévisualisation stylisée du document de bail avec mise en page professionnelle.

## Intégration Backend

Pour intégrer avec votre backend, utilisez le callback `onGenerate` :

```typescript
const handleGenerate = async (leaseData: LeaseData) => {
  try {
    const response = await fetch("/api/leases/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: property._id,
        candidatureId: tenant._id,
        ...leaseData,
      }),
    });
    
    const result = await response.json();
    // Rediriger vers la page de signature ou afficher un message de succès
  } catch (error) {
    console.error("Erreur lors de la génération du bail :", error);
  }
};
```

## Exemple Complet

Voir `BailInstant.example.tsx` pour un exemple complet d'utilisation.
