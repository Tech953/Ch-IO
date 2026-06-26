import { useState, useRef, useEffect, useCallback } from "react";
import { useListOpenaiConversations, useCreateOpenaiConversation, useDeleteOpenaiConversation, getListOpenaiConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Send, Upload, X, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ChatMode = "informational" | "alert" | "tutorial" | "companion" | "analyst" | "silent" | "custom";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Conversation {
  id: number;
  title: string;
  mode: string;
  personaName?: string | null;
  customEngram?: string | null;
  createdAt: string;
}

const MODES: { id: ChatMode; label: string; glyph: string; desc: string }[] = [
  { id: "informational", label: "Informational", glyph: "◈", desc: "Clear, measured. Inform with evidence." },
  { id: "alert", label: "Alert", glyph: "△", desc: "Concise. Urgent. Short sentences." },
  { id: "tutorial", label: "Tutorial", glyph: "◎", desc: "Patient. Structured. Step by step." },
  { id: "companion", label: "Companion", glyph: "⟡", desc: "Warm and conversational." },
  { id: "analyst", label: "Analyst", glyph: "⟐", desc: "Precise. Data-driven. Evidence-based." },
  { id: "silent", label: "Silent", glyph: "⬡", desc: "Minimal. Text-only output." },
  { id: "custom", label: "Custom", glyph: "⌘", desc: "Upload your own engram context." },
];

export default function Chat() {
  const { data: convList, isLoading: loadingList } = useListOpenaiConversations();
  const createConv = useCreateOpenaiConversation();
  const deleteConv = useDeleteOpenaiConversation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [convMode, setConvMode] = useState<ChatMode>("companion");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [customEngram, setCustomEngram] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function scrollToBottom() {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }

  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadConversation = useCallback(async (id: number) => {
    const resp = await fetch(`${BASE}/api/openai/conversations/${id}`);
    if (!resp.ok) return;
    const data = await resp.json();
    const conv: Conversation = { id: data.id, title: data.title, mode: data.mode, personaName: data.personaName, customEngram: data.customEngram, createdAt: data.createdAt };
    setMessages(data.messages ?? []);
    setActiveId(id);
    setConvMode((conv.mode as ChatMode) ?? "companion");
    setCustomEngram(conv.customEngram ?? "");
    scrollToBottom();
  }, []);

  async function handleNewConversation() {
    if (!newTitle.trim()) return;
    const result = await createConv.mutateAsync({
      data: {
        title: newTitle.trim(),
        mode: convMode,
        customEngram: convMode === "custom" ? customEngram : undefined,
      },
    });
    queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    setShowNewDialog(false);
    setNewTitle("");
    await loadConversation(result.id);
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteConv.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    toast({ title: "Conversation deleted" });
  }

  async function handleSend() {
    if (!input.trim() || streaming || !activeId) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setStreaming(true);
    const assistantIdx = messages.length + 1;
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(`${BASE}/api/openai/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg }),
        signal: ctrl.signal,
      });

      if (!resp.ok || !resp.body) {
        throw new Error("Stream failed");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const payload = JSON.parse(raw);
            if (payload.done) break;
            if (payload.error) {
              toast({ title: "Generation error", description: payload.error, variant: "destructive" });
              break;
            }
            if (payload.content) {
              accumulated += payload.content;
              setMessages((prev) => {
                const next = [...prev];
                const idx = next.findIndex((m, i) => i === assistantIdx);
                if (idx !== -1) next[idx] = { ...next[idx], content: accumulated };
                return next;
              });
            }
          } catch {}
        }
      }

      setMessages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((m, i) => i === assistantIdx);
        if (idx !== -1) next[idx] = { role: "assistant", content: accumulated };
        return next;
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast({ title: "Network error", description: "Could not reach the API", variant: "destructive" });
      }
      setMessages((prev) => prev.filter((_, i) => i !== assistantIdx));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleEngamorUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCustomEngram(ev.target?.result as string ?? "");
    reader.readAsText(file);
  }

  const activeConv = (convList ?? []).find((c: Conversation) => c.id === activeId);
  const modeInfo = MODES.find((m) => m.id === (activeConv?.mode ?? convMode));

  return (
    <div className="flex h-full gap-0 -m-6 md:-m-8 animate-in fade-in duration-500">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-border/50 flex flex-col bg-card/20 backdrop-blur-sm">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary">Conversations</h2>
            <p className="font-mono text-[9px] text-muted-foreground/50 mt-0.5">LPEM Dialogue Interface</p>
          </div>
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="w-7 h-7 text-primary hover:bg-primary/10">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border/50 max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display tracking-widest text-primary">New Conversation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Title</label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    placeholder="Thread name..." className="mt-1 font-mono text-sm border-border/50 bg-background/50"
                    onKeyDown={e => e.key === "Enter" && handleNewConversation()} />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2 block">LPEM Mode</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MODES.map((m) => (
                      <Tooltip key={m.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setConvMode(m.id)}
                            className={`flex items-center gap-2 px-2.5 py-2 border font-mono text-xs transition-colors ${convMode === m.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                          >
                            <span>{m.glyph}</span>
                            <span className="uppercase tracking-wider text-[10px]">{m.label}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-mono text-xs">{m.desc}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
                {convMode === "custom" && (
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider">Custom Engram</label>
                    <Textarea
                      value={customEngram}
                      onChange={e => setCustomEngram(e.target.value)}
                      placeholder="Paste your engram system context here..."
                      className="font-mono text-xs border-border/50 bg-background/50 min-h-24 resize-none"
                    />
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-primary/70 hover:text-primary transition-colors">
                      <Upload className="w-3 h-3" />
                      Upload .engram file
                      <input type="file" accept=".engram,.txt,.md,.json" onChange={handleEngamorUpload} className="sr-only" />
                    </label>
                  </div>
                )}
                <Button onClick={handleNewConversation} disabled={createConv.isPending || !newTitle.trim()}
                  className="w-full font-mono text-xs uppercase tracking-wider bg-primary text-primary-foreground">
                  {createConv.isPending ? "Creating..." : "Start Conversation"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingList ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 bg-primary/5" />)
            ) : !(convList ?? []).length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40 font-mono text-center">
                <MessageSquare className="w-6 h-6 mb-2" />
                <p className="text-[10px] uppercase">No conversations</p>
              </div>
            ) : (
              (convList as Conversation[]).map((c) => {
                const modeGlyph = MODES.find((m) => m.id === c.mode)?.glyph ?? "◈";
                return (
                  <button
                    key={c.id}
                    onClick={() => loadConversation(c.id)}
                    className={`w-full text-left px-3 py-2.5 border-l-2 transition-all group flex items-start gap-2 ${activeId === c.id ? "border-primary bg-primary/10" : "border-transparent hover:bg-white/5 hover:border-white/20"}`}
                  >
                    <span className="text-primary/60 text-sm mt-0.5">{modeGlyph}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-mono text-xs truncate ${activeId === c.id ? "text-primary" : "text-foreground/80"}`}>{c.title}</p>
                      <p className="font-mono text-[9px] text-muted-foreground/50 uppercase mt-0.5">{c.mode}</p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-400 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="h-12 border-b border-border/50 px-6 flex items-center gap-3 bg-background/50 backdrop-blur-sm shrink-0">
          {activeConv ? (
            <>
              <span className="text-primary text-base">{modeInfo?.glyph}</span>
              <span className="font-mono text-xs text-foreground/80 truncate">{activeConv.title}</span>
              <Badge variant="outline" className="font-mono text-[9px] uppercase tracking-wider border-primary/30 text-primary/70 ml-auto">
                {activeConv.mode}
              </Badge>
            </>
          ) : (
            <span className="font-mono text-xs text-muted-foreground/50 uppercase tracking-widest">Select or create a conversation</span>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!activeId ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/40 font-mono">
              <div className="text-5xl mb-4">◈</div>
              <p className="text-sm uppercase tracking-widest">PYRI Dialogue Interface</p>
              <p className="text-xs mt-2 text-muted-foreground/30">Create a conversation to begin</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {MODES.map((m) => (
                  <span key={m.id} className="font-mono text-[10px] text-muted-foreground/30 border border-muted/20 px-2 py-1">
                    {m.glyph} {m.label}
                  </span>
                ))}
              </div>
            </div>
          ) : !messages.length ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 font-mono">
              <span className="text-3xl mb-3">{modeInfo?.glyph}</span>
              <p className="text-xs uppercase tracking-widest">{modeInfo?.desc}</p>
              <p className="text-[10px] mt-1 text-muted-foreground/30">Send a message to begin</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] ${msg.role === "user" ? "order-1" : ""}`}>
                  <div className={`font-mono text-[9px] uppercase tracking-widest mb-1 ${msg.role === "user" ? "text-right text-muted-foreground/50" : "text-primary/50"}`}>
                    {msg.role === "user" ? "YOU" : `PYRI · ${modeInfo?.glyph ?? "◈"}`}
                  </div>
                  <div className={`px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary/10 border border-primary/20 text-foreground"
                      : "bg-card/40 border border-border/50 text-foreground/90 backdrop-blur-sm"
                  }`}>
                    {msg.content || (msg.streaming && (
                      <span className="flex items-center gap-1 text-muted-foreground/50">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="font-mono text-[10px]">generating</span>
                      </span>
                    ))}
                    {msg.streaming && msg.content && (
                      <span className="inline-block w-0.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border/50 p-4 bg-background/50 backdrop-blur-sm shrink-0">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeId ? `Message PYRI in ${convMode} mode…` : "Select a conversation first…"}
              disabled={!activeId || streaming}
              className="flex-1 font-mono text-sm border-border/50 bg-card/30 resize-none min-h-[44px] max-h-32 py-3 placeholder:text-muted-foreground/30"
              rows={1}
            />
            {streaming ? (
              <Button
                size="icon"
                variant="outline"
                className="shrink-0 border-rose-500/40 text-rose-400 hover:bg-rose-500/10 h-11 w-11"
                onClick={() => abortRef.current?.abort()}
              >
                <X className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                disabled={!activeId || !input.trim()}
                onClick={handleSend}
                className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-11"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/30 text-center mt-2">
            Enter to send · Shift+Enter for newline · {streaming ? "Generating…" : "Ready"}
          </p>
        </div>
      </div>
    </div>
  );
}
