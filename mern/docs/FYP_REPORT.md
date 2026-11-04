# TechNexa Solutions

## Final Year Project Report

### An IT Services and Learning Management Platform

**Stack:** React 18 + Node.js 20 + Express 4 + MySQL / MariaDB

| Item | Detail |
|---|---|
| Project title | TechNexa Solutions - IT Services and Learning Platform |
| Submitted by | Muhammad Umair |
| Registration no. | ____________________ |
| Supervisor | ____________________ |
| Department | ____________________ |
| Institution | ____________________ |
| Session | 2025 - 2026 |
| Date | 03 November 2026 |

---

## Abstract

TechNexa Solutions is a full-stack web platform that brings an IT-services website and a learning management portal into one system. Visitors can explore services, browse training courses, send enquiries, subscribe to updates and apply for enrollment. Registered students receive a personal dashboard for courses, assignments, quizzes, marks, attendance, timetable, materials, fees, documents, notices, chat and calls. Teachers manage assigned courses, grade submissions, create quizzes, generate questions, mark attendance, upload materials and communicate with students. Administrators control users, teacher approvals, enrollments, payments, courses, audit logs, call logs, contact messages and subscribers.

The application is implemented with React 18 and Vite on the client, Node.js and Express on the server, and MySQL/MariaDB for relational storage. Authentication uses a JWT stored in an httpOnly cookie. Socket.IO provides real-time chat, presence and WebRTC call signalling. Audio/video calls use WebRTC, and the caller can record a mixed audio stream containing both participants. The interface supports light and dark themes across the public site, authentication pages and portal.

A key part of the project is the academic workflow: students can attempt published quizzes and receive automatic scores; teachers can create quizzes manually or generate draft MCQs through the AI question generator. When no OpenAI key is configured, the system uses a built-in question generator instead of failing, so the feature remains usable in offline or low-cost demonstrations.

The report describes the problem, objectives, methodology, system design, implementation, testing, deployment and future work. It also includes screenshots of the implemented features.

---

## Acknowledgements

I would like to thank my supervisor, teachers and classmates for their guidance and feedback during the development of this project. I am also grateful to the open-source communities behind React, Express, MySQL, Socket.IO and WebRTC, whose documentation made this implementation possible.

---

## Table of Contents

1. Introduction
2. Literature Review and Related Work
3. Methodology
4. System Analysis and Design
5. Implementation
6. Testing and Results
7. Deployment
8. Conclusion and Future Work
9. References
10. Appendix A - Demo Accounts
11. Appendix B - Screenshot Index

---

# Chapter 1 - Introduction

## 1.1 Background

IT training institutes and small technology companies often run two separate systems: a marketing website for services and a learning portal for students. The public website is usually static, while the portal is either a spreadsheet-driven process or a collection of disconnected forms. This separation creates duplicated data, manual enrollment handling, delayed communication and weak auditability.

TechNexa Solutions addresses this gap with one platform. The public-facing side presents the company's services and training programmes. The authenticated side provides a role-aware academic and operational workspace. A single database stores users, courses, enrollments, payments, academic records and communication metadata, so administrators can see a consistent view of the institute.

## 1.2 Problem Statement

The existing manual or semi-digital process has several problems:

1. Course enquiries, enrollments and payments are tracked in different places.
2. Students cannot easily see their assignments, quizzes, attendance, marks, fees and materials in one dashboard.
3. Teachers spend time on repetitive tasks such as attendance, grading and question preparation.
4. Communication is scattered across personal messaging apps, so academic conversations and call records are not auditable.
5. Administrators lack a consolidated view of pending teachers, enrollments, revenue, failed logins and call activity.
6. Static websites do not provide a secure, role-aware portal for students and staff.
7. Many quiz tools require an external paid AI service or manual question entry only.

## 1.3 Objectives

The objectives of the project are:

1. Build a professional public website for TechNexa Solutions.
2. Provide secure student, teacher and administrator authentication with role-based access.
3. Centralise course, enrollment, payment and academic records in MySQL.
4. Give students a single dashboard for their learning and financial information.
5. Give teachers tools for assignments, quizzes, attendance, materials and communication.
6. Give administrators control over users, approvals, courses, payments, logs and reports.
7. Support real-time private chat and WebRTC audio/video calls.
8. Record both sides of a call from the caller's browser and store recordings privately.
9. Add a consistent light/dark theme to the public site and portal.
10. Keep core features usable without a paid external AI key.

