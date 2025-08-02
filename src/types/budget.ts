// Definierar alla typer som används i appen.

export interface Transaction {
  id: string; // Ett unikt ID, t.ex. från bankens referens + datum
  accountId: string; // Vilket av våra konton den tillhör
  date: string;
  bankCategory: string; // Bankens ursprungliga kategori
  bankSubCategory: string;
  description: string; // Bankens text
  userDescription: string; // Användarens egna text/notering
  amount: number; // Originalbelopp från banken, ändras aldrig
  balanceAfter: number; // Saldo efter transaktion
  status: 'red' | 'yellow' | 'green'; // Röd=kräver åtgärd, Gul=automatisk, Grön=godkänd
  type: 'Transaction' | 'InternalTransfer' | 'Savings' | 'CostCoverage' | 'ExpenseClaim';
  appCategoryId?: string; // Koppling till vår egen kategori
  appSubCategoryId?: string;
  linkedTransactionId?: string; // För att para ihop överföringar
  correctedAmount?: number; // För "Täck en kostnad"-logiken
  savingsTargetId?: string; // ID för kopplat sparmål eller sparkategori
  isManuallyChanged?: boolean; // Håller reda på om användaren gjort en ändring
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

export interface Account {
  id: string;
  name: string;
  startBalance: number;
  bankTemplateId?: string; // Koppling till bankmall
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
  // Salary information
  andreasSalary: number;
  andreasförsäkringskassan: number;
  andreasbarnbidrag: number;
  susannaSalary: number;
  susannaförsäkringskassan: number;
  susannabarnbidrag: number;
  
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

// Ny, förenklad state-struktur - Single Source of Truth
export interface BudgetState {
  historicalData: { [monthKey: string]: MonthData };
  accounts: Account[];
  savingsGoals: SavingsGoal[]; // NYTT FÄLT
  selectedMonthKey: string;
  selectedHistoricalMonth: string; // För historik-vyn
  
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
  
  // Transaction import state
  transactionImport: {
    categoryRules: any[];
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