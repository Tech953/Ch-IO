import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  safeStorage,
  shell,
  dialog,
} from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";
import http from "node:http";

// ---------------------------------------------------------------------------
// Paths. In a packaged app, bundled resources live under process.resourcesPath
// (see extraResources in electron-builder.yml). In an unpackaged dev run
// (`electron .`), they live under artifacts/desktop/resources (built by
// scripts/prepare-resources.mjs).
// ---------------------------------------------------------------------------
const resourcesDir = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, "..", "resources");

const serverEntry = path.join(resourcesDir, "server", "index.mjs");
const webDist = path.join(resourcesDir, "web");
const migrationsDir = path.join(resourcesDir, "drizzle");

let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let currentPort = 0;
let quitting = false;

function userDataPath(...segments: string[]): string {
  return path.join(app.getPath("userData"), ...segments);
}

// ---------------------------------------------------------------------------
// Settings: persisted to userData/settings.json. The online API key is stored
// encrypted via Electron safeStorage when the OS keychain is available, and
// only ever decrypted in-process to hand to the server child as LLM_API_KEY.
// If the OS keychain is unavailable, the key is NEVER written to disk: it is
// held in memory for the current session only (see sessionApiKey) and must be
// re-entered on the next launch.
// ---------------------------------------------------------------------------
interface Settings {
  mode: "offline" | "online";
  offline: { baseUrl: string; model: string };
  online: {
    baseUrl: string;
    model: string;
    apiKeyEnc?: string;
  };
}

// Online API key kept in memory only when the OS keychain is unavailable, so it
// is never persisted in plaintext. Cleared on quit; the user re-enters it next
// launch. When the keychain IS available the key lives in settings.apiKeyEnc.
let sessionApiKey: string | null = null;

const DEFAULT_SETTINGS: Settings = {
  mode: "offline",
  offline: { baseUrl: "http://localhost:11434/v1", model: "llama3.1" },
  online: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
};

function settingsFile(): string {
  return userDataPath("settings.json");
}

function loadSettings(): Settings {
  try {
    const raw = readFileSync(settingsFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      mode: parsed.mode === "online" ? "online" : "offline",
      offline: { ...DEFAULT_SETTINGS.offline, ...(parsed.offline ?? {}) },
      online: { ...DEFAULT_SETTINGS.online, ...(parsed.online ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function saveSettings(settings: Settings): void {
  mkdirSync(path.dirname(settingsFile()), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), "utf8");
}

function resolveApiKey(settings: Settings): string {
  if (settings.mode === "offline") return "local-placeholder";
  const online = settings.online;
  if (online.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(online.apiKeyEnc, "base64"));
    } catch {
      return "";
    }
  }
  return sessionApiKey ?? "";
}

function buildServerEnv(
  settings: Settings,
  port: number,
): NodeJS.ProcessEnv {
  const active =
    settings.mode === "offline" ? settings.offline : settings.online;
  const apiKey = resolveApiKey(settings) || "local-placeholder";
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    ENGRAM_DB_DRIVER: "pglite",
    PGLITE_DATA_DIR: userDataPath("db"),
    DRIZZLE_MIGRATIONS_DIR: migrationsDir,
    WEB_DIST: webDist,
    HOST: "127.0.0.1",
    PORT: String(port),
    LLM_BASE_URL: active.baseUrl,
    LLM_MODEL: active.model,
    LLM_API_KEY: apiKey,
  };
}

// ---------------------------------------------------------------------------
// Server child process lifecycle.
// ---------------------------------------------------------------------------
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port =
        address && typeof address === "object" ? address.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function waitForHealth(port: number, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = (): void => {
      const req = http.get(
        { host: "127.0.0.1", port, path: "/api/healthz", timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        },
      );
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
    };
    const retry = (): void => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Embedded server did not become healthy in time."));
      } else {
        setTimeout(attempt, 500);
      }
    };
    attempt();
  });
}

