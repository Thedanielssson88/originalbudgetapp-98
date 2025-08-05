// Single Source of Truth state - Simplified architecture

import { get, set, StorageKey } from '../services/storageService';
import { BudgetState, MonthData, Account, Transaction } from '../types/budget';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import { v4 as uuidv4 } from 'uuid';
import { apiStore } from '../store/apiStore';

interface AppState {
  isLoading: boolean;
  budgetState: BudgetState;
  calculated: {
    results: any;
    fullPrognosis: any;
  };
}

// Initialize the new simplified state structure
export const state: AppState = {
  isLoading: true, // Start as loading
  budgetState: {
    historicalData: {},
    accounts: [], // Will be loaded from API
    savingsGoals: [], // NYTT FÄLT
    plannedTransfers: [], // NYA PLANERADE ÖVERFÖRINGAR
    selectedMonthKey: '2025-07', // Use current month as default
    selectedHistoricalMonth: '2025-07',
    
    // CRITICAL: Central transaction storage - single source of truth
    allTransactions: [], // All transactions across all months
    
    // UI state
    uiState: {
      expandedSections: {},
      activeTab: 'inkomster'
    },
    
    // Global settings
    settings: {
      payday: 25, // Default to 25th of the month
    },
    accountCategories: [],
    accountCategoryMapping: {},
    budgetTemplates: {},
    
    // Chart settings
    chartSettings: {
      selectedAccountsForChart: [],
      showIndividualCostsOutsideBudget: false,
      showSavingsSeparately: false,
      useCustomTimeRange: false,
      chartStartMonth: '',
      chartEndMonth: '',
      balanceType: 'starting',
      showEstimatedBudgetAmounts: false
    },
    
    // Main categories for all groups (costs, savings, transactions) - loaded from API
    mainCategories: [],
    
    // Nya regelmotor för kategorisering
    categoryRules: [],
    
    // Transaction import state
    transactionImport: {
      fileStructures: [],
      importHistory: [],
      transactions: [],
    },
    
    // CSV mappings - permanent storage for mapping rules
    csvMappings: [],
  },
  calculated: {
    results: null,
    fullPrognosis: null
  }
};

export function initializeStateFromStorage(): void {
  try {
    addMobileDebugLog('[INIT] 🚀 Starting initialization...');
    // No longer loading from localStorage - data will come from API
    
    // Sync data from API store
    syncFromApiStore();
    
    // Ensure current month exists
    const currentMonth = state.budgetState.selectedMonthKey;
    if (!state.budgetState.historicalData[currentMonth]) {
      state.budgetState.historicalData[currentMonth] = createEmptyMonthData();
    }
    
    // Also ensure next month exists
    const nextMonth = getNextMonth(currentMonth);
    if (!state.budgetState.historicalData[nextMonth]) {
      state.budgetState.historicalData[nextMonth] = createEmptyMonthData();
    }
    
    // Set loading to false after initial setup
    state.isLoading = false;
    
    addMobileDebugLog('[INIT] ✅ State initialized');
    addMobileDebugLog(`[INIT] selectedMonthKey: ${state.budgetState.selectedMonthKey}`);
    addMobileDebugLog(`[INIT] availableMonths: ${Object.keys(state.budgetState.historicalData).join(', ')}`);
    
  } catch (error) {
    console.error('[INIT] 💥 Error during initialization:', error);
    addMobileDebugLog(`[INIT] 💥 Error: ${error}`);
    state.isLoading = false;
  }
}

