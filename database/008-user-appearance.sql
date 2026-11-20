CREATE TABLE IF NOT EXISTS hadir_user_appearance (
  user_id VARCHAR(36) NOT NULL PRIMARY KEY,
  settings TEXT NOT NULL,
  updated_at VARCHAR(24) NOT NULL,
  CONSTRAINT hadir_appearance_user_fk FOREIGN KEY (user_id) REFERENCES hadir_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
