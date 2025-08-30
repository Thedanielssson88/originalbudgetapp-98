import { BottomNavigation } from "./BottomNavigation";
import { PlanHeader } from "./PlanHeader";
import { useLocation } from "wouter";

interface AppLayoutProps {
  children: React.ReactNode;
  planHeaderData?: {
    selectedMonth: string;
    totalIncome: number;
    totalCosts: number;
    totalSavings: number;
    onMonthChange?: (month: string) => void;
  };
}

const pageTitles: Record<string, string> = {
  "/inkomster": "Min Månadsbudget",
  "/plan": "Planering",
  "/sammanstallning": "Sammanställning",
  "/overforing": "Överföring",
  "/egen-budget": "Egen Budget",
  "/historia": "Historia",
  "/sparmal": "Sparmål",
  "/granska": "Transaktioner",
  "/transaktioner": "Ladda upp CSV-filer",
  "/installningar": "Inställningar",
  "/debug": "DEBUG-Mode",
};

export function AppLayout({ children, planHeaderData }: AppLayoutProps) {
  const [location] = useLocation();
  const pageTitle = pageTitles[location] || "Budget Kalkylator";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      {location === "/plan" && planHeaderData ? (
        <header className="sticky top-0 z-40">
          <PlanHeader
            selectedMonth={planHeaderData.selectedMonth}
            totalIncome={planHeaderData.totalIncome}
            totalCosts={planHeaderData.totalCosts}
            totalSavings={planHeaderData.totalSavings}
            onMonthChange={planHeaderData.onMonthChange}
          />
        </header>
      ) : (
        <header className="h-14 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
          <div className="flex-1 text-center px-4">
            <h1 className="text-lg font-semibold truncate">{pageTitle}</h1>
          </div>
        </header>
      )}

      {/* Main content with padding for bottom nav */}
      <main className="flex-1 overflow-auto pb-16">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}