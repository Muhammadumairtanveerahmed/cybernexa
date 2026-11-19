import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadRoot = path.resolve(__dirname, "../../uploads");

for (const folder of [
  "avatars",
  "documents",
  "enrollments",
  "chat",
  "calls",
  "lectures",
  "lecture_thumbs",
  "lecture_hls"
]) {
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

const SIGNATURE_TESTS = [
  // [ext list, test bytes] — null means "no check available for this extension"
  { exts: [".jpg", ".jpeg"], test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    exts: [".png"],
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a
  },
  {
    exts: [".webp"],
    test: (b) =>
      b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"
  },
  { exts: [".pdf"], test: (b) => b.length >= 4 && b.toString("ascii", 0, 4) === "%PDF" },
  { exts: [".zip", ".docx", ".pptx"], test: (b) => b.length >= 2 && b[0] === 0x50 && b[1] === 0x4b },
  {
    exts: [".doc", ".ppt"],
    test: (b) => b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0
  },
  {
    exts: [".heic", ".heif", ".mp4", ".m4v", ".mov"],
    test: (b) => b.length >= 8 && b.toString("ascii", 4, 8) === "ftyp"
  },
  {
    exts: [".mp3"],
    test: (b) =>
      b.length >= 3 && (b.toString("ascii", 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0))
  },
  { exts: [".webm", ".mkv"], test: (b) => b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 }
];

// Verifies the first bytes of an uploaded file against its extension's
// signature. Prevents e.g. "not-a-photo.jpg" (a renamed script) being stored.
// Extensions without a known signature (.txt, .ogg, ...) are allowed through.
export function verifyMagic(file) {
  if (!file || !file.path) return { ok: true };
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ext) return { ok: false, reason: "file extension is missing" };
  const entry = SIGNATURE_TESTS.find((t) => t.exts.includes(ext));
  if (!entry) return { ok: true };
  let buf;
  try {
    buf = Buffer.alloc(16);
    const fd = fs.openSync(file.path, "r");
    const bytes = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    buf = buf.subarray(0, bytes);
  } catch {
    return { ok: false, reason: "could not read the uploaded file" };
  }
  if (entry.test(buf)) return { ok: true };
  return { ok: false, reason: `${ext.slice(1).toUpperCase()} signature mismatch` };
}

export function dropFile(file) {
  if (!file || !file.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch {
    /* ignore */
  }
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