async function startServer(): Promise<void> {
  if (!existsSync(serverEntry)) {
    throw new Error(
      `Server bundle not found at ${serverEntry}. Run the desktop build (pnpm --filter @workspace/desktop run build) first.`,
    );
  }
  const settings = loadSettings();
  mkdirSync(userDataPath("db"), { recursive: true });
  currentPort = await findFreePort();
  const env = buildServerEnv(settings, currentPort);

  serverProcess = spawn(process.execPath, [serverEntry], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(`[server] ${chunk.toString()}`);
  });
  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[server] ${chunk.toString()}`);
  });
  serverProcess.on("exit", (code, signal) => {
    if (!quitting) {
      // eslint-disable-next-line no-console
      console.error(
        `[desktop] server process exited unexpectedly (code=${code}, signal=${signal}).`,
      );
    }
    serverProcess = null;
  });

  await waitForHealth(currentPort);
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    const proc = serverProcess;
    if (!proc) {
      resolve();
      return;
    }
    serverProcess = null;
    const killTimer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      resolve();
    }, 5000);
    proc.once("exit", () => {
      clearTimeout(killTimer);
      resolve();
    });
    proc.kill("SIGTERM");
  });
}

async function restartServer(): Promise<void> {
  await stopServer();
  await startServer();
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.loadURL(`http://127.0.0.1:${currentPort}/`);
  }
}

// ---------------------------------------------------------------------------
// Windows + menu.
// ---------------------------------------------------------------------------
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#070b12",
    title: "ENGRAM — PYRI",
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  void mainWindow.loadURL(`http://127.0.0.1:${currentPort}/`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1")) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 560,
    height: 640,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow ?? undefined,
    modal: true,
    backgroundColor: "#070b12",
    title: "ENGRAM — Settings",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  void settingsWindow.loadFile(path.join(__dirname, "settings.html"));
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function buildMenu(): void {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              {
                label: "Settings…",
                accelerator: "Cmd+,",
                click: openSettingsWindow,
              },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Settings…",
          accelerator: "CmdOrCtrl+,",
          click: openSettingsWindow,
        },
        { type: "separator" as const },
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" as const },
        { role: "forceReload" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
        { role: "toggleDevTools" as const },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// IPC: settings get/save/close.
// ---------------------------------------------------------------------------
ipcMain.handle("settings:get", () => {
  const settings = loadSettings();
  return {
    mode: settings.mode,
    offline: settings.offline,
    online: {
      baseUrl: settings.online.baseUrl,
      model: settings.online.model,
    },
    hasApiKey: Boolean(settings.online.apiKeyEnc) || Boolean(sessionApiKey),
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
  };
});

ipcMain.handle(
  "settings:save",
  async (_event, payload: {
    mode: "offline" | "online";
    offline: { baseUrl: string; model: string };
    online: { baseUrl: string; model: string; apiKey: string };
  }) => {
    try {
      const previous = loadSettings();
      const next: Settings = {
        mode: payload.mode === "online" ? "online" : "offline",
        offline: {
          baseUrl: payload.offline.baseUrl.trim() || DEFAULT_SETTINGS.offline.baseUrl,
          model: payload.offline.model.trim() || DEFAULT_SETTINGS.offline.model,
        },
        online: {
          baseUrl: payload.online.baseUrl.trim() || DEFAULT_SETTINGS.online.baseUrl,
          model: payload.online.model.trim() || DEFAULT_SETTINGS.online.model,
          apiKeyEnc: previous.online.apiKeyEnc,
        },
      };

      const newKey = payload.online.apiKey;
      if (typeof newKey === "string" && newKey.length > 0) {
        if (safeStorage.isEncryptionAvailable()) {
          next.online.apiKeyEnc = safeStorage
            .encryptString(newKey)
            .toString("base64");
          sessionApiKey = null;
        } else {
          // No OS keychain: hold the key in memory for this session only.
          // It is intentionally never written to settings.json in plaintext.
          sessionApiKey = newKey;
          delete next.online.apiKeyEnc;
        }
      }

      saveSettings(next);
      await restartServer();
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.close();
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },
);

ipcMain.handle("settings:close", () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
});

// ---------------------------------------------------------------------------
// App lifecycle.
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    try {
      await startServer();
      createMainWindow();
    } catch (error) {
      dialog.showErrorBox(
        "ENGRAM failed to start",
        `The embedded server could not start.\n\n${String(error)}`,
      );
      app.quit();
    }

    app.on("activate", () => {
      if (mainWindow === null && currentPort) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", (event) => {
    if (serverProcess && !quitting) {
      event.preventDefault();
      quitting = true;
      void stopServer().finally(() => app.quit());
    }
  });
}
