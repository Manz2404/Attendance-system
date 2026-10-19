# Hadir Attendance — Windows + MySQL

A standalone attendance application for your Windows laptop. Source code belongs in `C:\Attendance-system`; attendance records are saved on the MySQL server you configure. SQLyog is the client you use to manage that server.

This version includes employees, schedules, manual IN/OUT punches, CSV imports, daily attendance, monthly reports, CSV exports, and an attendance kiosk with PIN or webcam face verification for both clock-in and clock-out. It supports a laptop camera or USB webcam. Device registration stores plans for separate attendance hardware; a device adapter still needs a supported SDK/API.

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

5. Setup downloads dependencies and face-recognition models, checks the connection, generates a private `FACE_ENCRYPTION_KEY` in `.env`, creates or upgrades the attendance tables, asks you to create an administrator username and password, then builds the app. The administrator password must have at least 12 characters; it is different from your MySQL password. Existing administrators are retained on updates.
6. Double-click **start-windows.cmd**. It starts the server and opens **http://127.0.0.1:3000** in your default browser when ready. Sign in with the administrator account you just created. Keep the server window open; closing it stops the app and your MySQL records remain saved.

The default server listens only on your laptop. For local-network access, set `HADIR_BIND_HOST=0.0.0.0` in `.env`, allow the configured port through Windows Firewall for your private LAN, and restart. The other PC uses your attendance PC's IPv4 address and port in its browser. Webcam scanning from another PC requires HTTPS; PIN and ordinary pages can use LAN HTTP. Future device integration may need a separate gateway or authenticated endpoint, depending on the device.

## Cloud hosting

To run the website on **Render while keeping the current MySQL database on your Windows laptop**, follow [RENDER-LAPTOP.md](RENDER-LAPTOP.md). Version **0.5.3** includes `connect-render-database.cmd` and a Docker startup that connects through private Tailscale networking and checks MySQL before serving the app. The laptop and MySQL must remain online.

Cloud startup is available with `npm run start:cloud`: it uses the host-assigned port, binds to `0.0.0.0`, enforces HTTPS-only cookies, and requires a stable face-enrollment key. See [CLOUD-DEPLOY.md](CLOUD-DEPLOY.md) for Railway, a cloud MySQL database, migration of existing records, and connecting `hadirattendance.my.id`. Normal Windows startup continues to use the configured local/LAN binding.

## Desktop application link

After setup, double-click **create-desktop-shortcut.cmd** once inside `C:\Attendance-system`. It creates a **Hadir Attendance** icon on your Windows Desktop. It does not need administrator access.

Double-click that desktop icon for daily use. It starts the server if needed, waits for the application to respond, and opens its link in your default browser. If Hadir is already running on the configured port, the launcher reuses it rather than starting a second server. Keep the original server window open while using the app. Run setup only for the first installation or after code updates; the desktop shortcut does not reinstall dependencies or modify database records.

The launcher reads `PORT` from your private `.env`, including a custom port. If a different app or an older build is using that port, it displays a message. Stop the old server and rebuild after updating before starting the new launcher. If you move the project folder, run the shortcut creator again so its target points to the new location.

**Hadir-Attendance.url** is a plain browser forwarder for `http://127.0.0.1:3000/`. Copy it to your Desktop when you want a link that opens an already-running server. For another PC, edit its `URL=` line in Notepad to the attendance server's actual LAN address or configured HTTPS domain, then save. A URL-only forwarder uses a running server; it does not start a server on the client PC.

For LAN use with the desktop launcher, retain `HADIR_BIND_HOST=0.0.0.0` in the attendance PC's `.env`. The launcher still opens the local loopback address on that PC; other PCs use the server's LAN address. Domain/HTTPS hosting remains a separate configuration step.

## Create login accounts in the browser

Version **0.5.2** adds **Create an account** on the sign-in page and **Settings → Account & access → Add user**. Enter the new user's display name, username, password (12–256 characters), and password confirmation. A signed-in administrator confirms their current password before creating another account; five failed confirmations pause account creation for 15 minutes without blocking normal sign-in. The administrator stays signed in after creating the new user.

Each login owns a **separate workspace**. A new account starts empty; your existing employees, attendance, PINs, and faces remain under the original account. Staff clocking in/out are added through **Employees**, rather than by creating another administrator login. Shared workspace roles are not part of this update.

To create an account from the sign-in screen before you have an administrator session, the server operator must first set a private `ACCOUNT_CREATION_KEY` in the hosting service's environment variables or local `.env`. Generate a separate random code on your own computer:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy this code directly into `ACCOUNT_CREATION_KEY` in Render's **Environment** tab, save and deploy, then open `/register` and enter it in **Account creation code**. Keep the code out of GitHub and chat, and do not reuse `FACE_ENCRYPTION_KEY`. You can remove `ACCOUNT_CREATION_KEY` after creating the required accounts; signed-in administrators can still use **Add user**. Without this variable, anonymous account creation is disabled.

