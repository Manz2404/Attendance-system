# Hadir Attendance — Windows + MySQL

A standalone attendance application for your Windows laptop. Source code belongs in `C:\Attendance-system`; attendance records are saved on the MySQL server you configure. SQLyog is the client you use to manage that server.

This version includes employees, schedules, manual IN/OUT punches, CSV imports, daily attendance, monthly reports, CSV exports, and a PIN clock-in kiosk. Device registration stores hardware details; a real device adapter will be added after you choose a device with a supported SDK/API. No hardware connection is claimed in this version.

## Install on Windows

1. Install the **Node.js LTS Windows installer** from <https://nodejs.org/en/download>. This project needs Node.js 22.13 or newer, including npm. Close and reopen Command Prompt after installation.
2. Get the source:

   ```bat
   cd /d C:\
   git clone https://github.com/Manz2404/Attendance-system.git Attendance-system
   cd /d C:\Attendance-system
   ```

   Git is optional: use **Code → Download ZIP** on GitHub or the supplied ZIP. Extract it so `package.json` and `setup-windows.cmd` are directly inside `C:\Attendance-system`, rather than a second nested folder.

3. In SQLyog, connect to your MySQL server. Choose an existing database, or create a separate one in its query editor:

   ```sql
   CREATE DATABASE IF NOT EXISTS attendance_system
     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
   ```

   You can use your existing MySQL server and account. A separate database keeps the attendance tables easy to manage. The app does not import or modify your other application's tables. It creates tables named `hadir_*` in the selected database. Use MySQL 5.5.42 or newer. Your existing MySQL 5.5.42 server is supported. MariaDB 10.6+ is also accepted by setup; automated database tests cover MySQL 5.5.42 and 8.4.

4. Double-click **setup-windows.cmd**. It creates and opens `.env` on the first run. Enter the same connection details you use in SQLyog, then save and close Notepad:

   ```dotenv
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=your_mysql_user
   DB_PASSWORD="your_mysql_password"
   DB_NAME=attendance_system
   DB_SSL=false
   DB_SSL_CA=
   PORT=3000
   COOKIE_SECURE=false
   ```

   Replace the example username and password with your real values **on your laptop**. Quotes keep spaces and `#` in a password intact. If MySQL runs on another computer, enter that server's address as `DB_HOST`. The account needs `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `INDEX` and `REFERENCES` permissions for the selected database during initial setup. It needs read/write permissions afterwards.

5. Setup downloads dependencies, checks the connection, creates the attendance tables, asks you to create an administrator username and password, then builds the app. The administrator password must have at least 12 characters; it is different from your MySQL password.
6. Double-click **start-windows.cmd**. Keep its window open and visit **http://127.0.0.1:3000**. Sign in with the administrator account you just created. Closing the window stops the app; your MySQL records remain saved.

The default server listens only on your laptop. Future device integration may need a separate LAN gateway or authenticated endpoint, depending on the device. It is not set up for access from other computers yet.

## Where your files and records are stored

| Item | Location |
| --- | --- |
| Source code | `C:\Attendance-system` and your GitHub repository |
| Your database connection settings | `C:\Attendance-system\.env` — ignored by Git |
| Attendance records, accounts and sessions | `hadir_*` tables in the MySQL database set by `DB_NAME` |
| Browser address | `http://127.0.0.1:3000` |

No database password, administrator password or live attendance records are included in the repository. Keep `.env` private. You do not need ChatGPT login to use this local version. The earlier hosted preview is a separate installation; its data is not copied automatically into MySQL.

## Start using your own team

Sign in, set your workspace name, review the default Monday–Friday 09:00–18:00 schedule, then add employees with unique employee codes. Record a manual punch or upload a CSV. Example format:

```csv
employee_code,timestamp,event,note
EMP-001,2026-10-09T09:00:00+08:00,IN,Morning arrival
EMP-001,2026-10-09T18:00:00+08:00,OUT,End of day
```

Create `EMP-001` first and use dates within that employee's employment period. The app provides a CSV template and preview. Imports allow 1–1,000 rows and up to 300 KB per request. Invalid rows reject the whole import; identical employee/time/event records are skipped, including concurrent imports.

