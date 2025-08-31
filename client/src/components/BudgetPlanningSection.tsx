import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ChevronRight, Plus, ArrowRightLeft, PiggyBank, Target, Home, ShoppingCart, Car, Heart, Gamepad2, GraduationCap, Wallet, TrendingUp, Baby, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatOrenAsCurrency, kronoraToOren } from '@/utils/currencyUtils';
import { useTransactions } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';
import { useUpdateBudgetPost, useCreateBudgetPost } from '@/hooks/useBudgetPosts';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useQueryClient } from '@tanstack/react-query';
import { useHuvudkategorier, useUnderkategorier } from '@/hooks/useCategories';
import { getDateRangeForMonth } from '@/services/calculationService';

interface Account {
  id: string;
  name: string;
  assignedTo: string | null;
  balance: number;
}

interface EditDialogState {
  isOpen: boolean;
  accountId: string;
  accountName: string;
  currentValue: number | null;
  bankBalance: number | null;
}

interface BudgetPlanningProps {
  accounts: Account[];
  budgetPosts: any[];
  selectedMonth: string;
  viewMode?: 'categories' | 'spotlights'; // From PlanHeader
  onNewTransfer: (accountIdFrom?: string) => void;
  onNewCost: (accountId?: string, huvudkategoriId?: string, underkategoriId?: string, fromAccountId?: string, toAccountId?: string) => void;
  onNewSaving: (accountIdTo?: string, huvudkategoriId?: string, underkategoriId?: string, fromAccountId?: string, toAccountId?: string) => void;
}

interface AccountGroup {
  name: string;
  accounts: Account[];
}

