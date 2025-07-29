// Single Source of Truth state - Simplified architecture

import { get, set, StorageKey } from '../services/storageService';
import { BudgetState, MonthData, Account } from '../types/budget';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';

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
    accounts: [
      { id: '1', name: 'Löpande', startBalance: 0 },
      { id: '2', name: 'Sparkonto', startBalance: 0 },
      { id: '3', name: 'Buffert', startBalance: 0 }
    ],
    savingsGoals: [], // NYTT FÄLT
    selectedMonthKey: '2025-07', // Use current month as default
    selectedHistoricalMonth: '2025-07',
    
    // UI state
    uiState: {
      expandedSections: {},
      activeTab: 'inkomster'
    },
    
    // Global settings
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
    
    // Main categories for cost groups
    mainCategories: ['Hushåll', 'Mat & Kläder', 'Transport']
  },
  calculated: {
    results: null,
    fullPrognosis: null
  }
};

export function initializeStateFromStorage(): void {
  try {
    addMobileDebugLog('[INIT] 🚀 Starting initialization from storage...');
    // Try to load from storage
    const savedData = get<any>(StorageKey.BUDGET_CALCULATOR_DATA);
    addMobileDebugLog(`[INIT] Raw savedData: ${savedData ? 'DATA FOUND' : 'NO DATA'}`);
    
    // CRITICAL: Direct localStorage inspection for debug
    addMobileDebugLog(`[INIT] 🔥 RAW LOCALSTORAGE LENGTH: ${localStorage.getItem('budgetCalculatorData')?.length || 'null'}`);
    if (savedData?.budgetState?.historicalData) {
      addMobileDebugLog(`[INIT] 🔥 HISTORICAL DATA KEYS: ${Object.keys(savedData.budgetState.historicalData).join(', ')}`);
      const month2025_07 = savedData.budgetState.historicalData['2025-07'];
      if (month2025_07) {
        addMobileDebugLog(`[INIT] 🔥 2025-07 ACCOUNT BALANCES: ${JSON.stringify(month2025_07.accountBalances)}`);
        addMobileDebugLog(`[INIT] 🔥 2025-07 ACCOUNT BALANCES SET: ${JSON.stringify(month2025_07.accountBalancesSet)}`);
      } else {
        addMobileDebugLog(`[INIT] 🔥 NO 2025-07 DATA FOUND!`);
      }
    }
    
    if (savedData) {
      addMobileDebugLog(`[INIT] 🔍 Analyzing savedData structure...`);
      addMobileDebugLog(`[INIT] savedData keys: ${Object.keys(savedData).join(', ')}`);
      
      // Migration from old structure to new BudgetState
      addMobileDebugLog(`[INIT] 🧪 Testing conditions...`);
      addMobileDebugLog(`[INIT] savedData.rawData exists: ${!!savedData.rawData}`);
      addMobileDebugLog(`[INIT] savedData.budgetState exists: ${!!savedData.budgetState}`);
      
      if (savedData.rawData) {
        addMobileDebugLog('[INIT] 📦 Found OLD structure (rawData) - migrating...');
        const oldRawData = savedData.rawData;
        
        // CRITICAL FIX: Preserve all existing historical data
        const existingHistoricalData = get<any>(StorageKey.HISTORICAL_DATA) || {};
        addMobileDebugLog(`[INIT] 📋 Found existing historical data for months: ${Object.keys(existingHistoricalData).join(', ')}`);
        
        // Migrate all historical data to new structure
        state.budgetState.historicalData = existingHistoricalData;
        
        // Migrate accounts
        if (oldRawData.accounts && Array.isArray(oldRawData.accounts)) {
          state.budgetState.accounts = oldRawData.accounts.map((accountName: string, index: number) => ({
            id: (index + 1).toString(),
            name: accountName,
            startBalance: 0
          }));
        }
        
        // Migrate historical data - this is our single source of truth
        if (oldRawData.historicalData) {
          state.budgetState.historicalData = oldRawData.historicalData;
        }
        
        // Migrate selected months
        if (oldRawData.selectedBudgetMonth) {
          state.budgetState.selectedMonthKey = oldRawData.selectedBudgetMonth;
        }
        if (oldRawData.selectedHistoricalMonth) {
          state.budgetState.selectedHistoricalMonth = oldRawData.selectedHistoricalMonth;
        }
        
        // Migrate global settings
        if (oldRawData.accountCategories) {
          state.budgetState.accountCategories = oldRawData.accountCategories;
        }
        if (oldRawData.accountCategoryMapping) {
          state.budgetState.accountCategoryMapping = oldRawData.accountCategoryMapping;
        }
        if (oldRawData.budgetTemplates) {
          state.budgetState.budgetTemplates = oldRawData.budgetTemplates;
        }
        
        // Migrate chart settings
        if (oldRawData.selectedAccountsForChart) {
          state.budgetState.chartSettings.selectedAccountsForChart = oldRawData.selectedAccountsForChart;
          state.budgetState.chartSettings.showIndividualCostsOutsideBudget = oldRawData.showIndividualCostsOutsideBudget || false;
          state.budgetState.chartSettings.showSavingsSeparately = oldRawData.showSavingsSeparately || false;
          state.budgetState.chartSettings.useCustomTimeRange = oldRawData.useCustomTimeRange || false;
          state.budgetState.chartSettings.chartStartMonth = oldRawData.chartStartMonth || '';
          state.budgetState.chartSettings.chartEndMonth = oldRawData.chartEndMonth || '';
          state.budgetState.chartSettings.balanceType = oldRawData.balanceType || 'starting';
          state.budgetState.chartSettings.showEstimatedBudgetAmounts = oldRawData.showEstimatedBudgetAmounts || false;
        }
        
        // Load main categories from storage or use defaults
        const savedMainCategories = get<string[]>(StorageKey.MAIN_CATEGORIES);
        if (savedMainCategories) {
          state.budgetState.mainCategories = savedMainCategories;
        }
        
        // If there's live data but no corresponding historical data, create a month entry
        const currentMonth = state.budgetState.selectedMonthKey;
        if (!state.budgetState.historicalData[currentMonth]) {
          state.budgetState.historicalData[currentMonth] = createEmptyMonthData();
          
          // Migrate any live data to the current month
          if (oldRawData.costGroups) {
            state.budgetState.historicalData[currentMonth].costGroups = oldRawData.costGroups;
          }
          if (oldRawData.savingsGroups) {
            state.budgetState.historicalData[currentMonth].savingsGroups = oldRawData.savingsGroups;
          }
          if (oldRawData.andreasSalary !== undefined) {
            state.budgetState.historicalData[currentMonth].andreasSalary = oldRawData.andreasSalary;
          }
          if (oldRawData.susannaSalary !== undefined) {
            state.budgetState.historicalData[currentMonth].susannaSalary = oldRawData.susannaSalary;
          }
          
          // Migrate account balances - CRITICAL FIX!
          if (oldRawData.accountBalances) {
            state.budgetState.historicalData[currentMonth].accountBalances = oldRawData.accountBalances;
          }
          if (oldRawData.accountBalancesSet) {
            state.budgetState.historicalData[currentMonth].accountBalancesSet = oldRawData.accountBalancesSet;
          }
          if (oldRawData.dailyTransfer !== undefined) {
            state.budgetState.historicalData[currentMonth].dailyTransfer = oldRawData.dailyTransfer;
          }
          if (oldRawData.weekendTransfer !== undefined) {
            state.budgetState.historicalData[currentMonth].weekendTransfer = oldRawData.weekendTransfer;
          }
          if (oldRawData.customHolidays) {
            state.budgetState.historicalData[currentMonth].customHolidays = oldRawData.customHolidays;
          }
        }
      } else if (savedData.budgetState) {
        addMobileDebugLog('[INIT] 🆕 Found NEW structure (budgetState) - direct load');
        addMobileDebugLog(`[INIT] budgetState keys: ${Object.keys(savedData.budgetState).join(', ')}`);
        
        // CRITICAL DEBUG - This MUST appear in logs!
        console.log(`🚨🚨🚨 CRITICAL DEBUG START 🚨🚨🚨`);
        addMobileDebugLog(`🚨🚨🚨 CRITICAL DEBUG START 🚨🚨🚨`);
        
        // New structure - direct load with proper merging
        const loadedBudgetState = savedData.budgetState;
        addMobileDebugLog(`[INIT] 🔍 loadedBudgetState exists: ${!!loadedBudgetState}`);
        addMobileDebugLog(`[INIT] 🔍 loadedBudgetState.historicalData exists: ${!!loadedBudgetState?.historicalData}`);
        
        // CRITICAL DEBUG: Check what's in the loaded historical data
        console.log(`[INIT] 🔍 CRITICAL DEBUG - loadedBudgetState.historicalData:`, loadedBudgetState.historicalData);
        const selectedMonth = loadedBudgetState.selectedMonthKey || state.budgetState.selectedMonthKey;
        if (loadedBudgetState.historicalData && loadedBudgetState.historicalData[selectedMonth]) {
          console.log(`[INIT] 🔍 CRITICAL DEBUG - month ${selectedMonth} data:`, loadedBudgetState.historicalData[selectedMonth]);
          console.log(`[INIT] 🔍 CRITICAL DEBUG - accountBalances in loaded data:`, loadedBudgetState.historicalData[selectedMonth].accountBalances);
        }
        
        // Merge, but preserve essential properties
        state.budgetState = {
          ...state.budgetState, 
          ...loadedBudgetState,
          // Ensure historicalData is properly loaded
          historicalData: loadedBudgetState.historicalData || state.budgetState.historicalData,
          // If selectedMonthKey exists in loaded data, use it
          selectedMonthKey: loadedBudgetState.selectedMonthKey || state.budgetState.selectedMonthKey
        };
        
        // Load main categories from storage or use defaults if not present in budgetState
        if (!state.budgetState.mainCategories) {
          const savedMainCategories = get<string[]>(StorageKey.MAIN_CATEGORIES);
          if (savedMainCategories) {
            state.budgetState.mainCategories = savedMainCategories;
          }
        }
        
        addMobileDebugLog(`[INIT] ✅ State merged successfully`);
        addMobileDebugLog(`[INIT] Final selectedMonthKey: ${state.budgetState.selectedMonthKey}`);
        addMobileDebugLog(`[INIT] Final available months: ${Object.keys(state.budgetState.historicalData).join(', ')}`);
        
        // Debug the loaded data for current month
        const currentMonth = state.budgetState.selectedMonthKey;
        if (state.budgetState.historicalData && state.budgetState.historicalData[currentMonth]) {
          const monthData = state.budgetState.historicalData[currentMonth];
          addMobileDebugLog(`[INIT] Current month (${currentMonth}) data keys: ${Object.keys(monthData).join(', ')}`);
          addMobileDebugLog(`[INIT] Loaded accountBalances: ${JSON.stringify(monthData.accountBalances || {})}`);
          addMobileDebugLog(`[INIT] Loaded accountBalancesSet: ${JSON.stringify(monthData.accountBalancesSet || {})}`);
        } else {
          addMobileDebugLog(`[INIT] ❌ No monthData found for current month: ${currentMonth}`);
        }
      } else {
        addMobileDebugLog('[INIT] ❓ Unknown data structure - no rawData or budgetState');
      }
      
      if (savedData.calculated) {
        addMobileDebugLog('[INIT] Loading calculated results...');
        state.calculated = savedData.calculated;
      }
    } else {
      addMobileDebugLog('[INIT] ❌ No savedData found - using defaults');
    }
    
    // Ensure current month exists
    const currentMonth = state.budgetState.selectedMonthKey;
    if (!state.budgetState.historicalData[currentMonth]) {
      state.budgetState.historicalData[currentMonth] = createEmptyMonthData();
    }
    
    addMobileDebugLog('[INIT] ✅ State initialized from storage');
    addMobileDebugLog(`[INIT] selectedMonthKey: ${state.budgetState.selectedMonthKey}`);
    addMobileDebugLog(`[INIT] availableMonths: ${Object.keys(state.budgetState.historicalData).join(', ')}`);
    const initCurrentMonth = state.budgetState.selectedMonthKey;
    const initCurrentData = state.budgetState.historicalData[initCurrentMonth];
    if (initCurrentData) {
      addMobileDebugLog(`[INIT] currentMonth accountBalances: ${JSON.stringify(initCurrentData.accountBalances || {})}`);
      addMobileDebugLog(`[INIT] currentMonth accountBalancesSet: ${JSON.stringify(initCurrentData.accountBalancesSet || {})}`);
    } else {
      addMobileDebugLog(`[INIT] ❌ NO DATA FOUND for current month: ${initCurrentMonth}`);
    }
  } catch (error) {
    console.error('[BudgetState] Error loading from storage:', error);
    // Keep default state on error
  }
}

