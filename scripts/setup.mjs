import mysql from 'mysql2/promise';
import { copyFileSync, existsSync } from 'node:fs';
import { databaseOptions, loadLocalEnvironment, explainError } from './database.mjs';
import { migrate } from './migrate.mjs';
import { promptAdmin } from './admin.mjs';
import { setupFaces } from './face-setup.mjs';
let connection;
try {
  if (!existsSync('.env')) { copyFileSync('.env.example', '.env'); throw new Error('Created .env. Enter your MySQL connection details in that file, then run setup again.'); }
  loadLocalEnvironment(); connection = await mysql.createConnection(databaseOptions());
  await setupFaces();
  console.log('MySQL connection successful.');
  console.log(await migrate(connection) ? 'Attendance tables created.' : 'Attendance database is already set up.');
  await promptAdmin(connection);
  console.log('Setup complete. Build with npm run build, then run npm start.');
} catch (error) { console.error(explainError(error)); process.exitCode = 1; }
finally { await connection?.end(); }
