# API Reference (planned)

Base URL: `http://localhost:5000/api`

All responses use JSON. Protected routes require a valid JWT/session cookie.

Standard success shape:

```json
{ "ok": true, "data": { } }
```

Standard error shape:

```json
{ "ok": false, "message": "Human-readable error" }
```

## 1. Auth

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register/student` | Public | Register a student |
| POST | `/auth/register/teacher` | Public | Apply as a teacher |
| POST | `/auth/login` | Public | Login (student, teacher or admin) |
| POST | `/auth/logout` | Auth | Logout |
| GET | `/auth/me` | Auth | Current user |
| POST | `/auth/forgot-password` | Public | Request a reset link |
| POST | `/auth/reset-password` | Public | Reset with a token |
| PATCH | `/auth/profile` | Auth | Update profile |
| POST | `/auth/avatar` | Auth | Upload avatar |

## 2. Public

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/public/courses` | Public | Course catalogue |
| GET | `/public/courses/:id` | Public | Course details |
| GET | `/public/services` | Public | Service pages |
| POST | `/public/contact` | Public | Contact form |
| POST | `/public/subscribe` | Public | Newsletter |
| GET | `/public/sitemap` | Public | Sitemap data |

## 3. Student

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/student/dashboard` | Student | Dashboard summary |
| GET | `/student/enrollments` | Student | My enrollments |
| POST | `/student/enrollments` | Student | Apply for a course |
| GET | `/student/documents` | Student | My documents |
| POST | `/student/documents` | Student | Upload a document |
| GET | `/student/fees` | Student | Fee summary and payments |
| GET | `/student/notices` | Student | My notices |
| GET | `/student/attendance` | Student | Attendance summary |
| GET | `/student/timetable` | Student | Weekly timetable |
| GET | `/student/materials` | Student | Course materials |
| GET | `/student/marks` | Student | Marks and results |
| GET | `/student/transcript` | Student | Printable transcript |

## 4. Teacher

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/teacher/dashboard` | Teacher | Teaching summary |
| GET | `/teacher/students` | Teacher | Students in my courses |
| GET | `/teacher/courses` | Teacher | Assigned courses |
| GET | `/teacher/attendance` | Teacher | Attendance sessions |
| POST | `/teacher/attendance` | Teacher | Save attendance |
| GET | `/teacher/timetable` | Teacher | My timetable |
| POST | `/teacher/timetable` | Teacher | Add a slot |
| DELETE | `/teacher/timetable/:id` | Teacher | Remove a slot |
| GET | `/teacher/materials` | Teacher | Course materials |
| POST | `/teacher/materials` | Teacher | Upload material |
| GET | `/teacher/announcements` | Teacher | Course announcements |
| POST | `/teacher/announcements` | Teacher | Post an announcement |
| GET | `/teacher/marks` | Teacher | Course results |

## 5. Assignments

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/assignments` | Student/Teacher | List assignments |
| POST | `/assignments` | Teacher | Create an assignment |
| GET | `/assignments/:id` | Student/Teacher | Assignment details |
| POST | `/assignments/:id/submit` | Student | Submit work |
| POST | `/assignments/:id/grade` | Teacher | Grade a submission |
| DELETE | `/assignments/:id` | Teacher | Delete an assignment |

## 6. Quizzes

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/quizzes` | Student/Teacher | List quizzes (role-aware) |
| POST | `/quizzes` | Teacher | Create a quiz (manual or from bank) |
| GET | `/quizzes/:id` | Student/Teacher | Quiz details |
| PATCH | `/quizzes/:id/status` | Teacher | Publish or close |
| DELETE | `/quizzes/:id` | Teacher | Delete a quiz |
| GET | `/quizzes/:id/take` | Student | Start or resume an attempt |
| POST | `/quizzes/:id/submit` | Student | Submit answers |
| GET | `/quizzes/:id/result` | Student | Result and answer review |
| GET | `/quizzes/:id/attempts` | Teacher | Attempts and scores |
| POST | `/quizzes/ai-generate` | Teacher | Generate questions with AI |
| GET | `/question-bank` | Teacher | List bank questions |
| POST | `/question-bank` | Teacher | Add a bank question |
| DELETE | `/question-bank/:id` | Teacher | Delete a bank question |

## 7. Fees

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/fees` | Student/Admin | Fee records |
| POST | `/fees/payments` | Admin | Record a payment |
| PATCH | `/fees/:enrollmentId/total` | Admin | Update the total |
| GET | `/fees/:id/receipt` | Student/Admin | Receipt data |
| GET | `/fees/:id/statement` | Student/Admin | Statement data |

## 8. Documents

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/documents` | Auth | List accessible documents |
| POST | `/documents` | Auth | Upload a document |
| GET | `/documents/:id` | Auth (owner/role) | View or download |
| DELETE | `/documents/:id` | Owner/Admin | Delete |

## 9. Chat

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/chat/contacts` | Auth | People I can chat with |
| GET | `/chat/history/:userId` | Auth | Conversation history |
| POST | `/chat/messages` | Auth | Send a message |
| PATCH | `/chat/messages/:id` | Auth (sender) | Edit a message |
| DELETE | `/chat/messages/:id` | Auth | Delete for me or everyone |
| POST | `/chat/upload` | Auth | Upload an attachment |
| GET | `/chat/file/:id` | Participant only | Private file viewer |
| GET | `/chat/unread` | Auth | Unread counts |

## 10. Calls

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/calls` | Auth | Create a call log |
| PATCH | `/calls/:id/answer` | Participant | Mark answered |
| PATCH | `/calls/:id/end` | Participant | Mark ended and compute duration |
| GET | `/calls` | Auth | My call history |
| GET | `/admin/calls` | Admin | All call logs |
| GET | `/admin/calls.csv` | Admin | CSV export |

## 11. Admin

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/admin/dashboard` | Admin | Statistics and queues |
| GET | `/admin/students` | Admin | Student list |
| GET | `/admin/teachers` | Admin | Teacher list and applications |
| PATCH | `/admin/teachers/:id/decision` | Admin | Approve or reject |
| POST | `/admin/teachers/:id/assign` | Admin | Assign a course |
| GET | `/admin/enrollments` | Admin | Enrollment list |
| PATCH | `/admin/enrollments/:id/status` | Admin | Update status |
| POST | `/admin/enrollments/:id/payment` | Admin | Record a payment |
| GET | `/admin/courses` | Admin | Course list |
| POST | `/admin/courses` | Admin | Create a course |
| PATCH | `/admin/courses/:id` | Admin | Update a course |
| DELETE | `/admin/courses/:id` | Admin | Delete a course |
| GET | `/admin/campus` | Admin | Campus overview |
| GET | `/admin/assignments` | Admin | Assignment overview |
| GET | `/admin/logs` | Admin | Login audit logs |
| GET | `/admin/logs.csv` | Admin | CSV export |
| GET | `/admin/notices` | Admin | Notices |
| POST | `/admin/notices` | Admin | Create a notice |
| GET | `/admin/resets` | Admin | Password reset requests |
| POST | `/admin/resets/:id/link` | Admin | Generate a reset link |

## 12. Uploads

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/upload` | Auth | Generic upload (field + folder) |
| GET | `/uploads/:folder/:file` | Auth/owner | Static file access |

## 13. Health

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | Liveness/readiness check |
