-- TechNexa demo data
-- Passwords:
--   admin@technexa.pk      Admin@12345
--   teacher@technexa.pk    Teacher@12345
--   student@technexa.pk    Student@12345

INSERT IGNORE INTO users
  (id, role, email, password_hash, full_name, phone, status, photo, last_login)
VALUES
  ('usr_admin', 'admin', 'admin@technexa.pk',
   '$2a$10$zj/yXuI3ck8BaptbUFo4H.xrTqYCnbyZ3vyoTUebI1w2Ap17Sk2Ae',
   'TechNexa Administrator', '+923237469306', 'active', '', NOW()),
  ('usr_teacher1', 'teacher', 'teacher@technexa.pk',
   '$2a$10$ma7GAqLUpTO1CAFQ9olYoukbgbDPJdnycUgHEeRG3jQXGFxa673a2',
   'Hamza Khan', '+923001234567', 'active', '', NOW()),
  ('usr_teacher2', 'teacher', 'pending.teacher@technexa.pk',
   '$2a$10$ma7GAqLUpTO1CAFQ9olYoukbgbDPJdnycUgHEeRG3jQXGFxa673a2',
   'Sana Malik', '+923111234567', 'pending', '', NULL),
  ('usr_student1', 'student', 'student@technexa.pk',
   '$2a$10$J6KaeEBD6RIqxu97SE2oGeddbSFMxJgnwKttoe3Vq9r8ATfVSyGFy',
   'Ali Raza', '+923221234567', 'active', '', NOW()),
  ('usr_student2', 'student', 'ayesha@technexa.pk',
   '$2a$10$J6KaeEBD6RIqxu97SE2oGeddbSFMxJgnwKttoe3Vq9r8ATfVSyGFy',
   'Ayesha Siddiqui', '+923331234567', 'active', '', NOW());

INSERT IGNORE INTO student_profiles
  (user_id, dob, gender, cnic, address, city, guardian_name, guardian_phone, last_qualification, interests)
VALUES
  ('usr_student1', '2001-04-12', 'Male', '35202-1234567-1',
   'Model Town', 'Lahore', 'Muhammad Raza', '+923001112233',
   'Intermediate (ICS)', 'Cybersecurity, Networking, Linux'),
  ('usr_student2', '2000-09-23', 'Female', '42101-7654321-8',
   'Clifton Block 5', 'Karachi', 'Shahid Siddiqui', '+923004445566',
   'BS Computer Science', 'Programming, Cloud, Design');

INSERT IGNORE INTO teacher_profiles
  (user_id, qualification, expertise, experience_years, bio, portfolio_url, cv_file,
   expected_fee, availability, applied_at, reviewed_at)
VALUES
  ('usr_teacher1', 'MS Information Security', 'Cybersecurity, Networking, Python', 8,
   'Industry trainer with eight years of experience delivering hands-on cybersecurity and networking programmes.',
   'https://github.com/hamzakhan', '', 'PKR 60,000 / month', 'Weekdays evening', NOW(), NOW()),
  ('usr_teacher2', 'MSc Software Engineering', 'Front-end Development, UI/UX', 4,
   'Front-end engineer and design mentor. Application currently waiting for admin review.',
   'https://sana.dev', '', 'PKR 45,000 / month', 'Weekends', NOW(), NULL);

INSERT IGNORE INTO teacher_courses (id, teacher_id, course_title) VALUES
  ('tc_1', 'usr_teacher1', 'Certified Ethical Hacker (CEH)'),
  ('tc_2', 'usr_teacher1', 'Cisco CCNA'),
  ('tc_3', 'usr_teacher1', 'Python Programming'),
  ('tc_4', 'usr_teacher1', 'Front-End Web Development');

INSERT IGNORE INTO enrollments
  (id, user_id, course_id, course_title, price, enrollment_type, status, payment_status,
   amount_total, notes, email, created_at)
VALUES
  ('enr_1', 'usr_student1', 'c_01', 'Certified Ethical Hacker (CEH)', 'PKR 20,000',
   'Online', 'approved', 'paid', 20000.00, 'Weekend batch preferred.', 'student@technexa.pk',
   DATE_SUB(NOW(), INTERVAL 21 DAY)),
  ('enr_2', 'usr_student1', 'c_05', 'Cisco CCNA', 'PKR 20,000',
   'On-campus', 'pending', 'unpaid', 20000.00, 'Awaiting approval.', 'student@technexa.pk',
   DATE_SUB(NOW(), INTERVAL 3 DAY)),
  ('enr_3', 'usr_student1', 'c_39', 'Python Programming', 'PKR 20,000',
   'Online', 'approved', 'partial', 20000.00, 'Paid first instalment.', 'student@technexa.pk',
   DATE_SUB(NOW(), INTERVAL 14 DAY)),
  ('enr_4', 'usr_student2', 'c_37', 'Front-End Web Development', 'PKR 20,000',
   'Online', 'approved', 'paid', 20000.00, 'Portfolio track.', 'ayesha@technexa.pk',
   DATE_SUB(NOW(), INTERVAL 10 DAY));

