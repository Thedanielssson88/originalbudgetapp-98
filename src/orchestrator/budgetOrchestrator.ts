// Single Source of Truth Orchestrator - Simplified architecture

import { state, initializeStateFromStorage, saveStateToStorage, getCurrentMonthData, updateCurrentMonthData } from '../state/budgetState';
import { StorageKey } from '../services/storageService';
import { calculateFullPrognosis, calculateBudgetResults, calculateAccountProgression, calculateMonthlyBreakdowns, calculateProjectedBalances } from '../services/calculationService';
import { BudgetGroup, MonthData } from '../types/budget';

// Event system for UI updates
const eventEmitter = new EventTarget();
export const APP_STATE_UPDATED = 'appstateupdated';

function triggerUIRefresh() {
  eventEmitter.dispatchEvent(new Event(APP_STATE_UPDATED));
}

// Initialize the application
export function initializeApp(): void {
  initializeStateFromStorage();
}

// Get current state
export function getCurrentState() {
  return state;
}

// Subscribe/unsubscribe to state changes
export function subscribeToStateChanges(callback: () => void): void {
  eventEmitter.addEventListener(APP_STATE_UPDATED, callback);
}

export function unsubscribeFromStateChanges(callback: () => void): void {
  eventEmitter.removeEventListener(APP_STATE_UPDATED, callback);
}

// Main calculation and state update function
export function runCalculationsAndUpdateState(): void {
  try {
    // Create temporary rawData structure for calculations (until we refactor calculation service)
    const currentMonth = getCurrentMonthData();
    const tempRawData = {
      ...currentMonth,
      accounts: state.budgetState.accounts.map(acc => acc.name),
      historicalData: state.budgetState.historicalData,
      selectedBudgetMonth: state.budgetState.selectedMonthKey,
      selectedHistoricalMonth: state.budgetState.selectedHistoricalMonth,
      accountCategories: state.budgetState.accountCategories,
      accountCategoryMapping: state.budgetState.accountCategoryMapping,
      budgetTemplates: state.budgetState.budgetTemplates,
      monthlyBudgets: {}, // Required for RawDataState compatibility
      andreasPersonalCosts: [], // Legacy format compatibility
      andreasPersonalSavings: [],
      susannaPersonalCosts: [],
      susannaPersonalSavings: [],
      ...state.budgetState.chartSettings
    };
    
    // Run calculations
    const { estimatedStartBalancesByMonth, estimatedFinalBalancesByMonth } = calculateFullPrognosis(tempRawData);
    const results = calculateBudgetResults(tempRawData);
    
    // Update estimated balances in historical data
    Object.keys(estimatedStartBalancesByMonth).forEach(monthKey => {
      if (state.budgetState.historicalData[monthKey]) {
        state.budgetState.historicalData[monthKey].accountEstimatedStartBalances = estimatedStartBalancesByMonth[monthKey];
        state.budgetState.historicalData[monthKey].accountEstimatedFinalBalances = estimatedFinalBalancesByMonth[monthKey];
      }
    });
    
    // Update calculated state
    state.calculated = {
      results: results,
      fullPrognosis: {
        accountProgression: calculateAccountProgression(tempRawData),
        monthlyBreakdowns: calculateMonthlyBreakdowns(tempRawData),
        projectedBalances: calculateProjectedBalances(tempRawData)
      }
    };
    
    // Save and trigger UI update
    saveStateToStorage();
    triggerUIRefresh();
  } catch (error) {
    console.error('[BudgetOrchestrator] Error in calculations:', error);
  }
}

// Helper function for updating data
function updateAndRecalculate(updates: Partial<MonthData>): void {
  updateCurrentMonthData(updates);
  runCalculationsAndUpdateState();
}

// ===== DATA UPDATE FUNCTIONS =====
// These functions now only write to historicalData[selectedMonthKey]

export function updateCostGroups(value: BudgetGroup[]): void {
  updateAndRecalculate({ costGroups: value });
}

export function updateSavingsGroups(value: BudgetGroup[]): void {
  updateAndRecalculate({ savingsGroups: value });
}

export function setAndreasSalary(value: number): void {
  updateAndRecalculate({ andreasSalary: value });
}

export function setAndreasförsäkringskassan(value: number): void {
  updateAndRecalculate({ andreasförsäkringskassan: value });
}

export function setAndreasbarnbidrag(value: number): void {
  updateAndRecalculate({ andreasbarnbidrag: value });
}

export function setSusannaSalary(value: number): void {
  updateAndRecalculate({ susannaSalary: value });
}

export function setSusannaförsäkringskassan(value: number): void {
  updateAndRecalculate({ susannaförsäkringskassan: value });
}

export function setSusannabarnbidrag(value: number): void {
  updateAndRecalculate({ susannabarnbidrag: value });
}

export function setCostGroups(value: BudgetGroup[]): void {
  updateAndRecalculate({ costGroups: value });
}

export function setSavingsGroups(value: BudgetGroup[]): void {
  updateAndRecalculate({ savingsGroups: value });
}

export function setDailyTransfer(value: number): void {
  updateAndRecalculate({ dailyTransfer: value });
}