## 1.4 Scope

### Included

- Public home, about, courses, industries, legal and service pages.
- Student and teacher registration, login, logout and password reset.
- Student portal: dashboard, courses, enrollments, assignments, quizzes, marks, attendance, timetable, materials, fees, documents, notices, announcements, messages, calls and profile.
- Teacher portal: dashboard, courses, students, assignments, quizzes, question bank, attendance, timetable, materials, announcements, messages, calls and profile.
- Admin portal: dashboard, students, teachers, enrollments, courses, assignments, quizzes, fees, logs, call logs, password resets, contact messages and subscribers.
- Real-time chat, attachments, presence and WebRTC calls.
- Call recording with private storage and admin playback.
- Light/dark theme and responsive layouts.
- Database migrations, seed data, Docker/Nginx examples and a local launcher.

### Excluded

- Online payment-gateway integration (payments are recorded manually).
- Native Android/iOS applications.
- Automatic video recording of calls (audio is recorded).
- Full LMS features such as SCORM packages, certificate generation and plagiarism detection.
- Multi-tenant institute separation.
- Advanced analytics/BI dashboards.

## 1.5 Significance

The project demonstrates how a small institute can replace disconnected spreadsheets and chat groups with a single secure platform. It reduces manual work, improves student visibility, gives teachers reusable academic tools and provides administrators with auditable records. It also demonstrates practical use of REST APIs, relational modelling, role-based security, real-time communication and browser media APIs.

---

# Chapter 2 - Literature Review and Related Work

## 2.1 Learning Management Systems

Learning management systems such as Moodle, Canvas and Google Classroom provide course delivery, assignments, quizzes and communication. They are mature but often heavy for a small institute. They may require significant configuration, and their public marketing website is usually separate from the academic portal.

TechNexa follows the useful ideas of an LMS - role-based access, course enrollment, assignments, quizzes and announcements - but keeps the implementation focused on the needs of a small IT training institute. The public website and portal share one codebase and one database.

## 2.2 IT Services Websites

A typical IT services website presents services, industries, case studies, contact details and a quote form. It rarely connects to a learning portal. TechNexa combines both: the same course catalogue that appears publicly is used by the portal, and public enrollment enquiries become records that administrators can review.

## 2.3 Real-Time Communication in Education

Modern browsers support WebRTC for peer-to-peer audio and video. Socket.IO is commonly used for signalling and chat because it provides reconnection and event-based messaging. Many academic projects implement chat but stop before call logging or recording. TechNexa adds call logs, a recording indicator and private recording playback for administrators.

## 2.4 AI-Assisted Question Generation

Large language models can draft multiple-choice questions quickly, but they introduce dependencies: API keys, quotas, latency and inconsistent output. A practical system should treat AI as an optional accelerator. TechNexa validates AI output and falls back to a built-in generator when the external service is unavailable. This keeps the teacher workflow usable during demonstrations and in environments without an API key.

## 2.5 Research Gap Addressed by the Project

The project addresses the gap between a public IT-services website and an academic portal. It also treats AI as an optional helper rather than a hard dependency, and it adds auditable communication features (chat logs, call logs and recordings) that are often missing from student projects.

---

# Chapter 3 - Methodology

## 3.1 Requirement Gathering

Requirements were gathered from the expected workflows of a training institute:

- Visitors need service and course information.
- Students need a single place to see academic and financial status.
- Teachers need efficient tools for recurring academic tasks.
- Administrators need approval, oversight and audit capabilities.
- The system must remain usable on a local machine without paid services.

## 3.2 Development Model

An incremental, feature-based approach was used. Each feature was implemented end-to-end:

1. Identify the user role and workflow.
2. Design the database table or migration.
3. Implement the API route with validation and role checks.
4. Build the React page and API helper.
5. Test the flow in the browser and with direct API calls.
6. Document the feature and capture a screenshot.

This approach made it possible to keep the application runnable while adding modules.

## 3.3 Tools and Technologies