INSERT IGNORE INTO payments (id, enrollment_id, amount, method, note, paid_at) VALUES
  ('pay_1', 'enr_1', 20000.00, 'Bank transfer', 'Full course fee', DATE_SUB(NOW(), INTERVAL 20 DAY)),
  ('pay_2', 'enr_3', 10000.00, 'JazzCash', 'First instalment', DATE_SUB(NOW(), INTERVAL 12 DAY)),
  ('pay_3', 'enr_4', 20000.00, 'Card', 'Full course fee', DATE_SUB(NOW(), INTERVAL 9 DAY));

INSERT IGNORE INTO notices (id, audience, target_user, title, body, created_at) VALUES
  ('ntc_1', 'all', '', 'Welcome to the TechNexa portal',
   'Your classes, assignments, attendance and results are now available in one place.', DATE_SUB(NOW(), INTERVAL 25 DAY)),
  ('ntc_2', 'students', '', 'Assignment submission guideline',
   'Upload PDF or DOCX files only. File size must stay below 20 MB.', DATE_SUB(NOW(), INTERVAL 7 DAY)),
  ('ntc_3', 'teachers', '', 'Weekly progress reports',
   'Please publish quiz results and attendance before Friday evening.', DATE_SUB(NOW(), INTERVAL 5 DAY));

INSERT IGNORE INTO assignments
  (id, course_title, teacher_id, title, description, due_date, max_marks, doc_id, status, created_at)