// Sync data from API store to budget state
export function syncFromApiStore(): void {
  try {
    // The ApiStore is now used for API operations only
    // Data is synced directly from React Query hooks
    addMobileDebugLog(`[SYNC] API Store is available for operations`);
  } catch (error) {
    console.error('[SYNC] Error syncing from API store:', error);
    addMobileDebugLog(`[SYNC] 💥 Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to get next month
function getNextMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

// Function to check if app is loading
export const isAppLoading = (): boolean => state.isLoading;

// Save state to storage - NO LONGER SAVES TO LOCALSTORAGE
export function saveStateToStorage(): void {
  try {
    addMobileDebugLog('[SAVE] ⏳ Saving state - this is now a no-op for localStorage');
    // No longer saving to localStorage - all data persisted via API
  } catch (error) {
    console.error('[SAVE] 💥 Error saving state:', error);
    addMobileDebugLog(`[SAVE] 💥 Error: ${error}`);
  }
}

// Function to create empty month data
function createEmptyMonthData(): MonthData {
  return {
    andreasSalary: 0,
    andreasförsäkringskassan: 0,
    andreasbarnbidrag: 0,
    susannaSalary: 0,
    susannaförsäkringskassan: 0,
    susannabarnbidrag: 0,
    costGroups: [
      { id: '1', name: 'Hyra', amount: 15000, type: 'cost' },
      { id: '2', name: 'Mat & Kläder', amount: 8000, type: 'cost' },
      { id: '3', name: 'Transport', amount: 2000, type: 'cost', subCategories: [] }
    ],
    savingsGroups: [],
    costItems: [],
    savingsItems: [],
    dailyTransfer: 300,
    weekendTransfer: 540,
    andreasPersonalCosts: 0,
    andreasPersonalSavings: 0,
    susannaPersonalCosts: 0,
    susannaPersonalSavings: 0,
    customHolidays: [],
    accountBalances: {},
    accountBalancesSet: {},
    accountEstimatedFinalBalances: { 'Överföring': 0 },
    accountEstimatedFinalBalancesSet: {},
    accountEstimatedStartBalances: { 'Överföring': 0 },
    accountStartBalancesSet: {},
    userName1: 'Andreas',
    userName2: 'Susanna',
    transferChecks: {},
    andreasShareChecked: false,
    susannaShareChecked: false,
    // NOTE: Transactions are no longer stored here - they're in allTransactions
    transactions: [],
  };
}

// Function to create empty month data with transaction preservation
function createEmptyMonthDataWithTransactionPreservation(monthKey: string): MonthData {
  console.log(`[BUDGETSTATE] 🔍 Creating month data for ${monthKey} with transaction preservation`);
  
  // Check if there are any existing transactions for this month across all stored months
  const allTransactions = Object.values(state.budgetState.historicalData)
    .flatMap(month => (month.transactions || []) as any[]);
  
  const existingTransactionsForMonth = allTransactions.filter(tx => {
    const txMonth = tx.date ? tx.date.substring(0, 7) : '';
    return txMonth === monthKey;
  });
  
  console.log(`[BUDGETSTATE] 🔍 Found ${existingTransactionsForMonth.length} existing transactions for month ${monthKey}`);
  
  // Create empty month data but preserve any existing transactions
  const emptyMonth = createEmptyMonthData();
  emptyMonth.transactions = existingTransactionsForMonth.map(tx => ({
    ...tx,
    userDescription: tx.userDescription || '',
    bankCategory: tx.bankCategory || '',
    bankSubCategory: tx.bankSubCategory || '',
    balanceAfter: tx.balanceAfter || 0
  }));
  
  console.log(`[BUDGETSTATE] ✅ Created month ${monthKey} with ${existingTransactionsForMonth.length} preserved transactions`);
  return emptyMonth;
}

// Helper function to get current month data
export function getCurrentMonthData(): MonthData {
  const currentMonth = state.budgetState.selectedMonthKey;
  if (!state.budgetState.historicalData[currentMonth]) {
    state.budgetState.historicalData[currentMonth] = createEmptyMonthDataWithTransactionPreservation(currentMonth);
  }
  return state.budgetState.historicalData[currentMonth];
}

// Helper function to update current month data
export function updateCurrentMonthData(updates: Partial<MonthData>): void {
  const currentMonth = state.budgetState.selectedMonthKey;
  if (!state.budgetState.historicalData[currentMonth]) {
    state.budgetState.historicalData[currentMonth] = createEmptyMonthDataWithTransactionPreservation(currentMonth);
  }
  
  state.budgetState.historicalData[currentMonth] = {
    ...state.budgetState.historicalData[currentMonth],
    ...updates
  };
}