| Area | Tool |
|---|---|
| Frontend | React 18, Vite, React Router, Axios |
| Styling | Plain CSS design system with light/dark variables |
| Backend | Node.js 20, Express 4 |
| Database | MySQL 8 / MariaDB 10.4+, `mysql2/promise` |
| Authentication | JWT, bcryptjs, httpOnly cookie |
| Realtime | Socket.IO |
| Calls | WebRTC, STUN, MediaRecorder, Web Audio API |
| Uploads | Multer |
| Email | Nodemailer / SMTP |
| AI | OpenAI Chat Completions API (optional) + built-in fallback |
| Deployment | Docker, Docker Compose, Nginx, GitHub Actions |
| Version control | Git |

## 3.4 Development Phases

| Phase | Work |
|---|---|
| 1 | Monorepo setup, Vite, Express, MySQL pool and health check |
| 2 | Authentication, registration, password reset and role middleware |
| 3 | Public website and course catalogue |
| 4 | Student and teacher dashboards, profiles, enrollments and fees |
| 5 | Assignments, attendance, timetable, materials and announcements |
| 6 | Quizzes, question bank, AI generation and automatic scoring |
| 7 | Chat, attachments, presence and WebRTC calls |
| 8 | Call recording, admin logs and reporting |
| 9 | Light/dark theme, responsive polish and card alignment |
| 10 | Testing, documentation, screenshots and deployment files |

---

# Chapter 4 - System Analysis and Design

## 4.1 Existing System

The existing process is a mixture of static web pages, spreadsheets and messaging apps. Enrollment details are copied manually, fee status is checked in separate files, and academic communication is not centrally recorded. Teachers prepare questions and attendance sheets manually. Administrators have no single dashboard for pending approvals, failed logins or call activity.

## 4.2 Proposed System

The proposed system provides:

- A public website and a secure portal in one application.
- A relational database as the single source of truth.
- Role-based navigation and API permissions.
- Real-time communication with audit-friendly logs.
- A theme system that works across public and authenticated pages.
- A graceful AI fallback so question generation does not fail without a key.

## 4.3 Functional Modules

1. Public website and course catalogue.
2. Authentication and account management.
3. Student portal.
4. Teacher portal.
5. Administrator portal.
6. Quiz and question bank.
7. Chat and presence.
8. Audio/video calls and recording.
9. Notices and announcements.
10. Theme, responsive layout and accessibility.
11. Deployment and operations.

## 4.4 Use Case Overview

```mermaid
flowchart LR
  Visitor --> Browse[Browse website and courses]
  Visitor --> Enroll[Submit enrollment / contact]
  Student --> Dashboard[View student dashboard]
  Student --> Learn[Assignments, quizzes, marks, materials]
  Student --> Communicate[Chat and call teachers]
  Teacher --> Manage[Manage courses and students]
  Teacher --> Assess[Create assignments and quizzes]
  Teacher --> Teach[Attendance, timetable, materials, announcements]
  Teacher --> Communicate
  Admin --> Control[Manage users, enrollments, courses, payments]
  Admin --> Audit[View logs, call logs, recordings]
```

## 4.5 System Architecture

```mermaid
flowchart TB
  subgraph Client
    React[React SPA]
    Theme[ThemeContext / localStorage]
    Call[useCall / MediaRecorder]
  end
  subgraph Server
    API[Express REST API]
    Socket[Socket.IO]
    Services[Business services]
  end
  DB[(MySQL / MariaDB)]
  Files[(Private uploads)]
  OpenAI[OpenAI optional]
  Mail[SMTP]

  React -->|JSON over HTTPS| API
  React <-->|WebSocket| Socket
  API --> Services
  Services --> DB
  Services --> Files
  Services --> OpenAI
  Services --> Mail
  Socket --> DB
  Call <-->|WebRTC media| Call
```

## 4.6 Entity Relationship Overview

