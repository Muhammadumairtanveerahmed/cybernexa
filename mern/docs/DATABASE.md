# Database Design — MySQL 8

Database name: `technexa`
Character set: `utf8mb4` / `utf8mb4_unicode_ci`
Engine: InnoDB

All primary keys are strings such as `usr_...`, `qz_...`, `qa_...` so records can be generated on the server and remain portable.

## 1. Table groups

### Accounts

| Table | Key columns | Purpose |
|---|---|---|
| `users` | `id`, `full_name`, `email`, `phone`, `password_hash`, `role`, `status`, `created_at` | All accounts (student, teacher, admin) |
| `student_profiles` | `user_id`, `dob`, `address`, `city`, `education`, `guardian_name`, `guardian_phone` | Student details |
| `teacher_profiles` | `user_id`, `qualification`, `experience`, `specialization`, `cv_file`, `expected_fee`, `availability`, `applied_at`, `reviewed_at`, `rejection_reason` | Teacher application |
| `sessions` | `id`, `user_id`, `created_at`, `expires_at`, `ip`, `user_agent` | Server-side sessions (if used) |
| `password_resets` | `id`, `token`, `user_id`, `requested_at`, `expires_at`, `used` | Password reset tokens |
| `login_logs` | `id`, `user_id`, `email`, `role`, `full_name`, `status`, `ip`, `user_agent`, `created_at` | Authentication audit trail |

### Courses and enrollment

| Table | Key columns | Purpose |
|---|---|---|
| `courses` | `id`, `title`, `category`, `price`, `duration`, `description`, `active` | Course catalogue |
| `teacher_courses` | `id`, `teacher_id`, `course_title`, `created_at` | Teacher-to-course assignment |
| `enrollments` | `id`, `user_id`, `course_id`, `course_title`, `price`, `enrollment_type`, `status`, `payment_status`, `amount_total`, `notes`, `email` | Student enrollment and fee status |
| `payments` | `id`, `enrollment_id`, `amount`, `method`, `note`, `paid_at` | Individual payments |

### Academics

| Table | Key columns | Purpose |
|---|---|---|
| `assignments` | `id`, `course_title`, `teacher_id`, `title`, `description`, `due_date`, `max_marks`, `doc_id` | Assignment definitions |
| `submissions` | `id`, `assignment_id`, `student_id`, `doc_id`, `note`, `submitted_at`, `status`, `marks`, `feedback`, `graded_at`, `graded_by` | Student submissions and grades |

### Campus

| Table | Key columns | Purpose |
|---|---|---|
| `attendance_sessions` | `id`, `course_title`, `teacher_id`, `session_date`, `topic` | One class meeting |
| `attendance` | `id`, `session_id`, `student_id`, `status` | Present, absent, late or excused |
| `timetable` | `id`, `course_title`, `teacher_id`, `day_of_week`, `start_time`, `end_time`, `room` | Weekly schedule |
| `materials` | `id`, `course_title`, `teacher_id`, `title`, `description`, `doc_id`, `external_url` | Lecture notes and links |
| `announcements` | `id`, `course_title`, `teacher_id`, `title`, `body`, `pinned` | Course announcements |

### Quizzes

| Table | Key columns | Purpose |
|---|---|---|
| `quizzes` | `id`, `course_title`, `teacher_id`, `title`, `description`, `duration_minutes`, `pass_percent`, `audience`, `status` | Quiz definition |
| `quiz_questions` | `id`, `quiz_id`, `q_no`, `question`, `option_a`…`option_d`, `correct`, `marks` | Questions in a quiz |
| `question_bank` | `id`, `teacher_id`, `course_title`, `question`, `option_a`…`option_d`, `correct`, `marks` | Reusable questions |
| `quiz_attempts` | `id`, `quiz_id`, `student_id`, `started_at`, `submitted_at`, `score`, `total`, `status` | One attempt per student per quiz |
| `quiz_answers` | `id`, `attempt_id`, `question_id`, `choice`, `correct`, `marks` | Per-question answers |
| `quiz_violations` | `id`, `quiz_id`, `attempt_id`, `student_id`, `violation_type`, `details`, `ip`, `user_agent`, `occurred_at` | Screen-off, tab-switch, focus-loss and copy events recorded during a quiz |

### Files

