import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";

import app from "../../src/app.js";
import { authRateLimiter } from "../../src/middleware/rateLimit.middleware.js";
import { verifyMagic } from "../../src/utils/upload.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function start(application) {
  return new Promise((resolve) => {
    const server = http.createServer(application).listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test("API responses carry the hardened security headers", async () => {
  const server = await start(app);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-powered-by"), null, "X-Powered-By must be hidden");
    assert.match(response.headers.get("content-security-policy") || "", /default-src 'self'/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.match(response.headers.get("permissions-policy") || "", /camera=\(self\)/);
  } finally {
    await close(server);
  }
});

test("unknown API routes return a JSON 404", async () => {
  const server = await start(app);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/nope`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, message: "Route not found" });
  } finally {
    await close(server);
  }
});

test("course enrollment requires authentication", async () => {
  const server = await start(app);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course: "Web Development", name: "Guest", email: "guest@example.com" })
    });
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.match(body.message || "", /auth/i);
  } finally {
    await close(server);
  }
});

test("cross-site state-changing requests are rejected by the origin guard", async () => {
  const server = await start(app);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const blocked = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ email: "someone@example.com", password: "Password123" })
    });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).ok, false);

    // Same-origin requests pass the guard (they fall through to the router).
    const allowed = await fetch(`${base}/api/health`, {
      method: "POST",
      headers: { Origin: base }
    });
    assert.notEqual(allowed.status, 403);
  } finally {
    await close(server);
  }
});

test("the auth limiter blocks brute-force attempts after 15 tries", async () => {
  const mini = express();
  mini.post("/try", authRateLimiter, (req, res) => res.json({ ok: true }));
  const server = await start(mini);
  try {
    const url = `http://127.0.0.1:${server.address().port}/try`;
    for (let attempt = 1; attempt <= 15; attempt += 1) {
      const response = await fetch(url, { method: "POST" });
      assert.equal(response.status, 200, `attempt ${attempt} should pass`);
    }
    const blocked = await fetch(url, { method: "POST" });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("ratelimit-policy"), "15;w=900");
  } finally {
    await close(server);
  }
});

test("upload signature checks reject renamed files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "technexa-sig-"));
  const write = (name, bytes) => {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, bytes);
    return { path: filePath, originalname: name };
  };
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
    "base64"
  );
  try {
    assert.equal(verifyMagic(write("real.png", png)).ok, true);
    assert.equal(verifyMagic(write("fake.png", Buffer.from("<html>not an image"))).ok, false);
    assert.equal(verifyMagic(write("report.pdf", Buffer.from("%PDF-1.7\n"))).ok, true);
    assert.equal(verifyMagic(write("renamed.jpg", png)).ok, false, "PNG bytes as .jpg must fail");
    assert.equal(verifyMagic(write("notes.txt", Buffer.from("plain text"))).ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("production refuses to boot without a strong JWT_SECRET", () => {
  const target = pathToFileURL(path.join(serverRoot, "src/middleware/attachUser.js")).href;
  const code = `import(${JSON.stringify(target)}).catch((error) => { console.error(error.message); process.exit(1); });`;
  const baseEnv = { ...process.env, NODE_ENV: "production" };

  const missing = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: serverRoot,
    env: { ...baseEnv, JWT_SECRET: "" },
    encoding: "utf8"
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /JWT_SECRET/);

  const placeholder = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: serverRoot,
    env: { ...baseEnv, JWT_SECRET: "replace-with-a-long-random-string" },
    encoding: "utf8"
  });
  assert.notEqual(placeholder.status, 0);

  const strong = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: serverRoot,
    env: { ...baseEnv, JWT_SECRET: "a".repeat(48) },
    encoding: "utf8"
  });
  assert.equal(strong.status, 0, strong.stderr);
});
