import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { databaseOptions, loadLocalEnvironment, explainError } from './database.mjs';
import { ask, askPassword } from './prompt.mjs';
import { hashPassword, hashToken, validUsername, validPassword } from '../lib/password.mjs';

export async function createAdmin(connection, { username, name, password }, reset = false) {
  username = username.trim().toLowerCase(); name = name.trim();
  if (!validUsername(username)) throw new Error('Username must have 3–80 characters: letters, numbers, dot, underscore, @ or hyphen.');
  if (!name || name.length > 120) throw new Error('Name must have 1–120 characters.');
  if (!validPassword(password)) throw new Error('Password must have 12–256 characters.');
  const passwordHash = await hashPassword(password);
  await connection.beginTransaction();
  try {
    const [[existing]] = await connection.execute('SELECT id FROM hadir_users WHERE username = ? FOR UPDATE', [username]);
    if (reset) {
      if (!existing) throw new Error('Administrator not found.');
      await connection.execute('UPDATE hadir_users SET password_hash = ? WHERE id = ?', [passwordHash, existing.id]);
      await connection.execute('DELETE FROM hadir_sessions WHERE user_id = ?', [existing.id]);
      await connection.execute('DELETE FROM hadir_login_attempts WHERE attempt_key = ?', [hashToken(username)]);
    } else {
      if (existing) throw new Error('This username already exists. Use admin:reset-password to change its password.');
      await connection.execute('INSERT INTO hadir_users (id, username, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [randomUUID(), username, name, passwordHash, new Date().toISOString()]);
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
}
export async function promptAdmin(connection, reset = false) {
  if (!reset) {
    const [[row]] = await connection.query('SELECT COUNT(*) AS count FROM hadir_users');
    if (row.count > 0) { console.log('An administrator already exists. Sign in with that account, or use npm run admin:reset-password.'); return; }
  }
  const username = await ask('Administrator username (example: arman): ');
  const name = reset ? username : await ask('Display name: ');
  const password = await askPassword('Password (at least 12 characters): ');
  const confirm = await askPassword('Confirm password: ');
  if (password !== confirm) throw new Error('Passwords do not match. Run setup again.');
  await createAdmin(connection, { username, name, password }, reset);
  console.log(reset ? 'Password changed. Existing sessions have been signed out.' : 'Administrator created. Use this username and password to sign in.');
}
if (process.argv[1]?.endsWith('admin.mjs')) {
  let connection;
  try { loadLocalEnvironment(); connection = await mysql.createConnection(databaseOptions()); await promptAdmin(connection, process.argv.includes('--reset')); }
  catch (error) { console.error(explainError(error)); process.exitCode = 1; }
  finally { await connection?.end(); }
}
