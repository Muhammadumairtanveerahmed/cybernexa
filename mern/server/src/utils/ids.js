import crypto from "node:crypto";

export function newId(prefix = "id") {
  const random = crypto.randomBytes(9).toString("base64url").replace(/[-_]/g, "").slice(0, 14);
  return `${prefix}_${random}`;
}

export function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
