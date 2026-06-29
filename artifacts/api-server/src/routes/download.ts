import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

const router = Router();

// Resolve a stable, cwd-independent default for the bundled-APK directory. The
// server bundle lives at artifacts/api-server/dist/index.mjs, so the repo root
// is three levels up. `import.meta.url` survives esbuild's ESM output, so this
// is correct in both dev (built into dist) and production — and does NOT depend
// on process.cwd(), which differs between `pnpm --filter ... start` (package
// dir) and the production `node artifacts/api-server/dist/index.mjs` (repo
// root).
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(moduleDir, "..", "..", "..");
const DEFAULT_DOWNLOADS_DIR = path.join(REPO_ROOT, "downloads");

const APK_MIME = "application/vnd.android.package-archive";

/**
 * Build a Content-Disposition value from a filename that may come from disk or a
 * GitHub asset. Collapses anything outside a conservative charset to "_" so the
 * (untrusted) name can never inject quotes / CRLF / control chars into the
 * header.
 */
function safeAttachment(filename: string): string {
  const safe = filename
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `attachment; filename="${safe || "engram.apk"}"`;
}

function githubRepo(): string {
  return process.env["ANDROID_APK_GITHUB_REPO"]?.trim() || "pyri-ai/engram";
}

function deriveVersion(name: string): string | null {
  const m = name.match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

type BundledApk = { path: string; filename: string; sizeBytes: number };

/**
 * Locate a committed/bundled .apk to serve directly — the first leg of "do
 * both". `ANDROID_APK_PATH` points at one file; otherwise the first *.apk in
 * `ANDROID_APK_DIR` (default <repo>/downloads) is used.
 */
function resolveBundledApk(): BundledApk | null {
  const explicit = process.env["ANDROID_APK_PATH"]?.trim();
  if (explicit) {
    try {
      const st = fs.statSync(explicit);
      if (st.isFile()) {
        return {
          path: explicit,
          filename: path.basename(explicit),
          sizeBytes: st.size,
        };
      }
    } catch {
      /* missing/unreadable → treated as "no bundled apk" */
    }
    return null;
  }

  const dir = process.env["ANDROID_APK_DIR"]?.trim() || DEFAULT_DOWNLOADS_DIR;
  try {
    const apks = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".apk"));
    if (apks.length === 0) return null;
    // Pick the most recently modified .apk. A lexicographic sort would rank
    // "1.9.0" above "1.10.0", so use mtime to mean "newest build" honestly.
    let best: BundledApk | null = null;
    let bestMtime = -Infinity;
    for (const f of apks) {
      const full = path.join(dir, f);
      try {
        const st = fs.statSync(full);
        if (st.isFile() && st.mtimeMs > bestMtime) {
          bestMtime = st.mtimeMs;
          best = { path: full, filename: f, sizeBytes: st.size };
        }
      } catch {
        /* skip unreadable entries */
      }
    }
    return best;
  } catch {
    return null;
  }
}

type GithubApk = {
  url: string;
  filename: string;
  sizeBytes: number;
  version: string | null;
};

let githubCache: { at: number; value: GithubApk | null } | null = null;
const GH_TTL_OK = 5 * 60 * 1000;
const GH_TTL_MISS = 60 * 1000;

/**
 * Find the latest GitHub release's .apk asset — the fallback leg of "do both".
 * Cached briefly (positive 5m, negative 1m) so polling the meta endpoint does
 * not hammer the GitHub API / hit its unauthenticated rate limit.
 */
async function resolveGithubApk(): Promise<GithubApk | null> {
  const now = Date.now();
  if (githubCache) {
    const ttl = githubCache.value ? GH_TTL_OK : GH_TTL_MISS;
    if (now - githubCache.at < ttl) return githubCache.value;
  }

  let value: GithubApk | null = null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${githubRepo()}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "engram-download",
        },
        // Don't let a hung GitHub call stall the meta endpoint; on timeout the
        // catch below records a (briefly cached) miss.
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.ok) {
      const json = (await res.json()) as {
        tag_name?: string;
        assets?: { name?: string; browser_download_url?: string; size?: number }[];
      };
      const asset = (json.assets ?? []).find((a) =>
        a.name?.toLowerCase().endsWith(".apk"),
      );
      if (asset?.browser_download_url) {
        value = {
          url: asset.browser_download_url,
          filename: asset.name ?? "engram.apk",
          sizeBytes: asset.size ?? 0,
          version: (json.tag_name ?? "").replace(/^v/, "") || null,
        };
      }
    }
  } catch {
    value = null;
  }

  githubCache = { at: now, value };
  return value;
}

