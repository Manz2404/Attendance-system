-- Additive upgrade for MySQL 5.5.42+; safe to resume after interrupted setup.
CREATE TABLE IF NOT EXISTS hadir_employee_pins (
  employee_id VARCHAR(36) NOT NULL PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  updated_at VARCHAR(24) NOT NULL,
  KEY hadir_employee_pins_owner_idx (owner_id),
  CONSTRAINT hadir_employee_pins_employee_fk FOREIGN KEY (employee_id) REFERENCES hadir_employees(id) ON DELETE CASCADE,
  CONSTRAINT hadir_employee_pins_workspace_fk FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hadir_kiosk_sessions (
  token_hash VARCHAR(64) NOT NULL PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  expires_at VARCHAR(24) NOT NULL,
  created_at VARCHAR(24) NOT NULL,
  KEY hadir_kiosk_sessions_owner_idx (owner_id),
  KEY hadir_kiosk_sessions_expiry_idx (expires_at),
  CONSTRAINT hadir_kiosk_sessions_workspace_fk FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hadir_kiosk_attempts (
  attempt_key VARCHAR(64) NOT NULL PRIMARY KEY,
  failures INT NOT NULL,
  window_start VARCHAR(24) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

ALTER TABLE hadir_punches MODIFY COLUMN source ENUM('manual','csv','sample','kiosk') NOT NULL;
