import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Calculator, DollarSign, TrendingUp, Users, Calendar, Plus, Trash2, Edit, Save, X, ChevronDown, ChevronUp, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import { AccountDataTable, AccountDataRow } from '@/components/AccountDataTable';
import CreateMonthDialog from './CreateMonthDialog';
import { CustomLineChart } from './CustomLineChart';
import { useBudgetData, BudgetGroup, BudgetIncomeData, BudgetTransfers, AccountBalance, BudgetConfiguration } from '@/hooks/useBudgetData';
import { useToast } from '@/hooks/use-toast';

interface SubCategory {
  id: string;
  name: string;
  amount: number;
  account?: string;
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
}

const BudgetCalculatorDB = () => {
  const { toast } = useToast();
  const {
    loading: dbLoading,
    saveIncomeData,
    loadIncomeData,
    saveBudgetCategories,
    loadBudgetCategories,
    saveTransferData,
    loadTransferData,
    saveAccountBalances,
    loadAccountBalances,
    saveBudgetConfiguration,
    loadBudgetConfiguration,
    saveBudgetCalculations,
    loadBudgetCalculations,
    getBudgetPeriods
  } = useBudgetData();

  // Core budget states
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
  const [transferAccount, setTransferAccount] = useState<number>(0);
  
  // Personal budget states
  const [andreasPersonalCosts, setAndreasPersonalCosts] = useState<BudgetGroup[]>([]);
  const [andreasPersonalSavings, setAndreasPersonalSavings] = useState<BudgetGroup[]>([]);
  const [susannaPersonalCosts, setSusannaPersonalCosts] = useState<BudgetGroup[]>([]);
  const [susannaPersonalSavings, setSusannaPersonalSavings] = useState<BudgetGroup[]>([]);
  
  // Account states
  const [accounts, setAccounts] = useState<string[]>(['Löpande', 'Sparkonto', 'Buffert']);
  const [accountBalances, setAccountBalances] = useState<{[key: string]: number}>({});
  const [accountBalancesSet, setAccountBalancesSet] = useState<{[key: string]: boolean}>({});
  const [accountFinalBalances, setAccountFinalBalances] = useState<{[key: string]: number}>({});
  const [accountFinalBalancesSet, setAccountFinalBalancesSet] = useState<{[key: string]: boolean}>({});
  const [accountEstimatedFinalBalances, setAccountEstimatedFinalBalances] = useState<{[key: string]: number}>({});
  
  // Configuration states
  const [accountCategories, setAccountCategories] = useState<string[]>(['Privat', 'Gemensam', 'Sparande', 'Hushåll']);
  const [accountCategoryMapping, setAccountCategoryMapping] = useState<{[accountName: string]: string}>({});
  const [userName1, setUserName1] = useState<string>('Andreas');
  const [userName2, setUserName2] = useState<string>('Susanna');
  
  // UI states
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("inkomster");
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Initialize current month
  useEffect(() => {
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedBudgetMonth(currentMonthKey);
  }, []);

  // Load available months
  useEffect(() => {
    const loadAvailableMonths = async () => {
      const periods = await getBudgetPeriods();
      const monthKeys = periods.map(p => `${p.year}-${String(p.month).padStart(2, '0')}`);
      
      // Always include current month
      const currentDate = new Date();
      const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthKeys.includes(currentMonthKey)) {
        monthKeys.push(currentMonthKey);
      }
      
      monthKeys.sort();
      setAvailableMonths(monthKeys);
    };
    
    loadAvailableMonths();
  }, [getBudgetPeriods]);

  // Load budget data when month changes
  useEffect(() => {
    if (!selectedBudgetMonth) return;
    
    const loadBudgetData = async () => {
      setIsLoading(true);
      try {
        const [year, month] = selectedBudgetMonth.split('-').map(Number);
        
        // Load all budget data
        const [
          incomeData,
          categoriesData,
          transferData,
          balancesData,
          calculationsData
        ] = await Promise.all([
          loadIncomeData(year, month),
          loadBudgetCategories(year, month),
          loadTransferData(year, month),
          loadAccountBalances(year, month),
          loadBudgetCalculations(year, month)
        ]);
        
        // Set income data
        if (incomeData) {
          setAndreasSalary(incomeData.andreas_salary);
          setAndreasförsäkringskassan(incomeData.andreas_forsakringskassan);
          setAndreasbarnbidrag(incomeData.andreas_barnbidrag);
          setSusannaSalary(incomeData.susanna_salary);
          setSusannaförsäkringskassan(incomeData.susanna_forsakringskassan);
          setSusannabarnbidrag(incomeData.susanna_barnbidrag);
        }
        
        // Set categories data
        if (categoriesData) {
          setCostGroups(categoriesData.costGroups);
          setSavingsGroups(categoriesData.savingsGroups);
          setAndreasPersonalCosts(categoriesData.andreasPersonalCosts);
          setAndreasPersonalSavings(categoriesData.andreasPersonalSavings);
          setSusannaPersonalCosts(categoriesData.susannaPersonalCosts);
          setSusannaPersonalSavings(categoriesData.susannaPersonalSavings);
        }
        
        // Set transfer data
        if (transferData) {
          setDailyTransfer(transferData.dailyTransfer);
          setWeekendTransfer(transferData.weekendTransfer);
          setTransferAccount(transferData.transferAccount);
        }
        
        // Set account balances
        if (balancesData) {
          const balances: {[key: string]: number} = {};
          const balancesSet: {[key: string]: boolean} = {};
          const finalBalances: {[key: string]: number} = {};
          const finalBalancesSet: {[key: string]: boolean} = {};
          const estimatedFinalBalances: {[key: string]: number} = {};
          
          balancesData.forEach(balance => {
            balances[balance.accountName] = balance.startingBalance;
            balancesSet[balance.accountName] = balance.startingBalanceSet;
            finalBalances[balance.accountName] = balance.finalBalance;
            finalBalancesSet[balance.accountName] = balance.finalBalanceSet;
            estimatedFinalBalances[balance.accountName] = balance.estimatedFinalBalance;
          });
          
          setAccountBalances(balances);
          setAccountBalancesSet(balancesSet);
          setAccountFinalBalances(finalBalances);
          setAccountFinalBalancesSet(finalBalancesSet);
          setAccountEstimatedFinalBalances(estimatedFinalBalances);
        }
        
        // Set calculations
        if (calculationsData) {
          setResults(calculationsData);
        }
        
        toast({
          title: "Budget loaded",
          description: `Data for ${selectedBudgetMonth} loaded successfully`
        });
      } catch (error) {
        console.error('Error loading budget data:', error);
        toast({
          title: "Error",
          description: "Failed to load budget data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadBudgetData();
  }, [selectedBudgetMonth, loadIncomeData, loadBudgetCategories, loadTransferData, loadAccountBalances, loadBudgetCalculations, toast]);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      const config = await loadBudgetConfiguration();
      if (config) {
        setAccounts(config.accounts);
        setAccountCategories(config.accountCategories);
        setAccountCategoryMapping(config.accountCategoryMapping);
        setUserName1(config.userNames.userName1);
        setUserName2(config.userNames.userName2);
      }
    };
    
    loadConfig();
  }, [loadBudgetConfiguration]);

  // Auto-save functionality
  const saveCurrentBudgetData = useCallback(async () => {
    if (!selectedBudgetMonth || !autoSaveEnabled) return;
    
    try {
      const [year, month] = selectedBudgetMonth.split('-').map(Number);
      
      // Save income data
      const incomeData: BudgetIncomeData = {
        andreas_salary: andreasSalary,
        andreas_forsakringskassan: andreasförsäkringskassan,
        andreas_barnbidrag: andreasbarnbidrag,
        susanna_salary: susannaSalary,
        susanna_forsakringskassan: susannaförsäkringskassan,
        susanna_barnbidrag: susannabarnbidrag
      };
      
      // Save transfers
      const transfers: BudgetTransfers = {
        dailyTransfer,
        weekendTransfer,
        transferAccount
      };
      
      // Save account balances
      const balances: AccountBalance[] = accounts.map(account => ({
        accountName: account,
        startingBalance: accountBalances[account] || 0,
        startingBalanceSet: accountBalancesSet[account] || false,
        finalBalance: accountFinalBalances[account] || 0,
        finalBalanceSet: accountFinalBalancesSet[account] || false,
        estimatedFinalBalance: accountEstimatedFinalBalances[account] || 0
      }));
      
      // Save configuration
      const config: BudgetConfiguration = {
        accounts,
        accountCategories,
        accountCategoryMapping,
        userNames: { userName1, userName2 }
      };
      
      // Execute saves in parallel
      await Promise.all([
        saveIncomeData(year, month, incomeData),
        saveBudgetCategories(year, month, costGroups, savingsGroups, andreasPersonalCosts, andreasPersonalSavings, susannaPersonalCosts, susannaPersonalSavings),
        saveTransferData(year, month, transfers),
        saveAccountBalances(year, month, balances),
        saveBudgetConfiguration(config),
        results ? saveBudgetCalculations(year, month, results) : Promise.resolve()
      ]);
      
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving budget data:', error);
      toast({
        title: "Error",
        description: "Failed to save budget data",
        variant: "destructive"
      });
    }
  }, [
    selectedBudgetMonth,
    autoSaveEnabled,
    andreasSalary,
    andreasförsäkringskassan,
    andreasbarnbidrag,
    susannaSalary,
    susannaförsäkringskassan,
    susannabarnbidrag,
    dailyTransfer,
    weekendTransfer,
    transferAccount,
    accounts,
    accountBalances,
    accountBalancesSet,
    accountFinalBalances,
    accountFinalBalancesSet,
    accountEstimatedFinalBalances,
    accountCategories,
    accountCategoryMapping,
    userName1,
    userName2,
    costGroups,
    savingsGroups,
    andreasPersonalCosts,
    andreasPersonalSavings,
    susannaPersonalCosts,
    susannaPersonalSavings,
    results,
    saveIncomeData,
    saveBudgetCategories,
    saveTransferData,
    saveAccountBalances,
    saveBudgetConfiguration,
    saveBudgetCalculations,
    toast
  ]);

  // Auto-save on data changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (autoSaveEnabled) {
        saveCurrentBudgetData();
      }
    }, 2000); // Save 2 seconds after last change
    
    return () => clearTimeout(timeoutId);
  }, [saveCurrentBudgetData, autoSaveEnabled]);

  // Helper function to get previous month's ending balance for calculations
  const getPreviousMonthEndingBalance = useCallback(async (accountName: string): Promise<number> => {
    if (!selectedBudgetMonth) return 0;
    
    const [currentYear, currentMonth] = selectedBudgetMonth.split('-').map(Number);
    
    // Calculate previous month
    let prevYear = currentYear;
    let prevMonth = currentMonth - 1;
    if (prevMonth === 0) {
      prevYear = currentYear - 1;
      prevMonth = 12;
    }
    
    try {
      const prevBalances = await loadAccountBalances(prevYear, prevMonth);
      if (prevBalances) {
        const prevBalance = prevBalances.find(b => b.accountName === accountName);
        if (prevBalance) {
          // Return actual final balance if set, otherwise estimated
          return prevBalance.finalBalanceSet 
            ? prevBalance.finalBalance 
            : prevBalance.estimatedFinalBalance;
        }
      }
    } catch (error) {
      console.error('Error loading previous month balance:', error);
    }
    
    return 0;
  }, [selectedBudgetMonth, loadAccountBalances]);

  // Basic calculation function (simplified version)
  const calculateBudget = useCallback(async () => {
    const totalIncome = andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + 
                       susannaSalary + susannaförsäkringskassan + susannabarnbidrag;
    
    const totalCosts = costGroups.reduce((sum, group) => sum + group.amount, 0);
    const totalSavings = savingsGroups.reduce((sum, group) => sum + group.amount, 0);
    
    const totalMonthlyExpenses = totalCosts + totalSavings;
    const balanceLeft = totalIncome - totalMonthlyExpenses;
    
    // Calculate individual shares based on income
    const andreasIncome = andreasSalary + andreasförsäkringskassan + andreasbarnbidrag;
    const susannaIncome = susannaSalary + susannaförsäkringskassan + susannabarnbidrag;
    
    const andreasPercentage = totalIncome > 0 ? (andreasIncome / totalIncome) * 100 : 50;
    const susannaPercentage = totalIncome > 0 ? (susannaIncome / totalIncome) * 100 : 50;
    
    const andreasShare = (balanceLeft * andreasPercentage) / 100;
    const susannaShare = (balanceLeft * susannaPercentage) / 100;
    
    // Simple day calculations (can be enhanced with actual holiday logic)
    const daysUntil25th = 25;
    const weekdayCount = 22; // Approximate
    const fridayCount = 4; // Approximate
    
    const totalDailyBudget = (weekdayCount * dailyTransfer) + (fridayCount * weekendTransfer);
    const remainingDailyBudget = balanceLeft - totalDailyBudget;
    
    // Calculate estimated account balances
    const newEstimatedBalances: {[key: string]: number} = {};
    for (const account of accounts) {
      const prevBalance = await getPreviousMonthEndingBalance(account);
      // Simple estimation: previous balance + some budget allocation
      newEstimatedBalances[account] = prevBalance + (balanceLeft / accounts.length);
    }
    
    setAccountEstimatedFinalBalances(newEstimatedBalances);
    
    const calculationResults = {
      totalSalary: totalIncome,
      totalDailyBudget,
      remainingDailyBudget,
      balanceLeft,
      susannaShare,
      andreasShare,
      susannaPercentage,
      andreasPercentage,
      daysUntil25th,
      weekdayCount,
      fridayCount,
      totalMonthlyExpenses,
      remainingWeekdayCount: weekdayCount,
      remainingFridayCount: fridayCount,
      estimatedAccountBalances: newEstimatedBalances
    };
    
    setResults(calculationResults);
    
    // Auto-save calculations if enabled
    if (autoSaveEnabled && selectedBudgetMonth) {
      const [year, month] = selectedBudgetMonth.split('-').map(Number);
      await saveBudgetCalculations(year, month, calculationResults);
    }
    
    return calculationResults;
  }, [
    andreasSalary, andreasförsäkringskassan, andreasbarnbidrag,
    susannaSalary, susannaförsäkringskassan, susannabarnbidrag,
    costGroups, savingsGroups, dailyTransfer, weekendTransfer,
    accounts, getPreviousMonthEndingBalance, autoSaveEnabled,
    selectedBudgetMonth, saveBudgetCalculations
  ]);

  // Recalculate when relevant data changes
  useEffect(() => {
    calculateBudget();
  }, [calculateBudget]);

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('SEK', 'kr');
  };

  // Add new cost group
  const addCostGroup = () => {
    const newGroup: BudgetGroup = {
      id: Date.now().toString(),
      name: 'Ny kostnad',
      amount: 0,
      type: 'cost'
    };
    setCostGroups([...costGroups, newGroup]);
  };

  // Add new savings group
  const addSavingsGroup = () => {
    const newGroup: BudgetGroup = {
      id: Date.now().toString(),
      name: 'Nytt sparande',
      amount: 0,
      type: 'savings'
    };
    setSavingsGroups([...savingsGroups, newGroup]);
  };

  // Update cost group
  const updateCostGroup = (id: string, field: string, value: any) => {
    setCostGroups(groups => groups.map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
  };

  // Update savings group
  const updateSavingsGroup = (id: string, field: string, value: any) => {
    setSavingsGroups(groups => groups.map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
  };

  // Remove cost group
  const removeCostGroup = (id: string) => {
    setCostGroups(groups => groups.filter(group => group.id !== id));
  };

  // Remove savings group
  const removeSavingsGroup = (id: string) => {
    setSavingsGroups(groups => groups.filter(group => group.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Budget Calculator (Database Version)
          </h1>
          <p className="text-muted-foreground">
            Hantera din budget med automatisk databassparning
          </p>
          
          {/* Status indicators */}
          <div className="flex justify-center items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${dbLoading || isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-sm text-muted-foreground">
                {dbLoading || isLoading ? 'Loading...' : 'Ready'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={autoSaveEnabled} 
                onCheckedChange={(checked) => setAutoSaveEnabled(checked === true)}
              />
              <span className="text-sm text-muted-foreground">Auto-save</span>
            </div>
            
            {lastSaved && (
              <span className="text-xs text-muted-foreground">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Month selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Select Budget Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Select value={selectedBudgetMonth} onValueChange={setSelectedBudgetMonth}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(month => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button onClick={saveCurrentBudgetData} disabled={dbLoading}>
                <Save className="h-4 w-4 mr-2" />
                Save Now
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="inkomster">Income</TabsTrigger>
            <TabsTrigger value="sammanstallning">Summary</TabsTrigger>
            <TabsTrigger value="overforing">Transfers</TabsTrigger>
            <TabsTrigger value="installningar">Settings</TabsTrigger>
          </TabsList>

          {/* Income Tab */}
          <TabsContent value="inkomster" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Monthly Income
                </CardTitle>
                <CardDescription>
                  Enter all income sources for {selectedBudgetMonth}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Andreas Income */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="andreas-salary">{userName1} - Salary</Label>
                    <Input
                      id="andreas-salary"
                      type="number"
                      value={andreasSalary}
                      onChange={(e) => setAndreasSalary(Number(e.target.value))}
                      placeholder="45000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="andreas-forsakring">{userName1} - Försäkringskassan</Label>
                    <Input
                      id="andreas-forsakring"
                      type="number"
                      value={andreasförsäkringskassan}
                      onChange={(e) => setAndreasförsäkringskassan(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="andreas-barnbidrag">{userName1} - Barnbidrag</Label>
                    <Input
                      id="andreas-barnbidrag"
                      type="number"
                      value={andreasbarnbidrag}
                      onChange={(e) => setAndreasbarnbidrag(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Susanna Income */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="susanna-salary">{userName2} - Salary</Label>
                    <Input
                      id="susanna-salary"
                      type="number"
                      value={susannaSalary}
                      onChange={(e) => setSusannaSalary(Number(e.target.value))}
                      placeholder="40000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="susanna-forsakring">{userName2} - Försäkringskassan</Label>
                    <Input
                      id="susanna-forsakring"
                      type="number"
                      value={susannaförsäkringskassan}
                      onChange={(e) => setSusannaförsäkringskassan(Number(e.target.value))}
                      placeholder="5000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="susanna-barnbidrag">{userName2} - Barnbidrag</Label>
                    <Input
                      id="susanna-barnbidrag"
                      type="number"
                      value={susannabarnbidrag}
                      onChange={(e) => setSusannabarnbidrag(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Total Income Display */}
                {results && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-semibold mb-2">Total Monthly Income</h3>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(results.totalSalary)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      {userName1}: {formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag)} ({results.andreasPercentage.toFixed(1)}%)
                      <br />
                      {userName2}: {formatCurrency(susannaSalary + susannaförsäkringskassan + susannabarnbidrag)} ({results.susannaPercentage.toFixed(1)}%)
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Budget Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost Categories */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-red-500" />
                      Costs
                    </span>
                    <Button size="sm" onClick={addCostGroup}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {costGroups.map((group) => (
                    <div key={group.id} className="flex items-center gap-2">
                      <Input
                        value={group.name}
                        onChange={(e) => updateCostGroup(group.id, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={group.amount}
                        onChange={(e) => updateCostGroup(group.id, 'amount', Number(e.target.value))}
                        className="w-32"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeCostGroup(group.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="font-semibold">
                      Total: {formatCurrency(costGroups.reduce((sum, group) => sum + group.amount, 0))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Savings Categories */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      Savings
                    </span>
                    <Button size="sm" onClick={addSavingsGroup}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {savingsGroups.map((group) => (
                    <div key={group.id} className="flex items-center gap-2">
                      <Input
                        value={group.name}
                        onChange={(e) => updateSavingsGroup(group.id, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={group.amount}
                        onChange={(e) => updateSavingsGroup(group.id, 'amount', Number(e.target.value))}
                        className="w-32"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSavingsGroup(group.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="font-semibold">
                      Total: {formatCurrency(savingsGroups.reduce((sum, group) => sum + group.amount, 0))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="sammanstallning" className="space-y-6">
            {results && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Budget Summary for {selectedBudgetMonth}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-sm text-green-600 mb-1">Total Income</div>
                      <div className="text-2xl font-bold text-green-700">
                        {formatCurrency(results.totalSalary)}
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-sm text-red-600 mb-1">Total Expenses</div>
                      <div className="text-2xl font-bold text-red-700">
                        {formatCurrency(results.totalMonthlyExpenses)}
                      </div>
                    </div>
                    
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-600 mb-1">Remaining</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {formatCurrency(results.balanceLeft)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">{userName1}</h3>
                      <div className="text-lg font-bold">
                        {formatCurrency(results.andreasShare)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {results.andreasPercentage.toFixed(1)}% of remaining
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">{userName2}</h3>
                      <div className="text-lg font-bold">
                        {formatCurrency(results.susannaShare)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {results.susannaPercentage.toFixed(1)}% of remaining
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-semibold mb-2">Daily Budget</h3>
                    <div className="text-lg font-bold">
                      {formatCurrency(results.totalDailyBudget)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      After daily transfers: {formatCurrency(results.remainingDailyBudget)} remaining
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="overforing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Daily Transfers
                </CardTitle>
                <CardDescription>
                  Set up automatic daily and weekend transfers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daily-transfer">Daily Transfer (Mon-Thu)</Label>
                    <Input
                      id="daily-transfer"
                      type="number"
                      value={dailyTransfer}
                      onChange={(e) => setDailyTransfer(Number(e.target.value))}
                      placeholder="300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weekend-transfer">Weekend Transfer (Fri)</Label>
                    <Input
                      id="weekend-transfer"
                      type="number"
                      value={weekendTransfer}
                      onChange={(e) => setWeekendTransfer(Number(e.target.value))}
                      placeholder="540"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transfer-account">Transfer Account</Label>
                    <Input
                      id="transfer-account"
                      type="number"
                      value={transferAccount}
                      onChange={(e) => setTransferAccount(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </div>

                {results && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-semibold mb-2">Transfer Summary</h3>
                    <div className="space-y-1 text-sm">
                      <div>Total monthly transfers: {formatCurrency(results.totalDailyBudget)}</div>
                      <div>Weekdays ({results.weekdayCount}): {formatCurrency(results.weekdayCount * dailyTransfer)}</div>
                      <div>Fridays ({results.fridayCount}): {formatCurrency(results.fridayCount * weekendTransfer)}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="installningar" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>
                  Manage accounts and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-name-1">User Name 1</Label>
                    <Input
                      id="user-name-1"
                      value={userName1}
                      onChange={(e) => setUserName1(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-name-2">User Name 2</Label>
                    <Input
                      id="user-name-2"
                      value={userName2}
                      onChange={(e) => setUserName2(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Accounts</Label>
                  <div className="text-sm text-muted-foreground">
                    Current accounts: {accounts.join(', ')}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Button onClick={saveCurrentBudgetData} disabled={dbLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Configuration
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={autoSaveEnabled} 
                      onCheckedChange={(checked) => setAutoSaveEnabled(checked === true)}
                    />
                    <Label>Enable Auto-save</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BudgetCalculatorDB;