```mermaid
erDiagram
  USERS ||--o| STUDENT_PROFILES : has
  USERS ||--o| TEACHER_PROFILES : has
  USERS ||--o{ ENROLLMENTS : applies
  COURSES ||--o{ ENROLLMENTS : receives
  ENROLLMENTS ||--o{ PAYMENTS : has
  USERS ||--o{ ASSIGNMENTS : creates
  ASSIGNMENTS ||--o{ SUBMISSIONS : receives
  USERS ||--o{ SUBMISSIONS : submits
  USERS ||--o{ QUIZZES : creates
  QUIZZES ||--o{ QUIZ_QUESTIONS : contains
  USERS ||--o{ QUIZ_ATTEMPTS : attempts
  QUIZZES ||--o{ QUIZ_ATTEMPTS : has
  USERS ||--o{ CHAT_MESSAGES : sends
  CHAT_MESSAGES ||--o{ CHAT_ATTACHMENTS : has
  USERS ||--o{ CALL_LOGS : participates
  USERS ||--o{ DOCUMENTS : owns
  USERS ||--o{ NOTICES : creates
  USERS ||--o{ LOGIN_LOGS : generates
```

## 4.7 Request Flow

```text
React page
  -> Axios API helper
  -> Express route
  -> Authentication middleware
  -> Role middleware
  -> Validation and business logic
  -> Parameterised SQL through mysql2 pool
  -> MySQL response
  -> JSON response
  -> useFetch updates the page
```

## 4.8 Security Design

1. Passwords are hashed with bcrypt.
2. JWT is stored in an httpOnly cookie, not localStorage.
3. Every protected route verifies the user and role.
4. SQL uses prepared statements.
5. Uploads are validated by extension and size.
6. Documents, chat attachments and call recordings are served through authenticated routes.
7. Students can access only their own records; teachers can access assigned courses.
8. Password-reset tokens expire after one hour.
9. Login attempts are rate-limited and logged.
10. Production requires HTTPS for secure cookies and browser media permissions.

---

# Chapter 5 - Implementation

## 5.1 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | SPA and fast development build |
| Routing | React Router v6 | Public, auth, portal and role-guarded routes |
| HTTP | Axios | REST API communication with credentials |
| Backend | Node.js + Express | REST API and middleware |
| Database | MySQL / MariaDB | Relational data storage |
| DB driver | mysql2/promise | Connection pool and prepared statements |
| Auth | JWT + httpOnly cookie | Secure session |
| Realtime | Socket.IO | Chat, presence and call signalling |
| Calls | WebRTC | Audio/video media |
| Recording | MediaRecorder + Web Audio API | Mixed caller + remote audio |
| Uploads | Multer | Avatars, documents, materials, chat files, recordings |
| Email | Nodemailer | Password reset and notifications |
| AI | OpenAI optional + built-in generator | Quiz question drafting |
| Deployment | Docker, Nginx, CI | Local and production packaging |

## 5.2 Project Structure

```text
mern/
  client/
    src/
      api/          # axios and resource API helpers
      context/      # AuthContext, ThemeContext
      features/     # auth, public-site, portal pages and components
      hooks/        # useFetch, useCall
      routes/       # public, auth, portal and protected routes
      styles/       # site.css, portal.css, portal-extra.css, global.css
      utils/        # formatters and helpers
  server/
    src/
      config/       # MySQL pool
      middleware/   # auth and role checks
      routes/       # auth, public, portal, admin
      services/     # course catalogue, quiz generator
      sockets/      # chat, presence, call signalling
      utils/        # errors, validation, uploads, mail, IDs
    database/
      migrations/   # numbered schema changes
      seeds/        # demo data
  docs/             # architecture, API, database, deployment, SRS, report
```

## 5.3 Public Website

The public site uses a shared layout with a responsive navbar, theme toggle, hero, service sections, course catalogue, industry sections, contact form and footer. Course cards use a flex layout so titles, metadata and **Enroll Now** buttons align consistently across rows. The light theme uses a solid white navbar and dark readable Login text; the dark theme uses a dark translucent navbar.

Clicking **Enroll Now** while signed out opens an authentication gate inside the course modal. The visitor can sign in or create a student account, and the selected course is preserved in the return URL so the enrollment form reopens after authentication. Document uploads are available only after login, and the server also rejects unauthenticated enrollment requests before accepting any files.

## 5.4 Authentication and Roles

Registration supports students and teachers. Teachers remain pending until approved by an administrator. Login issues a JWT cookie; the client loads the current user through `/api/auth/me`. Protected routes redirect guests to login. Portal pages and APIs check the role before returning data.

## 5.5 Student Portal