/**
 * Android download metadata (JSON). Reports whether an .apk is available and
 * where it comes from ("bundled" = committed into the deploy, "github" = latest
 * release). NOT in the OpenAPI spec — mirrors the media raw/upload routes, which
 * are likewise plain Express endpoints not modeled in the contract.
 */
router.get("/download/android", async (_req, res) => {
  const bundled = resolveBundledApk();
  if (bundled) {
    res.json({
      available: true,
      source: "bundled",
      version: deriveVersion(bundled.filename),
      filename: bundled.filename,
      sizeBytes: bundled.sizeBytes,
      downloadPath: "/api/download/android.apk",
    });
    return;
  }

  const gh = await resolveGithubApk();
  if (gh) {
    res.json({
      available: true,
      source: "github",
      version: gh.version,
      filename: gh.filename,
      sizeBytes: gh.sizeBytes,
      downloadPath: "/api/download/android.apk",
    });
    return;
  }

  res.json({
    available: false,
    source: null,
    version: null,
    filename: null,
    sizeBytes: null,
    downloadPath: null,
  });
});

/**
 * Stream the Android .apk for download (binary; NOT in the OpenAPI spec). Serves
 * a bundled file when present, otherwise proxy-streams the latest GitHub release
 * asset so the download always stays same-origin with the dashboard.
 */
router.get("/download/android.apk", async (req, res) => {
  const bundled = resolveBundledApk();
  if (bundled) {
    res.setHeader("Content-Type", APK_MIME);
    res.setHeader("Content-Length", bundled.sizeBytes);
    res.setHeader("Content-Disposition", safeAttachment(bundled.filename));
    const stream = fs.createReadStream(bundled.path);
    res.on("close", () => stream.destroy());
    stream.on("error", (err) => {
      req.log.error(err, "Failed to stream bundled APK");
      if (!res.headersSent) {
        res.status(500).json({ error: "Could not read the APK file." });
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
    return;
  }

  const gh = await resolveGithubApk();
  if (!gh) {
    res.status(404).json({ error: "No Android APK is available for download." });
    return;
  }

  // Abort the upstream fetch if the client disconnects mid-download so we don't
  // keep pulling a large APK that nobody is receiving.
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const upstream = await fetch(gh.url, {
      headers: {
        "User-Agent": "engram-download",
        Accept: "application/octet-stream",
      },
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) {
      req.log.error(
        { status: upstream.status },
        "Upstream APK fetch failed",
      );
      res
        .status(502)
        .json({ error: "Could not fetch the APK from the release host." });
      return;
    }
    res.setHeader("Content-Type", APK_MIME);
    if (gh.sizeBytes) res.setHeader("Content-Length", gh.sizeBytes);
    res.setHeader("Content-Disposition", safeAttachment(gh.filename));
    const nodeStream = Readable.fromWeb(
      upstream.body as Parameters<typeof Readable.fromWeb>[0],
    );
    nodeStream.on("error", (err) => {
      // A client-abort surfaces here as an AbortError — not a real failure.
      if (controller.signal.aborted) {
        res.destroy();
        return;
      }
      req.log.error(err, "Error while proxying APK");
      if (!res.headersSent) {
        res.status(502).json({ error: "APK download interrupted." });
      } else {
        res.destroy();
      }
    });
    nodeStream.pipe(res);
  } catch (err) {
    if (controller.signal.aborted) return; // client went away; nothing to do
    req.log.error(err, "APK proxy download failed");
    if (!res.headersSent) {
      res.status(502).json({ error: "Could not download the APK." });
    }
  }
});

export default router;
