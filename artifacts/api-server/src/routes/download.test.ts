import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// ---------------------------------------------------------------------------
// Hoisted FS mock state — mutated per-test to simulate different filesystem
// scenarios without touching real disk. The vi.mock factory below closes over
// this object; mutations made in test bodies are visible to the mock at
// call-time because JavaScript closures read the live reference.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => {
  const state = {
    dirs: {} as Record<string, string[]>,
    files: {} as Record<string, { size: number; mtimeMs: number }>,
    streamContent: {} as Record<string, Buffer>,
  };
  return { state };
});

// Mock node:fs so the download resolver never touches real disk.
// Both downloads.ts (the lib) and download.ts (the route) use
// `import fs from "node:fs"` — the default-export methods below cover both.
vi.mock("node:fs", () => {
  function readdirSync(dir: string): string[] {
    if (Object.prototype.hasOwnProperty.call(h.state.dirs, dir)) {
      return h.state.dirs[dir]!;
    }
    const err = new Error(
      `ENOENT: no such file or directory '${dir}'`,
    ) as NodeJS.ErrnoException;
    err.code = "ENOENT";
    throw err;
  }

  function statSync(p: string): { isFile(): boolean; mtimeMs: number; size: number } {
    if (Object.prototype.hasOwnProperty.call(h.state.files, p)) {
      const f = h.state.files[p]!;
      return { isFile: () => true, mtimeMs: f.mtimeMs, size: f.size };
    }
    const err = new Error(
      `ENOENT: no such file or directory '${p}'`,
    ) as NodeJS.ErrnoException;
    err.code = "ENOENT";
    throw err;
  }

  function createReadStream(p: string): {
    on(evt: string, cb: (...a: unknown[]) => void): unknown;
    pipe(dest: { write(b: Buffer): void; end(): void; on(...a: unknown[]): unknown }): unknown;
    destroy(): void;
  } {
    const buf: Buffer = Object.prototype.hasOwnProperty.call(
      h.state.streamContent,
      p,
    )
      ? h.state.streamContent[p]!
      : Buffer.from("fake-binary");
    let done = false;
    const evts: Record<string, Array<(...a: unknown[]) => void>> = {};
    const stream = {
      on(evt: string, cb: (...a: unknown[]) => void) {
        (evts[evt] ??= []).push(cb);
        return stream;
      },
      pipe(dest: { write(b: Buffer): void; end(): void; on(...a: unknown[]): unknown }) {
        if (!done) {
          setImmediate(() => {
            if (!done) {
              dest.write(buf);
              dest.end();
            }
          });
        }
        return dest;
      },
      destroy() {
        done = true;
      },
    };
    return stream;
  }

  return {
    default: { readdirSync, statSync, createReadStream },
    readdirSync,
    statSync,
    createReadStream,
  };
});

// ---------------------------------------------------------------------------
// Imports — must follow vi.mock() declarations
// ---------------------------------------------------------------------------
import express, {
  type Express,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
  type NextFunction,
} from "express";
import downloadRouter, { clearDownloadRateLimiter } from "./download";
import { clearReleaseCache } from "../lib/downloads";

// ---------------------------------------------------------------------------
// Capture the real fetch ONCE, before any stub is applied. All GitHub-mock
// helpers use this as a pass-through for requests to the local test server so
// that the test's own fetch(base + ...) calls still reach Express while only
// outbound GitHub API / CDN calls are intercepted.
// ---------------------------------------------------------------------------
const realFetch: typeof globalThis.fetch = globalThis.fetch;

function getUrlStr(url: string | URL | Request): string {
  if (typeof url === "string") return url;
  if (url instanceof URL) return url.href;
  return (url as Request).url;
}

function isGithubApiUrl(urlStr: string): boolean {
  try {
    return new URL(urlStr).hostname === "api.github.com";
  } catch {
    return false;
  }
}

