CREATE TABLE IF NOT EXISTS student_profiles (
  user_id VARCHAR(40) PRIMARY KEY,
  dob VARCHAR(20) DEFAULT '',
  gender VARCHAR(20) DEFAULT '',
  cnic VARCHAR(20) DEFAULT '',
  address VARCHAR(240) DEFAULT '',
  city VARCHAR(80) DEFAULT '',
  guardian_name VARCHAR(120) DEFAULT '',
  guardian_phone VARCHAR(30) DEFAULT '',
  last_qualification VARCHAR(160) DEFAULT '',
  interests VARCHAR(240) DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teacher_profiles (
  user_id VARCHAR(40) PRIMARY KEY,
  qualification VARCHAR(200) DEFAULT '',
  expertise VARCHAR(240) DEFAULT '',
  experience_years INT NOT NULL DEFAULT 0,
  bio TEXT,
  portfolio_url VARCHAR(240) DEFAULT '',
  cv_file VARCHAR(255) DEFAULT '',
  expected_fee VARCHAR(60) DEFAULT '',
  availability VARCHAR(120) DEFAULT '',
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  rejection_reason VARCHAR(240) DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_teacher_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollments (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(40) NULL,
  course_id VARCHAR(40) DEFAULT '',
  course_title VARCHAR(190) NOT NULL,
  price VARCHAR(40) DEFAULT '',
  enrollment_type VARCHAR(20) DEFAULT 'Online',
  status ENUM('pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending',
  payment_status ENUM('unpaid', 'partial', 'paid') NOT NULL DEFAULT 'unpaid',
  amount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes VARCHAR(240) DEFAULT '',
  email VARCHAR(190) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  CONSTRAINT fk_enrollment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(40) PRIMARY KEY,
  scope VARCHAR(20) NOT NULL,
  ref_id VARCHAR(40) DEFAULT '',
  user_id VARCHAR(40) DEFAULT '',
  kind VARCHAR(40) DEFAULT 'other',
  label VARCHAR(80) DEFAULT '',
  originalname VARCHAR(200) DEFAULT '',
  relpath VARCHAR(255) NOT NULL,
  size INT NOT NULL DEFAULT 0,
  uploaded_by VARCHAR(20) DEFAULT 'public',
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_scope (scope, ref_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(40) PRIMARY KEY,
  enrollment_id VARCHAR(40) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  method VARCHAR(40) DEFAULT '',
  note VARCHAR(200) DEFAULT '',
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_enrollment (enrollment_id),
  CONSTRAINT fk_payment_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(80) PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  ip VARCHAR(45) DEFAULT '',
  user_agent VARCHAR(255) DEFAULT '',
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id VARCHAR(40) PRIMARY KEY,
  token VARCHAR(80) NOT NULL UNIQUE,
  user_id VARCHAR(40) NOT NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notices (
  id VARCHAR(40) PRIMARY KEY,
  audience VARCHAR(20) NOT NULL DEFAULT 'all',
  target_user VARCHAR(40) DEFAULT '',
  title VARCHAR(160) NOT NULL,
  body TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audience (audience)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teacher_courses (
  id VARCHAR(40) PRIMARY KEY,
  teacher_id VARCHAR(40) NOT NULL,
  course_title VARCHAR(190) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_teacher (teacher_id),
  CONSTRAINT fk_teacher_course_user FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assignments (
  id VARCHAR(40) PRIMARY KEY,
  course_title VARCHAR(190) NOT NULL,
  teacher_id VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATETIME NULL,
  max_marks INT NOT NULL DEFAULT 100,
  doc_id VARCHAR(40) DEFAULT '',
  status ENUM('draft', 'published', 'closed') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_course (course_title),
  INDEX idx_teacher (teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submissions (
  id VARCHAR(40) PRIMARY KEY,
  assignment_id VARCHAR(40) NOT NULL,
  student_id VARCHAR(40) NOT NULL,
  doc_id VARCHAR(40) DEFAULT '',
  note TEXT,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('submitted', 'graded') NOT NULL DEFAULT 'submitted',
  marks DECIMAL(6,2) NULL,
  feedback TEXT,
  graded_at DATETIME NULL,
  graded_by VARCHAR(40) DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sub (assignment_id, student_id),
  INDEX idx_student (student_id),
  INDEX idx_assignment (assignment_id),
  CONSTRAINT fk_submission_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id VARCHAR(40) PRIMARY KEY,
  course_title VARCHAR(190) NOT NULL,
  teacher_id VARCHAR(40) NOT NULL,
  session_date DATE NOT NULL,
  topic VARCHAR(200) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_course (course_title),
  INDEX idx_teacher (teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id VARCHAR(40) PRIMARY KEY,
  session_id VARCHAR(40) NOT NULL,
  student_id VARCHAR(40) NOT NULL,
  status ENUM('present', 'absent', 'late', 'excused') NOT NULL DEFAULT 'present',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_att (session_id, student_id),
  INDEX idx_student (student_id),
  CONSTRAINT fk_attendance_session FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS timetable (
  id VARCHAR(40) PRIMARY KEY,
  course_title VARCHAR(190) NOT NULL,
  teacher_id VARCHAR(40) DEFAULT '',
  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(60) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_course (course_title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS materials (
  id VARCHAR(40) PRIMARY KEY,
  course_title VARCHAR(190) NOT NULL,
  teacher_id VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  doc_id VARCHAR(40) DEFAULT '',
  external_url VARCHAR(500) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_course (course_title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
  id VARCHAR(40) PRIMARY KEY,
  course_title VARCHAR(190) NOT NULL,
  teacher_id VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_course (course_title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quizzes (
  id VARCHAR(40) PRIMARY KEY,
  course_title VARCHAR(190) NOT NULL,
  teacher_id VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description VARCHAR(400) DEFAULT '',
  duration_minutes INT NOT NULL DEFAULT 15,
  pass_percent INT NOT NULL DEFAULT 50,
  audience ENUM('all', 'course') NOT NULL DEFAULT 'all',
  status ENUM('draft', 'published', 'closed') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_course (course_title),
  INDEX idx_teacher (teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_questions (
  id VARCHAR(40) PRIMARY KEY,
  quiz_id VARCHAR(40) NOT NULL,
  q_no INT NOT NULL DEFAULT 1,
  question TEXT NOT NULL,
  option_a VARCHAR(400) NOT NULL,
  option_b VARCHAR(400) NOT NULL,
  option_c VARCHAR(400) DEFAULT '',
  option_d VARCHAR(400) DEFAULT '',
  correct CHAR(1) NOT NULL,
  marks DECIMAL(6,2) NOT NULL DEFAULT 1,
  INDEX idx_quiz (quiz_id),
  CONSTRAINT fk_question_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS question_bank (
  id VARCHAR(40) PRIMARY KEY,
  teacher_id VARCHAR(40) NOT NULL,
  course_title VARCHAR(190) NOT NULL,
  question TEXT NOT NULL,
  option_a VARCHAR(400) NOT NULL,
  option_b VARCHAR(400) NOT NULL,
  option_c VARCHAR(400) DEFAULT '',
  option_d VARCHAR(400) DEFAULT '',
  correct CHAR(1) NOT NULL,
  marks DECIMAL(6,2) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_teacher (teacher_id),
  INDEX idx_course (course_title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id VARCHAR(40) PRIMARY KEY,
  quiz_id VARCHAR(40) NOT NULL,
  student_id VARCHAR(40) NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME NULL,
  score DECIMAL(8,2) DEFAULT NULL,
  total DECIMAL(8,2) DEFAULT NULL,
  status ENUM('in_progress', 'submitted') NOT NULL DEFAULT 'in_progress',
  UNIQUE KEY uniq_attempt (quiz_id, student_id),
  INDEX idx_student (student_id),
  CONSTRAINT fk_attempt_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_answers (
  id VARCHAR(40) PRIMARY KEY,
  attempt_id VARCHAR(40) NOT NULL,
  question_id VARCHAR(40) NOT NULL,
  choice CHAR(1) DEFAULT '',
  correct TINYINT(1) NOT NULL DEFAULT 0,
  marks DECIMAL(6,2) NOT NULL DEFAULT 0,
  INDEX idx_attempt (attempt_id),
  CONSTRAINT fk_answer_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(40) NULL,
  email VARCHAR(190) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT '',
  full_name VARCHAR(120) NOT NULL DEFAULT '',
  status ENUM('success', 'failed', 'suspended', 'blocked') NOT NULL DEFAULT 'success',
  ip VARCHAR(64) DEFAULT '',
  user_agent VARCHAR(255) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_email (email),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(40) PRIMARY KEY,
  sender_id VARCHAR(40) NOT NULL,
  recipient_id VARCHAR(40) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  edited_at DATETIME NULL,
  deleted_at DATETIME NULL,
  INDEX idx_chat_pair (sender_id, recipient_id, created_at),
  INDEX idx_chat_inbox (recipient_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_hidden (
  message_id VARCHAR(40) NOT NULL,
  user_id VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id),
  INDEX idx_hidden_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_attachments (
  id VARCHAR(40) PRIMARY KEY,
  message_id VARCHAR(40) NOT NULL,
  sender_id VARCHAR(40) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(128) NULL,
  file_size INT UNSIGNED DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ca_msg (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS call_logs (
  id VARCHAR(40) PRIMARY KEY,
  call_key VARCHAR(40) NOT NULL,
  caller_id VARCHAR(40) NOT NULL,
  callee_id VARCHAR(40) NOT NULL,
  kind ENUM('audio', 'video') NOT NULL DEFAULT 'audio',
  status ENUM('missed', 'answered', 'rejected', 'ended') NOT NULL DEFAULT 'missed',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at DATETIME NULL,
  ended_at DATETIME NULL,
  UNIQUE INDEX uq_call_key (call_key),
  INDEX idx_call_pair (caller_id, callee_id, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lk_notice_audience (
  id INT AUTO_INCREMENT PRIMARY KEY,
  value VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lk_enrollment_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  value VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lk_user_role (
  id INT AUTO_INCREMENT PRIMARY KEY,
  value VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lk_weekday (
  id INT AUTO_INCREMENT PRIMARY KEY,
  value VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lk_doc_kind (
  id INT AUTO_INCREMENT PRIMARY KEY,
  value VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lk_quiz_option (
  id INT AUTO_INCREMENT PRIMARY KEY,
  value VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