The student dashboard summarises enrollments, pending assignments, available quizzes, attendance and fees. Students can browse courses, apply for enrollment, submit assignments, attempt quizzes, view marks, attendance, timetable, materials, fees, documents, notices, announcements, chat and calls.

## 5.6 Teacher Portal

The teacher dashboard summarises assigned courses, students, pending submissions, quizzes, upcoming classes and recent activity. Teachers can create assignments, grade submissions, create quizzes, generate questions, mark attendance, manage the timetable, upload materials, publish announcements and communicate with students.

## 5.7 Administrator Portal

The admin dashboard shows totals for students, teachers, enrollments, revenue, pending teachers and failed logins. Administrators can manage students, teachers, enrollments, payments and courses, review logs and call recordings, manage password-reset links, read contact messages and view subscribers.

## 5.8 Quiz and Question Bank

A quiz contains a title, course/audience, duration, status and a list of questions. Each question has four options, a correct answer and marks. Published quizzes are visible to the intended students. The student's attempt is stored, scored automatically and displayed with a result summary.

The student sees all questions, an answered counter and a progress bar. Manual submission is blocked until every question is answered, and the same rule is enforced on the server. If the timer expires first, the attempt is submitted automatically and the student can retake an attempt that was left incomplete. Answers are saved on the device while the attempt is in progress, so a refresh does not lose work.

Quiz integrity is supported by a violation log. The browser reports leaving the quiz tab, switching apps, turning off the screen, losing window focus, exiting fullscreen and copying quiz content. Each event is stored with the student, quiz, attempt, IP address, user agent and UTC timestamp. Administrators review these events in **Portal -> Quiz Violations**, and the admin dashboard shows the total count.

Teachers can add questions manually or use the AI question generator. The generator accepts a topic and a count between 1 and 10.

### AI generation fix

During testing, the AI generator returned an error whenever the server did not have an `OPENAI_API_KEY`. The original route rejected the request with HTTP 503. The implementation was improved as follows:

1. The AI request is isolated in `server/src/services/quizGenerator.js`.
2. If `OPENAI_API_KEY` is configured, the service calls the OpenAI Chat Completions API with a strict JSON response format and a timeout.
3. The response is parsed defensively, including code-fenced JSON.
4. Questions are normalised: valid question text, four options, correct letter `a`-`d`, and marks.
5. If the key is missing, the request fails or the response is invalid, the service falls back to a built-in topic-aware generator.
6. The API returns `meta.source` and `meta.warning` so the UI can explain which generator was used.
7. The client shows generated questions and allows the teacher to save each one to the question bank.

This means the teacher can still generate questions during a demo without a paid API key. Adding a key enables live AI generation without changing the UI.

## 5.9 Chat and Presence

Socket.IO maintains authenticated connections. Users see permitted contacts, online/offline presence and unread indicators. Messages support text, attachments, editing and deletion. Chat attachments are served through authenticated API routes.

## 5.10 Audio/Video Calls and Recording

Calls use WebRTC with Socket.IO signalling. The caller creates an offer, the callee answers, and ICE candidates are exchanged. Both participants can mute, toggle video and end the call. A call log records the caller, callee, type, status and timestamps.

For recording, the caller's browser mixes the local microphone stream and the remote audio stream using the Web Audio API. `MediaRecorder` records the mixed stream. Both participants see a visible **Recording** indicator. The file is uploaded to private storage and linked to the call log. Administrators can play it from **Call Logs** through an authenticated route.

## 5.11 Theme System

`ThemeContext` stores the selected theme in `localStorage` under `technexa_theme` and applies `data-theme` to the `<html>` element. The public navbar, auth layout and portal top bar expose a sun/moon toggle. On first visit, the system preference is used. Both themes share the same CSS variables so surfaces, text, borders and buttons remain readable.

## 5.12 Notices, Announcements and Contact

Administrators can publish notices to selected audiences. Teachers can publish course announcements. Visitors can submit contact messages and subscribe to updates. These records are available in the admin portal.

---

# Chapter 6 - Testing and Results

## 6.1 Test Strategy

Testing was performed at four levels:

1. **Static checks:** client build and server syntax/import checks.
2. **API checks:** direct requests with valid and invalid sessions.
3. **Browser checks:** login as each role and navigate the main workflows.
4. **Visual checks:** screenshots of public and portal pages in the local demo.

## 6.2 Test Cases

