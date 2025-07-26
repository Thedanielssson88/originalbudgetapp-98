// Storage service - Centralized localStorage management
// Single point of contact for all localStorage operations

export const STORAGE_KEYS = {
  // Basic income data
  ANDREAS_SALARY: 'andreasSalary',
  ANDREAS_FORSAKRINGSKASSAN: 'andreasForsakringskassan',
  ANDREAS_BARNBIDRAG: 'andreasBarnbidrag',
  SUSANNA_SALARY: 'susannaSalary',
  SUSANNA_FORSAKRINGSKASSAN: 'susannaForsakringskassan',
  SUSANNA_BARNBIDRAG: 'susannaBarnbidrag',
  
  // Budget categories
  COST_GROUPS: 'costGroups',
  SAVINGS_GROUPS: 'savingsGroups',
  
  // Transfer settings
  DAILY_TRANSFER: 'dailyTransfer',
  WEEKEND_TRANSFER: 'weekendTransfer',
  TRANSFER_ACCOUNT: 'transferAccount',
  
  // Holidays
  CUSTOM_HOLIDAYS: 'customHolidays',
  
  // Historical data and monthly budgets
  HISTORICAL_DATA: 'historicalData',
  
  // Accounts and categories
  ACCOUNTS: 'accounts',
  ACCOUNT_CATEGORIES: 'accountCategories',
  ACCOUNT_CATEGORY_MAPPING: 'accountCategoryMapping',
  
  // Personal budgets
  ANDREAS_PERSONAL_COSTS: 'andreasPersonalCosts',
  ANDREAS_PERSONAL_SAVINGS: 'andreasPersonalSavings',
  SUSANNA_PERSONAL_COSTS: 'susannaPersonalCosts',
  SUSANNA_PERSONAL_SAVINGS: 'susannaPersonalSavings',
  
  // Budget templates
  BUDGET_TEMPLATES: 'budgetTemplates',
  
  // User settings
  USER_NAME_1: 'userName1',
  USER_NAME_2: 'userName2',
  
  // Transfer completion tracking
  TRANSFER_CHECKS: 'transferChecks',
  ANDREAS_SHARE_CHECKED: 'andreasShareChecked',
  SUSANNA_SHARE_CHECKED: 'susannaShareChecked',
  
  // Account balances
  ACCOUNT_BALANCES: 'accountBalances',
  ACCOUNT_BALANCES_SET: 'accountBalancesSet',
  ACCOUNT_ESTIMATED_FINAL_BALANCES: 'accountEstimatedFinalBalances',
  ACCOUNT_ESTIMATED_FINAL_BALANCES_SET: 'accountEstimatedFinalBalancesSet',
  ACCOUNT_ESTIMATED_START_BALANCES: 'accountEstimatedStartBalances',
  ACCOUNT_START_BALANCES_SET: 'accountStartBalancesSet',
  ACCOUNT_END_BALANCES_SET: 'accountEndBalancesSet',
  
  // Chart preferences
  SELECTED_ACCOUNTS_FOR_CHART: 'selectedAccountsForChart',
  SHOW_INDIVIDUAL_COSTS_OUTSIDE_BUDGET: 'showIndividualCostsOutsideBudget',
  SHOW_SAVINGS_SEPARATELY: 'showSavingsSeparately',
  SHOW_ESTIMATED_BUDGET_AMOUNTS: 'showEstimatedBudgetAmounts',
  BALANCE_TYPE: 'balanceType',
  
  // UI state
  EXPANDED_SECTIONS: 'expandedSections',
  EXPANDED_BUDGET_CATEGORIES: 'expandedBudgetCategories',
  EXPANDED_ACCOUNTS: 'expandedAccounts',
  EXPANDED_TEMPLATES: 'expandedTemplates',
  
  // Month management
  MONTH_FINAL_BALANCES: 'monthFinalBalances',
  
  // Chart settings
  USE_CUSTOM_TIME_RANGE: 'useCustomTimeRange',
  CHART_START_MONTH: 'chartStartMonth',
  CHART_END_MONTH: 'chartEndMonth',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Retrieves and parses data from localStorage
 * @param key - The storage key to retrieve
 * @returns Parsed data or null if not found or error occurred
 */
export function get<T = any>(key: StorageKey): T | null {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[StorageService] Error reading from localStorage (key: ${key}):`, error);
    return null;
  }
}

/**
 * Formats and saves data to localStorage
 * @param key - The storage key to save to
 * @param value - The value to save
 */
export function set<T = any>(key: StorageKey, value: T): void {
  try {
    const data = JSON.stringify(value);
    localStorage.setItem(key, data);
  } catch (error) {
    console.error(`[StorageService] Error writing to localStorage (key: ${key}):`, error);
  }
}

/**
 * Removes an item from localStorage
 * @param key - The storage key to remove
 */
export function remove(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[StorageService] Error removing from localStorage (key: ${key}):`, error);
  }
}

/**
 * Checks if a key exists in localStorage
 * @param key - The storage key to check
 * @returns True if key exists, false otherwise
 */
export function exists(key: StorageKey): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error(`[StorageService] Error checking localStorage (key: ${key}):`, error);
    return false;
  }
}

/**
 * Gets multiple values at once
 * @param keys - Array of storage keys to retrieve
 * @returns Object with key-value pairs
 */
export function getMultiple<T = any>(keys: StorageKey[]): Record<string, T | null> {
  const result: Record<string, T | null> = {};
  keys.forEach(key => {
    result[key] = get<T>(key);
  });
  return result;
}

/**
 * Sets multiple values at once
 * @param data - Object with key-value pairs to save
 */
export function setMultiple<T = any>(data: Record<StorageKey, T>): void {
  Object.entries(data).forEach(([key, value]) => {
    set(key as StorageKey, value);
  });
}