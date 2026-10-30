import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { publicPhoto } from "../utils/upload.js";

export const AUTH_COOKIE = "technexa_token";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET || "technexa-development-secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
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

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "technexa-development-secret"
    );

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
