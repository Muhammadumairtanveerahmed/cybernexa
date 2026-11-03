# TechNexa — React + Node.js + Express + MySQL

This folder is the proposed **MERN-style** implementation of the TechNexa Solutions platform.
The frontend is **React**, the backend is **Node.js + Express**, and the database is **MySQL**.

> **Quick summary for your teacher:** open `docs/ONE-PAGE-SUMMARY.md` for a one-page overview of the
> stack, folder tree, request flow and role-based routes.
>
> **Formal documents:** `docs/SRS.md` contains the Software Requirements Specification, and
> `docs/FYP_REPORT.md` contains the full final-year project report with feature screenshots.

> **Important for the teacher:** MERN stands for **MongoDB, Express, React, Node.js**. Because this
> project uses **MySQL** instead of MongoDB, the accurate name is **React + Node.js + Express + MySQL**
> (sometimes written as **MENR** or “MERN with MySQL”). The architecture and folder pattern are the
> same as MERN; only the database driver changes (`mysql2` instead of `mongoose`).

---

## 1. Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | Single-page application (SPA) |
| Routing | React Router v6 | Public, student, teacher and admin routes |
| HTTP client | Axios | Calls the REST API |
| Server state | Custom `useFetch` hook + Axios | Loading, errors and refetching |
| Forms | Controlled React forms | Form state and client-side checks |
| Styling | Plain CSS design system | `site.css`, `portal.css`, `portal-extra.css` |
| Backend | Node.js 20 + Express 4 | REST API |
| Database | MySQL 8 / MariaDB 10.4+ | Relational data |
| DB driver | `mysql2/promise` | Connection pool and prepared statements |
| Auth | JWT in an httpOnly cookie | Login and role-based access |
| Realtime | Socket.IO | Chat, presence and call signalling |
| Calls | WebRTC + STUN | Audio/video calls |
| Uploads | Multer | Avatars, assignments, materials, chat files |
| Email | Nodemailer | Password reset and notifications |
| AI | OpenAI API (optional) + built-in fallback | Quiz question generation |
| Dev tools | Nodemon, Vite | Local development |
| Deployment | Docker + Docker Compose + Nginx | Local and production examples |

### Call recording

- Audio calls and the audio track of video calls are recorded from the caller's browser.
- The recording mixes both voices (local microphone + remote participant).
- Both participants see a red **Recording** indicator while recording is active.
- Files are stored in `server/uploads/calls` and are **not** publicly accessible.
- Admins can play recordings from **Portal → Call Logs**; participants can access only their own call recording through the authenticated API.

### Quiz question generation

- Teachers enter a topic and a question count (1-10) in **Portal -> Question Bank**.
- With `OPENAI_API_KEY` set, the server requests validated MCQs from OpenAI.
- Without a key, or if the AI request fails, the server uses a built-in topic-aware generator so the workflow never stops.
- Generated questions can be reviewed and saved to the reusable question bank.

### Light and dark theme

- Every page has a sun/moon switch in the public navbar, auth pages and portal top bar.
- The selected theme is stored in `localStorage` and follows the operating system preference on first visit.
- Both the public website and the student/teacher/admin portal use the same theme state, so the choice follows the user across the app.

---

## 2. Planned folder structure

> The implemented app uses this feature-first layout with a smaller set of files. Empty placeholder
> folders are kept so the structure can grow without moving code. See `docs/ONE-PAGE-SUMMARY.md`
> for the files that are actually used today.

