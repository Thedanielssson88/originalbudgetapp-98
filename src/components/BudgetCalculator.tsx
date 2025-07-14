import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calculator, DollarSign, TrendingUp, Users } from 'lucide-react';

const BudgetCalculator = () => {
  const [susannaSalary, setSusannaSalary] = useState<number>(0);
  const [andreasSalary, setAndreasSalary] = useState<number>(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(0);
  const [results, setResults] = useState<{
    totalSalary: number;
    totalDailyBudget: number;
    balanceLeft: number;
    susannaShare: number;
    andreasShare: number;
  } | null>(null);

  const calculateDailyBudget = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentDay = currentDate.getDate();
    
    // Calculate from current date to 24th of same month
    const endDate = new Date(currentYear, currentMonth, 24);
    
    if (currentDay > 24) {
      // If current day is after 24th, calculate for next month
      const nextMonth = currentMonth + 1;
      const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
      const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
      endDate.setFullYear(nextYear, adjustedMonth, 24);
    }
    
    let totalBudget = 0;
    let currentDatePointer = new Date(currentDate);
    
    while (currentDatePointer <= endDate) {
      const dayOfWeek = currentDatePointer.getDay();
      
      // Monday = 1, Tuesday = 2, ..., Friday = 5
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        totalBudget += 300; // 300 every Monday to Friday
        
        if (dayOfWeek === 5) { // Friday
          totalBudget += 540; // Additional 540 every Friday
        }
      }
      
      currentDatePointer.setDate(currentDatePointer.getDate() + 1);
    }
    
    return totalBudget;
  };

  const calculateBudget = () => {
    const totalSalary = susannaSalary + andreasSalary;
    const totalDailyBudget = calculateDailyBudget();
    const balanceLeft = totalSalary - totalDailyBudget - monthlyExpenses;
    
    let susannaShare = 0;
    let andreasShare = 0;
    
    if (totalSalary > 0) {
      susannaShare = (susannaSalary / totalSalary) * balanceLeft;
      andreasShare = (andreasSalary / totalSalary) * balanceLeft;
    }
    
    setResults({
      totalSalary,
      totalDailyBudget,
      balanceLeft,
      susannaShare,
      andreasShare
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Family Budget Calculator
          </h1>
          <p className="text-muted-foreground text-lg">
            Calculate your shared expenses and individual contributions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Income & Expenses
              </CardTitle>
              <CardDescription>
                Enter your monthly income and expenses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="susanna">Susanna's Salary</Label>
                <Input
                  id="susanna"
                  type="number"
                  placeholder="Enter monthly salary"
                  value={susannaSalary || ''}
                  onChange={(e) => setSusannaSalary(Number(e.target.value))}
                  className="text-lg"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="andreas">Andreas's Salary</Label>
                <Input
                  id="andreas"
                  type="number"
                  placeholder="Enter monthly salary"
                  value={andreasSalary || ''}
                  onChange={(e) => setAndreasSalary(Number(e.target.value))}
                  className="text-lg"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="expenses">Total Monthly Expenses</Label>
                <Input
                  id="expenses"
                  type="number"
                  placeholder="Enter total monthly expenses"
                  value={monthlyExpenses || ''}
                  onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
                  className="text-lg"
                />
              </div>
              
              <Button 
                onClick={calculateBudget} 
                className="w-full bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary transition-all duration-300"
                size="lg"
              >
                Calculate Budget
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                Budget Results
              </CardTitle>
              <CardDescription>
                Your calculated budget breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Salary</p>
                      <p className="text-2xl font-bold text-primary">{formatCurrency(results.totalSalary)}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm font-medium text-muted-foreground">Daily Budget</p>
                      <p className="text-2xl font-bold text-accent">{formatCurrency(results.totalDailyBudget)}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-success/10 to-success/5 rounded-lg p-4 border border-success/20">
                    <p className="text-sm font-medium text-success">Balance Left</p>
                    <p className="text-3xl font-bold text-success">{formatCurrency(results.balanceLeft)}</p>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Individual Shares
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="font-medium">Susanna's Share</span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(results.susannaShare)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="font-medium">Andreas's Share</span>
                        <span className="text-lg font-bold text-accent">{formatCurrency(results.andreasShare)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Enter your income and expenses to see the budget calculation
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BudgetCalculator;