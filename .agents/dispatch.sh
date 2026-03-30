#!/bin/bash
# ============================================================
# dispatch.sh — Dispatch autonome multi-phases GetPatrimo
#
# Lit les fichiers de tâches par phase et les exécute
# séquentiellement via l'orchestrateur.
#
# Usage :
#   ./dispatch.sh                    # Toutes les phases
#   ./dispatch.sh --phase 1          # Phase 1 uniquement
#   ./dispatch.sh --phase 2-4        # Phases 2 à 4
#   ./dispatch.sh --resume           # Reprend après la dernière tâche terminée
#   ./dispatch.sh --dry-run          # Affiche les tâches sans exécuter
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TASKS_DIR="$SCRIPT_DIR/tasks"
ORCHESTRATOR="$SCRIPT_DIR/orchestrator.sh"
PROGRESS_FILE="$SCRIPT_DIR/logs/dispatch-progress.log"
REPORT_FILE="$SCRIPT_DIR/logs/dispatch-report.md"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ---- Arguments ----
PHASE_FILTER=""
RESUME=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --phase)
      PHASE_FILTER="$2"
      shift 2
      ;;
    --resume)
      RESUME=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo -e "${RED}Option inconnue: $1${NC}"
      exit 1
      ;;
  esac
done

# ---- Helpers ----
mkdir -p "$SCRIPT_DIR/logs"

# Les phases dans l'ordre
PHASES=(
  "phase1-security"
  "phase2-database"
  "phase3-architecture"
  "phase4-backend"
  "phase5-frontend"
  "phase6-devops"
)

PHASE_NAMES=(
  "Sécurité"
  "Base de données"
  "Architecture & Nettoyage"
  "Backend & API"
  "Frontend & Refactoring"
  "DevOps & Conformité"
)

PHASE_EMOJIS=("🔒" "🗄️" "🏗️" "⚙️" "🎨" "🚀")

# Filtrer les phases
should_run_phase() {
  local phase_num=$1
  if [ -z "$PHASE_FILTER" ]; then
    return 0
  fi
  # Support "3" ou "2-4"
  if [[ "$PHASE_FILTER" == *-* ]]; then
    local start="${PHASE_FILTER%-*}"
    local end="${PHASE_FILTER#*-}"
    [ "$phase_num" -ge "$start" ] && [ "$phase_num" -le "$end" ] && return 0 || return 1
  else
    [ "$phase_num" -eq "$PHASE_FILTER" ] && return 0 || return 1
  fi
}

# Trouver où reprendre
get_last_completed() {
  if [ -f "$PROGRESS_FILE" ]; then
    tail -1 "$PROGRESS_FILE" 2>/dev/null || echo ""
  else
    echo ""
  fi
}

# Logger la progression
log_progress() {
  local phase=$1
  local task_num=$2
  local status=$3
  echo "$(date '+%Y-%m-%d %H:%M:%S') | $phase | task_$task_num | $status" >> "$PROGRESS_FILE"
}

# ---- Header ----
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  ${BLUE}🚀 GetPatrimo — Dispatch Autonome Multi-Phases${CYAN}         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}🔍 Mode DRY-RUN — Affichage des tâches sans exécution${NC}"
  echo ""
fi

if [ "$RESUME" = true ]; then
  LAST=$(get_last_completed)
  if [ -n "$LAST" ]; then
    echo -e "${YELLOW}🔄 Reprise après : $LAST${NC}"
  else
    echo -e "${YELLOW}🔄 Aucune progression trouvée, démarrage depuis le début${NC}"
  fi
  echo ""
fi

# ---- Init rapport ----
if [ "$DRY_RUN" = false ]; then
  cat > "$REPORT_FILE" << 'HEADER'
# Rapport de Dispatch — GetPatrimo

| Phase | Tâche | Statut | Durée |
|-------|-------|--------|-------|
HEADER
fi

# ---- Boucle principale ----
DISPATCH_START=$(date +%s)
TOTAL_TASKS=0
COMPLETED_TASKS=0
FAILED_TASKS=0
RESUME_FOUND=false

if [ "$RESUME" = false ]; then
  RESUME_FOUND=true
fi

