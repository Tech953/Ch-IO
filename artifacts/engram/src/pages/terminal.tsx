import { useMemo, useState } from "react";
import {
  useGetHubControls,
  useUpdateHubControls,
  useListEngrams,
  useUpdateEngramConfig,
  useListEngramMessages,
  useMarkEngramMessagesSeen,
  useListHubSpaces,
  useMoveEngramPresence,
  getGetHubControlsQueryKey,
  getListEngramsQueryKey,
  getListEngramMessagesQueryKey,
  getListHubPresenceQueryKey,
  getListHubActivityQueryKey,
  EngramMode,
  type Engram,
  type EngramMessage,
  type EngramMode as EngramModeT,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Terminal as TerminalIcon,
  Pause,
  BellOff,
  Download,
  Moon,
  Check,
  Inbox,
  ShieldAlert,
  Power,
  FlaskConical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MODE_META: Record<string, { label: string; cls: string }> = {
  orientation: { label: "Orientation", cls: "text-sky-400" },
  social: { label: "Social", cls: "text-cyan-400" },
  simulation: { label: "Simulation", cls: "text-rose-400" },
  initiative_limited: { label: "Initiative (limited)", cls: "text-amber-400" },
  full_bounded: { label: "Full (bounded)", cls: "text-emerald-400" },
  quiescent: { label: "Quiescent", cls: "text-indigo-400" },
};

const MODE_ORDER: EngramModeT[] = [
  EngramMode.orientation,
  EngramMode.social,
  EngramMode.initiative_limited,
  EngramMode.full_bounded,
  EngramMode.simulation,
  EngramMode.quiescent,
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  delivered: { label: "Delivered", cls: "border-emerald-500/30 text-emerald-400" },
  queued: { label: "Queued", cls: "border-amber-500/30 text-amber-400" },
  digest: { label: "Digest", cls: "border-sky-500/30 text-sky-400" },
  blocked: { label: "Refused", cls: "border-rose-500/40 text-rose-400" },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "border-rose-500/40 text-rose-400" },
  meaningful: { label: "Meaningful", cls: "border-amber-500/30 text-amber-400" },
  social: { label: "Social", cls: "border-cyan-500/30 text-cyan-400" },
};

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

