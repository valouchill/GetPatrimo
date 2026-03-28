import { MongoClient, MongoClientOptions } from 'mongodb';

const options: MongoClientOptions = {};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoClientUri: string | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    // Pendant le build, retourner une promesse qui ne se résout jamais
    return new Promise(() => {});
  }

  // Si l'URI a changé depuis le cache (ex: build → runtime), recréer le client
  if (global._mongoClientPromise && global._mongoClientUri === uri) {
    return global._mongoClientPromise;
  }

  const client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
  global._mongoClientUri = uri;
  return global._mongoClientPromise;
}

// Export lazy — évalué à chaque accès via getter
// Cela garantit que l'URI runtime est utilisée, pas celle du build
let _cached: Promise<MongoClient> | null = null;

const clientPromise = new Proxy({} as Promise<MongoClient>, {
  get(_target, prop) {
    if (!_cached) {
      _cached = getClientPromise();
    }
    const val = (_cached as any)[prop];
    return typeof val === 'function' ? val.bind(_cached) : val;
  },
});

export { getClientPromise };
export default clientPromise;
