# GetPatrimo — Pipeline Multi-Agents Autonome

## Concept

Un orchestrateur lance des agents Claude Code spécialisés qui travaillent sur ton code de manière autonome. Chaque agent a son domaine d'expertise et ses contraintes. L'orchestrateur vérifie le résultat de chaque étape avant de passer à la suivante.

```
┌─────────────────────────────────────────────────────┐
│                   ORCHESTRATEUR                      │
│                  (orchestrator.sh)                    │
│                                                      │
│   Tâche demandée : "Ajouter le module quittances"    │
│                        │                             │
│   ┌────────────────────▼──────────────────────┐      │
│   │  1. ARCHITECT  — Planifie les changements │      │
│   └────────────────────┬──────────────────────┘      │
│                        │ plan.md                     │
│   ┌────────────────────▼──────────────────────┐      │
│   │  2. DATABASE   — Crée/modifie les modèles │      │
│   └────────────────────┬──────────────────────┘      │
│                        │ modèles OK                  │
│   ┌────────────────────▼──────────────────────┐      │
│   │  3. BACKEND    — Code les API routes      │      │
│   └────────────────────┬──────────────────────┘      │
│                        │ routes OK                   │
│   ┌────────────────────▼──────────────────────┐      │
│   │  4. FRONTEND   — Crée les composants UI   │      │
│   └────────────────────┬──────────────────────┘      │
│                        │ composants OK               │
│   ┌────────────────────▼──────────────────────┐      │
│   │  5. TESTING    — Écrit et lance les tests │      │
│   └────────────────────┬──────────────────────┘      │
│                        │ tests passent ?             │
│   ┌────────────────────▼──────────────────────┐      │
│   │  6. SECURITY   — Audit de sécurité        │      │
│   └────────────────────┬──────────────────────┘      │
│                        │ rapport                     │
│   ┌────────────────────▼──────────────────────┐      │
│   │  7. REVIEWER   — Review finale + commit   │      │
│   └────────────────────┬──────────────────────┘      │
│                        │                             │
│                   ✅ TERMINÉ                          │
└─────────────────────────────────────────────────────┘
```

## Installation

### Prérequis
- Node.js 20+
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- Clé API Anthropic (`ANTHROPIC_API_KEY`)

### Setup
```bash
# 1. Copier le dossier agents-pipeline/ à la racine de ton projet
cp -r agents-pipeline/ /chemin/vers/GetPatrimo/.agents/

# 2. Configurer la clé API
export ANTHROPIC_API_KEY=sk-ant-...

# 3. Rendre les scripts exécutables
chmod +x .agents/orchestrator.sh
chmod +x .agents/agents/*.sh

# 4. Lancer une tâche
.agents/orchestrator.sh "Créer le module de génération de quittances de loyer"
```

## Usage

### Lancer une tâche complète (pipeline complet)
```bash
.agents/orchestrator.sh "Ajouter un endpoint de recherche de biens par ville et budget"
```

### Lancer un agent seul
```bash
.agents/agents/run-agent.sh backend "Ajouter la pagination sur GET /api/owner/properties"
```

### Mode dry-run (planification sans exécution)
```bash
.agents/orchestrator.sh --plan-only "Migrer l'auth Express vers NextAuth"
```
