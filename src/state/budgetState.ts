// Single Source of Truth state - Simplified architecture

import { get, set, StorageKey } from '../services/storageService';
import { BudgetState, MonthData, Account } from '../types/budget';

interface AppState {
  budgetState: BudgetState;
  calculated: {
    results: any;
    fullPrognosis: any;
  };
}

// Initialize the new simplified state structure
export const state: AppState = {
  budgetState: {
    historicalData: {},
    accounts: [
      { id: '1', name: 'Löpande', startBalance: 0 },
      { id: '2', name: 'Sparkonto', startBalance: 0 },
      { id: '3', name: 'Buffert', startBalance: 0 }
    ],
    selectedMonthKey: '2024-01',
    selectedHistoricalMonth: '2024-01',
    
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
    }
  },
  calculated: {
    results: null,
    fullPrognosis: null
  }
};

export function initializeStateFromStorage(): void {
  try {
    // Try to load from storage
    const savedData = get<any>(StorageKey.BUDGET_CALCULATOR_DATA);
    
    if (savedData) {
      // Migration from old structure to new BudgetState
      if (savedData.rawData) {
        // Old structure - migrate to new
        const oldRawData = savedData.rawData;
        
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
          // ... migrate other fields as needed
        }
      } else if (savedData.budgetState) {
        // New structure - direct load
        state.budgetState = { ...state.budgetState, ...savedData.budgetState };
      }
      
      if (savedData.calculated) {
        state.calculated = savedData.calculated;
      }
    }
    
    // Ensure current month exists
    const currentMonth = state.budgetState.selectedMonthKey;
    if (!state.budgetState.historicalData[currentMonth]) {
      state.budgetState.historicalData[currentMonth] = createEmptyMonthData();
    }
    
    console.log('[BudgetState] State initialized from storage');
  } catch (error) {
    console.error('[BudgetState] Error loading from storage:', error);
    // Keep default state on error
  }
}

export function saveStateToStorage(): void {
  try {
    const dataToSave = {
      budgetState: state.budgetState,
      calculated: state.calculated
    };
    set(StorageKey.BUDGET_CALCULATOR_DATA, dataToSave);
    console.log('[BudgetState] State saved to storage');
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
