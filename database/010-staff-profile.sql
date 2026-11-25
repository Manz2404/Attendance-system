CREATE TABLE IF NOT EXISTS hadir_staff_profiles (
 employee_id VARCHAR(36) NOT NULL PRIMARY KEY,
 owner_id VARCHAR(36) NOT NULL,
 personal TEXT NOT NULL,
 job TEXT NOT NULL,
 updated_at VARCHAR(24) NOT NULL,
 INDEX hadir_staff_profiles_owner_idx (owner_id),
 FOREIGN KEY (employee_id) REFERENCES hadir_employees(id) ON DELETE CASCADE,
 FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
