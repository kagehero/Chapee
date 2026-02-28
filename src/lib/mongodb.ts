import { MongoClient, Db, Collection, Document } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGODB_DB || "chapee";

  if (cachedDb) return cachedDb;

  const client = cachedClient ?? new MongoClient(uri);
  if (!cachedClient) cachedClient = client;

  await client.connect();
  cachedDb = client.db(dbName);
  return cachedDb;
}

export async function getCollection<T extends Document = Document>(
  name: string
): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}
