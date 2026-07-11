import { contextBridge, ipcRenderer } from "electron";
import type { SupportedLocale } from "@workspace/localization";

export interface SettingsView {
  mode: "offline" | "online";
  locale: SupportedLocale;
  offline: { baseUrl: string; model: string };
  online: { baseUrl: string; model: string };
  hasApiKey: boolean;
  encryptionAvailable: boolean;
  localeLabels: Record<SupportedLocale, string>;
  messages: Record<string, string>;
}

export interface SettingsPayload {
  mode: "offline" | "online";
  locale: SupportedLocale;
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
  getMessages: (
    locale: SupportedLocale,
  ): Promise<Record<string, string>> =>
    ipcRenderer.invoke("i18n:messages", locale),
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
