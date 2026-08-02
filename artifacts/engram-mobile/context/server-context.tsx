import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setBaseUrl } from "@workspace/api-client-react";

const STORAGE_SERVER_URL = "engram.serverUrl";
const STORAGE_OFFLINE_MODE = "engram.offlineMode";

interface ServerContextValue {
  serverUrl: string | null;
  offlineMode: boolean;
  isConfigured: boolean;
  hydrated: boolean;
  setServerUrl: (url: string | null) => Promise<void>;
  setOfflineMode: (enabled: boolean) => Promise<void>;
  testConnection: (url: string) => Promise<{ ok: boolean; error?: string }>;
}

const ServerContext = createContext<ServerContextValue | undefined>(undefined);

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const [offlineMode, setOfflineModeState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedUrl, savedOffline] = await Promise.all([
          AsyncStorage.getItem(STORAGE_SERVER_URL),
          AsyncStorage.getItem(STORAGE_OFFLINE_MODE),
        ]);
        const url = savedUrl ?? null;
        setServerUrlState(url);
        setOfflineModeState(savedOffline === "true");
        setBaseUrl(url);
      } catch {
        // ignore
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setServerUrl = useCallback(async (url: string | null) => {
    const n = url ? url.replace(/\/+$/, "").trim() : null;
    setServerUrlState(n);
    setBaseUrl(n);
    if (n) await AsyncStorage.setItem(STORAGE_SERVER_URL, n);
    else await AsyncStorage.removeItem(STORAGE_SERVER_URL);
  }, []);

  const setOfflineMode = useCallback(async (enabled: boolean) => {
    setOfflineModeState(enabled);
    await AsyncStorage.setItem(STORAGE_OFFLINE_MODE, String(enabled));
  }, []);

  const testConnection = useCallback(async (url: string) => {
    try {
      const n = url.replace(/\/+$/, "").trim();
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${n}/api/healthz`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return { ok: true };
      return { ok: false, error: `Server responded with status ${res.status}` };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.name === "AbortError"
          ? "Connection timed out (8s). Check the URL and network."
          : e?.message ?? "Could not reach server.",
      };
    }
  }, []);

  const value = useMemo(
    () => ({ serverUrl, offlineMode, isConfigured: !!serverUrl, hydrated, setServerUrl, setOfflineMode, testConnection }),
    [serverUrl, offlineMode, hydrated, setServerUrl, setOfflineMode, testConnection],
  );
  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerContextValue {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error("useServer must be used within ServerProvider");
  return ctx;
}
