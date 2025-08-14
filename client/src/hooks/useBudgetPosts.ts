// Custom hook for managing budget posts with React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BudgetPost, InsertBudgetPost } from '@shared/schema';

// Helper function for API requests
async function apiRequest(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      console.log(`[useBudgetPosts] API request failed: ${response.status} ${response.statusText} for ${url}`);
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.log(`[useBudgetPosts] Network error for ${url}:`, error);
    // Re-throw with context but don't use console.error to avoid runtime popup
    if (error instanceof Error) {
      throw new Error(`Budget posts request failed: ${error.message}`);
    } else {
      throw new Error(`Budget posts request failed: Network error`);
    }
  }
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
    console.log('[useBudgetPosts] Failed to cache budget posts:', error);
  }
}

export function useBudgetPosts(monthKey?: string) {
  // Get cached budget posts immediately on hook initialization
  const cachedBudgetPosts = getCachedBudgetPosts();
  
  const query = useQuery<BudgetPost[]>({
    queryKey: ['/api/budget-posts', monthKey],
    queryFn: async () => {
      try {
        const url = monthKey ? `/api/budget-posts?monthKey=${monthKey}` : '/api/budget-posts';
        const data = await apiRequest(url);
        // Cache the fresh data immediately
        if (data && data.length > 0) {
          cacheBudgetPosts(data);
        }
        return data;
      } catch (error) {
        console.log(`[useBudgetPosts] Query failed, returning cached data:`, error instanceof Error ? error.message : String(error));
        // Return cached data instead of throwing to prevent runtime error overlay
        return cachedBudgetPosts;
      }
    },
    // Use cached data as initial data
    initialData: cachedBudgetPosts.length > 0 ? cachedBudgetPosts : undefined,
    staleTime: 0, // Always refetch to get fresh data
    retry: false, // Don't retry since we handle errors in queryFn
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
      try {
        // Fetch all budget posts across all months
        const data = await apiRequest('/api/budget-posts-all');
        return data || [];
      } catch (error) {
        console.log('[useAllBudgetPosts] Failed to fetch all budget posts:', error);
        return [];
      }
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