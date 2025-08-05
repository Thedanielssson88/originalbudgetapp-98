// Definierar och hanterar vårt centrala state.

import { get, set, StorageKey } from '../services/storageService';
import { RawDataState, CalculatedState, BudgetGroup } from '../types/budget';

interface AppState {
  rawData: RawDataState;
  calculated: CalculatedState;
}

export const state: AppState = {
  rawData: {
    // Income data
    andreasSalary: 0,
    andreasförsäkringskassan: 0,
    andreasbarnbidrag: 0,
    susannaSalary: 0,
    susannaförsäkringskassan: 0,
    susannabarnbidrag: 0,
    
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
  const savedData = get<any>(StorageKey.BUDGET_CALCULATOR_DATA);
  
  if (savedData) {
    try {
      // Handle migration from old data format
      if (savedData.budgetGroups && !savedData.costGroups) {
        console.log('Migrating old budget data format to new format');
        const migratedCostGroups = savedData.budgetGroups.map((group: any) => ({
          ...group,
          type: 'cost'
        }));
        state.rawData.costGroups = migratedCostGroups;
      } else {
        state.rawData.costGroups = savedData.costGroups || state.rawData.costGroups;
      }
      
      // Load all saved values with backward compatibility
      state.rawData.andreasSalary = savedData.andreasSalary || 45000;
      state.rawData.andreasförsäkringskassan = savedData.andreasförsäkringskassan || 0;
      state.rawData.andreasbarnbidrag = savedData.andreasbarnbidrag || 0;
      state.rawData.susannaSalary = savedData.susannaSalary || 40000;
      state.rawData.susannaförsäkringskassan = savedData.susannaförsäkringskassan || savedData.försäkringskassan || 5000;
      state.rawData.susannabarnbidrag = savedData.susannabarnbidrag || 0;
      
      state.rawData.savingsGroups = savedData.savingsGroups || [];
      state.rawData.dailyTransfer = savedData.dailyTransfer || 300;
      state.rawData.weekendTransfer = savedData.weekendTransfer || 540;
      state.rawData.customHolidays = savedData.customHolidays || [];
      
      // Load personal budget data
      state.rawData.andreasPersonalCosts = savedData.andreasPersonalCosts || [];
      state.rawData.andreasPersonalSavings = savedData.andreasPersonalSavings || [];
      state.rawData.susannaPersonalCosts = savedData.susannaPersonalCosts || [];
      state.rawData.susannaPersonalSavings = savedData.susannaPersonalSavings || [];
      
      // Load historical data
      state.rawData.historicalData = savedData.historicalData || {};
      
      // Load accounts data
      state.rawData.accounts = savedData.accounts || ['Löpande', 'Sparkonto', 'Buffert'];
      
      // Load account categories data
      state.rawData.accountCategories = savedData.accountCategories || ['Privat', 'Gemensam', 'Sparande', 'Hushåll'];
      state.rawData.accountCategoryMapping = savedData.accountCategoryMapping || {};
      
      // Load budget templates
      state.rawData.budgetTemplates = savedData.budgetTemplates || {};
      
      // Load user names
      state.rawData.userName1 = savedData.userName1 || 'Andreas';
      state.rawData.userName2 = savedData.userName2 || 'Susanna';
      
      // Load transfer checkbox states
      state.rawData.transferChecks = savedData.transferChecks || {};
      state.rawData.andreasShareChecked = savedData.andreasShareChecked || false;
      state.rawData.susannaShareChecked = savedData.susannaShareChecked || false;
      
      // Load account balances
      state.rawData.accountBalances = savedData.accountBalances || {};
      state.rawData.accountBalancesSet = savedData.accountBalancesSet || {};
      
      // Load account final balances
      state.rawData.accountEstimatedFinalBalances = savedData.accountEstimatedFinalBalances || {};
      state.rawData.accountEstimatedFinalBalancesSet = savedData.accountEstimatedFinalBalancesSet || {};
      
      // Load month final balances flags
      state.rawData.monthFinalBalances = savedData.monthFinalBalances || {};
      
      // Load account estimated start balances
      state.rawData.accountEstimatedStartBalances = savedData.accountEstimatedStartBalances || {};
      state.rawData.accountStartBalancesSet = savedData.accountStartBalancesSet || {};
      state.rawData.accountEndBalancesSet = savedData.accountEndBalancesSet || {};
      
      // Load selected accounts for chart
      state.rawData.selectedAccountsForChart = savedData.selectedAccountsForChart || [];
      
      // Load chart settings
      state.rawData.showIndividualCostsOutsideBudget = savedData.showIndividualCostsOutsideBudget || false;
      state.rawData.showSavingsSeparately = savedData.showSavingsSeparately || false;
      state.rawData.useCustomTimeRange = savedData.useCustomTimeRange || false;
      state.rawData.chartStartMonth = savedData.chartStartMonth || '';
      state.rawData.chartEndMonth = savedData.chartEndMonth || '';
      state.rawData.balanceType = savedData.balanceType || 'closing';
      state.rawData.showEstimatedBudgetAmounts = savedData.showEstimatedBudgetAmounts || false;
      
      // Load the previously selected budget month or default to current month
      const currentDate = new Date();
      const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      state.rawData.selectedBudgetMonth = savedData.selectedBudgetMonth || currentMonthKey;
      state.rawData.selectedHistoricalMonth = savedData.selectedHistoricalMonth || '';
      
      if (savedData.results) {
        state.calculated.results = savedData.results;
      }
      
      console.log('[State] State har initierats från localStorage.');
    } catch (error) {
      console.error('[State] Fel vid initiering från localStorage:', error);
      // Set current month as default even on error
      const currentDate = new Date();
      const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      state.rawData.selectedBudgetMonth = currentMonthKey;
    }
  } else {
    // If no saved data, set current month as default
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    state.rawData.selectedBudgetMonth = currentMonthKey;
    console.log('[State] Ingen sparad data hittades, använder standardvärden.');
  }
}

export function saveStateToStorage(): void {
  try {
    const dataToSave = {
      ...state.rawData,
      results: state.calculated.results
    };
    set(StorageKey.BUDGET_CALCULATOR_DATA, dataToSave);
    console.log('[State] State sparad till localStorage.');
  } catch (error) {
    console.error('[State] Fel vid sparning till localStorage:', error);
  }
}