| Table | Key columns | Purpose |
|---|---|---|
| `documents` | `id`, `scope`, `ref_id`, `user_id`, `kind`, `label`, `originalname`, `relpath`, `size`, `uploaded_by`, `uploaded_at` | Uploaded files and metadata |

### Communication

| Table | Key columns | Purpose |
|---|---|---|
| `chat_messages` | `id`, `sender_id`, `recipient_id`, `body`, `created_at`, `delivered_at`, `read_at`, `edited_at`, `deleted_at` | Chat messages |
| `chat_attachments` | `id`, `message_id`, `sender_id`, `original_name`, `stored_name`, `mime_type`, `file_size` | Chat files |
| `chat_hidden` | `message_id`, `user_id`, `created_at` | Per-user hidden conversations |
| `call_logs` | `id`, `call_key`, `caller_id`, `callee_id`, `kind`, `status`, `started_at`, `answered_at`, `ended_at` | Call metadata |

### Notices

| Table | Key columns | Purpose |
|---|---|---|
| `notices` | `id`, `audience`, `target_user`, `title`, `body`, `created_at` | Targeted notices |

### Lookup tables

| Table | Values |
|---|---|
| `lk_user_role` | student, teacher, admin |
| `lk_enrollment_status` | pending, approved, rejected, completed |
| `lk_notice_audience` | all, students, teachers |
| `lk_weekday` | 1–6 (Monday–Saturday) |
| `lk_doc_kind` | receipt, certificate |
| `lk_quiz_option` | A, B, C, D |

## 2. Relationships

```text
users 1 ─── * enrollments * ─── 1 courses
users 1 ─── * teacher_courses * ─── 1 courses
users 1 ─── * assignments (teacher)
assignments 1 ─── * submissions * ─── 1 users (student)
courses 1 ─── * attendance_sessions 1 ─── * attendance
quizzes 1 ─── * quiz_questions
quizzes 1 ─── * quiz_attempts * ─── 1 users (student)
quiz_attempts 1 ─── * quiz_answers * ─── 1 quiz_questions
quiz_attempts 1 ─── * quiz_violations * ─── 1 users (student)
users 1 ─── * chat_messages * ─── 1 users
chat_messages 1 ─── * chat_attachments
users 1 ─── * call_logs (caller) * ─── 1 users (callee)
```

## 3. Indexes and constraints

- `enrollments`: index on `user_id`, `status`.
- `submissions`: unique `(assignment_id, student_id)`.
- `attendance`: unique `(session_id, student_id)`.
- `quiz_attempts`: unique `(quiz_id, student_id)`.
- `quiz_violations`: index on `quiz_id`, `attempt_id`, `student_id` and `occurred_at`.
- `call_logs`: unique `call_key`.
- `chat_messages`: index on `(sender_id, recipient_id, created_at)` and `(recipient_id, read_at)`.
- `documents`: index on `(scope, ref_id)` and `user_id`.
- `login_logs`: index on `created_at`, `email`, `status`.

## 4. Migrations

Use numbered SQL files:

```text
server/database/migrations/
├── 001_create_users.sql
├── 002_create_profiles.sql
├── 003_create_courses.sql
├── 004_create_enrollments.sql
├── 005_create_academics.sql
├── 006_create_campus.sql
├── 007_create_quizzes.sql
├── 008_create_chat_calls.sql
└── 009_create_lookups.sql
```

A small migration runner can read the files in order, track applied filenames in a `schema_migrations` table, and execute only new ones.

## 5. Seeds

```text
server/database/seeds/
├── 001_lookups.sql      # roles, statuses, weekdays, options
├── 002_admin.sql        # initial administrator
└── 003_demo_data.sql    # sample courses and users (development only)
```

Never seed production with demo accounts.

## 6. Example table

```sql
CREATE TABLE quizzes (
  id VARCHAR(40) PRIMARY KEY,
  course_title VARCHAR(190) NOT NULL,
  teacher_id VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description VARCHAR(400) DEFAULT '',
  duration_minutes INT NOT NULL DEFAULT 15,
  pass_percent INT NOT NULL DEFAULT 50,
  audience ENUM('all','course') NOT NULL DEFAULT 'all',
  status ENUM('draft','published','closed') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_course (course_title),
  INDEX idx_teacher (teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
