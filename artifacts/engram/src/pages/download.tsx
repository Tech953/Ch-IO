import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { type SupportedLocale } from "@workspace/localization";
import {
  Download,
  Apple,
  MonitorDown,
  Terminal as TerminalIcon,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Maps our 2-letter SupportedLocale codes to full BCP 47 tags for APIs that
// require them (Intl.NumberFormat, String.prototype.localeCompare).
const LOCALE_BCP47: Record<SupportedLocale, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
};

// GitHub repository (owner/repo) that hosts the releases produced by
// .github/workflows/desktop-build.yml. Used here ONLY for the external
// "release notes" link; the actual downloads are served same-origin by this
// app's API (see below), so the browser never calls the GitHub API directly.
const GITHUB_REPO =
  (import.meta.env.VITE_GITHUB_REPO as string | undefined)?.trim() ||
  "Tech953/Ch-IO";

const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;

// Same-origin download endpoints served by this app's API
// (artifacts/api-server routes/download.ts). Each meta endpoint reports
// availability + source (a bundled file committed into the deploy, else the
// latest GitHub release proxied through this origin); the binary endpoints
// stream the file itself. Everything stays on the deploy's own origin.
const DESKTOP_META_URL = "/api/download/desktop";
const ANDROID_META_URL = "/api/download/android";
const ANDROID_APK_URL = "/api/download/android.apk";

type Os = "mac" | "win" | "linux" | "android";
type DesktopOs = "mac" | "win" | "linux";

type DesktopInstaller = {
  os: DesktopOs;
  ext: string;
  filename: string;
  sizeBytes: number;
  downloadPath: string;
};

type DesktopMeta = {
  available: boolean;
  source: "bundled" | "github" | null;
  version: string | null;
  installers: DesktopInstaller[];
};

type AndroidMeta = {
  available: boolean;
  source: "bundled" | "github" | null;
  version: string | null;
  filename: string | null;
  sizeBytes: number | null;
  downloadPath: string | null;
};

type DownloadLink = {
  key: string;
  href: string;
  label: string;
  filename: string;
  size?: number;
};

const OS_META: Record<Os, { name: string; icon: typeof Apple; noteKey: string }> = {
  mac: { name: "macOS", icon: Apple, noteKey: "download.noteMac" },
  win: {
    name: "Windows",
    icon: MonitorDown,
    noteKey: "download.noteWin",
  },
  linux: {
    name: "Linux",
    icon: TerminalIcon,
    noteKey: "download.noteLinux",
  },
  android: {
    name: "Android",
    icon: Smartphone,
    noteKey: "download.noteAndroid",
  },
};

const OS_ORDER: Os[] = ["mac", "win", "linux", "android"];

function detectOs(): Os | null {
  if (typeof navigator === "undefined") return null;
  const ua = `${navigator.userAgent} ${navigator.platform ?? ""}`.toLowerCase();
  // Android must be checked first: its UA string also contains "linux", so the
  // Linux check below would otherwise swallow it.
  if (ua.includes("android")) return "android";
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "win";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";
  return null;
}

