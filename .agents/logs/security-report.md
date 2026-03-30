# Rapport d'audit sécurité — Migration enum UPPER_SNAKE_CASE
**Date :** 2026-03-23
**Périmètre :** Tâche "Corriger l'enum invalide Lease.opensignStatus et normaliser tous les enums en UPPER_SNAKE_CASE"
**Auditeur :** Agent sécurité (Claude Sonnet 4.6)

---

## Résumé exécutif

La migration enum est globalement **correcte et cohérente**. Deux problèmes ont été identifiés et corrigés directement. Un warning sur le webhook HMAC existait avant cette tâche et reste à traiter. Aucune vulnérabilité critique non corrigée ne subsiste dans le périmètre audité.

---

## 1. Authentification

### ✅ Endpoints Express protégés par `req.user`
Tous les endpoints de `leaseController.js` vérifient `req.user.id` en début de handler (lignes 79, 109, 135, 159, 187, 240, 287, 357, 383, 436, 580, 688, 738). La session est injectée par un middleware d'authentification en amont.

### ✅ Endpoints Next.js protégés par `getServerSession`
`app/api/owner/properties/route.ts` (et les routes `[id]`) appellent `getServerSession(authOptions)` et retournent 401 si la session est absente.

### ✅ Filtrage par `user` en base
- `leaseController.js` : `Property.findOne({ _id: propertyId, user: userId })`, `Candidature.findOne({ ..., user: userId })`, comparaison explicite `String(lease.user) !== String(userId)` avant toute modification.
- `app/api/owner/properties/route.ts` : `Property.find({ user: userId })`.

---

## 2. Validation des entrées

### ⚠️ `leaseType` reçu du client — pas de validation Zod explicite dans `createLease`
`leaseController.js` ligne 446 : `leaseType` est extrait du `req.body` et passé directement à `deriveLeaseType()`, qui appelle `normalizeLeaseType()`. Cette fonction est robuste (retourne `null` pour toute valeur inconnue, fallback `'VIDE'`). Le schéma Mongoose possède un `enum` strict qui rejettera toute valeur hors liste à la sauvegarde. Il n'y a pas de validation Zod préalable — le risque est limité par les deux filets de sécurité existants (normalize + enum Mongoose), mais une validation explicite en amont serait préférable.

### ✅ `opensignStatus` — jamais reçu directement du client
Aucun endpoint n'accepte `opensignStatus` en entrée depuis le client. La valeur est toujours calculée en interne (via `computeAggregateStatus` ou mapping `OPENSIGN_STATUS_MAP`).

### ✅ ObjectId — filtrage indirect implicite via `findById` / `findOne`
Mongoose rejette silencieusement les ObjectId malformés (CastError → 500 générique). Pas de validation regex explicite, mais le risque d'injection est nul : Mongoose échappe les requêtes.

### ⚠️ Montants financiers (`rentAmount`, `chargesAmount`, `depositAmount`) — pas de min/max
`leaseController.js` lignes 397–399 et 505–507 : `Number(...)` sans validation de borne min/max. Un montant négatif ou absurde (ex. 999999999) peut être stocké. Pas de risque sécurité direct mais impact fonctionnel.

---

## 3. Injection

### ✅ Pas d'injection NoSQL
Toutes les requêtes Mongoose utilisent des IDs extraits de `req.user.id` (token JWT vérifié) ou des ObjectId construits par Mongoose. Aucune interpolation de chaîne dans un `$where` ou `$regex`.

### ✅ Path traversal — protection en place dans `getCompiledLeaseAsset`
`leaseController.js` ligne 136 : `path.basename(String(req.params.fileName))` élimine les séquences `../`. Vérification supplémentaire `fileName.startsWith(userPrefix)` — seul l'utilisateur courant peut accéder à ses propres fichiers compilés.

### ✅ Pas d'`eval()` ou `new Function()` avec données utilisateur
Aucune occurrence détectée dans le périmètre audité.

---

## 4. Données sensibles

### ✅ Pas de secrets dans le code
Toutes les clés API (`OPENSIGN_API_KEY`, `OPENSIGN_WEBHOOK_SECRET`, `MONGODB_URI`) sont lues depuis `process.env`. Le script de migration lit aussi depuis `.env` via `dotenv`.

### ✅ Tokens OpenSign non exposés dans les réponses API
`launchElectronicSignature` (ligne 661–675) retourne uniquement `opensignStatus`, `documentsCount` et `hasSigningLinks` — le `documentId` interne OpenSign n'est pas renvoyé au client.

### ⚠️ `error.message` exposé en production dans plusieurs endpoints
`leaseController.js` lignes 103, 126, 571, 679, 729, 801 : `error: error.message` est inclus dans les réponses 500 sans condition sur `NODE_ENV`. Un message d'erreur peut révéler des détails sur la structure interne (chemin de fichier, nom de modèle Mongoose). **Ce pattern existait avant cette tâche et n'a pas été introduit par la migration enum**, mais il est signalé pour traitement futur.

### ✅ Pas de stack traces exposées
Les `error.stack` sont loggués côté serveur (`console.error`) mais non inclus dans les réponses JSON des controllers modifiés.

---

## 5. Spécifique migration enum

### ✅ `opensignService.js` — normalisation exhaustive avec fallback
`OPENSIGN_STATUS_MAP` couvre les 5 valeurs connues de l'API OpenSign (`pending`, `signed`, `completed`, `expired`, `declined`). Fallback sur `'PENDING'` si valeur inconnue (ligne 229). Pattern correct : `String(response.data.status || '').toLowerCase()`.

