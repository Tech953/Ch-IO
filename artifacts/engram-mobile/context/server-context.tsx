/**
 * ServerContext — manages the Engram API base URL for the mobile app.
 *
 * Offline / local-first design:
 * - Default: http://localhost:5000  (works when the desktop app is on
 *   the same Android device via ADB port-forward, or for future embedded mode)
 * - User can change the URL to any reachable Engram server
 *   (local network IP, VPN, cloud host) and it is persisted across launches.
 * - setBaseUrl() from @workspace/api-client-react is called whenever the
 *   URL changes, so all React-Query hooks pick it up automatically.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { setBaseUrl } from "@workspace/api-client-react";

export const DEFAULT_SERVER_URL = "http://localhost:5000";
const STORAGE_KEY = "engram.serverUrl";
const OFFLINE_KEY = "engram.offlineMode";

export type ConnectionStatus = "unknown" | "checking" | "connected" | "unreachable";

interface ServerContextValue {
  serverUrl: string;
  connectionStatus: ConnectionStatus;
  hydrated: boolean;
  /** True once the user has saved a server URL (persisted in AsyncStorage). */
  isConfigured: boolean;
  /** When true, screens skip network calls and read from the offline cache. */
  offlineMode: boolean;
  setOfflineMode: (enabled: boolean) => Promise<void>;
  updateServerUrl: (url: string) => Promise<void>;
  checkConnection: () => Promise<void>;
}

const ServerContext = createContext<ServerContextValue | undefined>(undefined);

export function ServerProvider({ children }: { children: React.ReactNode }) {
  const [serverUrl, setServerUrlState] = useState<string>(DEFAULT_SERVER_URL);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("unknown");
  const [hydrated, setHydrated] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [offlineMode, setOfflineModeState] = useState(false);

  // Load persisted URL on boot and apply it immediately
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(OFFLINE_KEY)])
      .then(([stored, storedOffline]) => {
        const saved = stored?.trim();
        const url = saved || DEFAULT_SERVER_URL;
        setServerUrlState(url);
        setBaseUrl(url);
        setIsConfigured(!!saved);
        setOfflineModeState(storedOffline === "true");
      })
      .catch(() => {
        setBaseUrl(DEFAULT_SERVER_URL);
      })
      .finally(() => setHydrated(true));
  }, []);

  const updateServerUrl = useCallback(async (url: string) => {
    const clean = url.trim().replace(/\/+$/, "");
    setServerUrlState(clean);
    setBaseUrl(clean);
    setConnectionStatus("unknown");
    setIsConfigured(!!clean);
    if (clean) await AsyncStorage.setItem(STORAGE_KEY, clean);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const setOfflineMode = useCallback(async (enabled: boolean) => {
    setOfflineModeState(enabled);
    await AsyncStorage.setItem(OFFLINE_KEY, String(enabled));
  }, []);

  const checkConnection = useCallback(async () => {
    setConnectionStatus("checking");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${serverUrl}/api/healthz`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      setConnectionStatus(res.ok ? "connected" : "unreachable");
    } catch {
      setConnectionStatus("unreachable");
    }
  }, [serverUrl]);

  const value = useMemo(
    () => ({
      serverUrl,
      connectionStatus,
      hydrated,
      isConfigured,
      offlineMode,
      setOfflineMode,
      updateServerUrl,
      checkConnection,
    }),
    [serverUrl, connectionStatus, hydrated, isConfigured, offlineMode, setOfflineMode, updateServerUrl, checkConnection],
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerContextValue {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error("useServer must be used within ServerProvider");
  return ctx;
}
