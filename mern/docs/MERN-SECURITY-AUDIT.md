# TechNexa MERN App — Security Audit & Hardening

- **Date:** 14 November 2026 (initial review) · 16 November 2026 (second pass)
- **Target:** `mern/` — API (`server/`, Express + MySQL), SPA (`client/`, React 18 / Vite)
- **Scope:** Code review (read-only), targeted dynamic tests against a local dev build
  (`localhost:5000` / XAMPP MariaDB, `technexa` database). No production data.
- **Out of scope:** Live legacy app (`54.161.79.42`) — see `SECURITY-AUDIT.md`.
- **Severity model:** Critical / High / Medium / Low.

> Nothing was committed. All changes are local working-tree edits.

---

## 1. Findings (as of 2026-11-14)

### What was already strong (verified — not changed)

- Parameterised queries everywhere; the one template literal
  (`course.service.js` `SELECT ${selectFields} ...`) interpolates a **constant**
  column list, not user input.
- **IDOR checks** on documents (download/delete), quiz attempts/submissions,
  chat attachments, call recordings, quiz submit `WHERE ... AND student_id = ?`.
  Authenticated admins bypass where intended, teachers scoped by course.
- Passwords hashed with **bcrypt** (cost 12); JWT (5 min) in an **HttpOnly,
  SameSite=Lax** cookie; `secure` in production; `req.user` re-fetched from the
  DB on every `attachUser` call.
- **Helmet** (with a custom `crossOriginResourcePolicy`), CORS restricted to
  `CLIENT_URL` + `credentials`, cookie parser, 2 MB JSON limit.
- Uploads stored outside the web root; only `avatars` is statically served;
  extension allow-lists + size caps; `relpath` built server-side.
- No `dangerouslySetInnerHTML` / `innerHTML` / `document.write` / `eval`
  anywhere in `client/src`.
- No secrets in `client/` or tracked files; `.env` not tracked; JWT_SECRET is a
  96-char value in local `.env`.
- `/api/metrics` is `prom-client`, optionally protected with `METRICS_TOKEN`.
- `/api/admin/*` is guarded by `requireAuth + requireRole("admin")`; all 59
  portal routes have `requireAuth` at router level.

### Fixed in this audit

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| M-01 | Critical | **Weak default JWT secret** (`technexa-development-secret`) — if `JWT_SECRET` were ever unset in production, tokens could be forged. | Production refuses to boot unless `JWT_SECRET` is ≥ 32 chars and not an obvious placeholder; fallback only for dev. Used by `attachUser.js` and `sockets/index.js`. |
| M-02 | High | **No rate limiting** anywhere (`express-rate-limit` was a dependency but never imported; login, register, forgot-password, contact, subscribe, enroll all unthrottled). | New `middleware/rateLimit.middleware.js`; `authRateLimiter` (15 / 15 min / IP) on `/auth/login`, `/auth/register/*`, `/auth/forgot-password`, `/auth/reset-password`; `publicFormRateLimiter` (10 / 10 min) on `/contact`, `/subscribe`, `/enroll`. Verified `RateLimit-*` headers (`Limit 15`, remaining decrements). |
| M-03 | High | **Password reset tokens stored in plaintext** in `password_resets` — a DB leak would hand out live 1-hour reset links. | `token` now stores `SHA256(token)`; lookup hashes before compare. Raw token only travels in the email link. |
| M-04 | Medium | Uploads trusted only the file **extension** + random filename. | `verifyMagic()` signature check (JPEG/PNG/WebP/PDF/DOC/DOCX/PPT/HEIC) in `utils/upload.js`, enforced on the sensitive paths: teacher CV, portal avatar, portal documents, and enrollment files (enrollment files deleted + `415` on mismatch). Verified live: fake `<html>` renamed `.png` → **415**, real 1×1 PNG → **201**. |
| M-05 | Medium | `X-Powered-By: Express` disclosed. | `app.disable("x-powered-by")`. |
| M-06 | Medium | `morgan("dev")` in production logs every request in dev format. | `combined` in production, `dev` otherwise. |
| M-07 | Medium | **Internal error details** (`err.message`) leaked to clients for 5xx errors. | Only 4xx errors surface messages in production; 5xx returns generic `"Server error"`. |
| M-08 | High | `nodemailer@6.9.15` — 23 high-severity advisories; `zod@3.23.8` — high advisory (**unused** in both apps). | `nodemailer` → `^10.5.0`; `zod` **removed** from `server` and `client`; `npm audit --omit=dev` → **0 vulnerabilities**. |
| M-09 | Medium | `react-router-dom` 6.x — open-redirect / constructor-injection advisories (moderate). | Upgraded `react-router-dom` → `^7.18.5` (verified: `npm run build` succeeds; routes API compatible). |
| M-10 | Medium | CSRF: SPA relied on `SameSite=Lax` cookies only (no origin check). | Fixed: state-changing requests (`POST/PUT/PATCH/DELETE`) are rejected with `403` when the browser `Origin` header is neither `CLIENT_URL`/`PUBLIC_ORIGIN` nor the request's own origin. Non-browser clients without `Origin` (health checks) still work. |
| M-11 | Low | `sockets`: `call:signal` relays arbitrary payloads to any peer; `chat:send` can message anyone. | Accepted as designed (1:1 comms by an authenticated user); server enforces only presence/auth. No room isolation needed. |
| M-12 | Low | No email verification on signup; teachers are auto-signed-in in `pending`. | Accepted (intentional onboarding flow; admin approves teachers). |
| M-13 | Medium | No `Permissions-Policy`; browser features (camera/mic) were not scoped. | Header set explicitly: `camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()`. Helmet 8 does not ship this middleware, so it is set directly in `app.js`. |
| M-14 | High | **The SPA had no security headers or CSP** — the client container is plain nginx with default config. | `deploy/nginx/default.conf`: CSP (strict `script-src 'self'`), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS, `server_tokens off`. |
| M-15 | Medium | `index.html` had an **inline `<script>`** (theme bootstrap) that a strict CSP blocks. | Moved to `client/public/theme-init.js`, loaded with `<script src="/theme-init.js">`. Behaviour unchanged (same early theme paint). |
| M-16 | Low | Single 555 kB JS bundle (all portal + public screens on every visit). | Route-level `React.lazy` + `Suspense` (`RouteFallback`): entry chunk 555 kB → **277 kB**, portal/public/auth screens split into ~40 chunks. |
| M-17 | — | No regression tests for the security controls. | `server/tests/unit/security.test.js` (`node --test`): headers, JSON 404, **enrollment requires auth (401)**, CSRF origin guard, auth limiter (429 after 15), upload signature checks, production JWT guard. |
| M-18 | High | Public course enrollment could be attempted from the UI without a clear logged-out gate. | Backend `POST /api/enroll` was already protected by `requireAuth` (unauthenticated requests get `401`, verified by test). Frontend hardened: clicking **Enroll Now** while logged out now shows “Please register or log in first to enroll in a course.”, the modal gate states the same and routes to login/register (`?next=...`), and the submit handler refuses to post without an authenticated user (defense in depth). |

