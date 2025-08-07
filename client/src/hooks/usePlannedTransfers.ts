import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiStore } from '@/store/apiStore';
import type { PlannedTransfer } from '@/types/plannedTransfer';

export function usePlannedTransfers(month?: string) {
  const apiUrl = useApiStore(state => state.apiUrl);
  const queryClient = useQueryClient();

  const { data: transfers = [], isLoading, error } = useQuery({
    queryKey: ['plannedTransfers', month],
    queryFn: async () => {
      const params = month ? `?month=${month}` : '';
      const response = await fetch(`${apiUrl}/api/planned-transfers${params}`);
      if (!response.ok) throw new Error('Failed to fetch planned transfers');
      const data = await response.json();
      
      // Convert amounts from öre to SEK and parse JSON fields
      return data.map((transfer: any) => ({
        ...transfer,
        amount: transfer.amount / 100,
        dailyAmount: transfer.dailyAmount ? transfer.dailyAmount / 100 : undefined,
        transferDays: transfer.transferDays ? JSON.parse(transfer.transferDays) : undefined
      }));
    }
  });

  const createTransfer = useMutation({
    mutationFn: async (transfer: Omit<PlannedTransfer, 'id' | 'created'>) => {
      const response = await fetch(`${apiUrl}/api/planned-transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transfer)
      });
      if (!response.ok) throw new Error('Failed to create planned transfer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plannedTransfers'] });
    }
  });

  const updateTransfer = useMutation({
    mutationFn: async ({ id, ...transfer }: Partial<PlannedTransfer> & { id: string }) => {
      const response = await fetch(`${apiUrl}/api/planned-transfers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transfer)
      });
      if (!response.ok) throw new Error('Failed to update planned transfer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plannedTransfers'] });
    }
  });

  const deleteTransfer = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${apiUrl}/api/planned-transfers/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete planned transfer');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plannedTransfers'] });
    }
  });

  return {
    transfers,
    isLoading,
    error,
    createTransfer: createTransfer.mutate,
    updateTransfer: updateTransfer.mutate,
    deleteTransfer: deleteTransfer.mutate
  };
}