// Definierar och hanterar vårt centrala state.

import { get, set, StorageKey } from '../services/storageService';
import { RawDataState, CalculatedState, BudgetGroup } from '../types/budget';

interface AppState {
  rawData: RawDataState;
  calculated: CalculatedState;
}

export const state: AppState = {
  rawData: {
    
    // Budget groups
    costGroups: [
      { id: '1', name: 'Hyra', amount: 15000, type: 'cost' },
      { id: '2', name: 'Mat & Kläder', amount: 8000, type: 'cost' },
      { id: '3', name: 'Transport', amount: 2000, type: 'cost', subCategories: [] }
    ],
    savingsGroups: [],
    
    // Transfer data
    dailyTransfer: 300,
    weekendTransfer: 540,
    
    // Holiday data
    customHolidays: [],
    
    // Personal budgets
    andreasPersonalCosts: [],
    andreasPersonalSavings: [],
    susannaPersonalCosts: [],
    susannaPersonalSavings: [],
    
    // Account data
    accounts: ['Löpande', 'Sparkonto', 'Buffert'],
    accountBalances: {},
    accountBalancesSet: {},
    accountEstimatedFinalBalances: {},
    accountEstimatedFinalBalancesSet: {},
    accountEstimatedStartBalances: {},
    accountStartBalancesSet: {},
    accountEndBalancesSet: {},
    
    // Category data
    accountCategories: ['Privat', 'Gemensam', 'Sparande', 'Hushåll'],
    accountCategoryMapping: {},
    
    // Template data
    budgetTemplates: {},
    
    // Historical data
    monthlyBudgets: {},
    historicalData: {},
    
    // UI state
    selectedBudgetMonth: '',
    selectedHistoricalMonth: '',
    
    // User data
    userName1: 'Andreas',
    userName2: 'Susanna',
    
    // Transfer completion state
    transferChecks: {},
    andreasShareChecked: false,
    susannaShareChecked: false,
    
    // Chart settings
    selectedAccountsForChart: [],
    showIndividualCostsOutsideBudget: false,
    showSavingsSeparately: false,
    useCustomTimeRange: false,
    chartStartMonth: '',
    chartEndMonth: '',
    balanceType: 'closing',
    showEstimatedBudgetAmounts: false,
    
    // Month completion flags
    monthFinalBalances: {}
  },
  calculated: {
    results: null,
    fullPrognosis: null,
  }
};

export function initializeStateFromStorage(): void {
  // DEPRECATED: This function is no longer used as data comes from API
  // TODO: Remove this function completely after migration is complete
  console.warn('[State] initializeStateFromStorage is deprecated - data should come from API');
  
  // Set current month as default since we no longer use localStorage
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  state.rawData.selectedBudgetMonth = currentMonthKey;
  console.log('[State] Using default values since localStorage is deprecated.');
}

export function saveStateToStorage(): void {
  // DEPRECATED: This function is no longer used as data is saved via API
  // TODO: Remove this function completely after migration is complete
  console.warn('[State] saveStateToStorage is deprecated - data should be saved via API');
}