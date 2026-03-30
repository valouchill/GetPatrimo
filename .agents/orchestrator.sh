#!/bin/bash
# ============================================================
# orchestrator.sh — Pipeline multi-agents GetPatrimo
#
# Lance une séquence d'agents spécialisés pour réaliser une
# tâche complète : plan → database → backend → frontend →
# tests → sécurité → review.
#
# Usage :
#   ./orchestrator.sh "Créer le module de quittances de loyer"
#   ./orchestrator.sh --plan-only "Migrer l'auth vers NextAuth"
#   ./orchestrator.sh --skip frontend "Ajouter un index sur Property"
#   ./orchestrator.sh --only "database,backend" "Corriger les enums Lease"
# ============================================================

set -euo pipefail

# ---- Configuration ----
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_RUNNER="$SCRIPT_DIR/agents/run-agent.sh"
LOGS_DIR="$SCRIPT_DIR/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_DIR="$LOGS_DIR/run_$TIMESTAMP"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ---- Arguments ----
PLAN_ONLY=false
SKIP_AGENTS=""
ONLY_AGENTS=""
TASK=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --plan-only)
      PLAN_ONLY=true
      shift
      ;;
    --skip)
      SKIP_AGENTS="$2"
      shift 2
      ;;
    --only)
      ONLY_AGENTS="$2"
      shift 2
      ;;
    *)
      TASK="$1"
      shift
      ;;
  esac
done

if [ -z "$TASK" ]; then
  echo -e "${RED}❌ Usage: orchestrator.sh [options] \"description de la tâche\"${NC}"
  echo ""
  echo "Options:"
  echo "  --plan-only              Ne lance que l'agent Architect"
  echo "  --skip agent1,agent2     Sauter ces agents"
  echo "  --only agent1,agent2     Ne lancer que ces agents"
  echo ""
  echo "Exemple:"
  echo "  ./orchestrator.sh \"Ajouter le module de quittances de loyer\""
  exit 1
fi

# Vérifier les prérequis
if ! command -v claude &> /dev/null; then
  echo -e "${RED}❌ Claude Code CLI non installé${NC}"
  echo "   npm install -g @anthropic-ai/claude-code"
  exit 1
fi

# Vérifier que Claude Code est connecté (compte Pro/Max ou clé API)
if ! claude -p "ok" &>/dev/null; then
  echo -e "${RED}❌ Claude Code n'est pas connecté.${NC}"
  echo "   Lance 'claude' pour te connecter avec ton compte Claude Pro."
  exit 1
fi

# ---- Helpers ----
mkdir -p "$RUN_DIR"

should_run() {
  local agent=$1
  if [ -n "$ONLY_AGENTS" ]; then
    echo "$ONLY_AGENTS" | grep -q "$agent" && return 0 || return 1
  fi
  if [ -n "$SKIP_AGENTS" ]; then
    echo "$SKIP_AGENTS" | grep -q "$agent" && return 1 || return 0
  fi
  return 0
}

