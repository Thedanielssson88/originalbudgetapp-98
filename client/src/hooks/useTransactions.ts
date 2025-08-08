// Custom hook for managing transactions with React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Transaction, InsertTransaction } from '@shared/schema';

// Helper function for API requests
async function apiRequest(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      console.log(`[useTransactions] API request failed: ${response.status} ${response.statusText} for ${url}`);
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.log(`[useTransactions] Network error for ${url}:`, error);
    // Re-throw with context but don't use console.error to avoid runtime popup
    if (error instanceof Error) {
      throw new Error(`Transactions request failed: ${error.message}`);
    } else {
      throw new Error(`Transactions request failed: Network error`);
    }
  }
}

// Transaction hooks with localStorage persistence (similar to accounts)
const TRANSACTIONS_CACHE_KEY = 'transactions_cache';

// Helper function to get cached transactions
function getCachedTransactions(): Transaction[] {
  try {
    const cached = localStorage.getItem(TRANSACTIONS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

// Helper function to cache transactions
function cacheTransactions(transactions: Transaction[]): void {
  try {
    localStorage.setItem(TRANSACTIONS_CACHE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.log('[useTransactions] Failed to cache transactions:', error);
  }
}

export function useTransactions() {
  // Get cached transactions for fallback
  const cachedTransactions = getCachedTransactions();
  
  const query = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
    queryFn: async () => {
      try {
        const data = await apiRequest('/api/transactions');
        // Cache the fresh SQL data only after successful fetch
        if (data && Array.isArray(data)) {
          cacheTransactions(data);
        }
        return data;
      } catch (error) {
        console.log(`[useTransactions] Query failed, returning cached data:`, error instanceof Error ? error.message : String(error));
        // Return cached data instead of throwing to prevent runtime error overlay
        return cachedTransactions;
      }
    },
    // Use cached data as initial data
    initialData: cachedTransactions.length > 0 ? cachedTransactions : undefined,
    staleTime: 5000, // Cache for 5 seconds to reduce API calls
    retry: false, // Don't retry since we handle errors in queryFn
  });
  
  // Always prefer fresh data, but fallback to cache if needed
  const effectiveData = (query.data && query.data.length > 0) 
    ? query.data 
    : cachedTransactions;
  
  return {
    ...query,
    data: effectiveData,
    // Show as loading only if we don't have any data at all
    isLoading: query.isLoading && effectiveData.length === 0,
  };
}

export function useTransaction(id: string) {
  return useQuery<Transaction>({
    queryKey: ['/api/transactions', id],
    queryFn: () => apiRequest(`/api/transactions/${id}`),
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: InsertTransaction) => 
      apiRequest('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertTransaction> }) =>
      apiRequest(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/transactions/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
    },
  });
}