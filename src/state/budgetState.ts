// Single Source of Truth state management
import { BudgetState, MonthData, Account, BudgetGroup, CalculatedState } from '@/types/budget';
import { calculateBudgetResults, calculateFullPrognosis } from '@/services/calculationService';
import { get, set, StorageKey } from '@/services/storageService';

// Global state - Single Source of Truth
let budgetState: BudgetState = {
  historicalData: {},
  accounts: [],
  selectedMonthKey: '',
  selectedHistoricalMonth: '',
  uiState: {
    expandedSections: {},
    activeTab: 'inkomster'
  },
  accountCategories: ['Privat', 'Gemensam', 'Sparande', 'Hushåll'],
  accountCategoryMapping: {},
  budgetTemplates: {},
  chartSettings: {
    selectedAccountsForChart: [],
    showIndividualCostsOutsideBudget: false,
    showSavingsSeparately: false,
    useCustomTimeRange: false,
    chartStartMonth: '',
    chartEndMonth: '',
    balanceType: 'closing',
    showEstimatedBudgetAmounts: false
  }
};

// Calculated state
let calculatedState: CalculatedState = {
  results: null,
  fullPrognosis: null
};

// Subscribers for state changes
let subscribers: (() => void)[] = [];

// Utility function to get current month data (or create empty if not exists)
function getCurrentMonthData(): MonthData {
  const currentMonth = budgetState.selectedMonthKey;
  if (!currentMonth) {
    throw new Error('No selected month key');
  }
  
  if (!budgetState.historicalData[currentMonth]) {
    // Create empty month data structure
    budgetState.historicalData[currentMonth] = createEmptyMonthData();
  }
  
  return budgetState.historicalData[currentMonth];
}

function createEmptyMonthData(): MonthData {
  return {
    andreasSalary: 0,
    andreasförsäkringskassan: 0,
    andreasbarnbidrag: 0,
    susannaSalary: 0,
    susannaförsäkringskassan: 0,
    susannabarnbidrag: 0,
    costGroups: [],
    savingsGroups: [],
    dailyTransfer: 0,
    weekendTransfer: 0,
    transferAccount: 0,
    andreasPersonalCosts: [],
    andreasPersonalSavings: [],
    susannaPersonalCosts: [],
    susannaPersonalSavings: [],
    customHolidays: [],
    accountBalances: {},
    accountBalancesSet: {},
    accountEstimatedFinalBalances: {},
    accountEstimatedFinalBalancesSet: {},
    accountEstimatedStartBalances: {},
    accountStartBalancesSet: {},
    accountEndBalancesSet: {},
    userName1: 'Andreas',
    userName2: 'Susanna',
    transferChecks: {},
    andreasShareChecked: false,
    susannaShareChecked: false,
    monthFinalBalances: {},
    createdAt: new Date().toISOString()
  };
}

