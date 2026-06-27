import { useMemo, useState } from "react";
import {
  useListArtifacts,
  useCreateArtifact,
  useRetryArtifact,
  useDeleteArtifact,
  useListEngrams,
  getListArtifactsQueryKey,
  type EngramArtifact,
  type Engram,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Hammer,
  FileText,
  Image as ImageIcon,
  Video,
  Sparkles,
  RotateCw,
  Trash2,
  Download,
  AlertTriangle,
  Loader2,
  Bot,
  UserCog,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_META: Record<
  string,
  { label: string; cls: string; pulse?: boolean }
> = {
  pending: { label: "Queued", cls: "border-amber-500/40 text-amber-400" },
  processing: {
    label: "Generating",
    cls: "border-sky-500/40 text-sky-400",
    pulse: true,
  },
  completed: { label: "Ready", cls: "border-emerald-500/40 text-emerald-400" },
  failed: { label: "Failed", cls: "border-rose-500/40 text-rose-400" },
  canceled: { label: "Canceled", cls: "border-muted-foreground/40 text-muted-foreground" },
};

const KIND_ICON: Record<string, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  video: Video,
};

const KINDS: { value: "pdf" | "image" | "video"; label: string; note: string }[] = [
  { value: "pdf", label: "PDF", note: "always offline" },
  { value: "image", label: "Image", note: "cloud / best-effort" },
  { value: "video", label: "Video", note: "cloud / best-effort" },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function formatBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Studio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: engrams } = useListEngrams();
  const [selectedEngramId, setSelectedEngramId] = useState<number | "">("");
  const [kind, setKind] = useState<"pdf" | "image" | "video">("pdf");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");

  const create = useCreateArtifact();

  const { data: artifacts, isLoading } = useListArtifacts(undefined, {
    query: { queryKey: getListArtifactsQueryKey() },
  });

  const hasActive = (artifacts ?? []).some(
    (a) => a.status === "pending" || a.status === "processing",
  );

  // Poll the list while any job is in flight.
  useListArtifacts(undefined, {
    query: {
      queryKey: getListArtifactsQueryKey(),
      refetchInterval: hasActive ? 4000 : false,
    },
  });

  const engramById = useMemo(() => {
    const m = new Map<number, Engram>();
    for (const e of engrams ?? []) m.set(e.id, e);
    return m;
  }, [engrams]);

  const ordered = useMemo(
    () =>
      [...(artifacts ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [artifacts],
  );

  function handleCreate() {
    if (selectedEngramId === "" || !title.trim() || !prompt.trim()) return;
    create.mutate(
      {
        data: {
          engramId: Number(selectedEngramId),
          kind,
          title: title.trim(),
          prompt: prompt.trim(),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Generation queued", description: `${kind.toUpperCase()} job created.` });
          setTitle("");
          setPrompt("");
          queryClient.invalidateQueries({ queryKey: getListArtifactsQueryKey() });
        },
        onError: (e) =>
          toast({
            title: "Could not queue",
            description: e instanceof Error ? e.message : "Unknown error",
            variant: "destructive",
          }),
      },
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-widest text-primary flex items-center gap-3 glow-text">
            <Hammer className="w-7 h-7" /> CREATION STUDIO
          </h2>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            Engrams author real files — PDFs offline, images &amp; video via the cloud generation provider
          </p>
        </div>
        <Badge
          variant="outline"
          className="font-mono text-[10px] uppercase tracking-wider border-primary/40 text-primary gap-1.5"
        >
          <Sparkles className="w-3 h-3" /> {ordered.length} artifacts
        </Badge>
      </div>

      <div className="bg-primary/[0.03] border border-primary/20 p-4 font-mono text-xs text-muted-foreground space-y-1">
        <p className="text-primary/80 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> GENERATION → GENERATED PROVENANCE
        </p>
        <p>
          Generated artifacts are a separate subsystem from perception. They never become OBSERVED
          reality — if a piece ever lands in the world model it is pinned{" "}
          <span className="text-primary/90">generated</span> / source{" "}
          <span className="text-primary/90">artifact:&lt;id&gt;</span>. PDF always works offline;
          image &amp; video need an online generation provider and fail with a clear message otherwise.
        </p>
      </div>

      {/* Create now */}
      <Card className="bg-card/40 border-primary/25 backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Create now
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <select
              value={selectedEngramId}
              onChange={(e) =>
                setSelectedEngramId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="bg-background border border-border/60 text-sm font-mono px-3 py-2 text-foreground focus:border-primary/60 outline-none"
              data-testid="select-engram"
            >
              <option value="">Select engram…</option>
              {(engrams ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.symbol ? `${e.symbol} ` : ""}
                  {e.name}
                </option>
              ))}
            </select>

            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "pdf" | "image" | "video")}
              className="bg-background border border-border/60 text-sm font-mono px-3 py-2 text-foreground focus:border-primary/60 outline-none"
              data-testid="select-kind"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label} — {k.note}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="flex-1 bg-background border border-border/60 text-sm font-mono px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 outline-none"
              data-testid="input-title"
            />
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should the engram create? (the generation brief)"
            rows={3}
            className="w-full bg-background border border-border/60 text-sm font-mono px-3 py-2 text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 outline-none resize-y"
            data-testid="input-prompt"
          />

          <div className="flex justify-end">
            <Button
              onClick={handleCreate}
              disabled={
                create.isPending ||
                selectedEngramId === "" ||
                !title.trim() ||
                !prompt.trim()
              }
              className="font-mono text-[10px] uppercase tracking-wider h-9"
              data-testid="button-create"
            >
              {create.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              )}
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Artifact list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-primary/5" />
          ))
        ) : !ordered.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground font-mono text-center">
            <Hammer className="w-8 h-8 mb-4 opacity-30" />
            <p className="text-xs uppercase tracking-widest">Nothing generated yet</p>
            <p className="text-[10px] mt-2 opacity-60 max-w-sm">
              Queue a creation above, or let an engram autonomously author one within its caps. Each
              job runs asynchronously and produces a downloadable file.
            </p>
          </div>
        ) : (
          ordered.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              engram={engramById.get(artifact.engramId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ArtifactCard({
  artifact,
  engram,
}: {
  artifact: EngramArtifact;
  engram?: Engram;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const retry = useRetryArtifact();
  const remove = useDeleteArtifact();

  const status = STATUS_META[artifact.status] ?? STATUS_META.pending;
  const Icon = KIND_ICON[artifact.kind] ?? FileText;
  const rawUrl = `/api/artifacts/${artifact.id}/raw`;

  function handleRetry() {
    retry.mutate(
      { id: artifact.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListArtifactsQueryKey() });
          toast({ title: "Re-queued for generation" });
        },
        onError: () => toast({ title: "Retry failed", variant: "destructive" }),
      },
    );
  }

  function handleDelete() {
    remove.mutate(
      { id: artifact.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListArtifactsQueryKey() });
          toast({ title: "Artifact deleted" });
        },
        onError: () => toast({ title: "Delete failed", variant: "destructive" }),
      },
    );
  }

  return (
    <Card
      className="bg-card/40 border-primary/25 backdrop-blur-sm"
      data-testid={`artifact-${artifact.id}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-none border border-primary/30 text-primary flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-display tracking-wider text-sm text-foreground truncate max-w-[16rem]">
                {artifact.title}
              </span>
              <Badge
                variant="outline"
                className="font-mono text-[8px] uppercase tracking-wider border-primary/40 text-primary/80"
              >
                {artifact.kind}
              </Badge>
              <Badge
                variant="outline"
                className={`font-mono text-[8px] uppercase tracking-wider gap-1 ${
                  artifact.trigger === "autonomous"
                    ? "border-violet-500/40 text-violet-300"
                    : "border-cyan-500/40 text-cyan-300"
                }`}
              >
                {artifact.trigger === "autonomous" ? (
                  <Bot className="w-2.5 h-2.5" />
                ) : (
                  <UserCog className="w-2.5 h-2.5" />
                )}
                {artifact.trigger}
              </Badge>
              <Badge
                variant="outline"
                className={`font-mono text-[8px] uppercase tracking-wider ${status.cls}`}
              >
                {status.pulse && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse mr-1" />
                )}
                {status.label}
              </Badge>
              <span className="font-mono text-[10px] text-muted-foreground/40 ml-auto">
                {relativeTime(artifact.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground/60">
              <span className="text-primary/70">
                {engram?.symbol ?? "◇"} {engram?.name ?? `Engram #${artifact.engramId}`}
              </span>
              <span>{formatBytes(artifact.sizeBytes)}</span>
              {artifact.provider && (
                <span className="text-emerald-400/60">{artifact.provider}</span>
              )}
            </div>
            <p className="text-xs leading-relaxed font-mono text-muted-foreground/70 mt-2 line-clamp-2">
              {artifact.prompt}
            </p>
            {artifact.summary && (
              <p className="text-sm leading-relaxed font-sans text-foreground/85 mt-2">
                {artifact.summary}
              </p>
            )}
          </div>
        </div>

        {/* Error */}
        {artifact.status === "failed" && artifact.error && (
          <div className="border border-rose-500/25 bg-rose-500/[0.04] p-3 space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-wider text-rose-400/80 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> Generation failed
            </p>
            <p className="text-xs font-mono text-rose-300/70 break-words">{artifact.error}</p>
          </div>
        )}

        {/* Preview (completed only) */}
        {artifact.status === "completed" && (
          <div className="border-t border-border/30 pt-3">
            {artifact.kind === "image" && (
              <img
                src={rawUrl}
                alt={artifact.title}
                className="max-h-64 border border-border/40 object-contain"
              />
            )}
            {artifact.kind === "video" && (
              <video
                controls
                src={rawUrl}
                className="max-h-72 w-full border border-border/40"
              />
            )}
            {artifact.kind === "pdf" && (
              <object
                data={rawUrl}
                type="application/pdf"
                className="w-full h-72 border border-border/40 bg-white/[0.02]"
              >
                <p className="font-mono text-[10px] text-muted-foreground/60 p-3">
                  PDF preview unavailable — use Download.
                </p>
              </object>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {artifact.status === "completed" && (
            <a
              href={rawUrl}
              download={artifact.filename ?? undefined}
              className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 h-8 px-3"
              data-testid={`button-download-${artifact.id}`}
            >
              <Download className="w-3 h-3 mr-1.5" /> Download
            </a>
          )}
          {artifact.status === "failed" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              disabled={retry.isPending}
              className="font-mono text-[10px] uppercase tracking-wider border-amber-500/40 text-amber-300 hover:bg-amber-500/10 h-8"
              data-testid={`button-retry-${artifact.id}`}
            >
              <RotateCw className="w-3 h-3 mr-1.5" /> Retry
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={remove.isPending}
            className="font-mono text-[10px] uppercase tracking-wider border-rose-500/40 text-rose-300 hover:bg-rose-500/10 h-8 ml-auto"
            data-testid={`button-delete-${artifact.id}`}
          >
            <Trash2 className="w-3 h-3 mr-1.5" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