All reports use **Asia/Kuala_Lumpur (UTC+8)**. A completed continuous shift deducts the assigned unpaid break. Recorded gaps between paired sessions count toward that break so lunch is not deducted twice. Lateness beyond the grace period counts from the scheduled start; incomplete punches are flagged rather than assigned invented hours. Overnight checkouts are attributed to the prior shift. Editing a schedule recalculates historical summaries. Leave, public holidays, payroll rules and employee logins are not included in this first version.

Sample employees are optional and clearly labeled. Removing samples deletes those fictional employees and all punches linked to them, including manual punches you added to a sample employee. It keeps your own employees' records.

## Clock-in kiosk

1. Stop the running server, keep your existing `.env`, and run `setup-windows.cmd` after updating. Setup applies the new `002-kiosk.sql` migration and builds the app. Back up your MySQL database before the update.
2. Sign in as the administrator and open **Kiosk** in the side menu.
3. Choose an employee, enter and confirm a **six-digit PIN**, and click **Save PIN**. Leading zeros are supported. Share each PIN privately with its employee; PINs cannot be retrieved afterwards, only replaced or removed.
4. On the computer/browser that will be the shared attendance station, click **Start kiosk & sign out**. This revokes the current administrator session in that browser and opens **http://127.0.0.1:3000/kiosk** (or your configured port).
5. Staff choose their name, enter their PIN on the keyboard or number pad, and click **Clock in**. The success screen clears after five seconds for the next person. The timestamp is supplied by the server and attendance is saved to the normal MySQL punch table with source **kiosk**.
6. Sign in as administrator to see the record in Attendance or Reports. For another kiosk browser, sign in on that browser and repeat **Start kiosk & sign out**.

The kiosk cookie expires after 30 days. It only grants access to the staff-name list and PIN clock-in endpoint for its workspace; it grants no access to administrator screens or reports. **Disconnect all kiosks** revokes every paired browser for the current workspace. Removing a PIN or making an employee inactive removes their kiosk access. Resetting a PIN also clears that employee's failed-attempt lock.

This kiosk records **clock-in only**, once per shift workday. A second submission returns the existing IN record (including manual/CSV clock-ins) without inserting another. Overnight shifts use the schedule's workday. Clock-out remains available through the administrator's manual attendance workflow.

Five incorrect PINs lock that employee for 15 minutes across kiosk browsers. Each station also has a per-minute request limit. PINs use individually salted scrypt hashes, session tokens are hashed in MySQL, and no PIN/hash is included in API responses or exports. Names and employee codes are only listed on a browser an administrator has paired.

The laptop/application and MySQL must be running. `/kiosk` alone does not make the app available from other computers or your domain; network/tunnel setup is a separate step. A kiosk is a shared credential station and does not prove the person's physical identity.

## Commands and troubleshooting

Run commands from `C:\Attendance-system`:

| Command | Purpose |
| --- | --- |
| `npm run db:check` | Check MySQL connection and server version |
| `npm run setup` | Apply schema and create the first administrator |
| `npm run db:migrate` | Apply unapplied database migrations |
| `npm run admin:reset-password` | Reset an administrator password locally and revoke that account's sessions |
| `npm run dev` | Development mode on the local address |
| `npm run build` | Build after changing or updating the code |
| `npm start` | Start the built app |
| `npm test` | Attendance and security unit tests |
| `npm run test:http` | Check browser origins against the built local server |
| `npm run typecheck` | TypeScript check |

