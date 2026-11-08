# Database compatibility

The application is tested against MySQL **5.5.42** and **8.4** using the same initial schema and controller tests. Setup checks that InnoDB and `utf8mb4_bin` are available before creating tables.

`001-initial.sql` is unchanged from the first release, including its original MySQL 8.0 comment, because installations track the file's checksum. Its DDL uses InnoDB, VARCHAR, INT, TINYINT and ENUM; it does not need MySQL 8 JSON columns, window functions or generated columns. All indexes fit the older InnoDB 767-byte key limit. The largest composite key is `owner_id` plus `dedupe_key`: `(36 + 150) × 4 = 744` bytes with utf8mb4.

Dates and instants remain normalized text values so the same schema and timezone calculations work on both versions. Application writes use ordinary transactions, prepared statements, `ON DUPLICATE KEY UPDATE` and `SELECT … FOR UPDATE`.

The PIN kiosk uses a separate `002-kiosk.sql` upgrade. It adds `hadir_employee_pins`, `hadir_kiosk_sessions` and `hadir_kiosk_attempts`, and adds `kiosk` to the existing punch-source enum. Existing users and punches are retained. The initial migration remains unchanged. All added indexes also fit the old 767-byte limit. Run `setup-windows.cmd` after updating the application files, using your existing `.env`.

Reference: [MySQL 5.5 manual](https://downloads.mysql.com/docs/refman-5.5-en.a4.pdf).

Webcam attendance adds `003-face.sql`: `hadir_employee_faces` stores encrypted templates and their model version; `hadir_face_challenges` stores hashes of one-use scan tokens bound to an employee and kiosk. It extends the source enum with `face`. Camera photos are not stored. The new VARCHAR indexes and TEXT template column work with MySQL 5.5.42; migrations 001 and 002 retain their original checksums. Run `setup-windows.cmd` after updating to generate/validate the private face key and apply this migration. Retain `.env` with secure database backups; it holds the key needed to read saved face templates.

## Shared workspace roles (0.6.0)

Run `npm run db:migrate` before starting this version. Migration 006 adds only `hadir_workspace_members`; existing accounts remain administrators of their existing workspaces. No attendance records are moved or deleted.

In the Admin sidebar, open **User access → Add login**. Choose Admin, HR or Staff. Staff must be linked to an employee in this workspace. Share the username and initial password privately. All users sign in at the same login page; staff are routed to /portal.

- Admin: workspace, attendance, schedules, employees, devices, kiosk and user access.
- HR: employees, schedules, attendance editing/imports and reports. No user access, device or kiosk administration.
- Staff: read only their linked employee's attendance and schedule. No workspace API access.
- Disabling a login or resetting its password revokes its sessions. Disabling an employee also blocks their staff portal.
- The original owner and the current administrator cannot have their access changed through this screen.
- Existing independent workspace accounts are not merged automatically. New shared logins use unique usernames.
- Passwords remain hashed. Admins can reset a member password by editing access; blank retains it.
