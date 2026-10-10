import { createPool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { databaseOptions } from '../scripts/database.mjs';

function connect() {
  const pool = createPool({ ...databaseOptions(), waitForConnections: true, connectionLimit: 5, queueLimit: 50 });
  return drizzle(pool);
}
// Lazy connection: building the app never requires a running database.
const globalDb = globalThis as unknown as { hadirDb?: ReturnType<typeof connect> };
export function getDb() { return globalDb.hadirDb ??= connect(); }
export type Database = ReturnType<typeof getDb>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Connection = Database | Transaction;