```text
technexa-mern/
├── client/                              # React frontend (Vite)
│   ├── public/
│   │   ├── favicon.svg
│   │   └── robots.txt
│   ├── src/
│   │   ├── api/                         # Axios instances + API functions
│   │   │   ├── axios.js
│   │   │   ├── auth.api.js
│   │   │   ├── courses.api.js
│   │   │   ├── enrollments.api.js
│   │   │   ├── assignments.api.js
│   │   │   ├── quizzes.api.js
│   │   │   ├── attendance.api.js
│   │   │   ├── fees.api.js
│   │   │   ├── documents.api.js
│   │   │   ├── chat.api.js
│   │   │   └── admin.api.js
│   │   ├── assets/
│   │   │   ├── images/
│   │   │   └── icons/
│   │   ├── components/                  # Reusable UI (not feature-specific)
│   │   │   ├── common/                  # Button, Input, Modal, Table, Badge, Spinner, EmptyState
│   │   │   ├── layout/                  # PublicLayout, PortalLayout, AdminLayout, Sidebar, Topbar
│   │   │   ├── charts/                  # StatCard, BarChart, DonutChart
│   │   │   └── forms/                   # FormField, SelectField, FileInput, DatePicker
│   │   ├── context/
│   │   │   ├── AuthContext.jsx          # Logged-in user + role
│   │   │   ├── SocketContext.jsx        # Socket.IO connection
│   │   │   └── ThemeContext.jsx         # Optional theme toggle
│   │   ├── features/                    # Feature-based modules
│   │   │   ├── auth/
│   │   │   │   ├── pages/               # Login, RegisterStudent, RegisterTeacher, Forgot, Reset
│   │   │   │   ├── components/
│   │   │   │   └── hooks/
│   │   │   ├── public-site/
│   │   │   │   ├── pages/               # Home, About, Courses, Industries, Legal, ServicePage
│   │   │   │   └── components/          # Hero, ServiceCard, CourseCard, ContactForm, Footer
│   │   │   ├── student/
│   │   │   │   ├── pages/               # Dashboard, Enrollments, Profile, Documents, Fees,
│   │   │   │   │                        # Assignments, Marks, Attendance, Timetable,
│   │   │   │   │                        # Materials, Quizzes, Notices, Messages
│   │   │   │   └── components/
│   │   │   ├── teacher/
│   │   │   │   ├── pages/               # Dashboard, Students, Attendance, Timetable,
│   │   │   │   │                        # Materials, Announcements, Assignments,
│   │   │   │   │                        # QuestionBank, Quizzes, Marks
│   │   │   │   └── components/
│   │   │   ├── admin/
│   │   │   │   ├── pages/               # Dashboard, Students, Teachers, Enrollments,
│   │   │   │   │                        # Courses, Campus, Assignments, Calls, Logs,
│   │   │   │   │                        # Notices, Resets
│   │   │   │   └── components/
│   │   │   ├── quizzes/
│   │   │   │   ├── components/          # QuizCard, QuestionEditor, QuizRunner,
│   │   │   │   │                        # Timer, ResultCard, AnswerReview
│   │   │   │   └── hooks/               # useQuizTimer, useFullscreen, useQuizAttempt
│   │   │   └── chat/
│   │   │       ├── components/          # ChatList, ChatWindow, MessageBubble,
│   │   │       │                        # AttachmentPreview, CallOverlay, MicPicker
│   │   │       └── hooks/               # useChat, useCall, usePresence
│   │   ├── hooks/                       # useAuth, useFetch, usePagination, useDebounce
│   │   ├── routes/
│   │   │   ├── AppRoutes.jsx
│   │   │   ├── PublicRoutes.jsx
│   │   │   ├── StudentRoutes.jsx
│   │   │   ├── TeacherRoutes.jsx
│   │   │   ├── AdminRoutes.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── utils/
│   │   │   ├── formatters.js
│   │   │   ├── validators.js
│   │   │   ├── permissions.js
│   │   │   └── constants.js
│   │   ├── styles/
│   │   │   ├── global.css
│   │   │   ├── variables.css
│   │   │   └── tailwind.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                              # Node.js + Express backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                    # mysql2 connection pool
│   │   │   ├── env.js                   # Environment validation
│   │   │   └── cors.js                  # CORS options
│   │   ├── controllers/                 # Request/response only
│   │   │   ├── auth.controller.js
│   │   │   ├── user.controller.js
│   │   │   ├── course.controller.js
│   │   │   ├── enrollment.controller.js
│   │   │   ├── assignment.controller.js
│   │   │   ├── quiz.controller.js
│   │   │   ├── questionBank.controller.js
│   │   │   ├── attendance.controller.js
│   │   │   ├── timetable.controller.js
│   │   │   ├── material.controller.js
│   │   │   ├── announcement.controller.js
│   │   │   ├── fee.controller.js
│   │   │   ├── document.controller.js
│   │   │   ├── notice.controller.js
│   │   │   ├── chat.controller.js
│   │   │   ├── call.controller.js
│   │   │   ├── admin.controller.js
│   │   │   └── ai.controller.js
│   │   ├── routes/
│   │   │   ├── index.js                 # Mounts all routers
│   │   │   ├── auth.routes.js
│   │   │   ├── public.routes.js
│   │   │   ├── student.routes.js
│   │   │   ├── teacher.routes.js
│   │   │   ├── admin.routes.js
│   │   │   ├── quiz.routes.js
│   │   │   ├── chat.routes.js
│   │   │   └── upload.routes.js
│   │   ├── models/                      # SQL data access (repository layer)
│   │   │   ├── user.model.js
│   │   │   ├── course.model.js
│   │   │   ├── enrollment.model.js
│   │   │   ├── assignment.model.js
│   │   │   ├── quiz.model.js
│   │   │   ├── attendance.model.js
│   │   │   ├── fee.model.js
│   │   │   ├── chat.model.js
│   │   │   └── call.model.js
│   │   ├── services/                    # Business logic
│   │   │   ├── auth.service.js
│   │   │   ├── mail.service.js
│   │   │   ├── upload.service.js
│   │   │   ├── quiz.service.js
│   │   │   ├── ai.service.js
│   │   │   ├── call.service.js
│   │   │   └── report.service.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js       # Verify JWT/session
│   │   │   ├── role.middleware.js       # requireRole("teacher")
│   │   │   ├── validate.middleware.js   # Zod validation
│   │   │   ├── upload.middleware.js     # Multer
│   │   │   ├── error.middleware.js      # Central error handler
│   │   │   └── rateLimit.middleware.js  # Login throttling
│   │   ├── validators/
│   │   │   ├── auth.validator.js
│   │   │   ├── enrollment.validator.js
│   │   │   ├── assignment.validator.js
│   │   │   └── quiz.validator.js
│   │   ├── sockets/
│   │   │   ├── index.js                 # Socket.IO bootstrap
│   │   │   ├── chat.socket.js           # Message events
│   │   │   └── call.socket.js           # WebRTC signalling
│   │   ├── utils/
│   │   │   ├── ApiError.js
│   │   │   ├── asyncHandler.js
│   │   │   ├── jwt.js
│   │   │   ├── password.js
│   │   │   ├── response.js
│   │   │   └── logger.js
│   │   ├── jobs/
│   │   │   ├── cleanup.job.js           # Delete old logs/files
│   │   │   └── reminder.job.js          # Assignment/quiz reminders
│   │   ├── templates/
│   │   │   └── emails/                  # Password reset, notices
│   │   ├── app.js                       # Express app (no listen)
│   │   └── server.js                    # HTTP server + Socket.IO
│   ├── database/
│   │   ├── migrations/
│   │   │   ├── 001_create_users.sql
│   │   │   ├── 002_create_profiles.sql
│   │   │   ├── 003_create_courses.sql
│   │   │   ├── 004_create_enrollments.sql
│   │   │   ├── 005_create_academics.sql
│   │   │   ├── 006_create_campus.sql
│   │   │   ├── 007_create_quizzes.sql
│   │   │   ├── 008_create_chat_calls.sql
│   │   │   └── 009_create_lookups.sql
│   │   ├── seeds/
│   │   │   ├── 001_lookups.sql
│   │   │   ├── 002_admin.sql
│   │   │   └── 003_demo_data.sql
│   │   └── schema.sql                   # Full schema for fresh install
│   ├── uploads/                         # Runtime files (gitignored)
│   │   ├── avatars/
│   │   ├── assignments/
│   │   ├── materials/
│   │   ├── documents/
│   │   └── chat/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── .env.example
│   └── package.json
│
├── shared/                              # Code shared by client and server
│   ├── constants/
│   │   ├── roles.js                     # STUDENT, TEACHER, ADMIN
│   │   ├── statuses.js                  # pending, approved, rejected, completed
│   │   └── quiz.js                      # audience, difficulty, options
│   └── utils/
│       └── validators.js
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── FOLDER-STRUCTURE.md
│   ├── ONE-PAGE-SUMMARY.md
│   └── DEPLOYMENT.md
│
├── deploy/
│   ├── docker/
│   │   ├── Dockerfile.server
│   │   └── Dockerfile.client
│   ├── nginx/
│   │   └── default.conf
│   └── k8s/
│       ├── deployment.yaml
│       ├── service.yaml
│       └── ingress.yaml
│
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker-compose.yml
├── package.json                         # Root workspace scripts
├── .gitignore
└── README.md
```

