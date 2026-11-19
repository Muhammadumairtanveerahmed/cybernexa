-- Video lecture management: uploads/YouTube links, HLS assets, and student progress.

CREATE TABLE IF NOT EXISTS lectures (
  id VARCHAR(40) PRIMARY KEY,
  course_title VARCHAR(190) NOT NULL,
  teacher_id VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  lecture_type ENUM('upload', 'youtube') NOT NULL DEFAULT 'upload',
  source_path VARCHAR(255) DEFAULT '',
  youtube_url VARCHAR(500) DEFAULT '',
  hls_path VARCHAR(255) DEFAULT '',
  thumbnail_path VARCHAR(255) DEFAULT '',
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  processing_status ENUM('not_required', 'pending', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'not_required',
  processing_error VARCHAR(255) DEFAULT '',
  duration_seconds INT UNSIGNED NULL,
  file_size INT UNSIGNED NULL,
  mime_type VARCHAR(120) DEFAULT '',
  original_name VARCHAR(255) DEFAULT '',
  qualities_json TEXT NULL,
  created_by VARCHAR(40) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at DATETIME NULL,
  INDEX idx_lecture_course (course_title),
  INDEX idx_lecture_teacher (teacher_id),
  INDEX idx_lecture_status (status, processing_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lecture_progress (
  id VARCHAR(40) PRIMARY KEY,
  lecture_id VARCHAR(40) NOT NULL,
  student_id VARCHAR(40) NOT NULL,
  position_seconds DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration_seconds DECIMAL(10,2) NOT NULL DEFAULT 0,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_lecture_student (lecture_id, student_id),
  INDEX idx_progress_student (student_id),
  CONSTRAINT fk_progress_lecture FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
