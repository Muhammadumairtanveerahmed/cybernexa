import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pool } from "../config/db.js";
import { nowSql } from "../utils/ids.js";
import { uploadRoot } from "../utils/upload.js";

const activeJobs = new Set();

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.slice(-1200) || `${cmd} exited with code ${code}`));
    });
  });
}

async function hasBinary(cmd, args = ["-version"]) {
  try {
    await run(cmd, args);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    // If it exists but returned non-zero for this probe, treat as present.
    return error?.code !== "ENOENT";
  }
}

async function probeVideo(inputPath) {
  try {
    const { stdout } = await run("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=height,width,duration",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      inputPath
    ]);
    const data = JSON.parse(stdout || "{}");
    const stream = data.streams?.[0] || {};
    const duration = Number(stream.duration || data.format?.duration || 0);
    const height = Number(stream.height || 0);
    return {
      duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
      height: Number.isFinite(height) && height > 0 ? height : 0
    };
  } catch {
    return { duration: null, height: 0 };
  }
}

function safeJoin(base, target) {
  const full = path.resolve(base, target);
  if (!full.startsWith(path.resolve(base))) return null;
  return full;
}

export function lectureUploadRel(filename) {
  return `/uploads/lectures/${filename}`;
}

export function lectureThumbRel(filename) {
  return `/uploads/lecture_thumbs/${filename}`;
}

export function lectureHlsMasterRel(lectureId) {
  return `/uploads/lecture_hls/${lectureId}/master.m3u8`;
}

export function resolveUploadRel(relpath) {
  const relative = String(relpath || "").replace(/^\/?uploads\//, "");
  if (!relative || relative.includes("..")) return null;
  const full = path.join(uploadRoot, relative);
  return full.startsWith(uploadRoot) ? full : null;
}

export async function removeLectureFiles(lecture) {
  if (!lecture) return;
  const rels = [lecture.source_path, lecture.thumbnail_path].filter(Boolean);
  for (const rel of rels) {
    const full = resolveUploadRel(rel);
    if (full) {
      try {
        await fsp.unlink(full);
      } catch {
        /* ignore */
      }
    }
  }
  if (lecture.hls_path) {
    const hlsDir = path.join(uploadRoot, "lecture_hls", String(lecture.id));
    try {
      await fsp.rm(hlsDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function writeMasterPlaylist(outDir, variants) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const variant of variants) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.width}x${variant.height},NAME="${variant.label}"`
    );
    lines.push(`${variant.name}/index.m3u8`);
  }
  await fsp.writeFile(path.join(outDir, "master.m3u8"), `${lines.join("\n")}\n`, "utf8");
}

async function generateHls(inputPath, outDir, sourceHeight) {
  await fsp.mkdir(outDir, { recursive: true });
  const ladder = [
    { name: "360p", height: 360, width: 640, bitrate: "800k", maxrate: "856k", bufsize: "1200k", audio: "96k", bandwidth: 896000 },
    { name: "480p", height: 480, width: 854, bitrate: "1400k", maxrate: "1498k", bufsize: "2100k", audio: "128k", bandwidth: 1528000 },
    { name: "720p", height: 720, width: 1280, bitrate: "2800k", maxrate: "2996k", bufsize: "4200k", audio: "128k", bandwidth: 2928000 }
  ];
  const allowed = ladder.filter((variant) => !sourceHeight || sourceHeight + 80 >= variant.height);
  const variants = allowed.length ? allowed : [ladder[0]];

  for (const variant of variants) {
    const variantDir = path.join(outDir, variant.name);
    await fsp.mkdir(variantDir, { recursive: true });
    await run("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `scale=w=${variant.width}:h=${variant.height}:force_original_aspect_ratio=decrease,pad=${variant.width}:${variant.height}:(ow-iw)/2:(oh-ih)/2`,
      "-c:v",
      "libx264",
      "-profile:v",
      "main",
      "-crf",
      "23",
      "-sc_threshold",
      "0",
      "-g",
      "48",
      "-keyint_min",
      "48",
      "-b:v",
      variant.bitrate,
      "-maxrate",
      variant.maxrate,
      "-bufsize",
      variant.bufsize,
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-b:a",
      variant.audio,
      "-hls_time",
      "6",
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      path.join(variantDir, "seg_%03d.ts"),
      path.join(variantDir, "index.m3u8")
    ]);
  }

  await writeMasterPlaylist(
    outDir,
    variants.map((variant) => ({
      ...variant,
      label: variant.name
    }))
  );
  return variants.map((variant) => variant.name);
}

export async function queueLectureProcessing(lectureId) {
  if (activeJobs.has(lectureId)) return;
  activeJobs.add(lectureId);

  setImmediate(async () => {
    try {
      const [[lecture]] = await pool.query("SELECT * FROM lectures WHERE id = ? LIMIT 1", [lectureId]);
      if (!lecture || lecture.lecture_type !== "upload") return;

      const inputPath = resolveUploadRel(lecture.source_path);
      if (!inputPath || !fs.existsSync(inputPath)) {
        await pool.query(
          "UPDATE lectures SET processing_status = 'failed', processing_error = ?, updated_at = ? WHERE id = ?",
          ["Source video file is missing", nowSql(), lectureId]
        );
        return;
      }

      const ffmpegOk = await hasBinary("ffmpeg");
      const ffprobeOk = await hasBinary("ffprobe");
      if (!ffmpegOk || !ffprobeOk) {
        await pool.query(
          "UPDATE lectures SET processing_status = 'failed', processing_error = ?, updated_at = ? WHERE id = ?",
          ["FFmpeg/ffprobe is not installed on the server", nowSql(), lectureId]
        );
        return;
      }

      await pool.query(
        "UPDATE lectures SET processing_status = 'processing', processing_error = '', updated_at = ? WHERE id = ?",
        [nowSql(), lectureId]
      );

      const probe = await probeVideo(inputPath);
      const outDir = path.join(uploadRoot, "lecture_hls", lectureId);
      const qualities = await generateHls(inputPath, outDir, probe.height || 0);

      await pool.query(
        `UPDATE lectures SET
           processing_status = 'ready',
           processing_error = '',
           hls_path = ?,
           duration_seconds = COALESCE(?, duration_seconds),
           qualities_json = ?,
           updated_at = ?
         WHERE id = ?`,
        [lectureHlsMasterRel(lectureId), probe.duration, JSON.stringify(qualities), nowSql(), lectureId]
      );
    } catch (error) {
      await pool.query(
        "UPDATE lectures SET processing_status = 'failed', processing_error = ?, updated_at = ? WHERE id = ?",
        [String(error?.message || "Video processing failed").slice(0, 250), nowSql(), lectureId]
      );
    } finally {
      activeJobs.delete(lectureId);
    }
  });
}

export function safeLectureAssetPath(lectureId, assetPath = "master.m3u8") {
  const base = path.join(uploadRoot, "lecture_hls", String(lectureId));
  const decoded = decodeURIComponent(String(assetPath || ""));
  const normalized = decoded.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return null;
  return safeJoin(base, normalized);
}
