import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FamilyMember } from '@shared/schema';
import { apiStore } from '@/store/apiStore';

// Get all family members
export function useFamilyMembers() {
  return useQuery({
    queryKey: ['/api/family-members'],
    queryFn: () => apiStore.familyMembers,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Create family member mutation
export function useCreateFamilyMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; role?: string }) => {
      await apiStore.createFamilyMember(data);
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
      await apiStore.updateFamilyMember(id, data);
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
      await apiStore.deleteFamilyMember(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/family-members'] });
    },
  });
}