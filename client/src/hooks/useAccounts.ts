// Custom hook for managing accounts with React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Account, InsertAccount } from '@shared/schema';

// Helper function for API requests
async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Account hooks with localStorage persistence
const ACCOUNTS_CACHE_KEY = 'accounts_cache';

// Helper function to get cached accounts
function getCachedAccounts(): Account[] {
  try {
    const cached = localStorage.getItem(ACCOUNTS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

// Helper function to cache accounts
function cacheAccounts(accounts: Account[]): void {
  try {
    localStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.warn('Failed to cache accounts:', error);
  }
}

export function useAccounts() {
  // Get cached accounts immediately on hook initialization
  const cachedAccounts = getCachedAccounts();
  
  const query = useQuery<Account[]>({
    queryKey: ['/api/accounts'],
    queryFn: async () => {
      const data = await apiRequest('/api/accounts');
      // Cache the fresh data immediately
      if (data && data.length > 0) {
        cacheAccounts(data);
      }
      return data;
    },
    // Use cached data as initial data
    initialData: cachedAccounts.length > 0 ? cachedAccounts : undefined,
    staleTime: 0, // Always refetch to get fresh data
  });
  
  // Always prefer fresh data, but fallback to cache if needed
  const effectiveData = (query.data && query.data.length > 0) 
    ? query.data 
    : cachedAccounts;
  
  return {
    ...query,
    data: effectiveData,
    // Show as loading only if we don't have any data at all
    isLoading: query.isLoading && effectiveData.length === 0,
  };
}

export function useAccount(id: string) {
  return useQuery<Account>({
    queryKey: ['/api/accounts', id],
    queryFn: () => apiRequest(`/api/accounts/${id}`),
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: InsertAccount) => 
      apiRequest('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertAccount> }) =>
      apiRequest(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/accounts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
    },
  });
}