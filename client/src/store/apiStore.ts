// API-driven store that replaces localStorage as the single source of truth

import type { 
  Account, 
  Huvudkategori, 
  Underkategori, 
  CategoryRule, 
  Transaction,
  MonthlyBudget 
} from '@shared/schema';

interface ApiStore {
  // Loading state
  isLoading: boolean;
  
  // Core data from API
  accounts: Account[];
  huvudkategorier: Huvudkategori[];
  underkategorier: Underkategori[];
  categoryRules: CategoryRule[];
  transactions: Transaction[];
  monthlyBudgets: MonthlyBudget[];
  
  // Derived state - will be computed from core data
  mainCategories: string[]; // For backward compatibility
  subCategories: Record<string, string[]>; // For backward compatibility
  
  // Actions
  initialize: () => Promise<void>;
  createAccount: (account: { name: string; startBalance: number }) => Promise<void>;
  updateAccount: (id: string, data: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  
  createHuvudkategori: (data: { name: string; description?: string }) => Promise<void>;
  updateHuvudkategori: (id: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteHuvudkategori: (id: string) => Promise<void>;
  
  createUnderkategori: (data: { name: string; huvudkategoriId: string; description?: string }) => Promise<void>;
  updateUnderkategori: (id: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteUnderkategori: (id: string) => Promise<void>;
  
  createCategoryRule: (rule: Omit<CategoryRule, 'id' | 'userId'>) => Promise<void>;
  updateCategoryRule: (id: string, rule: Partial<CategoryRule>) => Promise<void>;
  deleteCategoryRule: (id: string) => Promise<void>;
  
  createTransaction: (transaction: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  // Monthly Budget methods
  getOrCreateMonthlyBudget: (monthKey: string) => Promise<MonthlyBudget>;
  updateMonthlyBudget: (monthKey: string, updates: Partial<MonthlyBudget>) => Promise<MonthlyBudget>;
  deleteMonthlyBudget: (monthKey: string) => Promise<void>;
}

// Helper function for API requests
async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  return response.json();
}

// Global store instance
let store: ApiStore;

// State container
const state = {
  isLoading: true,
  accounts: [] as Account[],
  huvudkategorier: [] as Huvudkategori[],
  underkategorier: [] as Underkategori[],
  categoryRules: [] as CategoryRule[],
  transactions: [] as Transaction[],
  monthlyBudgets: [] as MonthlyBudget[],
  mainCategories: [] as string[],
  subCategories: {} as Record<string, string[]>,
};

// Subscribers for state changes
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach(callback => callback());
}

// Create the store
store = {
  get isLoading() { return state.isLoading; },
  get accounts() { return state.accounts; },
  get huvudkategorier() { return state.huvudkategorier; },
  get underkategorier() { return state.underkategorier; },
  get categoryRules() { return state.categoryRules; },
  get transactions() { return state.transactions; },
  get monthlyBudgets() { return state.monthlyBudgets; },
  get mainCategories() { return state.mainCategories; },
  get subCategories() { return state.subCategories; },
  
  async initialize() {
    try {
      state.isLoading = true;
      notifySubscribers();
      
      // Fetch all data from the bootstrap endpoint
      const data = await apiRequest('/api/bootstrap');
      
      // Update state with API data
      state.accounts = data.accounts || [];
      state.huvudkategorier = data.huvudkategorier || [];
      state.underkategorier = data.underkategorier || [];
      state.categoryRules = data.categoryRules || [];
      state.transactions = data.transactions || [];
      state.monthlyBudgets = data.monthlyBudgets || [];
      
      // Compute backward compatibility data
      state.mainCategories = state.huvudkategorier.map(h => h.name);
      state.subCategories = {};
      state.huvudkategorier.forEach(h => {
        const subs = state.underkategorier
          .filter(u => u.huvudkategoriId === h.id)
          .map(u => u.name);
        if (subs.length > 0) {
          state.subCategories[h.name] = subs;
        }
      });
      
      state.isLoading = false;
      notifySubscribers();
    } catch (error) {
      console.error('Failed to initialize store:', error);
      state.isLoading = false;
      notifySubscribers();
      throw error;
    }
  },
  
  async createAccount(account) {
    const newAccount = await apiRequest('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });
    state.accounts.push(newAccount);
    notifySubscribers();
  },
  
  async updateAccount(id, data) {
    const updated = await apiRequest(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const index = state.accounts.findIndex(a => a.id === id);
    if (index !== -1) {
      state.accounts[index] = updated;
      notifySubscribers();
    }
  },
  
  async deleteAccount(id) {
    await apiRequest(`/api/accounts/${id}`, { method: 'DELETE' });
    state.accounts = state.accounts.filter(a => a.id !== id);
    notifySubscribers();
  },
  
  async createHuvudkategori(data) {
    const newKategori = await apiRequest('/api/huvudkategorier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    state.huvudkategorier.push(newKategori);
    state.mainCategories.push(newKategori.name);
    notifySubscribers();
  },
  
  async updateHuvudkategori(id, data) {
    const updated = await apiRequest(`/api/huvudkategorier/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const index = state.huvudkategorier.findIndex(h => h.id === id);
    if (index !== -1) {
      const oldName = state.huvudkategorier[index].name;
      state.huvudkategorier[index] = updated;
      
      // Update backward compatibility data
      const mainIndex = state.mainCategories.indexOf(oldName);
      if (mainIndex !== -1) {
        state.mainCategories[mainIndex] = updated.name;
      }
      if (oldName !== updated.name && state.subCategories[oldName]) {
        state.subCategories[updated.name] = state.subCategories[oldName];
        delete state.subCategories[oldName];
      }
      
      notifySubscribers();
    }
  },
  
  async deleteHuvudkategori(id) {
    await apiRequest(`/api/huvudkategorier/${id}`, { method: 'DELETE' });
    const kategori = state.huvudkategorier.find(h => h.id === id);
    if (kategori) {
      state.huvudkategorier = state.huvudkategorier.filter(h => h.id !== id);
      state.mainCategories = state.mainCategories.filter(m => m !== kategori.name);
      delete state.subCategories[kategori.name];
      // Also remove related underkategorier
      state.underkategorier = state.underkategorier.filter(u => u.huvudkategoriId !== id);
      notifySubscribers();
    }
  },
  
  async createUnderkategori(data) {
    const newKategori = await apiRequest('/api/underkategorier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    state.underkategorier.push(newKategori);
    
    // Update backward compatibility data
    const huvudkategori = state.huvudkategorier.find(h => h.id === data.huvudkategoriId);
    if (huvudkategori) {
      if (!state.subCategories[huvudkategori.name]) {
        state.subCategories[huvudkategori.name] = [];
      }
      state.subCategories[huvudkategori.name].push(newKategori.name);
    }
    
    notifySubscribers();
  },
  
  async updateUnderkategori(id, data) {
    const updated = await apiRequest(`/api/underkategorier/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const index = state.underkategorier.findIndex(u => u.id === id);
    if (index !== -1) {
      const oldKategori = state.underkategorier[index];
      state.underkategorier[index] = updated;
      
      // Update backward compatibility data if name changed
      if (data.name && oldKategori.name !== data.name) {
        const huvudkategori = state.huvudkategorier.find(h => h.id === oldKategori.huvudkategoriId);
        if (huvudkategori && state.subCategories[huvudkategori.name]) {
          const subIndex = state.subCategories[huvudkategori.name].indexOf(oldKategori.name);
          if (subIndex !== -1) {
            state.subCategories[huvudkategori.name][subIndex] = data.name;
          }
        }
      }
      
      notifySubscribers();
    }
  },
  
  async deleteUnderkategori(id) {
    await apiRequest(`/api/underkategorier/${id}`, { method: 'DELETE' });
    const kategori = state.underkategorier.find(u => u.id === id);
    if (kategori) {
      state.underkategorier = state.underkategorier.filter(u => u.id !== id);
      
      // Update backward compatibility data
      const huvudkategori = state.huvudkategorier.find(h => h.id === kategori.huvudkategoriId);
      if (huvudkategori && state.subCategories[huvudkategori.name]) {
        state.subCategories[huvudkategori.name] = state.subCategories[huvudkategori.name]
          .filter(s => s !== kategori.name);
      }
      
      notifySubscribers();
    }
  },
  
  async createCategoryRule(rule) {
    const newRule = await apiRequest('/api/category-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    state.categoryRules.push(newRule);
    notifySubscribers();
  },
  
  async updateCategoryRule(id, rule) {
    const updated = await apiRequest(`/api/category-rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    const index = state.categoryRules.findIndex(r => r.id === id);
    if (index !== -1) {
      state.categoryRules[index] = updated;
      notifySubscribers();
    }
  },
  
  async deleteCategoryRule(id) {
    await apiRequest(`/api/category-rules/${id}`, { method: 'DELETE' });
    state.categoryRules = state.categoryRules.filter(r => r.id !== id);
    notifySubscribers();
  },
  
  async createTransaction(transaction) {
    const newTransaction = await apiRequest('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    state.transactions.push(newTransaction);
    notifySubscribers();
  },
  
  async updateTransaction(id, transaction) {
    const updated = await apiRequest(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    const index = state.transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      state.transactions[index] = updated;
      notifySubscribers();
    }
  },
  
  async deleteTransaction(id) {
    await apiRequest(`/api/transactions/${id}`, { method: 'DELETE' });
    state.transactions = state.transactions.filter(t => t.id !== id);
    notifySubscribers();
  },

  // Monthly Budget methods
  async getOrCreateMonthlyBudget(monthKey: string): Promise<MonthlyBudget> {
    // First try to find existing budget
    const existing = state.monthlyBudgets.find(b => b.monthKey === monthKey);
    if (existing) {
      return existing;
    }

    // Try to fetch from server
    try {
      const budget = await apiRequest(`/api/monthly-budgets/${monthKey}`);
      // Add to state if not already there
      if (!state.monthlyBudgets.find(b => b.monthKey === monthKey)) {
        state.monthlyBudgets.push(budget);
        notifySubscribers();
      }
      return budget;
    } catch (error) {
      // If not found, create a new one with default values (all income starts at 0)
      const newBudget = {
        monthKey,
        andreasSalary: 0,
        andreasförsäkringskassan: 0,
        andreasbarnbidrag: 0,
        susannaSalary: 0,
        susannaförsäkringskassan: 0,
        susannabarnbidrag: 0,
        dailyTransfer: 300,
        weekendTransfer: 540,
        andreasPersonalCosts: 0,
        andreasPersonalSavings: 0,
        susannaPersonalCosts: 0,
        susannaPersonalSavings: 0,
        userName1: 'Andreas',
        userName2: 'Susanna'
      };

      const created = await apiRequest('/api/monthly-budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBudget),
      });

      state.monthlyBudgets.push(created);
      notifySubscribers();
      return created;
    }
  },

  async updateMonthlyBudget(monthKey: string, updates: Partial<MonthlyBudget>): Promise<MonthlyBudget> {
    const updated = await apiRequest(`/api/monthly-budgets/${monthKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    const index = state.monthlyBudgets.findIndex(b => b.monthKey === monthKey);
    if (index !== -1) {
      state.monthlyBudgets[index] = updated;
    } else {
      state.monthlyBudgets.push(updated);
    }
    notifySubscribers();
    return updated;
  },

  async deleteMonthlyBudget(monthKey: string): Promise<void> {
    await apiRequest(`/api/monthly-budgets/${monthKey}`, { method: 'DELETE' });
    state.monthlyBudgets = state.monthlyBudgets.filter(b => b.monthKey !== monthKey);
    notifySubscribers();
  },
};

// Subscribe/unsubscribe functions
export function subscribeToStore(callback: () => void) {
  subscribers.add(callback);
}

export function unsubscribeFromStore(callback: () => void) {
  subscribers.delete(callback);
}

// Export the store
export const apiStore = store;