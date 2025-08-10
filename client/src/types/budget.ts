// Definierar alla typer som används i appen.

// Import Account type from shared schema
export type { Account } from '@shared/schema';

export interface Transaction {
  id: string; // Ett unikt ID, t.ex. från bankens referens + datum
  accountId: string; // Vilket av våra konton den tillhör
  date: string;
  bankCategory?: string; // Bankens ursprungliga kategori (OPTIONAL för bakåtkompatibilitet)
  bankSubCategory?: string; // Bankens underkategori (OPTIONAL för bakåtkompatibilitet)
  description: string; // Bankens text
  userDescription: string; // Användarens egna text/notering
  amount: number; // Originalbelopp från banken, ändras aldrig
  balanceAfter: number; // Saldo efter transaktion
  status: 'red' | 'yellow' | 'green'; // Röd=kräver åtgärd, Gul=automatisk, Grön=godkänd
  type: 'Transaction' | 'InternalTransfer' | 'Savings' | 'CostCoverage' | 'ExpenseClaim' | 'Inkomst';
  appCategoryId?: string; // Koppling till vår egen kategori
  appSubCategoryId?: string;
  linkedTransactionId?: string; // För att para ihop överföringar
  correctedAmount?: number; // För "Täck en kostnad"-logiken
  savingsTargetId?: string; // ID för kopplat sparmål eller sparkategori
  incomeTargetId?: string; // ID för kopplad inkomst budget post
  isManuallyChanged?: boolean; // Håller reda på om användaren gjort en ändring
}

// Nya reglerdefinitioner för kategorisering
export type RuleCondition = 
  | { type: 'textContains'; value: string }
  | { type: 'textStartsWith'; value: string }
  | { type: 'exactText'; value: string }
  | { type: 'categoryMatch'; bankCategory: string; bankSubCategory?: string };

export interface CategoryRule {
  id: string; // UUID
  priority: number; // För att kunna sortera (textregler får högre prioritet)
  condition: RuleCondition;
  action: {
    appMainCategoryId: string;
    appSubCategoryId?: string;
    positiveTransactionType: 'Transaction' | 'InternalTransfer' | 'Savings' | 'CostCoverage'; // För positiva belopp
    negativeTransactionType: 'Transaction' | 'InternalTransfer' | 'ExpenseClaim'; // För negativa belopp
    applicableAccountIds?: string[]; // Vilka konton regeln gäller för (tom array = alla konton)
    autoApproval?: boolean; // Auto-approve transactions when rule is applied
  };
  transactionDirection?: 'all' | 'positive' | 'negative'; // Filter för transaktionsriktning
  // NEW: Bank category filters for rule conditions
  bankhuvudkategori?: string | null; // Filter by bank main category (null = "Alla Bankkategorier")
  bankunderkategori?: string | null; // Filter by bank subcategory (null = "Alla Bankunderkategorier")
  isActive: boolean; // Om regeln är aktiv eller inte
}

// Detta representerar nu en enskild budgetpost (både kostnad och sparande)
export interface BudgetItem {
  id: string; // Unikt ID för just denna budgetpost
  mainCategoryId: string; // ID som kopplar till en post i master-listan
  subCategoryId: string; // ID som kopplar till en post i master-listan
  description: string; // Användarens egna beskrivning för posten
  amount: number;
  accountId?: string; // ID som kopplar till ett konto i master-listan
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
  
  // Nya fält för dagliga överföringar
  transferType?: 'monthly' | 'daily'; // Typ av överföring (default: 'monthly')
  dailyAmount?: number; // Belopp per dag för dagliga överföringar
  transferDays?: number[]; // Dagar då överföring sker (0=Sön, 1=Mån, ..., 6=Lör)
}

// Legacy interface för bakåtkompatibilitet
export interface SubCategory {
  id: string;
  name: string;
  amount: number;
  accountId?: string; // KONSISTENT: Använder alltid kontots ID, aldrig namn
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
  
  // Nya fält för dagliga överföringar
  transferType?: 'monthly' | 'daily'; // Typ av överföring (default: 'monthly')
  dailyAmount?: number; // Belopp per dag för dagliga överföringar
  transferDays?: number[]; // Dagar då överföring sker (0=Sön, 1=Mån, ..., 6=Lör)
}

