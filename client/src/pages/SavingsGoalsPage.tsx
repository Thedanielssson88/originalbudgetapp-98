import { useState, useMemo } from 'react';
import { Plus, Target, TrendingUp, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useBudget } from '../hooks/useBudget';
import { useAccounts } from '../hooks/useAccounts';
import { useTransactions } from '../hooks/useTransactions';
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

export function SavingsGoalsPage() {
  const { budgetState, isLoading } = useBudget();
  const { data: accountsFromAPI = [], isLoading: accountsLoading } = useAccounts();
  const { data: transactionsFromAPI = [] } = useTransactions();
  const { data: huvudkategorier = [], isLoading: isLoadingHuvud } = useHuvudkategorier();
  const { data: underkategorier = [], isLoading: isLoadingUnder } = useUnderkategorier();
  const { data: budgetPostsFromAPI = [], isLoading: isLoadingBudgetPosts } = useBudgetPosts();
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

  // CRITICAL FIX: Use SQL transactions instead of localStorage budgetState
  // Beräkna faktiskt sparat för ett sparmål
  const calculateActualSaved = (goal: SavingsGoal): number => {
    let totalSaved = 0;
    
    // PHASE 2 MIGRATION: SQL-only data source - no localStorage fallback
    const allTransactions = transactionsFromAPI || [];
    
    // Debug logging to understand why progress might be 0
    const matchingTransactions = allTransactions.filter(transaction => {
      // Check for Savings or Sparande type (handle both variations)
      const isSavingsType = transaction.type === 'Savings' || transaction.type === 'Sparande';
      const hasMatchingTarget = transaction.savingsTargetId === goal.id;
      
      // For savings goals, we should count ALL transactions linked to this goal
      // regardless of which account they're on (since transfers might come from different accounts)
      if (isSavingsType && hasMatchingTarget) {
        console.log(`[calculateActualSaved] Found matching transaction for goal ${goal.name}:`, {
          transactionId: transaction.id,
          amountInOre: transaction.amount,
          amountInKronor: transaction.amount / 100,
          date: transaction.date,
          accountId: transaction.accountId,
          savingsTargetId: transaction.savingsTargetId,
          type: transaction.type
        });
        return true;
      }
      return false;
    });
    
    // Sum up all matching transactions
    matchingTransactions.forEach(transaction => {
      // Use the absolute value to handle both positive and negative amounts
      // Convert from öre to kronor by dividing by 100
      const amountInKronor = Math.abs(transaction.amount) / 100;
      totalSaved += amountInKronor;
    });
    
    console.log(`[calculateActualSaved] Goal: ${goal.name}, Total saved: ${totalSaved} kr, Transactions found: ${matchingTransactions.length}`);
    
    return totalSaved;
  };

  // Beräkna månadsbelopp som behövs
  const calculateMonthlyAmount = (goal: SavingsGoal): number => {
    const start = new Date(goal.startDate + '-01');
    const end = new Date(goal.endDate + '-01');
    const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                       (end.getMonth() - start.getMonth()) + 1;
    return goal.targetAmount / monthsDiff;
  };

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

  // Convert budget posts with type='sparmål' to SavingsGoal format
  const savingsGoalsFromSQL = useMemo(() => {
    if (!budgetPostsFromAPI || budgetPostsFromAPI.length === 0) return [];
    
    return budgetPostsFromAPI
      .filter(post => post.type === 'sparmål')
      .map(post => {
        // CRITICAL FIX: Read dates from dedicated database fields instead of JSON description
        const goalName = post.name || post.description?.replace('Sparmål: ', '') || 'Unnamed Goal';
        
        const goal = {
          id: post.id,
          name: goalName,
          accountId: post.accountId || '',
          targetAmount: post.amount / 100, // Convert from öre to kronor
          startDate: post.startDate || '', // CRITICAL FIX: Use dedicated startDate field
          endDate: post.endDate || ''      // CRITICAL FIX: Use dedicated endDate field
        };
        
        
        return goal;
      });
  }, [budgetPostsFromAPI]);

  // Combine SQL savings goals with legacy savings goals (during transition period)
  const allSavingsGoals = useMemo(() => {
    const legacyGoals = budgetState.savingsGoals || [];
    const sqlGoals = savingsGoalsFromSQL || [];
    
    // For now, prioritize SQL goals over legacy goals
    // You might want to deduplicate based on name or other criteria
    return [...sqlGoals, ...legacyGoals];
  }, [savingsGoalsFromSQL, budgetState.savingsGoals]);

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
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
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

      {allSavingsGoals.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Target className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">Inga sparmål ännu</CardTitle>
            <CardDescription className="mb-6">
              Skapa ditt första sparmål för att börja spåra dina framsteg
            </CardDescription>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Skapa ditt första sparmål
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {allSavingsGoals.map(goal => {
            // Debug the goal data
            console.log(`[SavingsGoalsPage] Processing goal:`, {
              id: goal.id,
              name: goal.name,
              accountId: goal.accountId,
              targetAmount: goal.targetAmount
            });
            
            const actualSaved = calculateActualSaved(goal);
            const progress = Math.min((actualSaved / goal.targetAmount) * 100, 100);
            const monthlyAmount = calculateMonthlyAmount(goal);
            const accountName = accountsFromAPI.find(acc => acc.id === goal.accountId)?.name || 'Okänt konto';
            
            return (
              <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{goal.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {accountName}
                      </Badge>
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
                  <CardDescription>
                    {goal.startDate} till {goal.endDate}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Framsteg</span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{actualSaved.toLocaleString()} kr</span>
                      <span>{goal.targetAmount.toLocaleString()} kr</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {(goal.targetAmount - actualSaved).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">kr kvar</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        {monthlyAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">kr/månad</div>
                    </div>
                  </div>
                  
                  {progress >= 100 && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-center">
                      <div className="text-green-700 dark:text-green-300 font-medium">
                        🎉 Sparmål uppnått!
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}