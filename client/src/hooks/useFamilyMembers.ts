import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FamilyMember } from '@shared/schema';
import { apiStore } from '@/store/apiStore';

// Helper function for API requests
async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  return response.json();
}

// Get all family members
export function useFamilyMembers() {
  return useQuery({
    queryKey: ['/api/family-members'],
    queryFn: () => apiRequest('/api/family-members'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Create family member mutation
export function useCreateFamilyMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; role?: string }) => {
      return apiRequest('/api/family-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/family-members'] });
    },
  });
}

// Update family member mutation
export function useUpdateFamilyMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; role?: string } }) => {
      return apiRequest(`/api/family-members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/family-members'] });
    },
  });
}

// Delete family member mutation
export function useDeleteFamilyMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/family-members/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/family-members'] });
    },
  });
}