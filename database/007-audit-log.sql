CREATE TABLE IF NOT EXISTS hadir_audit_logs (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 owner_id VARCHAR(36) NOT NULL,
 actor_id VARCHAR(36) NOT NULL,
 actor_name VARCHAR(120) NOT NULL,
 action VARCHAR(60) NOT NULL,
 target VARCHAR(120) NOT NULL,
 details TEXT NOT NULL,
 created_at VARCHAR(24) NOT NULL,
 KEY hadir_audit_owner_time_idx (owner_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
