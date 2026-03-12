# Architecture MVC - GetPatrimo

## Structure du projet

Le projet GetPatrimo a été refactorisé selon une architecture MVC (Model-View-Controller) professionnelle.

### Arborescence

```
/opt/doc2loc/
├── server.js                    # Point d'entrée principal (épuré)
├── src/                         # Code source modulaire
│   ├── config/                  # Configuration
│   │   ├── db.js               # Connexion MongoDB
│   │   └── app.js              # Configuration générale
│   ├── middleware/             # Middlewares Express
│   │   ├── auth.js             # Authentification JWT
│   │   ├── admin.js            # Vérification droits admin
│   │   └── errorMiddleware.js  # Gestion centralisée des erreurs
│   ├── controllers/            # Controllers (logique métier)
│   │   ├── authController.js
│   │   ├── billingController.js
│   │   ├── propertyController.js
│   │   ├── tenantController.js
│   │   ├── documentController.js
│   │   ├── eventController.js
│   │   ├── reminderController.js
│   │   ├── alertController.js
│   │   ├── adminController.js
│   │   └── publicController.js
│   ├── routes/                  # Routes Express
│   │   ├── authRoutes.js
│   │   ├── billingRoutes.js
│   │   ├── propertyRoutes.js
│   │   ├── tenantRoutes.js
│   │   ├── documentRoutes.js
│   │   ├── eventRoutes.js
│   │   ├── reminderRoutes.js
│   │   ├── alertRoutes.js
│   │   ├── adminRoutes.js
│   │   └── publicRoutes.js
│   ├── services/                # Services métier
│   │   ├── eventService.js     # Logging d'événements
│   │   ├── emailService.js     # Envoi d'emails (Brevo)
│   │   ├── pdfService.js       # Génération PDF
│   │   ├── geoService.js       # Validation géographique
│   │   └── billingService.js   # Gestion paywall
│   └── utils/                   # Utilitaires
│       ├── upload.js           # Configuration Multer
│       └── csv.js              # Utilitaires CSV
├── models/                      # Modèles Mongoose (inchangés)
│   ├── User.js
│   ├── Property.js
│   ├── Tenant.js
│   ├── Document.js
│   ├── Event.js
│   ├── Lead.js
│   └── Candidature.js
└── public/                      # Fichiers statiques (inchangés)
```

## Principes de l'architecture

### Séparation des responsabilités

- **Models** (`/models`) : Schémas Mongoose, définitions de données
- **Controllers** (`/src/controllers`) : Logique métier, traitement des requêtes
- **Routes** (`/src/routes`) : Définition des endpoints, mapping URL → Controller
- **Services** (`/src/services`) : Services réutilisables (email, PDF, etc.)
- **Middleware** (`/src/middleware`) : Authentification, gestion d'erreurs
- **Config** (`/src/config`) : Configuration centralisée

### Conventions de code

1. **async/await** : Tous les appels asynchrones utilisent async/await
2. **try/catch** : Tous les appels DB/API sont entourés de blocs try/catch
3. **Commentaires** : En français, selon les règles du projet
4. **Modularité** : Aucun fichier ne dépasse 500 lignes

## Flux de requête

```
Requête HTTP
    ↓
server.js (point d'entrée)
    ↓
Route (/src/routes/*)
    ↓
Middleware (auth, admin si nécessaire)
    ↓
Controller (/src/controllers/*)
    ↓
Service (/src/services/*) si nécessaire
    ↓
Model (/models/*)
    ↓
Réponse HTTP
```

## Migration depuis l'ancien code

L'ancien `server.js` monolithique (904 lignes) a été découpé en :
- 1 fichier de configuration DB
- 1 fichier de configuration app
- 3 middlewares
- 10 controllers
- 5 services
- 2 utilitaires
- 10 fichiers de routes
- 1 nouveau server.js épuré (65 lignes)

## Points d'attention

- Les modèles restent dans `/models` (non déplacés dans `/src/models`)
- Les chemins d'importation utilisent des chemins relatifs (`../../models/`)
- La configuration des uploads utilise `__dirname` pour résoudre les chemins
- Tous les middlewares d'erreur sont centralisés dans `errorMiddleware.js`

## Tests

Pour vérifier la syntaxe :
```bash
node -c server.js
node -c src/config/*.js
node -c src/routes/*.js
node -c src/controllers/*.js
```

## Démarrage

Le serveur démarre via `server.js` qui :
1. Charge les variables d'environnement
2. Initialise Express
3. Connecte MongoDB
4. Charge toutes les routes
5. Configure les middlewares d'erreur
6. Démarre l'écoute sur le port configuré
