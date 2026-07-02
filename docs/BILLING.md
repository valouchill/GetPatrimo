# Pay-per-Listing — Facturation par bien (V8.0 · achat one-time)

Modèle économique : **achat unique d'une offre par bien** (paiement Stripe one-time).
Chaque achat débloque un quota fixe d'analyses IA pour ce `Property`. Au-delà du quota :
**plafond dur** (racheter une offre) — pas de facturation à l'usage.

## Grille tarifaire

| Offre | Prix (paiement unique) | Audits forensic inclus | Au-delà du quota |
|---|---|---|---|
| **FREE** | 0 € | 3 (essai gratuit, par compte) | Souscrire une offre |
| **ESSENTIAL** (Vérifier mon finaliste) | 19,90 € | 3 | Racheter une offre |
| **PREMIUM** (Comparer ma short-list) | 39,90 € | 10 | Racheter une offre |
| **MAX** (Sécuriser ma location) | 59,90 € | 20 | Racheter une offre |

Source de vérité : `lib/billing/tiers.ts` (importable client + serveur).

> **Offre orientée résultat (07/2026)** : chaque pack payant débloque en plus la
> **comparaison détaillée de tous les candidats** du bien (`isManaged`) ; le quota =
> nb d'audits forensic profonds. Les volumes historiques (25/100/250) sont réservés
> à la future offre B2B. Les biens achetés avant le recut conservent leur
> `dossiersQuota` stocké (cf. `effectiveQuota` : valeur DB prioritaire).

---

## Rapport méthode : achat one-time + plafond dur

**Méthode retenue : Stripe Checkout `mode: payment` (paiement unique) + plafond dur au quota.**

- Les offres sont des **achats ponctuels par bien** : on paie une fois pour débloquer
  l'analyse IA d'une mise en location, pas un abonnement mensuel.
- **Pas de facturation à l'usage** : au-delà du quota inclus, l'analyse est bloquée (HTTP 402)
  et l'owner rachète une offre (ou monte de gamme). Aucune facture surprise.
- Réconciliation Stripe native (paiements, TVA, exports). Pas de gestion de solde côté app.

> **Historique (re-audit V1)** : l'implémentation initiale visait un *abonnement + metered
> overage* (`subscriptionItems.createUsageRecord`, retiré du SDK v20), puis des *invoice
> items*. Les offres étant finalement des **achats one-time**, ni l'abonnement ni les invoice
> items (qui exigent une facture récurrente) ne s'appliquent → `mode: payment` + plafond dur.

### Architecture Stripe

Checkout `POST /api/billing/subscribe` en **`mode: payment`** (paiement unique) avec
**1 line item** : l'offre achetée (Price `one_time`, 19,90 / 39,90 / 59,90 €).
`customer_creation: 'always'` pour conserver le client + son historique de paiement.

Le webhook `checkout.session.completed` finalise :
- `managed: true`, `tier`, `dossiersQuota` (quota acheté), compteur remis à zéro,
- capture `Property.stripeCustomerId`.

Au-delà du quota : `checkAnalysisAllowed` renvoie `reason: 'QUOTA_EXCEEDED'` (HTTP 402) quand
l'enforcement est actif → l'app invite à racheter. Aucun appel Stripe à la consommation.

---

## Variables d'environnement (Price IDs Stripe)

À créer dans le **Dashboard Stripe** (Produits → Prix), puis renseigner :

```bash
# Offres (Price one-time / paiement unique) — SEULS prix à créer
PRICE_ID_ESSENTIAL_BASE=price_xxx   # 19,90 €
PRICE_ID_PREMIUM_BASE=price_xxx     # 39,90 €
PRICE_ID_MAX_BASE=price_xxx         # 59,90 €

# Clés Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

> **Note** : chaque Price doit être créé en **One-time** (paiement unique), PAS « Recurring ».
> `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` est inutile (checkout par redirection).

Webhook Stripe → `/api/webhooks/stripe`, events : `checkout.session.completed`,
`customer.subscription.deleted` (legacy), `invoice.payment_failed` (legacy).

---

## Garde-fous backend

`POST /api/owner/applications/[id]/analyze-v2` (le `TenantAnalysisService`) :

1. Charge la `Property` liée au dossier.
2. `checkAnalysisAllowed(property, applicationId, { enforced, accountFreeUsed })` :
   - **FREE, essai dispo** (< `FREE_TRIAL_LIMIT`=3 au niveau du COMPTE) → `FREE_TRIAL`.
   - **FREE, essai épuisé** (enforced) → `402` (`code: PAYMENT_REQUIRED`, reason `FREE_TRIAL_EXHAUSTED`) → souscrire.
   - **Payant, dossier déjà compté** → `ALREADY_COUNTED` (re-analyse gratuite).
   - **Payant, dans le quota** → `WITHIN_QUOTA`.
   - **Payant, quota épuisé** (enforced) → `402` (`code: QUOTA_EXCEEDED`) → racheter.
3. (analyse IA) — uniquement si autorisé.
4. Décompte **après succès** :
   - `FREE_TRIAL` → `User.freeAnalysesUsed += 1` (COMPTE, atomique borné) + dédup du dossier sur le bien.
   - `WITHIN_QUOTA` → `consumeAnalysisQuota` (+1 par bien : `dossiersAnalyzedCount`, `analyzedApplicationIds`).

> **Essai gratuit = 3 analyses PAR COMPTE** (`User.freeAnalysesUsed`, plafond `FREE_TRIAL_LIMIT`),
> pas par bien. `enforced` est piloté par `BILLING_ENFORCED` (`lib/features.ts`, **`true`** en prod) ;
> en soft-launch (`false`), FREE n'est pas bloqué.
>
> **Par DOSSIER, pas par appel** : ré-analyser le même dossier ne reconsomme pas de quota
> (`analyzedApplicationIds` déduplique). **On consomme après succès** : une analyse qui
> échoue ne décompte rien.

---

## Frontend

- **Jauge** `PropertyQuotaGauge` (page détail bien) : « Dossiers analysés : X / quota » +
  barre, badge « quota presque atteint » à ≥ 90 %, badge « quota épuisé → racheter » au-delà.
- **Upsell FREE / quota épuisé** : `AnalysisV2Panel` affiche un encart « Voir les offres »
  sur 402 (au lieu d'une erreur brute).
- **Page `/pricing`** : tableau comparatif 4 offres (paiement unique) + CTAs →
  `POST /api/billing/subscribe`.

---

## Limites connues / TODO

- **Rachat** : 1er achat depuis FREE → quota frais (les essais gratuits du compte ne le grèvent
  pas) ; rachat payant→payant → **cumul** des crédits + niveau le plus élevé (`higherTier`), sans
  recompter les analyses faites.
- Le **paywall** `BILLING_ENFORCED` est **`true`** (activé). Le flag est inliné au build
  (`NEXT_PUBLIC_FEATURES_V1`) → tout changement nécessite un rebuild.
- Paywall propriétaire récurrent (`OWNER_PAYWALL`, route `create-checkout`) : **désactivé**
  (feature V2, encore en `mode: subscription` — à revoir si réactivé).