### ✅ Script `migrate-enum-uppercase.js` — idempotent
- Utilise `$set` ciblé sur chaque champ (`updateDoc.$set[field] = value`), jamais de remplacement de document entier.
- Filtre via `needsMigration(map, value)` qui ne matche que les valeurs encore en lowercase — un document déjà migré est ignoré.
- Mode `--dry-run` disponible pour tester sans écriture.
- Parcours sur cursor avec `for await` : pas de chargement massif en mémoire.

### ✅ Enums côté client (`LeaseWizard.tsx`) — options `<select>` mises à jour
Les quatre options (`VIDE`, `MEUBLE`, `MOBILITE`, `GARAGE_PARKING`) correspondent exactement aux valeurs acceptées par le modèle Mongoose.

### ✅ `leaseWizardShared.js` — `normalizeLeaseType` robuste avec double acceptation
La fonction accepte les valeurs déjà en UPPER_SNAKE_CASE (test `.toUpperCase()`) **et** les valeurs normalized en lowercase par compatibilité. Le fallback retourne `null` (jamais une valeur invalide).

### ❌ [CORRIGÉ] `leaseController.js` ligne 770 — fallback `'lease'` (lowercase) oublié

**Problème :** Dans `getSignatureStatus`, lors de la construction du tableau `statuses`, le fallback était `document.kind || 'lease'`. Avec la migration, `document.kind` sera `'LEASE'` ou `'GUARANTEE'`, mais si le document n'avait pas de `kind` (ancien document pré-migration non couvert), la valeur `'lease'` (lowercase) aurait été écrite en base via `lease.opensignDocuments = statuses.map(...)`, violant l'enum Mongoose.

**Correction appliquée :** `/opt/doc2loc/src/controllers/leaseController.js` ligne 770 :
```js
// Avant
kind: document.kind || 'lease',
// Après
kind: document.kind || 'LEASE',
```

### ❌ [CORRIGÉ] `trustEngineService.js` ligne 48 — `'warning'` (lowercase) non migré

**Problème :** Après migration de `'flagged'` → `'FLAGGED'`, la ligne suivante comparait encore `metadataStatus === 'warning'` en lowercase. Si `metadataStatus` a été migré en `'WARNING'` dans la base (ou si une nouvelle écriture produit `'WARNING'`), la branche n'était jamais empruntée, silencieusement réduisant le score d'intégrité à 100 au lieu de 60 pour un dossier en avertissement.

**Note :** `metadataStatus` n'est pas défini dans les modèles Mongoose audités — c'est un champ libre calculé en mémoire dans `runPhase1AuditPure`. La valeur `'warning'` est produite par cette fonction interne. La correction appliquée accepte les deux formes pour éviter toute régression pendant la période de transition.

**Correction appliquée :** `/opt/doc2loc/src/services/trustEngineService.js` ligne 48 :
```js
// Avant
} else if (applicationData.metadataStatus === 'warning') {
// Après
} else if (applicationData.metadataStatus === 'WARNING' || applicationData.metadataStatus === 'warning') {
```

### ❌ [CORRIGÉ] `leaseController.js` — `mapLegacyPropertyType` non mise à jour

**Problème :** La fonction `mapLegacyPropertyType` (ligne 21) comparait encore contre `'meuble'`, `'mobilite'`, `'garage_parking'` (lowercase). Or elle est appelée avec `resolvedLeaseType` (ligne 508), qui produit désormais toujours des valeurs UPPER_SNAKE_CASE. La fonction retournait systématiquement `'NU'` quel que soit le type de bail, corrompant silencieusement le champ `propertyType` à la création du bail.

**Correction appliquée :** `/opt/doc2loc/src/controllers/leaseController.js` lignes 21–26 : ajout des comparaisons UPPER_SNAKE_CASE en parallèle des valeurs lowercase legacy.

### ⚠️ Webhook OpenSign — vérification HMAC non implémentée

`webhookController.js` lignes 29–37 : la vérification de la signature HMAC est commentée (`// TODO`). En présence de `OPENSIGN_WEBHOOK_SECRET`, seule l'existence du header `x-opensign-signature` est vérifiée, pas sa valeur. Un attaquant connaissant l'URL du webhook peut forger des événements de signature. **Ce problème préexiste à cette tâche** mais représente une vulnérabilité réelle en production sur des données financières critiques (statut de bail, archivage de PDF, mise à jour du statut de bien).

**Recommandation prioritaire :** Implémenter la vérification HMAC-SHA256 avant déploiement en production.

---

## Récapitulatif des actions

| Fichier | Problème | Action |
|---|---|---|
| `src/controllers/leaseController.js` | Fallback `'lease'` lowercase à la ligne 770 | ❌ → Corrigé |
| `src/controllers/leaseController.js` | `mapLegacyPropertyType` non mise à jour (toujours lowercase) | ❌ → Corrigé |
| `src/services/trustEngineService.js` | `metadataStatus === 'warning'` non migré | ❌ → Corrigé |
| `src/controllers/webhookController.js` | Vérification HMAC incomplète (TODO) | ⚠️ — À traiter avant prod |
| `src/controllers/leaseController.js` | `error.message` exposé sans `NODE_ENV` | ⚠️ — Amélioration future |
| `leaseController.js` createLease | Pas de validation Zod sur `leaseType` client | ⚠️ — Amélioration future |
| `leaseController.js` montants | Pas de min/max sur montants financiers | ⚠️ — Amélioration future |
