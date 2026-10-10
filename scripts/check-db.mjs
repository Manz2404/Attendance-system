import mysql from 'mysql2/promise';
import { databaseOptions, loadLocalEnvironment, explainError } from './database.mjs';
export async function checkDatabase(connection) {
  const [[row]] = await connection.query('SELECT VERSION() AS version, DATABASE() AS databaseName');
  const maria = row.version.includes('MariaDB');
  const [major, minor] = row.version.split('.').map(Number);
  if ((!maria && major < 8) || (maria && (major < 10 || (major === 10 && minor < 6)))) throw new Error(`Your server is ${row.version}. Use MySQL 8.0+ (or MariaDB 10.6+) for this application.`);
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
