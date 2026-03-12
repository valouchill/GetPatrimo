# Configuration OpenAI GPT-4o Vision

## Variables d'environnement requises

Pour activer l'analyse IA des documents, vous devez configurer la clé API OpenAI :

### Option 1 : Fichier .env (recommandé)

Créez un fichier `.env` à la racine du projet avec :

```bash
OPENAI_API_KEY=sk-votre-cle-api-openai-ici
```

### Option 2 : Variables Docker

Si vous utilisez Docker Compose, ajoutez dans `docker-compose.yml` :

```yaml
services:
  app:
    environment:
      - OPENAI_API_KEY=sk-votre-cle-api-openai-ici
```

### Option 3 : Variables système

```bash
export OPENAI_API_KEY=sk-votre-cle-api-ici
```

## Obtenir une clé API OpenAI

1. Créez un compte sur https://platform.openai.com
2. Allez dans "API Keys"
3. Créez une nouvelle clé API
4. Copiez la clé (commence par `sk-`)

## Vérification

Une fois configurée, l'analyse IA sera automatiquement activée. Si la clé n'est pas configurée, le système fonctionnera en mode simulation (sans analyse réelle).

## Coûts

GPT-4o Vision coûte environ $0.01 par image analysée. Pour un dossier complet avec ~10 documents, comptez environ $0.10.
