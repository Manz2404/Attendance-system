CREATE TABLE IF NOT EXISTS hadir_workspace_members (
 user_id VARCHAR(36) NOT NULL PRIMARY KEY,
 owner_id VARCHAR(36) NOT NULL,
 employee_id VARCHAR(36) NULL,
 role ENUM('admin','hr','staff') NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at VARCHAR(24) NOT NULL,
 UNIQUE KEY hadir_members_employee_uq (employee_id),
 KEY hadir_members_owner_idx (owner_id),
 CONSTRAINT hadir_members_user_fk FOREIGN KEY (user_id) REFERENCES hadir_users(id) ON DELETE CASCADE,
 CONSTRAINT hadir_members_owner_fk FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id),
 CONSTRAINT hadir_members_employee_fk FOREIGN KEY (employee_id) REFERENCES hadir_employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
