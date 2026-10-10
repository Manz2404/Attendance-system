-- MySQL 8.0+ / InnoDB. The setup script applies this file and tracks its checksum.
-- Attendance tables use a hadir_ prefix so they can share an existing database.
CREATE TABLE IF NOT EXISTS hadir_users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at VARCHAR(24) NOT NULL,
  UNIQUE KEY hadir_users_username_uq (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hadir_sessions (
  token_hash VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  expires_at VARCHAR(24) NOT NULL,
  created_at VARCHAR(24) NOT NULL,
  KEY hadir_sessions_user_idx (user_id),
  KEY hadir_sessions_expiry_idx (expires_at),
  CONSTRAINT hadir_sessions_user_fk FOREIGN KEY (user_id) REFERENCES hadir_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hadir_login_attempts (
  attempt_key VARCHAR(64) NOT NULL PRIMARY KEY,
  failures INT NOT NULL,
  window_start VARCHAR(24) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hadir_workspaces (
  owner_id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(80) NOT NULL DEFAULT 'My workspace',
  created_at VARCHAR(24) NOT NULL,
  CONSTRAINT hadir_workspaces_user_fk FOREIGN KEY (owner_id) REFERENCES hadir_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hadir_schedules (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  break_minutes INT NOT NULL DEFAULT 60,
  grace_minutes INT NOT NULL DEFAULT 10,
  weekdays VARCHAR(13) NOT NULL DEFAULT '1,2,3,4,5',
  KEY hadir_schedules_owner_idx (owner_id),
  CONSTRAINT hadir_schedules_workspace_fk FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hadir_employees (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(120) NOT NULL,
  department VARCHAR(80) NOT NULL,
  schedule_id VARCHAR(80) NOT NULL,
  device_user_id VARCHAR(60) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  is_sample TINYINT(1) NOT NULL DEFAULT 0,
  start_date VARCHAR(10) NOT NULL,
  end_date VARCHAR(10) NULL,
  created_at VARCHAR(24) NOT NULL,
  UNIQUE KEY hadir_employees_code_uq (owner_id, code),
  KEY hadir_employees_owner_idx (owner_id),
  CONSTRAINT hadir_employees_workspace_fk FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id),
  CONSTRAINT hadir_employees_schedule_fk FOREIGN KEY (schedule_id) REFERENCES hadir_schedules(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hadir_devices (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  brand VARCHAR(60) NOT NULL,
  model VARCHAR(80) NOT NULL,
  serial_number VARCHAR(100) NULL,
  method VARCHAR(30) NOT NULL DEFAULT 'Not selected',
  created_at VARCHAR(24) NOT NULL,
  KEY hadir_devices_owner_idx (owner_id),
  CONSTRAINT hadir_devices_workspace_fk FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hadir_punches (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  timestamp VARCHAR(24) NOT NULL,
  kind ENUM('IN','OUT') NOT NULL,
  source ENUM('manual','csv','sample') NOT NULL,
  device_id VARCHAR(36) NULL,
  note VARCHAR(240) NOT NULL DEFAULT '',
  dedupe_key VARCHAR(150) NOT NULL,
  created_at VARCHAR(24) NOT NULL,
  UNIQUE KEY hadir_punches_dedupe_uq (owner_id, dedupe_key),
  KEY hadir_punches_owner_time_idx (owner_id, timestamp),
  CONSTRAINT hadir_punches_workspace_fk FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id),
  CONSTRAINT hadir_punches_employee_fk FOREIGN KEY (employee_id) REFERENCES hadir_employees(id),
  CONSTRAINT hadir_punches_device_fk FOREIGN KEY (device_id) REFERENCES hadir_devices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