function isGithubCdnUrl(urlStr: string): boolean {
  try {
    return new URL(urlStr).hostname === "objects.githubusercontent.com";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const TEST_DL_DIR = "/test-dl";

// Bundled file content — sizes MUST match content length so the streaming
// path sets a correct Content-Length header and the HTTP client doesn't hang.
const APK_CONTENT = Buffer.from("fake-apk-binary-data");   // 20 bytes
const APK_SIZE = APK_CONTENT.byteLength;
const APK_MTIME = 1_700_000_000_000;
const APK_FILE = "ENGRAM-Mobile-1.0.0.apk";
const APK_ROOT_PATH = `${TEST_DL_DIR}/${APK_FILE}`;
const APK_SUB_PATH = `${TEST_DL_DIR}/android/${APK_FILE}`;

const DMG_CONTENT = Buffer.from("fake-dmg-binary-data");   // 20 bytes
const DMG_SIZE = DMG_CONTENT.byteLength;
const DMG_MTIME = 1_700_000_001_000;
const DMG_FILE = "ENGRAM-Desktop-1.0.0.dmg";
const DMG_ROOT_PATH = `${TEST_DL_DIR}/${DMG_FILE}`;
const DMG_SUB_PATH = `${TEST_DL_DIR}/desktop/${DMG_FILE}`;

const APPIMAGE_CONTENT = Buffer.from("fake-appimage-binary-data"); // 25 bytes
const APPIMAGE_SIZE = APPIMAGE_CONTENT.byteLength;
const APPIMAGE_MTIME = 1_700_000_002_000;
const APPIMAGE_FILE = "ENGRAM-Desktop-1.0.0.AppImage";
const APPIMAGE_ROOT_PATH = `${TEST_DL_DIR}/${APPIMAGE_FILE}`;

// GitHub proxy content — separate from bundled, again sized consistently so
// proxyDownload's Content-Length header matches the fake upstream body.
const GH_APK_CONTENT = Buffer.from("github-apk-bytes");    // 16 bytes
const GH_APK_SIZE = GH_APK_CONTENT.byteLength;
const GH_DMG_CONTENT = Buffer.from("github-dmg-bytes");    // 16 bytes
const GH_DMG_SIZE = GH_DMG_CONTENT.byteLength;

const GH_APK_URL =
  "https://objects.githubusercontent.com/test/ENGRAM-Mobile-1.0.0.apk";
const GH_DMG_URL =
  "https://objects.githubusercontent.com/test/ENGRAM-Desktop-1.0.0.dmg";
const GH_APPIMAGE_URL =
  "https://objects.githubusercontent.com/test/ENGRAM-Desktop-1.0.0.AppImage";

// ---------------------------------------------------------------------------
// Fixture helpers — set up virtual FS entries per scenario
// ---------------------------------------------------------------------------
function setupBundledApkInRoot(): void {
  h.state.dirs[TEST_DL_DIR] = [APK_FILE];
  h.state.files[APK_ROOT_PATH] = { size: APK_SIZE, mtimeMs: APK_MTIME };
  h.state.streamContent[APK_ROOT_PATH] = APK_CONTENT;
}

function setupBundledApkInSubdir(): void {
  h.state.dirs[TEST_DL_DIR] = [];
  h.state.dirs[`${TEST_DL_DIR}/android`] = [APK_FILE];
  h.state.files[APK_SUB_PATH] = { size: APK_SIZE, mtimeMs: APK_MTIME };
  h.state.streamContent[APK_SUB_PATH] = APK_CONTENT;
}

function setupBundledDesktopInRoot(): void {
  h.state.dirs[TEST_DL_DIR] = [DMG_FILE];
  h.state.files[DMG_ROOT_PATH] = { size: DMG_SIZE, mtimeMs: DMG_MTIME };
  h.state.streamContent[DMG_ROOT_PATH] = DMG_CONTENT;
}

function setupBundledDesktopInSubdir(): void {
  h.state.dirs[TEST_DL_DIR] = [];
  h.state.dirs[`${TEST_DL_DIR}/desktop`] = [DMG_FILE];
  h.state.files[DMG_SUB_PATH] = { size: DMG_SIZE, mtimeMs: DMG_MTIME };
  h.state.streamContent[DMG_SUB_PATH] = DMG_CONTENT;
}

function setupBundledDesktopBothPlatforms(): void {
  h.state.dirs[TEST_DL_DIR] = [DMG_FILE, APPIMAGE_FILE];
  h.state.files[DMG_ROOT_PATH] = { size: DMG_SIZE, mtimeMs: DMG_MTIME };
  h.state.files[APPIMAGE_ROOT_PATH] = { size: APPIMAGE_SIZE, mtimeMs: APPIMAGE_MTIME };
  h.state.streamContent[DMG_ROOT_PATH] = DMG_CONTENT;
  h.state.streamContent[APPIMAGE_ROOT_PATH] = APPIMAGE_CONTENT;
}

/**
 * Stub fetch so that:
 *   - GitHub API calls return a release manifest with an APK + two desktop assets
 *   - GitHub CDN calls (objects.githubusercontent.com) return synthetic binary bytes
 *     whose length matches the `size` field in the manifest (required so the
 *     proxy's Content-Length header matches the actual body)
 *   - All other calls (requests to the local test server) go through the real fetch
 */
function setupGithubRelease(): void {
  vi.stubGlobal(
    "fetch",
    async (
      url: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const urlStr = getUrlStr(url);

      if (isGithubApiUrl(urlStr)) {
        return new Response(
          JSON.stringify({
            tag_name: "v1.0.0",
            assets: [
              { name: APK_FILE, browser_download_url: GH_APK_URL, size: GH_APK_SIZE },
              { name: DMG_FILE, browser_download_url: GH_DMG_URL, size: GH_DMG_SIZE },
              { name: APPIMAGE_FILE, browser_download_url: GH_APPIMAGE_URL, size: 0 },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (isGithubCdnUrl(urlStr)) {
        let binaryContent: Buffer;
        if (urlStr === GH_APK_URL) binaryContent = GH_APK_CONTENT;
        else if (urlStr === GH_DMG_URL) binaryContent = GH_DMG_CONTENT;
        else binaryContent = Buffer.from("github-binary-data");

        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(binaryContent));
            controller.close();
          },
        });
        return new Response(body, { status: 200 });
      }

      // Local Express server — use the real fetch
      return realFetch(url, init);
    },
  );
}

/**
 * Stub fetch so that GitHub returns no release (404), while local server
 * requests still pass through to the real Express server.
 */
function setupGithubNoRelease(): void {
  vi.stubGlobal(
    "fetch",
    async (
      url: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const urlStr = getUrlStr(url);
      if (isGithubApiUrl(urlStr)) {
        return new Response(null, { status: 404 });
      }
      return realFetch(url, init);
    },
  );
}

/**
 * Stub fetch so that GitHub release metadata succeeds but binary asset
 * downloads fail with 502, while local server requests pass through.
 */
function setupGithubBinaryFails(): void {
  vi.stubGlobal(
    "fetch",
    async (
      url: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const urlStr = getUrlStr(url);
      if (isGithubApiUrl(urlStr)) {
        return new Response(
          JSON.stringify({
            tag_name: "v1.0.0",
            assets: [
              { name: APK_FILE, browser_download_url: GH_APK_URL, size: APK_SIZE },
            ],
          }),
          { status: 200 },
        );
      }
      if (isGithubCdnUrl(urlStr)) {
        return new Response(null, { status: 502 });
      }
      return realFetch(url, init);
    },
  );
}

// ---------------------------------------------------------------------------
// Express app + server lifecycle
// ---------------------------------------------------------------------------
let server: Server;
let base = "";

function buildApp(): Express {
  const app = express();
  app.use((req: ExpressRequest, _res: ExpressResponse, next: NextFunction) => {
    (req as ExpressRequest & { log: unknown }).log = {
      info: () => {},
      warn: () => {},
      error: () => {},
    } as unknown as ExpressRequest["log"];
    next();
  });
  app.use("/api", downloadRouter);
  return app;
}

beforeAll(async () => {
  process.env["ANDROID_APK_DIR"] = TEST_DL_DIR;
  await new Promise<void>((resolve) => {
    server = buildApp().listen(0, () => {
      const { port } = server.address() as AddressInfo;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  delete process.env["ANDROID_APK_DIR"];
  vi.unstubAllGlobals();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  // Reset FS state so each test starts with an empty virtual filesystem
  h.state.dirs = {};
  h.state.files = {};
  h.state.streamContent = {};
  // Clear cached GitHub release data and rate-limit counters
  clearReleaseCache();
  clearDownloadRateLimiter();
  // Default: GitHub returns no release; local server requests pass through
  setupGithubNoRelease();
});

// ===========================================================================
// Android — offline (bundled) path
// ===========================================================================
describe("Android APK — bundled (offline)", () => {
  it("GET /api/download/android returns correct metadata for a root-level APK", async () => {
    setupBundledApkInRoot();
    const res = await fetch(`${base}/api/download/android`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(true);
    expect(body.source).toBe("bundled");
    expect(body.filename).toBe(APK_FILE);
    expect(body.sizeBytes).toBe(APK_SIZE);
    expect(body.version).toBe("1.0.0");
    expect(body.downloadPath).toBe("/api/download/android.apk");
  });

  it("GET /api/download/android returns correct metadata for an android/-subdir APK", async () => {
    setupBundledApkInSubdir();
    const res = await fetch(`${base}/api/download/android`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(true);
    expect(body.source).toBe("bundled");
    expect(body.filename).toBe(APK_FILE);
  });

  it("GET /api/download/android.apk streams the bundled APK with correct headers", async () => {
    setupBundledApkInRoot();
    const res = await fetch(`${base}/api/download/android.apk`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.android.package-archive",
    );
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const data = Buffer.from(await res.arrayBuffer());
    expect(data).toEqual(APK_CONTENT);
  });

  it("GET /api/download/android/latest streams the bundled APK", async () => {
    setupBundledApkInRoot();
    const res = await fetch(`${base}/api/download/android/latest`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.android.package-archive",
    );
    const data = Buffer.from(await res.arrayBuffer());
    expect(data).toEqual(APK_CONTENT);
  });

  it("picks the newer APK when both root and android/ subdir contain one", async () => {
    const newerContent = Buffer.from("newer-apk-bytes");
    const newerMtime = APK_MTIME + 1000;
    const newerFile = "ENGRAM-Mobile-1.1.0.apk";
    h.state.dirs[TEST_DL_DIR] = [APK_FILE];
    h.state.dirs[`${TEST_DL_DIR}/android`] = [newerFile];
    h.state.files[APK_ROOT_PATH] = { size: APK_SIZE, mtimeMs: APK_MTIME };
    h.state.files[`${TEST_DL_DIR}/android/${newerFile}`] = {
      size: newerContent.byteLength, // must match content so Content-Length is correct
      mtimeMs: newerMtime,
    };
    h.state.streamContent[APK_ROOT_PATH] = APK_CONTENT;
    h.state.streamContent[`${TEST_DL_DIR}/android/${newerFile}`] = newerContent;

    const meta = await fetch(`${base}/api/download/android`);
    const body = (await meta.json()) as Record<string, unknown>;
    expect(body.filename).toBe(newerFile);
    expect(body.version).toBe("1.1.0");

    const dl = await fetch(`${base}/api/download/android.apk`);
    const data = Buffer.from(await dl.arrayBuffer());
    expect(data).toEqual(newerContent);
  });
});

// ===========================================================================
// Android — online (GitHub fallback) path
// ===========================================================================
describe("Android APK — GitHub fallback (online)", () => {
  it("GET /api/download/android returns metadata sourced from GitHub", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    setupGithubRelease();

    const res = await fetch(`${base}/api/download/android`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(true);
    expect(body.source).toBe("github");
    expect(body.filename).toBe(APK_FILE);
    expect(body.sizeBytes).toBe(GH_APK_SIZE);
    expect(body.version).toBe("1.0.0");
  });

  it("GET /api/download/android.apk proxy-streams the GitHub APK asset", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    setupGithubRelease();

    const res = await fetch(`${base}/api/download/android.apk`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.android.package-archive",
    );
    const data = Buffer.from(await res.arrayBuffer());
    expect(data).toEqual(GH_APK_CONTENT);
  });

  it("GET /api/download/android.apk returns 502 when the upstream binary download fails", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    setupGithubBinaryFails();

    const res = await fetch(`${base}/api/download/android.apk`);
    expect(res.status).toBe(502);
  });

  it("GET /api/download/android returns available:false when GitHub has no APK asset", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    vi.stubGlobal(
      "fetch",
      async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const urlStr = getUrlStr(url);
        if (isGithubApiUrl(urlStr)) {
          return new Response(
            JSON.stringify({ tag_name: "v1.0.0", assets: [] }),
            { status: 200 },
          );
        }
        return realFetch(url, init);
      },
    );

    const res = await fetch(`${base}/api/download/android`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(false);
  });
});

// ===========================================================================
// Android — nothing available
// ===========================================================================
describe("Android APK — nothing available", () => {
  it("GET /api/download/android returns available:false", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    const res = await fetch(`${base}/api/download/android`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(false);
    expect(body.source).toBeNull();
  });

  it("GET /api/download/android.apk returns 404", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    const res = await fetch(`${base}/api/download/android.apk`);
    expect(res.status).toBe(404);
  });

  it("GET /api/download/android/latest returns 404", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    const res = await fetch(`${base}/api/download/android/latest`);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// Desktop — offline (bundled) path
// ===========================================================================
describe("Desktop installers — bundled (offline)", () => {
  it("GET /api/download/desktop returns metadata for a root-level .dmg", async () => {
    setupBundledDesktopInRoot();
    const res = await fetch(`${base}/api/download/desktop`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(true);
    expect(body.source).toBe("bundled");
    expect(body.version).toBe("1.0.0");
    const installers = body.installers as Array<Record<string, unknown>>;
    expect(installers).toHaveLength(1);
    expect(installers[0]!.os).toBe("mac");
    expect(installers[0]!.filename).toBe(DMG_FILE);
    expect(installers[0]!.sizeBytes).toBe(DMG_SIZE);
    expect(String(installers[0]!.downloadPath)).toContain(DMG_FILE);
  });

  it("GET /api/download/desktop returns metadata for a desktop/-subdir installer", async () => {
    setupBundledDesktopInSubdir();
    const res = await fetch(`${base}/api/download/desktop`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(true);
    const installers = body.installers as Array<Record<string, unknown>>;
    expect(installers[0]!.filename).toBe(DMG_FILE);
  });

  it("GET /api/download/desktop returns all platform installers", async () => {
    setupBundledDesktopBothPlatforms();
    const res = await fetch(`${base}/api/download/desktop`);
    const body = (await res.json()) as Record<string, unknown>;
    const installers = body.installers as Array<Record<string, unknown>>;
    const oses = installers.map((i) => i["os"]);
    expect(oses).toContain("mac");
    expect(oses).toContain("linux");
  });

  it("GET /api/download/desktop/file/:name streams the bundled installer", async () => {
    setupBundledDesktopInRoot();
    const res = await fetch(
      `${base}/api/download/desktop/file/${encodeURIComponent(DMG_FILE)}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const data = Buffer.from(await res.arrayBuffer());
    expect(data).toEqual(DMG_CONTENT);
  });

  it("GET /api/download/desktop/latest/mac streams the bundled .dmg", async () => {
    setupBundledDesktopInRoot();
    const res = await fetch(`${base}/api/download/desktop/latest/mac`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    const data = Buffer.from(await res.arrayBuffer());
    expect(data).toEqual(DMG_CONTENT);
  });

  it("GET /api/download/desktop/latest/linux streams an .AppImage", async () => {
    setupBundledDesktopBothPlatforms();
    const res = await fetch(`${base}/api/download/desktop/latest/linux`);
    expect(res.status).toBe(200);
    const data = Buffer.from(await res.arrayBuffer());
    expect(data).toEqual(APPIMAGE_CONTENT);
  });

  it("picks the newer installer when both root and desktop/ subdir have a .dmg", async () => {
    const newerFile = "ENGRAM-Desktop-1.1.0.dmg";
    const newerContent = Buffer.from("newer-dmg-bytes");
    const newerMtime = DMG_MTIME + 1000;
    h.state.dirs[TEST_DL_DIR] = [DMG_FILE];
    h.state.dirs[`${TEST_DL_DIR}/desktop`] = [newerFile];
    h.state.files[DMG_ROOT_PATH] = { size: DMG_SIZE, mtimeMs: DMG_MTIME };
    h.state.files[`${TEST_DL_DIR}/desktop/${newerFile}`] = {
      size: newerContent.byteLength, // must match content so Content-Length is correct
      mtimeMs: newerMtime,
    };
    h.state.streamContent[DMG_ROOT_PATH] = DMG_CONTENT;
    h.state.streamContent[`${TEST_DL_DIR}/desktop/${newerFile}`] = newerContent;

    const meta = await fetch(`${base}/api/download/desktop`);
    const body = (await meta.json()) as Record<string, unknown>;
    const installers = body.installers as Array<Record<string, unknown>>;
    expect(installers[0]!.filename).toBe(newerFile);

    const dl = await fetch(`${base}/api/download/desktop/latest/mac`);
    const data = Buffer.from(await dl.arrayBuffer());
    expect(data).toEqual(newerContent);
  });
});

// ===========================================================================
// Desktop — online (GitHub fallback) path
// ===========================================================================
describe("Desktop installers — GitHub fallback (online)", () => {
  it("GET /api/download/desktop returns metadata from GitHub release", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    setupGithubRelease();

    const res = await fetch(`${base}/api/download/desktop`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(true);
    expect(body.source).toBe("github");
    expect(body.version).toBe("1.0.0");
    const installers = body.installers as Array<Record<string, unknown>>;
    const oses = installers.map((i) => i["os"]);
    expect(oses).toContain("mac");
    expect(oses).toContain("linux");
  });

  it("GET /api/download/desktop/file/:name proxy-streams a GitHub asset", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    setupGithubRelease();

    const res = await fetch(
      `${base}/api/download/desktop/file/${encodeURIComponent(DMG_FILE)}`,
    );
    expect(res.status).toBe(200);
    const data = Buffer.from(await res.arrayBuffer());
    expect(data).toEqual(GH_DMG_CONTENT);
  });

  it("GET /api/download/desktop/latest/mac proxy-streams the GitHub .dmg", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    setupGithubRelease();

    const res = await fetch(`${base}/api/download/desktop/latest/mac`);
    expect(res.status).toBe(200);
    const data = Buffer.from(await res.arrayBuffer());
    expect(data).toEqual(GH_DMG_CONTENT);
  });

  it("GET /api/download/desktop returns available:false when GitHub has no installer assets", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    vi.stubGlobal(
      "fetch",
      async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const urlStr = getUrlStr(url);
        if (isGithubApiUrl(urlStr)) {
          return new Response(
            JSON.stringify({ tag_name: "v1.0.0", assets: [] }),
            { status: 200 },
          );
        }
        return realFetch(url, init);
      },
    );

    const res = await fetch(`${base}/api/download/desktop`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(false);
  });
});

// ===========================================================================
// Desktop — nothing available
// ===========================================================================
describe("Desktop installers — nothing available", () => {
  it("GET /api/download/desktop returns available:false", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    const res = await fetch(`${base}/api/download/desktop`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(false);
    expect(body.installers).toEqual([]);
  });

  it("GET /api/download/desktop/file/:name returns 404", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    const res = await fetch(
      `${base}/api/download/desktop/file/ENGRAM-Desktop-1.0.0.dmg`,
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/download/desktop/latest/mac returns 404 when no mac installer", async () => {
    h.state.dirs[TEST_DL_DIR] = [];
    const res = await fetch(`${base}/api/download/desktop/latest/mac`);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// Desktop — edge cases
// ===========================================================================
describe("Desktop installers — edge cases", () => {
  it("GET /api/download/desktop/latest/:os returns 400 for an invalid OS", async () => {
    const res = await fetch(`${base}/api/download/desktop/latest/amiga`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
  });

  it("GET /api/download/desktop/file/:name returns 404 for a path-traversal attempt", async () => {
    setupBundledDesktopInRoot();
    const res = await fetch(
      `${base}/api/download/desktop/file/${encodeURIComponent("../secret.txt")}`,
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/download/desktop/file/:name returns 404 for an unknown filename", async () => {
    setupBundledDesktopInRoot();
    const res = await fetch(
      `${base}/api/download/desktop/file/nonexistent.dmg`,
    );
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// Rate limiting
// ===========================================================================
describe("Rate limiting", () => {
  it("returns 429 on the 31st request to android/latest within the window", async () => {
    // No APK available — the 404 path still counts against the rate limit.
    h.state.dirs[TEST_DL_DIR] = [];

    // 30 requests — all should succeed (404, not 429)
    const first30 = await Promise.all(
      Array.from({ length: 30 }, () =>
        fetch(`${base}/api/download/android/latest`),
      ),
    );
    for (const r of first30) {
      expect(r.status).not.toBe(429);
    }

    // 31st hits the rate limit
    const over = await fetch(`${base}/api/download/android/latest`);
    expect(over.status).toBe(429);
    const body = (await over.json()) as Record<string, unknown>;
    expect(typeof body.error).toBe("string");
  });

  it("returns 429 on the 31st request to desktop/latest/:os within the window", async () => {
    h.state.dirs[TEST_DL_DIR] = [];

    const first30 = await Promise.all(
      Array.from({ length: 30 }, () =>
        fetch(`${base}/api/download/desktop/latest/mac`),
      ),
    );
    for (const r of first30) {
      expect(r.status).not.toBe(429);
    }

    const over = await fetch(`${base}/api/download/desktop/latest/mac`);
    expect(over.status).toBe(429);
  });
});
