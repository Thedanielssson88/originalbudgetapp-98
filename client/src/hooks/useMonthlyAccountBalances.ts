import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

export interface MonthlyAccountBalance {
  id: string;
  userId: string;
  monthKey: string;
  accountId: string;
  calculatedBalance: number; // in öre
  faktisktKontosaldo?: number | null; // in öre
  bankensKontosaldo?: number | null; // in öre
  createdAt: string;
  updatedAt: string;
}

export interface InsertMonthlyAccountBalance {
  userId: string;
  monthKey: string;
  accountId: string;
  calculatedBalance: number; // in öre
}

export function useMonthlyAccountBalances(monthKey?: string) {
  const queryKey = monthKey 
    ? ['/api/monthly-account-balances', monthKey]
    : ['/api/monthly-account-balances'];
    
  return useQuery<MonthlyAccountBalance[]>({
    queryKey,
    queryFn: () => {
      const url = monthKey 
        ? `/api/monthly-account-balances?monthKey=${monthKey}`
        : '/api/monthly-account-balances';
      return apiRequest(url);
    },
  });
}

export function useSaveMonthlyAccountBalance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: InsertMonthlyAccountBalance) => 
      apiRequest('/api/monthly-account-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate all monthly account balance queries
      queryClient.invalidateQueries({ queryKey: ['/api/monthly-account-balances'] });
    },
  });
}

export function useUpdateFaktisktKontosaldo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ monthKey, accountId, faktisktKontosaldo }: { 
      monthKey: string; 
      accountId: string; 
      faktisktKontosaldo: number | null; 
    }) => 
      apiRequest(`/api/monthly-account-balances/${monthKey}/${accountId}/faktiskt-kontosaldo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faktisktKontosaldo }),
      }),
    onSuccess: () => {
      // Invalidate all monthly account balance queries
      queryClient.invalidateQueries({ queryKey: ['/api/monthly-account-balances'] });
    },
  });
}