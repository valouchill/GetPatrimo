# État des lieux — Plateforme PatrimoTrust / doc2loc

## 1. Chemins et utilités

### Racine du projet
| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc` | Racine du projet |
| `/opt/doc2loc/server.js` | Point d'entrée Express. Monte Next.js, MongoDB, routes API, uploads, emails |
| `/opt/doc2loc/package.json` | Dépendances (Next.js 16, React 19, OpenAI, Mongoose, etc.) |
| `/opt/doc2loc/next.config.js` | Configuration Next.js |
| `/opt/doc2loc/docker-compose.getpatrimo.yml` | Déploiement Docker (port 3000) |
| `/opt/doc2loc/Dockerfile` | Image Node 20 Alpine, build Next.js |

---

### Parcours propriétaire (Owner Tunnel)

#### Mode Concierge (Next.js — principal)
| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc/app/concierge/page.tsx` | Page principale /concierge |
| `/opt/doc2loc/app/concierge/AgentConciergeClient.tsx` | Agent IA conversationnel (streaming, quick replies, Smart Widgets) |
| `/opt/doc2loc/app/concierge/ConciergeOnboardingClient.tsx` | Parcours formulaire alternatif (Typeform) |
| `/opt/doc2loc/app/concierge/layout.tsx` | Layout sans header/footer |

#### Mode formulaire (HTML statique)
| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc/public/owner-journey.html` | Parcours propriétaire formulaire (étapes, DPE, photos, pricing) |
| Routes serveur : `/owner-journey`, `/owner-journey.html` | Servent ce fichier |

---

### API Owner Tunnel

| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc/app/api/owner-tunnel/agent/route.ts` | Agent IA conversationnel. Streaming SSE, mémoire, quick_replies, auto-correction |
| `/opt/doc2loc/app/api/owner-tunnel/dossier-strategique/route.ts` | Dossier Stratégique (loyer, primes, profil cible, synthèse) |
| `/opt/doc2loc/app/api/owner-tunnel/pricing/route.ts` | Loyer marché + surcote prestige |
| `/opt/doc2loc/app/api/owner-tunnel/scan-dpe/route.ts` | Extraction DPE (PDF) |
| `/opt/doc2loc/app/api/owner-tunnel/scan-vision/route.ts` | Atouts visuels (parquet, cuisine, luminosité, balcon) |
| `/opt/doc2loc/app/api/owner-tunnel/annonce/route.ts` | Génération annonce |
| `/opt/doc2loc/app/api/owner-tunnel/gen-annonce/route.ts` | Génération annonce (alternative) |
| `/opt/doc2loc/app/api/owner-tunnel/generate-annonce/route.ts` | Génération annonce (lib) |

---

### Lib Owner Tunnel

| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc/lib/owner-tunnel/property-data-schema.ts` | Schéma PropertyData (address, surface_m2, furnished, etc.) |
| `/opt/doc2loc/lib/owner-tunnel/dossier-strategique-engine.ts` | Moteur Dossier Stratégique (loyer_base, primes, profil_cible) |
| `/opt/doc2loc/lib/owner-tunnel/pricing-engine.ts` | Loyer base + surcote IA |
| `/opt/doc2loc/lib/owner-tunnel/dpe-scanner.ts` | Scanner DPE (PDF) |
| `/opt/doc2loc/lib/owner-tunnel/vision-scanner.ts` | Scanner atouts visuels (images) |
| `/opt/doc2loc/lib/owner-tunnel/schemas.ts` | VisionAtouts, PricingResult, etc. |
| `/opt/doc2loc/lib/owner-tunnel/annonce-generator.ts` | Génération annonce |

---

### Analyse photos

| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc/app/api/analyze-photos/route.ts` | Analyse visuelle riche (matériaux, annonce prestige, features) |

---

### Pages Next.js

| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc/app/page.tsx` | Page d'accueil |
| `/opt/doc2loc/app/layout.tsx` | Layout racine |
| `/opt/doc2loc/app/dashboard/owner/page.tsx` | Dashboard propriétaire |
| `/opt/doc2loc/app/dashboard/owner/OwnerDashboardClient.tsx` | Client dashboard |
| `/opt/doc2loc/app/dashboard/tenant/page.tsx` | Dashboard locataire |
| `/opt/doc2loc/app/apply/[id]/page.tsx` | Candidature locataire |
| `/opt/doc2loc/app/apply/[id]/ApplyClient.tsx` | Client candidature |
| `/opt/doc2loc/app/verify/[token]/page.tsx` | Vérification email |
| `/opt/doc2loc/app/verify-guarantor/[token]/page.tsx` | Vérification garant |
| `/opt/doc2loc/app/auth/signin/page.tsx` | Connexion |
| `/opt/doc2loc/app/p/[slug]/page.tsx` | Passport public |

---

### Modèles MongoDB

| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc/models/User.js` | Utilisateur |
| `/opt/doc2loc/models/Property.js` | Bien immobilier |
| `/opt/doc2loc/models/Tenant.js` | Locataire |
| `/opt/doc2loc/models/Document.js` | Document |
| `/opt/doc2loc/models/Application.js` | Candidature |
| `/opt/doc2loc/models/Candidature.js` | Candidature |
| `/opt/doc2loc/models/Lease.js` | Bail |
| `/opt/doc2loc/models/Guarantor.js` | Garant |
| `/opt/doc2loc/models/IdentitySession.js` | Session Didit |
| `/opt/doc2loc/models/Lead.js` | Lead |
| `/opt/doc2loc/models/Event.js` | Événement |

---

### Composants

| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc/app/components/UnifiedTunnelHeader.tsx` | Header tunnel |
| `/opt/doc2loc/app/components/ConditionalHeader.tsx` | Header conditionnel (exclut /concierge) |
| `/opt/doc2loc/app/components/ConditionalMain.tsx` | Main conditionnel |
| `/opt/doc2loc/app/components/BailInstant.tsx` | Bail instantané |
| `/opt/doc2loc/app/components/CertificationScoreBar.tsx` | Barre score certification |
| `/opt/doc2loc/app/components/PatrimoTrustGauge.tsx` | Jauge PatrimoTrust |
| `/opt/doc2loc/app/components/AIFeedbackBubble.tsx` | Bulle feedback IA |
| `/opt/doc2loc/app/components/PassportPDF.tsx` | PDF Passport |
| `/opt/doc2loc/app/components/SolvencyAnalysis.tsx` | Analyse solvabilité |

---

### Services & Controllers (Express legacy)

| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc/src/controllers/*.js` | Controllers Express (auth, property, tenant, etc.) |
| `/opt/doc2loc/src/services/*.js` | Services (email, PDF, scoring, etc.) |

---

### Uploads

| Chemin | Utilité |
|--------|---------|
| `/opt/doc2loc/uploads/property-documents/` | Documents biens |
| `/opt/doc2loc/uploads/candidats/` | Fichiers candidats |

---

## 2. Interactions (flux principaux)

### Flux Concierge (Agent Conversationnel)

```
Utilisateur → /concierge (Next.js)
    ↓
AgentConciergeClient.tsx
    ↓
POST /api/owner-tunnel/agent (stream: true)
    ├── Historique messages
    ├── PropertyData
    └── userMessage
    ↓
OpenAI stream → SSE (token, quick_replies, done)
    ↓
Affichage streaming + boutons binaires
    ↓
Si isComplete → launchFinalAnalysis()
    ├── POST /api/owner-tunnel/scan-vision (si photos)
    ├── POST /api/owner-tunnel/dossier-strategique
    └── POST /api/analyze-photos (si photos)
    ↓
DossierStrategiqueView (onglets Stratégie, Ciblage, Rayonnement)
    ↓
CTA "Valider la Stratégie" → /dashboard/owner
```

### Flux Dossier Stratégique

```
dossier-strategique/route.ts
    ↓
computeDossierStrategique() (lib)
    ├── fetchBaseMarketPrice() (pricing-engine)
    └── OpenAI (primes, profil_cible, note_synthese)
    ↓
Retourne: loyer_base, loyer_recommande, primes_valorisation, profil_cible_titre, profil_cible_explication, note_synthese
```

### Flux Owner Journey (HTML)

```
/owner-journey.html
    ↓
Formulaire étapes → DPE (scan-dpe)
    ↓
Photos → scan-vision + pricing + analyze-photos
    ↓
Résultat annonce + loyer
```

---

## 3. Ce qui est fait

| Fonctionnalité | État |
|----------------|------|
| Agent IA conversationnel (Expert PatrimoTrust) | ✅ |
| Streaming SSE (token par token) | ✅ |
| Mémoire (historique messages) | ✅ |
| Auto-correction (contradiction silencieuse) | ✅ |
| Smart Widgets (boutons binaires Vide/Meublé) | ✅ |
| Upload non bloquant (indicateur DPE) | ✅ |
| Dossier Stratégique (loyer, waterfall, profil cible) | ✅ |
| API dossier-strategique | ✅ |
| Analyse photos (IA) | ✅ |
| Scan DPE (PDF) | ✅ |
| Scan vision (atouts) | ✅ |
| Pricing (loyer marché + surcote) | ✅ |
| Parcours owner-journey (HTML) | ✅ |
| Dashboard propriétaire | ✅ (structure) |
| Candidature locataire (Apply) | ✅ |
| Didit (identité) | ✅ |
| Passport (partage) | ✅ |
| Déploiement Docker | ✅ |

---

## 4. Ce qui reste à faire

| Fonctionnalité | Priorité | Notes |
|----------------|----------|-------|
| **Persistance PropertyData** | Haute | Sauvegarder le bien après Dossier Stratégique (MongoDB) |
| **Lien CTA → Dashboard** | Haute | Le bouton "Valider la Stratégie" redirige vers /dashboard/owner mais sans créer le bien |
| **Dashboard owner** | Haute | Récupérer les biens réels de l'utilisateur (TODO dans le code) |
| **Authentification Concierge** | Moyenne | Le parcours /concierge est public ; lier à un compte utilisateur |
| **Historique chat** | Moyenne | Persister les messages pour reprise de session |
| **Outils de Rayonnement** | Moyenne | Onglet 3 du Dossier : diffusion annonce (LeBonCoin, etc.) |
| **Storytelling annonce** | Basse | Vérifier que le style "prestige" est bien appliqué partout |
| **Tests E2E** | Basse | Automatiser les tests du flux Concierge |
| **ConciergeOnboardingClient** | Basse | Parcours formulaire alternatif ; peut être déprécié |
| **Unification owner-journey / concierge** | Basse | Deux parcours parallèles ; décider d'un seul point d'entrée |

---

## 5. Variables d'environnement

| Variable | Utilité |
|----------|---------|
| `OPENAI_API_KEY` | Requise pour agent, pricing, analyse photos, DPE |
| `MONGO_URI` | MongoDB |
| `JWT_SECRET` | Auth |
| `BREVO_USER` / `BREVO_PASS` | Emails |
| `PRICING_API_URL` | Optionnel ; API externe loyer |
| `GEO_VALIDATION` | Validation commune française |

---

## 6. Commandes utiles

```bash
# Développement
cd /opt/doc2loc && npm run dev

# Build
npm run build

# Production (Docker)
docker-compose -f docker-compose.getpatrimo.yml build
docker-compose -f docker-compose.getpatrimo.yml up -d
```

---

*Document généré le 2025-02-25*
