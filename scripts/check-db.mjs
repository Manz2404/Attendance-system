import mysql from 'mysql2/promise';
import { databaseOptions, loadLocalEnvironment, explainError } from './database.mjs';
import { requireCompatibleVersion } from '../lib/database-version.mjs';
export async function checkDatabase(connection) {
  const [[row]] = await connection.query('SELECT VERSION() AS version, DATABASE() AS databaseName');
  requireCompatibleVersion(row.version);
  const [engines] = await connection.query('SHOW ENGINES');
  if (!engines.some(engine => engine.Engine.toLowerCase() === 'innodb' && ['YES', 'DEFAULT'].includes(engine.Support.toUpperCase()))) throw new Error('This MySQL server needs InnoDB enabled for attendance transactions.');
  const [collations] = await connection.query("SHOW COLLATION WHERE Collation = 'utf8mb4_bin'");
  if (!collations.length) throw new Error('This MySQL server needs the utf8mb4_bin collation for attendance text.');
  return row;
}
if (process.argv[1]?.endsWith('check-db.mjs')) {
  let connection;
  try {
    loadLocalEnvironment(); connection = await mysql.createConnection(databaseOptions());
    const row = await checkDatabase(connection);
    console.log(`Connection successful. Database: ${row.databaseName}. Server: ${row.version}.`);
  } catch (error) { console.error(explainError(error)); process.exitCode = 1; }
  finally { await connection?.end(); }
}
