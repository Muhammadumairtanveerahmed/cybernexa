import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadRoot = path.resolve(__dirname, "../../uploads");

for (const folder of ["avatars", "documents", "enrollments", "chat", "calls"]) {
  fs.mkdirSync(path.join(uploadRoot, folder), { recursive: true });
}

export function makeUpload(folder, allowedExt = [], maxCount = 1, maxSizeMB = 10) {
  const destination = path.join(uploadRoot, folder);
  fs.mkdirSync(destination, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, destination),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        cb(null, `${base}${ext}`);
      }
    }),
    limits: { fileSize: maxSizeMB * 1024 * 1024, files: maxCount },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedExt.length && !allowedExt.includes(ext)) {
        return cb(new Error(`File type ${ext || "unknown"} is not allowed`));
      }
      cb(null, true);
    }
  });
}

export function fileUrl(file, folder) {
  if (!file) return "";
  return `/uploads/${folder}/${file.filename}`;
}

export function removeUpload(relpath) {
  if (!relpath) return;
  const safe = String(relpath).replace(/^\/+/, "").replace(/\.\./g, "");
  const full = path.join(uploadRoot, safe);
  if (full.startsWith(uploadRoot) && fs.existsSync(full)) {
    try {
      fs.unlinkSync(full);
    } catch {
      /* ignore */
    }
  }
}

export function publicPhoto(photo) {
  if (!photo) return "";
  if (/^https?:\/\//i.test(photo) || photo.startsWith("/")) return photo;
  return `/uploads/avatars/${photo}`;
}
