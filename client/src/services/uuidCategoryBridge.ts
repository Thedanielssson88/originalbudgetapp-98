// Bridge service to convert old string-based categories to UUID categories
// This ensures the entire budget system uses UUID categories

import { useCategoryResolver } from '../hooks/useCategories';
import { StorageKey, get } from './storageService';
import { state } from '../state/budgetState';
import { BudgetItem, SubCategory, BudgetGroup } from '../types/budget';

/**
 * Service to bridge old string-based categories to UUID categories
 * This is critical for making the budget calculations work with UUID categories
 */
export class UuidCategoryBridge {
  
  /**
   * Convert old mainCategoryId (string like "1", "2") to UUID by mapping through category names
   */
  static convertStringCategoryToUuid(
    mainCategoryId: string,
    subCategoryId: string,
    huvudkategorier: any[],
    underkategorier: any[]
  ): { mainUuid: string | null, subUuid: string | null } {
    
    // Get old string-based categories from localStorage
    const oldMainCategories = get<string[]>(StorageKey.MAIN_CATEGORIES) || [];
    const oldSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
    
    let mainUuid: string | null = null;
    let subUuid: string | null = null;
    
    try {
      // Convert mainCategoryId (which might be a numeric string like "1", "2") to category name
      const mainCategoryIndex = parseInt(mainCategoryId) - 1; // Assuming 1-based indexing
      const mainCategoryName = oldMainCategories[mainCategoryIndex];
      
      if (mainCategoryName) {
        // Find UUID for this category name
        const huvudkategori = huvudkategorier.find(kat => kat.name === mainCategoryName);
        mainUuid = huvudkategori?.id || null;
        
        // Convert subcategory
        if (subCategoryId && oldSubcategories[mainCategoryName]) {
          const subCategoryIndex = parseInt(subCategoryId) - 1; // Assuming 1-based indexing
          const subCategoryName = oldSubcategories[mainCategoryName][subCategoryIndex];
          
          if (subCategoryName && huvudkategori) {
            const underkategori = underkategorier.find(kat => 
              kat.name === subCategoryName && kat.huvudkategoriId === huvudkategori.id
            );
            subUuid = underkategori?.id || null;
          }
        }
      }
    } catch (error) {
      console.warn('Error converting string category to UUID:', error);
    }
    
    return { mainUuid, subUuid };
  }
  
  /**
   * Convert BudgetItems to use UUID categories
   */
  static convertBudgetItemsToUuid(
    items: BudgetItem[],
    huvudkategorier: any[],
    underkategorier: any[]
  ): BudgetItem[] {
    return items.map(item => {
      const { mainUuid, subUuid } = this.convertStringCategoryToUuid(
        item.mainCategoryId,
        item.subCategoryId,
        huvudkategorier,
        underkategorier
      );
      
      return {
        ...item,
        mainCategoryId: mainUuid || item.mainCategoryId,
        subCategoryId: subUuid || item.subCategoryId
      };
    });
  }
  
  /**
   * Convert legacy SubCategory objects to use UUID categories
   */
  static convertSubCategoriesToUuid(
    subCategories: SubCategory[],
    groupName: string,
    huvudkategorier: any[],
    underkategorier: any[]
  ): SubCategory[] {
    return subCategories.map(subCat => {
      // For SubCategory, the ID might actually be a UUID already or a string index
      // We need to find the right UUID based on the group name and subcategory name
      const huvudkategori = huvudkategorier.find(kat => kat.name === groupName);
      
      if (huvudkategori) {
        const underkategori = underkategorier.find(kat => 
          kat.name === subCat.name && kat.huvudkategoriId === huvudkategori.id
        );
        
        if (underkategori) {
          return {
            ...subCat,
            id: underkategori.id
          };
        }
      }
      
      return subCat;
    });
  }
  
  /**
   * Convert legacy BudgetGroups to use UUID categories
   */
  static convertBudgetGroupsToUuid(
    groups: BudgetGroup[],
    huvudkategorier: any[],
    underkategorier: any[]
  ): BudgetGroup[] {
    return groups.map(group => {
      // Find the huvudkategori UUID for this group name
      const huvudkategori = huvudkategorier.find(kat => kat.name === group.name);
      const groupId = huvudkategori?.id || group.id;
      
      // Convert subcategories within this group
      const convertedSubCategories = group.subCategories ? 
        this.convertSubCategoriesToUuid(group.subCategories, group.name, huvudkategorier, underkategorier) : 
        undefined;
      
      return {
        ...group,
        id: groupId,
        subCategories: convertedSubCategories
      };
    });
  }
  
  /**
   * Check if we need to perform UUID migration for budget data
   */
  static needsUuidMigration(): boolean {
    // Check if we have old string-based categories in current state
    const currentMainCategories = state.budgetState.mainCategories;
    
    // If we have numeric strings like "1", "2", "3" instead of UUIDs, we need migration
    return currentMainCategories.some(cat => /^\d+$/.test(cat));
  }
  
  /**
   * Migrate current month's budget data to use UUID categories
   */
  static migrateBudgetDataToUuid(
    huvudkategorier: any[],
    underkategorier: any[]
  ): void {
    const currentMonth = state.budgetState.selectedMonthKey;
    const monthData = state.budgetState.historicalData[currentMonth];
    
    if (!monthData) return;
    
    // Convert cost items
    if (monthData.costItems) {
      monthData.costItems = this.convertBudgetItemsToUuid(
        monthData.costItems,
        huvudkategorier,
        underkategorier
      );
    }
    
    // Convert savings items
    if (monthData.savingsItems) {
      monthData.savingsItems = this.convertBudgetItemsToUuid(
        monthData.savingsItems,
        huvudkategorier,
        underkategorier
      );
    }
    
    // Convert cost groups
    if (monthData.costGroups) {
      monthData.costGroups = this.convertBudgetGroupsToUuid(
        monthData.costGroups,
        huvudkategorier,
        underkategorier
      );
    }
    
    // Convert savings groups
    if (monthData.savingsGroups) {
      monthData.savingsGroups = this.convertBudgetGroupsToUuid(
        monthData.savingsGroups,
        huvudkategorier,
        underkategorier
      );
    }
    
    console.log('✅ Budget data migrated to UUID categories for month:', currentMonth);
  }
}

/**
 * React hook to use the UUID category bridge
 */
export function useUuidCategoryBridge() {
  const { huvudkategorier, underkategorier, isLoading } = useCategoryResolver();
  
  const convertToUuid = (mainCategoryId: string, subCategoryId: string) => {
    return UuidCategoryBridge.convertStringCategoryToUuid(
      mainCategoryId,
      subCategoryId,
      huvudkategorier,
      underkategorier
    );
  };
  
  const migrateBudgetData = () => {
    if (!isLoading && huvudkategorier.length > 0) {
      UuidCategoryBridge.migrateBudgetDataToUuid(huvudkategorier, underkategorier);
    }
  };
  
  return {
    convertToUuid,
    migrateBudgetData,
    needsMigration: UuidCategoryBridge.needsUuidMigration(),
    isLoading
  };
}