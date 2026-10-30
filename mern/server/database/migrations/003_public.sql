CREATE TABLE IF NOT EXISTS contact_messages (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) DEFAULT '',
  message TEXT NOT NULL,
  ip VARCHAR(64) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscribers (
  id VARCHAR(40) PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(40) PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT '',
  tag VARCHAR(60) DEFAULT '',
  short_desc VARCHAR(400) DEFAULT '',
  description TEXT,
  meta VARCHAR(200) DEFAULT '',
  price VARCHAR(40) DEFAULT '',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO lk_notice_audience (value, label, sort_order) VALUES
  ('all', 'Everyone', 1), ('students', 'Students', 2), ('teachers', 'Teachers', 3);

INSERT IGNORE INTO lk_enrollment_status (value, label, sort_order) VALUES
  ('pending', 'Pending', 1), ('approved', 'Approved', 2), ('rejected', 'Rejected', 3), ('completed', 'Completed', 4);

INSERT IGNORE INTO lk_user_role (value, label, sort_order) VALUES
  ('student', 'Student', 1), ('teacher', 'Teacher', 2), ('admin', 'Admin', 3);

INSERT IGNORE INTO lk_weekday (value, label, sort_order) VALUES
  ('1', 'Monday', 1), ('2', 'Tuesday', 2), ('3', 'Wednesday', 3), ('4', 'Thursday', 4), ('5', 'Friday', 5), ('6', 'Saturday', 6);

INSERT IGNORE INTO lk_doc_kind (value, label, sort_order) VALUES
  ('cnic', 'CNIC', 1), ('photo', 'Photo', 2), ('payment', 'Payment receipt', 3),
  ('qualification', 'Qualification', 4), ('cv', 'CV', 5), ('other', 'Other', 6);

INSERT IGNORE INTO lk_quiz_option (value, label, sort_order) VALUES
  ('a', 'Option A', 1), ('b', 'Option B', 2), ('c', 'Option C', 3), ('d', 'Option D', 4);
