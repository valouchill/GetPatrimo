# Plan de Dispatch Autonome — GetPatrimo

**Date** : 23 mars 2026
**Objectif** : Corriger toutes les incohérences, combler les manques et améliorer l'app de manière autonome via le pipeline multi-agents.

---

## Stratégie

Le dispatch est découpé en **6 phases séquentielles**, de la plus critique à la moins urgente. Chaque phase contient des tâches atomiques que l'orchestrateur peut exécuter une par une. Chaque tâche est formulée comme une instruction claire pour l'agent Architect, qui planifie puis délègue aux agents spécialisés.

**Ordre** : Sécurité → Base de données → Architecture → Backend/API → Frontend → DevOps/Legal

---

## Phase 1 — Sécurité (Score actuel : 4/10 → Cible : 8/10)

Les failles de sécurité sont bloquantes pour la production. Aucune feature ne doit être ajoutée tant que ces points ne sont pas résolus.

| # | Tâche | Agents | Risque si ignoré |
|---|-------|--------|------------------|
| 1.1 | Ajouter express-rate-limit sur /api/auth/*, /api/login, /api/register (max 5 req/min login, 20 req/min API) | backend, security | Brute force sur les comptes |
| 1.2 | Hasher magicSignInToken et magicLinkToken avec bcrypt avant stockage dans User et Application | database, backend, security | Tokens exploitables si fuite BDD |
| 1.3 | Ajouter express.json({ limit: '1mb' }) et express.urlencoded({ limit: '1mb' }) dans server.js | backend, security | Attaque DoS par payload géant |
| 1.4 | Installer et configurer helmet pour les headers de sécurité (HSTS, X-Frame-Options, CSP, X-Content-Type-Options) | backend, security | XSS, clickjacking |
| 1.5 | Ajouter mongo-sanitize sur toutes les entrées utilisateur pour empêcher l'injection NoSQL | backend, security | Injection NoSQL critique |
| 1.6 | Valider le MIME type des uploads par magic bytes (file-type) et pas seulement par l'extension | backend, security | Upload de fichiers malveillants |
| 1.7 | Remplacer les credentials hardcodées dans docker-compose (admin:password123) par des variables d'environnement | backend, security | Accès non autorisé à la BDD |
| 1.8 | Ajouter une politique de mot de passe minimale (8 chars, 1 majuscule, 1 chiffre) dans le modèle User et les endpoints register | database, backend, security | Comptes avec mots de passe faibles |

---

## Phase 2 — Base de données (Score actuel : 4.5/10 → Cible : 8/10)

Les incohérences de modèles provoquent des bugs silencieux et des données corrompues.

| # | Tâche | Agents | Problème actuel |
|---|-------|--------|-----------------|
| 2.1 | Fixer la syntaxe enum de Lease.opensignStatus : remplacer { values: [...] } par un enum: [...] Mongoose valide, puis normaliser toutes les données existantes | database | Aucune validation appliquée |
| 2.2 | Normaliser le casing de TOUS les enums : DPE→DPE, dpe→DPE, meuble→MEUBLE, etc. dans les 11 modèles. Créer un script de migration pour les données existantes | database, backend | Requêtes cassées par la casse |
| 2.3 | Ajouter les ~30 index manquants sur les clés étrangères : Property.user, Candidature.property, Candidature.tenant, Application.property, Application.user, Lease.property, Lease.tenant, Document.application, etc. | database | Requêtes lentes O(n) |
| 2.4 | Remplacer les 15+ champs Schema.Types.Mixed par des sous-schémas typés (aiAnalysis, guarantee, breakdown, etc.) | database | Pas de validation, migration impossible |
| 2.5 | Ajouter les validations manquantes : montants >= 0, dates cohérentes (fin > début), format email, format téléphone, sur les 68% de champs non validés | database, backend | Données corrompues en BDD |
| 2.6 | Découper le schéma Application (136 lignes, 50+ champs) en sous-documents ou références : profil, vérification, documents, scoring | database | Schéma ingérable |
| 2.7 | Ajouter les timestamps (createdAt/updatedAt) manquants sur les modèles qui ne les ont pas et vérifier que { timestamps: true } est activé partout | database | Pas de traçabilité |

---

## Phase 3 — Architecture & Nettoyage (Score actuel : 5.5/10 → Cible : 8/10)

Réduire la dette technique et clarifier l'architecture.

| # | Tâche | Agents | Impact |
|---|-------|--------|--------|
| 3.1 | Supprimer tous les fichiers .bak et .BROKEN (202 fichiers, 36% du repo), ajouter *.bak et *.BROKEN dans .gitignore | backend, reviewer | Repo pollué, confusion |
| 3.2 | Inventorier les routes dupliquées entre server.js et Next.js API Routes. Migrer les routes Express restantes vers app/api/ et documenter le plan de suppression progressive de server.js | architect, backend | Double source de vérité |
| 3.3 | Créer les hooks custom réutilisables : useFetch, useAsync, useForm, useDebounce pour éliminer la duplication de logique dans les composants | frontend, refactor | 4700 lignes dupliquées |
| 3.4 | Créer un système de notifications toast (remplacer les 6 appels alert()) avec un composant NotificationProvider + hook useNotification | frontend | UX amateur |
| 3.5 | Implémenter un validateur de formulaire avec Zod côté client : créer un hook useZodForm qui wraps react-hook-form + zod, et l'utiliser dans les formulaires de candidature et de bail | frontend, backend | Pas de validation structurée |

---

## Phase 4 — Backend & API (Score actuel : 6.5/10 → Cible : 8.5/10)

Consolider les API et corriger les incohérences métier.

| # | Tâche | Agents | Contexte |
|---|-------|--------|----------|
| 4.1 | Ajouter la validation Zod sur TOUTES les API Routes de app/api/ : chaque endpoint doit valider son body/query avec un schéma Zod strict et retourner une 400 propre si invalide | backend, security | 68% non validé |
| 4.2 | Implémenter un middleware d'erreur centralisé dans server.js et les API Routes : pas de stack trace en production, logging structuré, réponses d'erreur cohérentes | backend | Stack traces exposées |
| 4.3 | Vérifier et corriger la logique du dépôt de garantie : 0 pour bail mobilité, max 1 mois HC pour nu, max 2 mois HC pour meublé. Ajouter la validation dans Lease et dans l'API de création de bail | backend, legal, database | Montants potentiellement illégaux |
| 4.4 | Ajouter les endpoints RGPD manquants : GET /api/user/export (portabilité), DELETE /api/user/data (effacement), PUT /api/user/consent (gestion consentement Didit) | backend, legal | Non-conformité RGPD |
| 4.5 | Vérifier que le cron rgpdPurge.js supprime correctement : candidatures refusées > 3 mois, pièces d'identité des non-retenus immédiatement, données biométriques Didit après vérification, leads > 3 ans | backend, legal | Violation durées RGPD |

---

## Phase 5 — Frontend & Refactoring (Score actuel : 6.5/10 → Cible : 8.5/10)

Refactorer les composants monolithiques et améliorer l'UX.

| # | Tâche | Agents | Détail |
|---|-------|--------|--------|
| 5.1 | Refactorer ApplyClient.tsx (7898 lignes) : extraire DocumentUploadSection, ScoringSection, GuaranteeForm, ProfileStep, RecapStep, ProgressBar dans des fichiers séparés avec hooks custom | refactor, frontend | Fichier ingérable |
| 5.2 | Refactorer OwnerDashboardClient.tsx (1411 lignes) : extraire PropertyGrid, CandidateList, StatsBar, AlertBanner | refactor, frontend | Maintenabilité |
| 5.3 | Refactorer BailInstant.tsx (1177 lignes) : séparer LeaseForm, GuarantorSelector, ClausesEditor, PDFPreview | refactor, frontend | Maintenabilité |
| 5.4 | Refactorer LeaseWizard.tsx (1052 lignes) : un composant par step + WizardShell | refactor, frontend | Maintenabilité |
| 5.5 | Ajouter les attributs d'accessibilité de base : aria-label sur les boutons sans texte, rôles ARIA sur les modals/tabs/forms, navigation clavier sur les composants interactifs | frontend | Accessibilité 2/10 |
| 5.6 | Dédupliquer les patterns de fetch et les composants Avatar en créant des composants partagés dans app/components/shared/ | refactor, frontend | 18% code dupliqué |

---

## Phase 6 — DevOps, Tests & Conformité (Score actuel : 4/10 → Cible : 7.5/10)

| # | Tâche | Agents | Priorité |
|---|-------|--------|----------|
| 6.1 | Créer un workflow GitHub Actions : lint + type-check + tests unitaires sur chaque push/PR | backend, testing | Pas de CI/CD |
| 6.2 | Ajouter health check Docker, user non-root, et multi-stage build dans le Dockerfile | backend, security | Conteneur vulnérable |
| 6.3 | Écrire les tests d'API pour les 10 endpoints les plus critiques (auth, candidature, bail, paiement, documents) | testing | Pas de tests d'API |
| 6.4 | Vérifier que le bail généré contient TOUTES les mentions obligatoires loi ALUR et qu'aucune clause interdite n'est présente | legal, testing | Non-conformité juridique |
| 6.5 | Vérifier que le dossier candidat ne demande aucun document interdit (relevé bancaire, carte vitale, casier judiciaire, etc.) dans le code et l'UI | legal, frontend | Hors-la-loi |
| 6.6 | Ajouter un monitoring basique : logs structurés JSON avec winston, endpoint /health, alertes email si erreur critique | backend | Pas de visibilité en prod |

---

## Résumé

| Phase | Nb tâches | Durée estimée (pipeline) | Agents principaux |
|-------|-----------|--------------------------|-------------------|
| 1. Sécurité | 8 | ~2-3h | backend, security |
| 2. Base de données | 7 | ~2-3h | database |
| 3. Architecture | 5 | ~2h | refactor, frontend, backend |
| 4. Backend & API | 5 | ~2h | backend, legal |
| 5. Frontend | 6 | ~3-4h | refactor, frontend |
| 6. DevOps & Conformité | 6 | ~2-3h | testing, legal, backend |
| **Total** | **37 tâches** | **~13-18h** | |

Chaque tâche est exécutée par l'orchestrateur qui lance la chaîne complète : architect → agents spécialisés → tests → security → review + commit.
