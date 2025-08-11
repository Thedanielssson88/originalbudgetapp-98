import { useState, useMemo } from 'react';
import { Plus, Target, TrendingUp, ChevronLeft, ChevronRight, Edit, Trash2, Wallet, ArrowUp, ArrowDown, Banknote, CheckCircle, RotateCcw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useBudget } from '../hooks/useBudget';
import { useAccounts } from '../hooks/useAccounts';
import { useTransactions } from '../hooks/useTransactions';
// Removed useMonthlyAccountBalances - now using budgetPosts with type='Balance' to match KontosaldoKopia
import { useHuvudkategorier, useUnderkategorier } from '../hooks/useCategories';
import { useCreateBudgetPost, useBudgetPosts, useUpdateBudgetPost, useDeleteBudgetPost } from '../hooks/useBudgetPosts';
import { createSavingsGoal, updateSelectedBudgetMonth } from '../orchestrator/budgetOrchestrator';
import { SavingsGoal } from '../types/budget';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { formatOrenAsCurrency } from '../utils/currencyUtils';

export function SavingsGoalsPage() {
  const { budgetState, isLoading } = useBudget();
  const { data: accountsFromAPI = [], isLoading: accountsLoading } = useAccounts();
  const { data: transactionsFromAPI = [] } = useTransactions();
  // Note: We now use budgetPosts with type='Balance' instead of monthlyBalances to match KontosaldoKopia
  const { data: huvudkategorier = [], isLoading: isLoadingHuvud } = useHuvudkategorier();
  const { data: underkategorier = [], isLoading: isLoadingUnder } = useUnderkategorier();
  const { data: budgetPostsFromAPI = [], isLoading: isLoadingBudgetPosts } = useBudgetPosts(budgetState.selectedMonthKey);
  const createBudgetPostMutation = useCreateBudgetPost();
  const updateBudgetPostMutation = useUpdateBudgetPost();
  const deleteBudgetPostMutation = useDeleteBudgetPost();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [formData, setFormData] = useState({
    huvudkategoriId: '',
    underkategoriId: '',
    name: '',
    accountId: '',
    targetAmount: '',
    startDate: '',
    endDate: ''
  });

  // Month navigation functions
  const navigateToPreviousMonth = () => {
    const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    updateSelectedBudgetMonth(prevMonthKey);
  };

  const navigateToNextMonth = () => {
    const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    updateSelectedBudgetMonth(nextMonthKey);
  };

  const handleBudgetMonthChange = (value: string) => {
    updateSelectedBudgetMonth(value);
  };

  // Calculate opening balance for an account - use same logic as KontosaldoKopia
  const getOpeningBalance = (accountId: string): number => {
    // Find the Balance type budget post for this account (same as KontosaldoKopia)
    const balancePost = budgetPostsFromAPI.find(post => 
      post.type === 'Balance' && post.accountId === accountId
    );
    
    if (!balancePost) return 0;
    
    // Use accountUserBalance (Faktiskt kontosaldo) if available, otherwise accountBalance (Bankens kontosaldo)
    // This matches exactly what KontosaldoKopia shows
    const balanceInOre = balancePost.accountUserBalance ?? balancePost.accountBalance ?? 0;
    return balanceInOre; // Keep in öre for calculations
  };

  // Calculate payday date range for current month
  const getPaydayDateRange = (monthKey: string): { startDate: Date, endDate: Date } => {
    const [year, month] = monthKey.split('-').map(Number);
    
    // Start from 25th of previous month
    let startYear = year;
    let startMonth = month - 1;
    if (startMonth === 0) {
      startMonth = 12;
      startYear = year - 1;
    }
    
    // From 2025-07-25 to 2025-08-24 for August
    const startDate = new Date(startYear, startMonth - 1, 25, 0, 0, 0);
    const endDate = new Date(year, month - 1, 25, 0, 0, 0); // End on 25th of current month (exclusive)
    
    return { startDate, endDate };
  };

  // Calculate actual saved (Faktiskt Sparat) using payday logic
  const calculateActualSaved = (accountId: string, monthKey: string): number => {
    const { startDate, endDate } = getPaydayDateRange(monthKey);
    
    // Filter transactions for this account within the payday period
    const savingTransactions = transactionsFromAPI.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      const isInDateRange = transactionDate >= startDate && transactionDate < endDate;
      const isCorrectAccount = transaction.accountId === accountId;
      const isSavingsType = transaction.type === 'Sparande' || transaction.type === 'Savings';
      
      return isCorrectAccount && isInDateRange && isSavingsType;
    });
    
    // Sum up all savings transactions (positive - negative)
    return savingTransactions.reduce((total, transaction) => {
      return total + transaction.amount; // Amount is already in öre, can be positive or negative
    }, 0);
  };

  // Calculate cumulative savings that should have been saved by current month for all goals on account
  const getCumulativeSavingsForAccount = (accountId: string, currentMonthKey: string, allSavingsGoals: SavingsGoal[]): number => {
    const [currentYear, currentMonth] = currentMonthKey.split('-').map(Number);
    
    let totalCumulative = 0;
    
    // Filter goals for this account and apply visibility rules (same as display logic)
    const relevantGoals = allSavingsGoals.filter(goal => {
      if (goal.accountId !== accountId) return false;
      
      const [startYear, startMonth] = goal.startDate.split('-').map(Number);
      const [endYear, endMonth] = goal.endDate.split('-').map(Number);
      
      // Check if current month is at or after the start date
      const isAtOrAfterStart = currentYear > startYear || (currentYear === startYear && currentMonth >= startMonth);
      
      // For active goals (default to active if no status set): include if we're at or after start date (ignore end date)
      if (goal.status === 'active' || goal.status === 'yellow' || !goal.status) {
        return isAtOrAfterStart;
      }
      
      // For completed goals: only include if we're in their original date range
      if (goal.status === 'completed' || goal.status === 'green') {
        const isInDateRange = isAtOrAfterStart &&
                             (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth));
        return isInDateRange;
      }
      
      return false;
    });
    
    relevantGoals.forEach(goal => {
      const monthlyAmount = calculateMonthlyAmount(goal);
      const [startYear, startMonth] = goal.startDate.split('-').map(Number);
      const [endYear, endMonth] = goal.endDate.split('-').map(Number);
      
      // For active goals: calculate from start to current month
      // For completed goals: calculate from start to end month (or current if before end)
      let calculationEndYear = currentYear;
      let calculationEndMonth = currentMonth;
      
      if (goal.status === 'completed') {
        // For completed goals, calculate only up to their end date
        if (currentYear > endYear || (currentYear === endYear && currentMonth > endMonth)) {
          calculationEndYear = endYear;
          calculationEndMonth = endMonth;
        }
      }
      
      // Calculate how many months from start to calculation end (inclusive)
      let monthsElapsed = 0;
      let year = startYear;
      let month = startMonth;
      
      while (year < calculationEndYear || (year === calculationEndYear && month <= calculationEndMonth)) {
        // Don't count months beyond the goal end date
        if (year > endYear || (year === endYear && month > endMonth)) {
          break;
        }
        
        monthsElapsed++;
        
        // Move to next month
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }
      
      const cumulativeForGoal = monthsElapsed * monthlyAmount * 100; // Convert to öre
      totalCumulative += cumulativeForGoal;
      
      console.log(`[SAVINGS] Goal: ${goal.name} (${goal.status}), Monthly: ${monthlyAmount} kr, Months elapsed: ${monthsElapsed}, Cumulative: ${cumulativeForGoal / 100} kr`);
    });
    
    console.log(`[SAVINGS] Account ${accountId} total cumulative: ${totalCumulative / 100} kr`);
    return totalCumulative; // Return in öre
  };

  // Calculate budgeted savings goals for the current month per account (for display purposes)
  const getBudgetedSavingsForAccount = (accountId: string, monthKey: string): number => {
    // Get all budget posts of type 'savings' or 'sparmål' for this account and month
    const savingsBudgets = budgetPostsFromAPI.filter(post => 
      post.accountId === accountId && 
      (post.type === 'savings' || post.type === 'sparmål' || post.budgetType === 'Sparande')
    );
    
    // Sum up the budgeted amounts
    return savingsBudgets.reduce((total, post) => total + (post.amount || 0), 0);
  };

  // Convert budget posts with type='sparmål' to SavingsGoal format
  const savingsGoalsFromSQL = useMemo(() => {
    if (!budgetPostsFromAPI || budgetPostsFromAPI.length === 0) return [];
    
    return budgetPostsFromAPI
      .filter(post => post.type === 'sparmål')
      .map(post => {
        // CRITICAL FIX: Read dates from dedicated database fields instead of JSON description
        const goalName = post.name || post.description?.replace('Sparmål: ', '') || 'Unnamed Goal';
        
        // Map budget post status to savings goal status
        const status = post.status === 'green' ? 'completed' : 'active';
        
        const goal: SavingsGoal = {
          id: post.id,
          name: goalName,
          accountId: post.accountId || '',
          targetAmount: post.amount / 100, // Convert from öre to kronor
          startDate: post.startDate || '', // CRITICAL FIX: Use dedicated startDate field
          endDate: post.endDate || '',      // CRITICAL FIX: Use dedicated endDate field
          status: status
        };
        
        return goal;
      });
  }, [budgetPostsFromAPI]);

  // Calculate monthly amount needed for a savings goal
  const calculateMonthlyAmount = (goal: SavingsGoal): number => {
    const start = new Date(goal.startDate + '-01');
    const end = new Date(goal.endDate + '-01');
    const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                       (end.getMonth() - start.getMonth()) + 1;
    return goal.targetAmount / monthsDiff;
  };

  // Calculate actual progress for a specific savings goal
  const calculateGoalProgress = (goal: SavingsGoal): { actualSaved: number; progress: number } => {
    // For now, we'll calculate based on transactions linked to this specific goal
    const goalTransactions = transactionsFromAPI.filter(transaction => {
      const isSavingsType = transaction.type === 'Savings' || transaction.type === 'Sparande';
      const isLinkedToGoal = transaction.savingsTargetId === goal.id;
      return isSavingsType && isLinkedToGoal;
    });
    
    const actualSaved = goalTransactions.reduce((total, transaction) => {
      return total + Math.abs(transaction.amount / 100); // Convert to kronor
    }, 0);
    
    const progress = Math.min((actualSaved / goal.targetAmount) * 100, 100);
    
    return { actualSaved, progress };
  };

  // Get savings goals for an account based on current month and goal status
  const getSavingsGoalsForAccount = (accountId: string, currentMonthKey: string): SavingsGoal[] => {
    const [currentYear, currentMonth] = currentMonthKey.split('-').map(Number);
    
    return savingsGoalsFromSQL.filter(goal => {
      if (goal.accountId !== accountId) return false;
      
      // Handle invalid dates gracefully
      if (!goal.startDate || !goal.endDate) return false;
      
      const [startYear, startMonth] = goal.startDate.split('-').map(Number);
      const [endYear, endMonth] = goal.endDate.split('-').map(Number);
      
      // Check if current month is at or after the start date
      const isAtOrAfterStart = currentYear > startYear || (currentYear === startYear && currentMonth >= startMonth);
      
      // For active goals (default to active if no status set): show for all months from start date onwards (ignore end date)
      if (goal.status === 'active' || goal.status === 'yellow' || !goal.status) {
        return isAtOrAfterStart;
      }
      
      // For completed goals: only show during their original active date range (startDate to endDate)
      if (goal.status === 'completed' || goal.status === 'green') {
        const isInDateRange = isAtOrAfterStart &&
                             (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth));
        return isInDateRange;
      }
      
      return false;
    });
  };

  // Calculate data per account
  const accountsData = useMemo(() => {
    return accountsFromAPI.map(account => {
      const openingBalance = getOpeningBalance(account.id); // in öre
      const actualSaved = calculateActualSaved(account.id, budgetState.selectedMonthKey); // in öre
      const currentCalculatedBalance = openingBalance + actualSaved; // in öre
      const budgetedSavings = getBudgetedSavingsForAccount(account.id, budgetState.selectedMonthKey); // in öre (current month only, for display)
      const cumulativeSavings = getCumulativeSavingsForAccount(account.id, budgetState.selectedMonthKey, savingsGoalsFromSQL); // in öre (cumulative from start to current month)
      const available = currentCalculatedBalance - cumulativeSavings; // in öre (use cumulative for "Tillgängligt")
      const savingsGoals = getSavingsGoalsForAccount(account.id, budgetState.selectedMonthKey);

      console.log(`[ACCOUNT] ${account.name}: Balance=${currentCalculatedBalance/100} kr, Cumulative=${cumulativeSavings/100} kr, Available=${available/100} kr`);

      return {
        account,
        openingBalance, // öre
        actualSaved, // öre
        currentCalculatedBalance, // öre
        budgetedSavings, // öre (current month only)
        cumulativeSavings, // öre (total that should be saved by now)
        available, // öre (balance - cumulative)
        savingsGoals
      };
    });
  }, [accountsFromAPI, transactionsFromAPI, budgetPostsFromAPI, savingsGoalsFromSQL, budgetState.selectedMonthKey]);

  const handleCreateGoal = async () => {
    if (!formData.huvudkategoriId || !formData.underkategoriId || !formData.name || !formData.accountId || !formData.targetAmount || 
        !formData.startDate || !formData.endDate) {
      return;
    }

    try {
      // Save to SQL database as budget_post
      const budgetPostData = {
        userId: 'dev-user-123', // Mock user ID for development
        monthKey: budgetState.selectedMonthKey,
        huvudkategoriId: formData.huvudkategoriId,
        underkategoriId: formData.underkategoriId,
        description: `Sparmål: ${formData.name}`, // Simple description
        name: formData.name, // CRITICAL FIX: Use dedicated name field
        startDate: formData.startDate, // CRITICAL FIX: Use dedicated startDate field
        endDate: formData.endDate, // CRITICAL FIX: Use dedicated endDate field
        amount: Math.round(parseFloat(formData.targetAmount) * 100), // Convert to öre
        accountId: formData.accountId,
        accountIdFrom: null,
        financedFrom: 'Löpande kostnad',
        transferType: 'monthly',
        dailyAmount: null,
        transferDays: null,
        type: 'sparmål',
        transactionType: 'Sparmål',
        budgetType: 'Sparmål',
      };

      
      await createBudgetPostMutation.mutateAsync(budgetPostData);
      
      // CRITICAL FIX: Remove localStorage duplication - only save to SQL database
      // The old localStorage savings goals are deprecated and cause duplicates
      // since we now load from SQL via useBudgetPosts hook which automatically
      // updates the allSavingsGoals useMemo when the mutation succeeds
      setIsCreateDialogOpen(false);
      setFormData({ huvudkategoriId: '', underkategoriId: '', name: '', accountId: '', targetAmount: '', startDate: '', endDate: '' });
    } catch (error) {
      console.error('🔍 [ERROR] Failed to create savings goal:', error);
      // Could add error toast here
    }
  };

  const handleEditGoal = (goal: SavingsGoal) => {
    // Find the budget post associated with this savings goal
    const budgetPost = budgetPostsFromAPI.find(post => post.id === goal.id && post.type === 'sparmål');
    
    setEditingGoal(goal);
    setFormData({
      huvudkategoriId: budgetPost?.huvudkategoriId || '',
      underkategoriId: budgetPost?.underkategoriId || '',
      name: goal.name,
      accountId: goal.accountId,
      targetAmount: goal.targetAmount.toString(),
      startDate: goal.startDate,
      endDate: goal.endDate
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateGoal = async () => {
    if (!editingGoal || !formData.huvudkategoriId || !formData.underkategoriId || !formData.name || 
        !formData.accountId || !formData.targetAmount || !formData.startDate || !formData.endDate) {
      return;
    }

    try {
      const updateData = {
        huvudkategoriId: formData.huvudkategoriId,
        underkategoriId: formData.underkategoriId,
        description: `Sparmål: ${formData.name}`,
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        amount: Math.round(parseFloat(formData.targetAmount) * 100), // Convert to öre
        accountId: formData.accountId,
      };

      
      await updateBudgetPostMutation.mutateAsync({ 
        id: editingGoal.id, 
        data: updateData 
      });
      
      setIsEditDialogOpen(false);
      setEditingGoal(null);
      setFormData({ huvudkategoriId: '', underkategoriId: '', name: '', accountId: '', targetAmount: '', startDate: '', endDate: '' });
    } catch (error) {
      console.error('🔍 [ERROR] Failed to update savings goal:', error);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Är du säker på att du vill ta bort detta sparmål?')) {
      return;
    }

    try {
      await deleteBudgetPostMutation.mutateAsync(goalId);
    } catch (error) {
      console.error('🔍 [ERROR] Failed to delete savings goal:', error);
    }
  };

  const handleMarkAsCompleted = async (goalId: string) => {
    try {
      await updateBudgetPostMutation.mutateAsync({ 
        id: goalId, 
        data: { status: 'green' } // Mark as completed by setting status to green
      });
      console.log('🎉 [SUCCESS] Marked savings goal as completed:', goalId);
    } catch (error) {
      console.error('🔍 [ERROR] Failed to mark savings goal as completed:', error);
    }
  };

  const handleMarkAsActive = async (goalId: string) => {
    try {
      await updateBudgetPostMutation.mutateAsync({ 
        id: goalId, 
        data: { status: 'yellow' } // Mark as active by setting status to yellow
      });
      console.log('✅ [SUCCESS] Marked savings goal as active:', goalId);
    } catch (error) {
      console.error('🔍 [ERROR] Failed to mark savings goal as active:', error);
    }
  };

  // Filter subcategories based on selected main category
  const availableSubcategories = useMemo(() => {
    if (formData.huvudkategoriId && underkategorier.length > 0) {
      return underkategorier.filter(sub => sub.huvudkategoriId === formData.huvudkategoriId);
    }
    return [];
  }, [formData.huvudkategoriId, underkategorier]);

  if (isLoading || accountsLoading || isLoadingHuvud || isLoadingUnder || isLoadingBudgetPosts) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Laddar sparmål, konton och kategorier...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header - Same as main budget page */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Familjens Budgetkalkylator
          </h1>
          <p className="text-muted-foreground text-lg">
            Beräkna era gemensamma utgifter och individuella bidrag
          </p>
        </div>

        {/* Month Selector - Same as main budget page */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-foreground">
              Aktuell månad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => navigateToPreviousMonth()}
                className="p-3 h-12 w-12 text-primary hover:text-primary/80"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              
              <Select 
                value={budgetState.selectedMonthKey} 
                onValueChange={(value) => handleBudgetMonthChange(value)}
              >
                <SelectTrigger className="w-auto min-w-[200px] border-none bg-transparent text-xl font-semibold text-primary hover:bg-muted/50 transition-colors text-center justify-center">
                  <SelectValue>
                    {(() => {
                      const monthNames = [
                        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                      ];
                      
                      const [year, month] = budgetState.selectedMonthKey.split('-');
                      const monthIndex = parseInt(month) - 1;
                      return `${monthNames[monthIndex]} ${year}`;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const monthNames = [
                      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                    ];
                    
                    const availableMonths = Object.keys(budgetState.historicalData || {});
                    const currentDate = new Date();
                    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    const allMonths = new Set([currentMonthKey, ...availableMonths]);
                    
                    return Array.from(allMonths).sort().reverse().map(monthKey => {
                      const [year, month] = monthKey.split('-');
                      const monthIndex = parseInt(month) - 1;
                      const displayName = `${monthNames[monthIndex]} ${year}`;
                      
                      return (
                        <SelectItem key={monthKey} value={monthKey}>
                          {displayName}
                        </SelectItem>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="lg"
                onClick={() => navigateToNextMonth()}
                className="p-3 h-12 w-12 text-primary hover:text-primary/80"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Page-specific content starts here */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Sparmål - {(() => {
                const monthNames = [
                  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                ];
                const [year, month] = budgetState.selectedMonthKey.split('-');
                const monthIndex = parseInt(month) - 1;
                return `${monthNames[monthIndex]} ${year}`;
              })()}
            </h1>
            <p className="text-muted-foreground">
              Skapa och följ upp dina långsiktiga sparmål
            </p>
          </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Skapa sparmål
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Skapa nytt sparmål</DialogTitle>
              <DialogDescription>
                Ange information för ditt nya sparmål
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="huvudkategori">Huvudkategori</Label>
                <Select 
                  value={formData.huvudkategoriId} 
                  onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, huvudkategoriId: value, underkategoriId: '' }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj huvudkategori" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg z-50">
                    {isLoadingHuvud ? (
                      <SelectItem value="loading" disabled>Laddar...</SelectItem>
                    ) : (
                      huvudkategorier.filter(k => k.id && k.id !== '').map((kategori) => (
                        <SelectItem key={kategori.id} value={kategori.id}>
                          {kategori.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="underkategori">Underkategori</Label>
                <Select 
                  value={formData.underkategoriId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, underkategoriId: value }))}
                  disabled={!formData.huvudkategoriId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.huvudkategoriId ? "Välj underkategori" : "Välj först huvudkategori"} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg z-50">
                    {isLoadingUnder ? (
                      <SelectItem value="loading" disabled>Laddar...</SelectItem>
                    ) : (
                      availableSubcategories.filter(s => s.id && s.id !== '').map((subkategori) => (
                        <SelectItem key={subkategori.id} value={subkategori.id}>
                          {subkategori.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="name">Namn</Label>
                <Input
                  id="name"
                  placeholder="t.ex. Thailandresa"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="account">Konto</Label>
                <Select value={formData.accountId} onValueChange={(value) => 
                  setFormData(prev => ({...prev, accountId: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj konto" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsFromAPI.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="target">Målbelopp (kr)</Label>
                <Input
                  id="target"
                  type="number"
                  placeholder="50000"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData(prev => ({...prev, targetAmount: e.target.value}))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="start">Startdatum</Label>
                  <Input
                    id="start"
                    type="month"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="end">Måldatum</Label>
                  <Input
                    id="end"
                    type="month"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleCreateGoal}
                disabled={
                  !formData.huvudkategoriId || 
                  !formData.underkategoriId || 
                  !formData.name || 
                  !formData.accountId || 
                  !formData.targetAmount || 
                  !formData.startDate || 
                  !formData.endDate
                }
              >
                Skapa sparmål
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Redigera sparmål</DialogTitle>
              <DialogDescription>
                Ändra information för ditt sparmål
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-huvudkategori">Huvudkategori</Label>
                <Select 
                  value={formData.huvudkategoriId} 
                  onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, huvudkategoriId: value, underkategoriId: '' }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj huvudkategori" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg z-50">
                    {isLoadingHuvud ? (
                      <SelectItem value="loading" disabled>Laddar...</SelectItem>
                    ) : (
                      huvudkategorier.filter(k => k.id && k.id !== '').map((kategori) => (
                        <SelectItem key={kategori.id} value={kategori.id}>
                          {kategori.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-underkategori">Underkategori</Label>
                <Select 
                  value={formData.underkategoriId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, underkategoriId: value }))}
                  disabled={!formData.huvudkategoriId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.huvudkategoriId ? "Välj underkategori" : "Välj först huvudkategori"} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg z-50">
                    {isLoadingUnder ? (
                      <SelectItem value="loading" disabled>Laddar...</SelectItem>
                    ) : (
                      availableSubcategories.filter(s => s.id && s.id !== '').map((subkategori) => (
                        <SelectItem key={subkategori.id} value={subkategori.id}>
                          {subkategori.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Namn</Label>
                <Input
                  id="edit-name"
                  placeholder="t.ex. Thailandresa"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-account">Konto</Label>
                <Select value={formData.accountId} onValueChange={(value) => 
                  setFormData(prev => ({...prev, accountId: value}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj konto" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsFromAPI.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-target">Målbelopp (kr)</Label>
                <Input
                  id="edit-target"
                  type="number"
                  placeholder="50000"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData(prev => ({...prev, targetAmount: e.target.value}))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-start">Startdatum</Label>
                  <Input
                    id="edit-start"
                    type="month"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="edit-end">Måldatum</Label>
                  <Input
                    id="edit-end"
                    type="month"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Avbryt
              </Button>
              <Button 
                onClick={handleUpdateGoal}
                disabled={
                  !formData.huvudkategoriId || 
                  !formData.underkategoriId || 
                  !formData.name || 
                  !formData.accountId || 
                  !formData.targetAmount || 
                  !formData.startDate || 
                  !formData.endDate
                }
              >
                Spara ändringar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

        {/* Account-based savings overview */}
        <div className="space-y-6">
          {accountsData.map(({ account, openingBalance, actualSaved, currentCalculatedBalance, budgetedSavings, cumulativeSavings, available, savingsGoals }) => (
            <Card key={account.id} className="w-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Wallet className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{account.name}</CardTitle>
                      <CardDescription>
                        Sparmålsöversikt för {(() => {
                          const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
                          const [year, month] = budgetState.selectedMonthKey.split('-');
                          return `${monthNames[parseInt(month) - 1]} ${year}`;
                        })()}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {savingsGoals.length} sparmål
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Financial Summary - Mobile responsive */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {formatOrenAsCurrency(openingBalance)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Ingående saldo</div>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300 flex items-center justify-center gap-1">
                      {actualSaved >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      {formatOrenAsCurrency(Math.abs(actualSaved))}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Faktiskt Sparat</div>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                      {formatOrenAsCurrency(currentCalculatedBalance)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Nuvarande saldo</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className={`text-2xl font-bold ${available >= 0 ? 'text-orange-700 dark:text-orange-300' : 'text-red-700 dark:text-red-300'}`}>
                      {formatOrenAsCurrency(available)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Tillgängligt</div>
                  </div>
                </div>
                
                {/* Cumulative Savings Goals */}
                {cumulativeSavings > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-amber-600" />
                      <span className="font-semibold text-amber-800 dark:text-amber-200">Totalt som borde sparats t.o.m. denna månad</span>
                    </div>
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {formatOrenAsCurrency(cumulativeSavings)}
                    </div>
                    {budgetedSavings > 0 && (
                      <div className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                        Denna månad: {formatOrenAsCurrency(budgetedSavings)}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Savings Goals for this account */}
                {savingsGoals.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Sparmål</h3>
                      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Plus className="mr-2 h-4 w-4" />
                            Lägg till sparmål
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                      {savingsGoals.map(goal => {
                        const { actualSaved, progress } = calculateGoalProgress(goal);
                        const monthlyAmount = calculateMonthlyAmount(goal);
                        const remainingAmount = Math.max(0, goal.targetAmount - actualSaved);
                        const isCompleted = goal.status === 'completed';
                        
                        return (
                          <div key={goal.id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                            isCompleted 
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
                              : 'bg-white dark:bg-gray-800'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <h4 className={`font-semibold ${isCompleted ? 'text-green-800 dark:text-green-200' : ''}`}>
                                  {goal.name}
                                </h4>
                                {isCompleted && (
                                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Färdigt
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {isCompleted ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleMarkAsActive(goal.id)}
                                    title="Markera som aktiv"
                                    className="h-8 w-8 p-0 text-orange-500 hover:text-orange-700"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleMarkAsCompleted(goal.id)}
                                    title="Markera som färdigt"
                                    className="h-8 w-8 p-0 text-green-500 hover:text-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditGoal(goal)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteGoal(goal.id)}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>{goal.startDate}</span>
                                <span>{goal.endDate}</span>
                              </div>
                              
                              {/* Target Amount */}
                              <div className="text-center">
                                <div className="text-lg font-bold text-primary">
                                  {goal.targetAmount.toLocaleString('sv-SE')} kr
                                </div>
                                <div className="text-xs text-muted-foreground">Målbelopp</div>
                              </div>
                              
                              {/* Progress Bar */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Framsteg</span>
                                  <span>{progress.toFixed(1)}%</span>
                                </div>
                                <Progress value={progress} className="h-2" />
                                <div className="flex justify-between text-sm text-muted-foreground">
                                  <span>{actualSaved.toLocaleString('sv-SE')} kr sparat</span>
                                  <span>{remainingAmount.toLocaleString('sv-SE')} kr kvar</span>
                                </div>
                              </div>
                              
                              {/* Monthly Amount */}
                              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <div className="flex items-center justify-center gap-1 text-xl font-bold text-blue-700 dark:text-blue-300">
                                  <TrendingUp className="h-4 w-4" />
                                  {monthlyAmount.toLocaleString('sv-SE')} kr
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">per månad</div>
                              </div>
                              
                              {/* Completion Status */}
                              {isCompleted ? (
                                <div className="bg-green-100 dark:bg-green-800/40 p-3 rounded-lg text-center">
                                  <div className="text-green-800 dark:text-green-200 font-medium">
                                    🎉 Sparmål färdigt!
                                  </div>
                                  <div className="text-green-600 dark:text-green-300 text-sm mt-1">
                                    Detta sparmål är markerat som slutfört
                                  </div>
                                </div>
                              ) : progress >= 100 && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-center">
                                  <div className="text-amber-700 dark:text-amber-300 font-medium">
                                    🎯 Målbelopp uppnått!
                                  </div>
                                  <div className="text-amber-600 dark:text-amber-400 text-sm mt-1">
                                    Du kan markera detta sparmål som färdigt
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                    <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Inga sparmål för detta konto</p>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Skapa ditt första sparmål
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          
          {accountsData.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <Wallet className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">Inga konton hittades</CardTitle>
                <CardDescription>
                  Lägg till konton för att börja hantera sparmål
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}