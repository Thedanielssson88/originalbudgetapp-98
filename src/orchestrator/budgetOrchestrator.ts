// Single Source of Truth Orchestrator - Simplified architecture

import { state, initializeStateFromStorage, saveStateToStorage, getCurrentMonthData, updateCurrentMonthData } from '../state/budgetState';
import { StorageKey, set } from '../services/storageService';
import { calculateFullPrognosis, calculateBudgetResults, calculateAccountProgression, calculateMonthlyBreakdowns, calculateProjectedBalances } from '../services/calculationService';
import { BudgetGroup, MonthData, SavingsGoal } from '../types/budget';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import { v4 as uuidv4 } from 'uuid';
import { ImportedTransaction, CategoryRule } from '../types/transaction';

// Event system for UI updates
const eventEmitter = new EventTarget();
export const APP_STATE_UPDATED = 'appstateupdated';

function triggerUIRefresh() {
  console.log('🎯 [ORCHESTRATOR] Dispatching APP_STATE_UPDATED event...');
  addMobileDebugLog('🎯 [ORCHESTRATOR] Dispatching APP_STATE_UPDATED event...');
  eventEmitter.dispatchEvent(new Event(APP_STATE_UPDATED));
}

// Track initialization to prevent multiple calls
let isInitialized = false;

// Initialize the application
export function initializeApp(): void {
  console.log('[BudgetOrchestrator] 🚀 initializeApp() called!');
  addMobileDebugLog('[ORCHESTRATOR] 🚀 initializeApp() called!');
  
  if (isInitialized) {
    console.log('[BudgetOrchestrator] ⚠️ App already initialized - skipping...');
    addMobileDebugLog('[ORCHESTRATOR] ⚠️ App already initialized - skipping...');
    return;
  }
  
  isInitialized = true;
  console.log('[BudgetOrchestrator] ✅ Setting initialization flag and starting...');
  addMobileDebugLog('[ORCHESTRATOR] ✅ Setting initialization flag and starting...');
  
  initializeStateFromStorage();
  
  addMobileDebugLog(`[ORCHESTRATOR] After storage init - available months: ${Object.keys(state.budgetState.historicalData).join(', ')}`);
  addMobileDebugLog(`[ORCHESTRATOR] Selected month: ${state.budgetState.selectedMonthKey}`);
  
  // Run initial calculations to ensure state is up to date
  runCalculationsAndUpdateState();
  
  // Mark loading as complete
  state.isLoading = false;
  addMobileDebugLog('[ORCHESTRATOR] ✅ App initialization complete - loading set to false');
  
  // Don't trigger UI refresh here - runCalculationsAndUpdateState() already does it
  addMobileDebugLog('[ORCHESTRATOR] 📡 App initialization complete - UI refresh was done by runCalculationsAndUpdateState');
}

// Get current state
export function getCurrentState() {
  return state;
}

// Subscribe/unsubscribe to state changes
export function subscribeToStateChanges(callback: () => void): void {
  console.log('🎯 [ORCHESTRATOR] Subscribing to state changes...');
  addMobileDebugLog('🎯 [ORCHESTRATOR] Subscribing to state changes...');
  eventEmitter.addEventListener(APP_STATE_UPDATED, callback);
}

export function unsubscribeFromStateChanges(callback: () => void): void {
  console.log('🎯 [ORCHESTRATOR] Unsubscribing from state changes...');
  addMobileDebugLog('🎯 [ORCHESTRATOR] Unsubscribing from state changes...');
  eventEmitter.removeEventListener(APP_STATE_UPDATED, callback);
}

// Main calculation and state update function
export function runCalculationsAndUpdateState(): void {
  console.log('🔥 [ORCHESTRATOR] runCalculationsAndUpdateState() STARTED');
  const stack = new Error().stack;
  const callerLine = stack?.split('\n')[2] || 'unknown';
  console.log('🔥 [ORCHESTRATOR] WHO IS CALLING ME?:', callerLine);
  addMobileDebugLog('🔥 [ORCHESTRATOR] runCalculationsAndUpdateState() STARTED');
  addMobileDebugLog(`🔥 [ORCHESTRATOR] WHO IS CALLING ME?: ${callerLine}`);
  
  try {
    const { historicalData, accounts } = state.budgetState;
    const currentMonth = getCurrentMonthData();
    
    // Run calculations with the new state structure
    const { estimatedStartBalancesByMonth, estimatedFinalBalancesByMonth } = 
      calculateFullPrognosis(historicalData, accounts);
    const results = calculateBudgetResults(currentMonth);
    
    // Update estimated balances in historical data (direct state modification to avoid loops)
    Object.keys(estimatedStartBalancesByMonth).forEach(monthKey => {
      if (state.budgetState.historicalData[monthKey]) {
        // Direct state modification - no function calls to avoid infinite loops
        state.budgetState.historicalData[monthKey].accountEstimatedStartBalances = estimatedStartBalancesByMonth[monthKey];
        state.budgetState.historicalData[monthKey].accountEstimatedFinalBalances = estimatedFinalBalancesByMonth[monthKey];
      }
    });
    
    // Update calculated state
    state.calculated = {
      results: results,
      fullPrognosis: {
        accountProgression: calculateAccountProgression(historicalData, accounts),
        monthlyBreakdowns: calculateMonthlyBreakdowns(historicalData, accounts),
        projectedBalances: calculateProjectedBalances(historicalData, accounts)
      }
    };
    
    // Save and trigger UI update
    saveStateToStorage();
    triggerUIRefresh();
    
    console.log('🔥 [ORCHESTRATOR] runCalculationsAndUpdateState() COMPLETED');
    addMobileDebugLog('🔥 [ORCHESTRATOR] runCalculationsAndUpdateState() COMPLETED');
  } catch (error) {
    console.error('[BudgetOrchestrator] Error in calculations:', error);
  }
}

