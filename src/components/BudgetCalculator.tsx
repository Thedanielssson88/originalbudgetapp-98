import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calculator } from 'lucide-react';
import { useBudget } from '../hooks/useBudget';
import {
  setAndreasSalary,
  setSusannaSalary,
  setDailyTransfer,
  setWeekendTransfer
} from '../orchestrator/budgetOrchestrator';

interface SubCategory {
  id: string;
  name: string;
  amount: number;
  account?: string;
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
}

interface BudgetGroup {
  id: string;
  name: string;
  amount: number;
  type: 'cost' | 'savings';
  subCategories?: SubCategory[];
  account?: string;
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
}

const BudgetCalculator = () => {
  console.log('🔥 [COMPONENT] BudgetCalculator component starting (STATELESS VERSION)');

  // Central state - THE SINGLE SOURCE OF TRUTH
  const { isLoading, budgetState, calculated } = useBudget();

  // ONLY UI-SPECIFIC local state (not data that exists in central state)
  const [isEditingCategories, setIsEditingCategories] = useState<boolean>(false);
  const [isEditingTransfers, setIsEditingTransfers] = useState<boolean>(false);
  const [isEditingHolidays, setIsEditingHolidays] = useState<boolean>(false);
  const [newHistoricalMonth, setNewHistoricalMonth] = useState<string>('');
  const [newMonthFromCopy, setNewMonthFromCopy] = useState<string>('');
  const [selectedSourceMonth, setSelectedSourceMonth] = useState<string>('');
  const [standardValues, setStandardValues] = useState<any>(null);
  const [transferAccount, setTransferAccount] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [isUpdatingAllMonths, setIsUpdatingAllMonths] = useState<boolean>(false);

  // Debug state for mobile
  const [globalDebugLogs, setGlobalDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);

  // Tab and UI interaction state
  const [activeTab, setActiveTab] = useState<string>("inkomster");
  const [previousTab, setPreviousTab] = useState<string>("");
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    costCategories: false,
    savingsCategories: false,
    budgetTransfers: false,
    redDays: false,
    editMonths: false,
    monthSelector: false,
    accountSummary: false,
    budgetTemplates: false,
    totalIncome: false,
    budgetSummary: false,
    remainingToAllocate: false,
    incomeDetails: false,
    costDetails: false,
    transferDetails: false,
    budgetIncome: false,
    budgetCosts: false,
    budgetTransfer: false,
    budgetCategories: false,
    andreasDetails: false,
    susannaDetails: false,
    remainingAmountDistribution: false,
    remainingDailyBudgetDistribution: false,
    individualSharesDistribution: false,
    dailyTransferDetails: false,
    accountBalances: false,
    finalAccountSummary: false
  });

  // UI state for expandable categories
  const [expandedBudgetCategories, setExpandedBudgetCategories] = useState<{[key: string]: boolean}>({});

  // UI state for personal budget editing
  const [selectedPerson, setSelectedPerson] = useState<'andreas' | 'susanna'>('andreas');
  const [isEditingPersonalBudget, setIsEditingPersonalBudget] = useState<boolean>(false);

  // UI state for account management
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [isEditingAccounts, setIsEditingAccounts] = useState<boolean>(false);
  const [expandedAccounts, setExpandedAccounts] = useState<{[key: string]: boolean}>({});

  // UI state for account categories
  const [accountCategories, setAccountCategories] = useState<string[]>(['Privat', 'Gemensam', 'Sparande', 'Hushåll']);
  const [accountCategoryMapping, setAccountCategoryMapping] = useState<{[accountName: string]: string}>({});
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [isEditingAccountCategories, setIsEditingAccountCategories] = useState<boolean>(false);

  // UI state for budget templates
  const [budgetTemplates, setBudgetTemplates] = useState<{[key: string]: any}>({});
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [selectedTemplateSourceMonth, setSelectedTemplateSourceMonth] = useState<string>('');
  const [expandedTemplates, setExpandedTemplates] = useState<{[key: string]: boolean}>({});
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingTemplateData, setEditingTemplateData] = useState<any>(null);

  // UI state for template copying
  const [selectedTemplateToCopy, setSelectedTemplateToCopy] = useState<string>('');
  const [targetCopyMonth, setTargetCopyMonth] = useState<string>('');
  const [showTemplateDetails, setShowTemplateDetails] = useState<boolean>(false);

  // UI state for create month dialog
  const [isCreateMonthDialogOpen, setIsCreateMonthDialogOpen] = useState<boolean>(false);
  const [createMonthDirection, setCreateMonthDirection] = useState<'previous' | 'next'>('next');

  // UI state for chart selection
  const [selectedAccountsForChart, setSelectedAccountsForChart] = useState<string[]>([]);
  const [showIndividualCostsOutsideBudget, setShowIndividualCostsOutsideBudget] = useState<boolean>(false);
  const [showSavingsSeparately, setShowSavingsSeparately] = useState<boolean>(false);
  const [showEstimatedBudgetAmounts, setShowEstimatedBudgetAmounts] = useState<boolean>(false);
  const [balanceType, setBalanceType] = useState<'starting' | 'closing'>('closing');

  // UI state for chart legend and time range
  const [isChartLegendExpanded, setIsChartLegendExpanded] = useState<boolean>(false);
  const [useCustomTimeRange, setUseCustomTimeRange] = useState<boolean>(false);
  const [chartStartMonth, setChartStartMonth] = useState<string>('');
  const [chartEndMonth, setChartEndMonth] = useState<string>('');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading budget data...</p>
        </div>
      </div>
    );
  }

  // READ-ONLY: Direct access to central state (no local state duplicates)
  const { historicalData, selectedMonthKey, selectedHistoricalMonth, accounts: centralAccounts } = budgetState;
  const currentMonthData = historicalData[selectedMonthKey] || {};
  const results = calculated.results;

  // All data comes directly from central state
  const andreasSalary = currentMonthData.andreasSalary || 45000;
  const andreasförsäkringskassan = currentMonthData.andreasförsäkringskassan || 0;
  const andreasbarnbidrag = currentMonthData.andreasbarnbidrag || 0;
  const susannaSalary = currentMonthData.susannaSalary || 40000;
  const susannaförsäkringskassan = currentMonthData.susannaförsäkringskassan || 5000;
  const susannabarnbidrag = currentMonthData.susannabarnbidrag || 0;
  const costGroups = currentMonthData.costGroups || [];
  const savingsGroups = currentMonthData.savingsGroups || [];
  const dailyTransfer = currentMonthData.dailyTransfer || 300;
  const weekendTransfer = currentMonthData.weekendTransfer || 540;
  const customHolidays = currentMonthData.customHolidays || [];
  const andreasPersonalCosts = currentMonthData.andreasPersonalCosts || 0;
  const andreasPersonalSavings = currentMonthData.andreasPersonalSavings || 0;
  const susannaPersonalCosts = currentMonthData.susannaPersonalCosts || 0;
  const susannaPersonalSavings = currentMonthData.susannaPersonalSavings || 0;
  const accountBalances = currentMonthData.accountBalances || {};
  const accountBalancesSet = currentMonthData.accountBalancesSet || {};
  const accountEstimatedFinalBalances = currentMonthData.accountEstimatedFinalBalances || {};
  const accountEstimatedFinalBalancesSet = currentMonthData.accountEstimatedFinalBalancesSet || {};
  const accountEstimatedStartBalances = currentMonthData.accountEstimatedStartBalances || {};
  const accountStartBalancesSet = currentMonthData.accountStartBalancesSet || {};
  const accountEndBalancesSet = currentMonthData.accountEndBalancesSet || {};
  const userName1 = currentMonthData.userName1 || 'Andreas';
  const userName2 = currentMonthData.userName2 || 'Susanna';
  const transferChecks = currentMonthData.transferChecks || {};
  const andreasShareChecked = currentMonthData.andreasShareChecked || false;
  const susannaShareChecked = currentMonthData.susannaShareChecked || false;
  const monthFinalBalances = currentMonthData.monthFinalBalances || {};
  const accountEndingBalances = currentMonthData.accountEndingBalances || {};

  // Convert accounts to string array for compatibility with legacy code
  const accounts = centralAccounts.map(acc => acc.name);

  console.log('✅ [STATELESS] All data read directly from central state - no local state conflicts');

  // Calculation functions (now reading from central state only)
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
    const preliminaryBalance = totalSalary - budgetData.totalBudget - totalMonthlyExpenses;

    let susannaShare = 0;
    let andreasShare = 0;
    let susannaPercentage = 0;
    let andreasPercentage = 0;

    if (totalSalary > 0) {
      susannaPercentage = (susannaTotalIncome / totalSalary) * 100;
      andreasPercentage = (andreasTotalIncome / totalSalary) * 100;
      susannaShare = (susannaTotalIncome / totalSalary) * preliminaryBalance;
      andreasShare = (andreasTotalIncome / totalSalary) * preliminaryBalance;
    }

    // Final balance should be 0 when individual shares are included
    const finalBalance = preliminaryBalance - susannaShare - andreasShare;

    return {
      totalSalary,
      totalDailyBudget: budgetData.totalBudget,
      remainingDailyBudget: budgetData.totalBudget,
      holidayDaysBudget: budgetData.holidayDaysBudget,
      balanceLeft: preliminaryBalance,
      susannaShare,
      andreasShare,
      susannaPercentage,
      andreasPercentage,
      daysUntil25th: budgetData.daysUntil25th,
      totalMonthlyExpenses,
      weekdayCount: budgetData.weekdayCount,
      fridayCount: budgetData.fridayCount,
      remainingWeekdayCount: budgetData.remainingWeekdayCount,
      remainingFridayCount: budgetData.remainingFridayCount,
      holidaysUntil25th: budgetData.holidaysUntil25th,
      nextTenHolidays: budgetData.nextTenHolidays,
      holidayDays: budgetData.holidayDays
    };
  };

  const calculateDaysForMonth = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let weekdays = 0;
    let fridays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        weekdays++;
        if (dayOfWeek === 5) {
          fridays++;
        }
      }
    }
    return { weekdays, fridays };
  };

  const getSwedishHolidays = (year: number): Date[] => {
    // Placeholder: Return an array of Date objects representing Swedish holidays for the given year
    // For simplicity, return empty array here
    return [];
  };

  const getHolidaysUntil25th = (): Date[] => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const holidays = [...customHolidays.map(d => new Date(d)), ...getSwedishHolidays(year)];
    return holidays.filter(d => d.getMonth() === month && d.getDate() <= 25 && d >= today);
  };

  const getNextTenHolidays = (): Date[] => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const holidays = [...customHolidays.map(d => new Date(d)), ...getSwedishHolidays(year)];
    const futureHolidays = holidays.filter(d => d >= today);
    futureHolidays.sort((a, b) => a.getTime() - b.getTime());
    return futureHolidays.slice(0, 10);
  };

  const calculateDailyBudget = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    // Get 25th of current month
    const twentyFifthOfMonth = new Date(currentYear, currentMonth, 25);

    // Calculate days until 25th
    let daysUntil25th;
    if (currentDay <= 25) {
      daysUntil25th = 25 - currentDay;
    } else {
      // If today is after 25th, calculate days until 25th of next month
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const twentyFifthNextMonth = new Date(nextYear, nextMonth, 25);
      daysUntil25th = Math.ceil((twentyFifthNextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    const daysForMonth = calculateDaysForMonth(currentYear, currentMonth);
    const weekdayCount = daysForMonth.weekdays;
    const fridayCount = daysForMonth.fridays;

    // Calculate remaining weekdays and fridays until 25th
    let remainingWeekdayCount = 0;
    let remainingFridayCount = 0;

    const endDate = new Date(currentYear, currentMonth, Math.min(25, new Date(currentYear, currentMonth + 1, 0).getDate()));

    for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
        remainingWeekdayCount++;
        if (dayOfWeek === 5) { // Friday
          remainingFridayCount++;
        }
      }
    }

    // Holiday calculations
    const holidaysUntil25th = getHolidaysUntil25th();
    const nextTenHolidays = getNextTenHolidays();
    const holidayDays = [...customHolidays.map(d => new Date(d)), ...getSwedishHolidays(currentYear)];

    // Calculate budget based on remaining weekdays and weekend days
    const remainingWeekdayBudget = remainingWeekdayCount * dailyTransfer;
    const remainingWeekendBudget = remainingFridayCount * weekendTransfer;
    const holidayDaysBudget = holidaysUntil25th.length * weekendTransfer;

    const totalBudget = remainingWeekdayBudget + remainingWeekendBudget + holidayDaysBudget;

    return {
      totalBudget,
      daysUntil25th,
      weekdayCount,
      fridayCount,
      remainingWeekdayCount,
      remainingFridayCount,
      holidayDaysBudget,
      holidaysUntil25th,
      nextTenHolidays,
      holidayDays
    };
  };

  // Simple render for now to test the stateless approach
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              Budget Calculator (Stateless Version)
            </CardTitle>
            <CardDescription>
              All data comes from central state - no infinite loops!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Andreas Salary</Label>
                <Input
                  type="number"
                  value={andreasSalary}
                  onChange={(e) => setAndreasSalary(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Susanna Salary</Label>
                <Input
                  type="number"
                  value={susannaSalary}
                  onChange={(e) => setSusannaSalary(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Daily Transfer</Label>
                <Input
                  type="number"
                  value={dailyTransfer}
                  onChange={(e) => setDailyTransfer(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Weekend Transfer</Label>
                <Input
                  type="number"
                  value={weekendTransfer}
                  onChange={(e) => setWeekendTransfer(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Budget Results</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Total Salary: {results.totalSalary?.toLocaleString() || 0} kr</div>
                <div>Balance Left: {results.balanceLeft?.toLocaleString() || 0} kr</div>
                <div>Andreas Share: {results.andreasShare?.toLocaleString() || 0} kr</div>
                <div>Susanna Share: {results.susannaShare?.toLocaleString() || 0} kr</div>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                ✅ No infinite loops - reading directly from central state!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BudgetCalculator;
