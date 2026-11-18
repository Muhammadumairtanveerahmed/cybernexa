import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { publicPhoto } from "../utils/upload.js";

// In production we require a strong, explicitly configured secret so tokens
// can never be forged. In development a clearly-labelled default is fine.
const RAW_SECRET = process.env.JWT_SECRET;
if (
  process.env.NODE_ENV === "production" &&
  (!RAW_SECRET || RAW_SECRET.length < 32 || /replace|change|example|secret$/i.test(RAW_SECRET))
) {
  throw new Error(
    "FATAL: JWT_SECRET must be set to a strong random string (32+ chars) in production."
  );
}
export const JWT_SECRET = RAW_SECRET || "technexa-development-secret";

export const AUTH_COOKIE = "technexa_token";

export function signToken(user, expiresIn = "5m") {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn }
  );
}

export function setAuthCookie(res, token, rememberMinutes = 5) {
  // COOKIE_SECURE overrides the NODE_ENV default so the app can be hosted over
  // plain HTTP (e.g. an internal/plain-HTTP ingress) while still running with
  // NODE_ENV=production. Leave it unset in normal HTTPS deployments.
  const secureCookie =
    process.env.COOKIE_SECURE === undefined
      ? process.env.NODE_ENV === "production"
      : process.env.COOKIE_SECURE === "true";

  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    maxAge: rememberMinutes * 60 * 1000,
    path: "/"
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    email: row.email,
    full_name: row.full_name,
    phone: row.phone || "",
    status: row.status,
    photo: row.photo || "",
    photo_url: publicPhoto(row.photo),
    created_at: row.created_at,
    last_login: row.last_login || null
  };
}

export async function attachUser(req, res, next) {
  try {
    let token = req.cookies?.[AUTH_COOKIE];
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7);
    }
    if (!token) return next();

    const payload = jwt.verify(token, JWT_SECRET);

    const [rows] = await pool.query(
      `SELECT id, role, email, full_name, phone, status, photo, created_at, last_login
       FROM users WHERE id = ? LIMIT 1`,
      [payload.sub]
    );

    if (rows[0]) req.user = rows[0];
    next();
  } catch {
    clearAuthCookie(res);
    next();
  }
}