// Helper function for updating data
function updateAndRecalculate(updates: Partial<MonthData>): void {
  const stack = new Error().stack;
  const callerLine = stack?.split('\n')[2] || 'unknown';
  console.log('🔥 [ORCHESTRATOR] updateAndRecalculate() called from:', callerLine);
  addMobileDebugLog(`🔥 [ORCHESTRATOR] updateAndRecalculate() called from: ${callerLine}`);
  updateCurrentMonthData(updates);
  runCalculationsAndUpdateState();
}

// ===== DATA UPDATE FUNCTIONS =====
// These functions now only write to historicalData[selectedMonthKey]

export function updateCostGroups(value: BudgetGroup[]): void {
  console.log('🔍 [ORCHESTRATOR] updateCostGroups called with:', value);
  console.log('🔍 [ORCHESTRATOR] Number of groups being saved:', value.length);
  value.forEach((group, index) => {
    console.log(`🔍 [ORCHESTRATOR] Group ${index}: ${group.name} with ${group.subCategories?.length || 0} subcategories`);
    if (group.subCategories) {
      group.subCategories.forEach((sub, subIndex) => {
        console.log(`  🔍 [ORCHESTRATOR] Subcategory ${subIndex}: ${sub.name} - ${sub.amount}`);
      });
    }
  });
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
  const currentMonthData = getCurrentMonthData();
  const newBalances = { ...currentMonthData.accountBalances, [accountName]: balance };
  const newBalancesSet = { ...currentMonthData.accountBalancesSet, [accountName]: true };
  
  // Update current month accountBalances and accountBalancesSet
  updateAndRecalculate({ 
    accountBalances: newBalances,
    accountBalancesSet: newBalancesSet
  });

  // No need to update previous month's accountEndBalances anymore
  // as they are now calculated from next month's accountBalances
  console.log(`✅ Updated account balance for ${accountName}: ${balance} (accountEndBalances now calculated dynamically)`);
}

