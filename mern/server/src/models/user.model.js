import { pool } from "../config/db.js";

export async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, full_name, email, password_hash, role, status
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const [rows] = await pool.query(
    `SELECT id, full_name, email, phone, role, status, avatar_path
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function createUser(user) {
  await pool.query(
    `INSERT INTO users (id, full_name, email, phone, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.fullName,
      user.email,
      user.phone || "",
      user.passwordHash,
      user.role,
      user.status || "active"
    ]
  );
  return findUserById(user.id);
}
