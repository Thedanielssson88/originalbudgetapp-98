// Custom hook for managing transactions with React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Transaction, InsertTransaction } from '@shared/schema';

// Helper function for API requests
async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  return response.json();
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
    console.warn('Failed to cache transactions:', error);
  }
}

export function useTransactions() {
  // Get cached transactions immediately on hook initialization
  const cachedTransactions = getCachedTransactions();
  
  const query = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
    queryFn: async () => {
      const data = await apiRequest('/api/transactions');
      // Cache the fresh data immediately
      if (data && data.length > 0) {
        cacheTransactions(data);
      }
      return data;
    },
    // Use cached data as initial data
    initialData: cachedTransactions.length > 0 ? cachedTransactions : undefined,
    staleTime: 0, // Always refetch to get fresh data
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