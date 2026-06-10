# Pay-per-Listing — Facturation par bien (V8.0 · overage = invoice items)

Modèle économique : **forfait de base par bien + facturation au dépassement**
(forfait Stripe Subscription + dépassement via *invoice items*). Chaque bien
(`Property`) porte son propre quota d'analyses IA.

## Grille tarifaire

| Offre | Prix/mois | Analyses IA incluses | Dépassement |
|---|---|---|---|
| **FREE** | 0 € | 0 (stockage seul) | — |
| **ESSENTIAL** | 19,90 € | 25 | +0,49 € / dossier |
| **PREMIUM** (Analyse IA) | 39,90 € | 100 | +0,49 € / dossier |
| **MAX** (Analyse IA Max) | 59,90 € | 250 | +0,49 € / dossier |

Source de vérité : `lib/billing/tiers.ts` (importable client + serveur).

---

## Rapport méthode : à l'usage (invoice items) vs Achat de crédits

**Méthode retenue : Stripe Subscription (forfait) + invoice items (à l'usage).**

### Pourquoi facturer à l'usage (et pas un système de crédits) ?

| Critère | À l'usage (invoice items) ✅ | Crédits (Top-up) |
|---|---|---|
| Friction au dépassement | Aucune (carte enregistrée, facturé en fin de cycle) | L'owner doit racheter des crédits → analyse bloquée entre-temps |
| Réconciliation comptable | Native Stripe (factures, TVA, exports) | À gérer manuellement (solde, expiration, remboursements) |
| Modèle mental | « Forfait + à l'usage » familier (téléphonie) | « Porte-monnaie » à recharger |
| Risque d'impayé | Géré par Stripe (retries, dunning) | Risque de solde négatif si on autorise le découvert |
| Complexité d'implémentation | Webhook + 1 `invoiceItems.create` par dépassement | Modèle de solde + transactions + idempotence maison |

Le seul avantage des crédits (paiement 100 % anticipé, zéro risque d'impayé)
est couvert par Stripe (dunning + suspension). Pour un produit « banque privée »
où l'on ne veut pas bloquer un owner en plein closing de bail, **le sans-friction
prime** → facturation à l'usage.

> **Note d'archi (re-audit V1)** : l'implémentation initiale visait le *Metered
> Billing* legacy (`subscriptionItems.createUsageRecord`), mais cette API a été
> retirée du SDK Stripe v20 (et la création de prix `usage_type=metered` est
> désactivée pour les nouveaux comptes). On facture donc le dépassement par
> **invoice items** posés sur le client : même résultat (ajout à la facture de
> fin de cycle), sans dépendre du metered legacy ni d'un *meter* à configurer.

### Architecture Stripe

Chaque souscription comporte **1 line item** :
1. **Prix de base** (`licensed`, `quantity: 1`) — le forfait mensuel
   (19,90 / 39,90 / 59,90 €).

Le **dépassement** (0,49 €/dossier) n'est PAS un line item d'abonnement : à
chaque dossier au-delà du quota, `reportOverageToStripe` (quota-service) appelle
`stripe.invoiceItems.create({ customer, amount: 49, currency: 'eur' })` → le
montant est ajouté à la **prochaine facture** de l'abonnement. Prix unitaire
surchargeable par `OVERAGE_UNIT_CENTS` (défaut 49).

Le webhook `checkout.session.completed` :
- applique `tier` + `dossiersQuota`,
- capture `Property.stripeCustomerId` (cible des futurs invoice items).

---

## Variables d'environnement (Price IDs Stripe)

À créer dans le **Dashboard Stripe** (Produits → Prix), puis renseigner :

```bash
# Forfaits de base (recurring, licensed) — SEULS prix à créer dans Stripe
PRICE_ID_ESSENTIAL_BASE=price_xxx   # 19,90 €/mois
PRICE_ID_PREMIUM_BASE=price_xxx     # 39,90 €/mois
PRICE_ID_MAX_BASE=price_xxx         # 59,90 €/mois

# Dépassement : facturé via invoice items (AUCUN prix Stripe à créer).
# Prix unitaire en centimes, optionnel (défaut 49 = 0,49 €).
OVERAGE_UNIT_CENTS=49

# Clés Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

> **Note** : il n'y a plus de prix `metered` à configurer — le dépassement est
> facturé en centimes via `invoiceItems.create`. Seuls les **3 prix de base**
> `recurring` (licensed) sont nécessaires.

---

## Garde-fous backend

`POST /api/owner/applications/[id]/analyze-v2` (le `TenantAnalysisService`) :

1. Charge la `Property` liée au dossier.
2. `checkAnalysisAllowed(property, applicationId)` :
   - **FREE** → `402 Payment Required` (`code: PAYMENT_REQUIRED`, `pricingUrl`).
   - **Payant, dossier déjà compté** → `ALREADY_COUNTED` (re-analyse gratuite).
   - **Payant, dans le quota** → `WITHIN_QUOTA`.
   - **Payant, au-delà** → `OVERAGE`.
3. (analyse IA) — uniquement si autorisé.
4. `consumeAnalysisQuota(...)` **après succès** :
   - +1 dossier distinct (`dossiersAnalyzedCount`, `analyzedApplicationIds`),
   - si `OVERAGE` → `invoiceItems.create` sur le client (best-effort, loggé).

> **Facturation par DOSSIER, pas par appel** : ré-analyser le même dossier ne
> reconsomme pas de quota (`analyzedApplicationIds` déduplique). Cohérent avec
> la limite « 1 ré-analyse / dossier » (V7.13).
>
> **On consomme après succès** : une analyse qui échoue ne décompte rien.

---

## Frontend

- **Jauge** `PropertyQuotaGauge` (page détail bien) : « Dossiers analysés :
  X / quota » + barre, badge d'alerte à ≥ 90 %, upsell sur dépassement.
- **Upsell FREE** : `AnalysisV2Panel` affiche un encart « Voir les offres »
  sur 402 (au lieu d'une erreur brute).
- **Page `/pricing`** : tableau comparatif 4 offres + CTAs spécifiques +
  souscription Stripe (`POST /api/billing/subscribe`).

---

## Limites connues / TODO

- La facturation du dépassement est **best-effort** : si `stripeCustomerId` est
  absent, le dépassement est autorisé mais non facturé (loggé en warn). À monitorer.
- Pas encore de webhook `invoice.created` pour afficher le détail des
  dépassements facturés dans l'app (Stripe les expose déjà côté portail).
- Le changement d'offre (upgrade/downgrade) passe par une nouvelle Checkout :
  un proration `subscriptions.update` serait plus élégant (itération future).
