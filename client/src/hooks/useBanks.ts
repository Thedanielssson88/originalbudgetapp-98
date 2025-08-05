import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Helper function for API requests
async function apiRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  return response.json();
}

type Bank = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};

type BankCsvMapping = {
  id: string;
  userId: string;
  bankId: string;
  name: string;
  dateColumn?: string;
  descriptionColumn?: string;
  amountColumn?: string;
  balanceColumn?: string;
  bankCategoryColumn?: string;
  bankSubCategoryColumn?: string;
  isActive: string;
  createdAt: string;
  updatedAt: string;
};

// Banks hooks
export function useBanks() {
  return useQuery<Bank[]>({
    queryKey: ['/api/banks'],
  });
}

export function useCreateBank() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bank: { name: string }) => {
      return await apiRequest('/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bank),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
    },
  });
}

export function useDeleteBank() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bankId: string) => {
      return await apiRequest(`/api/banks/${bankId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bank-csv-mappings'] });
    },
  });
}

// Bank CSV Mappings hooks
export function useBankCsvMappings() {
  return useQuery<BankCsvMapping[]>({
    queryKey: ['/api/bank-csv-mappings'],
  });
}

export function useBankCsvMappingsByBank(bankId: string) {
  return useQuery<BankCsvMapping[]>({
    queryKey: ['/api/bank-csv-mappings', 'bank', bankId],
    queryFn: () => apiRequest(`/api/bank-csv-mappings/bank/${bankId}`),
    enabled: !!bankId,
  });
}

export function useCreateBankCsvMapping() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (mapping: {
      bankId: string;
      name: string;
      dateColumn?: string;
      descriptionColumn?: string;
      amountColumn?: string;
      balanceColumn?: string;
      bankCategoryColumn?: string;
      bankSubCategoryColumn?: string;
    }) => {
      return await apiRequest('/api/bank-csv-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-csv-mappings'] });
    },
  });
}

export function useUpdateBankCsvMapping() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...mapping }: {
      id: string;
      name?: string;
      dateColumn?: string;
      descriptionColumn?: string;
      amountColumn?: string;
      balanceColumn?: string;
      bankCategoryColumn?: string;
      bankSubCategoryColumn?: string;
      isActive?: string;
    }) => {
      return await apiRequest(`/api/bank-csv-mappings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-csv-mappings'] });
    },
  });
}

export function useDeleteBankCsvMapping() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (mappingId: string) => {
      return await apiRequest(`/api/bank-csv-mappings/${mappingId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-csv-mappings'] });
    },
  });
}