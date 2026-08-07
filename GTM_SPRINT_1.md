# Sprint 1 — Fondations (J1 → J30) · Maison Patrimo

> **Objectif global :** rendre l'entonnoir étanche + décrocher **15 premiers payants à la main**.
> **Métrique de sortie :** 15+ payants ET taux essai→payant mesuré.
> **Règle :** on ne passe pas au sous-sprint suivant tant que son 🏁 jalon n'est pas coché.

Légende : `[ ]` à faire · `[x]` fait · 🏁 = jalon (porte de sortie).

---

## 🟦 Sous-sprint 1.A — Activation & mesure (Sem. 1 · J1→J7)
*But : un proprio vit le "aha" seul en < 2 min, et tu vois tout ce qui se passe.*

### Tâche 1 — Mode « dossier exemple »
- [ ] 1.1 Créer le dossier exemple **propre** (Grade S) : CNI valide + 3 bulletins cohérents + avis d'imposition concordant
- [ ] 1.2 Créer le dossier exemple **frauduleux** : bulletin retouché avec métadonnées détectables (Photoshop/Canva) par le forensic
- [ ] 1.3 Ajouter le bouton **« Tester avec un dossier exemple »** dans le dashboard proprio (visible dès l'inscription, avant tout bien créé)
- [ ] 1.4 Brancher le clic → pipeline d'analyse → écran de résultat réel (score /100, fraude, Grade)
- [ ] 1.5 **Exclure** ces analyses-démo du quota des 3 essais gratuits
- [ ] 1.6 Test bout-en-bout : compte neuf → « aha » en < 2 min
- [ ] 1.7 (si ça touche `analyze-v2`/`checkAnalysisAllowed`) rebuild Docker + recreate conteneur
- [ ] 🏁 **Jalon A1** — un compte neuf voit une détection de fraude **sans locataire externe**, en < 2 min

### Tâche 2 — Instrumentation minimale (4 events)
- [ ] 2.1 Créer le projet **PostHog EU** + brancher le consentement analytics au flux RGPD
- [ ] 2.2 Installer `posthog-js` (client, cookieless/opt-in) + `identify(userId)` à l'auth
- [ ] 2.3 Installer `posthog-node` (serveur)
- [ ] 2.4 Event `signup_completed`
- [ ] 2.5 Event `analysis_completed` (serveur, dans `analyze-v2`) + propriétés `tier` / `grade` / `fraud_detected`
- [ ] 2.6 Event `paywall_viewed` (quand `checkAnalysisAllowed` → `FREE_TRIAL_EXHAUSTED` / `QUOTA_EXCEEDED`)
- [ ] 2.7 Event `purchase_completed` (serveur, webhook `checkout.session.completed`) + `tier` / `amount` / `is_first_purchase`
- [ ] 2.8 Vérifier le stitch anonyme→connu (`distinct_id = userId`)
- [ ] 🏁 **Jalon A2** — dashboard live : inscrits / analyses / paywall / achats visibles en temps réel

---

## 🟩 Sous-sprint 1.B — Message & boucle (Sem. 2 · J8→J14)
*But : une page qui transforme un visiteur en inscrit + transformer le Sésame en canal gratuit.*

### Tâche 3 — Landing page + 3 angles
- [ ] 3.1 Rédiger les 3 titres : **impayé** / **fraude** / **gain de temps** (voir Annexe A)
- [ ] 3.2 Monter le hero + CTA « Tester gratuitement »
- [ ] 3.3 Section réassurance : badges Didit / eIDAS / RGPD / 3 analyses offertes
- [ ] 3.4 Section « Comment ça marche » en 3 étapes (lien → scan → score)
- [ ] 3.5 Section « aha » : capture écran Grade / forensic
- [ ] 3.6 CTA final
- [ ] 3.7 Capter `utm_*` + `ref` et les persister jusqu'au `signup_completed`
- [ ] 3.8 Préparer les 3 variantes d'angle pilotées par UTM (`utm_content=angle-impaye`, etc.)
- [ ] 🏁 **Jalon B1** — landing live sur maisonpatrimo.com, CTA→signup, UTM captées

### Tâche 4 — Brander le Sésame (la boucle)
- [ ] 4.1 Bandeau « Sécurisé par Maison Patrimo » sur le tunnel locataire
- [ ] 4.2 Encart fin de parcours « Vous êtes propriétaire ? Testez gratuitement → » vers la landing `?ref=sesame`
- [ ] 4.3 Vérifier que `ref=sesame` remonte bien dans PostHog
- [ ] 🏁 **Jalon B2** — chaque page Sésame porte la marque + l'invitation proprio, trackée `ref=sesame`

---

## 🟧 Sous-sprint 1.C — Premiers proprios à la main (Sem. 3 · J15→J21)
*But : 15 proprios réels recrutés en parlant à des humains.*

### Tâche 5 — 50 conversations dans 5 communautés
- [ ] 5.1 Rejoindre 5 communautés (voir Annexe B)
- [ ] 5.2 Repérer 50 discussions sur impayés / sélection / fraude au dossier
- [ ] 5.3 Apporter de l'aide d'abord (commentaires utiles, zéro vente)
- [ ] 5.4 Basculer en DM les proprios pertinents
- [ ] 5.5 Logger les 50 interactions dans la feuille de suivi
- [ ] 🏁 **Jalon C1** — 50 interactions sincères + une poignée d'intéressés

### Tâche 6 — Recruter 15 bêta-proprios
- [ ] 6.1 Envoyer le DM template (Annexe C) aux intéressés + réseau perso
- [ ] 6.2 Créer / accompagner 15 comptes
- [ ] 6.3 S'assurer que chacun lance ≥ 1 analyse (= activation, pas juste inscription)
- [ ] 🏁 **Jalon C2** — 15 comptes activés (≥ 1 analyse chacun)

### Tâche 7 — Lancer Google Ads
- [ ] 7.1 Créer 1 campagne + 1 groupe d'annonces
- [ ] 7.2 Mots-clés en expression exacte (Annexe D)
- [ ] 7.3 Mots-clés à exclure (Annexe D)
- [ ] 7.4 Rédiger 2 annonces RSA (Annexe D)
- [ ] 7.5 Budget 350-400 €/mois, plafonné
- [ ] 7.6 Brancher le suivi de conversion (achat, ou inscription au début)
- [ ] 7.7 UTM par angle
- [ ] 🏁 **Jalon C3** — campagne live, conversions trackées, budget plafonné

---

## 🟥 Sous-sprint 1.D — Premiers € (Sem. 4 · J22→J30)
*But : transformer les bêtas en payants + comprendre pourquoi ils paient (ou pas).*

### Tâche 8 — Onboarding manuel
- [ ] 8.1 Contacter chacun des 15 (« tu as pu tester ? un blocage ? »)
- [ ] 8.2 Proposer un appel 15 min / partage d'écran
- [ ] 8.3 Aider chacun à analyser un **vrai** candidat
- [ ] 🏁 **Jalon D1** — chaque bêta a fait une vraie analyse ou expliqué son blocage

### Tâche 9 — Récolter 5 verbatims
- [ ] 9.1 Caler 5 échanges (appel ou message)
- [ ] 9.2 Poser les 5 questions (Annexe E)
- [ ] 9.3 Écrire 5 verbatims + extraire 3 témoignages réutilisables
- [ ] 🏁 **Jalon D2** — 5 verbatims + 3 témoignages (preuve sociale)

### Tâche 10 — Demander l'achat (explicitement)
- [ ] 10.1 Relancer ceux qui ont touché le paywall
- [ ] 10.2 Inviter clairement à prendre un pack (ESSENTIAL 19,90 € pour démarrer)
- [ ] 10.3 Noter les raisons de non-achat
- [ ] 🏁 **Jalon D3 — SORTIE DE SPRINT** : **15+ payants** ET taux essai→payant calculé

---

## Annexes (copy prête à l'emploi)

### Annexe A — Les 3 angles de titre
- **A. Impayé** : « Un impayé, c'est jusqu'à 24 mois de loyer perdus. Vérifiez la solvabilité du dossier avant de signer. »
- **B. Fraude** : « 1 dossier locataire sur 6 contient un faux. Détectez les faux bulletins de salaire en 3 clics. »
- **C. Temps** : « Triez vos candidats en 3 clics. Score de fiabilité sur 100, dossier certifié. »

### Annexe B — Les 5 communautés
- Facebook : « Propriétaires Bailleurs », « Investissement immobilier locatif », « Location entre particuliers »
- Forums : forum PAP, Reddit r/immobilier, r/vosfinances
- Discord : communautés d'investisseurs / formateurs immo

### Annexe C — DM aux proprios
> Bonjour [prénom], j'ai vu ton message sur [les impayés / le tri des dossiers]. Je construis Maison Patrimo, un outil qui vérifie l'authenticité d'un dossier locataire (faux bulletins, solvabilité) en 3 clics. Je cherche quelques propriétaires pour le tester gratuitement et me dire ce qui manque. Ça te dirait d'y jeter un œil ? Zéro engagement.

### Annexe D — Google Ads
- **Mots-clés (exact)** : `vérifier solvabilité locataire`, `vérifier dossier locataire`, `détecter faux bulletin de salaire`, `faux bulletin de salaire locataire`, `éviter impayés locataire`, `analyser dossier locataire`
- **À exclure** : `gratuit`, `modèle`, `CAF`, `emploi`, `salaire moyen`
- **Titres** : « Vérifier un dossier locataire » · « Détecter les faux bulletins » · « Score de fiabilité sur 100 » · « 3 analyses gratuites »
- **Descriptions** : « Avant de signer, vérifiez solvabilité et authenticité du dossier. RGPD, sans engagement. » · « Détection de fraude documentaire + dossier certifié. Testez gratuitement. »

### Annexe E — Les 5 questions verbatim
1. Qu'est-ce qui t'a le plus marqué ?
2. Qu'est-ce qui t'a bloqué ou rendu confus ?
3. Paierais-tu pour ça ? À quel prix ça te paraît juste ?
4. Dans quelle situation précise l'utiliserais-tu ?
5. À qui le recommanderais-tu ?

---

## Tableau de bord du sprint (à remplir)
| Jalon | Cible | Statut | Date |
|---|---|---|---|
| A1 — aha < 2 min | OK/KO | | |
| A2 — dashboard live | OK/KO | | |
| B1 — landing live | OK/KO | | |
| B2 — Sésame brandé | OK/KO | | |
| C1 — 50 conversations | 50 | | |
| C2 — bêtas activés | 15 | | |
| C3 — ads live | OK/KO | | |
| D1 — onboarding | 15 | | |
| D2 — verbatims | 5 | | |
| **D3 — payants** | **15+** | | |
