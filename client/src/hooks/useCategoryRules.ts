// UUID-based Category Rules hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { CategoryRuleDB, InsertCategoryRule } from '@shared/schema';

export function useCategoryRules() {
  return useQuery<CategoryRuleDB[]>({
    queryKey: ['/api/category-rules'],
    queryFn: () => apiRequest('/api/category-rules'),
  });
}

export function useCategoryRule(id: string) {
  return useQuery<CategoryRuleDB>({
    queryKey: ['/api/category-rules', id],
    queryFn: () => apiRequest(`/api/category-rules/${id}`),
    enabled: !!id,
  });
}

export function useCreateCategoryRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: InsertCategoryRule) =>
      apiRequest('/api/category-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/category-rules'] });
    },
  });
}

export function useUpdateCategoryRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertCategoryRule> }) =>
      apiRequest(`/api/category-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/category-rules'] });
    },
  });
}

export function useDeleteCategoryRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/category-rules/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/category-rules'] });
    },
  });
}