// Export function to check if app is loading
export const isAppLoading = (): boolean => state.isLoading;

export function saveStateToStorage(): void {
  try {
    const dataToSave = {
      budgetState: state.budgetState,
      calculated: state.calculated
    };
    set(StorageKey.BUDGET_CALCULATOR_DATA, dataToSave);
    console.log('[BudgetState] State saved to storage');
    console.log('[BudgetState] SAVE DEBUG - selectedMonthKey:', state.budgetState.selectedMonthKey);
    const saveCurrentMonth = state.budgetState.selectedMonthKey;
    const saveCurrentData = state.budgetState.historicalData[saveCurrentMonth];
    if (saveCurrentData) {
      console.log('[BudgetState] SAVE DEBUG - accountBalances being saved:', saveCurrentData.accountBalances);
      console.log('[BudgetState] SAVE DEBUG - accountBalancesSet being saved:', saveCurrentData.accountBalancesSet);
    }
  } catch (error) {
    console.error('[BudgetState] Error saving to storage:', error);
  }
}

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

// Helper function to get current month data
export function getCurrentMonthData(): MonthData {
  const currentMonth = state.budgetState.selectedMonthKey;
  if (!state.budgetState.historicalData[currentMonth]) {
    state.budgetState.historicalData[currentMonth] = createEmptyMonthData();
  }
  return state.budgetState.historicalData[currentMonth];
}

// Helper function to update current month data
export function updateCurrentMonthData(updates: Partial<MonthData>): void {
  const currentMonth = state.budgetState.selectedMonthKey;
  if (!state.budgetState.historicalData[currentMonth]) {
    state.budgetState.historicalData[currentMonth] = createEmptyMonthData();
  }
  
  state.budgetState.historicalData[currentMonth] = {
    ...state.budgetState.historicalData[currentMonth],
    ...updates
  };
}
