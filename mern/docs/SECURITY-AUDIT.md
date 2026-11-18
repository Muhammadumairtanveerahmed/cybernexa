# TechNexa — Security Audit Report

- **Date:** 14 November 2026
- **Target:** `http://54.161.79.42/` (live EC2 instance, k3s + Traefik), plus host-level grey-box review over SSH
- **Scope:** Non-destructive, authorized assessment of the owner's own infrastructure
- **Tester:** OpenCode (assisted)
- **Out of scope:** Denial of service, data modification/deletion, social engineering, third-party services

> This was a **read-only** assessment. No data was modified or deleted. Two failed-login bursts
> (10 requests each) were sent to verify rate limiting, and one forged session cookie was used to
> read the admin dashboard (GET only).

---

## 1. Executive summary

The application code is in good shape: SQL is parameterised, output is escaped, IDOR checks are
present on documents/quiz results/chat attachments, uploads are type- and size-limited, sessions are
random 256-bit IDs, and SSH/MySQL are hardened.

However, the **admin authentication scheme is fundamentally broken**: the admin session cookie is a
stateless HMAC token whose signing key is derived from a **hardcoded string plus the admin password**.
Because the admin password is the documented demo password, an attacker can **forge a valid admin
cookie and bypass the login entirely**. This was verified: a forged `cnx_admin` cookie returned
`200 OK` on `/admin/dashboard` with no credentials, while an unauthenticated request returned `302`.

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High     | 4 |
| Medium   | 9 |
| Low/Info | 5 |

**Overall risk: HIGH until F-01 is fixed.**

---

## 2. Findings

### F-01 — CRITICAL — Admin session cookie can be forged (auth bypass)

**Where:** `server.js` lines 823–870 (live legacy app)

```js
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_SECRET = crypto
  .createHmac("sha256", "cybernexa-admin-session-v1")   // hardcoded key
  .update(String(ADMIN_PASSWORD))
  .digest("hex");
// token = <exp>.<HMAC-SHA256(ADMIN_SECRET, exp)>
```

The cookie is `cnx_admin=<exp>.<sig>`. Validation (`isAdmin`) only checks the HMAC — it never
touches the database, never checks IP/User-Agent, and has no revocation list.

**Impact:** Anyone who knows (or guesses) the admin password can compute a valid cookie offline and
get **full admin access** — even while the login form is rate-limited. The password is the demo
credential printed in the project handover (`cybernexa****`), and it is only 13 characters.

**Evidence (verified live):**

```
pw=cybernexa****      forged_cookie_admin_dashboard=200   <-- bypass
pw=admin123           forged_cookie_admin_dashboard=302
no cookie             forged_cookie_admin_dashboard=302
```

**Status — 2026-11-14: FIXED (code + credentials).**

1. Admin password rotated to a random 24-char value (see `handover/CREDENTIALS.md`).
2. Real code fix deployed in image `cybernexa:secure-20261114`: an independent random
   `ADMIN_SESSION_KEY` lives in k8s secret `cybernexa-env`; the hardcoded
   `"cybernexa-admin-session-v1"` derivation was removed (random per-boot fallback).
   TTL 12 h → 4 h; password compared exactly.

Verified live: forged cookie (old scheme, correct password) → **302**; `GET /admin/dashboard`
without a cookie → **302**; normal admin login → **302 /admin/dashboard**; site/portal → 200.

**Fix (still recommended):**

1. Add a **random, independent** signing key, e.g. `ADMIN_SESSION_KEY` (64 hex chars) to the k3s
   secret `cybernexa-env`; never derive it from the password.
2. Replace the hardcoded `"cybernexa-admin-session-v1"` with that key.
3. Bind the token to at least a server-side session record (or `UA` + IP hash) and support
   revocation on logout / password change.
4. Longer term: delete this parallel admin auth and use the `users` table with `role='admin'`
   (single auth system, one place to audit).
5. Stop the stale `:3000` instance (F-03) — it still uses the old password in
   `/home/ubuntu/app/.env`, so the old forgery would work there if that port ever becomes reachable.

---

### F-02 — HIGH — Weak, shared and documented credentials + world-readable `.env`

