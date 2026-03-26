# Migration des routes Express → Next.js API Routes

## Routes dupliquées (migrées vers Next.js, supprimées d'Express)

| Route Express | Route Next.js | Statut |
|---|---|---|
| `POST /api/auth/register` | `app/api/auth/register/route.ts` | **Migré** — supprimé d'Express |
| `GET /api/public/apply/:token` | `app/api/public/apply/[token]/route.ts` | **Migré** — supprimé d'Express |
| `POST /api/webhooks/stripe` | `app/api/webhooks/stripe/route.ts` | **Migré** — supprimé d'Express |

## Routes Next.js uniquement (pas de doublon Express)

| Route Next.js | Description |
|---|---|
| `app/api/auth/[...nextauth]/route.ts` | NextAuth (login, session, callback) |
| `app/api/auth/send-otp/route.ts` | Envoi OTP magic link |
| `app/api/auth/verify-otp/route.ts` | Vérification OTP |
| `app/api/owner/properties/route.ts` | CRUD propriétés (owner) |
| `app/api/owner/properties/[id]/route.ts` | Détail propriété (owner) |
| `app/api/owner/properties/[id]/candidatures/route.ts` | Candidatures par propriété |
| `app/api/owner/properties/[id]/selection/route.ts` | Sélection candidat |
| `app/api/owner/properties/[id]/entry-report/route.ts` | État des lieux |
| `app/api/owner/leases/compile/route.ts` | Compilation bail |
| `app/api/owner/leases/compiled/[fileName]/route.ts` | Téléchargement bail compilé |
| `app/api/owner/leases/check-readiness/route.ts` | Vérification prêt à signer |
| `app/api/owner/candidatures/[id]/route.ts` | Détail candidature |
| `app/api/properties/[id]/candidatures/route.ts` | Candidatures (public) |
| `app/api/documents/delete/route.ts` | Suppression document |
| `app/api/billing/create-checkout/route.ts` | Création checkout Stripe |
| `app/api/billing/portal/route.ts` | Portail Stripe |
| `app/api/webhooks/didit/route.ts` | Webhook Didit |
| `app/api/webhooks/didit/guarantor/route.ts` | Webhook Didit garant |
| `app/api/didit/start/route.ts` | Démarrage vérification Didit |
| `app/api/didit/callback/route.ts` | Callback Didit |
| `app/api/didit/session/route.ts` | Session Didit |
| `app/api/didit/status/route.ts` | Statut Didit |
| `app/api/guarantor/create-session/route.ts` | Création session garant |
| `app/api/guarantor/status/route.ts` | Statut garant |
| `app/api/guarantor/audit/route.ts` | Audit garant |
| `app/api/scoring/tenant/route.ts` | Scoring locataire |
| `app/api/scoring/calculate/route.ts` | Calcul scoring |
| `app/api/trust/phase1/health/route.ts` | Health check trust |
| `app/api/analyze-document/route.ts` | Analyse document IA |
| `app/api/analyze-document-v2/route.ts` | Analyse document v2 |
| `app/api/analyze-photos/route.ts` | Analyse photos IA |
| `app/api/owner-tunnel/*/route.ts` | Tunnel propriétaire (6 routes) |
| `app/api/passport/*/route.ts` | Passeport locataire (4 routes) |
| `app/api/verify/[token]/route.ts` | Vérification token |

## Routes Express uniquement (à migrer ultérieurement)

| Route Express | Description |
|---|---|
| `POST /api/auth/login` | Login JWT (Express) |
| `GET /api/auth/profile` | Profil utilisateur |
| `PUT /api/auth/profile` | Mise à jour profil |
| `GET /api/billing/status` | Statut facturation |
| `GET/POST/PUT/DELETE /api/properties/*` | CRUD propriétés (Express legacy) |
| `GET/POST/PUT/DELETE /api/tenants/*` | CRUD locataires |
| `GET /api/documents/quittance/:id` | Génération quittance PDF |
| `POST /api/documents/email/:id` | Envoi document par email |
| `GET/POST/DELETE /api/property-documents/*` | Documents propriété (upload, list, delete) |
| `GET /api/events/*` | Événements (par propriété, locataire, résumé) |
| `POST /api/reminders/tenant/:tenantId` | Rappels locataire |
| `GET /api/alerts/overview` | Aperçu alertes |
| `GET /api/public/check-token/:token` | Vérification token (diagnostic) |
| `GET /api/public/property/:propertyId` | Propriété publique |
| `POST /api/public/property/:propertyId/apply` | Candidature publique |
| `POST /api/public/candidature` | Candidature (legacy) |
| `POST /api/public/lead` | Capture lead |
| `POST /api/webhooks/opensign` | Webhook OpenSign |
| `GET /api/admin/leads` | Admin leads (JSON) |
| `GET /api/admin/leads.csv` | Admin leads (CSV) |
| Router `/api/candidatures` | Routes candidatures (Express router) |
| Router `/api/documents` | Routes documents (Express router) |
| Router `/api/leases` | Routes leases (Express router) |
| Router `/api/properties` | Routes properties (Express router) |
