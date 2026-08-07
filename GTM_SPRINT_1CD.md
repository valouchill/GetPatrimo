# Sprint 1.C + 1.D — Playbook terrain (~3 semaines)

> **But 1.C :** 50 conversations + 15 bêta-proprios activés + Google Ads live.
> **But 1.D :** onboarding manuel + 5 verbatims + **15 payants** (ou objections documentées).
> Métrique nord : nouveaux payants/semaine (PostHog `purchase_completed`).

Légende : `[ ]` à faire · 🏁 jalon.

---

## 🔴 JOUR 0 — Prérequis (2-3 h, AVANT tout trafic)

### P1 — Stripe en LIVE (sinon personne ne peut payer)
- [ ] Dashboard Stripe → activer le compte live (KYB si pas fait)
- [ ] Créer les **3 prix one-time LIVE** : 19,90 / 39,90 / 59,90 €
- [ ] Renommer les 3 Products : « Essentiel — Vérifiez votre finaliste », « Pro — Comparez votre short-list », « Pro max — Sécurisez votre location »
- [ ] `/opt/doc2loc/.env` : `STRIPE_SECRET_KEY=sk_live_…` + `PRICE_ID_ESSENTIAL_BASE` / `_PREMIUM_BASE` / `_MAX_BASE` (les IDs live) + webhook live → `STRIPE_WEBHOOK_SECRET=whsec_…` (endpoint `/api/webhooks/stripe`, event `checkout.session.completed`)
- [ ] Recreate conteneur (env runtime, pas de rebuild) : `cd /opt/doc2loc && docker compose -f docker-compose.getpatrimo.yml up -d --no-build --force-recreate`
- [ ] **Test réel de bout en bout** : compte témoin → analyse → paywall → **achat réel 19,90 € avec ta carte** → vérifier déblocage (noms visibles, quota 3) → **rembourser** via Stripe
- [ ] 🏁 **P1 — un achat réel fonctionne de bout en bout**

### P1-bis — Armes de closing B2B (5 min, dans la même session Stripe)
- [ ] Créer 2 produits **récurrents mensuels** : « Pro Starter » 99 €/mois · « Pro Agence » 199 €/mois
- [ ] Créer les 2 **Payment Links** correspondants — config : **CB + prélèvement SEPA**, **codes promo autorisés**, **facturation automatique** (factures TVA pour la compta des agences)
- [ ] Créer 1 coupon de closing : `PILOTE50` (−50 % pendant 2 mois)
- [ ] Ranger les 2 liens dans le Sheet pipeline (PAS sur la page /pro — le seul CTA public reste le pilote gratuit ; le lien se dégaine en call, au moment du « oui »)
- [ ] ⚠️ Grille = ancre : on ne baisse JAMAIS le prix affiché, on négocie au coupon limité dans le temps

### P2 — Outillage de suivi (30 min)
- [ ] Google Sheet « Pipeline Sprint 1 » : onglet *Conversations* (date · canal · pseudo · sujet · lien · statut DM) · onglet *Bêtas* (nom · source · date signup · activé O/N · verbatim O/N · payant O/N · objection) · onglet *Dépenses* (semaine · canal · € · signups · payants)
- [ ] PostHog : épingler funnel A (signup→analysis→purchase) + payants/semaine + breakdown `utm_source`

### P3 — L'offre bêta (à cause de l'essai à 1 audit)
- [ ] Décision : chaque bêta reçoit **le pack Essentiel offert** (3 audits + déblocage) **contre 20 min de feedback + 1 témoignage**. Ça teste AUSSI l'expérience payante réelle.
- [ ] Mécanique : à la main en base (tier ESSENTIAL, dossiersQuota 3, managed true sur son bien) — *demander à Claude de scripter le grant au fil de l'eau*, ou coupon Stripe 100 %.

---

## 🟧 SEMAINE 1 — Communautés + Ads (Sprint 1.C)

### Tâche 1 — Installation dans 5 communautés (Jour 1)
- [ ] Rejoindre : FB « Propriétaires Bailleurs » · FB « Investissement immobilier locatif » · forum PAP · Reddit r/vosfinances (+ r/immobilier) · 1 Discord invest immo
- [ ] Profil perso crédible (photo, prénom réel) — PAS de page entreprise
- [ ] Lire les règles de chaque groupe (la plupart bannissent l'autopromo → méthode aide-d'abord obligatoire)