---

## 3. What each folder does

| Folder | Purpose | Examples |
|---|---|---|
| `client/` | React single-page application | All UI, routing, forms, API calls |
| `client/src/api/` | One file per backend resource | `auth.api.js`, `quiz.api.js` |
| `client/src/components/` | Reusable, feature-agnostic UI | Button, Modal, Table |
| `client/src/features/` | Feature modules (pages + local components) | `student/`, `teacher/`, `admin/`, `quizzes/` |
| `client/src/context/` | Global state | Logged-in user, socket connection |
| `client/src/routes/` | Route definitions and guards | `ProtectedRoute.jsx` |
| `client/src/hooks/` | Reusable React hooks | `useAuth`, `usePagination` |
| `server/` | Express REST API | All backend logic |
| `server/src/routes/` | URL definitions only | `quiz.routes.js` |
| `server/src/controllers/` | Read request, call service, send response | `quiz.controller.js` |
| `server/src/services/` | Business rules | Scoring, AI, email |
| `server/src/models/` | SQL queries (repository) | `quiz.model.js` |
| `server/src/middleware/` | Cross-cutting concerns | Auth, roles, validation, errors |
| `server/src/sockets/` | Socket.IO events | Chat, calls, presence |
| `server/src/jobs/` | Scheduled/background work | Cleanup, reminders |
| `server/database/` | Schema, migrations, seeds | `schema.sql` |
| `server/uploads/` | Uploaded files (runtime) | Avatars, assignments |
| `shared/` | Constants and validators used by both sides | Roles, statuses |
| `docs/` | Architecture, API and database docs | `API.md` |
| `deploy/` | Docker, Nginx and Kubernetes files | `Dockerfile.server` |
| `.github/workflows/` | CI/CD pipeline | Build and test |

