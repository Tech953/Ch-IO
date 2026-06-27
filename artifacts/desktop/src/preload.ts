import { contextBridge, ipcRenderer } from "electron";

export interface SettingsView {
  mode: "offline" | "online";
  offline: { baseUrl: string; model: string };
  online: { baseUrl: string; model: string };
  hasApiKey: boolean;
  encryptionAvailable: boolean;
}

export interface SettingsPayload {
  mode: "offline" | "online";
  offline: { baseUrl: string; model: string };
  online: { baseUrl: string; model: string; apiKey: string };
}

export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version?: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version?: string }
  | { state: "error"; message: string };

export interface AppInfo {
  version: string;
  updatesSupported: boolean;
  updateStatus: UpdateStatus;
}

contextBridge.exposeInMainWorld("engram", {
  getSettings: (): Promise<SettingsView> => ipcRenderer.invoke("settings:get"),
  saveSettings: (
    payload: SettingsPayload,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("settings:save", payload),
  close: (): Promise<void> => ipcRenderer.invoke("settings:close"),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:info"),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke("update:check"),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_event: unknown, status: UpdateStatus): void =>
      callback(status);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
});
