// API Store for managing PostgreSQL database operations
import type { CategoryRule } from '@shared/schema';

interface CreateCategoryRuleData {
  ruleName: string;
  transactionName: string;
  huvudkategoriId: string;
  underkategoriId: string;
  userId: string;
}

class ApiStore {
  public isLoading = false;

  async initialize() {
    // No-op for now - placeholder for compatibility
    this.isLoading = false;
  }

  async createCategoryRule(data: CreateCategoryRuleData): Promise<CategoryRule> {
    const response = await fetch('/api/category-rules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create category rule: ${response.statusText}`);
    }

    return response.json();
  }

  async getCategoryRules(): Promise<CategoryRule[]> {
    const response = await fetch('/api/category-rules');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch category rules: ${response.statusText}`);
    }

    return response.json();
  }

  async createTransaction(data: any): Promise<any> {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create transaction: ${response.statusText}`);
    }

    return response.json();
  }

  async updateTransaction(id: string, data: any): Promise<any> {
    
    const response = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update transaction: ${response.statusText}`);
    }

    const result = await response.json();
    
    return result;
  }

  async getTransactions(): Promise<any[]> {
    try {
      const response = await fetch('/api/transactions', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get transactions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ [ApiStore] Failed to fetch transactions:', error);
      
      // If it's a network error, try to provide helpful context
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 [ApiStore] Network error - server might be down or unreachable');
        console.error('💡 [ApiStore] Try refreshing the page or check server status');
      }
      
      throw error;
    }
  }

  async getOrCreateMonthlyBudget(monthKey: string): Promise<any> {
    try {
      const response = await fetch(`/api/monthly-budgets/${monthKey}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        return await response.json();
      } else if (response.status === 404) {
        // Budget doesn't exist, create a new one
        return await this.createMonthlyBudget(monthKey);
      } else {
        throw new Error(`Failed to get monthly budget: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[API Store] Error in getOrCreateMonthlyBudget:', error);
      throw error;
    }
  }

  async createMonthlyBudget(monthKey: string): Promise<any> {
    try {
      const response = await fetch('/api/monthly-budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthKey,
          andreasSalary: 0,
          andreasförsäkringskassan: 0,
          andreasbarnbidrag: 0,
          susannaSalary: 0,
          susannaförsäkringskassan: 0,
          susannabarnbidrag: 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create monthly budget: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[API Store] Error in createMonthlyBudget:', error);
      throw error;
    }
  }

  async updateMonthlyBudget(monthKey: string, updates: any): Promise<any> {
    try {
      const response = await fetch(`/api/monthly-budgets/${monthKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update monthly budget: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[API Store] Error in updateMonthlyBudget:', error);
      throw error;
    }
  }

  async syncFromDatabase(): Promise<any> {
    // No-op for now - placeholder for compatibility
    return {};
  }
}

export const apiStore = new ApiStore();

// Add subscribeToStore and unsubscribeFromStore functions for compatibility
export function subscribeToStore() {
  // No-op for now - placeholder for compatibility
  return () => {};
}

export function unsubscribeFromStore() {
  // No-op for now - placeholder for compatibility
}