| ID | Test | Expected result | Status |
|---|---|---|---|
| T-01 | Open public home page | Page loads with navbar, hero and sections | Pass |
| T-02 | Toggle light/dark theme | Theme changes and persists after refresh | Pass |
| T-03 | Open courses page | Course cards align and buttons sit at the bottom | Pass |
| T-04 | Login as student | Student dashboard opens | Pass |
| T-05 | Login as teacher | Teacher dashboard opens | Pass |
| T-06 | Login as admin | Admin dashboard opens | Pass |
| T-07 | Guest opens `/portal/dashboard` | Redirected to login | Pass |
| T-08 | Student opens admin route | Redirected or forbidden | Pass |
| T-09 | Student attempts a published quiz | Score and result are stored | Pass |
| T-10 | Teacher creates a quiz manually | Quiz appears in list | Pass |
| T-11 | Teacher generates questions with no OpenAI key | Built-in generator returns valid MCQs | Pass |
| T-12 | Teacher saves a generated question | Question appears in the bank | Pass |
| T-13 | Two users exchange chat messages | Messages appear in real time | Pass |
| T-14 | User uploads a chat attachment | Attachment is accessible only when authenticated | Pass |
| T-15 | Two users start an audio call | Both sides connect | Pass |
| T-16 | Caller starts recording | Both sides see Recording indicator | Pass |
| T-17 | Admin opens Call Logs | Recording is available for authorised playback | Pass |
| T-18 | Student views fees/documents | Only own records are shown | Pass |
| T-19 | Admin views logs | Login/audit entries are visible | Pass |
| T-20 | `npm run build` | Client production build succeeds | Pass |

## 6.3 Build and API Verification

- API health endpoint returned `ok: true`.
- Student, teacher and admin login flows returned success.
- The AI question endpoint returned valid MCQs with `meta.source = "builtin"` when no OpenAI key was configured.
- Vite served the client on port `5173` and the API on port `5000`.
- The client production build completed successfully after the final changes.

## 6.4 Screenshot Evidence

The screenshots below were captured from the local demo at a desktop width of 1440 px. They are stored in `mern/docs/screenshots/`.

### Public Website

#### Public Home

![Public home](screenshots/public-home.png)

#### About

![About page](screenshots/public-about.png)

#### Courses

![Courses page](screenshots/public-courses.png)

#### Industries

![Industries page](screenshots/public-industries.png)

#### Legal

![Legal page](screenshots/public-legal.png)

#### Login

![Login page](screenshots/public-login.png)

#### Registration Chooser

![Registration chooser](screenshots/public-register.png)

#### Student Registration

![Student registration](screenshots/public-register-student.png)

#### Teacher Registration

![Teacher registration](screenshots/public-register-teacher.png)

#### Forgot Password

![Forgot password](screenshots/public-forgot-password.png)

### Student Portal

#### Student Dashboard

![Student dashboard](screenshots/student-dashboard.png)

#### Student Courses

![Student courses](screenshots/student-courses.png)

#### Student Enrollments

![Student enrollments](screenshots/student-enrollments.png)

#### Student Assignments

![Student assignments](screenshots/student-assignments.png)

#### Student Quizzes

![Student quizzes](screenshots/student-quizzes.png)

#### Student Marks

![Student marks](screenshots/student-marks.png)

#### Student Attendance

![Student attendance](screenshots/student-attendance.png)

#### Student Timetable

![Student timetable](screenshots/student-timetable.png)

#### Student Materials

![Student materials](screenshots/student-materials.png)

#### Student Fees

![Student fees](screenshots/student-fees.png)

#### Student Documents

![Student documents](screenshots/student-documents.png)

#### Student Notices

![Student notices](screenshots/student-notices.png)

#### Student Announcements

![Student announcements](screenshots/student-announcements.png)

#### Student Messages and Calls

![Student messages](screenshots/student-messages.png)

#### Student Profile

![Student profile](screenshots/student-profile.png)

### Teacher Portal

#### Teacher Dashboard

![Teacher dashboard](screenshots/teacher-dashboard.png)

#### Teacher Courses

![Teacher courses](screenshots/teacher-courses.png)

#### Teacher Students

![Teacher students](screenshots/teacher-students.png)

#### Teacher Assignments

