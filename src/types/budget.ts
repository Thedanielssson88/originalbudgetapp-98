// Definierar alla typer som används i appen.

export interface SubCategory {
  id: string;
  name: string;
  amount: number;
  account?: string;
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
}

export interface BudgetGroup {
  id: string;
  name: string;
  amount: number;
  type: 'cost' | 'savings';
  subCategories?: SubCategory[];
  account?: string;
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
}

export interface Account {
  id: string;
  name: string;
  startBalance: number;
}

export interface BudgetResults {
  totalSalary: number;
  totalDailyBudget: number;
  remainingDailyBudget: number;
  holidayDaysBudget: number;
  balanceLeft: number;
  susannaShare: number;
  andreasShare: number;
  susannaPercentage: number;
  andreasPercentage: number;
  daysUntil25th: number;
  weekdayCount: number;
  fridayCount: number;
  totalMonthlyExpenses: number;
  holidayDays: string[];
  holidaysUntil25th: string[];
  nextTenHolidays: string[];
  remainingWeekdayCount: number;
  remainingFridayCount: number;
}

// MonthData innehåller all data för en specifik månad
export interface MonthData {
  // Salary information
  andreasSalary: number;
  andreasförsäkringskassan: number;
  andreasbarnbidrag: number;
  susannaSalary: number;
  susannaförsäkringskassan: number;
  susannabarnbidrag: number;
  
  // Budget groups (tidigare top-level i rawData)
  costGroups: BudgetGroup[];
  savingsGroups: BudgetGroup[];
  
  // Transfer settings
  dailyTransfer: number;
  weekendTransfer: number;
  transferAccount?: number;
  
  // Personal budgets (behåll som number för kompatibilitet)
  andreasPersonalCosts: number;
  andreasPersonalSavings: number;
  susannaPersonalCosts: number;
  susannaPersonalSavings: number;
  
  // Custom holidays for this month
  customHolidays: {date: string, name: string}[];
  
  // Account balances and related data
  accountBalances: {[key: string]: number};
  accountBalancesSet: {[key: string]: boolean};
  accountEstimatedFinalBalances: {[key: string]: number};
  accountEstimatedFinalBalancesSet: {[key: string]: boolean};
  accountEstimatedStartBalances: {[key: string]: number};
  accountStartBalancesSet: {[key: string]: boolean};
  accountEndBalancesSet: {[key: string]: boolean};
  
  // User names
  userName1: string;
  userName2: string;
  
  // Transfer completion tracking
  transferChecks: {[key: string]: boolean};
  andreasShareChecked: boolean;
  susannaShareChecked: boolean;
  
  // Month completion flags
  monthFinalBalances: {[key: string]: boolean};
  
  // Account ending balances 
  accountEndingBalances: {[key: string]: number};
  
  // Metadata
  createdAt?: string;
}

// Ny, förenklad state-struktur - Single Source of Truth
export interface BudgetState {
  historicalData: { [monthKey: string]: MonthData };
  accounts: Account[];
  selectedMonthKey: string;
  selectedHistoricalMonth: string; // För historik-vyn
  
  // UI state som inte är månadsspecifik
  uiState: {
    expandedSections: { [key: string]: boolean };
    activeTab: string;
  };
  
  // Globala inställningar
  accountCategories: string[];
  accountCategoryMapping: {[accountName: string]: string};
  budgetTemplates: {[key: string]: any};
  
  // Chart settings
  chartSettings: {
    selectedAccountsForChart: string[];
    showIndividualCostsOutsideBudget: boolean;
    showSavingsSeparately: boolean;
    useCustomTimeRange: boolean;
    chartStartMonth: string;
    chartEndMonth: string;
    balanceType: 'starting' | 'closing';
    showEstimatedBudgetAmounts: boolean;
  };
}

// Legacy interface för bakåtkompatibilitet under övergången
export interface RawDataState {
  // Income data
  andreasSalary: number;
  andreasförsäkringskassan: number;
  andreasbarnbidrag: number;
  susannaSalary: number;
  susannaförsäkringskassan: number;
  susannabarnbidrag: number;
  
  // Budget groups
  costGroups: BudgetGroup[];
  savingsGroups: BudgetGroup[];
  
  // Transfer data
  dailyTransfer: number;
  weekendTransfer: number;
  
  // Holiday data
  customHolidays: {date: string, name: string}[];
  
  // Personal budgets
  andreasPersonalCosts: BudgetGroup[];
  andreasPersonalSavings: BudgetGroup[];
  susannaPersonalCosts: BudgetGroup[];
  susannaPersonalSavings: BudgetGroup[];
  
  // Account data
  accounts: string[];
  accountBalances: {[key: string]: number};
  accountBalancesSet: {[key: string]: boolean};
  accountEstimatedFinalBalances: {[key: string]: number};
  accountEstimatedFinalBalancesSet: {[key: string]: boolean};
  accountEstimatedStartBalances: {[key: string]: number};
  accountStartBalancesSet: {[key: string]: boolean};
  accountEndBalancesSet: {[key: string]: boolean};
  
  // Category data
  accountCategories: string[];
  accountCategoryMapping: {[accountName: string]: string};
  
  // Template data
  budgetTemplates: {[key: string]: any};
  
  // Historical data
  monthlyBudgets: {[monthKey: string]: any};
  historicalData: {[key: string]: any};
  
  // UI state
  selectedBudgetMonth: string;
  selectedHistoricalMonth: string;
  
  // User data
  userName1: string;
  userName2: string;
  
  // Transfer completion state
  transferChecks: {[key: string]: boolean};
  andreasShareChecked: boolean;
  susannaShareChecked: boolean;
  
  // Chart settings
  selectedAccountsForChart: string[];
  showIndividualCostsOutsideBudget: boolean;
  showSavingsSeparately: boolean;
  useCustomTimeRange: boolean;
  chartStartMonth: string;
  chartEndMonth: string;
  balanceType: 'starting' | 'closing';
  showEstimatedBudgetAmounts: boolean;
  
  // Month completion flags
  monthFinalBalances: {[key: string]: boolean};
}

export interface CalculatedState {
  results: BudgetResults | null;
  fullPrognosis: any;
}