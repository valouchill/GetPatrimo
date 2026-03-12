import { MongoClient, MongoClientOptions } from 'mongodb';

const options: MongoClientOptions = {};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Fonction lazy pour créer la connexion uniquement quand nécessaire
export function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGO_URI;
  
  if (!uri) {
    // Pendant le build, retourner une promesse qui ne se résout jamais
    // Cela permet au build de passer sans erreur
    return new Promise(() => {});
  }

  if (process.env.NODE_ENV === 'development') {
    // En développement, utiliser une variable globale pour préserver la connexion
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  } else {
    // En production, utiliser aussi le cache global pour éviter les connexions multiples
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }
}

// Export par défaut pour compatibilité
const clientPromise = getClientPromise();
export default clientPromise;