---

## 4. How a request flows

```text
 1. React page calls an Axios function.
 2. Axios sends the request to the Express route.
 3. Auth and role middleware check the user.
 4. Controller reads the request and calls a service.
 5. Service applies the business rules.
 6. Model runs the SQL query against MySQL.
 7. MySQL returns the rows.
 8. API returns a JSON response.
 9. React Query stores the response in its cache.
10. The UI re-renders with the new data.
```

**Example — student submits a quiz**

1. `QuizRunner.jsx` posts answers to `POST /api/quizzes/:id/submit`.
2. `auth.middleware.js` validates the JWT/session.
3. `role.middleware.js` allows only `student`.
4. `quiz.controller.js` validates the body and calls `quiz.service.js`.
5. `quiz.service.js` loads questions, calculates the score, and writes `quiz_attempts` and `quiz_answers` through `quiz.model.js`.
6. The API returns `{ score, total, percentage, grade }`.
7. React shows the result page with **score / total** and **total marks**.

---

## 5. Frontend routing plan

| Path | Layout | Access |
|---|---|---|
| `/` | PublicLayout | Everyone |
| `/about`, `/courses`, `/industries`, `/legal`, `/services/:slug` | PublicLayout | Everyone |
| `/login`, `/register`, `/register/student`, `/register/teacher` | AuthLayout | Guests |
| `/student/*` | PortalLayout | Student only |
| `/teacher/*` | PortalLayout | Teacher only |
| `/admin/*` | AdminLayout | Admin only |

