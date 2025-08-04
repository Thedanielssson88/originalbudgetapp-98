import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import { AppLayout } from "./components/AppLayout";
import { MobileDebugPanel } from "./components/MobileDebugPanel";
import Index from "./pages/Index";
import BudgetPage from "./pages/BudgetPage";
import { SavingsGoalsPage } from "./pages/SavingsGoalsPage";
import TransactionsPage from "./pages/TransactionsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <AppLayout>
          <Switch>
            <Route path="/" component={BudgetPage} />
            <Route path="/budget" component={BudgetPage} />
            <Route path="/sparmal" component={SavingsGoalsPage} />
            <Route path="/transaktioner" component={TransactionsPage} />
            <Route path="/installningar" component={SettingsPage} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Router>
    </TooltipProvider>
    <MobileDebugPanel />
  </QueryClientProvider>
);

export default App;
