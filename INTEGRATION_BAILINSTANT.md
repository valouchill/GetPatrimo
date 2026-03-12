# Intégration BailInstant - Documentation

## ✅ Étapes Complétées

### 1. Backend - Création du Bail (`createLease`)

**Fichier**: `/opt/doc2loc/src/controllers/leaseController.js`

- ✅ Fonction `createLease` créée
- ✅ Validation des données (propertyId, candidatureId, startDate requis)
- ✅ Vérification des permissions (bien et candidature appartiennent au propriétaire)
- ✅ Création du bail avec toutes les données (locataire, garant, dates, montants)
- ✅ Mise à jour automatique du statut de la candidature (`SELECTED_FOR_LEASE`)
- ✅ Mise à jour automatique du statut du bien (`LEASE_IN_PROGRESS`)
- ✅ Génération asynchrone du PDF du bail
- ✅ Envoi asynchrone des invitations de signature

**Route API**: `POST /api/leases`

**Body attendu**:
```json
{
  "propertyId": "string",
  "candidatureId": "string",
  "startDate": "ISO date string",
  "endDate": "ISO date string (optionnel)",
  "rentAmount": number,
  "chargesAmount": number,
  "depositAmount": number,
  "propertyType": "NU" | "MEUBLE",
  "additionalClauses": "string (optionnel)",
  "guarantorType": "VISALE" | "PHYSIQUE" | "NONE",
  "guarantor": {
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string",
    "address": "string",
    "income": number,
    "profession": "string",
    "visaleNumber": "string (si VISALE)"
  }
}
```

### 2. Génération PDF du Bail (`generateLeasePdf`)

**Fichier**: `/opt/doc2loc/src/services/pdfService.js`

