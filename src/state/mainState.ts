// Main state management - Single source of truth for the application
import * as storage from '../services/storageService';
import { AppState, RawDataState, CalculatedState, BudgetGroup, Holiday } from '../types/budget';

// Central state object - Single source of truth
export const state: AppState = {
  rawData: {
    // Basic income settings - defaults that match current component
    andreasSalary: 45000,
    andreasForsakringskassan: 0,
    andreasBarnbidrag: 0,
    susannaSalary: 40000,
    susannaForsakringskassan: 5000,
    susannaBarnbidrag: 0,
    
    // Budget categories - defaults that match current component
    costGroups: [
      { id: '1', name: 'Hyra', amount: 15000, type: 'cost' },
      { id: '2', name: 'Mat & Kläder', amount: 8000, type: 'cost' },
      { id: '3', name: 'Transport', amount: 2000, type: 'cost', subCategories: [] }
    ],
    savingsGroups: [],
    
    // Transfer settings
    dailyTransfer: 300,
    weekendTransfer: 540,
    transferAccount: 0,
    
    // Holidays
    customHolidays: [],
    
    // Monthly historical data
    historicalData: {},
    
    // Accounts and categories
    accounts: ['Löpande', 'Sparkonto', 'Buffert'],
    accountCategories: ['Privat', 'Gemensam', 'Sparande', 'Hushåll'],
    accountCategoryMapping: {},
    
    // Personal budgets
    andreasPersonalCosts: [],
    andreasPersonalSavings: [],
    susannaPersonalCosts: [],
    susannaPersonalSavings: [],
    
    // Budget templates
    budgetTemplates: {},
    
    // User settings
    userName1: 'Andreas',
    userName2: 'Susanna',
    
    // Global transfer completion tracking
    transferChecks: {},
    andreasShareChecked: false,
    susannaShareChecked: false,
    
    // Chart preferences
    selectedAccountsForChart: [],
    showIndividualCostsOutsideBudget: false,
    showSavingsSeparately: false,
    showEstimatedBudgetAmounts: false,
    balanceType: 'closing',
    
    // UI state
    expandedSections: {
      costCategories: false,
      savingsCategories: false,
      budgetTransfers: false,
      redDays: false,
      editMonths: false,
      monthSelector: false,
      accountSummary: false,
      budgetTemplates: false,
      totalIncome: false,
      budgetSummary: false,
      remainingToAllocate: false,
      incomeDetails: false,
      costDetails: false,
      transferDetails: false,
      budgetIncome: false,
      budgetCosts: false,
      budgetTransfer: false,
      budgetCategories: false,
      andreasDetails: false,
      susannaDetails: false,
      remainingAmountDistribution: false,
      remainingDailyBudgetDistribution: false,
      individualSharesDistribution: false,
      dailyTransferDetails: false,
      accountBalances: false,
      finalAccountSummary: false
    },
    expandedBudgetCategories: {},
    expandedAccounts: {},
    expandedTemplates: {},
    
    // Chart settings
    useCustomTimeRange: false,
    chartStartMonth: '',
    chartEndMonth: '',
  },
  
  // Calculated data - computed from rawData
  calculated: {
    monthlyResults: {},
    accountSummaries: {},
    chartData: [],
    accountDataRows: []
  }
};

/**
 * Loads all raw data from localStorage into the state object
 * This runs once when the app starts
 */