**Where:** `/home/ubuntu/app/.env`, `/home/ubuntu/cybernexa/.env`, k3s secret `cybernexa-env`

- Admin password = the demo password from the handover document (13 chars, guessable pattern).
- Teacher/student demo accounts use simple `Name@YYYY` passwords.
- Both `.env` files are mode `664` (`rw-rw-r--`) and contain `DB_PASSWORD` (24 chars),
  `ADMIN_PASSWORD`, and SMTP settings. Any member of the `docker` group (and `jenkins`) can read them.
- `/opt/technexa-monitoring/.env` is correctly `600 root:root` — use that as the standard.

**Fix:** strong unique passwords per account, `chmod 600` on every `.env`, rotate DB password,
move secrets to the k3s secret only, remove `.env` from the server working copies.

---

### F-03 — HIGH — Stale second instance of the app on `0.0.0.0:3000`

**Where:** `/home/ubuntu/app`, PID 26960 (`node`), listening on `*:3000`

A second copy of the site (older code, its own `.env` with admin + DB creds) is running and bound to
all interfaces. It is currently unreachable only because the AWS Security Group blocks 3000. Any
future SG change, or SSRF from inside the cluster, exposes an older, unaudited build.

**Fix:** stop the process (or bind it to `127.0.0.1`), delete the stale copy of the code, and keep a
single deployment path (the k3s image).

---

### F-04 — HIGH — `ubuntu` has passwordless root + `docker` group; `jenkins` is in `docker` group

```
(ALL) NOPASSWD: ALL          # sudo -l -U ubuntu
docker:x:109:ubuntu,jenkins  # membership of the docker group == root
```

Any compromise of the app, Jenkins, or the `ubuntu` account is an immediate **root** compromise
(docker group can mount the host filesystem; NOPASSWD sudo needs no password).

**Fix:** restrict sudo to specific commands, remove `ubuntu`/`jenkins` from `docker`, run Jenkins
and CI in a rootless container or dedicated user, and use SSM Session Manager instead of broad sudo.

---

### F-05 — HIGH — Jenkins grants full control to any authenticated user

**Where:** `/var/lib/jenkins/config.xml`, `0.0.0.0:8080` (prefix `/jenkins`)

```xml
<useSecurity>true</useSecurity>
<authorizationStrategy class="hudson.security.FullControlOnceLoggedInAuthorizationStrategy">
```

Any account that can log in gets **full administrative control** of Jenkins (install plugins, run
scripts on agents), and Jenkins runs as a user in the `docker` group → host root. It is only
protected by the Security Group today.

**Fix:** switch to Matrix Authorization (least privilege), disable sign-up, bind Jenkins to
`127.0.0.1` behind an authenticated proxy, remove it from the `docker` group, keep it patched.

---

### F-06 — MEDIUM — No rate limiting on the portal login

10 consecutive wrong passwords for a student account all returned `302` (no `429`, no lockout).
Only the admin login has a limiter (10 attempts / 15 min per IP, and it correctly resisted
`X-Forwarded-For` spoofing — Traefik overwrites the header).

**Fix:** add per-IP + per-account throttling (e.g. 5 failures / 15 min, exponential backoff),
CAPTCHA after N failures, and alert on spikes.

---

### F-07 — MEDIUM — Missing security headers

