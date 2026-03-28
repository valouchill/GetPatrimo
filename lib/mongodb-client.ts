import { MongoClient, MongoClientOptions } from 'mongodb';

const options: MongoClientOptions = {};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoClientUri: string | undefined;
}

/**
 * Returns a MongoClient promise, creating a new one if needed.
 * Invalidates the cache if MONGO_URI changed (build → runtime).
 */
export function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGO_URI || '';

  if (!uri) {
    return new Promise(() => {}); // build time — never resolves
  }

  if (global._mongoClientPromise && global._mongoClientUri === uri) {
    return global._mongoClientPromise;
  }

  // URI changed or first call — create fresh connection
  const client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
  global._mongoClientUri = uri;
  return global._mongoClientPromise;
}

// Default export: a promise that defers to runtime URI.
// We use a "lazy thenable" so MongoDBAdapter can `await` it.
const clientPromise: Promise<MongoClient> = {
  then(onFulfilled, onRejected) {
    return getClientPromise().then(onFulfilled, onRejected);
  },
  catch(onRejected) {
    return getClientPromise().catch(onRejected);
  },
  finally(onFinally) {
    return getClientPromise().finally(onFinally);
  },
  [Symbol.toStringTag]: 'LazyMongoClientPromise',
} as Promise<MongoClient>;

export default clientPromise;