for i in "${!PHASES[@]}"; do
  phase_num=$((i + 1))
  phase="${PHASES[$i]}"
  phase_name="${PHASE_NAMES[$i]}"
  phase_emoji="${PHASE_EMOJIS[$i]}"
  task_file="$TASKS_DIR/${phase}.txt"

  # Filtrer la phase
  if ! should_run_phase "$phase_num"; then
    continue
  fi

  # Vérifier que le fichier existe
  if [ ! -f "$task_file" ]; then
    echo -e "${RED}❌ Fichier manquant : $task_file${NC}"
    continue
  fi

  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}${phase_emoji} PHASE $phase_num — ${phase_name}${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo ""

  # Lire les tâches (une par ligne)
  task_num=0
  while IFS= read -r task; do
    # Ignorer les lignes vides
    [ -z "$task" ] && continue

    task_num=$((task_num + 1))
    TOTAL_TASKS=$((TOTAL_TASKS + 1))
    task_id="phase${phase_num}_task${task_num}"

    # Mode resume : chercher la dernière tâche complétée
    if [ "$RESUME" = true ] && [ "$RESUME_FOUND" = false ]; then
      if grep -q "$task_id | SUCCESS" "$PROGRESS_FILE" 2>/dev/null; then
        echo -e "${GREEN}  ✅ [$task_id] Déjà terminé — skip${NC}"
        COMPLETED_TASKS=$((COMPLETED_TASKS + 1))
        continue
      else
        RESUME_FOUND=true
        echo -e "${YELLOW}  🔄 Reprise à $task_id${NC}"
      fi
    fi

    # Afficher la tâche
    echo -e "${BLUE}  📌 [$task_id] ${task:0:80}...${NC}"

    if [ "$DRY_RUN" = true ]; then
      echo -e "     ${YELLOW}→ $task${NC}"
      echo ""
      continue
    fi

    # Exécuter via l'orchestrateur
    task_start=$(date +%s)

    if bash "$ORCHESTRATOR" "$task"; then
      task_end=$(date +%s)
      task_duration=$((task_end - task_start))
      COMPLETED_TASKS=$((COMPLETED_TASKS + 1))
      echo -e "${GREEN}  ✅ [$task_id] Terminé en ${task_duration}s${NC}"
      log_progress "$phase" "$task_num" "SUCCESS"
      echo "| ${phase_name} | $task_id | ✅ | ${task_duration}s |" >> "$REPORT_FILE"
    else
      task_end=$(date +%s)
      task_duration=$((task_end - task_start))
      FAILED_TASKS=$((FAILED_TASKS + 1))
      echo -e "${RED}  ❌ [$task_id] Échec après ${task_duration}s${NC}"
      log_progress "$phase" "$task_num" "FAILED"
      echo "| ${phase_name} | $task_id | ❌ | ${task_duration}s |" >> "$REPORT_FILE"

      # Demander si on continue
      echo ""
      read -p "  Continuer le dispatch ? (o/n) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        echo -e "${RED}  Dispatch interrompu. Relance avec --resume pour reprendre.${NC}"
        break 2
      fi
    fi

    # Pause entre les tâches pour laisser Claude souffler
    echo -e "${YELLOW}  ⏳ Pause 15s avant la tâche suivante...${NC}"
    sleep 15

  done < "$task_file"

  echo ""
  echo -e "${GREEN}  ✅ Phase $phase_num terminée${NC}"

done

# ---- Footer ----
DISPATCH_END=$(date +%s)
TOTAL_DURATION=$((DISPATCH_END - DISPATCH_START))
HOURS=$((TOTAL_DURATION / 3600))
MINUTES=$(( (TOTAL_DURATION % 3600) / 60))

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🏁 Dispatch terminé${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  📊 Tâches    : ${COMPLETED_TASKS}/${TOTAL_TASKS} réussies, ${FAILED_TASKS} en échec"
echo -e "  ⏱️  Durée     : ${HOURS}h ${MINUTES}min"
echo -e "  📄 Rapport   : $REPORT_FILE"
echo -e "  📋 Progrès   : $PROGRESS_FILE"
echo ""

if [ "$DRY_RUN" = false ]; then
  # Ajouter le résumé au rapport
  cat >> "$REPORT_FILE" << FOOTER

---

**Résultat** : ${COMPLETED_TASKS}/${TOTAL_TASKS} tâches réussies, ${FAILED_TASKS} en échec
**Durée totale** : ${HOURS}h ${MINUTES}min
**Date** : $(date '+%Y-%m-%d %H:%M')
FOOTER
fi
