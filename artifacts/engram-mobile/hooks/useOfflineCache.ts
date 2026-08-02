import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback } from "react";

const PREFIX = "engram.cache.";

export function useOfflineCache<T>(key: string) {
  const storageKey = `${PREFIX}${key}`;

  const write = useCallback(async (data: T): Promise<void> => {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify({ ts: Date.now(), data }));
    } catch {}
  }, [storageKey]);

  const read = useCallback(async (): Promise<{ data: T; ts: number } | null> => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as { data: T; ts: number };
    } catch { return null; }
  }, [storageKey]);

  const clear = useCallback(async (): Promise<void> => {
    try { await AsyncStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  return { read, write, clear };
}
