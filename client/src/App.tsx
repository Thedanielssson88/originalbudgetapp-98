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
import AuthCallbackPage from "./pages/AuthCallbackPage";
import { useInitializeApiStore } from "./hooks/useApiStore";
import { usePrefetchAllTransactions } from "./hooks/useTransactions";
import { useEffect } from "react";
import { addLog } from "./utils/mobileDebugLogger";

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
  
  // STARTUP OPTIMIZATION: Prefetch all transactions for summaries and yearly analysis
  usePrefetchAllTransactions();
  
  // Show environment status on app start
  useEffect(() => {
    const checkEnvironment = async () => {
      const isDevelopment = import.meta.env.DEV;
      const clientEnv = isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION';
      const emoji = isDevelopment ? '🔧' : '🚀';
      
      // Log client environment
      addLog('info', `${emoji} Client started in ${clientEnv} mode`, {
        environment: clientEnv,
        baseUrl: window.location.origin,
        timestamp: new Date().toISOString()
      });
      
      // Fetch and log server environment
      try {
        const response = await fetch('/api/environment');
        if (response.ok) {
          const serverInfo = await response.json();
          const serverEmoji = serverInfo.environment === 'development' ? '🔧' : '🚀';
          addLog('info', `${serverEmoji} Server: ${serverInfo.environment.toUpperCase()} - Database: ${serverInfo.database}`, serverInfo);
        }
      } catch (error) {
        addLog('error', 'Failed to fetch server environment', { error });
      }
    };
    
    checkEnvironment();
  }, []);
  
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
            <Route path="/ladda-upp-filer" component={ImportPage} />
            <Route path="/installningar" component={SettingsPage} />
            <Route path="/auth/callback" component={AuthCallbackPage} />
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