`ProtectedRoute.jsx` checks the logged-in user and role, then redirects to `/login` or `/403`.

---

## 6. Backend API plan

| Prefix | Purpose |
|---|---|
| `/api/auth` | Register, login, logout, forgot/reset password, me |
| `/api/public` | Courses, services, contact, subscribe |
| `/api/student` | Dashboard, enrollments, profile, documents, fees, notices |
| `/api/teacher` | Students, attendance, timetable, materials, announcements |
| `/api/assignments` | Create, submit, grade, list |
| `/api/quizzes` | Create, publish, take, submit, result, question bank, AI |
| `/api/attendance` | Sessions and marks |
| `/api/fees` | Payments, receipts, statements |
| `/api/documents` | Upload and view files |
| `/api/chat` | Conversations, messages, attachments |
| `/api/calls` | Call logs and signalling metadata |
| `/api/admin` | Students, teachers, enrollments, courses, logs, calls, resets |
| `/api/upload` | Generic upload endpoint |

A detailed endpoint list is in `docs/API.md`.

---

## 7. Database plan

The MySQL schema from the current project is reused. The main table groups are:

| Group | Tables |
|---|---|
| Accounts | `users`, `student_profiles`, `teacher_profiles`, `sessions`, `password_resets`, `login_logs` |
| Courses | `courses`, `teacher_courses`, `enrollments`, `payments` |
| Academics | `assignments`, `submissions` |
| Campus | `attendance_sessions`, `attendance`, `timetable`, `materials`, `announcements` |
| Quizzes | `quizzes`, `quiz_questions`, `question_bank`, `quiz_attempts`, `quiz_answers` |
| Files | `documents` |
| Communication | `chat_messages`, `chat_attachments`, `chat_hidden`, `call_logs` |
| Notices | `notices` |
| Lookups | `lk_user_role`, `lk_enrollment_status`, `lk_notice_audience`, `lk_weekday`, `lk_doc_kind`, `lk_quiz_option` |

Migrations live in `server/database/migrations/`; seed data lives in `server/database/seeds/`.

---

## 8. Mapping from the current project

| Current file / folder | New location |
|---|---|
| `server.js` | `server/src/app.js` + `server/src/server.js` + `server/src/routes/` |
| `portal.js` | `server/src/controllers/auth.controller.js`, `user.controller.js`, `enrollment.controller.js`, `fee.controller.js` |
| `portal-campus.js` | `server/src/controllers/quiz.controller.js`, `questionBank.controller.js`, `attendance.controller.js`, `timetable.controller.js`, `material.controller.js`, `announcement.controller.js` |
| `portal-academics.js` | `server/src/controllers/assignment.controller.js`, `report.controller.js` |
| `portal-admin.js` | `server/src/controllers/admin.controller.js` |
| `portal-realtime.js` | `server/src/sockets/` + `server/src/controllers/chat.controller.js`, `call.controller.js` |
| `js/messages.js` | `client/src/features/chat/` + `client/src/context/SocketContext.jsx` |
| `index.html`, `about.html`, `courses.html`, `industries.html`, `legal.html` | `client/src/features/public-site/pages/` |
| `services/*.html` | `client/src/features/public-site/pages/ServicePage.jsx` (data-driven) |
| `css/style.css` | `client/src/styles/` |
| `k8s/` | `deploy/k8s/` |
| `Dockerfile` | `deploy/docker/Dockerfile.server` |
| `Jenkinsfile` | `.github/workflows/ci.yml` (or keep Jenkins) |
| `handover/` | `docs/` |