### Tâche 2 — 5 interactions utiles / jour × 10 jours (Jours 1-12)
- [ ] Chercher dans chaque groupe : « impayé », « faux bulletin », « dossier locataire », « garant », « DossierFacile », « arnaque »
- [ ] Répondre avec du CONSEIL réel (3-6 phrases, zéro lien, zéro promo). Exemples d'angles : comment repérer un bulletin retouché (métadonnées, cumuls URSSAF incohérents), taux d'effort, Visale vs garant physique
- [ ] Quand quelqu'un a EXACTEMENT ton problème → commentaire utile PUIS DM (template A)
- [ ] Logger chaque interaction dans le Sheet
- [ ] 🏁 **C1 — 50 interactions sincères** (~J12)

### Tâche 3 — Recruter 15 bêtas (Jours 2-12)
Sources : DM communautés + réseau perso (post LinkedIn/entourage, template B) + le premier candidat Sésame venu.
- [ ] Envoyer ~30 DM/messages personnalisés (taux de oui ~50 %)
- [ ] À chaque oui : créer/l'aider à créer son compte + **poser le pack bêta offert** + l'aider à créer son bien et **mettre le lien Sésame sur sa vraie annonce** (LeBonCoin/PAP)
- [ ] Suivi J+1 : « tu as reçu des dossiers ? un blocage ? »
- [ ] 🏁 **C2 — 15 comptes bêta ACTIVÉS** (≥1 analyse réelle chacun)

### Tâche 4 — Google Ads (Jours 3-4, ~1 h de setup)
⚠️ Pas de gtag installé (choix RGPD cookieless) → **la mesure se fait dans PostHog** (`utm_source=google`), pas dans Google Ads. Optimisation manuelle hebdo.
- [ ] 1 campagne Search « Vérif dossier locataire » · budget **12 €/jour** (~360 €/mois) · France · CPC max ~1,50 €
- [ ] 1 groupe d'annonces, mots-clés en **[exact]** : `[vérifier dossier locataire]` `[vérifier solvabilité locataire]` `[faux bulletin de salaire locataire]` `[détecter faux bulletin de salaire]` `[analyser dossier locataire]` `[éviter impayés locataire]`
- [ ] Négatifs : `gratuit, modèle, exemple, CAF, emploi, salaire moyen, simulation`
- [ ] 2 RSA — Titres : « Vérifier un dossier locataire » · « Détectez les faux bulletins » · « Score de fiabilité sur 100 » · « 1 audit forensic offert » · « Comparez vos candidats » — Descriptions : « Avant de signer, vérifiez l'authenticité et la solvabilité du dossier. RGPD, sans abonnement. » · « Pré-tri gratuit de tous vos candidats + audit anti-fraude. Testez maintenant. »
- [ ] URL finale : `https://maisonpatrimo.com/?utm_source=google&utm_medium=cpc&utm_campaign=verif-dossier`
- [ ] 🏁 **C3 — campagne live, dépense qui court, arrivées `utm_source=google` visibles dans PostHog**

### Convention UTM (pour que le breakdown PostHog serve à quelque chose)
| Canal | Lien à utiliser |
|---|---|
| Google Ads | `?utm_source=google&utm_medium=cpc&utm_campaign=verif-dossier` |
| Groupes Facebook (DM) | `?utm_source=fb-groupes` |
| Forum PAP | `?utm_source=pap` |
| Reddit | `?utm_source=reddit` |
| LinkedIn / réseau perso | `?utm_source=reseau` |
| Boucle Sésame | déjà automatique (`utm_source=sesame`) |

---

## 🟥 SEMAINES 2-3 — Onboarding, verbatims, premiers € (Sprint 1.D)

### Tâche 5 — Onboarding manuel des 15 (continu)
- [ ] Chaque bêta : message J+1 puis J+4 · proposer 15 min de visio/partage d'écran
- [ ] Objectif par bêta : bien créé → Sésame sur sa vraie annonce → ≥1 vrai dossier reçu → ≥1 analyse
- [ ] Noter chaque blocage produit dans le Sheet (c'est de l'or)
- [ ] 🏁 **D1 — 15/15 ont fait une vraie analyse OU blocage documenté**

