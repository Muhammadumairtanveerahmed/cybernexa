# Architecture — React + Node.js + Express + MySQL

## 1. High-level architecture

| Layer | Components | Connects to |
|---|---|---|
| Browser | React SPA, React Router, React Query, Axios, Socket.IO client | Express API over HTTPS/REST and WebSocket |
| API | Express routes, middleware, controllers, services, models | MySQL over SQL and the uploads volume |
| Data | MySQL 8 | API |
| Files | Uploads volume or S3 | API |

The browser sends REST requests and WebSocket events to the Express API. The API uses a `mysql2`
connection pool for SQL and writes uploaded files to the uploads volume.

## 2. Backend layers

| Layer | Responsibility | Example |
|---|---|---|
| Route | URL + HTTP method + middleware chain | `router.post("/:id/submit", auth, role("student"), submitQuiz)` |
| Middleware | Auth, roles, validation, uploads, errors | `requireRole("teacher")` |
| Controller | Read `req`, call a service, send `res` | `quiz.controller.js` |
| Service | Business rules and orchestration | Score calculation, AI generation |
| Model | SQL queries and row mapping | `quiz.model.js` |
| Config | Database pool, environment, CORS | `config/db.js` |

**Rule:** controllers do not write SQL, and models do not send HTTP responses. This keeps the code testable.

## 3. Frontend layers

| Layer | Responsibility | Example |
|---|---|---|
| Page | Route-level screen | `student/pages/Dashboard.jsx` |
| Feature component | UI for one business area | `QuizRunner.jsx` |
| Common component | Reusable UI | `Button.jsx`, `Modal.jsx` |
| API module | HTTP calls for one resource | `quiz.api.js` |
| Context | Global state | `AuthContext.jsx` |
| Hook | Reusable behaviour | `useQuizTimer.js` |

## 4. Authentication

Recommended: **JWT in an httpOnly cookie**.

1. `POST /api/auth/login` verifies the password with `bcrypt`.
2. The server signs a JWT containing `{ id, role }` and sets it in an httpOnly cookie.
3. `auth.middleware.js` verifies the token on every protected request.
4. `role.middleware.js` checks `req.user.role`.
5. `POST /api/auth/logout` clears the cookie.

Alternative: server-side sessions in MySQL, as in the current implementation. Either is acceptable; JWT is more common in MERN projects.

## 5. Realtime

```text
1. Student A emits "message:send" through Socket.IO.
2. The API saves the message in MySQL.
3. The API emits "message:new" to Student B.

Call:
1. The caller emits "call:offer".
2. The callee answers with "call:answer".
3. Audio and video flow peer-to-peer through WebRTC.
4. TURN is used when a direct connection is not possible.
```

- Chat messages are persisted before they are emitted.
- Call logs store metadata only (caller, callee, type, status, timestamps, duration).
- Attachments are served only to the two participants.

## 6. Quiz flow

```text
Teacher creates quiz
  ├── manual questions
  ├── questions copied from the question bank
  └── AI-generated questions (OpenAI or template fallback)

Student opens quiz
  ├── audience check (all students or course-enrolled)
  ├── fullscreen request
  ├── one question at a time (Previous / Next)
  ├── timer with auto-submit
  └── submit

Server scores the attempt
  ├── writes quiz_attempts (score, total, status)
  ├── writes quiz_answers (choice, correct, marks)
  └── returns score / total / percentage / grade

Student and teacher see total marks
```

## 7. Error handling

- `ApiError` carries an HTTP status and a safe message.
- `asyncHandler` wraps async controllers so rejected promises reach the error middleware.
- `error.middleware.js` returns a consistent JSON shape:

```json
{ "ok": false, "message": "Quiz not found" }
```

## 8. Security checklist

- Passwords hashed with bcrypt (or scrypt).
- JWT/session in an httpOnly, SameSite cookie.
- Role checks on every protected route.
- Parameterised SQL queries only.
- File access checked against the user and role.
- Login rate limiting.
- Helmet security headers.
- CORS restricted to the client origin.
- Secrets in environment variables.
