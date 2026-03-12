import mongoose from 'mongoose';

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
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
    cached.promise = mongoose.connect(MONGO_URI);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