run_step() {
  local step_num=$1
  local agent_name=$2
  local instruction=$3
  local emoji=$4

  if ! should_run "$agent_name"; then
    echo -e "${YELLOW}⏭️  [$step_num/7] $agent_name — SKIPPED${NC}"
    return 0
  fi

  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$emoji [$step_num/7] Agent $agent_name${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  local start_time=$(date +%s)
  local log_file="$RUN_DIR/${step_num}_${agent_name}.log"

  if bash "$AGENT_RUNNER" "$agent_name" "$instruction" > "$log_file" 2>&1; then
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo -e "${GREEN}✅ $agent_name terminé en ${duration}s${NC}"
    return 0
  else
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo -e "${RED}❌ $agent_name a échoué après ${duration}s${NC}"
    echo -e "${RED}   Log: $log_file${NC}"

    # Demander à l'utilisateur s'il veut continuer
    read -p "Continuer le pipeline ? (o/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
      echo -e "${RED}Pipeline interrompu.${NC}"
      exit 1
    fi
    return 1
  fi
}

# ---- Header ----
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ${BLUE}🏗️  GetPatrimo — Pipeline Multi-Agents${CYAN}          ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📋 Tâche : ${YELLOW}$TASK${NC}"
echo -e "📁 Logs  : $RUN_DIR"
echo -e "⏰ Start : $(date '+%H:%M:%S')"
echo ""

# Sauvegarder la tâche
echo "$TASK" > "$RUN_DIR/task.txt"

# ---- Pipeline ----
PIPELINE_START=$(date +%s)

# Step 1 : Architect — Planifier
run_step 1 "architect" \
  "Analyse cette tâche et produis un plan détaillé dans .agents/logs/plan.md : $TASK" \
  "🏗️"

if [ "$PLAN_ONLY" = true ]; then
  echo ""
  echo -e "${GREEN}📋 Plan généré. Mode --plan-only, pipeline arrêté.${NC}"
  echo -e "   Voir : .agents/logs/plan.md"
  exit 0
fi

# Lire le plan pour le passer aux agents suivants
PLAN_CONTEXT=""
if [ -f ".agents/logs/plan.md" ]; then
  PLAN_CONTEXT=$(cat .agents/logs/plan.md)
fi

# Step 2 : Database
run_step 2 "database" \
  "Voici le plan à suivre :
$PLAN_CONTEXT

Exécute UNIQUEMENT la section DATABASE du plan ci-dessus.
Tâche originale : $TASK" \
  "🗄️"

# Step 3 : Backend
run_step 3 "backend" \
  "Voici le plan à suivre :
$PLAN_CONTEXT

Exécute UNIQUEMENT la section BACKEND du plan ci-dessus.
Les modèles de données ont déjà été créés/modifiés par l'agent Database.
Tâche originale : $TASK" \
  "⚙️"

# Step 4 : Frontend
run_step 4 "frontend" \
  "Voici le plan à suivre :
$PLAN_CONTEXT

Exécute UNIQUEMENT la section FRONTEND du plan ci-dessus.
Les endpoints API sont déjà créés par l'agent Backend.
Tâche originale : $TASK" \
  "🎨"

# Step 5 : Testing
run_step 5 "testing" \
  "Du code vient d'être ajouté/modifié pour cette tâche : $TASK

Écris des tests unitaires et lance-les avec 'npm test'.
Couvre : cas nominal, cas limites, données invalides.
Si les tests échouent, signale le problème précisément." \
  "🧪"

# Step 6 : Security
run_step 6 "security" \
  "Du code vient d'être ajouté/modifié pour cette tâche : $TASK

Audite les changements récents (git diff).
Vérifie : auth, validation, injection, données sensibles, uploads.
Corrige les vulnérabilités critiques directement.
Produis le rapport dans .agents/logs/security-report.md" \
  "🔒"

# Step 7 : Reviewer
run_step 7 "reviewer" \
  "Le pipeline a terminé la tâche suivante : $TASK

1. Vérifie la cohérence de tous les changements (git diff)
2. Lance 'npm test' pour confirmer que tout passe
3. Fais un commit propre avec un message descriptif
4. Produis un résumé dans .agents/logs/review-summary.md" \
  "👀"

# ---- Footer ----
PIPELINE_END=$(date +%s)
TOTAL_DURATION=$((PIPELINE_END - PIPELINE_START))
MINUTES=$((TOTAL_DURATION / 60))
SECONDS=$((TOTAL_DURATION % 60))

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Pipeline terminé en ${MINUTES}m ${SECONDS}s${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📁 Logs du run : $RUN_DIR"
echo "📋 Plan        : .agents/logs/plan.md"
echo "🔒 Sécurité    : .agents/logs/security-report.md"
echo "👀 Review      : .agents/logs/review-summary.md"
echo ""
