import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { databaseOptions, loadLocalEnvironment, explainError } from './database.mjs';
import { checkDatabase } from './check-db.mjs';

const version = '001-initial';
const expectedTables = ['hadir_users', 'hadir_sessions', 'hadir_login_attempts', 'hadir_workspaces', 'hadir_schedules', 'hadir_employees', 'hadir_devices', 'hadir_punches'];
export async function migrate(connection) {
  await checkDatabase(connection);
  const sql = await readFile(new URL('../database/001-initial.sql', import.meta.url), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const [[db]] = await connection.query('SELECT DATABASE() AS name');
  const lockName = 'hadir-migrate-' + createHash('sha256').update(db.name).digest('hex').slice(0, 32);
  const [[lock]] = await connection.execute('SELECT GET_LOCK(?, 15) AS acquired', [lockName]);
  if (Number(lock.acquired) !== 1) throw new Error('Another database setup is running. Try again after it finishes.');
  try {
    const [tables] = await connection.execute('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
    const names = new Set(tables.map(t => t.name));
    const trackingExists = names.has('hadir_schema_migrations');
    if (!trackingExists && [...names].some(n => n.startsWith('hadir_'))) throw new Error('This database already contains hadir_ tables from another installation. Choose a separate database; existing tables were not changed.');
    await connection.query("CREATE TABLE IF NOT EXISTS hadir_schema_migrations (version VARCHAR(80) NOT NULL PRIMARY KEY, checksum VARCHAR(64) NOT NULL, applied_at VARCHAR(24) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin");
    const [[existing]] = await connection.execute('SELECT checksum, applied_at FROM hadir_schema_migrations WHERE version = ?', [version]);
    if (existing && existing.checksum !== checksum) throw new Error('The applied migration file has changed. Restore database/001-initial.sql instead of modifying an existing migration.');
    if (existing?.applied_at) {
      if (expectedTables.some(t => !names.has(t))) throw new Error('An attendance table is missing. Restore it from your database backup.');
      return false;
    }
    // MySQL commits DDL automatically. The marker lets an interrupted setup resume.
    if (!existing) await connection.execute('INSERT INTO hadir_schema_migrations (version, checksum, applied_at) VALUES (?, ?, NULL)', [version, checksum]);
    const statements = sql.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
    for (const statement of statements) await connection.query(statement);
    await connection.execute('UPDATE hadir_schema_migrations SET applied_at = ? WHERE version = ?', [new Date().toISOString(), version]);
    return true;
  } finally { await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]); }
}
if (process.argv[1]?.endsWith('migrate.mjs')) {
  let connection;
  try { loadLocalEnvironment(); connection = await mysql.createConnection(databaseOptions()); console.log(await migrate(connection) ? 'Attendance tables created.' : 'Database schema is already up to date.'); }
  catch (error) { console.error(explainError(error)); process.exitCode = 1; }
  finally { await connection?.end(); }
}
