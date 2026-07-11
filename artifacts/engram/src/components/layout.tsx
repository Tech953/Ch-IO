import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Brain, Activity, Database, BookOpen, Users, Hash, FileCheck2, TrendingUp, BarChart3, MessageSquare, Radio, MessageCircleQuestion, Menu, Globe, Network, MessagesSquare, Terminal, FlaskConical, ScanEye, Download, Hammer } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useI18n, WEB_LOCALE_LABELS, WEB_SUPPORTED_LOCALES } from "@/i18n";

const navItems = [
  { href: "/", labelKey: "nav.overview", icon: Activity },
  { href: "/hub", labelKey: "nav.hub", icon: Network },
  { href: "/commons", labelKey: "nav.commons", icon: MessagesSquare },
  { href: "/simulations", labelKey: "nav.simulations", icon: FlaskConical },
  { href: "/terminal", labelKey: "nav.terminal", icon: Terminal },
  { href: "/chat", labelKey: "nav.chat", icon: MessageSquare },
  { href: "/environment", labelKey: "nav.environment", icon: Radio },
  { href: "/inquiry", labelKey: "nav.inquiry", icon: MessageCircleQuestion },
  { href: "/media", labelKey: "nav.media", icon: ScanEye },
  { href: "/studio", labelKey: "nav.studio", icon: Hammer },
  { href: "/personality", labelKey: "nav.personality", icon: Brain },
  { href: "/memory", labelKey: "nav.memory", icon: Database },
  { href: "/world-model", labelKey: "nav.worldModel", icon: Globe },
  { href: "/journal", labelKey: "nav.journal", icon: BookOpen },
  { href: "/personas", labelKey: "nav.personas", icon: Users },
  { href: "/hiero-code", labelKey: "nav.hieroCode", icon: Hash },
  { href: "/beliefs", labelKey: "nav.beliefs", icon: FileCheck2 },
  { href: "/evolution", labelKey: "nav.evolution", icon: TrendingUp },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
  { href: "/download", labelKey: "layout.downloadApp", icon: Download },
];

function SidebarContent({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <>
      <div className="p-6 flex flex-col gap-2 border-b border-border/50">
        <h1 className="text-2xl font-bold tracking-widest text-primary glow-text flex items-center gap-3">
          <span className="text-3xl">◈</span> PYRI
        </h1>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{t("layout.brandTagline")}</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} className={`flex items-center gap-3 px-3 py-2.5 rounded-none border-l-2 transition-all duration-200 ${isActive ? "bg-primary/10 border-primary text-primary" : "border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground hover:border-white/20"}`}>
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="font-display font-medium uppercase tracking-wider text-sm">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-border/50">
        <label className="block text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-2">
          {t("layout.locale")}
        </label>
        <select
          className="w-full bg-background border border-border/60 text-xs font-mono px-2 py-1.5"
          value={locale}
          onChange={(event) => setLocale(event.target.value as typeof locale)}
        >
          {WEB_SUPPORTED_LOCALES.map((code) => (
            <option key={code} value={code}>
              {WEB_LOCALE_LABELS[code]}
            </option>
          ))}
        </select>
      </div>

      <div className="px-3 py-3 border-t border-border/50">
        <Link
          href="/download"
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-none border transition-all duration-200 ${location === "/download" ? "bg-primary/15 border-primary text-primary" : "border-primary/30 text-primary/80 hover:bg-primary/10 hover:border-primary hover:text-primary"}`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span className="font-display font-medium uppercase tracking-wider text-sm">{t("layout.downloadApp")}</span>
        </Link>
      </div>

      <div className="p-4 border-t border-border/50 font-mono text-[10px] text-muted-foreground/50 uppercase flex justify-between">
        <span>{t("layout.statusOnline")}</span>
        <span className="text-primary/50">{t("layout.statusNominal")}</span>
      </div>
    </>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [location] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isChat = location === "/chat";
  const pageLabel = location === "/" ? t("layout.overview") : location.replace("/", "").toUpperCase();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r border-border/50 bg-sidebar/80 backdrop-blur-md flex-col z-10">
        <SidebarContent location={location} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col z-0 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden h-14 border-b border-border/50 flex items-center gap-3 px-4 bg-background/80 backdrop-blur-md z-20 shrink-0">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <button
                aria-label={t("layout.openNavigation")}
                className="flex items-center justify-center w-9 h-9 -ml-1 text-foreground/80 hover:text-primary transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              aria-describedby={undefined}
              className="w-72 max-w-[82vw] p-0 bg-sidebar border-border/50 flex flex-col"
            >
              <SheetTitle className="sr-only">{t("layout.navigation")}</SheetTitle>
              <SidebarContent location={location} onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
          <h1 className="text-lg font-bold tracking-widest text-primary glow-text flex items-center gap-2">
            <span className="text-xl">◈</span> PYRI
          </h1>
          <span className="font-mono text-[10px] text-primary/60 uppercase tracking-widest ml-auto truncate">
            {pageLabel}
          </span>
        </header>

        {/* Desktop header (non-chat) */}
        {!isChat && (
          <header className="hidden md:flex h-14 border-b border-border/50 items-center px-6 bg-background/50 backdrop-blur-sm z-10 shrink-0">
            <div className="font-mono text-xs text-primary/70 uppercase tracking-widest">
              {location === "/" ? "/ OVERVIEW" : location.toUpperCase()}
            </div>
          </header>
        )}

        <div className={`flex-1 overflow-hidden flex flex-col relative ${isChat ? "" : "overflow-y-auto p-4 md:p-8"}`}>
          {isChat ? (
            <div className="flex-1 h-full overflow-hidden p-4 md:p-8">
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