export function initializeState(): void {
  console.log('[MainState] Initializing state from localStorage...');
  
  // Load basic income data
  state.rawData.andreasSalary = storage.get(storage.STORAGE_KEYS.ANDREAS_SALARY) || state.rawData.andreasSalary;
  state.rawData.andreasForsakringskassan = storage.get(storage.STORAGE_KEYS.ANDREAS_FORSAKRINGSKASSAN) || state.rawData.andreasForsakringskassan;
  state.rawData.andreasBarnbidrag = storage.get(storage.STORAGE_KEYS.ANDREAS_BARNBIDRAG) || state.rawData.andreasBarnbidrag;
  state.rawData.susannaSalary = storage.get(storage.STORAGE_KEYS.SUSANNA_SALARY) || state.rawData.susannaSalary;
  state.rawData.susannaForsakringskassan = storage.get(storage.STORAGE_KEYS.SUSANNA_FORSAKRINGSKASSAN) || state.rawData.susannaForsakringskassan;
  state.rawData.susannaBarnbidrag = storage.get(storage.STORAGE_KEYS.SUSANNA_BARNBIDRAG) || state.rawData.susannaBarnbidrag;
  
  // Load budget categories
  state.rawData.costGroups = storage.get<BudgetGroup[]>(storage.STORAGE_KEYS.COST_GROUPS) || state.rawData.costGroups;
  state.rawData.savingsGroups = storage.get<BudgetGroup[]>(storage.STORAGE_KEYS.SAVINGS_GROUPS) || state.rawData.savingsGroups;
  
  // Load transfer settings
  state.rawData.dailyTransfer = storage.get(storage.STORAGE_KEYS.DAILY_TRANSFER) || state.rawData.dailyTransfer;
  state.rawData.weekendTransfer = storage.get(storage.STORAGE_KEYS.WEEKEND_TRANSFER) || state.rawData.weekendTransfer;
  state.rawData.transferAccount = storage.get(storage.STORAGE_KEYS.TRANSFER_ACCOUNT) || state.rawData.transferAccount;
  
  // Load holidays
  state.rawData.customHolidays = storage.get<Holiday[]>(storage.STORAGE_KEYS.CUSTOM_HOLIDAYS) || state.rawData.customHolidays;
  
  // Load historical data
  state.rawData.historicalData = storage.get(storage.STORAGE_KEYS.HISTORICAL_DATA) || state.rawData.historicalData;
  
  // Load accounts and categories
  state.rawData.accounts = storage.get<string[]>(storage.STORAGE_KEYS.ACCOUNTS) || state.rawData.accounts;
  state.rawData.accountCategories = storage.get<string[]>(storage.STORAGE_KEYS.ACCOUNT_CATEGORIES) || state.rawData.accountCategories;
  state.rawData.accountCategoryMapping = storage.get(storage.STORAGE_KEYS.ACCOUNT_CATEGORY_MAPPING) || state.rawData.accountCategoryMapping;
  
  // Load personal budgets
  state.rawData.andreasPersonalCosts = storage.get<BudgetGroup[]>(storage.STORAGE_KEYS.ANDREAS_PERSONAL_COSTS) || state.rawData.andreasPersonalCosts;
  state.rawData.andreasPersonalSavings = storage.get<BudgetGroup[]>(storage.STORAGE_KEYS.ANDREAS_PERSONAL_SAVINGS) || state.rawData.andreasPersonalSavings;
  state.rawData.susannaPersonalCosts = storage.get<BudgetGroup[]>(storage.STORAGE_KEYS.SUSANNA_PERSONAL_COSTS) || state.rawData.susannaPersonalCosts;
  state.rawData.susannaPersonalSavings = storage.get<BudgetGroup[]>(storage.STORAGE_KEYS.SUSANNA_PERSONAL_SAVINGS) || state.rawData.susannaPersonalSavings;
  
  // Load budget templates
  state.rawData.budgetTemplates = storage.get(storage.STORAGE_KEYS.BUDGET_TEMPLATES) || state.rawData.budgetTemplates;
  
  // Load user settings
  state.rawData.userName1 = storage.get(storage.STORAGE_KEYS.USER_NAME_1) || state.rawData.userName1;
  state.rawData.userName2 = storage.get(storage.STORAGE_KEYS.USER_NAME_2) || state.rawData.userName2;
  
  // Load transfer completion tracking
  state.rawData.transferChecks = storage.get(storage.STORAGE_KEYS.TRANSFER_CHECKS) || state.rawData.transferChecks;
  state.rawData.andreasShareChecked = storage.get(storage.STORAGE_KEYS.ANDREAS_SHARE_CHECKED) || state.rawData.andreasShareChecked;
  state.rawData.susannaShareChecked = storage.get(storage.STORAGE_KEYS.SUSANNA_SHARE_CHECKED) || state.rawData.susannaShareChecked;
  
  // Load chart preferences
  state.rawData.selectedAccountsForChart = storage.get<string[]>(storage.STORAGE_KEYS.SELECTED_ACCOUNTS_FOR_CHART) || state.rawData.selectedAccountsForChart;
  state.rawData.showIndividualCostsOutsideBudget = storage.get(storage.STORAGE_KEYS.SHOW_INDIVIDUAL_COSTS_OUTSIDE_BUDGET) || state.rawData.showIndividualCostsOutsideBudget;
  state.rawData.showSavingsSeparately = storage.get(storage.STORAGE_KEYS.SHOW_SAVINGS_SEPARATELY) || state.rawData.showSavingsSeparately;
  state.rawData.showEstimatedBudgetAmounts = storage.get(storage.STORAGE_KEYS.SHOW_ESTIMATED_BUDGET_AMOUNTS) || state.rawData.showEstimatedBudgetAmounts;
  state.rawData.balanceType = storage.get(storage.STORAGE_KEYS.BALANCE_TYPE) || state.rawData.balanceType;
  
  // Load UI state
  const expandedSections = storage.get(storage.STORAGE_KEYS.EXPANDED_SECTIONS);
  if (expandedSections) {
    state.rawData.expandedSections = { ...state.rawData.expandedSections, ...expandedSections };
  }
  state.rawData.expandedBudgetCategories = storage.get(storage.STORAGE_KEYS.EXPANDED_BUDGET_CATEGORIES) || state.rawData.expandedBudgetCategories;
  state.rawData.expandedAccounts = storage.get(storage.STORAGE_KEYS.EXPANDED_ACCOUNTS) || state.rawData.expandedAccounts;
  state.rawData.expandedTemplates = storage.get(storage.STORAGE_KEYS.EXPANDED_TEMPLATES) || state.rawData.expandedTemplates;
  
  // Load chart settings
  state.rawData.useCustomTimeRange = storage.get(storage.STORAGE_KEYS.USE_CUSTOM_TIME_RANGE) || state.rawData.useCustomTimeRange;
  state.rawData.chartStartMonth = storage.get(storage.STORAGE_KEYS.CHART_START_MONTH) || state.rawData.chartStartMonth;
  state.rawData.chartEndMonth = storage.get(storage.STORAGE_KEYS.CHART_END_MONTH) || state.rawData.chartEndMonth;
  
  console.log('[MainState] State initialization complete');
}

