import mongoose from "mongoose";

// Registering every schema here means a route can .populate() a model it does not
// itself import. Without this, a cold start that only loads some model files throws
// MissingSchemaError - which is invisible in development, where an earlier request
// has usually registered the model already.
import "@/models";

/**
 * Cached connection helper.
 * Next.js hot-reloads modules in development, so without caching every reload
 * would open a new pool of connections to MongoDB Atlas.
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cached = global._mongoose ?? { conn: null, promise: null };
global._mongoose = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { bufferCommands: false }).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}

export default connectDB;