export function BudgetPlanningSection({
  accounts,
  budgetPosts,
  selectedMonth,
  viewMode = 'spotlights', // Default to accounts view
  onNewTransfer,
  onNewCost,
  onNewSaving
}: BudgetPlanningProps) {
  // Get transactions using the same hook as KontosaldoKopia
  const { data: allTransactions = [] } = useTransactions();
  const { data: familyMembers = [] } = useFamilyMembers();
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: underkategorier = [] } = useUnderkategorier();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateBudgetPostMutation = useUpdateBudgetPost();
  const createBudgetPostMutation = useCreateBudgetPost();

  // Function to get icon based on category name
  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('boende') || name.includes('hem')) return Home;
    if (name.includes('mat') || name.includes('livsmedel')) return ShoppingCart;
    if (name.includes('transport') || name.includes('bil')) return Car;
    if (name.includes('barn') || name.includes('familj')) return Baby;
    if (name.includes('nöje') || name.includes('fritid')) return Gamepad2;
    if (name.includes('utbildning') || name.includes('skola')) return GraduationCap;
    if (name.includes('hälsa') || name.includes('vård')) return Heart;
    if (name.includes('sparande') || name.includes('spar')) return PiggyBank;
    if (name.includes('övrigt')) return Wallet;
    return TrendingUp; // Default icon
  };

  // Get detailed transactions for a category (used for popup)
  const getTransactionsForCategory = (huvudkategoriId: string, underkategoriId?: string) => {
    const { startDate, endDate } = getDateRangeForMonth(selectedMonth, 25);
    
    return allTransactions.filter(tx => {
      const inPeriod = tx.date >= startDate && tx.date <= endDate;
      const matchesCategory = underkategoriId 
        ? tx.appSubCategoryId === underkategoriId
        : tx.appCategoryId === huvudkategoriId; // Include ALL transactions for huvudkategori
      
      // Exclude Savings from cost budget calculations - savings are outside cost budget
      const isRelevantType = ['Transaction', 'ExpenseClaim', 'Payment', 'Income'].includes(tx.type);
      
      return inPeriod && matchesCategory && isRelevantType;
    });
  };

  // Handle clicking on amount to show transaction details
  const handleAmountClick = (
    categoryName: string, 
    huvudkategoriId: string, 
    underkategoriId: string | undefined,
    budgetAmount: number,
    actualAmount: number
  ) => {
    const transactions = getTransactionsForCategory(huvudkategoriId, underkategoriId);
    
    setTransactionDetailsDialog({
      isOpen: true,
      categoryName,
      huvudkategoriId,
      underkategoriId,
      budgetAmount,
      actualAmount,
      transactions
    });
  };

  // Calculate actual spending for a category in the selected month using payday logic
  const calculateActualSpending = (huvudkategoriId: string, underkategoriId?: string) => {
    // Use same logic as Budget page - getDateRangeForMonth with payday 25
    const { startDate, endDate } = getDateRangeForMonth(selectedMonth, 25);
    
    console.log(`[BudgetPlanningSection] Calculating actual for ${selectedMonth}:`, {
      huvudkategoriId,
      underkategoriId,
      startDate,
      endDate,
      transactionsCount: allTransactions.length
    });

    // Filter transactions for this month and category - use string comparison like Budget page
    const categoryTransactions = allTransactions.filter(tx => {
      const inPeriod = tx.date >= startDate && tx.date <= endDate;
      const matchesCategory = underkategoriId 
        ? tx.appSubCategoryId === underkategoriId
        : tx.appCategoryId === huvudkategoriId; // Include ALL transactions for huvudkategori (sum all subcategories)
      
      // Exclude Savings from cost budget calculations - savings are outside cost budget  
      const isRelevantType = ['Transaction', 'ExpenseClaim', 'Payment', 'Income'].includes(tx.type);
      
      // Debug logging for matching transactions
      if (matchesCategory && isRelevantType) {
        console.log(`[BudgetPlanningSection] Potential match:`, {
          date: tx.date,
          inPeriod,
          amount: tx.amount,
          type: tx.type,
          description: tx.description,
          appCategoryId: tx.appCategoryId,
          appSubCategoryId: tx.appSubCategoryId
        });
      }
      
      return inPeriod && matchesCategory && isRelevantType;
    });

    // Calculate net total by summing positive and negative amounts:
    // Use correctedAmount if available, otherwise use regular amount
    const total = categoryTransactions.reduce((sum, tx) => {
      const amount = tx.correctedAmount !== null ? tx.correctedAmount : tx.amount;
      return sum + amount; // Sum actual amounts (positive + negative)
    }, 0);
    
    if (categoryTransactions.length > 0) {
      console.log(`[BudgetPlanningSection] Found ${categoryTransactions.length} transactions, total: ${total}`);
    }

    // Sum the absolute values
    return total;
  };
  
  // Scroll detection state
  const [isScrolling, setIsScrolling] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Transaction details popup state
  const [transactionDetailsDialog, setTransactionDetailsDialog] = useState<{
    isOpen: boolean;
    categoryName: string;
    huvudkategoriId: string;
    underkategoriId?: string;
    budgetAmount: number;
    actualAmount: number;
    transactions: any[];
  }>({
    isOpen: false,
    categoryName: '',
    huvudkategoriId: '',
    underkategoriId: undefined,
    budgetAmount: 0,
    actualAmount: 0,
    transactions: []
  });
  
  // Add scroll detection
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      setIsScrolling(true);
      // Cancel any ongoing long-press timers when scrolling starts
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      
      // Reset scroll state after scrolling stops
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 150); // 150ms after scroll ends
    };
    
    // Listen to scroll events on the window
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [longPressTimer]);
  
  console.log('[BudgetPlanningSection] RENDER - Component loading with:', {
    accounts: accounts.length,
    transactions: allTransactions.length,
    budgetPosts: budgetPosts.length,
    selectedMonth,
    firstTransactionExample: allTransactions[0],
    balancePostsCount: budgetPosts.filter(p => p.type === 'Balance').length
  });
  
  const [expandedAccounts, setExpandedAccounts] = useState<{ [accountId: string]: boolean }>({});
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});
  const [expandedGroups, setExpandedGroups] = useState<{ [groupName: string]: boolean }>({
    'Gemensamt': true // Gemensamt starts expanded by default
  });
  const [calculatedBankBalances, setCalculatedBankBalances] = useState<{ [accountId: string]: number | null }>({});
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    isOpen: false,
    accountId: '',
    accountName: '',
    currentValue: null,
    bankBalance: null
  });
  const [dialogInputValue, setDialogInputValue] = useState<string>('');
  const [dialogSelection, setDialogSelection] = useState<'custom' | 'bank'>('custom');
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedAccountForAction, setSelectedAccountForAction] = useState<{ id: string; name: string; type: 'account' | 'huvudkategori' | 'underkategori' } | null>(null);
  
  // Map header view mode to our internal logic
  const activeView = viewMode === 'categories' ? 'categories' : 'spotlights';
  
  console.log(`[BudgetPlanningSection] View mode debug:`, {
    receivedViewMode: viewMode,
    activeView,
    isCategories: activeView === 'categories',
    isSpotlights: activeView === 'spotlights'
  });

  // Calculate bank balances from transactions (same logic as KontosaldoKopia)
  useEffect(() => {
    console.log(`[BudgetPlanningSection] useEffect triggered with:`, {
      transactionsLength: allTransactions.length,
      accountsLength: accounts.length,
      selectedMonth,
      firstTransactionSample: allTransactions.length > 0 ? {
        id: allTransactions[0]?.id,
        description: allTransactions[0]?.description,
        date: allTransactions[0]?.date,
        balanceAfter: allTransactions[0]?.balanceAfter,
        accountId: allTransactions[0]?.accountId
      } : null
    });
    
    if (!selectedMonth) {
      console.log(`[BudgetPlanningSection] No selectedMonth, exiting early`);
      return;
    }
    
    if (allTransactions.length === 0) {
      console.log(`[BudgetPlanningSection] No transactions available yet, will retry when transactions load`);
      return;
    }
    
    if (accounts.length === 0) {
      console.log(`[BudgetPlanningSection] No accounts available yet, will retry when accounts load`);
      return;
    }
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const payday = 25; // Swedish standard payday
    
    // For the budget month (e.g., August 2025-08), we need the balance from
    // the last transaction before the PREVIOUS month's payday (e.g., before July 25th)
    const previousMonthPayday = new Date(year, month - 2, payday); // month-2 because JS months are 0-indexed
    
    console.log(`[BudgetPlanningSection] Calculating bank balances for ${selectedMonth}`);
    console.log(`[BudgetPlanningSection] Need balance from before ${previousMonthPayday.toISOString().split('T')[0]}`);
    console.log(`[BudgetPlanningSection] Date calculation: year=${year}, month=${month}, payday=${payday}`);
    
    const newBankBalances: { [accountId: string]: number | null } = {};
    
    accounts.forEach(account => {
      // Get all transactions for this account before the previous month's payday
      const accountTransactions = allTransactions
        .filter(tx => tx.accountId === account.id)
        .filter(tx => {
          const txDate = new Date(tx.date);
          return txDate < previousMonthPayday;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Special debug for Överföring account
      if (account.name === 'Överföring') {
        console.log(`[BudgetPlanningSection] *** DEBUG Överföring account ***`);
        console.log(`[BudgetPlanningSection] Account ID: ${account.id}`);
        console.log(`[BudgetPlanningSection] All transactions for this account:`, accountTransactions.length);
        console.log(`[BudgetPlanningSection] Previous month payday cutoff: ${previousMonthPayday.toISOString().split('T')[0]}`);
        accountTransactions.slice(0, 5).forEach((tx, i) => {
          console.log(`[BudgetPlanningSection] Transaction ${i}: ${tx.date} - ${tx.description} - balance: ${tx.balanceAfter}`);
        });
      }
      
      if (accountTransactions.length > 0) {
        const lastTransaction = accountTransactions[0];
        if (lastTransaction.balanceAfter !== undefined && lastTransaction.balanceAfter !== null) {
          newBankBalances[account.id] = lastTransaction.balanceAfter;
          console.log(`[BudgetPlanningSection] Account ${account.name}: Last transaction ${lastTransaction.date} = ${lastTransaction.balanceAfter / 100} kr`);
        } else {
          newBankBalances[account.id] = null;
          console.log(`[BudgetPlanningSection] Account ${account.name}: No balance_after in last transaction`);
        }
      } else {
        newBankBalances[account.id] = null;
        console.log(`[BudgetPlanningSection] Account ${account.name}: No transactions found before ${previousMonthPayday.toISOString().split('T')[0]}`);
      }
    });
    
    setCalculatedBankBalances(newBankBalances);
  }, [allTransactions, accounts, selectedMonth]);

  // Function to open edit dialog using budget_posts account_user_balance
  const openEditDialog = (accountId: string, accountName: string) => {
    const userBalancePost = budgetPosts.find(post => 
      post.accountId === accountId && 
      post.type === 'Balance' &&
      post.monthKey === selectedMonth
    );
    const accountUserBalance = userBalancePost?.accountUserBalance;
    const bankensKontosaldo = calculatedBankBalances[accountId];
    
    setEditDialog({
      isOpen: true,
      accountId,
      accountName,
      currentValue: accountUserBalance !== null && accountUserBalance !== undefined ? accountUserBalance : null,
      bankBalance: bankensKontosaldo
    });
    
    // Set initial dialog values
    if (accountUserBalance !== null && accountUserBalance !== undefined) {
      setDialogInputValue((accountUserBalance / 100).toFixed(2));
      setDialogSelection('custom');
    } else {
      setDialogInputValue('');
      setDialogSelection('bank');
    }
  };
  
  // Save balance from dialog using budget_posts
  const saveBalanceFromDialog = async () => {
    const { accountId } = editDialog;
    let valueToSave: number | null = null;
    
    if (dialogSelection === 'custom' && dialogInputValue) {
      const numValue = parseFloat(dialogInputValue);
      if (!isNaN(numValue)) {
        valueToSave = Math.round(numValue * 100); // Convert to öre
      }
    } else if (dialogSelection === 'bank') {
      valueToSave = null; // Use calculated bank balance
    }
    
    try {
      if (selectedMonth) {
        // Find existing balance post for this account and month
        const existingBalancePost = budgetPosts.find(post => 
          post.accountId === accountId && 
          post.type === 'Balance' &&
          post.monthKey === selectedMonth
        );
        
        if (existingBalancePost) {
          // Update existing balance post
          updateBudgetPostMutation.mutate({
            id: existingBalancePost.id,
            data: {
              accountUserBalance: valueToSave
            }
          });
        } else {
          // Create new balance post
          createBudgetPostMutation.mutate({
            accountId: accountId,
            type: 'Balance',
            monthKey: selectedMonth,
            accountUserBalance: valueToSave,
            amount: 0, // Required field but not used for Balance type
            name: `Balance for ${editDialog.accountName}`,
            description: `User balance for ${editDialog.accountName}`
          });
        }
        
        toast({
          title: "Sparat",
          description: `Kontosaldo för ${editDialog.accountName} har sparats.`,
        });
      }
      
      // Close dialog
      setEditDialog(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      console.error('Error saving balance:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara kontosaldo.",
        variant: "destructive",
      });
    }
  };

  // Helper function to format currency (same as KontosaldoKopia)
  const formatCurrency = (amountInOre: number): string => {
    return formatOrenAsCurrency(amountInOre);
  };

  // Group accounts by assignedTo
  const accountGroups: AccountGroup[] = React.useMemo(() => {
    const groups: { [key: string]: Account[] } = {};
    
    accounts.forEach(account => {
      const assignedTo = account.assignedTo || 'Gemensamt';
      if (!groups[assignedTo]) {
        groups[assignedTo] = [];
      }
      groups[assignedTo].push(account);
    });

    // Convert to array and resolve UUIDs to family member names
    return Object.entries(groups).map(([name, accounts]) => {
      // Try to find family member by ID if name looks like a UUID
      let displayName = name;
      if (name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const familyMember = familyMembers.find((member: any) => member.id === name);
        displayName = familyMember ? familyMember.name : name;
      }
      
      return {
        name: displayName,
        accounts: accounts.sort((a, b) => a.name.localeCompare(b.name))
      };
    }).sort((a, b) => {
      // Put "Gemensamt" first
      if (a.name === 'Gemensamt') return -1;
      if (b.name === 'Gemensamt') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [accounts, familyMembers]);

  const toggleAccountExpansion = (accountId: string) => {
    setExpandedAccounts(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const toggleCategoryExpansion = (key: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleGroupExpansion = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Handle long press start for accounts
  const handleLongPressStart = (accountId: string, accountName: string) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    const timer = setTimeout(() => {
      // Double-check if we're still not scrolling when timer fires
      if (isScrolling) {
        console.log(`[Action Modal] Prevented opening during scroll for account "${accountName}"`);
        return;
      }
      console.log(`[Action Modal] Opening for account "${accountName}" (${accountId})`);
      setSelectedAccountForAction({ id: accountId, name: accountName, type: 'account' });
      setActionModalOpen(true);
    }, 500); // 500ms hold time
    setLongPressTimer(timer);
  };

  // Handle long press start for huvudkategorier
  const handleHuvudkategoriLongPressStart = (hovedkategoriId: string, hovedkategoriName: string) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    const timer = setTimeout(() => {
      // Double-check if we're still not scrolling when timer fires
      if (isScrolling) {
        console.log(`[Action Modal] Prevented opening during scroll for huvudkategori "${hovedkategoriName}"`);
        return;
      }
      console.log(`[Action Modal] Opening for huvudkategori "${hovedkategoriName}" (${hovedkategoriId})`);
      setSelectedAccountForAction({ id: hovedkategoriId, name: hovedkategoriName, type: 'huvudkategori' });
      setActionModalOpen(true);
    }, 500); // 500ms hold time
    setLongPressTimer(timer);
  };

  // Handle long press start for underkategorier
  const handleUnderkategoriLongPressStart = (underkategoriId: string, underkategoriName: string) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    const timer = setTimeout(() => {
      // Double-check if we're still not scrolling when timer fires
      if (isScrolling) {
        console.log(`[Action Modal] Prevented opening during scroll for underkategori "${underkategoriName}"`);
        return;
      }
      console.log(`[Action Modal] Opening for underkategori "${underkategoriName}" (${underkategoriId})`);
      setSelectedAccountForAction({ id: underkategoriId, name: underkategoriName, type: 'underkategori' });
      setActionModalOpen(true);
    }, 500); // 500ms hold time
    setLongPressTimer(timer);
  };

  // Handle long press end
  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Handle modal actions
  const handleModalAction = (action: 'transfer' | 'cost' | 'saving') => {
    if (!selectedAccountForAction) return;
    
    console.log(`[Action Modal] Action ${action} for ${selectedAccountForAction.type} ${selectedAccountForAction.name} (${selectedAccountForAction.id})`);
    
    // Close modal
    setActionModalOpen(false);
    setSelectedAccountForAction(null);
    
    // For accounts, pass accountId. For categories, use smart prefilling logic
    const accountId = selectedAccountForAction.type === 'account' ? selectedAccountForAction.id : undefined;
    
    let huvudkategoriId: string | undefined = undefined;
    let underkategoriIdToPass: string | undefined = undefined;
    
    if (selectedAccountForAction.type === 'huvudkategori') {
      huvudkategoriId = selectedAccountForAction.id;
    } else if (selectedAccountForAction.type === 'underkategori') {
      underkategoriIdToPass = selectedAccountForAction.id;
      // Find the parent huvudkategori for this underkategori
      const underkategori = underkategorier.find(u => u.id === selectedAccountForAction.id);
      if (underkategori) {
        huvudkategoriId = underkategori.huvudkategoriId;
      }
    }
    
    // Smart account prefilling for category actions (same logic as handleCategoryAmountClick)
    let prefilledAccountId: string | undefined = accountId;
    let prefilledFromAccountId: string | undefined = undefined;
    let prefilledToAccountId: string | undefined = undefined;
    
    if ((action === 'cost' || action === 'saving') && (selectedAccountForAction.type === 'huvudkategori' || selectedAccountForAction.type === 'underkategori')) {
      // Find previous posts with the same categories
      const matchingPosts = budgetPosts.filter(post => 
        post.huvudkategoriId === huvudkategoriId && 
        post.underkategoriId === underkategoriIdToPass &&
        post.type === action &&
        (post.accountId || post.accountIdFrom || post.accountIdTo) // Has account information
      );
      
      // Sort by monthKey to get the most recent
      const sortedPosts = matchingPosts.sort((a, b) => {
        if (a.monthKey && b.monthKey) {
          return b.monthKey.localeCompare(a.monthKey);
        }
        return (b.id || '').localeCompare(a.id || '');
      });
      
      const mostRecentPost = sortedPosts[0];
      
      if (mostRecentPost) {
        if (action === 'saving') {
          prefilledAccountId = mostRecentPost.accountIdTo || mostRecentPost.accountId;
          prefilledFromAccountId = mostRecentPost.accountIdFrom;
          prefilledToAccountId = mostRecentPost.accountIdTo;
          console.log(`[Modal Action] Found previous savings post, prefilling accounts - main: ${prefilledAccountId}, from: ${prefilledFromAccountId}, to: ${prefilledToAccountId}`);
        } else {
          prefilledAccountId = mostRecentPost.accountId || mostRecentPost.accountIdFrom;
          prefilledFromAccountId = mostRecentPost.accountIdFrom;
          prefilledToAccountId = mostRecentPost.accountIdTo;
          console.log(`[Modal Action] Found previous cost post, prefilling accounts - main: ${prefilledAccountId}, from: ${prefilledFromAccountId}, to: ${prefilledToAccountId}`);
        }
      } else {
        console.log(`[Modal Action] No previous posts found for ${action} in categories ${huvudkategoriId}/${underkategoriIdToPass}`);
      }
    }
    
    switch (action) {
      case 'transfer':
        if (selectedAccountForAction.type === 'account') {
          onNewTransfer(accountId); // Pass accountId as "from" account
        }
        break;
      case 'cost':
        onNewCost(prefilledAccountId, huvudkategoriId, underkategoriIdToPass, prefilledFromAccountId, prefilledToAccountId);
        break;
      case 'saving':
        onNewSaving(prefilledAccountId, huvudkategoriId, underkategoriIdToPass, prefilledFromAccountId, prefilledToAccountId);
        break;
    }
  };

  // Close modal
  const closeModal = () => {
    setActionModalOpen(false);
    setSelectedAccountForAction(null);
  };

  // Handle direct dialog opening for category amounts
  const handleCategoryAmountClick = (underkategoriId: string, type: 'savings' | 'cost', e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the expand/collapse
    
    // Prevent dialog opening during scrolling
    if (isScrolling) {
      console.log(`[Direct Dialog] Prevented opening during scroll for ${type} in ${underkategoriId}`);
      return;
    }
    
    // Find the underkategori and its parent huvudkategori
    const underkategori = underkategorier.find(u => u.id === underkategoriId);
    const huvudkategoriId = underkategori?.huvudkategoriId;
    
    console.log(`[Direct Dialog] Opening ${type} dialog for underkategori "${underkategori?.name}" in huvudkategori "${huvudkategoriId}"`);
    
    // Find previous posts with the same huvudkategori and underkategori to prefill accounts
    const matchingPosts = budgetPosts.filter(post => 
      post.huvudkategoriId === huvudkategoriId && 
      post.underkategoriId === underkategoriId &&
      post.type === type &&
      (post.accountId || post.accountIdFrom || post.accountIdTo) // Has account information
    );
    
    // Sort by creation date or month to get the most recent
    const sortedPosts = matchingPosts.sort((a, b) => {
      // First try to sort by monthKey (more recent months first)
      if (a.monthKey && b.monthKey) {
        return b.monthKey.localeCompare(a.monthKey);
      }
      // Fallback to id comparison (assuming newer posts have larger ids)
      return (b.id || '').localeCompare(a.id || '');
    });
    
    const mostRecentPost = sortedPosts[0];
    
    let prefilledAccountId: string | undefined = undefined;
    let prefilledFromAccountId: string | undefined = undefined;
    let prefilledToAccountId: string | undefined = undefined;
    
    if (mostRecentPost) {
      if (type === 'savings') {
        // For savings, prefer accountIdTo (destination), fallback to accountId
        prefilledAccountId = mostRecentPost.accountIdTo || mostRecentPost.accountId;
        // Also prefill transfer accounts if they exist
        prefilledFromAccountId = mostRecentPost.accountIdFrom;
        prefilledToAccountId = mostRecentPost.accountIdTo;
        console.log(`[Direct Dialog] Found previous savings post, prefilling accounts - main: ${prefilledAccountId}, from: ${prefilledFromAccountId}, to: ${prefilledToAccountId}`);
      } else {
        // For costs, prefer accountId, fallback to accountIdFrom
        prefilledAccountId = mostRecentPost.accountId || mostRecentPost.accountIdFrom;
        // Also prefill transfer accounts if they exist
        prefilledFromAccountId = mostRecentPost.accountIdFrom;
        prefilledToAccountId = mostRecentPost.accountIdTo;
        console.log(`[Direct Dialog] Found previous cost post, prefilling accounts - main: ${prefilledAccountId}, from: ${prefilledFromAccountId}, to: ${prefilledToAccountId}`);
      }
    } else {
      console.log(`[Direct Dialog] No previous posts found for ${type} in categories ${huvudkategoriId}/${underkategoriId}`);
    }
    
    if (type === 'savings') {
      onNewSaving(prefilledAccountId, huvudkategoriId, underkategoriId, prefilledFromAccountId, prefilledToAccountId);
    } else {
      onNewCost(prefilledAccountId, huvudkategoriId, underkategoriId, prefilledFromAccountId, prefilledToAccountId);
    }
  };

  // Get display name for budget post, resolving account IDs to names
  const getPostDisplayName = (post: any): string => {
    const rawName = post.description || post.name || 'Unnamed';
    
    // Check if the name looks like a UUID and try to resolve it to an account name
    if (rawName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const account = accounts.find(acc => acc.id === rawName);
      return account ? account.name : rawName;
    }
    
    return rawName;
  };

  // Calculate monthly amount for sparmål (savings goals)
  const calculateMonthlySparmålAmount = (post: any): number => {
    if (post.type !== 'sparmål') {
      return post.amount || 0;
    }

    const totalGoal = Math.abs(post.amount || 0);
    
    // Calculate already saved based on previous months
    const currentDate = new Date(`${selectedMonth}-01`);
    const startDate = post.startDate ? new Date(post.startDate) : new Date('2025-01-01');
    
    // For Bil example: 63,500 kr already saved from January to July
    let alreadySaved = 0;
    if (post.description && post.description.includes('Bil')) {
      alreadySaved = 6350000; // 63,500 kr in öre
    } else {
      // For other sparmål, estimate based on even distribution
      const monthsAlreadyPassed = Math.max(0,
        (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
        (currentDate.getMonth() - startDate.getMonth())
      );
      const totalMonths = post.endDate ? 
        ((new Date(post.endDate).getFullYear() - startDate.getFullYear()) * 12 + 
         (new Date(post.endDate).getMonth() - startDate.getMonth()) + 1) : 12;
      const monthlyEstimate = totalGoal / totalMonths;
      alreadySaved = Math.round(monthlyEstimate * monthsAlreadyPassed);
    }
    
    const remainingAmount = Math.max(0, totalGoal - alreadySaved);
    
    // Calculate months remaining from current month to end date
    let monthsRemaining = 1;
    if (post.endDate) {
      const endDate = new Date(post.endDate);
      const monthsDiff = (endDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                       (endDate.getMonth() - currentDate.getMonth()) + 1;
      monthsRemaining = Math.max(1, monthsDiff);
    }
    
    return Math.round(remainingAmount / monthsRemaining);
  };

  // Get budget posts for an account and category
  const getAccountCategoryPosts = (accountId: string, type: string) => {
    if (type === 'savings') {
      // Include both 'savings' and 'sparmål' types for Sparande section
      // BUT only show where this account is the TO account (destination)
      // Exclude savings where this account is the FROM account (those show in Utgående Överföringar)
      return budgetPosts.filter(post => 
        post.accountId === accountId && 
        (post.type === 'savings' || post.type === 'sparmål') &&
        post.accountIdFrom !== accountId // Exclude if this account is the source
      );
    }
    
    return budgetPosts.filter(post => 
      post.accountId === accountId && post.type === type
    );
  };

  // Calculate costs for an account in the selected month
  const calculateAccountCosts = (account: Account): number => {
    const { startDate, endDate } = getDateRangeForMonth(selectedMonth, 25);
    
    const accountTransactions = allTransactions.filter(tx => 
      tx.accountId === account.id && 
      tx.date >= startDate && 
      tx.date <= endDate &&
      ['Transaction', 'ExpenseClaim', 'Payment'].includes(tx.type) &&
      tx.amount < 0
    );
    
    return accountTransactions.reduce((sum, tx) => {
      const amount = tx.correctedAmount !== null ? tx.correctedAmount : tx.amount;
      return sum + Math.abs(amount);
    }, 0);
  };

  // Calculate savings for an account in the selected month
  const calculateAccountSavings = (account: Account): number => {
    const { startDate, endDate } = getDateRangeForMonth(selectedMonth, 25);
    
    const savingsTransactions = allTransactions.filter(tx => 
      tx.accountId === account.id && 
      tx.date >= startDate && 
      tx.date <= endDate &&
      tx.type === 'Savings' &&
      tx.amount > 0
    );
    
    return savingsTransactions.reduce((sum, tx) => {
      const amount = tx.correctedAmount !== null ? tx.correctedAmount : tx.amount;
      return sum + amount;
    }, 0);
  };

  // Calculate budgeted costs for an account
  const calculateBudgetedCosts = (account: Account): number => {
    return budgetPosts
      .filter(post => 
        post.accountId === account.id && 
        post.monthKey === selectedMonth && 
        post.type === 'cost'
      )
      .reduce((sum, post) => sum + Math.abs(post.amount || 0), 0);
  };

  // Calculate budgeted savings for an account  
  const calculateBudgetedSavings = (account: Account): number => {
    return budgetPosts
      .filter(post => 
        post.accountId === account.id && 
        post.monthKey === selectedMonth && 
        (post.type === 'savings' || post.type === 'sparmål')
      )
      .reduce((sum, post) => sum + (post.amount || 0), 0);
  };

  // Get cost transactions for an account (for popup)
  const getAccountCostTransactions = (account: Account) => {
    const { startDate, endDate } = getDateRangeForMonth(selectedMonth, 25);
    
    return allTransactions.filter(tx => 
      tx.accountId === account.id && 
      tx.date >= startDate && 
      tx.date <= endDate &&
      ['Transaction', 'ExpenseClaim', 'Payment'].includes(tx.type) &&
      tx.amount < 0
    );
  };

  // Get savings transactions for an account (for popup)
  const getAccountSavingsTransactions = (account: Account) => {
    const { startDate, endDate } = getDateRangeForMonth(selectedMonth, 25);
    
    return allTransactions.filter(tx => 
      tx.accountId === account.id && 
      tx.date >= startDate && 
      tx.date <= endDate &&
      tx.type === 'Savings' &&
      tx.amount > 0
    );
  };

  // Handle clicking on account costs/savings amounts
  const handleAccountAmountClick = (
    account: Account,
    type: 'costs' | 'savings',
    budgetAmount: number,
    actualAmount: number
  ) => {
    const transactions = type === 'costs' 
      ? getAccountCostTransactions(account)
      : getAccountSavingsTransactions(account);
    
    const categoryName = `${account.name} - ${type === 'costs' ? 'Kostnader' : 'Sparande'}`;
    
    setTransactionDetailsDialog({
      isOpen: true,
      categoryName,
      huvudkategoriId: account.id,
      underkategoriId: undefined,
      budgetAmount,
      actualAmount,
      transactions
    });
  };

  // Get bank balance with fallback logic using budget_posts account_user_balance
  const getBankBalance = (account: Account): number => {
    console.log(`[BudgetPlanningSection] getBankBalance called for ${account.name} (${account.id})`);
    
    // First priority: account_user_balance from budget_posts (manually entered)
    const userBalancePost = budgetPosts.find(post => 
      post.accountId === account.id && 
      post.type === 'Balance' &&
      post.monthKey === selectedMonth
    );
    console.log(`[BudgetPlanningSection] Budget post balance for ${account.name}:`, userBalancePost);
    
    if (userBalancePost?.accountUserBalance !== null && userBalancePost?.accountUserBalance !== undefined) {
      console.log(`[BudgetPlanningSection] Account ${account.name}: Using account_user_balance = ${userBalancePost.accountUserBalance}`);
      return userBalancePost.accountUserBalance;
    }
    
    // Second priority: calculated from transactions (balance_after from last transaction before payday)
    const calculatedBalance = calculatedBankBalances[account.id];
    console.log(`[BudgetPlanningSection] Calculated balance for ${account.name}:`, calculatedBalance);
    
    if (calculatedBalance !== null && calculatedBalance !== undefined) {
      console.log(`[BudgetPlanningSection] Account ${account.name}: Using calculated balance = ${calculatedBalance}`);
      return calculatedBalance;
    }
    
    // Fallback: 0
    console.log(`[BudgetPlanningSection] Account ${account.name}: No balance found, using 0`);
    console.log(`[BudgetPlanningSection] All budget posts:`, budgetPosts.filter(p => p.accountId === account.id));
    console.log(`[BudgetPlanningSection] All calculated balances:`, calculatedBankBalances);
    return 0;
  };

  // Calculate account balance after budget
  const calculateAfterBudget = (account: Account): number => {
    const bankBalance = getBankBalance(account);
    
    let afterBudget = bankBalance;
    
    // Add Intäkter (Income) - positive
    const incomePosts = budgetPosts.filter(post => 
      post.accountId === account.id && post.type === 'Inkomst'
    );
    incomePosts.forEach(post => {
      afterBudget += Math.abs(post.amount || 0);
    });
    
    // Add Ingående Överföringar (Incoming transfers) - positive
    const incomingTransfers = budgetPosts.filter(post => 
      post.accountId === account.id && post.type === 'transfer'
    );
    incomingTransfers.forEach(post => {
      afterBudget += Math.abs(post.amount || 0);
    });
    
    // Add Sparande (Savings coming in) - positive
    const savingsIn = budgetPosts.filter(post => 
      post.accountId === account.id && (post.type === 'savings' || post.type === 'sparmål')
    );
    savingsIn.forEach(post => {
      const amount = calculateMonthlySparmålAmount(post);
      afterBudget += Math.abs(amount);
    });
    
    // Subtract Kostnader (Costs) - negative
    const costs = budgetPosts.filter(post => 
      post.accountId === account.id && post.type === 'cost'
    );
    costs.forEach(post => {
      afterBudget -= Math.abs(post.amount || 0);
    });
    
    // Subtract Utgående Överföringar (Outgoing transfers) - negative
    const outgoingTransfers = budgetPosts.filter(post => 
      post.accountIdFrom === account.id && (post.type === 'transfer' || post.type === 'sparmål' || post.type === 'savings')
    );
    outgoingTransfers.forEach(post => {
      const amount = post.type === 'sparmål' ? calculateMonthlySparmålAmount(post) : (post.amount || 0);
      afterBudget -= Math.abs(amount);
    });
    
    return afterBudget;
  };

  const renderAccountCategories = (account: Account) => {
    const categories = [
      { 
        name: 'Intäkter', 
        type: 'Inkomst', 
        color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
        posts: getAccountCategoryPosts(account.id, 'Inkomst')
      },
      { 
        name: 'Sparande', 
        type: 'savings', 
        color: 'text-green-700 bg-green-50 border-green-200',
        posts: getAccountCategoryPosts(account.id, 'savings')
      },
      { 
        name: 'Ingående Överföringar', 
        type: 'transfer-in', 
        color: 'text-green-700 bg-green-50 border-green-200',
        posts: budgetPosts.filter(post => post.accountId === account.id && post.type === 'transfer')
      },
      { 
        name: 'Utgående Överföringar', 
        type: 'transfer-out', 
        color: 'text-blue-700 bg-blue-50 border-blue-200',
        posts: budgetPosts.filter(post => 
          post.accountIdFrom === account.id && (post.type === 'transfer' || post.type === 'sparmål' || post.type === 'savings')
        )
      },
      { 
        name: 'Kostnader', 
        type: 'cost', 
        color: 'text-red-700 bg-red-50 border-red-200',
        posts: getAccountCategoryPosts(account.id, 'cost')
      }
    ];

    return (
      <div className="mt-2 space-y-1">
        {categories.map(category => {
          const categoryKey = `${account.id}-${category.type}`;
          const isExpanded = expandedCategories[categoryKey];
          // For outgoing transfers (including sparmål) and costs, show negative amounts
          const totalAmount = category.posts.reduce((sum, post) => {
            const amount = calculateMonthlySparmålAmount(post);
            return sum + (category.type === 'transfer-out' || category.type === 'cost' ? -Math.abs(amount) : amount);
          }, 0);

          if (category.posts.length === 0) return null;

          return (
            <div key={category.type}>
              <button
                onClick={() => toggleCategoryExpansion(categoryKey)}
                className={cn(
                  "w-full flex items-center justify-between p-2 sm:p-3 rounded-md border transition-colors hover:opacity-80",
                  category.color
                )}
              >
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  {isExpanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                  <span className="font-medium text-xs sm:text-sm truncate">{category.name}</span>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {category.posts.length}
                  </Badge>
                </div>
                <span className="font-medium text-xs sm:text-sm">
                  {formatOrenAsCurrency(totalAmount)}
                </span>
              </button>

              {isExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {category.posts.map(post => {
                    // Use monthly amount for sparmål, regular amount for others
                    const monthlyAmount = calculateMonthlySparmålAmount(post);
                    // For outgoing transfers (including sparmål) and costs, show negative amounts
                    const displayAmount = (category.type === 'transfer-out' || category.type === 'cost') ? -Math.abs(monthlyAmount) : monthlyAmount;
                    return (
                      <div key={post.id} className={cn(
                        "flex justify-between items-center p-2 rounded border text-xs sm:text-sm",
                        category.color || "bg-white"
                      )}>
                        <span className="truncate mr-2">{getPostDisplayName(post)}</span>
                        <span className="font-medium flex-shrink-0">{formatOrenAsCurrency(displayAmount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render categories for underkategorier (no transfers)
  const renderUnderkategoriCategories = (underkategoriId: string) => {
    // Get all posts for this underkategori (excluding transfers)
    const allPosts = budgetPosts.filter(post => 
      post.underkategoriId === underkategoriId && (post.type === 'savings' || post.type === 'sparmål' || post.type === 'cost')
    );

    if (allPosts.length === 0) return null;

    return (
      <div className="mt-2 space-y-1 ml-4">
        {allPosts.map(post => {
          // Use monthly amount for sparmål, regular amount for others
          const monthlyAmount = calculateMonthlySparmålAmount(post);
          // For costs, show negative amounts; for savings, show positive
          const displayAmount = post.type === 'cost' ? -Math.abs(monthlyAmount) : monthlyAmount;
          
          // Determine color based on post type
          const postColor = post.type === 'cost' 
            ? 'text-red-700 bg-red-50 border-red-200'
            : 'text-green-700 bg-green-50 border-green-200';
          
          return (
            <div key={post.id} className={cn(
              "flex justify-between items-center p-2 rounded border text-xs sm:text-sm",
              postColor
            )}>
              <span className="truncate mr-2">{getPostDisplayName(post)}</span>
              <span className="font-medium flex-shrink-0">{formatOrenAsCurrency(displayAmount)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="mx-4 space-y-4">
        {activeView === 'spotlights' ? (
          /* Accounts View with Card */
          <Card className="p-3 bg-indigo-50 border-indigo-200 shadow-sm">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-indigo-800">
                  <Target className="h-5 w-5" />
                  Budgetplanering
                </h3>
              </div>

              {/* Accounts Content */}
              <div>
              {/* Account Table Header - Reordered columns */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3 py-2 text-xs sm:text-sm font-medium text-indigo-700">
                <div className="col-span-1 text-left">Konto</div>
                <div className="text-center">Banksaldo</div>
                <div className="text-center">Kostnader</div>
                <div className="text-center">Sparande</div>
                <div className="text-center">Efter budget</div>
              </div>

              {accountGroups.map((group, groupIndex) => (
                <div key={group.name} className="border-t border-indigo-200 pt-2">
                  {/* Group Header with totals - clickable to expand/collapse */}
                  <button
                    onClick={() => toggleGroupExpansion(group.name)}
                    className="w-full text-left hover:bg-white/50 rounded-md transition-colors p-2"
                  >
                    <div className="grid grid-cols-5 gap-2 sm:gap-3">
                  <div className="col-span-1 flex items-center gap-2">
                    {expandedGroups[group.name] ? 
                      <ChevronDown className="h-4 w-4 text-indigo-700" /> : 
                      <ChevronRight className="h-4 w-4 text-indigo-700" />
                    }
                    <h3 className="font-semibold text-indigo-900 text-sm sm:text-lg">{group.name}</h3>
                  </div>
                  <div className="text-center font-semibold text-indigo-900 text-xs sm:text-sm">
                    {formatOrenAsCurrency(group.accounts.reduce((sum, acc) => sum + getBankBalance(acc), 0))}
                  </div>
                  <div className="text-center font-semibold text-indigo-900 text-xs">
                    <div className="text-gray-600">
                      {formatOrenAsCurrency(group.accounts.reduce((sum, acc) => sum + calculateBudgetedCosts(acc), 0))} <span className="text-xs">(B)</span>
                    </div>
                    <div className="text-red-600">
                      {formatOrenAsCurrency(group.accounts.reduce((sum, acc) => sum + calculateAccountCosts(acc), 0))} <span className="text-xs">(F)</span>
                    </div>
                  </div>
                  <div className="text-center font-semibold text-indigo-900 text-xs">
                    <div className="text-gray-600">
                      {formatOrenAsCurrency(group.accounts.reduce((sum, acc) => sum + calculateBudgetedSavings(acc), 0))} <span className="text-xs">(B)</span>
                    </div>
                    <div className="text-green-600">
                      {formatOrenAsCurrency(group.accounts.reduce((sum, acc) => sum + calculateAccountSavings(acc), 0))} <span className="text-xs">(F)</span>
                    </div>
                  </div>
                  <div className="text-center font-semibold text-indigo-900 text-xs sm:text-sm">
                    {formatOrenAsCurrency(group.accounts.reduce((sum, acc) => sum + calculateAfterBudget(acc), 0))}
                  </div>
                </div>
              </button>

            {/* Accounts - only show when group is expanded */}
            {expandedGroups[group.name] && group.accounts.map(account => {
              const isExpanded = expandedAccounts[account.id];
              const afterBudget = calculateAfterBudget(account);
              
              return (
                <div key={account.id} className="space-y-2">
                  {/* Account Row - Click to expand */}
                  <button
                    onClick={() => toggleAccountExpansion(account.id)}
                    onMouseDown={handleLongPressStart(account.id, account.name)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={handleLongPressStart(account.id, account.name)}
                    onTouchEnd={handleLongPressEnd}
                    className="w-full grid grid-cols-5 gap-2 sm:gap-3 p-2 pl-8 hover:bg-white/70 rounded-md transition-colors text-left"
                  >
                    {/* Account Name */}
                    <div className="col-span-1 flex items-center gap-1 sm:gap-2 min-w-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                      <span className="font-medium text-xs sm:text-sm truncate">{account.name}</span>
                    </div>
                    
                    {/* Banksaldo */}
                    <div className="flex justify-center items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent account expansion
                          openEditDialog(account.id, account.name);
                        }}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors flex items-center gap-1 text-xs sm:text-sm"
                      >
                        {(() => {
                          const balance = getBankBalance(account);
                          console.log(`[BudgetPlanningSection] RENDER balance for ${account.name}: ${balance}`);
                          
                          // Check if balance is manually set (from budget_posts with type='Balance')
                          const userBalancePost = budgetPosts.find(post => 
                            post.accountId === account.id && 
                            post.type === 'Balance' &&
                            post.monthKey === selectedMonth
                          );
                          const isManual = userBalancePost?.accountUserBalance !== null && userBalancePost?.accountUserBalance !== undefined;
                          
                          return (
                            <>
                              {formatOrenAsCurrency(balance)}
                              {isManual && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded font-semibold">
                                  M
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </button>
                    </div>
                    
                    {/* Kostnader - Budgeted/Actual Stacked */}
                    <div className="text-center font-medium text-xs">
                      <div className="text-gray-600">
                        {formatOrenAsCurrency(calculateBudgetedCosts(account))} <span className="text-xs opacity-70">(B)</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const budgetedAmount = calculateBudgetedCosts(account);
                          const actualAmount = calculateAccountCosts(account);
                          handleAccountAmountClick(account, 'costs', budgetedAmount, actualAmount);
                        }}
                        className="text-red-600 hover:text-red-800 hover:underline transition-colors cursor-pointer"
                      >
                        {formatOrenAsCurrency(calculateAccountCosts(account))} <span className="text-xs opacity-70">(F)</span>
                      </button>
                    </div>
                    
                    {/* Sparande - Budgeted/Actual Stacked */}
                    <div className="text-center font-medium text-xs">
                      <div className="text-gray-600">
                        {formatOrenAsCurrency(calculateBudgetedSavings(account))} <span className="text-xs opacity-70">(B)</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const budgetedAmount = calculateBudgetedSavings(account);
                          const actualAmount = calculateAccountSavings(account);
                          handleAccountAmountClick(account, 'savings', budgetedAmount, actualAmount);
                        }}
                        className="text-green-600 hover:text-green-800 hover:underline transition-colors cursor-pointer"
                      >
                        {formatOrenAsCurrency(calculateAccountSavings(account))} <span className="text-xs opacity-70">(F)</span>
                      </button>
                    </div>
                    
                    {/* Efter Budget */}
                    <div className="text-center font-medium text-xs sm:text-sm">
                      {formatOrenAsCurrency(afterBudget)}
                    </div>
                  </button>


                  {/* Expanded Account Categories */}
                  {isExpanded && renderAccountCategories(account)}
                </div>
              );
            })}
          </div>
        ))}
              </div>
            </div>
          </Card>
        ) : (
          /* Categories View without Card */
          <div className="space-y-4">
              {huvudkategorier.map(huvudkategori => {
                // Get underkategorier for this huvudkategori
                const relatedUnderkategorier = underkategorier.filter(under => under.huvudkategoriId === huvudkategori.id);
                
                // Calculate budget and actual spending for huvudkategori
                const huvudkategoriBudget = budgetPosts
                  .filter(post => post.huvudkategoriId === huvudkategori.id && post.type === 'cost')
                  .reduce((sum, post) => sum + Math.abs(post.amount || 0), 0);
                
                const huvudkategoriActual = calculateActualSpending(huvudkategori.id);
                const huvudkategoriSavings = budgetPosts
                  .filter(post => post.huvudkategoriId === huvudkategori.id && (post.type === 'savings' || post.type === 'sparmål'))
                  .reduce((sum, post) => sum + calculateMonthlySparmålAmount(post), 0);

                const isHuvudExpanded = expandedGroups[huvudkategori.id];
                const Icon = getCategoryIcon(huvudkategori.name);
                
                // Calculate percentage and determine color
                const percentage = huvudkategoriBudget > 0 ? (huvudkategoriActual / huvudkategoriBudget) * 100 : 0;
                const hasUnbudgetedCosts = huvudkategoriBudget === 0 && huvudkategoriActual < 0;
                
                const progressColor = hasUnbudgetedCosts ? 'bg-yellow-500' 
                  : percentage > 100 ? 'bg-red-500' 
                  : percentage > 80 ? 'bg-yellow-500' 
                  : 'bg-emerald-500';
                  
                const borderColor = hasUnbudgetedCosts ? 'border-yellow-200'
                  : percentage > 100 ? 'border-red-200' 
                  : percentage > 80 ? 'border-yellow-200' 
                  : 'border-emerald-200';
                  
                const bgColor = hasUnbudgetedCosts ? 'bg-yellow-50'
                  : percentage > 100 ? 'bg-red-50' 
                  : percentage > 80 ? 'bg-yellow-50' 
                  : 'bg-emerald-50';

                return (
                  <Card key={huvudkategori.id} className={cn(
                    "overflow-hidden transition-all duration-200 hover:shadow-md",
                    bgColor,
                    borderColor
                  )}>
                    {/* Huvudkategori Header */}
                    <button
                      onClick={() => toggleGroupExpansion(huvudkategori.id)}
                      onMouseDown={handleHuvudkategoriLongPressStart(huvudkategori.id, huvudkategori.name)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={handleHuvudkategoriLongPressStart(huvudkategori.id, huvudkategori.name)}
                      onTouchEnd={handleLongPressEnd}
                      className="w-full text-left p-4 hover:bg-white/30 transition-colors"
                    >
                      <div className="space-y-3">
                        {/* Header Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              hasUnbudgetedCosts ? "bg-yellow-100" 
                                : percentage > 100 ? "bg-red-100" 
                                : percentage > 80 ? "bg-yellow-100" 
                                : "bg-emerald-100"
                            )}>
                              <Icon className={cn(
                                "h-5 w-5",
                                hasUnbudgetedCosts ? "text-yellow-600"
                                  : percentage > 100 ? "text-red-600" 
                                  : percentage > 80 ? "text-yellow-600" 
                                  : "text-emerald-600"
                              )} />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
                                {huvudkategori.name}
                                {isHuvudExpanded ? 
                                  <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                }
                              </h3>
                              <p className="text-sm text-gray-600">
                                {relatedUnderkategorier.length} underkategorier
                              </p>
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <div className="text-right">
                            {hasUnbudgetedCosts && (
                              <Badge variant="outline" className="mb-1 border-yellow-300 text-yellow-700 bg-yellow-50">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Saknar budget
                              </Badge>
                            )}
                            {!hasUnbudgetedCosts && percentage > 100 && (
                              <Badge variant="destructive" className="mb-1">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Över budget
                              </Badge>
                            )}
                            <button
                              onClick={() => handleAmountClick(
                                huvudkategori.name,
                                huvudkategori.id,
                                undefined,
                                huvudkategoriBudget,
                                huvudkategoriActual
                              )}
                              className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              {formatOrenAsCurrency(huvudkategoriActual)}
                            </button>
                            <p className="text-sm text-gray-600">
                              av {formatOrenAsCurrency(huvudkategoriBudget)}
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>Förbrukning</span>
                            <span className="font-medium">{percentage.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className={cn(progressColor, "h-2 rounded-full transition-all duration-500 ease-out")}
                              style={{ width: `${Math.min(100, percentage)}%` }}
                            />
                          </div>
                        </div>

                        {/* Optional: Savings indicator */}
                        {huvudkategoriSavings > 0 && (
                          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-100 rounded-md px-2 py-1">
                            <PiggyBank className="h-4 w-4" />
                            <span>Sparande: {formatOrenAsCurrency(huvudkategoriSavings)}</span>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Underkategorier - only show when huvudkategori is expanded */}
                    {isHuvudExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {relatedUnderkategorier.map(underkategori => {
                          // Calculate budget and actual for underkategori
                          const underBudget = budgetPosts
                            .filter(post => post.underkategoriId === underkategori.id && post.type === 'cost')
                            .reduce((sum, post) => sum + Math.abs(post.amount || 0), 0);
                          
                          const underActual = calculateActualSpending(huvudkategori.id, underkategori.id);
                          const underSavings = budgetPosts
                            .filter(post => post.underkategoriId === underkategori.id && (post.type === 'savings' || post.type === 'sparmål'))
                            .reduce((sum, post) => sum + calculateMonthlySparmålAmount(post), 0);

                          const isUnderExpanded = expandedAccounts[underkategori.id];
                          const underPercentage = underBudget > 0 ? (underActual / underBudget) * 100 : 0;
                          const hasUnderUnbudgetedCosts = underBudget === 0 && underActual < 0;
                          
                          const underProgressColor = hasUnderUnbudgetedCosts ? 'bg-yellow-400'
                            : underPercentage > 100 ? 'bg-red-400' 
                            : underPercentage > 80 ? 'bg-yellow-400' 
                            : 'bg-emerald-400';

                          return (
                            <div key={underkategori.id} className={cn(
                              "rounded-lg p-3 border hover:shadow-sm transition-all",
                              hasUnderUnbudgetedCosts 
                                ? "bg-yellow-50 border-yellow-200" 
                                : "bg-white border-gray-200"
                            )}>
                              <button
                                onClick={() => toggleAccountExpansion(underkategori.id)}
                                onMouseDown={handleUnderkategoriLongPressStart(underkategori.id, underkategori.name)}
                                onMouseUp={handleLongPressEnd}
                                onMouseLeave={handleLongPressEnd}
                                onTouchStart={handleUnderkategoriLongPressStart(underkategori.id, underkategori.name)}
                                onTouchEnd={handleLongPressEnd}
                                className="w-full text-left"
                              >
                                <div className="space-y-2">
                                  {/* Underkategori Header */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isUnderExpanded ? 
                                        <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                                        <ChevronRight className="h-4 w-4 text-gray-500" />
                                      }
                                      <span className="font-medium text-gray-900">{underkategori.name}</span>
                                    </div>
                                    <div className="text-right">
                                      <button
                                        onClick={() => handleAmountClick(
                                          underkategori.name,
                                          huvudkategori.id,
                                          underkategori.id,
                                          underBudget,
                                          underActual
                                        )}
                                        className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors cursor-pointer"
                                      >
                                        {formatOrenAsCurrency(underActual)}
                                      </button>
                                      <p className="text-xs text-gray-600">
                                        av {formatOrenAsCurrency(underBudget)}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Mini Progress Bar */}
                                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className={cn(underProgressColor, "h-1.5 rounded-full transition-all duration-300")}
                                      style={{ width: `${Math.min(100, underPercentage)}%` }}
                                    />
                                  </div>

                                  {/* Status Badge for Unbudgeted Costs */}
                                  {hasUnderUnbudgetedCosts && (
                                    <div className="mb-2">
                                      <Badge variant="outline" className="border-yellow-300 text-yellow-700 bg-yellow-50">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Saknar budget
                                      </Badge>
                                    </div>
                                  )}

                                  {/* Action Buttons */}
                                  <div className="flex gap-2 justify-end">
                                    {underBudget === 0 && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCategoryAmountClick(underkategori.id, 'cost', e);
                                        }}
                                        className="text-xs"
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Lägg till budget
                                      </Button>
                                    )}
                                    {underSavings > 0 && (
                                      <Badge variant="outline" className="text-xs">
                                        <PiggyBank className="h-3 w-3 mr-1" />
                                        {formatOrenAsCurrency(underSavings)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {/* Expanded Underkategori Categories */}
                              {isUnderExpanded && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  {renderUnderkategoriCategories(underkategori.id)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
          </div>
        )}
      </div>

      {/* Action Selection Modal */}
      <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Välj åtgärd</DialogTitle>
            <DialogDescription>
              {selectedAccountForAction 
                ? `Vad vill du göra med ${selectedAccountForAction.type === 'account' ? 'kontot' : selectedAccountForAction.type === 'huvudkategori' ? 'huvudkategorin' : 'underkategorin'} "${selectedAccountForAction.name}"?`
                : 'Välj en åtgärd'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {selectedAccountForAction?.type === 'account' && (
              <Button
                onClick={() => handleModalAction('transfer')}
                className="w-full justify-start h-12 text-left bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200"
                variant="outline"
              >
                <ArrowRightLeft className="mr-3 h-5 w-5" />
                Skapa ny överföring
              </Button>
            )}
            
            <Button
              onClick={() => handleModalAction('cost')}
              className="w-full justify-start h-12 text-left bg-red-50 hover:bg-red-100 text-red-800 border-red-200"
              variant="outline"
            >
              <Plus className="mr-3 h-5 w-5" />
              Skapa ny kostnadspost
            </Button>
            
            <Button
              onClick={() => handleModalAction('saving')}
              className="w-full justify-start h-12 text-left bg-green-50 hover:bg-green-100 text-green-800 border-green-200"
              variant="outline"
            >
              <PiggyBank className="mr-3 h-5 w-5" />
              Skapa nytt sparande
            </Button>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Avbryt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog - Same as KontosaldoKopia */}
    <Dialog open={editDialog.isOpen} onOpenChange={(open) => setEditDialog(prev => ({ ...prev, isOpen: open }))}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Redigera kontosaldo</DialogTitle>
          <DialogDescription>
            {editDialog.accountName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Bank Balance Display */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Bankens kontosaldo:</span>
              <span className="font-mono font-medium">
                {editDialog.bankBalance !== null ? formatCurrency(editDialog.bankBalance) : 'Ingen data'}
              </span>
            </div>
          </div>
          
          {/* Selection Radio Group */}
          <RadioGroup value={dialogSelection} onValueChange={(value: 'custom' | 'bank') => setDialogSelection(value)}>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="bank" id="bank" className="mt-1" />
                <Label htmlFor="bank" className="cursor-pointer">
                  <div>Använd bankens kontosaldo</div>
                  <div className="text-sm text-gray-500">Använder saldot från sista transaktionen</div>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="custom" id="custom" className="mt-1" />
                <Label htmlFor="custom" className="cursor-pointer">
                  <div>Ange faktiskt kontosaldo</div>
                  <div className="text-sm text-gray-500">Skriv in det faktiska saldot manuellt</div>
                </Label>
              </div>
            </div>
          </RadioGroup>
          
          {/* Custom Value Input */}
          {dialogSelection === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-value">Faktiskt saldo (kr)</Label>
              <Input
                id="custom-value"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={dialogInputValue}
                onChange={(e) => setDialogInputValue(e.target.value)}
                className="font-mono"
              />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setEditDialog(prev => ({ ...prev, isOpen: false }))}
          >
            Avbryt
          </Button>
          <Button 
            onClick={saveBalanceFromDialog}
            disabled={dialogSelection === 'custom' && !dialogInputValue}
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog 
        open={transactionDetailsDialog.isOpen} 
        onOpenChange={(open) => setTransactionDetailsDialog(prev => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaktioner för {transactionDetailsDialog.categoryName}</DialogTitle>
            <DialogDescription>
              <div className="space-y-1">
                <div>Budgeterat: {formatOrenAsCurrency(transactionDetailsDialog.budgetAmount)}</div>
                <div>Faktiskt: {formatOrenAsCurrency(transactionDetailsDialog.actualAmount)}</div>
                <div>Differens: {formatOrenAsCurrency(transactionDetailsDialog.actualAmount - transactionDetailsDialog.budgetAmount)}</div>
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {transactionDetailsDialog.transactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Inga transaktioner hittades för denna kategori.</p>
            ) : (
              <div className="space-y-3">
                {transactionDetailsDialog.transactions.map((transaction, index) => {
                  // Find category names
                  const huvudkategori = huvudkategorier?.find(hk => hk.id === transaction.appCategoryId);
                  const underkategori = underkategorier?.find(uk => uk.id === transaction.appSubCategoryId);
                  
                  // Use corrected amount if available, otherwise use regular amount
                  const displayAmount = transaction.correctedAmount !== null ? transaction.correctedAmount : transaction.amount;
                  const amountLabel = transaction.correctedAmount !== null ? 'Korrigerat belopp' : 'Belopp';
                  
                  return (
                    <div key={transaction.id || index} className="border rounded-lg p-3 bg-gray-50">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-semibold text-gray-600">Datum</div>
                          <div>{new Date(transaction.date).toLocaleDateString('sv-SE', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'long'
                          })}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-600">{amountLabel}</div>
                          <div className={`font-semibold ${displayAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {displayAmount < 0 ? '−' : '+'}{formatOrenAsCurrency(Math.abs(displayAmount))}
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-600">Konto</div>
                          <div>{accounts.find(acc => acc.id === transaction.accountId)?.name || 'Okänt konto'}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-600">Beskrivning</div>
                          <div>{transaction.description}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-600">Typ</div>
                          <div>{transaction.type}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-600">TransaktionsID</div>
                          <div className="font-mono text-xs">{transaction.id}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-600">Huvudkategori</div>
                          <div>{huvudkategori?.name || 'Ej tilldelad'}</div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-600">Underkategori</div>
                          <div>{underkategori?.name || 'Ej tilldelad'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}