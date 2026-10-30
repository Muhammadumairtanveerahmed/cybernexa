import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/db.js";
import { newId, nowSql } from "../utils/ids.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coursesFile = path.resolve(__dirname, "../../data/courses.json");

const selectFields = `id, title, category, tag, short_desc AS shortDesc, description,
  meta, price, featured, active, sort_order AS sortOrder`;

export async function ensureCourses() {
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM courses");
  if (Number(rows[0]?.count || 0) > 0) return;

  let courses = [];
  try {
    courses = JSON.parse(await fs.readFile(coursesFile, "utf8"));
  } catch {
    return;
  }

  for (const course of courses) {
    await pool.query(
      `INSERT IGNORE INTO courses
        (id, title, category, tag, short_desc, description, meta, price, featured, active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course.id || newId("crs"),
        course.title,
        course.category || "",
        course.tag || "",
        course.shortDesc || "",
        course.description || "",
        course.meta || "",
        course.price || "",
        course.featured ? 1 : 0,
        course.active === false ? 0 : 1,
        Number(course.sortOrder || 0),
        nowSql(),
        nowSql()
      ]
    );
  }
}

export async function listCourses({ includeInactive = false } = {}) {
  await ensureCourses();
  const where = includeInactive ? "" : "WHERE active = 1";
  const [rows] = await pool.query(
    `SELECT ${selectFields} FROM courses ${where} ORDER BY sort_order ASC, title ASC`
  );
  return rows;
}

export async function findCourse(id) {
  const [rows] = await pool.query(`SELECT ${selectFields} FROM courses WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function createCourse(data) {
  const id = data.id || newId("crs");
  await pool.query(
    `INSERT INTO courses
      (id, title, category, tag, short_desc, description, meta, price, featured, active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.title,
      data.category || "",
      data.tag || "",
      data.shortDesc || data.short_desc || "",
      data.description || "",
      data.meta || "",
      data.price || "",
      data.featured ? 1 : 0,
      data.active === false ? 0 : 1,
      Number(data.sortOrder || data.sort_order || 0),
      nowSql(),
      nowSql()
    ]
  );
  return findCourse(id);
}

export async function updateCourse(id, data) {
  const current = await findCourse(id);
  if (!current) return null;

  await pool.query(
    `UPDATE courses SET
      title = ?, category = ?, tag = ?, short_desc = ?, description = ?,
      meta = ?, price = ?, featured = ?, active = ?, sort_order = ?, updated_at = ?
     WHERE id = ?`,
    [
      data.title ?? current.title,
      data.category ?? current.category,
      data.tag ?? current.tag,
      data.shortDesc ?? data.short_desc ?? current.shortDesc,
      data.description ?? current.description,
      data.meta ?? current.meta,
      data.price ?? current.price,
      data.featured === undefined ? current.featured : data.featured ? 1 : 0,
      data.active === undefined ? current.active : data.active ? 1 : 0,
      data.sortOrder ?? data.sort_order ?? current.sortOrder,
      nowSql(),
      id
    ]
  );
  return findCourse(id);
}

export async function deleteCourse(id) {
  await pool.query("DELETE FROM courses WHERE id = ?", [id]);
}
