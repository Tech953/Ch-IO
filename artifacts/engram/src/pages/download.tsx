import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Apple, Monitor, Terminal as TerminalIcon, ExternalLink } from "lucide-react";

const RELEASES_URL =
  (import.meta.env.VITE_DESKTOP_RELEASES_URL as string | undefined)?.trim() ||
  "https://github.com/pyri-engram/engram/releases/latest";

type OsKey = "mac" | "windows" | "linux" | "unknown";

type OsInfo = {
  key: OsKey;
  label: string;
  fileHint: string;
  icon: typeof Apple;
};

const OS_TABLE: Record<Exclude<OsKey, "unknown">, OsInfo> = {
  mac: { key: "mac", label: "macOS", fileHint: ".dmg", icon: Apple },
  windows: { key: "windows", label: "Windows", fileHint: ".exe", icon: Monitor },
  linux: { key: "linux", label: "Linux", fileHint: ".AppImage / .deb", icon: TerminalIcon },
};

function detectOs(): OsKey {
  if (typeof navigator === "undefined") return "unknown";
  const ua = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (/(mac|iphone|ipad|ipod)/.test(ua)) return "mac";
  if (/win/.test(ua)) return "windows";
  if (/linux|android|x11/.test(ua)) return "linux";
  return "unknown";
}

export default function DownloadPage() {
  const detected = useMemo(detectOs, []);
  const primary = detected !== "unknown" ? OS_TABLE[detected] : null;
  const others = (Object.keys(OS_TABLE) as Array<Exclude<OsKey, "unknown">>)
    .filter((k) => k !== detected)
    .map((k) => OS_TABLE[k]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-widest text-primary">DOWNLOAD</h2>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            Get the ENGRAM desktop app — runs fully offline
          </p>
        </div>
        <Download className="w-7 h-7 text-primary/70 shrink-0" />
      </div>

      <Card className="bg-card/40 border-border/50 backdrop-blur-sm glow-box">
        <CardHeader>
          <CardTitle className="font-display tracking-widest text-sm text-primary/80">
            {primary ? `Recommended for ${primary.label}` : "Desktop installers"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            The desktop app bundles PYRI's full ENGRAM stack — dashboard, API, and an
            embedded database — into a single installer. No setup, no terminal, no
            internet required after install.
          </p>

          {primary && (
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 p-4 rounded-none border border-primary/40 bg-primary/10 hover:bg-primary/20 hover:border-primary transition-all duration-200"
            >
              <primary.icon className="w-8 h-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-display font-medium uppercase tracking-wider text-sm text-primary">
                  Download for {primary.label}
                </div>
                <div className="font-mono text-xs text-muted-foreground mt-0.5">
                  Latest release · {primary.fileHint}
                </div>
              </div>
              <Download className="w-5 h-5 text-primary/70 group-hover:text-primary transition-colors" />
            </a>
          )}

          <div className="space-y-2">
            <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
              {primary ? "Other platforms" : "Choose your platform"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {others.map((os) => (
                <a
                  key={os.key}
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 p-3 rounded-none border border-border/50 bg-card/30 hover:bg-white/5 hover:border-white/20 transition-all duration-200"
                >
                  <os.icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-medium uppercase tracking-wider text-xs text-foreground">
                      {os.label}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">{os.fileHint}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-xs text-primary/70 hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View all releases on GitHub
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
