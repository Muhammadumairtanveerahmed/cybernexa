import client from "prom-client";
import { pool } from "./db.js";

/**
 * TechNexa monitoring registry.
 *
 * Every metric is prefixed with `technexa_` so it is easy to find in
 * Prometheus / Grafana. The endpoint is exposed at GET /metrics.
 */

export const registry = new client.Registry();

registry.setDefaultLabels({ app: "technexa-api" });

// Node.js runtime metrics: CPU, memory, event loop, GC, handles, uptime.
client.collectDefaultMetrics({
  register: registry,
  prefix: "technexa_"
});

/* ------------------------------------------------------------------ */
/* HTTP traffic                                                        */
/* ------------------------------------------------------------------ */

export const httpRequestsTotal = new client.Counter({
  name: "technexa_http_requests_total",
  help: "Total number of HTTP requests handled by the API.",
  labelNames: ["method", "route", "status"],
  registers: [registry]
});

export const httpRequestDuration = new client.Histogram({
  name: "technexa_http_request_duration_seconds",
  help: "HTTP request duration in seconds.",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry]
});

export const httpRequestsInFlight = new client.Gauge({
  name: "technexa_http_requests_in_flight",
  help: "HTTP requests currently being processed.",
  registers: [registry]
});

export const httpErrorsTotal = new client.Counter({
  name: "technexa_http_errors_total",
  help: "HTTP requests that ended with a 5xx status code.",
  labelNames: ["method", "route", "status"],
  registers: [registry]
});

function routeLabel(req) {
  // Express fills req.route only when a handler matched. Parameterised routes
  // (e.g. /api/portal/quizzes/:id) keep label cardinality low.
  if (req.route && req.route.path) {
    const base = req.baseUrl || "";
    const path = req.route.path === "/" ? "" : req.route.path;
    return `${base}${path}` || "/";
  }
  if (req.baseUrl) return `${req.baseUrl}/*`;
  return "unmatched";
}

export function metricsMiddleware(req, res, next) {
  if (req.path === "/metrics") return next();

  httpRequestsInFlight.inc();
  const stopTimer = httpRequestDuration.startTimer();

  res.on("finish", () => {
    httpRequestsInFlight.dec();
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status: String(res.statusCode)
    };
    httpRequestsTotal.inc(labels);
    stopTimer(labels);
    if (res.statusCode >= 500) httpErrorsTotal.inc(labels);
  });

  next();
}

/* ------------------------------------------------------------------ */
/* Database pool                                                       */
/* ------------------------------------------------------------------ */

const dbPoolConnections = new client.Gauge({
  name: "technexa_db_pool_connections",
  help: "MySQL connection pool usage by state.",
  labelNames: ["state"],
  registers: [registry],
  collect() {
    this.reset();
    const core = pool.pool || pool;
    const used = Array.isArray(core._allConnections) ? core._allConnections.length : 0;
    const free = Array.isArray(core._freeConnections) ? core._freeConnections.length : 0;
    const queued = Array.isArray(core._connectionQueue) ? core._connectionQueue.length : 0;
    this.set({ state: "used" }, used);
    this.set({ state: "free" }, free);
    this.set({ state: "queued" }, queued);
    this.set({ state: "limit" }, Number(pool.pool?._connectionLimit || 10));
  }
});

/* ------------------------------------------------------------------ */
/* Real-time (Socket.IO)                                               */
/* ------------------------------------------------------------------ */

export const onlineUsers = new client.Gauge({
  name: "technexa_online_users",
  help: "Distinct users currently connected over Socket.IO.",
  registers: [registry]
});

export const socketConnections = new client.Gauge({
  name: "technexa_socket_connections",
  help: "Active Socket.IO connections.",
  registers: [registry]
});

/* ------------------------------------------------------------------ */
/* Business metrics (read straight from MySQL)                         */
/* ------------------------------------------------------------------ */

function dbGauge({ name, help, sql, labelName = null, defaultLabels = [] }) {
  const labelNames = labelName ? [labelName] : [];
  return new client.Gauge({
    name,
    help,
    labelNames,
    registers: [registry],
    async collect() {
      this.reset();
      if (labelName) {
        for (const label of defaultLabels) {
          this.set({ [labelName]: String(label) }, 0);
        }
      }
      try {
        const [rows] = await pool.query(sql);
        for (const row of rows) {
          const value = Number(row.value) || 0;
          if (labelName) {
            this.set({ [labelName]: String(row.label ?? "unknown") }, value);
          } else {
            this.set(value);
          }
        }
      } catch {
        // Database unavailable: keep serving the rest of the metrics.
      }
    }
  });
}