/**
 * Updates a specific part of raw data and saves it to localStorage
 * @param key - The storage key to update
 * @param value - The new value
 * @param statePath - The path in state.rawData to update (dot notation)
 */
export function updateRawData<T = any>(key: storage.StorageKey, value: T, statePath: string): void {
  // Save to localStorage immediately for persistence
  storage.set(key, value);
  
  // Update in-memory state
  const pathParts = statePath.split('.');
  let currentObj: any = state.rawData;
  
  for (let i = 0; i < pathParts.length - 1; i++) {
    currentObj = currentObj[pathParts[i]];
  }
  
  currentObj[pathParts[pathParts.length - 1]] = value;
  
  console.log(`[MainState] Updated ${statePath} with new value`);
}

/**
 * Gets the current raw data state
 */
export function getRawData(): RawDataState {
  return state.rawData;
}

/**
 * Gets the current calculated state
 */
export function getCalculatedData(): CalculatedState {
  return state.calculated;
}

/**
 * Updates the calculated state (in-memory only, not persisted)
 * @param newCalculatedState - The new calculated state
 */
export function updateCalculatedState(newCalculatedState: Partial<CalculatedState>): void {
  state.calculated = { ...state.calculated, ...newCalculatedState };
  console.log('[MainState] Updated calculated state');
}