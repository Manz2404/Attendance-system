CREATE TABLE IF NOT EXISTS hadir_employee_photos (
  employee_id VARCHAR(36) NOT NULL PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL,
  photo TEXT NOT NULL,
  KEY hadir_employee_photos_owner_idx (owner_id),
  CONSTRAINT hadir_employee_photos_employee_fk FOREIGN KEY (employee_id) REFERENCES hadir_employees(id) ON DELETE CASCADE,
  CONSTRAINT hadir_employee_photos_workspace_fk FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
