import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, ChevronRight, ArrowLeftRight, Plus, Edit3, Trash2, DollarSign } from 'lucide-react';
import { BudgetState, PlannedTransfer, BudgetItem, Account, MonthData, Transaction } from '@/types/budget';
import { getAccountNameById } from '../orchestrator/budgetOrchestrator';
import { getDateRangeForMonth, getInternalTransferSummary } from '../services/calculationService';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgetPosts } from '@/hooks/useBudgetPosts';
import { useHuvudkategorier, useUnderkategorier, useCategoriesHierarchy } from '@/hooks/useCategories';
import { formatOrenAsCurrency, kronoraToOren } from '@/utils/currencyUtils';
import { SimpleTransferMatchDialog } from './SimpleTransferMatchDialog';
import { NewTransferForm } from './NewTransferForm';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';

interface TransfersAnalysisProps {
  budgetState: BudgetState;
  selectedMonth: string;
}

export const TransfersAnalysis: React.FC<TransfersAnalysisProps> = ({
  budgetState,
  selectedMonth
}) => {
  const { data: accountsFromAPI = [], isLoading: accountsLoading } = useAccounts();
  const { data: transactionsFromAPI = [] } = useTransactions();
  const { data: budgetPosts = [], isLoading: budgetPostsLoading, refetch: refetchBudgetPosts } = useBudgetPosts(selectedMonth);
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: underkategorier = [] } = useUnderkategorier();
  const { categories } = useCategoriesHierarchy();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [expandedKontoAccounts, setExpandedKontoAccounts] = useState<Set<string>>(new Set());
  const [expandedKontoDailyTransfers, setExpandedKontoDailyTransfers] = useState<Set<string>>(new Set());
  const [expandedBudgetCosts, setExpandedBudgetCosts] = useState<Set<string>>(new Set());
  const [expandedKontoSections, setExpandedKontoSections] = useState<Set<string>>(new Set(['budgetCosts', 'plannedTransfers', 'actualTransfers']));
  const [transferMatchDialog, setTransferMatchDialog] = useState<{
    isOpen: boolean;
    transaction?: Transaction;
    suggestions?: Transaction[];
  }>({ isOpen: false });
  
  const [showNewTransferForm, setShowNewTransferForm] = useState(false);
  const [selectedFromAccountId, setSelectedFromAccountId] = useState<string>('');
  const [expandedDailyTransfers, setExpandedDailyTransfers] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);

  // Helper functions for getting category names - memoized to prevent re-renders
  const getCategoryName = React.useCallback((categoryId: string | undefined): string => {
    if (!categoryId || !categories.length) return '-';
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || '-';
  }, [categories]);

  const getSubCategoryName = React.useCallback((huvudkategoriId: string | undefined, underkategoriId: string | undefined): string => {
    if (!huvudkategoriId || !underkategoriId || !categories.length) return '-';
    const category = categories.find(cat => cat.id === huvudkategoriId);
    const subCategory = category?.underkategorier?.find(sub => sub.id === underkategoriId);
    return subCategory?.name || '-';
  }, [categories]);

  // Toggle account expansion
  const toggleAccount = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  // Toggle kontoöversikt account expansion
  const toggleKontoAccount = (accountId: string) => {
    const newExpanded = new Set(expandedKontoAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedKontoAccounts(newExpanded);
  };

  // Toggle daily transfer expansion in kontoöversikt
  const toggleKontoDailyTransfer = (transferId: string) => {
    const newExpanded = new Set(expandedKontoDailyTransfers);
    if (newExpanded.has(transferId)) {
      newExpanded.delete(transferId);
    } else {
      newExpanded.add(transferId);
    }
    setExpandedKontoDailyTransfers(newExpanded);
  };

  // Toggle budget cost expansion
  const toggleBudgetCost = React.useCallback((costId: string) => {
    try {
      addMobileDebugLog(`[TransfersAnalysis] Toggling budget cost: ${costId}`);
      setExpandedBudgetCosts(prev => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(costId)) {
          newExpanded.delete(costId);
          addMobileDebugLog(`[TransfersAnalysis] Collapsing cost: ${costId}`);
        } else {
          newExpanded.add(costId);
          addMobileDebugLog(`[TransfersAnalysis] Expanding cost: ${costId}`);
        }
        return newExpanded;
      });
    } catch (error) {
      addMobileDebugLog(`[TransfersAnalysis] Error toggling cost: ${error}`);
    }
  }, []);

  // Toggle main section expansion in kontoöversikt
  const toggleKontoSection = (sectionId: string) => {
    const newExpanded = new Set(expandedKontoSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedKontoSections(newExpanded);
  };

  // Get category name by ID
  const getHuvudkategoriName = (id: string | null): string => {
    if (!id) return 'Ingen kategori';
    const kategori = huvudkategorier.find(k => k.id === id);
    return kategori?.name || 'Okänd kategori';
  };

  const getUnderkategoriName = (id: string | null): string => {
    if (!id) return 'Ingen underkategori';
    const kategori = underkategorier.find(k => k.id === id);
    return kategori?.name || 'Okänd underkategori';
  };

  // Toggle daily transfer expansion
  const toggleDailyTransfer = (transferId: string) => {
    const newExpanded = new Set(expandedDailyTransfers);
    if (newExpanded.has(transferId)) {
      newExpanded.delete(transferId);
    } else {
      newExpanded.add(transferId);
    }
    setExpandedDailyTransfers(newExpanded);
  };

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', { 
      style: 'currency', 
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Get day names in Swedish
  const getDayNames = (days: number[]) => {
    const dayNames = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
    return days.map(d => dayNames[d]).join(', ');
  };

  // Count specific weekdays in a date range (payday-based)
  const countWeekdaysInMonth = (monthKey: string, selectedWeekdays: number[], payday: number = 25): number => {
    const { startDate, endDate } = getDateRangeForMonth(monthKey, payday);
    
    let count = 0;
    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);
    
    // Iterate through each day in the range
    while (currentDate <= lastDate) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Check if this day is in our selected weekdays
      if (selectedWeekdays.includes(dayOfWeek)) {
        count++;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return count;
  };

  // Handle new transfer form
  const openNewTransferForm = (fromAccountId?: string) => {
    setSelectedFromAccountId(fromAccountId || '');
    setShowNewTransferForm(true);
  };

  // Handle transfer creation
  const handleCreateTransfer = async (transfer: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    transferType: 'monthly' | 'daily';
    dailyAmount?: number;
    transferDays?: number[];
    huvudkategoriId?: string;
    underkategoriId?: string;
  }) => {
    try {
      console.log('🔄 [TRANSFER CREATION] Starting transfer creation');
      console.log('🔄 [TRANSFER CREATION] Transfer data:', transfer);
      console.log('🔄 [TRANSFER CREATION] Selected month:', selectedMonth);
      console.log('🔄 [TRANSFER CREATION] From account ID:', transfer.fromAccountId);
      console.log('🔄 [TRANSFER CREATION] To account ID:', transfer.toAccountId);

      // Calculate total monthly amount for daily transfers
      let totalMonthlyAmount = transfer.amount;
      
      if (transfer.transferType === 'daily' && transfer.dailyAmount && transfer.transferDays && transfer.transferDays.length > 0) {
        const payday = budgetState.settings?.payday || 25;
        const weekdayCount = countWeekdaysInMonth(selectedMonth, transfer.transferDays, payday);
        totalMonthlyAmount = transfer.dailyAmount * weekdayCount;
        
        console.log('🔄 [TRANSFER CREATION] Daily transfer calculation:');
        console.log('  - Daily amount:', transfer.dailyAmount);
        console.log('  - Transfer days:', transfer.transferDays);
        console.log('  - Weekday count for month:', weekdayCount);
        console.log('  - Total monthly amount:', totalMonthlyAmount);
      }

      // Create budget post for the transfer
      const budgetPostData = {
        monthKey: selectedMonth,
        huvudkategoriId: transfer.huvudkategoriId || null,
        underkategoriId: transfer.underkategoriId || null,
        description: transfer.description || 'Planerad överföring',
        amount: kronoraToOren(totalMonthlyAmount), // Convert calculated total to öre
        accountId: transfer.toAccountId, // To account
        accountIdFrom: transfer.fromAccountId, // From account
        financedFrom: `Från ${accountsFromAPI.find(acc => acc.id === transfer.fromAccountId)?.name || 'okänt konto'}`,
        transferType: transfer.transferType,
        dailyAmount: transfer.dailyAmount ? kronoraToOren(transfer.dailyAmount) : null, // Convert to öre
        transferDays: transfer.transferDays ? JSON.stringify(transfer.transferDays) : null,
        type: 'transfer',
        userId: 'dev-user-123'
      };

      console.log('🔄 [TRANSFER CREATION] Budget post data to send:', budgetPostData);

      const response = await fetch('/api/budget-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(budgetPostData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const createdTransfer = await response.json();
      console.log('Transfer created successfully:', createdTransfer);
      
      // Refresh budget posts to show the new transfer
      await refetchBudgetPosts();
      
    } catch (error) {
      console.error('Error creating transfer:', error);
      // TODO: Show error message to user
    } finally {
      setShowNewTransferForm(false);
      setSelectedFromAccountId('');
    }
  };

  // Handle deleting planned transfers
  const handleDeletePlannedTransfer = async (transferId: string) => {
    console.log('🔄 [TRANSFER DELETION] Attempting to delete transfer with ID:', transferId);

    try {
      const response = await fetch(`/api/budget-posts/${transferId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Transfer deleted successfully');
      
      // Refresh budget posts to update the UI
      await refetchBudgetPosts();
      
    } catch (error) {
      console.error('Error deleting transfer:', error);
      // TODO: Show error message to user
    }
  };

  // Handle clicking on "Ej matchad" badge to match transfers
  const handleMatchTransfer = (transaction: Transaction) => {
    // Get all transactions for the period
    const { startDate, endDate } = getDateRangeForMonth(selectedMonth, budgetState.settings?.payday || 25);
    const allTransactions = budgetState.allTransactions || [];
    const transactionsForPeriod = allTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= new Date(startDate) && transactionDate <= new Date(endDate);
    });

    // Find potential matches - ALL transactions with opposite sign within 7 days from OTHER accounts
    const potentialMatches = transactionsForPeriod.filter(t => 
      t.id !== transaction.id &&
      t.accountId !== transaction.accountId && // Different account
      // Opposite signs (positive matches negative, negative matches positive)
      ((transaction.amount > 0 && t.amount < 0) || (transaction.amount < 0 && t.amount > 0)) &&
      Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01 && // Same absolute amount
      Math.abs(new Date(t.date).getTime() - new Date(transaction.date).getTime()) <= 7 * 24 * 60 * 60 * 1000 // Within 7 days
    );

    console.log('🔍 [TRANSFER MATCH] Looking for matches for transaction:', transaction);
    console.log('🔍 [TRANSFER MATCH] Found potential matches:', potentialMatches);

    setTransferMatchDialog({
      isOpen: true,
      transaction,
      suggestions: potentialMatches
    });
  };


  // Hämta interna överföringar för varje konto (outside useMemo so it can be used in render)
  // CRITICAL FIX: Use SQL transactions instead of localStorage budgetState
  // Pass accounts from API to transfer calculation
  const budgetStateWithAPIAccounts = {
    ...budgetState,
    accounts: accountsFromAPI
  };
  const allInternalTransfers = getInternalTransferSummary(budgetStateWithAPIAccounts, selectedMonth, transactionsFromAPI);

  // Helper function to get account name by ID
  const getAccountNameByIdHelper = (accountId: string): string => {
    const account = accountsFromAPI.find(acc => acc.id === accountId);
    return account?.name || 'Okänt konto';
  };

  return (
    <div className="space-y-6">
      {/* Kontoöversikt Section - Matching Detaljvy Design */}
      <Card className="shadow-lg border-0 bg-blue-50/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <ArrowLeftRight className="h-5 w-5" />
            Kontoöversikt
          </CardTitle>
          <CardDescription className="text-blue-700">
            Översikt av alla konton med planerade och faktiska överföringar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-100/50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-blue-800">Kontoöversikt ({selectedMonth})</h3>
                <p className="text-sm text-blue-700">Planerade vs faktiska överföringar per konto</p>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                className="border-blue-300 text-blue-800 hover:bg-blue-200"
                onClick={() => openNewTransferForm()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ny Överföring
              </Button>
            </div>
            
            <div className="space-y-3">
              {accountsFromAPI.length === 0 ? (
                <div className="text-center py-8 text-blue-700">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Inga konton tillgängliga</p>
                  <p className="text-sm opacity-75">Lägg till konton för att se en översikt här</p>
                </div>
              ) : (
                accountsFromAPI.map(account => {
                  // Get planned transfers for this account from budget posts
                  const transferPosts = budgetPosts.filter((post: any) => 
                    post.type === 'transfer' && 
                    (post.accountId === account.id || post.accountIdFrom === account.id)
                  );
                  
                  // Calculate incoming planned transfers
                  const plannedIncoming = transferPosts
                    .filter((post: any) => post.accountId === account.id)
                    .reduce((sum: number, post: any) => sum + (post.amount || 0), 0);
                  
                  // Calculate outgoing planned transfers
                  const plannedOutgoing = transferPosts
                    .filter((post: any) => post.accountIdFrom === account.id)
                    .reduce((sum: number, post: any) => sum + (post.amount || 0), 0);
                  
                  // Calculate net planned transfers
                  const netPlanned = plannedIncoming - plannedOutgoing;
                  
                  // Get budget posts for this account (costs)
                  const costPosts = budgetPosts.filter((post: any) => 
                    post.type === 'cost' && post.accountId === account.id
                  );
                  const totalBudgeted = costPosts.reduce((sum: number, post: any) => sum + (post.amount || 0), 0);
                  
                  // Get internal transfers for this account from our calculation
                  const accountInternalTransfers = allInternalTransfers.find(t => t.accountId === account.id);
                  const actualTransferredIn = accountInternalTransfers?.totalIn || 0;
                  
                  // Only show accounts that have some activity
                  if (costPosts.length === 0 && transferPosts.length === 0 && actualTransferredIn === 0) {
                    return null;
                  }

                  const isAccountExpanded = expandedKontoAccounts.has(account.id);

                  return (
                    <div key={account.id} className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                      {/* Account Header - Klickbar för expansion */}
                      <div 
                        className="p-4 cursor-pointer hover:bg-blue-50/50 transition-colors"
                        onClick={() => toggleKontoAccount(account.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-blue-900 text-lg">{account.name}</h4>
                              <ChevronDown className={`h-4 w-4 text-blue-600 transition-transform ${isAccountExpanded ? 'rotate-180' : ''}`} />
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="text-center">
                                <div className="text-red-700 font-medium">Budgeterade kostnader</div>
                                <div className="font-semibold text-red-900">{formatOrenAsCurrency(totalBudgeted)}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-blue-700 font-medium">Planerat</div>
                                <div className="font-semibold text-blue-900">{formatOrenAsCurrency(netPlanned)}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-green-600 font-medium">Faktiskt</div>
                                <div className="font-semibold text-green-600">{formatOrenAsCurrency(actualTransferredIn)}</div>
                              </div>
                            </div>
                            
                            {/* Progress bar för planerat vs faktiskt */}
                            <div className="w-full bg-blue-100 rounded-full h-2 mt-3">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                style={{ 
                                  width: netPlanned > 0 
                                    ? `${Math.min((actualTransferredIn / netPlanned) * 100, 100)}%` 
                                    : '0%' 
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanderat innehåll med detaljer */}
                      {isAccountExpanded && (
                        <div className="border-t border-blue-200 bg-blue-25/25">
                          <div className="p-4 space-y-4">
                            
                            {/* Budgeterade kostnader */}
                            {costPosts.length > 0 && (
                              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                                <div 
                                  className="flex items-center gap-2 mb-3 cursor-pointer hover:bg-red-100/50 rounded p-2 -m-2 transition-colors"
                                  onClick={() => toggleKontoSection('budgetCosts')}
                                >
                                  <h4 className="font-semibold text-sm text-red-800 uppercase tracking-wide">
                                    Budgeterade Kostnader ({costPosts.length})
                                  </h4>
                                  <ChevronDown className={`h-4 w-4 text-red-600 transition-transform ml-auto ${expandedKontoSections.has('budgetCosts') ? 'rotate-180' : ''}`} />
                                  <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                                    Ut: {formatOrenAsCurrency(totalBudgeted)}
                                  </Badge>
                                </div>
                                
                                {expandedKontoSections.has('budgetCosts') && (
                                  <div className="space-y-2">
                                    {costPosts.map(item => {
                                      const isDaily = item.transferType === 'daily';
                                      const isExpanded = expandedBudgetCosts.has(item.id);
                                      
                                      return (
                                        <div key={item.id}>
                                          <div className="flex justify-between items-center py-2 px-3 rounded bg-white border border-red-100">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm text-red-900">
                                                {item.description}
                                                {isDaily && (
                                                  <span className="ml-2 text-xs text-red-600">
                                                    (Daglig)
                                                  </span>
                                                )}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-sm text-red-800">
                                                {isDaily ? (() => {
                                                  const payday = budgetState.settings?.payday || 25;
                                                  const selectedDays = item.transferDays ? JSON.parse(item.transferDays) : [];
                                                  const transferDayCount = countWeekdaysInMonth(selectedMonth, selectedDays, payday);
                                                  const calculatedTotal = (item.dailyAmount || 0) * transferDayCount;
                                                  return formatOrenAsCurrency(calculatedTotal);
                                                })() : formatOrenAsCurrency(item.amount)}
                                              </span>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                                                onClick={() => toggleBudgetCost(item.id)}
                                              >
                                                {isExpanded ? 
                                                  <ChevronUp className="h-4 w-4" /> : 
                                                  <ChevronDown className="h-4 w-4" />
                                                }
                                              </Button>
                                            </div>
                                          </div>
                                          
                                          {/* Expandable budget cost details */}
                                          {isExpanded && (
                                            <div className="mt-2 ml-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                              <div className="text-xs text-red-700 space-y-1">
                                                <div className="flex justify-between">
                                                  <span className="text-muted-foreground">Huvudkategori:</span>
                                                  <span>{getCategoryName(item.huvudkategoriId)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-muted-foreground">Underkategori:</span>
                                                  <span>{getSubCategoryName(item.huvudkategoriId, item.underkategoriId)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-muted-foreground">Överföringstyp:</span>
                                                  <span>{isDaily ? 'Daglig' : 'Månadsvis'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-muted-foreground">Finansieras från:</span>
                                                  <span>{item.financedFrom || 'Löpande kostnad'}</span>
                                                </div>
                                                {isDaily && (
                                                  <>
                                                    <div className="flex justify-between">
                                                      <span className="text-muted-foreground">Valda dagar:</span>
                                                      <span>{item.transferDays ? JSON.parse(item.transferDays).length : 0} dagar/vecka</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-muted-foreground">Period:</span>
                                                      <span>{(() => {
                                                        const payday = budgetState.settings?.payday || 25;
                                                        const { startDate, endDate } = getDateRangeForMonth(selectedMonth, payday);
                                                        return `${startDate} till ${endDate}`;
                                                      })()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-muted-foreground">Antal överföringsdagar:</span>
                                                      <span>{(() => {
                                                        const payday = budgetState.settings?.payday || 25;
                                                        const selectedDays = item.transferDays ? JSON.parse(item.transferDays) : [];
                                                        return countWeekdaysInMonth(selectedMonth, selectedDays, payday);
                                                      })()} dagar</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span className="text-muted-foreground">Belopp per dag:</span>
                                                      <span>{new Intl.NumberFormat('sv-SE', {
                                                        style: 'currency',
                                                        currency: 'SEK',
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                      }).format((item.dailyAmount || 0) / 100)}</span>
                                                    </div>
                                                    <div className="flex justify-between font-medium">
                                                      <span className="text-muted-foreground">Total månadsbelopp:</span>
                                                      <span>{(() => {
                                                        const payday = budgetState.settings?.payday || 25;
                                                        const selectedDays = item.transferDays ? JSON.parse(item.transferDays) : [];
                                                        const transferDayCount = countWeekdaysInMonth(selectedMonth, selectedDays, payday);
                                                        const calculatedTotal = (item.dailyAmount || 0) * transferDayCount;
                                                        return formatOrenAsCurrency(calculatedTotal);
                                                      })()}</span>
                                                    </div>
                                                  </>
                                                )}
                                                {!isDaily && (
                                                  <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Belopp:</span>
                                                    <span>{formatOrenAsCurrency(item.amount)}</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Planerade överföringar sektion - same style as detaljvy */}
                            {transferPosts.length > 0 && (
                              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                                <div 
                                  className="flex items-center gap-2 mb-3 cursor-pointer hover:bg-yellow-100/50 rounded p-2 -m-2 transition-colors"
                                  onClick={() => toggleKontoSection('plannedTransfers')}
                                >
                                  <h4 className="font-semibold text-sm text-yellow-800 uppercase tracking-wide">
                                    Planerade Överföringar ({transferPosts.length})
                                  </h4>
                                  <ChevronDown className={`h-4 w-4 text-yellow-600 transition-transform ml-auto ${expandedKontoSections.has('plannedTransfers') ? 'rotate-180' : ''}`} />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="ml-2 h-6 w-6 p-0 text-yellow-700 hover:bg-yellow-200"
                                    onClick={() => setEditMode(!editMode)}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  {plannedIncoming > 0 && (
                                    <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                                      In: {formatOrenAsCurrency(plannedIncoming)}
                                    </Badge>
                                  )}
                                  {plannedOutgoing > 0 && (
                                    <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
                                      Ut: {formatOrenAsCurrency(plannedOutgoing)}
                                    </Badge>
                                  )}
                                </div>
                                
                                {expandedKontoSections.has('plannedTransfers') && (
                                  <>
                                    {/* Incoming transfers */}
                                    {plannedIncoming > 0 && (
                                      <div className="mb-3">
                                        <h5 className="text-xs font-medium text-green-700 mb-2">Inkommande:</h5>
                                        <div className="space-y-1">
                                          {transferPosts
                                            .filter((post: any) => post.accountId === account.id)
                                            .map((post: any) => {
                                              const isDaily = post.transferType === 'daily';
                                              const isExpanded = expandedKontoDailyTransfers.has(post.id);
                                              
                                              return (
                                                <div key={post.id}>
                                                  <div 
                                                    className="flex justify-between items-center py-2 px-3 rounded bg-green-50 border border-green-100 cursor-pointer hover:bg-green-100/50 transition-colors"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      addMobileDebugLog(`[TransfersAnalysis] Planned transfer clicked: ${post.id} - ${post.description || 'No description'}`);
                                                      toggleKontoDailyTransfer(post.id);
                                                    }}
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      <span className={`h-4 w-4 text-green-600 ${isExpanded ? 'rotate-90' : ''} transition-transform`}>
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                      </span>
                                                      <span className="text-sm text-green-900">
                                                        {formatOrenAsCurrency(post.amount)} från {getAccountNameByIdHelper(post.accountIdFrom)}
                                                        {post.description && (
                                                          <span className="ml-2 text-xs text-green-600">
                                                            - {post.description}
                                                          </span>
                                                        )}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-medium text-sm text-green-600">
                                                        + {formatOrenAsCurrency(post.amount)}
                                                      </span>
                                                      {editMode && (
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                                                          onClick={() => handleDeletePlannedTransfer(post.id)}
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                      )}
                                                      {isDaily && (
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-6 w-6 p-0 text-green-600 hover:bg-green-100"
                                                          onClick={() => toggleKontoDailyTransfer(post.id)}
                                                        >
                                                          {isExpanded ? 
                                                            <ChevronUp className="h-4 w-4" /> : 
                                                            <ChevronDown className="h-4 w-4" />
                                                          }
                                                        </Button>
                                                      )}
                                                    </div>
                                                  </div>
                                                  {/* Expandable daily transfer details for incoming */}
                                                  {isExpanded && (
                                                    <div className="mt-2 ml-4 p-3 bg-green-50 border border-green-200 rounded-md">
                                                      <div className="text-xs text-green-700 space-y-1">
                                                        <div className="flex justify-between">
                                                          <span className="text-muted-foreground">Huvudkategori:</span>
                                                          <span>{getCategoryName(post.huvudkategoriId)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                          <span className="text-muted-foreground">Underkategori:</span>
                                                          <span>{getSubCategoryName(post.huvudkategoriId, post.underkategoriId)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                          <span className="text-muted-foreground">Överföringstyp:</span>
                                                          <span>{isDaily ? 'Daglig' : 'Månadsvis'}</span>
                                                        </div>
                                                        {isDaily && (
                                                          <>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Valda dagar:</span>
                                                              <span>{post.transferDays ? JSON.parse(post.transferDays).length : 0} dagar/vecka</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Period:</span>
                                                              <span>{(() => {
                                                                const payday = budgetState.settings?.payday || 25;
                                                                const { startDate, endDate } = getDateRangeForMonth(selectedMonth, payday);
                                                                return `${startDate} till ${endDate}`;
                                                              })()}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Antal överföringsdagar:</span>
                                                              <span>{(() => {
                                                                const payday = budgetState.settings?.payday || 25;
                                                                const selectedDays = post.transferDays ? JSON.parse(post.transferDays) : [];
                                                                return countWeekdaysInMonth(selectedMonth, selectedDays, payday);
                                                              })()} dagar</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Belopp per dag:</span>
                                                              <span>{new Intl.NumberFormat('sv-SE', {
                                                                style: 'currency',
                                                                currency: 'SEK',
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                              }).format((post.dailyAmount || 0) / 100)}</span>
                                                            </div>
                                                            <div className="flex justify-between font-medium">
                                                              <span className="text-muted-foreground">Total månadsbelopp:</span>
                                                              <span>{new Intl.NumberFormat('sv-SE', {
                                                                style: 'currency',
                                                                currency: 'SEK',
                                                                minimumFractionDigits: 0,
                                                                maximumFractionDigits: 0
                                                              }).format(post.amount / 100)}</span>
                                                            </div>
                                                          </>
                                                        )}
                                                        {!isDaily && (
                                                          <>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Från Konto:</span>
                                                              <span>{getAccountNameByIdHelper(post.accountIdFrom)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Till Konto:</span>
                                                              <span>{getAccountNameByIdHelper(post.accountId)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Belopp:</span>
                                                              <span>{formatOrenAsCurrency(post.amount)}</span>
                                                            </div>
                                                          </>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Outgoing transfers */}
                                    {plannedOutgoing > 0 && (
                                      <div>
                                        <h5 className="text-xs font-medium text-red-700 mb-2">Utgående:</h5>
                                        <div className="space-y-1">
                                          {transferPosts
                                            .filter((post: any) => post.accountIdFrom === account.id)
                                            .map((post: any) => {
                                              const isDaily = post.transferType === 'daily';
                                              const isExpanded = expandedKontoDailyTransfers.has(post.id);
                                              
                                              return (
                                                <div key={post.id}>
                                                  <div 
                                                    className="flex justify-between items-center py-2 px-3 rounded bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100/50 transition-colors"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      addMobileDebugLog(`[TransfersAnalysis] Planned outgoing transfer clicked: ${post.id} - ${post.description || 'No description'}`);
                                                      toggleKontoDailyTransfer(post.id);
                                                    }}
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      <span className={`h-4 w-4 text-red-600 ${isExpanded ? 'rotate-90' : ''} transition-transform`}>
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                      </span>
                                                      <span className="text-sm text-red-900">
                                                        {formatOrenAsCurrency(post.amount)} till {getAccountNameByIdHelper(post.accountId)}
                                                        {post.description && (
                                                          <span className="ml-2 text-xs text-red-600">
                                                            - {post.description}
                                                          </span>
                                                        )}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-medium text-sm text-red-600">
                                                        - {formatOrenAsCurrency(post.amount)}
                                                      </span>
                                                      {editMode && (
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                                                          onClick={() => handleDeletePlannedTransfer(post.id)}
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                      )}
                                                      {isDaily && (
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                                                          onClick={() => toggleKontoDailyTransfer(post.id)}
                                                        >
                                                          {isExpanded ? 
                                                            <ChevronUp className="h-4 w-4" /> : 
                                                            <ChevronDown className="h-4 w-4" />
                                                          }
                                                        </Button>
                                                      )}
                                                    </div>
                                                  </div>
                                                  {/* Expandable daily transfer details for outgoing */}
                                                  {isExpanded && (
                                                    <div className="mt-2 ml-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                                      <div className="text-xs text-red-700 space-y-1">
                                                        <div className="flex justify-between">
                                                          <span className="text-muted-foreground">Huvudkategori:</span>
                                                          <span>{getCategoryName(post.huvudkategoriId)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                          <span className="text-muted-foreground">Underkategori:</span>
                                                          <span>{getSubCategoryName(post.huvudkategoriId, post.underkategoriId)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                          <span className="text-muted-foreground">Överföringstyp:</span>
                                                          <span>{isDaily ? 'Daglig' : 'Månadsvis'}</span>
                                                        </div>
                                                        {isDaily && (
                                                          <>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Valda dagar:</span>
                                                              <span>{post.transferDays ? JSON.parse(post.transferDays).length : 0} dagar/vecka</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Period:</span>
                                                              <span>{(() => {
                                                                const payday = budgetState.settings?.payday || 25;
                                                                const { startDate, endDate } = getDateRangeForMonth(selectedMonth, payday);
                                                                return `${startDate} till ${endDate}`;
                                                              })()}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Antal överföringsdagar:</span>
                                                              <span>{(() => {
                                                                const payday = budgetState.settings?.payday || 25;
                                                                const selectedDays = post.transferDays ? JSON.parse(post.transferDays) : [];
                                                                return countWeekdaysInMonth(selectedMonth, selectedDays, payday);
                                                              })()} dagar</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Belopp per dag:</span>
                                                              <span>{new Intl.NumberFormat('sv-SE', {
                                                                style: 'currency',
                                                                currency: 'SEK',
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                              }).format((post.dailyAmount || 0) / 100)}</span>
                                                            </div>
                                                            <div className="flex justify-between font-medium">
                                                              <span className="text-muted-foreground">Total månadsbelopp:</span>
                                                              <span>{new Intl.NumberFormat('sv-SE', {
                                                                style: 'currency',
                                                                currency: 'SEK',
                                                                minimumFractionDigits: 0,
                                                                maximumFractionDigits: 0
                                                              }).format(post.amount / 100)}</span>
                                                            </div>
                                                          </>
                                                        )}
                                                        {!isDaily && (
                                                          <>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Från Konto:</span>
                                                              <span>{getAccountNameByIdHelper(post.accountIdFrom)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Till Konto:</span>
                                                              <span>{getAccountNameByIdHelper(post.accountId)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                              <span className="text-muted-foreground">Belopp:</span>
                                                              <span>{formatOrenAsCurrency(post.amount)}</span>
                                                            </div>
                                                          </>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}

                            {/* Faktiska överföringar sektion */}
                            {accountInternalTransfers && (accountInternalTransfers.incomingTransfers.length > 0 || accountInternalTransfers.outgoingTransfers.length > 0) && (
                              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                <div 
                                  className="flex items-center gap-2 mb-3 cursor-pointer hover:bg-green-100/50 rounded p-2 -m-2 transition-colors"
                                  onClick={() => toggleKontoSection('actualTransfers')}
                                >
                                  <h4 className="font-semibold text-sm text-green-800 uppercase tracking-wide">
                                    Faktiska Överföringar ({accountInternalTransfers.incomingTransfers.length + accountInternalTransfers.outgoingTransfers.length})
                                  </h4>
                                  <ChevronDown className={`h-4 w-4 text-green-600 transition-transform ml-auto ${expandedKontoSections.has('actualTransfers') ? 'rotate-180' : ''}`} />
                                  {accountInternalTransfers.totalIn > 0 && (
                                    <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                                      In: {formatOrenAsCurrency(accountInternalTransfers.totalIn)}
                                    </Badge>
                                  )}
                                  {accountInternalTransfers.totalOut > 0 && (
                                    <Badge variant="destructive">
                                      Ut: {formatOrenAsCurrency(accountInternalTransfers.totalOut)}
                                    </Badge>
                                  )}
                                </div>
                                
                                {expandedKontoSections.has('actualTransfers') && (
                                  <>
                                    {accountInternalTransfers.incomingTransfers.length > 0 && (
                                      <div className="mb-3">
                                        <h5 className="text-xs font-medium text-green-700 mb-2">Inkommande:</h5>
                                        <div className="space-y-1">
                                          {accountInternalTransfers.incomingTransfers.map((t, index) => (
                                            <div key={index} className="flex justify-between items-center py-2 px-3 rounded bg-white border border-green-100">
                                               <span className="text-sm text-green-900">
                                                 {formatOrenAsCurrency(t.amount)} från {t.fromAccountName}
                                                 {t.linked ? (
                                                   <span className="ml-2 text-xs text-green-600 font-medium">
                                                     ({t.fromAccountName}, {t.transaction.date}) - {t.transaction.description || 'Överföring'}, {t.transaction.date}
                                                   </span>
                                                 ) : (
                                                   <Badge 
                                                     variant="outline" 
                                                     className="ml-2 text-xs text-orange-600 border-orange-200 cursor-pointer hover:bg-orange-50"
                                                     onClick={(e) => {
                                                       e.stopPropagation();
                                                       handleMatchTransfer(t.transaction);
                                                     }}
                                                   >
                                                     Ej matchad
                                                   </Badge>
                                                 )}
                                               </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {accountInternalTransfers.outgoingTransfers.length > 0 && (
                                      <div>
                                        <h5 className="text-xs font-medium text-green-700 mb-2">Utgående:</h5>
                                        <div className="space-y-1">
                                          {accountInternalTransfers.outgoingTransfers.map((t, index) => (
                                            <div key={index} className="flex justify-between items-center py-2 px-3 rounded bg-white border border-green-100">
                                               <span className="text-sm text-green-900">
                                                 {formatOrenAsCurrency(t.amount)} till {t.toAccountName}
                                                 {t.linked ? (
                                                   <span className="ml-2 text-xs text-green-600 font-medium">
                                                     ({t.toAccountName}, {t.transaction.date}) - {t.transaction.description || 'Överföring'}, {t.transaction.date}
                                                   </span>
                                                 ) : (
                                                   <Badge 
                                                     variant="outline" 
                                                     className="ml-2 text-xs text-orange-600 border-orange-200 cursor-pointer hover:bg-orange-50"
                                                     onClick={(e) => {
                                                       e.stopPropagation();
                                                       handleMatchTransfer(t.transaction);
                                                     }}
                                                   >
                                                     Ej matchad
                                                   </Badge>
                                                 )}
                                               </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    
    {/* Transfer Match Dialog */}
    <SimpleTransferMatchDialog
      isOpen={transferMatchDialog.isOpen}
      onClose={() => setTransferMatchDialog({ isOpen: false })}
      transaction={transferMatchDialog.transaction}
      suggestions={transferMatchDialog.suggestions || []}
    />
    
    {/* New Transfer Form Modal */}
    {showNewTransferForm && (
      <NewTransferForm
        preselectedFromAccountId={selectedFromAccountId}
        preselectedFromAccountName={selectedFromAccountId ? 
          accountsFromAPI.find(acc => acc.id === selectedFromAccountId)?.name || 'Välj konto' : 
          'Välj konto'
        }
        availableAccounts={accountsFromAPI}
        selectedMonth={selectedMonth}
        budgetState={budgetState}
        onSubmit={handleCreateTransfer}
        onCancel={() => {
          setShowNewTransferForm(false);
          setSelectedFromAccountId('');
        }}
      />
    )}
    </div>
  );
};