function formatSize(locale: SupportedLocale, bytes?: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${new Intl.NumberFormat(LOCALE_BCP47[locale], {
    minimumFractionDigits: mb >= 100 ? 0 : 1,
    maximumFractionDigits: mb >= 100 ? 0 : 1,
  }).format(mb)} MB`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json() as Promise<T>;
}

export default function DownloadPage() {
  const { locale, t } = useI18n();
  const { toast } = useToast();
  const detectedOs = useMemo(detectOs, []);

  const sourceLabel = (source: "bundled" | "github" | null | undefined): string => {
    if (source === "bundled") return t("download.sourceBundled");
    if (source === "github") return t("download.sourceGithub");
    return "";
  };

  const absoluteHref = (href: string): string => {
    if (href.startsWith("http://") || href.startsWith("https://")) return href;
    if (typeof window === "undefined") return href;
    return new URL(href, window.location.origin).toString();
  };

  const copyLink = async (href: string): Promise<void> => {
    const full = absoluteHref(href);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(full);
      } else {
        const ta = document.createElement("textarea");
        ta.value = full;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast({ title: t("download.copyLinkSuccess") });
    } catch {
      toast({ title: t("download.copyLinkError"), variant: "destructive" });
    }
  };

  // Desktop installers (mac/win/linux) — same-origin meta from this app's API.
  const desktopQuery = useQuery<DesktopMeta>({
    queryKey: ["desktop-download-meta"],
    queryFn: () => fetchJson<DesktopMeta>(DESKTOP_META_URL),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Android — same-origin meta from this app's API.
  const androidQuery = useQuery<AndroidMeta>({
    queryKey: ["android-download-meta"],
    queryFn: () => fetchJson<AndroidMeta>(ANDROID_META_URL),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const desktopByOs = useMemo(() => {
    const map: Record<DesktopOs, DownloadLink[]> = { mac: [], win: [], linux: [] };
    for (const inst of desktopQuery.data?.installers ?? []) {
      if (!map[inst.os]) continue;
      map[inst.os].push({
        key: inst.filename,
        href: inst.downloadPath,
        label: t("download.downloadExt", { ext: inst.ext }),
        filename: inst.filename,
        size: inst.sizeBytes,
      });
    }
    // Stable order within an OS (e.g. Linux .AppImage before .deb).
    for (const os of ["mac", "win", "linux"] as DesktopOs[]) {
      map[os].sort((a, b) => a.label.localeCompare(b.label, LOCALE_BCP47[locale]));
    }
    return map;
  }, [desktopQuery.data, locale, t]);

  const android = androidQuery.data;
  const androidLinks: DownloadLink[] = useMemo(() => {
    if (!android?.available) return [];
    return [
      {
        key: android.filename ?? "engram.apk",
        href: android.downloadPath ?? ANDROID_APK_URL,
        label: t("download.installApk"),
        filename: android.filename ?? "engram.apk",
        size: android.sizeBytes ?? undefined,
      },
    ];
  }, [android, t]);

  const linksByOs: Record<Os, DownloadLink[]> = {
    mac: desktopByOs.mac,
    win: desktopByOs.win,
    linux: desktopByOs.linux,
    android: androidLinks,
  };

  const hasAnyCard = OS_ORDER.some((os) => linksByOs[os].length > 0);
  const isLoading = desktopQuery.isLoading || androidQuery.isLoading;
  const isError = desktopQuery.isError && androidQuery.isError;

  const version = desktopQuery.data?.version ?? android?.version ?? null;
  const hasRecommended =
    detectedOs !== null && linksByOs[detectedOs] && linksByOs[detectedOs].length > 0;

  const orderedOs = useMemo(
    () =>
      [...OS_ORDER].sort((a, b) => {
        if (a === detectedOs && b !== detectedOs) return -1;
        if (b === detectedOs && a !== detectedOs) return 1;
        return OS_ORDER.indexOf(a) - OS_ORDER.indexOf(b);
      }),
    [detectedOs],
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-widest text-primary">
            {t("download.title")}
          </h2>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            {t("download.subtitle")}
          </p>
        </div>

        <Card className="bg-card/40 border-primary/20 backdrop-blur-sm">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">
                {t("download.directLinks")}:
              </span>{" "}
              <a className="text-primary hover:underline" href="/api/download/desktop/latest/mac" download>
                {t("download.directDesktop", { os: "mac" })}
              </a>
              {" · "}
              <a className="text-primary hover:underline" href="/api/download/desktop/latest/win" download>
                {t("download.directDesktop", { os: "win" })}
              </a>
              {" · "}
              <a className="text-primary hover:underline" href="/api/download/desktop/latest/linux" download>
                {t("download.directDesktop", { os: "linux" })}
              </a>
              {" · "}
              <a className="text-primary hover:underline" href="/api/download/android/latest" download>
                {t("download.directAndroid")}
              </a>
            </p>
          </CardContent>
        </Card>

        {!isLoading && hasRecommended && detectedOs && (
          <Card className="bg-card/40 border-primary/30 backdrop-blur-sm glow-box">
            <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-foreground">{t("download.quickInstall")}</p>
                <p className="text-xs text-muted-foreground">{t("download.quickInstallBody")}</p>
              </div>
              <a
                href={linksByOs[detectedOs][0].href}
                download={linksByOs[detectedOs][0].filename}
                className="inline-flex items-center gap-2 px-4 py-2 border border-primary/50 text-primary bg-primary/10 hover:bg-primary/20 transition-colors font-mono text-xs uppercase tracking-widest"
              >
                <Download className="w-4 h-4" />
                {linksByOs[detectedOs][0].label}
              </a>
            </CardContent>
          </Card>
        )}
        <div className="flex items-center gap-3 font-mono text-xs">
          {isLoading ? (
            <Skeleton className="h-6 w-28 bg-primary/10" />
          ) : version ? (
            <span className="px-3 py-1.5 border border-primary/30 text-primary uppercase tracking-widest bg-primary/5">
              {t("download.latest", { version })}
            </span>
          ) : null}
        </div>
      </div>

      {/* Auto-update note */}
      <Card className="bg-card/40 border-primary/20 backdrop-blur-sm">
        <CardContent className="p-4 flex items-start gap-3">
          <RefreshCw className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">
              {t("download.autoUpdateStrong")}
            </span>{" "}
            {t("download.autoUpdateBody")}
          </p>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full bg-primary/5" />
          ))}
        </div>
      )}

      {!isLoading && hasAnyCard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {orderedOs.map((os) => {
            const links = linksByOs[os];
            if (links.length === 0) return null;
            const meta = OS_META[os];
            const Icon = meta.icon;
            const isRecommended = os === detectedOs;
            return (
              <Card
                key={os}
                className={`bg-card/40 backdrop-blur-sm flex flex-col ${
                  isRecommended
                    ? "border-primary glow-box ring-1 ring-primary/30"
                    : "border-border/50"
                }`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="font-display tracking-widest text-sm text-primary/90 flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    {meta.name}
                    {isRecommended && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-primary font-mono uppercase tracking-widest">
                        <CheckCircle2 className="w-3 h-3" />{" "}
                        {os === "android"
                          ? t("download.yourDevice")
                          : t("download.yourOs")}
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs font-mono text-muted-foreground">
                  {t(meta.noteKey)}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 mt-auto">
                  {links.map((link) => (
                    <div key={link.key} className="space-y-1">
                      <div className="flex items-stretch gap-2">
                        <a
                          href={link.href}
                          download={link.filename}
                          className={`flex items-center gap-2 px-3 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors border flex-1 ${
                            isRecommended
                              ? "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20"
                              : "border-border/60 text-foreground hover:bg-white/5 hover:border-primary/40"
                          }`}
                        >
                          <Download className="w-4 h-4 shrink-0" />
                          <span className="truncate">{link.label}</span>
                          {link.size ? (
                            <span className="ml-auto text-muted-foreground normal-case">
                              {formatSize(locale, link.size)}
                            </span>
                          ) : null}
                        </a>
                        <button
                          type="button"
                          onClick={() => void copyLink(link.href)}
                          className="px-2.5 border border-border/60 hover:border-primary/40 hover:bg-white/5 text-muted-foreground hover:text-primary transition-colors"
                          aria-label={t("download.copyLink")}
                          title={t("download.copyLink")}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground break-all">
                        {t("download.fileName")}: {link.filename}
                      </p>
                    </div>
                  ))}
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {t("download.source")}:{" "}
                    {os === "android"
                      ? sourceLabel(android?.source)
                      : sourceLabel(desktopQuery.data?.source)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && !hasAnyCard && (
        <Card
          className={`bg-card/40 backdrop-blur-sm ${
            isError ? "border-destructive/40" : "border-border/50"
          }`}
        >
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <AlertTriangle
              className={`w-8 h-8 ${
                isError ? "text-destructive/80" : "text-muted-foreground/60"
              }`}
            />
            {isError ? (
              <p className="text-sm text-muted-foreground max-w-md">
                {t("download.couldNotReach")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground max-w-lg">
                {t("download.nonePublished")}
              </p>
            )}
            <a
              href={RELEASES_PAGE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-primary/40 text-primary font-mono text-xs uppercase tracking-widest hover:bg-primary/10 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> {t("download.openReleases")}
            </a>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-border/40">
        <p className="text-xs font-mono text-muted-foreground/70">
          {t("download.everyInstaller")}
        </p>
        <a
          href={RELEASES_PAGE}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs font-mono text-primary/80 hover:text-primary uppercase tracking-widest transition-colors"
        >
          {t("download.allVersions")} <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
