#!/bin/bash
# ============================================================
# install.sh — Installe le pipeline multi-agents GetPatrimo
# Usage : bash .agents/install.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}🏗️  Installation du pipeline multi-agents GetPatrimo${NC}"
echo ""

# 1. Vérifier Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js non trouvé. Installe Node.js 20+ :${NC}"
  echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "   sudo apt-get install -y nodejs"
  exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# 2. Vérifier / Installer Claude Code CLI
if ! command -v claude &> /dev/null; then
  echo -e "${YELLOW}⏳ Installation de Claude Code CLI...${NC}"
  npm install -g @anthropic-ai/claude-code
  if ! command -v claude &> /dev/null; then
    echo -e "${RED}❌ Échec de l'installation. Essaie avec sudo :${NC}"
    echo "   sudo npm install -g @anthropic-ai/claude-code"
    exit 1
  fi
fi
echo -e "${GREEN}✅ Claude Code CLI installé${NC}"

# 3. Vérifier la connexion Claude
echo ""
echo -e "${YELLOW}⏳ Vérification de la connexion Claude...${NC}"
if claude -p "ok" &>/dev/null; then
  echo -e "${GREEN}✅ Claude Code connecté avec ton compte${NC}"
else
  echo ""
  echo -e "${YELLOW}⚠️  Claude Code n'est pas encore connecté à ton compte.${NC}"
  echo ""
  echo "Pour te connecter avec ton abonnement Claude Pro :"
  echo ""
  echo "  1. Lance la commande :  claude"
  echo "  2. Un lien va s'afficher dans le terminal"
  echo "  3. Copie ce lien et ouvre-le dans ton navigateur"
  echo "  4. Connecte-toi avec ton compte Claude Pro"
  echo "  5. Reviens ici et relance : bash .agents/install.sh"
  echo ""
fi

# 4. Rendre les scripts exécutables
chmod +x .agents/orchestrator.sh 2>/dev/null || true
chmod +x .agents/agents/run-agent.sh 2>/dev/null || true
echo -e "${GREEN}✅ Scripts rendus exécutables${NC}"

# 5. Créer le dossier de logs
mkdir -p .agents/logs
echo -e "${GREEN}✅ Dossier de logs créé${NC}"

# 6. Ajouter au .gitignore
if [ -f .gitignore ]; then
  if ! grep -q ".agents/logs" .gitignore; then
    echo "" >> .gitignore
    echo "# Pipeline multi-agents" >> .gitignore
    echo ".agents/logs/" >> .gitignore
    echo -e "${GREEN}✅ .agents/logs/ ajouté au .gitignore${NC}"
  fi
fi

echo ""
echo -e "${GREEN}🎉 Installation terminée !${NC}"
echo ""
echo "Usage :"
echo -e "  ${BLUE}.agents/orchestrator.sh \"Créer le module de quittances\"${NC}"
echo -e "  ${BLUE}.agents/agents/run-agent.sh backend \"Ajouter la pagination\"${NC}"
echo -e "  ${BLUE}.agents/orchestrator.sh --plan-only \"Planifier une feature\"${NC}"
echo ""
