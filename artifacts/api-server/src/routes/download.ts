import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "node:fs";
import { Readable } from "node:stream";
import {
  APK_MIME,
  OCTET_MIME,
  safeAttachment,
  resolveApk,
  resolveDesktop,
  findDesktopInstaller,
} from "../lib/downloads";

// Plain Express download routes (deliberately NOT in the OpenAPI spec, like the
// media raw/upload routes). Everything is served same-origin through the deploy:
//   GET /api/download/android            -> JSON meta
//   GET /api/download/android.apk        -> the apk binary
//   GET /api/download/desktop            -> JSON meta (per-OS installers)
//   GET /api/download/desktop/file/:name -> a single installer binary
// Each binary resolves a bundled file first, else proxy-streams the matching
// asset from the latest GitHub release — see lib/downloads.ts.
const router = Router();
const DOWNLOAD_RATE_WINDOW_MS = 10_000;
const DOWNLOAD_RATE_LIMIT = 30;
const downloadRequests = new Map<string, number[]>();

function desktopDownloadPath(filename: string): string {
  return `/api/download/desktop/file/${encodeURIComponent(filename)}`;
}

function withinDownloadRateLimit(req: Request, routeKey: string): boolean {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `${routeKey}:${ip}`;
  const now = Date.now();
  const since = now - DOWNLOAD_RATE_WINDOW_MS;
  const history = (downloadRequests.get(key) ?? []).filter((ts) => ts >= since);
  if (history.length >= DOWNLOAD_RATE_LIMIT) {
    downloadRequests.set(key, history);
    return false;
  }
  history.push(now);
  downloadRequests.set(key, history);
  return true;
}

/** Express middleware that enforces the per-IP download rate limit for a named route. */
function downloadRateLimit(routeKey: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!withinDownloadRateLimit(req, routeKey)) {
      res
        .status(429)
        .json({ error: "Too many download requests. Please try again shortly." });
      return;
    }
    next();
  };
}

type DesktopOs = "mac" | "win" | "linux";

function isDesktopOs(value: string): value is DesktopOs {
  return value === "mac" || value === "win" || value === "linux";
}

function preferredDesktopExt(os: DesktopOs): string[] {
  switch (os) {
    case "mac":
      return [".dmg"];
    case "win":
      return [".exe", ".zip"];
    case "linux":
      return [".AppImage", ".deb"];
  }
}

function pickDesktopInstallerForOs(
  installers: Awaited<ReturnType<typeof resolveDesktop>>["installers"],
  os: DesktopOs,
) {
  const forOs = installers.filter((i) => i.os === os);
  if (forOs.length === 0) return null;
  const exts = preferredDesktopExt(os);
  const preferred = forOs.find((i) =>
    exts.some((ext) => i.ext.toLowerCase() === ext.toLowerCase()),
  );
  return preferred ?? forOs[0] ?? null;
}