![Teacher assignments](screenshots/teacher-assignments.png)

#### Teacher Quizzes

![Teacher quizzes](screenshots/teacher-quizzes.png)

#### Teacher Question Bank and AI Generator

![Teacher question bank](screenshots/teacher-question-bank.png)

#### Teacher Attendance

![Teacher attendance](screenshots/teacher-attendance.png)

#### Teacher Timetable

![Teacher timetable](screenshots/teacher-timetable.png)

#### Teacher Materials

![Teacher materials](screenshots/teacher-materials.png)

#### Teacher Announcements

![Teacher announcements](screenshots/teacher-announcements.png)

#### Teacher Messages and Calls

![Teacher messages](screenshots/teacher-messages.png)

#### Teacher Profile

![Teacher profile](screenshots/teacher-profile.png)

### Administrator Portal

#### Admin Dashboard

![Admin dashboard](screenshots/admin-dashboard.png)

#### Admin Students

![Admin students](screenshots/admin-students.png)

#### Admin Teachers

![Admin teachers](screenshots/admin-teachers.png)

#### Admin Enrollments

![Admin enrollments](screenshots/admin-enrollments.png)

#### Admin Courses

![Admin courses](screenshots/admin-courses.png)

#### Admin Assignments

![Admin assignments](screenshots/admin-assignments.png)

#### Admin Quizzes

![Admin quizzes](screenshots/admin-quizzes.png)

#### Admin Fees

![Admin fees](screenshots/admin-fees.png)

#### Admin Logs

![Admin logs](screenshots/admin-logs.png)

#### Admin Call Logs

![Admin call logs](screenshots/admin-call-logs.png)

#### Admin Password Resets

![Admin password resets](screenshots/admin-resets.png)

#### Admin Contact Messages

![Admin contact messages](screenshots/admin-contact-messages.png)

#### Admin Subscribers

![Admin subscribers](screenshots/admin-subscribers.png)

---

# Chapter 7 - Deployment

## 7.1 Local Development

The project includes a one-command local launcher (`mern/start-dev.bat`). It starts the API, the Vite client and the database connection using the configured environment. The standard commands are:

```bash
cd mern
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Local URLs:

- Client: `http://localhost:5173`
- API: `http://localhost:5000/api`
- Health: `http://localhost:5000/api/health`
- MySQL: `localhost:3306`

## 7.2 Docker and Nginx

The `deploy/` folder contains Dockerfiles, an Nginx configuration and Kubernetes examples. A typical production setup builds the React client as static files, serves them through Nginx, proxies `/api` and `/socket.io` to the Node server, and connects the API to MySQL.

## 7.3 Environment Configuration

Secrets are supplied through environment variables:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `OPENAI_API_KEY`, `OPENAI_MODEL` (optional)
- `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` (for restrictive networks)

## 7.4 Operational Notes

1. Use HTTPS in production for secure cookies and browser media access.
2. Back up MySQL and the private uploads directory together.
3. Keep call recordings and documents outside the public web root.
4. Use a TURN server when participants are behind restrictive NAT/firewalls.
5. Monitor disk usage for uploads and recordings.
6. Rotate the JWT secret and database credentials periodically.

---

# Chapter 8 - Conclusion and Future Work

## 8.1 Conclusion

TechNexa Solutions demonstrates a complete full-stack academic and IT-services platform. It combines a public website with a secure role-based portal, centralises relational data in MySQL, and adds real-time communication and call recording. Students get visibility of their academic and financial status, teachers get reusable academic tools, and administrators get approval, oversight and audit capabilities.

The project also shows how to handle optional external AI responsibly. The question generator works with OpenAI when a key is available and falls back to a built-in generator when it is not, so the teacher workflow remains reliable.

## 8.2 Future Work

1. Integrate an online payment gateway and automatic receipt generation.
2. Add certificate generation and downloadable result cards.
3. Add video recording and cloud storage for call recordings.
4. Add a TURN server by default for reliable calls on restrictive networks.
5. Add push/email notifications for assignment and quiz deadlines.
6. Add attendance analytics and early-warning reports for at-risk students.
7. Add a mobile application or PWA with offline support.
8. Add role-specific analytics dashboards and export to PDF/Excel.
9. Add automated end-to-end tests with Playwright or Cypress.
10. Add multi-tenant support for multiple institutes.
11. Add richer AI features such as quiz explanations and personalised study plans.
12. Add accessibility audit and WCAG compliance checks.

