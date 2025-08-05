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
  CHART_SETTINGS = 'chart_settings',
  MAIN_CATEGORIES = 'main_categories',
  SUBCATEGORIES = 'subcategories',
  BANKS = 'banks',
  BANK_CSV_MAPPINGS = 'bank_csv_mappings',
  CATEGORY_RULES = 'categoryRules',
  CATEGORY_MIGRATION_MAPPING = 'category_migration_mapping',
  CATEGORY_MIGRATION_COMPLETED = 'category_migration_completed'
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
    
    // CRITICAL: Log data size to detect potential localStorage issues
    const sizeInBytes = new Blob([data]).size;
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    console.log(`[StorageService] 💾 Saving ${key}: ${sizeInKB} KB (${sizeInBytes} bytes)`);
    
    // Check if we're approaching localStorage limits (typically 5-10 MB)
    if (sizeInBytes > 4 * 1024 * 1024) { // 4 MB warning threshold
      console.warn(`[StorageService] ⚠️ WARNING: Large data size for ${key}: ${sizeInKB} KB`);
    }
    
    localStorage.setItem(key, data);
    
    // CRITICAL: Verify the data was actually saved
    const savedData = localStorage.getItem(key);
    if (!savedData) {
      console.error(`[StorageService] ❌ CRITICAL: Failed to save ${key} - data not found after save!`);
    } else if (savedData !== data) {
      console.error(`[StorageService] ❌ CRITICAL: Data corruption detected for ${key} - saved data doesn't match!`);
    } else {
      console.log(`[StorageService] ✅ Successfully saved ${key}`);
    }
  } catch (error) {
    console.error(`[StorageService] ❌ Fel vid skrivning (key: ${key}):`, error);
    // Log specific error details
    if (error instanceof Error) {
      if (error.name === 'QuotaExceededError') {
        console.error(`[StorageService] ❌ localStorage quota exceeded! Cannot save ${key}`);
      }
      console.error(`[StorageService] Error details:`, error.message);
    }
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