- ✅ Fonction `generateLeasePdf` créée
- ✅ Génération d'un PDF professionnel avec PDFKit
- ✅ Mise en page Luxe-Tech (Navy #0F172A, Emerald #10B981)
- ✅ Sections complètes :
  - En-tête avec titre
  - Article 1 : Objet du contrat (adresse, loyer, charges, surface)
  - Article 2 : Locataire (nom, prénom, email, téléphone)
  - Article 3 : Durée et dates (date d'entrée, dépôt de garantie)
  - Article 4 : Acte de cautionnement (si applicable)
  - Article 5 : Clauses additionnelles (si présentes)
  - Zones de signature
- ✅ Sauvegarde automatique dans `/uploads/leases/`
- ✅ Retourne le chemin relatif du PDF pour stockage en DB

### 3. Service de Signature Électronique (`signatureService`)

**Fichier**: `/opt/doc2loc/src/services/signatureService.js`

- ✅ Service complet de gestion des signatures
- ✅ Fonction `sendSignatureInvitations` :
  - Envoie les invitations par email au locataire
  - Envoie les invitations au garant (si applicable)
  - Génère des liens de signature sécurisés
- ✅ Génération de tokens de signature sécurisés (`generateSignatureToken`)
- ✅ Validation de tokens (`validateSignatureToken`)
- ✅ Templates d'emails HTML professionnels :
  - Email pour le locataire
  - Email pour le garant
- ✅ Logging des événements via `eventService`

**Configuration requise**:
- Variable d'environnement `APP_URL` pour les liens de signature
- Variable d'environnement `SIGNATURE_SECRET` pour la sécurité des tokens (optionnel)

### 4. Route API

**Fichier**: `/opt/doc2loc/src/routes/leaseRoutes.js`

- ✅ Route `POST /api/leases` ajoutée
- ✅ Protection par authentification (`auth` middleware)
- ✅ Intégration avec le contrôleur `createLease`

### 5. Composant React BailInstant

**Fichier**: `/opt/doc2loc/app/components/BailInstant.tsx`

- ✅ Intégration complète avec l'API backend
- ✅ Appel à `POST /api/leases` lors du clic sur "Lancer la signature électronique"
- ✅ Gestion des erreurs avec callbacks `onError`
- ✅ Gestion du succès avec callback `onSuccess`
- ✅ Props supplémentaires :
  - `candidatureId` : ID de la candidature (optionnel)
  - `onSuccess` : Callback appelé en cas de succès
  - `onError` : Callback appelé en cas d'erreur

## 📋 Utilisation

### Frontend (React)

```tsx
import BailInstant from "./components/BailInstant";

<BailInstant
  property={propertyData}
  tenant={tenantData}
  candidatureId="candidature-id"
  onSuccess={(lease) => {
    console.log("Bail créé:", lease);
    // Rediriger vers la page de suivi
  }}
  onError={(error) => {
    console.error("Erreur:", error);
    // Afficher un message d'erreur
  }}
/>
```

### Backend (API)

```bash
POST /api/leases
Authorization: Bearer <token>
Content-Type: application/json

{
  "propertyId": "123",
  "candidatureId": "456",
  "startDate": "2024-02-01T00:00:00.000Z",
  "rentAmount": 1200,
  "chargesAmount": 150,
  "depositAmount": 1800,
  "guarantorType": "VISALE",
  "guarantor": {
    "visaleNumber": "VISALE123456789"
  }
}
```

## 🔄 Flux Complet

1. **Utilisateur remplit le formulaire BailInstant**
   - Sélectionne la date d'entrée
   - Configure le type de garantie
   - Ajuste les montants si nécessaire

2. **Clic sur "Lancer la signature électronique"**
   - Le composant appelle `POST /api/leases`
   - Affichage de l'animation "Envoi des invitations..."

3. **Backend traite la requête**
   - Crée le bail en base de données
   - Met à jour le statut de la candidature
   - Met à jour le statut du bien
   - Génère le PDF du bail (asynchrone)
   - Envoie les invitations de signature (asynchrone)

4. **Réponse au frontend**
   - Succès : Retourne les données du bail créé
   - Erreur : Retourne un message d'erreur

5. **Actions asynchrones (en arrière-plan)**
   - PDF généré et sauvegardé
   - Emails d'invitation envoyés
   - Logs d'événements créés

## 🔐 Sécurité

- ✅ Authentification requise pour toutes les routes
- ✅ Vérification des permissions (bien et candidature appartiennent au propriétaire)
- ✅ Validation des données d'entrée
- ✅ Tokens de signature sécurisés (HMAC SHA-256)
- ✅ Protection contre les injections SQL (Mongoose)

## 📝 Notes Importantes

1. **Authentification Frontend** : Le composant BailInstant fait des appels API sans gestion explicite du token. Dans une vraie application, vous devriez :
   - Utiliser un contexte d'authentification
   - Inclure le token dans les headers : `Authorization: Bearer ${token}`

2. **Génération PDF** : La génération du PDF est asynchrone et ne bloque pas la réponse API. Le chemin du PDF est sauvegardé dans le bail une fois généré.

3. **Envoi d'emails** : L'envoi des invitations est également asynchrone. Les erreurs sont loggées mais n'affectent pas la création du bail.

4. **Tokens de signature** : Le système de tokens est simplifié. Pour la production, considérez :
   - Utiliser JWT avec expiration
   - Implémenter un système de révocation de tokens
   - Ajouter une table de tokens en base de données

## 🚀 Prochaines Étapes Possibles

1. **Page de signature** : Créer une page dédiée pour la signature électronique (`/sign/lease/:id/:type`)
2. **Suivi des signatures** : Dashboard pour suivre l'état des signatures
3. **Notifications** : Système de notifications en temps réel pour les signatures
4. **Intégration service de signature** : Intégrer avec un service tiers (DocuSign, Yousign, etc.)
5. **Génération acte de cautionnement** : PDF séparé pour l'acte de cautionnement

## 📚 Fichiers Modifiés/Créés

- ✅ `/opt/doc2loc/src/controllers/leaseController.js` - Ajout `createLease`
- ✅ `/opt/doc2loc/src/services/pdfService.js` - Ajout `generateLeasePdf`
- ✅ `/opt/doc2loc/src/services/signatureService.js` - Nouveau fichier
- ✅ `/opt/doc2loc/src/routes/leaseRoutes.js` - Ajout route POST
- ✅ `/opt/doc2loc/app/components/BailInstant.tsx` - Intégration API
- ✅ `/opt/doc2loc/app/components/BailInstant.example.tsx` - Exemple mis à jour
