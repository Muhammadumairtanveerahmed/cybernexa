CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(40) PRIMARY KEY,
  role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) DEFAULT '',
  status ENUM('pending', 'active', 'suspended', 'rejected') NOT NULL DEFAULT 'active',
  photo VARCHAR(255) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login DATETIME NULL,
  INDEX idx_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
