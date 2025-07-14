import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calculator, DollarSign, TrendingUp, Users, Calendar, Plus, Trash2 } from 'lucide-react';

interface SubCategory {
  id: string;
  name: string;
  amount: number;
}

interface BudgetGroup {
  id: string;
  name: string;
  amount: number;
  type: 'cost' | 'savings';
  subCategories?: SubCategory[];
}

const BudgetCalculator = () => {
  const [andreasSalary, setAndreasSalary] = useState<number>(45000);
  const [andreasförsäkringskassan, setAndreasförsäkringskassan] = useState<number>(0);
  const [andreasbarnbidrag, setAndreasbarnbidrag] = useState<number>(0);
  const [susannaSalary, setSusannaSalary] = useState<number>(40000);
  const [susannaförsäkringskassan, setSusannaförsäkringskassan] = useState<number>(5000);
  const [susannabarnbidrag, setSusannabarnbidrag] = useState<number>(0);
  const [costGroups, setCostGroups] = useState<BudgetGroup[]>([
    { id: '1', name: 'Hyra', amount: 15000, type: 'cost' },
    { id: '2', name: 'Mat & Kläder', amount: 8000, type: 'cost' },
    { id: '3', name: 'Transport', amount: 2000, type: 'cost', subCategories: [] }
  ]);
  const [savingsGroups, setSavingsGroups] = useState<BudgetGroup[]>([]);
  const [dailyTransfer, setDailyTransfer] = useState<number>(300);
  const [weekendTransfer, setWeekendTransfer] = useState<number>(540);
  const [results, setResults] = useState<{
    totalSalary: number;
    totalDailyBudget: number;
    remainingDailyBudget: number;
    balanceLeft: number;
    susannaShare: number;
    andreasShare: number;
    susannaPercentage: number;
    andreasPercentage: number;
    daysUntil25th: number;
    weekdayCount: number;
    fridayCount: number;
    totalMonthlyExpenses: number;
  } | null>(null);

  // Load saved values from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('budgetCalculatorData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        
        // Handle migration from old data format
        if (parsed.budgetGroups && !parsed.costGroups) {
          console.log('Migrating old budget data format to new format');
          // Migrate old budgetGroups to new costGroups format
          const migratedCostGroups = parsed.budgetGroups.map((group: any) => ({
            ...group,
            type: 'cost'
          }));
          setCostGroups(migratedCostGroups);
        } else {
          // Use new format costGroups
          setCostGroups(parsed.costGroups || [
            { id: '1', name: 'Hyra', amount: 15000, type: 'cost' },
            { id: '2', name: 'Mat & Kläder', amount: 8000, type: 'cost' },
            { id: '3', name: 'Transport', amount: 2000, type: 'cost', subCategories: [] }
          ]);
        }
        
        // Load all saved values with backward compatibility
        setAndreasSalary(parsed.andreasSalary || 45000);
        setAndreasförsäkringskassan(parsed.andreasförsäkringskassan || 0);
        setAndreasbarnbidrag(parsed.andreasbarnbidrag || 0);
        setSusannaSalary(parsed.susannaSalary || 40000);
        // Migrate old försäkringskassan to susannaförsäkringskassan if needed
        setSusannaförsäkringskassan(parsed.susannaförsäkringskassan || parsed.försäkringskassan || 5000);
        setSusannabarnbidrag(parsed.susannabarnbidrag || 0);
        
        setSavingsGroups(parsed.savingsGroups || []);
        setDailyTransfer(parsed.dailyTransfer || 300);
        setWeekendTransfer(parsed.weekendTransfer || 540);
        
        if (parsed.results) {
          setResults(parsed.results);
        }
        
        console.log('Successfully loaded saved budget data');
      } catch (error) {
        console.error('Error loading saved data:', error);
        // Only clear corrupted data, don't lose user data on migration
        console.warn('Using default values due to corrupted data');
      }
    }
  }, []);

  // Save data to localStorage whenever values change
  const saveToLocalStorage = () => {
    const dataToSave = {
      andreasSalary,
      andreasförsäkringskassan,
      andreasbarnbidrag,
      susannaSalary,
      susannaförsäkringskassan,
      susannabarnbidrag,
      costGroups,
      savingsGroups,
      dailyTransfer,
      weekendTransfer,
      results
    };
    localStorage.setItem('budgetCalculatorData', JSON.stringify(dataToSave));
  };

  // Save data whenever key values change
  useEffect(() => {
    saveToLocalStorage();
  }, [andreasSalary, andreasförsäkringskassan, andreasbarnbidrag, susannaSalary, susannaförsäkringskassan, susannabarnbidrag, costGroups, savingsGroups, dailyTransfer, weekendTransfer, results]);

  const calculateDailyBudget = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentDay = currentDate.getDate();
    
    // Calculate remaining budget: from current date to 24th of same month
    let remainingEndDate = new Date(currentYear, currentMonth, 24);
    
    if (currentDay > 24) {
      // If current day is after 24th, calculate for next month
      const nextMonth = currentMonth + 1;
      const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
      const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
      remainingEndDate.setFullYear(nextYear, adjustedMonth, 24);
    }
    
    // Calculate total budget: from 25th of previous month to 24th of current month
    const prevMonth = currentMonth - 1;
    const prevYear = prevMonth < 0 ? currentYear - 1 : currentYear;
    const adjustedPrevMonth = prevMonth < 0 ? 11 : prevMonth;
    const totalStartDate = new Date(prevYear, adjustedPrevMonth, 25);
    const totalEndDate = new Date(currentYear, currentMonth, 24);
    
    // Calculate days until 25th
    let date25th = new Date(currentYear, currentMonth, 25);
    if (currentDay > 25) {
      const nextMonth = currentMonth + 1;
      const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
      const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
      date25th.setFullYear(nextYear, adjustedMonth, 25);
    }
    
    const timeDiff = date25th.getTime() - currentDate.getTime();
    const daysUntil25th = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    // Calculate remaining budget (today to 24th)
    let remainingBudget = 0;
    let remainingWeekdayCount = 0;
    let remainingFridayCount = 0;
    let currentDatePointer = new Date(currentDate);
    
    while (currentDatePointer <= remainingEndDate) {
      const dayOfWeek = currentDatePointer.getDay();
      
      // Monday = 1, Tuesday = 2, ..., Friday = 5
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        remainingBudget += dailyTransfer;
        remainingWeekdayCount++;
        
        if (dayOfWeek === 5) { // Friday
          remainingBudget += weekendTransfer;
          remainingFridayCount++;
        }
      }
      
      currentDatePointer.setDate(currentDatePointer.getDate() + 1);
    }
    
    // Calculate total budget (25th previous month to 24th current month)
    let totalBudget = 0;
    let totalWeekdayCount = 0;
    let totalFridayCount = 0;
    let totalDatePointer = new Date(totalStartDate);
    
    while (totalDatePointer <= totalEndDate) {
      const dayOfWeek = totalDatePointer.getDay();
      
      // Monday = 1, Tuesday = 2, ..., Friday = 5
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        totalBudget += dailyTransfer;
        totalWeekdayCount++;
        
        if (dayOfWeek === 5) { // Friday
          totalBudget += weekendTransfer;
          totalFridayCount++;
        }
      }
      
      totalDatePointer.setDate(totalDatePointer.getDate() + 1);
    }
    
    return { 
      totalBudget, 
      remainingBudget, 
      weekdayCount: remainingWeekdayCount, 
      fridayCount: remainingFridayCount, 
      daysUntil25th,
      totalWeekdayCount,
      totalFridayCount
    };
  };

  const calculateBudget = () => {
    const andreasTotalIncome = andreasSalary + andreasförsäkringskassan + andreasbarnbidrag;
    const susannaTotalIncome = susannaSalary + susannaförsäkringskassan + susannabarnbidrag;
    const totalSalary = andreasTotalIncome + susannaTotalIncome;
    const budgetData = calculateDailyBudget();
    
    // Calculate total costs (only from subcategories, main categories are calculated automatically)
    const totalCosts = costGroups.reduce((sum, group) => {
      const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
      return sum + subCategoriesTotal;
    }, 0);
    
    // Calculate total savings
    const totalSavings = savingsGroups.reduce((sum, group) => sum + group.amount, 0);
    
    const totalMonthlyExpenses = totalCosts + totalSavings;
    const balanceLeft = totalSalary - budgetData.totalBudget - totalMonthlyExpenses;
    
    let susannaShare = 0;
    let andreasShare = 0;
    let susannaPercentage = 0;
    let andreasPercentage = 0;
    
    if (totalSalary > 0) {
      susannaPercentage = (susannaTotalIncome / totalSalary) * 100;
      andreasPercentage = (andreasTotalIncome / totalSalary) * 100;
      susannaShare = (susannaTotalIncome / totalSalary) * balanceLeft;
      andreasShare = (andreasTotalIncome / totalSalary) * balanceLeft;
    }
    
    setResults({
      totalSalary,
      totalDailyBudget: budgetData.totalBudget,
      remainingDailyBudget: budgetData.remainingBudget,
      balanceLeft,
      susannaShare,
      andreasShare,
      susannaPercentage,
      andreasPercentage,
      daysUntil25th: budgetData.daysUntil25th,
      weekdayCount: budgetData.weekdayCount,
      fridayCount: budgetData.fridayCount,
      totalMonthlyExpenses
    });
  };

  const addCostGroup = () => {
    const newGroup: BudgetGroup = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      type: 'cost',
      subCategories: []
    };
    setCostGroups([...costGroups, newGroup]);
  };

  const addSavingsGroup = () => {
    const newGroup: BudgetGroup = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      type: 'savings'
    };
    setSavingsGroups([...savingsGroups, newGroup]);
  };

  const removeCostGroup = (id: string) => {
    setCostGroups(costGroups.filter(group => group.id !== id));
  };

  const removeSavingsGroup = (id: string) => {
    setSavingsGroups(savingsGroups.filter(group => group.id !== id));
  };

  const updateCostGroup = (id: string, field: 'name' | 'amount', value: string | number) => {
    setCostGroups(costGroups.map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
  };

  const updateSavingsGroup = (id: string, field: 'name' | 'amount', value: string | number) => {
    setSavingsGroups(savingsGroups.map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
  };

  const addSubCategory = (groupId: string) => {
    const newSubCategory: SubCategory = {
      id: Date.now().toString(),
      name: '',
      amount: 0
    };
    setCostGroups(costGroups.map(group => 
      group.id === groupId ? { 
        ...group, 
        subCategories: [...(group.subCategories || []), newSubCategory] 
      } : group
    ));
  };

  const removeSubCategory = (groupId: string, subId: string) => {
    setCostGroups(costGroups.map(group => 
      group.id === groupId ? {
        ...group,
        subCategories: group.subCategories?.filter(sub => sub.id !== subId) || []
      } : group
    ));
  };

  const updateSubCategory = (groupId: string, subId: string, field: 'name' | 'amount', value: string | number) => {
    setCostGroups(costGroups.map(group => 
      group.id === groupId ? {
        ...group,
        subCategories: group.subCategories?.map(sub => 
          sub.id === subId ? { ...sub, [field]: value } : sub
        ) || []
      } : group
    ));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Familjens Budgetkalkylator
          </h1>
          <p className="text-muted-foreground text-lg">
            Beräkna era gemensamma utgifter och individuella bidrag
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Inkomst & Utgifter
              </CardTitle>
              <CardDescription>
                Ange era månadsinkomster och utgifter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Andreas Income Section */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <h3 className="text-lg font-semibold mb-3 text-primary">Andreas Inkomst</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="andreas">Lön</Label>
                    <Input
                      id="andreas"
                      type="number"
                      placeholder="Ange månadslön"
                      value={andreasSalary || ''}
                      onChange={(e) => setAndreasSalary(Number(e.target.value))}
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="andreas-forsakringskassan">Försäkringskassan</Label>
                    <Input
                      id="andreas-forsakringskassan"
                      type="number"
                      placeholder="Ange försäkringskassan"
                      value={andreasförsäkringskassan || ''}
                      onChange={(e) => setAndreasförsäkringskassan(Number(e.target.value))}
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="andreas-barnbidrag">Barnbidrag</Label>
                    <Input
                      id="andreas-barnbidrag"
                      type="number"
                      placeholder="Ange barnbidrag"
                      value={andreasbarnbidrag || ''}
                      onChange={(e) => setAndreasbarnbidrag(Number(e.target.value))}
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Andreas:</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Susanna Income Section */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <h3 className="text-lg font-semibold mb-3 text-primary">Susannas Inkomst</h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="susanna">Lön</Label>
                    <Input
                      id="susanna"
                      type="number"
                      placeholder="Ange månadslön"
                      value={susannaSalary || ''}
                      onChange={(e) => setSusannaSalary(Number(e.target.value))}
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="susanna-forsakringskassan">Försäkringskassan</Label>
                    <Input
                      id="susanna-forsakringskassan"
                      type="number"
                      placeholder="Ange försäkringskassan"
                      value={susannaförsäkringskassan || ''}
                      onChange={(e) => setSusannaförsäkringskassan(Number(e.target.value))}
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="susanna-barnbidrag">Barnbidrag</Label>
                    <Input
                      id="susanna-barnbidrag"
                      type="number"
                      placeholder="Ange barnbidrag"
                      value={susannabarnbidrag || ''}
                      onChange={(e) => setSusannabarnbidrag(Number(e.target.value))}
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Susanna:</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(susannaSalary + susannaförsäkringskassan + susannabarnbidrag)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={calculateBudget} 
                className="w-full bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary transition-all duration-300"
                size="lg"
              >
                Beräkna Budget
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                Budgetresultat
              </CardTitle>
              <CardDescription>
                Era beräknade budgetfördelning
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Lön</p>
                      <p className="text-2xl font-bold text-primary">{formatCurrency(results.totalSalary)}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Daglig Budget</p>
                      <p className="text-2xl font-bold text-accent">{formatCurrency(results.totalDailyBudget)}</p>
                    </div>
                  </div>
                  
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm font-medium text-muted-foreground">Återstående Daglig Budget</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(results.remainingDailyBudget)}</p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-success/10 to-success/5 rounded-lg p-4 border border-success/20">
                    <p className="text-sm font-medium text-success">Kvar att fördela</p>
                    <p className="text-3xl font-bold text-success">{formatCurrency(results.balanceLeft)}</p>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Tid & Överföringsdetaljer
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground">Dagar tills 25:e</p>
                        <p className="text-xl font-bold text-primary">{results.daysUntil25th}</p>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground">Vardagar</p>
                        <p className="text-xl font-bold text-accent">{results.weekdayCount}</p>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground">Fredagar</p>
                        <p className="text-xl font-bold text-primary">{results.fridayCount}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Individuella Andelar
                    </h3>
                     <div className="space-y-2">
                       <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                         <span className="font-medium">Andreas Andel</span>
                         <div className="text-right">
                           <span className="text-lg font-bold text-accent">{formatCurrency(results.andreasShare)}</span>
                           <p className="text-sm text-muted-foreground">({results.andreasPercentage.toFixed(1)}%)</p>
                         </div>
                       </div>
                       <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                         <span className="font-medium">Susannas Andel</span>
                         <div className="text-right">
                           <span className="text-lg font-bold text-primary">{formatCurrency(results.susannaShare)}</span>
                           <p className="text-sm text-muted-foreground">({results.susannaPercentage.toFixed(1)}%)</p>
                         </div>
                       </div>
                     </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Ange era inkomster och utgifter för att se budgetberäkningen
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Budgetkategorier Section */}
        <div className="mt-8">
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Budgetkategorier
              </CardTitle>
              <CardDescription>
                Översikt över alla budgetkategorier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Income Section */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-primary">Inkomster</h3>
                  <div className="grid gap-2">
                    <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <span className="font-medium">Andreas Total</span>
                      <span className="text-lg font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <span className="font-medium">Susanna Total</span>
                      <span className="text-lg font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(susannaSalary + susannaförsäkringskassan + susannabarnbidrag)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <span className="font-medium text-primary">Total Inkomst</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Costs Section */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-primary">Kostnader</h3>
                  <div className="grid gap-2">
                    {costGroups.map((group) => {
                      const subCategoriesTotal = group.subCategories?.reduce((sum, sub) => sum + sub.amount, 0) || 0;
                      return subCategoriesTotal > 0 ? (
                        <div key={group.id} className="space-y-2">
                          <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                            <span className="font-medium">{group.name || 'Namnlös kategori'}</span>
                            <span className="text-lg font-bold text-red-700 dark:text-red-300">
                              {formatCurrency(subCategoriesTotal)}
                            </span>
                          </div>
                          {group.subCategories && group.subCategories.length > 0 && (
                            <div className="ml-4 space-y-1">
                              {group.subCategories.map((sub) => 
                                sub.amount > 0 ? (
                                  <div key={sub.id} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                                    <span>{sub.name || 'Namnlös underkategori'}</span>
                                    <span className="font-medium">{formatCurrency(sub.amount)}</span>
                                  </div>
                                ) : null
                              )}
                            </div>
                          )}
                        </div>
                      ) : null;
                    })}
                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <span className="font-medium text-primary">Totala Kostnader</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(costGroups.reduce((sum, group) => {
                          const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                          return sum + subCategoriesTotal;
                        }, 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Savings Section */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-primary">Sparande</h3>
                  <div className="grid gap-2">
                    {savingsGroups.map((group) => 
                      group.amount > 0 ? (
                        <div key={group.id} className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <span className="font-medium">{group.name || 'Namnlös sparande'}</span>
                          <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                            {formatCurrency(group.amount)}
                          </span>
                        </div>
                      ) : null
                    )}
                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <span className="font-medium text-primary">Totalt Sparande</span>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(savingsGroups.reduce((sum, group) => sum + group.amount, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budgetöverföringar Section */}
        <div className="mt-6">
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-accent" />
                Budgetöverföringar
              </CardTitle>
              <CardDescription>
                Dagliga överföringar och helgtillägg
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="flex justify-between items-center p-4 bg-accent/10 rounded-lg border border-accent/20">
                  <div>
                    <span className="font-medium text-accent">Daglig överföring</span>
                    <p className="text-sm text-muted-foreground">Måndag till fredag</p>
                  </div>
                  <span className="text-2xl font-bold text-accent">
                    {formatCurrency(dailyTransfer)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div>
                    <span className="font-medium text-primary">Fredagsöverföring</span>
                    <p className="text-sm text-muted-foreground">Extra helgtillägg</p>
                  </div>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(weekendTransfer)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Budgetinställningar Section */}
        <div className="mt-6">
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-accent" />
                Budgetinställningar
              </CardTitle>
              <CardDescription>
                Hantera era budgetkategorier och överföringsinställningar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cost Groups Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Kostnader</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCostGroup}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Lägg till kostnad
                  </Button>
                </div>
                
                {costGroups.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Inga kostnader har lagts till än.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {costGroups.map((group) => (
                      <div key={group.id} className="space-y-2 p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Kostnadskategori"
                            value={group.name}
                            onChange={(e) => updateCostGroup(group.id, 'name', e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="Beräknat från underkategorier"
                            value={group.subCategories?.reduce((sum, sub) => sum + (sub.amount || 0), 0) || 0}
                            readOnly
                            className="w-32 bg-muted text-muted-foreground cursor-not-allowed"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addSubCategory(group.id)}
                            className="px-2"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCostGroup(group.id)}
                            className="text-destructive hover:text-destructive px-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* Sub-categories */}
                        {group.subCategories && group.subCategories.length > 0 && (
                          <div className="ml-4 space-y-1">
                            {group.subCategories.map((sub, index) => (
                              <div key={`${group.id}-${sub.id}-${index}`} className="flex items-center gap-2">
                                <Input
                                  placeholder="Underkategori"
                                  value={sub.name || ''}
                                  onChange={(e) => {
                                    console.log('Updating subcategory name:', e.target.value);
                                    updateSubCategory(group.id, sub.id, 'name', e.target.value);
                                  }}
                                  className="flex-1 h-8 text-sm"
                                />
                                <Input
                                  type="number"
                                  placeholder="Belopp"
                                  value={sub.amount || ''}
                                  onChange={(e) => {
                                    console.log('Updating subcategory amount:', e.target.value);
                                    updateSubCategory(group.id, sub.id, 'amount', Number(e.target.value));
                                  }}
                                  className="w-20 h-8 text-sm"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSubCategory(group.id, sub.id)}
                                  className="text-destructive hover:text-destructive px-1 h-8"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Savings Groups Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Sparande</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSavingsGroup}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Lägg till sparande
                  </Button>
                </div>
                
                {savingsGroups.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Inga sparanden har lagts till än.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savingsGroups.map((group) => (
                      <div key={group.id} className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                        <Input
                          placeholder="Sparandekategori"
                          value={group.name}
                          onChange={(e) => updateSavingsGroup(group.id, 'name', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder="Belopp"
                          value={group.amount || ''}
                          onChange={(e) => updateSavingsGroup(group.id, 'amount', Number(e.target.value))}
                          className="w-24"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSavingsGroup(group.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total Summary */}
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <span className="font-medium text-red-700 dark:text-red-300">Totala kostnader</span>
                  <span className="text-lg font-bold text-red-700 dark:text-red-300">
                    {formatCurrency(costGroups.reduce((sum, group) => {
                      const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                      return sum + subCategoriesTotal;
                    }, 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <span className="font-medium text-green-700 dark:text-green-300">Totalt sparande</span>
                  <span className="text-lg font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(savingsGroups.reduce((sum, group) => sum + group.amount, 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="font-medium text-primary">Totala månatliga utgifter</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(
                      costGroups.reduce((sum, group) => {
                        const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                        return sum + subCategoriesTotal;
                      }, 0) + savingsGroups.reduce((sum, group) => sum + group.amount, 0)
                    )}
                  </span>
                </div>
              </div>
              
              {/* Transfer Settings */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-primary">Överföringsinställningar</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daily-transfer">Daglig överföring</Label>
                    <Input
                      id="daily-transfer"
                      type="number"
                      placeholder="Ange daglig överföring"
                      value={dailyTransfer || ''}
                      onChange={(e) => setDailyTransfer(Number(e.target.value))}
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="weekend-transfer">Extra helgöverföring</Label>
                    <Input
                      id="weekend-transfer"
                      type="number"
                      placeholder="Ange fredagsöverföring"
                      value={weekendTransfer || ''}
                      onChange={(e) => setWeekendTransfer(Number(e.target.value))}
                      className="text-lg"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BudgetCalculator;