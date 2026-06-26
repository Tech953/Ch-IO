import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";

import Home from "@/pages/home";
import Personality from "@/pages/personality";
import Memory from "@/pages/memory";
import Journal from "@/pages/journal";
import Personas from "@/pages/personas";
import HieroCode from "@/pages/hiero-code";
import Beliefs from "@/pages/beliefs";
import Evolution from "@/pages/evolution";
import Analytics from "@/pages/analytics";
import Chat from "@/pages/chat";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/personality" component={Personality} />
        <Route path="/memory" component={Memory} />
        <Route path="/journal" component={Journal} />
        <Route path="/personas" component={Personas} />
        <Route path="/hiero-code" component={HieroCode} />
        <Route path="/beliefs" component={Beliefs} />
        <Route path="/evolution" component={Evolution} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/chat" component={Chat} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        <div className="scanline" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
