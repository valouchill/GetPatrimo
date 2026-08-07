# Plan de conquête 120 jours — Maison Patrimo
*(remplace `GTM_SPRINT_1.md` — version consolidée des 4 sprints)*

## 🎯 Cap stratégique (valable sur tout le plan)
- **Architecture gagnante :** 🪝 anti-fraude = *wedge* (acquisition + preuve) → 🔁 abonnement gestion autonome = moteur de **LTV/récurrent** → 🚀 B2B = accélérateur vers **100-200 k€**. Passeport locataire = **boucle de croissance** d'abord, revenu ensuite (Phase 2+).
- **North star :** nouveaux clients payants / semaine.
- **COGS connu :** ~0,15 €/analyse en early-stage (Didit gratuit) → ~0,40 € à l'échelle. **Marge ~90 %+ → on price pour la CONVERSION, pas pour la marge.**
- **Différenciation (à marteler) :** *« DossierFacile aide le locataire à présenter un dossier. Maison Patrimo aide le propriétaire à décider, détecter la fraude, comparer les candidats et sécuriser toute la vie du bail. »*
- **Garde-fous :** loi Hoguet (rester « assistant en autonomie », jamais « service de gestion »/mandataire) · prix **TTC** pour les particuliers · **jamais de péage locataire obligatoire**.

Légende : `[ ]` à faire · `[x]` fait · 🏁 jalon · ⭐ priorité.

---

# 🟦 SPRINT 1 — Fondations & preuve (J1 → J30)
> **But :** entonnoir étanche, aha sans locataire, **marge validée**, 15 premiers payants à la main.
> **Sortie :** 15+ payants + taux essai→payant + COGS/marge par offre validés.

## Sous-sprint 1.A — Activation, mesure & COGS (Sem. 1)
### Tâche 1 — Mode « dossier exemple » ⭐
- [ ] 1.1 Dossier exemple **propre** (Grade S)
- [ ] 1.2 Dossier exemple **frauduleux** (bulletin retouché, métadonnées détectables)
- [ ] 1.3 Bouton « Tester avec un dossier exemple » dès l'inscription
- [ ] 1.4 Clic → pipeline → écran résultat réel (score, fraude, Grade)
- [ ] 1.5 Exclure la démo du quota d'essais gratuits
- [ ] 1.6 Test : compte neuf → aha < 2 min
- [ ] 1.7 (si touche `analyze-v2`) rebuild + recreate Docker
- [ ] 🏁 **A1** — aha sans locataire externe < 2 min

### Tâche 2 — Instrumentation (4 events)
- [ ] 2.1 Projet PostHog EU + consentement RGPD
- [ ] 2.2 `posthog-js` cookieless + `identify(userId)`
- [ ] 2.3 `posthog-node` (serveur)
- [ ] 2.4 `signup_completed` · 2.5 `analysis_completed` (serveur) · 2.6 `paywall_viewed` · 2.7 `purchase_completed` (webhook Stripe)
- [ ] 2.8 Vérifier le stitch anonyme→connu
- [ ] 🏁 **A2** — dashboard live (inscrits/analyses/paywall/achats)

### Tâche 3 — COGS réel & marge ⭐ (gate des ads)
- [ ] 3.1 Lire le coût moyen/analyse dans le cockpit admin (`ApiCostLog`)
- [ ] 3.2 Confirmer statut Didit (gratuit < 500/mois, puis 0,25 €)
- [ ] 3.3 Vérifier coût signature électronique (OpenSign) → add-on ou premium ?
- [ ] 3.4 Calculer marge brute **par offre** (cf. Annexe A)
- [ ] 3.5 Fixer le coût max acceptable/analyse + le suivi « franchissement 500 Didit/mois »
- [ ] 🏁 **A3** — COGS chiffré + marge/offre validée (**condition pour lancer les ads**)

