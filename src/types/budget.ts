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