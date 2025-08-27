import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  Link2, 
  Sparkles,
  Receipt,
  Shield,
  Banknote,
  Calendar,
  Building2,
  Edit3,
  Plus,
  ArrowUpDown,
  AlertCircle,
  CheckCircle2,
  PiggyBank,
  Trash2,
  Zap,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  Users,
  Target,
  Star
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useBudget } from '@/hooks/useBudget';
import { useTransactions, useUpdateTransaction, useHistoricalCategoryMatches } from '@/hooks/useTransactions';
import { useHuvudkategorier, useUnderkategorier, useCategoryNames } from '@/hooks/useCategories';
import { useAccounts } from '@/hooks/useAccounts';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useBudgetPosts } from '@/hooks/useBudgetPosts';
import { useCategoryRules } from '@/hooks/useCategoryRules';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { applyRulesToTransactionsBatch } from '@/orchestrator/batchRuleApplication';
import { getDateRangeForMonth } from '@/services/calculationService';
import { TransactionTypeSelector } from '@/components/TransactionTypeSelector';
import { CreateRuleDialog } from '@/components/CreateRuleDialog';
import { ExpenseLinkDialog } from '@/components/ExpenseLinkDialog';
import { CostCoverageDialog } from '@/components/CostCoverageDialog';
import { SavingsGoalLinkDialog } from '@/components/SavingsGoalLinkDialog';
import { SimpleTransferMatchDialog } from '@/components/SimpleTransferMatchDialog';
import { UtbetalningLinkDialog } from '@/components/UtbetalningLinkDialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { setSelectedBudgetMonth } from '@/orchestrator/budgetOrchestrator';
// Removed deprecated orchestrator imports - using React Query hooks directly

