// Migration layer - Gradual transition to Single Source of Truth
import {
  initializeBudgetState,
  getBudgetState,
  subscribeToStateChanges,
  unsubscribeFromStateChanges,
  updateCostGroupsForMonth,
  updateSavingsGroupsForMonth,
  updateSalaryForMonth,
  updateTransferForMonth,
  updateSelectedMonth,
  updateAccounts,
  setCostGroups as newSetCostGroups,
  setSavingsGroups as newSetSavingsGroups,
  setAndreasSalary as newSetAndreasSalary,
  setSusannaSalary as newSetSusannaSalary,
  setDailyTransfer as newSetDailyTransfer,
  setWeekendTransfer as newSetWeekendTransfer
} from './state/budgetState';
import { BudgetGroup, Account, MonthData } from './types/budget';
import { StorageKey } from './services/storageService';

// ===== TRANSITION LAYER =====
// This file gradually migrates from old state management to new Single Source of Truth

// Initialize the application
export function initializeApp(): void {
  console.log('🚀 Initializing app with Single Source of Truth');
  initializeBudgetState();
}

// Get current state (adapted for legacy compatibility)
export function getCurrentState() {
  const { budgetState, calculatedState } = getBudgetState();
  
  // Get current month data
  const currentMonthData = budgetState.historicalData[budgetState.selectedMonthKey] || createEmptyMonthData();
  
  // Create legacy-compatible rawData structure
  const rawData = {
    // From current month
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
    andreasPersonalCosts: currentMonthData.andreasPersonalCosts,
    andreasPersonalSavings: currentMonthData.andreasPersonalSavings,
    susannaPersonalCosts: currentMonthData.susannaPersonalCosts,
    susannaPersonalSavings: currentMonthData.susannaPersonalSavings,
    accountBalances: currentMonthData.accountBalances,
    accountBalancesSet: currentMonthData.accountBalancesSet,
    accountEstimatedFinalBalances: currentMonthData.accountEstimatedFinalBalances,
    accountEstimatedFinalBalancesSet: currentMonthData.accountEstimatedFinalBalancesSet,
    accountEstimatedStartBalances: currentMonthData.accountEstimatedStartBalances,
    accountStartBalancesSet: currentMonthData.accountStartBalancesSet,
    accountEndBalancesSet: currentMonthData.accountEndBalancesSet,
    userName1: currentMonthData.userName1,
    userName2: currentMonthData.userName2,
    transferChecks: currentMonthData.transferChecks,
    
    // From global state
    accounts: budgetState.accounts.map(acc => acc.name), // Convert to strings for compatibility
    historicalData: budgetState.historicalData,
    selectedBudgetMonth: budgetState.selectedMonthKey,
    selectedHistoricalMonth: budgetState.selectedHistoricalMonth,
    accountCategories: budgetState.accountCategories,
    accountCategoryMapping: budgetState.accountCategoryMapping,
    budgetTemplates: budgetState.budgetTemplates,
    
    // Chart settings
    selectedAccountsForChart: budgetState.chartSettings.selectedAccountsForChart,
    showIndividualCostsOutsideBudget: budgetState.chartSettings.showIndividualCostsOutsideBudget,
    showSavingsSeparately: budgetState.chartSettings.showSavingsSeparately,
    useCustomTimeRange: budgetState.chartSettings.useCustomTimeRange,
    chartStartMonth: budgetState.chartSettings.chartStartMonth,
    chartEndMonth: budgetState.chartSettings.chartEndMonth,
    balanceType: budgetState.chartSettings.balanceType,
    showEstimatedBudgetAmounts: budgetState.chartSettings.showEstimatedBudgetAmounts
  };
  
  return {
    rawData,
    calculated: calculatedState
  };
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
    andreasPersonalCosts: 0,
    andreasPersonalSavings: 0,
    susannaPersonalCosts: 0,
    susannaPersonalSavings: 0,
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
    accountEndingBalances: {},
    createdAt: new Date().toISOString()
  };
}

// ===== STATE SUBSCRIPTION =====
export { subscribeToStateChanges, unsubscribeFromStateChanges };

// ===== SIMPLIFIED UPDATE FUNCTIONS =====
// These now use the Single Source of Truth pattern

export function setCostGroups(value: BudgetGroup[]): void {
  newSetCostGroups(value);
}

export function setSavingsGroups(value: BudgetGroup[]): void {
  newSetSavingsGroups(value);
}

export function setAndreasSalary(value: number): void {
  newSetAndreasSalary(value);
}

export function setAndreasförsäkringskassan(value: number): void {
  const { budgetState } = getBudgetState();
  updateSalaryForMonth('andreasförsäkringskassan', value, budgetState.selectedMonthKey);
}

export function setAndreasbarnbidrag(value: number): void {
  const { budgetState } = getBudgetState();
  updateSalaryForMonth('andreasbarnbidrag', value, budgetState.selectedMonthKey);
}

export function setSusannaSalary(value: number): void {
  newSetSusannaSalary(value);
}

export function setSusannaförsäkringskassan(value: number): void {
  const { budgetState } = getBudgetState();
  updateSalaryForMonth('susannaförsäkringskassan', value, budgetState.selectedMonthKey);
}

export function setSusannabarnbidrag(value: number): void {
  const { budgetState } = getBudgetState();
  updateSalaryForMonth('susannabarnbidrag', value, budgetState.selectedMonthKey);
}

