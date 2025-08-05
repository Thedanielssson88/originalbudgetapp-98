// Category Migration Service - Migrates from string-based to UUID-based categories
import { StorageKey, get, set } from './storageService';

export interface MigrationResult {
  huvudkategorier: Array<{ id: string; name: string }>;
  underkategorier: Array<{ id: string; name: string; huvudkategoriId: string }>;
  categoryMapping: Record<string, string>; // name -> UUID mapping
}

/**
 * Migrates existing localStorage categories to UUID-based database categories
 */
export async function migrateCategoriesFromLocalStorage(): Promise<MigrationResult> {
  console.log('🔄 Starting category migration from localStorage to UUID-based system...');
  
  // Get current localStorage categories
  const mainCategories = get<string[]>(StorageKey.MAIN_CATEGORIES) || [];
  const subcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
  
  console.log('📋 Found localStorage categories:', {
    mainCategories: mainCategories.length,
    subcategories: Object.keys(subcategories).length
  });

  if (mainCategories.length === 0) {
    console.log('⚠️ No main categories found in localStorage, nothing to migrate');
    return {
      huvudkategorier: [],
      underkategorier: [],
      categoryMapping: {}
    };
  }

  try {
    // Call migration API endpoint
    const response = await fetch('/api/migrate-categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mainCategories,
        subcategories
      })
    });

    if (!response.ok) {
      throw new Error(`Migration API failed: ${response.statusText}`);
    }

    const migrationResult = await response.json() as MigrationResult;

    console.log('✅ Migration completed successfully:', migrationResult);
    
    // Store the category mapping for future reference
    set(StorageKey.CATEGORY_MIGRATION_MAPPING, migrationResult.categoryMapping);
    set(StorageKey.CATEGORY_MIGRATION_COMPLETED, new Date().toISOString());
    
    return migrationResult;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw new Error(`Category migration failed: ${error}`);
  }
}

/**
 * Converts old string-based category references to UUID references
 */
export function convertCategoryNamesToUUIDs(
  categoryName: string, 
  subcategoryName: string | undefined,
  categoryMapping: Record<string, string>
): { huvudkategoriId?: string; underkategoriId?: string } {
  const huvudkategoriId = categoryMapping[categoryName];
  let underkategoriId: string | undefined;
  
  if (subcategoryName && huvudkategoriId) {
    underkategoriId = categoryMapping[`${categoryName}:${subcategoryName}`];
  }
  
  return { huvudkategoriId, underkategoriId };
}

/**
 * Updates existing transactions to use UUID-based category references
 */
export async function migrateTransactionCategories(categoryMapping: Record<string, string>): Promise<void> {
  console.log('🔄 Migrating transaction categories to UUID-based system...');
  
  // Get transactions from localStorage for now (since we're migrating from localStorage-based system)
  const allTransactionsData = get(StorageKey.BUDGET_CALCULATOR_DATA);
  let migratedCount = 0;
  
  if (allTransactionsData && typeof allTransactionsData === 'object') {
    // Look for transaction data in various possible locations in localStorage
    const dataObj = allTransactionsData as any;
    const transactionSources = [
      dataObj.allTransactions,
      dataObj.transactions,
      dataObj.budgetState?.allTransactions
    ].filter(Boolean);
    
    for (const transactionArray of transactionSources) {
      if (Array.isArray(transactionArray)) {
        for (const transaction of transactionArray) {
          // Skip if already using UUIDs (UUIDs contain hyphens, category names typically don't)
          if (transaction.appCategoryId?.includes('-') && transaction.appSubCategoryId?.includes('-')) {
            continue;
          }
          
          const { huvudkategoriId, underkategoriId } = convertCategoryNamesToUUIDs(
            transaction.appCategoryId || '',
            transaction.appSubCategoryId,
            categoryMapping
          );
          
          if (huvudkategoriId) {
            transaction.appCategoryId = huvudkategoriId;
            transaction.appSubCategoryId = underkategoriId;
            migratedCount++;
          }
        }
      }
    }
    
    // Save the updated data back to localStorage
    set(StorageKey.BUDGET_CALCULATOR_DATA, allTransactionsData);
  }
  
  console.log(`✅ Migrated ${migratedCount} transactions to UUID-based categories`);
}

/**
 * Checks if migration has been completed
 */
export function isMigrationCompleted(): boolean {
  const migrationDate = get<string>(StorageKey.CATEGORY_MIGRATION_COMPLETED);
  return !!migrationDate;
}

/**
 * Gets the category mapping from migration
 */
export function getCategoryMapping(): Record<string, string> {
  return get<Record<string, string>>(StorageKey.CATEGORY_MIGRATION_MAPPING) || {};
}

/**
 * Performs complete migration from string-based to UUID-based categories
 */
export async function performCompleteMigration(): Promise<MigrationResult> {
  console.log('🚀 Starting complete category migration...');
  
  // Step 1: Migrate categories from localStorage to database
  const migrationResult = await migrateCategoriesFromLocalStorage();
  
  // Step 2: Update existing transactions
  await migrateTransactionCategories(migrationResult.categoryMapping);
  
  // Step 3: Mark migration as completed
  set(StorageKey.CATEGORY_MIGRATION_MAPPING, migrationResult.categoryMapping);
  set(StorageKey.CATEGORY_MIGRATION_COMPLETED, new Date().toISOString());
  
  console.log('🎉 Complete migration finished successfully!');
  return migrationResult;
}

/**
 * Force complete migration with existing UUID database data
 */
export async function forceCompleteMigration(): Promise<void> {
  console.log('🚀 Force completing migration with existing UUID database...');
  
  try {
    // Fetch existing UUID categories from database
    const [huvudkategorierResponse, underkategorierResponse] = await Promise.all([
      fetch('/api/huvudkategorier'),
      fetch('/api/underkategorier')
    ]);
    
    if (!huvudkategorierResponse.ok || !underkategorierResponse.ok) {
      throw new Error('Failed to fetch UUID categories from database');
    }
    
    const huvudkategorier = await huvudkategorierResponse.json();
    const underkategorier = await underkategorierResponse.json();
    
    // Build category mapping
    const categoryMapping: Record<string, string> = {};
    
    // Map main categories
    huvudkategorier.forEach((cat: any) => {
      categoryMapping[cat.name] = cat.id;
    });
    
    // Map subcategories
    underkategorier.forEach((sub: any) => {
      const huvudkategori = huvudkategorier.find((h: any) => h.id === sub.huvudkategoriId);
      if (huvudkategori) {
        categoryMapping[`${huvudkategori.name}:${sub.name}`] = sub.id;
      }
    });
    
    // Save migration completion
    set(StorageKey.CATEGORY_MIGRATION_MAPPING, categoryMapping);
    set(StorageKey.CATEGORY_MIGRATION_COMPLETED, new Date().toISOString());
    
    console.log('✅ Force migration completed with mapping:', categoryMapping);
    
    // Trigger page reload to switch to UUID system
    window.location.reload();
    
  } catch (error) {
    console.error('❌ Force migration failed:', error);
    throw error;
  }
}