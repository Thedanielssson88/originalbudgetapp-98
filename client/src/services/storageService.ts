// Handles localStorage communication for UI preferences only.
// Application data is now stored in the database via API.

// UI preferences and session data only
export enum StorageKey {
  // Google Drive OAuth (temporary session data)
  GOOGLE_DRIVE_ACCESS_TOKEN = 'googleDriveAccessToken',
  GOOGLE_DRIVE_USER_EMAIL = 'googleDriveUserEmail',
  
  // UI preferences
  THEME = 'theme',
  SIDEBAR_COLLAPSED = 'sidebarCollapsed',
  CHART_SETTINGS = 'chartSettings',
  TABLE_COLUMN_VISIBILITY = 'tableColumnVisibility',
  DASHBOARD_LAYOUT = 'dashboardLayout',
  
  // Temporary UI state
  SELECTED_MONTH = 'selectedMonth',
  ACTIVE_TAB = 'activeTab',
  EXPANDED_SECTIONS = 'expandedSections',
  
  // Development/debug preferences
  DEBUG_MODE = 'debugMode',
  SHOW_MOBILE_DEBUG = 'showMobileDebug',
  
  // Legacy backup (for emergency data recovery only)
  LEGACY_BACKUP = 'legacyBackup',
  
  // Legacy keys (deprecated - kept for compatibility to prevent crashes)
  SUBCATEGORIES = 'subcategories_DEPRECATED',
  MAIN_CATEGORIES = 'main_categories_DEPRECATED', 
  CATEGORY_RULES = 'categoryRules_DEPRECATED',
  BUDGET_CALCULATOR_DATA = 'budgetCalculatorData_DEPRECATED',
  CATEGORY_MIGRATION_MAPPING = 'category_migration_mapping_DEPRECATED',
  CATEGORY_MIGRATION_COMPLETED = 'category_migration_completed_DEPRECATED'
}

export function get<T>(key: StorageKey): T | null {
  try {
    // Handle deprecated keys with empty defaults to prevent crashes
    if (key.endsWith('_DEPRECATED')) {
      console.warn(`[StorageService] Deprecated key accessed: ${key} - returning empty default`);
      
      if (key === StorageKey.SUBCATEGORIES) return {} as T;
      if (key === StorageKey.MAIN_CATEGORIES) return [] as T;
      if (key === StorageKey.CATEGORY_RULES) return [] as T;
      if (key === StorageKey.BUDGET_CALCULATOR_DATA) return null;
      if (key === StorageKey.CATEGORY_MIGRATION_MAPPING) return {} as T;
      if (key === StorageKey.CATEGORY_MIGRATION_COMPLETED) return null;
      
      return null;
    }
    
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) as T : null;
  } catch (error) {
    console.error(`[StorageService] Failed to read (key: ${key}):`, error);
    return null;
  }
}

// Legacy compatibility function for removed StorageKey values
export function getLegacy<T>(keyName: string): T | null {
  try {
    // Return empty defaults for removed localStorage keys to prevent crashes
    console.warn(`[StorageService] Legacy key accessed: ${keyName} - returning empty default`);
    
    if (keyName === 'SUBCATEGORIES') return {} as T;
    if (keyName === 'MAIN_CATEGORIES') return [] as T;
    if (keyName === 'CATEGORY_RULES') return [] as T;
    if (keyName === 'BUDGET_CALCULATOR_DATA') return null;
    if (keyName === 'CATEGORY_MIGRATION_MAPPING') return {} as T;
    if (keyName === 'CATEGORY_MIGRATION_COMPLETED') return null;
    
    return null;
  } catch (error) {
    console.error(`[StorageService] Failed to read legacy key (${keyName}):`, error);
    return null;
  }
}

export function set<T>(key: StorageKey, value: T): void {
  try {
    // Handle deprecated keys - just log the attempt and ignore
    if (key.endsWith('_DEPRECATED')) {
      console.warn(`[StorageService] Attempt to save deprecated key: ${key} - ignoring (data should be saved via API)`);
      return;
    }
    
    const data = JSON.stringify(value);
    localStorage.setItem(key, data);
    console.log(`[StorageService] ✅ Saved UI preference: ${key}`);
  } catch (error) {
    console.error(`[StorageService] ❌ Failed to save UI preference (key: ${key}):`, error);
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error(`[StorageService] ❌ localStorage quota exceeded for UI preferences!`);
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
    console.error(`[StorageService] Failed to check existence (key: ${key}):`, error);
    return false;
  }
}

// Direct localStorage utilities for migration and special cases
export function getDirectly(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`[StorageService] Failed to read directly (key: ${key}):`, error);
    return null;
  }
}

export function setDirectly(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`[StorageService] Failed to save directly (key: ${key}):`, error);
  }
}

export function removeDirectly(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[StorageService] Failed to remove directly (key: ${key}):`, error);
  }
}