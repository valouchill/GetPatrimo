# Pay-per-Listing — Facturation par bien (V8.0)

Modèle économique : **forfait de base par bien + facturation au dépassement**
(Metered Billing Stripe). Chaque bien (`Property`) porte son propre quota
d'analyses IA.

## Grille tarifaire

| Offre | Prix/mois | Analyses IA incluses | Dépassement |
|---|---|---|---|
| **FREE** | 0 € | 0 (stockage seul) | — |
| **ESSENTIAL** | 19,90 € | 25 | +0,49 € / dossier |
| **PREMIUM** (Analyse IA) | 39,90 € | 100 | +0,49 € / dossier |
| **MAX** (Analyse IA Max) | 59,90 € | 250 | +0,49 € / dossier |

Source de vérité : `lib/billing/tiers.ts` (importable client + serveur).

---

## Rapport méthode : Metered Billing vs Achat de crédits

**Méthode retenue : Stripe Subscription + Metered Billing.**

### Pourquoi Metered Billing (et pas un système de crédits) ?

| Critère | Metered Billing ✅ | Crédits (Top-up) |
|---|---|---|
| Friction au dépassement | Aucune (carte enregistrée, facturé en fin de cycle) | L'owner doit racheter des crédits → analyse bloquée entre-temps |
| Réconciliation comptable | Native Stripe (factures, TVA, exports) | À gérer manuellement (solde, expiration, remboursements) |
| Modèle mental | « Forfait + à l'usage » familier (téléphonie) | « Porte-monnaie » à recharger |
| Risque d'impayé | Géré par Stripe (retries, dunning) | Risque de solde négatif si on autorise le découvert |
| Complexité d'implémentation | Webhook + 1 `createUsageRecord` par dépassement | Modèle de solde + transactions + idempotence maison |

Le seul avantage des crédits (paiement 100 % anticipé, zéro risque d'impayé)
est couvert par Stripe côté Metered (dunning + suspension). Pour un produit
« banque privée » où l'on ne veut pas bloquer un owner en plein closing de
bail, **le sans-friction prime** → Metered Billing.

### Architecture Stripe

Chaque souscription comporte **2 line items** :
1. **Prix de base** (`licensed`, `quantity: 1`) — le forfait mensuel
   (19,90 / 39,90 / 59,90 €).
2. **Prix au dépassement** (`metered`, `usage_type: metered`) — 0,49 €/unité.
   On y reporte la consommation au-delà du quota via
   `stripe.subscriptionItems.createUsageRecord(itemId, { quantity, action: 'increment' })`.

Le webhook `checkout.session.completed` :
- applique `tier` + `dossiersQuota`,
- récupère l'`id` du subscription item `metered` → `Property.stripeUsageItemId`
  (cible des futurs `createUsageRecord`).

---

## Variables d'environnement (Price IDs Stripe)

À créer dans le **Dashboard Stripe** (Produits → Prix), puis renseigner :

```bash
# Forfaits de base (recurring, licensed)
PRICE_ID_ESSENTIAL_BASE=price_xxx   # 19,90 €/mois
PRICE_ID_PREMIUM_BASE=price_xxx     # 39,90 €/mois
PRICE_ID_MAX_BASE=price_xxx         # 59,90 €/mois

# Dépassement (recurring, usage_type: metered, 0,49 €/unité)
PRICE_ID_ESSENTIAL_METERED=price_xxx
PRICE_ID_PREMIUM_METERED=price_xxx
PRICE_ID_MAX_METERED=price_xxx

# Déjà existants
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

> **Important** : chaque Price `metered` doit être configuré en
> `Recurring` → `Usage is metered` → `Sum of usage values during period`,
> prix unitaire 0,49 €.

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
   - si `OVERAGE` → `createUsageRecord` (best-effort, loggé).

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

- Le `createUsageRecord` est **best-effort** : si l'item metered n'est pas
  configuré (`stripeUsageItemId` vide), le dépassement est autorisé mais non
  facturé (loggé en warn). À monitorer.
- Pas encore de webhook `invoice.created` pour afficher le détail des
  dépassements facturés dans l'app (Stripe les expose déjà côté portail).
- Le changement d'offre (upgrade/downgrade) passe par une nouvelle Checkout :
  un proration `subscriptions.update` serait plus élégant (itération future).
