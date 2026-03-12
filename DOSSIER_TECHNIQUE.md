# Dossier technique — Plateforme doc2loc / PatrimoTrust / GetPatrimo

Documentation technique complète de la plateforme de gestion locative.

---

## 1. Architecture globale

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         POINT D'ENTRÉE                                   │
│  server.js (Express) + Next.js (app router)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│  EXPRESS      │           │  NEXT.JS      │           │  STATIC       │
│  Routes API   │           │  API Routes   │           │  public/*.html │
│  /api/auth/*  │           │  /api/owner-  │           │  /owner-journey│
│  /api/prop*   │           │  tunnel/*     │           │  /dashboard-  │
│  /api/tenant* │           │  /api/analyze*│           │  luxe, etc.   │
│  /api/public/*│           │  /api/didit/* │           │               │
└───────────────────────────┴───────────────────────────┴───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MongoDB (User, Property, Tenant, Document, Application, Candidature,    │
│           Lease, Guarantor, IdentitySession, Lead, Event)                │
└─────────────────────────────────────────────────────────────────────────┘
```

**Stack :** Node.js 20, Express 4, Next.js 16, React 19, MongoDB (Mongoose), OpenAI, Tailwind, Framer Motion

---

## 2. Arborescence complète

```
/opt/doc2loc/
├── server.js                    # Point d'entrée Express (1250+ lignes)
├── package.json
├── next.config.js
├── middleware.ts                # Next.js middleware (proxy, auth)
├── Dockerfile
├── docker-compose.getpatrimo.yml
│
├── app/                         # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                 # Page d'accueil
│   ├── providers/SessionProvider.tsx
│   │
│   ├── api/                     # API Routes Next.js
│   │   ├── analyze-document/route.ts
│   │   ├── analyze-document-v2/route.ts
│   │   ├── analyze-photos/route.ts
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── didit/               # Didit (identité)
│   │   │   ├── callback/route.ts
│   │   │   ├── session/route.ts
│   │   │   ├── start/route.ts
│   │   │   ├── status/route.ts
│   │   │   └── db.ts
│   │   ├── documents/delete/route.ts
│   │   ├── guarantor/           # Garant
│   │   │   ├── audit/route.ts
│   │   │   ├── create-session/route.ts
│   │   │   └── status/route.ts
│   │   ├── owner-tunnel/        # Parcours propriétaire
│   │   │   ├── agent/route.ts
│   │   │   ├── annonce/route.ts
│   │   │   ├── dossier-strategique/route.ts
│   │   │   ├── gen-annonce/route.ts
│   │   │   ├── generate-annonce/route.ts
│   │   │   ├── pricing/route.ts
│   │   │   ├── scan-dpe/route.ts
│   │   │   └── scan-vision/route.ts
│   │   ├── passport/            # Passeport locataire
│   │   │   ├── application/[id]/route.ts
│   │   │   ├── pdf/[id]/route.ts
│   │   │   ├── public/[slug]/route.ts
│   │   │   └── share/[slug]/route.ts
│   │   ├── properties/[id]/candidatures/route.ts
│   │   ├── scoring/calculate/route.ts
│   │   ├── scoring/tenant/route.ts
│   │   ├── verify/[token]/route.ts
│   │   └── webhooks/didit/route.ts + guarantor/route.ts
│   │
│   ├── actions/                 # Server Actions
│   │   ├── ai-certification.ts
│   │   ├── application-actions.ts
│   │   ├── audit-identity.ts
│   │   ├── calculate-solvency.ts
│   │   ├── create-tenant-account.ts
│   │   ├── process-dossier.ts
│   │   ├── send-guarantor-invitation.ts
│   │   ├── share-passport.ts
│   │   └── validate-mrz.ts
│   │
│   ├── apply/[id]/               # Tunnel candidature locataire
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── ApplyClient.tsx
│   ├── apply/success/
│   ├── auth/signin/
│   ├── auth/verify-request/
│   ├── concierge/                # Mode Concierge (agent IA)
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── AgentConciergeClient.tsx
│   │   └── ConciergeOnboardingClient.tsx
│   │
│   ├── dashboard/owner/
│   │   ├── page.tsx
│   │   ├── OwnerDashboardClient.tsx
│   │   └── property/[id]/
│   ├── dashboard/tenant/
│   ├── p/[slug]/                 # Passeport public
│   ├── properties/[id]/contract/ # Contractualisation
│   ├── verify/[token]/           # Vérification email
│   ├── verify-guarantor/[token]/ # Vérification garant
│   │
│   ├── components/
│   │   ├── AIFeedbackBubble.tsx
│   │   ├── BailInstant.tsx
│   │   ├── CertificationScoreBar.tsx
│   │   ├── ConditionalHeader.tsx
│   │   ├── ConditionalMain.tsx
│   │   ├── LuxeHeader.tsx
│   │   ├── PassportPDF.tsx
│   │   ├── PatrimoTrustGauge.tsx
│   │   ├── SecuritySettingsModal.tsx
│   │   ├── SolvencyAnalysis.tsx
│   │   ├── UnifiedTunnelHeader.tsx
│   │   └── UserMenu.tsx
│   │
│   └── utils/
│       ├── 2d-doc-decoder.ts
│       ├── integrity-score.ts
│       ├── nameVerification.ts
│       └── visale-verification.ts
│
├── lib/
│   ├── mongodb-client.ts
│   └── owner-tunnel/
│       ├── annonce-generator.ts
│       ├── dossier-strategique-engine.ts
│       ├── dpe-scanner.ts
│       ├── index.ts
│       ├── pricing-engine.ts
│       ├── property-data-schema.ts
│       ├── schemas.ts
│       └── vision-scanner.ts
│
├── models/                       # Mongoose
│   ├── User.js
│   ├── Property.js
│   ├── Tenant.js
│   ├── Document.js
│   ├── Application.js
│   ├── Candidature.js
│   ├── Lease.js
│   ├── Guarantor.js
│   ├── IdentitySession.js
│   ├── Lead.js
│   └── Event.js
│
├── src/                          # Code Express (legacy/modulaire)
│   ├── config/
│   │   ├── app.js
│   │   └── db.js
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── alertController.js
│   │   ├── authController.js
│   │   ├── billingController.js
│   │   ├── candidatureController.js
│   │   ├── documentAnalysisController.js
│   │   ├── documentController.js
│   │   ├── eventController.js
│   │   ├── fraudController.js
│   │   ├── leaseController.js
│   │   ├── oauthController.js
│   │   ├── propertyController.js
│   │   ├── publicController.js
│   │   ├── reminderController.js
│   │   ├── scrapingController.js
│   │   ├── taxController.js
│   │   ├── tenantController.js
│   │   ├── trustController.js
│   │   └── webhookController.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── alertRoutes.js
│   │   ├── authRoutes.js
│   │   ├── billingRoutes.js
│   │   ├── candidatureRoutes.js
│   │   ├── documentAnalysisRoutes.js
│   │   ├── documentRoutes.js
│   │   ├── eventRoutes.js
│   │   ├── leaseRoutes.js
│   │   ├── oauthRoutes.js
│   │   ├── propertyRoutes.js
│   │   ├── publicRoutes.js
│   │   ├── reminderRoutes.js
│   │   ├── scrapingRoutes.js
│   │   ├── taxRoutes.js
│   │   ├── tenantRoutes.js
│   │   ├── trustRoutes.js
│   │   └── webhookRoutes.js
│   ├── services/
│   │   ├── aiService.js
│   │   ├── alertService.js
│   │   ├── billingService.js
│   │   ├── diagnosticAlertService.js
│   │   ├── emailService.js
│   │   ├── eventService.js
│   │   ├── geoService.js
│   │   ├── opensignService.js
│   │   ├── pdfService.js
│   │   ├── scoringService.js
│   │   ├── signatureService.js
│   │   ├── taxAccountingService.js
│   │   ├── taxDeclarationService.js
│   │   ├── taxOcrService.js
│   │   ├── taxRecommendationService.js
│   │   └── trustEngineService.js
│   ├── middleware/
│   │   ├── admin.js
│   │   ├── auth.js
│   │   └── errorMiddleware.js
│   ├── cron/
│   │   └── rgpdPurge.js
│   └── utils/
│       ├── csv.js
│       └── upload.js
│
├── public/                       # Fichiers statiques
│   ├── owner-journey.html
│   ├── dashboard-luxe.html
│   ├── login-luxe.html
│   ├── register-luxe.html
│   ├── property-luxe.html
│   ├── contractualization-luxe.html
│   ├── apply.html
│   ├── dashboard.html
│   ├── property.html
│   ├── tenant.html
│   ├── candidatures.html
│   ├── guides/*.html
│   └── ...
│
└── uploads/
    ├── property-documents/
    └── candidats/
```

---

## 3. Routes API complètes

### 3.1 Express (server.js)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/healthz` | — | Health check |
| POST | `/api/auth/register` | — | Inscription |
| POST | `/api/auth/login` | — | Connexion |
| GET | `/api/auth/profile` | ✓ | Profil utilisateur |
| PUT | `/api/auth/profile` | ✓ | Mise à jour profil |
| GET | `/api/billing/status` | ✓ | Statut plan/billing |
| POST | `/api/properties` | ✓ | Créer bien |
| GET | `/api/properties` | ✓ | Liste biens |
| GET | `/api/properties/:id` | ✓ | Détail bien |
| PUT | `/api/properties/:id` | ✓ | Modifier bien |
| DELETE | `/api/properties/:id` | ✓ | Supprimer bien |
| POST | `/api/tenants` | ✓ | Créer locataire |
| GET | `/api/tenants` | ✓ | Liste locataires |
| GET | `/api/tenants/by-property/:id` | ✓ | Locataire par bien |
| GET | `/api/tenants/:id` | ✓ | Détail locataire |
| PUT | `/api/tenants/:id` | ✓ | Modifier locataire |
| DELETE | `/api/tenants/:id` | ✓ | Supprimer locataire |
| GET | `/api/documents/quittance/:id` | ✓ | PDF quittance |
| POST | `/api/documents/email/:id` | ✓ | Envoyer quittance par email |
| GET | `/api/property-documents/file/:docId` | ✓ | Télécharger document |
| POST | `/api/property-documents/upload/:propertyId` | ✓ | Upload document bien |
| GET | `/api/property-documents/:propertyId` | ✓ | Liste documents bien |
| DELETE | `/api/property-documents/:docId` | ✓ | Supprimer document |
| GET | `/api/events/property/:id` | ✓ | Événements bien |
| GET | `/api/events/tenant/:id` | ✓ | Événements locataire |
| GET | `/api/events/summary` | ✓ | Résumé événements |
| POST | `/api/reminders/tenant/:id` | ✓ | Relance locataire |
| GET | `/api/alerts/overview` | ✓ | Vue alertes |
| GET | `/api/public/apply/:token` | — | Bien par token candidature |
| GET | `/api/public/check-token/:token` | — | Vérifier token |
| GET | `/api/public/property/:id` | — | Détail bien public |
| POST | `/api/public/property/:id/apply` | — | Soumettre candidature |
| POST | `/api/public/candidature` | — | Candidature (placeholder) |
| POST | `/api/public/lead` | — | Capture lead |
| POST | `/api/webhooks/opensign` | — | Webhook OpenSign |
| GET | `/api/admin/leads` | ✓ Admin | Liste leads |
| GET | `/api/admin/leads.csv` | ✓ Admin | Export CSV leads |

### 3.2 Routes modulaires (src/routes)

| Préfixe | Fichier | Routes principales |
|---------|---------|--------------------|
| `/api/candidatures` | candidatureRoutes.js | GET /, GET /property/:id, GET /:id, POST /:id/accept, POST /:id/reject, POST /:id/analyze-trust |
| `/api/documents` | documentRoutes.js | Routes documents |
| `/api/leases` | leaseRoutes.js | Routes baux |
| `/api/properties` | propertyRoutes.js | POST /, GET /, GET /:id, PUT /:id, PATCH /:id, DELETE /:id |

### 3.3 Next.js API Routes

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/analyze-document` | POST | Analyse document (PDF, OCR) |
| `/api/analyze-document-v2` | POST | Analyse document v2 |
| `/api/analyze-photos` | POST | Analyse photos IA (annonce prestige) |
| `/api/auth/[...nextauth]` | * | NextAuth (OAuth, etc.) |
| `/api/didit/start` | POST | Démarrer session Didit |
| `/api/didit/status` | GET | Statut Didit |
| `/api/didit/callback` | GET | Callback Didit |
| `/api/didit/session` | POST | Session Didit |
| `/api/documents/delete` | POST | Supprimer document |
| `/api/guarantor/create-session` | POST | Créer session garant |
| `/api/guarantor/audit` | POST | Audit garant |
| `/api/guarantor/status` | GET | Statut garant |
| `/api/owner-tunnel/agent` | POST | Agent IA (streaming) |
| `/api/owner-tunnel/dossier-strategique` | POST | Dossier Stratégique |
| `/api/owner-tunnel/pricing` | POST | Loyer marché + surcote |
| `/api/owner-tunnel/scan-dpe` | POST | Extraction DPE PDF |
| `/api/owner-tunnel/scan-vision` | POST | Atouts visuels |
| `/api/owner-tunnel/annonce` | POST | Génération annonce |
| `/api/owner-tunnel/gen-annonce` | POST | Génération annonce |
| `/api/owner-tunnel/generate-annonce` | POST | Génération annonce |
| `/api/passport/application/[id]` | GET | Application passport |
| `/api/passport/pdf/[id]` | GET | PDF passport |
| `/api/passport/public/[slug]` | GET | Passport public |
| `/api/passport/share/[slug]` | POST | Partager passport |
| `/api/properties/[id]/candidatures` | GET | Candidatures d'un bien |
| `/api/scoring/calculate` | POST | Calcul score |
| `/api/scoring/tenant` | POST | Score locataire |
| `/api/verify/[token]` | GET | Vérification email |
| `/api/webhooks/didit` | POST | Webhook Didit |
| `/api/webhooks/didit/guarantor` | POST | Webhook Didit garant |

---

## 4. Pages et routes

### 4.1 Next.js (App Router)

| Route | Fichier | Description |
|-------|---------|-------------|
| `/` | app/page.tsx | Accueil |
| `/concierge` | app/concierge/page.tsx | Agent IA Concierge |
| `/dashboard/owner` | app/dashboard/owner/page.tsx | Dashboard propriétaire |
| `/dashboard/owner/property/[id]` | app/dashboard/owner/property/[id]/page.tsx | Détail bien |
| `/dashboard/tenant` | app/dashboard/tenant/page.tsx | Dashboard locataire |
| `/apply/[id]` | app/apply/[id]/page.tsx | Tunnel candidature |
| `/apply/success` | app/apply/success/page.tsx | Succès candidature |
| `/auth/signin` | app/auth/signin/page.tsx | Connexion |
| `/auth/verify-request` | app/auth/verify-request/page.tsx | Vérification email |
| `/verify/[token]` | app/verify/[token]/page.tsx | Vérification email |
| `/verify-guarantor/[token]` | app/verify-guarantor/[token]/page.tsx | Vérification garant |
| `/p/[slug]` | app/p/[slug]/page.tsx | Passport public |
| `/properties/[id]/contract` | app/properties/[id]/contract/page.tsx | Contractualisation |

### 4.2 HTML statiques (public/)

| Route | Fichier | Description |
|-------|---------|-------------|
| `/owner-journey` | owner-journey.html | Parcours propriétaire (formulaire) |
| `/dashboard-luxe` | dashboard-luxe.html | Dashboard luxe |
| `/login-luxe` | login-luxe.html | Connexion luxe |
| `/register-luxe` | register-luxe.html | Inscription luxe |
| `/property-luxe` | property-luxe.html | Fiche bien luxe |
| `/contractualization-luxe` | contractualization-luxe.html | Contractualisation |
| `/apply.html` | apply.html | Candidature (legacy) |
| `/dashboard.html` | dashboard.html | Dashboard |
| `/property.html` | property.html | Fiche bien |
| `/tenant.html` | tenant.html | Fiche locataire |
| `/candidatures.html` | candidatures.html | Candidatures |
| `/guides/*` | guides/*.html | Guides |

---

## 5. Modèles MongoDB

| Modèle | Fichier | Champs principaux |
|--------|---------|-------------------|
| **User** | models/User.js | email, password, firstName, lastName, plan, usage |
| **Property** | models/Property.js | user, name, address, rentAmount, chargesAmount, surfaceM2, applyToken, status, diagnostics |
| **Tenant** | models/Tenant.js | user, firstName, lastName, email, property |
| **Document** | models/Document.js | user, property, type, filename, relPath |
| **Application** | models/Application.js | userEmail, property, applyToken, profile, tunnel, didit, documents, patrimometer, guarantor |
| **Candidature** | models/Candidature.js | Candidature (legacy) |
| **Lease** | models/Lease.js | Bail |
| **Guarantor** | models/Guarantor.js | Garant |
| **IdentitySession** | models/IdentitySession.js | Session Didit |
| **Lead** | models/Lead.js | email, source, utm |
| **Event** | models/Event.js | user, property, tenant, type, meta |

---

## 6. Services (src/services)

| Service | Usage |
|---------|-------|
| aiService.js | Analyse IA |
| alertService.js | Alertes |
| billingService.js | Facturation, paywall |
| diagnosticAlertService.js | Alertes diagnostics (expiration DPE, etc.) |
| emailService.js | Envoi emails (Brevo) |
| eventService.js | Logging événements |
| geoService.js | Validation géographique (geo.api.gouv.fr) |
| opensignService.js | Intégration OpenSign |
| pdfService.js | Génération PDF |
| scoringService.js | Scoring locataire |
| signatureService.js | Signature |
| taxAccountingService.js | Comptabilité fiscale |
| taxDeclarationService.js | Déclarations fiscales |
| taxOcrService.js | OCR documents fiscaux |
| taxRecommendationService.js | Recommandations fiscales |
| trustEngineService.js | Moteur de confiance |

---

## 7. Controllers (src/controllers)

| Controller | Usage |
|------------|-------|
| adminController.js | Admin |
| alertController.js | Alertes |
| authController.js | Auth |
| billingController.js | Billing |
| candidatureController.js | Candidatures (accept, reject, insight) |
| documentAnalysisController.js | Analyse documents |
| documentController.js | Documents |
| eventController.js | Événements |
| fraudController.js | Détection fraude |
| leaseController.js | Baux |
| oauthController.js | OAuth |
| propertyController.js | Biens |
| publicController.js | Candidature publique |
| reminderController.js | Relances |
| scrapingController.js | Scraping |
| taxController.js | Fiscalité |
| tenantController.js | Locataires |
| trustController.js | Trust / PatrimoMeter |
| webhookController.js | Webhooks (Didit, OpenSign) |

---

## 8. Lib (owner-tunnel)

| Fichier | Usage |
|---------|-------|
| property-data-schema.ts | Schéma PropertyData (address, surface_m2, furnished, etc.) |
| dossier-strategique-engine.ts | Loyer, primes, profil cible |
| pricing-engine.ts | Loyer base + surcote IA |
| dpe-scanner.ts | Extraction DPE (PDF) |
| vision-scanner.ts | Atouts visuels (parquet, cuisine, etc.) |
| schemas.ts | VisionAtouts, PricingResult |
| annonce-generator.ts | Génération annonce |

---

## 9. Flux principaux

### 9.1 Parcours propriétaire (Concierge)

```
/concierge → AgentConciergeClient
    → POST /api/owner-tunnel/agent (stream: true)
    → POST /api/owner-tunnel/scan-dpe (si DPE)
    → POST /api/owner-tunnel/scan-vision (si photos)
    → POST /api/owner-tunnel/dossier-strategique
    → POST /api/analyze-photos (si photos)
    → DossierStrategiqueView
    → CTA → /dashboard/owner
```

### 9.2 Parcours candidature locataire

```
/apply/[token] → ApplyClient
    → Didit (identité)
    → Upload documents
    → POST /api/guarantor/create-session
    → POST /api/scoring/calculate
    → Application (MongoDB)
```

### 9.3 Auth

```
POST /api/auth/login → JWT
Header: x-auth-token
```

---

## 10. Variables d'environnement

| Variable | Requis | Usage |
|----------|--------|-------|
| OPENAI_API_KEY | ✓ | Agent, pricing, analyse photos, DPE |
| MONGO_URI | ✓ | MongoDB |
| JWT_SECRET | ✓ | Auth JWT |
| BREVO_USER | | SMTP |
| BREVO_PASS | | SMTP |
| MAIL_FROM | | Email expéditeur |
| ADMIN_EMAILS | | Liste emails admin |
| PRICING_API_URL | | API externe loyer |
| GEO_VALIDATION | | Validation commune |
| DIDIT_* | | Didit |
| NEXTAUTH_* | | NextAuth |

---

## 11. État des lieux

### Fait

- Auth JWT / NextAuth
- CRUD biens, locataires, documents
- Quittance PDF + email
- Parcours Concierge (agent IA, streaming, Smart Widgets)
- Dossier Stratégique
- Analyse photos, DPE, vision
- Tunnel candidature (Apply)
- Didit (identité)
- Garant
- Passport
- Scoring
- Dashboard owner/tenant
- Déploiement Docker

### À faire

- Persistance bien après Dossier Stratégique
- Lien CTA → création bien en base
- Dashboard owner alimenté par les biens réels
- Authentification Concierge
- Outils de rayonnement (onglet 3)
- Unification parcours propriétaire / owner-journey

---

*Document généré le 2025-02-25*