export function TransactionReviewPage() {
  const { toast } = useToast();
  const { budgetState } = useBudget();
  const { data: transactions = [], refetch: refetchTransactions } = useTransactions();
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: underkategorier = [] } = useUnderkategorier();
  const { getHuvudkategoriName, getUnderkategoriName } = useCategoryNames();
  const { data: accounts = [] } = useAccounts();
  const { data: budgetPosts = [] } = useBudgetPosts();
  const { data: categoryRules = [] } = useCategoryRules();
  const { data: familyMembers = [] } = useFamilyMembers();
  const updateTransactionMutation = useUpdateTransaction();
  const queryClient = useQueryClient();
  
  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(`/api/category-rules/${ruleId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Failed to delete rule');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Regel borttagen',
        description: 'Regeln har tagits bort framgångsrikt.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/category-rules'] });
      setShowRuleDetailsDialog(false);
    },
    onError: (error) => {
      toast({
        title: 'Fel',
        description: 'Kunde inte ta bort regeln. Försök igen.',
        variant: 'destructive',
      });
      console.error('Error deleting rule:', error);
    }
  });
  
  const handleDeleteRule = (ruleId: string, ruleName: string) => {
    if (window.confirm(`Är du säker på att du vill ta bort regeln "${ruleName}"? Detta kan inte ångras.`)) {
      deleteRuleMutation.mutate(ruleId);
    }
  };

  // Calculate available months from transaction data AND budget posts - ALL months from first to last
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    
    // Add months from transactions
    transactions.forEach(tx => {
      if (tx.date) {
        const monthKey = tx.date.substring(0, 7); // YYYY-MM format
        months.add(monthKey);
      }
    });
    
    // Add months from budget posts
    budgetPosts.forEach(post => {
      if (post.monthKey) {
        months.add(post.monthKey);
      }
    });
    
    const sortedMonths = Array.from(months).sort();
    if (sortedMonths.length === 0) return [];
    
    // Generate all months from first to last (inclusive)
    const firstMonth = sortedMonths[0];
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    
    const allMonths: string[] = [];
    const [firstYear, firstMonthNum] = firstMonth.split('-').map(Number);
    const [lastYear, lastMonthNum] = lastMonth.split('-').map(Number);
    
    let currentYear = firstYear;
    let currentMonth = firstMonthNum;
    
    while (currentYear < lastYear || (currentYear === lastYear && currentMonth <= lastMonthNum)) {
      const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      allMonths.push(monthKey);
      
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }
    
    return allMonths;
  }, [transactions, budgetPosts]);

  // Ensure the selected month exists in transaction data, fallback to latest month
  const effectiveSelectedMonth = useMemo(() => {
    const selected = budgetState?.selectedMonthKey;
    // If "all" is selected, return "all"
    if (selected === 'all') {
      return 'all';
    }
    if (selected && availableMonths.includes(selected)) {
      return selected;
    }
    // Fallback to the latest month if current selection is not in transaction data
    return availableMonths.length > 0 ? availableMonths[availableMonths.length - 1] : selected;
  }, [budgetState?.selectedMonthKey, availableMonths]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showCostCoverageDialog, setShowCostCoverageDialog] = useState(false);
  const [showSavingsDialog, setShowSavingsDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showUtbetalningDialog, setShowUtbetalningDialog] = useState(false);
  const [editMode, setEditMode] = useState<'note' | 'amount' | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [tempAmount, setTempAmount] = useState('');
  const [showLinkedTransactionDialog, setShowLinkedTransactionDialog] = useState(false);
  const [linkedTransactionToShow, setLinkedTransactionToShow] = useState<any>(null);
  const [showApplyRulesResults, setShowApplyRulesResults] = useState(false);
  const [applyRulesResults, setApplyRulesResults] = useState<any>(null);
  const [showRuleDetailsDialog, setShowRuleDetailsDialog] = useState(false);
  const [applicableRulesForDialog, setApplicableRulesForDialog] = useState<any[]>([]);
  const [isApplyingRules, setIsApplyingRules] = useState(false);
  
  // Filter state
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState('red-yellow'); // Default to red+yellow
  const [accountFilter, setAccountFilter] = useState('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [transactionFilter, setTransactionFilter] = useState('all'); // Positive/Negative/All
  const [monthFilter, setMonthFilter] = useState('current'); // Will use current month by default
  const [appHuvudkategoriFilter, setAppHuvudkategoriFilter] = useState('all');
  const [appUnderkategoriFilter, setAppUnderkategoriFilter] = useState('all');
  const [bankCategoryFilter, setBankCategoryFilter] = useState('all');
  const [bankSubCategoryFilter, setBankSubCategoryFilter] = useState('all');
  const [descriptionFilter, setDescriptionFilter] = useState('');
  
  
  // Removed complex local state - using React Query optimistic updates instead

  // Get all unique values for filter dropdowns
  const uniqueTransactionTypes = useMemo(() => 
    [...new Set(transactions.map(tx => tx.type).filter(Boolean))].sort(),
    [transactions]
  );
  
  const uniqueBankCategories = useMemo(() => 
    [...new Set(transactions.map(tx => tx.bankCategory).filter(Boolean))].sort(),
    [transactions]
  );
  
  const uniqueBankSubCategories = useMemo(() => 
    [...new Set(transactions.map(tx => tx.bankSubCategory).filter(Boolean))].sort(),
    [transactions]
  );

  // Get date range for the selected month using payday logic (matches Sammanställning)
  const { startDate, endDate } = useMemo(() => {
    const currentMonth = monthFilter === 'current' 
      ? effectiveSelectedMonth 
      : monthFilter;
      
    if (monthFilter === 'all' || currentMonth === 'all') {
      // For "all months", don't restrict date range
      return { startDate: null, endDate: null };
    }
    
    const payday = budgetState.settings?.payday || 25;
    return getDateRangeForMonth(currentMonth, payday);
  }, [monthFilter, effectiveSelectedMonth, budgetState.settings?.payday]);

  // Get transactions with all filters applied
  const monthTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Month filter using payday-based date ranges (matches Sammanställning logic)
      if (startDate && endDate) {
        const transactionDate = new Date(tx.date);
        if (transactionDate < new Date(startDate) || transactionDate > new Date(endDate)) return false;
      }
      
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'red' && tx.status !== 'red') return false;
        if (statusFilter === 'yellow' && tx.status !== 'yellow') return false;
        if (statusFilter === 'green' && tx.status !== 'green') return false;
        if (statusFilter === 'red-yellow' && tx.status !== 'red' && tx.status !== 'yellow') return false;
      }
      
      // Account filter
      if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;
      
      // Transaction type filter
      if (transactionTypeFilter !== 'all' && tx.type !== transactionTypeFilter) return false;
      
      // Transaction direction filter (Positive/Negative)
      if (transactionFilter === 'positive' && tx.amount <= 0) return false;
      if (transactionFilter === 'negative' && tx.amount >= 0) return false;
      
      // App huvudkategori filter
      if (appHuvudkategoriFilter !== 'all') {
        if (appHuvudkategoriFilter === 'uncategorized') {
          // Show transactions missing EITHER huvudkategori OR underkategori (matches Sammanställning logic)
          if (tx.appCategoryId && tx.appSubCategoryId) return false;
        } else {
          if (tx.appCategoryId !== appHuvudkategoriFilter) return false;
        }
      }
      
      // App underkategori filter
      if (appUnderkategoriFilter !== 'all') {
        if (appUnderkategoriFilter === 'uncategorized') {
          // Show transactions missing EITHER huvudkategori OR underkategori (matches Sammanställning logic)
          if (tx.appCategoryId && tx.appSubCategoryId) return false;
        } else {
          if (tx.appSubCategoryId !== appUnderkategoriFilter) return false;
        }
      }
      
      // Bank category filter
      if (bankCategoryFilter !== 'all' && tx.bankCategory !== bankCategoryFilter) return false;
      
      // Bank subcategory filter
      if (bankSubCategoryFilter !== 'all' && tx.bankSubCategory !== bankSubCategoryFilter) return false;
      
      // Description filter (search in description, userDescription, or ID)
      if (descriptionFilter) {
        const searchTerm = descriptionFilter.toLowerCase();
        const description = (tx.description || '').toLowerCase();
        const userDescription = (tx.userDescription || '').toLowerCase();
        const id = (tx.id || '').toLowerCase();
        if (!description.includes(searchTerm) && !userDescription.includes(searchTerm) && !id.includes(searchTerm)) return false;
      }
      
      return tx.amount !== 0;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    transactions, 
    startDate,
    endDate,
    statusFilter,
    accountFilter,
    transactionTypeFilter,
    transactionFilter,
    appHuvudkategoriFilter,
    appUnderkategoriFilter,
    bankCategoryFilter,
    bankSubCategoryFilter,
    descriptionFilter
  ]);

  // Filter for uncategorized for count purposes, but use all for navigation
  const uncategorizedTransactions = useMemo(() => {
    const filtered = monthTransactions.filter(tx => 
      tx.status === 'red' || tx.status === 'yellow'
    );
    console.log(`📊 [TRANSACTION COUNT] ${filtered.length} uncategorized transactions for ${effectiveSelectedMonth || 'current month'} (red/yellow status)`);
    return filtered;
  }, [monthTransactions]);

  // Get current transaction - use all filtered transactions when searching, uncategorized when not
  const transactionsForNavigation = descriptionFilter ? monthTransactions : uncategorizedTransactions;
  const baseTransaction = transactionsForNavigation[currentIndex];
  
  // Current transaction (React Query handles optimistic updates automatically)
  const currentTransaction = baseTransaction;

  // Get historical category matches for the current transaction
  const { data: historicalMatches = [] } = useHistoricalCategoryMatches(
    currentTransaction?.id
  );

  // Transform budget posts into savings goals for the dialog, filtered by current transaction's account
  const savingsGoals = useMemo(() => {
    const currentTransactionAccountId = currentTransaction?.accountId;
    if (!currentTransactionAccountId) return [];
    
    return budgetPosts
      .filter(post => 
        (post.type === 'sparmål' || post.type === 'savings') && 
        post.accountId === currentTransactionAccountId
      )
      .map(post => ({
        id: post.id,
        name: post.name || post.description || 'Unnamed Goal',
        targetAmount: post.amount ? post.amount / 100 : undefined, // Convert from öre to SEK
        currentAmount: 0, // Would need to be calculated from linked transactions
        mainCategoryId: post.huvudkategoriId,
        subCategoryId: post.underkategoriId
      }));
  }, [budgetPosts, currentTransaction?.accountId]);
  
  // Reset index when filters change to prevent out-of-bounds
  useEffect(() => {
    setCurrentIndex(0);
  }, [
    statusFilter,
    accountFilter,
    transactionTypeFilter,
    transactionFilter,
    monthFilter,
    appHuvudkategoriFilter,
    appUnderkategoriFilter,
    bankCategoryFilter,
    bankSubCategoryFilter,
    descriptionFilter
  ]);

  // Reset app underkategori filter when huvudkategori filter changes
  useEffect(() => {
    if (appHuvudkategoriFilter !== 'all' && appHuvudkategoriFilter !== 'uncategorized') {
      const validSubCategories = underkategorier.filter(sub => sub.huvudkategoriId === appHuvudkategoriFilter);
      if (appUnderkategoriFilter !== 'all' && appUnderkategoriFilter !== 'uncategorized') {
        const isCurrentSubCategoryValid = validSubCategories.some(sub => sub.id === appUnderkategoriFilter);
        if (!isCurrentSubCategoryValid) {
          setAppUnderkategoriFilter('all');
        }
      }
    }
  }, [appHuvudkategoriFilter, appUnderkategoriFilter, underkategorier]);

  // Handle swipe/navigation
  const handleNext = useCallback(() => {
    if (currentIndex < transactionsForNavigation.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
      setEditMode(null);
    }
  }, [currentIndex, transactionsForNavigation.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
      setEditMode(null);
    }
  }, [currentIndex]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 100;
    if (info.offset.x > swipeThreshold) {
      handlePrevious();
    } else if (info.offset.x < -swipeThreshold) {
      handleNext();
    }
  };

  // Handle category updates - SIMPLIFIED VERSION
  const handleCategoryUpdate = async (huvudkategoriId: string, underkategoriId?: string) => {
    if (!currentTransaction) return;

    const huvudkat = huvudkategorier.find(h => h.id === huvudkategoriId);
    const underkat = underkategoriId ? underkategorier.find(u => u.id === underkategoriId) : null;

    // When changing huvudkategori, clear underkategori if it doesn't belong to the new category
    let actualUnderkategoriId = underkategoriId;
    if (underkategoriId) {
      const underkatCheck = underkategorier.find(u => u.id === underkategoriId);
      if (underkatCheck && underkatCheck.huvudkategoriId !== huvudkategoriId) {
        actualUnderkategoriId = undefined;
      }
    }

    // Determine new status: Yellow only if BOTH categories, otherwise red
    const hasMainCategory = !!huvudkategoriId;
    const hasSubCategory = !!actualUnderkategoriId;
    const newStatus: 'green' | 'yellow' | 'red' = (hasMainCategory && hasSubCategory) ? 'yellow' : 'red';

    // React Query handles optimistic updates automatically

    console.log(`🎯 [TRANSACTION PAGE] Updating category: ${huvudkat?.name}${actualUnderkategoriId && underkat ? ` - ${underkat.name}` : ''}`);
    console.log(`🎯 [TRANSACTION PAGE] Transaction ID: ${currentTransaction.id}`);
    console.log(`🎯 [TRANSACTION PAGE] Category IDs:`, {
      huvudkategoriId,
      actualUnderkategoriId,
      hovedkategoriName: huvudkat?.name,
      underkategoriName: underkat?.name
    });
    console.log(`🎯 [TRANSACTION PAGE] About to call updateTransactionMutation.mutate`);
    console.log(`🎯 [TRANSACTION PAGE] Mutation state:`, {
      isLoading: updateTransactionMutation.isLoading,
      isError: updateTransactionMutation.isError,
      error: updateTransactionMutation.error
    });

    // Add mobile debug logging
    const { addMobileDebugLog } = await import('../utils/mobileDebugLogger');
    addMobileDebugLog(`🎯 [TRANSACTION PAGE] Updating category: ${huvudkat?.name}${actualUnderkategoriId && underkat ? ` - ${underkat.name}` : ''}`);
    addMobileDebugLog(`🎯 [TRANSACTION PAGE] Transaction ID: ${currentTransaction.id}`);
    addMobileDebugLog(`🔍 [TRANSACTION PAGE] Transaction details: ${currentTransaction.description} - ${currentTransaction.date} - ${currentTransaction.amount}`);
    addMobileDebugLog(`🔍 [TRANSACTION PAGE] Current transaction userId: ${currentTransaction.userId}`);
    addMobileDebugLog(`🔍 [TRANSACTION PAGE] Total transactions loaded: ${transactions.length}`);
    
    // Check if this transaction exists in our loaded data
    const foundInList = transactions.find(tx => tx.id === currentTransaction.id);
    if (foundInList) {
      addMobileDebugLog(`✅ [TRANSACTION PAGE] Transaction found in loaded list: ${foundInList.id}`);
    } else {
      addMobileDebugLog(`❌ [TRANSACTION PAGE] Transaction NOT found in loaded list! This is the problem.`);
    }
    
    addMobileDebugLog(`🎯 [TRANSACTION PAGE] About to call updateTransactionMutation.mutate`);

    // SIMPLE APPROACH: Just update SQL and let React Query refetch
    updateTransactionMutation.mutate({
      id: currentTransaction.id,
      data: {
        appCategoryId: huvudkategoriId,
        appSubCategoryId: actualUnderkategoriId || null,
        status: newStatus, // Server gets the correct status
        isManuallyChanged: 'true',
        wasHistoricallyAssigned: 'false' // Remove star when manually changed
      }
    }, {
      onSuccess: () => {
        // Clear local updates since server confirmed the change
        // Local updates removed - React Query handles this
        
        toast({
          title: "Kategori uppdaterad!",
          description: `Ändrad till ${huvudkat?.name}${actualUnderkategoriId && underkat ? ` - ${underkat.name}` : ''}`,
        });
        
        // Never auto-advance - user must manually navigate
        // This allows full control over the review process
      },
      onError: (error) => {
        // Rollback local updates on error
        // Local updates removed - React Query handles this
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast({
          title: "API Error",
          description: errorMessage,
          variant: "destructive",
        });
        console.error("Failed to update category:", error);
        console.error("Error details:", errorMessage);
      }
    });

    // Show immediate feedback
    toast({
      title: "Sparar...",
      description: `Uppdaterar till ${huvudkat?.name}${actualUnderkategoriId && underkat ? ` - ${underkat.name}` : ''}`,
    });
  };

  // Handle transaction type update (callback from TransactionTypeSelector)
  const handleTypeUpdate = (type: string) => {
    // The TransactionTypeSelector handles the mutation internally
    // We just show a toast for user feedback
    toast({
      title: "Transaktionstyp uppdaterad",
      description: `Ändrad till ${type}`,
    });
  };

  // Handle approve (make green)
  const handleApprove = async () => {
    if (!currentTransaction) return;

    updateTransactionMutation.mutate({
      id: currentTransaction.id,
      data: {
        status: 'green',
        isManuallyChanged: 'true'
      }
    });
    
    toast({
      title: "Transaktion godkänd",
      className: "bg-green-50 border-green-200",
    });

    // No auto-advance - user controls navigation manually
  };

  // Handle note update
  const handleNoteUpdate = async () => {
    if (!currentTransaction) return;
    
    updateTransactionMutation.mutate({
      id: currentTransaction.id,
      data: {
        userDescription: tempNote,
        isManuallyChanged: 'true'
      }
    });
    setEditMode(null);
    
    toast({
      title: "Anteckning sparad",
    });
  };

  // Handle linked transaction view
  const handleLinkedTransactionClick = (linkedTransactionId: string) => {
    const linkedTransaction = transactions.find(tx => tx.id === linkedTransactionId);
    if (linkedTransaction) {
      setLinkedTransactionToShow(linkedTransaction);
      setShowLinkedTransactionDialog(true);
    } else {
      toast({
        title: "Länkad transaktion hittades inte",
        description: "Transaktionen kanske har tagits bort.",
        variant: "destructive",
      });
    }
  };

  // Handle unlinking internal transfer
  const handleUnlinkInternalTransfer = async () => {
    if (!currentTransaction?.linkedTransactionId) return;

    const linkedTransactionId = currentTransaction.linkedTransactionId;
    
    try {
      // Update both transactions to remove the link
      await Promise.all([
        updateTransactionMutation.mutateAsync({
          id: currentTransaction.id,
          data: {
            type: 'Transaction',
            linkedTransactionId: null,
            userDescription: '',
            isManuallyChanged: 'true'
          }
        }),
        updateTransactionMutation.mutateAsync({
          id: linkedTransactionId,
          data: {
            type: 'Transaction',
            linkedTransactionId: null,
            userDescription: '',
            isManuallyChanged: 'true'
          }
        })
      ]);

      toast({
        title: "Länkning borttagen",
        description: "Intern överföring har kopplats ur.",
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort länkningen.",
        variant: "destructive",
      });
    }
  };

  // Handle unlinking expense/cost
  const handleUnlinkExpenseCost = async () => {
    if (!currentTransaction?.linkedCostId) return;

    const linkedCostId = currentTransaction.linkedCostId;
    
    try {
      // Update both transactions to remove the link and corrected amount
      await Promise.all([
        updateTransactionMutation.mutateAsync({
          id: currentTransaction.id,
          data: {
            type: 'Transaction',
            linkedCostId: null,
            correctedAmount: null,
            userDescription: '',
            isManuallyChanged: 'true'
          }
        }),
        updateTransactionMutation.mutateAsync({
          id: linkedCostId,
          data: {
            type: 'Transaction',
            linkedCostId: null,
            correctedAmount: null,
            userDescription: '',
            isManuallyChanged: 'true'
          }
        })
      ]);

      toast({
        title: "Länkning borttagen",
        description: "Utlägg/kostnad har kopplats ur och korrigerat belopp återställt.",
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort länkningen.",
        variant: "destructive",
      });
    }
  };

  // Handle unlinking savings
  const handleUnlinkSavings = async () => {
    if (!currentTransaction?.savingsTargetId) return;
    
    try {
      await updateTransactionMutation.mutateAsync({
        id: currentTransaction.id,
        data: {
          type: 'Transaction',
          savingsTargetId: null,
          appCategoryId: null,
          appSubCategoryId: null,
          isManuallyChanged: 'true'
        }
      });

      toast({
        title: "Länkning borttagen",
        description: "Sparande har kopplats ur.",
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort länkningen.",
        variant: "destructive",
      });
    }
  };

  // Handle unlinking income
  const handleUnlinkIncome = async () => {
    if (!currentTransaction?.incomeTargetId) return;
    
    try {
      await updateTransactionMutation.mutateAsync({
        id: currentTransaction.id,
        data: {
          type: 'Transaction',
          incomeTargetId: null,
          isManuallyChanged: 'true'
        }
      });

      toast({
        title: "Länkning borttagen",
        description: "Inkomst har kopplats ur.",
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort länkningen.",
        variant: "destructive",
      });
    }
  };

  // Helper function to check if there are applicable rules for a transaction
  const hasApplicableRules = useMemo(() => {
    if (!currentTransaction || categoryRules.length === 0) return false;
    
    return categoryRules.some(rule => {
      // Skip inactive rules - handle both string and boolean types
      const isActive = rule.isActive === 'true' || rule.isActive === true;
      if (!isActive) {
        return false;
      }
      
      // Check account restrictions
      if (rule.applicableAccountIds && rule.applicableAccountIds !== '[]') {
        try {
          const accountIds = JSON.parse(rule.applicableAccountIds);
          if (accountIds.length > 0 && !accountIds.includes(currentTransaction.accountId)) {
            return false;
          }
        } catch (e) {
          // If parsing fails, assume no restrictions
        }
      }
      
      // Check transaction direction
      if (rule.transactionDirection === 'positive' && currentTransaction.amount < 0) {
        return false;
      }
      if (rule.transactionDirection === 'negative' && currentTransaction.amount >= 0) {
        return false;
      }
      
      // Check rule type and matching logic
      const ruleType = rule.ruleType || 'textContains';
      const transactionText = currentTransaction.description?.toLowerCase() || '';
      const ruleText = rule.transactionName?.toLowerCase() || '';
      
      // Handle wildcard (*) - matches all transactions
      if (ruleText === '*') {
        return true;
      }
      
      // Bank category matching
      if (ruleType === 'categoryMatch') {
        if (rule.bankhuvudkategori && rule.bankunderkategori) {
          return currentTransaction.bankCategory === rule.bankhuvudkategori && 
                 currentTransaction.bankSubCategory === rule.bankunderkategori;
        } else if (rule.bankhuvudkategori) {
          return currentTransaction.bankCategory === rule.bankhuvudkategori;
        }
        return false;
      }
      
      // Text-based matching
      switch (ruleType) {
        case 'exactText':
          return transactionText === ruleText;
        case 'textStartsWith':
          return transactionText.startsWith(ruleText);
        case 'textContains':
        default:
          return transactionText.includes(ruleText);
      }
    });
  }, [currentTransaction, categoryRules]);

  // Function to get applicable rules for current transaction (detailed version)
  const getApplicableRulesForTransaction = useCallback((transaction: any) => {
    if (!transaction || categoryRules.length === 0) return [];
    
    return categoryRules.filter(rule => {
      // Skip inactive rules - handle both string and boolean types
      const isActive = rule.isActive === 'true' || rule.isActive === true;
      if (!isActive) {
        return false;
      }
      
      // Check account restrictions
      if (rule.applicableAccountIds && rule.applicableAccountIds !== '[]') {
        try {
          const accountIds = JSON.parse(rule.applicableAccountIds);
          if (accountIds.length > 0 && !accountIds.includes(transaction.accountId)) {
            return false;
          }
        } catch (e) {
          // If parsing fails, assume no restrictions
        }
      }
      
      // Check transaction direction
      if (rule.transactionDirection === 'positive' && transaction.amount < 0) {
        return false;
      }
      if (rule.transactionDirection === 'negative' && transaction.amount >= 0) {
        return false;
      }
      
      // Check rule type and matching logic
      const ruleType = rule.ruleType || 'textContains';
      const transactionText = transaction.description?.toLowerCase() || '';
      const ruleText = rule.transactionName?.toLowerCase() || '';
      
      // Handle wildcard (*) - matches all transactions
      if (ruleText === '*') {
        return true;
      }
      
      // Bank category matching
      if (ruleType === 'categoryMatch') {
        if (rule.bankhuvudkategori && rule.bankunderkategori) {
          return transaction.bankCategory === rule.bankhuvudkategori && 
                 transaction.bankSubCategory === rule.bankunderkategori;
        } else if (rule.bankhuvudkategori) {
          return transaction.bankCategory === rule.bankhuvudkategori;
        }
        return false;
      }
      
      // Text-based matching
      switch (ruleType) {
        case 'exactText':
          return transactionText === ruleText;
        case 'textStartsWith':
          return transactionText.startsWith(ruleText);
        case 'textContains':
        default:
          return transactionText.includes(ruleText);
      }
    });
  }, [categoryRules]);

  // Function to show rule details dialog
  const handleShowRuleDetails = () => {
    if (currentTransaction) {
      const applicableRules = getApplicableRulesForTransaction(currentTransaction);
      setApplicableRulesForDialog(applicableRules);
      setShowRuleDetailsDialog(true);
    }
  };

  // Apply historical category matches to transactions
  const applyHistoricalMatches = async (transactionsToProcess: any[]) => {
    console.log(`🌟 [HISTORICAL] Starting historical matching for ${transactionsToProcess.length} transactions`);
    
    // Limit to first 50 transactions for performance during testing
    const limitedTransactions = transactionsToProcess.slice(0, 50);
    if (limitedTransactions.length < transactionsToProcess.length) {
      console.log(`⚠️ [HISTORICAL] Processing only first ${limitedTransactions.length} transactions for performance`);
    }
    
    const historicallyUpdated = new Set<string>();
    const updates = [];
    
    for (const transaction of limitedTransactions) {
      // Debug: Log transaction being processed
      console.log(`🔍 [HISTORICAL] Processing transaction ${transaction.id} (${transaction.description})`);
      
      // Only process transactions without categories (both must be missing)
      if (!transaction.appCategoryId && !transaction.appSubCategoryId) {
        console.log(`✅ [HISTORICAL] Transaction ${transaction.id} has no categories, checking for matches`);
        try {
          // Find historical matches
          const matches = await fetch(`/api/transactions/${transaction.id}/historical-matches`)
            .then(res => res.ok ? res.json() : [])
            .catch(() => []);
          
          if (matches.length > 0) {
            const bestMatch = matches[0];
            if (bestMatch.appCategoryId && bestMatch.appSubCategoryId) {
              console.log(`🌟 [HISTORICAL] Found match for ${transaction.description} -> ${bestMatch.appCategoryId}`);
              
              updates.push({
                id: transaction.id,
                data: {
                  appCategoryId: bestMatch.appCategoryId,
                  appSubCategoryId: bestMatch.appSubCategoryId,
                  type: bestMatch.type, // Copy the transaction type as well
                  wasHistoricallyAssigned: 'true' // Mark as historically assigned for star display
                }
              });
              
              historicallyUpdated.add(transaction.id);
            }
          }
        } catch (error) {
          console.warn(`Failed to get historical matches for ${transaction.id}:`, error);
        }
      }
    }
    
    // Apply updates in batch if any
    if (updates.length > 0) {
      try {
        // Use individual updates to avoid overwhelming the server
        console.log(`🌟 [HISTORICAL] Applying ${updates.length} historical matches...`);
        
        for (const update of updates) {
          try {
            await updateTransactionMutation.mutateAsync(update);
            console.log(`✅ [HISTORICAL] Updated transaction ${update.id}`);
          } catch (error) {
            console.error(`❌ [HISTORICAL] Failed to update transaction ${update.id}:`, error);
          }
        }
        
        // Star display is now handled via database field wasHistoricallyAssigned
        
        console.log(`🌟 [HISTORICAL] Applied historical matches to ${updates.length} transactions`);
        console.log(`⭐ [MOBILE DEBUG] Total transactions with stars: ${historicallyUpdated.size}`);
      } catch (error) {
        console.error('Failed to apply historical matches:', error);
      }
    }
    
    return { updatedCount: updates.length, updatedTransactionIds: historicallyUpdated };
  };

  // Apply rules to all filtered transactions
  const handleApplyRulesToFiltered = async () => {
    console.log(`🟡 [BUTTON CLICKED] Apply rules button was clicked!`);
    console.log(`🟡 [DATA CHECK] Month: ${effectiveSelectedMonth}, Uncategorized: ${uncategorizedTransactions.length}, Rules: ${categoryRules.length}`);
    setIsApplyingRules(true);
    
    try {
      console.log(`🚀 [APPLY RULES] Starting rule application to ${uncategorizedTransactions.length} filtered transactions (${transactions.length} total for linking)`);
      
      // STEP 1: Apply historical matches first
      console.log(`🌟 [STEP 1] Applying historical matches to uncategorized transactions`);
      const historicalResult = await applyHistoricalMatches(uncategorizedTransactions);
      
      // Refetch transactions after historical matches to get latest data
      await queryClient.refetchQueries({ queryKey: ['/api/transactions'] });
      
      // STEP 2: Apply category rules (which may override historical matches)
      console.log(`🔧 [STEP 2] Applying category rules`);
      // IMPORTANT: Pass ALL transactions for proper transfer matching, but only process rules on filtered ones
      // Transfer matching needs to find counterparts across all accounts, not just filtered ones
      const result = await applyRulesToTransactionsBatch(
        transactions, // ALL transactions for linking/matching
        categoryRules,
        huvudkategorier,
        underkategorier,
        uncategorizedTransactions // Only process rules on these filtered transactions
      );
      
      if (result.success) {
        // Mobile debug log for successful rule application
        console.log(`✅ [RULES APPLIED] Database updated successfully!`);
        console.log(`📊 [STATS] Month: ${effectiveSelectedMonth}, Updated: ${result.stats.updated}, Auto-approved: ${result.stats.autoApproved}`);
        
        // STEP 3: Remove stars from transactions that were actually overridden by rules
        // Only remove stars if rules actually CHANGED the categories from historical matches
        if (result.updatedTransactions && result.updatedTransactions.length > 0 && historicalResult.updatedTransactionIds.size > 0) {
          const actuallyOverridden = [];
          
          for (const updatedTx of result.updatedTransactions) {
            // Only check transactions that had historical matches applied
            if (historicalResult.updatedTransactionIds.has(updatedTx.id)) {
              // Get the original transaction data before any updates
              const originalTx = transactions.find(t => t.id === updatedTx.id);
              
              // Check if the rule actually changed categories from what historical matching set
              const categoriesChanged = 
                updatedTx.appCategoryId !== originalTx?.appCategoryId ||
                updatedTx.appSubCategoryId !== originalTx?.appSubCategoryId;
              
              if (categoriesChanged) {
                actuallyOverridden.push(updatedTx.id);
                console.log(`⭐ [RULE OVERRIDE] Transaction ${updatedTx.id} categories actually changed by rules`);
              } else {
                console.log(`✅ [RULE CONFIRM] Transaction ${updatedTx.id} categories confirmed by rules, keeping star`);
              }
            }
          }
          
          if (actuallyOverridden.length > 0) {
            console.log(`⭐ [STAR REMOVAL] Removing stars from ${actuallyOverridden.length} transactions actually overridden by rules`);
            // Update database to remove historical assignment flag for truly overridden transactions
            for (const txId of actuallyOverridden) {
              try {
                await updateTransactionMutation.mutateAsync({
                  id: txId,
                  data: { wasHistoricallyAssigned: 'false' }
                });
                console.log(`🚫 [MOBILE DEBUG] Transaction ${txId} STAR REMOVED (actually overridden by rules)`);
              } catch (error) {
                console.error(`Failed to remove star from transaction ${txId}:`, error);
              }
            }
          }
        }
        
        // Force refresh of all transaction data
        await queryClient.refetchQueries({ queryKey: ['/api/transactions'] });
        
        // Local state reset removed - React Query handles this
        
        // Show results dialog
        setApplyRulesResults(result);
        setShowApplyRulesResults(true);
        
        // Mobile debug log after refresh
        console.log(`🔄 [REFRESH] Transaction data refreshed from database`);
        console.log(`📉 [COUNT] Uncategorized before: ${uncategorizedTransactions.length}, Updates applied: ${result.stats.updated}`);
        console.log(`🔗 [AUTO-MATCH] Auto-matched: ${result.stats.autoMatched} internal transfers`);
        
        toast({
          title: "Regler applicerade!",
          description: `${result.stats.updated} transaktioner uppdaterade (${result.stats.rulesApplied} regelträffar, ${result.stats.autoMatched} auto-matchade, ${result.stats.autoApproved} auto-godkända)`,
        });
        
        console.log(`✅ [APPLY RULES] Successfully applied rules:`, result.stats);
      } else {
        throw new Error('Rule application failed');
      }
    } catch (error) {
      console.error('❌ [APPLY RULES] Error:', error);
      toast({
        title: "Fel vid regelapplicering",
        description: error instanceof Error ? error.message : "Kunde inte applicera regler",
        variant: "destructive",
      });
    } finally {
      setIsApplyingRules(false);
    }
  };


  // Progress based on how many transactions are categorized vs total month transactions
  const categorizedCount = monthTransactions.length - uncategorizedTransactions.length;
  const progress = monthTransactions.length > 0 ? (categorizedCount / monthTransactions.length) * 100 : 0;
  const huvudkategoriForTransaction = currentTransaction ? huvudkategorier.find(h => h.id === currentTransaction.appCategoryId) : null;
  const underkategorierForHuvud = currentTransaction?.appCategoryId 
    ? underkategorier.filter(u => u.huvudkategoriId === currentTransaction.appCategoryId)
    : [];

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20">
      {/* Header with progress - Always visible */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Granska transaktioner</h1>
          <Badge variant="outline" className="text-lg px-3 py-1">
            {currentIndex + 1} / {transactionsForNavigation.length}
          </Badge>
        </div>
        
        {/* Month selector and Filter button - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select
              value={effectiveSelectedMonth || ''}
              onValueChange={(value) => {
                console.log(`📅 [MONTH CHANGE] Switching to month: ${value}`);
                setSelectedBudgetMonth(value);
                setCurrentIndex(0); // Reset to first transaction when month changes
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Välj månad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla månader</SelectItem>
                {availableMonths.map((month) => (
                  <SelectItem key={month} value={month}>
                    {new Date(month + '-01').toLocaleDateString('sv-SE', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button
            variant="outline"
            size="default"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="w-full sm:w-auto justify-center"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {filtersExpanded ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground mb-3">
          {uncategorizedTransactions.length} transaktioner att granska
        </div>
        
        {/* Expandable filters */}
        <Collapsible open={filtersExpanded}>
          <CollapsibleContent>
            <Card className="mb-4">
              <CardContent className="space-y-4 p-4">
                {/* Mobile-first responsive layout - Stack on mobile, group on larger screens */}
                <div className="space-y-4">
                  {/* Row 1: Status Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Visa bara status:</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Röd + Gul" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla</SelectItem>
                        <SelectItem value="red">Röd</SelectItem>
                        <SelectItem value="yellow">Gul</SelectItem>
                        <SelectItem value="green">Grön</SelectItem>
                        <SelectItem value="red-yellow">Röd + Gul</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Row 2: Account and Transaction Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Konto:</Label>
                      <Select value={accountFilter} onValueChange={setAccountFilter}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Alla" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alla</SelectItem>
                          {accounts.map(account => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Transaktionstyp:</Label>
                      <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Alla" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alla</SelectItem>
                          {uniqueTransactionTypes.map(type => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 2: Transaction Direction and Month */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Transaktion:</Label>
                      <Select value={transactionFilter} onValueChange={setTransactionFilter}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Alla" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alla</SelectItem>
                          <SelectItem value="positive">Positiva</SelectItem>
                          <SelectItem value="negative">Negativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Månad:</Label>
                      <Select value={monthFilter} onValueChange={setMonthFilter}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Aktuell" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">Aktuell</SelectItem>
                          <SelectItem value="all">Alla månader</SelectItem>
                          {availableMonths.map((month) => (
                            <SelectItem key={month} value={month}>
                              {new Date(month + '-01').toLocaleDateString('sv-SE', { 
                                year: 'numeric', 
                                month: 'long' 
                              })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 3: App Categories */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Huvudkategori (App):</Label>
                      <Select value={appHuvudkategoriFilter} onValueChange={setAppHuvudkategoriFilter}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Alla" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alla</SelectItem>
                          <SelectItem value="uncategorized">Okategoriserat</SelectItem>
                          {huvudkategorier.map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Underkategori (App):</Label>
                      <Select value={appUnderkategoriFilter} onValueChange={setAppUnderkategoriFilter}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Alla" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alla</SelectItem>
                          <SelectItem value="uncategorized">Okategoriserat</SelectItem>
                          {underkategorier
                            .filter(sub => appHuvudkategoriFilter === 'all' || sub.huvudkategoriId === appHuvudkategoriFilter)
                            .map(subCategory => (
                              <SelectItem key={subCategory.id} value={subCategory.id}>
                                {subCategory.name}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 4: Bank Categories */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Bankkategori:</Label>
                      <Select value={bankCategoryFilter} onValueChange={setBankCategoryFilter}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Alla" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alla</SelectItem>
                          {uniqueBankCategories.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Bankunderkategori:</Label>
                      <Select value={bankSubCategoryFilter} onValueChange={setBankSubCategoryFilter}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Alla" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alla</SelectItem>
                          {uniqueBankSubCategories.map(subCategory => (
                            <SelectItem key={subCategory} value={subCategory}>
                              {subCategory}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 5: Description Search - Full width */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Beskrivning:</Label>
                    <Input
                      type="text"
                      placeholder="Sök i beskrivning, egen text eller UUID"
                      value={descriptionFilter}
                      onChange={(e) => setDescriptionFilter(e.target.value)}
                      className="h-10 w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
        
        <Progress value={progress} className="h-2" />
        
        {/* Mobile-friendly status and apply rules section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
          <p className="text-sm text-muted-foreground order-2 sm:order-1">
            {descriptionFilter ? 
              `${transactionsForNavigation.length} ${transactionsForNavigation.length === 1 ? 'transaktion' : 'transaktioner'} att granska` :
              `${uncategorizedTransactions.length} transaktioner kvar att granska`
            }
          </p>
          <Button
            onClick={handleApplyRulesToFiltered}
            disabled={isApplyingRules || uncategorizedTransactions.length === 0 || categoryRules.length === 0}
            size="default"
            variant="default"
            className="w-full sm:w-auto order-1 sm:order-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isApplyingRules ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Applicerar...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Applicera regler ({uncategorizedTransactions.length} transaktioner)</span>
                <span className="sm:hidden">Applicera regler ({uncategorizedTransactions.length})</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Conditional content based on available transactions to review */}
      {(!descriptionFilter && uncategorizedTransactions.length === 0) || (descriptionFilter && transactionsForNavigation.length === 0) ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            {descriptionFilter ? 'Inga transaktioner hittades!' : 'Allt är kategoriserat!'}
          </h2>
          <p className="text-muted-foreground">
            {descriptionFilter ? 'Inga transaktioner matchade din sökning.' : 'Du har inga transaktioner att granska just nu.'}
          </p>
        </div>
      ) : currentTransaction ? (
        <>
          {/* Swipeable transaction card */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentTransaction.id}
          custom={direction}
          initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction > 0 ? -300 : 300, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="touch-pan-y"
          style={{ userSelect: 'text' }}
        >
          <Card className={cn(
            "border-2 shadow-xl hover:shadow-2xl transition-all duration-200 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50",
            currentTransaction.status === 'red' 
              ? "border-red-300 bg-gradient-to-br from-red-50/80 to-white dark:from-red-950/20 dark:to-gray-900"
              : currentTransaction.status === 'green'
              ? "border-green-300 bg-gradient-to-br from-green-50/80 to-white dark:from-green-950/20 dark:to-gray-900"
              : "border-yellow-300 bg-gradient-to-br from-yellow-50/80 to-white dark:from-yellow-950/20 dark:to-gray-900"
          )}>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      variant={
                        currentTransaction.status === 'red' ? "destructive" 
                        : currentTransaction.status === 'green' ? "default"  
                        : "default"
                      }
                      className={cn(
                        "text-xs",
                        currentTransaction.status === 'green' && "bg-green-100 text-green-800 border-green-300"
                      )}
                    >
                      {currentTransaction.status === 'red' ? 'Ej kategoriserad' 
                       : currentTransaction.status === 'green' ? 'Godkänd'
                       : 'Delvis kategoriserad'}
                    </Badge>
                    {currentTransaction.type && (
                      <Badge variant="outline" className="text-xs">
                        {currentTransaction.type}
                      </Badge>
                    )}
                    {hasApplicableRules && (
                      <Badge 
                        variant="outline" 
                        className="text-xs bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-200 dark:border-green-600 cursor-pointer hover:bg-green-200 transition-colors"
                        onClick={handleShowRuleDetails}
                      >
                        Automatiska regler
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-mono select-text cursor-text" title="Transaction ID">
                      ID: {currentTransaction.id}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground select-text">
                      <Calendar className="h-4 w-4" />
                      <span className="select-text cursor-text">{format(new Date(currentTransaction.date), 'PPP', { locale: sv })}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {currentTransaction.correctedAmount !== null && currentTransaction.correctedAmount !== undefined ? (
                    <div>
                      <p className={cn(
                        "text-2xl font-bold select-text cursor-text",
                        currentTransaction.correctedAmount < 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {formatOrenAsCurrency(currentTransaction.correctedAmount)}
                      </p>
                      <p className="text-sm text-muted-foreground line-through select-text cursor-text">
                        Ursprungligt: {formatOrenAsCurrency(currentTransaction.amount)}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">
                        Korrigerat belopp
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className={cn(
                        "text-2xl font-bold select-text cursor-text",
                        currentTransaction.amount < 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {formatOrenAsCurrency(currentTransaction.amount)}
                      </p>
                      {/* Balance after transaction - smaller text under the amount */}
                      {(currentTransaction.balanceAfter !== undefined && !isNaN(currentTransaction.balanceAfter)) && (
                        <p className="text-sm text-muted-foreground mt-1 font-medium select-text cursor-text">
                          Saldo efter transaktion<br/>{formatOrenAsCurrency(currentTransaction.balanceAfter)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="details" className="text-sm">Detaljer</TabsTrigger>
                  <TabsTrigger value="linked" className="text-sm">Länkade transaktioner</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4 mt-0">
              {/* Account info */}
              <div className="flex items-center gap-2 p-3 bg-background rounded-lg">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium select-text cursor-text">
                  {accounts.find(a => a.id === currentTransaction.accountId)?.name || currentTransaction.accountName || 'Okänt konto'}
                </span>
              </div>

              {/* Transaction type - without heading, similar to account style */}
              <TransactionTypeSelector
                transaction={currentTransaction}
                onTypeChange={handleTypeUpdate}
              />

              {/* Koppla Utbetalning button - appears when type is Payment */}
              {currentTransaction.type === 'Payment' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUtbetalningDialog(true)}
                    className="flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Koppla Utbetalning
                  </Button>
                  {currentTransaction.linkedPerson && (
                    <span className="text-xs text-muted-foreground">
                      Kopplad till familjemedlem
                    </span>
                  )}
                </div>
              )}

              {/* Description Section - Simplified single field */}
              <div className="space-y-3">
                
                <div className="p-4 bg-gradient-to-r from-gray-50/70 to-slate-50/40 dark:from-gray-800/40 dark:to-slate-900/20 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Beskrivning:</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">
                          {currentTransaction.userDescription ? 'Egen text' : 'Från bank'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => {
                            setTempNote(currentTransaction.userDescription || currentTransaction.description || '');
                            setEditMode(editMode === 'description' ? null : 'description');
                          }}
                        >
                          <Edit3 className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                        </Button>
                        {currentTransaction.userDescription && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                            onClick={() => {
                              updateTransaction.mutate({
                                id: currentTransaction.id,
                                updates: { userDescription: null }
                              });
                            }}
                            title="Återställ till ursprunglig beskrivning"
                          >
                            <RotateCcw className="h-3 w-3 text-red-500 dark:text-red-400" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {editMode === 'description' ? (
                      <div className="space-y-2">
                        <Input
                          value={tempNote}
                          onChange={(e) => setTempNote(e.target.value)}
                          placeholder="Ange egen beskrivning..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleNoteUpdate();
                              setEditMode(null);
                            }
                            if (e.key === 'Escape') {
                              setEditMode(null);
                            }
                          }}
                          className="w-full bg-white dark:bg-gray-900"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setEditMode(null)}>
                            <X className="h-4 w-4 mr-1" />
                            Avbryt
                          </Button>
                          <Button size="sm" variant="default" className="h-8 px-3" onClick={() => {
                            handleNoteUpdate();
                            setEditMode(null);
                          }}>
                            <Check className="h-4 w-4 mr-1" />
                            Spara
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white/80 dark:bg-gray-900/80 rounded-md border border-gray-200/60 dark:border-gray-700/60 min-h-[44px] flex items-center">
                        <p className="font-medium text-sm select-text cursor-text">
                          {currentTransaction.userDescription || currentTransaction.description || 'Ingen beskrivning'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Kategorisering - Bank and App Categories */}
              <div className="space-y-3">
                

                {/* App Categories - Combined edit mode for both categories */}
                <div className="p-4 bg-gradient-to-r from-green-50/70 to-emerald-50/40 dark:from-green-800/40 dark:to-emerald-900/20 rounded-lg border border-green-200/50 dark:border-green-700/50">
                  <div className="space-y-4">

                    {editMode === 'categories' ? (
                      <div className="space-y-4">
                        {/* Huvudkategori selector */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-600 dark:text-gray-400">Huvudkategori</Label>
                          <Select
                            value={currentTransaction.appCategoryId || ''}
                            onValueChange={(value) => {
                              handleCategoryUpdate(value, undefined);
                            }}
                          >
                            <SelectTrigger className="w-full bg-white dark:bg-gray-900">
                              <SelectValue placeholder="Välj huvudkategori" />
                            </SelectTrigger>
                            <SelectContent>
                              {huvudkategorier.map(kat => (
                                <SelectItem key={kat.id} value={kat.id}>
                                  {kat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Underkategori selector */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-600 dark:text-gray-400">Underkategori</Label>
                          {currentTransaction.appCategoryId && underkategorierForHuvud.length > 0 ? (
                            <Select
                              value={currentTransaction.appSubCategoryId || ''}
                              onValueChange={(value) => {
                                handleCategoryUpdate(currentTransaction.appCategoryId, value);
                              }}
                            >
                              <SelectTrigger className="w-full bg-white dark:bg-gray-900">
                                <SelectValue placeholder="Välj underkategori (valfritt)" />
                              </SelectTrigger>
                              <SelectContent>
                                {underkategorierForHuvud.map(kat => (
                                  <SelectItem key={kat.id} value={kat.id}>
                                    {kat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-muted-foreground text-sm italic">
                              {currentTransaction.appCategoryId ? 'Inga underkategorier tillgängliga' : 'Välj huvudkategori först'}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" className="h-8 px-3" onClick={() => setEditMode(null)}>
                            <Check className="h-4 w-4 mr-1" />
                            Klart
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* App Categories Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Huvudkategori display */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Huvudkategori:</span>
                                {currentTransaction.wasHistoricallyAssigned === 'true' && (
                                  <div className="group relative">
                                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                    <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                      Uppdaterad baserat på historik
                                    </div>
                                  </div>
                                )}
                              </div>
                              {!currentTransaction.savingsTargetId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 hover:bg-green-100 dark:hover:bg-green-800 rounded-full"
                                  onClick={() => setEditMode(editMode === 'categories' ? null : 'categories')}
                                >
                                  <Edit3 className="h-3 w-3 text-green-600 dark:text-green-400" />
                                </Button>
                              )}
                              {currentTransaction.savingsTargetId && (
                                <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-200 dark:border-green-600">
                                  Låst
                                </Badge>
                              )}
                            </div>
                            <div className="p-3 bg-white/80 dark:bg-gray-900/80 rounded-md border border-gray-200/60 dark:border-gray-700/60 min-h-[44px] flex flex-col items-start justify-center gap-2">
                              {currentTransaction.appCategoryId ? (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-700 select-text cursor-text">
                                  {huvudkategoriForTransaction?.name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm italic">Ingen huvudkategori vald</span>
                              )}
                              {/* Bank Huvudkategori underneath */}
                              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700 select-text cursor-text">
                                Bank: {currentTransaction.bankCategory || currentTransaction.bankKategori || 'Övriga inkomster'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Underkategori display */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Underkategori:</span>
                            </div>
                            <div className="p-3 bg-white/80 dark:bg-gray-900/80 rounded-md border border-gray-200/60 dark:border-gray-700/60 min-h-[44px] flex flex-col items-start justify-center gap-2">
                              {currentTransaction.appSubCategoryId ? (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700 select-text cursor-text">
                                  {underkategorier.find(u => u.id === currentTransaction.appSubCategoryId)?.name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm italic">Ingen underkategori vald</span>
                              )}
                              {/* Bank Underkategori underneath */}
                              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700 select-text cursor-text">
                                Bank: {currentTransaction.bankSubCategory || currentTransaction.bankUnderkategori || 'Överföring egna konton'}
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                </div>
              </div>



              {/* Action buttons */}
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTransferDialog(true)}
                    className="justify-start"
                  >
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    Intern överföring
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExpenseDialog(true)}
                    className="justify-start"
                    disabled={currentTransaction.amount >= 0}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Utlägg
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCostCoverageDialog(true)}
                    className="justify-start"
                    disabled={currentTransaction.amount <= 0}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Täck kostnad
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRuleDialog(true)}
                    className="justify-start"
                    disabled={hasApplicableRules}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Skapa regel
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSavingsDialog(true)}
                  className="justify-start w-full"
                  disabled={currentTransaction.amount <= 0}
                >
                  <PiggyBank className="h-4 w-4 mr-2" />
                  Länka sparande
                </Button>
              </div>
                </TabsContent>
                
                <TabsContent value="linked" className="space-y-4 mt-0">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      Länkningsstatus
                    </h4>
                    
                    {/* Linked Transaction (Internal Transfer) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Länkad intern överföring</span>
                        {currentTransaction.linkedTransactionId ? (
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="default" 
                              className="bg-green-100 text-green-700 border-green-300 cursor-pointer hover:bg-green-200 transition-colors"
                              onClick={() => handleLinkedTransactionClick(currentTransaction.linkedTransactionId)}
                            >
                              Länkad
                            </Badge>
                            <button
                              onClick={handleUnlinkInternalTransfer}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Ta bort länkning"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            Ej länkad
                          </Badge>
                        )}
                      </div>
                      {currentTransaction.linkedTransactionId && (
                        <div className="text-xs text-muted-foreground pl-4 border-l-2 border-green-200">
                          ID: {currentTransaction.linkedTransactionId.substring(0, 8)}...
                          <br />
                          Typ: Intern överföring
                        </div>
                      )}
                    </div>
                    
                    {/* Linked Cost (Expense/Coverage) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Länkad utlägg/kostnad</span>
                        {currentTransaction.linkedCostId ? (
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="default" 
                              className="bg-blue-100 text-blue-700 border-blue-300 cursor-pointer hover:bg-blue-200 transition-colors"
                              onClick={() => handleLinkedTransactionClick(currentTransaction.linkedCostId)}
                            >
                              Länkad
                            </Badge>
                            <button
                              onClick={handleUnlinkExpenseCost}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Ta bort länkning och återställ korrigerat belopp"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            Ej länkad
                          </Badge>
                        )}
                      </div>
                      {currentTransaction.linkedCostId && (
                        <div className="text-xs text-muted-foreground pl-4 border-l-2 border-blue-200">
                          ID: {currentTransaction.linkedCostId.substring(0, 8)}...
                          <br />
                          Typ: {currentTransaction.type === 'ExpenseClaim' ? 'Utlägg' : 'Kostnadstäckning'}
                        </div>
                      )}
                    </div>
                    
                    {/* Linked Savings Target */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Länkat sparande/sparmål</span>
                        {currentTransaction.savingsTargetId ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-300">
                              Länkad
                            </Badge>
                            <button
                              onClick={handleUnlinkSavings}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Ta bort länkning"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            Ej länkad
                          </Badge>
                        )}
                      </div>
                      {currentTransaction.savingsTargetId && (
                        <div className="text-xs text-muted-foreground pl-4 border-l-2 border-purple-200">
                          ID: {currentTransaction.savingsTargetId.substring(0, 8)}...
                          <br />
                          Typ: Sparande
                        </div>
                      )}
                    </div>
                    
                    {/* Linked Income Target */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Länkad inkomst</span>
                        {currentTransaction.incomeTargetId ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                              Länkad
                            </Badge>
                            <button
                              onClick={handleUnlinkIncome}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Ta bort länkning"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            Ej länkad
                          </Badge>
                        )}
                      </div>
                      {currentTransaction.incomeTargetId && (
                        <div className="text-xs text-muted-foreground pl-4 border-l-2 border-yellow-200">
                          ID: {currentTransaction.incomeTargetId.substring(0, 8)}...
                          <br />
                          Typ: Inkomst
                        </div>
                      )}
                    </div>
                    
                    {/* Linked Person (Utbetalning) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Länkad utbetalning</span>
                        {currentTransaction.linkedPerson ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-orange-100 text-orange-700 border-orange-300">
                              Länkad
                            </Badge>
                            <button
                              onClick={() => {
                                updateTransactionMutation.mutate({
                                  id: currentTransaction.id,
                                  data: { linkedPerson: null, isManuallyChanged: 'true' }
                                });
                                toast({
                                  title: "Utbetalningslänkning borttagen",
                                  description: "Transaktionen är inte längre länkad till en familjemedlem."
                                });
                              }}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Ta bort länkning"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            Ej länkad
                          </Badge>
                        )}
                      </div>
                      {currentTransaction.linkedPerson && (
                        <div className="text-xs text-muted-foreground pl-4 border-l-2 border-orange-200">
                          Familjemedlem: <strong>{familyMembers.find(member => member.id === currentTransaction.linkedPerson)?.name || 'Okänd'}</strong>
                          <br />
                          ID: {currentTransaction.linkedPerson.substring(0, 8)}...
                        </div>
                      )}
                    </div>
                    
                    {/* Summary */}
                    <div className="mt-6 p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-muted-foreground text-center">
                        {[currentTransaction.linkedTransactionId, currentTransaction.linkedCostId, currentTransaction.savingsTargetId, currentTransaction.incomeTargetId, currentTransaction.linkedPerson].filter(Boolean).length} av 5 möjliga länkningar aktiva
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            className="flex-1"
            size="lg"
            onClick={handleApprove}
            disabled={!currentTransaction.appCategoryId}
          >
            <Check className="h-5 w-5 mr-2" />
            Godkänn
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex === transactionsForNavigation.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Rule creation dialog */}
      {showRuleDialog && currentTransaction && (
        <CreateRuleDialog
          open={showRuleDialog}
          onOpenChange={(open) => setShowRuleDialog(open)}
          transaction={currentTransaction}
          accounts={accounts}
        />
      )}

      {/* Expense link dialog */}
      {showExpenseDialog && currentTransaction && (
        <ExpenseLinkDialog
          isOpen={showExpenseDialog}
          onClose={() => setShowExpenseDialog(false)}
          expenseTransaction={currentTransaction}
          transactions={transactions}
          onLink={(positiveTxId) => {
            // Find the transactions
            const expenseTransaction = currentTransaction; // negative transaction
            const coverageTransaction = transactions.find(tx => tx.id === positiveTxId); // positive transaction
            
            if (!coverageTransaction) {
              toast({
                title: "Fel",
                description: "Kunde inte hitta täckningstransaktionen.",
                variant: "destructive",
              });
              return;
            }
            
            // Calculate amounts
            const expenseAmount = Math.abs(expenseTransaction.amount);
            const coverageAmount = coverageTransaction.amount;
            const amountToCover = Math.min(expenseAmount, coverageAmount);
            
            const newExpenseCorrectedAmount = expenseTransaction.amount + amountToCover;
            const newCoverageCorrectedAmount = coverageAmount - amountToCover;
            
            console.log('🔗 Expense linking calculation:', {
              expenseAmount,
              coverageAmount,
              amountToCover,
              newExpenseCorrectedAmount,
              newCoverageCorrectedAmount,
              expenseId: expenseTransaction.id,
              coverageId: positiveTxId
            });
            
            // Update expense transaction (negative) - the selected one
            updateTransactionMutation.mutate({
              id: expenseTransaction.id,
              data: {
                type: 'ExpenseClaim',
                correctedAmount: newExpenseCorrectedAmount,
                linkedCostId: positiveTxId, // Points to the original transaction
                isManuallyChanged: 'true'
              }
            }, {
              onSuccess: () => {
                // Update coverage transaction (positive) - the original one
                updateTransactionMutation.mutate({
                  id: positiveTxId,
                  data: {
                    type: 'CostCoverage',
                    correctedAmount: newCoverageCorrectedAmount,
                    linkedCostId: expenseTransaction.id, // Points to the selected transaction
                    isManuallyChanged: 'true'
                  }
                }, {
                  onSuccess: () => {
                    setShowExpenseDialog(false);
                    toast({
                      title: "Utlägg länkat",
                      description: "Transaktionen har markerats som utlägg.",
                    });
                  },
                  onError: (error) => {
                    toast({
                      title: "Fel",
                      description: "Kunde inte uppdatera täckningstransaktionen.",
                      variant: "destructive",
                    });
                    console.error('Failed to update coverage transaction:', error);
                  }
                });
              },
              onError: (error) => {
                toast({
                  title: "Fel",
                  description: "Kunde inte uppdatera utläggstransaktionen.",
                  variant: "destructive",
                });
                console.error('Failed to update expense transaction:', error);
              }
            });
            // No auto-advance - user controls navigation
          }}
        />
      )}

      {/* Cost coverage dialog */}
      {showCostCoverageDialog && currentTransaction && (
        <CostCoverageDialog
          isOpen={showCostCoverageDialog}
          onClose={() => setShowCostCoverageDialog(false)}
          coverageTransaction={currentTransaction}
          transactions={transactions}
          onLink={(costTxId) => {
            // Find the transactions
            const coverageTransaction = currentTransaction; // positive transaction
            const costTransaction = transactions.find(tx => tx.id === costTxId); // negative transaction
            
            if (!costTransaction) {
              toast({
                title: "Fel",
                description: "Kunde inte hitta kostnadstransaktionen.",
                variant: "destructive",
              });
              return;
            }
            
            // Calculate amounts
            const costAmount = Math.abs(costTransaction.amount);
            const coverageAmount = coverageTransaction.amount;
            const amountToCover = Math.min(costAmount, coverageAmount);
            
            const newCostCorrectedAmount = costTransaction.amount + amountToCover;
            const newCoverageCorrectedAmount = coverageAmount - amountToCover;
            
            // Update cost transaction (negative) - the selected one
            updateTransactionMutation.mutate({
              id: costTxId,
              data: {
                type: 'ExpenseClaim',
                correctedAmount: newCostCorrectedAmount,
                linkedCostId: currentTransaction.id, // Points to the original transaction
                isManuallyChanged: 'true'
              }
            }, {
              onSuccess: () => {
                // Update coverage transaction (positive) - the original one
                updateTransactionMutation.mutate({
                  id: currentTransaction.id,
                  data: {
                    type: 'CostCoverage',
                    correctedAmount: newCoverageCorrectedAmount,
                    linkedCostId: costTxId, // Points to the selected transaction
                    isManuallyChanged: 'true'
                  }
                }, {
                  onSuccess: () => {
                    setShowCostCoverageDialog(false);
                    toast({
                      title: "Kostnad täckt",
                      description: "Transaktionen har länkats till kostnaden.",
                    });
                  },
                  onError: (error) => {
                    toast({
                      title: "Fel",
                      description: "Kunde inte uppdatera täckningstransaktionen.",
                      variant: "destructive",
                    });
                    console.error('Failed to update coverage transaction:', error);
                  }
                });
              },
              onError: (error) => {
                toast({
                  title: "Fel",
                  description: "Kunde inte uppdatera kostnadstransaktionen.",
                  variant: "destructive",
                });
                console.error('Failed to update cost transaction:', error);
              }
            });
            // No auto-advance - user controls navigation
          }}
        />
      )}

      {/* Savings link dialog */}
      {showSavingsDialog && currentTransaction && (
        <SavingsGoalLinkDialog
          isOpen={showSavingsDialog}
          onClose={() => setShowSavingsDialog(false)}
          transaction={currentTransaction}
          savingsGoals={savingsGoals}
          onLink={(savingsTargetId, mainCategoryId, subCategoryId) => {
            updateTransactionMutation.mutate({
              id: currentTransaction.id,
              data: {
                savingsTargetId: savingsTargetId,
                appCategoryId: mainCategoryId,
                appSubCategoryId: subCategoryId || null,
                type: 'savings',
                isManuallyChanged: 'true'
              }
            }, {
              onSuccess: () => {
                setShowSavingsDialog(false);
                toast({
                  title: "Sparande länkat",
                  description: "Transaktionen har länkats till sparmålet.",
                });
              },
              onError: (error) => {
                toast({
                  title: "Fel",
                  description: "Kunde inte länka transaktionen till sparmålet.",
                  variant: "destructive"
                });
                console.error('Failed to link savings transaction:', error);
              }
            });
            // No auto-advance - user controls navigation
          }}
        />
      )}

      {/* Internal transfer dialog */}
      {showTransferDialog && currentTransaction && (
        <SimpleTransferMatchDialog
          isOpen={showTransferDialog}
          onClose={() => setShowTransferDialog(false)}
          transaction={currentTransaction}
          suggestions={transactions.filter(tx => 
            tx.id !== currentTransaction.id && 
            Math.abs(tx.amount) === Math.abs(currentTransaction.amount) &&
            Math.abs(new Date(tx.date).getTime() - new Date(currentTransaction.date).getTime()) <= 7 * 24 * 60 * 60 * 1000 &&
            ((currentTransaction.amount < 0 && tx.amount > 0) || (currentTransaction.amount > 0 && tx.amount < 0)) // Opposite signs only
          )}
          onRefresh={async () => {
            // Refresh transactions data using React Query
            await refetchTransactions();
          }}
        />
      )}

      {/* Linked transaction view dialog */}
      {showLinkedTransactionDialog && linkedTransactionToShow && (
        <Dialog open={showLinkedTransactionDialog} onOpenChange={setShowLinkedTransactionDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Länkad transaktion</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Transaction header */}
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <div>
                  <h3 className="text-lg font-semibold">{linkedTransactionToShow.description}</h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(linkedTransactionToShow.date), 'dd MMMM yyyy', { locale: sv })}
                    {linkedTransactionToShow.accountId && accounts.find(a => a.id === linkedTransactionToShow.accountId) && (
                      <> • {accounts.find(a => a.id === linkedTransactionToShow.accountId)?.name}</>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  {linkedTransactionToShow.correctedAmount !== null && linkedTransactionToShow.correctedAmount !== undefined ? (
                    <div>
                      <p className={cn("text-2xl font-bold", linkedTransactionToShow.correctedAmount < 0 ? "text-red-600" : "text-green-600")}>
                        {formatOrenAsCurrency(linkedTransactionToShow.correctedAmount)}
                      </p>
                      <p className="text-sm text-muted-foreground line-through">
                        Ursprungligt: {formatOrenAsCurrency(linkedTransactionToShow.amount)}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">Korrigerat belopp</p>
                    </div>
                  ) : (
                    <p className={cn("text-2xl font-bold", linkedTransactionToShow.amount < 0 ? "text-red-600" : "text-green-600")}>
                      {formatOrenAsCurrency(linkedTransactionToShow.amount)}
                    </p>
                  )}
                </div>
              </div>

              {/* Transaction details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Typ</Label>
                  <Badge variant="outline" className="block w-fit mt-1">
                    {linkedTransactionToShow.type}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "block w-fit mt-1",
                      linkedTransactionToShow.status === 'green' && "bg-green-100 text-green-700 border-green-300",
                      linkedTransactionToShow.status === 'yellow' && "bg-yellow-100 text-yellow-700 border-yellow-300",
                      linkedTransactionToShow.status === 'red' && "bg-red-100 text-red-700 border-red-300"
                    )}
                  >
                    {linkedTransactionToShow.status === 'green' ? 'Godkänd' : 
                     linkedTransactionToShow.status === 'yellow' ? 'Granskning' : 'Behöver åtgärd'}
                  </Badge>
                </div>
              </div>

              {/* User note */}
              {linkedTransactionToShow.userDescription && (
                <div>
                  <Label className="text-xs text-muted-foreground">Anteckning</Label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded">{linkedTransactionToShow.userDescription}</p>
                </div>
              )}

              {/* Categories */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Huvudkategori</Label>
                  <p className="text-sm mt-1">
                    {linkedTransactionToShow.appCategoryId && huvudkategorier.find(h => h.id === linkedTransactionToShow.appCategoryId)?.name || 'Ej kategoriserad'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Underkategori</Label>
                  <p className="text-sm mt-1">
                    {linkedTransactionToShow.appSubCategoryId && underkategorier.find(u => u.id === linkedTransactionToShow.appSubCategoryId)?.name || 'Ej vald'}
                  </p>
                </div>
              </div>

              {/* Linking Status */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Länkningsstatus
                </h4>
                
                <div className="space-y-3">
                  {/* Linked Internal Transfer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Länkad intern överföring</span>
                      {linkedTransactionToShow.linkedTransactionId ? (
                        <Badge variant="default" className="bg-green-100 text-green-700 border-green-300">
                          Länkad
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          Ej länkad
                        </Badge>
                      )}
                    </div>
                    {linkedTransactionToShow.linkedTransactionId && (
                      <div className="text-xs text-muted-foreground pl-4 border-l-2 border-green-200">
                        ID: {linkedTransactionToShow.linkedTransactionId.substring(0, 8)}...
                        <br />
                        Typ: Intern överföring
                      </div>
                    )}
                  </div>
                  
                  {/* Linked Cost (Expense/Coverage) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Länkad utlägg/kostnad</span>
                      {linkedTransactionToShow.linkedCostId ? (
                        <Badge variant="default" className="bg-blue-100 text-blue-700 border-blue-300">
                          Länkad
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          Ej länkad
                        </Badge>
                      )}
                    </div>
                    {linkedTransactionToShow.linkedCostId && (
                      <div className="text-xs text-muted-foreground pl-4 border-l-2 border-blue-200">
                        ID: {linkedTransactionToShow.linkedCostId.substring(0, 8)}...
                        <br />
                        Typ: {linkedTransactionToShow.type === 'ExpenseClaim' ? 'Utlägg' : 'Kostnadstäckning'}
                      </div>
                    )}
                  </div>
                  
                  {/* Linked Savings Target */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Länkat sparande/sparmål</span>
                      {linkedTransactionToShow.savingsTargetId ? (
                        <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-300">
                          Länkad
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          Ej länkad
                        </Badge>
                      )}
                    </div>
                    {linkedTransactionToShow.savingsTargetId && (
                      <div className="text-xs text-muted-foreground pl-4 border-l-2 border-purple-200">
                        ID: {linkedTransactionToShow.savingsTargetId.substring(0, 8)}...
                        <br />
                        Typ: Sparande
                      </div>
                    )}
                  </div>
                  
                  {/* Linked Income Target */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Länkad inkomst</span>
                      {linkedTransactionToShow.incomeTargetId ? (
                        <Badge variant="default" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                          Länkad
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          Ej länkad
                        </Badge>
                      )}
                    </div>
                    {linkedTransactionToShow.incomeTargetId && (
                      <div className="text-xs text-muted-foreground pl-4 border-l-2 border-yellow-200">
                        ID: {linkedTransactionToShow.incomeTargetId.substring(0, 8)}...
                        <br />
                        Typ: Inkomst
                      </div>
                    )}
                  </div>
                  
                  {/* Summary */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-muted-foreground text-center">
                      {[linkedTransactionToShow.linkedTransactionId, linkedTransactionToShow.linkedCostId, linkedTransactionToShow.savingsTargetId, linkedTransactionToShow.incomeTargetId].filter(Boolean).length} av 4 möjliga länkningar aktiva
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction ID */}
              <div>
                <Label className="text-xs text-muted-foreground">Transaktions-ID</Label>
                <p className="text-xs font-mono mt-1 p-2 bg-gray-50 rounded">{linkedTransactionToShow.id}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Apply Rules Results Dialog */}
      {showApplyRulesResults && applyRulesResults && (
        <Dialog open={showApplyRulesResults} onOpenChange={setShowApplyRulesResults}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Regelapplicering genomförd
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Statistics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{applyRulesResults.stats.filteredProcessed}</div>
                  <div className="text-sm text-muted-foreground">Filtrerade behandlade</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{applyRulesResults.stats.updated}</div>
                  <div className="text-sm text-muted-foreground">
                    Totalt uppdaterade
                    {applyRulesResults.stats.counterpartUpdated > 0 && (
                      <div className="text-xs text-green-600 mt-1">
                        (inkl. {applyRulesResults.stats.counterpartUpdated} matchade)
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{applyRulesResults.stats.rulesApplied}</div>
                  <div className="text-sm text-muted-foreground">Regelträffar</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{applyRulesResults.stats.autoApproved}</div>
                  <div className="text-sm text-muted-foreground">Auto-godkända</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{applyRulesResults.stats.bankMatched}</div>
                  <div className="text-sm text-muted-foreground">Bankträffar</div>
                </div>
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">{applyRulesResults.stats.autoMatched}</div>
                  <div className="text-sm text-muted-foreground">Auto-matchade (av filtrerade)</div>
                </div>
              </div>

              {/* Success Message */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-800">Regelapplicering slutförd</h4>
                    <p className="text-sm text-green-700 mt-1">
                      {applyRulesResults.stats.filteredProcessed} filtrerade transaktioner behandlades, 
                      {applyRulesResults.stats.updated} totalt uppdaterades
                      {applyRulesResults.stats.counterpartUpdated > 0 && ` (inkl. ${applyRulesResults.stats.counterpartUpdated} matchade motparter)`}.
                      {applyRulesResults.stats.autoApproved > 0 && ` ${applyRulesResults.stats.autoApproved} transaktioner godkändes automatiskt.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Results */}
              {applyRulesResults.stats.updated > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Uppdateringsdetaljer</h4>
                  <div className="space-y-2 text-sm">
                    {applyRulesResults.stats.rulesApplied > 0 && (
                      <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                        <span>Regelbaserade kategoriseringar</span>
                        <Badge variant="outline" className="bg-purple-100 text-purple-700">
                          {applyRulesResults.stats.rulesApplied}
                        </Badge>
                      </div>
                    )}
                    {applyRulesResults.stats.bankMatched > 0 && (
                      <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                        <span>Bankkategori-matchningar</span>
                        <Badge variant="outline" className="bg-orange-100 text-orange-700">
                          {applyRulesResults.stats.bankMatched}
                        </Badge>
                      </div>
                    )}
                    {applyRulesResults.stats.autoMatched > 0 && (
                      <div className="flex items-center justify-between p-2 bg-indigo-50 rounded">
                        <span>Automatiskt matchade överföringar (filtrerade)</span>
                        <Badge variant="outline" className="bg-indigo-100 text-indigo-700">
                          {applyRulesResults.stats.autoMatched}
                        </Badge>
                      </div>
                    )}
                    {applyRulesResults.stats.autoApprovedFiltered > 0 && (
                      <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <span>Automatiskt godkända (filtrerade)</span>
                        <Badge variant="outline" className="bg-green-100 text-green-700">
                          {applyRulesResults.stats.autoApprovedFiltered}
                        </Badge>
                      </div>
                    )}
                    {applyRulesResults.stats.autoApprovedMatched > 0 && (
                      <div className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                        <span>Automatiskt godkända (matchade)</span>
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-700">
                          {applyRulesResults.stats.autoApprovedMatched}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Nästa steg</p>
                    <p>
                      Transaktionerna har uppdaterats automatiskt. Du kan fortsätta granska de återstående transaktionerna 
                      eller gå tillbaka för att se översikten.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => setShowApplyRulesResults(false)}>
                  Stäng
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Rule Details Dialog */}
      <Dialog open={showRuleDetailsDialog} onOpenChange={setShowRuleDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Automatiska regler för denna transaktion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {applicableRulesForDialog.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Följande {applicableRulesForDialog.length} regel{applicableRulesForDialog.length !== 1 ? 'er' : ''} kan appliceras på denna transaktion:
                </p>
                {applicableRulesForDialog.map((rule, index) => {
                  const applicableAccounts = rule.applicableAccountIds ? 
                    (JSON.parse(rule.applicableAccountIds || '[]').length === 0 ? 
                      ['Alla konton'] : 
                      JSON.parse(rule.applicableAccountIds).map((id: string) => {
                        const account = accounts.find(acc => acc.id === id);
                        return account ? account.name : `Okänt konto (${id})`;
                      })
                    ) : ['Alla konton'];
                  
                  const showLinkedApproval = rule.positiveTransactionType === 'InternalTransfer' || 
                                           rule.negativeTransactionType === 'InternalTransfer';
                  
                  return (
                    <Card key={rule.id} className="border-gray-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={rule.isActive === 'true' || rule.isActive === true ? "default" : "secondary"}>
                              #{rule.priority || 100}
                            </Badge>
                            <h3 className="font-medium text-sm">
                              {rule.ruleType === 'textStartsWith' && 'Börjar med'}
                              {rule.ruleType === 'textContains' && 'Innehåller'}
                              {rule.ruleType === 'exactText' && 'Exakt text'}
                              {rule.ruleType === 'categoryMatch' && 'Bankkategori'}
                              {rule.transactionName && ` • "${rule.transactionName}"`}
                              {' → '}
                              {getHuvudkategoriName(rule.huvudkategoriId) || 'Okänd'} / {getUnderkategoriName(rule.underkategoriId) || 'Okänd'}
                            </h3>
                          </div>
                          {rule.isActive === 'false' || rule.isActive === false ? (
                            <Badge variant="outline" className="text-orange-600 border-orange-200">
                              Inaktiv
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {rule.positiveTransactionType === 'InternalTransfer' || rule.negativeTransactionType === 'InternalTransfer' ? 
                            'Intern överföring' : 'Standard transaktionstyper'}
                        </p>
                        {applicableAccounts[0] !== 'Alla konton' && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {applicableAccounts.map((accountName, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {accountName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {/* Section 1: Regeln gäller för */}
                        <Card className="border-blue-200 bg-blue-50/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Filter className="h-4 w-4 text-blue-600" />
                              Regeln gäller för
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2 text-sm">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Regeltyp</Label>
                                <p className="font-medium mt-1">
                                  {rule.ruleType === 'textContains' && 'Text innehåller'}
                                  {rule.ruleType === 'textStartsWith' && 'Text börjar med'}
                                  {rule.ruleType === 'exactText' && 'Exakt text'}
                                  {rule.ruleType === 'categoryMatch' && 'Bankens kategori'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Villkor</Label>
                                <p className="font-medium mt-1">
                                  {rule.transactionName || 'Inget villkor'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Transaktionsriktning</Label>
                                <p className="font-medium mt-1">
                                  {rule.transactionDirection === 'all' && 'Alla transaktioner'}
                                  {rule.transactionDirection === 'positive' && 'Endast inkomster (+)'}
                                  {rule.transactionDirection === 'negative' && 'Endast utgifter (-)'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Bankkategorier</Label>
                                <p className="font-medium mt-1">
                                  {rule.bankhuvudkategori && rule.bankhuvudkategori !== 'Alla Bankkategorier'
                                    ? `${rule.bankhuvudkategori}${rule.bankunderkategori && rule.bankunderkategori !== 'Alla Bankunderkategorier' ? ` / ${rule.bankunderkategori}` : ''}`
                                    : 'Alla bankkategorier'}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        {/* Section 2: Konton */}
                        <Card className="border-green-200 bg-green-50/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Users className="h-4 w-4 text-green-600" />
                              Konton som regeln gäller för
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-1">
                              {applicableAccounts.map((accountName, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {accountName}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                        
                        {/* Section 3: Kategorisering & Åtgärder */}
                        <Card className="border-purple-200 bg-purple-50/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Target className="h-4 w-4 text-purple-600" />
                              Kategorisering & Åtgärder
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2 text-sm">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Huvudkategori</Label>
                                <p className="font-medium mt-1">
                                  {getHuvudkategoriName(rule.huvudkategoriId) || 'Okänd kategori'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Underkategori</Label>
                                <p className="font-medium mt-1">
                                  {getUnderkategoriName(rule.underkategoriId) || 'Okänd underkategori'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Positiva belopp</Label>
                                <p className="font-medium mt-1">
                                  {rule.positiveTransactionType === 'Income' ? 'Inkomst' : (rule.positiveTransactionType || 'Transaction')}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Negativa belopp</Label>
                                <p className="font-medium mt-1">
                                  {rule.negativeTransactionType === 'Income' ? 'Inkomst' : (rule.negativeTransactionType || 'Transaction')}
                                </p>
                              </div>
                            </div>
                            
                            <Separator />
                            
                            <div className="grid gap-3 md:grid-cols-2 text-sm">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Prioritet</Label>
                                <p className="font-medium mt-1">
                                  {rule.priority || 100} <span className="text-xs text-muted-foreground">(lägre = högre prioritet)</span>
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Automatiskt godkännande</Label>
                                <p className="font-medium mt-1">
                                  {rule.autoApproval ? 'Ja' : 'Nej'}
                                </p>
                              </div>
                              {showLinkedApproval && (
                                <div className="md:col-span-2">
                                  <Label className="text-xs font-medium text-muted-foreground">Automatisk godkännande för matchad transaktion</Label>
                                  <p className="font-medium mt-1">
                                    {rule.autoApproveLinked === true ? 'Ja' : 'Nej'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Inga regler kan appliceras på denna transaktion.
              </p>
            )}
            
            <div className="flex justify-between pt-4">
              <div className="flex gap-2">
                {applicableRulesForDialog.map((rule, index) => (
                  <Button 
                    key={rule.id}
                    variant="destructive" 
                    onClick={() => handleDeleteRule(rule.id, rule.ruleName)}
                    disabled={deleteRuleMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Ta bort regel {applicableRulesForDialog.length > 1 ? `#${index + 1}` : ''}
                  </Button>
                ))}
              </div>
              <Button onClick={() => setShowRuleDetailsDialog(false)}>
                Stäng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Utbetalning link dialog */}
      {showUtbetalningDialog && currentTransaction && (
        <UtbetalningLinkDialog
          isOpen={showUtbetalningDialog}
          onClose={() => setShowUtbetalningDialog(false)}
          transaction={currentTransaction}
        />
      )}
        </>
      ) : null}
    </div>
  );
}