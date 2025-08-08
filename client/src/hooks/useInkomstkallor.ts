import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Inkomstkall, InsertInkomstkall, InkomstkallorMedlem, InsertInkomstkallorMedlem } from '@shared/schema';

// Income sources hooks
export function useInkomstkallor() {
  return useQuery<Inkomstkall[]>({
    queryKey: ['/api/inkomstkallor'],
    queryFn: async () => {
      const response = await fetch('/api/inkomstkallor');
      if (!response.ok) throw new Error('Failed to fetch inkomstkällor');
      return response.json();
    },
  });
}

export function useCreateInkomstkall() {
  const queryClient = useQueryClient();
  
  return useMutation<Inkomstkall, Error, Omit<InsertInkomstkall, 'userId'>>({
    mutationFn: async (data) => {
      const response = await fetch('/api/inkomstkallor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create inkomstkälla');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inkomstkallor'] });
    },
  });
}

export function useUpdateInkomstkall() {
  const queryClient = useQueryClient();
  
  return useMutation<Inkomstkall, Error, { id: string; data: Partial<Omit<InsertInkomstkall, 'userId'>> }>({
    mutationFn: async ({ id, data }) => {
      const response = await fetch(`/api/inkomstkallor/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update inkomstkälla');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inkomstkallor'] });
    },
  });
}

export function useDeleteInkomstkall() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/inkomstkallor/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete inkomstkälla');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inkomstkallor'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inkomstkallor-medlem'] });
    },
  });
}

// Income source member assignments hooks
export function useInkomstkallorMedlem() {
  return useQuery<InkomstkallorMedlem[]>({
    queryKey: ['/api/inkomstkallor-medlem'],
    queryFn: async () => {
      const response = await fetch('/api/inkomstkallor-medlem');
      if (!response.ok) throw new Error('Failed to fetch inkomstkällor medlem');
      return response.json();
    },
  });
}

export function useCreateInkomstkallorMedlem() {
  const queryClient = useQueryClient();
  
  return useMutation<InkomstkallorMedlem, Error, Omit<InsertInkomstkallorMedlem, 'userId'>>({
    mutationFn: async (data) => {
      const response = await fetch('/api/inkomstkallor-medlem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create inkomstkällor medlem');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inkomstkallor-medlem'] });
    },
  });
}

export function useUpdateInkomstkallorMedlem() {
  const queryClient = useQueryClient();
  
  return useMutation<InkomstkallorMedlem, Error, { id: string; data: Partial<Omit<InsertInkomstkallorMedlem, 'userId'>> }>({
    mutationFn: async ({ id, data }) => {
      const response = await fetch(`/api/inkomstkallor-medlem/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update inkomstkällor medlem');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inkomstkallor-medlem'] });
    },
  });
}

export function useDeleteInkomstkallorMedlem() {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/inkomstkallor-medlem/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete inkomstkällor medlem');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inkomstkallor-medlem'] });
    },
  });
}