---

## 9. Naming conventions

| Item | Convention | Example |
|---|---|---|
| React components | PascalCase | `QuizRunner.jsx` |
| React hooks | camelCase starting with `use` | `useQuizTimer.js` |
| API/service files | kebab-case + `.api.js` | `quiz.api.js` |
| Backend controllers | camelCase + `.controller.js` | `quiz.controller.js` |
| Backend models | camelCase + `.model.js` | `quiz.model.js` |
| Database tables | snake_case | `quiz_attempts` |
| Database columns | snake_case | `created_at` |
| Environment variables | UPPER_SNAKE_CASE | `DB_PASSWORD` |
| Constants | UPPER_SNAKE_CASE | `ROLES.TEACHER` |

---

## 10. Local setup

```bash
# 1. Install dependencies (from the project root)
npm install

# 2. Start MySQL (Docker)
docker compose up -d mysql

# 3. Create the database and run migrations
cd server
cp .env.example .env
npm run db:migrate
npm run db:seed

# 4. Start the API and the React app
cd ..
npm run dev
```

- React: `http://localhost:5173`
- API: `http://localhost:5000/api`
- MySQL: `localhost:3306`

---

## 11. Deployment

- **Local / demo:** `docker compose up --build`
- **Production:** build the client, serve it with Nginx, run the API with Node, and deploy both to k3s using the manifests in `deploy/k8s/`.
- **Environment:** keep secrets in `.env` locally and in a Kubernetes `Secret` in production.

---

## 12. How to explain this to your teacher

You can say:

> “The project follows a **feature-based monorepo** structure. The `client` folder is a React SPA built with Vite. Each feature — auth, public site, student, teacher, admin, quizzes and chat — has its own `pages` and `components`, so the code is modular. The `server` folder is an Express REST API. A request goes through a **route**, then **auth and role middleware**, then a **controller**, then a **service** for business logic, then a **model** that runs parameterised SQL against MySQL. The `database` folder contains migrations and seeds, so the schema is versioned. `shared` holds constants used by both sides, `docs` holds the architecture, API and database documentation, and `deploy` holds Docker, Nginx and Kubernetes files. Realtime chat and calls use Socket.IO and WebRTC. This is the MERN pattern, with MySQL replacing MongoDB.”

Key points to mention:

- **Separation of concerns:** UI, routing, business logic and data access are separate.
- **Role-based access:** student, teacher and admin routes are protected.
- **Reusable components:** buttons, tables, modals and forms live in `components/`.
- **Feature modules:** each business area is self-contained.
- **Versioned database:** migrations and seeds.
- **Deployment-ready:** Docker and Kubernetes files are included.

---

## 13. Suggested implementation phases

| Phase | Work |
|---|---|
| 1 | Set up the monorepo, Vite, Express, MySQL pool and health check |
| 2 | Auth: register, login, JWT/session, role middleware |
| 3 | Public site: home, about, courses, industries, legal, services |
| 4 | Student and teacher portals: dashboard, profile, enrollments, fees |
| 5 | Academics: assignments, attendance, timetable, materials, announcements |
| 6 | Quizzes: question bank, manual/AI creation, audience, fullscreen attempt, results |
| 7 | Chat, attachments and WebRTC calls |
| 8 | Admin panel, audit logs, call logs, reports |
| 9 | Testing, Docker, CI/CD and deployment |

---

## 14. Next steps

1. Confirm the folder structure with your teacher.
2. Create the MySQL database and run the migrations.
3. Implement authentication first (it unlocks every other module).
4. Build one feature end-to-end (for example Courses) before moving to the next.
5. Add tests and deployment once the core features work.