Account creation uses the existing MySQL tables and password hashing. **No database migration is needed for this update.** MySQL must be reachable and its earlier migrations must already have been applied. A browser form does not connect Render to a Windows laptop automatically: keep MySQL and the configured private connection online, and verify the Render `DB_*` settings. Connection and missing-table errors now explain the database issue instead of instructing cloud users to run a Windows launcher. Command-line administrator setup and password reset remain available.

## Appearance settings

Version **0.5.0** adds **Settings → Appearance**, styled with mode previews and color controls. After updating your application files, keep your existing `.env`, stop the old server, and run `setup-windows.cmd` once to rebuild. Start the app normally afterwards. No database migration is needed for appearance preferences.

- **Mode:** follow your device with System, or choose Light or Dark. System mode follows operating-system appearance changes while the app is open. The existing header toggle still switches between light and dark without losing your accent or custom colors.
- **Theme:** choose Hadir, Midnight, or Sand. Selecting a theme applies its coordinated palette and accent and clears custom background/text overrides for both modes.
- **Accent:** choose one of eight colors or use the color picker for any custom color. Buttons, links, focus indicators, and selected items update immediately. Attendance status colors keep their meaning.
- **Background / Foreground:** preview a background and text color using the picker or a six-digit hex value. Click **Apply colors** to use the pair. Light and dark modes keep separate custom pairs. Apply is available when text contrast is at least 4.5:1; button text also adjusts for its accent color.
- **Reset colors:** restore the current mode's theme colors. **Reset appearance:** return all appearance preferences to Hadir, green accent, and System mode.

Preferences are saved **in the current browser**, apply to administrator, sign-in, and kiosk screens, and synchronize with other tabs on the same app address. Other computers, browser profiles, and addresses have their own preferences. Existing light/dark choices are retained on upgrade. If browser storage is unavailable, changes work for the current visit.

## Where your files and records are stored

| Item | Location |
| --- | --- |
| Source code | `C:\Attendance-system` and your GitHub repository |
| Your database connection settings | `C:\Attendance-system\.env` — ignored by Git |
| Attendance records, accounts and sessions | `hadir_*` tables in the MySQL database set by `DB_NAME` |
| Encrypted face templates | `hadir_employee_faces` in that database; encryption key in your private `.env` |
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

## Staff clock-in and clock-out kiosk

1. Stop the running server, keep your existing `.env`, and run `setup-windows.cmd` after updating. Setup applies unapplied kiosk and face migrations and builds the app. Back up your MySQL database and `.env` before the update.
2. Sign in as the administrator and open **Kiosk** in the side menu.
3. Choose an employee, enter and confirm a **six-digit PIN**, and click **Save PIN**. Leading zeros are supported. Share each PIN privately with its employee; PINs cannot be retrieved afterwards, only replaced or removed.
4. On the computer/browser that will be the shared attendance station, click **Start kiosk & sign out**. This revokes the current administrator session in that browser and opens **http://127.0.0.1:3000/kiosk** (or your configured port).
5. Staff choose **Clock in** or **Clock out**, select their name, enter their PIN on the keyboard or number pad, and click the matching button. The success screen confirms the selected event and clears after five seconds for the next person. The timestamp is supplied by the server and attendance is saved to the normal MySQL punch table with source **kiosk**.
6. Sign in as administrator to see the record in Attendance or Reports. For another kiosk browser, sign in on that browser and repeat **Start kiosk & sign out**.

The kiosk cookie expires after 30 days. It only grants access to its workspace's staff-name list and restricted clock-in endpoints; it grants no access to administrator screens or reports. **Disconnect all kiosks** revokes every paired browser for the current workspace. Removing a PIN disables PIN entry; removing a face disables face entry. Staff with neither method, or inactive staff, are unavailable at the kiosk. Resetting a PIN clears that employee's failed PIN attempts.

The kiosk records one initial IN per shift workday. Repeating **Clock in** returns the existing IN record (including manual/CSV clock-ins) without inserting another. **Clock out** completes an open IN for that workday and records OUT. If the session is already complete, repeated clock-outs return the saved OUT, including when PIN and face submissions arrive together. A clock-out without a clock-in is rejected; the administrator can correct a missing record through **Attendance → Record punch**. If an administrator records another IN after a completed session, staff can clock out to close that new session. Overnight punches follow the existing schedule workday, including its two-hour checkout window after the scheduled end.

