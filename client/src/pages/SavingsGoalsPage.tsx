import { useState } from 'react';
import { Plus, Target, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useBudget } from '../hooks/useBudget';
import { createSavingsGoal } from '../orchestrator/budgetOrchestrator';
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    accountId: '',
    targetAmount: '',
    startDate: '',
    endDate: ''
  });

  // Beräkna faktiskt sparat för ett sparmål
  const calculateActualSaved = (goal: SavingsGoal): number => {
    let totalSaved = 0;
    
    // Gå igenom alla månader i historicalData
    Object.values(budgetState.historicalData).forEach(monthData => {
      // Hitta transaktioner som är kopplade till detta sparmål
      monthData.transactions.forEach(transaction => {
        if (transaction.type === 'Savings' && 
            transaction.accountId === goal.accountId &&
            transaction.savingsTargetId === goal.id) {
          totalSaved += Math.abs(transaction.amount);
        }
      });
    });
    
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

  const handleCreateGoal = () => {
    if (!formData.name || !formData.accountId || !formData.targetAmount || 
        !formData.startDate || !formData.endDate) {
      return;
    }

    const newGoal: Omit<SavingsGoal, 'id'> = {
      name: formData.name,
      accountId: formData.accountId,
      targetAmount: parseFloat(formData.targetAmount),
      startDate: formData.startDate,
      endDate: formData.endDate
    };

    // Generate UUID for the new goal
    const goalWithId = {
      id: uuidv4(),
      ...newGoal
    };

    createSavingsGoal(goalWithId);
    setIsCreateDialogOpen(false);
    setFormData({ name: '', accountId: '', targetAmount: '', startDate: '', endDate: '' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Laddar sparmål...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? year - 1 : year;
            const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
            // Navigate to previous month logic would go here
          }}
          className="p-3 h-12 w-12 text-primary hover:text-primary/80"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Aktuell månad:</span>
          <span className="text-lg font-semibold">
            {new Date(budgetState.selectedMonthKey + '-01').toLocaleDateString('sv-SE', { 
              year: 'numeric', 
              month: 'long' 
            })}
          </span>
        </div>

        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
            const nextMonth = month === 12 ? 1 : month + 1;
            const nextYear = month === 12 ? year + 1 : year;
            const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
            // Navigate to next month logic would go here
          }}
          className="p-3 h-12 w-12 text-primary hover:text-primary/80"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sparmål</h1>
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
                    {budgetState.accounts.map(account => (
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
              <Button onClick={handleCreateGoal}>Skapa sparmål</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {budgetState.savingsGoals.length === 0 ? (
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
          {budgetState.savingsGoals.map(goal => {
            const actualSaved = calculateActualSaved(goal);
            const progress = Math.min((actualSaved / goal.targetAmount) * 100, 100);
            const monthlyAmount = calculateMonthlyAmount(goal);
            const accountName = budgetState.accounts.find(acc => acc.id === goal.accountId)?.name || 'Okänt konto';
            
            return (
              <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{goal.name}</CardTitle>
                    <Badge variant="outline">
                      {accountName}
                    </Badge>
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
  );
}