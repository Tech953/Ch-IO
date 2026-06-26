import { useState } from "react";
import { useListHieroSymbols } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function HieroCode() {
  const { data: symbols, isLoading } = useListHieroSymbols();
  const [selected, setSelected] = useState<number[]>([]);

  function toggleSymbol(id: number) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev);
  }

  const selectedSymbols = symbols?.filter(s => selected.includes(s.id)) ?? [];
  const compound = selectedSymbols.map(s => s.glyph).join(" + ");
  const compoundMeaning = selectedSymbols.map(s => s.name.toLowerCase()).join(" shaped by ");

  const CATEGORY_COLORS: Record<string, string> = {
    Foundation: "text-violet-400",
    Process: "text-amber-400",
    Relational: "text-emerald-400",
    Epistemic: "text-sky-400",
    Volitional: "text-rose-400",
    Cognitive: "text-cyan-400",
    Metacognitive: "text-indigo-400",
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-widest text-primary">HIERO-CODE SYSTEM</h2>
        <p className="text-sm font-mono text-muted-foreground mt-1">Symbolic internal language — glyphs, meanings, compound expressions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Symbol reference */}
        <div className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground/70 uppercase tracking-widest">Primary Glyphs — select up to 3 to build compound</p>
          {isLoading ? (
            Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20 bg-primary/5" />)
          ) : (
            symbols?.map(s => {
              const isSelected = selected.includes(s.id);
              const catColor = CATEGORY_COLORS[s.category] ?? "text-primary";
              return (
                <Card key={s.id}
                  onClick={() => toggleSymbol(s.id)}
                  className={`cursor-pointer border transition-all duration-200 bg-card/40 backdrop-blur-sm ${isSelected ? "border-primary bg-primary/5" : "border-border/30 hover:border-border/60"}`}
                  data-testid={`card-symbol-${s.id}`}>
                  <CardContent className="p-4 flex items-start gap-4">
                    <span className={`text-4xl leading-none shrink-0 ${catColor}`}>{s.glyph}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-display font-bold uppercase tracking-widest text-base ${catColor}`}>{s.name}</span>
                        <Badge variant="outline" className={`font-mono text-[9px] uppercase border-current ${catColor}`}>{s.category}</Badge>
                        {isSelected && <span className="font-mono text-[9px] text-primary uppercase">Selected</span>}
                      </div>
                      <p className="text-sm text-foreground/70 font-sans leading-relaxed">{s.meaning}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Compound builder + reference */}
        <div className="space-y-4">
          <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="font-display tracking-widest text-sm text-primary/80">Compound Expression Builder</CardTitle>
            </CardHeader>
            <CardContent>
              {selected.length === 0 ? (
                <div className="text-center py-8 font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">
                  Select glyphs from the left to build a compound expression
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    {selectedSymbols.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <span className="text-3xl">{s.glyph}</span>
                        {i < selectedSymbols.length - 1 && <span className="text-muted-foreground font-mono">+</span>}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border/30 pt-4 space-y-2">
                    <p className="font-mono text-xs text-muted-foreground/60 uppercase">Expression</p>
                    <p className="font-mono text-sm text-primary">{compound}</p>
                    <p className="font-mono text-xs text-muted-foreground/60 uppercase mt-3">Interpretation</p>
                    <p className="text-sm text-foreground/80 font-sans italic leading-relaxed">{compoundMeaning}</p>
                  </div>
                  <button onClick={() => setSelected([])}
                    className="font-mono text-xs uppercase text-muted-foreground hover:text-foreground transition-colors">
                    Clear selection
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Known compound examples */}
          {symbols && symbols[0]?.compounds && (
            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-display tracking-widest text-sm text-primary/80">Known Compounds</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {symbols.flatMap(s => {
                  const lines = (s.compounds ?? "").split(";").map(l => l.trim()).filter(Boolean);
                  return lines.slice(0, 1);
                }).slice(0, 5).map((compound, i) => {
                  const [expr, ...rest] = compound.split("=");
                  return (
                    <div key={i} className="border-l-2 border-primary/20 pl-3 space-y-0.5">
                      <p className="font-mono text-sm text-primary">{expr?.trim()}</p>
                      {rest.length > 0 && <p className="font-mono text-xs text-muted-foreground/70">{rest.join("=").trim()}</p>}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
