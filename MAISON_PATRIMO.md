# MAISON PATRIMO — Document de référence produit & business

> **En une phrase** : Maison Patrimo protège les propriétaires bailleurs et les professionnels
> de la location contre les dossiers locataires frauduleux, grâce à un audit forensic
> automatisé (IA + contrôles déterministes) — et les aide à choisir le bon locataire.
>
> Domaine : **maisonpatrimo.com** · Statut : **en production, encaissement Stripe live validé**
> Dernière mise à jour : juillet 2026

---

## 1. Le problème

- Les **faux dossiers de location sont devenus industriels** : bulletins de salaire générés
  en ligne pour ~20 €, documents retouchés (Photoshop, Canva), et désormais **générés par IA**
  (visuels synthétiques, C2PA). À l'œil nu, ils sont indétectables.
- Un impayé coûte au bailleur **18 à 24 mois de procédure** et des milliers d'euros.
- Les vérifications manuelles efficaces (cohérence des cumuls URSSAF, recoupement avec l'avis
  d'imposition, métadonnées) prennent **20-30 min par dossier** et exigent un savoir-faire.
- **DossierFacile** (service public) aide le locataire à présenter un dossier propre, mais ne
  fait PAS le travail de vérification côté bailleur — c'est complémentaire, pas concurrent.

## 2. Le produit — fonctionnement

### Parcours propriétaire (B2C)
1. **Créer un bien** → obtention d'un **Sésame** : lien de candidature partageable + **code
   d'accès court** (`PT-XXXXX-XXXX`, pour LeBonCoin qui bloque les liens). Kit annonce prêt à
   coller (2 variantes : sans lien / avec lien).
2. **Recevoir les candidatures** : les dossiers arrivent centralisés dans le tableau de bord.
   Notification email à chaque premier dossier soumis.
3. **Pré-tri automatique (gratuit, illimité)** : chaque candidat reçoit un score et un grade
   (Indice de Résilience, calcul déterministe sans coût LLM).
4. **Audit forensic (payant)** : analyse approfondie d'un dossier — détection de falsification,
   cohérence financière, verdict et plan d'action.
5. **Comparaison (payant)** : identités, coordonnées et pièces de TOUS les candidats
   débloquées ; classement pour décider.
6. **Passeport Locatif PDF** : rapport certifié partageable (QR, liens vérifiés).

### Parcours candidat (locataire)
- Clique le lien Sésame **ou** saisit le code sur maisonpatrimo.com (« Espace locataire »).
- Tunnel de candidature : identité (vérification **biométrique eIDAS via Didit**), pièces
  (analysées à l'upload), revenus, garant (invitation par email), colocataires.
- Relance automatique à J+2 si le dossier n'est pas terminé/envoyé.
- Ton produit : « bienveillance sécuritaire » — on aide le candidat à réussir son dossier,
  les contrôles anti-fraude tournent en arrière-plan.

### Le moteur d'analyse (2 étages)
**Étage 1 — par document, à l'upload** (`analyze-document-v2`) :
- Extraction : OCR **Azure Document Intelligence** (~0,06 €/dossier) + **GPT-4o Vision**.
- Forensic déterministe (zéro coût) : métadonnées PDF (Creator/Producer — logiciels de
  retouche vs logiciels de paie légitimes), audit mathématique brut−cotisations=net (±0,50 €),
  MRZ des pièces d'identité, **détection de génération par IA** : manifestes C2PA/Content
  Credentials, marqueur XMP `trainedAlgorithmicMedia`, paramètres Stable Diffusion, outils IA
  dans les métadonnées. Chaque signal alimente un `fraud_score` (0-100) et des alertes.

**Étage 2 — dossier complet, à la demande** (`analyze-v2`, bouton du propriétaire) :
- LLM **neuro-symbolique** (OpenAI structured outputs, ~0,04 €/analyse) : reçoit un résumé
  agrégé déterministe (jamais les documents bruts) et produit verdict, sous-scores,
  recommandation (GO_FAST / MANUAL_CHECK / REJECT) et la **Trust-List** (3-5 contrôles
  forensic affichés au propriétaire et sur le passeport PDF).
- Règle dure : contenu généré par IA détecté ⇒ contrôle « Origine IA » en ALERTE +
  `isFraudDetected=true`.
- COGS total ≈ **0,15-0,40 €/analyse** (Didit 500 gratuits/mois puis 0,25 €).

## 3. Business B2C — propriétaires particuliers

### Offres (paiement UNIQUE par bien — pas d'abonnement, plafond dur, crédits cumulables)
| Offre | Prix TTC (TVA 20 %) | Contenu |
|---|---|---|
| **Gratuit** | 0 € | Sésame illimité, pré-tri de tous les candidats, démo « dossier exemple », **1 audit forensic offert** (par compte) |
| **Essentiel** | 19,90 € | Comparaison débloquée + **3 audits** — « Vérifiez votre finaliste » |
| **Pro** | 39,90 € | Comparaison + **10 audits** + Passeport PDF — « Comparez vos candidats » |
| **Pro max** | 59,90 € | Comparaison + **20 audits** + support prioritaire |

Principes : rachat = **cumul** des crédits restants (jamais perdus), re-analyse d'un dossier
déjà audité gratuite, l'essai gratuit ne grève pas le quota acheté.

### Le funnel de conversion
```
Landing (démo « audit en direct » : un faux bulletin démasqué sous les yeux du visiteur)
  → inscription gratuite → Sésame posé sur l'annonce → dossiers reçus & pré-triés
    → 1 audit d'essai (le « aha » sur SON candidat) → identités masquées + quota épuisé
      → paywall en plein mode décision → achat (Stripe checkout, renoncement rétractation)
        → relance email automatique J+2 si pas d'achat
```
Boucle virale : chaque candidature expose la marque aux candidats ; le passeport PDF et le
kit annonce exposent la marque aux autres bailleurs (`utm_source=sesame`).

## 4. Business B2B — agences, administrateurs de biens, mandataires

### Stratégie « vendre d'abord »
Pas de checkout self-serve : la vente est **consultative**. Le produit sert la démo et le
pilote ; l'encaissement passe par **Stripe Payment Links** (créés à la main) tant que le
volume ne justifie pas de coder l'abonnement.

### Offres affichées (page /pro)
| Formule | Prix | Quota |
|---|---|---|
| Pro Starter | **99 €/mois** | 50 audits/mois |
| Pro Agence ⭐ | **199 €/mois** | 120 audits/mois |
| Réseau & marque blanche | sur devis | volume, API, rapports à la marque |

Dépassement : 2,90 €/audit. Porte d'entrée : **pilote gratuit 10 dossiers**.
Levier de closing : coupon `PILOTE50` (−50 % 2 mois) — on ne baisse jamais le prix affiché.

### Le pipeline de vente
```
Cold email (séquence 4 touches, cible : gérants d'agences villes tendues)
  → /pro (grille + formulaire pilote → notification email au fondateur)
    → démo 15 min (dossier exemple frauduleux) → GRANT à chaud (10 audits, 2 clics admin)
      → suivi J+2 (activation) → débrief J+7 = closing call → Payment Link en visio
```

### Outillage interne (console admin, superadmin)
- **Pilotes & crédits** : octroi par email (pilote B2B ou geste commercial B2C), fonctionne
  même SANS compte existant (email d'invitation + application automatique au 1er bien),
  suivi par pilote (date d'octroi, 1er/dernier audit, consommation, statuts ✉️/🟣/🟢).
- **`accountType` B2C/B2B** : posé automatiquement par un grant pilote, togglable à la main.
  Un compte **B2B ne voit JAMAIS les offres B2C** (intégrité de la grille Pro) : onglet
  « Mon offre Pro » (forfait + grille 99/199 + contact), /pricing contextuel, messages de
  quota sans prix B2C, exclusion des relances B2C.
- Geste commercial : audits offerts sans changer l'offre (client) ou mini-déblocage Essentiel
  (compte gratuit).

## 5. Boucles de croissance automatiques (cron 08:30)

| Boucle | Déclencheur | Action |
|---|---|---|
| Relance paywall | essai épuisé + 2 j, pas d'achat | email « vos candidats restent masqués » (1×/compte) |
| Relance candidat | dossier non soumis + 2 j | email pièces manquantes / « il ne reste qu'à envoyer » |
| Notification proprio | 1er dossier soumis | email temps réel avec lien classement |
| Digest fondateur | lundi | encaissements Stripe live, signups, audits, leads, pilotes |

Instrumentation : **PostHog EU** (cookieless), funnel signup→analysis→paywall→purchase,
attribution UTM par canal (google/fb-groupes/pap/reddit/reseau/coldmail-b2b/sesame/email).

## 6. Stack technique & infra

- **App** : Next.js 16 (App Router) + Express custom server (`server.js`) — monorepo.
- **Data** : MongoDB 8 (Docker, réseau interne). Backup : `scripts/mongo-backup.sh`.
- **IA** : OpenAI GPT-4o (analyse), Azure Document Intelligence (OCR), Didit (KYC eIDAS).
- **Paiement** : Stripe **live** (checkout one-time B2C, webhooks signés, handler de
  remboursement anti-abus ; Payment Links B2B manuels).
- **Email** : Brevo SMTP — SPF + DKIM + DMARC configurés (délivrabilité validée).
- **Analytics/erreurs** : PostHog EU, Sentry.
- **Déploiement** : Docker sur VPS (image unique, `docker-compose.getpatrimo.yml`),
  pipeline 3 environnements (DEV /tmp/logo · BUILD /tmp/def · PROD /opt/doc2loc),
  gate `tsc --noEmit` + 434 tests, tags de rollback à chaque déploiement.

## 7. Conformité & posture juridique

- **Positionnement légal** : outil d'**aide à la décision** (obligation de moyens) — ne
  garantit jamais la solvabilité future ; le bailleur reste seul décisionnaire. Pas de
  gestion pour compte de tiers (posture loi Hoguet : on outille, on ne gère pas à la place).
- **RGPD** : pièces interdites bloquées (décret 2015-1437), art. 22 (aucune décision
  automatisée — score indicatif + humain dans la boucle), page de contestation, DPO,
  anonymisation sur effacement, analytics cookieless.
- **AI Act (posture)** : human-in-the-loop, score indicatif, transparence — conçu pour la
  conformité (ne pas revendiquer publiquement « hors champ »).
- **CGV** : one-time par bien, TVA 20 %, rétractation L221-18/L221-28 avec renoncement
  exprès au checkout + formulaire type, garantie L224-25-12, médiation L611-1.
- **⏳ Restant** : désigner le médiateur de la consommation (CM2C/Medicys/AME) ; compléter
  les mentions légales (SIRET — SASU en cours, statuts drafts : `STATUTS_SASU_DRAFT.md`,
  président non rémunéré → maintien ARE).

## 8. Modèle économique — synthèse

- **B2C one-time** : marge brute ~85-95 % (COGS 0,15-0,40 €/analyse). Volume nécessaire
  élevé → c'est le **canal d'acquisition et de preuve**, pas la destination.
- **B2B récurrent** : le chemin vers 100-200 k€/an (50-100 agences × 99-199 €/mois).
- **Extensions prévues** : gestion locative récurrente B2C (~4,99 €/mois — waitlist ouverte),
  passeport locataire payant, marque blanche.

## 9. Fichiers de travail

| Fichier | Contenu |
|---|---|
| `GTM_PLAN_120J.md` | Stratégie de conquête 120 jours (sprints 1-4) |
| `GTM_SPRINT_1.md` / `GTM_SPRINT_1CD.md` | Checklists cochables Sprint 1 (produit + terrain) |
| `GTM_TERRAIN_ASSETS.md` | Posts communautés, séquence cold-email B2B, plan Google Ads, process pilote |
| `STATUTS_SASU_DRAFT.md` | Statuts SASU (président non rémunéré / ARE) + PV + aide-mémoire France Travail |
| `docs/BILLING.md` | Spécification du système d'offres/quotas |
