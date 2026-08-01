export interface ConnectionSettings {
  mode: "offline" | "online";
  offline: { baseUrl: string; model: string };
  online: { baseUrl: string; model: string };
  hasOnlineApiKey: boolean;
}

export function normalizeBaseUrl(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

export function isValidBaseUrl(input: string): boolean {
  try {
    const url = new URL(normalizeBaseUrl(input));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateConnectionSettings(
  settings: ConnectionSettings,
): string | null {
  if (!isValidBaseUrl(settings.offline.baseUrl)) return "settings.validation.offlineBaseUrl";
  if (!settings.offline.model.trim()) return "settings.validation.offlineModel";
  if (!isValidBaseUrl(settings.online.baseUrl)) return "settings.validation.onlineBaseUrl";
  if (!settings.online.model.trim()) return "settings.validation.onlineModel";
  if (settings.mode === "online" && !settings.hasOnlineApiKey) {
    return "settings.validation.onlineApiKey";
  }
  return null;
}

export async function testOnlineConnection(
  baseUrl: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = `${normalizeBaseUrl(baseUrl)}/models`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: "Bearer " + apiKey },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
