// Custom hook for managing UUID-based categories with React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Huvudkategori, Underkategori, InsertHuvudkategori, InsertUnderkategori } from '@shared/schema';

// Helper function for API requests
async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  return response.json();
}

// Huvudkategori hooks
export function useHuvudkategorier() {
  return useQuery<Huvudkategori[]>({
    queryKey: ['/api/huvudkategorier'],
    queryFn: () => apiRequest('/api/huvudkategorier'),
  });
}

export function useHuvudkategori(id: string) {
  return useQuery<Huvudkategori>({
    queryKey: ['/api/huvudkategorier', id],
    queryFn: () => apiRequest(`/api/huvudkategorier/${id}`),
    enabled: !!id,
  });
}

export function useCreateHuvudkategori() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: InsertHuvudkategori) => 
      apiRequest('/api/huvudkategorier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/huvudkategorier'] });
    },
  });
}

export function useUpdateHuvudkategori() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertHuvudkategori> }) =>
      apiRequest(`/api/huvudkategorier/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/huvudkategorier'] });
    },
  });
}

export function useDeleteHuvudkategori() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/huvudkategorier/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/huvudkategorier'] });
      queryClient.invalidateQueries({ queryKey: ['/api/underkategorier'] });
    },
  });
}

// Underkategori hooks
export function useUnderkategorier(huvudkategoriId?: string) {
  return useQuery<Underkategori[]>({
    queryKey: huvudkategoriId 
      ? ['/api/underkategorier', { huvudkategoriId }]
      : ['/api/underkategorier'],
    queryFn: () => {
      const url = huvudkategoriId 
        ? `/api/underkategorier?huvudkategoriId=${huvudkategoriId}`
        : '/api/underkategorier';
      return apiRequest(url);
    },
  });
}

export function useUnderkategori(id: string) {
  return useQuery<Underkategori>({
    queryKey: ['/api/underkategorier', id],
    queryFn: () => apiRequest(`/api/underkategorier/${id}`),
    enabled: !!id,
  });
}

export function useCreateUnderkategori() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: InsertUnderkategori) =>
      apiRequest('/api/underkategorier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/underkategorier'] });
    },
  });
}

export function useUpdateUnderkategori() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertUnderkategori> }) =>
      apiRequest(`/api/underkategorier/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/underkategorier'] });
    },
  });
}

export function useDeleteUnderkategori() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/underkategorier/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/underkategorier'] });
    },
  });
}

// Helper hook to get categories with hierarchical structure
export function useCategoriesHierarchy() {
  const { data: huvudkategorier = [], isLoading: isLoadingHuvud } = useHuvudkategorier();
  const { data: underkategorier = [], isLoading: isLoadingUnder } = useUnderkategorier();

  const categoriesWithSubs = huvudkategorier.map(huvud => ({
    ...huvud,
    underkategorier: underkategorier.filter(under => under.huvudkategoriId === huvud.id)
  }));

  return {
    categories: categoriesWithSubs,
    hovedkategorier: huvudkategorier,
    underkategorier,
    isLoading: isLoadingHuvud || isLoadingUnder,
  };
}

// Helper function to find category names by UUIDs
export function useCategoryNames() {
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: underkategorier = [] } = useUnderkategorier();

  const getHuvudkategoriName = (id?: string) => {
    if (!id) return undefined;
    return huvudkategorier.find(kat => kat.id === id)?.name;
  };

  const getUnderkategoriName = (id?: string) => {
    if (!id) return undefined;
    return underkategorier.find(kat => kat.id === id)?.name;
  };

  const getCategoryPath = (huvudId?: string, underId?: string) => {
    const huvudName = getHuvudkategoriName(huvudId);
    const underName = getUnderkategoriName(underId);
    
    if (huvudName && underName) {
      return `${huvudName} > ${underName}`;
    }
    return huvudName || underName || '';
  };

  return {
    getHuvudkategoriName,
    getUnderkategoriName,
    getCategoryPath,
    huvudkategorier,
    underkategorier,
  };
}