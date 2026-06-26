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

contextBridge.exposeInMainWorld("engram", {
  getSettings: (): Promise<SettingsView> => ipcRenderer.invoke("settings:get"),
  saveSettings: (
    payload: SettingsPayload,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("settings:save", payload),
  close: (): Promise<void> => ipcRenderer.invoke("settings:close"),
});
