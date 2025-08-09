// Custom hook for managing account types with React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AccountType, InsertAccountType } from '@shared/schema';

// Helper function for API requests
async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Account types hooks with localStorage persistence
const ACCOUNT_TYPES_CACHE_KEY = 'account_types_cache';

// Helper function to get cached account types
function getCachedAccountTypes(): AccountType[] {
  try {
    const cached = localStorage.getItem(ACCOUNT_TYPES_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

// Helper function to cache account types
function cacheAccountTypes(accountTypes: AccountType[]): void {
  try {
    localStorage.setItem(ACCOUNT_TYPES_CACHE_KEY, JSON.stringify(accountTypes));
  } catch (error) {
    console.warn('Failed to cache account types:', error);
  }
}

export function useAccountTypes() {
  const query = useQuery<AccountType[]>({
    queryKey: ['/api/account-types'],
    queryFn: async () => {
      const data = await apiRequest('/api/account-types');
      // Cache the fresh SQL data only after successful fetch
      if (data && Array.isArray(data)) {
        cacheAccountTypes(data);
      }
      return data;
    },
    // Don't use localStorage as initial data to prevent legacy data interference
    // Always fetch fresh data from SQL first, then use cache only for subsequent renders
    staleTime: 5000, // Cache for 5 seconds to reduce API calls
  });
  
  // Only return SQL data, never mix with localStorage fallback
  // This prevents duplicate account types from localStorage interfering with SQL data
  return {
    ...query,
    data: query.data || [], // Always return SQL data or empty array
    isLoading: query.isLoading,
  };
}

export function useAccountType(id: string) {
  return useQuery<AccountType>({
    queryKey: ['/api/account-types', id],
    queryFn: () => apiRequest(`/api/account-types/${id}`),
    enabled: !!id,
  });
}

export function useCreateAccountType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: InsertAccountType) => 
      apiRequest('/api/account-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/account-types'] });
    },
  });
}

export function useUpdateAccountType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertAccountType> }) =>
      apiRequest(`/api/account-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/account-types'] });
    },
  });
}

export function useDeleteAccountType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/account-types/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/account-types'] });
    },
  });
}