import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";

// GitHub repository (owner/repo) that hosts the DESKTOP releases produced by
// .github/workflows/desktop-build.yml. Configurable so a fork can point the
// page at its own release feed without code changes; falls back to the project
// default.
const GITHUB_REPO =
  (import.meta.env.VITE_GITHUB_REPO as string | undefined)?.trim() ||
  "pyri-ai/engram";

const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// Same-origin Android endpoints served by this app's API (artifacts/api-server
// routes/download.ts). The meta endpoint reports availability + source (a
// bundled .apk committed into the deploy, else the latest GitHub release); the
// .apk endpoint streams the file itself. Both go through /api so the Android
// download never leaves the deploy's own origin.
const ANDROID_META_URL = "/api/download/android";
const ANDROID_APK_URL = "/api/download/android.apk";

type Os = "mac" | "win" | "linux" | "android";

type GithubAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

type GithubRelease = {
  tag_name: string;
  name: string | null;
  html_url: string;
  assets: GithubAsset[];
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
  size?: number;
  /** Same-origin links use the download attribute to force a save dialog. */
  forceDownload?: boolean;
};

const OS_META: Record<
  Os,
  { name: string; icon: typeof Apple; note: string }
> = {
  mac: { name: "macOS", icon: Apple, note: "Apple Silicon & Intel (.dmg)" },
  win: { name: "Windows", icon: MonitorDown, note: "Windows 10/11 installer (.exe)" },
  linux: {
    name: "Linux",
    icon: TerminalIcon,
    note: "AppImage (portable) or .deb (Debian/Ubuntu)",
  },
  android: {
    name: "Android",
    icon: Smartphone,
    note: "Android 8+ — sideload the .apk (enable unknown sources)",
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

function osForAsset(name: string): Os | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".dmg")) return "mac";
  if (lower.endsWith(".exe")) return "win";
  if (lower.endsWith(".appimage") || lower.endsWith(".deb")) return "linux";
  if (lower.endsWith(".apk")) return "android";
  return null;
}

function formatSize(bytes?: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export default function DownloadPage() {
  const detectedOs = useMemo(detectOs, []);

  // Desktop installers (mac/win/linux) come from the GitHub release feed.
  const releaseQuery = useQuery<GithubRelease>({
    queryKey: ["github-latest-release", GITHUB_REPO],
    queryFn: async () => {
      const res = await fetch(LATEST_RELEASE_API, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) {
        throw new Error(`GitHub API responded ${res.status}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Android comes from this app's own API: a bundled .apk if the deploy has one,
  // otherwise the latest GitHub release proxied same-origin.
  const androidQuery = useQuery<AndroidMeta>({
    queryKey: ["android-download-meta"],
    queryFn: async () => {
      const res = await fetch(ANDROID_META_URL, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Android meta responded ${res.status}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const desktopByOs = useMemo(() => {
    const map: Record<Os, DownloadLink[]> = {
      mac: [],
      win: [],
      linux: [],
      android: [],
    };
    for (const asset of releaseQuery.data?.assets ?? []) {
      const os = osForAsset(asset.name);
      // Android is served same-origin via the meta endpoint, never from the
      // GitHub feed here — otherwise it would double up with the local card.
      if (!os || os === "android") continue;
      const ext = asset.name.slice(asset.name.lastIndexOf(".")).toLowerCase();
      map[os].push({
        key: asset.name,
        href: asset.browser_download_url,
        label: `Download ${ext}`,
        size: asset.size,
      });
    }
    return map;
  }, [releaseQuery.data]);

  const android = androidQuery.data;
  const androidLinks: DownloadLink[] = useMemo(() => {
    if (!android?.available) return [];
    return [
      {
        key: android.filename ?? "engram.apk",
        href: android.downloadPath ?? ANDROID_APK_URL,
        label: "Install APK",
        size: android.sizeBytes ?? undefined,
        forceDownload: true,
      },
    ];
  }, [android]);

  const linksByOs: Record<Os, DownloadLink[]> = {
    mac: desktopByOs.mac,
    win: desktopByOs.win,
    linux: desktopByOs.linux,
    android: androidLinks,
  };

  const hasAnyCard = OS_ORDER.some((os) => linksByOs[os].length > 0);
  const isLoading = releaseQuery.isLoading || androidQuery.isLoading;

  const version =
    releaseQuery.data?.tag_name?.replace(/^v/, "") ?? android?.version ?? null;

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
          <h2 className="text-3xl font-bold tracking-widest text-primary">DOWNLOAD PYRI</h2>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            Native desktop app (runs fully offline) — plus an Android APK served straight from this app
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          {isLoading ? (
            <Skeleton className="h-6 w-28 bg-primary/10" />
          ) : version ? (
            <span className="px-3 py-1.5 border border-primary/30 text-primary uppercase tracking-widest bg-primary/5">
              Latest&nbsp;v{version}
            </span>
          ) : null}
        </div>
      </div>

      {/* Auto-update note */}
      <Card className="bg-card/40 border-primary/20 backdrop-blur-sm">
        <CardContent className="p-4 flex items-start gap-3">
          <RefreshCw className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Desktop auto-updates after install.</span>{" "}
            Once installed, the desktop app checks for new releases on launch and
            updates itself silently in the background. The Android APK is
            sideloaded — grab the newest build here whenever you want to update.
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
                        {os === "android" ? "Your device" : "Your OS"}
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs font-mono text-muted-foreground">{meta.note}</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 mt-auto">
                  {links.map((link) => (
                    <a
                      key={link.key}
                      href={link.href}
                      {...(link.forceDownload
                        ? { download: link.key }
                        : {})}
                      className={`flex items-center gap-2 px-3 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${
                        isRecommended
                          ? "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20"
                          : "border-border/60 text-foreground hover:bg-white/5 hover:border-primary/40"
                      }`}
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <span className="truncate">{link.label}</span>
                      {link.size ? (
                        <span className="ml-auto text-muted-foreground normal-case">
                          {formatSize(link.size)}
                        </span>
                      ) : null}
                    </a>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && !hasAnyCard && (
        <Card
          className={`bg-card/40 backdrop-blur-sm ${
            releaseQuery.isError ? "border-destructive/40" : "border-border/50"
          }`}
        >
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <AlertTriangle
              className={`w-8 h-8 ${
                releaseQuery.isError
                  ? "text-destructive/80"
                  : "text-muted-foreground/60"
              }`}
            />
            <p className="text-sm text-muted-foreground max-w-md">
              {releaseQuery.isError
                ? "Couldn't reach the release feed right now. You can browse all installers directly on the GitHub Releases page."
                : "No installers are available yet. Check the GitHub Releases page for desktop builds, or add an Android .apk to this deploy."}
            </p>
            <a
              href={RELEASES_PAGE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-primary/40 text-primary font-mono text-xs uppercase tracking-widest hover:bg-primary/10 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Open Releases
            </a>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-border/40">
        <p className="text-xs font-mono text-muted-foreground/70">
          Android installs straight from this app; desktop builds come from GitHub Releases.
        </p>
        <a
          href={RELEASES_PAGE}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs font-mono text-primary/80 hover:text-primary uppercase tracking-widest transition-colors"
        >
          All versions & release notes <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
