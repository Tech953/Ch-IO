import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Apple,
  MonitorDown,
  Terminal as TerminalIcon,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

// GitHub repository (owner/repo) that hosts the desktop releases produced by
// .github/workflows/desktop-build.yml. Configurable so a fork can point the
// page at its own release feed without code changes; falls back to the project
// default. The CI publisher (electron-builder) uploads installers + update
// manifests to this repo's Releases.
const GITHUB_REPO =
  (import.meta.env.VITE_GITHUB_REPO as string | undefined)?.trim() ||
  "pyri-ai/engram";

const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

type Os = "mac" | "win" | "linux";

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

type Installer = {
  os: Os;
  label: string;
  ext: string;
  asset: GithubAsset;
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
};

function detectOs(): Os | null {
  if (typeof navigator === "undefined") return null;
  const ua = `${navigator.userAgent} ${navigator.platform ?? ""}`.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "win";
  if (ua.includes("linux") || ua.includes("x11") || ua.includes("android"))
    return "linux";
  return null;
}

function osForAsset(name: string): Os | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".dmg")) return "mac";
  if (lower.endsWith(".exe")) return "win";
  if (lower.endsWith(".appimage") || lower.endsWith(".deb")) return "linux";
  return null;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export default function DownloadPage() {
  const detectedOs = useMemo(detectOs, []);

  const { data, isLoading, isError } = useQuery<GithubRelease>({
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

  const installers: Installer[] = useMemo(() => {
    if (!data?.assets) return [];
    const out: Installer[] = [];
    for (const asset of data.assets) {
      const os = osForAsset(asset.name);
      if (!os) continue;
      const ext = asset.name.slice(asset.name.lastIndexOf(".")).toLowerCase();
      out.push({
        os,
        ext,
        label: OS_META[os].name,
        asset,
      });
    }
    // Group order: detected OS first, then mac/win/linux.
    const order: Os[] = ["mac", "win", "linux"];
    return out.sort((a, b) => {
      if (a.os === detectedOs && b.os !== detectedOs) return -1;
      if (b.os === detectedOs && a.os !== detectedOs) return 1;
      return order.indexOf(a.os) - order.indexOf(b.os);
    });
  }, [data, detectedOs]);

  const version = data?.tag_name?.replace(/^v/, "") ?? null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-widest text-primary">DOWNLOAD PYRI</h2>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            Native desktop app — runs fully offline on your machine
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
            <span className="text-foreground font-medium">Auto-updates after install.</span>{" "}
            Once installed, the desktop app checks for new releases on launch and
            updates itself silently in the background — you only install once.
          </p>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full bg-primary/5" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <Card className="bg-card/40 border-destructive/40 backdrop-blur-sm">
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <AlertTriangle className="w-8 h-8 text-destructive/80" />
            <p className="text-sm text-muted-foreground max-w-md">
              Couldn't reach the release feed right now. You can browse all
              installers directly on the GitHub Releases page.
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

      {!isLoading && !isError && installers.length === 0 && (
        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <AlertTriangle className="w-8 h-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground max-w-md">
              No desktop installers found in the latest release yet. Check the
              GitHub Releases page for available builds.
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

      {!isLoading && !isError && installers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["mac", "win", "linux"] as Os[])
            .sort((a, b) => {
              if (a === detectedOs && b !== detectedOs) return -1;
              if (b === detectedOs && a !== detectedOs) return 1;
              return 0;
            })
            .map((os) => {
              const osInstallers = installers.filter((i) => i.os === os);
              if (osInstallers.length === 0) return null;
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
                          <CheckCircle2 className="w-3 h-3" /> Your OS
                        </span>
                      )}
                    </CardTitle>
                    <p className="text-xs font-mono text-muted-foreground">{meta.note}</p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 mt-auto">
                    {osInstallers.map((inst) => (
                      <a
                        key={inst.asset.name}
                        href={inst.asset.browser_download_url}
                        className={`flex items-center gap-2 px-3 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors border ${
                          isRecommended
                            ? "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20"
                            : "border-border/60 text-foreground hover:bg-white/5 hover:border-primary/40"
                        }`}
                      >
                        <Download className="w-4 h-4 shrink-0" />
                        <span className="truncate">Download {inst.ext}</span>
                        {inst.asset.size ? (
                          <span className="ml-auto text-muted-foreground normal-case">
                            {formatSize(inst.asset.size)}
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

      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-border/40">
        <p className="text-xs font-mono text-muted-foreground/70">
          All builds are published from CI to GitHub Releases.
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