Version **0.4.1** adds staff clock-out using the existing IN/OUT columns and encrypted face enrollments; it needs no new database migration. Stop the server, update your application files, retain `.env`, and run `setup-windows.cmd` to rebuild, then restart and refresh the kiosk page. If you use the LAN startup command on your attendance PC, use that command again after rebuilding.

Five incorrect PINs lock that employee for 15 minutes across kiosk browsers. Each station also has a per-minute request limit. PINs use individually salted scrypt hashes, session tokens are hashed in MySQL, and no PIN/hash is included in API responses or exports. Names and employee codes are only listed on a browser an administrator has paired.

The laptop/application and MySQL must be running. `/kiosk` alone does not make the app available from other computers or your domain; network/tunnel setup is a separate step.

## Laptop or USB webcam face attendance

1. Update the application files, retain `.env`, and run **setup-windows.cmd**. It installs the local model files, generates an encryption key if needed, and applies **003-face.sql**. Start the app again.
2. Sign in as administrator and open **Kiosk → Face enrollment**. Choose an employee and confirm that they agree to enrollment. Offer PIN entry to employees who prefer it or cannot be matched.
3. Click **Enroll face → Start camera** and allow browser camera permission. If multiple cameras are connected, select the laptop or USB camera and click Start camera again. Use even lighting and keep one person in the guide.
4. Click **Capture enrollment**. Follow the three prompts: look straight, turn slightly to one side, then look straight again. An administrator can replace or remove an enrollment on this screen. One face cannot be assigned to two employees in the same workspace.
5. Click **Start kiosk & sign out**. Staff choose **Clock in** or **Clock out**, select their name and **Face scan**, start the camera, and click **Scan face & clock in** or **Scan face & clock out**. They follow the head-turn prompts. A match saves the selected event with a server timestamp and source **face**. Clock-out requires an open IN; repeated face or PIN entries return the saved record.

Face scanning verifies the selected employee; it does not automatically identify everyone walking past the camera. Staff may use PIN entry if a PIN is set. A face-only employee can also clock in and out at the kiosk. Administrators can still enter manual IN/OUT corrections.

Camera permission works on **http://127.0.0.1:3000**, **http://localhost:3000**, or an **HTTPS** deployment. Plain HTTP on a LAN address normally cannot open a camera. Opening the kiosk on your domain still requires hosting or a tunnel; owning the domain alone does not run this application. Model processing uses the attendance server's CPU, so older laptops may scan more slowly.

Three small camera JPEGs are sent to your own attendance server and processed in memory. Photos are not saved to disk or MySQL and are not sent to a face-recognition service. Only three 128-number face templates are retained, encrypted with AES-256-GCM and bound to the employee and workspace. Templates and PIN hashes never appear in browser rosters, reports or exports. Models are installed locally, so internet is needed for installation rather than each scan.

**Keep `.env` with your secure database backup.** Losing or changing `FACE_ENCRYPTION_KEY` makes stored face enrollments unreadable; re-enroll employees in that case. Never commit the key or real employee photos to GitHub. Removing an enrollment deletes its template and outstanding scan tokens from the current database; manage old database backups according to your retention needs.

Each scan uses a hashed token bound to the employee, kiosk and selected IN/OUT event. It expires after 90 seconds and can be used only once. Changing the selection restarts camera capture. Five failed face scans lock face entry for that employee for 15 minutes; PIN entry remains available. Re-enrollment clears the face lock. Each kiosk also limits scan starts per minute.

**Use a supervised kiosk.** The head-turn check rejects a stationary pose; it is a basic movement check, not certified liveness detection. An ordinary webcam cannot reliably prevent photo/video spoofing. Matching can fail under poor lighting or vary by person; PIN fallback and administrator review remain available. Test enrollment, matching and duplicate clock-ins on your own camera before relying on the kiosk.