Present: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`.
Missing: `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`
(no valid TLS yet). `X-Powered-By: Express` is disclosed.

**Fix:** add CSP (`default-src 'self'` with the Font Awesome CDN allow-listed), `Referrer-Policy:
strict-origin-when-cross-origin`, `Permissions-Policy`, and disable `X-Powered-By`.

---

### F-08 — MEDIUM — HTTPS serves a self-signed Traefik certificate; site is HTTP-only

`CN=TRAEFIK DEFAULT CERT` — browsers show a warning, so the site is used over plain HTTP. That means
passwords and session cookies travel in clear text on the network.

**Fix:** point a real domain at the instance, issue a Let's Encrypt certificate (Traefik ACME),
redirect 80 → 443, add `Secure` to cookies and enable HSTS.

---

### F-09 — MEDIUM — Session lifetime and cookie flags

Portal sessions last **7 days** (`SESSION_DAYS = 7`) with no idle timeout, rotation, or
"sign out everywhere". Cookies are `HttpOnly; SameSite=Lax` but not `Secure` (HTTP site). The admin
token lives 12 hours and is not revocable server-side.

**Fix:** shorter absolute + idle timeouts, rotate the session ID on login, `Secure` once HTTPS is on,
and keep a server-side session table for admin too.

---

### F-10 — MEDIUM — Patch level

68 packages are upgradable. `unattended-upgrades` is active, but k3s, Docker, Jenkins and Node are
not covered by it. Grafana 11.3.0 and Jetty 12.1.13 are also visible in responses.

**Fix:** monthly patch window, `needrestart`, pin and upgrade Grafana to the latest 11.3.x/12.x,
and track CVEs for k3s/Docker.

---

### F-11 — MEDIUM — No host firewall / fail2ban

`ufw` is inactive and `fail2ban` is not installed. Protection currently relies entirely on the AWS
Security Group and key-only SSH (which is good, but is a single layer).

**Fix:** enable `ufw` (allow 22/80/443 only) and `fail2ban` for SSH, as defence in depth.

---

### F-12 — MEDIUM — Admin token is stateless and not bound to the client

`cnx_admin` is valid for 12 h from any IP/User-Agent; logout only clears the browser cookie. A stolen
or forged cookie (see F-01) remains valid until expiry.

**Fix:** server-side admin sessions with revocation, bind to a UA/IP hash, shorten TTL.

---

### F-13 — MEDIUM — `/healthz` and public version disclosure

`/healthz` returns app name and server time (low risk). `/grafana/api/health` is public and returns
the exact Grafana version — useful for targeting known CVEs.

**Fix:** keep health checks minimal (no build info), restrict `/grafana/api/health` at the proxy if
possible, and keep versions patched.

---

### F-14 — MEDIUM — `trust proxy: true` is broader than needed

`app.set("trust proxy", true)` trusts the whole `X-Forwarded-For` chain. Today Traefik overwrites the
header (spoofing did **not** bypass the admin limiter), but the setting is fragile — a direct-to-pod
path would make IP-based limits spoofable.

**Fix:** `app.set("trust proxy", 1)` (single hop) or the Traefik pod CIDR.

---

### F-15 — LOW — Backups and old source on disk

`/home/ubuntu/cybernexa-src-backup-20261113.tar.gz` (and similar) may contain `.env` files and old
code. They are not web-reachable but widen the blast radius of any host compromise.

**Fix:** store backups encrypted/off-box, delete local copies, verify they contain no secrets.

---

### F-16 — LOW — Stale/duplicate services bound to all interfaces

Listening on `*`: `3000` (stale app), `3001` (Grafana), `6443` (k3s API), `8080` (Jenkins),
`9090` (Prometheus), `31654` (k3s). External scan shows only **22/80/443** open, so the Security
Group is doing the work.

**Fix:** bind every service to `127.0.0.1` (or the pod network) and keep the SG minimal. Add
`127.0.0.1` binds to the monitoring compose file.

---

### F-17 — LOW — `ADMIN_PASSWORD` compared case-insensitively and trimmed

Lower-casing a password reduces its entropy and makes it case-insensitive.

**Fix:** compare exact bytes; hash with scrypt/argon2 like the portal users.

---

### F-18 — INFO — TRACE/PUT/DELETE/CORS

`TRACE`, `PUT`, `DELETE`, `OPTIONS` return `404`; no CORS headers are emitted. Good.

### F-19 — INFO — Grafana/Prometheus exposure

Grafana has anonymous access disabled and sits behind its own login; Prometheus is behind basic auth
(verified `401` without credentials, `200` with). Credentials are documented internally — rotate
them and keep them out of public repos.

---

## 3. What is already done well

- **SQL injection:** all queries use parameterised statements (`pool.query(sql, params)`) — `'`
  payloads produced no errors and no data leakage.
- **XSS:** query-string payloads are HTML-escaped (`&lt;script&gt;`), not reflected raw; the few
  `innerHTML` uses are static template strings.
- **IDOR:** `/portal/file/:id` enforces `doc.user_id === req.user.id`; quiz results filter by
  `student_id`; chat attachments check sender/recipient/uploader; all tested routes returned
  403/404.
