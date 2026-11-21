CREATE TABLE IF NOT EXISTS hadir_leave_settings (
 owner_id VARCHAR(36) NOT NULL PRIMARY KEY,
 settings LONGTEXT NOT NULL,
 FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS hadir_leave_entitlements (
 id VARCHAR(100) NOT NULL PRIMARY KEY,
 owner_id VARCHAR(36) NOT NULL,
 employee_id VARCHAR(36) NOT NULL,
 year INT NOT NULL,
 type VARCHAR(20) NOT NULL,
 units INT NOT NULL,
 UNIQUE KEY hadir_leave_quota (owner_id, employee_id, year, type),
 FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id),
 FOREIGN KEY (employee_id) REFERENCES hadir_employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS hadir_leave_requests (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 owner_id VARCHAR(36) NOT NULL,
 employee_id VARCHAR(36) NOT NULL,
 year INT NOT NULL,
 type VARCHAR(20) NOT NULL,
 days TEXT NOT NULL,
 reason VARCHAR(1000) NOT NULL,
 status VARCHAR(30) NOT NULL,
 requested_by VARCHAR(36) NOT NULL,
 reviewed_by VARCHAR(36) NULL,
 review_note VARCHAR(1000) NOT NULL,
 created_at VARCHAR(24) NOT NULL,
 updated_at VARCHAR(24) NOT NULL,
 KEY hadir_leave_owner_year (owner_id, year),
 FOREIGN KEY (owner_id) REFERENCES hadir_workspaces(owner_id),
 FOREIGN KEY (employee_id) REFERENCES hadir_employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS hadir_leave_attachments (
 request_id VARCHAR(36) NOT NULL PRIMARY KEY,
 mime VARCHAR(40) NOT NULL,
 data LONGTEXT NOT NULL,
 FOREIGN KEY (request_id) REFERENCES hadir_leave_requests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
