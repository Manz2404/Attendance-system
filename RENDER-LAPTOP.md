# Connect Render to your existing Windows MySQL database

Version 0.5.3 adds a private Tailscale connection for Render. Employees, accounts, attendance, PINs and encrypted face templates stay in your existing laptop database. This setup does not export, replace or migrate that database.

The laptop must remain awake, connected to the internet, with MySQL and Tailscale running. The website runs on Render; database requests travel through Tailscale to the laptop. A Tailscale IP alone does not give Render access to your private network.

## 1. Enable the forwarder on the laptop

Update the existing project folder using `git pull`. Keep your existing `.env`. Open **Command Prompt as administrator**, change to the folder containing `package.json`, and run:

```bat
cd /d C:\Attendance-system
connect-render-database.cmd
```

If your project is nested, use `C:\Attendance-system\Attendance-system` instead. Install project dependencies with `npm install` if this checkout has not been set up. You do not need to start the local attendance website for this connection.

The helper checks the existing MySQL connection and enables:

```powershell
tailscale serve --bg --tcp=13306 tcp://127.0.0.1:3306
```

It reads the real MySQL port from `.env`, so the destination may differ from `3306`. The helper prints your laptop's Tailscale IPv4 address. Keep this value for Render. It shares TCP port **13306 inside your tailnet** and connects locally to MySQL. No public MySQL port or router forwarding is required. This is Tailscale Serve; do not enable Funnel for the database.

The background forwarder keeps running after closing the helper window. If the helper reports a Tailscale permission or configuration error, check that Tailscale is signed in, Serve is allowed, and the terminal has administrator access. You can inspect the forwarding configuration with `tailscale serve status`.

## 2. Create the Render Tailscale credential

In [Tailscale Admin → Settings → Keys](https://login.tailscale.com/admin/settings/keys), generate an **auth key** in the same tailnet as the laptop. Enable **Reusable** and **Ephemeral**; enable **Pre-approved** if device approval is required. Enter the key directly in Render's `TS_AUTHKEY` secret environment variable. Do not paste it into chat, source code or GitHub.

The Render container uses memory-only VPN state, so each restart joins as a new ephemeral device named `hadir-render`. The reusable key must still be valid when the next container starts; replace it in Render before expiry. If your tailnet has custom access rules, allow the Render device to reach the laptop on **TCP 13306**. Use the smallest appropriate grant; preserve your other existing access rules.

## 3. Configure the existing Render web service

Use the existing service linked to `Manz2404/Attendance-system`, branch `main`. In **Settings → Build → Source → Edit**, select that repository and change **Runtime** to **Docker**. Set the Dockerfile path to `Dockerfile.render-laptop` and the Docker build context to the repository root (`.`). Leave the root directory empty if `package.json` is at the repository root.

Keep the existing service, plan and hostname. The Dockerfile builds the app and includes pinned Tailscale binaries; it uses userspace networking and does not require privileged containers or a TUN device.

| Setting | Value |
| --- | --- |
| Runtime / Language | Docker |
| Dockerfile Path | `Dockerfile.render-laptop` |
| Docker Build Context | `.` |
| Docker Command | Empty, to use the Dockerfile's startup command |
| Pre-deploy Command | Empty |
| Health Check Path | `/login` |

In **Environment**, set these values before deploying:

| Variable | Value |
| --- | --- |
| `LAPTOP_TAILSCALE_IP` | The laptop's `100.x.x.x` address printed by the helper |
| `TS_AUTHKEY` | The reusable ephemeral auth key from the same tailnet, entered privately |
| `DB_USER` | The working MySQL username from the laptop's existing `.env` |
| `DB_PASSWORD` | Its matching MySQL password, entered privately |
| `DB_NAME` | The existing attendance database name from the laptop's `.env` |
| `FACE_ENCRYPTION_KEY` | The exact existing 64-character hex key from the laptop's `.env` |
| `NEXT_TELEMETRY_DISABLED` | `1` |

Leave `PORT` to Render. Keep `ACCOUNT_CREATION_KEY` if you already configured browser account creation; otherwise it is optional. Do not replace `FACE_ENCRYPTION_KEY`: your current face enrollments need the original key.

Startup automatically sets the application's `DB_HOST=127.0.0.1`, `DB_PORT=3307` and `DB_SSL=false` for the local relay; Tailscale encrypts the network connection. Existing Render `DB_HOST`, `DB_PORT`, `DB_SSL` and `DB_SSL_CA` values are overridden only inside this startup process. The laptop's `.env` is not changed. `LAPTOP_TAILSCALE_PORT` is optional and defaults to `13306`.

Do not use `npm run start:cloud` as a Docker Command override: it would bypass the tunnel startup. Do not run `db:migrate` as a pre-deploy command for this connection; this uses your already configured laptop database.

## 4. Deploy and verify

Save the environment values and deploy the latest commit. Startup authenticates Tailscale, opens a loopback-only TCP relay, and runs a **read-only** MySQL compatibility check. The web server starts only after the check succeeds. It never creates an administrator, runs migrations or changes database records during startup.

Look for this line in Render's deploy logs:

```text
Laptop MySQL connection verified. Starting Hadir Attendance.
```

Open your existing Render HTTPS address and sign in using your original account. Check that its employees and attendance are present. New administrator logins own separate workspaces, so a newly created account starts empty even though your original records remain intact. For an additional login use **Settings → Account & access → Add user**; staff members for clock-in/out belong under **Employees**.

Pair the kiosk at the Render address with **Start kiosk & sign out**. A kiosk paired on localhost must be paired again at this address. Test a staff clock-in and clock-out and confirm the records appear in your laptop's database.

The `/login` health check confirms the web server responds. It does not continuously verify MySQL availability. If the laptop sleeps or disconnects after startup, database requests fail until the laptop connection returns. Keep using one shared database to see the same records from both addresses.

## Troubleshooting and stopping

| Deploy message | What to check |
| --- | --- |
| `Set LAPTOP_TAILSCALE_IP` | Copy the laptop's Tailscale IPv4 address from the helper, not its Wi-Fi address |
| `Set TS_AUTHKEY` / authentication failed | Same tailnet, reusable unexpired key, device approval and access policy |
| `Laptop MySQL check failed` | Laptop awake, MySQL and Tailscale online, forwarder enabled, correct database credentials, TCP 13306 allowed by tailnet rules |
| Face encryption key validation failed | Copy the existing key from your laptop's private `.env` |
| Server starts without a MySQL verification message | Clear the Docker Command override and confirm the service uses this Dockerfile |

On the laptop, stop only this database forwarder with:

```bat
connect-render-database.cmd --stop
```

This disables the Tailscale listener on port 13306. It does not stop MySQL, remove records or reset unrelated Tailscale Serve mappings. Re-run the helper without `--stop` to enable it again.

## Official references

- [Render: changing a service's runtime](https://render.com/docs/native-runtimes#changing-a-services-runtime)
- [Render: Docker deployment](https://render.com/docs/docker)
- [Tailscale: userspace networking](https://tailscale.com/docs/features/userspace-networking)
- [Tailscale: Serve TCP forwarder](https://tailscale.com/docs/reference/tailscale-cli/serve)
- [Tailscale: auth keys](https://tailscale.com/docs/features/access-control/auth-keys)
