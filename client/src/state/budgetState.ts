// Single Source of Truth state - Simplified architecture

import { get, set, StorageKey } from '../services/storageService';
import { BudgetState, MonthData, Account, Transaction } from '../types/budget';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import { v4 as uuidv4 } from 'uuid';

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
    accounts: [], // Will be loaded from saved data or set dynamically
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
    
    // Main categories for all groups (costs, savings, transactions) - loaded from storage, no defaults
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
        
        // Migrate accounts with UUID
        if (oldRawData.accounts && Array.isArray(oldRawData.accounts)) {
          state.budgetState.accounts = oldRawData.accounts.map((accountName: string) => ({
            id: uuidv4(),
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
        
        // ALWAYS load main categories from storage - no defaults
        const savedMainCategories = get<string[]>(StorageKey.MAIN_CATEGORIES);
        if (savedMainCategories && savedMainCategories.length > 0) {
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
        
        // CRITICAL: Log transaction counts when LOADING
        console.log('[INIT] 🔍 LOAD DEBUG - Transaction counts from loaded data:');
        if (loadedBudgetState.historicalData) {
          Object.entries(loadedBudgetState.historicalData).forEach(([month, data]: [string, any]) => {
            const txCount = (data.transactions || []).length;
            if (txCount > 0) {
              console.log(`[INIT] 📊 Month ${month}: ${txCount} transactions LOADED`);
              // Log sample transaction
              if (data.transactions && data.transactions.length > 0) {
                console.log(`[INIT] 📝 Sample tx from ${month}:`, {
                  id: data.transactions[0].id,
                  date: data.transactions[0].date,
                  description: data.transactions[0].description,
                  linkedTransactionId: data.transactions[0].linkedTransactionId
                });
              }
            }
          });
        }
        
        const selectedMonth = loadedBudgetState.selectedMonthKey || state.budgetState.selectedMonthKey;
        if (loadedBudgetState.historicalData && loadedBudgetState.historicalData[selectedMonth]) {
          console.log(`[INIT] 🔍 CRITICAL DEBUG - month ${selectedMonth} data:`, loadedBudgetState.historicalData[selectedMonth]);
          console.log(`[INIT] 🔍 CRITICAL DEBUG - accountBalances in loaded data:`, loadedBudgetState.historicalData[selectedMonth].accountBalances);
          console.log(`[INIT] 🔍 CRITICAL DEBUG - transactions count for ${selectedMonth}:`, (loadedBudgetState.historicalData[selectedMonth].transactions || []).length);
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
        
        // ALWAYS load main categories from storage - no defaults
        const savedMainCategories = get<string[]>(StorageKey.MAIN_CATEGORIES);
        if (savedMainCategories && savedMainCategories.length > 0) {
          state.budgetState.mainCategories = savedMainCategories;
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
    
    // Ensure accounts exist - derive from account category mapping or use standard defaults
    if (!state.budgetState.accounts || state.budgetState.accounts.length === 0) {
      // Check if there's an account category mapping that defines accounts
      const accountNames = Object.keys(state.budgetState.accountCategoryMapping);
      if (accountNames.length > 0) {
        addMobileDebugLog(`[INIT] 📂 Creating accounts from category mapping: ${accountNames.join(', ')}`);
        state.budgetState.accounts = accountNames.map((name) => ({
          id: uuidv4(),
          name: name,
          startBalance: 0
        }));
      } else {
        // Use standard accounts that match the interface shown
        const standardAccounts = ['Löpande', 'Sparkonto', 'Buffert', 'Nöje', 'Hushållskonto'];
        addMobileDebugLog(`[INIT] 📂 Using standard accounts: ${standardAccounts.join(', ')}`);
        state.budgetState.accounts = standardAccounts.map((name) => ({
          id: uuidv4(),
          name: name,
          startBalance: 0
        }));
      }
    }
    
    // STEP 4: MIGRATION - Convert account names to account IDs (One-time operation)
    if (state.budgetState.historicalData && !state.budgetState.migrationVersion) {
      console.log('[MIGRATION] 🔄 Old data structure detected. Starting migration to ID-based accounts...');
      
      const accounts = state.budgetState.accounts || [];
      
      // Go through each month in historical data
      Object.values(state.budgetState.historicalData).forEach((monthData: any) => {
        // Migrate cost groups
        (monthData.costGroups || []).forEach((group: any) => {
          (group.subCategories || []).forEach((sub: any) => {
            if (sub.account && !sub.accountId) {  // If old account field exists but no accountId
              const matchingAccount = accounts.find(acc => acc.name === sub.account);
              if (matchingAccount) {
                sub.accountId = matchingAccount.id;  // Set the new accountId field
                console.log(`[MIGRATION] Converted cost item "${sub.name}" from account "${sub.account}" to accountId "${sub.accountId}"`);
              }
              delete sub.account;  // Remove the old, deprecated field
            }
          });
        });
        
        // Migrate savings groups
        (monthData.savingsGroups || []).forEach((group: any) => {
          (group.subCategories || []).forEach((sub: any) => {
            if (sub.account && !sub.accountId) {  // If old account field exists but no accountId
              const matchingAccount = accounts.find(acc => acc.name === sub.account);
              if (matchingAccount) {
                sub.accountId = matchingAccount.id;  // Set the new accountId field
                console.log(`[MIGRATION] Converted savings item "${sub.name}" from account "${sub.account}" to accountId "${sub.accountId}"`);
              }
              delete sub.account;  // Remove the old, deprecated field
            }
          });
        });
      });
      
      // Mark migration as complete to prevent it from running again
      state.budgetState.migrationVersion = 2;  // Set a version number
      console.log('[MIGRATION] ✅ Migration completed successfully!');
      
      // Save immediately to persist the migrated data
      saveStateToStorage();
    }
    
    // STEP 5: MIGRATION - Move transactions to centralized storage (Migration version 3)
    if (!state.budgetState.migrationVersion || state.budgetState.migrationVersion < 3) {
      console.log('[MIGRATION v3] 🔄 Migrating transactions to centralized storage...');
      
      // Initialize allTransactions if it doesn't exist
      if (!state.budgetState.allTransactions) {
        state.budgetState.allTransactions = [];
      }
      
      // Collect all transactions from monthly storage
      const allTransactions: Transaction[] = [];
      Object.entries(state.budgetState.historicalData).forEach(([monthKey, monthData]) => {
        if (monthData.transactions && monthData.transactions.length > 0) {
          console.log(`[MIGRATION v3] 📊 Found ${monthData.transactions.length} transactions in month ${monthKey}`);
          allTransactions.push(...monthData.transactions);
        }
      });
      
      // Remove duplicates based on transaction ID
      const uniqueTransactions = Array.from(
        new Map(allTransactions.map(tx => [tx.id, tx])).values()
      );
      
      console.log(`[MIGRATION v3] 📊 Total unique transactions: ${uniqueTransactions.length}`);
      state.budgetState.allTransactions = uniqueTransactions;
      
      // Clear transactions from monthly data (they're now in centralized storage)
      Object.values(state.budgetState.historicalData).forEach((monthData) => {
        delete (monthData as any).transactions;
      });
      
      // Update migration version
      state.budgetState.migrationVersion = 3;
      console.log('[MIGRATION v3] ✅ Transaction migration completed successfully!');
      
      // Save immediately to persist the migrated data
      saveStateToStorage();
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
    // CRITICAL: Log transaction counts before saving
    console.log('[BudgetState] 🔍 SAVE DEBUG - Transaction counts BEFORE save:');
    Object.entries(state.budgetState.historicalData).forEach(([month, data]) => {
      const txCount = (data.transactions || []).length;
      if (txCount > 0) {
        console.log(`[BudgetState] 📊 Month ${month}: ${txCount} transactions`);
        // Log sample transaction data
        if (data.transactions && data.transactions.length > 0) {
          console.log(`[BudgetState] 📝 Sample tx from ${month}:`, {
            id: data.transactions[0].id,
            date: data.transactions[0].date,
            description: data.transactions[0].description,
            linkedTransactionId: data.transactions[0].linkedTransactionId
          });
        }
      }
    });
    
    const dataToSave = {
      budgetState: state.budgetState,
      calculated: state.calculated
    };
    set(StorageKey.BUDGET_CALCULATOR_DATA, dataToSave);
    console.log('[BudgetState] ✅ State saved to storage');
    console.log('[BudgetState] SAVE DEBUG - selectedMonthKey:', state.budgetState.selectedMonthKey);
    const saveCurrentMonth = state.budgetState.selectedMonthKey;
    const saveCurrentData = state.budgetState.historicalData[saveCurrentMonth];
    if (saveCurrentData) {
      console.log('[BudgetState] SAVE DEBUG - accountBalances being saved:', saveCurrentData.accountBalances);
      console.log('[BudgetState] SAVE DEBUG - accountBalancesSet being saved:', saveCurrentData.accountBalancesSet);
      console.log(`[BudgetState] SAVE DEBUG - transactions count for ${saveCurrentMonth}:`, (saveCurrentData.transactions || []).length);
    }
  } catch (error) {
    console.error('[BudgetState] ❌ Error saving to storage:', error);
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
      { id: uuidv4(), name: 'Hyra', amount: 15000, type: 'cost' },
      { id: uuidv4(), name: 'Mat & Kläder', amount: 8000, type: 'cost' },
      { id: uuidv4(), name: 'Transport', amount: 2000, type: 'cost', subCategories: [] }
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

// CRITICAL FIX: New function that preserves existing transactions when creating month data
function createEmptyMonthDataWithTransactionPreservation(monthKey: string): MonthData {
  console.log(`[BUDGETSTATE] 🔍 Creating month data for ${monthKey} with transaction preservation`);
  
  // Check if there are any existing transactions for this month across all stored months
  const allTransactions = Object.values(state.budgetState.historicalData)
    .flatMap(month => (month.transactions || []) as any[]);
  
  const existingTransactionsForMonth = allTransactions.filter(tx => {
    const txMonth = tx.date.substring(0, 7); // Get YYYY-MM format
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
