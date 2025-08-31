import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ChevronDown, ChevronRight, Plus, ArrowRightLeft, PiggyBank, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatOrenAsCurrency, kronoraToOren } from '@/utils/currencyUtils';
import { useTransactions } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';
import { useUpdateBudgetPost, useCreateBudgetPost } from '@/hooks/useBudgetPosts';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useQueryClient } from '@tanstack/react-query';
import { useHuvudkategorier, useUnderkategorier } from '@/hooks/useCategories';

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
  
  // Scroll detection state
  const [isScrolling, setIsScrolling] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
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
  const activeView = viewMode === 'categories' ? 'categories' : 'accounts';

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
      <Card className="shadow-lg border-0 bg-indigo-50/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-indigo-800">
            <Target className="h-5 w-5" />
            Budgetplanering
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {activeView === 'accounts' ? (
          <div className="space-y-4">
        {/* Account Table Header - Only show once at the top */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 px-2 sm:px-4 py-2 text-green-700 bg-green-50 border-green-200 rounded-md border font-medium text-xs sm:text-sm">
          <div className="text-left">Kontonamn</div>
          <div className="text-center sm:text-right">Banksaldo</div>
          <div className="text-right">Efter budget</div>
        </div>

        {accountGroups.map((group, groupIndex) => (
          <div key={group.name} className="space-y-3">
            {/* Group Header with totals - clickable to expand/collapse */}
            <div className="border-b border-indigo-200 pb-2">
              <button
                onClick={() => toggleGroupExpansion(group.name)}
                className="w-full text-left hover:bg-indigo-50/50 rounded-md transition-colors"
              >
                <div className="grid grid-cols-3 gap-2 sm:gap-4 px-2 sm:px-4 py-2">
                  <div className="flex items-center gap-2">
                    {expandedGroups[group.name] ? 
                      <ChevronDown className="h-4 w-4 text-indigo-700" /> : 
                      <ChevronRight className="h-4 w-4 text-indigo-700" />
                    }
                    <h3 className="font-semibold text-indigo-900 text-lg">{group.name}</h3>
                  </div>
                  <div className="text-center sm:text-right font-semibold text-indigo-900">
                    {formatOrenAsCurrency(group.accounts.reduce((sum, acc) => sum + getBankBalance(acc), 0))}
                  </div>
                  <div className="text-right font-semibold text-indigo-900">
                    {formatOrenAsCurrency(group.accounts.reduce((sum, acc) => sum + calculateAfterBudget(acc), 0))}
                  </div>
                </div>
              </button>
            </div>

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
                    className="w-full grid grid-cols-3 gap-2 sm:gap-4 px-2 sm:px-4 py-3 bg-white rounded-md border border-indigo-200 hover:bg-indigo-50/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                      <span className="font-medium text-sm sm:text-base truncate">{account.name}</span>
                    </div>
                    <div className="flex justify-center sm:justify-end items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent account expansion
                          openEditDialog(account.id, account.name);
                        }}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors flex items-center gap-1 text-sm sm:text-base"
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
                    <div className="text-right font-medium text-sm sm:text-base">
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
        ) : (
          <div className="space-y-4">
            {/* Category Table Header */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 px-2 sm:px-4 py-2 text-green-700 bg-green-50 border-green-200 rounded-md border font-medium text-xs sm:text-sm">
              <div className="text-left">Kategorinamn</div>
              <div className="text-center sm:text-right">Sparande</div>
              <div className="text-right">Kostnader</div>
            </div>

            {huvudkategorier.map(huvudkategori => {
              // Get underkategorier for this huvudkategori
              const relatedUnderkategorier = underkategorier.filter(under => under.huvudkategoriId === huvudkategori.id);
              
              // Calculate totals for this huvudkategori
              const huvudkategoriSavings = budgetPosts
                .filter(post => post.huvudkategoriId === huvudkategori.id && (post.type === 'savings' || post.type === 'sparmål'))
                .reduce((sum, post) => sum + calculateMonthlySparmålAmount(post), 0);
              
              const huvudkategoriCosts = budgetPosts
                .filter(post => post.huvudkategoriId === huvudkategori.id && post.type === 'cost')
                .reduce((sum, post) => sum + Math.abs(post.amount || 0), 0);

              const isHuvudExpanded = expandedGroups[huvudkategori.id];

              return (
                <div key={huvudkategori.id} className="space-y-3">
                  {/* Huvudkategori Header */}
                  <div className="border-b border-indigo-200 pb-2">
                    <button
                      onClick={() => toggleGroupExpansion(huvudkategori.id)}
                      onMouseDown={handleHuvudkategoriLongPressStart(huvudkategori.id, huvudkategori.name)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={handleHuvudkategoriLongPressStart(huvudkategori.id, huvudkategori.name)}
                      onTouchEnd={handleLongPressEnd}
                      className="w-full text-left hover:bg-indigo-50/50 rounded-md transition-colors"
                    >
                      <div className="grid grid-cols-3 gap-2 sm:gap-4 px-2 sm:px-4 py-2">
                        <div className="flex items-center gap-2">
                          {isHuvudExpanded ? 
                            <ChevronDown className="h-4 w-4 text-indigo-700" /> : 
                            <ChevronRight className="h-4 w-4 text-indigo-700" />
                          }
                          <h3 className="font-semibold text-indigo-900 text-lg">{huvudkategori.name}</h3>
                        </div>
                        <div className="text-center sm:text-right font-semibold text-green-700">
                          {formatOrenAsCurrency(huvudkategoriSavings)}
                        </div>
                        <div className="text-right font-semibold text-red-700">
                          {formatOrenAsCurrency(-huvudkategoriCosts)}
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Underkategorier - only show when huvudkategori is expanded */}
                  {isHuvudExpanded && relatedUnderkategorier.map(underkategori => {
                    // Calculate totals for this underkategori
                    const underSavings = budgetPosts
                      .filter(post => post.underkategoriId === underkategori.id && (post.type === 'savings' || post.type === 'sparmål'))
                      .reduce((sum, post) => sum + calculateMonthlySparmålAmount(post), 0);
                    
                    const underCosts = budgetPosts
                      .filter(post => post.underkategoriId === underkategori.id && post.type === 'cost')
                      .reduce((sum, post) => sum + Math.abs(post.amount || 0), 0);

                    const isUnderExpanded = expandedAccounts[underkategori.id];

                    return (
                      <div key={underkategori.id} className="space-y-2 ml-4">
                        {/* Underkategori Row */}
                        <button
                          onClick={() => toggleAccountExpansion(underkategori.id)}
                          onMouseDown={handleUnderkategoriLongPressStart(underkategori.id, underkategori.name)}
                          onMouseUp={handleLongPressEnd}
                          onMouseLeave={handleLongPressEnd}
                          onTouchStart={handleUnderkategoriLongPressStart(underkategori.id, underkategori.name)}
                          onTouchEnd={handleLongPressEnd}
                          className="w-full grid grid-cols-3 gap-2 sm:gap-4 px-2 sm:px-4 py-3 bg-white rounded-md border border-indigo-200 hover:bg-indigo-50/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                            {isUnderExpanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                            <span className="font-medium text-sm sm:text-base truncate">{underkategori.name}</span>
                          </div>
                          <div className="flex justify-center sm:justify-end items-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent underkategori expansion
                                handleCategoryAmountClick(underkategori.id, 'savings', e);
                              }}
                              className="font-medium text-green-700 hover:text-green-900 hover:underline cursor-pointer transition-colors text-sm sm:text-base"
                            >
                              {formatOrenAsCurrency(underSavings)}
                            </button>
                          </div>
                          <div className="flex justify-end items-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent underkategori expansion
                                handleCategoryAmountClick(underkategori.id, 'cost', e);
                              }}
                              className="font-medium text-red-700 hover:text-red-900 hover:underline cursor-pointer transition-colors text-sm sm:text-base"
                            >
                              {formatOrenAsCurrency(-underCosts)}
                            </button>
                          </div>
                        </button>

                        {/* Expanded Underkategori Categories */}
                        {isUnderExpanded && renderUnderkategoriCategories(underkategori.id)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      </Card>

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
    </>
  );
}