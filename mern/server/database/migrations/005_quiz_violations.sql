CREATE TABLE IF NOT EXISTS quiz_violations (
  id VARCHAR(40) PRIMARY KEY,
  quiz_id VARCHAR(40) NOT NULL,
  attempt_id VARCHAR(40) NULL,
  student_id VARCHAR(40) NOT NULL,
  violation_type VARCHAR(60) NOT NULL,
  details VARCHAR(255) DEFAULT '',
  ip VARCHAR(64) DEFAULT '',
  user_agent VARCHAR(255) DEFAULT '',
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_quiz (quiz_id),
  INDEX idx_attempt (attempt_id),
  INDEX idx_student (student_id),
  INDEX idx_time (occurred_at),
  CONSTRAINT fk_violation_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT fk_violation_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_violation_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
