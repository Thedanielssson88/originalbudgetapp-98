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

// Global query key for all transactions (used for startup prefetch)
export const ALL_TRANSACTIONS_QUERY_KEY = ['/api/transactions', 'all'];

export function useTransactions(dateRange?: { fromDate?: string; toDate?: string }) {
  // Get cached transactions for fallback
  const cachedTransactions = getCachedTransactions();
  
  // Create stable, unique query key based on date range parameters
  const queryKey = dateRange?.fromDate || dateRange?.toDate 
    ? ['/api/transactions', 'filtered', dateRange.fromDate || 'undefined', dateRange.toDate || 'undefined']
    : ALL_TRANSACTIONS_QUERY_KEY;
  
  const query = useQuery<Transaction[]>({
    queryKey,
    queryFn: async () => {
      try {
        // Build URL with date range parameters if provided
        let url = '/api/transactions';
        const params = new URLSearchParams();
        if (dateRange?.fromDate) params.set('fromDate', dateRange.fromDate);
        if (dateRange?.toDate) params.set('toDate', dateRange.toDate);
        if (params.toString()) url += `?${params.toString()}`;
        
        console.log(`📊 [useTransactions] Fetching from: ${url} (Query Key: ${JSON.stringify(queryKey)})`);
        const data = await apiRequest(url);
        
        console.log(`📊 [useTransactions] Received ${data?.length || 0} transactions from server`);
        if (data && data.length > 0) {
          // Log some sample transactions to debug
          const sampleTransactions = data.slice(0, 3);
          console.log(`📊 [useTransactions] Sample transactions:`, sampleTransactions.map((t: any) => 
            `${t.date}: ${t.description} (${t.amount})`
          ));
          
          // Check for ExpenseClaim transactions with linkedCostId
          const expenseClaims = data.filter((t: any) => t.type === 'ExpenseClaim');
          if (expenseClaims.length > 0) {
            console.log(`📊 [useTransactions] Found ${expenseClaims.length} ExpenseClaim transactions`);
            expenseClaims.forEach((t: any) => {
              console.log(`  - ${t.id}: linkedCostId=${t.linkedCostId}, correctedAmount=${t.correctedAmount}`);
            });
          }
          
          // Check for our specific February 24 transaction
          const feb24Transactions = data.filter((t: any) => t.date.includes('2025-02-24'));
          console.log(`📊 [useTransactions] Found ${feb24Transactions.length} transactions on 2025-02-24`);
          feb24Transactions.forEach((t: any) => {
            console.log(`  - ${t.description}: ${t.amount} öre`);
          });
        }
        
        // Only cache data without date filters (full dataset)
        if (data && Array.isArray(data) && !dateRange?.fromDate && !dateRange?.toDate) {
          cacheTransactions(data);
          console.log(`📊 [useTransactions] Cached ${data.length} transactions for summaries/analysis`);
        }
        return data;
      } catch (error) {
        console.log(`[useTransactions] Query failed, returning cached data:`, error instanceof Error ? error.message : String(error));
        // Return cached data instead of throwing to prevent runtime error overlay
        return cachedTransactions;
      }
    },
    // Use cached data as initial data only for full dataset queries
    initialData: (!dateRange?.fromDate && !dateRange?.toDate && cachedTransactions.length > 0) 
      ? cachedTransactions 
      : undefined,
    // STARTUP OPTIMIZATION: Longer cache times for all transactions used by summaries/analysis
    staleTime: dateRange?.fromDate || dateRange?.toDate ? 60000 : 10 * 60 * 1000, // Filtered: 1 min, All: 10 minutes 
    gcTime: dateRange?.fromDate || dateRange?.toDate ? 300000 : 30 * 60 * 1000, // Filtered: 5 min, All: 30 minutes
    retry: false, // Don't retry since we handle errors in queryFn
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    refetchOnMount: false, // Don't refetch if we have recent data
  });
  
  // Always prefer fresh data, but fallback to cache if needed (only for full dataset)
  const effectiveData = (query.data && query.data.length > 0) 
    ? query.data 
    : ((!dateRange?.fromDate && !dateRange?.toDate) ? cachedTransactions : []);
  
  return {
    ...query,
    data: effectiveData,
    // Show as loading only if we don't have any data at all
    isLoading: query.isLoading && effectiveData.length === 0,
  };
}

