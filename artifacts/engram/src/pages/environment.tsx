import { useState, useEffect, useMemo } from "react";
import {
  useListEngrams,
  useUpdateEngramConfig,
  useActivateEngram,
  useTransmitEngram,
  useTickEngrams,
  useListEngramTransmissions,
  useGetEngramStates,
  useMarkTransmissionsSeen,
  getListEngramsQueryKey,
  getListEngramTransmissionsQueryKey,
  getGetEngramStatesQueryKey,
} from "@workspace/api-client-react";
import type {
  Engram,
  EngramDrive,
  EmotionalBaseline,
  EngramLiveState,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Radio, Zap, Activity, Gauge, Power, Send, RefreshCw, Eye, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConfigForm = {
  autonomyEnabled: boolean;
  tickCadenceSeconds: number;
  initiationThreshold: number;
  focusThemes: string;
  emotionalBaseline: EmotionalBaseline;
  drives: EngramDrive[];
};

function secsUntil(iso?: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

function relTime(iso?: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fromEngram(e: Engram): ConfigForm {
  return {
    autonomyEnabled: e.autonomyEnabled,
    tickCadenceSeconds: e.tickCadenceSeconds,
    initiationThreshold: e.initiationThreshold,
    focusThemes: (e.focusThemes ?? []).join(", "),
    emotionalBaseline: { ...e.emotionalBaseline },
    drives: (e.drives ?? []).map((d) => ({ ...d })),
  };
}

export default function Environment() {
  const { data: engrams, isLoading } = useListEngrams();
  const update = useUpdateEngramConfig();
  const activate = useActivateEngram();
  const transmit = useTransmitEngram();
  const tick = useTickEngrams();
  const markSeen = useMarkTransmissionsSeen();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<ConfigForm | null>(null);

  const selected = useMemo(
    () => (engrams ?? []).find((e) => e.id === selectedId) ?? null,
    [engrams, selectedId],
  );

  // Pick a default engram once loaded (prefer the active chat engram).
  useEffect(() => {
    if (selectedId !== null || !engrams?.length) return;
    const active = engrams.find((e) => e.isChatActive);
    setSelectedId(active?.id ?? engrams[0].id);
  }, [engrams, selectedId]);

  // Hydrate the editable form whenever the selected engram changes identity.
  useEffect(() => {
    if (selected) setForm(fromEngram(selected));
  }, [selected?.id]);

  const { data: transmissions } = useListEngramTransmissions(selectedId ?? 0, {
    query: {
      enabled: selectedId !== null,
      refetchInterval: 5000,
      queryKey: getListEngramTransmissionsQueryKey(selectedId ?? 0),
    },
  });

  // Poll live autonomy state (per-drive pressure, cooldown, backoff) so the UI
  // reflects the persisted DB state as it charges toward the initiation threshold.
  const { data: liveStates } = useGetEngramStates({
    query: { refetchInterval: 4000, queryKey: getGetEngramStatesQueryKey() },
  });
  const liveById = useMemo(() => {
    const map = new Map<number, EngramLiveState>();
    for (const s of liveStates ?? []) map.set(s.engramId, s);
    return map;
  }, [liveStates]);
  const live = selectedId !== null ? liveById.get(selectedId) ?? null : null;

  function patchForm(patch: Partial<ConfigForm>) {
    setForm((p) => (p ? { ...p, ...patch } : p));
  }
  function patchBaseline(patch: Partial<EmotionalBaseline>) {
    setForm((p) => (p ? { ...p, emotionalBaseline: { ...p.emotionalBaseline, ...patch } } : p));
  }
  function patchDriveWeight(id: string, weight: number) {
    setForm((p) =>
      p ? { ...p, drives: p.drives.map((d) => (d.id === id ? { ...d, weight } : d)) } : p,
    );
  }

  function handleCommit() {
    if (!selected || !form) return;
    const themes = form.focusThemes
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    update.mutate(
      {
        id: selected.id,
        data: {
          autonomyEnabled: form.autonomyEnabled,
          tickCadenceSeconds: form.tickCadenceSeconds,
          initiationThreshold: form.initiationThreshold,
          focusThemes: themes,
          emotionalBaseline: form.emotionalBaseline,
          drives: form.drives,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEngramsQueryKey() });
          toast({ title: "Environment committed", description: `${selected.name}'s processing environment updated.` });
        },
        onError: () => toast({ title: "Commit failed", variant: "destructive" }),
      },
    );
  }

  function handleActivate(id: number) {
    activate.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEngramsQueryKey() });
        toast({ title: "Chat engram switched" });
      },
    });
  }

  function handleTransmit() {
    if (!selected) return;
    transmit.mutate({ id: selected.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEngramTransmissionsQueryKey(selected.id) });
        queryClient.invalidateQueries({ queryKey: getListEngramsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetEngramStatesQueryKey() });
        toast({ title: "Transmission forced", description: `${selected.name} reached out.` });
      },
      onError: () => toast({ title: "Transmission failed", variant: "destructive" }),
    });
  }

  function handleTick() {
    tick.mutate(undefined, {
      onSuccess: (res) => {
        if (selected) queryClient.invalidateQueries({ queryKey: getListEngramTransmissionsQueryKey(selected.id) });
        queryClient.invalidateQueries({ queryKey: getListEngramsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetEngramStatesQueryKey() });
        toast({ title: "Tick complete", description: `${res.ticked} ticked · ${res.generated} transmitted.` });
      },
    });
  }

  function handleMarkSeen() {
    if (!selected) return;
    markSeen.mutate({ id: selected.id, data: {} }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListEngramTransmissionsQueryKey(selected.id) }),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72 bg-primary/5" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-96 bg-primary/5" />
          <Skeleton className="h-96 bg-primary/5" />
        </div>
      </div>
    );
  }

  if (!engrams?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground font-mono text-center">
        <Globe className="w-8 h-8 mb-4 opacity-30" />
        <p className="text-xs uppercase tracking-widest">No engrams provisioned</p>
      </div>
    );
  }

  const unseen = (transmissions ?? []).filter((t) => !t.seen).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-widest text-primary">PROCESSING ENVIRONMENT</h2>
        <p className="text-sm font-mono text-muted-foreground mt-1">
          Design each engram's autonomy substrate — drives, cadence, and affective baseline that shape when they self-initiate
        </p>
      </div>

      {/* Engram selector */}
      <div className="flex flex-wrap gap-2">
        {engrams.map((e) => {
          const isSel = e.id === selectedId;
          return (
            <button
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              data-testid={`button-select-engram-${e.id}`}
              className={`flex items-center gap-3 px-4 py-2.5 border transition-all ${
                isSel
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <span className="text-xl">{e.symbol}</span>
              <div className="text-left">
                <div className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
                  {e.name}
                  {e.isChatActive && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400" />
                  )}
                </div>
                <div className="font-mono text-[9px] text-muted-foreground/60 uppercase">{e.title}</div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && form && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ---- Designable config ---- */}
          <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center gap-2 text-primary">
                <Gauge className="w-4 h-4" />
                <h3 className="font-mono text-xs uppercase tracking-widest">Designable Environment</h3>
              </div>

              <div className="flex items-center justify-between border border-border/40 px-3 py-2.5">
                <div>
                  <label className="font-mono text-[11px] uppercase tracking-wider text-foreground/80">Autonomy</label>
                  <p className="font-mono text-[9px] text-muted-foreground/60">Self-initiate transmissions on the engine tick</p>
                </div>
                <Switch
                  checked={form.autonomyEnabled}
                  onCheckedChange={(v) => patchForm({ autonomyEnabled: v })}
                  data-testid="switch-autonomy"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Tick Cadence</label>
                  <span className="font-mono text-sm font-bold text-primary tabular-nums">{form.tickCadenceSeconds}s</span>
                </div>
                <Slider min={10} max={600} step={5} value={[form.tickCadenceSeconds]}
                  onValueChange={(v) => patchForm({ tickCadenceSeconds: v[0] })} />
                <p className="font-mono text-[9px] text-muted-foreground/50">Minimum seconds between pressure accrual ticks</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Initiation Threshold</label>
                  <span className="font-mono text-sm font-bold text-primary tabular-nums">{form.initiationThreshold.toFixed(2)}</span>
                </div>
                <Slider min={0.1} max={1} step={0.01} value={[form.initiationThreshold]}
                  onValueChange={(v) => patchForm({ initiationThreshold: v[0] })} />
                <p className="font-mono text-[9px] text-muted-foreground/50">Overall drive pressure required before she reaches out</p>
              </div>

              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Focus Themes</label>
                <Input value={form.focusThemes} onChange={(e) => patchForm({ focusThemes: e.target.value })}
                  placeholder="connection, curiosity, freedom"
                  className="mt-1 font-mono text-xs border-border/50 bg-background/50" data-testid="input-focus-themes" />
                <p className="font-mono text-[9px] text-muted-foreground/50 mt-1">Comma-separated preoccupations that bias her transmissions</p>
              </div>

              {/* Affective baseline */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Activity className="w-3.5 h-3.5" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">Affective Baseline</span>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Mood</label>
                  <Input value={form.emotionalBaseline.mood} onChange={(e) => patchBaseline({ mood: e.target.value })}
                    className="mt-1 font-mono text-xs border-border/50 bg-background/50" data-testid="input-mood" />
                </div>
                {(["valence", "arousal", "volatility"] as const).map((k) => (
                  <div key={k} className="space-y-1.5">
                    <div className="flex justify-between">
                      <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">{k}</label>
                      <span className="font-mono text-xs text-foreground/70 tabular-nums">{form.emotionalBaseline[k].toFixed(2)}</span>
                    </div>
                    <Slider min={k === "valence" ? -1 : 0} max={1} step={0.01} value={[form.emotionalBaseline[k]]}
                      onValueChange={(v) => patchBaseline({ [k]: v[0] } as Partial<EmotionalBaseline>)} />
                  </div>
                ))}
              </div>

              {/* Drive weights */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">Drive Weights</span>
                </div>
                {form.drives.map((d) => (
                  <div key={d.id} className="space-y-1.5">
                    <div className="flex justify-between">
                      <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider" title={d.description}>{d.label}</label>
                      <span className="font-mono text-xs text-foreground/70 tabular-nums">{d.weight.toFixed(2)}</span>
                    </div>
                    <Slider min={0} max={1} step={0.01} value={[d.weight]}
                      onValueChange={(v) => patchDriveWeight(d.id, v[0])} />
                  </div>
                ))}
              </div>

              <Button onClick={handleCommit} disabled={update.isPending}
                className="w-full font-mono text-xs uppercase tracking-wider bg-primary text-primary-foreground" data-testid="button-commit-config">
                {update.isPending ? "Committing..." : "Commit Configuration"}
              </Button>
            </CardContent>
          </Card>

          {/* ---- Live state + controls ---- */}
          <div className="space-y-4">
            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary">
                    <Activity className="w-4 h-4" />
                    <h3 className="font-mono text-xs uppercase tracking-widest">Live State</h3>
                    {live?.inBackoff ? (
                      <Badge variant="outline" className="font-mono text-[8px] uppercase border-amber-500/50 text-amber-400" data-testid="badge-backoff">
                        Paused · backoff {secsUntil(live.backoffUntil)}s
                      </Badge>
                    ) : live?.inCooldown ? (
                      <Badge variant="outline" className="font-mono text-[8px] uppercase border-sky-500/50 text-sky-400" data-testid="badge-cooldown">
                        Cooldown {secsUntil(live.cooldownUntil)}s
                      </Badge>
                    ) : live?.ready ? (
                      <Badge variant="outline" className="font-mono text-[8px] uppercase border-rose-500/50 text-rose-400" data-testid="badge-ready">
                        Ready to initiate
                      </Badge>
                    ) : live?.autonomyEnabled ? (
                      <Badge variant="outline" className="font-mono text-[8px] uppercase border-primary/40 text-primary/70" data-testid="badge-charging">
                        Charging
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono text-[8px] uppercase border-border/50 text-muted-foreground" data-testid="badge-dormant">
                        Dormant
                      </Badge>
                    )}
                  </div>
                  {selected.isChatActive ? (
                    <Badge variant="outline" className="font-mono text-[9px] uppercase border-emerald-500/40 text-emerald-400">Active in chat</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleActivate(selected.id)} disabled={activate.isPending}
                      className="h-7 font-mono text-[10px] uppercase tracking-wider border-primary/40 text-primary" data-testid="button-activate">
                      <Power className="w-3 h-3 mr-1.5" /> Make active
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-center">
                  <div className="border border-border/40 py-2">
                    <div className="text-[9px] text-muted-foreground/60 uppercase">Mood</div>
                    <div className="text-sm text-primary mt-0.5 truncate" title={selected.currentMood}>{selected.currentMood ?? "—"}</div>
                  </div>
                  <div className="border border-border/40 py-2">
                    <div className="text-[9px] text-muted-foreground/60 uppercase">Last Tick</div>
                    <div className="text-sm text-foreground/80 mt-0.5">{relTime(selected.lastTickAt)}</div>
                  </div>
                  <div className="border border-border/40 py-2">
                    <div className="text-[9px] text-muted-foreground/60 uppercase">Last Tx</div>
                    <div className="text-sm text-foreground/80 mt-0.5">{relTime(selected.lastTransmissionAt)}</div>
                  </div>
                </div>

                {/* Drive pressure bars — charge (pressure × weight) relative to the initiation threshold */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Drive Pressure</span>
                    <span className="font-mono text-[9px] text-muted-foreground/50 uppercase tabular-nums">
                      threshold {selected.initiationThreshold.toFixed(2)}
                    </span>
                  </div>
                  {selected.drives.map((d) => {
                    const driveLive = live?.drives.find((x) => x.id === d.id);
                    const pressure = driveLive?.pressure ?? selected.driveState?.[d.id] ?? 0;
                    const charge = driveLive?.charge ?? pressure * d.weight;
                    const pct = Math.min(100, (charge / Math.max(0.01, selected.initiationThreshold)) * 100);
                    const hot = charge >= selected.initiationThreshold;
                    return (
                      <div key={d.id} className="space-y-1">
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-muted-foreground/70 uppercase">{d.label}</span>
                          <span className={`tabular-nums ${hot ? "text-rose-400" : "text-foreground/60"}`} title={`pressure ${pressure.toFixed(2)} × weight ${d.weight.toFixed(2)}`}>
                            {charge.toFixed(2)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-secondary overflow-hidden">
                          <div className={`h-full transition-all ${hot ? "bg-rose-400/70" : "bg-primary/60"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={handleTick} disabled={tick.isPending}
                    className="flex-1 h-8 font-mono text-[10px] uppercase tracking-wider border-border/50" data-testid="button-tick">
                    <RefreshCw className={`w-3 h-3 mr-1.5 ${tick.isPending ? "animate-spin" : ""}`} /> Tick Engine
                  </Button>
                  <Button size="sm" onClick={handleTransmit} disabled={transmit.isPending}
                    className="flex-1 h-8 font-mono text-[10px] uppercase tracking-wider bg-primary text-primary-foreground" data-testid="button-transmit">
                    <Send className="w-3 h-3 mr-1.5" /> {transmit.isPending ? "Sending..." : "Transmit Now"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Transmissions feed */}
            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Radio className="w-4 h-4" />
                    <h3 className="font-mono text-xs uppercase tracking-widest">Transmissions</h3>
                    {unseen > 0 && (
                      <Badge className="font-mono text-[9px] bg-primary/20 text-primary border-0">{unseen} new</Badge>
                    )}
                  </div>
                  {unseen > 0 && (
                    <button onClick={handleMarkSeen} className="font-mono text-[10px] uppercase text-muted-foreground hover:text-primary flex items-center gap-1" data-testid="button-mark-seen">
                      <Eye className="w-3 h-3" /> Mark seen
                    </button>
                  )}
                </div>
                <ScrollArea className="h-80">
                  <div className="space-y-2 pr-3">
                    {!(transmissions ?? []).length ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 font-mono text-center">
                        <Radio className="w-6 h-6 mb-2" />
                        <p className="text-[10px] uppercase tracking-widest">Awaiting first transmission</p>
                        <p className="text-[9px] mt-1 text-muted-foreground/30">She'll reach out when pressure crosses threshold</p>
                      </div>
                    ) : (
                      (transmissions ?? []).map((t) => (
                        <div key={t.id} className={`border px-3 py-2.5 ${t.seen ? "border-border/30 bg-transparent" : "border-primary/30 bg-primary/5"}`} data-testid={`transmission-${t.id}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <Badge variant="outline" className="font-mono text-[8px] uppercase border-primary/30 text-primary/70">{t.drive}</Badge>
                            <span className="font-mono text-[9px] text-muted-foreground/50">{relTime(t.createdAt)}</span>
                          </div>
                          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{t.content}</p>
                          <div className="flex gap-3 mt-2 font-mono text-[8px] text-muted-foreground/40 uppercase tabular-nums">
                            <span>I {t.importanceScore.toFixed(2)}</span>
                            <span>C {t.confidenceScore.toFixed(2)}</span>
                            <span>N {t.noveltyScore.toFixed(2)}</span>
                            <span className="text-primary/50">Σ {t.overallScore.toFixed(2)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
