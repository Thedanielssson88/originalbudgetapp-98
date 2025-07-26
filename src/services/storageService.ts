// Hanterar all kommunikation med localStorage.

// Använd en enum för att undvika stavfel
export enum StorageKey {
  BUDGET_CALCULATOR_DATA = 'budgetCalculatorData',
  BUDGET_CALCULATOR_BACKUP = 'budgetCalculatorBackup',
  ACCOUNTS = 'accounts',
  COST_GROUPS = 'cost_groups',
  SAVINGS_GROUPS = 'savings_groups',
  MONTHLY_BUDGETS = 'monthly_budgets',
  HISTORICAL_DATA = 'historical_data',
  BUDGET_TEMPLATES = 'budget_templates',
  ACCOUNT_BALANCES = 'account_balances',
  ACCOUNT_CATEGORIES = 'account_categories',
  USER_NAMES = 'user_names',
  TRANSFER_CHECKS = 'transfer_checks',
  CUSTOM_HOLIDAYS = 'custom_holidays',
  CHART_SETTINGS = 'chart_settings'
}

export function get<T>(key: StorageKey): T | null {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) as T : null;
  } catch (error) {
    console.error(`[StorageService] Fel vid läsning (key: ${key}):`, error);
    return null;
  }
}

export function set<T>(key: StorageKey, value: T): void {
  try {
    const data = JSON.stringify(value);
    localStorage.setItem(key, data);
  } catch (error) {
    console.error(`[StorageService] Fel vid skrivning (key: ${key}):`, error);
  }
}

export function remove(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[StorageService] Fel vid borttagning (key: ${key}):`, error);
  }
}

export function exists(key: StorageKey): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error(`[StorageService] Fel vid kontroll av existens (key: ${key}):`, error);
    return false;
  }
}