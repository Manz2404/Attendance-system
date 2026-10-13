# Database compatibility

The application is tested against MySQL **5.5.42** and **8.4** using the same initial schema and controller tests. Setup checks that InnoDB and `utf8mb4_bin` are available before creating tables.

`001-initial.sql` is unchanged from the first release, including its original MySQL 8.0 comment, because installations track the file's checksum. Its DDL uses InnoDB, VARCHAR, INT, TINYINT and ENUM; it does not need MySQL 8 JSON columns, window functions or generated columns. All indexes fit the older InnoDB 767-byte key limit. The largest composite key is `owner_id` plus `dedupe_key`: `(36 + 150) × 4 = 744` bytes with utf8mb4.

Dates and instants remain normalized text values so the same schema and timezone calculations work on both versions. Application writes use ordinary transactions, prepared statements, `ON DUPLICATE KEY UPDATE` and `SELECT … FOR UPDATE`.

The PIN kiosk uses a separate `002-kiosk.sql` upgrade. It adds `hadir_employee_pins`, `hadir_kiosk_sessions` and `hadir_kiosk_attempts`, and adds `kiosk` to the existing punch-source enum. Existing users and punches are retained. The initial migration remains unchanged. All added indexes also fit the old 767-byte limit. Run `setup-windows.cmd` after updating the application files, using your existing `.env`.

Reference: [MySQL 5.5 manual](https://downloads.mysql.com/docs/refman-5.5-en.a4.pdf).