- **Connection refused:** start your MySQL Windows service; check its host and port in SQLyog and `.env`.
- **Access denied:** check the account, password, host permissions and database grants.
- **Unknown database:** create `DB_NAME` in SQLyog or choose a database that already exists.
- **SQLyog uses SSH or HTTP tunneling:** this app uses a direct MySQL connection. Establish an SSH tunnel locally and set `DB_HOST=127.0.0.1` and `DB_PORT` to its forwarded port, or configure direct access. SQLyog's HTTP tunnel is not an application connection.
- **Port 3000 already used:** change `PORT` in `.env`, restart and use the new port.
- **Forgot administrator password:** open Command Prompt here and run `npm run admin:reset-password`.
- **Login says "This request is not allowed":** open `http://127.0.0.1:3000/login` using your configured port. Version 0.2.2 also accepts `http://localhost:3000` correctly. Update the application files, keep `.env`, stop the running server, run `setup-windows.cmd` to rebuild, then start it again.
- **Already contains `hadir_` tables:** use another database if these tables belong to a different app. Setup refuses an untracked installation; it does not replace those tables.
- **Internet needed:** the first dependency install needs internet. The app can then run locally while the configured MySQL server is available.

For a remote MySQL connection requiring TLS, set `DB_SSL=true`; set `DB_SSL_CA` to your CA certificate path if required. TLS verification stays enabled. `COOKIE_SECURE=false` is for local HTTP; only change it to `true` when the browser uses HTTPS.

## Updating from the original MySQL 8.0 setup requirement

Version 0.2.1 supports the existing MySQL 5.5.42 server. Update the application files, keep your existing `.env`, then run `setup-windows.cmd` again. The schema is unchanged, so this fix does not require a server upgrade or a new database.

If you installed by downloading ZIP, extract the updated ZIP and copy its contents into `C:\Attendance-system`, replacing the application files. The ZIP contains `.env.example` but no `.env`, so your saved connection details are kept.

## Updating and backups

Back up the MySQL database using SQLyog before updates. Source control backs up code, not attendance records. Keep a separate secure backup of `.env`.

If installed using Git, save or commit your own code changes, then update:

```bat
cd /d C:\Attendance-system
git pull
npm install
npm run db:migrate
npm run build
npm start
```

The kiosk upgrade adds three tables and extends the punch source enum. Existing attendance and administrator accounts are retained. Migration files are checksummed and applied explicitly during setup/update, never during web requests. Do not edit an already applied migration. MySQL DDL commits automatically; an interrupted first setup can resume using its migration marker.

## Source map

| File | Purpose |
| --- | --- |
| `app/attendance-app.tsx` | Dashboard and administrator workflows |
| `app/api/workspace/route.ts` | Attendance controller: authenticated reads and writes |
| `app/api/auth/login/route.ts` | Local sign-in and failed attempt limit |
| `lib/auth.ts` | Hashed database sessions and logout |
| `app/kiosk/`, `app/kiosk-settings.tsx` | Shared clock-in screen and administrator PIN setup |
| `app/api/kiosk/` | Restricted clock-in and kiosk session endpoints |
| `database/002-kiosk.sql` | PINs, kiosk sessions and attempt limits |
| `lib/attendance.ts` | Attendance calculations and CSV handling |
| `db/index.ts`, `db/schema.ts` | MySQL pool and typed tables |
| `database/001-initial.sql` | Initial MySQL schema |
| `scripts/setup.mjs`, `setup-windows.cmd` | First-run setup |
| `start-windows.cmd` | Start the local server |

## Verification and device integration

GitHub Actions in `.github/workflows/ci.yml` runs the unit tests, TypeScript check and production build on Windows, plus controller/authentication integration tests against disposable MySQL 5.5.42 and 8.4 services. These tests cover transaction rollback, duplicate and concurrent imports, account isolation, samples, hashed sessions, password reset, login limits and database persistence. Check the Actions tab for the current result.

To run the MySQL suite manually, use a **new disposable database named `hadir_test_<name>`** with test connection environment variables, then run `npm run test:mysql`. The suite refuses a regular attendance database and leaves its test data there; it does not reset your real database.

No real hardware has been tested because a device has not been selected. Before buying, obtain the exact model's integration documentation, SDK/API availability and licensing from the supplier. Its adapter should translate device events to employee code, timestamp with timezone, and IN/OUT. A future device adapter also needs authentication, retry/sync tracking and a way to map device user IDs. The current device page records plans and supports CSV imports; it does not receive unattended device pushes or poll hardware.

Framework and driver documentation: <https://nextjs.org/docs>, <https://sidorares.github.io/node-mysql2/docs>.
