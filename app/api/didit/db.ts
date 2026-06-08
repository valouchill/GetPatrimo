import mongoose from 'mongoose';

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
   
  var mongooseCache: MongooseCache | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = { conn: null, promise: null };
  global.mongooseCache = cached;
}

export async function connectDiditDb() {
  const MONGO_URI = process.env.MONGO_URI || '';
  
  if (!MONGO_URI) {
    throw new Error('MONGO_URI manquant');
  }

  if (!cached) {
    cached = { conn: null, promise: null };
    global.mongooseCache = cached;
  }
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGO_URI, {
        serverSelectionTimeoutMS: 10_000, // échec rapide si le cluster est injoignable (évite que les routes pendent)
        socketTimeoutMS: 45_000,
        maxPoolSize: 10,
      })
      .catch((err) => {
        // Réinitialiser la promesse pour permettre une nouvelle tentative au prochain appel
        // (sinon une connexion échouée resterait définitivement « rejected » en cache).
        if (cached) cached.promise = null;
        throw err;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