VALUES
  ('asg_1', 'Certified Ethical Hacker (CEH)', 'usr_teacher1',
   'Reconnaissance lab report',
   'Document passive and active reconnaissance steps for the assigned target. Include tool output and a short mitigation note.',
   DATE_ADD(NOW(), INTERVAL 7 DAY), 100, '', 'published', DATE_SUB(NOW(), INTERVAL 4 DAY)),
  ('asg_2', 'Cisco CCNA', 'usr_teacher1',
   'Packet Tracer: VLAN configuration',
   'Build a two-switch topology with three VLANs, trunk links and inter-VLAN routing. Submit the .pkt file with a one-page explanation.',
   DATE_ADD(NOW(), INTERVAL 12 DAY), 50, '', 'published', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  ('asg_3', 'Python Programming', 'usr_teacher1',
   'Build a CLI expense tracker',
   'Create a Python CLI app that stores expenses in a CSV file. Include add, list and monthly total commands.',
   DATE_SUB(NOW(), INTERVAL 2 DAY), 100, '', 'published', DATE_SUB(NOW(), INTERVAL 10 DAY));

INSERT IGNORE INTO submissions
  (id, assignment_id, student_id, doc_id, note, submitted_at, status, marks, feedback, graded_at, graded_by)
VALUES
  ('sub_1', 'asg_1', 'usr_student1', '', 'Lab report attached in the portal.',
   DATE_SUB(NOW(), INTERVAL 1 DAY), 'submitted', NULL, NULL, NULL, ''),
  ('sub_2', 'asg_3', 'usr_student1', '', 'Expense tracker with CSV storage and monthly summary.',
   DATE_SUB(NOW(), INTERVAL 4 DAY), 'graded', 88.00,
   'Clean structure and good validation. Add unit tests next time.', DATE_SUB(NOW(), INTERVAL 3 DAY), 'usr_teacher1');

INSERT IGNORE INTO attendance_sessions (id, course_title, teacher_id, session_date, topic) VALUES
  ('ats_1', 'Certified Ethical Hacker (CEH)', 'usr_teacher1', DATE_SUB(CURDATE(), INTERVAL 14 DAY), 'Footprinting and reconnaissance'),
  ('ats_2', 'Certified Ethical Hacker (CEH)', 'usr_teacher1', DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'Scanning networks'),
  ('ats_3', 'Certified Ethical Hacker (CEH)', 'usr_teacher1', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Enumeration and system hacking'),
  ('ats_4', 'Python Programming', 'usr_teacher1', DATE_SUB(CURDATE(), INTERVAL 6 DAY), 'Functions and modules');

INSERT IGNORE INTO attendance (id, session_id, student_id, status) VALUES
  ('att_1', 'ats_1', 'usr_student1', 'present'),
  ('att_2', 'ats_2', 'usr_student1', 'present'),
  ('att_3', 'ats_3', 'usr_student1', 'late'),
  ('att_4', 'ats_4', 'usr_student1', 'absent');

INSERT IGNORE INTO timetable (id, course_title, teacher_id, day_of_week, start_time, end_time, room) VALUES
  ('tt_1', 'Certified Ethical Hacker (CEH)', 'usr_teacher1', 1, '18:00:00', '20:00:00', 'Lab A'),
  ('tt_2', 'Certified Ethical Hacker (CEH)', 'usr_teacher1', 3, '18:00:00', '20:00:00', 'Lab A'),
  ('tt_3', 'Cisco CCNA', 'usr_teacher1', 2, '17:00:00', '19:00:00', 'Network Lab'),
  ('tt_4', 'Python Programming', 'usr_teacher1', 4, '19:00:00', '21:00:00', 'Online'),
  ('tt_5', 'Front-End Web Development', 'usr_teacher1', 6, '10:00:00', '13:00:00', 'Lab B');

INSERT IGNORE INTO materials
  (id, course_title, teacher_id, title, description, doc_id, external_url, created_at)
VALUES
  ('mat_1', 'Certified Ethical Hacker (CEH)', 'usr_teacher1',
   'CEH lab manual', 'Official lab steps and safe practice guidelines.', '',
   'https://www.eccouncil.org/programs/certified-ethical-hacker-ceh/', DATE_SUB(NOW(), INTERVAL 12 DAY)),
  ('mat_2', 'Cisco CCNA', 'usr_teacher1',
   'Subnetting cheat sheet', 'Quick reference for IPv4 subnetting and VLSM.', '',
   'https://learningnetwork.cisco.com/', DATE_SUB(NOW(), INTERVAL 6 DAY)),
  ('mat_3', 'Python Programming', 'usr_teacher1',
   'Python style guide', 'PEP 8 naming, imports and formatting rules.', '',
   'https://peps.python.org/pep-0008/', DATE_SUB(NOW(), INTERVAL 3 DAY));

INSERT IGNORE INTO announcements
  (id, course_title, teacher_id, title, body, pinned, created_at)
VALUES
  ('ann_1', 'Certified Ethical Hacker (CEH)', 'usr_teacher1',
   'Lab session moved to Thursday',
   'This week only, the CEH lab will run on Thursday at 6:00 PM in Lab A.', 1,
   DATE_SUB(NOW(), INTERVAL 2 DAY)),
  ('ann_2', 'Python Programming', 'usr_teacher1',
   'Bring your expense tracker project',
   'We will review the CLI project together in the next class.', 0,
   DATE_SUB(NOW(), INTERVAL 4 DAY));

INSERT IGNORE INTO quizzes
  (id, course_title, teacher_id, title, description, duration_minutes, pass_percent,
   audience, status, created_at)
VALUES
  ('qz_1', 'Certified Ethical Hacker (CEH)', 'usr_teacher1',
   'CEH Module 1 quiz', 'Reconnaissance, scanning and enumeration fundamentals.', 15, 50,
   'course', 'published', DATE_SUB(NOW(), INTERVAL 5 DAY)),
  ('qz_2', '', 'usr_teacher1',
   'TechNexa general IT quiz', 'A short general quiz open to every student.', 10, 50,
   'all', 'published', DATE_SUB(NOW(), INTERVAL 2 DAY));

INSERT IGNORE INTO quiz_questions
  (id, quiz_id, q_no, question, option_a, option_b, option_c, option_d, correct, marks)
VALUES
  ('qq_1', 'qz_1', 1, 'Which phase comes immediately before scanning?',
   'Reconnaissance', 'Enumeration', 'Exploitation', 'Reporting', 'A', 2),
  ('qq_2', 'qz_1', 2, 'What does Nmap primarily do?',
   'Network mapping and port scanning', 'Password cracking', 'Packet filtering', 'Disk encryption', 'A', 2),
  ('qq_3', 'qz_1', 3, 'Which record type maps a domain name to an IPv4 address?',
   'MX', 'A', 'TXT', 'CNAME', 'B', 2),
  ('qq_4', 'qz_1', 4, 'What is the default port for HTTPS?',
   '21', '25', '443', '8080', 'C', 2),
  ('qq_5', 'qz_1', 5, 'Which activity is passive reconnaissance?',
   'Port scanning', 'Banner grabbing', 'WHOIS lookup', 'Vulnerability exploitation', 'C', 2),
  ('qq_6', 'qz_2', 1, 'What does CSS control on a web page?',
   'Presentation and layout', 'Database queries', 'Server routing', 'File permissions', 'A', 2),
  ('qq_7', 'qz_2', 2, 'Which command lists files in a Linux directory?',
   'pwd', 'ls', 'cd', 'rm', 'B', 2),
  ('qq_8', 'qz_2', 3, 'What does API stand for?',
   'Application Programming Interface', 'Automated Process Input', 'Applied Protocol Index', 'Application Process Integration', 'A', 2),
  ('qq_9', 'qz_2', 4, 'Which HTTP status code means Not Found?',
   '200', '301', '404', '500', 'C', 2),
  ('qq_10', 'qz_2', 5, 'Which of these is a version control system?',
   'Git', 'Docker', 'Nginx', 'MySQL', 'A', 2);

INSERT IGNORE INTO quiz_attempts
  (id, quiz_id, student_id, started_at, submitted_at, score, total, status)
VALUES
  ('qa_1', 'qz_1', 'usr_student1', DATE_SUB(NOW(), INTERVAL 1 DAY),
   DATE_SUB(NOW(), INTERVAL 1 DAY), 8.00, 10.00, 'submitted');

INSERT IGNORE INTO quiz_answers (id, attempt_id, question_id, choice, correct, marks) VALUES
  ('qan_1', 'qa_1', 'qq_1', 'A', 1, 2),
  ('qan_2', 'qa_1', 'qq_2', 'A', 1, 2),
  ('qan_3', 'qa_1', 'qq_3', 'B', 1, 2),
  ('qan_4', 'qa_1', 'qq_4', 'C', 1, 2),
  ('qan_5', 'qa_1', 'qq_5', 'B', 0, 0);

INSERT IGNORE INTO question_bank
  (id, teacher_id, course_title, question, option_a, option_b, option_c, option_d, correct, marks)
VALUES
  ('qb_1', 'usr_teacher1', 'Certified Ethical Hacker (CEH)',
   'Which tool is commonly used for packet capture?',
   'Wireshark', 'Photoshop', 'Excel', 'Figma', 'A', 2),
  ('qb_2', 'usr_teacher1', 'Cisco CCNA',
   'Which protocol provides reliable, connection-oriented transport?',
   'UDP', 'TCP', 'ICMP', 'ARP', 'B', 2),
  ('qb_3', 'usr_teacher1', 'Python Programming',
   'Which keyword defines a function in Python?',
   'func', 'def', 'function', 'lambda', 'B', 2);

INSERT IGNORE INTO chat_messages
  (id, sender_id, recipient_id, body, created_at, delivered_at, read_at)
VALUES
  ('msg_1', 'usr_teacher1', 'usr_student1',
   'Assalam o Alaikum Ali, please upload your CEH lab report before Friday.',
   DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR)),
  ('msg_2', 'usr_student1', 'usr_teacher1',
   'Walaikum Assalam sir, I have submitted it today. Please review when you get time.',
   DATE_SUB(NOW(), INTERVAL 90 MINUTE), DATE_SUB(NOW(), INTERVAL 90 MINUTE), DATE_SUB(NOW(), INTERVAL 80 MINUTE)),
  ('msg_3', 'usr_teacher1', 'usr_student1',
   'Received. I will share feedback after tomorrow class.',
   DATE_SUB(NOW(), INTERVAL 70 MINUTE), DATE_SUB(NOW(), INTERVAL 70 MINUTE), NULL);

INSERT IGNORE INTO call_logs
  (id, call_key, caller_id, callee_id, kind, status, started_at, answered_at, ended_at)
VALUES
  ('call_1', 'demo-call-1', 'usr_teacher1', 'usr_student1', 'audio', 'answered',
   DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
  ('call_2', 'demo-call-2', 'usr_student2', 'usr_teacher1', 'video', 'missed',
   DATE_SUB(NOW(), INTERVAL 3 DAY), NULL, NULL);

INSERT IGNORE INTO login_logs
  (id, user_id, email, role, full_name, status, ip, user_agent, created_at)
VALUES
  (1, 'usr_admin', 'admin@technexa.pk', 'admin', 'TechNexa Administrator', 'success',
   '127.0.0.1', 'TechNexa demo seed', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (2, 'usr_teacher1', 'teacher@technexa.pk', 'teacher', 'Hamza Khan', 'success',
   '127.0.0.1', 'TechNexa demo seed', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (3, NULL, 'unknown@example.com', '', '', 'failed',
   '127.0.0.1', 'TechNexa demo seed', DATE_SUB(NOW(), INTERVAL 12 HOUR));

INSERT IGNORE INTO contact_messages (id, name, email, phone, message, ip, created_at) VALUES
  ('cmsg_1', 'Bilal Ahmed', 'bilal@example.com', '+923001112233',
   'I want details about the CEH weekend batch and instalment plan.', '127.0.0.1',
   DATE_SUB(NOW(), INTERVAL 2 DAY)),
  ('cmsg_2', 'Hira Noor', 'hira@example.com', '+923331112233',
   'Do you offer corporate training for a 15-person networking team?', '127.0.0.1',
   DATE_SUB(NOW(), INTERVAL 1 DAY));

INSERT IGNORE INTO subscribers (id, email, created_at) VALUES
  ('sub_demo_1', 'bilal@example.com', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  ('sub_demo_2', 'hira@example.com', DATE_SUB(NOW(), INTERVAL 1 DAY));