export function setWeekendTransfer(value: number): void {
  updateAndRecalculate({ weekendTransfer: value });
}

export function setCustomHolidays(value: {date: string, name: string}[]): void {
  updateAndRecalculate({ customHolidays: value });
}

export function setAndreasPersonalCosts(value: number): void {
  updateAndRecalculate({ andreasPersonalCosts: value });
}

export function setAndreasPersonalSavings(value: number): void {
  updateAndRecalculate({ andreasPersonalSavings: value });
}

export function setSusannaPersonalCosts(value: number): void {
  updateAndRecalculate({ susannaPersonalCosts: value });
}

export function setSusannaPersonalSavings(value: number): void {
  updateAndRecalculate({ susannaPersonalSavings: value });
}

export function setAccountBalances(value: {[key: string]: number}): void {
  updateAndRecalculate({ accountBalances: value });
}

export function setAccountBalancesSet(value: {[key: string]: boolean}): void {
  updateAndRecalculate({ accountBalancesSet: value });
}

export function updateAccountBalance(accountName: string, balance: number): void {
  const currentMonth = getCurrentMonthData();
  const newBalances = { ...currentMonth.accountBalances, [accountName]: balance };
  const newBalancesSet = { ...currentMonth.accountBalancesSet, [accountName]: true };
  
  updateAndRecalculate({ 
    accountBalances: newBalances,
    accountBalancesSet: newBalancesSet
  });
}

// ===== MONTH MANAGEMENT =====

export function setSelectedBudgetMonth(monthKey: string): void {
  state.budgetState.selectedMonthKey = monthKey;
  
  // Ensure the month exists
  if (!state.budgetState.historicalData[monthKey]) {
    state.budgetState.historicalData[monthKey] = createEmptyMonthData();
  }
  
  saveStateToStorage();
  triggerUIRefresh();
}

export function setSelectedHistoricalMonth(monthKey: string): void {
  state.budgetState.selectedHistoricalMonth = monthKey;
  saveStateToStorage();
  triggerUIRefresh();
}

// ===== GLOBAL SETTINGS =====

export function setAccounts(accounts: any[]): void {
  if (Array.isArray(accounts) && accounts.length > 0) {
    if (typeof accounts[0] === 'string') {
      // Convert string array to Account objects
      state.budgetState.accounts = accounts.map((name, index) => ({
        id: (index + 1).toString(),
        name: name,
        startBalance: 0
      }));
    } else {
      // Already Account objects
      state.budgetState.accounts = accounts;
    }
  }
  saveStateToStorage();
  triggerUIRefresh();
}

// ===== HELPER FUNCTIONS =====

function createEmptyMonthData(): MonthData {
  return {
    andreasSalary: 45000,
    andreasförsäkringskassan: 0,
    andreasbarnbidrag: 0,
    susannaSalary: 40000,
    susannaförsäkringskassan: 5000,
    susannabarnbidrag: 0,
    costGroups: [
      { id: '1', name: 'Hyra', amount: 15000, type: 'cost' },
      { id: '2', name: 'Mat & Kläder', amount: 8000, type: 'cost' },
      { id: '3', name: 'Transport', amount: 2000, type: 'cost', subCategories: [] }
    ],
    savingsGroups: [],
    dailyTransfer: 300,
    weekendTransfer: 540,
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

// Legacy compatibility functions (to be removed after component refactoring)
export function forceRecalculation(): void {
  runCalculationsAndUpdateState();
}

export function setResults(value: any): void {
  state.calculated.results = value;
  triggerUIRefresh();
}

export function updateHistoricalData(value: any): void {
  state.budgetState.historicalData = value;
  saveStateToStorage();
  triggerUIRefresh();
}

export function setHistoricalData(value: any): void {
  state.budgetState.historicalData = value;
  saveStateToStorage();
  triggerUIRefresh();
}

export function updateHistoricalDataSingle(monthKey: string, data: any): void {
  state.budgetState.historicalData[monthKey] = data;
  saveStateToStorage();
  triggerUIRefresh();
}

export function updateSelectedBudgetMonth(value: string): void {
  setSelectedBudgetMonth(value);
}

export function setAccountEstimatedFinalBalances(value: {[key: string]: number}): void {
  updateAndRecalculate({ accountEstimatedFinalBalances: value });
}

export function setAccountEstimatedFinalBalancesSet(value: {[key: string]: boolean}): void {
  updateAndRecalculate({ accountEstimatedFinalBalancesSet: value });
}

export function setAccountEstimatedStartBalances(value: {[key: string]: number}): void {
  updateAndRecalculate({ accountEstimatedStartBalances: value });
}

export function setAccountStartBalancesSet(value: {[key: string]: boolean}): void {
  updateAndRecalculate({ accountStartBalancesSet: value });
}

export function setAccountEndBalancesSet(value: {[key: string]: boolean}): void {
  updateAndRecalculate({ accountEndBalancesSet: value });
}

export function setMonthFinalBalances(value: {[key: string]: boolean}): void {
  updateAndRecalculate({ monthFinalBalances: value });
}