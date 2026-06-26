import { useListInitiativeEvents, useCreateInitiativeEvent, getListInitiativeEventsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Plus, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Initiative() {
  const { data: events, isLoading } = useListInitiativeEvents();
  const create = useCreateInitiativeEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    trigger: "", message: "",
    importanceScore: 0.7, confidenceScore: 0.75, noveltyScore: 0.6,
    overallScore: 0.68, wasDelivered: false,
  });

  function calcOverall(f: typeof form) {
    return +(f.importanceScore * f.confidenceScore * f.noveltyScore * 1.5).toFixed(2);
  }

  function handleCreate() {
    if (!form.trigger.trim() || !form.message.trim()) return;
    const overall = calcOverall(form);
    create.mutate({ data: { ...form, overallScore: overall } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInitiativeEventsQueryKey() });
        setOpen(false);
        setForm({ trigger: "", message: "", importanceScore: 0.7, confidenceScore: 0.75, noveltyScore: 0.6, overallScore: 0.68, wasDelivered: false });
        toast({ title: "Initiative Event Logged", description: `Score: ${(overall * 100).toFixed(0)}%` });
      }
    });
  }

  const sorted = events ? [...events].sort((a, b) => b.overallScore - a.overallScore) : [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-widest text-primary">INITIATIVE ENGINE</h2>
          <p className="text-sm font-mono text-muted-foreground mt-1">Proactive signal queue — importance × confidence × novelty</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="font-mono text-xs uppercase tracking-wider bg-primary text-primary-foreground">
              <Plus className="w-3 h-3 mr-2" /> Log Event
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/50 max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display tracking-widest text-primary">Log Initiative Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Trigger</label>
                <Input value={form.trigger} onChange={e => setForm(p => ({ ...p, trigger: e.target.value }))}
                  placeholder="What triggered this?" className="mt-1 font-mono text-sm border-border/50 bg-background/50" />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Message</label>
                <Textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Proactive message to surface..." className="mt-1 font-sans text-sm border-border/50 bg-background/50 min-h-20" />
              </div>
              {[
                { key: "importanceScore" as const, label: "Importance" },
                { key: "confidenceScore" as const, label: "Confidence" },
                { key: "noveltyScore" as const, label: "Novelty" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">{label}</label>
                    <span className="font-mono text-xs text-primary">{Math.round(form[key] * 100)}%</span>
                  </div>
                  <Slider min={0} max={1} step={0.01} value={[form[key]]}
                    onValueChange={v => setForm(p => ({ ...p, [key]: v[0] }))} />
                </div>
              ))}
              <div className="flex justify-between items-center font-mono text-xs p-3 bg-primary/5 border border-primary/20">
                <span className="text-muted-foreground uppercase">Overall Score</span>
                <span className="text-primary font-bold text-lg">{(calcOverall(form) * 100).toFixed(0)}%</span>
              </div>
              <Button onClick={handleCreate} disabled={create.isPending || !form.trigger.trim()}
                className="w-full font-mono text-xs uppercase tracking-wider bg-primary text-primary-foreground">
                {create.isPending ? "Logging..." : "Log Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card/20 border border-border/30 p-4 font-mono text-xs text-muted-foreground space-y-1">
        <p className="text-primary/70">THRESHOLD: 0.65</p>
        <p>score = importance × confidence × novelty × 1.5 — Events below threshold are suppressed to prevent interruption noise.</p>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 bg-primary/5" />)
        ) : !sorted.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground font-mono text-center">
            <Zap className="w-8 h-8 mb-4 opacity-30" />
            <p className="text-xs uppercase tracking-widest">No initiative events recorded</p>
          </div>
        ) : (
          sorted.map(ev => {
            const score = Math.round(ev.overallScore * 100);
            const delivered = ev.wasDelivered;
            const scoreColor = score >= 65 ? "text-emerald-400" : "text-rose-400";
            return (
              <Card key={ev.id} className="bg-card/40 border-border/50 backdrop-blur-sm hover:bg-card/60 transition-colors">
                <CardContent className="p-4 flex gap-4 items-start">
                  <div className={`font-mono text-2xl font-bold tabular-nums shrink-0 ${scoreColor}`}>{score}%</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-mono text-[10px] text-primary/70 uppercase">{ev.trigger}</span>
                      <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 border ${delivered ? "border-emerald-500/30 text-emerald-400" : "border-muted text-muted-foreground/50"}`}>
                        {delivered ? "Delivered" : "Suppressed"}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/40">{new Date(ev.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-foreground/80 font-sans leading-relaxed">{ev.message}</p>
                    <div className="flex gap-4 mt-2 text-[10px] font-mono text-muted-foreground/50">
                      <span>IMP {Math.round(ev.importanceScore * 100)}%</span>
                      <span>CONF {Math.round(ev.confidenceScore * 100)}%</span>
                      <span>NOVEL {Math.round(ev.noveltyScore * 100)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