// Legacy interface för bakåtkompatibilitet
export interface BudgetGroup {
  id: string;
  name: string;
  amount: number;
  actualAmount?: number; // NYTT FÄLT för faktiska transaktioner
  type: 'cost' | 'savings';
  subCategories?: SubCategory[];
  accountId?: string; // KONSISTENT: Använder alltid kontots ID, aldrig namn
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
}


export interface SavingsGoal {
  id: string;
  name: string;
  accountId: string; // Vilket konto sparandet sker på
  targetAmount: number;
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM
  mainCategoryId?: string; // Ny: Huvudkategori för integration med sparandesystem
  subCategoryId?: string; // Ny: Underkategori för integration med sparandesystem
}

// CategoryLink interface removed - using unified category system

export interface BudgetResults {
  totalSalary: number;
  totalDailyBudget: number;
  remainingDailyBudget: number;
  holidayDaysBudget: number;
  // balanceLeft removed - calculated on-demand with calculateBalanceLeft
  susannaShare: number;
  andreasShare: number;
  susannaPercentage: number;
  andreasPercentage: number;
  daysUntil25th: number;
  weekdayCount: number;
  fridayCount: number;
  // totalMonthlyExpenses removed - calculated on-demand with calculateTotalBudgetedCosts + calculateTotalBudgetedSavings
  holidayDays: string[];
  holidaysUntil25th: string[];
  nextTenHolidays: string[];
  remainingWeekdayCount: number;
  remainingFridayCount: number;
}

// MonthData innehåller all data för en specifik månad
export interface MonthData {
  
  // Budget groups (tidigare top-level i rawData) - LEGACY
  costGroups: BudgetGroup[];
  savingsGroups: BudgetGroup[];
  
  // Nya struktur med BudgetItem som ersätter groups
  costItems: BudgetItem[];
  savingsItems: BudgetItem[];
  
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
  // accountEndBalances and accountEndBalancesSet removed - now calculated dynamically
  
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
  
  // Transactions for this month
  transactions: Transaction[];
  
  // Metadata
  createdAt?: string;
}

// Skapa en typ för en mappningsregel
export interface CsvMapping {
  fileFingerprint: string; // Unikt "fingeravtryck" för en filtyp
  columnMapping: { [key: string]: string }; // Ex: { 'Datum': 'date', 'Belopp': 'amount' }
}

// Enhanced PlannedTransfer with support for different transfer types
export interface PlannedTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  month: string;
  description?: string;
  created: string;
  transferType: 'monthly' | 'daily'; // Fast månadsöverföring vs Daglig överföring
  // Daily transfer specific fields
  dailyAmount?: number; // Amount per day for daily transfers
  transferDays?: number[]; // Days of week (0=Sunday, 1=Monday, etc.) for daily transfers
}

export interface BudgetState {
  historicalData: { [monthKey: string]: MonthData };
  accounts: Account[];
  savingsGoals: SavingsGoal[]; // NYTT FÄLT
  plannedTransfers: PlannedTransfer[]; // NYA PLANERADE ÖVERFÖRINGAR
  selectedMonthKey: string;
  selectedHistoricalMonth: string; // För historik-vyn
  
  // CRITICAL: Central transaction storage - single source of truth
  allTransactions: Transaction[]; // All transactions across all months
  
  // UI state som inte är månadsspecifik
  uiState: {
    expandedSections: { [key: string]: boolean };
    activeTab: string;
  };
  
  // Globala inställningar
  settings: {
    payday: number; // Dagen i månaden (1-31) - default 25
  };
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
  
  // Main categories for all groups (costs, savings, transactions)
  mainCategories: string[];
  
  // Nya regelmotor för kategorisering
  categoryRules: CategoryRule[];
  
  // Transaction import state (behålls för bakåtkompatibilitet)
  transactionImport: {
    fileStructures: any[];
    importHistory: any[];
    transactions: any[];
  };
  
  // CSV mappings - permanent storage for mapping rules
  csvMappings: CsvMapping[];
  
  // Migration version to track data migrations
  migrationVersion?: number;
}

// Legacy interface för bakåtkompatibilitet under övergången
export interface RawDataState {
  
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