import {
  cpSync,
  rmSync,
  mkdirSync,
  chmodSync,
  existsSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.join(here, ".."); // artifacts/desktop
const repoRoot = path.join(desktopDir, "..", ".."); // workspace root
const resources = path.join(desktopDir, "resources");

function requireDir(dir, hint) {
  if (!existsSync(dir)) {
    throw new Error(`Missing ${dir}\n  -> ${hint}`);
  }
}

const apiDist = path.join(repoRoot, "artifacts", "api-server", "dist");
const webSrc = path.join(repoRoot, "artifacts", "engram", "dist", "public");
const drizzleSrc = path.join(repoRoot, "lib", "db", "drizzle");
const pgliteSrc = path.join(
  repoRoot,
  "artifacts",
  "api-server",
  "node_modules",
  "@electric-sql",
  "pglite",
);

requireDir(
  apiDist,
  "Build the API first: pnpm --filter @workspace/api-server run build",
);
requireDir(
  webSrc,
  "Build the web first: PORT=5000 BASE_PATH=/ pnpm --filter @workspace/engram run build",
);
requireDir(
  drizzleSrc,
  "Generate migrations first: pnpm --filter @workspace/db run generate",
);
requireDir(
  pgliteSrc,
  "Install deps first: pnpm install (expected @electric-sql/pglite under api-server)",
);

// Clean slate so stale assets never ship.
rmSync(resources, { recursive: true, force: true });
mkdirSync(resources, { recursive: true });

// 1. Server bundle — copy the runtime .mjs files only (skip .map sources).
const serverOut = path.join(resources, "server");
mkdirSync(serverOut, { recursive: true });
for (const file of readdirSync(apiDist)) {
  if (file.endsWith(".mjs")) {
    cpSync(path.join(apiDist, file), path.join(serverOut, file));
  }
}

// 2. PGlite — the only externalized runtime dependency of the server bundle.
//    Dereference the pnpm symlink so the package (incl. its wasm/data files)
//    ships as real files next to the bundle, resolvable as a bare import.
const pgliteOut = path.join(
  serverOut,
  "node_modules",
  "@electric-sql",
  "pglite",
);
mkdirSync(path.dirname(pgliteOut), { recursive: true });
cpSync(pgliteSrc, pgliteOut, { recursive: true, dereference: true });

// 3. Web (built dashboard served by the embedded API at WEB_DIST).
cpSync(webSrc, path.join(resources, "web"), { recursive: true });

// 4. Drizzle migrations (run by ensureDatabaseReady on first launch).
cpSync(drizzleSrc, path.join(resources, "drizzle"), { recursive: true });

// 5. ffmpeg + ffprobe — the host-platform binaries the media worker needs for the
//    VIDEO modality (frame sampling + audio extraction). ffmpeg-static downloads,
//    and ffprobe-static selects, the binary matching the OS/arch this build runs
//    on, so packaging on each native OS (see .github/workflows/desktop-build.yml)
//    ships the right binaries. Only the resolved host binary is copied into the
//    bundle; main.ts points the server child at it via FFMPEG_PATH/FFPROBE_PATH.
//    On macOS these unsigned Mach-O binaries are code-signed during packaging via
//    the `mac.binaries` list in electron-builder.yml so notarized builds succeed.
const ffmpegSrc = require("ffmpeg-static");
const ffprobeSrc = require("ffprobe-static").path;
requireDir(
  ffmpegSrc,
  "ffmpeg-static did not provide a binary; reinstall deps (its postinstall downloads it).",
);
requireDir(
  ffprobeSrc,
  "ffprobe-static did not provide a binary; reinstall deps.",
);

const binOut = path.join(resources, "bin");
mkdirSync(binOut, { recursive: true });
const exe = process.platform === "win32" ? ".exe" : "";
const ffmpegOut = path.join(binOut, `ffmpeg${exe}`);
const ffprobeOut = path.join(binOut, `ffprobe${exe}`);
cpSync(ffmpegSrc, ffmpegOut);
cpSync(ffprobeSrc, ffprobeOut);
chmodSync(ffmpegOut, 0o755);
chmodSync(ffprobeOut, 0o755);

console.log("[desktop] resources prepared ->", resources);
