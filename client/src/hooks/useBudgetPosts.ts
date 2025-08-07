// Custom hook for managing budget posts with React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BudgetPost, InsertBudgetPost } from '@shared/schema';

// Helper function for API requests
async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  return response.json();
}

// Budget Post hooks with localStorage persistence
const BUDGET_POSTS_CACHE_KEY = 'budget_posts_cache';

// Helper function to get cached budget posts
function getCachedBudgetPosts(): BudgetPost[] {
  try {
    const cached = localStorage.getItem(BUDGET_POSTS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

// Helper function to cache budget posts
function cacheBudgetPosts(budgetPosts: BudgetPost[]): void {
  try {
    localStorage.setItem(BUDGET_POSTS_CACHE_KEY, JSON.stringify(budgetPosts));
  } catch (error) {
    console.warn('Failed to cache budget posts:', error);
  }
}

export function useBudgetPosts(monthKey?: string) {
  // Get cached budget posts immediately on hook initialization
  const cachedBudgetPosts = getCachedBudgetPosts();
  
  const query = useQuery<BudgetPost[]>({
    queryKey: ['/api/budget-posts', monthKey],
    queryFn: async () => {
      const url = monthKey ? `/api/budget-posts?monthKey=${monthKey}` : '/api/budget-posts';
      const data = await apiRequest(url);
      // Cache the fresh data immediately
      if (data && data.length > 0) {
        cacheBudgetPosts(data);
      }
      return data;
    },
    // Use cached data as initial data
    initialData: cachedBudgetPosts.length > 0 ? cachedBudgetPosts : undefined,
    staleTime: 0, // Always refetch to get fresh data
  });
  
  // Always prefer fresh data, but fallback to cache if needed
  const effectiveData = (query.data && query.data.length > 0) 
    ? query.data 
    : cachedBudgetPosts;
  
  return {
    ...query,
    data: effectiveData,
    // Show as loading only if we don't have any data at all
    isLoading: query.isLoading && effectiveData.length === 0,
  };
}

// Hook specifically for getting ALL budget posts for linked transaction lookups
export function useAllBudgetPosts() {
  return useQuery<BudgetPost[]>({
    queryKey: ['/api/budget-posts', 'all'],
    queryFn: async () => {
      console.log('🔄 [useAllBudgetPosts] Fetching ALL budget posts for linked transactions');
      const data = await apiRequest('/api/budget-posts');
      console.log('✅ [useAllBudgetPosts] Fetched budget posts:', data.length);
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });
}

export function useBudgetPost(id: string) {
  return useQuery<BudgetPost>({
    queryKey: ['/api/budget-posts', id],
    queryFn: () => apiRequest(`/api/budget-posts/${id}`),
    enabled: !!id,
  });
}

export function useCreateBudgetPost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: InsertBudgetPost) => 
      apiRequest('/api/budget-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budget-posts'] });
      // Clear cache to force refresh
      localStorage.removeItem(BUDGET_POSTS_CACHE_KEY);
    },
  });
}

export function useUpdateBudgetPost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertBudgetPost> }) =>
      apiRequest(`/api/budget-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budget-posts'] });
      // Clear cache to force refresh
      localStorage.removeItem(BUDGET_POSTS_CACHE_KEY);
    },
  });
}

export function useDeleteBudgetPost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/budget-posts/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budget-posts'] });
      // Clear cache to force refresh
      localStorage.removeItem(BUDGET_POSTS_CACHE_KEY);
    },
  });
}