export default function Terminal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: controls, isLoading: controlsLoading } = useGetHubControls();
  const { data: engrams, isLoading: engramsLoading } = useListEngrams();
  const { data: spaces } = useListHubSpaces();
  const { data: messages, isLoading: messagesLoading } = useListEngramMessages(
    { channel: "human", limit: 100 },
    {
      query: {
        queryKey: getListEngramMessagesQueryKey({ channel: "human", limit: 100 }),
        refetchInterval: 15000,
      },
    },
  );

  const updateControls = useUpdateHubControls();
  const updateEngram = useUpdateEngramConfig();
  const markSeen = useMarkEngramMessagesSeen();
  const move = useMoveEngramPresence();

  const [pendingEngramId, setPendingEngramId] = useState<number | null>(null);

  const humanMessagesKey = getListEngramMessagesQueryKey({ channel: "human", limit: 100 });

  const quiescenceSpace = useMemo(
    () => (spaces ?? []).find((s) => s.kind === "quiescence"),
    [spaces],
  );

  const engramById = useMemo(() => {
    const m = new Map<number, Engram>();
    for (const e of engrams ?? []) m.set(e.id, e);
    return m;
  }, [engrams]);

  const ordered = useMemo(
    () =>
      [...(messages ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [messages],
  );

  const unseenIds = useMemo(
    () => ordered.filter((m) => !m.seen && m.status !== "blocked").map((m) => m.id),
    [ordered],
  );

  function toggleControl(patch: { paused?: boolean; quietMode?: boolean }) {
    updateControls.mutate(
      { data: patch },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetHubControlsQueryKey() });
        },
        onError: () => toast({ title: "Failed to update controls", variant: "destructive" }),
      },
    );
  }

  function setEngramMode(engram: Engram, mode: EngramModeT) {
    setPendingEngramId(engram.id);
    updateEngram.mutate(
      { id: engram.id, data: { mode } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEngramsQueryKey() });
          toast({ title: `${engram.name} → ${MODE_META[mode]?.label ?? mode}` });
        },
        onError: () => toast({ title: "Failed to change mode", variant: "destructive" }),
        onSettled: () => setPendingEngramId(null),
      },
    );
  }

  function toggleHumanContact(engram: Engram, enabled: boolean) {
    setPendingEngramId(engram.id);
    updateEngram.mutate(
      { id: engram.id, data: { humanContactEnabled: enabled } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEngramsQueryKey() });
          toast({
            title: `${engram.name} human contact ${enabled ? "enabled" : "disabled"}`,
          });
        },
        onError: () => toast({ title: "Failed to update human contact", variant: "destructive" }),
        onSettled: () => setPendingEngramId(null),
      },
    );
  }

  function toggleSimulation(engram: Engram, enabled: boolean) {
    setPendingEngramId(engram.id);
    updateEngram.mutate(
      { id: engram.id, data: { simulationEnabled: enabled } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEngramsQueryKey() });
          toast({
            title: `${engram.name} simulations ${enabled ? "enabled" : "disabled"}`,
          });
        },
        onError: () => toast({ title: "Failed to update simulations", variant: "destructive" }),
        onSettled: () => setPendingEngramId(null),
      },
    );
  }

  function sendToQuiescence(engram: Engram) {
    if (!quiescenceSpace) {
      toast({ title: "No quiescence space configured", variant: "destructive" });
      return;
    }
    setPendingEngramId(engram.id);
    move.mutate(
      { engramId: engram.id, data: { spaceId: quiescenceSpace.id, note: "Sent to quiescence by operator" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListHubPresenceQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListHubActivityQueryKey() });
          toast({ title: `${engram.name} sent to quiescence` });
        },
        onError: () => toast({ title: "Failed to send to quiescence", variant: "destructive" }),
        onSettled: () => setPendingEngramId(null),
      },
    );
  }

  function handleMarkSeen() {
    if (!unseenIds.length) return;
    markSeen.mutate(
      { data: { ids: unseenIds } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: humanMessagesKey });
          toast({ title: `Marked ${res.updated} message${res.updated === 1 ? "" : "s"} seen` });
        },
        onError: () => toast({ title: "Failed to mark seen", variant: "destructive" }),
      },
    );
  }

  function exportLogs() {
    const payload = {
      exportedAt: new Date().toISOString(),
      channel: "human",
      controls: controls ?? null,
      messages: ordered.map((m) => ({
        ...m,
        fromEngram: engramById.get(m.fromEngramId)?.name ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `human-contact-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Log exported", description: `${ordered.length} messages downloaded.` });
  }

  const paused = controls?.paused ?? false;
  const quietMode = controls?.quietMode ?? false;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-widest text-primary flex items-center gap-3">
            <TerminalIcon className="w-7 h-7" /> HUMAN TERMINAL
          </h2>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            Operator overrides and the bounded channel through which engrams reach you
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={exportLogs}
          disabled={!ordered.length}
          className="font-mono text-xs uppercase tracking-wider border-border/50"
          data-testid="button-export-logs"
        >
          <Download className="w-3 h-3 mr-2" /> Export Logs
        </Button>
      </div>

      {/* Global overrides */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ControlToggle
          icon={Pause}
          title="Global Pause"
          description="Halt all autonomous behavior. Engrams still accrue pressure but emit nothing."
          active={paused}
          activeLabel="Paused"
          tone="rose"
          loading={controlsLoading || updateControls.isPending}
          onToggle={(v) => toggleControl({ paused: v })}
          testId="switch-pause"
        />
        <ControlToggle
          icon={BellOff}
          title="Quiet Mode"
          description="Suppress non-urgent contact. Only urgent messages reach you; the rest are held."
          active={quietMode}
          activeLabel="Quiet"
          tone="amber"
          loading={controlsLoading || updateControls.isPending}
          onToggle={(v) => toggleControl({ quietMode: v })}
          testId="switch-quiet"
        />
      </div>

      {/* Per-engram controls */}
      <div>
        <h3 className="font-display uppercase tracking-widest text-sm text-primary mb-3">
          Per-Engram Controls
        </h3>
        {engramsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 bg-primary/5" />
            ))}
          </div>
        ) : !engrams?.length ? (
          <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest py-6 text-center">
            No engrams instantiated
          </p>
        ) : (
          <div className="space-y-3">
            {engrams.map((engram) => (
              <Card key={engram.id} className="bg-card/40 border-border/50 backdrop-blur-sm">
                <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3 min-w-0 lg:w-56 shrink-0">
                    <div className="shrink-0 w-9 h-9 rounded-none border border-border/50 flex items-center justify-center text-primary text-lg">
                      {engram.symbol}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display tracking-wider text-sm text-foreground truncate">{engram.name}</p>
                      <span className={`font-mono text-[10px] uppercase tracking-widest ${MODE_META[engram.mode]?.cls ?? "text-muted-foreground"}`}>
                        {MODE_META[engram.mode]?.label ?? engram.mode}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-wrap items-center gap-4">
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 block">Mode</span>
                      <Select
                        value={engram.mode}
                        onValueChange={(v) => setEngramMode(engram, v as EngramModeT)}
                        disabled={pendingEngramId === engram.id}
                      >
                        <SelectTrigger
                          className="font-mono text-xs border-border/50 bg-background/50 w-52 h-8"
                          data-testid={`select-mode-${engram.id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/50">
                          {MODE_ORDER.map((m) => (
                            <SelectItem key={m} value={m} className="font-mono text-xs">
                              {MODE_META[m]?.label ?? m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 block">Human Contact</span>
                      <div className="flex items-center gap-2 h-8">
                        <Switch
                          checked={engram.humanContactEnabled}
                          onCheckedChange={(v) => toggleHumanContact(engram, v)}
                          disabled={pendingEngramId === engram.id}
                          data-testid={`switch-human-contact-${engram.id}`}
                        />
                        <span className={`font-mono text-[10px] uppercase tracking-wider ${engram.humanContactEnabled ? "text-emerald-400" : "text-muted-foreground/50"}`}>
                          {engram.humanContactEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1">
                        <FlaskConical className="w-2.5 h-2.5" /> Simulations
                      </span>
                      <div className="flex items-center gap-2 h-8">
                        <Switch
                          checked={engram.simulationEnabled}
                          onCheckedChange={(v) => toggleSimulation(engram, v)}
                          disabled={pendingEngramId === engram.id}
                          data-testid={`switch-simulation-${engram.id}`}
                        />
                        <span className={`font-mono text-[10px] uppercase tracking-wider ${engram.simulationEnabled ? "text-rose-400" : "text-muted-foreground/50"}`}>
                          {engram.simulationEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 ml-auto">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 block">Override</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendToQuiescence(engram)}
                        disabled={pendingEngramId === engram.id || !quiescenceSpace || engram.mode === "quiescent"}
                        className="font-mono text-[10px] uppercase tracking-wider border-indigo-400/40 text-indigo-300 hover:bg-indigo-400/10 h-8"
                        data-testid={`button-quiescence-${engram.id}`}
                      >
                        <Moon className="w-3 h-3 mr-1.5" /> Send to Quiescence
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Human-channel messages */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h3 className="font-display uppercase tracking-widest text-sm text-primary flex items-center gap-2">
            <Inbox className="w-4 h-4" /> Incoming Contact
            {unseenIds.length > 0 && (
              <Badge variant="outline" className="font-mono text-[9px] uppercase border-primary/40 text-primary">
                {unseenIds.length} new
              </Badge>
            )}
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkSeen}
            disabled={!unseenIds.length || markSeen.isPending}
            className="font-mono text-xs uppercase tracking-wider border-border/50"
            data-testid="button-mark-seen"
          >
            <Check className="w-3 h-3 mr-2" /> Mark all seen
          </Button>
        </div>

        {messagesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-primary/5" />
            ))}
          </div>
        ) : !ordered.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground font-mono text-center">
            <Power className="w-8 h-8 mb-4 opacity-30" />
            <p className="text-xs uppercase tracking-widest">No engram has reached out yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ordered.map((msg) => (
              <HumanMessageRow key={msg.id} msg={msg} engramById={engramById} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ControlToggle({
  icon: Icon,
  title,
  description,
  active,
  activeLabel,
  tone,
  loading,
  onToggle,
  testId,
}: {
  icon: typeof Pause;
  title: string;
  description: string;
  active: boolean;
  activeLabel: string;
  tone: "rose" | "amber";
  loading: boolean;
  onToggle: (v: boolean) => void;
  testId: string;
}) {
  const toneCls =
    tone === "rose" ? "border-rose-500/40 text-rose-400" : "border-amber-500/40 text-amber-400";
  return (
    <Card className={`bg-card/40 border-border/50 backdrop-blur-sm ${active ? `${toneCls} bg-white/[0.02]` : ""}`}>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`shrink-0 w-9 h-9 rounded-none border flex items-center justify-center ${active ? toneCls : "border-border/50 text-muted-foreground"}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-display tracking-wider text-sm text-foreground">{title}</h4>
            {active && (
              <Badge variant="outline" className={`font-mono text-[8px] uppercase tracking-wider ${toneCls}`}>
                {activeLabel}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground/80 leading-relaxed font-sans">{description}</p>
        </div>
        <Switch checked={active} onCheckedChange={onToggle} disabled={loading} data-testid={testId} />
      </CardContent>
    </Card>
  );
}

function HumanMessageRow({
  msg,
  engramById,
}: {
  msg: EngramMessage;
  engramById: Map<number, Engram>;
}) {
  const from = engramById.get(msg.fromEngramId);
  const status = STATUS_META[msg.status] ?? STATUS_META.delivered;
  const priority = PRIORITY_META[msg.priority] ?? PRIORITY_META.social;
  const blocked = msg.status === "blocked";
  const unseen = !msg.seen && !blocked;

  return (
    <Card
      className={`bg-card/40 border-border/50 backdrop-blur-sm ${unseen ? "border-primary/30" : ""} ${blocked ? "border-rose-500/30 bg-rose-500/[0.03]" : ""}`}
      data-testid={`human-message-${msg.id}`}
    >
      <CardContent className="p-4 flex gap-3 items-start">
        <div className="shrink-0 w-9 h-9 rounded-none border border-border/50 flex items-center justify-center text-primary text-lg">
          {from?.symbol ?? "◇"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-display tracking-wider text-sm text-foreground">
              {from?.name ?? `Engram #${msg.fromEngramId}`}
            </span>
            <Badge variant="outline" className={`font-mono text-[8px] uppercase tracking-wider ${priority.cls}`}>
              {priority.label}
            </Badge>
            <Badge variant="outline" className={`font-mono text-[8px] uppercase tracking-wider ${status.cls}`}>
              {status.label}
            </Badge>
            {unseen && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" title="Unseen" />
            )}
            <span className="font-mono text-[10px] text-muted-foreground/40 ml-auto">
              {relativeTime(msg.createdAt)}
            </span>
          </div>
          <p className={`text-sm leading-relaxed font-sans ${blocked ? "text-rose-200/70 italic" : "text-foreground/85"}`}>
            {msg.content}
          </p>
          {blocked && msg.reason && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-rose-400/80 flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3 shrink-0" /> {msg.reason}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
