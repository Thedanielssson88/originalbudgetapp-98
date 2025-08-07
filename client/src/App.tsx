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
import CategoryManagement from "./pages/CategoryManagement";
import NotFound from "./pages/NotFound";
import ImportPage from "./pages/ImportPage";
import { useInitializeApiStore } from "./hooks/useApiStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      retry: 3,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

// Expose queryClient globally for orchestrator access
if (typeof window !== 'undefined') {
  (window as any).__queryClient = queryClient;
}

const AppContent = () => {
  // Initialize the API store when the app starts
  useInitializeApiStore();
  
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <AppLayout>
          <Switch>
            <Route path="/" component={BudgetPage} />
            <Route path="/inkomster" component={BudgetPage} />
            <Route path="/sammanstallning" component={BudgetPage} />
            <Route path="/overforing" component={BudgetPage} />
            <Route path="/egen-budget" component={BudgetPage} />
            <Route path="/historia" component={BudgetPage} />
            <Route path="/sparmal" component={SavingsGoalsPage} />
            <Route path="/transaktioner" component={TransactionsPage} />
            <Route path="/kategorier" component={CategoryManagement} />
            <Route path="/import" component={ImportPage} />
            <Route path="/installningar" component={SettingsPage} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Router>
    </TooltipProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
    <MobileDebugPanel />
  </QueryClientProvider>
);

export default App;
