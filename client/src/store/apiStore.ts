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

    return response.json();
  }

  async getOrCreateMonthlyBudget(monthKey: string): Promise<any> {
    // No-op for now - placeholder for compatibility
    console.log(`[API Store] getOrCreateMonthlyBudget called for ${monthKey}`);
    return null;
  }

  async syncFromDatabase(): Promise<any> {
    // No-op for now - placeholder for compatibility
    console.log('[API Store] syncFromDatabase called');
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