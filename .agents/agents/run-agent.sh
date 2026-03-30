#!/bin/bash
# ============================================================
# run-agent.sh — Lance un agent Claude Code spécialisé
# Usage : ./run-agent.sh <agent-name> "<instruction>"
# Exemple : ./run-agent.sh backend "Ajouter la pagination sur /api/properties"
# ============================================================

set -euo pipefail

AGENT_NAME="${1:?Usage: run-agent.sh <agent-name> <instruction>}"
INSTRUCTION="${2:?Usage: run-agent.sh <agent-name> <instruction>}"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/prompts"
LOGS_DIR="$SCRIPT_DIR/logs"
PROMPT_FILE="$PROMPTS_DIR/$AGENT_NAME.md"

# Vérifications
if [ ! -f "$PROMPT_FILE" ]; then
  echo "❌ Agent inconnu: $AGENT_NAME"
  echo "   Agents disponibles: architect, database, backend, frontend, testing, security, reviewer"
  exit 1
fi

# Vérifier que Claude Code est connecté (compte Pro/Max ou clé API)
if ! claude -p "ok" &>/dev/null; then
  echo "❌ Claude Code n'est pas connecté."
  echo "   Lance 'claude' pour te connecter avec ton compte Claude Pro."
  echo "   (Ou configure ANTHROPIC_API_KEY si tu utilises l'API)"
  exit 1
fi

# Créer le dossier de logs
mkdir -p "$LOGS_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOGS_DIR/${AGENT_NAME}_${TIMESTAMP}.log"

echo "🤖 Lancement de l'agent [$AGENT_NAME]..."
echo "📋 Instruction : $INSTRUCTION"
echo "📝 Log : $LOG_FILE"
echo "---"

# Construire le prompt complet
SYSTEM_PROMPT=$(cat "$PROMPT_FILE")

FULL_PROMPT="$SYSTEM_PROMPT

---

## Tâche à réaliser maintenant

$INSTRUCTION

## Contexte additionnel
- Tu travailles sur le projet GetPatrimo (gestion locative)
- Le code est dans le répertoire courant
- Lis les fichiers existants AVANT de modifier quoi que ce soit
- Respecte les conventions du prompt ci-dessus
- Quand tu as terminé, résume ce que tu as fait"

# Lancer Claude Code en mode headless
claude -p "$FULL_PROMPT" \
  --allowedTools "Read,Write,Edit,Bash(npm test:*),Bash(node:*),Bash(cat:*),Bash(ls:*),Bash(find:*),Bash(grep:*),Bash(git:*),Glob,Grep" \
  2>&1 | tee "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ Agent [$AGENT_NAME] terminé avec succès"
else
  echo ""
  echo "❌ Agent [$AGENT_NAME] a échoué (code: $EXIT_CODE)"
  echo "   Voir le log : $LOG_FILE"
fi

exit $EXIT_CODE
