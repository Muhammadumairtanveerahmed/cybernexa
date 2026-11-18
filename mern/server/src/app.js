import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import apiRouter from "./routes/index.js";
import { attachUser } from "./middleware/attachUser.js";
import { metricsHandler, metricsMiddleware } from "./config/metrics.js";
import { uploadRoot } from "./utils/upload.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  })
);
// helmet 8 does not ship Permissions-Policy, so set it ourselves. WebRTC calls
// need camera + microphone from our own origin only.
app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()"
  );
  next();
});
const CLIENT_ORIGIN = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true
  })
);

// ---------------------------------------------------------------------------
// CSRF guard: browsers attach an Origin header to every cross-site POST/PUT/
// PATCH/DELETE. Reject anything that is neither our configured client origin
// nor the origin the request was actually sent to. Non-browser clients (curl,
// health checks) send no Origin and are unaffected.
// ---------------------------------------------------------------------------
const allowedOrigins = new Set(
  [CLIENT_ORIGIN, process.env.PUBLIC_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"]
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ""))
);
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  const selfOrigin = `${req.protocol}://${req.get("host")}`;
  if (allowedOrigins.has(origin) || origin === selfOrigin) return next();
  return res.status(403).json({ ok: false, message: "Request blocked by origin policy" });
});
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(metricsMiddleware);
app.use(attachUser);

// Profile photos are public. Documents and chat attachments are served through
// authenticated API routes, never through a static directory.
app.use(
  "/uploads/avatars",
  express.static(`${uploadRoot}/avatars`, {
    maxAge: "7d",
    fallthrough: true
  })
);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "TechNexa API", time: new Date().toISOString() });
});

// Prometheus scrapes this endpoint. Set METRICS_TOKEN to require a bearer token.
app.get("/metrics", metricsHandler);

app.use("/api", apiRouter);

app.use((req, res) => {
  res.status(404).json({ ok: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  const status = err.status || (err.code === "LIMIT_FILE_SIZE" ? 413 : 500);
  if (status >= 500) console.error(err);
  // Never leak internal error details (DB errors, stack parts) to clients
  // outside development.
  const clientMessage =
    err.code === "LIMIT_FILE_SIZE"
      ? "The uploaded file is too large"
      : err.status && status < 500
        ? err.message || "Request failed"
        : process.env.NODE_ENV === "production"
          ? "Server error"
          : err.message || "Server error";
  res.status(status).json({ ok: false, message: clientMessage });
});

export default app;
