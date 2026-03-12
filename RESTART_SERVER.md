# Redémarrage du serveur nécessaire

## Problème identifié
L'erreur 404 est due au fait que le serveur n'a pas été redémarré après les modifications des routes.

## Solution

### Option 1 : Redémarrer manuellement
```bash
# Arrêter le serveur actuel
pkill -f "node server.js"

# Redémarrer
cd /opt/doc2loc
node server.js
```

### Option 2 : Si le serveur tourne avec PM2 ou un gestionnaire de processus
```bash
pm2 restart server.js
# ou
pm2 reload server.js
```

### Option 3 : Si le serveur tourne avec Docker
```bash
docker-compose restart
# ou
docker restart <container_name>
```

## Vérification après redémarrage

Testez la route :
```bash
curl http://localhost:3000/api/public/test
```

Devrait retourner :
```json
{"msg":"Route publique OK","path":"/test"}
```

## Routes configurées

- GET `/api/public/apply/:token` - Récupère les infos du bien
- POST `/api/public/apply/:token` - Crée une candidature avec upload de fichiers
- POST `/api/public/candidature` - Alternative pour créer une candidature
- POST `/api/public/lead` - Crée un lead

## Notes

Les routes publiques sont maintenant montées **en premier** dans server.js pour éviter les conflits avec les routes génériques.
