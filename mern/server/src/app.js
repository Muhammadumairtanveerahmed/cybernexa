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

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));
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
  res.status(status).json({
    ok: false,
    message:
      err.code === "LIMIT_FILE_SIZE"
        ? "The uploaded file is too large"
        : err.message || "Server error"
  });
});

export default app;
