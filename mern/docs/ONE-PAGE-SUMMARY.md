# TechNexa — One-Page Project Summary

**Stack:** React 18 + Vite · Node.js 20 + Express 4 · MySQL / MariaDB · Socket.IO · WebRTC · JWT (httpOnly cookie)

> **Note:** MERN ka “M” MongoDB hota hai. Is project mein MySQL use ho raha hai, is liye stack ka
> sahi naam **React + Node.js + Express + MySQL** hai. Folder pattern MERN jaisa hi hai; database
> driver `mysql2` hai.

## Top-level structure

```text
mern/
├── client/              # React single-page application (Vite)
├── server/              # Express REST API + Socket.IO
├── shared/              # Constants shared by both sides
├── docs/                # Architecture, API, database and deployment notes
├── deploy/              # Docker, Nginx and Kubernetes examples
├── docker-compose.yml
└── package.json         # npm workspace scripts
```

## Client (React)

```text
client/src/
├── api/                 # axios.js, auth.api.js, portal.api.js
├── context/             # AuthContext (logged-in user + role)
├── features/
│   ├── auth/            # login, student/teacher registration, forgot/reset
│   ├── public-site/     # home, about, courses, industries, legal, service pages
│   └── portal/          # role-aware portal pages + shared components
├── hooks/               # useFetch, useCall (WebRTC)
├── routes/              # public, protected and role-guarded routes
├── styles/              # site.css, portal.css, portal-extra.css, global.css
└── utils/               # date/number formatters and initials
```

Portal routes live under `/portal/*` and are guarded by `ProtectedRoute` plus role checks.
Students, teachers and admins share the same layout but see only their allowed navigation and pages.

## Server (Express + MySQL)

```text
server/src/
├── config/db.js         # mysql2 pool, UTC sessions
├── middleware/          # JWT cookie auth, role checks, current user
├── models/              # small reusable user query helpers
├── routes/
│   ├── auth.routes.js   # register, login, logout, forgot/reset password
│   ├── public.routes.js # public courses, contact, newsletter, enrollment
│   ├── portal.routes.js # student/teacher/admin portal APIs
│   ├── admin.routes.js  # admin-only CRUD, logs, payments, reset links
│   └── index.js
├── services/            # course catalogue helpers
├── sockets/index.js     # realtime chat, presence, call signalling + call logs
├── utils/               # ApiError, asyncHandler, ids, mail, uploads, validation
├── app.js
└── server.js

server/database/
├── migrations/          # numbered SQL migrations
├── seeds/               # demo accounts and realistic sample data
├── migrate.js
└── seed.js
```

## Request flow

```text
1. React page calls an Axios function in client/src/api/.
2. Axios sends the request with the httpOnly JWT cookie.
3. Express route middleware verifies the user and role.
4. The route handler runs parameterised SQL through the mysql2 pool.
5. MySQL returns rows; the API responds with JSON.
6. useFetch stores the result and the page re-renders.
7. Socket.IO pushes chat, presence and call events in realtime.
```

## Role-based routes

| Area | Path | Access |
|---|---|---|
| Public site | `/`, `/about`, `/courses`, `/industries`, `/legal`, `/services/*` | Everyone |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password` | Guests |
| Portal | `/portal/dashboard`, `/portal/courses`, `/portal/messages`, ... | Signed-in users |
| Student pages | `/portal/assignments`, `/portal/quizzes`, `/portal/fees`, ... | Student |
| Teacher pages | `/portal/students`, `/portal/question-bank`, `/portal/attendance`, ... | Teacher |
| Admin pages | `/portal/teachers`, `/portal/enrollments`, `/portal/subscribers`, `/portal/logs`, ... | Admin |

## Security and privacy

1. JWT is stored in an **httpOnly cookie**, not localStorage.
2. Every protected API checks authentication and role.
3. Documents and chat attachments are served only through authenticated API routes.
4. Students can only open their own documents, attempts and payments.
5. Chat is private between the two participants; admins can moderate through admin tools.
6. Calls record both voices from the caller side; both participants see a recording indicator.
7. Call recordings are private files and are played through authenticated API routes only.
8. Passwords are hashed with bcrypt; reset tokens expire after one hour.
9. All app timestamps are stored and compared in **UTC**.

## Viva / teacher explanation

> “This is a feature-based monorepo. React handles the UI, Express exposes a REST API, and MySQL
> stores relational data. A request passes through authentication and role middleware, then a route
> handler that uses parameterised SQL. Socket.IO handles realtime chat and WebRTC call signalling.
> The schema is versioned with migrations and seeded with demo data.”

## Run locally

```bash
cd mern
npm install
cp server/.env.example server/.env
npm run db:migrate
npm run db:seed
npm run dev
```

- React: `http://localhost:5173`
- API: `http://localhost:5000/api`
- Health: `http://localhost:5000/api/health`

Demo accounts are listed in `mern/README.md`.