---

## 2. Results & verification (2026-11-14)

- **Server boot (dev):** `MySQL connected and course catalogue ready` — OK.
- `GET /api/health` → `200` (minimal body).
- Unknown route → `404` JSON `{ ok: false }`.
- Seeded admin login → `200`, `/api/auth/me` returns user **without** password hash.
- Login response carries `RateLimit-Limit: 15`, `RateLimit-Remaining` decrements.
- Fake image upload (teacher CV) → `415` `CV rejected: PNG signature mismatch`.
- Real PNG upload → `201` (smoke teacher created & deleted afterwards; upload file removed).
- Unknown route / headers / CSP: no `X-Powered-By`; helmet CSP applied.
- **Client:** `npm run build` — React Router v7 renders; no build errors. Entry chunk 277 kB after route splitting.
- **Dependencies:** `npm audit --omit=dev` → **0 vulnerabilities** (root workspace lockfile).
- **Regression tests:** `node --test` in `server/` → **6/6 pass** (`tests/unit/security.test.js`).

### Browser verification of the production CSP (16 Nov 2026)

The built `dist/` was served with the exact headers from `deploy/nginx/default.conf`:

| Check | Result |
|-------|--------|
| Console CSP violations | **0** (before M-15 the inline theme script and both CDNs were blocked) |
| Google Fonts CSS + `fonts.gstatic.com` webfonts | `200` |
| Font Awesome CSS + `fa-solid-900.woff2` | `200`, 46 icons rendered |
| Theme bootstrap (`data-theme`, `theme-color`) | Applied before first paint |
| Public home (`/`) and login (`/login`) under CSP | Render, no errors |
| Dev-server login (`admin@technexa.pk` → portal) | `POST /api/auth/login` `200`, lands on `/portal/dashboard`, portal chunks load, no console errors |

---

## 3. Remaining hardening (deployment-bound)

1. **HTTPS** — HSTS is already sent by nginx but only takes effect once the
   deployment terminates TLS on a real domain. Cookies become `Secure`
   automatically when `NODE_ENV=production`.
2. **Production secrets** — `JWT_SECRET` (≥ 32 random chars) is enforced at boot
   (M-01); `METRICS_TOKEN` should be set; SMTP credentials must come from the
   environment, never the repo.
3. **`.env`** never committed; only `.env.example` tracked — already true.
4. **E-mail verification** for new accounts is still optional; recommending
   admin approval of teacher CVs (already the flow).
5. **Error reporting** (Sentry/log aggregation) — none configured yet.
6. **Uploads:** lower-risk formats (`.txt`, `.ogg`, `.m4a`, `.webm` chat audio)
   are extension-filtered only; add signatures if stricter checks are needed.
7. **CSP third-party allowlist:** the SPA CSP allows `fonts.googleapis.com`,
   `fonts.gstatic.com` and `cdnjs.cloudflare.com` (Font Awesome). Self-hosting
   those assets would let the policy drop to `'self'` only.
8. **CI:** `.github/workflows/ci.yml` now runs `npm test -w server` (the
   security suite) and the client build on every push/PR to `main`.

## 4. Sign-off

The MERN codebase was already in good shape (parameterised SQL, IDOR checks,
HttpOnly cookies, no client-side XSS sinks). The first pass closed the gaps
around JWT handling, rate limiting, reset tokens, uploads and dependencies. The
second pass added the missing browser-facing controls: a CSRF origin guard, a
real CSP for the SPA (verified in a browser, not just in config), Permissions-
Policy, route-level code splitting, and a security regression suite that now
runs in CI. What remains is deployment-bound (TLS, production secrets,
monitoring); none of it is exploitable as the code stands.
