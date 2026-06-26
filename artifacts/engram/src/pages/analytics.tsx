import { useGetStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from "recharts";

const LAYER_COLORS: Record<string, string> = {
  working: "#22d3ee",
  episodic: "#a78bfa",
  semantic: "#34d399",
  preference: "#fbbf24",
  reflective: "#fb7185",
  procedural: "#38bdf8",
};

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "hsl(230 50% 7%)",
  border: "1px solid hsl(230 50% 15%)",
  borderRadius: "0",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "11px",
  color: "hsl(210 40% 98%)",
};

export default function Analytics() {
  const { data: stats, isLoading } = useGetStats();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-widest text-primary">ANALYTICS</h2>
        <p className="text-sm font-mono text-muted-foreground mt-1">System-wide telemetry — memory topology, belief distribution, initiative history</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Memories", value: stats?.totalMemories },
          { label: "Beliefs", value: stats?.totalBeliefs },
          { label: "Journal", value: stats?.totalJournalEntries },
          { label: "Initiatives", value: stats?.totalInitiativeEvents },
          { label: "Revisions", value: stats?.evolutionRevisions },
        ].map(({ label, value }) => (
          <Card key={label} className="bg-card/40 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">{label}</p>
              {isLoading ? <Skeleton className="h-7 w-12 bg-primary/10" /> : (
                <p className="font-display text-2xl font-bold text-primary" data-testid={`stat-${label.toLowerCase()}`}>{value ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory by layer */}
        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-sm text-primary/80">Memory by Layer</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {isLoading ? <Skeleton className="h-full bg-primary/5" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.memoryByLayer ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(230 50% 15%)" vertical={false} />
                  <XAxis dataKey="layer" tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "hsl(210 30% 60%)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => v.toUpperCase()} />
                  <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "hsl(210 30% 60%)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="count" radius={0}>
                    {(stats?.memoryByLayer ?? []).map((entry) => (
                      <Cell key={entry.layer} fill={LAYER_COLORS[entry.layer] ?? "hsl(190 90% 50%)"} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Initiative events over time */}
        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-sm text-primary/80">Initiative Events (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {isLoading ? <Skeleton className="h-full bg-primary/5" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.initiativeByDay ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(230 50% 15%)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "hsl(210 30% 60%)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "hsl(210 30% 60%)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="count" stroke="hsl(190 90% 50%)" strokeWidth={2} dot={{ fill: "hsl(190 90% 50%)", r: 3 }}
                    activeDot={{ r: 5, fill: "hsl(190 90% 50%)" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Belief confidence distribution */}
        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-sm text-primary/80">Belief Confidence Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {isLoading ? <Skeleton className="h-full bg-primary/5" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.beliefConfidenceDistribution ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(230 50% 15%)" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "hsl(210 30% 60%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: "hsl(210 30% 60%)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="count" radius={0}>
                    {(stats?.beliefConfidenceDistribution ?? []).map((entry, i) => {
                      const colors = ["#fb7185", "#fbbf24", "#60a5fa", "#34d399"];
                      return <Cell key={entry.range} fill={colors[i]} fillOpacity={0.7} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Initiative score formula */}
        <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-sm text-primary/80">Initiative Score Formula</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border border-primary/20 bg-primary/5 font-mono text-xs sm:text-sm text-primary text-center break-words">
              score = importance × confidence × timing × novelty
            </div>
            <p className="font-mono text-xs text-muted-foreground/70">Threshold for delivery: 0.65. Suppressed below threshold to prevent interruption noise.</p>
            <div className="space-y-2">
              {[
                { label: "importance", desc: "How critical is the detected signal?", color: "text-rose-400" },
                { label: "confidence", desc: "How reliable is the observation?", color: "text-amber-400" },
                { label: "timing", desc: "Is the user receptive right now?", color: "text-sky-400" },
                { label: "novelty", desc: "Has this been surfaced before?", color: "text-emerald-400" },
              ].map(f => (
                <div key={f.label} className="flex gap-3 items-start">
                  <span className={`font-mono text-xs font-bold w-20 shrink-0 ${f.color}`}>{f.label}</span>
                  <span className="font-mono text-xs text-muted-foreground/60">{f.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
