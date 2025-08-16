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
  const query = useQuery<Account[]>({
    queryKey: ['/api/accounts'],
    queryFn: async () => {
      const data = await apiRequest('/api/accounts');
      // Cache the fresh SQL data only after successful fetch
      if (data && Array.isArray(data)) {
        cacheAccounts(data);
      }
      return data;
    },
    // CRITICAL FIX: Don't use localStorage as initial data to prevent legacy data interference
    // Always fetch fresh data from SQL first, then use cache only for subsequent renders
    staleTime: 1000, // Reduced to 1 second for faster lastUpdate refresh
  });
  
  // FIXED: Only return SQL data, never mix with localStorage fallback
  // This prevents duplicate accounts from localStorage interfering with SQL data
  return {
    ...query,
    data: query.data || [], // Always return SQL data or empty array
    isLoading: query.isLoading,
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