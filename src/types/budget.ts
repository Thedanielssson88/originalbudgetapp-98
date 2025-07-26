// Type definitions for the budget application

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

export interface Holiday {
  date: string;
  name: string;
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

export interface MonthlyData {
  // Income data
  andreasSalary?: number;
  andreasForsakringskassan?: number;
  andreasBarnbidrag?: number;
  susannaSalary?: number;
  susannaForsakringskassan?: number;
  susannaBarnbidrag?: number;
  
  // Budget categories
  costGroups?: BudgetGroup[];
  savingsGroups?: BudgetGroup[];
  
  // Transfer settings
  dailyTransfer?: number;
  weekendTransfer?: number;
  transferAccount?: number;
  
  // Personal budgets
  andreasPersonalCosts?: BudgetGroup[];
  andreasPersonalSavings?: BudgetGroup[];
  susannaPersonalCosts?: BudgetGroup[];
  susannaPersonalSavings?: BudgetGroup[];
  
  // Account balances
  accountBalances?: {[key: string]: number};
  accountBalancesSet?: {[key: string]: boolean};
  accountEstimatedFinalBalances?: {[key: string]: number};
  accountEstimatedFinalBalancesSet?: {[key: string]: boolean};
  accountEstimatedStartBalances?: {[key: string]: number};
  accountStartBalancesSet?: {[key: string]: boolean};
  accountEndBalancesSet?: {[key: string]: boolean};
  accountEndingBalances?: {[key: string]: number};
  
  // Transfer completion
  transferChecks?: {[key: string]: boolean};
  andreasShareChecked?: boolean;
  susannaShareChecked?: boolean;
  
  // Calculated results
  results?: BudgetResults;
  
  // Month completion flags
  monthFinalBalances?: {[key: string]: boolean};
}

export interface RawDataState {
  // Basic income settings
  andreasSalary: number;
  andreasForsakringskassan: number;
  andreasBarnbidrag: number;
  susannaSalary: number;
  susannaForsakringskassan: number;
  susannaBarnbidrag: number;
  
  // Budget categories
  costGroups: BudgetGroup[];
  savingsGroups: BudgetGroup[];
  
  // Transfer settings
  dailyTransfer: number;
  weekendTransfer: number;
  transferAccount: number;
  
  // Holidays
  customHolidays: Holiday[];
  
  // Monthly historical data
  historicalData: {[monthKey: string]: MonthlyData};
  
  // Accounts and categories
  accounts: string[];
  accountCategories: string[];
  accountCategoryMapping: {[accountName: string]: string};
  
  // Personal budgets
  andreasPersonalCosts: BudgetGroup[];
  andreasPersonalSavings: BudgetGroup[];
  susannaPersonalCosts: BudgetGroup[];
  susannaPersonalSavings: BudgetGroup[];
  
  // Budget templates
  budgetTemplates: {[key: string]: any};
  
  // User settings
  userName1: string;
  userName2: string;
  
  // Global transfer completion tracking
  transferChecks: {[key: string]: boolean};
  andreasShareChecked: boolean;
  susannaShareChecked: boolean;
  
  // Chart preferences
  selectedAccountsForChart: string[];
  showIndividualCostsOutsideBudget: boolean;
  showSavingsSeparately: boolean;
  showEstimatedBudgetAmounts: boolean;
  balanceType: 'starting' | 'closing';
  
  // UI state
  expandedSections: {[key: string]: boolean};
  expandedBudgetCategories: {[key: string]: boolean};
  expandedAccounts: {[key: string]: boolean};
  expandedTemplates: {[key: string]: boolean};
  
  // Chart settings
  useCustomTimeRange: boolean;
  chartStartMonth: string;
  chartEndMonth: string;
}

export interface CalculatedState {
  monthlyResults: {[monthKey: string]: BudgetResults};
  accountSummaries: {[monthKey: string]: {[accountName: string]: number}};
  chartData: any[];
  accountDataRows: any[];
}

export interface AppState {
  rawData: RawDataState;
  calculated: CalculatedState;
}

export interface AccountDataRow {
  year: number;
  month: string;
  monthKey: string;
  account: string;
  calcKontosaldo: number;
  calcDescr: string;
}