### Tâche 6 — 5 verbatims (Semaine 3)
- [ ] Caler 5 appels de 20 min avec les bêtas les plus actifs
- [ ] Les 5 questions : 1) Qu'est-ce qui t'a le plus marqué ? 2) Qu'est-ce qui t'a bloqué/rendu confus ? 3) Si tu devais payer, tu l'aurais fait ? À quel prix ça te paraît juste ? 4) Dans quelle situation précise tu t'en resservirais ? 5) À qui tu le recommanderais ?
- [ ] Noter les PHRASES EXACTES (pas des résumés) → futur copy
- [ ] Demander l'accord pour 3 témoignages publiables (prénom + situation)
- [ ] 🏁 **D2 — 5 verbatims + 3 témoignages**

### Tâche 7 — Demander l'achat (Semaine 2-3, en continu)
Trois cibles, trois gestes :
- [ ] **Non-bêtas au paywall** (venus par ads/communautés/Sésame) : le produit vend seul désormais ; relance manuelle J+2 pour ceux qui ont vu le paywall sans acheter (PostHog : personnes avec `paywall_viewed` sans `purchase_completed`) — template C
- [ ] **Bêtas (pack offert)** : question willingness-to-pay (Q3 du verbatim) + proposer l'achat réel pour un 2ᵉ bien ou un pack supérieur
- [ ] **Chaque non-achat** : noter LA raison exacte (prix ? confiance ? pas de candidats ? DossierFacile ?) dans le Sheet
- [ ] 🏁 **D3 — SORTIE : 15+ payants OU liste des objections** (les deux valent de l'or)

### Rituel hebdo (lundi, 30 min — non négociable)
1. Payants cette semaine (PostHog) vs objectif
2. Funnel A : où est la plus grosse fuite ? → 1 action
3. Breakdown `utm_source` : quel canal amène des PAYANTS (pas des clics) ? → doubler / couper
4. Ads : dépense vs signups `utm_source=google` → couper les mots-clés à 0 signup après ~15 € dépensés

---

## Templates

**A — DM communauté (après avoir aidé)**
> Bonjour [prénom], j'ai vu ton message sur [les impayés / le tri des dossiers]. Je construis Maison Patrimo, un outil qui vérifie l'authenticité d'un dossier locataire (faux bulletins, solvabilité) et pré-trie tous les candidats. Je cherche quelques propriétaires pour le tester — je t'offre le pack complet contre 20 min de retour d'expérience. Ça te dit ? Zéro engagement.

**B — Post réseau perso (LinkedIn / entourage)**
> Je cherche 10 propriétaires bailleurs qui mettent un bien en location dans les 2 prochains mois. Je leur offre l'audit anti-fraude complet de leurs dossiers locataires (détection de faux bulletins, score de solvabilité, comparaison des candidats) en échange de 20 minutes de feedback. Qui connaît quelqu'un ? 🙏

**C — Relance paywall (J+2, email/DM)**
> Bonjour [prénom], vous avez analysé un dossier sur Maison Patrimo cette semaine — j'espère que le résultat vous a été utile. Vos autres candidats restent masqués : si vous hésitez à débloquer la comparaison, je peux vous montrer en 10 min ce que ça donne sur vos dossiers (ou répondre à vos questions). — Valentin, fondateur

---

## Jalons récapitulatifs
| Jalon | Cible | Échéance |
|---|---|---|
| 🏁 P1 achat réel OK (Stripe live) | 1 achat testé+remboursé | J0 |
| 🏁 C1 conversations | 50 | ~J12 |
| 🏁 C2 bêtas activés | 15 | ~J12 |
| 🏁 C3 Ads live | dépense + utm visibles | J4 |
| 🏁 D1 onboarding | 15/15 | ~J18 |
| 🏁 D2 verbatims | 5 + 3 témoignages | ~J21 |
| 🏁 D3 payants | **15+** (ou objections) | ~J21-30 |
