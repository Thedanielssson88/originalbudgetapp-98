import { useState, useEffect } from 'react';
import { apiStore } from '@/store/apiStore';
import type { MonthlyBudget } from '@shared/schema';

interface UseMonthlyBudgetReturn {
  monthlyBudget: MonthlyBudget | null;
  isLoading: boolean;
  updateIncome: (field: keyof MonthlyBudget, value: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMonthlyBudget(monthKey: string): UseMonthlyBudgetReturn {
  const [monthlyBudget, setMonthlyBudget] = useState<MonthlyBudget | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMonthlyBudget = async () => {
    try {
      setIsLoading(true);
      const budget = await apiStore.getOrCreateMonthlyBudget(monthKey);
      setMonthlyBudget(budget);
    } catch (error) {
      console.error('Error loading monthly budget:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateIncome = async (field: keyof MonthlyBudget, value: number) => {
    if (!monthlyBudget) return;

    try {
      const updates = { [field]: value };
      const updated = await apiStore.updateMonthlyBudget(monthKey, updates);
      setMonthlyBudget(updated);
    } catch (error) {
      console.error('Error updating monthly budget:', error);
      // Optionally re-fetch the data on error
      await loadMonthlyBudget();
    }
  };

  useEffect(() => {
    loadMonthlyBudget();
  }, [monthKey]);

  return {
    monthlyBudget,
    isLoading,
    updateIncome,
    refresh: loadMonthlyBudget
  };
}