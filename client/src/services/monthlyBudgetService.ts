import { apiStore } from '@/store/apiStore';
import type { MonthlyBudget } from '@shared/schema';
import { state } from '../state/budgetState';

/**
 * Service that bridges the existing budget orchestrator with the new monthly budget database API
 */
class MonthlyBudgetService {
  private budgetCache: Map<string, MonthlyBudget> = new Map();
  
  /**
   * Get or create monthly budget for a specific month
   */
  async getOrCreateMonthlyBudget(monthKey: string): Promise<MonthlyBudget> {
    // Check cache first
    if (this.budgetCache.has(monthKey)) {
      return this.budgetCache.get(monthKey)!;
    }

    try {
      const budget = await apiStore.getOrCreateMonthlyBudget(monthKey);
      this.budgetCache.set(monthKey, budget);
      return budget;
    } catch (error) {
      console.error('Error getting or creating monthly budget:', error);
      throw error;
    }
  }

  /**
   * Update a specific field in the monthly budget
   */
  async updateMonthlyBudgetField(monthKey: string, field: keyof MonthlyBudget, value: number): Promise<MonthlyBudget> {
    try {
      const updates = { [field]: value };
      const updated = await apiStore.updateMonthlyBudget(monthKey, updates);
      
      // Update cache
      this.budgetCache.set(monthKey, updated);
      
      return updated;
    } catch (error) {
      console.error('Error updating monthly budget field:', error);
      throw error;
    }
  }

  /**
   * Sync current month data from the legacy state to the database
   */
  async syncCurrentMonthToDatabase(monthKey: string): Promise<void> {
    const currentData = state.budgetState.historicalData[monthKey];
    if (!currentData) return;

    console.log('📊 [MONTHLY BUDGET SERVICE] Syncing current month data to database:', { monthKey, currentData });

    try {
      const updates: Partial<MonthlyBudget> = {
        andreasSalary: currentData.andreasSalary ?? 0,
        andreasförsäkringskassan: currentData.andreasförsäkringskassan ?? 0,
        andreasbarnbidrag: currentData.andreasbarnbidrag ?? 0,
        susannaSalary: currentData.susannaSalary ?? 0,
        susannaförsäkringskassan: currentData.susannaförsäkringskassan ?? 0,
        susannabarnbidrag: currentData.susannabarnbidrag ?? 0,
        dailyTransfer: currentData.dailyTransfer ?? 300,
        weekendTransfer: currentData.weekendTransfer ?? 540,
        andreasPersonalCosts: currentData.andreasPersonalCosts ?? 0,
        andreasPersonalSavings: currentData.andreasPersonalSavings ?? 0,
        susannaPersonalCosts: currentData.susannaPersonalCosts ?? 0,
        susannaPersonalSavings: currentData.susannaPersonalSavings ?? 0,
        userName1: currentData.userName1 ?? 'Andreas',
        userName2: currentData.userName2 ?? 'Susanna'
      };

      const updated = await apiStore.updateMonthlyBudget(monthKey, updates);
      this.budgetCache.set(monthKey, updated);
      
      console.log('✅ [MONTHLY BUDGET SERVICE] Successfully synced month data to database');
    } catch (error) {
      console.error('❌ [MONTHLY BUDGET SERVICE] Error syncing to database:', error);
    }
  }

  /**
   * Load monthly budget data from database and apply to current state
   */
  async loadMonthlyBudgetFromDatabase(monthKey: string): Promise<MonthlyBudget | null> {
    try {
      const budget = await this.getOrCreateMonthlyBudget(monthKey);
      console.log('📊 [MONTHLY BUDGET SERVICE] Loaded monthly budget from database:', budget);
      return budget;
    } catch (error) {
      console.error('❌ [MONTHLY BUDGET SERVICE] Error loading monthly budget from database:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific month
   */
  clearCache(monthKey?: string): void {
    if (monthKey) {
      this.budgetCache.delete(monthKey);
    } else {
      this.budgetCache.clear();
    }
  }

  /**
   * Get cached budget data without making API calls
   */
  getCachedBudget(monthKey: string): MonthlyBudget | null {
    return this.budgetCache.get(monthKey) || null;
  }
}

// Export singleton instance
export const monthlyBudgetService = new MonthlyBudgetService();