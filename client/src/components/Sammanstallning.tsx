import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PiggyBank,
  Target,
  AlertCircle,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  ChevronRight,
  Sparkles,
  Zap,
  Trophy,
  CheckCircle2,
  XCircle,
  Users
} from 'lucide-react';
import { BudgetState } from '@/types/budget';
import { useAccounts } from '@/hooks/useAccounts';
import { useAccountTypes } from '@/hooks/useAccountTypes';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgetPosts } from '@/hooks/useBudgetPosts';
import { useMonthlyAccountBalances } from '@/hooks/useMonthlyAccountBalances';
import { useHuvudkategorier, useUnderkategorier } from '@/hooks/useCategories';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useInkomstkallor } from '@/hooks/useInkomstkallor';
import { formatOrenAsCurrency, kronoraToOren } from '@/utils/currencyUtils';
import { getDateRangeForMonth } from '../services/calculationService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar
} from 'recharts';

interface SammanstallningProps {
  budgetState: BudgetState;
  selectedMonth: string;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export const Sammanstallning: React.FC<SammanstallningProps> = ({
  budgetState,
  selectedMonth
}) => {
  const { data: accounts = [] } = useAccounts();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: transactions = [] } = useTransactions();
  const { data: budgetPosts = [] } = useBudgetPosts(selectedMonth);
  const { data: monthlyBalances = [] } = useMonthlyAccountBalances(selectedMonth);
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: underkategorier = [] } = useUnderkategorier();
  const { data: familyMembers = [] } = useFamilyMembers();
  const { data: inkomstkallor = [] } = useInkomstkallor();
  
  const [activeView, setActiveView] = useState<'overview' | 'trends' | 'categories' | 'accounts'>('overview');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [showSubcategories, setShowSubcategories] = useState<boolean>(false);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<'all' | 'account-type' | string>('all');
  const [selectedAccountTypeId, setSelectedAccountTypeId] = useState<string>('');

  // Get date range for the selected month
  const { startDate, endDate } = useMemo(() => {
    const payday = budgetState.settings?.payday || 25;
    return getDateRangeForMonth(selectedMonth, payday);
  }, [selectedMonth, budgetState.settings?.payday]);

  // Filter transactions for the selected period
  const transactionsForPeriod = useMemo(() => {
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= new Date(startDate) && transactionDate <= new Date(endDate);
    });
  }, [transactions, startDate, endDate]);

  // Filter transactions based on account filter (for trends analysis)
  const filteredTransactionsForTrends = useMemo(() => {
    if (selectedAccountFilter === 'all') {
      return transactionsForPeriod;
    } else if (selectedAccountFilter === 'account-type' && selectedAccountTypeId) {
      // Filter by account type
      const accountsOfType = accounts.filter(acc => acc.accountTypeId === selectedAccountTypeId);
      const accountIds = accountsOfType.map(acc => acc.id);
      return transactionsForPeriod.filter(t => accountIds.includes(t.accountId));
    } else if (selectedAccountFilter !== 'all' && selectedAccountFilter !== 'account-type') {
      // Filter by specific account ID
      return transactionsForPeriod.filter(t => t.accountId === selectedAccountFilter);
    }
    return transactionsForPeriod;
  }, [transactionsForPeriod, selectedAccountFilter, selectedAccountTypeId, accounts]);

  // Income breakdown by family member and source
  const incomeBreakdown = useMemo(() => {
    const incomePosts = budgetPosts.filter(post => post.type === 'Inkomst');
    
    // Group by family member and income source
    const breakdown = new Map();
    
    incomePosts.forEach(post => {
      const memberId = post.familjemedlemId || 'unknown';
      const sourceId = post.idInkomstkalla || 'unknown';
      
      if (!breakdown.has(memberId)) {
        breakdown.set(memberId, new Map());
      }
      
      const memberBreakdown = breakdown.get(memberId);
      if (!memberBreakdown.has(sourceId)) {
        memberBreakdown.set(sourceId, 0);
      }
      
      memberBreakdown.set(sourceId, memberBreakdown.get(sourceId) + (post.amount || 0));
    });
    
    // Convert to structured data
    const result = [];
    breakdown.forEach((sources, memberId) => {
      const member = familyMembers.find(m => m.id === memberId);
      const memberName = member?.name || 'Okänd';
      
      const sourcesArray = [];
      sources.forEach((amount, sourceId) => {
        const source = inkomstkallor.find(s => s.id === sourceId);
        sourcesArray.push({
          sourceId,
          sourceName: source?.text || 'Okänd källa',
          amount
        });
      });
      
      result.push({
        memberId,
        memberName,
        sources: sourcesArray,
        total: sourcesArray.reduce((sum, s) => sum + s.amount, 0)
      });
    });
    
    return result;
  }, [budgetPosts, familyMembers, inkomstkallor]);

  // Payment breakdown by family member (linked_person)
  const paymentBreakdown = useMemo(() => {
    // Get all Payment type transactions with linkedPerson
    const paymentTransactions = transactionsForPeriod.filter(tx => 
      tx.type === 'Payment' && tx.amount < 0 && tx.linkedPerson
    );
    
    // Group by family member
    const breakdown = new Map();
    
    paymentTransactions.forEach(tx => {
      const memberId = tx.linkedPerson;
      const amount = Math.abs(tx.amount);
      
      if (!breakdown.has(memberId)) {
        breakdown.set(memberId, 0);
      }
      
      breakdown.set(memberId, breakdown.get(memberId) + amount);
    });
    
    // Convert to structured data with percentages
    const totalPayments = Array.from(breakdown.values()).reduce((sum, amount) => sum + amount, 0);
    
    const result = [];
    breakdown.forEach((amount, memberId) => {
      const member = familyMembers.find(m => m.id === memberId);
      const percentage = totalPayments > 0 ? (amount / totalPayments) * 100 : 0;
      
      result.push({
        memberId,
        memberName: member?.name || 'Okänd',
        amount,
        percentage: Math.round(percentage)
      });
    });
    
    // Sort by amount descending
    return result.sort((a, b) => b.amount - a.amount);
  }, [transactionsForPeriod, familyMembers]);

  // Calculate key metrics
  const metrics = useMemo(() => {
    // Income calculation
    const incomePosts = budgetPosts.filter(post => post.type === 'Inkomst');
    const totalIncome = incomePosts.reduce((sum, post) => sum + (post.amount || 0), 0);

    // Costs calculation
    const costPosts = budgetPosts.filter(post => post.type === 'cost');
    const totalBudgetedCosts = costPosts.reduce((sum, post) => sum + (post.amount || 0), 0);

    // Transfers calculation
    const transferPosts = budgetPosts.filter(post => post.type === 'transfer');
    const totalTransfers = transferPosts.reduce((sum, post) => sum + (post.amount || 0), 0);

    // Savings calculation - use actual Savings transactions
    const actualSavings = transactionsForPeriod
      .filter(t => t.type === 'Savings')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Actual spending from transactions (only negative Transaction type)
    const actualSpending = transactionsForPeriod
      .filter(t => t.type === 'Transaction' && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Actual income from transactions (positive Transaction type)
    const actualIncome = transactionsForPeriod
      .filter(t => t.type === 'Transaction' && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    // Budget utilization
    const budgetUtilization = totalBudgetedCosts > 0 
      ? (actualSpending / totalBudgetedCosts) * 100 
      : 0;

    // Available budget
    const availableBudget = totalIncome - totalBudgetedCosts - actualSavings;

    // Savings rate
    const savingsRate = totalIncome > 0 
      ? (actualSavings / totalIncome) * 100 
      : 0;

    return {
      totalIncome,
      totalBudgetedCosts,
      totalTransfers,
      totalSavings: actualSavings,
      actualSpending,
      actualIncome,
      budgetUtilization,
      availableBudget,
      savingsRate,
      transactionCount: transactionsForPeriod.length
    };
  }, [budgetPosts, transactionsForPeriod]);

  // Category spending analysis - Based on actual transactions
  const categoryAnalysis = useMemo(() => {
    const categorySpending = new Map<string, { budgeted: number; actual: number; name: string; subCategories: Map<string, number> }>();
    
    const costPosts = budgetPosts.filter(post => post.type === 'cost');

    // Group budget posts by category
    costPosts.forEach(post => {
      if (post.huvudkategoriId) {
        const category = huvudkategorier.find(h => h.id === post.huvudkategoriId);
        if (category) {
          const existing = categorySpending.get(post.huvudkategoriId) || { 
            budgeted: 0, 
            actual: 0, 
            name: category.name,
            subCategories: new Map()
          };
          existing.budgeted += post.amount || 0;
          categorySpending.set(post.huvudkategoriId, existing);
        }
      }
    });

    // Calculate actual spending from transactions (negative amounts only)
    transactionsForPeriod.forEach(transaction => {
      // Only count negative transactions (expenses) with type 'Transaction'
      if (transaction.type === 'Transaction' && transaction.amount < 0) {
        // Use appCategoryId for main category
        const categoryId = transaction.appCategoryId;
        const subCategoryId = transaction.appSubCategoryId;
        
        if (categoryId) {
          // Find or create category entry
          let categoryEntry = categorySpending.get(categoryId);
          
          if (!categoryEntry) {
            const category = huvudkategorier.find(h => h.id === categoryId);
            categoryEntry = {
              budgeted: 0,
              actual: 0,
              name: category?.name || 'Okänd kategori',
              subCategories: new Map()
            };
            categorySpending.set(categoryId, categoryEntry);
          }
          
          // Add to actual spending
          const amount = Math.abs(transaction.amount);
          categoryEntry.actual += amount;
          
          // Track subcategory spending
          if (subCategoryId) {
            const currentSubAmount = categoryEntry.subCategories.get(subCategoryId) || 0;
            categoryEntry.subCategories.set(subCategoryId, currentSubAmount + amount);
          }
        }
      }
    });

    // Add uncategorized transactions
    const uncategorizedAmount = transactionsForPeriod
      .filter(t => t.type === 'Transaction' && t.amount < 0 && (!t.appCategoryId || !t.appSubCategoryId))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const result = Array.from(categorySpending.values());
    
    // Add uncategorized if there are any
    if (uncategorizedAmount > 0) {
      result.push({
        budgeted: 0,
        actual: uncategorizedAmount,
        name: 'Okategoriserad',
        subCategories: new Map()
      });
    }

    return result
      .sort((a, b) => b.actual - a.actual) // Sort by actual spending instead of budgeted
      .slice(0, 8); // Top 8 categories
  }, [budgetPosts, transactionsForPeriod, huvudkategorier]);

  // Subcategory analysis for selected categories
  const subcategoryAnalysis = useMemo(() => {
    const subcategorySpending = new Map<string, { 
      actual: number; 
      name: string; 
      categoryId: string; 
      categoryName: string; 
    }>();

    transactionsForPeriod.forEach(transaction => {
      if (transaction.type === 'Transaction' && transaction.amount < 0 && 
          transaction.appCategoryId && transaction.appSubCategoryId &&
          selectedCategories.includes(transaction.appCategoryId)) {
        
        const subcategory = underkategorier.find(uk => uk.id === transaction.appSubCategoryId);
        const category = huvudkategorier.find(hk => hk.id === transaction.appCategoryId);
        
        if (subcategory && category) {
          const amount = Math.abs(transaction.amount);
          const existing = subcategorySpending.get(subcategory.id) || {
            actual: 0,
            name: subcategory.name,
            categoryId: category.id,
            categoryName: category.name
          };
          existing.actual += amount;
          subcategorySpending.set(subcategory.id, existing);
        }
      }
    });

    return Array.from(subcategorySpending.values())
      .sort((a, b) => b.actual - a.actual);
  }, [transactionsForPeriod, underkategorier, huvudkategorier, selectedCategories]);

  // Account balances summary with detailed transaction breakdown
  const accountSummary = useMemo(() => {
    return accounts.map(account => {
      const balance = monthlyBalances.find(b => b.accountId === account.id);
      const accountTransactions = transactionsForPeriod.filter(t => t.accountId === account.id);
      
      // Inkommande överföringar: All positive transactions that are transfers (InternalTransfer type OR have linkedTransactionId)
      const incomingTransfers = accountTransactions
        .filter(t => t.amount > 0 && (t.type === 'InternalTransfer' || t.linkedTransactionId))
        .reduce((sum, t) => sum + t.amount, 0);

      // Utgående överföringar: All negative transactions that are transfers (InternalTransfer type OR have linkedTransactionId)
      const outgoingTransfers = accountTransactions
        .filter(t => t.amount < 0 && (t.type === 'InternalTransfer' || t.linkedTransactionId))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Inkomster: Transaction type "Income" (should be positive)
      const incomes = accountTransactions
        .filter(t => t.type === 'Income')
        .reduce((sum, t) => sum + Math.max(0, t.amount), 0); // Ensure positive

      // Kostnader: Transaction type "Transaction" with negative amount
      const costs = accountTransactions
        .filter(t => t.type === 'Transaction' && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Legacy totals for compatibility
      const totalIn = incomingTransfers + incomes;
      const totalOut = outgoingTransfers + costs;

      return {
        id: account.id,
        name: account.name,
        currentBalance: balance?.calculatedBalance || 0,
        actualBalance: (balance?.faktisktKontosaldo != null) 
          ? balance.faktisktKontosaldo 
          : balance?.calculatedBalance || 0,
        // Detailed breakdown
        incomingTransfers,
        outgoingTransfers,
        incomes,
        costs,
        // Legacy totals
        totalIn,
        totalOut,
        netFlow: totalIn - totalOut,
        transactionCount: accountTransactions.length
      };
    });
  }, [accounts, monthlyBalances, transactionsForPeriod]);

  // Daily spending trend (use filtered transactions for trends view)
  const dailyTrend = useMemo(() => {
    const dailyData = new Map<string, { income: number; expenses: number }>();
    
    // Use filtered transactions if we're in trends view, otherwise use all transactions
    const transactionsToUse = activeView === 'trends' ? filteredTransactionsForTrends : transactionsForPeriod;
    
    transactionsToUse.forEach(t => {
      // Count ALL transaction types for comprehensive cash flow
      const date = new Date(t.date).toISOString().split('T')[0];
      const existing = dailyData.get(date) || { income: 0, expenses: 0 };
      
      if (t.amount > 0) {
        existing.income += t.amount;
      } else {
        existing.expenses += Math.abs(t.amount);
      }
      
      dailyData.set(date, existing);
    });

    return Array.from(dailyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        income: data.income / 100,
        expenses: data.expenses / 100
      }));
  }, [transactionsForPeriod, filteredTransactionsForTrends, activeView]);

  // Category trend analysis - for selected categories
  const categoryTrend = useMemo(() => {
    if (selectedCategories.length === 0 && selectedSubcategories.length === 0) return [];
    
    const dailyData = new Map<string, Map<string, number>>();
    
    transactionsForPeriod.forEach(t => {
      if (t.type === 'Transaction' && t.amount < 0) {
        const date = new Date(t.date).toISOString().split('T')[0];
        
        if (!dailyData.has(date)) {
          dailyData.set(date, new Map());
        }
        
        const dateCategories = dailyData.get(date)!;
        
        // Handle main categories (if showing aggregated)
        if (!showSubcategories) {
          // Handle properly categorized transactions
          if (t.appCategoryId && t.appSubCategoryId && selectedCategories.includes(t.appCategoryId)) {
            const currentAmount = dateCategories.get(t.appCategoryId) || 0;
            dateCategories.set(t.appCategoryId, currentAmount + Math.abs(t.amount));
          }
          // Handle uncategorized transactions (missing either main or sub category)
          else if ((!t.appCategoryId || !t.appSubCategoryId) && selectedCategories.includes('uncategorized')) {
            const currentAmount = dateCategories.get('uncategorized') || 0;
            dateCategories.set('uncategorized', currentAmount + Math.abs(t.amount));
          }
        }
        
        // Handle subcategories
        if (showSubcategories && t.appSubCategoryId && selectedSubcategories.includes(t.appSubCategoryId)) {
          const currentAmount = dateCategories.get(t.appSubCategoryId) || 0;
          dateCategories.set(t.appSubCategoryId, currentAmount + Math.abs(t.amount));
        }
      }
    });

    // Convert to array format for chart
    const result = Array.from(dailyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => {
        const dataPoint: any = { date };
        
        if (showSubcategories) {
          // Show subcategories
          selectedSubcategories.forEach(subCatId => {
            const subcategory = underkategorier.find(uk => uk.id === subCatId);
            const category = huvudkategorier.find(hk => hk.id === subcategory?.huvudkategoriId);
            const displayName = subcategory ? `${category?.name} - ${subcategory.name}` : 'Okänd';
            dataPoint[displayName] = data.get(subCatId) || 0;
          });
        } else {
          // Show main categories
          selectedCategories.forEach(catId => {
            if (catId === 'uncategorized') {
              dataPoint['Okategoriserad'] = data.get('uncategorized') || 0;
            } else {
              const category = huvudkategorier.find(h => h.id === catId);
              const categoryName = category?.name || 'Okänd';
              dataPoint[categoryName] = data.get(catId) || 0;
            }
          });
        }
        
        return dataPoint;
      });

    return result;
  }, [transactionsForPeriod, selectedCategories, selectedSubcategories, showSubcategories, huvudkategorier, underkategorier]);

  // Format currency
  const formatCurrency = (amount: number) => formatOrenAsCurrency(amount);

  // Get month name
  const getMonthName = () => {
    const [year, month] = selectedMonth.split('-');
    const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                       'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Sammanställning
            </h1>
            <p className="text-lg text-muted-foreground mt-2">{getMonthName()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1.5 text-sm">
              <Calendar className="w-4 h-4 mr-2" />
              {startDate} - {endDate}
            </Badge>
          </div>
        </div>

        {/* View Tabs */}
        <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)} className="w-full">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Översikt
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Trender
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Alla konton
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Kategorier
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Income Card */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-200 rounded-full -mr-16 -mt-16 opacity-20" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Total Inkomst
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-900">
                    {formatCurrency(metrics.totalIncome)}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <ArrowUpRight className="w-3 h-3 mr-1" />
                      {formatCurrency(metrics.actualIncome)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">faktisk</span>
                  </div>
                </CardContent>
              </Card>

              {/* Budget Utilization Card */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200 rounded-full -mr-16 -mt-16 opacity-20" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Budgetutnyttjande
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-900">
                    {metrics.budgetUtilization.toFixed(1)}%
                  </div>
                  <Progress value={metrics.budgetUtilization} className="mt-2 h-2" />
                  <div className="text-xs text-muted-foreground mt-2">
                    {formatCurrency(metrics.actualSpending)} av {formatCurrency(metrics.totalBudgetedCosts)}
                  </div>
                </CardContent>
              </Card>

              {/* Savings Rate Card */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200 rounded-full -mr-16 -mt-16 opacity-20" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
                    <PiggyBank className="w-4 h-4" />
                    Sparkvot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-900">
                    {metrics.savingsRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-purple-600 mt-2">
                    {formatCurrency(metrics.totalSavings)} sparat
                  </div>
                  <div className="mt-2">
                    <Progress value={metrics.savingsRate} className="h-2 bg-purple-100" />
                  </div>
                </CardContent>
              </Card>

              {/* Available Budget Card */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-amber-50 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200 rounded-full -mr-16 -mt-16 opacity-20" />
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Tillgängligt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${metrics.availableBudget >= 0 ? 'text-orange-900' : 'text-red-600'}`}>
                    {formatCurrency(metrics.availableBudget)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Efter kostnader & sparande
                  </div>
                  {metrics.availableBudget < 0 && (
                    <Badge variant="destructive" className="mt-2">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Överbudget
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Income Breakdown Section */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Inkomstfördelning per Person
                </CardTitle>
                <CardDescription>
                  Detaljerad översikt av inkomster per familjemedlem och källa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {incomeBreakdown.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Inga inkomster registrerade för denna månad</p>
                  ) : (
                    incomeBreakdown.map((member) => (
                      <div key={member.memberId} className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-lg text-green-900">{member.memberName}</h4>
                          <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1">
                            Total: {formatCurrency(member.total)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {member.sources.map((source) => (
                            <div key={source.sourceId} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-green-200">
                              <span className="text-sm text-gray-700">{source.sourceName}</span>
                              <span className="font-medium text-green-700">{formatCurrency(source.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {member.sources.length > 1 && (
                          <div className="mt-2 pt-2 border-t border-green-200">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span>Antal inkomstkällor: {member.sources.length}</span>
                              <span>Genomsnitt per källa: {formatCurrency(member.total / member.sources.length)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  
                  {/* Total Income Summary */}
                  {incomeBreakdown.length > 0 && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total hushållsinkomst</p>
                          <p className="text-2xl font-bold text-blue-900">
                            {formatCurrency(incomeBreakdown.reduce((sum, m) => sum + m.total, 0))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Antal personer med inkomst</p>
                          <p className="text-xl font-semibold text-blue-800">{incomeBreakdown.length}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Income Distribution Chart */}
            {incomeBreakdown.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-green-500" />
                    Inkomstfördelning Visualisering
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pie Chart by Person */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Per Person</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <RePieChart>
                          <Pie
                            data={incomeBreakdown.map(member => ({
                              name: member.memberName,
                              value: member.total
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {incomeBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => formatCurrency(value)} />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Bar Chart by Income Source */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Per Inkomstkälla</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={(() => {
                          const sourceMap = new Map();
                          incomeBreakdown.forEach(member => {
                            member.sources.forEach(source => {
                              if (sourceMap.has(source.sourceName)) {
                                sourceMap.set(source.sourceName, sourceMap.get(source.sourceName) + source.amount);
                              } else {
                                sourceMap.set(source.sourceName, source.amount);
                              }
                            });
                          });
                          return Array.from(sourceMap.entries()).map(([name, amount]) => ({
                            name,
                            amount: amount / 100
                          }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <Tooltip formatter={(value: any) => formatCurrency(value)} />
                          <Bar dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Breakdown Section */}
            {paymentBreakdown.length > 0 && (
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-500" />
                    Utbetalning
                  </CardTitle>
                  <CardDescription>
                    Fördelning av utbetalningar per familjemedlem
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Per Person</h4>
                      <div className="space-y-3">
                        {paymentBreakdown.map((member) => (
                          <div key={member.memberId} className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-orange-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{member.memberName}</p>
                                <p className="text-sm text-gray-600">{member.percentage}%</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-orange-900">{formatCurrency(member.amount)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Total Payment Summary */}
                    <div className="p-4 bg-gradient-to-r from-orange-100 to-amber-100 rounded-lg border border-orange-300">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total utbetalningar</p>
                          <p className="text-2xl font-bold text-orange-900">
                            {formatCurrency(paymentBreakdown.reduce((sum, m) => sum + m.amount, 0))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Antal personer</p>
                          <p className="text-xl font-semibold text-orange-800">{paymentBreakdown.length}</p>
                        </div>
                      </div>
                    </div>

                    {/* Payment Distribution Chart */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Visualisering</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <RePieChart>
                          <Pie
                            data={paymentBreakdown.map(member => ({
                              name: member.memberName,
                              value: member.amount
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#f97316"
                            dataKey="value"
                          >
                            {paymentBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#f97316', '#fb923c', '#fdba74', '#fed7aa'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => formatCurrency(value)} />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Insights Section */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  Snabba Insikter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Budget Health */}
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        metrics.budgetUtilization <= 90 ? 'bg-green-100' : 
                        metrics.budgetUtilization <= 100 ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                        {metrics.budgetUtilization <= 90 ? 
                          <CheckCircle2 className="w-6 h-6 text-green-600" /> :
                          metrics.budgetUtilization <= 100 ?
                          <AlertCircle className="w-6 h-6 text-yellow-600" /> :
                          <XCircle className="w-6 h-6 text-red-600" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Budgethälsa</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {metrics.budgetUtilization <= 90 ? 'Utmärkt! Du håller dig inom budget.' :
                           metrics.budgetUtilization <= 100 ? 'Bra, men nära budgetgränsen.' :
                           'Överbudget! Se över dina utgifter.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Top Spending Category */}
                  {categoryAnalysis[0] && (
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <DollarSign className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Största utgift</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {categoryAnalysis[0].name}: {formatCurrency(categoryAnalysis[0].actual)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Transaction Activity */}
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Transaktioner</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {metrics.transactionCount} transaktioner denna period
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top 10 Largest Expenses */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-orange-500" />
                    Top 10 Största Kostnaderna
                  </h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {transactionsForPeriod
                      .filter(t => t.type === 'Transaction' && t.amount < 0)
                      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                      .slice(0, 10)
                      .map((transaction, index) => {
                        const categoryName = huvudkategorier.find(h => h.id === transaction.appCategoryId)?.name || 'Okänd kategori';
                        const subCategoryName = underkategorier.find(u => u.id === transaction.appSubCategoryId)?.name || '';
                        const accountName = accounts.find(a => a.id === transaction.accountId)?.name || 'Okänt konto';
                        
                        return (
                          <div key={transaction.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                <span className="text-sm font-bold text-red-600">#{index + 1}</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                    {transaction.description}
                                  </p>
                                  <Badge variant="outline" className="text-xs">
                                    {new Date(transaction.date).toLocaleDateString('sv-SE')}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                    {categoryName}
                                  </span>
                                  {subCategoryName && (
                                    <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                      {subCategoryName}
                                    </span>
                                  )}
                                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                    {accountName}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-red-600">
                                -{formatCurrency(Math.abs(transaction.amount))}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    }
                    {transactionsForPeriod.filter(t => t.type === 'Transaction' && t.amount < 0).length === 0 && (
                      <p className="text-center text-gray-500 py-8">Inga kostnadstransaktioner hittades för denna period</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Budget vs Actual Chart */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Budget vs Faktiskt per Kategori</CardTitle>
                <CardDescription>Jämförelse mellan budgeterat och faktiskt spenderat</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatCurrency(value * 100)} />
                    <Legend />
                    <Bar dataKey="budgeted" name="Budgeterat" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="actual" name="Faktiskt" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="mt-6 space-y-6">
            {/* Account Filter */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Activity className="w-5 h-5" />
                  Kontofiltrera Trender
                </CardTitle>
                <CardDescription className="text-blue-700">
                  Välj vilka konton eller kontotyper du vill analysera i trenderna
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-blue-800 mb-2 block">
                      Filtrera efter:
                    </Label>
                    <Select value={selectedAccountFilter} onValueChange={setSelectedAccountFilter}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Välj filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4" />
                            Kategorier
                          </div>
                        </SelectItem>
                        <SelectItem value="account-type">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Filtrera efter kontotyp
                          </div>
                        </SelectItem>
                        {accounts.map(account => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              {account.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedAccountFilter === 'account-type' && (
                    <div className="flex-1">
                      <Label className="text-sm font-medium text-blue-800 mb-2 block">
                        Välj kontotyp:
                      </Label>
                      <Select value={selectedAccountTypeId} onValueChange={setSelectedAccountTypeId}>
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue placeholder="Välj kontotyp" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountTypes.map(type => (
                            <SelectItem key={type.id} value={type.id}>
                              <div className="flex items-center gap-2">
                                <PiggyBank className="w-4 h-4" />
                                {type.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Filter Summary */}
                  <div className="text-sm text-blue-600 bg-white rounded-lg p-3 border border-blue-200">
                    <div className="font-medium mb-1">Aktuellt filter:</div>
                    {selectedAccountFilter === 'all' && (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-blue-700 border-blue-300">
                          Kategorier ({accounts.length})
                        </Badge>
                      </div>
                    )}
                    {selectedAccountFilter === 'account-type' && selectedAccountTypeId && (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-purple-700 border-purple-300">
                          {accountTypes.find(t => t.id === selectedAccountTypeId)?.name || 'Okänd typ'}
                        </Badge>
                        <span className="text-xs">
                          ({accounts.filter(a => a.accountTypeId === selectedAccountTypeId).length} konton)
                        </span>
                      </div>
                    )}
                    {selectedAccountFilter !== 'all' && selectedAccountFilter !== 'account-type' && (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          {accounts.find(a => a.id === selectedAccountFilter)?.name || 'Okänt konto'}
                        </Badge>
                      </div>
                    )}
                    <div className="text-xs text-blue-500 mt-1">
                      {filteredTransactionsForTrends.length} transaktioner
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Spending Trend */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Daglig Utgifts- och Inkomsttrend
                  {selectedAccountFilter !== 'all' && (
                    <Badge variant="outline" className="text-xs">
                      Filtrerat
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Översikt över dagliga transaktioner. Alla positiva transaktioner visas som inkomst, alla negativa som utgifter.
                  {selectedAccountFilter !== 'all' && 
                    ` (${filteredTransactionsForTrends.length} transaktioner i filter)`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatCurrency(value * 100)} />
                    <Legend />
                    <Area type="monotone" dataKey="income" name="Inkomst" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="expenses" name="Utgifter" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cumulative Balance Trend */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Ackumulerat Kassaflöde
                  {selectedAccountFilter !== 'all' && (
                    <Badge variant="outline" className="text-xs">
                      Filtrerat
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Hur ditt kassaflöde utvecklas över månaden från payday-saldo. 
                  Alla positiva transaktioner räknas som inkomst, alla negativa som utgifter.
                  {selectedAccountFilter !== 'all' && 
                    ` (${filteredTransactionsForTrends.length} transaktioner i filter)`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={(() => {
                    // Calculate starting balance from account balances on payday
                    // For the current selectedMonth, use ALL accounts from monthlyBalances
                    const startingBalance = monthlyBalances.reduce((total, balance) => {
                      // Use account_user_balance if it has a value (not null/undefined), otherwise use account_balance
                      const accountStartBalance = (balance.faktisktKontosaldo != null) 
                        ? balance.faktisktKontosaldo 
                        : balance.calculatedBalance ?? 0;
                      console.log(`🏦 [Cumulative] Balance entry ${balance.id}:`, {
                        accountId: balance.accountId,
                        faktisktKontosaldo: balance.faktisktKontosaldo,
                        calculatedBalance: balance.calculatedBalance,
                        usedBalance: accountStartBalance,
                        nullCheck: balance.faktisktKontosaldo != null
                      });
                      return total + accountStartBalance;
                    }, 0);
                    
                    console.log(`💰 [Cumulative] Total starting balance for ${selectedMonth}:`, {
                      startingBalance,
                      formattedBalance: formatCurrency(startingBalance),
                      accountCount: accounts.length,
                      monthlyBalancesCount: monthlyBalances.length
                    });

                    // Create daily cumulative data starting from payday balance
                    let runningBalance = startingBalance;
                    
                    return dailyTrend.map((d, i) => {
                      // Get transactions for this specific date (use filtered transactions for trends)
                      const transactionsToFilter = activeView === 'trends' ? filteredTransactionsForTrends : transactionsForPeriod;
                      const dayTransactions = transactionsToFilter.filter(t => {
                        const transactionDate = new Date(t.date).toISOString().split('T')[0];
                        return transactionDate === d.date;
                      });

                      // Calculate net change for this day from actual transactions
                      // Count ALL positive transactions as income (any transaction type with positive amount)
                      const dayIncomeTransactions = dayTransactions
                        .filter(t => t.amount > 0)
                        .reduce((sum, t) => sum + t.amount, 0);

                      // Count ALL negative transactions as costs (any transaction type with negative amount)
                      const dayCostTransactions = dayTransactions
                        .filter(t => t.amount < 0)
                        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

                      const netDayChange = dayIncomeTransactions - dayCostTransactions;
                      runningBalance += netDayChange;

                      return {
                        ...d,
                        cumulative: runningBalance / 100, // Convert to kronor for display
                        dailyIncome: dayIncomeTransactions / 100,
                        dailyCosts: dayCostTransactions / 100,
                        netChange: netDayChange / 100,
                        startingBalanceForDay: (runningBalance - netDayChange) / 100
                      };
                    });
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        formatCurrency(value * 100), 
                        name === 'cumulative' ? 'Ackumulerat saldo' :
                        name === 'dailyIncome' ? 'Inkomst denna dag' :
                        name === 'dailyCosts' ? 'Kostnader denna dag' :
                        name === 'netChange' ? 'Nettoförändring' :
                        name
                      ]}
                      labelFormatter={(date) => `Datum: ${date}`}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border rounded shadow-lg">
                              <p className="font-medium">{`Datum: ${label}`}</p>
                              <p className="text-purple-600">
                                {`Ackumulerat saldo: ${formatCurrency(data.cumulative * 100)}`}
                              </p>
                              <p className="text-green-600">
                                {`Alla positiva transaktioner: ${formatCurrency(data.dailyIncome * 100)}`}
                              </p>
                              <p className="text-red-600">
                                {`Alla negativa transaktioner: ${formatCurrency(data.dailyCosts * 100)}`}
                              </p>
                              <p className="text-blue-600">
                                {`Nettoförändring: ${formatCurrency(data.netChange * 100)}`}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="cumulative" 
                      name="Ackumulerat Saldo" 
                      stroke="#8b5cf6" 
                      strokeWidth={3}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                
                {/* Starting Balance Info */}
                <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-700 font-medium">Startsaldo på payday ({startDate})</p>
                      <p className="text-lg font-bold text-purple-900">
                        {formatCurrency(monthlyBalances.reduce((total, balance) => {
                          const accountStartBalance = (balance.faktisktKontosaldo != null) 
                            ? balance.faktisktKontosaldo 
                            : balance.calculatedBalance ?? 0;
                          return total + accountStartBalance;
                        }, 0))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-purple-700">Månad: {selectedMonth}</p>
                      <p className="text-xs text-purple-600">
                        {monthlyBalances.some(b => b.faktisktKontosaldo != null) 
                          ? 'Användarens saldo prioriterat' 
                          : 'Beräknat saldo'}
                      </p>
                      <p className="text-xs text-purple-500 mt-1">
                        {monthlyBalances.length} balansdata
                      </p>
                    </div>
                  </div>
                  
                  {/* Debug info in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <details className="mt-3">
                      <summary className="text-xs text-purple-600 cursor-pointer">Debug: Kontodetaljer</summary>
                      <div className="mt-2 text-xs space-y-1">
                        {monthlyBalances.map(balance => {
                          const account = accounts.find(a => a.id === balance.accountId);
                          const accountStartBalance = (balance.faktisktKontosaldo != null) 
                            ? balance.faktisktKontosaldo 
                            : balance.calculatedBalance ?? 0;
                          return (
                            <div key={balance.id} className="flex justify-between">
                              <span>{account?.name || 'Unknown Account'}</span>
                              <span>
                                {formatCurrency(accountStartBalance)}
                                {balance.faktisktKontosaldo != null ? ' (user)' : ' (calc)'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="mt-6 space-y-6">
            {/* Enhanced Category Performance with Subcategories */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Kategoriprestation</CardTitle>
                <CardDescription>Välj kategorier och underkategorier för att se deras utgiftstrend över månaden</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Display Mode Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="show-categories"
                          name="display-mode"
                          checked={!showSubcategories}
                          onChange={() => {
                            setShowSubcategories(false);
                            setSelectedSubcategories([]);
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="show-categories" className="text-sm font-medium cursor-pointer">
                          Visa huvudkategorier
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="show-subcategories"
                          name="display-mode"
                          checked={showSubcategories}
                          onChange={() => setShowSubcategories(true)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="show-subcategories" className="text-sm font-medium cursor-pointer">
                          Visa underkategorier
                        </label>
                      </div>
                    </div>
                    {selectedCategories.length > 0 && !showSubcategories && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCategories([])}
                      >
                        Rensa alla
                      </Button>
                    )}
                    {selectedSubcategories.length > 0 && showSubcategories && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSubcategories([])}
                      >
                        Rensa alla
                      </Button>
                    )}
                  </div>

                  {!showSubcategories ? (
                    /* Main Categories Selection */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Välj huvudkategorier att jämföra:</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const allCatIds = categoryAnalysis.map(cat => 
                              huvudkategorier.find(h => h.name === cat.name)?.id
                            ).filter(Boolean) as string[];
                            setSelectedCategories(allCatIds);
                          }}
                        >
                          Välj alla
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Include Uncategorized transactions */}
                        <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                          <input
                            type="checkbox"
                            id="uncategorized"
                            checked={selectedCategories.includes('uncategorized')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories([...selectedCategories, 'uncategorized']);
                              } else {
                                setSelectedCategories(selectedCategories.filter(id => id !== 'uncategorized'));
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="uncategorized" className="text-sm cursor-pointer flex-1">
                            <div className="font-medium text-gray-700">Okategoriserad</div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(
                                transactionsForPeriod
                                  .filter(t => t.type === 'Transaction' && t.amount < 0 && (!t.appCategoryId || !t.appSubCategoryId))
                                  .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                              )}
                            </div>
                          </label>
                        </div>
                        {categoryAnalysis.map((cat) => {
                          const catId = huvudkategorier.find(h => h.name === cat.name)?.id;
                          if (!catId) return null;
                          return (
                            <div key={cat.name} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                              <input
                                type="checkbox"
                                id={cat.name}
                                checked={selectedCategories.includes(catId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCategories([...selectedCategories, catId]);
                                  } else {
                                    setSelectedCategories(selectedCategories.filter(id => id !== catId));
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label htmlFor={cat.name} className="text-sm cursor-pointer flex-1">
                                <div className="font-medium text-gray-700">{cat.name}</div>
                                <div className="text-xs text-gray-500">{formatCurrency(cat.actual)}</div>
                              </label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedCategories([catId]);
                                  setShowSubcategories(true);
                                  const subCatIds = subcategoryAnalysis
                                    .filter(sub => sub.categoryId === catId)
                                    .map(sub => underkategorier.find(uk => uk.name === sub.name)?.id)
                                    .filter(Boolean) as string[];
                                  setSelectedSubcategories(subCatIds);
                                }}
                                className="text-xs h-6 px-2"
                              >
                                Visa underkategorier
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Subcategories Selection */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Välj underkategorier att jämföra:</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const allSubCatIds = subcategoryAnalysis
                              .map(sub => underkategorier.find(uk => uk.name === sub.name)?.id)
                              .filter(Boolean) as string[];
                            setSelectedSubcategories(allSubCatIds);
                          }}
                        >
                          Välj alla
                        </Button>
                      </div>
                      {selectedCategories.length > 0 ? (
                        <div className="space-y-4">
                          {selectedCategories.map(catId => {
                            const category = huvudkategorier.find(h => h.id === catId);
                            const categorySubcategories = subcategoryAnalysis.filter(sub => sub.categoryId === catId);
                            if (!category || categorySubcategories.length === 0) return null;
                            
                            return (
                              <div key={catId} className="border rounded-lg p-4">
                                <h4 className="font-medium text-gray-800 mb-3">{category.name}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {categorySubcategories.map(sub => {
                                    const subCatId = underkategorier.find(uk => uk.name === sub.name)?.id;
                                    if (!subCatId) return null;
                                    
                                    return (
                                      <div key={subCatId} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50">
                                        <input
                                          type="checkbox"
                                          id={subCatId}
                                          checked={selectedSubcategories.includes(subCatId)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedSubcategories([...selectedSubcategories, subCatId]);
                                            } else {
                                              setSelectedSubcategories(selectedSubcategories.filter(id => id !== subCatId));
                                            }
                                          }}
                                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <label htmlFor={subCatId} className="text-sm cursor-pointer flex-1">
                                          <div className="font-medium text-gray-700">{sub.name}</div>
                                          <div className="text-xs text-gray-500">{formatCurrency(sub.actual)}</div>
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>Välj först huvudkategorier för att se underkategorier</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Enhanced Category Trend Chart */}
                  {((selectedCategories.length > 0 && !showSubcategories) || (selectedSubcategories.length > 0 && showSubcategories)) && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium mb-3">
                        Daglig utgiftstrend för valda {showSubcategories ? 'underkategorier' : 'kategorier'}
                      </h4>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={categoryTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip formatter={(value: any) => formatCurrency(value)} />
                          <Legend />
                          {showSubcategories ? (
                            selectedSubcategories.map((subCatId, index) => {
                              const subcategory = underkategorier.find(uk => uk.id === subCatId);
                              const category = huvudkategorier.find(hk => hk.id === subcategory?.huvudkategoriId);
                              const displayName = subcategory ? `${category?.name} - ${subcategory.name}` : 'Okänd';
                              return (
                                <Line
                                  key={subCatId}
                                  type="monotone"
                                  dataKey={displayName}
                                  stroke={COLORS[index % COLORS.length]}
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                />
                              );
                            })
                          ) : (
                            selectedCategories.map((catId, index) => {
                              const categoryName = catId === 'uncategorized' ? 'Okategoriserad' : 
                                (huvudkategorier.find(h => h.id === catId)?.name || 'Okänd');
                              return (
                                <Line
                                  key={catId}
                                  type="monotone"
                                  dataKey={categoryName}
                                  stroke={COLORS[index % COLORS.length]}
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                />
                              );
                            })
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {selectedCategories.length === 0 && selectedSubcategories.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Välj minst en {showSubcategories ? 'underkategori' : 'kategori'} för att se utgiftstrend</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Category Distribution Pie Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Utgiftsfördelning per Kategori</CardTitle>
                  <CardDescription>Procentuell fördelning av faktiska utgifter</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={categoryAnalysis.map(cat => ({
                          name: cat.name,
                          value: cat.actual
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryAnalysis.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    </RePieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Category Actual Spending */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Faktiska Utgifter per Kategori</CardTitle>
                  <CardDescription>Baserat på transaktioner denna månad</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoryAnalysis.slice(0, 5).map((cat, index) => {
                      const percentage = cat.budgeted > 0 ? (cat.actual / cat.budgeted) * 100 : 
                                        cat.actual > 0 ? 100 : 0;
                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{cat.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{formatCurrency(cat.actual)}</span>
                              {cat.budgeted > 0 && (
                                <Badge variant={percentage > 100 ? "destructive" : percentage > 80 ? "secondary" : "default"}>
                                  {percentage.toFixed(0)}%
                                </Badge>
                              )}
                            </div>
                          </div>
                          {cat.budgeted > 0 ? (
                            <>
                              <Progress value={Math.min(percentage, 100)} className="h-2" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Budget: {formatCurrency(cat.budgeted)}</span>
                                <span>{percentage > 100 ? 'Över budget' : 'Inom budget'}</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Ingen budget satt
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {categoryAnalysis.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        Inga utgifter registrerade denna månad
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Category Insights */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Kategoriinsikter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Over Budget Categories */}
                  <div className="p-4 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-900 mb-2">Överbudget</h4>
                    <div className="space-y-2">
                      {categoryAnalysis
                        .filter(cat => cat.actual > cat.budgeted)
                        .slice(0, 3)
                        .map((cat, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-red-700">{cat.name}</span>
                            <Badge variant="destructive" className="text-xs">
                              +{formatCurrency(cat.actual - cat.budgeted)}
                            </Badge>
                          </div>
                        ))
                      }
                      {categoryAnalysis.filter(cat => cat.actual > cat.budgeted).length === 0 && (
                        <p className="text-sm text-green-600">Alla kategorier inom budget!</p>
                      )}
                    </div>
                  </div>

                  {/* Under Budget Categories */}
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Under budget</h4>
                    <div className="space-y-2">
                      {categoryAnalysis
                        .filter(cat => cat.actual < cat.budgeted * 0.8)
                        .slice(0, 3)
                        .map((cat, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-green-700">{cat.name}</span>
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              -{formatCurrency(cat.budgeted - cat.actual)}
                            </Badge>
                          </div>
                        ))
                      }
                    </div>
                  </div>

                  {/* Optimization Suggestions */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Optimeringsförslag</h4>
                    <div className="space-y-2 text-sm text-blue-700">
                      {categoryAnalysis[0] && categoryAnalysis[0].actual > categoryAnalysis[0].budgeted && (
                        <p>Överväg att öka budget för {categoryAnalysis[0].name}</p>
                      )}
                      {metrics.savingsRate < 10 && (
                        <p>Försök öka sparkvoten till minst 10%</p>
                      )}
                      {metrics.budgetUtilization > 95 && (
                        <p>Du är nära budgetgränsen, se över utgifter</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="mt-6 space-y-6">
            {/* Account Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accountSummary.map((account) => (
                <Card key={account.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{account.name}</span>
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-2xl font-bold">{formatCurrency(account.actualBalance)}</p>
                        <p className="text-xs text-muted-foreground">Aktuellt saldo</p>
                      </div>
                      
                      {/* Detailed Transaction Breakdown */}
                      <div className="space-y-2 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-green-50 p-2 rounded">
                            <p className="font-medium text-green-800">Inkomster</p>
                            <p className="text-green-700">{formatCurrency(account.incomes)}</p>
                          </div>
                          <div className="bg-red-50 p-2 rounded">
                            <p className="font-medium text-red-800">Kostnader</p>
                            <p className="text-red-700">{formatCurrency(account.costs)}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-blue-50 p-2 rounded">
                            <p className="font-medium text-blue-800">Inkommande överföringar</p>
                            <p className="text-blue-700">{formatCurrency(account.incomingTransfers)}</p>
                          </div>
                          <div className="bg-orange-50 p-2 rounded">
                            <p className="font-medium text-orange-800">Utgående överföringar</p>
                            <p className="text-orange-700">{formatCurrency(account.outgoingTransfers)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Nettoflöde</span>
                          <Badge variant={account.netFlow >= 0 ? "default" : "destructive"}>
                            {account.netFlow >= 0 ? '+' : ''}{formatCurrency(account.netFlow)}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm text-muted-foreground">Transaktioner</span>
                          <span className="text-sm font-medium">{account.transactionCount}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Account Flow Visualization */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Detaljerat Kontoflöde</CardTitle>
                <CardDescription>Uppdelat per transaktionstyp och konto</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={accountSummary.map(account => ({
                    name: account.name,
                    inkomster: account.incomes / 100,
                    kostnader: account.costs / 100,
                    inkommandeOverforingar: account.incomingTransfers / 100,
                    utgaendeOverforingar: account.outgoingTransfers / 100
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        formatCurrency(value * 100), 
                        name === 'inkomster' ? 'Inkomster (Income)' :
                        name === 'kostnader' ? 'Kostnader (Transaction -)' :
                        name === 'inkommandeOverforingar' ? 'Inkommande överföringar' :
                        name === 'utgaendeOverforingar' ? 'Utgående överföringar' :
                        name
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="inkomster" name="Inkomster" fill="#10b981" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="kostnader" name="Kostnader" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="inkommandeOverforingar" name="Inkommande överföringar" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="utgaendeOverforingar" name="Utgående överföringar" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Account Health Score */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Kontohälsa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Total Balance */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Total balans alla konton</p>
                      <p className="text-3xl font-bold">
                        {formatCurrency(accountSummary.reduce((sum, acc) => sum + acc.actualBalance, 0))}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Totala inkomster</span>
                        <span className="font-medium text-green-600">
                          +{formatCurrency(metrics.totalIncome)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Totala kostnader (Transaction -)</span>
                        <span className="font-medium text-red-600">
                          -{formatCurrency(accountSummary.reduce((sum, acc) => sum + acc.costs, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Inkommande överföringar</span>
                        <span className="font-medium text-blue-600">
                          +{formatCurrency(accountSummary.reduce((sum, acc) => sum + acc.incomingTransfers, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Utgående överföringar</span>
                        <span className="font-medium text-orange-600">
                          -{formatCurrency(accountSummary.reduce((sum, acc) => sum + acc.outgoingTransfers, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span>Netto denna månad</span>
                        <span className={`font-medium ${
                          accountSummary.reduce((sum, acc) => sum + acc.netFlow, 0) >= 0 
                            ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(accountSummary.reduce((sum, acc) => sum + acc.netFlow, 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Account Distribution */}
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Balansfördelning</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <RePieChart>
                        <Pie
                          data={accountSummary
                            .filter(acc => acc.actualBalance > 0)
                            .map(acc => ({
                              name: acc.name,
                              value: acc.actualBalance
                            }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {accountSummary.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => formatCurrency(value)} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Summary Footer */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Månadens sammanfattning</h3>
              <p className="text-white/90">
                Du har använt {metrics.budgetUtilization.toFixed(0)}% av din budget och sparat {metrics.savingsRate.toFixed(0)}% av dina inkomster.
                {metrics.availableBudget >= 0 
                  ? ` Du har ${formatCurrency(metrics.availableBudget)} kvar att spendera.`
                  : ` Du är ${formatCurrency(Math.abs(metrics.availableBudget))} över budget.`
                }
              </p>
            </div>
            <Button variant="secondary" size="lg" className="bg-white text-indigo-600 hover:bg-gray-100">
              <ChevronRight className="w-5 h-5 ml-2" />
              Exportera rapport
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};