dbGauge({
  name: "technexa_users_total",
  help: "Registered users grouped by role and account status.",
  labelName: "label",
  sql: "SELECT CONCAT(role, '/', status) AS label, COUNT(*) AS value FROM users GROUP BY role, status"
});

dbGauge({
  name: "technexa_enrollments_total",
  help: "Course enrollments grouped by approval status.",
  labelName: "status",
  defaultLabels: ["pending", "approved", "rejected", "completed"],
  sql: "SELECT status AS label, COUNT(*) AS value FROM enrollments GROUP BY status"
});

dbGauge({
  name: "technexa_quiz_attempts_total",
  help: "Quiz attempts grouped by status.",
  labelName: "status",
  defaultLabels: ["in_progress", "submitted"],
  sql: "SELECT status AS label, COUNT(*) AS value FROM quiz_attempts GROUP BY status"
});

dbGauge({
  name: "technexa_quiz_violations_total",
  help: "Recorded quiz violations grouped by type.",
  labelName: "type",
  defaultLabels: ["screen_hidden", "window_blur", "fullscreen_exit", "page_leave", "copy_attempt", "other"],
  sql: "SELECT violation_type AS label, COUNT(*) AS value FROM quiz_violations GROUP BY violation_type"
});

dbGauge({
  name: "technexa_login_events_total",
  help: "Login attempts recorded, grouped by outcome.",
  labelName: "status",
  defaultLabels: ["success", "failed", "suspended", "blocked"],
  sql: "SELECT status AS label, COUNT(*) AS value FROM login_logs GROUP BY status"
});

dbGauge({
  name: "technexa_call_logs_total",
  help: "Audio/video calls grouped by final status.",
  labelName: "status",
  defaultLabels: ["missed", "answered", "rejected", "ended"],
  sql: "SELECT status AS label, COUNT(*) AS value FROM call_logs GROUP BY status"
});

dbGauge({
  name: "technexa_contact_messages_total",
  help: "Messages received from the public contact form.",
  sql: "SELECT COUNT(*) AS value FROM contact_messages"
});

dbGauge({
  name: "technexa_subscribers_total",
  help: "Newsletter subscribers.",
  sql: "SELECT COUNT(*) AS value FROM subscribers"
});

dbGauge({
  name: "technexa_quiz_violations_last_24h",
  help: "Quiz violations recorded in the last 24 hours.",
  labelName: "type",
  sql: `SELECT violation_type AS label, COUNT(*) AS value
          FROM quiz_violations
         WHERE created_at >= NOW() - INTERVAL 1 DAY
         GROUP BY violation_type`
});

dbGauge({
  name: "technexa_logins_last_24h",
  help: "Login attempts in the last 24 hours grouped by outcome.",
  labelName: "status",
  sql: `SELECT status AS label, COUNT(*) AS value
          FROM login_logs
         WHERE created_at >= NOW() - INTERVAL 1 DAY
         GROUP BY status`
});

dbGauge({
  name: "technexa_new_users_last_24h",
  help: "New accounts created in the last 24 hours.",
  sql: "SELECT COUNT(*) AS value FROM users WHERE created_at >= NOW() - INTERVAL 1 DAY"
});

/* ------------------------------------------------------------------ */
/* Application events                                                  */
/* ------------------------------------------------------------------ */

export const aiQuizGenerationTotal = new client.Counter({
  name: "technexa_ai_quiz_generation_total",
  help: "AI quiz generation requests grouped by provider and result.",
  labelNames: ["provider", "result"],
  registers: [registry]
});

export const loginAttemptsTotal = new client.Counter({
  name: "technexa_login_attempts_total",
  help: "Login attempts handled by the API grouped by outcome.",
  labelNames: ["role", "result"],
  registers: [registry]
});

export const enrollmentsSubmittedTotal = new client.Counter({
  name: "technexa_enrollments_submitted_total",
  help: "Enrollment applications submitted through the public site.",
  registers: [registry]
});

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export async function metricsHandler(req, res) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const header = req.headers.authorization || "";
    if (header !== `Bearer ${token}`) {
      res.status(401).json({ ok: false, message: "Metrics token required" });
      return;
    }
  }

  try {
    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

export function setOnlineUsers(count) {
  onlineUsers.set(Number(count) || 0);
}
