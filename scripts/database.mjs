import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

export function loadLocalEnvironment() {
  const file = resolve(process.cwd(), '.env');
  if (existsSync(file)) loadEnvFile(file);
}
export function databaseOptions(env = process.env) {
  if (!env.DB_HOST || !env.DB_USER || !env.DB_NAME || env.DB_USER === 'your_mysql_user') throw new Error('Edit DB_HOST, DB_USER, DB_PASSWORD and DB_NAME in .env using your SQLyog connection details.');
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT must be a valid port number.');
  if (env.DB_PASSWORD === 'your_mysql_password') throw new Error('Replace the example DB_PASSWORD in .env. Use an empty value only if your MySQL account has no password.');
  if (env.DB_SSL && !['true', 'false'].includes(env.DB_SSL)) throw new Error('DB_SSL must be true or false.');
  const ssl = env.DB_SSL === 'true' ? { rejectUnauthorized: true, ...(env.DB_SSL_CA ? { ca: readFileSync(resolve(env.DB_SSL_CA), 'utf8') } : {}) } : undefined;
  return { host: env.DB_HOST, port, user: env.DB_USER, password: env.DB_PASSWORD ?? '', database: env.DB_NAME, charset: 'utf8mb4', timezone: 'Z', dateStrings: true, connectTimeout: 10000, ssl };
}
export function explainError(error) {
  const messages = {
    ECONNREFUSED: 'MySQL is not running, or DB_HOST / DB_PORT is incorrect. Start your MySQL service and check .env.',
    ENOTFOUND: 'DB_HOST could not be found. Check the server address in .env.',
    ETIMEDOUT: 'MySQL did not respond. Check the address, port and firewall.',
    ER_ACCESS_DENIED_ERROR: 'MySQL rejected your account. Check DB_USER / DB_PASSWORD and allowed hosts.',
    ER_BAD_DB_ERROR: 'DB_NAME does not exist. Create the database in SQLyog or choose your existing database.',
    ER_TABLEACCESS_DENIED_ERROR: 'Your MySQL account needs permission to create and read/write the attendance tables.',
  };
  return messages[error?.code] ?? (error?.code ? `Database error ${error.code}. Check your MySQL configuration.` : error instanceof Error ? error.message : 'Setup failed.');
}
