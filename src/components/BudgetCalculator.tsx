import React, { useState, useEffect, useMemo } from 'react';
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
import { 
  updateCostGroups,
  updateSavingsGroups,
  updateAccountBalance,
  forceRecalculation,
  setAndreasSalary,
  setAndreasförsäkringskassan,
  setAndreasbarnbidrag,
  setSusannaSalary,
  setSusannaförsäkringskassan,
  setSusannabarnbidrag,
  setCostGroups,
  setSavingsGroups,
  setDailyTransfer,
  setWeekendTransfer,
  setCustomHolidays,
  setAndreasPersonalCosts,
  setAndreasPersonalSavings,
  setSusannaPersonalCosts,
  setSusannaPersonalSavings,
  setAccounts,
  setSelectedBudgetMonth,
  setSelectedHistoricalMonth,
  setAccountBalances,
  setAccountBalancesSet,
  updateHistoricalData,
  setHistoricalData,
  updateHistoricalDataSingle,
  setResults,
  updateSelectedBudgetMonth,
  setAccountEstimatedFinalBalances,
  setAccountEstimatedFinalBalancesSet,
  setAccountEstimatedStartBalances,
  setAccountStartBalancesSet,
  setAccountEndBalancesSet,
  setMonthFinalBalances
} from '../orchestrator/budgetOrchestrator';
import { StorageKey } from '../services/storageService';
import { useBudget } from '../hooks/useBudget';
import { mobileDebugLogger, addMobileDebugLog } from '../utils/mobileDebugLogger';

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
  console.log('🔥 [COMPONENT] BudgetCalculator component starting (STATELESS VERSION WITH FULL UI)');
  
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

  // Helper functions
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSwedishHolidays = (year: number) => {
    // Simplified Swedish holidays for the year
    return [
      { date: `${year}-01-01`, name: "Nyårsdagen" },
      { date: `${year}-01-06`, name: "Trettondedag jul" },
      { date: `${year}-05-01`, name: "Första maj" },
      { date: `${year}-06-06`, name: "Nationaldagen" },
      { date: `${year}-12-24`, name: "Julafton" },
      { date: `${year}-12-25`, name: "Juldagen" },
      { date: `${year}-12-26`, name: "Annandag jul" },
      { date: `${year}-12-31`, name: "Nyårsafton" },
    ];
  };

  const getHolidaysUntil25th = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const twentyFifth = new Date(currentYear, currentMonth, 25);
    
    const allHolidays = [...customHolidays, ...getSwedishHolidays(currentYear)];
    
    return allHolidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate >= today && holidayDate <= twentyFifth;
    });
  };

  const getNextTenHolidays = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const nextYear = currentYear + 1;
    
    const allHolidays = [
      ...customHolidays,
      ...getSwedishHolidays(currentYear),
      ...getSwedishHolidays(nextYear)
    ];
    
    return allHolidays
      .filter(holiday => new Date(holiday.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  };

  const calculateDaysForMonth = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let weekdays = 0;
    let fridays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
        weekdays++;
        if (dayOfWeek === 5) { // Friday
          fridays++;
        }
      }
    }
    
    return { weekdays, fridays };
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
    const holidayDays = [...customHolidays, ...getSwedishHolidays(currentYear)];
    
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

  // Available months for selection
  const availableMonths = useMemo(() => {
    return Object.keys(historicalData).sort().reverse();
  }, [historicalData]);

  // Helper functions for managing Cost Groups - STATELESS VERSION
  const handleAddCostGroup = () => {
    const newGroup = { 
      id: Date.now().toString(), 
      name: 'Ny kostnad', 
      amount: 0, 
      type: 'cost', 
      subCategories: [] 
    };
    const newCostGroups = [...(currentMonthData.costGroups || []), newGroup];
    updateCostGroups(newCostGroups);
  };

  const handleUpdateCostGroup = (groupId: string, field: string, value: any) => {
    const newCostGroups = (currentMonthData.costGroups || []).map(group =>
      group.id === groupId ? { ...group, [field]: value } : group
    );
    updateCostGroups(newCostGroups);
  };

  const handleRemoveCostGroup = (groupId: string) => {
    const newCostGroups = (currentMonthData.costGroups || []).filter(group => group.id !== groupId);
    updateCostGroups(newCostGroups);
  };

  // Helper functions for managing Savings Groups - STATELESS VERSION
  const handleAddSavingsGroup = () => {
    const newGroup = { 
      id: Date.now().toString(), 
      name: 'Ny spargrupp', 
      amount: 0, 
      type: 'savings', 
      subCategories: [] 
    };
    const newSavingsGroups = [...(currentMonthData.savingsGroups || []), newGroup];
    updateSavingsGroups(newSavingsGroups);
  };

  const handleUpdateSavingsGroup = (groupId: string, field: string, value: any) => {
    const newSavingsGroups = (currentMonthData.savingsGroups || []).map(group =>
      group.id === groupId ? { ...group, [field]: value } : group
    );
    updateSavingsGroups(newSavingsGroups);
  };

  const handleRemoveSavingsGroup = (groupId: string) => {
    const newSavingsGroups = (currentMonthData.savingsGroups || []).filter(group => group.id !== groupId);
    updateSavingsGroups(newSavingsGroups);
  };

  const addSubCategory = (groupId: string, isSubCategory = false) => {
    const newSub: SubCategory = {
      id: Date.now().toString(),
      name: 'New Subcategory',
      amount: 0
    };
    
    const updatedGroups = costGroups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          subCategories: [...(group.subCategories || []), newSub]
        };
      }
      return group;
    });
    setCostGroups(updatedGroups);
  };

  const updateSubCategory = (groupId: string, subId: string, field: string, value: any) => {
    const updatedGroups = costGroups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          subCategories: group.subCategories?.map(sub => 
            sub.id === subId ? { ...sub, [field]: value } : sub
          )
        };
      }
      return group;
    });
    setCostGroups(updatedGroups);
  };

  const deleteSubCategory = (groupId: string, subId: string) => {
    const updatedGroups = costGroups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          subCategories: group.subCategories?.filter(sub => sub.id !== subId)
        };
      }
      return group;
    });
    setCostGroups(updatedGroups);
  };

  // Toggle expanded sections
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Toggle expanded budget categories
  const toggleBudgetCategory = (categoryId: string) => {
    setExpandedBudgetCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              Family Budget Calculator
            </CardTitle>
            <CardDescription>
              Manage your family's monthly budget and track expenses
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Month Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Current Month: {selectedMonthKey}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreateMonthDirection('previous');
                    setIsCreateMonthDialogOpen(true);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreateMonthDirection('next');
                    setIsCreateMonthDialogOpen(true);
                  }}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedMonthKey} onValueChange={setSelectedBudgetMonth}>
              <SelectTrigger>
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
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="inkomster">Inkomster</TabsTrigger>
            <TabsTrigger value="kostnader">Kostnader</TabsTrigger>
            <TabsTrigger value="sparande">Sparande</TabsTrigger>
            <TabsTrigger value="överföringar">Överföringar</TabsTrigger>
            <TabsTrigger value="sammanfattning">Sammanfattning</TabsTrigger>
          </TabsList>

          {/* Income Tab */}
          <TabsContent value="inkomster">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Monthly Income
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Andreas Income */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{userName1}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Salary</Label>
                      <Input
                        type="number"
                        value={andreasSalary}
                        onChange={(e) => setAndreasSalary(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Försäkringskassan</Label>
                      <Input
                        type="number"
                        value={andreasförsäkringskassan}
                        onChange={(e) => setAndreasförsäkringskassan(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Barnbidrag</Label>
                      <Input
                        type="number"
                        value={andreasbarnbidrag}
                        onChange={(e) => setAndreasbarnbidrag(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Susanna Income */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{userName2}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Salary</Label>
                      <Input
                        type="number"
                        value={susannaSalary}
                        onChange={(e) => setSusannaSalary(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Försäkringskassan</Label>
                      <Input
                        type="number"
                        value={susannaförsäkringskassan}
                        onChange={(e) => setSusannaförsäkringskassan(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Barnbidrag</Label>
                      <Input
                        type="number"
                        value={susannabarnbidrag}
                        onChange={(e) => setSusannabarnbidrag(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Total Income Summary */}
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Income Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">{userName1} Total:</span>
                      <span className="ml-2">{formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag)}</span>
                    </div>
                    <div>
                      <span className="font-medium">{userName2} Total:</span>
                      <span className="ml-2">{formatCurrency(susannaSalary + susannaförsäkringskassan + susannabarnbidrag)}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t">
                      <span className="font-bold">Total Family Income:</span>
                      <span className="ml-2 font-bold text-lg">{formatCurrency(results.totalSalary || 0)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cost Categories Tab */}
          <TabsContent value="kostnader">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Cost Categories
                  </span>
                  <Button onClick={handleAddCostGroup} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {costGroups.map((group) => (
                  <Card key={group.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1 mr-4">
                        <Input
                          value={group.name}
                          onChange={(e) => handleUpdateCostGroup(group.id, 'name', e.target.value)}
                          placeholder="Category name"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addSubCategory(group.id)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleBudgetCategory(group.id)}
                        >
                          {expandedBudgetCategories[group.id] ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />
                          }
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveCostGroup(group.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {expandedBudgetCategories[group.id] && (
                      <div className="space-y-2">
                        {group.subCategories?.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-2 ml-4">
                            <Input
                              value={sub.name}
                              onChange={(e) => updateSubCategory(group.id, sub.id, 'name', e.target.value)}
                              placeholder="Subcategory name"
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              value={sub.amount}
                              onChange={(e) => updateSubCategory(group.id, sub.id, 'amount', Number(e.target.value))}
                              placeholder="Amount"
                              className="w-32"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteSubCategory(group.id, sub.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 p-2 bg-muted rounded text-sm">
                      Category Total: {formatCurrency(
                        group.subCategories?.reduce((sum, sub) => sum + sub.amount, 0) || 0
                      )}
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Savings Tab */}
          <TabsContent value="sparande">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Savings Categories
                  </span>
                  <Button onClick={handleAddSavingsGroup} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Savings
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {savingsGroups.map((group) => (
                  <Card key={group.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <Input
                        value={group.name}
                        onChange={(e) => handleUpdateSavingsGroup(group.id, 'name', e.target.value)}
                        placeholder="Savings name"
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={group.amount}
                        onChange={(e) => handleUpdateSavingsGroup(group.id, 'amount', Number(e.target.value))}
                        placeholder="Amount"
                        className="w-32"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveSavingsGroup(group.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="överföringar">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Daily Transfers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Daily Transfer (Mon-Thu)</Label>
                    <Input
                      type="number"
                      value={dailyTransfer}
                      onChange={(e) => setDailyTransfer(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Weekend Transfer (Fri-Sun)</Label>
                    <Input
                      type="number"
                      value={weekendTransfer}
                      onChange={(e) => setWeekendTransfer(Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="sammanfattning">
            <div className="space-y-6">
              {/* Budget Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Budget Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h3 className="font-semibold text-green-800">Total Income</h3>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(results.totalSalary || 0)}
                      </p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <h3 className="font-semibold text-red-800">Total Expenses</h3>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(results.totalMonthlyExpenses || 0)}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-semibold text-blue-800">Remaining Balance</h3>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(results.balanceLeft || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Individual Shares */}
              <Card>
                <CardHeader>
                  <CardTitle>Individual Shares</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-semibold">{userName1}</h3>
                      <p className="text-xl font-bold">
                        {formatCurrency(results.andreasShare || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(results.andreasPercentage || 0).toFixed(1)}% of total income
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-semibold">{userName2}</h3>
                      <p className="text-xl font-bold">
                        {formatCurrency(results.susannaShare || 0)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(results.susannaPercentage || 0).toFixed(1)}% of total income
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Daily Budget Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Budget Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Days until 25th:</span>
                      <p className="text-lg font-bold">{results.daysUntil25th || 0}</p>
                    </div>
                    <div>
                      <span className="font-medium">Remaining weekdays:</span>
                      <p className="text-lg font-bold">{results.remainingWeekdayCount || 0}</p>
                    </div>
                    <div>
                      <span className="font-medium">Remaining Fridays:</span>
                      <p className="text-lg font-bold">{results.remainingFridayCount || 0}</p>
                    </div>
                    <div>
                      <span className="font-medium">Total daily budget:</span>
                      <p className="text-lg font-bold">{formatCurrency(results.totalDailyBudget || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Month Dialog */}
        <CreateMonthDialog
          isOpen={isCreateMonthDialogOpen}
          onClose={() => setIsCreateMonthDialogOpen(false)}
          onCreateMonth={(type, templateName, sourceMonth) => {
            console.log('Creating month:', type, templateName, sourceMonth);
            setIsCreateMonthDialogOpen(false);
          }}
          budgetTemplates={budgetTemplates}
          selectedBudgetMonth={selectedMonthKey}
          direction={createMonthDirection}
          historicalData={historicalData}
          availableMonths={availableMonths}
        />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          ✅ Stateless architecture - No infinite loops!
        </div>
      </div>
    </div>
  );
};

export default BudgetCalculator;