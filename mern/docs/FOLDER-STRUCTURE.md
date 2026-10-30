# Folder Structure — Quick Reference

This is the same structure shown in `README.md`, written as a checklist you can follow while
building the project. Every folder has a single, clear responsibility.

## 1. Tree with notes

```text
mern/
├── client/                          # React frontend (Vite)
│   ├── public/                      # Static files copied as-is
│   ├── src/
│   │   ├── api/                     # One file per backend resource (Axios)
│   │   ├── assets/                  # Images, icons, fonts
│   │   ├── components/
│   │   │   ├── common/              # Button, Input, Modal, Table, Badge, Spinner
│   │   │   ├── layout/              # PublicLayout, PortalLayout, AdminLayout
│   │   │   ├── charts/              # Dashboard charts
│   │   │   └── forms/               # Reusable form controls
│   │   ├── context/                 # AuthContext, SocketContext, ThemeContext
│   │   ├── features/
│   │   │   ├── auth/                # Login, register, forgot/reset password
│   │   │   ├── public-site/         # Home, about, courses, industries, legal
│   │   │   ├── student/             # Student portal pages
│   │   │   ├── teacher/             # Teacher portal pages
│   │   │   ├── admin/               # Admin pages
│   │   │   ├── quizzes/             # Quiz runner, timer, result, question editor
│   │   │   └── chat/                # Chat window, attachments, call overlay
│   │   ├── hooks/                   # Reusable hooks
│   │   ├── routes/                  # Route tables + ProtectedRoute
│   │   ├── utils/                   # Formatters, validators, permissions
│   │   ├── styles/                  # Global CSS / Tailwind
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                          # Node.js + Express backend
│   ├── src/
│   │   ├── config/                  # db.js, env.js, cors.js
│   │   ├── controllers/             # HTTP request/response only
│   │   ├── routes/                  # URL definitions
│   │   ├── models/                  # SQL queries (repository layer)
│   │   ├── services/                # Business logic
│   │   ├── middleware/              # auth, role, validate, upload, error
│   │   ├── validators/              # Zod schemas
│   │   ├── sockets/                 # Socket.IO chat + call signalling
│   │   ├── utils/                   # ApiError, asyncHandler, jwt, logger
│   │   ├── jobs/                    # Cleanup, reminders
│   │   ├── templates/emails/        # Email templates
│   │   ├── app.js                   # Express app
│   │   └── server.js                # HTTP server + Socket.IO
│   ├── database/
│   │   ├── migrations/              # Numbered .sql files
│   │   ├── seeds/                   # Lookups, admin, demo data
│   │   ├── migrate.js               # Migration runner
│   │   ├── seed.js                  # Seed runner
│   │   └── schema.sql               # Fresh-install helper
│   ├── uploads/                     # Runtime files (gitignored)
│   ├── tests/                       # unit / integration / e2e
│   ├── .env.example
│   └── package.json
│
├── shared/                          # Constants used by client and server
│   ├── constants/
│   └── utils/
│
├── docs/                            # Architecture, API, database, deployment
├── deploy/                          # Docker, Nginx, Kubernetes
├── .github/workflows/               # CI/CD
├── docker-compose.yml
├── package.json                     # Root workspace scripts
├── .gitignore
└── README.md
```

## 2. Which folder for which work?

| I want to… | Put the code in… |
|---|---|
| Add a new page | `client/src/features/<area>/pages/` |
| Add a reusable button or modal | `client/src/components/common/` |
| Call a new API endpoint | `client/src/api/<resource>.api.js` |
| Add a protected route | `client/src/routes/` |
| Add a global provider | `client/src/context/` |
| Add a backend endpoint | `server/src/routes/` + `server/src/controllers/` |
| Add business logic | `server/src/services/` |
| Add a SQL query | `server/src/models/` |
| Add a permission check | `server/src/middleware/role.middleware.js` |
| Add a validation rule | `server/src/validators/` |
| Add a Socket.IO event | `server/src/sockets/` |
| Add a database table | `server/database/migrations/` |
| Add default data | `server/database/seeds/` |
| Change deployment | `deploy/` |
| Document something | `docs/` |

## 3. Build order (recommended)

1. **Setup** — root `package.json`, client Vite app, server Express app, MySQL pool, `/api/health`.
2. **Database** — migrations for `users`, `courses`, `enrollments`.
3. **Auth** — register, login, logout, `auth.middleware.js`, `role.middleware.js`.
4. **Public site** — home, about, courses, industries, legal.
5. **Student portal** — dashboard, profile, enrollments, fees, documents.
6. **Teacher portal** — students, attendance, timetable, materials, announcements.
7. **Academics** — assignments, submissions, marks.
8. **Quizzes** — question bank, manual/AI creation, audience, fullscreen attempt, result.
9. **Chat and calls** — Socket.IO, attachments, WebRTC.
10. **Admin** — users, enrollments, courses, logs, call logs, resets.
11. **Testing and deployment** — tests, Docker, CI/CD, k3s.

## 4. File naming rules

| Type | Rule | Example |
|---|---|---|
| React page | PascalCase + `Page` (optional) | `StudentDashboard.jsx` |
| React component | PascalCase | `QuizCard.jsx` |
| React hook | `use` + camelCase | `useQuizTimer.js` |
| API module | kebab-case + `.api.js` | `question-bank.api.js` |
| Controller | camelCase + `.controller.js` | `quiz.controller.js` |
| Model | camelCase + `.model.js` | `quiz.model.js` |
| Service | camelCase + `.service.js` | `quiz.service.js` |
| SQL migration | number + verb + table | `007_create_quizzes.sql` |
| Constant | UPPER_SNAKE_CASE | `ROLES.TEACHER` |

## 5. Import rules (keep the layers clean)

- A **page** may import components, hooks and API modules.
- A **component** may import other components and hooks, but not pages.
- A **controller** may import services, never models directly.
- A **service** may import models and other services.
- A **model** imports only the database pool.
- `shared/` must not import from `client/` or `server/`.

These rules prevent circular dependencies and make the project easy to explain.