export function unsetAccountBalance(accountName: string): void {
  const currentMonthData = getCurrentMonthData();
  const newBalances = { ...currentMonthData.accountBalances };
  const newBalancesSet = { ...currentMonthData.accountBalancesSet };
  
  // Set balance to 0 and mark as not set by user
  newBalances[accountName] = 0;
  newBalancesSet[accountName] = false;
  
  // Update current month accountBalances and accountBalancesSet
  updateAndRecalculate({ 
    accountBalances: newBalances,
    accountBalancesSet: newBalancesSet
  });
  
  console.log(`✅ Unset account balance for ${accountName} (marked as not set by user)`);
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
    costItems: [], // Nya struktur
    savingsItems: [], // Nya struktur
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
    userName1: 'Andreas',
    userName2: 'Susanna',
    transferChecks: {},
    andreasShareChecked: false,
    susannaShareChecked: false,
    monthFinalBalances: {},
    accountEndingBalances: {},
    transactions: [], // NYTT FÄLT
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
  addMobileDebugLog('🔥 [ORCHESTRATOR] updateHistoricalData called');
  addMobileDebugLog(`🔥 [ORCHESTRATOR] Incoming data keys: ${Object.keys(value).join(', ')}`);
  
  // Check what's in the data for current month
  const currentMonth = state.budgetState.selectedMonthKey;
  if (value[currentMonth]) {
    addMobileDebugLog(`🔥 [ORCHESTRATOR] Current month data keys: ${Object.keys(value[currentMonth]).join(', ')}`);
    addMobileDebugLog(`🔥 [ORCHESTRATOR] accountBalances in data: ${JSON.stringify(value[currentMonth].accountBalances)}`);
    addMobileDebugLog(`🔥 [ORCHESTRATOR] accountBalancesSet in data: ${JSON.stringify(value[currentMonth].accountBalancesSet)}`);
  }
  
  state.budgetState.historicalData = value;
  addMobileDebugLog('🔥 [ORCHESTRATOR] State updated, calling saveStateToStorage');
  saveStateToStorage();
  addMobileDebugLog('🔥 [ORCHESTRATOR] saveStateToStorage completed');
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

// setAccountEndBalances and setAccountEndBalancesSet removed - now calculated dynamically

export function setMonthFinalBalances(value: {[key: string]: boolean}): void {
  updateAndRecalculate({ monthFinalBalances: value });
}

// Main categories management
export function setMainCategories(value: string[]): void {
  state.budgetState.mainCategories = value;
  // Also save to separate storage for migration compatibility
  set(StorageKey.MAIN_CATEGORIES, value);
  saveStateToStorage();
  triggerUIRefresh();
}

// ===== SAVINGS GOALS MANAGEMENT =====

export const createSavingsGoal = (goalData: Omit<SavingsGoal, 'id'>) => {
  console.log(`🎯 [ORCHESTRATOR] Creating new savings goal: ${goalData.name}`);
  
  const newGoal: SavingsGoal = {
    ...goalData,
    id: uuidv4() // Generate unique ID
  };
  
  state.budgetState.savingsGoals.push(newGoal);
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log(`✅ [ORCHESTRATOR] Savings goal created successfully`);
};

export const updateSavingsGoal = (goalId: string, updates: Partial<SavingsGoal>) => {
  console.log(`🎯 [ORCHESTRATOR] Updating savings goal: ${goalId}`);
  
  const goalIndex = state.budgetState.savingsGoals.findIndex(goal => goal.id === goalId);
  if (goalIndex !== -1) {
    state.budgetState.savingsGoals[goalIndex] = {
      ...state.budgetState.savingsGoals[goalIndex],
      ...updates
    };
    saveStateToStorage();
    triggerUIRefresh();
    console.log(`✅ [ORCHESTRATOR] Savings goal updated successfully`);
  } else {
    console.error(`❌ [ORCHESTRATOR] Savings goal not found: ${goalId}`);
  }
};

export const deleteSavingsGoal = (goalId: string) => {
  console.log(`🎯 [ORCHESTRATOR] Deleting savings goal: ${goalId}`);
  
  state.budgetState.savingsGoals = state.budgetState.savingsGoals.filter(goal => goal.id !== goalId);
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log(`✅ [ORCHESTRATOR] Savings goal deleted successfully`);
};

// ===== TRANSACTION MANAGEMENT =====

export function setTransactionsForCurrentMonth(transactions: ImportedTransaction[]): void {
  const currentMonthKey = state.budgetState.selectedMonthKey;

  // Check that a month is selected
  if (!currentMonthKey) {
    console.error('[Orchestrator] Ingen månad vald, kan inte spara transaktioner.');
    return;
  }

  // Ensure the month data exists
  if (!state.budgetState.historicalData[currentMonthKey]) {
    state.budgetState.historicalData[currentMonthKey] = createEmptyMonthData();
  }

  // Update the transaction list for the selected month (store as any for now due to type differences)
  (state.budgetState.historicalData[currentMonthKey] as any).transactions = transactions;

  console.log(`[Orchestrator] Sparade ${transactions.length} transaktioner till månad ${currentMonthKey}.`);

  // Save the updated state permanently
  saveStateToStorage();
  
  // Run calculations so the budget view updates immediately
  runCalculationsAndUpdateState();
}

// ===== CATEGORY RULES MANAGEMENT =====

export function addCategoryRule(newRule: Omit<CategoryRule, 'id'>): void {
  const ruleWithId = { ...newRule, id: uuidv4() };
  state.budgetState.transactionImport.categoryRules.push(ruleWithId);
  saveStateToStorage();
  triggerUIRefresh();
}

export function updateCategoryRule(updatedRule: CategoryRule): void {
  const ruleIndex = state.budgetState.transactionImport.categoryRules.findIndex(r => r.id === updatedRule.id);
  if (ruleIndex !== -1) {
    state.budgetState.transactionImport.categoryRules[ruleIndex] = updatedRule;
    saveStateToStorage();
    triggerUIRefresh();
  }
}

export function deleteCategoryRule(ruleId: string): void {
  state.budgetState.transactionImport.categoryRules = state.budgetState.transactionImport.categoryRules.filter(r => r.id !== ruleId);
  saveStateToStorage();
  triggerUIRefresh();
}

// ===== UNIFIED CATEGORY SYSTEM =====
// Categories are now directly managed through mainCategories and subcategories
// No more separate linking system needed