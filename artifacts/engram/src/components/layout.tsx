import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Brain, Activity, Database, BookOpen, Users, Hash, FileCheck2, TrendingUp, BarChart3, MessageSquare, Radio, MessageCircleQuestion } from "lucide-react";

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Hub", icon: Activity },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/environment", label: "Environment", icon: Radio },
    { href: "/inquiry", label: "Inquiry", icon: MessageCircleQuestion },
    { href: "/personality", label: "Personality", icon: Brain },
    { href: "/memory", label: "Memory", icon: Database },
    { href: "/journal", label: "Journal", icon: BookOpen },
    { href: "/personas", label: "Personas", icon: Users },
    { href: "/hiero-code", label: "Hiero-Code", icon: Hash },
    { href: "/beliefs", label: "Beliefs", icon: FileCheck2 },
    { href: "/evolution", label: "Evolution", icon: TrendingUp },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  const isChat = location === "/chat";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border/50 bg-sidebar/80 backdrop-blur-md flex flex-col z-10">
        <div className="p-6 flex flex-col gap-2 border-b border-border/50">
          <h1 className="text-2xl font-bold tracking-widest text-primary glow-text flex items-center gap-3">
            <span className="text-3xl">◈</span> PYRI
          </h1>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Cognitive Architecture</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-none border-l-2 transition-all duration-200 ${isActive ? "bg-primary/10 border-primary text-primary" : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground hover:border-white/20"}`}>
                <item.icon className="w-4 h-4" />
                <span className="font-display font-medium uppercase tracking-wider text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border/50 font-mono text-[10px] text-muted-foreground/50 uppercase flex justify-between">
          <span>SYS.ONLINE</span>
          <span className="text-primary/50">OP.NOMINAL</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col z-0">
        {!isChat && (
          <header className="h-14 border-b border-border/50 flex items-center px-6 bg-background/50 backdrop-blur-sm z-10 shrink-0">
            <div className="font-mono text-xs text-primary/70 uppercase tracking-widest">
              {location === "/" ? "/ HUB" : location.toUpperCase()}
            </div>
          </header>
        )}
        <div className={`flex-1 overflow-hidden flex flex-col relative ${isChat ? "" : "overflow-y-auto p-6 md:p-8"}`}>
          {isChat ? (
            <div className="flex-1 h-full overflow-hidden p-6 md:p-8">
              {children}
            </div>
          ) : (
            <div className="max-w-7xl mx-auto h-full w-full">
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
