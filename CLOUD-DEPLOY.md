# Host Hadir Attendance on Railway

Run the Next.js app and a persistent MySQL database in the cloud. Staff then use the HTTPS website, including the webcam kiosk, while your Windows laptop can be switched off. A domain supplies the name; Railway supplies the running application and database.

The repository is `Manz2404/Attendance-system`, branch `main`. Cloud startup is `npm run start:cloud`; Windows users keep using their normal launcher.

## 1. Choose the account and database

Connect Railway to the GitHub account that owns this personal repository. Create a Hadir project and a MySQL service with persistent storage. MySQL 8.4 is covered by the project's integration tests. Keep the app and database in the same project/environment, preferably a region near your staff.

Railway bills for resources used by both services. Check the current plan, spending controls, and usage estimate before enabling paid hosting. The pricing page is https://railway.com/pricing.

Choose whether to move the current attendance database or start with an empty database:

- **Keep current employees and attendance:** export the complete existing attendance database, including `hadir_schema_migrations`, from SQLyog. Import it into the new cloud database **before the first app deployment runs its migration command**. Retain the same `FACE_ENCRYPTION_KEY` from the Windows `.env`; encrypted face enrollments need this exact key. Existing administrator credentials are stored in that database and move with it. Stop local clock-ins during the final export/import, then use the cloud address so records are written to one database.
- **Start fresh:** leave the cloud database empty. The pre-deploy command creates its tables, then create an administrator after deployment as described below. Use a newly generated key and enroll staff again.

Keep a private copy of the database export and encryption key. Upload secrets through Railway's Variables interface, not through GitHub or chat.

## 2. Configure the app service

Add a service from the GitHub repository. Use the repository root containing `package.json` and the Railpack builder. Add variables before deploying:

| Variable | Value |
| --- | --- |
| `RAILPACK_NODE_VERSION` | `22` |
| `DB_HOST` | The MySQL service's private host, referenced from its `MYSQLHOST` variable |
| `DB_PORT` | The MySQL service's internal `MYSQLPORT` |
| `DB_USER` | The MySQL service's `MYSQLUSER`, or a dedicated account with the app's schema permissions |
| `DB_PASSWORD` | The matching database password, referenced from `MYSQLPASSWORD` |
| `DB_NAME` | The MySQL service's `MYSQLDATABASE` |
| `DB_SSL` | `false` when using Railway's private network; use verified TLS for an external database |
| `FACE_ENCRYPTION_KEY` | The existing 64-character hex key for an imported database, or a new private key for a fresh one |
| `COOKIE_SECURE` | `true` |
| `NEXT_TELEMETRY_DISABLED` | `1` |

For a database service named `MySQL`, Railway reference variables look like `${{MySQL.MYSQLHOST}}`, `${{MySQL.MYSQLPORT}}`, `${{MySQL.MYSQLUSER}}`, `${{MySQL.MYSQLPASSWORD}}`, and `${{MySQL.MYSQLDATABASE}}`. Use the actual database service name. Leave `PORT` to Railway; cloud startup reads the assigned value and binds to `0.0.0.0`.

For a **fresh** installation only, generate a key privately on your own PC:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the result directly into Railway's secret variable. Replacing an existing installation's key requires face re-enrollment.

Use these service deployment settings:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Pre-deploy command | `npm run db:migrate` |
| Start command | `npm run start:cloud` |
| Healthcheck path | `/login` |
| Restart policy | On failure |

The existing migrations run against the chosen database, preserve applied migration checksums, and stop a deployment if setup fails. The healthcheck verifies that the web server is responding; it is not a database-backup or ongoing database-health check.

Cloud mode enforces production mode, a public listener, and HTTPS-only session cookies. It validates the face encryption key before starting and never generates a replacement key on a container's temporary disk. All recognition models are installed by npm with the app dependencies; the app does not save staff camera frames to the filesystem. Persistent attendance data belongs in the MySQL service's volume, with backups enabled.

Deploy, generate a Railway HTTPS domain for the app service, and open its `/login` page. A custom domain is added after this initial address is working.

## 3. Administrator and staff access

If you imported the existing database, use the existing administrator account. If the database is fresh, open an interactive shell inside the deployed app using Railway's SSH feature or CLI, then run:

```sh
npm run admin:create
```

The existing prompt asks for username, display name, and a password of at least 12 characters. With the Railway CLI already linked to this project/service, `railway ssh` opens the remote shell. Enter the command there so it uses the cloud database's private-network variables. `railway run` on the laptop runs a local process and normally cannot reach those private hostnames.

Sign in, check employees/attendance, and open Kiosk. Pair each staff browser at the cloud address with **Start kiosk & sign out**. A kiosk paired on `localhost` has a different cookie and needs pairing again on the new address. Use the final custom domain for normal kiosk use; verify staff PIN and webcam clock-in/out there. Appearance choices are also browser/address specific and can be selected again under Settings.

## 4. Use hadirattendance.my.id

In the app service's domain settings, add `hadirattendance.my.id`. Railway supplies the DNS routing and ownership-verification records. Add the exact records Railway shows in the domain's DNS management area at Flaz, or at whichever provider currently hosts its nameservers. Use those assigned values; do not copy an example Railway hostname from a guide.

A root domain needs a DNS provider supporting CNAME flattening or an equivalent ALIAS/ANAME feature. If the current provider does not support it, use a subdomain such as `app.hadirattendance.my.id`, or plan a DNS-provider change while preserving existing records. Domain registration can stay with Flaz. Verify the domain and HTTPS certificate before staff use it.

The registered domain, cloud MySQL service, and app service have separate settings. Changing DNS alone does not upload the app or migrate local records.

## 5. Updates and recovery

Deploy later source updates from GitHub. Keep the database service, its volume, and the same face key across app redeployments. Back up the database before upgrades and test restoring to a separate disposable database. An application rollback does not undo database migrations.

For a failed deployment, check dependency/build logs, the pre-deploy migration result, required variables, and whether the assigned port is reachable. Use the application service's HTTPS address; secure cookies intentionally require HTTPS. Do not open your Windows MySQL port to the internet as a substitute for a cloud database.

## Official references

- https://docs.railway.com/guides/nextjs
- https://docs.railway.com/databases/mysql
- https://railpack.com/languages/node
- https://docs.railway.com/deployments/pre-deploy-command
- https://docs.railway.com/cli/ssh
- https://docs.railway.com/networking/domains/working-with-domains
- https://railway.com/pricing