## Sous-sprint 1.B — Offres, message & boucle (Sem. 2)
### Tâche 4 — Landing + offres + différenciation
- [ ] 4.1 Rédiger les 3 angles (impayé / fraude / temps) — Annexe E
- [ ] 4.2 Hero + CTA « Tester gratuitement »
- [ ] 4.3 Afficher la **grille d'offres** orientée résultat (Annexe A) — héros = « Comparer mes candidats »
- [ ] 4.4 Bloc différenciation **DossierFacile** (Annexe C)
- [ ] 4.5 Réassurance : Didit / eIDAS / RGPD · prix **TTC**
- [ ] 4.6 **Waitlist « gestion locative bientôt disponible »** (teste l'intérêt récurrent)
- [ ] 4.7 Capter `utm_*`/`ref` jusqu'au signup ; 3 variantes d'angle par UTM
- [ ] 🏁 **B1** — landing live, offres + waitlist + UTM en place

### Tâche 5 — Boucle Sésame + expérience locataire
- [ ] 5.1 Bandeau « Sécurisé par Maison Patrimo » sur le tunnel locataire
- [ ] 5.2 Encart « Vous êtes propriétaire ? Testez gratuitement → » (`?ref=sesame`)
- [ ] 5.3 Concevoir l'expérience locataire **gratuite & loop-friendly** (portabilité, branding) — base du futur Passeport
- [ ] 5.4 Vérifier `ref=sesame` dans PostHog
- [ ] 🏁 **B2** — Sésame brandé + invitation proprio trackée

## Sous-sprint 1.C — Premiers proprios à la main (Sem. 3)
### Tâche 6 — 50 conversations / 5 communautés
- [ ] 6.1 Rejoindre 5 communautés (Annexe E)
- [ ] 6.2 Repérer 50 discussions impayés/sélection/fraude
- [ ] 6.3 Aider d'abord, basculer en DM, logger les 50
- [ ] 🏁 **C1** — 50 interactions + intéressés

### Tâche 7 — Recruter 15 bêta-proprios
- [ ] 7.1 Envoyer le DM (Annexe E) · 7.2 créer/accompagner 15 comptes · 7.3 chacun ≥1 analyse
- [ ] 🏁 **C2** — 15 comptes activés

### Tâche 8 — Google Ads (⚠️ seulement si A3 verte)
- [ ] 8.1 Campagne + groupe d'annonces · 8.2 mots-clés exacts (Annexe E) · 8.3 exclusions
- [ ] 8.4 2 annonces RSA · 8.5 budget 350-400 €/mois plafonné · 8.6 suivi conversion · 8.7 UTM par angle
- [ ] 🏁 **C3** — campagne live, conversions trackées

## Sous-sprint 1.D — Premiers € (Sem. 4)
### Tâche 9 — Onboarding manuel
- [ ] 9.1 Contacter les 15 · 9.2 appel 15 min / partage écran · 9.3 aider à analyser un vrai candidat
- [ ] 🏁 **D1** — chaque bêta a fait une vraie analyse ou expliqué son blocage

### Tâche 10 — 5 verbatims
- [ ] 10.1 Caler 5 échanges · 10.2 poser les 5 questions (Annexe E) · 10.3 écrire 5 verbatims + 3 témoignages
- [ ] 🏁 **D2** — 5 verbatims + 3 témoignages

### Tâche 11 — Demander l'achat
- [ ] 11.1 Relancer ceux qui ont touché le paywall · 11.2 inviter explicitement (offre « Comparer mes candidats ») · 11.3 noter les non-achats
- [ ] 🏁 **D3 — SORTIE SPRINT 1 : 15+ payants** + taux essai→payant + marge/offre validés

---

# 🟩 SPRINT 2 — Channel-fit & amorce B2B (J31 → J60)
> **But :** trouver LE canal répétable, mesurer la boucle, lancer une offre B2B **simple (analyse seule)**.
> **Sortie :** 50+ payants cumulés, ≥1 canal répétable, offre B2B en marché + 2 pilotes.

## Sous-sprint 2.A — Boucle & parrainage (Sem. 5)
- [ ] 12.1 Activer le **parrainage** (crédit donné/reçu)
- [ ] 12.2 Instrumenter & mesurer le **k-factor** de la boucle Sésame
- [ ] 12.3 Renforcer l'expérience locataire gratuite (partage 1 clic)
- [ ] 🏁 **E1** — parrainage live + k-factor mesuré

## Sous-sprint 2.B — Contenu & SEO (Sem. 6)
- [ ] 13.1 2 articles haute-intention (vérifier dossier / faux bulletin)
- [ ] 13.2 2 lead magnets (checklist anti-arnaque, simulateur solvabilité)
- [ ] 13.3 Page comparative vs DossierFacile (SEO + positionnement)
- [ ] 🏁 **E2** — 2 aimants à leads publiés

## Sous-sprint 2.C — Expériences de canal (Sem. 7)
- [ ] 14.1 1 expérience de canal / semaine
- [ ] 14.2 Comparer canaux **par conversion en payant** (pas clics)
- [ ] 14.3 Couper les morts, doubler les vivants
- [ ] 🏁 **E3** — ≥1 canal répétable identifié

## Sous-sprint 2.D — Amorce B2B (Sem. 8)
- [ ] 15.1 Packager l'offre B2B **analyse seule** : Pro 99 €/mois (~50 analyses) + dépassement 2,90 € (Annexe A)
- [ ] 15.2 Lister 100 cibles (agences, gestionnaires, mandataires, chasseurs, GLI)
- [ ] 15.3 Séquence outbound LinkedIn + email (RGPD B2B, opt-out)
- [ ] 15.4 10 démos
- [ ] 🏁 **E4 — SORTIE SPRINT 2 : 50+ payants** + offre B2B live + 2 pilotes

---

# 🟧 SPRINT 3 — Systématiser, récurrent & partenariats (J61 → J90)
> **But :** scaler le canal gagnant, **shipper le MVP gestion autonome** (récurrent), signer 1 partenariat, PR.
> **Sortie :** 120+ payants cumulés, premiers abonnés récurrents, 1 partenariat signé, 1 retombée presse.

## Sous-sprint 3.A — Scale du canal gagnant (Sem. 9)
- [ ] 16.1 Industrialiser le canal n°1 (process contenu / budget ads / playbook communautés)
- [ ] 16.2 Doubler le budget paid **uniquement si** CAC < marge
- [ ] 🏁 **F1** — canal n°1 sous process

## Sous-sprint 3.B — MVP gestion autonome (récurrent) (Sem. 10) ⭐
- [ ] 17.1 Construire l'**Essentiel** : quittances, avis d'échéance, coffre-fort, rappels, courriers
- [ ] 17.2 Wording **« assistant de gestion en autonomie »** (garde-fou Hoguet) + check juridique
- [ ] 17.3 Pricing **7,90 €/mois TTC** (bêta 4,99 €/mois 3 mois) + annuel 79-89 € (Annexe A)
- [ ] 17.4 Upsell post-analyse : « dossier validé → passez en gestion autonome »
- [ ] 17.5 Convertir la waitlist (Sprint 1) en premiers abonnés
- [ ] 🏁 **F2** — gestion autonome Essentiel live + premiers abonnés récurrents

## Sous-sprint 3.C — Partenariats & PR (Sem. 11)
- [ ] 18.1 Pitcher 5 distributeurs (assureur GLI, réseaux mandataires, courtiers)
- [ ] 18.2 Étude data « X % des dossiers contiennent un faux » + pitch presse (PAP, BFM Immo, MoneyVox, Capital)
- [ ] 🏁 **F3** — 5 pitchs envoyés + étude publiée

## Sous-sprint 3.D — Closing B2B & récurrent (Sem. 12)
- [ ] 19.1 Convertir les pilotes B2B en contrats (Pro/Agence)
- [ ] 19.2 Signer 1 partenariat de distribution
- [ ] 🏁 **F4 — SORTIE SPRINT 3 : 120+ payants** + récurrent lancé + 1 partenariat + 1 retombée

---

# 🟥 SPRINT 4 — Accélérer, two-sided & scale (J91 → J120)
> **But :** optimiser la conversion, **activer le passeport locataire**, répliquer les partenariats, pousser le paid (rentable grâce à la LTV récurrente).
> **Sortie :** 200+ payants (cible) / 350+ (surperf), base récurrente installée, moteur identifié.

## Sous-sprint 4.A — Optimisation conversion (Sem. 13)
- [ ] 20.1 A/B paywall + landing (angles, prix d'entrée 14,90 vs 19,90)
- [ ] 20.2 Relance auto des essais non convertis
- [ ] 20.3 Relance waitlist → abonnement
- [ ] 🏁 **G1** — +2-3 pts de conversion

## Sous-sprint 4.B — Two-sided locataire (Sem. 14)
- [ ] 21.1 Renforcer le **Passeport gratuit** (boucle, déclenché par le bailleur = gratuit)
- [ ] 21.2 Lancer **Passeport Premium 4,99 €** (proactif uniquement, marchés tendus) — Annexe A
- [ ] 21.3 Règles **anti-discrimination** (jamais obligatoire, toujours un chemin gratuit) + design indépendance/confiance + check juridique
- [ ] 🏁 **G2** — passeport gratuit boosté + premium en test marché tendu

## Sous-sprint 4.C — Réplication & paid (Sem. 15)
- [ ] 22.1 Activer 2-3 partenariats
- [ ] 22.2 Lancer/scaler le paid (la LTV récurrente rend le CAC 30-40 € rentable)
- [ ] 22.3 Preuve sociale (témoignages, Trustpilot, captures Grade S)
- [ ] 🏁 **G3** — 2-3 deals actifs + paid scalable

## Sous-sprint 4.D — Bilan & cap (Sem. 16)
- [ ] 23.1 Revue 120 j (les 4 signaux — Annexe F)
- [ ] 23.2 Figer le moteur (canal n°1 + récurrent + B2B)
- [ ] 23.3 Plan trimestre suivant
- [ ] 🏁 **G4 — SORTIE 120 J : 200+ payants (cible) / 350+ (surperf)**

---

# ANNEXES

## Annexe A — Grille d'offres complète (marge ~90 %+, COGS ~0,40 €)
**B2C one-shot (orienté résultat, prix tout compris) — GRILLE FINALE (décidée 02/07/2026, EN PROD) :**
*Modèle : chaque pack débloque la comparaison détaillée de TOUS les candidats (`isManaged`) + N audits forensic (`quota`/bien). Prix Stripe existants conservés (zéro reconfiguration) ; variantes basses (14,90/34,90/49,90) = A/B test Sprint 4.*
| Offre | Prix | Contenu |
|---|---|---|
| Démo dossier exemple | gratuit | aha, 0 COGS |
| + 3 audits réels (au total) | gratuit | activation (~0,45 €) |
| Vérifier mon finaliste (Essentiel) | 19,90 € | comparaison de tous + **3 audits** |
| ⭐ Comparer ma short-list (Pro) | 39,90 € | comparaison de tous + **10 audits** |
| Sécuriser ma location (Pro max) | 59,90 € | comparaison de tous + **20 audits** + priorité |

*(marges ~94/90/87 % à l'échelle COGS 0,40 € ; les volumes 100/250 partent dans l'offre B2B Sprint 2 ; pas de promesse bail/gestion tant que LEASES/MANAGEMENT sont off)*

**B2C récurrent (gestion autonome, TTC) :** Essentiel **7,90 €/mois/bien** (bêta 4,99 €) · Plus **12,90 €/mois** · Annuel **79-89 €**.

**B2B :** Pro **99 €/mois** (~50 analyses) · Agence **199 €/mois** (~120) · Réseau **sur devis** (API, marque blanche) · dépassement **+2,90 €/analyse**. *(Le « 250 analyses » historique vit ici.)*

**Locataire (Phase 2+) :** Passeport **gratuit** si déclenché par le bailleur · Passeport **Premium 4,99 €** (proactif, portable, valable X mois) — jamais obligatoire.

## Annexe B — COGS & seuils
- Didit : 500 KYC gratuits/mois puis **0,25 €** · OCR Azure : **0,0086 €/page** (~0,06 €/dossier) · LLM : ~0,10 € (gpt-5.5) / ~0,04 € (gpt-4o).
- **COGS ≈ 0,15 € early / ≈ 0,40 € à l'échelle.** Suivi : `ApiCostLog` → cockpit admin. Alerte : franchissement 500 Didit/mois.
- Marges cibles : one-shot ≥70 % (réel ~96 %), récurrent ~99 %, B2B ~85 %. **La marge n'est pas la contrainte — la conversion l'est.**
- Seul vrai add-on potentiel : **signature électronique** (vérifier coût OpenSign/acte).

## Annexe C — Pitch différenciation DossierFacile
> « DossierFacile aide le **locataire** à présenter un dossier propre. Maison Patrimo aide le **propriétaire** à **décider** : détecter les incohérences et la fraude, **scorer le risque**, **comparer** les candidats, puis **sécuriser toute la vie du bail**. »

## Annexe D — Garde-fous juridiques
- **Hoguet / carte G :** rester « assistant en autonomie » ; ne jamais encaisser de loyer / agir en mandataire sans cadre → check juridique avant toute feature d'encaissement.
- **TTC** pour les particuliers (les concurrents affichent HT).
- **Anti-discrimination locataire :** le passeport payant ne doit JAMAIS être obligatoire pour candidater ; toujours un chemin gratuit.

## Annexe E — Copy & ressources
- **Angles :** impayé (« jusqu'à 24 mois perdus ») / fraude (« 1 dossier sur 6 contient un faux ») / temps (« triez en 3 clics »).
- **Communautés :** FB « Propriétaires Bailleurs », « Investissement locatif », « Location entre particuliers » · forum PAP · Reddit r/immobilier, r/vosfinances · Discord investisseurs.
- **DM proprio :** « Bonjour [prénom], vu ton message sur [impayés]. Je construis Maison Patrimo (vérif dossier locataire anti-fraude en 3 clics). Je cherche quelques proprios pour tester gratuitement et me dire ce qui manque. Ça te dit ? Zéro engagement. »
- **Google Ads :** mots-clés `vérifier solvabilité locataire`, `vérifier dossier locataire`, `détecter faux bulletin de salaire`, `éviter impayés locataire` · exclusions `gratuit, modèle, CAF, emploi` · titres « Vérifier un dossier locataire / Détecter les faux bulletins / Score de fiabilité sur 100 ».
- **5 questions verbatim :** marquant ? / bloquant ? / prix juste ? / quelle situation ? / recommanderais à qui ?

## Annexe F — Les 4 signaux qui valident le business
1. essai→payant > 10-15 % · 2. k-factor Sésame > 0,2 · 3. 1-2 closes B2B / 10 démos · 4. premiers abonnés récurrents avec churn faible.