Face detection, landmarks and descriptors use `@vladmandic/face-api` 1.7.15's Node/WASM distribution with `@tensorflow/tfjs` 4.22.0's pure JavaScript CPU backend. Its WASM backend dependency is installed but does not need a native TensorFlow addon. JPEG decoding uses `jpeg-js` 0.4.4. See `THIRD_PARTY_NOTICES.md` for the corresponding notices. The feature does not analyze age, gender or emotion.

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
| `npm run launch` | Start/reuse the local server and open the application link on Windows |
| `npm test` | Attendance and security unit tests |
| `npm run test:http` | Check browser origins against the built local server |
| `npm run test:face-engine` | Load local face models and run the CPU detector on a test JPEG |
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
- **Camera permission denied:** allow camera access for the localhost/HTTPS address in your browser settings, close other apps using the camera, and retry. PIN entry remains available.
- **Face scanning is not ready:** stop the server, run `setup-windows.cmd`, and restart. Setup installs models and validates the encryption key.
- **Face did not match:** confirm the selected employee, improve lighting, move closer, and follow the head-turn prompts. An administrator can re-enroll the employee; use PIN entry if needed.

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
npm run setup
npm run build
npm start
```

The PIN upgrade adds three tables; the face upgrade adds two more and extends the punch source enum. Existing attendance and administrator accounts are retained. Setup generates the face key only when missing. Migration files are checksummed and applied explicitly during setup/update, never during web requests. Do not edit an already applied migration. MySQL DDL commits automatically; an interrupted first setup can resume using its migration marker.

## Source map

| File | Purpose |
| --- | --- |
| `app/attendance-app.tsx` | Dashboard and administrator workflows |
| `app/api/workspace/route.ts` | Attendance controller: authenticated reads and writes |
| `app/api/auth/login/route.ts` | Local sign-in and failed attempt limit |
| `lib/auth.ts` | Hashed database sessions and logout |
| `app/appearance-settings.tsx`, `app/appearance-provider.tsx` | Appearance controls and browser preference synchronization |
| `lib/appearance.ts` | Shared color policy, contrast checks, and first-paint theme bootstrap |
| `app/kiosk/`, `app/kiosk-settings.tsx` | Shared clock-in/out screen and administrator PIN setup |
| `app/api/kiosk/` | Restricted attendance and kiosk session endpoints |
| `app/camera-capture.tsx`, `app/face-settings.tsx` | Camera capture and administrator face enrollment |
| `lib/face-engine.mjs`, `lib/face-policy.mjs` | Server-side face extraction, matching, movement and template encryption |
| `lib/kiosk-punch.ts` | Shared face/PIN verification of open sessions and duplicate handling |
| `database/002-kiosk.sql` | PINs, kiosk sessions and attempt limits |
| `database/003-face.sql` | Encrypted templates and one-use scan challenges |
| `lib/attendance.ts` | Attendance calculations and CSV handling |
| `db/index.ts`, `db/schema.ts` | MySQL pool and typed tables |
| `database/001-initial.sql` | Initial MySQL schema |
| `scripts/setup.mjs`, `setup-windows.cmd` | First-run setup |
| `start-windows.cmd` | Start the local server |
| `scripts/launch.mjs`, `lib/launcher.mjs` | Start/reuse the server and open its browser link when ready |
| `create-desktop-shortcut.cmd` | Create the Windows desktop application shortcut |
| `Hadir-Attendance.url` | Browser-only forwarder to an already-running server |

## Verification and device integration

The `linux-cloud` workflow job verifies the production build, actual CPU face engine, and production HTTP behavior using the cloud listener on Linux. Startup policy tests verify host-assigned ports, HTTPS-only cookies, key validation, and local/LAN compatibility.

Appearance tests cover all preset/accent combinations in light and dark mode, custom-color validation, legacy choices, System mode resolution, and startup with unavailable or damaged browser storage. The production HTTP suite also executes the actual rendered first-paint script to verify it remains standalone after the Windows build.

GitHub Actions in `.github/workflows/ci.yml` runs the unit tests, Windows desktop shortcut creation, actual CPU face-detector smoke test, TypeScript check and production build on Windows, plus controller/authentication integration tests against disposable MySQL 5.5.42 and 8.4 services. Launcher checks cover custom ports, unavailable/occupied listeners, startup waits, the saved shortcut target and production-server reuse. The database tests inject face-model results to verify encryption, consent, account isolation, event-bound challenge expiry/reuse, match/movement failures, limits, revocation, concurrent face/PIN clock-ins and clock-outs, missing-IN rejection, completion of imported sessions, and report updates. The independent engine test loads real packaged models and detects the absence of a face in a generated blank JPEG. These automated checks do not measure recognition accuracy or anti-spoofing performance with real staff. Check the Actions tab for the current result.

To run the MySQL suite manually, use a **new disposable database named `hadir_test_<name>`** with test connection environment variables, then run `npm run test:mysql`. The suite refuses a regular attendance database and leaves its test data there; it does not reset your real database.

No real hardware has been tested because a device has not been selected. Before buying, obtain the exact model's integration documentation, SDK/API availability and licensing from the supplier. Its adapter should translate device events to employee code, timestamp with timezone, and IN/OUT. A future device adapter also needs authentication, retry/sync tracking and a way to map device user IDs. The current device page records plans and supports CSV imports; it does not receive unattended device pushes or poll hardware.

Framework and driver documentation: <https://nextjs.org/docs>, <https://sidorares.github.io/node-mysql2/docs>.
