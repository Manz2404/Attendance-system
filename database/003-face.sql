CREATE TABLE IF NOT EXISTS hadir_employee_faces (
  employee_id VARCHAR(36) NOT NULL PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  template TEXT NOT NULL,
  model VARCHAR(60) NOT NULL,
  updated_at VARCHAR(24) NOT NULL,
  KEY hadir_employee_faces_owner_idx (owner_id),
  CONSTRAINT hadir_employee_faces_employee_fk FOREIGN KEY (employee_id) REFERENCES hadir_employees(id) ON DELETE CASCADE,
  CONSTRAINT hadir_employee_faces_workspace_fk FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hadir_face_challenges (
  token_hash VARCHAR(64) NOT NULL PRIMARY KEY,
  kiosk_token_hash VARCHAR(64) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  employee_id VARCHAR(36) NOT NULL,
  expires_at VARCHAR(24) NOT NULL,
  KEY hadir_face_challenges_kiosk_idx (kiosk_token_hash),
  KEY hadir_face_challenges_expiry_idx (expires_at),
  CONSTRAINT hadir_face_challenges_kiosk_fk FOREIGN KEY (kiosk_token_hash) REFERENCES hadir_kiosk_sessions(token_hash) ON DELETE CASCADE,
  CONSTRAINT hadir_face_challenges_employee_fk FOREIGN KEY (employee_id) REFERENCES hadir_employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

ALTER TABLE hadir_punches MODIFY COLUMN source ENUM('manual','csv','sample','kiosk','face') NOT NULL;