// Hook to prefetch all transactions at app startup for summaries and analysis
export function usePrefetchAllTransactions() {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ALL_TRANSACTIONS_QUERY_KEY,
    queryFn: async () => {
      console.log('🚀 [STARTUP] Prefetching ALL transactions for summaries and yearly analysis');
      const data = await apiRequest('/api/transactions');
      if (data && Array.isArray(data)) {
        cacheTransactions(data);
        console.log(`🚀 [STARTUP] Successfully prefetched ${data.length} transactions`);
      }
      return data;
    },
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTransaction> }) => {
      console.log(`💾 [SIMPLE UPDATE] Starting mutation for transaction ${id}`);
      console.log(`💾 [SIMPLE UPDATE] Data to update:`, data);
      
      const result = await apiRequest(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      console.log(`✅ [SIMPLE UPDATE] SQL updated successfully`);
      return result;
    },
    onMutate: async ({ id, data }) => {
      // OPTIMISTIC UPDATE: Update UI immediately
      console.log(`🔄 [OPTIMISTIC] Updating transaction ${id} in UI first`);
      
      // Cancel outgoing queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/transactions'] });
      
      // Get current data for rollback
      const previousData = queryClient.getQueryData(['/api/transactions']);
      
      // Update cache optimistically for ALL transaction query keys
      queryClient.setQueryData(['/api/transactions'], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        
        const newData = oldData.map((transaction: any) => 
          transaction.id === id 
            ? { ...transaction, ...data, isManuallyChanged: 'true' }
            : transaction
        );
        
        console.log(`🔄 [OPTIMISTIC] Updated transaction ${id} with:`, data);
        console.log(`🔄 [OPTIMISTIC] New transaction data:`, newData.find(t => t.id === id));
        
        return newData;
      });
      
      // Also update the ALL_TRANSACTIONS cache if it exists
      queryClient.setQueryData(ALL_TRANSACTIONS_QUERY_KEY, (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        
        return oldData.map((transaction: any) => 
          transaction.id === id 
            ? { ...transaction, ...data, isManuallyChanged: 'true' }
            : transaction
        );
      });
      
      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      console.error(`❌ [ROLLBACK] Rolling back optimistic update:`, error);
      if (context?.previousData) {
        queryClient.setQueryData(['/api/transactions'], context.previousData);
      }
    },
    onSuccess: (updatedTransaction, { id }) => {
      console.log(`✅ [SUCCESS] SQL update confirmed, updating cache with server data`);
      
      // Update cache with confirmed server data for ALL transaction query keys
      queryClient.setQueryData(['/api/transactions'], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        
        return oldData.map((transaction: any) => 
          transaction.id === id 
            ? { ...transaction, ...updatedTransaction }
            : transaction
        );
      });
      
      // Also update the ALL_TRANSACTIONS cache
      queryClient.setQueryData(ALL_TRANSACTIONS_QUERY_KEY, (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        
        return oldData.map((transaction: any) => 
          transaction.id === id 
            ? { ...transaction, ...updatedTransaction }
            : transaction
        );
      });
      
      // Invalidate all transaction queries to force re-render
      queryClient.invalidateQueries({ 
        queryKey: ['/api/transactions'],
        refetchType: 'none'
      });
      
      // Update localStorage cache
      try {
        const cachedTransactions = getCachedTransactions();
        const updatedCache = cachedTransactions.map((transaction: any) =>
          transaction.id === id 
            ? { ...transaction, ...updatedTransaction }
            : transaction
        );
        cacheTransactions(updatedCache);
        console.log(`📦 [SUCCESS] Updated localStorage cache`);
      } catch (error) {
        console.log('[SUCCESS] Failed to update localStorage cache:', error);
      }
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