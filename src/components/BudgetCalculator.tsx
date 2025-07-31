import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calculator, DollarSign, TrendingUp, Users, Calendar, Plus, Trash2, Edit, Save, X, ChevronDown, ChevronUp, History, ChevronLeft, ChevronRight, Target, Receipt } from 'lucide-react';
import { CostItemEditDialog } from './CostItemEditDialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import { AccountDataTable, AccountDataRow } from '@/components/AccountDataTable';
import CreateMonthDialog from './CreateMonthDialog';
import { CustomLineChart } from './CustomLineChart';
import { AccountSelector } from '@/components/AccountSelector';
import { MainCategoriesSettings } from '@/components/MainCategoriesSettings';
import { AddBudgetItemDialog } from '@/components/AddBudgetItemDialog';
import { TransactionImportEnhanced } from '@/components/TransactionImportEnhanced';
import { TransactionDrillDownDialog } from '@/components/TransactionDrillDownDialog';
import { SavingsSection } from '@/components/SavingsSection';
import { calculateAccountEndBalances, getTransactionsForPeriod } from '../services/calculationService';
import { 
  createSavingsGoal,
  updateCostGroups,
  updateSavingsGroups,
  updateAccountBalance,
  unsetAccountBalance,
  forceRecalculation,
  setAndreasSalary,
  setAndreasförsäkringskassan,
  setAndreasbarnbidrag,
  setSusannaSalary,
  setSusannaförsäkringskassan,
  setSusannabarnbidrag,
  
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
  setMonthFinalBalances
} from '../orchestrator/budgetOrchestrator';
import { StorageKey, get, set } from '../services/storageService';
import { useBudget } from '../hooks/useBudget';
import { mobileDebugLogger, addMobileDebugLog } from '../utils/mobileDebugLogger';
import { Transaction } from '../types/budget';
import { 
  calculateMonthlyAmountForDailyTransfer, 
  calculateEstimatedToDate, 
  calculateActualTransferred, 
  calculateDifference, 
  calculateRemaining, 
  formatTransferDays 
} from '../utils/dailyTransferUtils';

interface SubCategory {
  id: string;
  name: string;
  amount: number;
  account?: string;
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
  transferType?: 'monthly' | 'daily';
  dailyAmount?: number;
  transferDays?: number[];
}

interface ExtendedSubCategory extends SubCategory {
  groupId: string;
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
  console.log('🔥 [COMPONENT] BudgetCalculator component is starting!');
  console.log('🔥 [COMPONENT] BudgetCalculator component is starting!'); // Duplicate for visibility
  console.log('🔥🔥🔥 FORCING BUDGET CALCULATOR TO LOG 🔥🔥🔥');
  // Use the original useBudget hook - fix hook ordering instead
  const { isLoading, budgetState, calculated } = useBudget();
  
  // ALL HOOKS MUST BE DECLARED FIRST - BEFORE ANY CONDITIONAL LOGIC
  const [isEditingCategories, setIsEditingCategories] = useState<boolean>(false);
  const [isEditingTransfers, setIsEditingTransfers] = useState<boolean>(false);
  const [isEditingHolidays, setIsEditingHolidays] = useState<boolean>(false);
  const [newHistoricalMonth, setNewHistoricalMonth] = useState<string>(''); // State for new month input
  const [newMonthFromCopy, setNewMonthFromCopy] = useState<string>(''); // State for new month when copying from historical
  const [selectedSourceMonth, setSelectedSourceMonth] = useState<string>(''); // State for source month to copy from
  const [standardValues, setStandardValues] = useState<any>(null);
  const [transferAccount, setTransferAccount] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [isUpdatingAllMonths, setIsUpdatingAllMonths] = useState<boolean>(false);
  
  // Debug state for mobile - now using global logger
  const [globalDebugLogs, setGlobalDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);
  
  // Subscribe to global debug logger
  useEffect(() => {
    // Load existing logs immediately when component mounts
    const existingLogs = mobileDebugLogger.getLogs();
    setGlobalDebugLogs(existingLogs.map(log => `${log.timestamp}: ${log.message}`));
    
    const unsubscribe = mobileDebugLogger.subscribe((logs) => {
      setGlobalDebugLogs(logs.map(log => `${log.timestamp}: ${log.message}`));
    });
    
    // Add a log to show component mounted
    addMobileDebugLog('[COMPONENT] BudgetCalculator mounted - checking for existing logs');
    
    return unsubscribe;
  }, []);
  
  // Tab and expandable sections state
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

  // Budget category expandable states
  const [expandedBudgetCategories, setExpandedBudgetCategories] = useState<{[key: string]: boolean}>({});
  const [expandedCostGroups, setExpandedCostGroups] = useState<{[key: string]: boolean}>({});
  
  // Personal budget states
  const [selectedPerson, setSelectedPerson] = useState<'andreas' | 'susanna'>('andreas');
  const [isEditingPersonalBudget, setIsEditingPersonalBudget] = useState<boolean>(false);
  
  // Account management states
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [isEditingAccounts, setIsEditingAccounts] = useState<boolean>(false);
  const [expandedAccounts, setExpandedAccounts] = useState<{[key: string]: boolean}>({});

  // Account categories states
  const [accountCategories, setAccountCategories] = useState<string[]>(['Privat', 'Gemensam', 'Sparande', 'Hushåll']);
  const [accountCategoryMapping, setAccountCategoryMapping] = useState<{[accountName: string]: string}>({});
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [isEditingAccountCategories, setIsEditingAccountCategories] = useState<boolean>(false);

  // Budget template states
  const [budgetTemplates, setBudgetTemplates] = useState<{[key: string]: any}>({});
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [selectedTemplateSourceMonth, setSelectedTemplateSourceMonth] = useState<string>('');
  const [expandedTemplates, setExpandedTemplates] = useState<{[key: string]: boolean}>({});
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingTemplateData, setEditingTemplateData] = useState<any>(null);
  
  // Template copying states
  const [selectedTemplateToCopy, setSelectedTemplateToCopy] = useState<string>('');
  const [targetCopyMonth, setTargetCopyMonth] = useState<string>('');
  const [showTemplateDetails, setShowTemplateDetails] = useState<boolean>(false);
  
  // User name states
  const [userName1, setUserName1] = useState<string>('Andreas');
  const [userName2, setUserName2] = useState<string>('Susanna');

  // Transfer completion states
  const [transferChecks, setTransferChecks] = useState<{[key: string]: boolean}>({});
  const [andreasShareChecked, setAndreasShareChecked] = useState<boolean>(false);
  const [susannaShareChecked, setSusannaShareChecked] = useState<boolean>(false);

  // Create month dialog state
  const [isCreateMonthDialogOpen, setIsCreateMonthDialogOpen] = useState<boolean>(false);
  
  // Cost item edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<(SubCategory & { groupId: string; categoryName: string }) | null>(null);
  const [createMonthDirection, setCreateMonthDirection] = useState<'previous' | 'next'>('next');
  
  // Add budget item dialog state
  const [showAddBudgetDialog, setShowAddBudgetDialog] = useState<{
    isOpen: boolean;
    type: 'cost' | 'savings';
  }>({ isOpen: false, type: 'cost' });

  // Sparmål state
  const [isCreateSavingsGoalDialogOpen, setIsCreateSavingsGoalDialogOpen] = useState<boolean>(false);
  console.log('🔍 [DEBUG] isCreateSavingsGoalDialogOpen state initialized:', isCreateSavingsGoalDialogOpen);
  const [newSavingsGoalName, setNewSavingsGoalName] = useState<string>('');
  const [newSavingsGoalAccount, setNewSavingsGoalAccount] = useState<string>('');
  const [newSavingsGoalTarget, setNewSavingsGoalTarget] = useState<string>('');
  const [newSavingsGoalStartDate, setNewSavingsGoalStartDate] = useState<string>('');
  const [newSavingsGoalEndDate, setNewSavingsGoalEndDate] = useState<string>('');
  
  // Transaction drill down dialog state
  const [drillDownDialog, setDrillDownDialog] = useState<{
    isOpen: boolean;
    transactions: Transaction[];
    categoryName: string;
    budgetAmount: number;
    actualAmount: number;
  }>({
    isOpen: false,
    transactions: [],
    categoryName: '',
    budgetAmount: 0,
    actualAmount: 0
  });
  
  // Account balances - läs direkt från central state (inga lokala useState längre)
  
  // Chart selection states
  const [selectedAccountsForChart, setSelectedAccountsForChart] = useState<string[]>([]);
  const [showIndividualCostsOutsideBudget, setShowIndividualCostsOutsideBudget] = useState<boolean>(false);
  const [showSavingsSeparately, setShowSavingsSeparately] = useState<boolean>(false);
  const [showEstimatedBudgetAmounts, setShowEstimatedBudgetAmounts] = useState<boolean>(false);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(true);
  const [balanceType, setBalanceType] = useState<'starting' | 'closing'>('closing');
  const [monthFinalBalances, setMonthFinalBalances] = useState<{[key: string]: boolean}>({});
  const [costViewType, setCostViewType] = useState<'category' | 'account'>('category');
  
  // Chart legend and time range states
  const [isChartLegendExpanded, setIsChartLegendExpanded] = useState<boolean>(false);
  const [useCustomTimeRange, setUseCustomTimeRange] = useState<boolean>(false);
  const [chartStartMonth, setChartStartMonth] = useState<string>('');
  const [chartEndMonth, setChartEndMonth] = useState<string>('');
  
  // SINGLE SOURCE OF TRUTH: Read from historicalData[selectedMonthKey]
  const { historicalData: appHistoricalData, selectedMonthKey } = budgetState;
  const currentMonthData = appHistoricalData[selectedMonthKey] || {};
  
  // CRITICAL DEBUG: Log what data is actually available
  console.log(`🔍 [DATA LOADING] selectedMonthKey: ${selectedMonthKey}`);
  console.log(`🔍 [DATA LOADING] appHistoricalData keys:`, Object.keys(appHistoricalData));
  console.log(`🔍 [DATA LOADING] currentMonthData:`, currentMonthData);
  console.log(`🔍 [DATA LOADING] currentMonthData.accountBalances:`, (currentMonthData as any).accountBalances);
  console.log(`🔍 [DATA LOADING] currentMonthData.accountBalancesSet:`, (currentMonthData as any).accountBalancesSet);
  
  // Data från den enda källan till sanning
  const andreasSalary = (currentMonthData as any).andreasSalary || 45000;
  const andreasförsäkringskassan = (currentMonthData as any).andreasförsäkringskassan || 0;
  const andreasbarnbidrag = (currentMonthData as any).andreasbarnbidrag || 0;
  const susannaSalary = (currentMonthData as any).susannaSalary || 40000;
  const susannaförsäkringskassan = (currentMonthData as any).susannaförsäkringskassan || 5000;
  const susannabarnbidrag = (currentMonthData as any).susannabarnbidrag || 0;
  const costGroups = (currentMonthData as any).costGroups || [];
  const savingsGroups = (currentMonthData as any).savingsGroups || [];
  const dailyTransfer = (currentMonthData as any).dailyTransfer || 300;
  const weekendTransfer = (currentMonthData as any).weekendTransfer || 540;
  const customHolidays = (currentMonthData as any).customHolidays || [];
  const results = calculated.results;
  const historicalData = appHistoricalData;
  const selectedHistoricalMonth = budgetState.selectedHistoricalMonth;
  const selectedBudgetMonth = selectedMonthKey;
  
  // Personal budget values from current month data
  const andreasPersonalCosts = (currentMonthData as any).andreasPersonalCosts || 0;
  const andreasPersonalSavings = (currentMonthData as any).andreasPersonalSavings || 0;
  const susannaPersonalCosts = (currentMonthData as any).susannaPersonalCosts || 0;
  const susannaPersonalSavings = (currentMonthData as any).susannaPersonalSavings || 0;
  
  // Account management states  
  const accounts = budgetState.accounts.map(acc => acc.name);
  
  // Create unified savings items list that combines savingsGroups with active savings goals
  const allSavingsItems = useMemo(() => {
    // 1. Start with regular, general savings
    const generalSavings = savingsGroups || [];

    // 2. Get all savings goals from global state
    const savingsGoals = budgetState.savingsGoals || [];

    // 3. Filter and transform savings goals that are active this month
    const activeGoalsAsSavingsItems = savingsGoals
      .map(goal => {
        // Calculate monthly savings amount for the goal
        const start = new Date(goal.startDate + '-01');
        const end = new Date(goal.endDate + '-01');
        const currentMonthDate = new Date(selectedBudgetMonth + '-01');

        // Check if goal is active
        if (currentMonthDate >= start && currentMonthDate <= end) {
          const monthsDiff = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + 
                             (end.getMonth() - start.getMonth()) + 1);
          
          if (monthsDiff > 0) {
            const monthlyAmount = goal.targetAmount / monthsDiff;

            // Transform savings goal into an object that looks like regular savings
            return {
              id: goal.id,
              name: `${goal.name} (Sparmål)`, // Clarify that it's a savings goal
              amount: monthlyAmount,
              type: 'savings' as const,
              mainCategoryId: goal.mainCategoryId,
              subCategoryId: goal.subCategoryId,
              account: goal.accountId ? budgetState.accounts.find(a => a.id === goal.accountId)?.name : undefined,
              // Keep original savings goal properties for compatibility
              _originalGoal: goal
            };
          }
        }
        return null;
      })
      .filter(Boolean); // Filter out null values (inactive goals)

    // 4. Combine the two lists into one
    return [...generalSavings, ...activeGoalsAsSavingsItems];

  }, [savingsGroups, budgetState.savingsGoals, selectedBudgetMonth, budgetState.accounts]);

  // --- NY, FILTRERAD LOGIK STARTAR HÄR ---
  
  // Dynamisk filtrering av kategorier och konton baserat på aktiv användning
  const activeContent = useMemo(() => {
    console.log('🚨🚨🚨 ACTIVEONTENT CALCULATION RUNNING 🚨🚨🚨');
    console.log('🚨 FORCED DEBUG - Selected month key:', selectedMonthKey);
    console.log('🚨 FORCED DEBUG - Available historical data months:', Object.keys(appHistoricalData));
    
    // 1. Hämta alla budgetposter för den relevanta perioden
    const costItems = (currentMonthData as any).costItems || [];
    const savingsItems = (currentMonthData as any).savingsItems || [];
    const budgetItems = [...costItems, ...savingsItems];
    
    // 2. Hämta transaktioner för perioden (25:e föregående månad till 24:e aktuell månad)
    console.log('🚨 FORCED DEBUG - Calling getTransactionsForPeriod...');
    const transactionsForPeriod = getTransactionsForPeriod(appHistoricalData, selectedMonthKey);
    console.log('🚨 FORCED DEBUG - getTransactionsForPeriod returned:', transactionsForPeriod.length, 'transactions');
    console.log('🚨 FORCED DEBUG - Sample transactions:', transactionsForPeriod.slice(0, 3).map(t => ({ id: t.id, accountId: t.accountId, amount: t.amount })));
    
    // 3. Samla alla unika ID:n för kategorier som används
    const activeMainCategoryIds = new Set<string>();
    
    // Från budgetposter
    budgetItems.forEach(item => {
      if (item.mainCategoryId) {
        activeMainCategoryIds.add(item.mainCategoryId);
      }
    });
    
    // Från transaktioner
    transactionsForPeriod.forEach(transaction => {
      if (transaction.appCategoryId) {
        activeMainCategoryIds.add(transaction.appCategoryId);
      }
    });
    
    // Från legacy costGroups och savingsGroups (för bakåtkompatibilitet)
    [...costGroups, ...savingsGroups].forEach(group => {
      if (group.name) {
        activeMainCategoryIds.add(group.name);
      }
    });
    
    // 1. Hitta alla unika och aktiva KONTO-NAMN
    const activeAccountNames = new Set<string>();

    // Lägg till kontonamn från budgetposter
    budgetItems.forEach(item => {
      if (item.account) {
        activeAccountNames.add(item.account);
      }
    });

    // Lägg till kontonamn från transaktioner, med översättning från ID till namn
    transactionsForPeriod.forEach(t => {
      if (t.accountId) {
        // Hitta det matchande kontot i master-listan
        const account = budgetState.accounts.find(acc => acc.id === t.accountId);
        if (account) {
          activeAccountNames.add(account.name);
        }
      }
    });

    // Från legacy groups (för bakåtkompatibilitet)
    [...costGroups, ...savingsGroups].forEach(group => {
      if (group.account) {
        activeAccountNames.add(group.account);
      }
      if (group.subCategories) {
        group.subCategories.forEach(sub => {
          if (sub.account) {
            activeAccountNames.add(sub.account);
          }
        });
      }
    });

    // Filtrera kategorier baserat på de aktiva ID:n
    const activeCategories = budgetState.mainCategories.filter(category => 
      activeMainCategoryIds.has(category)
    );

    // 2. Filtrera den centrala "master-listan" av konton
    // baserat på de aktiva namnen.
    const activeAccounts = budgetState.accounts.filter(account => 
      activeAccountNames.has(account.name)
    );
    
    console.log('🚨🚨🚨 FINAL RESULTS 🚨🚨🚨');
    console.log('🚨 Active account names found:', Array.from(activeAccountNames));
    console.log('🚨 All available accounts in budgetState:', budgetState.accounts.map(a => ({ id: a.id, name: a.name })));
    console.log('🚨 Final filtered active accounts:', activeAccounts.map(a => ({ id: a.id, name: a.name })));
    console.log('🚨 Does Hushållskonto exist in budget state?', budgetState.accounts.find(a => a.name === 'Hushållskonto'));
    
    return { 
      activeCategories, 
      activeAccounts, // Use the correctly filtered account list
      budgetItems: { costItems, savingsItems },
      transactionsForPeriod
    };

  }, [currentMonthData, appHistoricalData, selectedMonthKey, budgetState.accounts, budgetState.mainCategories, costGroups, savingsGroups]);

  // --- SLUT PÅ NY LOGIK ---
  
  // CRITICAL DEBUG: Log the exact data being used
  console.log(`🚨 [RENDER] budgetState.historicalData:`, budgetState.historicalData);
  console.log(`🚨 [RENDER] selectedMonthKey:`, selectedMonthKey);
  console.log(`🚨 [RENDER] currentMonthData:`, currentMonthData);

  // Account balances - LÄS DIREKT FRÅN CENTRAL STATE (inga lokala useState längre)
  const accountBalances = (currentMonthData as any).accountBalances || {};
  const accountBalancesSet = (currentMonthData as any).accountBalancesSet || {};
  const accountEstimatedFinalBalances = (currentMonthData as any).accountEstimatedFinalBalances || {};
  const accountEstimatedFinalBalancesSet = (currentMonthData as any).accountEstimatedFinalBalancesSet || {};
  const accountEstimatedStartBalances = (currentMonthData as any).accountEstimatedStartBalances || {};
  const accountStartBalancesSet = (currentMonthData as any).accountStartBalancesSet || {};
  
  // Calculate accountEndBalances dynamically from next month's accountBalances
  const accountEndBalances = calculateAccountEndBalances(
    budgetState.historicalData, 
    budgetState.selectedMonthKey, 
    budgetState.accounts
  );
  const accountEndBalancesSet = {}; // No longer used since it's calculated

  // Helper function to check if next month's balance is set for an account
  const isNextMonthBalanceSet = (accountName: string): boolean => {
    const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    
    const nextMonthData = budgetState.historicalData[nextMonthKey];
    return nextMonthData?.accountBalancesSet?.[accountName] === true;
  };

  // Helper function to get next month name
  const getNextMonthName = (): string => {
    const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                       'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    return monthNames[nextMonth - 1];
  };

  // CRITICAL DEBUG: Force logging of actual values being used in component
  useEffect(() => {
    console.log(`🔥 [COMPONENT DATA] accountBalances:`, accountBalances);
    console.log(`🔥 [COMPONENT DATA] accountBalancesSet:`, accountBalancesSet);
    console.log(`🔥 [COMPONENT DATA] accounts:`, accounts);
  }, [JSON.stringify(accountBalances), JSON.stringify(accountBalancesSet), JSON.stringify(accounts)]);

  // Helper functions for calculating actual amounts from transactions
  const calculateActualAmountForCategory = (categoryId: string): number => {
    const monthTransactions = (currentMonthData as any).transactions || [];
    
    // DEBUG: Log all transaction data to understand the structure
    console.log(`🔍 [DEBUG] calculateActualAmountForCategory for categoryId: ${categoryId}`);
    console.log(`🔍 [DEBUG] Total transactions in month:`, monthTransactions.length);
    console.log(`🔍 [DEBUG] All transactions:`, monthTransactions);
    
    const matchingTransactions = monthTransactions.filter((t: Transaction) => {
      const matches = t.appCategoryId === categoryId;
      console.log(`🔍 [DEBUG] Transaction ${t.id}: appCategoryId=${t.appCategoryId}, categoryId=${categoryId}, matches=${matches}`);
      return matches;
    });
    
    console.log(`🔍 [DEBUG] Matching transactions for category ${categoryId}:`, matchingTransactions);
    
    const total = matchingTransactions.reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);
    console.log(`🔍 [DEBUG] Total amount for category ${categoryId}: ${total}`);
    
    return total;
  };

  const getTransactionsForCategory = (categoryId: string): Transaction[] => {
    const monthTransactions = (currentMonthData as any).transactions || [];
    return monthTransactions.filter((t: Transaction) => t.appCategoryId === categoryId);
  };

  const getTransactionsForAccount = (accountName: string): Transaction[] => {
    const monthTransactions = (currentMonthData as any).transactions || [];
    console.log(`🔍 [DEBUG] getTransactionsForAccount called with accountName: "${accountName}"`);
    console.log(`🔍 [DEBUG] Available transactions:`, monthTransactions.map((t: Transaction) => ({
      id: t.id,
      accountId: t.accountId,
      description: t.description,
      amount: t.amount,
      appCategoryId: t.appCategoryId
    })));
    
    // For budget accounts, we need to find transactions that belong to subcategories in this account
    // Get all subcategories that belong to this budget account
    const accountSubcategories: string[] = [];
    costGroups.forEach(group => {
      group.subCategories?.forEach(sub => {
        if (sub.account === accountName) {
          // Use the group ID as the category ID for transactions
          accountSubcategories.push(group.id);
        }
      });
    });
    
    console.log(`🔍 [DEBUG] Found subcategories for account "${accountName}":`, accountSubcategories);
    
    // Filter transactions by category ID (appCategoryId) that belong to this account
    const filtered = monthTransactions.filter((t: Transaction) => 
      accountSubcategories.includes(t.appCategoryId || '')
    );
    
    console.log(`🔍 [DEBUG] Filtered transactions for account "${accountName}":`, filtered);
    return filtered;
  };

  const openDrillDownDialog = (categoryName: string, categoryId: string, budgetAmount: number) => {
    const transactions = getTransactionsForCategory(categoryId);
    const actualAmount = calculateActualAmountForCategory(categoryId);
    
    setDrillDownDialog({
      isOpen: true,
      transactions,
      categoryName,
      budgetAmount,
      actualAmount
    });
  };

  const openAccountDrillDownDialog = (accountName: string, budgetAmount: number, actualAmount: number) => {
    const transactions = getTransactionsForAccount(accountName);
    
    setDrillDownDialog({
      isOpen: true,
      transactions,
      categoryName: accountName,
      budgetAmount,
      actualAmount
    });
  };


  // Helper function to calculate the correct amount for a subcategory (daily or monthly)
  const getSubcategoryDisplayAmount = (subcategory: SubCategory): number => {
    if (subcategory.transferType === 'daily' && subcategory.dailyAmount && subcategory.transferDays) {
      return calculateMonthlyAmountForDailyTransfer(subcategory, selectedBudgetMonth);
    }
    return subcategory.amount;
  };

  // FUNCTION DEFINITIONS (must come before useEffect hooks that call them)
  const calculateBudget = () => {
    const andreasTotalIncome = andreasSalary + andreasförsäkringskassan + andreasbarnbidrag;
    const susannaTotalIncome = susannaSalary + susannaförsäkringskassan + susannabarnbidrag;
    const totalSalary = andreasTotalIncome + susannaTotalIncome;
    const budgetData = calculateDailyBudget();
    
    // Calculate total costs (only from subcategories, main categories are calculated automatically)
    const totalCosts = costGroups.reduce((sum, group) => {
      const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + getSubcategoryDisplayAmount(sub), 0) || 0;
      return sum + subCategoriesTotal;
    }, 0);
    
    // Calculate total savings
    const totalSavings = allSavingsItems.reduce((sum, group) => sum + group.amount, 0);
    
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
    const balanceLeft = preliminaryBalance - susannaShare - andreasShare;
    
    // Calculate final balances (Slutsaldo) for each account using EXACT same logic as UI
    const finalBalances: {[key: string]: number} = {};
    accounts.forEach(account => {
      // CRITICAL: Use exact same calculation as UI "Slutsaldo" display
      
      // Get original balance using Calc.Kontosaldo from same month (same as UI)
      const originalBalance = getCalcKontosaldoSameMonth(account);
      
      // Calculate total deposits (savings) for this account (same as UI)
      const savingsAmount = savingsGroups
        .filter(group => group.account === account)
        .reduce((sum, group) => sum + group.amount, 0);
      const totalDeposits = savingsAmount;
      
      // Get all cost subcategories for this account that are "Löpande kostnad" (same as UI)
      const accountCostItems = costGroups.reduce((items, group) => {
        const groupCosts = group.subCategories?.filter(sub => 
          sub.account === account && (sub.financedFrom === 'Löpande kostnad' || !sub.financedFrom)
        ) || [];
        return items.concat(groupCosts);
      }, []);
      
      // Calculate total costs for this account (only Löpande kostnad) (same as UI)
      const totalCosts = accountCostItems.reduce((sum, item) => sum + item.amount, 0);
      
      // Calculate final balance as sum of ALL entries shown in the table (same as UI):
      // original balance + savings deposits + cost budget deposits - all costs
      const allCostItems = costGroups.reduce((items, group) => {
        const groupCosts = group.subCategories?.filter(sub => sub.account === account) || [];
        return items.concat(groupCosts);
      }, []);
      const totalAllCosts = allCostItems.reduce((sum, item) => sum + item.amount, 0);
      
      // EXACT same calculation as UI Slutsaldo
      const calculatedBalance = originalBalance + totalDeposits + totalCosts - totalAllCosts;
      
      console.log(`=== SLUTSALDO CALCULATION FOR ${account} (MATCHING UI) ===`);
      console.log(`Original balance: ${originalBalance}`);
      console.log(`Total deposits (savings): ${totalDeposits}`);
      console.log(`Total costs (Löpande kostnad): ${totalCosts}`);
      console.log(`Total all costs (all types): ${totalAllCosts}`);
      console.log(`Calculation: ${originalBalance} + ${totalDeposits} + ${totalCosts} - ${totalAllCosts} = ${calculatedBalance}`);
      console.log(`This MUST match UI Slutsaldo display for ${account}`);
      
      finalBalances[account] = calculatedBalance;
    });
    
    // Update state with final balances
    // REMOVED: setAccountEstimatedFinalBalances(finalBalances);
    // The orchestrator now handles all balance calculations
    
    // Mark all final balances as calculated (not user-input)
    // REMOVED: setAccountEstimatedFinalBalancesSet(finalBalancesSetState);
    // The orchestrator now handles all balance state management
    
    // Check and set MonthFinalBalances flag when final balances are calculated and saved
    const currentDateForFlag = new Date();
    const monthKeyForFlag = selectedBudgetMonth || `${currentDateForFlag.getFullYear()}-${String(currentDateForFlag.getMonth() + 1).padStart(2, '0')}`;
    checkAndSetMonthFinalBalancesFlag(monthKeyForFlag);
    
    console.log('Holiday days calculated:', budgetData.holidayDays);
    // REMOVED: setResults() call - orchestrator now handles all calculations automatically
    // setResults({
    //   totalSalary,
    //   totalDailyBudget: budgetData.totalBudget,
    //   remainingDailyBudget: budgetData.remainingBudget,
    //   holidayDaysBudget: budgetData.holidayBudget,
    //   balanceLeft,
    //   susannaShare,
    //   andreasShare,
    //   susannaPercentage,
    //   andreasPercentage,
    //   daysUntil25th: budgetData.daysUntil25th,
    //   weekdayCount: budgetData.weekdayCount,
    //   fridayCount: budgetData.fridayCount,
    //   totalMonthlyExpenses,
    //   holidayDays: budgetData.holidayDays,
    //   holidaysUntil25th: budgetData.holidaysUntil25th,
    //   nextTenHolidays: budgetData.nextTenHolidays,
    //   remainingWeekdayCount: budgetData.remainingWeekdayCount,
    //   remainingFridayCount: budgetData.remainingFridayCount
    // });
    
    // Update historical data for selected month with calculated results INCLUDING final balances
    const currentDate = new Date();
    const monthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Create specifically formatted ending balance keys for each account
    const [currentYear, currentMonth] = monthKey.split('-');
    const endingBalanceKeys: {[key: string]: number} = {};
    accounts.forEach(account => {
      const endingBalanceKey = `${account}.${currentYear}.${currentMonth}.Endbalance`;
      endingBalanceKeys[endingBalanceKey] = finalBalances[account];
    });
    
    // Update the existing month data with calculated results
    if (historicalData[monthKey]) {
      const updatedMonthData = {
        ...historicalData[monthKey], // Keep existing data
        // Update with fresh calculated results
        totalMonthlyExpenses,
        totalCosts,
        totalSavings,
        balanceLeft,
        susannaShare,
        andreasShare,
        susannaPercentage,
        andreasPercentage,
        totalDailyBudget: budgetData.totalBudget,
        remainingDailyBudget: budgetData.remainingBudget,
        holidayDaysBudget: budgetData.holidayBudget,
        daysUntil25th: budgetData.daysUntil25th,
        accountEstimatedFinalBalances: finalBalances, // Save the calculated Slutsaldo to accountEstimatedFinalBalances
        date: currentDate.toISOString() // Update timestamp
      };
      
      // REMOVED: updateHistoricalDataSingle(monthKey, updatedMonthData);
      // The orchestrator now handles all data updates automatically
      console.log(`💾 AFTER SAVE - historicalData[${monthKey}].accountEstimatedFinalBalances:`, finalBalances);
      console.log(`💾 SPECIFICALLY Löpande for ${monthKey}:`, finalBalances?.['Löpande']);
    }
    
    console.log(`🔥 SAVING accountEstimatedFinalBalances for ${monthKey}:`, finalBalances);
    console.log(`Final balances calculated and saved for ${monthKey}:`, finalBalances);
    console.log(`🔍 SEPTEMBER DEBUG - Key details for September Slutsaldo:`);
    console.log(`   - Month: ${monthKey}`);
    console.log(`   - Is this September? ${monthKey.includes('2025-09')}`);
    console.log(`   - Löpande final balance: ${finalBalances['Löpande']}`);
    console.log(`   - This should show 5500 for September`);
    console.log(`   - Will be used as opening balance for October`);
  };

  // Centralized month list logic for consistent dropdown behavior
  const availableMonths = useMemo(() => {
    const keys = Object.keys(historicalData).sort((a, b) => a.localeCompare(b));
    console.log(`🔍 availableMonths recalculated. historicalData keys:`, keys);
    return keys;
  }, [historicalData]);

  // Calculate structured account data for table view
  const accountDataRows: AccountDataRow[] = React.useMemo(() => {
    // Helper function to get Calc.Kontosaldo for a month and account
    const getCalcKontosaldoForTable = (monthKey: string, account: string) => {
      const monthData = historicalData[monthKey];
      
      if (!monthData) {
        return { balance: 0, isEstimated: true };
      }
      
      const hasActualBalance = monthData.accountBalancesSet && 
                              monthData.accountBalancesSet[account] === true;
      const currentBalance = monthData.accountBalances?.[account] || 0;
      
      // If Faktiskt kontosaldo is "Ej ifyllt" (not filled), use estimated opening balance
      let estimatedOpeningBalance = 0;
      if (!hasActualBalance) {
        // Get estimated opening balance for this month by looking at previous month's ending balance
        const [currentYear, currentMonth] = monthKey.split('-').map(Number);
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
        const prevMonthData = historicalData[prevMonthKey];
        
        if (prevMonthData) {
          const endingBalanceKey = `${account}.${prevYear}.${String(prevMonth).padStart(2, '0')}.Endbalance`;
          estimatedOpeningBalance = prevMonthData.accountEndingBalances?.[endingBalanceKey] || 
                                   prevMonthData.accountEstimatedFinalBalances?.[account] || 
                                   prevMonthData.accountBalances?.[account] || 0;
        }
      }
      
      const calcBalance = hasActualBalance ? currentBalance : estimatedOpeningBalance;
      const isUsingEstimated = !hasActualBalance;
      
      return { balance: calcBalance, isEstimated: isUsingEstimated };
    };

    const rows: AccountDataRow[] = [];
    const allMonthKeys = Object.keys(historicalData).sort();
    
    allMonthKeys.forEach(monthKey => {
      const [year, month] = monthKey.split('-');
      const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                         'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
      
      // Calculate previous month for display
      const currentYear = parseInt(year);
      const currentMonth = parseInt(month);
      
      let displayYear: number;
      let displayMonth: number;
      
      if (currentMonth === 1) {
        // January -> December of previous year
        displayYear = currentYear - 1;
        displayMonth = 12;
      } else {
        // Any other month -> previous month of same year
        displayYear = currentYear;
        displayMonth = currentMonth - 1;
      }
      
      const displayMonthName = monthNames[displayMonth - 1];
      
      accounts.forEach(account => {
        const { balance, isEstimated } = getCalcKontosaldoForTable(monthKey, account);
        const calcDescr = isEstimated ? "(Est)" : "";
        
        rows.push({
          year: displayYear,
          month: displayMonthName,
          monthKey, // Keep original monthKey for data lookup
          account,
          calcKontosaldo: balance,
          calcDescr
        });
      });
    });
    
    return rows;
  }, [historicalData, accounts]);
  
  // LOADING STATE - Render loading overlay instead of conditional return
  const loadingOverlay = isLoading ? (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Laddar budget...</h1>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    </div>
  ) : null;

  // Helper function to add debug log - now using global logger
  const addDebugLog = (message: string) => {
    addMobileDebugLog(message);
  };

  // Function to save current month as historical
  const handleSaveCurrentMonthAsHistorical = () => {
    addDebugLog('🎯 SAVE BUTTON: Spara denna månad clicked');
    addDebugLog(`🎯 SAVE BUTTON: selectedBudgetMonth: ${selectedBudgetMonth}`);
    
    if (!selectedBudgetMonth) {
      alert('Ingen månad är vald att spara.');
      return;
    }

    // Samla ihop all data från de nuvarande state-variablerna
    const currentMonthDataToSave = {
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
      transferAccount,
      andreasPersonalCosts,
      andreasPersonalSavings,
      susannaPersonalCosts,
      susannaPersonalSavings,
      accounts,
      customHolidays,
      accountBalances: (currentMonthData as any).accountBalances || {},
      accountBalancesSet: (currentMonthData as any).accountBalancesSet || {},
      accountEstimatedFinalBalances: (currentMonthData as any).accountEstimatedFinalBalances || {},
      accountEstimatedFinalBalancesSet: (currentMonthData as any).accountEstimatedFinalBalancesSet || {},
      accountEstimatedStartBalances: (currentMonthData as any).accountEstimatedStartBalances || {},
      accountStartBalancesSet: (currentMonthData as any).accountStartBalancesSet || {},
      userName1: (currentMonthData as any).userName1 || 'Andreas',
      userName2: (currentMonthData as any).userName2 || 'Susanna',
      transferChecks: (currentMonthData as any).transferChecks || {},
      andreasShareChecked: (currentMonthData as any).andreasShareChecked || false,
      susannaShareChecked: (currentMonthData as any).susannaShareChecked || false,
      createdAt: new Date().toISOString()
    };

    addDebugLog(`🎯 SAVE BUTTON: andreasSalary: ${currentMonthDataToSave.andreasSalary}`);
    addDebugLog(`🎯 SAVE BUTTON: susannaSalary: ${currentMonthDataToSave.susannaSalary}`);
    addDebugLog(`🎯 SAVE BUTTON: accountBalances: ${JSON.stringify(currentMonthDataToSave.accountBalances)}`);
    addDebugLog(`🎯 SAVE BUTTON: accountBalancesSet: ${JSON.stringify(currentMonthDataToSave.accountBalancesSet)}`);

    // Create a NEW object that contains all old data PLUS the new month
    const newHistoricalData = {
      ...historicalData,
      [selectedBudgetMonth]: currentMonthDataToSave
    };

    addDebugLog(`🎯 SAVE BUTTON: Calling updateHistoricalData with keys: ${Object.keys(newHistoricalData).join(', ')}`);

    // Use the central state management to update historical data
    updateHistoricalData(newHistoricalData);

    addDebugLog('🎯 SAVE BUTTON: updateHistoricalData called successfully');
    addDebugLog(`✅ Budgeten för ${selectedBudgetMonth} har sparats till historiken!`);
    
    // Don't show alert, just show in debug panel
    setShowDebugPanel(true);
  };

  // Function to handle creating a new savings goal
  const handleCreateSavingsGoal = () => {
    console.log('🔍 [DEBUG] handleCreateSavingsGoal function called');
    if (!newSavingsGoalName || !newSavingsGoalAccount || !newSavingsGoalTarget || 
        !newSavingsGoalStartDate || !newSavingsGoalEndDate) {
      return;
    }

    const newGoal = {
      name: newSavingsGoalName,
      accountId: newSavingsGoalAccount,
      targetAmount: parseFloat(newSavingsGoalTarget),
      startDate: newSavingsGoalStartDate,
      endDate: newSavingsGoalEndDate
    };

    createSavingsGoal(newGoal);
    setIsCreateSavingsGoalDialogOpen(false);
    setNewSavingsGoalName('');
    setNewSavingsGoalAccount('');
    setNewSavingsGoalTarget('');
    setNewSavingsGoalStartDate('');
    setNewSavingsGoalEndDate('');
  };

  // Handler för BudgetItem struktur
  const handleAddBudgetItem = (budgetItem: any) => {
    console.log('🔍 [DEBUG] handleAddBudgetItem called with:', budgetItem);
    
    // För nu, konvertera tillbaka till legacy format för att inte bryta befintlig logik
    const legacyItem = {
      mainCategory: budgetItem.mainCategoryId,
      subcategory: budgetItem.subCategoryId,
      name: budgetItem.description,
      amount: budgetItem.amount,
      account: budgetState.accounts.find(acc => acc.id === budgetItem.accountId)?.name || '',
      financedFrom: budgetItem.financedFrom || 'Löpande kostnad',
      transferType: budgetItem.transferType,
      dailyAmount: budgetItem.dailyAmount,
      transferDays: budgetItem.transferDays
    };
    handleAddCostItem(legacyItem);
  };
  
  // Tab navigation helper functions
  const getTabOrder = () => {
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    
    let targetMonthKey;
    if (currentDay <= 24) {
      // Before/on 24th: show for current month
      targetMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // After 24th: show for next month
      const nextMonth = currentDate.getMonth() + 1;
      const nextYear = nextMonth === 12 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
      const adjustedNextMonth = nextMonth === 12 ? 1 : nextMonth + 1;
      targetMonthKey = `${nextYear}-${String(adjustedNextMonth).padStart(2, '0')}`;
    }
    
    const shouldShowOverforingTab = selectedBudgetMonth === targetMonthKey;
    
    return shouldShowOverforingTab 
      ? ["inkomster", "sammanstallning", "overforing", "egen-budget", "historia", "sparmal", "transaktioner", "installningar"]
      : ["inkomster", "sammanstallning", "egen-budget", "historia", "sparmal", "transaktioner", "installningar"];
  };

  const navigateToNextTab = () => {
    if (isAnimating) return;
    
    const tabs = getTabOrder();
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = (currentIndex + 1) % tabs.length;
    
    setPreviousTab(activeTab);
    setSwipeDirection("left");
    setIsAnimating(true);
    
    setTimeout(() => {
      setActiveTab(tabs[nextIndex]);
      setTimeout(() => {
        // Find the main title element for the current tab
        const mainTitle = document.querySelector('h1.text-3xl.font-bold.text-center');
        if (mainTitle) {
          mainTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
      setTimeout(() => {
        setIsAnimating(false);
        setSwipeDirection(null);
        setPreviousTab("");
      }, 300);
    }, 150);
  };

  const navigateToPreviousTab = () => {
    if (isAnimating) return;
    
    const tabs = getTabOrder();
    const currentIndex = tabs.indexOf(activeTab);
    const previousIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    
    setPreviousTab(activeTab);
    setSwipeDirection("right");
    setIsAnimating(true);
    
    setTimeout(() => {
      setActiveTab(tabs[previousIndex]);
      setTimeout(() => {
        // Find the main title element for the current tab
        const mainTitle = document.querySelector('h1.text-3xl.font-bold.text-center');
        if (mainTitle) {
          mainTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
      setTimeout(() => {
        setIsAnimating(false);
        setSwipeDirection(null);
        setPreviousTab("");
      }, 300);
    }, 150);
  };

  // Add swipe gestures
  useSwipeGestures({
    onSwipeLeft: navigateToNextTab,
    onSwipeRight: navigateToPreviousTab,
    threshold: 50
  });
  
  // Alternative budget states - no longer needed for the read-only fields
  // const [altTotalDailyBudget, setAltTotalDailyBudget] = useState<number>(0);
  // const [altTotalSharedCosts, setAltTotalSharedCosts] = useState<number>(0);
  // const [altTotalSharedSavings, setAltTotalSharedSavings] = useState<number>(0);

  // Swedish holiday calculation
  const getSwedishHolidays = (year: number) => {
    const holidays = [];
    
    // Fixed holidays
    holidays.push(new Date(year, 0, 1));   // New Year's Day
    holidays.push(new Date(year, 0, 6));   // Epiphany
    holidays.push(new Date(year, 4, 1));   // May Day
    holidays.push(new Date(year, 5, 6));   // National Day
    holidays.push(new Date(year, 11, 24)); // Christmas Eve
    holidays.push(new Date(year, 11, 25)); // Christmas Day
    holidays.push(new Date(year, 11, 26)); // Boxing Day
    holidays.push(new Date(year, 11, 31)); // New Year's Eve
    
    // Calculate Easter and related holidays
    const easter = calculateEaster(year);
    holidays.push(new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000)); // Good Friday
    holidays.push(new Date(easter.getTime() + 24 * 60 * 60 * 1000));     // Easter Monday
    holidays.push(new Date(easter.getTime() + 39 * 24 * 60 * 60 * 1000)); // Ascension Day
    holidays.push(new Date(easter.getTime() + 50 * 24 * 60 * 60 * 1000)); // Whit Monday
    
    // Midsummer's Eve (Friday between June 19-25)
    const midsummer = getMidsummerEve(year);
    holidays.push(midsummer);
    
    // All Saints' Day (Saturday between October 31 - November 6)
    const allSaints = getAllSaintsDay(year);
    holidays.push(allSaints);
    
    return holidays;
  };

  const calculateEaster = (year: number) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  };

  const getMidsummerEve = (year: number) => {
    // Friday between June 19-25
    for (let day = 19; day <= 25; day++) {
      const date = new Date(year, 5, day); // June
      if (date.getDay() === 5) { // Friday
        return date;
      }
    }
    return new Date(year, 5, 24); // Fallback
  };

  const getAllSaintsDay = (year: number) => {
    // Saturday between October 31 - November 6
    for (let day = 31; day >= 25; day--) {
      const date = new Date(year, 9, day); // October
      if (date.getDay() === 6) { // Saturday
        return date;
      }
    }
    // Check early November
    for (let day = 1; day <= 6; day++) {
      const date = new Date(year, 10, day); // November
      if (date.getDay() === 6) { // Saturday
        return date;
      }
    }
    return new Date(year, 10, 1); // Fallback
  };

  const isSwedishHoliday = (date: Date) => {
    const year = date.getFullYear();
    const holidays = getSwedishHolidays(year);
    
    // Check official Swedish holidays
    const isOfficialHoliday = holidays.some(holiday => 
      holiday.getDate() === date.getDate() &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getFullYear() === date.getFullYear()
    );
    
    // Check custom holidays
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const isCustomHoliday = customHolidays.some(holiday => holiday.date === dateString);
    
    return isOfficialHoliday || isCustomHoliday;
  };

  // Load saved values from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('budgetCalculatorData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        
        // ARKITEKTONISK FIX: All budgetdata läses nu från central state automatiskt
        // Ingen lokal initiering från localStorage behövs längre för budget-specifika värden
        
        // Load UI-specific data (non-budget data)
        setSelectedPerson(parsed.selectedPerson || 'andreas');
        
        // Load account categories data
        const loadedCategories = parsed.accountCategories || ['Privat', 'Gemensam', 'Sparande', 'Hushåll'];
        setAccountCategories(loadedCategories);
        setAccountCategoryMapping(parsed.accountCategoryMapping || {});
        
        // Initialize all account categories as expanded
        const expandedCategoriesState = loadedCategories.reduce((acc: {[key: string]: boolean}, category: string) => {
          acc[category] = true;
          return acc;
        }, {});
        setExpandedAccounts(expandedCategoriesState);
        
        // Load budget templates
        setBudgetTemplates(parsed.budgetTemplates || {});
        
        // Load user names
        setUserName1(parsed.userName1 || 'Andreas');
        setUserName2(parsed.userName2 || 'Susanna');
        
        // Load transfer checkbox states
        setTransferChecks(parsed.transferChecks || {});
        setAndreasShareChecked(parsed.andreasShareChecked || false);
        setSusannaShareChecked(parsed.susannaShareChecked || false);
        
        // ARKITEKTONISK FIX: Account balances läses nu från central state, så detta behövs inte längre
        // const loadedBalances = parsed.accountBalances || {};
        // setAccountBalances(loadedBalances);
        // setAccountBalancesSet(parsed.accountBalancesSet || {});
        
        // Load month final balances flags
        setMonthFinalBalances(parsed.monthFinalBalances || {});
        
        // ARKITEKTONISK FIX: Account balances läses nu från central state
        // setAccountEstimatedStartBalances(parsed.accountEstimatedStartBalances || {});
        // setAccountStartBalancesSet(parsed.accountStartBalancesSet || {});
        // setAccountEndBalancesSet(parsed.accountEndBalancesSet || {});
        
        // Load selected accounts for chart
        setSelectedAccountsForChart(parsed.selectedAccountsForChart || []);
        
        // Load show individual costs outside budget setting
        setShowIndividualCostsOutsideBudget(parsed.showIndividualCostsOutsideBudget || false);
        
        // Load show savings separately setting
        setShowSavingsSeparately(parsed.showSavingsSeparately || false);
        
        // Load chart time range settings
        setUseCustomTimeRange(parsed.useCustomTimeRange || false);
        setChartStartMonth(parsed.chartStartMonth || '');
        setChartEndMonth(parsed.chartEndMonth || '');
        
        // REMOVED: setResults() call - orchestrator now handles all calculations automatically
        // if (parsed.results) {
        //   setResults(parsed.results);
        // }
        
        console.log('Successfully loaded saved budget data');
        
        // Load the previously selected budget month or default to current month
        const currentDate = new Date();
        const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const savedSelectedMonth = parsed.selectedBudgetMonth || currentMonthKey;
        setSelectedBudgetMonth(savedSelectedMonth);
        
        // Load data for the selected month from historical data
        if (parsed.historicalData && parsed.historicalData[savedSelectedMonth]) {
          // Use setTimeout to ensure state is set before loading data
          setTimeout(() => {
            loadDataFromSelectedMonth(savedSelectedMonth);
          }, 0);
        }
        
      } catch (error) {
        console.error('Error loading saved data:', error);
        console.warn('Using default values due to corrupted data');
        
        // Set current month as default selected budget month even on error
        const currentDate = new Date();
        const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        setSelectedBudgetMonth(currentMonthKey);
      }
    } else {
      // If no saved data, set current month as default
      const currentDate = new Date();
      const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      setSelectedBudgetMonth(currentMonthKey);
      
      // Initialize all default account categories as expanded
      const defaultCategories = ['Privat', 'Gemensam', 'Sparande', 'Hushåll'];
      const expandedCategoriesState = defaultCategories.reduce((acc: {[key: string]: boolean}, category: string) => {
        acc[category] = true;
        return acc;
      }, {});
      setExpandedAccounts(expandedCategoriesState);
    }
    
    // Mark initial load as complete
    setTimeout(() => {
      console.log(`🚀 Setting isInitialLoad to false`);
      setIsInitialLoad(false);
    }, 100);

    // Load backup
    const savedBackup = localStorage.getItem('budgetCalculatorBackup');
    if (savedBackup) {
      try {
        const parsed = JSON.parse(savedBackup);
        setStandardValues(parsed);
        console.log('Successfully loaded backup');
      } catch (error) {
        console.error('Error loading backup:', error);
      }
    }
    
    // Calculate budget on component mount after data is loaded
    setTimeout(() => {
      calculateBudget();
      // Calculation now handled by orchestrator - no legacy calls needed
    }, 100);
  }, []);

  // REMOVED: Den problematiska useEffect som skapade oändlig loop är nu borttagen
  // Data läses nu direkt från central state istället för att dupliceras i lokala variabler

  // Save current data to the selected month in historical data
  const saveToSelectedMonth = (explicitData?: any) => {
    const currentDate = new Date();
    const monthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Use explicit data if provided, otherwise use current state
    const dataToSave = explicitData || {
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
      andreasPersonalCosts,
      andreasPersonalSavings,
      susannaPersonalCosts,
      susannaPersonalSavings,
      accountBalances,
      accountBalancesSet,
      accountEstimatedFinalBalances,
      accountEstimatedFinalBalancesSet,
      accountEstimatedStartBalances,
      accountStartBalancesSet
    };
    
    console.log(`📝 Saving month data to ${monthKey}`);
    console.log(`📝 Current historicalData keys BEFORE save:`, Object.keys(historicalData));
    console.log(`📝 DEBUG: andreasSalary value being saved:`, dataToSave.andreasSalary);
    console.log(`📝 DEBUG: susannaSalary value being saved:`, dataToSave.susannaSalary);
    
    // Final balances are now calculated and saved directly in calculateBudget()
    
    // Create accountStartBalancesSet based on which accountBalances have values (not "Ej ifyllt")
    const startBalancesSet: {[key: string]: boolean} = {};
    accounts.forEach(account => {
      // If accountBalancesSet[account] is true, it means the balance was manually set (not "Ej ifyllt")
      if (accountBalancesSet[account] === true) {
        startBalancesSet[account] = true;
      }
      // If accountBalancesSet[account] is false or undefined, don't set anything for this account
    });

    // accountEndBalancesSet logic removed - end balances are now calculated dynamically
    
    const monthSnapshot = {
      month: monthKey,
      date: currentDate.toISOString(),
      andreasSalary: dataToSave.andreasSalary,
      andreasförsäkringskassan: dataToSave.andreasförsäkringskassan,
      andreasbarnbidrag: dataToSave.andreasbarnbidrag,
      susannaSalary: dataToSave.susannaSalary,
      susannaförsäkringskassan: dataToSave.susannaförsäkringskassan,
      susannabarnbidrag: dataToSave.susannabarnbidrag,
      totalSalary: dataToSave.andreasSalary + dataToSave.andreasförsäkringskassan + dataToSave.andreasbarnbidrag + dataToSave.susannaSalary + dataToSave.susannaförsäkringskassan + dataToSave.susannabarnbidrag,
      costGroups: JSON.parse(JSON.stringify(dataToSave.costGroups)),
      savingsGroups: JSON.parse(JSON.stringify(dataToSave.savingsGroups)),
      dailyTransfer: dataToSave.dailyTransfer,
      weekendTransfer: dataToSave.weekendTransfer,
      customHolidays: JSON.parse(JSON.stringify(customHolidays)),
      andreasPersonalCosts: JSON.parse(JSON.stringify(dataToSave.andreasPersonalCosts)),
      andreasPersonalSavings: JSON.parse(JSON.stringify(dataToSave.andreasPersonalSavings)),
      susannaPersonalCosts: JSON.parse(JSON.stringify(dataToSave.susannaPersonalCosts)),
      susannaPersonalSavings: JSON.parse(JSON.stringify(dataToSave.susannaPersonalSavings)),
      accounts: JSON.parse(JSON.stringify(accounts)),
      accountBalances: JSON.parse(JSON.stringify(dataToSave.accountBalances)),
      accountBalancesSet: JSON.parse(JSON.stringify(dataToSave.accountBalancesSet)),
      accountEstimatedFinalBalances: JSON.parse(JSON.stringify(dataToSave.accountEstimatedFinalBalances)),
      accountEstimatedFinalBalancesSet: JSON.parse(JSON.stringify(dataToSave.accountEstimatedFinalBalancesSet)),
      accountEstimatedStartBalances: JSON.parse(JSON.stringify(dataToSave.accountEstimatedStartBalances)),
      accountStartBalancesSet: JSON.parse(JSON.stringify(startBalancesSet)),
      monthFinalBalances: monthFinalBalances[monthKey] || false,
      // Include any existing calculated results if they exist
      ...(results && {
        totalMonthlyExpenses: results.totalMonthlyExpenses,
        balanceLeft: results.balanceLeft,
        susannaShare: results.susannaShare,
        andreasShare: results.andreasShare,
        susannaPercentage: results.susannaPercentage,
        andreasPercentage: results.andreasPercentage,
        totalDailyBudget: results.totalDailyBudget,
        remainingDailyBudget: results.remainingDailyBudget,
        holidayDaysBudget: results.holidayDaysBudget,
        daysUntil25th: results.daysUntil25th
      })
    };
    
    console.log(`Saving month data for ${monthKey} with final balances:`, accountEstimatedFinalBalances);
    
    // CRITICAL FIX: Use updateHistoricalDataSingle to properly merge data
    updateHistoricalDataSingle(monthKey, monthSnapshot);
    
    // Handle next month's estimated start balances separately if needed
    const [year, month] = monthKey.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    
    // If next month exists, update its accountEstimatedStartBalances
    if (historicalData[nextMonthKey]) {
      console.log(`📊 Updating ${nextMonthKey} accountEstimatedStartBalances from ${monthKey} accountEstimatedFinalBalances`);
      const nextMonthData = {
        ...historicalData[nextMonthKey],
        accountEstimatedStartBalances: JSON.parse(JSON.stringify(accountEstimatedFinalBalances))
      };
      updateHistoricalDataSingle(nextMonthKey, nextMonthData);
    }
  };

  // Note: Save functionality now handled by orchestrator - removed duplicate save logic to prevent conflicts
  // Legacy calculation removed - now handled by orchestrator

  // DISABLED: Auto-calculate budget whenever any input changes
  // The orchestrator now handles all calculations automatically when data changes
  // useEffect(() => {
  //   calculateBudget();
  // }, [andreasSalary, andreasförsäkringskassan, andreasbarnbidrag, susannaSalary, susannaförsäkringskassan, susannabarnbidrag, costGroups, savingsGroups, dailyTransfer, weekendTransfer, customHolidays, selectedBudgetMonth, transferAccount, andreasPersonalCosts, andreasPersonalSavings, susannaPersonalCosts, susannaPersonalSavings, accounts]);

  // Safety check to ensure accounts is always an array of strings
  useEffect(() => {
    if (accounts.some(account => typeof account !== 'string')) {
      console.warn('Found non-string accounts, converting to strings:', accounts);
      const stringAccounts = accounts.map(account => 
        typeof account === 'string' ? account : (account as any).name || String(account)
      );
      setAccounts(stringAccounts);
      // Clear localStorage to prevent re-loading corrupted data
      const savedData = localStorage.getItem('budgetCalculatorData');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          parsed.accounts = stringAccounts;
          localStorage.setItem('budgetCalculatorData', JSON.stringify(parsed));
        } catch (error) {
          console.error('Error updating localStorage accounts:', error);
        }
      }
    }
  }, [accounts]);

  // Function to calculate weekdays and weekend days for a specific month
  const calculateDaysForMonth = (year: number, month: number) => {
    // Calculate from 25th of previous month to 24th of selected month
    const prevMonth = month - 1;
    const prevYear = prevMonth < 0 ? year - 1 : year;
    const adjustedPrevMonth = prevMonth < 0 ? 11 : prevMonth;
    const startDate = new Date(prevYear, adjustedPrevMonth, 25);
    const endDate = new Date(year, month, 24);
    
    let weekdayCount = 0;
    let fridayCount = 0;
    let currentDatePointer = new Date(startDate);
    
    while (currentDatePointer <= endDate) {
      const dayOfWeek = currentDatePointer.getDay();
      const isHoliday = isSwedishHoliday(currentDatePointer);
      
      if (!isHoliday && dayOfWeek >= 1 && dayOfWeek <= 5) {
        weekdayCount++;
        if (dayOfWeek === 5) { // Friday
          fridayCount++;
        }
      }
      
      currentDatePointer.setDate(currentDatePointer.getDate() + 1);
    }
    
    return { weekdayCount, fridayCount };
  };

  const calculateDailyBudget = () => {
    const currentDate = new Date();
    
    // Use selected budget month for calculations
    let selectedYear = currentDate.getFullYear();
    let selectedMonth = currentDate.getMonth();
    
    if (selectedBudgetMonth) {
      const [yearStr, monthStr] = selectedBudgetMonth.split('-');
      selectedYear = parseInt(yearStr);
      selectedMonth = parseInt(monthStr) - 1; // Convert to 0-based month
    }
    
    const currentDay = currentDate.getDate();
    
    // Calculate total budget: from 25th of previous month to 24th of selected month
    const prevMonth = selectedMonth - 1;
    const prevYear = prevMonth < 0 ? selectedYear - 1 : selectedYear;
    const adjustedPrevMonth = prevMonth < 0 ? 11 : prevMonth;
    const totalStartDate = new Date(prevYear, adjustedPrevMonth, 25);
    const totalEndDate = new Date(selectedYear, selectedMonth, 24);
    
    // Calculate days until 25th of selected month
    let date25th = new Date(selectedYear, selectedMonth, 25);
    if (currentDay > 25 && selectedYear === currentDate.getFullYear() && selectedMonth === currentDate.getMonth()) {
      const nextMonth = selectedMonth + 1;
      const nextYear = nextMonth > 11 ? selectedYear + 1 : selectedYear;
      const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
      date25th.setFullYear(nextYear, adjustedMonth, 25);
    }
    
    const timeDiff = date25th.getTime() - currentDate.getTime();
    const daysUntil25th = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    // Collect holiday days - calculate for the selected month period (25th prev month to 24th selected month)
    let holidayBudget = 0;
    
    // Calculate holiday period: from 25th of previous month to 24th of selected month
    const holidayPrevMonth = selectedMonth - 1;
    const holidayPrevYear = holidayPrevMonth < 0 ? selectedYear - 1 : selectedYear;
    const holidayAdjustedPrevMonth = holidayPrevMonth < 0 ? 11 : holidayPrevMonth;
    const holidayStartDate = new Date(holidayPrevYear, holidayAdjustedPrevMonth, 25);
    const holidayEndDate = new Date(selectedYear, selectedMonth, 24);
    
    const holidaysUntil25th: string[] = [];
    let holidayDatePointer = new Date(holidayStartDate);
    
    while (holidayDatePointer <= holidayEndDate) {
      const dayOfWeek = holidayDatePointer.getDay();
      const isHoliday = isSwedishHoliday(holidayDatePointer);
      
      if (isHoliday) {
        const holidayName = getHolidayName(holidayDatePointer);
        holidaysUntil25th.push(`${holidayDatePointer.getDate()}/${holidayDatePointer.getMonth() + 1} - ${holidayName}`);
        
        // If it's a weekday holiday, add to holiday budget
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          holidayBudget += dailyTransfer;
          if (dayOfWeek === 5) { // Friday
            holidayBudget += weekendTransfer;
          }
        }
      }
      
      holidayDatePointer.setDate(holidayDatePointer.getDate() + 1);
    }
    
    // Collect next 5 holidays from today regardless of 25th limit
    const allUpcomingHolidays: string[] = [];
    const holidayYear = currentDate.getFullYear();
    
    // Check current year and next year for holidays
    for (let year = holidayYear; year <= holidayYear + 1; year++) {
      const holidays = getSwedishHolidays(year);
      for (const holiday of holidays) {
        if (holiday > currentDate) {
          const holidayName = getHolidayName(holiday);
          allUpcomingHolidays.push(`${holiday.getDate()}/${holiday.getMonth() + 1} - ${holidayName}`);
          
          if (allUpcomingHolidays.length >= 5) {
            break;
          }
        }
      }
      if (allUpcomingHolidays.length >= 5) {
        break;
      }
    }
    
    // Collect next 10 holidays from today regardless of 25th limit
    const nextTenHolidays: string[] = [];
    
    // Check current year and next year for holidays
    for (let year = holidayYear; year <= holidayYear + 1; year++) {
      const holidays = getSwedishHolidays(year);
      for (const holiday of holidays) {
        if (holiday > currentDate) {
          const holidayName = getHolidayName(holiday);
          nextTenHolidays.push(`${holiday.getDate()}/${holiday.getMonth() + 1} - ${holidayName}`);
          
          if (nextTenHolidays.length >= 10) {
            break;
          }
        }
      }
      if (nextTenHolidays.length >= 10) {
        break;
      }
    }
    
    // Use whichever list is longer: holidays until 25th or next 5 holidays
    const holidayDays = holidaysUntil25th.length >= 5 ? holidaysUntil25th : allUpcomingHolidays;
    
    // Calculate remaining budget based on whether we're looking at current month or not
    let remainingBudget = 0;
    let remainingWeekdayCount = 0;
    let remainingFridayCount = 0;
    let remainingStartDate;
    let remainingEndDate;
    
    const isCurrentMonth = selectedYear === currentDate.getFullYear() && selectedMonth === currentDate.getMonth();
    const isPastMonth = selectedYear < currentDate.getFullYear() || 
                       (selectedYear === currentDate.getFullYear() && selectedMonth < currentDate.getMonth());
    
    if (isPastMonth) {
      // For past months: no remaining budget since the month has passed
      remainingWeekdayCount = 0;
      remainingFridayCount = 0;
      remainingBudget = 0;
    } else if (isCurrentMonth) {
      // For current month: from today to 25th of same month
      remainingStartDate = new Date(currentDate);
      remainingEndDate = new Date(selectedYear, selectedMonth, 25);
      
      // If today is after 25th, calculate for next month
      if (currentDay > 25) {
        const nextMonth = selectedMonth + 1;
        const nextYear = nextMonth > 11 ? selectedYear + 1 : selectedYear;
        const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
        remainingEndDate = new Date(nextYear, adjustedMonth, 25);
      }
    } else {
      // For future months: same as total budget - from 25th of previous month to 24th of selected month
      const prevMonth = selectedMonth - 1;
      const prevYear = prevMonth < 0 ? selectedYear - 1 : selectedYear;
      const adjustedPrevMonth = prevMonth < 0 ? 11 : prevMonth;
      remainingStartDate = new Date(prevYear, adjustedPrevMonth, 25);
      remainingEndDate = new Date(selectedYear, selectedMonth, 24);
    }
    
    let currentDatePointer = new Date(remainingStartDate);
    
    while (currentDatePointer <= remainingEndDate) {
      const dayOfWeek = currentDatePointer.getDay();
      const isHoliday = isSwedishHoliday(currentDatePointer);
      
      if (!isHoliday && dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Only count non-holiday weekdays for budget calculation
        remainingBudget += dailyTransfer;
        remainingWeekdayCount++;
        
        if (dayOfWeek === 5) { // Friday
          remainingBudget += weekendTransfer;
          remainingFridayCount++;
        }
      }
      
      currentDatePointer.setDate(currentDatePointer.getDate() + 1);
    }
    
    // Calculate total budget (25th previous month to 24th current month) excluding holidays
    let totalBudget = 0;
    let totalWeekdayCount = 0;
    let totalFridayCount = 0;
    let totalDatePointer = new Date(totalStartDate);
    
    while (totalDatePointer <= totalEndDate) {
      const dayOfWeek = totalDatePointer.getDay();
      const isHoliday = isSwedishHoliday(totalDatePointer);
      
      if (!isHoliday) {
        // Monday = 1, Tuesday = 2, ..., Friday = 5
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          totalBudget += dailyTransfer;
          totalWeekdayCount++;
          
          if (dayOfWeek === 5) { // Friday
            totalBudget += weekendTransfer;
            totalFridayCount++;
          }
        }
      }
      
      totalDatePointer.setDate(totalDatePointer.getDate() + 1);
    }
    
    return { 
      totalBudget,
      remainingBudget, 
      holidayBudget,
      weekdayCount: totalWeekdayCount, 
      fridayCount: totalFridayCount, 
      daysUntil25th,
      totalWeekdayCount,
      totalFridayCount,
      remainingWeekdayCount,
      remainingFridayCount,
      holidayDays,
      holidaysUntil25th,
      nextTenHolidays
    };
  };

  
  const getNextHoliday = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Check holidays for current year and next year
    for (let year = currentYear; year <= currentYear + 1; year++) {
      const holidays = getSwedishHolidays(year);
      for (const holiday of holidays) {
        if (holiday > currentDate) {
          return {
            date: holiday,
            name: getHolidayName(holiday),
            daysUntil: Math.ceil((holiday.getTime() - currentDate.getTime()) / (1000 * 3600 * 24))
          };
        }
      }
    }
    return null;
  };

  const getHolidayName = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Check custom holidays first
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const customHoliday = customHolidays.find(holiday => holiday.date === dateString);
    if (customHoliday) return customHoliday.name;
    
    // Fixed holidays
    if (month === 0 && day === 1) return "Nyårsdagen";
    if (month === 0 && day === 6) return "Trettondedag jul";
    if (month === 4 && day === 1) return "Första maj";
    if (month === 5 && day === 6) return "Nationaldagen";
    if (month === 11 && day === 24) return "Julafton";
    if (month === 11 && day === 25) return "Juldagen";
    if (month === 11 && day === 26) return "Annandag jul";
    if (month === 11 && day === 31) return "Nyårsafton";
    
    // Easter-related holidays
    const easter = calculateEaster(year);
    const easterTime = easter.getTime();
    const dateTime = date.getTime();
    
    if (dateTime === easterTime - 2 * 24 * 60 * 60 * 1000) return "Långfredag";
    if (dateTime === easterTime + 24 * 60 * 60 * 1000) return "Annandag påsk";
    if (dateTime === easterTime + 39 * 24 * 60 * 60 * 1000) return "Kristi himmelfärd";
    if (dateTime === easterTime + 50 * 24 * 60 * 60 * 1000) return "Annandag pingst";
    
    // Variable holidays
    const midsummer = getMidsummerEve(year);
    if (date.getTime() === midsummer.getTime()) return "Midsommarafton";
    
    const allSaints = getAllSaintsDay(year);
    if (date.getTime() === allSaints.getTime()) return "Alla helgons dag";
    
    return "Helgdag";
  };



  // Function to reset MonthFinalBalances flag for current and future months when manual values change
  const resetMonthFinalBalancesFlag = (currentMonthKey: string) => {
    console.log(`🚨 RESETTING MonthFinalBalances flag for ${currentMonthKey} and all future months`);
    console.log(`🔍 Current historicalData keys:`, Object.keys(historicalData).sort());
    console.log(`🔍 Current monthFinalBalances state:`, monthFinalBalances);
    
    setMonthFinalBalances(prev => {
      const updated = { ...prev };
      
      // Reset current month
      updated[currentMonthKey] = false;
      console.log(`🔄 Set flag to false for current month ${currentMonthKey}`);
      
      // Reset all future months
      const currentMonthKeys = Object.keys(historicalData).sort();
      const currentIndex = currentMonthKeys.indexOf(currentMonthKey);
      console.log(`🔍 Current month ${currentMonthKey} is at index ${currentIndex} in sorted keys:`, currentMonthKeys);
      
      if (currentIndex !== -1) {
        for (let i = currentIndex + 1; i < currentMonthKeys.length; i++) {
          updated[currentMonthKeys[i]] = false;
          console.log(`🔄 Set flag to false for future month ${currentMonthKeys[i]}`);
        }
      }
      
      console.log(`📝 Updated MonthFinalBalances flags:`, updated);
      return updated;
    });

    // Also update historicalData to persist the flag changes
    // CRITICAL FIX: Use individual updates instead of setHistoricalData with function
    
    // Update current month's flag in historicalData
    if (historicalData[currentMonthKey]) {
      const updatedCurrentMonthData = {
        ...historicalData[currentMonthKey],
        monthFinalBalances: false
      };
      updateHistoricalDataSingle(currentMonthKey, updatedCurrentMonthData);
      console.log(`💾 Set flag to false in historicalData for current month ${currentMonthKey}`);
    }
    
    // Update all future months' flags in historicalData
    const currentMonthKeys = Object.keys(historicalData).sort();
    const currentIndex = currentMonthKeys.indexOf(currentMonthKey);
    if (currentIndex !== -1) {
      for (let i = currentIndex + 1; i < currentMonthKeys.length; i++) {
        const futureMonthKey = currentMonthKeys[i];
        if (historicalData[futureMonthKey]) {
          const updatedFutureMonthData = {
            ...historicalData[futureMonthKey],
            monthFinalBalances: false
          };
          updateHistoricalDataSingle(futureMonthKey, updatedFutureMonthData);
          console.log(`💾 Set flag to false in historicalData for future month ${futureMonthKey}`);
        }
      }
    }
    
    console.log(`💾 Updated flags in historicalData for ${currentMonthKey} and future months`);
  };

  // Function to check if we can set MonthFinalBalances flag to true
  const checkAndSetMonthFinalBalancesFlag = (monthKey: string) => {
    console.log(`🔍 Checking if we can set MonthFinalBalances flag to true for ${monthKey}`);
    
    // Get previous month
    const [year, month] = monthKey.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    
    // Check if this is the first month with saved data
    const allMonthKeys = Object.keys(historicalData).sort();
    const isFirstMonth = allMonthKeys.length === 0 || allMonthKeys[0] === monthKey;
    
    // Check if previous month flag is true
    const prevMonthFlagSet = monthFinalBalances[prevMonthKey] === true;
    
    console.log(`📊 Flag check for ${monthKey}:`);
    console.log(`   - Is first month: ${isFirstMonth}`);
    console.log(`   - Previous month (${prevMonthKey}) flag: ${monthFinalBalances[prevMonthKey]}`);
    console.log(`   - Can set flag: ${isFirstMonth || prevMonthFlagSet}`);
    
    if (isFirstMonth || prevMonthFlagSet) {
      setMonthFinalBalances(prev => ({
        ...prev,
        [monthKey]: true
      }));
      console.log(`✅ Set MonthFinalBalances flag to true for ${monthKey}`);
      return true;
    } else {
      console.log(`❌ Cannot set MonthFinalBalances flag for ${monthKey} - previous month flag not set`);
      return false;
    }
  };

  // Function to calculate and save final balances for the previous month of a target month
  const calculateAndSavePreviousMonthFinalBalances = (targetMonthKey: string) => {
    console.log(`=== CALCULATE AND SAVE PREVIOUS MONTH DEBUG ===`);
    // Get previous month info
    const [targetYear, targetMonth] = targetMonthKey.split('-').map(Number);
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    
    console.log(`Calculating final balances for previous month ${prevMonthKey} when switching to ${targetMonthKey}`);
    
    // Check if previous month has data
    const prevMonthData = historicalData[prevMonthKey];
    if (!prevMonthData) {
      console.log(`No data found for previous month ${prevMonthKey}`);
      return null;
    }
    
    console.log(`Recalculating final balances for ${prevMonthKey} based on current data`);
    console.log(`Previous month data before calculation:`, prevMonthData);
    
    // Always recalculate final balances based on previous month's current data
    const finalBalances: {[key: string]: number} = {};
    const accountsToProcess = budgetState.accounts.map(acc => acc.name);
    
    accountsToProcess.forEach(account => {
      // Use the actual account balance if it exists and is not 0
      let originalBalance = prevMonthData.accountBalances?.[account] || 0;
      
      // If account balance is 0 or empty, try to use estimated balance from the month before the previous month
      if (originalBalance === 0) {
        // Get the month before the previous month to check for estimated values
        const prevPrevMonth = prevMonth === 1 ? 12 : prevMonth - 1;
        const prevPrevYear = prevMonth === 1 ? prevYear - 1 : prevYear;
        const prevPrevMonthKey = `${prevPrevYear}-${String(prevPrevMonth).padStart(2, '0')}`;
        
        console.log(`${account}: Account balance is 0, checking for estimated value from ${prevPrevMonthKey}`);
        
        // Check if there's saved estimated final balance from the month before previous
        const prevPrevMonthData = historicalData[prevPrevMonthKey];
        if (prevPrevMonthData && prevPrevMonthData.accountEstimatedFinalBalances && prevPrevMonthData.accountEstimatedFinalBalances[account] !== undefined) {
          originalBalance = prevPrevMonthData.accountEstimatedFinalBalances[account];
          console.log(`${account}: Using estimated final balance from ${prevPrevMonthKey}: ${originalBalance}`);
        }
      }
      
      console.log(`${account}: Final starting balance: ${originalBalance}`);
      
      // Calculate total deposits for this account from savings groups
      const accountSavings = (prevMonthData.savingsGroups || [])
        .filter((group: any) => group.account === account)
        .reduce((sum: number, group: any) => sum + group.amount, 0);
      
      // Calculate only "Enskild kostnad" (one-time costs) that should be subtracted
      const accountOneTimeCosts = (prevMonthData.costGroups || []).reduce((sum: number, group: any) => {
        const groupOneTimeCosts = group.subCategories
          ?.filter((sub: any) => sub.account === account && sub.financedFrom === 'Enskild kostnad')
          .reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
        return sum + groupOneTimeCosts;
      }, 0);
      
      // Final balance (Slutsaldo) = original balance + savings - only one-time costs
      // Löpande kostnader are covered by the cost budget deposits and should not be subtracted again
      finalBalances[account] = originalBalance + accountSavings - accountOneTimeCosts;
      console.log(`${account}: ${originalBalance} + ${accountSavings} - ${accountOneTimeCosts} = ${finalBalances[account]}`);
    });
    
    console.log(`Final balances calculated:`, finalBalances);
    
    // Always save the recalculated final balances to the previous month's data
    const [prevYearStr, prevMonthStr] = prevMonthKey.split('-');
    const prevEndingBalanceKeys: {[key: string]: number} = {};
    accounts.forEach(account => {
      const endingBalanceKey = `${account}.${prevYearStr}.${prevMonthStr}.Endbalance`;
      prevEndingBalanceKeys[endingBalanceKey] = finalBalances[account];
    });
    
    // CRITICAL FIX: Use updateHistoricalDataSingle instead of setHistoricalData with function
    if (historicalData[prevMonthKey]) {
      const updatedPrevMonthData = {
        ...historicalData[prevMonthKey],
        accountEstimatedFinalBalances: finalBalances // Save the calculated Slutsaldo to accountEstimatedFinalBalances
      };
      updateHistoricalDataSingle(prevMonthKey, updatedPrevMonthData);
      console.log(`Updated historical data for ${prevMonthKey}:`, updatedPrevMonthData);
    }
    
    console.log(`Final balances recalculated and saved for ${prevMonthKey}:`, finalBalances);
    console.log(`Ending balance keys saved for ${prevMonthKey}:`, prevEndingBalanceKeys);
    console.log(`=== END CALCULATE AND SAVE PREVIOUS MONTH DEBUG ===`);
    
    // Return the calculated final balances so they can be used immediately
    return finalBalances;
  };

  const addCostGroup = () => {
    const newGroup: BudgetGroup = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      type: 'cost',
      subCategories: []
    };
    updateCostGroups([...costGroups, newGroup]);
    
    // Reset MonthFinalBalances flag when manual values are changed
    const currentDate = new Date();
    const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    resetMonthFinalBalancesFlag(currentMonthKey);
  };


  const handleAddCostItem = (item: {
    mainCategory: string;
    subcategory: string;
    name: string;
    amount: number;
    account: string;
    financedFrom: string;
    transferType?: 'monthly' | 'daily';
    dailyAmount?: number;
    transferDays?: number[];
  }) => {
    console.log('🔍 [DEBUG] handleAddCostItem called with:', item);
    console.log('🔍 [DEBUG] Current costGroups before addition:', costGroups);
    
    // Create a working copy of costGroups that we can modify
    const currentCostGroups = [...costGroups];
    
    // Find existing group or create new one
    let targetGroup = currentCostGroups.find(group => group.name === item.mainCategory);
    console.log('🔍 [DEBUG] Found target group:', targetGroup);
    
    // --- NEW ROBUST LOGIC STARTS HERE ---
    
    // 1. Create main category if it doesn't exist
    if (!targetGroup) {
      console.log(`Huvudkategori '${item.mainCategory}' hittades inte, skapar en ny.`);
      targetGroup = {
        id: Date.now().toString(),
        name: item.mainCategory,
        amount: 0,
        type: 'cost',
        subCategories: []
      };
      currentCostGroups.push(targetGroup); // Add the new group to the list
    }
    
    // --- END OF NEW LOGIC ---

    // Calculate the correct amount based on transfer type
    let calculatedAmount = item.amount;
    if (item.transferType === 'daily' && item.dailyAmount && item.transferDays) {
      // For daily transfers, calculate the monthly amount
      const currentMonthKey = selectedBudgetMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const tempSubCategory = {
        id: 'temp',
        name: 'temp',
        amount: 0,
        transferType: item.transferType,
        dailyAmount: item.dailyAmount,
        transferDays: item.transferDays
      };
      calculatedAmount = calculateMonthlyAmountForDailyTransfer(tempSubCategory, currentMonthKey);
      console.log(`🔍 [DEBUG] Calculated amount for daily transfer: ${calculatedAmount} (dailyAmount: ${item.dailyAmount}, transferDays: ${item.transferDays})`);
    }

    // Create the new subcategory (cost item)
    const newSubCategory = {
      id: Date.now().toString() + '_sub',
      name: `${item.subcategory}: ${item.name}`,
      amount: calculatedAmount,
      account: item.account,
      financedFrom: item.financedFrom,
      transferType: item.transferType || 'monthly',
      dailyAmount: item.dailyAmount,
      transferDays: item.transferDays
    };

    // Update subcategories for the target group
    const updatedSubCategories = [...(targetGroup.subCategories || []), newSubCategory];
    const updatedGroup = { ...targetGroup, subCategories: updatedSubCategories };

    // Create the final updated list with all cost groups
    const finalGroups = currentCostGroups.map(group => 
      group.id === targetGroup!.id ? updatedGroup : group
    );

    console.log('🔍 [DEBUG] Final groups after addition:', finalGroups);
    console.log('🔍 [DEBUG] About to call updateCostGroups with:', finalGroups);
    updateCostGroups(finalGroups);
    console.log('🔍 [DEBUG] updateCostGroups called successfully');
    
    // Reset MonthFinalBalances flag when manual values are changed
    const currentDate = new Date();
    const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    resetMonthFinalBalancesFlag(currentMonthKey);
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
    updateCostGroups(costGroups.filter(group => group.id !== id));
  };

  const removeSavingsGroup = (id: string) => {
    setSavingsGroups(savingsGroups.filter(group => group.id !== id));
  };

  const updateCostGroup = (id: string, field: 'name' | 'amount', value: string | number) => {
    updateCostGroups(costGroups.map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
    
    // Reset MonthFinalBalances flag when manual values are changed
    const currentDate = new Date();
    const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    resetMonthFinalBalancesFlag(currentMonthKey);
  };

  const updateSavingsGroup = (id: string, field: 'name' | 'amount' | 'account' | 'financedFrom', value: string | number) => {
    setSavingsGroups(savingsGroups.map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
    
    // Reset MonthFinalBalances flag when manual values are changed
    const currentDate = new Date();
    const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    resetMonthFinalBalancesFlag(currentMonthKey);
  };

  const addSubCategory = (groupId: string) => {
    const newSubCategory: SubCategory = {
      id: Date.now().toString(),
      name: '',
      amount: 0
    };
    updateCostGroups(costGroups.map(group => 
      group.id === groupId ? { 
        ...group, 
        subCategories: [...(group.subCategories || []), newSubCategory] 
      } : group
    ));
  };

  const removeSubCategory = (groupId: string, subId: string) => {
    updateCostGroups(costGroups.map(group => 
      group.id === groupId ? {
        ...group,
        subCategories: group.subCategories?.filter(sub => sub.id !== subId) || []
      } : group
    ));
  };

  // Initialize Transport subcategories if empty
  React.useEffect(() => {
    const transportGroup = costGroups.find(group => group.name === 'Transport');
    if (transportGroup && (!transportGroup.subCategories || transportGroup.subCategories.length === 0)) {
      const defaultTransportSubcategories: SubCategory[] = [
        {
          id: 'transport_fuel_sub',
          name: 'Bränsle',
          amount: 800,
          account: 'Löpande',
          financedFrom: 'Löpande kostnad'
        },
        {
          id: 'transport_maintenance_sub', 
          name: 'Underhåll fordon',
          amount: 600,
          account: 'Löpande',
          financedFrom: 'Löpande kostnad'
        },
        {
          id: 'transport_parking_sub',
          name: 'Parkering',
          amount: 300,
          account: 'Löpande', 
          financedFrom: 'Löpande kostnad'
        },
        {
          id: 'transport_public_sub',
          name: 'Kollektivtrafik',
          amount: 300,
          account: 'Löpande',
          financedFrom: 'Löpande kostnad'
        }
      ];
      
      // Update cost groups with subcategories
      const updatedCostGroups = costGroups.map(group => 
        group.id === transportGroup.id 
          ? { ...group, subCategories: defaultTransportSubcategories } 
          : group
      );
      updateCostGroups(updatedCostGroups);
      
      // Also save the subcategories mapping to storage for future reference
      const subcategoriesMapping = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
      subcategoriesMapping['Transport'] = defaultTransportSubcategories.map(sub => sub.name);
      set(StorageKey.SUBCATEGORIES, subcategoriesMapping);
    }
  }, [costGroups]);

  const addCustomHoliday = () => {
    const newHoliday = {
      date: '',
      name: ''
    };
    setCustomHolidays([...customHolidays, newHoliday]);
  };

  const removeCustomHoliday = (index: number) => {
    setCustomHolidays(customHolidays.filter((_, i) => i !== index));
  };

  const updateCustomHoliday = (index: number, field: 'date' | 'name', value: string) => {
    setCustomHolidays(customHolidays.map((holiday, i) => 
      i === index ? { ...holiday, [field]: value } : holiday
    ));
  };

  // Function to get available months (all saved months including future ones)
  const getAvailableMonths = () => {
    // Include all months with saved historical data (including future months)
    const availableMonths = Object.keys(historicalData)
      .sort((a, b) => b.localeCompare(a)); // Sort newest first
    
    return availableMonths;
  };

  // Function to add a new month with data copied from latest historical month
  const addNewBudgetMonth = (monthKey: string, copyFromCurrent: boolean = true) => {
    if (!copyFromCurrent) {
      // Create empty month
      const newMonthData = {
        month: monthKey,
        date: new Date().toISOString(),
        andreasSalary: 0,
        andreasförsäkringskassan: 0,
        andreasbarnbidrag: 0,
        susannaSalary: 0,
        susannaförsäkringskassan: 0,
        susannabarnbidrag: 0,
        totalSalary: 0,
        costGroups: [],
        savingsGroups: [],
        totalMonthlyExpenses: 0,
        totalCosts: 0,
        totalSavings: 0,
        dailyTransfer: 300,
        weekendTransfer: 540,
        balanceLeft: 0,
        susannaShare: 0,
        andreasShare: 0,
        susannaPercentage: 0,
        andreasPercentage: 0,
        totalDailyBudget: 0,
        remainingDailyBudget: 0,
        holidayDaysBudget: 0,
        daysUntil25th: 0
      };
      
      updateHistoricalDataSingle(monthKey, newMonthData);
      return;
    }

    // Find the latest month in historical data (should be today's month)
    const historicalMonths = Object.keys(historicalData).sort((a, b) => b.localeCompare(a)); // Sort newest first
    const latestMonth = historicalMonths[0]; // Get the most recent month
    
    let newMonthData;
    
    if (latestMonth && historicalData[latestMonth]) {
      // Copy data from the latest historical month but exclude accountBalances
      newMonthData = {
        ...JSON.parse(JSON.stringify(historicalData[latestMonth])), // Deep copy everything
        month: monthKey,
        date: new Date().toISOString(),
        accountBalances: {}, // Always start with empty account balances - user should fill manually
        accountBalancesSet: {}, // All balances start as not set, so they show "Ej ifyllt"
        accountStartBalancesSet: {} // No start balances are set initially
      };
      console.log(`Copying data from latest month: ${latestMonth} to new month: ${monthKey}`);
    } else {
      // Fallback: Copy from current form values if no historical data exists
      newMonthData = {
        month: monthKey,
        date: new Date().toISOString(),
        andreasSalary,
        andreasförsäkringskassan,
        andreasbarnbidrag,
        susannaSalary,
        susannaförsäkringskassan,
        susannabarnbidrag,
        totalSalary: andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag,
        costGroups: JSON.parse(JSON.stringify(costGroups)),
        savingsGroups: JSON.parse(JSON.stringify(savingsGroups)),
        totalMonthlyExpenses: 0,
        totalCosts: 0,
        totalSavings: 0,
        dailyTransfer,
        weekendTransfer,
        balanceLeft: 0,
        susannaShare: 0,
        andreasShare: 0,
        susannaPercentage: 0,
        andreasPercentage: 0,
        totalDailyBudget: 0,
        remainingDailyBudget: 0,
        holidayDaysBudget: 0,
        daysUntil25th: 0,
        andreasPersonalCosts: JSON.parse(JSON.stringify(andreasPersonalCosts)),
        andreasPersonalSavings: JSON.parse(JSON.stringify(andreasPersonalSavings)),
        susannaPersonalCosts: JSON.parse(JSON.stringify(susannaPersonalCosts)),
        susannaPersonalSavings: JSON.parse(JSON.stringify(susannaPersonalSavings)),
        accountBalances: {}, // Always start with empty account balances - user should fill manually
        accountBalancesSet: {}, // All balances start as not set, so they show "Ej ifyllt"
        accountStartBalancesSet: {} // No start balances are set initially
      };
      console.log(`No historical data found, using current form values for new month: ${monthKey}`);
    }
    
    updateHistoricalDataSingle(monthKey, newMonthData);
  };

  // Helper function to get previous month information for account balances
  const getPreviousMonthInfo = () => {
    const currentDate = new Date();
    let selectedYear = currentDate.getFullYear();
    let selectedMonth = currentDate.getMonth();
    
    if (selectedBudgetMonth) {
      const [yearStr, monthStr] = selectedBudgetMonth.split('-');
      selectedYear = parseInt(yearStr);
      selectedMonth = parseInt(monthStr) - 1; // Convert to 0-based month
    }
    
    const prevMonth = selectedMonth - 1;
    const prevYear = prevMonth < 0 ? selectedYear - 1 : selectedYear;
    const adjustedPrevMonth = prevMonth < 0 ? 11 : prevMonth;
    
    const monthNames = [
      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ];
    
    const result = {
      monthName: monthNames[adjustedPrevMonth],
      year: prevYear,
      date: `24 ${monthNames[adjustedPrevMonth]} ${prevYear}`,
      monthKey: `${prevYear}-${String(adjustedPrevMonth + 1).padStart(2, '0')}`
    };
    
    console.log(`=== GET PREVIOUS MONTH INFO DEBUG ===`);
    console.log(`selectedBudgetMonth: ${selectedBudgetMonth}`);
    console.log(`selectedYear: ${selectedYear}, selectedMonth: ${selectedMonth}`);
    console.log(`prevYear: ${prevYear}, adjustedPrevMonth: ${adjustedPrevMonth}`);
    console.log(`Previous month key: ${result.monthKey}`);
    console.log(`=== END GET PREVIOUS MONTH INFO DEBUG ===`);
    
    return result;
  };

  // Helper function to get estimated opening balances from previous month's final balances
  const getEstimatedOpeningBalances = (freshFinalBalances?: {[key: string]: number}) => {
    const prevMonthInfo = getPreviousMonthInfo();
    const prevMonthData = historicalData[prevMonthInfo.monthKey];
    
    console.log(`=== GET ESTIMATED OPENING BALANCES DEBUG ===`);
    console.log(`🔍 BERÄKNAR ESTIMERAD INGÅENDE BALANS FÖR: ${selectedBudgetMonth || 'Aktuell månad'}`);
    console.log(`📅 ANVÄNDER DATA FRÅN FÖREGÅENDE MÅNAD: ${prevMonthInfo.monthKey}`);
    console.log(`📊 Föregående månads data finns:`, !!prevMonthData);
    console.log(`📋 Tillgängliga historiska månader:`, Object.keys(historicalData));
    console.log(`💰 Föregående månads slutsaldon:`, prevMonthData?.accountEstimatedFinalBalances);
    console.log(`🆕 Nya slutsaldon medskickade:`, freshFinalBalances);
    if (prevMonthData) {
      console.log(`Previous month data structure:`, {
        accountBalances: prevMonthData.accountBalances,
        accountEstimatedFinalBalances: prevMonthData.accountEstimatedFinalBalances,
        hasAccountEstimatedFinalBalances: !!prevMonthData.accountEstimatedFinalBalances,
        accountEstimatedFinalBalancesKeys: Object.keys(prevMonthData.accountEstimatedFinalBalances || {}),
        buffertEstimatedFinalBalance: prevMonthData.accountEstimatedFinalBalances?.['Buffert']
      });
    }
    
    if (!prevMonthData) {
      console.log(`❌ INGEN DATA HITTADES FÖR FÖREGÅENDE MÅNAD: ${prevMonthInfo.monthKey}`);
      console.log(`   Detta betyder att estimerad ingående balans inte kan beräknas.`);
      console.log(`   För Juni skulle vi behöva data från Maj för att beräkna.`);
      return null;
    }
    
    const estimatedOpeningBalances: {[key: string]: number} = {};
    
    console.log('Previous month data found:', prevMonthInfo.monthKey, prevMonthData);
    
    // Calculate estimated opening balances for current month
    // This should load the specific "AccountName.Year.Month.Endbalance" value from previous month
    accounts.forEach(account => {
        console.log(`🔍 === DEBUGGING ${account} FOR ${selectedBudgetMonth} ===`);
        console.log(`🎯 Looking for previous month's ending balance...`);
        
        const [prevYear, prevMonth] = prevMonthInfo.monthKey.split('-');
        const endingBalanceKey = `${account}.${prevYear}.${prevMonth}.Endbalance`;
        
        console.log(`🔑 Looking for ending balance key: "${endingBalanceKey}"`);
        console.log(`📊 Previous month data ALL KEYS:`, Object.keys(prevMonthData));
        console.log(`💾 accountEndingBalances FULL OBJECT:`, prevMonthData.accountEndingBalances);
        console.log(`💾 accountEndingBalances keys:`, prevMonthData.accountEndingBalances ? Object.keys(prevMonthData.accountEndingBalances) : 'undefined');
        console.log(`💰 accountEstimatedFinalBalances FULL OBJECT:`, prevMonthData.accountEstimatedFinalBalances);
        console.log(`💰 accountEstimatedFinalBalances keys:`, prevMonthData.accountEstimatedFinalBalances ? Object.keys(prevMonthData.accountEstimatedFinalBalances) : 'undefined');
        
        // Use accountEstimatedFinalBalances as the single source of truth
        let openingBalance = prevMonthData.accountEstimatedFinalBalances?.[account];
        console.log(`🔍 accountEstimatedFinalBalances lookup for "${account}": ${openingBalance}`);
        
        // Final fallback to accountEndingBalances with specific key format
        if (openingBalance === undefined || openingBalance === null) {
          const [prevYear, prevMonth] = prevMonthInfo.monthKey.split('-');
          const endingBalanceKey = `${account}.${prevYear}.${prevMonth}.Endbalance`;
          openingBalance = prevMonthData.accountEndingBalances?.[endingBalanceKey];
          console.log(`🔍 accountEndingBalances fallback for "${endingBalanceKey}": ${openingBalance}`);
        }
        
        console.log(`🔍 DETAILED DEBUG FOR ${account}:`);
        console.log(`   - prevMonthData.accountEstimatedFinalBalances:`, prevMonthData.accountEstimatedFinalBalances);
        console.log(`   - Looking in month: ${prevMonthInfo.monthKey}`);
        console.log(`   - Final openingBalance: ${openingBalance}`);
        
        // If still not found, use 0 as default
        if (openingBalance === undefined || openingBalance === null) {
          openingBalance = 0;
          console.log(`❌ NO DATA FOUND: Using 0 for ${account} in ${prevMonthInfo.monthKey}`);
        } else {
          console.log(`✅ FOUND DATA: Using ${openingBalance} for ${account} from ${prevMonthInfo.monthKey}`);
        }
        
        // The estimated opening balance is the previous month's ending balance
        estimatedOpeningBalances[account] = openingBalance || 0;
        
         // CRITICAL DEBUG FOR DECEMBER LÖPANDE
         if (selectedBudgetMonth?.includes('12') && account === 'Löpande') {
           console.log(`🚨🚨🚨 CRITICAL DECEMBER LÖPANDE CALCULATION 🚨🚨🚨`);
           console.log(`🔢 Final calculated value: ${estimatedOpeningBalances[account]}`);
           console.log(`🔢 openingBalance was: ${openingBalance}`);
           console.log(`🔢 This should be 1000, not 6001!`);
           console.log(`🚨🚨🚨 END CRITICAL DEBUG 🚨🚨🚨`);
         }
        
        console.log(`=== 📊 ESTIMATED OPENING BALANCE FOR ${account.toUpperCase()} ===`);
        console.log(`📈 Previous month ending balance (${endingBalanceKey}): ${openingBalance || 0} kr`);
        console.log(`✅ ESTIMATED OPENING BALANCE: ${estimatedOpeningBalances[account]} kr`);
        console.log(`=== 🏁 END ===`);
    });
    
    // CRITICAL DEBUG: Check if December Löpande is in the final result
    if (selectedBudgetMonth?.includes('12') && estimatedOpeningBalances['Löpande']) {
      console.log(`🚨🚨🚨 FINAL ESTIMATED OPENING BALANCES CHECK 🚨🚨🚨`);
      console.log(`🔢 Löpande in final result: ${estimatedOpeningBalances['Löpande']}`);
      console.log(`🔢 All estimated opening balances:`, estimatedOpeningBalances);
      console.log(`🚨🚨🚨 THIS IS WHAT GETS RETURNED FOR OPENING BALANCES 🚨🚨🚨`);
    }
    
    console.log('All estimated opening balances:', estimatedOpeningBalances);
    console.log(`=== END GET ESTIMATED OPENING BALANCES DEBUG ===`);
    return estimatedOpeningBalances;
  };

  // Keep original function for backwards compatibility (for estimated final balances)
  const getEstimatedAccountBalances = (freshFinalBalances?: {[key: string]: number}) => {
    // This now just calls the opening balances function since that's what it was doing
    return getEstimatedOpeningBalances(freshFinalBalances);
  };

  // Helper function to check if current month has empty account balances
  const hasEmptyAccountBalances = () => {
    return accounts.every(account => (accountBalances[account] || 0) === 0);
  };

  // Helper function to get account balance with fallback to estimated
  const getAccountBalanceWithFallback = (account: string) => {
    console.log(`=== DEBUG getAccountBalanceWithFallback FOR ${account} ===`);
    const currentBalance = accountBalances[account] || 0;
    console.log(`currentBalance from accountBalances[${account}]: ${currentBalance}`);
    
    // CRITICAL FIX: Check if this account balance has been explicitly set by the user
    const isExplicitlySet = accountBalancesSet[account] === true;
    console.log(`accountBalancesSet[${account}]: ${isExplicitlySet}`);
    
    // If user has explicitly set the balance (even to 0), ALWAYS use that value
    if (isExplicitlySet) {
      console.log(`✅ Balance explicitly set by user: ${currentBalance}`);
      console.log(`=== END DEBUG getAccountBalanceWithFallback ===`);
      return currentBalance;
    }
    
    // If not explicitly set, "Faktiskt kontosaldo" should ALWAYS show 0 or "Ej ifyllt"
    // NEVER use estimated values for "Faktiskt kontosaldo"
    console.log(`🚨 CORRECTED: Faktiskt kontosaldo when not set should be 0 (Ej ifyllt)`);
    console.log(`=== END DEBUG getAccountBalanceWithFallback ===`);
    return currentBalance;
  };

  // Helper function to get Calc.Kontosaldo for same month (for Ursprungligt saldo)
  const getCalcKontosaldoSameMonth = (account: string) => {
    console.log(`=== DEBUG getCalcKontosaldoSameMonth FOR ${account} ===`);
    console.log(`Current month: ${selectedBudgetMonth}`);
    
    const hasActualBalance = accountBalancesSet[account] === true;
    const currentBalance = accountBalances?.[account] || 0;
    
    // Calculate estimated balance using the same logic as the main calculation
    const freshBalances = (window as any).__freshFinalBalances;
    const estimatedResult = getEstimatedOpeningBalances(freshBalances);
    const estimatedBalance = estimatedResult?.[account] || 0;
    
    // When "Ej ifyllt" (hasActualBalance = false), use estimated balance
    // When filled with actual value, use that value
    const calcBalance = hasActualBalance ? currentBalance : estimatedBalance;
    
    console.log(`hasActualBalance: ${hasActualBalance}`);
    console.log(`currentBalance: ${currentBalance}`);
    console.log(`estimatedBalance: ${estimatedBalance}`);
    console.log(`calcBalance (FINAL): ${calcBalance}`);
    
    return calcBalance;
  };

  // Helper function to check if Calc.Descr for same month is (Est)
  // Text should be "Ursprungligt saldo" if Faktiskt Saldo is not "Ej ifyllt"
  const isCalcDescrEstimatedSameMonth = (account: string) => {
    const hasActualBalance = accountBalancesSet[account] === true;
    return !hasActualBalance; // Returns true if "Ej ifyllt", false if actual balance is set
  };

  // Function to update account balance
  const handleAccountBalanceUpdate = (account: string, balance: number) => {
    addDebugLog(`🎯 handleAccountBalanceUpdate called: ${account} = ${balance}`);
    
    // CRITICAL FIX: Call orchestrator only once to avoid duplicate updates
    updateAccountBalance(account, balance);
    addDebugLog(`✅ updateAccountBalance completed for ${account}`);
    
    // Reset MonthFinalBalances flag when manual values are changed
    const currentDate = new Date();
    const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    resetMonthFinalBalancesFlag(currentMonthKey);
  };
  
  // Function to unset account balance (revert to "Ej ifyllt")
  const handleAccountBalanceUnset = (account: string) => {
    addDebugLog(`🎯 handleAccountBalanceUnset called: ${account}`);
    
    unsetAccountBalance(account);
    addDebugLog(`✅ unsetAccountBalance completed for ${account}`);
    
    // Reset MonthFinalBalances flag when manual values are changed
    const currentDate = new Date();
    const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    resetMonthFinalBalancesFlag(currentMonthKey);
    
    addDebugLog(`🔄 About to call forceRecalculation`);
    // Force recalculation to ensure all dependent values update
    forceRecalculation();
    console.log(`✅ forceRecalculation completed`);
  };

  // Function to load data from selected month into current form
  const loadDataFromSelectedMonth = (monthKey: string) => {
    const monthData = historicalData[monthKey];
    if (!monthData) return;
    
    // Calculate and save final balances for the previous month before loading current month
    const freshFinalBalances = calculateAndSavePreviousMonthFinalBalances(monthKey);
    
    // Store the fresh final balances to use immediately for estimated balances
    if (freshFinalBalances) {
      (window as any).__freshFinalBalances = freshFinalBalances;
    }
    
    // Data läses nu automatiskt från central state - ingen lokal initiering behövs
    console.log(`📥 DEBUG: Month data loaded automatically from central state for: ${monthKey}`);
    
    // ARKITEKTONISK FIX: Account balances läses nu från central state
    // const loadedBalances = monthData.accountBalances || {};
    // setAccountBalances(loadedBalances);
    // setAccountEstimatedStartBalances(monthData.accountEstimatedStartBalances || {});
    // setAccountStartBalancesSet(monthData.accountStartBalancesSet || {});
    
    // Account end balances are now calculated dynamically, no need to load them
    
    // ARKITEKTONISK FIX: AccountBalancesSet läses nu från central state
    // if (monthData.accountBalancesSet) {
    //   setAccountBalancesSet(monthData.accountBalancesSet);
    // }
    
    // Load ALL MonthFinalBalances flags from historicalData to ensure consistency
    console.log(`🔄 Loading month data for ${monthKey}, loading ALL flags from historicalData`);
    const allFlags: {[key: string]: boolean} = {};
    Object.keys(historicalData).forEach(key => {
      const data = historicalData[key];
      const flagValue = data.monthFinalBalances?.[key] || false;
      allFlags[key] = flagValue;
      console.log(`📋 Loaded flag for ${key}: ${allFlags[key]}`);
    });
    
    // Set current month flag specifically
    allFlags[monthKey] = monthData.monthFinalBalances?.[monthKey] || false;
    console.log(`📋 Set current month ${monthKey} flag to: ${allFlags[monthKey]}`);
    
    console.log(`📋 Final flags being set:`, allFlags);
    setMonthFinalBalances(allFlags);
    
    // Results are now calculated and managed by the orchestrator
    // No need to manually set results here - they come from calculated state
    
    // Legacy calculation removed - now handled by orchestrator
    // to prevent infinite loops and ensure proper saving
  };
  
  // Legacy calculation function removed to prevent infinite loops
  // All calculations are now handled by the orchestrator system

  // Function to get available months with saved data
  const getMonthsWithSavedData = () => {
    return Object.keys(historicalData)
      .filter(month => historicalData[month]) // Only months with actual saved data
      .sort((a, b) => a.localeCompare(b)); // Sort chronologically (oldest first)
  };

  // Function to get months that need updating (from first false flag onwards)
  const getMonthsToUpdate = () => {
    const allMonths = getMonthsWithSavedData();
    
    // Find the first month with flag set to false
    let firstFalseIndex = -1;
    for (let i = 0; i < allMonths.length; i++) {
      const monthKey = allMonths[i];
      const monthData = historicalData[monthKey];
      const flagValue = monthData?.monthFinalBalances || false;
      
      if (!flagValue) {
        firstFalseIndex = i;
        break;
      }
    }
    
    // If no month has flag false, return empty array (nothing to update)
    if (firstFalseIndex === -1) {
      return [];
    }
    
    // Return all months from the first false flag onwards
    return allMonths.slice(firstFalseIndex);
  };

  // Function to navigate to previous month with saved data
  const navigateToPreviousMonth = () => {
    const monthsWithData = getMonthsWithSavedData();
    const currentIndex = monthsWithData.indexOf(selectedBudgetMonth);
    
    if (currentIndex > 0) {
      const previousMonth = monthsWithData[currentIndex - 1];
      handleBudgetMonthChange(previousMonth);
    }
  };

  // Function to navigate to next month with saved data
  const navigateToNextMonth = () => {
    const monthsWithData = getMonthsWithSavedData();
    const currentIndex = monthsWithData.indexOf(selectedBudgetMonth);
    
    if (currentIndex >= 0 && currentIndex < monthsWithData.length - 1) {
      const nextMonth = monthsWithData[currentIndex + 1];
      handleBudgetMonthChange(nextMonth);
    }
  };

  // Function to check if navigation arrows should be disabled
  const canNavigatePrevious = () => {
    const monthsWithData = getMonthsWithSavedData();
    const currentIndex = monthsWithData.indexOf(selectedBudgetMonth);
    return currentIndex > 0;
  };

  const canNavigateNext = () => {
    const monthsWithData = getMonthsWithSavedData();
    const currentIndex = monthsWithData.indexOf(selectedBudgetMonth);
    return currentIndex >= 0 && currentIndex < monthsWithData.length - 1;
  };

  // Function to create previous month with current month's data
  const createPreviousMonth = () => {
    if (!selectedBudgetMonth) return;
    
    const [year, month] = selectedBudgetMonth.split('-');
    const currentYear = parseInt(year);
    const currentMonth = parseInt(month);
    
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    
    // Don't create if it already exists
    if (historicalData[prevMonthKey]) {
      handleBudgetMonthChange(prevMonthKey);
      return;
    }
    
    // Copy current month's data to new previous month, but reset all income to 0
    const currentMonthData = historicalData[selectedBudgetMonth];
    if (currentMonthData) {
      const newMonthData = {
        ...currentMonthData,
        // Reset all income values to 0
        andreasSalary: 0,
        andreasförsäkringskassan: 0,
        andreasbarnbidrag: 0,
        susannaSalary: 0,
        susannaförsäkringskassan: 0,
        susannabarnbidrag: 0,
        // Update any date-specific properties if needed
        createdAt: new Date().toISOString()
      };
      
      updateHistoricalDataSingle(prevMonthKey, newMonthData);
      
      // Set the new month as selected
      setSelectedBudgetMonth(prevMonthKey);
      
      // Directly set all income values to 0 in the form
      setAndreasSalary(0);
      setAndreasförsäkringskassan(0);
      setAndreasbarnbidrag(0);
      setSusannaSalary(0);
      setSusannaförsäkringskassan(0);
      setSusannabarnbidrag(0);
      
      // Also load other data from the new month
      setTimeout(() => {
        const monthData = newMonthData;
        // UI data läses nu automatiskt från central state
        setSelectedPerson((monthData as any).selectedPerson || 'andreas');
        setUserName1(monthData.userName1 || 'Andreas');
        setUserName2(monthData.userName2 || 'Susanna');
        setTransferChecks(monthData.transferChecks || {});
        setAndreasShareChecked(monthData.andreasShareChecked !== undefined ? monthData.andreasShareChecked : true);
        setSusannaShareChecked(monthData.susannaShareChecked !== undefined ? monthData.susannaShareChecked : true);
      }, 0);
    }
  };

  // Function to create next month with current month's data
  const createNextMonth = () => {
    if (!selectedBudgetMonth) return;
    
    const [year, month] = selectedBudgetMonth.split('-');
    const currentYear = parseInt(year);
    const currentMonth = parseInt(month);
    
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    
    // Don't create if it already exists
    if (historicalData[nextMonthKey]) {
      handleBudgetMonthChange(nextMonthKey);
      return;
    }
    
    // Copy current month's data to new next month, but reset all income to 0
    const currentMonthData = historicalData[selectedBudgetMonth];
    if (currentMonthData) {
      const newMonthData = {
        ...currentMonthData,
        // Reset all income values to 0
        andreasSalary: 0,
        andreasförsäkringskassan: 0,
        andreasbarnbidrag: 0,
        susannaSalary: 0,
        susannaförsäkringskassan: 0,
        susannabarnbidrag: 0,
        // Update any date-specific properties if needed
        createdAt: new Date().toISOString()
      };
      
      updateHistoricalDataSingle(nextMonthKey, newMonthData);
      
      // Set the new month as selected
      setSelectedBudgetMonth(nextMonthKey);
      
      // Directly set all income values to 0 in the form
      setAndreasSalary(0);
      setAndreasförsäkringskassan(0);
      setAndreasbarnbidrag(0);
      setSusannaSalary(0);
      setSusannaförsäkringskassan(0);
      setSusannabarnbidrag(0);
      
      // Also load other data from the new month
      setTimeout(() => {
        const monthData = newMonthData;
        // UI data läses nu automatiskt från central state  
        setSelectedPerson((monthData as any).selectedPerson || 'andreas');
        setUserName1(monthData.userName1 || 'Andreas');
        setUserName2(monthData.userName2 || 'Susanna');
        setTransferChecks(monthData.transferChecks || {});
        setAndreasShareChecked(monthData.andreasShareChecked !== undefined ? monthData.andreasShareChecked : true);
        setSusannaShareChecked(monthData.susannaShareChecked !== undefined ? monthData.susannaShareChecked : true);
      }, 0);
    }
  };

  // Function to handle month creation from dialog
  const handleCreateMonthFromDialog = (type: 'empty' | 'template' | 'copy', templateName?: string, sourceMonth?: string) => {
    if (!selectedBudgetMonth) return;
    
    console.log(`🏗️ Creating new month. Type: ${type}, Template: ${templateName}, Source: ${sourceMonth}`);
    console.log(`🏗️ Current selectedBudgetMonth: ${selectedBudgetMonth}`);
    console.log(`🏗️ historicalData keys BEFORE creation:`, Object.keys(historicalData));
    
    // CRITICAL FIX: Save current month data FIRST before creating new month
    console.log(`💾 Saving current month (${selectedBudgetMonth}) before creating new month...`);
    saveToSelectedMonth();
    
    const [year, month] = selectedBudgetMonth.split('-');
    const currentYear = parseInt(year);
    const currentMonth = parseInt(month);
    
    // Calculate target month based on direction
    let targetMonth, targetYear;
    if (createMonthDirection === 'next') {
      targetMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      targetYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    } else {
      targetMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      targetYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    }
    
    const targetMonthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    console.log(`🏗️ Target month: ${targetMonthKey}`);
    
    // Don't create if it already exists
    if (historicalData[targetMonthKey]) {
      console.log(`⚠️ Target month ${targetMonthKey} already exists, switching to it`);
      updateSelectedBudgetMonth(targetMonthKey);
      return;
    }

    // Get estimated account balances for the new month
    const getEstimatedBalancesForNewMonth = () => {
      // For newly created months, "Faktiskt kontosaldo" should always be 0
      // regardless of direction (next or previous)
      const estimatedBalances: {[key: string]: number} = {};
      
      // Initialize all account balances to 0 for new months
      accounts.forEach(account => {
        estimatedBalances[account] = 0;
      });
      
      return estimatedBalances;
    };

    const estimatedAccountBalances = getEstimatedBalancesForNewMonth();
    
    let newMonthData: any;
    
    if (type === 'empty') {
      // Create empty month with same categories but no amounts
      // Since we just saved current month, we can get it from current state
      console.log(`📝 Creating empty month from current state`);
      
      newMonthData = {
        month: targetMonthKey,
        date: new Date().toISOString(),
        // Reset all income values to 0
        andreasSalary: 0,
        andreasförsäkringskassan: 0,
        andreasbarnbidrag: 0,
        susannaSalary: 0,
        susannaförsäkringskassan: 0,
        susannabarnbidrag: 0,
        // Reset all category amounts to 0, but exclude "Enskilda kostnader"
        costGroups: costGroups.map((group: any) => ({
          ...group,
          amount: 0,
          subCategories: (group.subCategories || []).filter((sub: any) => 
            sub.financedFrom !== 'Enskild kostnad'
          ).map((sub: any) => ({
            ...sub,
            amount: 0
          }))
        })),
        savingsGroups: savingsGroups.map((group: any) => ({
          ...group,
          amount: 0,
          subCategories: (group.subCategories || []).map((sub: any) => ({
            ...sub,
            amount: 0
          }))
        })),
        dailyTransfer: dailyTransfer || 300,
        weekendTransfer: weekendTransfer || 540,
        customHolidays: JSON.parse(JSON.stringify(customHolidays || [])),
        andreasPersonalCosts: JSON.parse(JSON.stringify(andreasPersonalCosts || [])),
        andreasPersonalSavings: JSON.parse(JSON.stringify(andreasPersonalSavings || [])),
        susannaPersonalCosts: JSON.parse(JSON.stringify(susannaPersonalCosts || [])),
        susannaPersonalSavings: JSON.parse(JSON.stringify(susannaPersonalSavings || [])),
        accounts: JSON.parse(JSON.stringify(accounts || ['Löpande', 'Sparkonto', 'Buffert'])),
        // Use empty account balances for new months - user should fill manually 
        accountBalances: {},
        accountBalancesSet: {}, // All balances start as not set, so they show "Ej ifyllt"
        accountEstimatedFinalBalances: {},
        createdAt: new Date().toISOString()
      };
    } else if (type === 'template' && templateName && budgetTemplates[templateName]) {
      // Use template data - copy all data like "Kopiera Budgetmall"
      const template = budgetTemplates[templateName];
      newMonthData = {
        date: new Date().toISOString(),
        andreasSalary: template.andreasSalary || 0,
        andreasförsäkringskassan: template.andreasförsäkringskassan || 0,
        andreasbarnbidrag: template.andreasbarnbidrag || 0,
        susannaSalary: template.susannaSalary || 0,
        susannaförsäkringskassan: template.susannaförsäkringskassan || 0,
        susannabarnbidrag: template.susannabarnbidrag || 0,
        costGroups: JSON.parse(JSON.stringify(template.costGroups || [])).map((group: any) => ({
          ...group,
          subCategories: (group.subCategories || []).filter((sub: any) => 
            sub.financedFrom !== 'Enskild kostnad'
          )
        })),
        savingsGroups: JSON.parse(JSON.stringify(template.savingsGroups || [])),
        dailyTransfer: template.dailyTransfer || 300,
        weekendTransfer: template.weekendTransfer || 540,
        customHolidays: JSON.parse(JSON.stringify(template.customHolidays || [])),
        andreasPersonalCosts: JSON.parse(JSON.stringify(template.andreasPersonalCosts || [])),
        andreasPersonalSavings: JSON.parse(JSON.stringify(template.andreasPersonalSavings || [])),
        susannaPersonalCosts: JSON.parse(JSON.stringify(template.susannaPersonalCosts || [])),
        susannaPersonalSavings: JSON.parse(JSON.stringify(template.susannaPersonalSavings || [])),
        accounts: JSON.parse(JSON.stringify(template.accounts || ['Löpande', 'Sparkonto', 'Buffert'])),
          // Use empty account balances for new months - user should fill manually 
          accountBalances: {},
          accountBalancesSet: {}, // All balances start as not set, so they show "Ej ifyllt"
          accountEstimatedFinalBalances: {},
          createdAt: new Date().toISOString()
      };
    } else if (type === 'copy' && sourceMonth) {
      // Copy from selected source month with all data including income values
      console.log(`📝 Creating month by copying from ${sourceMonth}`);
      
      let sourceMonthData;
      if (sourceMonth === selectedBudgetMonth) {
        // If copying from current month, use current state instead of historicalData
        console.log(`📝 Copying from current month - using current state`);
        sourceMonthData = {
          month: selectedBudgetMonth,
          date: new Date().toISOString(),
          andreasSalary,
          andreasförsäkringskassan,
          andreasbarnbidrag,
          susannaSalary,
          susannaförsäkringskassan,
          susannabarnbidrag,
          costGroups: JSON.parse(JSON.stringify(costGroups)),
          savingsGroups: JSON.parse(JSON.stringify(savingsGroups)),
          dailyTransfer,
          weekendTransfer,
          customHolidays: JSON.parse(JSON.stringify(customHolidays)),
          andreasPersonalCosts: JSON.parse(JSON.stringify(andreasPersonalCosts)),
          andreasPersonalSavings: JSON.parse(JSON.stringify(andreasPersonalSavings)),
          susannaPersonalCosts: JSON.parse(JSON.stringify(susannaPersonalCosts)),
          susannaPersonalSavings: JSON.parse(JSON.stringify(susannaPersonalSavings)),
          accounts: JSON.parse(JSON.stringify(accounts))
        };
      } else {
        // If copying from a different month, use historicalData
        console.log(`📝 Copying from different month - using historicalData`);
        sourceMonthData = historicalData[sourceMonth];
      }
      
      if (sourceMonthData) {
        newMonthData = {
          ...sourceMonthData,
          month: targetMonthKey,
          date: new Date().toISOString(),
          // Keep all income values from the source month
          // Filter out "Enskilda kostnader" from cost groups
          costGroups: (sourceMonthData.costGroups || []).map((group: any) => ({
            ...group,
            subCategories: (group.subCategories || []).filter((sub: any) => 
              sub.financedFrom !== 'Enskild kostnad'
            )
          })),
          // Use empty account balances for new months - user should fill manually 
          accountBalances: {},
          accountBalancesSet: {}, // All balances start as not set, so they show "Ej ifyllt"
          accountEstimatedFinalBalances: {},
          createdAt: new Date().toISOString()
        };
      }
    }
    
    if (newMonthData) {
      console.log(`🏗️ Creating new month with data:`, newMonthData);
      
      // Create a NEW object that contains all old data PLUS the new month
      const newHistoricalData = {
        ...historicalData,
        [targetMonthKey]: newMonthData
      };
      
      console.log(`🏗️ Updated historicalData keys:`, Object.keys(newHistoricalData));
      
      // Use central state management to update historical data
      updateHistoricalData(newHistoricalData);
      
      // Set the new month as selected
      setSelectedBudgetMonth(targetMonthKey);
      
      // Re-render is automatically handled by useBudget hook
      
      // Close the dialog after a brief delay to ensure state updates complete
      setTimeout(() => {
        setIsCreateMonthDialogOpen(false);
      }, 100);
    } else {
      console.error(`❌ Failed to create month data`);
    }
  };

  // Function to handle month selection change
  const handleBudgetMonthChange = (monthKey: string) => {
    console.log(`=== MONTH CHANGE: Switching to ${monthKey} ===`);
    
    // IMMEDIATE save of current month data before switching
    console.log(`💾 Final save before month switch...`);
    console.log(`💾 DEBUG: Before switch - andreasSalary:`, andreasSalary);
    console.log(`💾 DEBUG: Before switch - susannaSalary:`, susannaSalary);
    
    // Create explicit data snapshot to ensure we save current state values
    const currentDataSnapshot = {
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
      andreasPersonalCosts,
      andreasPersonalSavings,
      susannaPersonalCosts,
      susannaPersonalSavings,
      accountBalances,
      accountBalancesSet,
      accountEstimatedFinalBalances,
      accountEstimatedFinalBalancesSet,
      accountEstimatedStartBalances,
      accountStartBalancesSet
    };
    
    saveToSelectedMonth(currentDataSnapshot);
    
    // Calculate and save final balances for the previous month of the target month
    console.log(`Calculating previous month final balances...`);
    const freshFinalBalances = calculateAndSavePreviousMonthFinalBalances(monthKey);
    
    // Store the fresh final balances to use immediately for estimated balances
    if (freshFinalBalances) {
      (window as any).__freshFinalBalances = freshFinalBalances;
      console.log(`Stored fresh final balances for immediate use:`, freshFinalBalances);
    }
    
    setSelectedBudgetMonth(monthKey);
    
    // Check if switching away from current month while on Överföring tab
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonth = monthKey === currentMonthKey;
    
    // If switching to non-current month and currently on Överföring tab, switch to a valid tab
    if (!isCurrentMonth && activeTab === 'overforing') {
      setActiveTab('sammanstallning');
    }
    
    // If the month exists in historical data, load it
    if (historicalData[monthKey]) {
      loadDataFromSelectedMonth(monthKey);
    } else {
      // If it's a new month, add it with data copied from current month
      addNewBudgetMonth(monthKey, true);
    }
  };

  // Budget template functions
  const saveBudgetTemplate = (templateName: string, sourceMonth: string) => {
    const sourceData = historicalData[sourceMonth];
    if (!sourceData || !templateName.trim()) return;
    
    // Create template with complete cost and savings data including subcategories and accounts
    // Exclude "Enskilda kostnader" from the template
    const templateData = {
      name: templateName.trim(),
      date: new Date().toISOString(),
      costGroups: JSON.parse(JSON.stringify(sourceData.costGroups || [])).map((group: any) => ({
        ...group,
        subCategories: (group.subCategories || []).filter((sub: any) => 
          sub.financedFrom !== 'Enskild kostnad'
        )
      })),
      savingsGroups: JSON.parse(JSON.stringify(sourceData.savingsGroups || [])),
      dailyTransfer: sourceData.dailyTransfer || 300,
      weekendTransfer: sourceData.weekendTransfer || 540,
      customHolidays: JSON.parse(JSON.stringify(sourceData.customHolidays || [])),
      // Include accounts to ensure they are available when loading template
      accounts: JSON.parse(JSON.stringify(budgetState.accounts.map(acc => acc.name)))
    };
    
    const updatedTemplates = {
      ...budgetTemplates,
      [templateName.trim()]: templateData
    };
    
    setBudgetTemplates(updatedTemplates);
    
    // Save immediately to localStorage with the new template data
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
      customHolidays,
      results,
      selectedPerson,
      andreasPersonalCosts,
      andreasPersonalSavings,
      susannaPersonalCosts,
      susannaPersonalSavings,
      historicalData,
      accounts,
      budgetTemplates: updatedTemplates, // Use the updated templates immediately
      selectedBudgetMonth
    };
    localStorage.setItem('budgetCalculatorData', JSON.stringify(dataToSave));
  };

  const loadBudgetTemplate = (templateName: string) => {
    const template = budgetTemplates[templateName];
    if (!template) return;
    
    // Load template data into current form with complete data
    updateCostGroups(JSON.parse(JSON.stringify(template.costGroups || [])));
    setSavingsGroups(JSON.parse(JSON.stringify(template.savingsGroups || [])));
    setDailyTransfer(template.dailyTransfer || 300);
    setWeekendTransfer(template.weekendTransfer || 540);
    setCustomHolidays(JSON.parse(JSON.stringify(template.customHolidays || [])));
    
    // Load accounts if they exist in the template
    if (template.accounts) {
      setAccounts(JSON.parse(JSON.stringify(template.accounts)));
    }
    
    // Save current month after loading template
    saveToSelectedMonth();
  };

  const copyTemplateToJuli2025 = (templateName: string) => {
    const template = budgetTemplates[templateName];
    if (!template) return;
    
    const juli2025Key = '2025-07';
    
    // Create historical data entry for Juli 2025
    const historicalEntry = {
      andreasSalary: template.andreasSalary || 45000,
      andreasförsäkringskassan: template.andreasförsäkringskassan || 0,
      andreasbarnbidrag: template.andreasbarnbidrag || 0,
      susannaSalary: template.susannaSalary || 40000,
      susannaförsäkringskassan: template.susannaförsäkringskassan || 5000,
      susannabarnbidrag: template.susannabarnbidrag || 0,
      costGroups: JSON.parse(JSON.stringify(template.costGroups || [])),
      savingsGroups: JSON.parse(JSON.stringify(template.savingsGroups || [])),
      dailyTransfer: template.dailyTransfer || 300,
      weekendTransfer: template.weekendTransfer || 540,
      customHolidays: JSON.parse(JSON.stringify(template.customHolidays || [])),
      andreasPersonalCosts: JSON.parse(JSON.stringify(template.andreasPersonalCosts || [])),
      andreasPersonalSavings: JSON.parse(JSON.stringify(template.andreasPersonalSavings || [])),
      susannaPersonalCosts: JSON.parse(JSON.stringify(template.susannaPersonalCosts || [])),
      susannaPersonalSavings: JSON.parse(JSON.stringify(template.susannaPersonalSavings || [])),
      accounts: JSON.parse(JSON.stringify(template.accounts || ['Löpande', 'Sparkonto', 'Buffert'])),
      transferChecks: {},
      andreasShareChecked: false,
      susannaShareChecked: false,
      results: null,
      transferAccount: 0,
      date: new Date().toISOString()
    };
    
    // Update historical data
    const updatedHistoricalData = {
      ...historicalData,
      [juli2025Key]: historicalEntry
    };
    
    setHistoricalData(updatedHistoricalData);
    
    // Note: Auto-save now handled by orchestrator
  };

  const deleteBudgetTemplate = (templateName: string) => {
    setBudgetTemplates(prev => {
      const updated = { ...prev };
      delete updated[templateName];
      return updated;
    });
  };

  const startEditingTemplate = (templateName: string) => {
    const template = budgetTemplates[templateName];
    if (!template) return;
    
    setEditingTemplate(templateName);
    setEditingTemplateData(JSON.parse(JSON.stringify(template)));
  };

  const saveEditedTemplate = () => {
    if (!editingTemplate || !editingTemplateData) return;
    
    setBudgetTemplates(prev => ({
      ...prev,
      [editingTemplate]: {
        ...editingTemplateData,
        date: new Date().toISOString() // Update modification date
      }
    }));
    
    setEditingTemplate(null);
    setEditingTemplateData(null);
    
    // Note: Save now handled by orchestrator
  };

  const cancelEditingTemplate = () => {
    setEditingTemplate(null);
    setEditingTemplateData(null);
  };

  const updateEditingTemplateTransfer = (field: 'dailyTransfer' | 'weekendTransfer', value: number) => {
    if (!editingTemplateData) return;
    
    setEditingTemplateData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const copyTemplateToMonth = (templateName?: string, targetMonth?: string) => {
    const template = budgetTemplates[templateName || selectedTemplateToCopy];
    const month = targetMonth || targetCopyMonth;
    
    if (!template || !month) return;
    
    // Prepare the data to copy (exclude accountBalances - user should fill manually)
    const templateDataToCopy = {
      month: month,
      date: new Date().toISOString(),
      andreasSalary: template.andreasSalary || 0,
      andreasförsäkringskassan: template.andreasförsäkringskassan || 0,
      andreasbarnbidrag: template.andreasbarnbidrag || 0,
      susannaSalary: template.susannaSalary || 0,
      susannaförsäkringskassan: template.susannaförsäkringskassan || 0,
      susannabarnbidrag: template.susannabarnbidrag || 0,
      costGroups: JSON.parse(JSON.stringify(template.costGroups || [])),
      savingsGroups: JSON.parse(JSON.stringify(template.savingsGroups || [])),
      dailyTransfer: template.dailyTransfer || 300,
      weekendTransfer: template.weekendTransfer || 540,
      customHolidays: JSON.parse(JSON.stringify(template.customHolidays || [])),
      andreasPersonalCosts: JSON.parse(JSON.stringify(template.andreasPersonalCosts || [])),
      andreasPersonalSavings: JSON.parse(JSON.stringify(template.andreasPersonalSavings || [])),
      susannaPersonalCosts: JSON.parse(JSON.stringify(template.susannaPersonalCosts || [])),
      susannaPersonalSavings: JSON.parse(JSON.stringify(template.susannaPersonalSavings || [])),
      accounts: JSON.parse(JSON.stringify(template.accounts || ['Löpande', 'Sparkonto', 'Buffert'])),
      // accountBalances: {} // Explicitly exclude - user should fill manually
    };
    
    // If we're updating the current month, apply changes directly
    if (month === selectedBudgetMonth) {
      setAndreasSalary(template.andreasSalary || 0);
      setAndreasförsäkringskassan(template.andreasförsäkringskassan || 0);
      setAndreasbarnbidrag(template.andreasbarnbidrag || 0);
      setSusannaSalary(template.susannaSalary || 0);
      setSusannaförsäkringskassan(template.susannaförsäkringskassan || 0);
      setSusannabarnbidrag(template.susannabarnbidrag || 0);
      updateCostGroups(JSON.parse(JSON.stringify(template.costGroups || [])));
      setSavingsGroups(JSON.parse(JSON.stringify(template.savingsGroups || [])));
      setDailyTransfer(template.dailyTransfer || 300);
      setWeekendTransfer(template.weekendTransfer || 540);
      setCustomHolidays(JSON.parse(JSON.stringify(template.customHolidays || [])));
      setAndreasPersonalCosts(JSON.parse(JSON.stringify(template.andreasPersonalCosts || [])));
      setAndreasPersonalSavings(JSON.parse(JSON.stringify(template.andreasPersonalSavings || [])));
      setSusannaPersonalCosts(JSON.parse(JSON.stringify(template.susannaPersonalCosts || [])));
      setAccounts(JSON.parse(JSON.stringify(template.accounts || ['Löpande', 'Sparkonto', 'Buffert'])));
      // ARKITEKTONISK FIX: Account balances hanteras av central state
      // setAccountBalances({});
      // setAccountBalancesSet({}); // All balances start as not set, so they show "Ej ifyllt"
    }
    
    // Add the copied data to historical data
    updateHistoricalDataSingle(month, templateDataToCopy);
    
    // Reset form
    setSelectedTemplateToCopy('');
    setTargetCopyMonth('');
    setShowTemplateDetails(false);
    
    console.log(`Budget template "${templateName || selectedTemplateToCopy}" has been copied to ${month}`);
  };

  const updateEditingTemplateGroup = (groupId: string, field: string, value: any, isSubCategory: boolean = false, subCategoryId?: string) => {
    if (!editingTemplateData) return;
    
    setEditingTemplateData((prev: any) => {
      const updated = { ...prev };
      
      // Update cost groups
      if (updated.costGroups) {
        updated.costGroups = updated.costGroups.map((group: any) => {
          if (group.id === groupId) {
            if (isSubCategory && subCategoryId) {
              // Update subcategory
              const updatedGroup = { ...group };
              if (updatedGroup.subCategories) {
                updatedGroup.subCategories = updatedGroup.subCategories.map((sub: any) => 
                  sub.id === subCategoryId ? { ...sub, [field]: value } : sub
                );
              }
              return updatedGroup;
            } else {
              // Update main category
              return { ...group, [field]: value };
            }
          }
          return group;
        });
      }
      
      // Update savings groups
      if (updated.savingsGroups) {
        updated.savingsGroups = updated.savingsGroups.map((group: any) => {
          if (group.id === groupId) {
            return { ...group, [field]: value };
          }
          return group;
        });
      }
      
      return updated;
    });
  };

  const calculateMainCategorySum = (group: any) => {
    if (!group.subCategories || group.subCategories.length === 0) {
      return group.amount;
    }
    return group.subCategories.reduce((sum: number, sub: any) => sum + (sub.amount || 0), 0);
  };

  const addEditingCostGroup = () => {
    if (!editingTemplateData) return;
    
    const newGroup = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      type: 'cost',
      subCategories: []
    };
    
    setEditingTemplateData(prev => ({
      ...prev,
      costGroups: [...(prev.costGroups || []), newGroup]
    }));
  };

  const addEditingSavingsGroup = () => {
    if (!editingTemplateData) return;
    
    const newGroup = {
      id: Date.now().toString(),
      name: '',
      amount: 0,
      type: 'savings'
    };
    
    setEditingTemplateData(prev => ({
      ...prev,
      savingsGroups: [...(prev.savingsGroups || []), newGroup]
    }));
  };

  const addEditingSubCategory = (groupId: string) => {
    if (!editingTemplateData) return;
    
    const newSubCategory = {
      id: Date.now().toString(),
      name: '',
      amount: 0
    };
    
    setEditingTemplateData(prev => ({
      ...prev,
      costGroups: prev.costGroups.map((group: any) => 
        group.id === groupId ? { 
          ...group, 
          subCategories: [...(group.subCategories || []), newSubCategory]
        } : group
      )
    }));
  };

  const removeEditingCostGroup = (groupId: string) => {
    if (!editingTemplateData) return;
    
    setEditingTemplateData(prev => ({
      ...prev,
      costGroups: prev.costGroups.filter((group: any) => group.id !== groupId)
    }));
  };

  const removeEditingSavingsGroup = (groupId: string) => {
    if (!editingTemplateData) return;
    
    setEditingTemplateData(prev => ({
      ...prev,
      savingsGroups: prev.savingsGroups.filter((group: any) => group.id !== groupId)
    }));
  };

  const removeEditingSubCategory = (groupId: string, subCategoryId: string) => {
    if (!editingTemplateData) return;
    
    setEditingTemplateData(prev => ({
      ...prev,
      costGroups: prev.costGroups.map((group: any) => 
        group.id === groupId ? {
          ...group,
          subCategories: group.subCategories.filter((sub: any) => sub.id !== subCategoryId)
        } : group
      )
    }));
  };

  // Backup functions
  const saveBackup = () => {
    const backupData = {
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
      customHolidays,
      selectedPerson,
      andreasPersonalCosts,
      andreasPersonalSavings,
      susannaPersonalCosts,
      susannaPersonalSavings,
      historicalData,
      accounts,
      budgetTemplates,
      showIndividualCostsOutsideBudget,
      showSavingsSeparately
    };
    localStorage.setItem('budgetCalculatorBackup', JSON.stringify(backupData));
    setStandardValues(backupData);
    console.log('Backup saved successfully with all historical data');
  };

  const loadBackup = () => {
    if (standardValues) {
      // Replace all data with backup data
      setAndreasSalary(standardValues.andreasSalary || 45000);
      setAndreasförsäkringskassan(standardValues.andreasförsäkringskassan || 0);
      setAndreasbarnbidrag(standardValues.andreasbarnbidrag || 0);
      setSusannaSalary(standardValues.susannaSalary || 40000);
      setSusannaförsäkringskassan(standardValues.susannaförsäkringskassan || 5000);
      setSusannabarnbidrag(standardValues.susannabarnbidrag || 0);
      updateCostGroups(standardValues.costGroups || []);
      setSavingsGroups(standardValues.savingsGroups || []);
      setDailyTransfer(standardValues.dailyTransfer || 300);
      setWeekendTransfer(standardValues.weekendTransfer || 540);
      setCustomHolidays(standardValues.customHolidays || []);
      setSelectedPerson(standardValues.selectedPerson || 'andreas');
      setAndreasPersonalCosts(standardValues.andreasPersonalCosts || []);
      setAndreasPersonalSavings(standardValues.andreasPersonalSavings || []);
      setSusannaPersonalCosts(standardValues.susannaPersonalCosts || []);
      setSusannaPersonalSavings(standardValues.susannaPersonalSavings || []);
      setHistoricalData(standardValues.historicalData || {});
      setAccounts(standardValues.accounts || ['Löpande', 'Sparkonto', 'Buffert']);
      setBudgetTemplates(standardValues.budgetTemplates || {});
      console.log('Backup loaded successfully - all data replaced');
    }
  };

  const updateSubCategory = (groupId: string, subId: string, field: 'name' | 'amount' | 'account' | 'financedFrom', value: string | number) => {
    updateCostGroups(costGroups.map(group => 
      group.id === groupId ? {
        ...group,
        subCategories: group.subCategories?.map(sub => 
          sub.id === subId ? { ...sub, [field]: value } : sub
        ) || []
      } : group
    ));
    
    // Reset MonthFinalBalances flag when manual values are changed
    const currentDate = new Date();
    const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    resetMonthFinalBalancesFlag(currentMonthKey);
  };

  // Cost item edit dialog functions
  const openEditDialog = (item: SubCategory & { groupId: string }, categoryName: string) => {
    setEditingItem({ ...item, categoryName });
    setIsEditDialogOpen(true);
  };

  const handleEditSave = (updatedItem: SubCategory & { groupId: string; categoryName: string }) => {
    // Check if category changed - if so, we need to move the item
    const originalGroup = costGroups.find(g => g.id === updatedItem.groupId);
    const originalCategoryName = originalGroup?.name;
    
    if (updatedItem.categoryName !== originalCategoryName) {
      // Find or create the target category group
      let targetGroup = costGroups.find(g => g.name === updatedItem.categoryName);
      if (!targetGroup) {
        // Create new group if it doesn't exist
        targetGroup = {
          id: `category-${Date.now()}`,
          name: updatedItem.categoryName,
          amount: 0,
          type: 'cost' as const,
          subCategories: []
        };
        updateCostGroups([...costGroups, targetGroup]);
      }
      
      // Remove item from original group and add to target group
      const updatedCostGroups = costGroups.map(group => {
        if (group.id === updatedItem.groupId) {
          // Remove from original group
          return {
            ...group,
            subCategories: group.subCategories?.filter(sub => sub.id !== updatedItem.id) || []
          };
        } else if (group.name === updatedItem.categoryName) {
          // Add to target group
          const { categoryName, groupId, ...subItem } = updatedItem;
          return {
            ...group,
            subCategories: [...(group.subCategories || []), subItem]
          };
        }
        return group;
      });
      
      updateCostGroups(updatedCostGroups);
    } else {
      // Just update the item in place
      const { categoryName, ...subItem } = updatedItem;
      updateCostGroups(costGroups.map(group => 
        group.id === updatedItem.groupId ? {
          ...group,
          subCategories: group.subCategories?.map(sub => 
            sub.id === updatedItem.id ? subItem : sub
          ) || []
        } : group
      ));
    }
    
    // Reset MonthFinalBalances flag when manual values are changed
    const currentDate = new Date();
    const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    resetMonthFinalBalancesFlag(currentMonthKey);
  };

  // Get unique category names for the edit dialog
  const getCategoryNames = (): string[] => {
    return [...new Set(costGroups.map(group => group.name))].filter((name): name is string => typeof name === 'string');
  };

  // Account management functions
  const addAccount = () => {
    if (newAccountName.trim() && !accounts.includes(newAccountName.trim())) {
      setAccounts([...accounts, newAccountName.trim()]);
      setNewAccountName('');
    }
  };

  const removeAccount = (accountName: string) => {
    setAccounts(accounts.filter(account => account !== accountName));
    // Remove the account from all subcategories and savings groups
    updateCostGroups(costGroups.map(group => ({
      ...group,
      account: group.account === accountName ? undefined : group.account,
      subCategories: group.subCategories?.map(sub => ({
        ...sub,
        account: sub.account === accountName ? undefined : sub.account
      }))
    })));
    setSavingsGroups(savingsGroups.map(group => ({
      ...group,
      account: group.account === accountName ? undefined : group.account
    })));
  };

  const updateSavingsGroupAccount = (id: string, account: string) => {
    setSavingsGroups(savingsGroups.map(group => 
      group.id === id ? { ...group, account: account || undefined } : group
    ));
  };

  // Account category management functions
  const addAccountCategory = () => {
    if (newCategoryName.trim() && !accountCategories.includes(newCategoryName.trim())) {
      setAccountCategories([...accountCategories, newCategoryName.trim()]);
      setNewCategoryName('');
    }
  };

  const removeAccountCategory = (categoryName: string) => {
    setAccountCategories(accountCategories.filter(category => category !== categoryName));
    // Remove the category from all account mappings
    const updatedMapping = { ...accountCategoryMapping };
    Object.keys(updatedMapping).forEach(account => {
      if (updatedMapping[account] === categoryName) {
        delete updatedMapping[account];
      }
    });
    setAccountCategoryMapping(updatedMapping);
  };

  const updateAccountCategory = (accountName: string, categoryName: string) => {
    if (categoryName === 'none') {
      const updatedMapping = { ...accountCategoryMapping };
      delete updatedMapping[accountName];
      setAccountCategoryMapping(updatedMapping);
    } else {
      setAccountCategoryMapping(prev => ({
        ...prev,
        [accountName]: categoryName
      }));
    }
  };

  // Helper function to group accounts by category
  const getAccountsByCategory = () => {
    const grouped: {[category: string]: string[]} = {};
    
    // Add accounts with categories
    Object.entries(accountCategoryMapping).forEach(([accountName, category]) => {
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(accountName);
    });
    
    // Add accounts without categories to "Hushåll" by default
    const accountsWithoutCategory = accounts.filter(account => {
      const accountName = typeof account === 'string' ? account : (account as any).name || '';
      return !accountCategoryMapping[accountName];
    });
    
    if (accountsWithoutCategory.length > 0) {
      if (!grouped['Hushåll']) {
        grouped['Hushåll'] = [];
      }
      grouped['Hushåll'].push(...accountsWithoutCategory.map(account => 
        typeof account === 'string' ? account : (account as any).name || ''
      ));
    }
    
    return grouped;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Personal budget helper functions
  const getCurrentPersonalCosts = () => {
    return selectedPerson === 'andreas' ? andreasPersonalCosts : susannaPersonalCosts;
  };

  const getCurrentPersonalSavings = () => {
    return selectedPerson === 'andreas' ? andreasPersonalSavings : susannaPersonalSavings;
  };

  const setCurrentPersonalCosts = (costs: BudgetGroup[]) => {
    const total = costs.reduce((sum, group) => sum + group.amount, 0);
    if (selectedPerson === 'andreas') {
      setAndreasPersonalCosts(total);
    } else {
      setSusannaPersonalCosts(total);
    }
  };

  const setCurrentPersonalSavings = (savings: BudgetGroup[]) => {
    const total = savings.reduce((sum, group) => sum + group.amount, 0);
    if (selectedPerson === 'andreas') {
      setAndreasPersonalSavings(total);
    } else {
      setSusannaPersonalSavings(total);
    }
  };

  // These functions are no longer needed since personal costs are now numbers, not arrays
  // Keeping them as no-ops for backward compatibility during transition
  const addPersonalCostGroup = () => {
    console.log('Personal costs are now managed as numbers, not arrays');
  };

  const addPersonalSavingsGroup = () => {
    console.log('Personal savings are now managed as numbers, not arrays');
  };

  const removePersonalCostGroup = (id: string) => {
    console.log('Personal costs are now managed as numbers, not arrays');
  };

  const removePersonalSavingsGroup = (id: string) => {
    console.log('Personal savings are now managed as numbers, not arrays');
  };

  const updatePersonalCostGroup = (id: string, field: 'name' | 'amount', value: string | number) => {
    console.log('Personal costs are now managed as numbers, not arrays');
  };

  const updatePersonalSavingsGroup = (id: string, field: 'name' | 'amount', value: string | number) => {
    console.log('Personal savings are now managed as numbers, not arrays');
  };

  const getCurrentPersonIncome = () => {
    if (!results) return 0;
    if (selectedPerson === 'andreas') {
      return results.andreasShare;
    } else {
      return results.susannaShare;
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newState = {
        ...prev,
        [section]: !prev[section]
      };
      
      // If collapsing a section, exit edit mode
      if (prev[section] === true && !newState[section]) {
        if (section === 'costCategories' || section === 'savingsCategories') {
          setIsEditingCategories(false);
        }
        if (section === 'budgetTransfers') {
          setIsEditingTransfers(false);
        }
        if (section === 'redDays') {
          setIsEditingHolidays(false);
        }
      }
      
      return newState;
    });
  };

  const toggleAccountDetails = (accountName: string) => {
    setExpandedAccounts(prev => ({
      ...prev,
      [accountName]: !prev[accountName]
    }));
  };

  const toggleBudgetCategory = (categoryKey: string) => {
    setExpandedBudgetCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const renderHistoricalCharts = () => {
    const chartData = Object.keys(historicalData).map(monthKey => {
      const data = historicalData[monthKey];
      
      // Calculate totals from groups since MonthData doesn't store calculated results
      const totalCosts = (data.costGroups?.reduce((sum: number, group: any) => {
        const subCategoriesTotal = group.subCategories?.reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
        return sum + subCategoriesTotal;
      }, 0) || 0);
      
      const totalSavings = (data.savingsGroups?.reduce((sum: number, group: any) => sum + group.amount, 0) || 0);
      
      // Calculate total income from salary fields
      const totalIncome = (data.andreasSalary || 0) + (data.andreasförsäkringskassan || 0) + (data.andreasbarnbidrag || 0) +
                         (data.susannaSalary || 0) + (data.susannaförsäkringskassan || 0) + (data.susannabarnbidrag || 0);
      
      return {
        month: monthKey,
        totalIncome: totalIncome,
        totalCosts: totalCosts,
        totalSavings: totalSavings,
        totalDailyBudget: (data.dailyTransfer || 0) * 30 // Approximate monthly from daily
      };
    }).sort((a, b) => a.month.localeCompare(b.month));

    if (chartData.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Ingen historisk data tillgänglig. Budgeten sparas automatiskt varje månad.</p>
        </div>
      );
    }

    return (
      <div className="h-64 sm:h-80 lg:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="totalIncome" stroke="#22c55e" name="Totala Intäkter" />
            <Line type="monotone" dataKey="totalCosts" stroke="#ef4444" name="Totala Kostnader" />
            <Line type="monotone" dataKey="totalSavings" stroke="#3b82f6" name="Totalt Sparande" />
            <Line type="monotone" dataKey="totalDailyBudget" stroke="#f59e0b" name="Total Daglig Budget" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderAccountBalanceChart = () => {
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Get all saved months from historical data and sort them
    const savedMonthKeys = Object.keys(historicalData).sort();
    
    // Create extended month list based on user selection or default behavior
    let extendedMonthKeys: string[] = [];
    
    if (useCustomTimeRange && chartStartMonth && chartEndMonth) {
      // Use custom time range - generate all months between start and end (inclusive)
      const [startYear, startMonth] = chartStartMonth.split('-').map(Number);
      const [endYear, endMonth] = chartEndMonth.split('-').map(Number);
      
      let currentIterMonth = new Date(startYear, startMonth - 1, 1);
      const endDate = new Date(endYear, endMonth - 1, 1);
      
      if (endDate >= currentIterMonth) {
        while (currentIterMonth <= endDate) {
          const monthKey = `${currentIterMonth.getFullYear()}-${String(currentIterMonth.getMonth() + 1).padStart(2, '0')}`;
          extendedMonthKeys.push(monthKey);
          currentIterMonth.setMonth(currentIterMonth.getMonth() + 1);
        }
      }
    } else {
      // Default behavior: show saved months plus current month
      extendedMonthKeys = [...savedMonthKeys];
      if (!extendedMonthKeys.includes(currentMonthKey)) {
        extendedMonthKeys.push(currentMonthKey);
      }
      extendedMonthKeys.sort();
    }

    // Initialize selected accounts to show ALL accounts by default
    if (selectedAccountsForChart.length === 0 && accounts.length > 0) {
      setSelectedAccountsForChart([...accounts]);
    }
    
    // Helper function to get Calc.Kontosaldo for a month and account (same logic as the main page)
    const getCalcKontosaldo = (monthKey: string, account: string) => {
      const monthData = historicalData[monthKey];
      
      if (!monthData) {
        return { balance: 0, isEstimated: true };
      }
      
      // Same logic as main page Calc.Kontosaldo
      const hasActualBalance = monthData.accountBalancesSet && 
                              monthData.accountBalancesSet[account] === true;
      const currentBalance = monthData.accountBalances?.[account] || 0;
      const estimatedBalance = monthData.accountEstimatedStartBalances?.[account] || 0;
      
      const calcBalance = hasActualBalance ? currentBalance : estimatedBalance;
      const isUsingEstimated = !hasActualBalance;
      
      return { balance: calcBalance, isEstimated: isUsingEstimated };
    };

     // Helper function to format month for display (shows actual month)
     const formatMonthForDisplay = (monthKey: string) => {
       const [year, monthNum] = monthKey.split('-').map(Number);
       
       const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                          'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
       const monthName = monthNames[monthNum - 1];
       return `${year} - ${monthName}`;
     };

      // Helper function to get individual costs for an account in a month
      const getIndividualCosts = (monthKey: string, account: string) => {
        const monthData = historicalData[monthKey];
        if (!monthData || !monthData.costGroups) return 0;
        
        let totalIndividualCosts = 0;
        
        // Check both costGroups and savingsGroups for individual costs
        if (monthData.costGroups) {
          monthData.costGroups.forEach((group: any) => {
            if (group.subCategories) {
              group.subCategories
                .filter((sub: any) => sub.account === account && sub.financedFrom === 'Enskild kostnad')
                .forEach((sub: any) => {
                  totalIndividualCosts += sub.amount;
                  console.log(`Individual cost found in costGroups - Month: ${monthKey}, Account: ${account}, Amount: ${sub.amount}, Name: ${sub.name}`);
                });
            }
            
            // Also check if the group itself is an individual cost
            if (group.account === account && group.financedFrom === 'Enskild kostnad') {
              totalIndividualCosts += group.amount;
              console.log(`Individual cost found as group - Month: ${monthKey}, Account: ${account}, Amount: ${group.amount}, Name: ${group.name}`);
            }
          });
        }
        
        // Also check savingsGroups for individual costs
        if (monthData.savingsGroups) {
          monthData.savingsGroups.forEach((group: any) => {
            if (group.subCategories) {
              group.subCategories
                .filter((sub: any) => sub.account === account && sub.financedFrom === 'Enskild kostnad')
                .forEach((sub: any) => {
                  totalIndividualCosts += sub.amount;
                  console.log(`Individual cost found in savingsGroups subCategories - Month: ${monthKey}, Account: ${account}, Amount: ${sub.amount}, Name: ${sub.name}`);
                });
            }
            
            // Also check if the savings group itself is an individual cost
            if (group.account === account && group.financedFrom === 'Enskild kostnad') {
              totalIndividualCosts += group.amount;
              console.log(`Individual cost found as savings group - Month: ${monthKey}, Account: ${account}, Amount: ${group.amount}, Name: ${group.name}`);
            }
          });
        }
        
        if (totalIndividualCosts !== 0) {
        console.log(`💰 Total individual costs for ${account} in ${monthKey}: ${totalIndividualCosts}`);
        }
        
        return totalIndividualCosts;
      };

      // Helper function to get savings for an account in a month
      const getSavingsForAccount = (monthKey: string, account: string) => {
        const monthData = historicalData[monthKey];
        if (!monthData || !monthData.savingsGroups) return 0;
        
        return monthData.savingsGroups
          .filter((group: any) => group.account === account)
          .reduce((sum: number, group: any) => sum + group.amount, 0);
      };

    // Calculate chart data
    const chartData = extendedMonthKeys.map((monthKey, index) => {
      const dataPoint: any = { 
        month: monthKey,
        displayMonth: formatMonthForDisplay(monthKey)
      };
      
      accounts.forEach(account => {
        const { balance, isEstimated } = getCalcKontosaldo(monthKey, account);
        
        // If showing estimated amounts is disabled and this is estimated data, don't include it
        if (!showEstimatedBudgetAmounts && isEstimated) {
          // Don't add this data point
          return;
        }
        
        // Always add the main account data (this is the final balance for the month)
        dataPoint[account] = balance;
        
        // Get current month data for additional fields
        const monthData = historicalData[monthKey];
        
        // Starting balance logic
        let startingBalance = monthData?.accountBalances?.[account] || 0;
        if (startingBalance === 0) {
          startingBalance = monthData?.accountEstimatedStartBalances?.[account] || 0;
        }
        dataPoint[`${account}_startingBalance`] = startingBalance;
        
        // Add information about whether accountBalances is set for this month
        dataPoint[`${account}_accountBalancesSet`] = monthData?.accountBalancesSet?.[account] === true;
        
        // Add estimated start balance for tooltip
        dataPoint[`${account}_estimatedStartBalance`] = monthData?.accountEstimatedStartBalances?.[account] || 0;
        
        // Add estimated final balance for tooltip
        dataPoint[`${account}_estimatedFinalBalance`] = monthData?.accountEstimatedFinalBalances?.[account] || 0;
        
        // Add next month starting balance for closing balance calculation
        const nextMonthIndex = index + 1;
        if (nextMonthIndex < extendedMonthKeys.length) {
          const nextMonthKey = extendedMonthKeys[nextMonthIndex];
          const nextMonthData = historicalData[nextMonthKey];
          
          if (nextMonthData && nextMonthData.accountBalancesSet && nextMonthData.accountBalancesSet[account]) {
            dataPoint[`${account}_nextMonthStartingBalance`] = nextMonthData.accountBalances?.[account] || 0;
          } else {
            dataPoint[`${account}_nextMonthStartingBalance`] = null;
          }
        } else {
          dataPoint[`${account}_nextMonthStartingBalance`] = null;
        }
        
        // Mark if this point is estimated for styling purposes
        if (isEstimated) {
          dataPoint[`${account}_isEstimated`] = true;
        }
        
        // Calculate "Faktiska extra kostnader/intäkter" from next month's Calc.diff
        // nextMonthIndex already defined above
        if (nextMonthIndex < extendedMonthKeys.length) {
          const nextMonthKey = extendedMonthKeys[nextMonthIndex];
          const nextMonthData = historicalData[nextMonthKey];
          
          if (nextMonthData && nextMonthData.accountBalancesSet && nextMonthData.accountBalancesSet[account]) {
            // Next month has actual balance, calculate its Calc.diff
            const nextActualBalance = nextMonthData.accountBalances?.[account] || 0;
            const nextEstimatedBalance = nextMonthData.accountEstimatedStartBalances?.[account] || 0;
            const nextCalcDiff = nextActualBalance - nextEstimatedBalance;
            dataPoint[`${account}_actualExtraCosts`] = nextCalcDiff;
          } else {
            // Next month doesn't have actual balance, so Calc.diff = 0
            dataPoint[`${account}_actualExtraCosts`] = 0;
          }
        } else {
          // No next month available
          dataPoint[`${account}_actualExtraCosts`] = 0;
        }
      });

      // Add individual costs if enabled - always show them regardless of estimated budget setting
      if (showIndividualCostsOutsideBudget) {
        accounts.forEach(account => {
          // Individual costs are now shown in the actual month they occurred
          const individualCosts = getIndividualCosts(monthKey, account);
          dataPoint[`${account}_individual`] = individualCosts;
          if (individualCosts !== 0) {
            console.log(`📍 Adding individual costs to chart data - Month: ${monthKey}, Account: ${account}, Amount: ${individualCosts}`);
          }
        });
      }

      // Add savings if enabled - always show them regardless of estimated budget setting
      if (showSavingsSeparately) {
        accounts.forEach(account => {
          // Savings are shown in the actual month they occurred
          const savings = getSavingsForAccount(monthKey, account);
          dataPoint[`${account}_savings`] = savings;
        });
      }

      return dataPoint;
    }).filter((dataPoint) => {
      // When estimated budget amounts are disabled, only show months with manually set balances OR actual data
      if (!showEstimatedBudgetAmounts) {
        const monthData = historicalData[dataPoint.month];
        if (!monthData) return false;
        
        // Check if any account has accountBalancesSet (actual balance data)
        const hasActualBalance = accounts.some(account => 
          monthData.accountBalancesSet && monthData.accountBalancesSet[account]
        );
        
        // Check if any account has accountStartBalancesSet (accountEndBalancesSet removed)
        const hasManualStartBalance = accounts.some(account => 
          monthData.accountStartBalancesSet && monthData.accountStartBalancesSet[account]
        );
        const hasManualEndBalance = false; // End balances are now calculated, not manually set
        
        return hasActualBalance || hasManualStartBalance || hasManualEndBalance;
      }
      
      // Default behavior: only include months that have at least one account with data
      return accounts.some(account => dataPoint[account] !== 0);
    });

    // Account colors for the chart
    const accountColors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
      '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
    ];

    // Check for invalid range
    const hasInvalidRange = useCustomTimeRange && chartStartMonth && chartEndMonth && chartStartMonth > chartEndMonth;
    
    // Render month selection UI
    const monthSelectorUI = (
      <div className="bg-muted/50 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-3">
          <Checkbox 
            checked={useCustomTimeRange}
            onCheckedChange={(checked) => setUseCustomTimeRange(checked as boolean)}
          />
          <h4 className="font-medium">Anpassa tidsintervall</h4>
        </div>
        
        {useCustomTimeRange && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <Label htmlFor="chart-start-month" className="text-sm">Startmånad:</Label>
               <Select value={chartStartMonth} onValueChange={setChartStartMonth}>
                 <SelectTrigger>
                   <SelectValue placeholder="Välj startmånad" />
                 </SelectTrigger>
                 <SelectContent>
                   {(() => {
                     // Create options starting one month before the first saved month
                     const allOptions = [...savedMonthKeys];
                     if (savedMonthKeys.length > 0) {
                       const firstMonth = savedMonthKeys[0];
                       const [year, monthNum] = firstMonth.split('-').map(Number);
                       let prevYear = year;
                       let prevMonth = monthNum - 1;
                       
                       if (prevMonth === 0) {
                         prevYear = year - 1;
                         prevMonth = 12;
                       }
                       
                       const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
                       allOptions.unshift(prevMonthKey);
                     }
                     
                     return allOptions.map(month => {
                       const [year, monthNum] = month.split('-');
                       const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                                          'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
                       const monthName = monthNames[parseInt(monthNum) - 1];
                       return (
                         <SelectItem key={month} value={month}>{year} - {monthName}</SelectItem>
                       );
                     });
                   })()}
                 </SelectContent>
               </Select>
             </div>
            <div>
              <Label htmlFor="chart-end-month" className="text-sm">Slutmånad:</Label>
              <Select value={chartEndMonth} onValueChange={setChartEndMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj slutmånad" />
                </SelectTrigger>
                <SelectContent>
                  {savedMonthKeys.map(month => {
                    const [year, monthNum] = month.split('-');
                    const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                                       'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
                    const monthName = monthNames[parseInt(monthNum) - 1];
                    return (
                      <SelectItem key={month} value={month}>{year} - {monthName}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    );

    return (
      <div className="space-y-6">
        {monthSelectorUI}

        {/* Account Selection */}
        <AccountSelector
          accounts={accounts}
          selectedAccounts={selectedAccountsForChart}
          onSelectionChange={setSelectedAccountsForChart}
          accountCategories={accountCategories}
          accountCategoryMapping={accountCategoryMapping}
          accountColors={accountColors}
        />

        {/* Balance Type Option */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Visa saldo som:</h4>
          <ToggleGroup 
            type="single" 
            value={balanceType} 
            onValueChange={(value) => value && setBalanceType(value as 'starting' | 'closing')}
            className="grid grid-cols-2 w-full max-w-md"
          >
            <ToggleGroupItem 
              value="starting" 
              className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Ingående
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="closing" 
              className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Slutsaldo
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Chart Display Options */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Visa även i grafen:</h4>
          <ToggleGroup 
            type="multiple" 
            value={[
              ...(showIndividualCostsOutsideBudget ? ['utgifter'] : []),
              ...(showSavingsSeparately ? ['sparande'] : []),
              ...(showEstimatedBudgetAmounts ? ['estimat'] : [])
            ]}
            onValueChange={(values) => {
              setShowIndividualCostsOutsideBudget(values.includes('utgifter'));
              setShowSavingsSeparately(values.includes('sparande'));
              setShowEstimatedBudgetAmounts(values.includes('estimat'));
            }}
            className="grid grid-cols-3 w-full max-w-lg"
          >
            <ToggleGroupItem 
              value="utgifter" 
              className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Utgifter
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="sparande" 
              className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Sparande
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="estimat" 
              className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Estimat
            </ToggleGroupItem>
          </ToggleGroup>
        </div>


        {/* Chart */}
        <div className="h-64 sm:h-80 lg:h-96 relative">
          {hasInvalidRange ? (
            <div className="flex items-center justify-center h-full text-red-500">
              <p>Felaktigt datumintervall: Slutmånad måste vara efter startmånad</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Ingen data att visa för det valda intervallet</p>
            </div>
          ) : (
            <div className="w-full h-64 sm:h-80 lg:h-96">
              <CustomLineChart
                data={chartData}
                accounts={selectedAccountsForChart}
                accountColors={accountColors}
                showEstimatedBudgetAmounts={showEstimatedBudgetAmounts}
                showIndividualCostsOutsideBudget={showIndividualCostsOutsideBudget}
                showSavingsSeparately={showSavingsSeparately}
                balanceType={balanceType}
                width={0} // Will be set dynamically
                height={window.innerWidth < 640 ? 256 : window.innerWidth < 1024 ? 320 : 384}
                margin={{ top: 20, right: window.innerWidth < 640 ? 15 : 30, bottom: 80, left: window.innerWidth < 640 ? 40 : 80 }}
                formatCurrency={formatCurrency}
              />
            </div>
          )}
        </div>

        {/* Chart Legend - Expandable */}
        <Collapsible open={isChartLegendExpanded} onOpenChange={setIsChartLegendExpanded}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex-1 justify-between p-3 h-auto">
                <span className="font-medium">Diagramförklaring</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isChartLegendExpanded ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <Button 
              onClick={() => {
                addDebugLog('[STORAGE CHECK] Checking localStorage now...');
                const data = localStorage.getItem('budgetCalculatorData');
                if (data) {
                  try {
                    const parsed = JSON.parse(data);
                    addDebugLog(`[STORAGE] Data found - structure: ${Object.keys(parsed).join(', ')}`);
                    if (parsed.budgetState?.historicalData) {
                      const months = Object.keys(parsed.budgetState.historicalData);
                      addDebugLog(`[STORAGE] Historical months: ${months.join(', ')}`);
                      if (parsed.budgetState.historicalData['2025-07']) {
                        const july = parsed.budgetState.historicalData['2025-07'];
                        addDebugLog(`[STORAGE] July accountBalances: ${JSON.stringify(july.accountBalances || {})}`);
                        addDebugLog(`[STORAGE] July accountBalancesSet: ${JSON.stringify(july.accountBalancesSet || {})}`);
                      }
                    }
                  } catch (e) {
                    addDebugLog(`[STORAGE] Error parsing data: ${e}`);
                  }
                } else {
                  addDebugLog('[STORAGE] No data found in localStorage');
                }
              }} 
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              Kolla Storage
            </Button>
          </div>
          <CollapsibleContent>
            <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-3">
              {/* Dynamic legend based on selected accounts and settings */}
              <div className="space-y-2">
                <p className="font-medium mb-2">Kontosaldon:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedAccountsForChart.map((account, index) => {
                    const color = accountColors[accounts.indexOf(account) % accountColors.length];
                    return (
                      <div key={account} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-0.5 rounded" 
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs">{account} (Historisk)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-0.5 rounded border-dashed border-2" 
                            style={{ borderColor: color }}
                          />
                          <span className="text-xs">{account} (Prognos)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Individual costs legend - only show if enabled */}
              {showIndividualCostsOutsideBudget && selectedAccountsForChart.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <h4 className="font-medium text-sm">Enskilda kostnader</h4>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full bg-red-500"
                    />
                    <Label className="text-sm">Enskilda kostnader (röd cirkel)</Label>
                  </div>
                </div>
              )}

              {/* Savings legend - only show if enabled */}
              {showSavingsSeparately && selectedAccountsForChart.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <h4 className="font-medium text-sm">Sparande</h4>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full bg-green-500"
                    />
                    <Label className="text-sm">Sparande (grön cirkel)</Label>
                  </div>
                </div>
              )}

              {/* Estimated values legend - only show if enabled */}
              {showEstimatedBudgetAmounts && selectedAccountsForChart.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="font-medium mb-2">Estimerade budgetbelopp:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedAccountsForChart.map((account) => {
                      const color = accountColors[accounts.indexOf(account) % accountColors.length];
                      return (
                        <div key={`${account}-estimated`} className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <div 
                              className="w-3 h-0.5 rounded border-dashed border-2" 
                              style={{ borderColor: color }}
                            />
                            <div 
                              className="w-1 h-1 rounded-full border-2" 
                              style={{ borderColor: color, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-xs">{account} (Estimerat)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* General legend */}
              <div className="border-t pt-3">
                <p className="font-medium mb-2">Allmän förklaring:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-muted-foreground text-xs">
                  <div>• Heldragna linjer: Historiska data</div>
                  <div>• Streckade linjer: Prognoser</div>
                  <div>• Grön linje: Dagens datum</div>
                  <div>• Orange linje: 25:e i månaden</div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  const renderMonthSelector = () => {
    const currentMonth = new Date().toISOString().substr(0, 7); // YYYY-MM format
    const historicalMonths = Object.keys(historicalData)
      .filter(month => month < currentMonth) // Only historical months (before current)
      .sort((a, b) => b.localeCompare(a)); // Sort newest first
    
    // Always include current month first, then only historical months with data
    const allMonths = [currentMonth, ...historicalMonths];

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="month-selector">Välj månad:</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedSections(prev => ({ ...prev, editMonths: !prev.editMonths }))}
          >
            {expandedSections.editMonths ? 'Klar' : 'Hantera månader'}
          </Button>
        </div>
        
        <select
          id="month-selector"
          value={selectedHistoricalMonth}
          onChange={(e) => setSelectedHistoricalMonth(e.target.value)}
          className="w-full p-2 border rounded-md mb-4"
        >
          <option value="">Välj en månad...</option>
          {allMonths.map(month => (
            <option key={month} value={month}>
              {month} {month === currentMonth ? '(Nuvarande)' : ''}
            </option>
          ))}
        </select>
        
        {/* Always visible create month section */}
        <div className="mb-4 p-4 bg-muted rounded-lg">
          <Label htmlFor="new-month">Lägg till historisk månad:</Label>
          <div className="text-sm text-muted-foreground mt-1 mb-2">
            Kopierar värden från nuvarande månad
          </div>
          <div className="flex gap-2 mt-2">
            <input
              id="new-month"
              type="month"
              value={newHistoricalMonth}
              onChange={(e) => setNewHistoricalMonth(e.target.value)}
              max={currentMonth}
              className="flex-1 p-2 border rounded-md"
            />
            <Button
              onClick={() => {
                const currentMonth = new Date().toISOString().substr(0, 7);
                if (newHistoricalMonth && newHistoricalMonth < currentMonth && !historicalData[newHistoricalMonth]) {
                  // Always copy ALL values from current month data - check if current month exists in historical data first
                  const currentMonthData = historicalData[currentMonth];
                  const sourceData = currentMonthData 
                    ? {
                        // Copy all fields from current month's historical data
                        andreasSalary: currentMonthData.andreasSalary || andreasSalary,
                        andreasförsäkringskassan: currentMonthData.andreasförsäkringskassan || andreasförsäkringskassan,
                        andreasbarnbidrag: currentMonthData.andreasbarnbidrag || andreasbarnbidrag,
                        susannaSalary: currentMonthData.susannaSalary || susannaSalary,
                        susannaförsäkringskassan: currentMonthData.susannaförsäkringskassan || susannaförsäkringskassan,
                        susannabarnbidrag: currentMonthData.susannabarnbidrag || susannabarnbidrag,
                        costGroups: JSON.parse(JSON.stringify(currentMonthData.costGroups || [])),
                        savingsGroups: JSON.parse(JSON.stringify(currentMonthData.savingsGroups || [])),
                        dailyTransfer: currentMonthData.dailyTransfer || dailyTransfer,
                        weekendTransfer: currentMonthData.weekendTransfer || weekendTransfer
                      }
                    : {
                        // Use current form values if current month doesn't exist in historical data
                        andreasSalary,
                        andreasförsäkringskassan,
                        andreasbarnbidrag,
                        susannaSalary,
                        susannaförsäkringskassan,
                        susannabarnbidrag,
                        totalSalary: andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag,
                        costGroups: JSON.parse(JSON.stringify(costGroups)),
                        savingsGroups: JSON.parse(JSON.stringify(savingsGroups)),
                        dailyTransfer,
                        weekendTransfer,
                        customHolidays: JSON.parse(JSON.stringify(customHolidays))
                      };
                  
                  const newMonthData = {
                    ...sourceData,
                    month: newHistoricalMonth,
                    date: new Date().toISOString()
                  };
                  updateHistoricalDataSingle(newHistoricalMonth, newMonthData);
                  setNewHistoricalMonth('');
                }
              }}
              disabled={!newHistoricalMonth || newHistoricalMonth >= currentMonth || !!historicalData[newHistoricalMonth]}
              size="sm"
            >
              Lägg till
            </Button>
          </div>
        </div>
        
        {expandedSections.editMonths && renderHistoricalMonthsEditor()}
      </div>
    );
  };

  const renderHistoricalMonthsEditor = () => {
    const deleteMonth = (month: string) => {
      const newData = { ...historicalData };
      delete newData[month];
      updateHistoricalData(newData);
      if (selectedHistoricalMonth === month) {
        setSelectedHistoricalMonth('');
      }
    };
    
    return (
      <div className="mt-4 p-4 bg-muted rounded-lg">
        <div>
          <Label>Hantera sparade månader:</Label>
          <div className="mt-2 space-y-2">
            {[...availableMonths].sort((a, b) => b.localeCompare(a)).map(month => (
              <div key={month} className="flex items-center justify-between p-2 bg-background rounded border">
                <span>{month}</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMonth(month)}
                >
                  Ta bort
                </Button>
              </div>
            ))}
            {Object.keys(historicalData).length === 0 && (
              <p className="text-muted-foreground text-sm">Inga sparade månader.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHistoricalData = () => {
    if (!selectedHistoricalMonth || !historicalData[selectedHistoricalMonth]) {
      return null;
    }

    const data = historicalData[selectedHistoricalMonth];
    
    // Calculate totals from groups since MonthData doesn't store calculated results
    const totalCosts = (data.costGroups?.reduce((sum: number, group: any) => {
      const subCategoriesTotal = group.subCategories?.reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
      return sum + subCategoriesTotal;
    }, 0) || 0);
    
    const totalSavings = (data.savingsGroups?.reduce((sum: number, group: any) => sum + group.amount, 0) || 0);
    
    // Calculate total income from salary fields  
    const totalIncome = (data.andreasSalary || 0) + (data.andreasförsäkringskassan || 0) + (data.andreasbarnbidrag || 0) +
                       (data.susannaSalary || 0) + (data.susannaförsäkringskassan || 0) + (data.susannabarnbidrag || 0);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Inkomster ({selectedHistoricalMonth})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Andreas lön:</span>
                <span className="font-medium">{formatCurrency(data.andreasSalary || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Andreas försäkringskassan:</span>
                <span className="font-medium">{formatCurrency(data.andreasförsäkringskassan || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Andreas barnbidrag:</span>
                <span className="font-medium">{formatCurrency(data.andreasbarnbidrag || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Susanna lön:</span>
                <span className="font-medium">{formatCurrency(data.susannaSalary || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Susanna försäkringskassan:</span>
                <span className="font-medium">{formatCurrency(data.susannaförsäkringskassan || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Susanna barnbidrag:</span>
                <span className="font-medium">{formatCurrency(data.susannabarnbidrag || 0)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Total inkomst:</span>
                <span>{formatCurrency(totalIncome)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kostnader & Sparande ({selectedHistoricalMonth})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="mb-4">
                <h4 className="font-medium mb-2">Kostnader:</h4>
                {data.costGroups?.map((group: any) => {
                  const groupTotal = group.subCategories?.reduce((sum: number, sub: any) => sum + sub.amount, 0) || 0;
                  return (
                    <div key={group.id}>
                      <div className="flex justify-between">
                        <span>{group.name}:</span>
                        <span className="font-medium">{formatCurrency(groupTotal)}</span>
                      </div>
                      {group.subCategories?.map((sub: any) => (
                        <div key={sub.id} className="ml-4 flex justify-between text-sm text-muted-foreground">
                          <span>• {sub.name}:</span>
                          <span>{formatCurrency(sub.amount)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Totala kostnader:</span>
                  <span>{formatCurrency(totalCosts)}</span>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-medium mb-2">Sparande:</h4>
                {data.savingsGroups?.map((group: any) => (
                  <div key={group.id} className="flex justify-between">
                    <span>{group.name}:</span>
                    <span className="font-medium">{formatCurrency(group.amount)}</span>
                  </div>
                ))}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Totalt sparande:</span>
                <span>{formatCurrency(totalSavings)}</span>
              </div>
              </div>

            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between">
                <span>Total daglig budget:</span>
                <span className="font-medium">{formatCurrency((data.dailyTransfer || 0) * 30)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Kvar efter kostnader, sparande och daglig budget:</span>
                <span>{formatCurrency(totalIncome - totalCosts - totalSavings - ((data.dailyTransfer || 0) * 30))}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium mb-2">Individuella Andelar:</h4>
              <div className="flex justify-between">
                <span>Andreas andel:</span>
                <span className="font-medium">{formatCurrency(results?.andreasShare || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Susannas andel:</span>
                <span className="font-medium">{formatCurrency(results?.susannaShare || 0)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>Andreas andel: {(results?.andreasPercentage || 0).toFixed(1)}%</span>
                <span>Susannas andel: {(results?.susannaPercentage || 0).toFixed(1)}%</span>
              </div>
            </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background p-4">
      {loadingOverlay}
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Familjens Budgetkalkylator
          </h1>
          <p className="text-muted-foreground text-lg">
            Beräkna era gemensamma utgifter och individuella bidrag
          </p>
        </div>


        {/* Month Selector */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className={`text-xl ${monthFinalBalances[selectedBudgetMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`] === true ? 'text-foreground' : 'text-red-500'}`}>
              Aktuell månad
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Current Month Display with Navigation and Dropdown */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="lg"
                onClick={canNavigatePrevious() ? navigateToPreviousMonth : () => {
                  setCreateMonthDirection('previous');
                  setIsCreateMonthDialogOpen(true);
                }}
                className={`p-3 h-12 w-12 text-primary hover:text-primary/80`}
              >
                {canNavigatePrevious() ? (
                  <ChevronLeft className="h-6 w-6" />
                ) : (
                  <Plus className="h-6 w-6" />
                )}
              </Button>
              
              <Select 
                value={selectedBudgetMonth} 
                onValueChange={(value) => {
                  console.log(`🔄 === DROPDOWN MONTH CHANGE ===`);
                  console.log(`📅 Switching from ${selectedBudgetMonth} to ${value}`);
                  
                  // Use the same logic as navigation buttons to ensure consistency
                  handleBudgetMonthChange(value);
                  
                  console.log(`🔄 === END DROPDOWN MONTH CHANGE ===`);
                }}
              >
                <SelectTrigger className="w-auto min-w-[200px] border-none bg-transparent text-xl font-semibold text-primary hover:bg-muted/50 transition-colors text-center justify-center">
                  <SelectValue>
                    {(() => {
                      const monthNames = [
                        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                      ];
                      
                      if (selectedBudgetMonth) {
                        const [year, month] = selectedBudgetMonth.split('-');
                        const monthIndex = parseInt(month) - 1;
                        return `${monthNames[monthIndex]} ${year}`;
                      } else {
                        const currentDate = new Date();
                        return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
                      }
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const monthNames = [
                      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                    ];
                    
                    // Generate options for current month and all historical months using centralized availableMonths
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
                onClick={canNavigateNext() ? navigateToNextMonth : () => {
                  setCreateMonthDirection('next');
                  setIsCreateMonthDialogOpen(true);
                }}
                className={`p-3 h-12 w-12 text-primary hover:text-primary/80`}
              >
                {canNavigateNext() ? (
                  <ChevronRight className="h-6 w-6" />
                ) : (
                  <Plus className="h-6 w-6" />
                )}
              </Button>
            </div>
            
            {/* Save Current Month Button */}
            {isAdminMode && (
              <div className="flex justify-center mt-4">
                <Button 
                  onClick={handleSaveCurrentMonthAsHistorical} 
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Spara Denna Månad
                </Button>
              </div>
            )}
            
            {/* Debug Toggle Button */}
            {isAdminMode && (
              <div className="flex justify-center mt-2 gap-2">
                <Button 
                  onClick={() => setShowDebugPanel(!showDebugPanel)} 
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  {showDebugPanel ? 'Dölj' : 'Visa'} Debug Loggar
                </Button>
                <Button 
                  onClick={() => addDebugLog('[MANUAL] Visa alla tidigare loggar från start')} 
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  Uppdatera Loggar
                </Button>
              </div>
            )}
            
            {/* Debug Panel */}
            {isAdminMode && showDebugPanel && (
              <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Debug Loggar:</h4>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {globalDebugLogs.length === 0 ? (
                    <p className="text-xs text-gray-500">Inga loggar än...</p>
                  ) : (
                    globalDebugLogs.map((log, index) => (
                      <p key={index} className="text-xs font-mono break-all">{log}</p>
                    ))
                  )}
                </div>
                <Button 
                  onClick={() => mobileDebugLogger.clearLogs()} 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 text-xs"
                >
                  Rensa Loggar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Hidden TabsList for programmatic navigation only */}
          <TabsList className="hidden">
            <TabsTrigger value="inkomster">Inkomster och Utgifter</TabsTrigger>
            <TabsTrigger value="sammanstallning">Sammanställning</TabsTrigger>
            {(() => {
              // Show Överföring tab for current month until 24th, then for next month
              const currentDate = new Date();
              const currentDay = currentDate.getDate();
              
              let targetMonthKey;
              if (currentDay <= 24) {
                // Before/on 24th: show for current month
                targetMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
              } else {
                // After 24th: show for next month
                const nextMonth = currentDate.getMonth() + 1;
                const nextYear = nextMonth === 12 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
                const adjustedNextMonth = nextMonth === 12 ? 1 : nextMonth + 1;
                targetMonthKey = `${nextYear}-${String(adjustedNextMonth).padStart(2, '0')}`;
              }
              
              const shouldShowOverforingTab = selectedBudgetMonth === targetMonthKey;
              return shouldShowOverforingTab ? (
                <TabsTrigger value="overforing">Överföring</TabsTrigger>
              ) : null;
            })()}
            <TabsTrigger value="egen-budget">Egen Budget</TabsTrigger>
            <TabsTrigger value="historia">Historia</TabsTrigger>
            <TabsTrigger value="sparmal">Sparmål</TabsTrigger>
            <TabsTrigger value="transaktioner">Läs in transaktioner</TabsTrigger>
            <TabsTrigger value="installningar">Inställningar</TabsTrigger>
          </TabsList>

          {/* Current page title */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-center">
              {activeTab === 'inkomster' && (() => {
                const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                                  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
                
                if (selectedBudgetMonth) {
                  const [year, month] = selectedBudgetMonth.split('-');
                  const monthIndex = parseInt(month) - 1;
                  return `Min Månadsbudget - ${monthNames[monthIndex]} ${year}`;
                } else {
                  const currentDate = new Date();
                  const currentMonth = monthNames[currentDate.getMonth()];
                  const currentYear = currentDate.getFullYear();
                  return `Min Månadsbudget - ${currentMonth} ${currentYear}`;
                }
              })()}
              {activeTab === 'sammanstallning' && 'Sammanställning'}
              {activeTab === 'overforing' && 'Överföring'}
              {activeTab === 'egen-budget' && 'Egen Budget'}
              {activeTab === 'historia' && 'Historia'}
              {activeTab === 'sparmal' && 'Sparmål'}
              {activeTab === 'transaktioner' && 'Läs in transaktioner'}
              {activeTab === 'installningar' && 'Inställningar'}
            </h1>
          </div>

          {/* Tab 1: Inkomster och Utgifter */}
          <TabsContent value="inkomster" className="mt-0">
            <div className={`relative overflow-hidden ${
              isAnimating && previousTab === "inkomster" 
                ? swipeDirection === "left" 
                  ? "animate-slide-out-left" 
                  : "animate-slide-out-right"
                : isAnimating && activeTab === "inkomster"
                  ? swipeDirection === "left"
                    ? "animate-slide-in-right"
                    : "animate-slide-in-left"
                  : ""
            }`}>
              <div className="space-y-6">
              {/* Intäkter Section */}
              <Card className="shadow-lg border-0 bg-green-50/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('incomeDetails')}>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-green-800">
                        <DollarSign className="h-5 w-5" />
                        Intäkter
                      </CardTitle>
                      <CardDescription className="text-green-700">
                        {formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag)}
                      </CardDescription>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform text-green-800 ${expandedSections.incomeDetails ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
                {expandedSections.incomeDetails && (
                  <CardContent className="space-y-6 bg-green-50/30">
                    {/* First User Income Section */}
                    <div className="p-4 bg-green-100/50 rounded-lg border border-green-200">
                      <h3 className="text-lg font-semibold mb-3 text-green-800">{userName1} Inkomst</h3>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="andreas" className="text-green-700">Lön</Label>
                           <Input
                            id="andreas"
                            type="number"
                            placeholder="Ange månadslön"
                            value={andreasSalary === 0 ? '0' : (andreasSalary || '')}
                            onChange={(e) => {
                              setAndreasSalary(Number(e.target.value));
                              const currentDate = new Date();
                              const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                              resetMonthFinalBalancesFlag(currentMonthKey);
                            }}
                            className="text-lg bg-white/70"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="andreas-forsakringskassan" className="text-green-700">Försäkringskassan</Label>
                           <Input
                            id="andreas-forsakringskassan"
                            type="number"
                            placeholder="Ange försäkringskassan"
                            value={andreasförsäkringskassan === 0 ? '0' : (andreasförsäkringskassan || '')}
                            onChange={(e) => setAndreasförsäkringskassan(Number(e.target.value))}
                            className="text-lg bg-white/70"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="andreas-barnbidrag" className="text-green-700">Barnbidrag</Label>
                           <Input
                            id="andreas-barnbidrag"
                            type="number"
                            placeholder="Ange barnbidrag"
                            value={andreasbarnbidrag === 0 ? '0' : (andreasbarnbidrag || '')}
                            onChange={(e) => setAndreasbarnbidrag(Number(e.target.value))}
                            className="text-lg bg-white/70"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Second User Income Section */}
                    <div className="p-4 bg-green-100/50 rounded-lg border border-green-200">
                      <h3 className="text-lg font-semibold mb-3 text-green-800">{userName2} Inkomst</h3>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="susanna" className="text-green-700">Lön</Label>
                           <Input
                            id="susanna"
                            type="number"
                            placeholder="Ange månadslön"
                            value={susannaSalary === 0 ? '0' : (susannaSalary || '')}
                            onChange={(e) => {
                              setSusannaSalary(Number(e.target.value));
                              const currentDate = new Date();
                              const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                              resetMonthFinalBalancesFlag(currentMonthKey);
                            }}
                            className="text-lg bg-white/70"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="susanna-forsakringskassan" className="text-green-700">Försäkringskassan</Label>
                           <Input
                            id="susanna-forsakringskassan"
                            type="number"
                            placeholder="Ange försäkringskassan"
                            value={susannaförsäkringskassan === 0 ? '0' : (susannaförsäkringskassan || '')}
                            onChange={(e) => setSusannaförsäkringskassan(Number(e.target.value))}
                            className="text-lg bg-white/70"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="susanna-barnbidrag" className="text-green-700">Barnbidrag</Label>
                           <Input
                            id="susanna-barnbidrag"
                            type="number"
                            placeholder="Ange barnbidrag"
                            value={susannabarnbidrag === 0 ? '0' : (susannabarnbidrag || '')}
                            onChange={(e) => setSusannabarnbidrag(Number(e.target.value))}
                            className="text-lg bg-white/70"
                          />
                        </div>
                      </div>
                    </div>

                  </CardContent>
                )}
              </Card>

              {/* Kontosaldon Section */}
              <Card className="shadow-lg border-0 bg-blue-50/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('accountBalances')}>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-blue-800">
                        <TrendingUp className="h-5 w-5" />
                        Kontosaldon
                      </CardTitle>
                      <CardDescription className="text-blue-700">
                        {(() => {
                          const total = accounts.reduce((sum, account) => {
                            return sum + getAccountBalanceWithFallback(account);
                          }, 0);
                          return formatCurrency(total);
                        })()}
                      </CardDescription>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform text-blue-800 ${expandedSections.accountBalances ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
                {expandedSections.accountBalances && (
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-blue-100/50 rounded-lg border border-blue-200">
                      <h3 className="text-lg font-semibold mb-4 text-blue-800">
                        Kontosaldon för {getPreviousMonthInfo().monthName} {getPreviousMonthInfo().year}
                      </h3>
                      <p className="text-sm text-blue-700 mb-4">
                        Ange saldot på kontona den 24:e föregående månad, innan kontona fylls på med nya pengar den 25:e.
                      </p>
                      
                        <div className="space-y-6">
                          {(() => {
                             const accountsByCategory = getAccountsByCategory();
                             const currentDate = new Date();
                             const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                             const isHistorical = selectedBudgetMonth < currentMonthKey;
                             const isCurrent = selectedBudgetMonth === currentMonthKey;
                             
                             // Check if any accounts have filled-in balances for current month
                             const hasFilledBalances = isCurrent && accounts.some(account => {
                               const balance = accountBalances[account];
                               return balance && balance !== 0;
                             });
                             
                             const shouldShowEstimated = !isHistorical && (!isCurrent || !hasFilledBalances);
                             
                             return Object.entries(accountsByCategory).map(([category, categoryAccounts]) => {
                               // Calculate category total
                               let categoryTotal = 0;
                               let isEstimated = false;
                               
                               if (shouldShowEstimated) {
                                 // Use estimated balances
                                 const freshBalances = (window as any).__freshFinalBalances;
                                  const estimatedResult = getEstimatedOpeningBalances(freshBalances);
                                 categoryTotal = categoryAccounts.reduce((sum, account) => {
                                   return sum + (estimatedResult?.[account] || 0);
                                 }, 0);
                                 isEstimated = true;
                               } else {
                                 // Use actual balances
                                 categoryTotal = categoryAccounts.reduce((sum, account) => {
                                   return sum + (accountBalances[account] || 0);
                                 }, 0);
                               }
                               
                               return (
                                 <div key={category} className="space-y-4">
                                   {/* Category Header with Summary */}
                                   <div className="pb-2 border-b border-blue-300">
                                     <h4 className="text-lg font-semibold text-blue-800">{category}</h4>
                                     <div className="text-blue-700 font-medium">
                                       {isEstimated ? 'Estimerat: ' : ''}{formatCurrency(categoryTotal)}
                                     </div>
                                   </div>
                                   
                                   {/* Expandable accounts in this category */}
                                   <Collapsible 
                                     open={expandedAccounts[category]} 
                                     onOpenChange={(open) => setExpandedAccounts(prev => ({ ...prev, [category]: open }))}
                                   >
                                     <CollapsibleTrigger asChild>
                                       <Button 
                                         variant="ghost" 
                                         size="sm" 
                                         className="w-full justify-between text-blue-700 hover:bg-blue-100"
                                       >
                                         <span>Visa konton ({categoryAccounts.length})</span>
                                         <ChevronDown className={`h-4 w-4 transition-transform ${expandedAccounts[category] ? 'rotate-180' : ''}`} />
                                       </Button>
                                     </CollapsibleTrigger>
                                     <CollapsibleContent className="space-y-3 mt-3">
                                        {categoryAccounts.map(account => {
                                            // CRITICAL FIX: Read directly from central state, not via helper function
                                            const currentBalance = accountBalances[account] || 0;
                             const freshBalances = (window as any).__freshFinalBalances;
                             const estimatedResult = getEstimatedAccountBalances(freshBalances);
                             const estimatedBalance = estimatedResult?.[account] || 0;
                             
                               // Get OPENING balance for "Estimerad ingående balans" display  
                               // Use propagated estimated start balances directly from historical data
                               const currentMonthData = historicalData[selectedBudgetMonth || ''];
                               const estimatedOpeningBalance = currentMonthData?.accountEstimatedStartBalances?.[account] || 0;
                              
                              // Debug for October Löpande specifically
                               // Debug message with new variable  
                               if (selectedBudgetMonth?.includes('2025-10') && account === 'Löpande') {
                                 console.log(`🔥 OCTOBER LÖPANDE DEBUG:`);
                                 console.log(`   - estimatedOpeningBalance for Löpande:`, estimatedOpeningBalance);
                                 console.log(`   - This should be 5500, not 0!`);
                                 console.log(`   - selectedBudgetMonth:`, selectedBudgetMonth);
                               }
                            
                            // CRITICAL DEBUGGING - Check where wrong calculation happens
                            if (currentBalance === 0 && account === 'Löpande') {
                              console.log(`🚨🚨🚨 DEBUGGING CALC.KONTOSALDO ISSUE 🚨🚨🚨`);
                              console.log(`📅 selectedBudgetMonth: ${selectedBudgetMonth}`);
                              console.log(`🏠 account: ${account}`);
                              console.log(`💰 currentBalance (Faktiskt): ${currentBalance}`);
                              console.log(`💰 estimatedBalance (Estimerad ingående): ${estimatedBalance}`);
                              console.log(`📊 accountBalancesSet[${account}]: ${accountBalancesSet[account]}`);
                            }
                                        
                                         return (
                                           <div key={account} className="bg-white rounded border overflow-hidden ml-4">
                                             <div className="p-3 bg-blue-50 border-b">
                                               <h5 className="font-semibold text-blue-800">{account}</h5>
                                             </div>
                                             
                                             <div className="p-3 space-y-3">
                                                {/* Faktiskt kontosaldo */}
                                                <div className="flex justify-between items-center">
                                                  <span className="text-sm font-medium text-blue-700">Faktiskt kontosaldo</span>
                                                  <div className="flex items-center gap-2">
                                                     <Input
                                                       type="text"
                                                       defaultValue={(() => {
                                                         const value = accountBalancesSet[account] 
                                                           ? currentBalance.toString() 
                                                           : (currentBalance === 0 ? "Ej ifyllt" : currentBalance.toString());
                                                         console.log(`🔍 [INPUT VALUE] ${account}: currentBalance=${currentBalance}, accountBalancesSet=${accountBalancesSet[account]}, defaultValue="${value}"`);
                                                         return value;
                                                       })()}
                                                       key={`${account}-${currentBalance}-${accountBalancesSet[account]}`}
                                                        onBlur={(e) => {
                                                          console.log(`🔄 onBlur triggered for ${account} with value: ${e.target.value}`);
                                                          const value = e.target.value;
                                                           if (value === "Ej ifyllt" || value === "") {
                                                             console.log(`🔄 onBlur: Unsetting ${account} balance (Ej ifyllt/empty)`);
                                                             handleAccountBalanceUnset(account);
                                                           } else {
                                                            const numValue = Number(value);
                                                            console.log(`🔄 onBlur: Parsed number value: ${numValue}, isNaN: ${isNaN(numValue)}`);
                                                            if (!isNaN(numValue)) {
                                                              console.log(`🔄 onBlur: About to call handleAccountBalanceUpdate(${account}, ${numValue})`);
                                                              handleAccountBalanceUpdate(account, numValue);
                                                            }
                                                          }
                                                        }}
                                                        onFocus={(e) => {
                                                          if (e.target.value === "Ej ifyllt") {
                                                            // Clear the field for easy editing
                                                            e.target.value = "";
                                                          }
                                                        }}
                                                        className="w-32 text-right"
                                                        placeholder="Ej ifyllt"
                                                     />
                                                    <span className="text-sm text-blue-700 min-w-8">kr</span>
                                                  </div>
                                                </div>
                                               
                                                 {/* Estimerat slutsaldo */}
                                                 {estimatedResult && (
                                                  <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                      <span className="text-sm font-medium text-orange-700">Estimerad ingående balans</span>
                                                      <div className="flex items-center gap-2">
                                                        <span className="w-32 text-right text-sm text-orange-600">{formatCurrency(estimatedOpeningBalance)}</span>
                                                        <span className="text-sm text-orange-600 min-w-8">kr</span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}

                                                 {/* Calc.Kontosaldo */}
                                                   {(() => {
                                                      const hasActualBalance = accountBalancesSet[account] === true;
                                                      // FIXED: When "Ej ifyllt" (hasActualBalance = false), use estimated balance
                                                      const calcBalance = hasActualBalance ? currentBalance : estimatedBalance;
                                                      const isUsingEstimated = !hasActualBalance; // Using estimated when not filled
                                                    
                                                    // CRITICAL DEBUG - Check if this is the wrong calculation
                                                    if (currentBalance === 0 && account === 'Löpande') {
                                                      console.log(`🚨🚨🚨 CALC.KONTOSALDO CALCULATION DEBUG 🚨🚨🚨`);
                                                      console.log(`📅 selectedBudgetMonth: ${selectedBudgetMonth}`);
                                                      console.log(`🏠 account: ${account}`);
                                                      console.log(`💰 currentBalance (Faktiskt): ${currentBalance}`);
                                                      console.log(`💰 estimatedBalance (Estimerad): ${estimatedBalance}`);
                                                      console.log(`📊 accountBalancesSet[${account}]: ${accountBalancesSet[account]}`);
                                                      console.log(`🎯 hasActualBalance: ${hasActualBalance}`);
                                                      console.log(`🎯 calcBalance (FINAL RESULT): ${calcBalance}`);
                                                      console.log(`🎯 isUsingEstimated: ${isUsingEstimated}`);
                                                      
                                                      if (calcBalance !== 0) {
                                                        console.log(`🔥🔥🔥 ERROR: calcBalance should be 0 but it's ${calcBalance}! 🔥🔥🔥`);
                                                        console.log(`🔍 This means hasActualBalance is false when it should be true`);
                                                      }
                                                    }
                                                   
                                                    return (
                                                      isAdminMode && (
                                                        <div className="space-y-2 pt-2 border-t border-gray-200">
                                                          <div className="flex justify-between items-center">
                                                            <span className="text-sm font-medium text-green-700">Calc.Kontosaldo</span>
                                                            <div className="flex items-center gap-2">
                                                              <span className="w-32 text-right text-sm text-green-600">{formatCurrency(calcBalance || 0)}</span>
                                                              <span className="text-sm text-green-600 min-w-8">kr</span>
                                                            </div>
                                                          </div>
                                                          
                                                           {/* Calc.Descr */}
                                                           <div className="flex justify-between items-center">
                                                             <span className="text-sm font-medium text-green-700">Calc.Descr</span>
                                                             <div className="flex items-center gap-2">
                                                               <span className="w-32 text-right text-sm text-green-600">
                                                                 {isUsingEstimated ? "(Est)" : ""}
                                                               </span>
                                                               <span className="text-sm text-green-600 min-w-8"></span>
                                                             </div>
                                                           </div>
                                                           
                                                           {/* Calc.diff */}
                                                           <div className="flex justify-between items-center">
                                                             <span className="text-sm font-medium text-green-700">Calc.diff</span>
                                                             <div className="flex items-center gap-2">
                                                               <span className="w-32 text-right text-sm text-green-600">
                                                                 {(() => {
                                                                   // If "Faktiskt kontosaldo" has a value (not "Ej ifyllt"):
                                                                   // Calc.diff = Faktiskt kontosaldo - Estimerat Slutsaldo
                                                                   // If "Faktiskt kontosaldo" is "Ej ifyllt": Calc.diff = 0
                                                                   if (hasActualBalance) {
                                                                     const diff = currentBalance - estimatedBalance;
                                                                     return formatCurrency(diff);
                                                                   } else {
                                                                     return formatCurrency(0);
                                                                   }
                                                                 })()}
                                                               </span>
                                                               <span className="text-sm text-green-600 min-w-8">kr</span>
                                                             </div>
                                                            </div>
                                                            
                                                            {/* Calc.Est */}
                                                            <div className="flex justify-between items-center">
                                                              <span className="text-sm font-medium text-green-700">Calc.Est</span>
                                                              <div className="flex items-center gap-2">
                                                                <span className="w-32 text-right text-sm text-green-600">
                                                                  {(() => {
                                                                    // Get previous month's ending balance for this account
                                                                    const prevMonthInfo = getPreviousMonthInfo();
                                                                    const prevMonthData = historicalData[prevMonthInfo.monthKey];
                                                                    
                                                                     if (prevMonthData && prevMonthData.accountEstimatedFinalBalances && prevMonthData.accountEstimatedFinalBalances[account] !== undefined) {
                                                                       const prevEndingBalance = prevMonthData.accountEstimatedFinalBalances[account];
                                                                      return formatCurrency(prevEndingBalance);
                                                                    }
                                                                    
                                                                    // Fallback to formatted ending balance key if available
                                                                    if (prevMonthData && prevMonthData.accountEndingBalances) {
                                                                      const [prevYear, prevMonth] = prevMonthInfo.monthKey.split('-');
                                                                      const endingBalanceKey = `${account}.${prevYear}.${prevMonth}.Endbalance`;
                                                                      const prevEndingBalance = prevMonthData.accountEndingBalances[endingBalanceKey];
                                                                      if (prevEndingBalance !== undefined) {
                                                                        return formatCurrency(prevEndingBalance);
                                                                      }
                                                                    }
                                                                    
                                                                    return formatCurrency(0);
                                                                  })()}
                                                                </span>
                                                                <span className="text-sm text-green-600 min-w-8">kr</span>
                                                              </div>
                                                            </div>
                                                          </div>
                                                      )
                                                     );
                                                 })()}
                                             </div>
                                           </div>
                                         );
                                       })}
                                     </CollapsibleContent>
                                   </Collapsible>
                                 </div>
                               );
                             });
                            })()}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-blue-800">Totalt saldo:</span>
                          <span className="font-bold text-lg text-blue-800">
                            {(() => {
                              const total = accounts.reduce((sum, account) => {
                                return sum + getAccountBalanceWithFallback(account);
                              }, 0);
                              return formatCurrency(total);
                            })()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Account Management Section */}
                      <div className="p-4 bg-blue-100/50 rounded-lg border border-blue-200 mt-4">
                        <div className="flex justify-center mb-4">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setIsEditingAccounts(!isEditingAccounts)}
                            className="border-blue-300 text-blue-800 hover:bg-blue-200"
                          >
                            {isEditingAccounts ? 'Stäng' : 'Redigera konton'}
                          </Button>
                        </div>
                       
                       {isEditingAccounts && (
                         <div className="space-y-4">
                           <div className="flex gap-2">
                             <Input
                               placeholder="Nytt kontonamn"
                               value={newAccountName}
                               onChange={(e) => setNewAccountName(e.target.value)}
                               className="flex-1"
                             />
                             <Button onClick={addAccount} disabled={!newAccountName.trim()}>
                               <Plus className="h-4 w-4" />
                             </Button>
                           </div>
                          
                           <div className="space-y-2">
                              {accounts.map((account, index) => {
                                const accountName = typeof account === 'string' ? account : (account as any).name || '';
                                return (
                                  <div key={accountName} className="flex justify-between items-center p-2 bg-white rounded border">
                                    <span className="font-medium">{accountName}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeAccount(accountName)}
                                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                );
                              })}
                           </div>
                         </div>
                       )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Budgetkategorier Section */}
              <Card className="shadow-lg border-0 bg-red-50/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('budgetCategories')}>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-red-800">
                        <Users className="h-5 w-5" />
                        Budgetkategorier
                      </CardTitle>
                      <CardDescription className="text-red-700">
                        {formatCurrency(costGroups.reduce((sum, group) => {
                          const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                          return sum + subCategoriesTotal;
                        }, 0) + (results ? results.totalDailyBudget : 0) + savingsGroups.reduce((sum, group) => sum + group.amount, 0))}
                      </CardDescription>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform text-red-800 ${expandedSections.budgetCategories ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
                {expandedSections.budgetCategories && (
                  <CardContent className="space-y-6">
                    {/* Budget Templates Section */}
                    {Object.keys(budgetTemplates).length > 0 && (
                      <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-primary">Kopiera Budgetmall</h4>
                            <p className="text-sm text-muted-foreground">Välj en budgetmall att kopiera till den valda månaden</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSection('budgetTemplates')}
                          >
                            {expandedSections.budgetTemplates ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                         {expandedSections.budgetTemplates && (
                          <div className="space-y-4">
                            {/* Template Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="template-select">Välj budgetmall</Label>
                                <Select
                                  value={selectedTemplateToCopy}
                                  onValueChange={setSelectedTemplateToCopy}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Välj en budgetmall" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.keys(budgetTemplates).sort().map(templateName => (
                                      <SelectItem key={templateName} value={templateName}>
                                        {templateName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="target-month">Måltminatid</Label>
                                <div className="text-sm p-2 bg-muted rounded border">
                                  {(() => {
                                    const monthNames = [
                                      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                                      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                                    ];
                                    
                                    if (selectedBudgetMonth) {
                                      const [year, month] = selectedBudgetMonth.split('-');
                                      const monthIndex = parseInt(month) - 1;
                                      return `${monthNames[monthIndex]} ${year}`;
                                    } else {
                                      const currentDate = new Date();
                                      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
                                    }
                                  })()}
                                </div>
                              </div>
                            </div>
                            
                            {/* Template Details */}
                            {selectedTemplateToCopy && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id="show-details"
                                    checked={showTemplateDetails}
                                    onCheckedChange={(checked) => setShowTemplateDetails(checked as boolean)}
                                  />
                                  <Label htmlFor="show-details" className="text-sm">Visa malldetaljer</Label>
                                </div>
                                
                                {showTemplateDetails && (
                                  <div className="p-3 bg-muted/50 rounded border">
                                    <h5 className="font-medium mb-2">Detaljer för "{selectedTemplateToCopy}"</h5>
                                    {(() => {
                                      const template = budgetTemplates[selectedTemplateToCopy];
                                      if (!template) return null;
                                      
                                      const totalCosts = template.costGroups?.reduce((sum: number, group: any) => {
                                        const subTotal = group.subCategories?.reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
                                        return sum + subTotal;
                                      }, 0) || 0;
                                      
                                      const totalSavings = template.savingsGroups?.reduce((sum: number, group: any) => sum + group.amount, 0) || 0;
                                      
                                      return (
                                        <div className="space-y-2 text-sm">
                                           <div className="space-y-3">
                                             <div className="grid grid-cols-2 gap-4">
                                               <div>
                                                 <span className="font-medium">Totala kostnader:</span>
                                                 <div className="text-destructive">{formatCurrency(totalCosts)}</div>
                                               </div>
                                               <div>
                                                 <span className="font-medium">Total daglig budget:</span>
                                                 <div className="text-destructive">
                                                   {(() => {
                                                     if (!template.dailyTransfer || !template.weekendTransfer) return '0 kr';
                                                     const currentDate = new Date();
                                                     let selectedYear = currentDate.getFullYear();
                                                     let selectedMonth = currentDate.getMonth();
                                                     
                                                     if (selectedBudgetMonth) {
                                                       const [yearStr, monthStr] = selectedBudgetMonth.split('-');
                                                       selectedYear = parseInt(yearStr);
                                                       selectedMonth = parseInt(monthStr) - 1;
                                                     }
                                                     
                                                     const { weekdayCount, fridayCount } = calculateDaysForMonth(selectedYear, selectedMonth);
                                                     const totalDailyBudget = template.dailyTransfer * weekdayCount + template.weekendTransfer * fridayCount;
                                                     return formatCurrency(totalDailyBudget);
                                                   })()}
                                                 </div>
                                               </div>
                                             </div>
                                             <div>
                                               <span className="font-medium">Totalt sparande:</span>
                                               <div className="text-green-600">{formatCurrency(totalSavings)}</div>
                                             </div>
                                           </div>
                                          
                                          {template.costGroups && template.costGroups.length > 0 && (
                                            <div>
                                              <span className="font-medium">Kostnadskategorier:</span>
                                              <ul className="ml-4 mt-1 space-y-1">
                                                {template.costGroups.map((group: any) => {
                                                  const groupTotal = group.subCategories?.reduce((sum: number, sub: any) => sum + sub.amount, 0) || 0;
                                                  return (
                                                    <li key={group.id} className="text-xs">
                                                      <div className="font-medium">{group.name}: {formatCurrency(groupTotal)}</div>
                                                      {group.subCategories && group.subCategories.length > 0 && (
                                                        <ul className="ml-4 mt-1 space-y-1">
                                                          {group.subCategories.map((sub: any, index: number) => (
                                                            <li key={index} className="text-xs text-muted-foreground">
                                                              • {sub.name}: {formatCurrency(sub.amount)}{sub.account ? ` (${sub.account})` : ''}
                                                            </li>
                                                          ))}
                                                        </ul>
                                                      )}
                                                    </li>
                                                  );
                                                })}
                                              </ul>
                                            </div>
                                          )}
                                          
                                          {template.savingsGroups && template.savingsGroups.length > 0 && (
                                            <div>
                                              <span className="font-medium">Sparandekategorier:</span>
                                              <ul className="ml-4 mt-1 space-y-1">
                                                {template.savingsGroups.map((group: any) => (
                                                  <li key={group.id} className="text-xs">
                                                    {group.name}: {formatCurrency(group.amount)}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                          
                                          {/* Dagliga Överföringar Section */}
                                          {(template.dailyTransfer || template.weekendTransfer) && (() => {
                                            const currentDate = new Date();
                                            let selectedYear = currentDate.getFullYear();
                                            let selectedMonth = currentDate.getMonth();
                                            
                                            if (selectedBudgetMonth) {
                                              const [yearStr, monthStr] = selectedBudgetMonth.split('-');
                                              selectedYear = parseInt(yearStr);
                                              selectedMonth = parseInt(monthStr) - 1;
                                            }
                                            
                                            const { weekdayCount, fridayCount } = calculateDaysForMonth(selectedYear, selectedMonth);
                                            const totalDailyBudget = (template.dailyTransfer || 0) * weekdayCount + (template.weekendTransfer || 0) * fridayCount;
                                            
                                            return (
                                              <div>
                                                <span className="font-medium">Dagliga Överföringar:</span>
                                                <div className="ml-4 mt-1 space-y-1 text-xs">
                                                  <div className="font-medium">
                                                    Total daglig budget: {formatCurrency(totalDailyBudget)}
                                                  </div>
                                                  <ul className="ml-4 space-y-1">
                                                    <li className="text-xs text-muted-foreground">
                                                      • Vardagar: {weekdayCount} × {formatCurrency(template.dailyTransfer || 0)} = {formatCurrency((template.dailyTransfer || 0) * weekdayCount)}
                                                    </li>
                                                    <li className="text-xs text-muted-foreground">
                                                      • Helgdagar: {fridayCount} × {formatCurrency(template.weekendTransfer || 0)} = {formatCurrency((template.weekendTransfer || 0) * fridayCount)}
                                                    </li>
                                                  </ul>
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                                
                                <Button
                                  onClick={() => copyTemplateToMonth(selectedTemplateToCopy, selectedBudgetMonth)}
                                  disabled={!selectedTemplateToCopy}
                                  className="w-full"
                                >
                                  <History className="w-4 h-4 mr-2" />
                                  Kopiera till {(() => {
                                    const monthNames = [
                                      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                                      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                                    ];
                                    
                                    if (selectedBudgetMonth) {
                                      const [year, month] = selectedBudgetMonth.split('-');
                                      const monthIndex = parseInt(month) - 1;
                                      return `${monthNames[monthIndex]} ${year}`;
                                    }
                                    return 'vald månad';
                                  })()}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Total Costs with Dropdown */}
                    <div className="p-4 bg-destructive/10 rounded-lg">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('costCategories')}>
                        <div>
                          <div className="text-sm text-muted-foreground">Totala kostnader</div>
                          <div className="text-2xl font-bold text-destructive">
                            {formatCurrency(costGroups.reduce((sum, group) => {
                              const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                              return sum + subCategoriesTotal;
                            }, 0))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-red-600" />
                          </div>
                          {expandedSections.costCategories ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                      </div>
                      
                      {expandedSections.costCategories && (
                        <div className="mt-4 space-y-4">
                          {/* Cost View Type Option */}
                          <div className="bg-muted/50 p-4 rounded-lg">
                            <h4 className="font-medium mb-3">Visa kostnadsbelopp för:</h4>
                            <ToggleGroup 
                              type="single" 
                              value={costViewType} 
                              onValueChange={(value) => value && setCostViewType(value as 'category' | 'account')}
                              className="grid grid-cols-2 w-full max-w-md"
                            >
                              <ToggleGroupItem 
                                value="category" 
                                className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                              >
                                Kategori
                              </ToggleGroupItem>
                              <ToggleGroupItem 
                                value="account" 
                                className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                              >
                                Konto
                              </ToggleGroupItem>
                            </ToggleGroup>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <h4 className="font-semibold">Kostnadskategorier</h4>
                            <div className="space-x-2">
                              <Button size="sm" onClick={() => setShowAddBudgetDialog({ isOpen: true, type: 'cost' })}>
                                <Plus className="w-4 h-4" />
                              </Button>
                              <Button size="sm" onClick={() => setIsEditingCategories(!isEditingCategories)}>
                                {isEditingCategories ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                              </Button>
                              {isEditingCategories && (
                                <Button size="sm" onClick={addCostGroup}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                            {costViewType === 'category' ? (
                             // Enhanced expandable category view
                              (() => {
                                console.log('🔍 [DEBUG] Rendering cost categories with costGroups:', costGroups);
                                console.log('🔍 [DEBUG] costGroups length:', costGroups.length);
                                
                                // Group subcategories by main category
                                const categoryGroups: { [key: string]: { total: number; subcategories: ExtendedSubCategory[] } } = {};
                                
                                costGroups.forEach((group) => {
                                  console.log('🔍 [DEBUG] Processing group:', group.name, 'with subcategories:', group.subCategories);
                                  if (!categoryGroups[group.name]) {
                                    categoryGroups[group.name] = { total: 0, subcategories: [] };
                                  }
                                  
                                  group.subCategories?.forEach((sub) => {
                                    categoryGroups[group.name].subcategories.push({
                                      ...sub,
                                      groupId: group.id
                                    } as SubCategory & { groupId: string });
                                   
                                   // ANVÄND DEN NYA BERÄKNINGSLOGIKEN HÄR
                                   if (sub.transferType === 'daily') {
                                     // Om det är en daglig överföring, anropa den nya funktionen
                                     categoryGroups[group.name].total += calculateMonthlyAmountForDailyTransfer(sub, selectedBudgetMonth);
                                   } else {
                                     // Annars, använd det vanliga fasta beloppet
                                     categoryGroups[group.name].total += sub.amount;
                                   }
                                 });
                               });
                               
                                return Object.entries(categoryGroups).map(([categoryName, data]) => {
                                  // Calculate actual amount for this category - use category ID, not name
                                  const categoryGroup = costGroups.find(g => g.name === categoryName);
                                  const actualAmount = categoryGroup ? calculateActualAmountForCategory(categoryGroup.id) : 0;
                                  const difference = data.total - actualAmount;
                                  const progress = data.total > 0 ? (actualAmount / data.total) * 100 : 0;
                                 
                                 return (
                                 <div key={categoryName} className="group relative bg-gradient-to-r from-background to-muted/30 border-2 border-border/50 rounded-xl p-4 space-y-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] animate-fade-in">
                                   {/* Category Header */}
                                   <div className="flex items-center gap-3">
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={() => setExpandedCostGroups(prev => ({
                                         ...prev,
                                         [categoryName]: !prev[categoryName]
                                       }))}
                                       className="p-2 h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20 transition-all duration-200 group-hover:scale-110"
                                     >
                                       {expandedCostGroups[categoryName] ? (
                                         <ChevronUp className="h-5 w-5 text-primary transition-transform duration-200" />
                                       ) : (
                                         <ChevronDown className="h-5 w-5 text-primary transition-transform duration-200" />
                                       )}
                                     </Button>
                                     
                                     <div className="flex-1 min-w-0">
                                       <div className="font-bold text-lg text-foreground group-hover:text-primary transition-colors duration-200">
                                         {categoryName}
                                       </div>
                                       <div className="text-sm text-muted-foreground flex items-center gap-2">
                                         <span className="inline-flex items-center gap-1">
                                           <div className="w-2 h-2 rounded-full bg-primary/60"></div>
                                           {data.subcategories.length} {data.subcategories.length === 1 ? 'post' : 'poster'}
                                         </span>
                                       </div>
                                     </div>
                                     
                                     {/* Enhanced Budget vs Actual */}
                                     <div className="text-right space-y-2">
                                       <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                         <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                           Budget: <span className="font-bold text-blue-900 dark:text-blue-100">{formatCurrency(data.total)}</span>
                                         </div>
                                         <div className="text-sm font-medium text-green-700 dark:text-green-300 mt-1">
                                           Faktiskt: 
                                           <button
                                             className="ml-1 font-bold text-green-800 dark:text-green-200 hover:text-green-600 dark:hover:text-green-400 underline decoration-2 underline-offset-2 hover:scale-105 transition-all duration-200"
                                             onClick={() => openDrillDownDialog(categoryName, categoryGroup?.id || categoryName, data.total)}
                                           >
                                             {formatCurrency(actualAmount)}
                                           </button>
                                         </div>
                                         <div className={`text-sm font-bold mt-1 ${difference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                           <span className="inline-flex items-center gap-1">
                                             {difference >= 0 ? '↗' : '↘'} {difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                                           </span>
                                         </div>
                                       </div>
                                     </div>
                                     
                                     {isEditingCategories && (
                                       <Button
                                         size="sm"
                                         variant="destructive"
                                         onClick={() => {
                                           const groupsToRemove = costGroups.filter(group => group.name === categoryName);
                                           groupsToRemove.forEach(group => removeCostGroup(group.id));
                                         }}
                                         className="h-10 w-10 rounded-full hover:scale-110 transition-all duration-200"
                                       >
                                         <Trash2 className="w-4 h-4" />
                                       </Button>
                                     )}
                                   </div>
                                   
                                   {/* Enhanced Progress Section */}
                                   <div className="space-y-3">
                                     <div className="relative">
                                       <Progress 
                                         value={Math.min(progress, 100)} 
                                         className="h-3 bg-gradient-to-r from-muted to-muted/50 border border-border/30 rounded-full overflow-hidden"
                                       />
                                       <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 rounded-full pointer-events-none"></div>
                                     </div>
                                     <div className="flex justify-between items-center text-xs">
                                       <span className="text-muted-foreground font-medium">
                                         Förbrukning
                                       </span>
                                       <span className={`font-bold px-2 py-1 rounded-full text-xs ${
                                         progress <= 75 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                         progress <= 90 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                         'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                       }`}>
                                         {progress.toFixed(1)}%
                                       </span>
                                     </div>
                                   </div>

                                   {/* Expandable Content with Animation */}
                                   {expandedCostGroups[categoryName] && (
                                     <div className="animate-accordion-down">
                                       <div className="mt-4 pl-8 space-y-3 border-l-4 border-primary/30 bg-gradient-to-r from-muted/20 to-transparent rounded-r-lg pr-4 py-3">
                                         {data.subcategories.map((sub) => (
                                           <div key={sub.id} className="space-y-2">
                                             {isEditingCategories ? (
                                               <div className="space-y-2 p-3 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-border/30">
                                                 <div className="flex gap-2 items-center">
                                                   <Input
                                                     value={sub.name}
                                                     onChange={(e) => updateSubCategory(sub.groupId, sub.id, 'name', e.target.value)}
                                                     className="flex-1"
                                                     placeholder="Kostnadspost namn"
                                                   />
                                                   <Input
                                                     type="number"
                                                     value={sub.amount === 0 ? '' : sub.amount}
                                                     onChange={(e) => updateSubCategory(sub.groupId, sub.id, 'amount', Number(e.target.value) || 0)}
                                                     className="w-32"
                                                     placeholder="Belopp"
                                                   />
                                                   <Button
                                                     size="sm"
                                                     variant="destructive"
                                                     onClick={() => removeSubCategory(sub.groupId, sub.id)}
                                                     className="hover:scale-110 transition-all duration-200"
                                                   >
                                                     <Trash2 className="w-4 h-4" />
                                                   </Button>
                                                 </div>
                                               </div>
                                             ) : (
                                               // Display mode with expandable details
                                               <div className="bg-gradient-to-r from-background to-muted/20 rounded-lg border border-border/50 overflow-hidden transition-all duration-200 hover:shadow-md">
                                                 <div className="flex justify-between items-center p-3 cursor-pointer"
                                                      onClick={() => setExpandedBudgetCategories(prev => ({
                                                        ...prev,
                                                        [`category_${categoryName}_${sub.id}`]: !prev[`category_${categoryName}_${sub.id}`]
                                                      }))}>
                                                    <div className="flex items-center gap-2">
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="p-1 h-8 w-8 rounded-full bg-primary/5 hover:bg-primary/10"
                                                      >
                                                        {expandedBudgetCategories[`category_${categoryName}_${sub.id}`] ? (
                                                          <ChevronUp className="h-4 w-4 text-primary" />
                                                        ) : (
                                                          <ChevronDown className="h-4 w-4 text-primary" />
                                                        )}
                                                      </Button>
                                                      <span className="font-medium text-foreground">{sub.name}</span>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          openEditDialog(sub, categoryName);
                                                        }}
                                                        className="p-1 h-8 w-8 rounded-full bg-secondary/50 hover:bg-secondary/80 transition-all duration-200 opacity-70 hover:opacity-100"
                                                      >
                                                        <Edit className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                      </Button>
                                                    </div>
                                                    <span className="font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full text-sm">
                                                      {sub.transferType === 'daily' 
                                                        ? formatCurrency(calculateMonthlyAmountForDailyTransfer(sub, selectedBudgetMonth))
                                                        : formatCurrency(sub.amount)
                                                      }
                                                    </span>
                                                 </div>
                                                 
                                                 {/* Expandable details */}
                                                 {expandedBudgetCategories[`category_${categoryName}_${sub.id}`] && (
                                                   <div className="p-4 bg-gradient-to-r from-muted/30 to-muted/10 border-t border-border/30 animate-accordion-down">
                                                     {/* Content similar to what we see in the image */}
                                                     <div className="grid grid-cols-2 gap-4 text-sm">
                                                       <div>
                                                         <span className="text-muted-foreground">Huvudkategori:</span>
                                                         <div className="font-medium">{categoryName}</div>
                                                       </div>
                                                       <div>
                                                         <span className="text-muted-foreground">Underkategori:</span>
                                                         <div className="font-medium">{sub.name}</div>
                                                       </div>
                                                     </div>
                                                     
                                                     <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                                       <div>
                                                         <span className="text-muted-foreground">Överföringstyp:</span>
                                                         <div className="font-medium">{sub.transferType === 'daily' ? 'Daglig överföring' : 'Månadsöverföring'}</div>
                                                       </div>
                                                       <div>
                                                         <span className="text-muted-foreground">Konto:</span>
                                                         <div className="font-medium">{sub.account || 'Inget konto'}</div>
                                                       </div>
                                                     </div>
                                                     
                                                     <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                                       <div>
                                                         <span className="text-muted-foreground">
                                                           {sub.transferType === 'daily' ? 'Månadsbelopp:' : 'Belopp:'}
                                                         </span>
                                                         <div className="font-medium">
                                                           {sub.transferType === 'daily' 
                                                             ? formatCurrency(calculateMonthlyAmountForDailyTransfer(sub, selectedBudgetMonth))
                                                             : formatCurrency(sub.amount)
                                                           }
                                                         </div>
                                                       </div>
                                                       <div>
                                                         <span className="text-muted-foreground">Finansieras ifrån:</span>
                                                         <div className="font-medium">{sub.financedFrom || 'Löpande kostnad'}</div>
                                                       </div>
                                                     </div>
                                                     
                                                     {/* Additional information for daily transfers */}
                                                     {sub.transferType === 'daily' && (
                                                       <div className="border-t pt-3 mt-3 space-y-3">
                                                         <div className="grid grid-cols-2 gap-4 text-sm">
                                                           <div>
                                                             <span className="text-muted-foreground">Dagar det överförs:</span>
                                                             <div className="font-medium">{formatTransferDays(sub.transferDays || [])}</div>
                                                           </div>
                                                           <div>
                                                             <span className="text-muted-foreground">Summa per dag:</span>
                                                             <div className="font-medium">{formatCurrency(sub.dailyAmount || 0)}</div>
                                                           </div>
                                                         </div>
                                                         
                                                         <div className="space-y-2">
                                                           <div>
                                                             <span className="text-muted-foreground">Estimerat överfört:</span>
                                                             <div className="font-medium text-green-600">
                                                               Dagar: {(() => {
                                                                 const estimatedAmount = calculateEstimatedToDate(sub, selectedBudgetMonth);
                                                                 const daysToDate = Math.floor(estimatedAmount / (sub.dailyAmount || 1));
                                                                 return `${daysToDate} × ${formatCurrency(sub.dailyAmount || 0)} = ${formatCurrency(estimatedAmount)}`;
                                                               })()}
                                                             </div>
                                                           </div>
                                                           
                                                           <div>
                                                             <span className="text-muted-foreground">Kvar att överföra:</span>
                                                             <div className="font-medium text-blue-600">
                                                               Dagar: {(() => {
                                                                 const remainingAmount = calculateRemaining(sub, selectedBudgetMonth);
                                                                 const remainingDays = Math.floor(remainingAmount / (sub.dailyAmount || 1));
                                                                 return `${remainingDays} × ${formatCurrency(sub.dailyAmount || 0)} = ${formatCurrency(remainingAmount)}`;
                                                               })()}
                                                             </div>
                                                           </div>
                                                         </div>
                                                       </div>
                                                     )}
                                                   </div>
                                                 )}
                                               </div>
                                             )}
                                           </div>
                                         ))}
                                         
                                         {isEditingCategories && (
                                           <Button
                                             size="sm"
                                             variant="outline"
                                             onClick={() => {
                                               // Find or create group for this category
                                               let targetGroup = costGroups.find(group => group.name === categoryName);
                                               if (targetGroup) {
                                                 addSubCategory(targetGroup.id);
                                               }
                                             }}
                                             className="w-full bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20 transition-all duration-200"
                                           >
                                             <Plus className="w-4 h-4 mr-1" />
                                             Lägg till kostnadspost
                                           </Button>
                                         )}
                                       </div>
                                     </div>
                                   )}
                                 </div>
                                 );
                               });
                             })()
                               ) : (
                                // Korrekt "Visa per konto" - börjar med konton först
                                (() => {
                                  console.log('🔍 [ACCOUNT VIEW] Starting correct account-first logic');
                                  console.log('🔍 [ACCOUNT VIEW] Available accounts:', activeContent.activeAccounts);
                                  console.log('🔍 [ACCOUNT VIEW] costGroups:', costGroups);
                                  console.log('🔍 [ACCOUNT VIEW] currentMonthData.transactions:', (currentMonthData as any).transactions || []);

                                  return activeContent.activeAccounts.map((account) => {
                                    console.log(`🔍 [ACCOUNT VIEW] Processing account: ${account.name} (ID: ${account.id})`);
                                    
                                    // 1. Hitta alla budgetposter (subCategories) som är kopplade till detta konto via NAMN
                                    const costItemsForThisAccount = costGroups.flatMap(g => g.subCategories || [])
                                      .filter(sub => sub.account === account.name);
                                    
                                    console.log(`🔍 [ACCOUNT VIEW] Found ${costItemsForThisAccount.length} budget items for ${account.name}:`, costItemsForThisAccount);
                                    
                                    // 2. Beräkna den totala BUDGETEN för detta konto
                                    const totalBudget = costItemsForThisAccount.reduce((sum, sub) => {
                                      if (sub.transferType === 'daily') {
                                        return sum + calculateMonthlyAmountForDailyTransfer(sub, selectedBudgetMonth);
                                      } else {
                                        return sum + sub.amount;
                                      }
                                    }, 0);
                                    
                                    console.log(`🔍 [ACCOUNT VIEW] Total budget for ${account.name}: ${totalBudget}`);
                                    
                                    // 3. Hitta alla transaktioner som är kopplade till detta konto via ID
                                    const transactionsForThisAccount = ((currentMonthData as any).transactions || [])
                                      .filter((t: any) => t.accountId === account.id);
                                    
                                    console.log(`🔍 [ACCOUNT VIEW] Found ${transactionsForThisAccount.length} transactions for ${account.name}:`, transactionsForThisAccount);
                                    
                                    // 4. Beräkna det FAKTISKA beloppet genom enkel summering
                                    const actualAmount = transactionsForThisAccount
                                      .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
                                    
                                    console.log(`🔍 [ACCOUNT VIEW] Actual amount for ${account.name}: ${actualAmount}`);
                                    
                                    const difference = totalBudget - actualAmount;
                                    
                                    // 5. Visa endast konton som faktiskt har en budgetpost eller en transaktion
                                    // Show account if it has budget items OR transactions (not both required)
                                    if (costItemsForThisAccount.length === 0 && transactionsForThisAccount.length === 0) {
                                      console.log(`🔍 [ACCOUNT VIEW] Skipping ${account.name} - no budget items or transactions`);
                                      return null;
                                    }
                                    
                                    // 6. Rendera vyn för detta specifika konto
                                    return (
                                      <div key={account.id} className="group relative bg-gradient-to-r from-background to-accent/10 border-2 border-border/50 rounded-xl p-4 space-y-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] animate-fade-in">
                                        {/* Huvudraden för kontot */}
                                        <div className="flex items-center gap-3">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              console.log(`🔍 Toggling account expansion: ${account.name}`);
                                              setExpandedCostGroups(prev => ({
                                                ...prev,
                                                [`account_${account.name}`]: !prev[`account_${account.name}`]
                                              }));
                                            }}
                                            className="p-2 h-10 w-10 rounded-full bg-accent/10 hover:bg-accent/20 transition-all duration-200 group-hover:scale-110"
                                          >
                                            {expandedCostGroups[`account_${account.name}`] ? (
                                              <ChevronUp className="h-5 w-5 text-accent transition-transform duration-200" />
                                            ) : (
                                              <ChevronDown className="h-5 w-5 text-accent transition-transform duration-200" />
                                            )}
                                          </Button>
                                          
                                          <div className="flex-1 min-w-0">
                                            <div className="font-bold text-lg text-foreground group-hover:text-accent transition-colors duration-200">
                                              {account.name}
                                            </div>
                                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                              <span className="inline-flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full bg-accent/60"></div>
                                                {costItemsForThisAccount.length} budgetposter
                                              </span>
                                            </div>
                                          </div>
                                          
                                          {/* Korrekt Budget vs Verklighet för kontot */}
                                          <div className="text-right space-y-2">
                                            <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                                              <div className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                                Budget: <span className="font-bold text-purple-900 dark:text-purple-100">{formatCurrency(totalBudget)}</span>
                                              </div>
                                              <div className="text-sm font-medium text-orange-700 dark:text-orange-300 mt-1">
                                                Faktiskt: 
                                                <button
                                                  className="ml-1 font-bold text-orange-800 dark:text-orange-200 hover:text-orange-600 dark:hover:text-orange-400 underline decoration-2 underline-offset-2 hover:scale-105 transition-all duration-200"
                                                  onClick={() => openAccountDrillDownDialog(account.name, totalBudget, actualAmount)}
                                                >
                                                  {formatCurrency(actualAmount)}
                                                </button>
                                              </div>
                                              <div className={`text-sm font-bold mt-1 ${difference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                <span className="inline-flex items-center gap-1">
                                                  {difference >= 0 ? '↗' : '↘'} {difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Den expanderade vyn som listar de specifika budgetposterna */}
                                        {expandedCostGroups[`account_${account.name}`] && (
                                          <div className="animate-accordion-down">
                                            <div className="mt-4 pl-8 space-y-3 border-l-4 border-accent/30 bg-gradient-to-r from-accent/10 to-transparent rounded-r-lg pr-4 py-3">
                                              {costItemsForThisAccount.map((sub) => {
                                                // Hitta gruppen för redigeringsändamål
                                                const parentGroup = costGroups.find(g => g.subCategories?.some(s => s.id === sub.id));
                                                return (
                                               <div key={sub.id}>
                                                 {isEditingCategories ? (
                                                   <div className="space-y-2 p-3 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-border/30">
                                                     <div className="flex gap-2 items-center">
                                                        <Input
                                                          value={sub.name}
                                                          onChange={(e) => parentGroup && updateSubCategory(parentGroup.id, sub.id, 'name', e.target.value)}
                                                          placeholder="Kostnadsnamn"
                                                          className="flex-1"
                                                        />
                                                        <Input
                                                          type="number"
                                                          value={sub.amount}
                                                          onChange={(e) => parentGroup && updateSubCategory(parentGroup.id, sub.id, 'amount', Number(e.target.value))}
                                                          placeholder="Belopp"
                                                          className="w-24"
                                                        />
                                                        <Button
                                                          size="sm"
                                                          variant="destructive"
                                                          onClick={() => parentGroup && removeSubCategory(parentGroup.id, sub.id)}
                                                          className="hover:scale-110 transition-all duration-200"
                                                        >
                                                          <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                      </div>
                                                      <div className="flex gap-2 items-center text-sm">
                                                        <span className="text-muted-foreground min-w-16">Kategori:</span>
                                                        <span className="text-sm font-medium">{parentGroup?.name || 'Okänd'}</span>
                                                      </div>
                                                      <div className="flex gap-2 items-center">
                                                        <span className="text-sm text-muted-foreground min-w-16">Finansieras från:</span>
                                                        <Select
                                                          value={sub.financedFrom || 'Löpande kostnad'}
                                                          onValueChange={(value) => parentGroup && updateSubCategory(parentGroup.id, sub.id, 'financedFrom', value as 'Löpande kostnad' | 'Enskild kostnad')}
                                                        >
                                                         <SelectTrigger className="w-40">
                                                           <SelectValue />
                                                         </SelectTrigger>
                                                         <SelectContent className="bg-popover border border-border shadow-lg z-50">
                                                           <SelectItem value="Löpande kostnad">Löpande kostnad</SelectItem>
                                                           <SelectItem value="Enskild kostnad">Enskild kostnad</SelectItem>
                                                         </SelectContent>
                                                       </Select>
                                                     </div>
                                                   </div>
                                                 ) : (
                                                   // Enhanced non-editing view with expandable details
                                                   <div className="bg-gradient-to-r from-background to-accent/10 rounded-lg border border-border/50 overflow-hidden transition-all duration-200 hover:shadow-md">
                                                      <div className="flex justify-between items-center p-3 cursor-pointer"
                                                           onClick={() => setExpandedBudgetCategories(prev => ({
                                                             ...prev,
                                                             [`account_${account.name}_${sub.id}`]: !prev[`account_${account.name}_${sub.id}`]
                                                           }))}>
                                                         <div className="flex items-center gap-2">
                                                           <Button
                                                             variant="ghost"
                                                             size="sm"
                                                             className="p-1 h-8 w-8 rounded-full bg-accent/5 hover:bg-accent/10"
                                                           >
                                                             {expandedBudgetCategories[`account_${account.name}_${sub.id}`] ? (
                                                               <ChevronUp className="h-4 w-4 text-accent" />
                                                             ) : (
                                                               <ChevronDown className="h-4 w-4 text-accent" />
                                                             )}
                                                           </Button>
                                                           <span className="font-medium text-foreground">
                                                             {sub.name} ({parentGroup?.name || 'Okänd'})
                                                           </span>
                                                           <Button
                                                             variant="ghost"
                                                             size="sm"
                                                             onClick={(e) => {
                                                               e.stopPropagation();
                                                               parentGroup && openEditDialog(sub, parentGroup.name);
                                                             }}
                                                             className="p-1 h-8 w-8 rounded-full bg-secondary/50 hover:bg-secondary/80 transition-all duration-200 opacity-70 hover:opacity-100"
                                                           >
                                                             <Edit className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                           </Button>
                                                         </div>
                                                       <span className="font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full text-sm">
                                                         {sub.transferType === 'daily' 
                                                           ? formatCurrency(calculateMonthlyAmountForDailyTransfer(sub, selectedBudgetMonth))
                                                           : formatCurrency(sub.amount)
                                                         }
                                                       </span>
                                                     </div>
                                                     
                                                      {/* Expandable details for each subcategory */}
                                                      {expandedBudgetCategories[`account_${account.name}_${sub.id}`] && (
                                                        <div className="p-4 bg-gradient-to-r from-accent/20 to-accent/5 border-t border-border/30 animate-accordion-down">
                                                          {/* Content similar to category view */}
                                                          <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div>
                                                              <span className="text-muted-foreground">Huvudkategori:</span>
                                                              <div className="font-medium">{parentGroup?.name || 'Okänd'}</div>
                                                            </div>
                                                           <div>
                                                             <span className="text-muted-foreground">Underkategori:</span>
                                                             <div className="font-medium">{sub.name}</div>
                                                           </div>
                                                         </div>
                                                         
                                                         <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                                           <div>
                                                             <span className="text-muted-foreground">Överföringstyp:</span>
                                                             <div className="font-medium">{sub.transferType === 'daily' ? 'Daglig överföring' : 'Månadsöverföring'}</div>
                                                           </div>
                                                           <div>
                                                             <span className="text-muted-foreground">Konto:</span>
                                                             <div className="font-medium">{sub.account || 'Inget konto'}</div>
                                                           </div>
                                                         </div>
                                                         
                                                         <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                                           <div>
                                                             <span className="text-muted-foreground">
                                                               {sub.transferType === 'daily' ? 'Månadsbelopp:' : 'Belopp:'}
                                                             </span>
                                                             <div className="font-medium">
                                                               {sub.transferType === 'daily' 
                                                                 ? formatCurrency(calculateMonthlyAmountForDailyTransfer(sub, selectedBudgetMonth))
                                                                 : formatCurrency(sub.amount)
                                                               }
                                                             </div>
                                                           </div>
                                                           <div>
                                                             <span className="text-muted-foreground">Finansieras ifrån:</span>
                                                             <div className="font-medium">{sub.financedFrom || 'Löpande kostnad'}</div>
                                                           </div>
                                                         </div>
                                                         
                                                         {/* Additional information for daily transfers */}
                                                         {sub.transferType === 'daily' && (
                                                           <div className="border-t pt-3 mt-3 space-y-3">
                                                             <div className="grid grid-cols-2 gap-4 text-sm">
                                                               <div>
                                                                 <span className="text-muted-foreground">Dagar det överförs:</span>
                                                                 <div className="font-medium">{formatTransferDays(sub.transferDays || [])}</div>
                                                               </div>
                                                               <div>
                                                                 <span className="text-muted-foreground">Summa per dag:</span>
                                                                 <div className="font-medium">{formatCurrency(sub.dailyAmount || 0)}</div>
                                                               </div>
                                                             </div>
                                                             
                                                             <div className="space-y-2">
                                                               <div>
                                                                 <span className="text-muted-foreground">Estimerat överfört:</span>
                                                                 <div className="font-medium text-green-600">
                                                                   Dagar: {(() => {
                                                                     const estimatedAmount = calculateEstimatedToDate(sub, selectedBudgetMonth);
                                                                     const daysToDate = Math.floor(estimatedAmount / (sub.dailyAmount || 1));
                                                                     return `${daysToDate} × ${formatCurrency(sub.dailyAmount || 0)} = ${formatCurrency(estimatedAmount)}`;
                                                                   })()}
                                                                 </div>
                                                               </div>
                                                               
                                                               <div>
                                                                 <span className="text-muted-foreground">Kvar att överföra:</span>
                                                                 <div className="font-medium text-blue-600">
                                                                   Dagar: {(() => {
                                                                     const remainingAmount = calculateRemaining(sub, selectedBudgetMonth);
                                                                     const remainingDays = Math.floor(remainingAmount / (sub.dailyAmount || 1));
                                                                     return `${remainingDays} × ${formatCurrency(sub.dailyAmount || 0)} = ${formatCurrency(remainingAmount)}`;
                                                                   })()}
                                                                 </div>
                                                               </div>
                                                             </div>
                                                           </div>
                                                         )}
                                                       </div>
                                                     )}
                                                   </div>
                                                 )}
                                                </div>
                                                );
                                              })}
                                              
                                              {isEditingCategories && (
                                                <div className="text-center pt-2">
                                                  <span className="text-sm text-muted-foreground">
                                                    Lägg till nya poster via kategorier ovan
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }).filter(Boolean);
                              })()
                          )}
                        </div>
                       )}
                     </div>

                     {/* Total Daily Budget with Dropdown */}
                     <div className="p-4 bg-blue-50 rounded-lg">
                       <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('budgetTransfers')}>
                         <div>
                           <div className="text-sm text-muted-foreground">Total daglig budget</div>
                           <div className="text-2xl font-bold text-blue-600">
                             {results ? formatCurrency(results.totalDailyBudget) : 'Beräknar...'}
                           </div>
                         </div>
                         {expandedSections.budgetTransfers ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                       </div>
                       
                       {expandedSections.budgetTransfers && (
                         <div className="mt-4 space-y-4">
                           <div className="flex justify-between items-center">
                             <h4 className="font-semibold">Budgetöverföringar</h4>
                             <Button size="sm" onClick={() => setIsEditingTransfers(!isEditingTransfers)}>
                               {isEditingTransfers ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                             </Button>
                           </div>
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                               <Label htmlFor="daily-transfer">Daglig överföring (måndag-torsdag)</Label>
                               <Input
                                 id="daily-transfer"
                                 type="number"
                                 value={dailyTransfer || ''}
                                  onChange={(e) => {
                                    setDailyTransfer(Number(e.target.value));
                                    const currentDate = new Date();
                                    const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                                    resetMonthFinalBalancesFlag(currentMonthKey);
                                  }}
                                 disabled={!isEditingTransfers}
                               />
                             </div>
                             <div className="space-y-2">
                               <Label htmlFor="weekend-transfer">Helgöverföring (fredag-söndag)</Label>
                               <Input
                                 id="weekend-transfer"
                                 type="number"
                                 value={weekendTransfer || ''}
                                  onChange={(e) => {
                                    setWeekendTransfer(Number(e.target.value));
                                    const currentDate = new Date();
                                    const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                                    resetMonthFinalBalancesFlag(currentMonthKey);
                                  }}
                                 disabled={!isEditingTransfers}
                               />
                             </div>
                           </div>
                            
                             {results && (
                               <div className="space-y-3">
                                 <div className="text-sm text-muted-foreground">
                                   <div>Daglig överföring: {formatCurrency(dailyTransfer)}</div>
                                   <div>Helgöverföring: {formatCurrency(weekendTransfer)}</div>
                                 </div>
                               </div>
                             )}
                         </div>
                       )}
                     </div>

                      {/* Total Savings with Dropdown */}
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('savingsCategories')}>
                          <div>
                            <div className="text-sm text-muted-foreground text-green-800">Totalt sparande</div>
                            <div className="text-3xl font-bold text-green-600">
                              {formatCurrency((() => {
                                const savingsCategoriesTotal = allSavingsItems.reduce((sum, group) => {
                                  const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                  return sum + group.amount + subCategoriesTotal;
                                }, 0);
                                
                                const savingsGoalsMonthlyTotal = budgetState.savingsGoals.reduce((sum, goal) => {
                                  const start = new Date(goal.startDate + '-01');
                                  const end = new Date(goal.endDate + '-01');
                                  const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                                                     (end.getMonth() - start.getMonth()) + 1;
                                  const monthlyAmount = goal.targetAmount / monthsDiff;
                                  
                                  const currentMonthDate = new Date(selectedBudgetMonth + '-01');
                                  if (currentMonthDate >= start && currentMonthDate <= end) {
                                    return sum + monthlyAmount;
                                  }
                                  return sum;
                                }, 0);
                                
                                return savingsCategoriesTotal + savingsGoalsMonthlyTotal;
                              })())}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-2xl">💰</span>
                            </div>
                            {expandedSections.savingsCategories ? <ChevronUp className="h-5 w-5 text-green-600" /> : <ChevronDown className="h-5 w-5 text-green-600" />}
                          </div>
                        </div>
                        
                        {expandedSections.savingsCategories && (
                          <div className="mt-4">
                            <SavingsSection
                              savingsGroups={allSavingsItems}
                              savingsGoals={budgetState.savingsGoals}
                              accounts={accounts}
                              mainCategories={budgetState.mainCategories || []}
                              onAddSavingsItem={(item) => {
                                // Handle adding savings item
                                const newGroup = {
                                  id: Date.now().toString(),
                                  name: item.mainCategory,
                                  amount: 0,
                                  type: 'savings' as const,
                                  subCategories: [{
                                    id: (Date.now() + 1).toString(),
                                    name: item.name,
                                    amount: item.amount,
                                    account: item.account
                                  }]
                                };
                                setSavingsGroups([...savingsGroups, newGroup]);
                              }}
                              onEditSavingsGroup={(group) => {
                                // Handle editing savings group
                                console.log('Edit savings group:', group);
                              }}
                              onDeleteSavingsGroup={(id) => {
                                // Handle deleting savings group
                                setSavingsGroups(savingsGroups.filter(g => g.id !== id));
                              }}
                            />
                          </div>
                        )}
                      </div>
                  </CardContent>
                )}
              </Card>

              {/* Budget Summary */}
              <Card className="shadow-lg border-0 bg-muted/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('budgetSummary')}>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-primary" />
                        Budgetsummering
                      </CardTitle>
                      <CardDescription>
                        {formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag)}
                      </CardDescription>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.budgetSummary ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
                {expandedSections.budgetSummary && results && (
                  <CardContent className="space-y-4">
                    {/* Income items - Green boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-sm text-green-700 font-medium">Totala intäkter</div>
                        <div className="text-xl font-bold text-green-800">
                          {formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag)}
                        </div>
                      </div>
                      
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="text-sm text-green-700 font-medium">Totalt sparande</div>
                        <div className="text-xl font-bold text-green-800">
                          {formatCurrency((() => {
                            const savingsCategoriesTotal = allSavingsItems.reduce((sum, group) => {
                              const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                              return sum + group.amount + subCategoriesTotal;
                            }, 0);
                            
                            const savingsGoalsMonthlyTotal = budgetState.savingsGoals.reduce((sum, goal) => {
                              const start = new Date(goal.startDate + '-01');
                              const end = new Date(goal.endDate + '-01');
                              const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                                                 (end.getMonth() - start.getMonth()) + 1;
                              const monthlyAmount = goal.targetAmount / monthsDiff;
                              
                              const currentMonthDate = new Date(selectedBudgetMonth + '-01');
                              if (currentMonthDate >= start && currentMonthDate <= end) {
                                return sum + monthlyAmount;
                              }
                              return sum;
                            }, 0);
                            
                            return savingsCategoriesTotal + savingsGoalsMonthlyTotal;
                          })())}
                        </div>
                      </div>
                    </div>

                    {/* Cost items - Red boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="text-sm text-red-700 font-medium">Totala kostnader</div>
                        <div className="text-xl font-bold text-red-800">
                          -{formatCurrency(costGroups.reduce((sum, group) => {
                            const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                            return sum + subCategoriesTotal;
                          }, 0))}
                        </div>
                      </div>
                    </div>

                    {/* Individual shares - Purple boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="text-sm text-purple-700 font-medium">{userName1} andel</div>
                        <div className="text-xl font-bold text-purple-800">
                          -{formatCurrency(results.andreasShare)}
                        </div>
                      </div>
                      
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="text-sm text-purple-700 font-medium">{userName2} andel</div>
                        <div className="text-xl font-bold text-purple-800">
                          -{formatCurrency(results.susannaShare)}
                        </div>
                      </div>
                    </div>

                    {/* Final sum */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="p-4 bg-gray-50 border-2 border-gray-300 rounded-lg">
                        <div className="text-sm text-gray-600 font-medium mb-1">Slutsumma (bör vara 0)</div>
                        <div className={`text-2xl font-bold ${
                          Math.abs(results.balanceLeft) < 0.01 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {formatCurrency(results.balanceLeft)}
                        </div>
                        {Math.abs(results.balanceLeft) > 0.01 && (
                          <div className="text-xs text-red-500 mt-1">
                            ⚠️ Budgeten är inte balanserad
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Calculate and Show Summary Button */}
              <Button onClick={() => {
                setActiveTab("sammanstallning");
                setTimeout(() => {
                  // Find the main title element for the current tab
                  const mainTitle = document.querySelector('h1.text-3xl.font-bold.text-center');
                  if (mainTitle) {
                    mainTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                <Calculator className="mr-2 h-4 w-4" />
                Beräkna och visa sammanställningen
              </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Sammanställning */}
          <TabsContent value="sammanstallning" className="mt-0">
            <div className={`relative overflow-hidden ${
              isAnimating && previousTab === "sammanstallning" 
                ? swipeDirection === "left" 
                  ? "animate-slide-out-left" 
                  : "animate-slide-out-right"
                : isAnimating && activeTab === "sammanstallning"
                  ? swipeDirection === "left"
                    ? "animate-slide-in-right"
                    : "animate-slide-in-left"
                  : ""
            }`}>
              <div className="space-y-6">
              {/* Overview Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Budgetöversikt</CardTitle>
                  <CardDescription>Översikt över intäkter, kostnader och överföringar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stacked Bar Chart */}
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          {
                            name: 'Intäkter',
                            andreas: andreasSalary + andreasförsäkringskassan + andreasbarnbidrag,
                            susanna: susannaSalary + susannaförsäkringskassan + susannabarnbidrag,
                          },
                          {
                            name: 'Kostnader',
                            costs: costGroups.reduce((sum, group) => {
                              const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                              return sum + subCategoriesTotal;
                            }, 0),
                            dailyBudget: results?.totalDailyBudget || 0,
                          },
                           {
                             name: 'Överföring',
                             andreasShare: results?.andreasShare || 0,
                             susannaShare: results?.susannaShare || 0,
                              savings: (() => {
                                const savingsCategoriesTotal = allSavingsItems.reduce((sum, group) => {
                                  const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                  return sum + group.amount + subCategoriesTotal;
                                }, 0);
                                
                                const savingsGoalsMonthlyTotal = budgetState.savingsGoals.reduce((sum, goal) => {
                                  const start = new Date(goal.startDate + '-01');
                                  const end = new Date(goal.endDate + '-01');
                                  const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                                                     (end.getMonth() - start.getMonth()) + 1;
                                  const monthlyAmount = goal.targetAmount / monthsDiff;
                                  
                                  const currentMonthDate = new Date(selectedBudgetMonth + '-01');
                                  if (currentMonthDate >= start && currentMonthDate <= end) {
                                    return sum + monthlyAmount;
                                  }
                                  return sum;
                                }, 0);
                                
                                return savingsCategoriesTotal + savingsGoalsMonthlyTotal;
                              })(),
                           }
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        barCategoryGap="10%"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          fontSize={12}
                          tick={{ fontSize: 12 }}
                          interval={0}
                        />
                        <YAxis 
                          fontSize={12}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <Tooltip 
                          formatter={(value, name) => [
                            formatCurrency(Number(value)), 
                            name === 'andreas' ? userName1 :
                            name === 'susanna' ? userName2 :
                            name === 'costs' ? 'Kostnader' :
                            name === 'dailyBudget' ? 'Daglig budget' :
                            name === 'andreasShare' ? `${userName1}s andel` :
                            name === 'susannaShare' ? `${userName2}s andel` :
                            name === 'savings' ? 'Sparande' : name
                          ]}
                          labelFormatter={(label) => label}
                        />
                        
                        {/* Income bars - green colors */}
                        <Bar dataKey="andreas" stackId="income" fill="hsl(142, 71%, 45%)" name={userName1} />
                        <Bar dataKey="susanna" stackId="income" fill="hsl(142, 71%, 35%)" name={userName2} />
                        
                        {/* Cost bars - red colors */}
                        <Bar dataKey="costs" stackId="costs" fill="hsl(0, 84%, 60%)" name="Kostnader" />
                        <Bar dataKey="dailyBudget" stackId="costs" fill="hsl(0, 84%, 45%)" name="Daglig budget" />
                        
                        {/* Transfer bars - purple and green */}
                        <Bar dataKey="andreasShare" stackId="transfer" fill="hsl(262, 83%, 58%)" name={`${userName1}s andel`} />
                        <Bar dataKey="susannaShare" stackId="transfer" fill="hsl(262, 83%, 68%)" name={`${userName2}s andel`} />
                        <Bar dataKey="savings" stackId="transfer" fill="hsl(142, 71%, 45%)" name="Sparande" />
                      </BarChart>
                    </ResponsiveContainer>
                   </div>
                   
                   {/* Budget vs Reality Summary */}
                   <Card className="bg-blue-50 border-blue-200">
                     <CardHeader>
                       <CardTitle className="text-blue-800">Budget vs Verklighet</CardTitle>
                       <CardDescription>Jämförelse mellan budgeterade och faktiska belopp</CardDescription>
                     </CardHeader>
                     <CardContent>
                       {(() => {
                         const monthTransactions = (currentMonthData as any).transactions || [];
                         const totalBudgetCosts = costGroups.reduce((sum, group) => {
                           const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                           return sum + subCategoriesTotal;
                         }, 0);
                         const totalActualCosts = monthTransactions
                           .filter((t: Transaction) => t.type === 'Transaction' && t.amount < 0)
                           .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0);
                         const costDifference = totalBudgetCosts - totalActualCosts;
                         
                         return (
                           <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                               <div className="text-sm text-muted-foreground">Totala kostnader</div>
                               <div>Budget: {formatCurrency(totalBudgetCosts)}</div>
                               <div>Faktiskt: {formatCurrency(totalActualCosts)}</div>
                               <div className={`font-bold ${costDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                 Differens: {costDifference >= 0 ? '+' : ''}{formatCurrency(Math.abs(costDifference))}
                               </div>
                             </div>
                             <div className="space-y-2">
                               <div className="text-sm text-muted-foreground">Status</div>
                               <div className="text-xs">
                                 {monthTransactions.length} importerade transaktioner
                               </div>
                               <div className="text-xs text-blue-600">
                                 Klicka på "Läs in transaktioner" för att importera
                               </div>
                             </div>
                           </div>
                         );
                       })()}
                     </CardContent>
                   </Card>

                    {/* Expandable Budget Sections */}
                   <div className="space-y-4">
                     {/* Intäkter Section */}
                     <div className="p-4 bg-primary/10 rounded-lg">
                       <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('budgetIncome')}>
                         <div>
                           <h4 className="font-medium">Intäkter</h4>
                           <p className="text-sm text-muted-foreground">
                             {formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag)}
                           </p>
                         </div>
                         <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.budgetIncome ? 'rotate-180' : ''}`} />
                       </div>
                       
                       {expandedSections.budgetIncome && (
                         <div className="mt-3 space-y-4 border-t pt-3">
                           {/* Income Chart */}
                           <div className="h-48 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                 <Pie
                                   data={[
                                     {
                                       name: userName1,
                                       value: andreasSalary + andreasförsäkringskassan + andreasbarnbidrag,
                                       color: 'hsl(262, 83%, 58%)'
                                     },
                                     {
                                       name: userName2,
                                       value: susannaSalary + susannaförsäkringskassan + susannabarnbidrag,
                                       color: 'hsl(200, 95%, 45%)'
                                     }
                                   ]}
                                   dataKey="value"
                                   nameKey="name"
                                   cx="50%"
                                   cy="50%"
                                   outerRadius={80}
                                 >
                                   <Cell fill="hsl(262, 83%, 58%)" />
                                   <Cell fill="hsl(200, 95%, 45%)" />
                                 </Pie>
                                 <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                               </PieChart>
                             </ResponsiveContainer>
                           </div>
                           
                            {/* Expandable income categories */}
                            <div className="space-y-2">
                              {(() => {
                                const total = andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag;
                                const andreasTotal = andreasSalary + andreasförsäkringskassan + andreasbarnbidrag;
                                const susannaTotal = susannaSalary + susannaförsäkringskassan + susannabarnbidrag;
                                const andreasPercentage = total > 0 ? (andreasTotal / total * 100).toFixed(1) : '0';
                                const susannaPercentage = total > 0 ? (susannaTotal / total * 100).toFixed(1) : '0';
                                
                                return (
                                  <>
                                    <Collapsible open={expandedBudgetCategories['budget-income-andreas']}>
                                      <CollapsibleTrigger 
                                        className="w-full p-3 rounded-lg" 
                                        style={{ backgroundColor: 'hsl(262, 83%, 58%, 0.2)' }}
                                        onClick={() => toggleBudgetCategory('budget-income-andreas')}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center justify-between w-full">
                                            <span className="font-medium">{userName1}</span>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-semibold">{andreasPercentage}%</span>
                                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedBudgetCategories['budget-income-andreas'] ? 'rotate-180' : ''}`} />
                                            </div>
                                          </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1 text-left">
                                          {formatCurrency(andreasTotal)}
                                        </p>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="mt-2">
                                        <div className="p-3 border rounded-lg bg-background">
                                          <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                              <span>• Lön:</span>
                                              <span className="font-medium">{formatCurrency(andreasSalary)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>• Försäkringskassan:</span>
                                              <span className="font-medium">{formatCurrency(andreasförsäkringskassan)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>• Barnbidrag:</span>
                                              <span className="font-medium">{formatCurrency(andreasbarnbidrag)}</span>
                                            </div>
                                            <div className="flex justify-between pt-1 border-t">
                                              <span className="font-medium">Total:</span>
                                              <span className="font-semibold">{formatCurrency(andreasTotal)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                    
                                    <Collapsible open={expandedBudgetCategories['budget-income-susanna']}>
                                      <CollapsibleTrigger 
                                        className="w-full p-3 rounded-lg" 
                                        style={{ backgroundColor: 'hsl(200, 95%, 45%, 0.2)' }}
                                        onClick={() => toggleBudgetCategory('budget-income-susanna')}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center justify-between w-full">
                                            <span className="font-medium">{userName2}</span>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-semibold">{susannaPercentage}%</span>
                                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedBudgetCategories['budget-income-susanna'] ? 'rotate-180' : ''}`} />
                                            </div>
                                          </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1 text-left">
                                          {formatCurrency(susannaTotal)}
                                        </p>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="mt-2">
                                        <div className="p-3 border rounded-lg bg-background">
                                          <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                              <span>• Lön:</span>
                                              <span className="font-medium">{formatCurrency(susannaSalary)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>• Försäkringskassan:</span>
                                              <span className="font-medium">{formatCurrency(susannaförsäkringskassan)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>• Barnbidrag:</span>
                                              <span className="font-medium">{formatCurrency(susannabarnbidrag)}</span>
                                            </div>
                                            <div className="flex justify-between pt-1 border-t">
                                              <span className="font-medium">Total:</span>
                                              <span className="font-semibold">{formatCurrency(susannaTotal)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  </>
                                );
                              })()}
                            </div>
                        </div>
                      )}
                    </div>
                    
                     {/* Kostnader Section */}
                     <div className="p-4 bg-destructive/10 rounded-lg">
                       <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('budgetCosts')}>
                         <div>
                           <h4 className="font-medium">Kostnader</h4>
                           <p className="text-sm text-muted-foreground">
                             {formatCurrency(costGroups.reduce((sum, group) => {
                               const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                               return sum + subCategoriesTotal;
                             }, 0) + (results?.totalDailyBudget || 0))}
                           </p>
                         </div>
                         <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.budgetCosts ? 'rotate-180' : ''}`} />
                       </div>
                       
                       {expandedSections.budgetCosts && (
                         <div className="mt-3 space-y-4 border-t pt-3">
                           {/* Costs Chart */}
                           <div className="h-48 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                 <Pie
                                   data={[
                                     ...costGroups.map((group, index) => ({
                                       name: group.name,
                                       value: group.subCategories?.reduce((sum, sub) => sum + sub.amount, 0) || 0,
                                       color: `hsl(${15 + (index * 60)}, 75%, 55%)`
                                     })),
                                     {
                                       name: 'Daglig Budget',
                                       value: results?.totalDailyBudget || 0,
                                       color: 'hsl(345, 82%, 48%)'
                                     }
                                   ]}
                                   dataKey="value"
                                   nameKey="name"
                                   cx="50%"
                                   cy="50%"
                                   outerRadius={80}
                                 >
                                   {costGroups.map((_, index) => (
                                     <Cell key={index} fill={`hsl(${15 + (index * 60)}, 75%, 55%)`} />
                                   ))}
                                   <Cell fill="hsl(345, 82%, 48%)" />
                                 </Pie>
                                 <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                               </PieChart>
                             </ResponsiveContainer>
                           </div>
                           
                            {/* Expandable budget categories */}
                            <div className="space-y-2">
                              {(() => {
                                const costGroupsTotal = costGroups.reduce((sum, group) => {
                                  const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                  return sum + subCategoriesTotal;
                                }, 0);
                                const dailyBudgetTotal = results?.totalDailyBudget || 0;
                                const total = costGroupsTotal + dailyBudgetTotal;
                                
                                return (
                                  <>
                                    {costGroups.map((group, index) => {
                                      const groupTotal = group.subCategories?.reduce((sum, sub) => sum + sub.amount, 0) || 0;
                                      const percentage = total > 0 ? (groupTotal / total * 100).toFixed(1) : '0';
                                      const color = `hsl(${15 + (index * 60)}, 75%, 55%)`;
                                      const categoryKey = `budget-costs-${group.id}`;
                                      
                                      return (
                                        <Collapsible key={group.id} open={expandedBudgetCategories[categoryKey]}>
                                          <CollapsibleTrigger 
                                            className="w-full p-3 rounded-lg" 
                                            style={{ backgroundColor: `${color.replace(')', ', 0.2)')}` }}
                                            onClick={() => toggleBudgetCategory(categoryKey)}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center justify-between w-full">
                                                <span className="font-medium">{group.name}</span>
                                                <div className="flex items-center space-x-2">
                                                  <span className="font-semibold">{percentage}%</span>
                                                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedBudgetCategories[categoryKey] ? 'rotate-180' : ''}`} />
                                                </div>
                                              </div>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1 text-left">
                                              {formatCurrency(groupTotal)}
                                            </p>
                                          </CollapsibleTrigger>
                                          <CollapsibleContent className="mt-2">
                                            <div className="p-3 border rounded-lg bg-background">
                                              <div className="space-y-1 text-sm">
                                                {group.subCategories && group.subCategories.length > 0 ? (
                                                  <>
                                                     {group.subCategories.map((sub) => (
                                                       <div key={sub.id} className="space-y-2">
                                                         <div className="flex justify-between">
                                                           <span>• {sub.name}:</span>
                                                           <span className="font-medium">{formatCurrency(getSubcategoryDisplayAmount(sub))}</span>
                                                         </div>
                                                          {sub.transferType === 'daily' && sub.dailyAmount && sub.transferDays && (
                                                            <div className="ml-4 p-3 bg-muted/50 rounded border-l-2 border-primary/20">
                                                              <div className="text-xs space-y-2">
                                                                <div className="flex justify-between items-center">
                                                                  <span className="font-medium">Överföring:</span>
                                                                  <span className="font-semibold">{formatCurrency(sub.dailyAmount)} ({formatTransferDays(sub.transferDays)})</span>
                                                                </div>
                                                                
                                                                <div className="flex items-center my-2">
                                                                  <div className="flex-1 border-t border-border"></div>
                                                                </div>
                                                                
                                                                <div className="space-y-1">
                                                                  <div className="flex justify-between">
                                                                    <span>Estimerat t.o.m. idag:</span>
                                                                    <span className="font-medium">{formatCurrency(calculateEstimatedToDate(sub, selectedBudgetMonth))}</span>
                                                                  </div>
                                                                  <div className="flex justify-between">
                                                                    <span>Faktiskt överfört (CSV):</span>
                                                                    <span className="font-medium">{formatCurrency(calculateActualTransferred(sub, (currentMonthData as any).transactions || [], selectedBudgetMonth))}</span>
                                                                  </div>
                                                                  <div className="flex justify-between">
                                                                    <span>Differens:</span>
                                                                     <span className={`font-medium ${calculateDifference(sub, (currentMonthData as any).transactions || [], selectedBudgetMonth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                       {calculateDifference(sub, (currentMonthData as any).transactions || [], selectedBudgetMonth) >= 0 ? '+' : ''}{formatCurrency(calculateDifference(sub, (currentMonthData as any).transactions || [], selectedBudgetMonth))}
                                                                    </span>
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          )}
                                                       </div>
                                                     ))}
                                                     <div className="flex justify-between pt-1 border-t">
                                                       <span className="font-medium">Total:</span>
                                                       <span className="font-semibold">{formatCurrency(group.subCategories.reduce((sum, sub) => sum + getSubcategoryDisplayAmount(sub), 0))}</span>
                                                     </div>
                                                  </>
                                                ) : (
                                                  <div className="flex justify-between">
                                                    <span>Inga kostnadsposter</span>
                                                    <span className="font-medium">{formatCurrency(0)}</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      );
                                    })}
                                    
                                    <Collapsible open={expandedBudgetCategories['budget-costs-daily']}>
                                      <CollapsibleTrigger 
                                        className="w-full p-3 rounded-lg" 
                                        style={{ backgroundColor: 'hsl(345, 82%, 48%, 0.2)' }}
                                        onClick={() => toggleBudgetCategory('budget-costs-daily')}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center justify-between w-full">
                                            <span className="font-medium">Daglig Budget</span>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-semibold">{total > 0 ? (dailyBudgetTotal / total * 100).toFixed(1) : '0'}%</span>
                                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedBudgetCategories['budget-costs-daily'] ? 'rotate-180' : ''}`} />
                                            </div>
                                          </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1 text-left">
                                          {formatCurrency(dailyBudgetTotal)}
                                        </p>
                                      </CollapsibleTrigger>
                                       <CollapsibleContent className="mt-2">
                                         <div className="p-3 border rounded-lg bg-background">
                                           <div className="space-y-3 text-sm">
                                             {/* Total Daily Budget Calculation */}
                                             <div>
                                               <p className="font-medium mb-2">Uträkning total daglig budget:</p>
                                               <div className="space-y-1 pl-2">
                                                 <div className="flex justify-between">
                                                   <span>• Vardagar: {results?.weekdayCount || 0} × {formatCurrency(dailyTransfer)} =</span>
                                                   <span className="font-medium">{formatCurrency((results?.weekdayCount || 0) * dailyTransfer)}</span>
                                                 </div>
                                                 <div className="flex justify-between">
                                                   <span>• Helgdagar: {results?.fridayCount || 0} × {formatCurrency(weekendTransfer)} =</span>
                                                   <span className="font-medium">{formatCurrency((results?.fridayCount || 0) * weekendTransfer)}</span>
                                                 </div>
                                                 <div className="flex justify-between pt-1 border-t">
                                                   <span className="font-medium">Total daglig budget:</span>
                                                   <span className="font-semibold">{formatCurrency(results?.totalDailyBudget || 0)}</span>
                                                 </div>
                                               </div>
                                             </div>
                                             
                                           </div>
                                         </div>
                                       </CollapsibleContent>
                                    </Collapsible>
                                  </>
                                );
                              })()}
                            </div>
                        </div>
                      )}
                    </div>
                    
                     {/* Överföring Section */}
                     <div className="p-4 bg-primary/10 rounded-lg">
                       <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('budgetTransfer')}>
                         <div>
                           <h4 className="font-medium">Överföring</h4>
                           <p className="text-sm text-muted-foreground">
                             {formatCurrency((results?.andreasShare || 0) + (results?.susannaShare || 0) + savingsGroups.reduce((sum, group) => {
                               const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                               return sum + group.amount + subCategoriesTotal;
                             }, 0))}
                           </p>
                         </div>
                         <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.budgetTransfer ? 'rotate-180' : ''}`} />
                       </div>
                       
                       {expandedSections.budgetTransfer && (
                         <div className="mt-3 space-y-4 border-t pt-3">
                           {/* Transfer Chart */}
                           <div className="h-48 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                 <Pie
                                   data={[
                                     {
                                       name: `${userName1}s andel`,
                                       value: results?.andreasShare || 0,
                                       color: 'hsl(45, 93%, 58%)'
                                     },
                                     {
                                       name: `${userName2}s andel`,
                                       value: results?.susannaShare || 0,
                                       color: 'hsl(280, 85%, 65%)'
                                     },
                                     {
                                       name: 'Sparande',
                                       value: savingsGroups.reduce((sum, group) => {
                                         const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                         return sum + group.amount + subCategoriesTotal;
                                       }, 0),
                                       color: 'hsl(142, 71%, 45%)'
                                     }
                                   ]}
                                   dataKey="value"
                                   nameKey="name"
                                   cx="50%"
                                   cy="50%"
                                   outerRadius={80}
                                 >
                                   <Cell fill="hsl(45, 93%, 58%)" />
                                   <Cell fill="hsl(280, 85%, 65%)" />
                                   <Cell fill="hsl(142, 71%, 45%)" />
                                 </Pie>
                                 <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                               </PieChart>
                             </ResponsiveContainer>
                           </div>
                           
                            {/* Expandable transfer categories */}
                            <div className="space-y-2">
                              {(() => {
                                const andreasShare = results?.andreasShare || 0;
                                const susannaShare = results?.susannaShare || 0;
                                const savingsTotal = savingsGroups.reduce((sum, group) => {
                                  const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                  return sum + group.amount + subCategoriesTotal;
                                }, 0);
                                const total = andreasShare + susannaShare + savingsTotal;
                                
                                const andreasPercentage = total > 0 ? (andreasShare / total * 100).toFixed(1) : '0';
                                const susannaPercentage = total > 0 ? (susannaShare / total * 100).toFixed(1) : '0';
                                const savingsPercentage = total > 0 ? (savingsTotal / total * 100).toFixed(1) : '0';
                                
                                return (
                                  <>
                                    <Collapsible open={expandedBudgetCategories['budget-transfer-andreas']}>
                                      <CollapsibleTrigger 
                                        className="w-full p-3 rounded-lg" 
                                        style={{ backgroundColor: 'hsl(45, 93%, 58%, 0.2)' }}
                                        onClick={() => toggleBudgetCategory('budget-transfer-andreas')}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center justify-between w-full">
                                            <span className="font-medium">{userName1}s andel</span>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-semibold">{andreasPercentage}%</span>
                                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedBudgetCategories['budget-transfer-andreas'] ? 'rotate-180' : ''}`} />
                                            </div>
                                          </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1 text-left">
                                          {formatCurrency(andreasShare)}
                                        </p>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="mt-2">
                                        <div className="p-3 border rounded-lg bg-background">
                                          <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                              <span>• Personlig andel:</span>
                                              <span className="font-semibold">{formatCurrency(andreasShare)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                    
                                    <Collapsible open={expandedBudgetCategories['budget-transfer-susanna']}>
                                      <CollapsibleTrigger 
                                        className="w-full p-3 rounded-lg" 
                                        style={{ backgroundColor: 'hsl(280, 85%, 65%, 0.2)' }}
                                        onClick={() => toggleBudgetCategory('budget-transfer-susanna')}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center justify-between w-full">
                                            <span className="font-medium">{userName2}s andel</span>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-semibold">{susannaPercentage}%</span>
                                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedBudgetCategories['budget-transfer-susanna'] ? 'rotate-180' : ''}`} />
                                            </div>
                                          </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1 text-left">
                                          {formatCurrency(susannaShare)}
                                        </p>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="mt-2">
                                        <div className="p-3 border rounded-lg bg-background">
                                          <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                              <span>• Personlig andel:</span>
                                              <span className="font-semibold">{formatCurrency(susannaShare)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                    
                                    <Collapsible open={expandedBudgetCategories['budget-transfer-savings']}>
                                      <CollapsibleTrigger 
                                        className="w-full p-3 rounded-lg" 
                                        style={{ backgroundColor: 'hsl(142, 71%, 45%, 0.2)' }}
                                        onClick={() => toggleBudgetCategory('budget-transfer-savings')}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center justify-between w-full">
                                            <span className="font-medium">Sparande</span>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-semibold">{savingsPercentage}%</span>
                                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedBudgetCategories['budget-transfer-savings'] ? 'rotate-180' : ''}`} />
                                            </div>
                                          </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1 text-left">
                                          {formatCurrency(savingsTotal)}
                                        </p>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent className="mt-2">
                                        <div className="p-3 border rounded-lg bg-background">
                                          <div className="space-y-1 text-sm">
                                            {savingsGroups.map((group) => (
                                              <div key={group.id} className="space-y-1">
                                                <div className="flex justify-between">
                                                  <span>• {group.name}:</span>
                                                  <span className="font-medium">{formatCurrency(group.amount + (group.subCategories?.reduce((sum, sub) => sum + sub.amount, 0) || 0))}</span>
                                                </div>
                                                {group.subCategories && group.subCategories.length > 0 && (
                                                  <div className="pl-4 space-y-1">
                                                    {group.subCategories.map((sub) => (
                                                      <div key={sub.id} className="flex justify-between text-xs text-muted-foreground">
                                                        <span>- {sub.name}:</span>
                                                        <span>{formatCurrency(sub.amount)}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                            <div className="flex justify-between pt-1 border-t">
                                              <span className="font-medium">Total sparande:</span>
                                              <span className="font-semibold">{formatCurrency(savingsTotal)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  </>
                                );
                              })()}
                            </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Editable Categories */}
              <Card>
                <CardHeader>
                  <CardTitle>Överföring</CardTitle>
                  <CardDescription>Kontosammanställning</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">





                    {/* Account Summary with Dropdown */}
                   {isAdminMode && (
                     <div className="p-4 bg-indigo-50 rounded-lg">
                       <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('accountSummary')}>
                         <div>
                            <div className="text-sm text-muted-foreground">Överföring till konton</div>
                            <div className="text-lg font-bold text-indigo-600">
                              {accounts.length + 2} konton
                            </div>
                         </div>
                         {expandedSections.accountSummary ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                       </div>
                     
                     {expandedSections.accountSummary && (
                       <div className="mt-4 space-y-4">
                         {/* Account Summary List */}
                         <div className="space-y-3">
                           {accounts.map(account => {
                              // Calculate savings for this account
                              const accountSavings = allSavingsItems
                                .filter(group => group.account === account)
                                .reduce((sum, group) => sum + group.amount, 0);
                             
                             // Calculate costs for this account
                             const accountCosts = costGroups.reduce((sum, group) => {
                               const groupCosts = group.subCategories
                                 ?.filter(sub => sub.account === account)
                                 .reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                               return sum + groupCosts;
                             }, 0);
                             
                             const netAmount = accountSavings - accountCosts;
                             const hasDetails = accountSavings > 0 || accountCosts > 0;
                             
                             return (
                               <div key={account} className="p-3 bg-white rounded border">
                                 <div className="flex justify-between items-center">
                                   <div className="flex items-center gap-2">
                                     <span className="font-medium">{account}</span>
                                     {hasDetails && (
                                       <button
                                         onClick={() => toggleAccountDetails(account)}
                                         className="text-gray-400 hover:text-gray-600"
                                       >
                                         {expandedAccounts[account] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                       </button>
                                     )}
                                   </div>
                                   <div className={`font-semibold ${netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                     {netAmount >= 0 ? '+' : ''}{formatCurrency(netAmount)}
                                   </div>
                                 </div>
                                 
                                 {/* Expandable breakdown */}
                                 {expandedAccounts[account] && hasDetails && (
                                   <div className="mt-3 pt-3 border-t space-y-2">
                                     {/* Savings breakdown */}
                                     {savingsGroups
                                       .filter(group => group.account === account)
                                       .map(group => (
                                         <div key={`savings-${group.id}`} className="flex justify-between text-sm">
                                           <span className="text-gray-600">{group.name} (Sparande)</span>
                                           <span className="text-green-600">+{formatCurrency(group.amount)}</span>
                                         </div>
                                       ))}
                                     
                                     {/* Costs breakdown */}
                                     {costGroups.map(group => 
                                       group.subCategories
                                         ?.filter(sub => sub.account === account)
                                         .map(sub => (
                                           <div key={`cost-${sub.id}`} className="flex justify-between text-sm">
                                             <span className="text-gray-600">{sub.name} (Kostnad)</span>
                                             <span className="text-red-600">-{formatCurrency(sub.amount)}</span>
                                           </div>
                                         ))
                                     )}
                                   </div>
                                 )}
                               </div>
                             );
                            })}
                            
                            {/* Andreas konto and Susannas konto */}
                            <div className="p-3 bg-white rounded border">
                              <div className="flex justify-between items-center">
                                <span className="font-medium">Andreas konto</span>
                                <div className="font-semibold text-purple-600">
                                  +{results ? formatCurrency(results.andreasShare) : 'Beräknar...'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="p-3 bg-white rounded border">
                              <div className="flex justify-between items-center">
                                <span className="font-medium">Susannas konto</span>
                                <div className="font-semibold text-purple-600">
                                  +{results ? formatCurrency(results.susannaShare) : 'Beräknar...'}
                                </div>
                              </div>
                            </div>
                          </div>
                         
                         {/* Account Management Section */}
                         <div className="p-4 bg-gray-50 rounded-lg">
                           <div className="flex justify-between items-center mb-4">
                             <h4 className="font-semibold">Hantera konton</h4>
                             <Button 
                               size="sm" 
                               variant="outline" 
                               onClick={() => setIsEditingAccounts(!isEditingAccounts)}
                             >
                               {isEditingAccounts ? 'Stäng' : 'Redigera konton'}
                             </Button>
                           </div>
                           
                           {isEditingAccounts && (
                             <div className="space-y-4">
                               <div className="flex gap-2">
                                 <Input
                                   placeholder="Nytt kontonamn"
                                   value={newAccountName}
                                   onChange={(e) => setNewAccountName(e.target.value)}
                                   className="flex-1"
                                 />
                                 <Button onClick={addAccount} disabled={!newAccountName.trim()}>
                                   <Plus className="w-4 h-4 mr-1" />
                                   Lägg till
                                 </Button>
                               </div>
                               
                               <div className="space-y-2">
                                 <h5 className="text-sm font-medium">Befintliga konton:</h5>
                                 {accounts.map((account) => (
                                   <div key={account} className="flex justify-between items-center p-2 bg-white rounded border">
                                     <span>{account}</span>
                                     <Button
                                       size="sm"
                                       variant="destructive"
                                       onClick={() => removeAccount(account)}
                                     >
                                       <Trash2 className="w-4 h-4" />
                                     </Button>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                         </div>
                       </div>
                      )}
                     </div>
                   )}

                     {/* Account Summary after transfers */}
                     {isAdminMode && (
                       <div className="p-4 bg-indigo-50 rounded-lg">
                         <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('finalAccountSummary')}>
                           <div>
                              <div className="text-sm text-muted-foreground">Kontosammanställning</div>
                              <div className="text-lg font-bold text-indigo-600">
                                {accounts.length + 2} konton efter överföring
                              </div>
                           </div>
                           {expandedSections.finalAccountSummary ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                         </div>
                      
                      {expandedSections.finalAccountSummary && (
                        <div className="mt-4 space-y-4">
                          {/* Final Account Summary List */}
                          <div className="space-y-3">
                            {accounts.map(account => {
                              // Get original balance using Calc.Kontosaldo from same month
                              const originalBalance = getCalcKontosaldoSameMonth(account);
                               
                               // Calculate savings for this account
                               const accountSavings = allSavingsItems
                                 .filter(group => group.account === account)
                                 .reduce((sum, group) => sum + group.amount, 0);
                              
                              // Calculate costs for this account
                              const accountCosts = costGroups.reduce((sum, group) => {
                                const groupCosts = group.subCategories
                                  ?.filter(sub => sub.account === account)
                                  .reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                return sum + groupCosts;
                              }, 0);
                              
                              // Calculate final balance (original balance + all amounts as positive)
                              const finalBalance = originalBalance + accountSavings + accountCosts;
                              
                              const hasDetails = accountSavings > 0 || accountCosts > 0 || originalBalance !== 0;
                              
                              return (
                                <div key={account} className="p-3 bg-white rounded border">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{account}</span>
                                      {hasDetails && (
                                        <button
                                          onClick={() => toggleAccountDetails(`final-${account}`)}
                                          className="text-gray-400 hover:text-gray-600"
                                        >
                                          {expandedAccounts[`final-${account}`] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </button>
                                      )}
                                    </div>
                                    <div className={`font-semibold ${finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(finalBalance)}
                                    </div>
                                  </div>
                                  
                                  {/* Expandable breakdown */}
                                  {expandedAccounts[`final-${account}`] && hasDetails && (
                                    <div className="mt-3 pt-3 border-t space-y-2">
                      {/* Original balance */}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {isCalcDescrEstimatedSameMonth(account) ? "Ursprungligt saldo (Est)" : "Ursprungligt saldo"}
                        </span>
                        <span className={originalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}>
                          {originalBalance >= 0 ? '+' : ''}{formatCurrency(Math.abs(originalBalance))}
                        </span>
                      </div>
                                      
                                      {/* Savings breakdown */}
                                      {savingsGroups
                                        .filter(group => group.account === account)
                                        .map(group => (
                                          <div key={`final-savings-${group.id}`} className="flex justify-between text-sm">
                                            <span className="text-gray-600">{group.name} (Sparande)</span>
                                            <span className="text-green-600">+{formatCurrency(group.amount)}</span>
                                          </div>
                                        ))}
                                      
                                      {/* Costs breakdown - shown as positive additions */}
                                      {costGroups.map(group => 
                                        group.subCategories
                                          ?.filter(sub => sub.account === account)
                                          .map(sub => (
                                            <div key={`final-cost-${sub.id}`} className="flex justify-between text-sm">
                                              <span className="text-gray-600">{sub.name} (Kostnad)</span>
                                              <span className="text-green-600">+{formatCurrency(sub.amount)}</span>
                                            </div>
                                          ))
                                      )}
                                      
                                      {/* Final calculation */}
                                      <div className="pt-2 mt-2 border-t border-gray-200">
                                        <div className="flex justify-between text-sm font-medium">
                                          <span className="text-gray-800">Slutligt saldo</span>
                                          <span className={finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                            {formatCurrency(finalBalance)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                             })}
                             
                             {/* Andreas konto final balance */}
                             <div className="p-3 bg-white rounded border">
                               <div className="flex justify-between items-center">
                                 <span className="font-medium">Andreas konto</span>
                                 <div className="font-semibold text-purple-600">
                                   {results ? formatCurrency(results.andreasShare) : 'Beräknar...'}
                                 </div>
                               </div>
                             </div>
                             
                             {/* Susannas konto final balance */}
                             <div className="p-3 bg-white rounded border">
                               <div className="flex justify-between items-center">
                                 <span className="font-medium">Susannas konto</span>
                                 <div className="font-semibold text-purple-600">
                                   {results ? formatCurrency(results.susannaShare) : 'Beräknar...'}
                                 </div>
                               </div>
                             </div>
                           </div>
                        </div>
                       )}
                     </div>
                     )}

                     {/* Account Summary after cost budget */}
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('accountSummaryCostBudget')}>
                        <div>
                            <div className="text-sm text-muted-foreground">Kontobelopp efter budget</div>
                            <div className="text-lg font-bold text-green-600">
                              {accounts.length + 2} konton
                            </div>
                        </div>
                        {expandedSections.accountSummaryCostBudget ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                      
                      {expandedSections.accountSummaryCostBudget && (
                        <div className="mt-4 space-y-4">
                          {/* Cost Budget Account Summary List */}
                          <div className="space-y-3">
                            {accounts.map(account => {
                              // Get original balance using Calc.Kontosaldo from same month
                              const originalBalance = getCalcKontosaldoSameMonth(account);
                              
                              // Calculate total deposits (savings + costs as positive) for this account
                              const savingsAmount = allSavingsItems.reduce((sum, group) => {
                                // Check if the group itself is assigned to this account
                                if (group.account === account) {
                                  return sum + group.amount;
                                }
                                // Check subcategories for this account
                                const subCategoriesAmount = group.subCategories
                                  ?.filter(sub => sub.account === account)
                                  .reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                return sum + subCategoriesAmount;
                              }, 0);
                              
                              // Add savings goals monthly amount for this account
                              const savingsGoalsMonthlyAmount = budgetState.savingsGoals.reduce((sum, goal) => {
                                // Try direct account name matching first (in case accountId was set to account name)
                                let accountMatches = goal.accountId === account;
                                
                                // Then try ID matching
                                if (!accountMatches) {
                                  const accountObj = budgetState.accounts.find(acc => acc.name === account);
                                  accountMatches = accountObj && goal.accountId === accountObj.id;
                                }
                                
                                if (accountMatches) {
                                  const start = new Date(goal.startDate + '-01');
                                  const end = new Date(goal.endDate + '-01');
                                  const monthsDiff = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + 
                                                     (end.getMonth() - start.getMonth()) + 1);
                                  const monthlyAmount = goal.targetAmount / monthsDiff;
                                  
                                  const currentMonthDate = new Date(selectedBudgetMonth + '-01');
                                  if (currentMonthDate >= start && currentMonthDate <= end) {
                                    return sum + monthlyAmount;
                                  }
                                }
                                return sum;
                              }, 0);
                              
                              const costsAmount = costGroups.reduce((sum, group) => {
                                const groupCosts = group.subCategories
                                  ?.filter(sub => sub.account === account)
                                  .reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                return sum + groupCosts;
                              }, 0);
                              
                               // Only count savings as deposits, not costs
                               const totalDeposits = savingsAmount + savingsGoalsMonthlyAmount;
                               
                                // Get all cost subcategories for this account that are "Löpande kostnad"
                                const accountCostItems = costGroups.reduce((items, group) => {
                                  const groupCosts = group.subCategories?.filter(sub => 
                                    sub.account === account && (sub.financedFrom === 'Löpande kostnad' || !sub.financedFrom)
                                  ) || [];
                                  return items.concat(groupCosts);
                                }, []);
                                
                                // Calculate total costs for this account (only Löpande kostnad)
                                const totalCosts = accountCostItems.reduce((sum, item) => sum + item.amount, 0);
                               
                                 // Calculate final balance as sum of ALL entries shown in the table:
                                 // original balance + savings deposits + cost budget deposits - all costs
                                 const allCostItems = costGroups.reduce((items, group) => {
                                   const groupCosts = group.subCategories?.filter(sub => sub.account === account) || [];
                                   return items.concat(groupCosts);
                                 }, []);
                                 const totalAllCosts = allCostItems.reduce((sum, item) => sum + item.amount, 0);
                                 
                                  const finalBalance = originalBalance + totalDeposits + totalCosts - totalAllCosts;
                                
                                console.log(`=== UI SLUTSALDO CALCULATION FOR ${account} ===`);
                                console.log(`Original balance: ${originalBalance}`);
                                console.log(`Savings (deposits): ${savingsAmount}`);
                                console.log(`Total costs (Löpande): ${totalCosts}`);
                                console.log(`Total all costs: ${totalAllCosts}`);
                                console.log(`UI Calculation: ${originalBalance} + ${totalDeposits} + ${totalCosts} - ${totalAllCosts} = ${finalBalance}`);
                                console.log(`Month: ${selectedBudgetMonth}`);
                                console.log(`This should MATCH accountEstimatedFinalBalances[${account}]`);
                                console.log(`=== END UI SLUTSALDO ===`);
                              
                              const hasDetails = totalDeposits > 0 || accountCostItems.length > 0 || originalBalance !== 0;
                              
                              return (
                                <div key={account} className="p-3 bg-white rounded border">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{account}</span>
                                      {hasDetails && (
                                        <button
                                          onClick={() => toggleAccountDetails(`costbudget-${account}`)}
                                          className="text-gray-400 hover:text-gray-600"
                                        >
                                          {expandedAccounts[`costbudget-${account}`] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </button>
                                      )}
                                    </div>
                                    <div className={`font-semibold ${finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(finalBalance)}
                                    </div>
                                  </div>
                                  
                                  {/* Expandable breakdown */}
                                  {expandedAccounts[`costbudget-${account}`] && hasDetails && (
                                    <div className="mt-3 pt-3 border-t space-y-2">
                                      {/* Original balance */}
                                      <div className="flex justify-between text-sm">
                                         <span className="text-gray-600">
                                           {isCalcDescrEstimatedSameMonth(account) ? "Ursprungligt saldo (Est)" : "Ursprungligt saldo"}
                                         </span>
                                        <span className={originalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}>
                                          {originalBalance >= 0 ? '+' : ''}{formatCurrency(Math.abs(originalBalance))}
                                        </span>
                                      </div>
                                      
                                      {/* Individual savings groups assigned to this account */}
                                      {allSavingsItems
                                        .filter(group => group.account === account)
                                        .map(savingsGroup => (
                                          <div key={`costbudget-savings-${savingsGroup.id}`} className="flex justify-between text-sm">
                                            <span className="text-gray-600">{savingsGroup.name}</span>
                                            <span className="text-green-600">+{formatCurrency(savingsGroup.amount)}</span>
                                          </div>
                                        ))}
                                      
                                      {/* Individual savings subcategories assigned to this account */}
                                      {allSavingsItems
                                        .filter(group => group.subCategories && group.subCategories.some(sub => sub.account === account))
                                        .map(group => 
                                          group.subCategories
                                            ?.filter(sub => sub.account === account)
                                            .map(sub => (
                                              <div key={`costbudget-savings-sub-${sub.id}`} className="flex justify-between text-sm">
                                                <span className="text-gray-600">{sub.name}</span>
                                                <span className="text-green-600">+{formatCurrency(sub.amount)}</span>
                                              </div>
                                            ))
                                        )}
                                      
                                       {/* Cost budget deposits - only Löpande kostnad costs as positive deposits */}
                                       {totalCosts > 0 && (
                                         <div className="flex justify-between text-sm">
                                           <span className="text-gray-600">Insättning kostnadsbudget (Löpande kostnad)</span>
                                           <span className="text-green-600">+{formatCurrency(totalCosts)}</span>
                                         </div>
                                       )}
                                      
                                       {/* Individual cost items as negative values - show all items but only Löpande kostnad affects budget */}
                                       {costGroups.reduce((items, group) => {
                                         const groupCosts = group.subCategories?.filter(sub => sub.account === account) || [];
                                         return items.concat(groupCosts);
                                       }, []).map(costItem => (
                                         <div key={`costbudget-cost-${costItem.id}`} className="flex justify-between text-sm">
                                           <span className="text-gray-600">
                                             {costItem.name} ({costItem.financedFrom || 'Löpande kostnad'})
                                           </span>
                                           <span className="text-red-600">-{formatCurrency(costItem.amount)}</span>
                                         </div>
                                       ))}
                                      
                                       {/* Final calculation line */}
                                       <div className="pt-2 mt-2 border-t border-gray-200">
                                         <div className="flex justify-between text-sm font-medium">
                                           <span className="text-gray-800">Estimerat slutsaldo</span>
                                           <span className={finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                             {formatCurrency(finalBalance)}
                                           </span>
                                          </div>

                                          {/* Line separator */}
                                          <div className="border-t border-gray-200 mt-2 pt-2">
                                            {isNextMonthBalanceSet(account) ? (
                                              <>
                                                {/* Faktiska extra kostnader/intäkter */}
                                                <div className="flex justify-between text-sm font-medium">
                                                  <span className="text-gray-800">Faktiska extra kostnader/intäkter</span>
                                                  <span className={(() => {
                                                    const actualEndBalance = accountEndBalances[account] || 0;
                                                    const difference = actualEndBalance - finalBalance;
                                                    return difference >= 0 ? 'text-green-600' : 'text-red-600';
                                                  })()}>
                                                    {(() => {
                                                      const actualEndBalance = accountEndBalances[account] || 0;
                                                      const difference = actualEndBalance - finalBalance;
                                                      return formatCurrency(difference);
                                                    })()}
                                                  </span>
                                                </div>

                                                {/* Faktiskt Slutsaldo */}
                                                <div className="flex justify-between text-sm font-medium mt-1">
                                                  <span className="text-gray-800">Faktiskt Slutsaldo</span>
                                                  <span className={(() => {
                                                    const actualEndBalance = accountEndBalances[account] || 0;
                                                    return actualEndBalance >= 0 ? 'text-green-600' : 'text-red-600';
                                                  })()}>
                                                    {formatCurrency(accountEndBalances[account] || 0)}
                                                  </span>
                                                </div>
                                              </>
                                            ) : (
                                              <div className="flex flex-col items-center text-center p-4 bg-gray-50 rounded-lg border">
                                                <div className="text-gray-600 text-sm mb-2">
                                                  <span className="font-medium">Ingående kontosaldo ej ifyllt för {getNextMonthName()}.</span>
                                                </div>
                                                <div className="text-gray-500 text-xs">
                                                  Fyll i för att se faktiskt slutsaldo.
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                       </div>
                                    </div>
                                  )}
                                </div>
                              );
                             })}
                             
                             {/* Andreas konto final balance */}
                             <div className="p-3 bg-white rounded border">
                               <div className="flex justify-between items-center">
                                 <span className="font-medium">Andreas konto</span>
                                 <div className="font-semibold text-purple-600">
                                   {results ? formatCurrency(results.andreasShare) : 'Beräknar...'}
                                 </div>
                               </div>
                             </div>
                             
                             {/* Susannas konto final balance */}
                             <div className="p-3 bg-white rounded border">
                               <div className="flex justify-between items-center">
                                 <span className="font-medium">Susannas konto</span>
                                 <div className="font-semibold text-purple-600">
                                   {results ? formatCurrency(results.susannaShare) : 'Beräknar...'}
                                 </div>
                               </div>
                             </div>
                           </div>
                         </div>
                       )}
                     </div>

                    {/* Remaining Daily Budget */}
                   <div className="p-4 bg-amber-50 rounded-lg">
                     <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('remainingDailyBudgetDistribution')}>
                       <div>
                         <div className="text-sm text-muted-foreground">Återstående daglig budget</div>
                         <div className="text-2xl font-bold text-amber-600">
                           {results ? formatCurrency(results.remainingDailyBudget) : 'Beräknar...'}
                         </div>
                       </div>
                       {expandedSections.remainingDailyBudgetDistribution ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                     </div>
                     
                     {expandedSections.remainingDailyBudgetDistribution && (
                       <div className="mt-4 space-y-4">
                         {results && (
                           <div className="space-y-4">
                             <div className="p-4 bg-amber-100 rounded-lg border border-amber-200">
                               <div className="text-sm text-amber-700 font-medium mb-2">Beräkning återstående daglig budget:</div>
                               <div className="space-y-1 pl-2">
                                 <div className="flex justify-between">
                                   <span>• Återstående vardagar: {results.remainingWeekdayCount || 0} × {formatCurrency(dailyTransfer)} =</span>
                                   <span className="font-medium">{formatCurrency((results.remainingWeekdayCount || 0) * dailyTransfer)}</span>
                                 </div>
                                 <div className="flex justify-between">
                                   <span>• Återstående helgdagar: {results.remainingFridayCount || 0} × {formatCurrency(weekendTransfer)} =</span>
                                   <span className="font-medium">{formatCurrency((results.remainingFridayCount || 0) * weekendTransfer)}</span>
                                 </div>
                                 <div className="flex justify-between pt-2 border-t">
                                   <span className="font-medium text-amber-800">Återstående daglig budget:</span>
                                   <span className="font-semibold text-amber-800">{formatCurrency(results.remainingDailyBudget || 0)}</span>
                                 </div>
                               </div>
                             </div>
                           </div>
                         )}
                       </div>
                     )}
                   </div>

                   {/* Budget Not Transferred (Red Days) */}
                   <div className="p-4 bg-red-50 rounded-lg">
                     <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('redDays')}>
                       <div>
                         <div className="text-sm text-muted-foreground">Budget som ej överförs (röda dagar)</div>
                         <div className="text-2xl font-bold text-red-600">
                           {results ? formatCurrency(results.holidayDaysBudget) : 'Beräknar...'}
                         </div>
                       </div>
                       {expandedSections.redDays ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                     </div>
                    
                    {expandedSections.redDays && (
                      <div className="mt-4 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-semibold">Svenska röda dagar</h4>
                          <Button size="sm" onClick={() => setIsEditingHolidays(!isEditingHolidays)}>
                            {isEditingHolidays ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                          </Button>
                        </div>
                        
                        {results && (
                          <div className="text-sm space-y-3">
                            <div>
                              <div>Röda dagar till 25:e: {results.holidaysUntil25th.length} st</div>
                              <div className="text-xs text-muted-foreground">
                                {results.holidaysUntil25th.join(', ')}
                              </div>
                            </div>
                            <div>
                              <div>Nästkommande 10 röda dagar:</div>
                              <div className="text-xs text-muted-foreground">
                                {results.nextTenHolidays.join(', ')}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {isEditingHolidays && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <h5 className="font-medium">Anpassade helgdagar</h5>
                              <Button size="sm" onClick={addCustomHoliday}>
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            {customHolidays.map((holiday, index) => (
                              <div key={index} className="flex gap-2 items-center">
                                <Input
                                  type="date"
                                  value={holiday.date}
                                  onChange={(e) => updateCustomHoliday(index, 'date', e.target.value)}
                                  className="flex-1"
                                />
                                <Input
                                  value={holiday.name}
                                  onChange={(e) => updateCustomHoliday(index, 'name', e.target.value)}
                                  className="flex-1"
                                  placeholder="Namn på helgdag"
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeCustomHoliday(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>

              {/* Individual Shares */}
              <Card>
                <CardHeader>
                  <CardTitle>Individuell Fördelning & Bidrag</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Individual Breakdown - Expandable Tabs */}
                  <div className="space-y-4">
                    {/* Andreas Expandable Tab */}
                    <div className="border rounded-lg">
                      <div className="flex items-center justify-between cursor-pointer p-4 bg-purple-50 hover:bg-purple-100 rounded-t-lg" onClick={() => toggleSection('andreasDetails')}>
                        <div>
                          <h5 className="font-medium text-lg">{userName1}</h5>
                          <div className="text-sm text-muted-foreground">
                            {(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                              ? ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) * 100).toFixed(1)
                              : '0'}% fördelning
                          </div>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.andreasDetails ? 'rotate-180' : ''}`} />
                      </div>
                      
                      {expandedSections.andreasDetails && (
                        <div className="p-4 border-t space-y-3">
                          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="text-sm text-muted-foreground">Procentuell fördelning</div>
                            <div className="text-xl font-bold text-purple-600">
                              {(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                                ? ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) * 100).toFixed(1)
                                : '0'}%
                            </div>
                          </div>
                          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="text-sm text-muted-foreground">Andel av gemensamma kostnader/sparande</div>
                            <div className="text-xl font-bold text-red-600">
                              {formatCurrency((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                                ? ((results ? results.totalDailyBudget : 0) +
                                  costGroups.reduce((sum, group) => {
                                    const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                    return sum + subCategoriesTotal;
                                  }, 0) +
                                  savingsGroups.reduce((sum, group) => sum + group.amount, 0)) * ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag))
                                : 0)}
                            </div>
                          </div>
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="text-sm text-muted-foreground">Kvar efter gemensamma kostnader/sparande</div>
                            <div className="text-xl font-bold text-green-600">
                              {formatCurrency((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag) - 
                                ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                                  ? ((results ? results.totalDailyBudget : 0) +
                                    costGroups.reduce((sum, group) => {
                                      const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                      return sum + subCategoriesTotal;
                                    }, 0) +
                                    savingsGroups.reduce((sum, group) => sum + group.amount, 0)) * ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag))
                                  : 0))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Susanna Expandable Tab */}
                    <div className="border rounded-lg">
                      <div className="flex items-center justify-between cursor-pointer p-4 bg-blue-50 hover:bg-blue-100 rounded-t-lg" onClick={() => toggleSection('susannaDetails')}>
                        <div>
                          <h5 className="font-medium text-lg">{userName2}</h5>
                          <div className="text-sm text-muted-foreground">
                            {(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                              ? ((susannaSalary + susannaförsäkringskassan + susannabarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) * 100).toFixed(1)
                              : '0'}% fördelning
                          </div>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.susannaDetails ? 'rotate-180' : ''}`} />
                      </div>
                      
                      {expandedSections.susannaDetails && (
                        <div className="p-4 border-t space-y-3">
                          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="text-sm text-muted-foreground">Procentuell fördelning</div>
                            <div className="text-xl font-bold text-purple-600">
                              {(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                                ? ((susannaSalary + susannaförsäkringskassan + susannabarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) * 100).toFixed(1)
                                : '0'}%
                            </div>
                          </div>
                          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="text-sm text-muted-foreground">Andel av gemensamma kostnader/sparande</div>
                            <div className="text-xl font-bold text-red-600">
                              {formatCurrency((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                                ? ((results ? results.totalDailyBudget : 0) +
                                  costGroups.reduce((sum, group) => {
                                    const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                    return sum + subCategoriesTotal;
                                  }, 0) +
                                  savingsGroups.reduce((sum, group) => sum + group.amount, 0)) * ((susannaSalary + susannaförsäkringskassan + susannabarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag))
                                : 0)}
                            </div>
                          </div>
                          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <div className="text-sm text-muted-foreground">Kvar efter gemensamma kostnader/sparande</div>
                            <div className="text-xl font-bold text-green-600">
                              {formatCurrency((susannaSalary + susannaförsäkringskassan + susannabarnbidrag) - 
                                ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                                  ? ((results ? results.totalDailyBudget : 0) +
                                    costGroups.reduce((sum, group) => {
                                      const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                      return sum + subCategoriesTotal;
                                    }, 0) +
                                    savingsGroups.reduce((sum, group) => sum + group.amount, 0)) * ((susannaSalary + susannaförsäkringskassan + susannabarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag))
                                  : 0))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Combined Chart Section */}
                  <div className="mt-8">
                    <h5 className="font-medium text-lg mb-4">Ekonomisk fördelning</h5>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              name: userName1,
                              andel: (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                                ? ((results ? results.totalDailyBudget : 0) +
                                  costGroups.reduce((sum, group) => {
                                    const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                    return sum + subCategoriesTotal;
                                  }, 0) +
                                  savingsGroups.reduce((sum, group) => sum + group.amount, 0)) * ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag))
                                : 0,
                              kvar: (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag) - 
                                ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                                  ? ((results ? results.totalDailyBudget : 0) +
                                    costGroups.reduce((sum, group) => {
                                      const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                      return sum + subCategoriesTotal;
                                    }, 0) +
                                    savingsGroups.reduce((sum, group) => sum + group.amount, 0)) * ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag))
                                  : 0)
                            },
                            {
                              name: userName2,
                              andel: (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                                ? ((results ? results.totalDailyBudget : 0) +
                                  costGroups.reduce((sum, group) => {
                                    const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                    return sum + subCategoriesTotal;
                                  }, 0) +
                                  savingsGroups.reduce((sum, group) => sum + group.amount, 0)) * ((susannaSalary + susannaförsäkringskassan + susannabarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag))
                                : 0,
                              kvar: (susannaSalary + susannaförsäkringskassan + susannabarnbidrag) - 
                                ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                                  ? ((results ? results.totalDailyBudget : 0) +
                                    costGroups.reduce((sum, group) => {
                                      const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                      return sum + subCategoriesTotal;
                                    }, 0) +
                                    savingsGroups.reduce((sum, group) => sum + group.amount, 0)) * ((susannaSalary + susannaförsäkringskassan + susannabarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag))
                                  : 0)
                            }
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} />
                          <Tooltip 
                            formatter={(value, name) => [
                              formatCurrency(Number(value)), 
                              name === 'andel' ? 'Andel av gemensamma kostnader/sparande' : 'Kvar efter gemensamma kostnader/sparande'
                            ]}
                          />
                          <Legend 
                            formatter={(value) => 
                              value === 'andel' ? 'Andel av gemensamma kostnader/sparande' : 'Kvar efter gemensamma kostnader/sparande'
                            }
                          />
                          <Bar dataKey="andel" fill="#ef4444" name="andel" />
                          <Bar dataKey="kvar" fill="#16a34a" name="kvar" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transfer Plan & Next Salary - Only show for current month */}
              {(() => {
                const currentDate = new Date();
                const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                const isCurrentMonth = selectedBudgetMonth === currentMonthKey;
                
                if (!isCurrentMonth) return null;
                
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Överföringsplan & Nästa Lön</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {results && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="text-sm text-muted-foreground">Dagar kvar till 25:e</div>
                            <div className="text-xl font-semibold">{results.daysUntil25th} dagar</div>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="text-sm text-muted-foreground">Vardagar</div>
                            <div className="text-xl font-semibold">{results.weekdayCount} dagar</div>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="text-sm text-muted-foreground">Helgdagar</div>
                            <div className="text-xl font-semibold">{results.fridayCount} dagar</div>
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-4 border-t">
                        <Button 
                          onClick={() => setActiveTab("overforing")} 
                          className="w-full"
                          variant="outline"
                        >
                          Se överföringsplan
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Överföring */}
          <TabsContent value="overforing" className="mt-0">
            <div className={`relative overflow-hidden ${
              isAnimating && previousTab === "overforing" 
                ? swipeDirection === "left" 
                  ? "animate-slide-out-left" 
                  : "animate-slide-out-right"
                : isAnimating && activeTab === "overforing"
                  ? swipeDirection === "left"
                    ? "animate-slide-in-right"
                    : "animate-slide-in-left"
                  : ""
            }`}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Överföringar
                  </CardTitle>
                  <CardDescription>
                    Hantera överföringar till konton och daglig budget
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="account-transfers" className="w-full">
                    <TabsList className="grid w-full grid-cols-1">
                      <TabsTrigger value="account-transfers">Överföring till konton</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="account-transfers" className="space-y-6 mt-6">
                 <div className="space-y-2">
                   <Label htmlFor="transfer-account">Överföringskonto saldo</Label>
                   <Input
                     id="transfer-account"
                     type="number"
                     placeholder="Ange nuvarande saldo"
                     value={transferAccount || ''}
                     onChange={(e) => setTransferAccount(Number(e.target.value))}
                     className="text-lg"
                   />
                 </div>

                 {/* Överföring till gemensamma konton section - copied from Sammanställning */}
                 <div className="p-4 bg-indigo-50 rounded-lg">
                   <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('accountSummary')}>
                     <div>
                        <div className="text-sm text-muted-foreground">Överföring till gemensamma konton</div>
                        <div className="text-lg font-bold text-indigo-600">
                          {accounts.length} konton
                        </div>
                     </div>
                     {expandedSections.accountSummary ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                   </div>
                   
                   {expandedSections.accountSummary && (
                     <div className="mt-4 space-y-4">
                        {/* Account Summary List */}
                        <div className="space-y-3">
                          {accounts.map(account => {
                              // Calculate savings for this account
                              const accountSavings = allSavingsItems
                                .filter(group => group.account === account)
                                .reduce((sum, group) => sum + group.amount, 0);
                             
                             // Calculate costs for this account
                             const accountCosts = costGroups.reduce((sum, group) => {
                               const groupCosts = group.subCategories
                                 ?.filter(sub => sub.account === account)
                                 .reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                               return sum + groupCosts;
                             }, 0);
                             
                             // Calculate total amount as sum of absolute values (what needs to be transferred)
                             const totalAmount = accountSavings + accountCosts;
                             const netAmount = accountSavings - accountCosts;
                             const hasDetails = accountSavings > 0 || accountCosts > 0;
                             
                             // Hide accounts with 0 balance since no transfer occurs to these
                             if (totalAmount === 0) return null;
                            
                            return (
                              <div key={account} className="p-3 bg-white rounded border">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      checked={transferChecks[account] || false}
                                      onCheckedChange={(checked) => setTransferChecks(prev => ({...prev, [account]: checked as boolean}))}
                                    />
                                    <span className="font-medium">{account}</span>
                                    {hasDetails && (
                                      <button
                                        onClick={() => toggleAccountDetails(account)}
                                        className="text-gray-400 hover:text-gray-600"
                                      >
                                        {expandedAccounts[account] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                      </button>
                                    )}
                                  </div>
                                   <div className={`font-semibold ${netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                     {formatCurrency(totalAmount)}
                                   </div>
                                </div>
                               
                               {/* Expandable breakdown */}
                               {expandedAccounts[account] && hasDetails && (
                                 <div className="mt-3 pt-3 border-t space-y-2">
                                   {/* Savings breakdown */}
                                   {savingsGroups
                                     .filter(group => group.account === account)
                                     .map(group => (
                                        <div key={`savings-${group.id}`} className="flex justify-between text-sm">
                                          <span className="text-gray-600">{group.name} (Sparande)</span>
                                          <span className="text-green-600">{formatCurrency(group.amount)}</span>
                                        </div>
                                     ))}
                                   
                                   {/* Costs breakdown */}
                                   {costGroups.map(group => 
                                     group.subCategories
                                       ?.filter(sub => sub.account === account)
                                       .map(sub => (
                                          <div key={`cost-${sub.id}`} className="flex justify-between text-sm">
                                            <span className="text-gray-600">{sub.name} (Kostnad)</span>
                                            <span className="text-red-600">{formatCurrency(sub.amount)}</span>
                                          </div>
                                       ))
                                   )}
                                 </div>
                               )}
                             </div>
                           );
                          })}
                        </div>
                       
                        {/* Account Management Section */}
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex justify-center mb-4">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setIsEditingAccounts(!isEditingAccounts)}
                            >
                              {isEditingAccounts ? 'Stäng' : 'Redigera konton'}
                            </Button>
                          </div>
                         
                         {isEditingAccounts && (
                           <div className="space-y-4">
                             <div className="flex gap-2">
                               <Input
                                 placeholder="Nytt kontonamn"
                                 value={newAccountName}
                                 onChange={(e) => setNewAccountName(e.target.value)}
                                 className="flex-1"
                               />
                               <Button onClick={addAccount} disabled={!newAccountName.trim()}>
                                 <Plus className="w-4 h-4 mr-1" />
                                 Lägg till
                               </Button>
                             </div>
                             
                             <div className="space-y-2">
                               <h5 className="text-sm font-medium">Befintliga konton:</h5>
                               {accounts.map((account) => (
                                 <div key={account} className="flex justify-between items-center p-2 bg-white rounded border">
                                   <span>{account}</span>
                                   <Button
                                     size="sm"
                                     variant="destructive"
                                     onClick={() => removeAccount(account)}
                                   >
                                     <Trash2 className="w-4 h-4" />
                                   </Button>
                                 </div>
                               ))}
                             </div>
                           </div>
                         )}
                       </div>
                     </div>
                   )}
                 </div>

                 {results && (
                   <div className="space-y-4">
                      {/* Fördelning av återstående belopp - Collapsible Section */}
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('remainingAmountDistribution')}>
                          <div>
                            <div className="text-sm text-muted-foreground">Fördelning av återstående belopp</div>
                            <div className="text-lg font-bold text-purple-600">
                              {formatCurrency(results.andreasShare + results.susannaShare + results.remainingDailyBudget)}
                            </div>
                          </div>
                          {expandedSections.remainingAmountDistribution ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                       
                        {expandedSections.remainingAmountDistribution && (
                          <div className="mt-4 space-y-4">
                             <div className="space-y-2">
                               
                               {/* Individual Shares - moved out of collapsible section */}
                               <div className="space-y-3 mt-4">
                                 <div className="p-3 bg-white rounded border">
                                   <div className="flex justify-between items-center">
                                     <div className="flex items-center gap-3">
                                       <Checkbox
                                         checked={andreasShareChecked}
                                         onCheckedChange={(checked) => setAndreasShareChecked(checked as boolean)}
                                       />
                                       <span className="font-medium">{userName1}s konto ({((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0 ? ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) * 100).toFixed(1) : '0')}%)</span>
                                     </div>
                                     <div className={`font-semibold ${results.andreasShare >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                       {formatCurrency(Math.abs(results.andreasShare))}
                                     </div>
                                   </div>
                                 </div>
                                 
                                 <div className="p-3 bg-white rounded border">
                                   <div className="flex justify-between items-center">
                                     <div className="flex items-center gap-3">
                                       <Checkbox
                                         checked={susannaShareChecked}
                                         onCheckedChange={(checked) => setSusannaShareChecked(checked as boolean)}
                                       />
                                       <span className="font-medium">{userName2}s konto ({((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0 ? ((susannaSalary + susannaförsäkringskassan + susannabarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) * 100).toFixed(1) : '0')}%)</span>
                                     </div>
                                     <div className={`font-semibold ${results.susannaShare >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                       {formatCurrency(Math.abs(results.susannaShare))}
                                     </div>
                                   </div>
                                 </div>
                                 
                                 <div className="p-3 bg-gray-50 rounded border">
                                   <div className="flex justify-between items-center">
                                     <span className="font-medium">Totalt att fördela:</span>
                                     <span className="font-semibold text-blue-800">{formatCurrency(Math.abs(results.andreasShare) + Math.abs(results.susannaShare) + results.remainingDailyBudget)}</span>
                                   </div>
                                 </div>
                               </div>
                              
                              
                            </div>
                          </div>
                        )}
                      </div>

                     {/* Återstående daglig överföring - Collapsible Section */}
                     <div className="p-4 bg-amber-50 rounded-lg">
                       <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('remainingDailyTransfer')}>
                         <div>
                           <div className="text-sm text-muted-foreground">Återstående daglig överföring</div>
                           <div className="text-lg font-bold text-amber-600">
                             {formatCurrency(results.remainingDailyBudget)}
                           </div>
                         </div>
                         {expandedSections.remainingDailyTransfer ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                       </div>
                      
                       {expandedSections.remainingDailyTransfer && (
                         <div className="mt-4 space-y-4">
                           <div className="space-y-4">
                             <div className="p-4 bg-amber-100 rounded-lg border border-amber-200">
                               <div className="text-sm text-amber-700 font-medium mb-2">Beräkning återstående daglig överföring:</div>
                               <div className="space-y-1 pl-2">
                                 <div className="flex justify-between">
                                   <span>• Återstående vardagar: {results.remainingWeekdayCount || 0} × {formatCurrency(dailyTransfer)} =</span>
                                   <span className="font-medium">{formatCurrency((results.remainingWeekdayCount || 0) * dailyTransfer)}</span>
                                 </div>
                                 <div className="flex justify-between">
                                   <span>• Återstående helgdagar: {results.remainingFridayCount || 0} × {formatCurrency(weekendTransfer)} =</span>
                                   <span className="font-medium">{formatCurrency((results.remainingFridayCount || 0) * weekendTransfer)}</span>
                                 </div>
                                 <div className="flex justify-between pt-2 border-t">
                                   <span className="font-medium text-amber-800">Återstående daglig överföring:</span>
                                   <span className="font-semibold text-amber-800">{formatCurrency(results.remainingDailyBudget || 0)}</span>
                                 </div>
                               </div>
                             </div>
                           </div>
                         </div>
                       )}
                     </div>

                     {/* Verifiering section - renamed from "Kvar att fördela" */}
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium mb-3">Verifiering</h4>
                      <div className="space-y-3">
                         <div className="flex justify-between pt-2 border-t">
                           <span>Differens:</span>
                           <span className={`font-semibold ${(() => {
                             // Calculate unchecked accounts total
                              const uncheckedAccountsTotal = accounts.reduce((sum, account) => {
                                if (transferChecks[account]) return sum; // Skip checked accounts
                                const accountSavings = allSavingsItems
                                  .filter(group => group.account === account)
                                  .reduce((sum, group) => sum + group.amount, 0);
                               const accountCosts = costGroups.reduce((sum, group) => {
                                 const groupCosts = group.subCategories
                                   ?.filter(sub => sub.account === account)
                                   .reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                 return sum + groupCosts;
                               }, 0);
                               return sum + accountSavings + accountCosts;
                             }, 0);
                             
                              // Calculate unchecked individual shares
                              const uncheckedSharesTotal = 
                                (!andreasShareChecked ? results.andreasShare : 0) +
                                (!susannaShareChecked ? results.susannaShare : 0);
                              
                              const totalUnchecked = uncheckedAccountsTotal + uncheckedSharesTotal + results.remainingDailyBudget;
                             const difference = transferAccount - totalUnchecked;
                             return difference >= 0 ? 'text-green-600' : 'text-red-600';
                           })()}`}>
                             {(() => {
                               // Calculate unchecked accounts total
                                const uncheckedAccountsTotal = accounts.reduce((sum, account) => {
                                  if (transferChecks[account]) return sum; // Skip checked accounts
                                  const accountSavings = allSavingsItems
                                    .filter(group => group.account === account)
                                    .reduce((sum, group) => sum + group.amount, 0);
                                 const accountCosts = costGroups.reduce((sum, group) => {
                                   const groupCosts = group.subCategories
                                     ?.filter(sub => sub.account === account)
                                     .reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                   return sum + groupCosts;
                                 }, 0);
                                 return sum + accountSavings + accountCosts;
                               }, 0);
                               
                                // Calculate unchecked individual shares
                                const uncheckedSharesTotal = 
                                  (!andreasShareChecked ? results.andreasShare : 0) +
                                  (!susannaShareChecked ? results.susannaShare : 0);
                                
                                const totalUnchecked = uncheckedAccountsTotal + uncheckedSharesTotal + results.remainingDailyBudget;
                               return formatCurrency(transferAccount - totalUnchecked);
                             })()}
                           </span>
                         </div>
                         <div className="flex justify-between">
                           <span>Kvar på överföringskonto:</span>
                           <span className="font-medium">{(() => {
                             // Calculate unchecked accounts total
                                const uncheckedAccountsTotal = accounts.reduce((sum, account) => {
                                  if (transferChecks[account]) return sum; // Skip checked accounts
                                  const accountSavings = allSavingsItems
                                    .filter(group => group.account === account)
                                    .reduce((sum, group) => sum + group.amount, 0);
                               const accountCosts = costGroups.reduce((sum, group) => {
                                 const groupCosts = group.subCategories
                                   ?.filter(sub => sub.account === account)
                                   .reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                 return sum + groupCosts;
                               }, 0);
                               return sum + accountSavings + accountCosts;
                             }, 0);
                             
                              // Calculate unchecked individual shares
                              const uncheckedSharesTotal = 
                                (!andreasShareChecked ? results.andreasShare : 0) +
                                (!susannaShareChecked ? results.susannaShare : 0);
                              
                              const totalUnchecked = uncheckedAccountsTotal + uncheckedSharesTotal + results.remainingDailyBudget;
                             return formatCurrency(transferAccount - totalUnchecked);
                           })()}</span>
                         </div>
                      </div>
                    </div>
                  </div>
                 )}
                    </TabsContent>
                    
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 4: Egen Budget */}
          <TabsContent value="egen-budget" className="mt-0">
            <div className={`relative overflow-hidden ${
              isAnimating && previousTab === "egen-budget" 
                ? swipeDirection === "left" 
                  ? "animate-slide-out-left" 
                  : "animate-slide-out-right"
                : isAnimating && activeTab === "egen-budget"
                  ? swipeDirection === "left"
                    ? "animate-slide-in-right"
                    : "animate-slide-in-left"
                  : ""
            }`}>
              <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Min Budget
                </CardTitle>
                <CardDescription>
                  Hantera personlig budget för Andreas och Susanna
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Person Selection */}
                <div className="space-y-3">
                  <Label>Välj person</Label>
                  <RadioGroup value={selectedPerson} onValueChange={(value) => setSelectedPerson(value as 'andreas' | 'susanna')}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="andreas" id="andreas-radio" />
                      <Label htmlFor="andreas-radio">Andreas</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="susanna" id="susanna-radio" />
                      <Label htmlFor="susanna-radio">Susanna</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Personal Budget Controls */}
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Budget för {selectedPerson === 'andreas' ? 'Andreas' : 'Susanna'}</h4>
                  <Button size="sm" onClick={() => setIsEditingPersonalBudget(!isEditingPersonalBudget)}>
                    {isEditingPersonalBudget ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                  </Button>
                </div>

                {/* Personal Costs */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h5 className="font-medium">Personliga kostnader</h5>
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    <span className="flex-1">Totala personliga kostnader:</span>
                    {isEditingPersonalBudget ? (
                      <Input
                        type="number"
                        value={getCurrentPersonalCosts() === 0 ? '' : getCurrentPersonalCosts()}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          if (selectedPerson === 'andreas') {
                            setAndreasPersonalCosts(value);
                          } else {
                            setSusannaPersonalCosts(value);
                          }
                        }}
                        className="w-32"
                        placeholder="0"
                      />
                    ) : (
                      <span className="w-32 text-right font-medium text-destructive">
                        -{formatCurrency(getCurrentPersonalCosts())}
                      </span>
                    )}
                  </div>
                </div>

                {/* Personal Savings */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h5 className="font-medium">Personligt sparande</h5>
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    <span className="flex-1">Totalt personligt sparande:</span>
                    {isEditingPersonalBudget ? (
                      <Input
                        type="number"
                        value={getCurrentPersonalSavings() === 0 ? '' : getCurrentPersonalSavings()}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          if (selectedPerson === 'andreas') {
                            setAndreasPersonalSavings(value);
                          } else {
                            setSusannaPersonalSavings(value);
                          }
                        }}
                        className="w-32"
                        placeholder="0"
                      />
                    ) : (
                      <span className="w-32 text-right font-medium text-green-600">
                        -{formatCurrency(getCurrentPersonalSavings())}
                      </span>
                    )}
                  </div>
                </div>

                {/* Personal Budget Summary */}
                <div className="p-4 bg-muted rounded-lg">
                  <h5 className="font-medium mb-3">Sammanfattning - {selectedPerson === 'andreas' ? 'Andreas' : 'Susanna'}</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total andel:</span>
                      <span className="font-medium">
                        {results ? formatCurrency(getCurrentPersonIncome()) : 'Beräknar...'}
                      </span>
                    </div>
                    <div className="flex justify-between text-destructive">
                      <span>Totala kostnader:</span>
                      <span className="font-medium">
                        -{formatCurrency(getCurrentPersonalCosts())}
                      </span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Totalt sparande:</span>
                      <span className="font-medium">
                        -{formatCurrency(getCurrentPersonalSavings())}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-semibold">
                      <span>Kvar att spendera:</span>
                      <span className={`font-semibold ${
                        (getCurrentPersonIncome() - 
                         getCurrentPersonalCosts() - 
                         getCurrentPersonalSavings()) >= 0
                        ? 'text-green-600' : 'text-destructive'
                      }`}>
                        {results ? formatCurrency(
                          getCurrentPersonIncome() - 
                          getCurrentPersonalCosts() - 
                          getCurrentPersonalSavings()
                        ) : 'Beräknar...'}
                      </span>
                    </div>
                    {/* Daily Budget Fields for Personal Budget */}
                    {results && (
                      <>
                        <div className="flex justify-between border-t pt-2">
                          <span>Kvar per dag till den 25e ({results.daysUntil25th} dagar):</span>
                          <span className="font-medium">
                            {formatCurrency((getCurrentPersonIncome() - 
                              getCurrentPersonalCosts() - 
                              getCurrentPersonalSavings()) / results.daysUntil25th)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* Tab 5: Historia */}
          <TabsContent value="historia" className="mt-0">
            <div className={`relative overflow-hidden ${
              isAnimating && previousTab === "historia" 
                ? swipeDirection === "left" 
                  ? "animate-slide-out-left" 
                  : "animate-slide-out-right"
                : isAnimating && activeTab === "historia"
                  ? swipeDirection === "left"
                    ? "animate-slide-in-right"
                    : "animate-slide-in-left"
                  : ""
            }`}>
              <div className="space-y-4 sm:space-y-6 px-2 sm:px-4">
              {/* Charts Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Historisk Översikt
                  </CardTitle>
                  <CardDescription>
                    Visa utvecklingen av intäkter, kostnader och sparande över tid
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderHistoricalCharts()}
                </CardContent>
              </Card>

              {/* Update All Months Button */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Uppdatera alla månader
                  </CardTitle>
                  <CardDescription>
                    Gå igenom alla månader automatiskt för att uppdatera tabellen och grafen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!isUpdatingAllMonths ? (
                    <Button 
                      onClick={() => {
                        const monthsToUpdate = getMonthsToUpdate();
                        if (monthsToUpdate.length === 0) return;
                        
                        // Show progress and hide button
                        setIsUpdatingAllMonths(true);
                        setUpdateProgress(0);
                        
                        console.log('🔄 Starting update from first month with false flag:', monthsToUpdate);
                        
                        let currentIndex = 0;
                         // Store original month to return to after processing
                         const originalMonth = selectedBudgetMonth;
                        
                        const updateAllMonths = async () => {
                          if (currentIndex < monthsToUpdate.length) {
                            const monthKey = monthsToUpdate[currentIndex];
                            console.log(`🔄 Processing month ${currentIndex + 1}/${monthsToUpdate.length}: ${monthKey}`);
                            
                            // Update progress
                            const progress = Math.round((currentIndex / monthsToUpdate.length) * 100);
                            setUpdateProgress(progress);
                            
                            console.log(`📂 Using exact manual month change process for: ${monthKey}`);
                            
                            // Create a promise that resolves when the month change is completely done
                            const processMonth = new Promise<void>((resolve) => {
                              // Use handleBudgetMonthChange but wait for it to complete properly
                              console.log(`🔄 Starting handleBudgetMonthChange for ${monthKey}`);
                              
                              // Set up a completion detector
                              let checkCount = 0;
                              const maxChecks = 50; // Maximum 5 seconds
                              
                              // Start the month change process
                              handleBudgetMonthChange(monthKey);
                              
                              // Check periodically if the month change is complete
                              const checkCompletion = () => {
                                checkCount++;
                                
                                // Check if the month has been properly set and data loaded
                                if (selectedBudgetMonth === monthKey && historicalData[monthKey]) {
                                  console.log(`✅ Month change completed for ${monthKey} after ${checkCount * 100}ms`);
                                  
                                  // Set the flag for this month
                                  setMonthFinalBalances(prev => ({
                                    ...prev,
                                    [monthKey]: true
                                  }));
                                  
                                  resolve();
                                } else if (checkCount >= maxChecks) {
                                  console.warn(`⚠️ Month change timeout for ${monthKey}, proceeding anyway`);
                                  resolve();
                                } else {
                                  // Continue checking
                                  setTimeout(checkCompletion, 100);
                                }
                              };
                              
                              // Start checking after a brief delay
                              setTimeout(checkCompletion, 200);
                            });
                            
                            // Wait for the month processing to complete
                            await processMonth;
                            
                            // Wait a bit more to ensure all state updates are settled
                            await new Promise(resolve => setTimeout(resolve, 200));
                            
                            console.log(`✅ Month ${monthKey} fully processed`);
                            
                            currentIndex++;
                            
                            // Continue with next month
                            setTimeout(updateAllMonths, 100);
                          } else {
                            console.log('✅ All months updated successfully');
                            // Set progress to 100%
                            setUpdateProgress(100);
                            
                            // Wait a moment to show 100% completion
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Hide progress and show button again
                            setIsUpdatingAllMonths(false);
                            setUpdateProgress(0);
                            
                            // Return to the originally selected month without triggering full recalculation
                            if (originalMonth && historicalData[originalMonth]) {
                              console.log(`🔄 Returning to original month ${originalMonth}`);
                              
                              // Simply set the month and load its data
                              setSelectedBudgetMonth(originalMonth);
                              
                // Data läses nu automatiskt från central state när selectedBudgetMonth ändras
                              
                              // Force a final chart update with the loaded data
                              setTimeout(() => {
                                console.log(`📊 Final chart update for original month ${originalMonth}`);
                                calculateBudget();
                              }, 300);
                            }
                          }
                        };
                        
                        updateAllMonths();
                      }}
                      disabled={getMonthsToUpdate().length === 0}
                      className="w-full"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Uppdatera alla månader
                    </Button>
                  ) : (
                    <div className="w-full space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Uppdaterar månader...</span>
                        <span className="text-sm text-muted-foreground">{updateProgress}%</span>
                      </div>
                      <Progress value={updateProgress} className="w-full" />
                    </div>
                  )}
                  {getMonthsToUpdate().length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Kommer att gå igenom {getMonthsToUpdate().length} månader från första månad med flagga falsk: {getMonthsToUpdate().join(', ')}
                    </p>
                  )}
                  {getMonthsToUpdate().length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Alla månader är redan uppdaterade (alla flaggor är sanna)
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Account Balance History and Forecast */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Historik och Prognos på konton
                  </CardTitle>
                  <CardDescription>
                    Visa utvecklingen av kontosaldon med historiska data och prognoser
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderAccountBalanceChart()}
                </CardContent>
              </Card>

              {/* Account Data Table */}
              <div className="overflow-x-auto">
                <AccountDataTable 
                  data={accountDataRows}
                  className="w-full min-w-[640px]"
                />
              </div>

              {/* Month Selector and Data Display */}
              <Card>
                <CardHeader>
                  <CardTitle>Välj Månad</CardTitle>
                  <CardDescription>
                    Visa detaljerad information för en specifik månad
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderMonthSelector()}
                  {renderHistoricalData()}
                </CardContent>
              </Card>
              </div>
            </div>
          </TabsContent>

          {/* Sparmål Tab */}
          <TabsContent value="sparmal" className="mt-0">
            <div className={`relative overflow-hidden ${
              isAnimating && previousTab === "sparmal" 
                ? swipeDirection === "left" 
                  ? "animate-slide-out-left" 
                  : "animate-slide-out-right"
                : isAnimating && activeTab === "sparmal"
                  ? swipeDirection === "left"
                    ? "animate-slide-in-right"
                    : "animate-slide-in-left"
                  : ""
            } `}>
              <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground">
                      Skapa och följ upp dina långsiktiga sparmål
                    </p>
                  </div>
                  
                  <Dialog open={isCreateSavingsGoalDialogOpen} onOpenChange={setIsCreateSavingsGoalDialogOpen}>
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
                          <Label htmlFor="savings-name">Namn</Label>
                          <Input
                            id="savings-name"
                            placeholder="t.ex. Thailandresa"
                            value={newSavingsGoalName}
                            onChange={(e) => setNewSavingsGoalName(e.target.value)}
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="savings-account">Konto</Label>
                          <Select value={newSavingsGoalAccount} onValueChange={setNewSavingsGoalAccount}>
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
                          <Label htmlFor="savings-target">Målbelopp (kr)</Label>
                          <Input
                            id="savings-target"
                            type="number"
                            placeholder="50000"
                            value={newSavingsGoalTarget}
                            onChange={(e) => setNewSavingsGoalTarget(e.target.value)}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="savings-start">Startdatum</Label>
                            <Input
                              id="savings-start"
                              type="month"
                              value={newSavingsGoalStartDate}
                              onChange={(e) => setNewSavingsGoalStartDate(e.target.value)}
                            />
                          </div>
                          
                          <div className="grid gap-2">
                            <Label htmlFor="savings-end">Måldatum</Label>
                            <Input
                              id="savings-end"
                              type="month"
                              value={newSavingsGoalEndDate}
                              onChange={(e) => setNewSavingsGoalEndDate(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleCreateSavingsGoal}>Skapa sparmål</Button>
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
                      <Dialog open={isCreateSavingsGoalDialogOpen} onOpenChange={setIsCreateSavingsGoalDialogOpen}>
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
                      // Beräkna faktiskt sparat för detta sparmål
                      let actualSaved = 0;
                      Object.values(budgetState.historicalData).forEach(monthData => {
                        if (monthData.transactions) {
                          monthData.transactions.forEach(transaction => {
                            if (transaction.type === 'Savings' && 
                                transaction.accountId === goal.accountId &&
                                transaction.appCategoryId === goal.id) {
                              actualSaved += Math.abs(transaction.amount);
                            }
                          });
                        }
                      });
                      
                      const progress = Math.min((actualSaved / goal.targetAmount) * 100, 100);
                      const start = new Date(goal.startDate + '-01');
                      const end = new Date(goal.endDate + '-01');
                      const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                                         (end.getMonth() - start.getMonth()) + 1;
                      const monthlyAmount = goal.targetAmount / monthsDiff;
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
                                  {Math.round(monthlyAmount).toLocaleString()}
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
          </TabsContent>

          {/* Transaction Import Tab */}
          <TabsContent value="transaktioner" className="mt-0">
            <div className={`relative overflow-hidden ${
              isAnimating && previousTab === "transaktioner" 
                ? swipeDirection === "left" 
                  ? "animate-slide-out-left" 
                  : "animate-slide-out-right"
                : isAnimating && activeTab === "transaktioner"
                  ? swipeDirection === "left"
                    ? "animate-slide-in-right"
                    : "animate-slide-in-left"
                  : ""
            }`}>
              <TransactionImportEnhanced />
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="installningar" className="mt-0">
            <div className={`relative overflow-hidden ${
              isAnimating && previousTab === "installningar" 
                ? swipeDirection === "left" 
                  ? "animate-slide-out-left" 
                  : "animate-slide-out-right"
                : isAnimating && activeTab === "installningar"
                  ? swipeDirection === "left"
                    ? "animate-slide-in-right"
                    : "animate-slide-in-left"
                  : ""
            }`}>
              <div className="space-y-6">
              {/* Admin Mode Toggle */}
              <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Admin läge
                  </CardTitle>
                  <CardDescription>
                    Aktivera administratörsfunktioner
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ToggleGroup 
                    type="single" 
                    value={isAdminMode ? 'admin' : ''}
                    onValueChange={(value) => setIsAdminMode(value === 'admin')}
                    className="grid grid-cols-1 gap-2"
                  >
                    <ToggleGroupItem 
                      value="admin" 
                      className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      Admin
                    </ToggleGroupItem>
                  </ToggleGroup>
                </CardContent>
              </Card>

              {/* Main Categories Settings */}
              <MainCategoriesSettings 
                mainCategories={budgetState.mainCategories || []} 
              />

              {/* User Names Settings */}
              <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Användarnamn
                  </CardTitle>
                  <CardDescription>
                    Anpassa namnen som visas i systemet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="user1-name">Första användaren</Label>
                      <Input
                        id="user1-name"
                        value={userName1}
                        onChange={(e) => setUserName1(e.target.value)}
                        placeholder="Ange namn för första användaren"
                        className="text-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user2-name">Andra användaren</Label>
                      <Input
                        id="user2-name"
                        value={userName2}
                        onChange={(e) => setUserName2(e.target.value)}
                        placeholder="Ange namn för andra användaren"
                        className="text-lg"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <p className="font-medium mb-2">Dessa namn används:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• I inkomstfälten</li>
                      <li>• I budgetfördelningen</li>
                      <li>• I den personliga budgeten</li>
                      <li>• I alla rapporter och sammanställningar</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Backup Section */}
              <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Save className="h-5 w-5 text-primary" />
                    Backup
                  </CardTitle>
                  <CardDescription>
                    Spara och ladda backup med all historisk data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Button onClick={saveBackup} className="w-full">
                      <Save className="mr-2 h-4 w-4" />
                      Spara backup
                    </Button>
                    <Button 
                      onClick={loadBackup} 
                      variant="outline" 
                      className="w-full"
                      disabled={!standardValues}
                    >
                      Ladda backup
                    </Button>
                  </div>
                  
                  {standardValues && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      <p className="font-medium mb-2">Backup innehåller:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• Alla inkomster och kategorier</li>
                        <li>• All historisk data för alla månader</li>
                        <li>• Personliga budgetar</li>
                        <li>• Överföringsinställningar</li>
                        <li>• Anpassade helgdagar</li>
                        <li>• Användarnamn</li>
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Advanced Month Options */}
              <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Avancerade månadsalternativ
                  </CardTitle>
                  <CardDescription>
                    Hantera månader och historiska data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Copy from month section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Kopiera från månad till en ny månad</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="copy-source-month">Kopiera från månad</Label>
                        <select
                          id="copy-source-month"
                          value={selectedSourceMonth}
                          onChange={(e) => setSelectedSourceMonth(e.target.value)}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="">Välj källmånad</option>
                          {[...availableMonths].sort().reverse().map(month => (
                            <option key={month} value={month}>{month}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="copy-new-month">Ny månad</Label>
                        <Input
                          id="copy-new-month"
                          type="month"
                          value={newMonthFromCopy}
                          onChange={(e) => setNewMonthFromCopy(e.target.value)}
                          className="text-lg"
                          placeholder="Ny månad"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button 
                          onClick={() => {
                            if (selectedSourceMonth && newMonthFromCopy && !historicalData[newMonthFromCopy]) {
                              const sourceData = historicalData[selectedSourceMonth];
                              const newMonthData = {
                                ...sourceData,
                                month: newMonthFromCopy,
                                date: new Date().toISOString()
                              };
                              updateHistoricalDataSingle(newMonthFromCopy, newMonthData);
                              setNewMonthFromCopy('');
                              setSelectedSourceMonth('');
                            }
                          }}
                          disabled={!selectedSourceMonth || !newMonthFromCopy}
                          className="w-full"
                        >
                          Kopiera månad
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Delete month section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Ta bort månad</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="delete-month-selector">Välj månad att ta bort</Label>
                        <select
                          id="delete-month-selector"
                          value={selectedHistoricalMonth}
                          onChange={(e) => setSelectedHistoricalMonth(e.target.value)}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="">Välj en månad</option>
                          {[...availableMonths].sort().reverse().map(month => (
                            <option key={month} value={month}>{month}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <Button 
                          onClick={() => {
                            if (selectedHistoricalMonth && historicalData[selectedHistoricalMonth]) {
                              const monthToDelete = selectedHistoricalMonth;
                              
                              // Create updated historical data without the deleted month
                              const newHistoricalData = { ...historicalData };
                              delete newHistoricalData[monthToDelete];
                              
                              // Update state
                              setHistoricalData(newHistoricalData);
                              
                              // Reset selection after deletion
                              setSelectedHistoricalMonth('');
                              
                              // Save directly to localStorage with updated data
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
                                customHolidays,
                                selectedPerson,
                                andreasPersonalCosts,
                                andreasPersonalSavings,
                                susannaPersonalCosts,
                                susannaPersonalSavings,
                                historicalData: newHistoricalData, // Use the updated data
                                accounts,
                                budgetTemplates,
                                selectedBudgetMonth,
                                userName1,
                                userName2,
                                transferChecks,
                                andreasShareChecked,
                                susannaShareChecked,
                                showIndividualCostsOutsideBudget,
                                showSavingsSeparately
                              };
                              localStorage.setItem('budgetCalculatorData', JSON.stringify(dataToSave));
                              
                              // If the deleted month was the currently selected budget month, reset to current month
                              if (selectedBudgetMonth === monthToDelete) {
                                const currentDate = new Date();
                                const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                                setSelectedBudgetMonth(currentMonthKey);
                                
                                // Load current month data if it exists, otherwise create it with current form values
                                if (historicalData[currentMonthKey]) {
                                  loadDataFromSelectedMonth(currentMonthKey);
                                }
                              }
                            }
                          }}
                          disabled={!selectedHistoricalMonth}
                          variant="destructive"
                          className="w-full"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Ta bort månad
                        </Button>
                      </div>
                    </div>
                    {selectedHistoricalMonth && (
                      <div className="text-sm text-muted-foreground">
                        Vald månad: <strong>{selectedHistoricalMonth}</strong>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

               {/* Budget Templates */}
               <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                     <History className="h-5 w-5 text-primary" />
                     Budgetmallar
                   </CardTitle>
                   <CardDescription>
                     Skapa och hantera budgetmallar från befintliga månader
                   </CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-6">
                   {/* Copy Template to Month Section */}
                   <div className="space-y-4 p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                     <h3 className="text-lg font-semibold text-primary">Kopiera Budgetmall till Månad</h3>
                     <p className="text-sm text-muted-foreground">
                       Välj en budgetmall att kopiera till Min Månadsbudget för en specifik månad
                     </p>
                     
                     {Object.keys(budgetTemplates).length > 0 ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label htmlFor="template-to-copy">Välj budgetmall</Label>
                           <Select value={selectedTemplateToCopy} onValueChange={setSelectedTemplateToCopy}>
                             <SelectTrigger>
                               <SelectValue placeholder="Välj en budgetmall att kopiera" />
                             </SelectTrigger>
                             <SelectContent>
                               {Object.keys(budgetTemplates).sort().map(templateName => (
                                 <SelectItem key={templateName} value={templateName}>
                                   {templateName}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                         
                         <div className="space-y-2">
                           <Label htmlFor="target-month">Månad att kopiera till</Label>
                           <Input
                             id="target-month"
                             type="month"
                             value={targetCopyMonth}
                             onChange={(e) => setTargetCopyMonth(e.target.value)}
                             className="text-lg"
                             placeholder="Välj månad"
                           />
                         </div>
                       </div>
                     ) : (
                       <div className="text-center py-4 text-muted-foreground">
                         <p>Inga budgetmallar skapade än. Skapa en mall först nedan.</p>
                       </div>
                     )}
                     
                     {selectedTemplateToCopy && Object.keys(budgetTemplates).length > 0 && (
                       <div className="space-y-4">
                         {/* Template Details */}
                         <div className="p-3 bg-muted/50 rounded-lg">
                           <div className="flex items-center justify-between mb-3">
                             <h4 className="font-medium">Detaljer för: {selectedTemplateToCopy}</h4>
                             <Button
                               onClick={() => setShowTemplateDetails(!showTemplateDetails)}
                               variant="outline"
                               size="sm"
                             >
                               {showTemplateDetails ? 'Dölj detaljer' : 'Visa detaljer'}
                             </Button>
                           </div>
                           
                           {budgetTemplates[selectedTemplateToCopy] && (
                             <div className="grid grid-cols-2 gap-4 text-sm">
                               <div>
                                 <span className="text-muted-foreground">Skapad:</span>
                                 <p className="font-medium">
                                   {new Date(budgetTemplates[selectedTemplateToCopy].created).toLocaleDateString('sv-SE')}
                                 </p>
                               </div>
                               <div>
                                 <span className="text-muted-foreground">Från månad:</span>
                                 <p className="font-medium">
                                   {budgetTemplates[selectedTemplateToCopy].sourceMonth === 'current' 
                                     ? 'Aktuell månad' 
                                     : budgetTemplates[selectedTemplateToCopy].sourceMonth}
                                 </p>
                               </div>
                             </div>
                           )}
                           
                           {showTemplateDetails && budgetTemplates[selectedTemplateToCopy] && (
                             <div className="mt-4 space-y-3">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                 <div>
                                   <h5 className="font-medium text-green-600 mb-2">Inkomster</h5>
                                   <div className="space-y-1">
                                     <div className="flex justify-between">
                                       <span>{userName1}:</span>
                                       <span>{formatCurrency(budgetTemplates[selectedTemplateToCopy].andreasSalary + budgetTemplates[selectedTemplateToCopy].andreasförsäkringskassan + budgetTemplates[selectedTemplateToCopy].andreasbarnbidrag)}</span>
                                     </div>
                                     <div className="flex justify-between">
                                       <span>{userName2}:</span>
                                       <span>{formatCurrency(budgetTemplates[selectedTemplateToCopy].susannaSalary + budgetTemplates[selectedTemplateToCopy].susannaförsäkringskassan + budgetTemplates[selectedTemplateToCopy].susannabarnbidrag)}</span>
                                     </div>
                                   </div>
                                 </div>
                                 <div>
                                   <h5 className="font-medium text-red-600 mb-2">Kostnader</h5>
                                   <div className="space-y-1">
                                     {budgetTemplates[selectedTemplateToCopy].costGroups?.slice(0, 3).map((group: any) => (
                                       <div key={group.id} className="flex justify-between">
                                         <span>{group.name}:</span>
                                         <span>{formatCurrency(group.amount)}</span>
                                       </div>
                                     ))}
                                     {budgetTemplates[selectedTemplateToCopy].costGroups?.length > 3 && (
                                       <div className="text-muted-foreground">
                                         +{budgetTemplates[selectedTemplateToCopy].costGroups.length - 3} fler kategorier...
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               </div>
                             </div>
                           )}
                         </div>
                         
                         {/* Copy Action */}
                         <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => copyTemplateToMonth()}
                              disabled={!selectedTemplateToCopy || !targetCopyMonth}
                              className="w-full bg-primary hover:bg-primary/90"
                              size="lg"
                            >
                             <Plus className="mr-2 h-4 w-4" />
                             Kopiera "{selectedTemplateToCopy}" till {targetCopyMonth}
                           </Button>
                           {targetCopyMonth && historicalData[targetCopyMonth] && (
                             <p className="text-sm text-amber-600 text-center">
                               ⚠️ Denna månad har redan data. Kopieringen kommer att ersätta befintlig data.
                             </p>
                           )}
                         </div>
                       </div>
                     )}
                   </div>

                   {/* Create new template */}
                   <div className="space-y-4">
                     <h3 className="text-lg font-semibold">Skapa ny budgetmall</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <Label htmlFor="template-name">Mallnamn</Label>
                         <Input
                           id="template-name"
                           value={newTemplateName}
                           onChange={(e) => setNewTemplateName(e.target.value)}
                           placeholder="Ange namn för budgetmall"
                           className="text-lg"
                         />
                       </div>
                       <div className="space-y-2">
                         <Label htmlFor="template-source">Skapa från månad</Label>
                         <Select value={selectedTemplateSourceMonth} onValueChange={setSelectedTemplateSourceMonth}>
                           <SelectTrigger>
                             <SelectValue placeholder="Välj månad" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="current">Aktuell månad</SelectItem>
                              {[...availableMonths].sort().reverse().map(month => (
                                <SelectItem key={month} value={month}>{month}</SelectItem>
                              ))}
                           </SelectContent>
                         </Select>
                       </div>
                     </div>
                     
                     <Button
                       onClick={() => {
                         if (newTemplateName && selectedTemplateSourceMonth) {
                           const sourceData = selectedTemplateSourceMonth === 'current' 
                             ? {
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
                                 customHolidays,
                                 andreasPersonalCosts,
                                 andreasPersonalSavings,
                                 susannaPersonalCosts,
                                 susannaPersonalSavings,
                                 accounts
                               }
                             : historicalData[selectedTemplateSourceMonth];
                           
                           const templateData = {
                             name: newTemplateName.trim(),
                             created: new Date().toISOString(),
                             sourceMonth: selectedTemplateSourceMonth,
                             andreasSalary: sourceData.andreasSalary || 0,
                             andreasförsäkringskassan: sourceData.andreasförsäkringskassan || 0,
                             andreasbarnbidrag: sourceData.andreasbarnbidrag || 0,
                             susannaSalary: sourceData.susannaSalary || 0,
                             susannaförsäkringskassan: sourceData.susannaförsäkringskassan || 0,
                             susannabarnbidrag: sourceData.susannabarnbidrag || 0,
                             costGroups: JSON.parse(JSON.stringify(sourceData.costGroups || [])),
                             savingsGroups: JSON.parse(JSON.stringify(sourceData.savingsGroups || [])),
                             dailyTransfer: sourceData.dailyTransfer || 300,
                             weekendTransfer: sourceData.weekendTransfer || 540,
                             customHolidays: JSON.parse(JSON.stringify(sourceData.customHolidays || [])),
                             andreasPersonalCosts: JSON.parse(JSON.stringify(sourceData.andreasPersonalCosts || [])),
                             andreasPersonalSavings: JSON.parse(JSON.stringify(sourceData.andreasPersonalSavings || [])),
                             susannaPersonalCosts: JSON.parse(JSON.stringify(sourceData.susannaPersonalCosts || [])),
                             susannaPersonalSavings: JSON.parse(JSON.stringify(sourceData.susannaPersonalSavings || [])),
                             accounts: JSON.parse(JSON.stringify(budgetState.accounts.map(acc => acc.name))),
                             date: new Date().toISOString()
                           };
                           
                           const updatedTemplates = {
                             ...budgetTemplates,
                             [newTemplateName.trim()]: templateData
                           };
                           
                           setBudgetTemplates(updatedTemplates);
                           setNewTemplateName('');
                           setSelectedTemplateSourceMonth('');
                         }
                       }}
                       disabled={!newTemplateName || !selectedTemplateSourceMonth}
                       className="w-full"
                     >
                       <Plus className="mr-2 h-4 w-4" />
                       Skapa budgetmall
                     </Button>
                   </div>

                    {/* Existing Templates Management */}
                    {Object.keys(budgetTemplates).length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Hantera befintliga mallar</h3>
                        <div className="space-y-2">
                          {Object.keys(budgetTemplates).sort().map(templateName => (
                            <Collapsible key={templateName} open={expandedTemplates[templateName]}>
                              <div className="border rounded-lg">
                                <CollapsibleTrigger asChild>
                                  <button 
                                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50"
                                    onClick={() => setExpandedTemplates(prev => ({
                                      ...prev,
                                      [templateName]: !prev[templateName]
                                    }))}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <div>
                                        <span className="font-medium">{templateName}</span>
                                        <p className="text-sm text-muted-foreground">
                                          Skapad: {new Date(budgetTemplates[templateName].created).toLocaleDateString('sv-SE')}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex gap-2">
                                          <Button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              startEditingTemplate(templateName);
                                            }}
                                            size="sm"
                                            variant="outline"
                                          >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Redigera
                                          </Button>
                                          <Button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const updatedTemplates = { ...budgetTemplates };
                                              delete updatedTemplates[templateName];
                                              setBudgetTemplates(updatedTemplates);
                                            }}
                                            size="sm"
                                            variant="destructive"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedTemplates[templateName] ? 'rotate-180' : ''}`} />
                                      </div>
                                    </div>
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="p-3 pt-0 border-t">
                                    {(() => {
                                      const template = budgetTemplates[templateName];
                                      if (!template) return null;
                                      
                                      const totalCosts = template.costGroups?.reduce((sum: number, group: any) => {
                                        const subTotal = group.subCategories?.reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
                                        return sum + subTotal;
                                      }, 0) || 0;
                                      
                                      const totalSavings = template.savingsGroups?.reduce((sum: number, group: any) => sum + group.amount, 0) || 0;
                                      
                                      // Check if this template is being edited
                                      if (editingTemplate === templateName && editingTemplateData) {
                                        return (
                                          <div className="space-y-4">
                                            {/* Edit Mode Header with totals */}
                                             <div className="mb-4 p-3 bg-muted/50 rounded-lg space-y-3">
                                               <div className="grid grid-cols-2 gap-4">
                                                 <div>
                                                   <span className="font-medium">Totala kostnader:</span>
                                                   <div className="text-destructive">
                                                     {formatCurrency(editingTemplateData.costGroups?.reduce((sum: number, group: any) => {
                                                       const subTotal = group.subCategories?.reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
                                                       return sum + subTotal;
                                                     }, 0) || 0)}
                                                   </div>
                                                 </div>
                                                 <div>
                                                   <span className="font-medium">Total daglig budget:</span>
                                                   <div className="text-destructive">
                                                     {editingTemplateData.dailyTransfer && editingTemplateData.weekendTransfer ? formatCurrency(
                                                       (() => {
                                                         const [year, month] = selectedBudgetMonth.split('-').map(Number);
                                                         const { weekdayCount, fridayCount } = calculateDaysForMonth(year, month - 1);
                                                         return (weekdayCount * editingTemplateData.dailyTransfer) + (fridayCount * editingTemplateData.weekendTransfer);
                                                       })()
                                                     ) : '0 kr'}
                                                   </div>
                                                 </div>
                                               </div>
                                               <div>
                                                 <span className="font-medium">Totalt sparande:</span>
                                                 <div className="text-green-600">
                                                   {formatCurrency(editingTemplateData.savingsGroups?.reduce((sum: number, group: any) => sum + group.amount, 0) || 0)}
                                                 </div>
                                               </div>
                                             </div>

                                            {/* Transfer Settings */}
                                            <div className="space-y-3 p-3 border rounded-lg bg-blue-50/50">
                                              <h4 className="font-medium text-blue-800">Överföringsinställningar</h4>
                                              <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                  <Label className="text-xs">Daglig överföring (måndag-torsdag)</Label>
                                                  <Input
                                                    type="number"
                                                    value={editingTemplateData.dailyTransfer || 0}
                                                    onChange={(e) => updateEditingTemplateTransfer('dailyTransfer', parseFloat(e.target.value) || 0)}
                                                    className="h-8"
                                                  />
                                                </div>
                                                <div>
                                                  <Label className="text-xs">Helgöverföring (fredag-söndag)</Label>
                                                  <Input
                                                    type="number"
                                                    value={editingTemplateData.weekendTransfer || 0}
                                                    onChange={(e) => updateEditingTemplateTransfer('weekendTransfer', parseFloat(e.target.value) || 0)}
                                                    className="h-8"
                                                  />
                                                </div>
                                              </div>
                                              {editingTemplateData.dailyTransfer && editingTemplateData.weekendTransfer && (
                                                <div className="text-xs text-muted-foreground">
                                                  Total daglig budget: {formatCurrency(
                                                    (() => {
                                                      const [year, month] = selectedBudgetMonth.split('-').map(Number);
                                                      const { weekdayCount, fridayCount } = calculateDaysForMonth(year, month - 1);
                                                      return (weekdayCount * editingTemplateData.dailyTransfer) + (fridayCount * editingTemplateData.weekendTransfer);
                                                    })()
                                                  )}
                                                </div>
                                              )}
                                            </div>

                                            {/* Cost Categories */}
                                            <div>
                                              <h4 className="font-medium mb-2">Kostnadskategorier</h4>
                                              {editingTemplateData.costGroups?.map((group: any) => (
                                                <div key={group.id} className="mb-4 p-3 border rounded-md">
                                                  <div className="grid grid-cols-3 gap-2 mb-2">
                                                     <div>
                                                       <Label className="text-xs">Huvudkategori</Label>
                                                       <Select 
                                                         value={group.name} 
                                                         onValueChange={(value) => updateEditingTemplateGroup(group.id, 'name', value)}
                                                       >
                                                         <SelectTrigger className="h-8">
                                                           <SelectValue placeholder="Välj huvudkategori" />
                                                         </SelectTrigger>
                                                         <SelectContent className="bg-popover border border-border shadow-lg z-50">
                                                           {(budgetState.mainCategories || []).map((category) => (
                                                             <SelectItem key={category} value={category}>
                                                               {category}
                                                             </SelectItem>
                                                           ))}
                                                         </SelectContent>
                                                       </Select>
                                                      </div>
                                                     <div>
                                                       <Label className="text-xs">Konto</Label>
                                                       <Select 
                                                         value={group.account || ''} 
                                                         onValueChange={(value) => updateEditingTemplateGroup(group.id, 'account', value)}
                                                       >
                                                         <SelectTrigger className="h-8">
                                                           <SelectValue placeholder="Välj konto" />
                                                         </SelectTrigger>
                                                         <SelectContent>
                                                           {accounts.map(account => (
                                                             <SelectItem key={account} value={account}>{account}</SelectItem>
                                                           ))}
                                                         </SelectContent>
                                                       </Select>
                                                     </div>
                                                     <div>
                                                       <Label className="text-xs">Finansieras ifrån</Label>
                                                       <Select 
                                                         value={group.financedFrom || 'Löpande kostnad'} 
                                                         onValueChange={(value) => updateEditingTemplateGroup(group.id, 'financedFrom', value)}
                                                       >
                                                         <SelectTrigger className="h-8">
                                                           <SelectValue />
                                                         </SelectTrigger>
                                                         <SelectContent>
                                                           <SelectItem value="Löpande kostnad">Löpande kostnad</SelectItem>
                                                           <SelectItem value="Enskild kostnad">Enskild kostnad</SelectItem>
                                                         </SelectContent>
                                                       </Select>
                                                     </div>
                                                    {(!group.subCategories || group.subCategories.length === 0) && (
                                                      <div>
                                                        <Label className="text-xs">Belopp</Label>
                                                        <Input
                                                          type="number"
                                                          value={group.amount}
                                                          onChange={(e) => updateEditingTemplateGroup(group.id, 'amount', parseFloat(e.target.value) || 0)}
                                                          className="h-8"
                                                        />
                                                      </div>
                                                    )}
                                                  </div>
                                                  
                                                  {/* Subcategories */}
                                                  {group.subCategories && group.subCategories.length > 0 && (
                                                    <div className="ml-4 space-y-2">
                                                      <Label className="text-xs text-muted-foreground">Kostnadsposter:</Label>
                                                       {group.subCategories.map((sub: any) => (
                                                         <div key={sub.id} className="grid grid-cols-4 gap-2">
                                                           <Input
                                                             value={sub.name}
                                                             onChange={(e) => updateEditingTemplateGroup(group.id, 'name', e.target.value, true, sub.id)}
                                                             className="h-7 text-xs"
                                                             placeholder="Kostnadspost"
                                                           />
                                                           <Select 
                                                             value={sub.account || ''} 
                                                             onValueChange={(value) => updateEditingTemplateGroup(group.id, 'account', value, true, sub.id)}
                                                           >
                                                             <SelectTrigger className="h-7 text-xs">
                                                               <SelectValue placeholder="Konto" />
                                                             </SelectTrigger>
                                                             <SelectContent>
                                                               {accounts.map(account => (
                                                                 <SelectItem key={account} value={account}>{account}</SelectItem>
                                                               ))}
                                                             </SelectContent>
                                                           </Select>
                                                           <Select 
                                                             value={sub.financedFrom || 'Löpande kostnad'} 
                                                             onValueChange={(value) => updateEditingTemplateGroup(group.id, 'financedFrom', value, true, sub.id)}
                                                           >
                                                             <SelectTrigger className="h-7 text-xs">
                                                               <SelectValue placeholder="Finansieras" />
                                                             </SelectTrigger>
                                                             <SelectContent>
                                                               <SelectItem value="Löpande kostnad">Löpande kostnad</SelectItem>
                                                               <SelectItem value="Enskild kostnad">Enskild kostnad</SelectItem>
                                                             </SelectContent>
                                                           </Select>
                                                           <Input
                                                             type="number"
                                                             value={sub.amount}
                                                             onChange={(e) => updateEditingTemplateGroup(group.id, 'amount', parseFloat(e.target.value) || 0, true, sub.id)}
                                                             className="h-7 text-xs"
                                                             placeholder="Belopp"
                                                           />
                                                         </div>
                                                       ))}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>

                                            {/* Savings Categories */}
                                            <div>
                                              <h4 className="font-medium mb-2">Sparandekategorier</h4>
                                              {editingTemplateData.savingsGroups?.map((group: any) => (
                                                 <div key={group.id} className="mb-4 p-3 border rounded-md">
                                                   <div className="grid grid-cols-3 gap-2">
                                                     <div>
                                                       <Label className="text-xs">Kategori</Label>
                                                       <Input
                                                         value={group.name}
                                                         onChange={(e) => updateEditingTemplateGroup(group.id, 'name', e.target.value)}
                                                         className="h-8"
                                                       />
                                                     </div>
                                                     <div>
                                                       <Label className="text-xs">Konto</Label>
                                                       <Select 
                                                         value={group.account || ''} 
                                                         onValueChange={(value) => updateEditingTemplateGroup(group.id, 'account', value)}
                                                       >
                                                         <SelectTrigger className="h-8">
                                                           <SelectValue placeholder="Välj konto" />
                                                         </SelectTrigger>
                                                         <SelectContent>
                                                           {accounts.map(account => (
                                                             <SelectItem key={account} value={account}>{account}</SelectItem>
                                                           ))}
                                                         </SelectContent>
                                                       </Select>
                                                     </div>
                                                     <div>
                                                       <Label className="text-xs">Belopp</Label>
                                                       <Input
                                                         type="number"
                                                         value={group.amount}
                                                         onChange={(e) => updateEditingTemplateGroup(group.id, 'amount', parseFloat(e.target.value) || 0)}
                                                         className="h-8"
                                                       />
                                                     </div>
                                                   </div>
                                                 </div>
                                              ))}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 pt-4 border-t">
                                              <Button onClick={saveEditedTemplate} className="flex-1">
                                                <Save className="w-4 h-4 mr-2" />
                                                Spara
                                              </Button>
                                              <Button onClick={cancelEditingTemplate} variant="outline" className="flex-1">
                                                Avbryt
                                              </Button>
                                            </div>
                                          </div>
                                        );
                                      }

                                      // View Mode
                                      return (
                                        <div className="space-y-3 text-sm">
                                           <div className="space-y-3">
                                             <div className="grid grid-cols-2 gap-4">
                                               <div>
                                                 <span className="font-medium">Totala kostnader:</span>
                                                 <div className="text-destructive">{formatCurrency(totalCosts)}</div>
                                               </div>
                                               <div>
                                                 <span className="font-medium">Total daglig budget:</span>
                                                 <div className="text-destructive">
                                                   {template.dailyTransfer && template.weekendTransfer ? formatCurrency(
                                                     (() => {
                                                       const [year, month] = selectedBudgetMonth.split('-').map(Number);
                                                       const { weekdayCount, fridayCount } = calculateDaysForMonth(year, month - 1);
                                                       return (weekdayCount * template.dailyTransfer) + (fridayCount * template.weekendTransfer);
                                                     })()
                                                   ) : '0 kr'}
                                                 </div>
                                               </div>
                                             </div>
                                             <div>
                                               <span className="font-medium">Totalt sparande:</span>
                                               <div className="text-green-600">{formatCurrency(totalSavings)}</div>
                                             </div>
                                           </div>
                                          
                                          {/* Daily Budget Summary with updated layout */}
                                           {template.dailyTransfer && template.weekendTransfer && (
                                             <div className="border-t pt-3">
                                               <div className="font-medium text-base mb-2">
                                                  Total daglig budget
                                               </div>
                                               <div className="ml-4 space-y-1 text-xs text-muted-foreground">
                                                 <div>Totalt belopp: {formatCurrency(
                                                    (() => {
                                                      const [year, month] = selectedBudgetMonth.split('-').map(Number);
                                                      const { weekdayCount, fridayCount } = calculateDaysForMonth(year, month - 1);
                                                      return (weekdayCount * template.dailyTransfer) + (fridayCount * template.weekendTransfer);
                                                    })()
                                                  )}</div>
                                                 <div>• Daglig överföring (måndag-torsdag): {template.dailyTransfer}</div>
                                                 <div>• Helgöverföring (fredag): {template.weekendTransfer}</div>
                                                  {(() => {
                                                    const [year, month] = selectedBudgetMonth.split('-').map(Number);
                                                    const { weekdayCount, fridayCount } = calculateDaysForMonth(year, month - 1);
                                                    const weekdaysExcludingFridays = weekdayCount - fridayCount;
                                                    return (
                                                      <>
                                                        <div>• Vardagar: {weekdaysExcludingFridays} × {template.dailyTransfer} kr = {formatCurrency(weekdaysExcludingFridays * template.dailyTransfer)}</div>
                                                        <div>• Helgdagar: {fridayCount} × {template.weekendTransfer} kr = {formatCurrency(fridayCount * template.weekendTransfer)}</div>
                                                      </>
                                                    );
                                                  })()}
                                               </div>
                                             </div>
                                           )}
                                         
                                         {template.costGroups && template.costGroups.length > 0 && (
                                           <div>
                                             <span className="font-medium">Kostnadskategorier:</span>
                                             <ul className="ml-4 mt-1 space-y-1">
                                               {template.costGroups.map((group: any) => {
                                                 const groupTotal = group.subCategories?.reduce((sum: number, sub: any) => sum + sub.amount, 0) || 0;
                                                 return (
                                                   <li key={group.id} className="text-xs">
                                                     <div className="font-medium">{group.name}: {formatCurrency(groupTotal)}</div>
                                                     {group.subCategories && group.subCategories.length > 0 && (
                                                       <ul className="ml-4 mt-1 space-y-1">
                                                         {group.subCategories.map((sub: any, index: number) => (
                                                           <li key={index} className="text-xs text-muted-foreground">
                                                             • {sub.name}: {formatCurrency(sub.amount)}{sub.account ? ` (${sub.account})` : ''}
                                                           </li>
                                                         ))}
                                                       </ul>
                                                     )}
                                                   </li>
                                                 );
                                               })}
                                             </ul>
                                           </div>
                                         )}
                                         
                                         {template.savingsGroups && template.savingsGroups.length > 0 && (
                                           <div>
                                             <span className="font-medium">Sparandekategorier:</span>
                                             <ul className="ml-4 mt-1 space-y-1">
                                               {template.savingsGroups.map((group: any) => (
                                                 <li key={group.id} className="text-xs">
                                                   {group.name}: {formatCurrency(group.amount)}
                                                 </li>
                                               ))}
                                             </ul>
                                           </div>
                                         )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          ))}
                        </div>
                      </div>
                     )}
                 </CardContent>
               </Card>

               {/* Account Management Section */}
               <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                     <DollarSign className="h-5 w-5 text-primary" />
                     Ändra konton
                   </CardTitle>
                   <CardDescription>
                     Hantera konton och kontokategorier
                   </CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-6">
                   {/* Account Categories Management */}
                   <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <h3 className="text-lg font-semibold">Kontokategorier</h3>
                       <Button 
                         size="sm" 
                         variant="outline" 
                         onClick={() => setIsEditingAccountCategories(!isEditingAccountCategories)}
                       >
                         {isEditingAccountCategories ? 'Stäng' : 'Redigera kategorier'}
                       </Button>
                     </div>

                     {isEditingAccountCategories && (
                       <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                         <div className="flex gap-2">
                           <Input
                             placeholder="Ny kontokategori"
                             value={newCategoryName}
                             onChange={(e) => setNewCategoryName(e.target.value)}
                             className="flex-1"
                           />
                           <Button onClick={addAccountCategory} disabled={!newCategoryName.trim()}>
                             <Plus className="h-4 w-4" />
                           </Button>
                         </div>
                         
                         <div className="space-y-2">
                           <h4 className="font-medium">Befintliga kategorier:</h4>
                           {accountCategories.map((category) => (
                             <div key={category} className="flex justify-between items-center p-2 bg-white rounded border">
                               <span className="font-medium">{category}</span>
                               <Button
                                 size="sm"
                                 variant="ghost"
                                 onClick={() => removeAccountCategory(category)}
                                 className="text-red-600 hover:text-red-800 hover:bg-red-50"
                               >
                                 <Trash2 className="h-4 w-4" />
                               </Button>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>

                   {/* Account Management */}
                   <div className="space-y-4">
                     <div className="flex items-center justify-between">
                       <h3 className="text-lg font-semibold">Konton</h3>
                       <Button 
                         size="sm" 
                         variant="outline" 
                         onClick={() => setIsEditingAccounts(!isEditingAccounts)}
                       >
                         {isEditingAccounts ? 'Stäng' : 'Redigera konton'}
                       </Button>
                     </div>

                     {isEditingAccounts && (
                       <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                         <div className="flex gap-2">
                           <Input
                             placeholder="Nytt kontonamn"
                             value={newAccountName}
                             onChange={(e) => setNewAccountName(e.target.value)}
                             className="flex-1"
                           />
                           <Button onClick={addAccount} disabled={!newAccountName.trim()}>
                             <Plus className="h-4 w-4" />
                           </Button>
                         </div>
                         
                         <div className="space-y-2">
                           <h4 className="font-medium">Befintliga konton:</h4>
                           {accounts.map((account, index) => {
                             const accountName = typeof account === 'string' ? account : (account as any).name || '';
                             return (
                               <div key={accountName} className="flex justify-between items-center p-2 bg-white rounded border">
                                 <span className="font-medium">{accountName}</span>
                                 <Button
                                   size="sm"
                                   variant="ghost"
                                   onClick={() => removeAccount(accountName)}
                                   className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </div>
                             );
                           })}
                         </div>
                       </div>
                     )}
                   </div>

                   {/* Account Category Mapping */}
                   <div className="space-y-4">
                     <h3 className="text-lg font-semibold">Kategorimappning</h3>
                     <p className="text-sm text-muted-foreground">
                       Koppla varje konto till en kontokategori för bättre organisation
                     </p>
                     
                     <div className="space-y-3">
                       {accounts.map((account) => {
                         const accountName = typeof account === 'string' ? account : (account as any).name || '';
                         return (
                           <div key={accountName} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                             <span className="font-medium">{accountName}</span>
                             <Select
                               value={accountCategoryMapping[accountName] || 'none'}
                               onValueChange={(value) => updateAccountCategory(accountName, value)}
                             >
                               <SelectTrigger className="w-48">
                                 <SelectValue placeholder="Välj kategori" />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="none">Ingen kategori</SelectItem>
                                 {accountCategories.map((category) => (
                                   <SelectItem key={category} value={category}>
                                     {category}
                                   </SelectItem>
                                 ))}
                               </SelectContent>
                             </Select>
                           </div>
                         );
                       })}
                     </div>

                     {Object.keys(accountCategoryMapping).length > 0 && (
                       <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                         <h4 className="font-medium mb-2">Kategorimappning översikt:</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                           {Object.entries(accountCategoryMapping).map(([account, category]) => (
                             <div key={account} className="flex justify-between">
                               <span className="text-muted-foreground">{account}:</span>
                               <span className="font-medium">{category}</span>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 </CardContent>
               </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Month Dialog */}
      <CreateMonthDialog
        isOpen={isCreateMonthDialogOpen}
        onClose={() => setIsCreateMonthDialogOpen(false)}
        onCreateMonth={handleCreateMonthFromDialog}
        budgetTemplates={budgetTemplates}
        selectedBudgetMonth={selectedBudgetMonth}
        direction={createMonthDirection}
        historicalData={historicalData}
        availableMonths={availableMonths}
      />

      {/* Cost Item Edit Dialog */}
      {editingItem && (
        <CostItemEditDialog
          item={editingItem}
          accounts={accounts}
          categories={getCategoryNames()}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSave={handleEditSave}
          onDelete={removeSubCategory}
        />
      )}

      {/* Add Budget Item Dialog */}
      <AddBudgetItemDialog
        isOpen={showAddBudgetDialog.isOpen}
        onClose={() => setShowAddBudgetDialog({ isOpen: false, type: 'cost' })}
        onSave={handleAddBudgetItem}
        mainCategories={activeContent.activeCategories}
        accounts={budgetState.accounts}
        type={showAddBudgetDialog.type}
      />
      
      {/* Transaction Drill Down Dialog */}
      <TransactionDrillDownDialog
        isOpen={drillDownDialog.isOpen}
        onClose={() => setDrillDownDialog(prev => ({ ...prev, isOpen: false }))}
        transactions={drillDownDialog.transactions}
        categoryName={drillDownDialog.categoryName}
        budgetAmount={drillDownDialog.budgetAmount}
        actualAmount={drillDownDialog.actualAmount}
      />
      
      {/* Bottom padding for better visual spacing */}
      <div className="h-16"></div>
    </div>
  );
};

export default BudgetCalculator;