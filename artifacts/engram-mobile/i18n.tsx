import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  MOBILE_CATALOG,
  SUPPORTED_LOCALES,
  normalizeLocale,
  tFromCatalog,
  type SupportedLocale,
} from "@workspace/localization";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "engram.locale";

type I18nContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function deviceLocale(): SupportedLocale {
  const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
  return normalizeLocale(resolved ?? DEFAULT_LOCALE);
}

export function MobileI18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(deviceLocale);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setLocaleState(normalizeLocale(stored));
      })
      .catch(() => {});
  }, []);

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      tFromCatalog(locale, MOBILE_CATALOG, key, values),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useMobileI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useMobileI18n must be used within MobileI18nProvider");
  return ctx;
}

export const MOBILE_SUPPORTED_LOCALES = SUPPORTED_LOCALES;
export const MOBILE_LOCALE_LABELS = LOCALE_LABELS;