export function setDailyTransfer(value: number): void {
  newSetDailyTransfer(value);
}

export function setWeekendTransfer(value: number): void {
  newSetWeekendTransfer(value);
}

export function setSelectedBudgetMonth(monthKey: string): void {
  updateSelectedMonth(monthKey);
}

export function setAccounts(accounts: Account[]): void {
  updateAccounts(accounts);
}

// ===== LEGACY COMPATIBILITY FUNCTIONS =====
// These provide backwards compatibility while migration is ongoing

export function handleManualValueChange(key: StorageKey, value: any, field: string, shouldSave: boolean = true): void {
  console.log(`🔄 Legacy handleManualValueChange called for ${field}`);
  // For now, these operations are handled by the specific setter functions above
}

export function updateCostGroups(value: BudgetGroup[]): void {
  setCostGroups(value);
}

export function updateSavingsGroups(value: BudgetGroup[]): void {
  setSavingsGroups(value);
}

export function updateAccountBalance(accountName: string, balance: number): void {
  const { budgetState } = getBudgetState();
  const currentMonth = budgetState.selectedMonthKey;
  
  if (budgetState.historicalData[currentMonth]) {
    budgetState.historicalData[currentMonth].accountBalances[accountName] = balance;
    budgetState.historicalData[currentMonth].accountBalancesSet[accountName] = true;
  }
}

export function updateSelectedBudgetMonth(monthKey: string): void {
  setSelectedBudgetMonth(monthKey);
}

export function updateHistoricalData(historicalData: any): void {
  const { budgetState } = getBudgetState();
  budgetState.historicalData = historicalData;
}

export function forceRecalculation(): void {
  // Calculations are automatic in the new system
  console.log('🔄 Force recalculation called (automatic in new system)');
}

export function setCustomHolidays(holidays: Array<{date: string, name: string}>): void {
  const { budgetState } = getBudgetState();
  const currentMonth = budgetState.selectedMonthKey;
  
  if (budgetState.historicalData[currentMonth]) {
    budgetState.historicalData[currentMonth].customHolidays = holidays;
  }
}

export function setAndreasPersonalCosts(value: number): void {
  const { budgetState } = getBudgetState();
  const currentMonth = budgetState.selectedMonthKey;
  
  if (budgetState.historicalData[currentMonth]) {
    budgetState.historicalData[currentMonth].andreasPersonalCosts = value;
  }
}

export function setAndreasPersonalSavings(value: number): void {
  const { budgetState } = getBudgetState();
  const currentMonth = budgetState.selectedMonthKey;
  
  if (budgetState.historicalData[currentMonth]) {
    budgetState.historicalData[currentMonth].andreasPersonalSavings = value;
  }
}

export function setSusannaPersonalCosts(value: number): void {
  const { budgetState } = getBudgetState();
  const currentMonth = budgetState.selectedMonthKey;
  
  if (budgetState.historicalData[currentMonth]) {
    budgetState.historicalData[currentMonth].susannaPersonalCosts = value;
  }
}

export function setSusannaPersonalSavings(value: number): void {
  const { budgetState } = getBudgetState();
  const currentMonth = budgetState.selectedMonthKey;
  
  if (budgetState.historicalData[currentMonth]) {
    budgetState.historicalData[currentMonth].susannaPersonalSavings = value;
  }
}

// ===== PLACEHOLDER FUNCTIONS =====
// These are used by components but will be gradually migrated

export function updateHistoricalDataSingle(key: string, data: any): void {
  console.log(`📝 updateHistoricalDataSingle called for ${key}`);
}

export function setResults(results: any): void {
  console.log('📊 setResults called (handled automatically)');
}

export function setHistoricalData(data: any): void {
  console.log('📚 setHistoricalData called');
}

export function setAccountBalances(balances: {[key: string]: number}): void {
  console.log('💰 setAccountBalances called');
}

export function setAccountBalancesSet(balancesSet: {[key: string]: boolean}): void {
  console.log('✅ setAccountBalancesSet called');
}

export function setAccountEstimatedFinalBalances(balances: {[key: string]: number}): void {
  console.log('💰 setAccountEstimatedFinalBalances called');
}

export function setAccountEstimatedFinalBalancesSet(balancesSet: {[key: string]: boolean}): void {
  console.log('✅ setAccountEstimatedFinalBalancesSet called');
}

export function setAccountEstimatedStartBalances(balances: {[key: string]: number}): void {
  console.log('💰 setAccountEstimatedStartBalances called');
}

export function setAccountStartBalancesSet(balancesSet: {[key: string]: boolean}): void {
  console.log('✅ setAccountStartBalancesSet called');
}

export function setAccountEndBalancesSet(balancesSet: {[key: string]: boolean}): void {
  console.log('✅ setAccountEndBalancesSet called');
}

export function setMonthFinalBalances(balances: {[key: string]: boolean}): void {
  console.log('🏁 setMonthFinalBalances called');
}

export function setSelectedHistoricalMonth(monthKey: string): void {
  const { budgetState } = getBudgetState();
  budgetState.selectedHistoricalMonth = monthKey;
}

export function runCalculationsAndUpdateState(): void {
  console.log('🧮 runCalculationsAndUpdateState called (automatic in new system)');
}

console.log('✅ App Orchestrator loaded with Single Source of Truth migration layer');