/** Stream a local file as an attachment. */
function streamLocalFile(
  req: Request,
  res: Response,
  filePath: string,
  filename: string,
  mime: string,
  sizeBytes: number,
): void {
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", String(sizeBytes));
  res.setHeader("Content-Disposition", safeAttachment(filename));
  const stream = fs.createReadStream(filePath);
  res.on("close", () => stream.destroy());
  stream.on("error", (err) => {
    req.log.error(err, "Failed to stream bundled download");
    if (!res.headersSent) {
      res.status(500).json({ error: "Could not read the file." });
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

/** Proxy-stream a remote URL as an attachment, aborting if the client leaves. */
async function proxyDownload(
  req: Request,
  res: Response,
  url: string,
  filename: string,
  mime: string,
  sizeBytes: number,
): Promise<void> {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "engram-download",
        Accept: "application/octet-stream",
      },
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) {
      req.log.error(
        { status: upstream.status },
        "Upstream download fetch failed",
      );
      res
        .status(502)
        .json({ error: "Could not fetch the file from the release host." });
      return;
    }
    res.setHeader("Content-Type", mime);
    if (sizeBytes) res.setHeader("Content-Length", String(sizeBytes));
    res.setHeader("Content-Disposition", safeAttachment(filename));
    const nodeStream = Readable.fromWeb(
      upstream.body as Parameters<typeof Readable.fromWeb>[0],
    );
    nodeStream.on("error", (err) => {
      if (controller.signal.aborted) {
        res.destroy();
        return;
      }
      req.log.error(err, "Error while proxying download");
      if (!res.headersSent) {
        res.status(502).json({ error: "Download interrupted." });
      } else {
        res.destroy();
      }
    });
    nodeStream.pipe(res);
  } catch (err) {
    if (controller.signal.aborted) return;
    req.log.error(err, "Proxy download failed");
    if (!res.headersSent) {
      res.status(502).json({ error: "Could not download the file." });
    }
  }
}

// ---- Android ----

router.get("/download/android", async (_req, res) => {
  const apk = await resolveApk();
  if (!apk) {
    res.json({
      available: false,
      source: null,
      version: null,
      filename: null,
      sizeBytes: null,
      downloadPath: null,
    });
    return;
  }
  res.json({
    available: true,
    source: apk.kind,
    version: apk.version,
    filename: apk.filename,
    sizeBytes: apk.sizeBytes,
    downloadPath: "/api/download/android.apk",
  });
});

router.get("/download/android.apk", downloadRateLimit("android-apk"), async (req, res) => {
  const apk = await resolveApk();
  if (!apk) {
    res.status(404).json({ error: "No Android APK is available for download." });
    return;
  }
  if (apk.kind === "bundled") {
    streamLocalFile(req, res, apk.localPath, apk.filename, APK_MIME, apk.sizeBytes);
  } else {
    await proxyDownload(req, res, apk.url, apk.filename, APK_MIME, apk.sizeBytes);
  }
});

router.get("/download/android/latest", downloadRateLimit("android-latest"), async (req, res) => {
  const apk = await resolveApk();
  if (!apk) {
    res.status(404).json({ error: "No Android APK is available for download." });
    return;
  }
  if (apk.kind === "bundled") {
    streamLocalFile(req, res, apk.localPath, apk.filename, APK_MIME, apk.sizeBytes);
  } else {
    await proxyDownload(req, res, apk.url, apk.filename, APK_MIME, apk.sizeBytes);
  }
});

// ---- Desktop ----

router.get("/download/desktop", async (_req, res) => {
  const { source, version, installers } = await resolveDesktop();
  res.json({
    available: installers.length > 0,
    source,
    version,
    installers: installers.map((i) => ({
      os: i.os,
      ext: i.ext,
      filename: i.filename,
      sizeBytes: i.sizeBytes,
      downloadPath: desktopDownloadPath(i.filename),
    })),
  });
});

router.get("/download/desktop/file/:name", downloadRateLimit("desktop-file"), async (req, res) => {
  const installer = await findDesktopInstaller(req.params["name"] as string);
  if (!installer) {
    res
      .status(404)
      .json({ error: "That installer is not available for download." });
    return;
  }
  if (installer.source === "bundled") {
    streamLocalFile(
      req,
      res,
      installer.localPath,
      installer.filename,
      OCTET_MIME,
      installer.sizeBytes,
    );
  } else {
    await proxyDownload(
      req,
      res,
      installer.url,
      installer.filename,
      OCTET_MIME,
      installer.sizeBytes,
    );
  }
});

router.get("/download/desktop/latest/:os", downloadRateLimit("desktop-latest"), async (req, res) => {
  const osParam = (req.params["os"] as string | undefined)?.toLowerCase() ?? "";
  if (!isDesktopOs(osParam)) {
    res.status(400).json({ error: "Desktop OS must be one of: mac, win, linux." });
    return;
  }

  const { installers } = await resolveDesktop();
  const installer = pickDesktopInstallerForOs(installers, osParam);
  if (!installer) {
    res
      .status(404)
      .json({ error: "No desktop installer is available for that operating system." });
    return;
  }

  if (installer.source === "bundled") {
    streamLocalFile(
      req,
      res,
      installer.localPath,
      installer.filename,
      OCTET_MIME,
      installer.sizeBytes,
    );
  } else {
    await proxyDownload(
      req,
      res,
      installer.url,
      installer.filename,
      OCTET_MIME,
      installer.sizeBytes,
    );
  }
});

export default router;

/** Clear the in-memory rate-limit counters. Exposed for use in tests. */
export function clearDownloadRateLimiter(): void {
  downloadRequests.clear();
}