- **SQL/error leakage:** none on malformed IDs (`302`/graceful pages, no stack traces).
- **Open redirect:** `next=` values are ignored — always redirects to `/portal/dashboard`.
- **Sessions:** 32 random bytes (`crypto.randomBytes(32)`), `HttpOnly`, `SameSite=Lax`, DB-backed
  with expiry; logout invalidates server-side.
- **Passwords:** scrypt with per-user salt and `timingSafeEqual`; min length + letter/digit policy.
- **Uploads:** extension allow-list, size caps, stored outside the web root, `/uploads/*` returns
  `403` except avatars; no path traversal.
- **Static file serving:** allow-list guard blocks source, `.env`, `data/`, `deploy/`, `scripts/`;
  traversal payloads all `404`.
- **SSH:** key-only (`PasswordAuthentication no`), root login prohibited, `MaxAuthTries 6`,
  no failed-login noise in the last 7 days.
- **MySQL:** listens on `127.0.0.1` only; app users are `localhost` only.
- **Monitoring:** exporters bound to loopback; Grafana anonymous off; Prometheus authenticated.
- **DataTables fix** is live and the portal/admin pages boot without the warning.

---

## 4. Prioritised remediation plan

### This week (critical/high)

1. **F-01** — random `ADMIN_SESSION_KEY`, strong admin password, rotate, add server-side admin
   sessions. *(This single fix removes the only confirmed auth bypass.)*
2. **F-02** — `chmod 600` on both `.env` files, rotate DB and admin passwords, stop printing
   credentials in handover docs.
3. **F-03** — kill the stale `:3000` instance and delete `/home/ubuntu/app`.
4. **F-04/F-05** — tighten sudo, remove `docker` group membership, switch Jenkins to matrix auth and
   loopback binding.

### Next sprint (medium)

5. **F-06** — login throttling for portal users.
6. **F-07** — CSP, Referrer-Policy, Permissions-Policy, drop `X-Powered-By`.
7. **F-08** — real TLS certificate + HTTPS redirect + `Secure` cookies + HSTS.
8. **F-09/F-12** — shorter sessions, rotation, server-side admin sessions.
9. **F-11** — ufw + fail2ban.
10. **F-14** — `trust proxy: 1`.
11. **F-10** — patch cycle.

### Housekeeping (low)

12. **F-13, F-15, F-16, F-17** — bind services to loopback, encrypted off-box backups, exact
    password compare, reduce version disclosure.

---

## 5. Verification commands (safe to re-run)

```bash
# Headers
curl -sI http://54.161.79.42/portal/login | grep -Ei 'content-security|x-frame|x-content|referrer|permissions|server|x-powered'

# Exposed files (all should be 404)
for p in server.js portal.js package.json .env .git/HEAD data/messages.json; do
  printf '%-28s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "http://54.161.79.42/$p")"
done

# Admin gate (should be 302 without a valid cookie)
curl -s -o /dev/null -w '%{http_code}\n' http://54.161.79.42/admin/dashboard

# After F-01 fix, a forged cookie must return 302:
# (compute exp + HMAC with the OLD key/password -- must fail)
```

```bash
# Host checks
sudo ss -ltnpH
sudo sshd -T | grep -Ei 'passwordauth|permitroot|maxauth'
sudo ls -l /home/ubuntu/*/.env
sudo -l -U ubuntu
getent group docker
apt list --upgradable | grep -c upgradable
```

---

## 6. Sign-off

No data was changed during this assessment. The only confirmed exploitation was the admin cookie
forgery (F-01), used for a single `GET /admin/dashboard` to prove impact. All other tests were
read-only probes. Fix F-01 before any public demo or submission.

---

## 7. Applied hardening (2026-11-14, live deploy)