// Initialize from storage
export function initializeBudgetState(): void {
  try {
    // Load from new format first
    const savedBudgetState = get<BudgetState>(StorageKey.BUDGET_CALCULATOR_DATA);
    
    if (savedBudgetState && savedBudgetState.historicalData) {
      budgetState = { ...budgetState, ...savedBudgetState };
    } else {
      // Migration from old format
      const legacyData = get<any>(StorageKey.BUDGET_CALCULATOR_DATA);
      if (legacyData) {
        budgetState = migrateLegacyData(legacyData);
      }
    }
    
    // Set default selected month if none set
    if (!budgetState.selectedMonthKey) {
      const today = new Date();
      budgetState.selectedMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
    
    // Ensure current month exists
    getCurrentMonthData();
    
    console.log('✅ Budget state initialized successfully');
    runCalculationsAndNotify();
    
  } catch (error) {
    console.error('❌ Failed to initialize budget state:', error);
    // Initialize with default state
    const today = new Date();
    budgetState.selectedMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    getCurrentMonthData();
  }
}

// Migrate legacy data to new format
function migrateLegacyData(legacyData: any): BudgetState {
  console.log('🔄 Migrating legacy data to new format');
  
  const newState: BudgetState = {
    ...budgetState,
    accounts: legacyData.accounts || [],
    selectedMonthKey: legacyData.selectedBudgetMonth || budgetState.selectedMonthKey,
    selectedHistoricalMonth: legacyData.selectedHistoricalMonth || '',
    accountCategories: legacyData.accountCategories || budgetState.accountCategories,
    accountCategoryMapping: legacyData.accountCategoryMapping || {},
    budgetTemplates: legacyData.budgetTemplates || {},
    historicalData: {}
  };
  
  // Migrate historical data
  if (legacyData.historicalData) {
    newState.historicalData = legacyData.historicalData;
  }
  
  // Create current month from legacy top-level data
  if (newState.selectedMonthKey) {
    newState.historicalData[newState.selectedMonthKey] = {
      andreasSalary: legacyData.andreasSalary || 0,
      andreasförsäkringskassan: legacyData.andreasförsäkringskassan || 0,
      andreasbarnbidrag: legacyData.andreasbarnbidrag || 0,
      susannaSalary: legacyData.susannaSalary || 0,
      susannaförsäkringskassan: legacyData.susannaförsäkringskassan || 0,
      susannabarnbidrag: legacyData.susannabarnbidrag || 0,
      costGroups: legacyData.costGroups || [],
      savingsGroups: legacyData.savingsGroups || [],
      dailyTransfer: legacyData.dailyTransfer || 0,
      weekendTransfer: legacyData.weekendTransfer || 0,
      transferAccount: 0,
      andreasPersonalCosts: legacyData.andreasPersonalCosts || [],
      andreasPersonalSavings: legacyData.andreasPersonalSavings || [],
      susannaPersonalCosts: legacyData.susannaPersonalCosts || [],
      susannaPersonalSavings: legacyData.susannaPersonalSavings || [],
      customHolidays: legacyData.customHolidays || [],
      accountBalances: legacyData.accountBalances || {},
      accountBalancesSet: legacyData.accountBalancesSet || {},
      accountEstimatedFinalBalances: legacyData.accountEstimatedFinalBalances || {},
      accountEstimatedFinalBalancesSet: legacyData.accountEstimatedFinalBalancesSet || {},
      accountEstimatedStartBalances: legacyData.accountEstimatedStartBalances || {},
      accountStartBalancesSet: legacyData.accountStartBalancesSet || {},
      accountEndBalancesSet: legacyData.accountEndBalancesSet || {},
      userName1: legacyData.userName1 || 'Andreas',
      userName2: legacyData.userName2 || 'Susanna',
      transferChecks: legacyData.transferChecks || {},
      andreasShareChecked: legacyData.andreasShareChecked || false,
      susannaShareChecked: legacyData.susannaShareChecked || false,
      monthFinalBalances: legacyData.monthFinalBalances || {},
      createdAt: new Date().toISOString()
    };
  }
  
  return newState;
}

// Save state to storage
export function saveBudgetStateToStorage(): void {
  try {
    set(StorageKey.BUDGET_CALCULATOR_DATA, budgetState);
    console.log('💾 Budget state saved to storage');
  } catch (error) {
    console.error('❌ Failed to save budget state:', error);
  }
}

// Get current state
export function getBudgetState(): { budgetState: BudgetState; calculatedState: CalculatedState } {
  return { budgetState: { ...budgetState }, calculatedState: { ...calculatedState } };
}

// Subscribe to state changes
export function subscribeToStateChanges(callback: () => void): void {
  subscribers.push(callback);
}

// Unsubscribe from state changes
export function unsubscribeFromStateChanges(callback: () => void): void {
  subscribers = subscribers.filter(sub => sub !== callback);
}

// Notify all subscribers
function notifySubscribers(): void {
  subscribers.forEach(callback => {
    try {
      callback();
    } catch (error) {
      console.error('❌ Error in state change subscriber:', error);
    }
  });
}

// Run calculations and notify
function runCalculationsAndNotify(): void {
  try {
    const currentMonthData = getCurrentMonthData();
    
    // Calculate results for current month
    // Create a temporary rawData object for backwards compatibility
    const tempRawData = {
      andreasSalary: currentMonthData.andreasSalary,
      andreasförsäkringskassan: currentMonthData.andreasförsäkringskassan,
      andreasbarnbidrag: currentMonthData.andreasbarnbidrag,
      susannaSalary: currentMonthData.susannaSalary,
      susannaförsäkringskassan: currentMonthData.susannaförsäkringskassan,
      susannabarnbidrag: currentMonthData.susannabarnbidrag,
      costGroups: currentMonthData.costGroups,
      savingsGroups: currentMonthData.savingsGroups,
      dailyTransfer: currentMonthData.dailyTransfer,
      weekendTransfer: currentMonthData.weekendTransfer,
      customHolidays: currentMonthData.customHolidays,
      // Add other required fields
      andreasPersonalCosts: currentMonthData.andreasPersonalCosts,
      andreasPersonalSavings: currentMonthData.andreasPersonalSavings,
      susannaPersonalCosts: currentMonthData.susannaPersonalCosts,
      susannaPersonalSavings: currentMonthData.susannaPersonalSavings,
      accounts: budgetState.accounts.map(acc => acc.name),
      accountBalances: currentMonthData.accountBalances,
      accountBalancesSet: currentMonthData.accountBalancesSet,
      accountEstimatedFinalBalances: currentMonthData.accountEstimatedFinalBalances,
      accountEstimatedFinalBalancesSet: currentMonthData.accountEstimatedFinalBalancesSet,
      accountEstimatedStartBalances: currentMonthData.accountEstimatedStartBalances,
      accountStartBalancesSet: currentMonthData.accountStartBalancesSet,
      accountEndBalancesSet: currentMonthData.accountEndBalancesSet,
      accountCategories: budgetState.accountCategories,
      accountCategoryMapping: budgetState.accountCategoryMapping,
      budgetTemplates: budgetState.budgetTemplates,
      monthlyBudgets: {},
      historicalData: budgetState.historicalData,
      selectedBudgetMonth: budgetState.selectedMonthKey,
      selectedHistoricalMonth: budgetState.selectedHistoricalMonth,
      userName1: currentMonthData.userName1,
      userName2: currentMonthData.userName2,
      transferChecks: currentMonthData.transferChecks,
      andreasShareChecked: currentMonthData.andreasShareChecked,
      susannaShareChecked: currentMonthData.susannaShareChecked,
      selectedAccountsForChart: budgetState.chartSettings.selectedAccountsForChart,
      showIndividualCostsOutsideBudget: budgetState.chartSettings.showIndividualCostsOutsideBudget,
      showSavingsSeparately: budgetState.chartSettings.showSavingsSeparately,
      useCustomTimeRange: budgetState.chartSettings.useCustomTimeRange,
      chartStartMonth: budgetState.chartSettings.chartStartMonth,
      chartEndMonth: budgetState.chartSettings.chartEndMonth,
      balanceType: budgetState.chartSettings.balanceType,
      showEstimatedBudgetAmounts: budgetState.chartSettings.showEstimatedBudgetAmounts,
      monthFinalBalances: currentMonthData.monthFinalBalances
    } as any;
    
    calculatedState.results = calculateBudgetResults(tempRawData);
    
    // Calculate full prognosis
    calculatedState.fullPrognosis = calculateFullPrognosis(tempRawData);
    
    console.log('🧮 Calculations completed');
    
  } catch (error) {
    console.error('❌ Calculation error:', error);
    calculatedState.results = null;
    calculatedState.fullPrognosis = null;
  }
  
  saveBudgetStateToStorage();
  notifySubscribers();
}

// UPDATE FUNCTIONS - Single Source of Truth

export function updateCostGroupsForMonth(newCostGroups: BudgetGroup[], monthKey: string): void {
  if (!budgetState.historicalData[monthKey]) {
    budgetState.historicalData[monthKey] = createEmptyMonthData();
  }
  
  budgetState.historicalData[monthKey].costGroups = newCostGroups;
  runCalculationsAndNotify();
}

export function updateSavingsGroupsForMonth(newSavingsGroups: BudgetGroup[], monthKey: string): void {
  if (!budgetState.historicalData[monthKey]) {
    budgetState.historicalData[monthKey] = createEmptyMonthData();
  }
  
  budgetState.historicalData[monthKey].savingsGroups = newSavingsGroups;
  runCalculationsAndNotify();
}

export function updateSalaryForMonth(
  field: 'andreasSalary' | 'andreasförsäkringskassan' | 'andreasbarnbidrag' | 'susannaSalary' | 'susannaförsäkringskassan' | 'susannabarnbidrag',
  value: number,
  monthKey: string
): void {
  if (!budgetState.historicalData[monthKey]) {
    budgetState.historicalData[monthKey] = createEmptyMonthData();
  }
  
  budgetState.historicalData[monthKey][field] = value;
  runCalculationsAndNotify();
}

export function updateTransferForMonth(field: 'dailyTransfer' | 'weekendTransfer', value: number, monthKey: string): void {
  if (!budgetState.historicalData[monthKey]) {
    budgetState.historicalData[monthKey] = createEmptyMonthData();
  }
  
  budgetState.historicalData[monthKey][field] = value;
  runCalculationsAndNotify();
}

export function updateSelectedMonth(monthKey: string): void {
  budgetState.selectedMonthKey = monthKey;
  
  // Ensure the month exists
  getCurrentMonthData();
  
  runCalculationsAndNotify();
}

export function updateAccounts(newAccounts: Account[]): void {
  budgetState.accounts = newAccounts;
  runCalculationsAndNotify();
}

// Helper function for current month operations (backwards compatibility)
export function setCostGroups(value: BudgetGroup[]): void {
  updateCostGroupsForMonth(value, budgetState.selectedMonthKey);
}

export function setSavingsGroups(value: BudgetGroup[]): void {
  updateSavingsGroupsForMonth(value, budgetState.selectedMonthKey);
}

export function setAndreasSalary(value: number): void {
  updateSalaryForMonth('andreasSalary', value, budgetState.selectedMonthKey);
}

export function setSusannaSalary(value: number): void {
  updateSalaryForMonth('susannaSalary', value, budgetState.selectedMonthKey);
}

export function setDailyTransfer(value: number): void {
  updateTransferForMonth('dailyTransfer', value, budgetState.selectedMonthKey);
}

export function setWeekendTransfer(value: number): void {
  updateTransferForMonth('weekendTransfer', value, budgetState.selectedMonthKey);
}