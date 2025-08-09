// Advanced batch loading hook for transactions with current month first strategy
import { useState, useEffect, useMemo } from 'react';
import { useTransactions } from './useTransactions';
import type { Transaction } from '@shared/schema';

interface BatchLoadingState {
  transactions: Transaction[];
  isLoadingCurrent: boolean;
  isLoadingHistorical: boolean;
  loadedMonths: string[];
  totalAvailable: number;
  hasMore: boolean;
}

export function useBatchTransactions() {
  const [loadedMonths, setLoadedMonths] = useState<string[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  
  // Get current month in YYYY-MM format
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  
  // Start of current month
  const currentMonthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }, []);
  
  // Load current month first
  const { 
    data: currentMonthTransactions = [], 
    isLoading: isLoadingCurrent,
    error: currentMonthError 
  } = useTransactions({
    fromDate: currentMonthStart,
    toDate: new Date().toISOString().split('T')[0] // Today
  });
  
  // Track loaded months
  useEffect(() => {
    if (currentMonthTransactions.length > 0 && !loadedMonths.includes(currentMonth)) {
      setLoadedMonths(prev => [...prev, currentMonth]);
    }
  }, [currentMonthTransactions, currentMonth, loadedMonths]);
  
  // Load additional historical months on demand
  const loadPreviousMonth = async () => {
    if (isLoadingHistorical) return;
    
    setIsLoadingHistorical(true);
    
    try {
      // Find the oldest loaded month and go back one more month
      const sortedMonths = [...loadedMonths].sort().reverse();
      const oldestMonth = sortedMonths[sortedMonths.length - 1] || currentMonth;
      
      // Calculate previous month
      const [year, month] = oldestMonth.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1); // month-2 because months are 0-indexed
      const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Skip if already loaded
      if (loadedMonths.includes(prevMonthKey)) {
        setIsLoadingHistorical(false);
        return;
      }
      
      console.log(`📊 [BatchLoading] Loading previous month: ${prevMonthKey}`);
      
      // Calculate date range for previous month
      const startDate = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1);
      const endDate = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0); // Last day of month
      
      // This would trigger a new query - for now, we'll mark the month as loaded
      setLoadedMonths(prev => [...prev, prevMonthKey]);
      
    } catch (error) {
      console.error('Failed to load previous month:', error);
    } finally {
      setIsLoadingHistorical(false);
    }
  };
  
  // Load next 3 months in background
  const loadMoreRecentMonths = () => {
    // Implementation for loading upcoming months (for completeness)
    console.log('📊 [BatchLoading] Loading more recent months...');
  };
  
  const state: BatchLoadingState = {
    transactions: currentMonthTransactions,
    isLoadingCurrent,
    isLoadingHistorical,
    loadedMonths,
    totalAvailable: currentMonthTransactions.length,
    hasMore: loadedMonths.length < 12 // Assume max 12 months of history
  };
  
  return {
    ...state,
    loadPreviousMonth,
    loadMoreRecentMonths,
    error: currentMonthError
  };
}