Image: `cybernexa:secure-20261114` (deployment `cybernexa`, imagePullPolicy `Never`).
Rollback: `kubectl set image deploy/cybernexa cybernexa=cybernexa:dtfix-20261113 && kubectl rollout status deploy/cybernexa`.
Source: `/home/ubuntu/cybernexa` (server.js / portal.js, tagged with marker `SEC-HARDENING-2026-11-14`).
Pre-patch backups: `/home/ubuntu/backups/server.js.pre-sec-20261114`, `portal.js.pre-sec-20261114`,
`cybernexa-web.pre-jenkins-20261114.yaml`, `cybernexa-websecure.pre-jenkins-20261114.yaml`,
`jenkins-ingress.pre-auth-20261114.yaml`, `jenkins-basic-auth.txt` (0600).

### Application (server.js / portal.js)

- **F-01 proper fix:** independent random `ADMIN_SESSION_KEY` (64 hex) added to k8s secret
  `cybernexa-env`; hardcoded `"cybernexa-admin-session-v1"` derivation removed (falls back to a
  random per-boot key if unset); `ADMIN_TTL_MS` 12 h → **4 h**; admin password compared
  **exactly** (no lowercasing); verified forged cookie (correct password, old scheme) → **302**.
- **F-06 fixed:** login throttle — 6 failed attempts / 15 min per IP+account pair (admin keeps its
  own 10/15 min limiter); verified 7th attempt → "Too many attempts".
- **F-07 fixed:** `Content-Security-Policy` (allow-listed CDNs), `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `X-Powered-By` removed; static verified.
- **CSRF defence in depth:** state-changing requests with an `Origin` whose host differs from
  `Host` → `403`.
- **F-14 fixed:** `app.set("trust proxy", 1)`.
- **F-13 fixed:** `/healthz` → `{"ok":true}` only.
- **F-09 partial:** portal `SESSION_DAYS` 7 → **2** days.
- Verified: site/portal/admin 200, student login → `/portal/dashboard`, admin → `/admin/dashboard`,
  allow-list files still 404, no source exposure.

### Infrastructure

- **F-02 (partial):** `/home/ubuntu/cybernexa/.env` and `/home/ubuntu/app/.env` → `0600`.
- **F-03 fixed:** stale PM2 app (`myapp`, PID 26960) deleted, resurrection list cleared; port 3000
  closed; `/home/ubuntu/app` remains on disk but unmanaged (`.env` 0600).
- **F-11 (partial):** `fail2ban` installed, `sshd` jail active (maxretry 4 / 1 h ban). UFW not
  enabled — k3s/Docker manage their own iptables; the AWS Security Group remains the perimeter.
- **F-05 (partial):** Jenkins is publicly exposed via an unauthenticated **k8s Ingress**
  (`path: /jenkins`, host `*`) — Traefik route was never the one serving it. Added Traefik
  basic auth (`jenkins` user, random 24-char password, stored in
  `/home/ubuntu/backups/jenkins-basic-auth.txt`) via annotation
  `traefik.ingress.kubernetes.io/router.middlewares=default-jenkins-auth@kubernetescrd`, plus the
  same middleware on the `cybernexa-web` / `cybernexa-websecure` IngressRoutes. Verified
  `/jenkins/login` → **401** without credentials (realm `traefik`). Note: 401 with credentials is
  **Jenkins's own login** (realm `Jenkins`) — double auth is by design.
- **F-01 credentials:** admin password rotated to a random 24-char value (in `handover/CREDENTIALS.md`).

### Not done (needs a decision / domain)

- **F-08:** TLS — requires a real domain + Let's Encrypt (Traefik already has an ACME resolver).
  Until then: plain HTTP, no `Secure` cookie flag, no HSTS. Also enables `Secure` on Set-Cookie.
- **F-04:** `ubuntu` passwordless sudo + `docker` group members unchanged.
- **F-05 internal:** Jenkins still `FullControlOnceLoggedIn` (perimeter basic auth is the current
  defence; only 2 Jenkins users exist).
- **F-10:** system packages not upgraded; Grafana 11.3.0 visible via `/grafana/api/health`.
- **F-12:** admin token remains stateless (but now backed by an independent random key, TTL 4 h).
- **F-15:** `/home/ubuntu/cybernexa-src-backup-20261113.tar.gz` kept on disk — verify/remove.
- **F-02 remainder:** DB password not rotated (would require `mysql` + `cybernexa-env` coordinated
  rotation and a rolling restart).
- `handover/cybernexa-handover.zip` predates the password rotation — regenerate on delivery.
