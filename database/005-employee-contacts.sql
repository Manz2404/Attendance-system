CREATE TABLE IF NOT EXISTS hadir_employee_contacts (
 employee_id VARCHAR(36) NOT NULL PRIMARY KEY,
 owner_id VARCHAR(36) NOT NULL,
 phone VARCHAR(15) NOT NULL,
 KEY hadir_employee_contacts_owner_idx (owner_id),
 CONSTRAINT hadir_contacts_employee_fk FOREIGN KEY (employee_id) REFERENCES hadir_employees(id) ON DELETE CASCADE,
 CONSTRAINT hadir_contacts_workspace_fk FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