---

# References

1. React documentation - https://react.dev
2. Vite documentation - https://vitejs.dev
3. Express documentation - https://expressjs.com
4. MySQL documentation - https://dev.mysql.com/doc
5. Socket.IO documentation - https://socket.io/docs
6. WebRTC documentation - https://webrtc.org
7. MDN Web Docs - MediaRecorder API and Web Audio API
8. OpenAI API documentation - https://platform.openai.com/docs
9. OWASP Application Security Verification Standard
10. IEEE 830-style Software Requirements Specification guidance

---

# Appendix A - Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@technexa.pk` | `Admin@12345` |
| Teacher | `teacher@technexa.pk` | `Teacher@12345` |
| Student | `student@technexa.pk` | `Student@12345` |
| Student | `ayesha@technexa.pk` | `Student@12345` |
| Pending teacher | `pending.teacher@technexa.pk` | `Teacher@12345` |

> These accounts are for local demonstration only. Change or remove them before a public deployment.

---

# Appendix B - Screenshot Index

| Feature | Screenshot |
|---|---|
| Public home | `screenshots/public-home.png` |
| Public about | `screenshots/public-about.png` |
| Public courses | `screenshots/public-courses.png` |
| Public industries | `screenshots/public-industries.png` |
| Public legal | `screenshots/public-legal.png` |
| Login | `screenshots/public-login.png` |
| Registration chooser | `screenshots/public-register.png` |
| Student registration | `screenshots/public-register-student.png` |
| Teacher registration | `screenshots/public-register-teacher.png` |
| Forgot password | `screenshots/public-forgot-password.png` |
| Student dashboard | `screenshots/student-dashboard.png` |
| Student courses | `screenshots/student-courses.png` |
| Student enrollments | `screenshots/student-enrollments.png` |
| Student assignments | `screenshots/student-assignments.png` |
| Student quizzes | `screenshots/student-quizzes.png` |
| Student marks | `screenshots/student-marks.png` |
| Student attendance | `screenshots/student-attendance.png` |
| Student timetable | `screenshots/student-timetable.png` |
| Student materials | `screenshots/student-materials.png` |
| Student fees | `screenshots/student-fees.png` |
| Student documents | `screenshots/student-documents.png` |
| Student notices | `screenshots/student-notices.png` |
| Student announcements | `screenshots/student-announcements.png` |
| Student messages | `screenshots/student-messages.png` |
| Student profile | `screenshots/student-profile.png` |
| Teacher dashboard | `screenshots/teacher-dashboard.png` |
| Teacher courses | `screenshots/teacher-courses.png` |
| Teacher students | `screenshots/teacher-students.png` |
| Teacher assignments | `screenshots/teacher-assignments.png` |
| Teacher quizzes | `screenshots/teacher-quizzes.png` |
| Teacher question bank | `screenshots/teacher-question-bank.png` |
| Teacher attendance | `screenshots/teacher-attendance.png` |
| Teacher timetable | `screenshots/teacher-timetable.png` |
| Teacher materials | `screenshots/teacher-materials.png` |
| Teacher announcements | `screenshots/teacher-announcements.png` |
| Teacher messages | `screenshots/teacher-messages.png` |
| Teacher profile | `screenshots/teacher-profile.png` |
| Admin dashboard | `screenshots/admin-dashboard.png` |
| Admin students | `screenshots/admin-students.png` |
| Admin teachers | `screenshots/admin-teachers.png` |
| Admin enrollments | `screenshots/admin-enrollments.png` |
| Admin courses | `screenshots/admin-courses.png` |
| Admin assignments | `screenshots/admin-assignments.png` |
| Admin quizzes | `screenshots/admin-quizzes.png` |
| Admin fees | `screenshots/admin-fees.png` |
| Admin logs | `screenshots/admin-logs.png` |
| Admin call logs | `screenshots/admin-call-logs.png` |
| Admin password resets | `screenshots/admin-resets.png` |
| Admin contact messages | `screenshots/admin-contact-messages.png` |
| Admin subscribers | `screenshots/admin-subscribers.png` |
