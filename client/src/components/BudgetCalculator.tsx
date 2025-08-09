import React, { useState, useEffect, useMemo } from 'react';
import { findBankBalanceForMonth } from '@/utils/bankBalanceUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calculator, DollarSign, TrendingUp, Users, Calendar, Plus, Trash2, Edit, Save, X, ChevronDown, ChevronUp, History, ChevronLeft, ChevronRight, Target, Receipt, ArrowRightLeft } from 'lucide-react';
import { useCategoryResolver, useHuvudkategorier, useUnderkategorier } from '../hooks/useCategories';
import { useUuidCategoryBridge } from '../services/uuidCategoryBridge';
import { StorageKey, get, set } from '../services/storageService';
import { formatOrenAsCurrency, kronoraToOren, orenToKronor } from '@/utils/currencyUtils';

import { CostItemEditDialog } from './CostItemEditDialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import { AccountDataTable, AccountDataRow } from '@/components/AccountDataTable';
import { MonthlyAccountBalances } from '@/components/MonthlyAccountBalances';
import CreateMonthDialog from './CreateMonthDialog';
import { CustomLineChart } from './CustomLineChart';
import { AccountSelector } from '@/components/AccountSelector';
import { MainCategoriesSettings } from '@/components/MainCategoriesSettings';
import { PaydaySettings } from '@/components/PaydaySettings';
import { AddBudgetItemDialog } from '@/components/AddBudgetItemDialog';
import { TransactionImportEnhanced } from '@/components/TransactionImportEnhanced';
import { TransactionDrillDownDialog } from '@/components/TransactionDrillDownDialog';
import { SavingsSection } from '@/components/SavingsSection';
import { TransfersAnalysis } from '@/components/TransfersAnalysis';
import { DynamicIncomeSection } from '@/components/DynamicIncomeSection';
import { KontosaldoKopia } from '@/components/KontosaldoKopia';
import { Sammanstallning } from '@/components/Sammanstallning';
import { 
  calculateAccountEndBalances, 
  getTransactionsForPeriod, 
  getProcessedBudgetDataForMonth,
  calculateTotalBudgetedCosts,
  calculateTotalBudgetedSavings,
  calculateBalanceLeft
} from '../services/calculationService';
import { updateAccountBalanceForMonth, getAccountNameById } from '../orchestrator/budgetOrchestrator';
import { useToast } from '@/hooks/use-toast';
import { useMonthlyBudget } from '@/hooks/useMonthlyBudget';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useAccounts } from '@/hooks/useAccounts';
import { useInkomstkallor, useInkomstkallorMedlem } from '@/hooks/useInkomstkallor';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgetPosts, useDeleteBudgetPost } from '@/hooks/useBudgetPosts';
import { useMonthlyAccountBalances, useUpdateFaktisktKontosaldo } from '@/hooks/useMonthlyAccountBalances';
import { 
  createSavingsGoal,
  deleteSavingsGoal,
  updateCostGroups,
  updateSavingsGroups,
  updateAccountBalance,
  unsetAccountBalance,
  forceRecalculation,
  addSavingsItem,
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
  setMonthFinalBalances,
  updatePaydaySetting
} from '../orchestrator/budgetOrchestrator';
import { getCurrentMonthData } from '../state/budgetState';
import { useBudget } from '../hooks/useBudget';
import { useIsMobile } from '@/hooks/use-mobile';
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
  accountId?: string; // ENDAST accountId - ingen account-property längre
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
  accountId?: string; // ENDAST accountId - ingen account-property längre
  financedFrom?: 'Löpande kostnad' | 'Enskild kostnad';
}

const BudgetCalculator = () => {
  // BudgetCalculator component starting
  // Use the original useBudget hook - fix hook ordering instead
  const { isLoading, budgetState, calculated } = useBudget();
  const { data: familyMembers } = useFamilyMembers();
  const { data: inkomstkallor } = useInkomstkallor();
  const { data: inkomstkallorMedlem } = useInkomstkallorMedlem();
  const { data: accountsFromAPI = [], isLoading: accountsLoading, error: accountsError } = useAccounts();
  const { data: transactionsFromAPI = [], isLoading: transactionsLoading } = useTransactions();
  const { data: budgetPostsFromAPI = [], isLoading: budgetPostsLoading } = useBudgetPosts(budgetState.selectedMonthKey);
  const deleteBudgetPostMutation = useDeleteBudgetPost();
  const currentMonthlyBudget = useMonthlyBudget(budgetState.selectedMonthKey);
  const { toast } = useToast();
  
  // API hooks for categories - declare early as they're needed in useMemo
  const { data: huvudkategorier = [], isLoading: huvudkategorierLoading } = useHuvudkategorier();
  const { data: underkategorier = [], isLoading: underkategorierLoading } = useUnderkategorier();

  // Convert PostgreSQL budget posts to legacy format for display with proper hierarchy
  const budgetPostsAsLegacyGroups = useMemo(() => {
    // Filter budget posts by types
    const savingsTypePosts = budgetPostsFromAPI.filter((post: any) => post.type === 'savings');
    const costTypePosts = budgetPostsFromAPI.filter((post: any) => post.type === 'cost');
    const otherTypePosts = budgetPostsFromAPI.filter((post: any) => post.type !== 'savings' && post.type !== 'cost');

    const costGroups: any[] = [];
    const savingsGroups: any[] = [];

    // ALWAYS include ALL huvudkategorier, not just ones with budget posts
    // This ensures we never fall back to localStorage
    const huvudkategorierByType = new Map<string, Set<string>>();
    
    // Add all huvudkategorier as 'cost' by default (can be changed later if needed)
    huvudkategorier.forEach(huvudkat => {
      const type = 'cost'; // Default type - could be determined differently
      if (!huvudkategorierByType.has(type)) {
        huvudkategorierByType.set(type, new Set());
      }
      huvudkategorierByType.get(type)!.add(huvudkat.id);
    });
    
    // Override with actual types from budget posts (EXCLUDE transfers)
    // FILTER: Only include budget posts with type='savings' for savings groups
    budgetPostsFromAPI
      .filter((post: any) => post.type !== 'transfer') // Exclude transfer posts
      .forEach((post: any) => {
        const type = post.type || 'cost';
        // Only add to savings groups if the post type is specifically 'savings'
        if (type === 'savings' || (type !== 'savings' && type !== 'cost')) {
          // For savings: only include posts with type='savings'
          if (type === 'savings') {
            if (!huvudkategorierByType.has('savings')) {
              huvudkategorierByType.set('savings', new Set());
            }
            huvudkategorierByType.get('savings')!.add(post.huvudkategoriId);
          }
        } else if (type === 'cost') {
          // For costs: include posts with type='cost' or default type
          if (!huvudkategorierByType.has(type)) {
            huvudkategorierByType.set(type, new Set());
          }
          huvudkategorierByType.get(type)!.add(post.hovedkategoriId);
        }
      });

    // Process each type (cost/savings)
    for (const [type, huvudkategoriIds] of huvudkategorierByType) {
      const targetArray = type === 'cost' ? costGroups : savingsGroups;

      // Process each huvudkategori
      for (const huvudkategoriId of huvudkategoriIds) {
        const huvudkategori = huvudkategorier.find(k => k.id === huvudkategoriId);
        if (!huvudkategori) continue;

        // Get all underkategorier for this huvudkategori
        const relevantUnderkategorier = underkategorier.filter(u => u.huvudkategoriId === huvudkategoriId);
        

        const huvudkategoriGroup = {
          id: huvudkategori.id,
          name: huvudkategori.name,
          amount: 0,
          type: type,
          subCategories: [] as any[] // These will be the underkategorier
        };

        // Create proper underkategori structure with nested budget posts
        relevantUnderkategorier.forEach(underkategori => {
          // Find budget posts for this underkategori (EXCLUDE transfers)
          // FILTER: Only include posts that match the current type (savings vs cost)
          const postsForUnderkategori = budgetPostsFromAPI.filter(post => 
            post.type !== 'transfer' && // Exclude transfer posts
            post.underkategoriId === underkategori.id && 
            post.huvudkategoriId === huvudkategori.id &&
            // CRITICAL: Only include posts that match the target type
            (type === 'savings' ? post.type === 'savings' : post.type !== 'savings')
          );


          // Calculate total for this underkategori
          const underkategoriTotal = postsForUnderkategori.reduce((sum, post) => sum + ((post.amount || 0) / 100), 0);

          // Create underkategori as a subCategory container
          const underkategoriSubCategory = {
            id: underkategori.id,
            name: underkategori.name,
            amount: underkategoriTotal,
            // Mark this as an underkategori container (not editable budget post)
            isUnderkategori: true,
            underkategoriId: underkategori.id,
            huvudkategoriId: huvudkategori.id,
            // Store budget posts as nested items
            budgetPosts: postsForUnderkategori.map(post => {
              const account = accountsFromAPI.find(acc => acc.id === post.accountId);
              const amountInKronor = (post.amount || 0) / 100;
              const dailyAmountInKronor = post.dailyAmount ? post.dailyAmount / 100 : undefined;

              return {
                id: post.id,
                name: post.description,
                amount: amountInKronor,
                account: account?.name || '',
                accountId: post.accountId,
                financedFrom: post.financedFrom || 'Löpande kostnad',
                transferType: post.transferType || 'monthly',
                dailyAmount: dailyAmountInKronor,
                transferDays: post.transferDays ? JSON.parse(post.transferDays) : undefined,
                // Add category info for reference
                mainCategory: huvudkategori.name,
                subcategory: underkategori.name,
                mainCategoryId: post.huvudkategoriId,
                subCategoryId: post.underkategoriId
              };
            })
          };

          huvudkategoriGroup.subCategories.push(underkategoriSubCategory);
          huvudkategoriGroup.amount += underkategoriTotal;
        });

        targetArray.push(huvudkategoriGroup);
      }
    }

    return { costGroups, savingsGroups };
  }, [budgetPostsFromAPI, huvudkategorier, underkategorier, accountsFromAPI]);

  // Hooks for monthly account balances (SQL database)
  const { data: monthlyBalances = [] } = useMonthlyAccountBalances(budgetState.selectedMonthKey);
  const updateFaktisktKontosaldoMutation = useUpdateFaktisktKontosaldo();
  
  // Import UUID category resolution system
  const { resolveHuvudkategoriName, resolveUnderkategoriName, isLoading: categoriesLoading } = useCategoryResolver();
  const { migrateBudgetData, needsMigration } = useUuidCategoryBridge();
  
  
  // Auto-migrate budget data to UUID categories if needed
  useEffect(() => {
    if (!categoriesLoading && needsMigration) {
      migrateBudgetData();
    }
  }, [categoriesLoading, needsMigration, migrateBudgetData]);
  
  // Utility function to check if a SubCategory belongs to a specific account
  const subCategoryBelongsToAccount = (sub: SubCategory, accountName: string): boolean => {
    if (sub.accountId) {
      // New logic: compare accountId
      const account = (accountsFromAPI || []).find(acc => acc.name === accountName);
      return account ? sub.accountId === account.id : false;
    }
    // Legacy fallback: this should not happen after migration
    return false;
  };

  // Utility function to get faktiskt kontosaldo from SQL database
  const getFaktisktKontosaldoFromSQL = (accountName: string): number | null => {
    const account = accountsFromAPI.find(acc => acc.name === accountName);
    if (!account) return null;
    
    const balance = monthlyBalances.find(b => b.accountId === account.id);
    return balance?.faktisktKontosaldo ?? null;
  };
  
  // ALL HOOKS MUST BE DECLARED FIRST - BEFORE ANY CONDITIONAL LOGIC
  const [isEditingCategories, setIsEditingCategories] = useState<boolean>(false); // Edit mode disabled
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
    setGlobalDebugLogs((existingLogs || []).map(log => `${log.timestamp}: ${log.message}`));
    
    const unsubscribe = mobileDebugLogger.subscribe((logs) => {
      setGlobalDebugLogs((logs || []).map(log => `${log.timestamp}: ${log.message}`));
    });
    
    // Add a log to show component mounted
    addMobileDebugLog('[COMPONENT] BudgetCalculator mounted - checking for existing logs');
    
    return unsubscribe;
  }, []);

  // Listen for tab switching events from routing
  useEffect(() => {
    const handleSetActiveTab = (event: CustomEvent) => {
      const targetTab = event.detail;
      console.log('🔄 [TAB SWITCH] Setting active tab to:', targetTab);
      setActiveTab(targetTab);
    };

    window.addEventListener('setActiveTab', handleSetActiveTab as EventListener);
    
    return () => {
      window.removeEventListener('setActiveTab', handleSetActiveTab as EventListener);
    };
  }, []);

  // Tab navigation functions for swipe gestures
  const tabs = ["inkomster", "sammanstallning", "overforing", "egen-budget", "historia"];
  
  const goToPreviousTab = () => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      const newTab = tabs[currentIndex - 1];
      console.log('🔄 [SWIPE] Switching to previous tab:', newTab);
      setActiveTab(newTab);
    }
  };

  const goToNextTab = () => {
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      const newTab = tabs[currentIndex + 1];
      console.log('🔄 [SWIPE] Switching to next tab:', newTab);
      setActiveTab(newTab);
    }
  };

  // Initialize swipe gestures
  useSwipeGestures({
    onSwipeLeft: goToNextTab,
    onSwipeRight: goToPreviousTab,
    threshold: 50
  });
  
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
    accountBalancesCopy: false,
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
    finalAccountSummary: false,
    plannedTransfers: false
  });

  // State for individual planned transfer expansion
  const [expandedPlannedTransfers, setExpandedPlannedTransfers] = useState<{[key: string]: boolean}>({});

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

  // Get dynamic user names based on selected family members
  const getSelectedUserName = (userId: string | null) => {
    if (!userId || !familyMembers) return null;
    const member = (familyMembers || []).find(m => m.id === userId);
    return member?.name || null;
  };

  const selectedPrimaryUserName = currentMonthlyBudget.monthlyBudget?.primaryUserId ? getSelectedUserName(currentMonthlyBudget.monthlyBudget.primaryUserId) : null;
  const selectedSecondaryUserName = currentMonthlyBudget.monthlyBudget?.secondaryUserId ? getSelectedUserName(currentMonthlyBudget.monthlyBudget.secondaryUserId) : null;

  // Use selected user names if available, otherwise fall back to userName1/userName2
  const displayUserName1 = selectedPrimaryUserName || userName1;
  const displayUserName2 = selectedSecondaryUserName || userName2;

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
  const [costViewType, setCostViewType] = useState<'category' | 'account' | 'all'>('category');
  const [savingsViewType, setSavingsViewType] = useState<'category' | 'account'>('category');
  const [isEditingSavings, setIsEditingSavings] = useState(false);
  
  // Mobile hook
  const isMobile = useIsMobile();
  
  // Chart legend and time range states
  const [isChartLegendExpanded, setIsChartLegendExpanded] = useState<boolean>(false);
  const [useCustomTimeRange, setUseCustomTimeRange] = useState<boolean>(false);
  const [chartStartMonth, setChartStartMonth] = useState<string>('');
  const [chartEndMonth, setChartEndMonth] = useState<string>('');
  
  // SINGLE SOURCE OF TRUTH: Read from historicalData[selectedMonthKey]
  const { historicalData: appHistoricalData, selectedMonthKey } = budgetState;
  const currentMonthData = appHistoricalData[selectedMonthKey] || {};
  
  // DATABASE-BACKED MONTHLY BUDGET DATA
  const { monthlyBudget, isLoading: isBudgetLoading, updateIncome } = useMonthlyBudget(selectedMonthKey);
  
  // Legacy income fields removed - now using DynamicIncomeSection with PostgreSQL

  // Legacy useEffect removed - income now managed by DynamicIncomeSection

  // Legacy salary setter functions removed
  
  
  // Legacy salary variables removed - now handled via budget posts
  // CRITICAL FIX: Merge localStorage data with PostgreSQL budget posts
  const localStorageCostGroups = (currentMonthData as any).costGroups || [];
  const localStorageSavingsGroups = (currentMonthData as any).savingsGroups || [];
  
  // FORCE USE of PostgreSQL hierarchical structure - completely ignore localStorage budget posts
  // Always use the PostgreSQL structure, even if empty, to get proper hierarchy
  const costGroups = budgetPostsAsLegacyGroups.costGroups;
  const savingsGroups = budgetPostsAsLegacyGroups.savingsGroups;
  
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
  
  // Account management states - USE API DATA
  const accounts = accountsFromAPI?.map(acc => acc.name) || [];
  const accountsWithIds = accountsFromAPI || []; // Keep full account objects with IDs
  
  // Create unified savings items list that combines savingsGroups with active savings goals
  const allSavingsItems = useMemo(() => {
    // Debug: Check if we're getting any localStorage interference
    const localStorageSavingsGroups = (currentMonthData as any).savingsGroups || [];
    
    // 1. Start with regular, general savings
    const generalSavings = savingsGroups || [];

    // 2. Get all savings goals from global state
     const savingsGoals = budgetState.savingsGoals || [];

    // 3. REMOVED: No longer adding savings goals to savings categories
    // Savings goals will only appear in their dedicated "Sparmål" section
    // This prevents duplicates where goals appear as categories with 0 budget/0 actual

    // 4. Return only the regular savings categories (no savings goals)
    const combined = [...generalSavings]; // Only include regular savings, not goals
    return combined;

  }, [savingsGroups, budgetState.savingsGoals, selectedBudgetMonth, accountsFromAPI]);

  // CRITICAL FIX: Combine SQL savings goals with localStorage savings goals
  const allSavingsGoals = useMemo(() => {
    // Convert budget posts with type='sparmål' to SavingsGoal format (same logic as SavingsGoalsPage)
    const savingsGoalsFromSQL = budgetPostsFromAPI
      .filter(post => post.type === 'sparmål')
      .map(post => {
        const goalName = post.name || post.description?.replace('Sparmål: ', '') || 'Unnamed Goal';
        
        return {
          id: post.id,
          name: goalName,
          accountId: post.accountId || '',
          targetAmount: post.amount / 100, // Convert from öre to kronor
          startDate: post.startDate || '',
          endDate: post.endDate || ''
        };
      });

    // Combine SQL savings goals with legacy savings goals (during transition period)
    const legacyGoals = budgetState.savingsGoals || [];
    
    // Prioritize SQL goals over legacy goals
    const combined = [...savingsGoalsFromSQL, ...legacyGoals];
    
    return combined;
  }, [budgetPostsFromAPI, budgetState.savingsGoals]);

  // CENTRALIZED LOGIC: Use single function call to replace complex logic
  const activeContent = useMemo(() => {
    console.log('✅ Using centralized getProcessedBudgetDataForMonth WITH SQL DATA');
    console.log('🔍 [DEBUG] activeContent useMemo - budgetState:', budgetState);
    console.log('🔍 [DEBUG] activeContent useMemo - selectedMonthKey:', selectedMonthKey);
    console.log('🔍 [DEBUG] activeContent useMemo - SQL accounts:', accountsFromAPI);
    console.log('🔍 [DEBUG] activeContent useMemo - SQL categories (huvud):', huvudkategorier);
    console.log('🔍 [DEBUG] activeContent useMemo - SQL categories (under):', underkategorier);
    console.log('🔍 [DEBUG] activeContent useMemo - budgetState.allTransactions:', budgetState.allTransactions?.length || 0);
    
    // SYSTEMATIC FIX: Pass SQL data sources to eliminate budgetState dependency
    const allCategories = [...(huvudkategorier || []), ...(underkategorier || [])];
    // CRITICAL FIX: Use transactions from React Query cache as primary source, budgetState as fallback
    const allTransactions = transactionsFromAPI.length > 0 
      ? transactionsFromAPI 
      : (budgetState.allTransactions || []);
    console.log(`🔍 [DEBUG] activeContent - using ${allTransactions.length} transactions (${transactionsFromAPI.length} from API cache, ${(budgetState.allTransactions || []).length} from budgetState)`);
    
    // CRITICAL DEBUG: Check savingsTargetId in both data sources for LÖN transactions
    const lonTransactionsFromAPI = transactionsFromAPI.filter(t => t.description === 'LÖN');
    const lonTransactionsFromState = (budgetState.allTransactions || []).filter(t => t.description === 'LÖN');
    const apiDebugData = lonTransactionsFromAPI.map(t => ({
      id: t.id,
      savingsTargetId: t.savingsTargetId,
      hasProperty: 'savingsTargetId' in t,
      allKeys: Object.keys(t)
    }));
    const stateDebugData = lonTransactionsFromState.map(t => ({
      id: t.id,
      savingsTargetId: t.savingsTargetId,
      hasProperty: 'savingsTargetId' in t,
      allKeys: Object.keys(t)
    }));
    const selectedSource = transactionsFromAPI.length > 0 ? 'transactionsFromAPI' : 'budgetState.allTransactions';
    
    console.log('🚨 [DATA SOURCE DEBUG] LÖN transactions from API:', apiDebugData);
    console.log('🚨 [DATA SOURCE DEBUG] LÖN transactions from budgetState:', stateDebugData);
    console.log('🚨 [DATA SOURCE DEBUG] Selected data source:', selectedSource);
    
    // Add to mobile debug log (only once per data change)
    if (lonTransactionsFromAPI.length > 0 || lonTransactionsFromState.length > 0) {
      setTimeout(() => {
        addMobileDebugLog(`🚨 [DATA SOURCE] LÖN from API: ${lonTransactionsFromAPI.length} transactions`);
        apiDebugData.forEach(t => {
          addMobileDebugLog(`  API: ${t.id.slice(-8)} savingsTargetId=${t.savingsTargetId ? t.savingsTargetId.slice(-8) : 'MISSING'} hasProperty=${t.hasProperty}`);
        });
        addMobileDebugLog(`🚨 [DATA SOURCE] LÖN from budgetState: ${lonTransactionsFromState.length} transactions`);
        stateDebugData.forEach(t => {
          addMobileDebugLog(`  State: ${t.id.slice(-8)} savingsTargetId=${t.savingsTargetId ? t.savingsTargetId.slice(-8) : 'MISSING'} hasProperty=${t.hasProperty}`);
        });
        addMobileDebugLog(`🚨 [DATA SOURCE] Selected: ${selectedSource}`);
      }, 0);
    }
    const processedData = getProcessedBudgetDataForMonth(
      budgetState, 
      selectedMonthKey, 
      accountsFromAPI || [], 
      allCategories, 
      allTransactions // Use actual transactions from budgetState
    );
    
    console.log(`🔍 [DEBUG] activeContent - processedData:`, processedData);
    console.log(`🔍 [DEBUG] activeContent - activeAccounts count: ${processedData.activeAccounts?.length || 0}`);
    console.log(`🔍 [DEBUG] activeContent - activeAccounts:`, processedData.activeAccounts);
    console.log(`🔍 [DEBUG] activeContent - transactionsForPeriod count: ${processedData.transactionsForPeriod?.length || 0}`);
    console.log(`🔍 [DEBUG] activeContent - sample transactions:`, (processedData.transactionsForPeriod || []).slice(0, 3).map(t => ({ 
      id: t.id, 
      accountId: t.accountId, 
      date: t.date, 
      amount: t.amount, 
      description: t.description 
    })));
    
    // CRITICAL DEBUG: Check if the target LÖN transaction has savingsTargetId
    const targetTransaction = (processedData.transactionsForPeriod || []).find(t => 
      t.id === 'edece0e6-59d1-4967-a90b-28ef3c4bfc2f'
    );
    if (targetTransaction) {
      console.log('🚨 [BUDGET CALCULATOR] Target LÖN transaction in transactionsForPeriod:', {
        id: targetTransaction.id,
        description: targetTransaction.description,
        savingsTargetId: targetTransaction.savingsTargetId,
        hasProperty: 'savingsTargetId' in targetTransaction,
        allKeys: Object.keys(targetTransaction)
      });
    } else {
      console.log('🚨 [BUDGET CALCULATOR] Target LÖN transaction NOT FOUND in transactionsForPeriod');
    }
    
    return {
      activeCategories: processedData.activeCategories,
      activeAccounts: processedData.activeAccounts,
      budgetItems: {
        costItems: processedData.costItems,
        savingsItems: processedData.savingsItems
      },
      transactionsForPeriod: processedData.transactionsForPeriod,
      dateRange: processedData.dateRange
    };

  }, [budgetState, selectedMonthKey, transactionsFromAPI, accountsFromAPI, huvudkategorier, underkategorier]);

  // --- SLUT PÅ NY LOGIK ---
  
  // Debug logging removed - old salary fields no longer used

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
    accountsFromAPI || []
  );
  const accountEndBalancesSet = {}; // No longer used since it's calculated

  // Helper function to check if next month's balance is set for an account
  const isNextMonthBalanceSet = (accountName: string): boolean => {
    const [year, month] = (budgetState.selectedMonthKey || '').split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    
    const nextMonthData = budgetState.historicalData[nextMonthKey];
    return nextMonthData?.accountBalancesSet?.[accountName] === true;
  };

  // Helper function to get next month name
  const getNextMonthName = (): string => {
    const [year, month] = (budgetState.selectedMonthKey || '').split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                       'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    return monthNames[nextMonth - 1];
  };



  // Helper functions for calculating actual amounts from transactions
  const calculateActualAmountForCategory = React.useCallback((categoryId: string): number => {
    // FIXED: Use exact same logic as Account view that works correctly
    
    // FIXED: Use activeContent.transactionsForPeriod (same as Account view)
    const allPeriodTransactions = activeContent.transactionsForPeriod || [];
    
    // FIXED: Use exact same calculation as Account view
    const categoryName = huvudkategorier.find(k => k.id === categoryId)?.name || 'Unknown';
    const relatedSubcategories = underkategorier.filter(sub => sub.huvudkategoriId === categoryId);
    const subcategoryIds = relatedSubcategories.map(sub => sub.id);
    
    // Filter transactions assigned to EITHER the main category OR any of its subcategories  
    const matchingTransactions = (allPeriodTransactions || []).filter((t: Transaction) => {
      const matchesMainCategory = t.appCategoryId === categoryId;
      const matchesSubcategory = t.appSubCategoryId && subcategoryIds.includes(t.appSubCategoryId);
      const isTransactionOrExpense = t.type === 'Transaction' || t.type === 'ExpenseClaim'; // Include Transaction and ExpenseClaim (Utlägg), exclude InternalTransfers etc.
      
      if (categoryName === 'Transport') {
        console.log(`🚗 [DEBUG] Transport transaction: ${t.description} (${t.amount / 100} kr)`);
        console.log(`  - Main match: ${matchesMainCategory}, Sub match: ${matchesSubcategory}, Type: ${t.type}, isTransactionOrExpense: ${isTransactionOrExpense}`);
        console.log(`  - appCategoryId: ${t.appCategoryId}, appSubCategoryId: ${t.appSubCategoryId}`);
      }
      
      return (matchesMainCategory || matchesSubcategory) && isTransactionOrExpense;
    });

    // FIXED: Filter for negative transactions only (same as Account view)
    const negativeTransactions = matchingTransactions
      .filter((t: Transaction) => {
        const effectiveAmount = (t.correctedAmount !== undefined && t.correctedAmount !== null && t.correctedAmount !== t.amount) ? t.correctedAmount : t.amount;
        return effectiveAmount < 0; // Only include negative amounts (costs)
      });
      
    // FIXED: Keep negative values as negative (don't use Math.abs)
    const total = negativeTransactions
      .reduce((sum: number, t: Transaction) => {
        const effectiveAmount = (t.correctedAmount !== undefined && t.correctedAmount !== null && t.correctedAmount !== t.amount) ? t.correctedAmount : t.amount;
        return sum + effectiveAmount; // Keep negative values negative
      }, 0);

    if (categoryName === 'Transport') {
      console.log(`🚗 [DEBUG] ${categoryName} FINAL calculation:`);
      console.log(`  - Found ${matchingTransactions.length} matching transactions`);
      console.log(`  - Found ${negativeTransactions.length} negative transactions`);
      console.log(`  - Total amount: ${total} öre (${total / 100} kr)`);
    }

    return total;
  }, [activeContent.transactionsForPeriod, underkategorier, huvudkategorier]);

  // Calculate actual amount for a specific underkategori
  const calculateActualAmountForUnderkategori = React.useCallback((underkategoriId: string): number => {
    // FIXED: Use exact same logic as Account view and main category calculation
    const allPeriodTransactions = activeContent.transactionsForPeriod || [];
    
    // Filter transactions for this specific underkategori
    const matchingTransactions = (allPeriodTransactions || []).filter((t: Transaction) => {
      const matchesSubcategory = t.appSubCategoryId === underkategoriId;
      const isTransactionOrExpense = t.type === 'Transaction' || t.type === 'ExpenseClaim'; // Include Transaction and ExpenseClaim (Utlägg), exclude InternalTransfers etc.
      return matchesSubcategory && isTransactionOrExpense;
    });

    // FIXED: Filter for negative transactions only (same as Account view)
    const negativeTransactions = matchingTransactions.filter((t: Transaction) => {
      const effectiveAmount = (t.correctedAmount !== undefined && t.correctedAmount !== null && t.correctedAmount !== t.amount) ? t.correctedAmount : t.amount;
      return effectiveAmount < 0; // Only include negative amounts (costs)
    });
      
    // FIXED: Keep negative values as negative (don't use Math.abs)
    const total = negativeTransactions.reduce((sum: number, t: Transaction) => {
      const effectiveAmount = (t.correctedAmount !== undefined && t.correctedAmount !== null && t.correctedAmount !== t.amount) ? t.correctedAmount : t.amount;
      return sum + effectiveAmount; // Keep negative values negative
    }, 0);
    
    return total;
  }, [activeContent.transactionsForPeriod]);

  const getTransactionsForCategory = (categoryId: string): Transaction[] => {
    // FIXED: Use exact same logic as Account view and calculation function
    const allPeriodTransactions = activeContent.transactionsForPeriod || [];
    
    // Get related subcategories for this main category  
    const relatedSubcategories = underkategorier.filter(sub => sub.hovedkategoriId === categoryId);
    const subcategoryIds = relatedSubcategories.map(sub => sub.id);
    
    // Filter transactions assigned to EITHER the main category OR any of its subcategories  
    const matchingTransactions = (allPeriodTransactions || []).filter((t: Transaction) => {
      const matchesMainCategory = t.appCategoryId === categoryId;
      const matchesSubcategory = t.appSubCategoryId && subcategoryIds.includes(t.appSubCategoryId);
      const isTransactionOrExpense = t.type === 'Transaction' || t.type === 'ExpenseClaim'; // Include Transaction and ExpenseClaim (Utlägg), exclude InternalTransfers etc.
      
      return (matchesMainCategory || matchesSubcategory) && isTransactionOrExpense;
    });

    // FIXED: Filter for negative transactions only (same as Account view)
    const filtered = matchingTransactions.filter((t: Transaction) => {
      const effectiveAmount = (t.correctedAmount !== undefined && t.correctedAmount !== null && t.correctedAmount !== t.amount) ? t.correctedAmount : t.amount;
      return effectiveAmount < 0; // Only include negative amounts (costs)
    });
    
    console.log(`🔍 [DEBUG] Filtered transactions for category ${categoryId}:`, (filtered || []).map(t => ({ 
      id: t.id, 
      amount: t.amount, 
      correctedAmount: t.correctedAmount,
      effectiveAmount: t.correctedAmount !== undefined ? t.correctedAmount : t.amount,
      description: t.description, 
      date: t.date 
    })));
    return filtered;
  };

  const getTransactionsForUnderkategori = (underkategoriId: string): Transaction[] => {
    // FIXED: Use exact same logic as Account view and main category calculation
    const allPeriodTransactions = activeContent.transactionsForPeriod || [];
    
    // Filter transactions for this specific underkategori
    const matchingTransactions = (allPeriodTransactions || []).filter((t: Transaction) => {
      const matchesSubcategory = t.appSubCategoryId === underkategoriId;
      const isTransactionOrExpense = t.type === 'Transaction' || t.type === 'ExpenseClaim'; // Include Transaction and ExpenseClaim (Utlägg), exclude InternalTransfers etc.
      return matchesSubcategory && isTransactionOrExpense;
    });

    // FIXED: Filter for negative transactions only (same as Account view)
    const filtered = matchingTransactions.filter((t: Transaction) => {
      const effectiveAmount = (t.correctedAmount !== undefined && t.correctedAmount !== null && t.correctedAmount !== t.amount) ? t.correctedAmount : t.amount;
      return effectiveAmount < 0; // Only include negative amounts (costs)
    });
    
    return filtered;
  };

  // MODERN: Function that uses accountId directly (more reliable)
  const getTransactionsForAccountId = React.useCallback((accountId: string): Transaction[] => {
    const allPeriodTransactions = activeContent.transactionsForPeriod || [];
    
    const accountTransactions = (allPeriodTransactions || []).filter((t: Transaction) => 
      t.accountId === accountId && (t.type === 'Transaction' || t.type === 'ExpenseClaim')
    );
    
    return accountTransactions;
  }, [activeContent.transactionsForPeriod]);

  // LEGACY: Function that uses accountName (kept for backward compatibility)
  const getTransactionsForAccount = React.useCallback((accountName: string): Transaction[] => {
    const allPeriodTransactions = activeContent.transactionsForPeriod || [];
    
    // Method 1: Find transactions directly by accountId
    const directAccountTransactions = (allPeriodTransactions || []).filter((t: Transaction) => {
      const account = (accountsFromAPI || []).find(acc => acc.id === t.accountId);
      const matchesDirect = account?.name === accountName;
      const isTransactionOrExpense = t.type === 'Transaction' || t.type === 'ExpenseClaim';
      return matchesDirect && isTransactionOrExpense;
    });
    
    // Method 2: Also check for transactions that might have accountId directly matching the account name
    const nameMatchTransactions = allPeriodTransactions.filter((t: Transaction) => {
      const matchesName = t.accountId === accountName;
      const isTransactionOrExpense = t.type === 'Transaction' || t.type === 'ExpenseClaim';
      return matchesName && isTransactionOrExpense;
    });
    
    // Method 3: For budget accounts, also find transactions that belong to subcategories in this account
    const accountSubcategories: string[] = [];
    costGroups.forEach(group => {
      group.subCategories?.forEach(sub => {
        const matchesLegacy = sub.account === accountName;
        const account = (accountsFromAPI || []).find(acc => acc.id === sub.accountId);
        const matchesNew = account?.name === accountName;
        
        if (matchesLegacy || matchesNew) {
          accountSubcategories.push(group.id);
        }
      });
    });
    
    const categoryBasedTransactions = allPeriodTransactions.filter((t: Transaction) => 
      accountSubcategories.includes(t.appCategoryId || '')
    );
    
    // Combine all methods and remove duplicates
    const allTransactions = [...directAccountTransactions, ...nameMatchTransactions];
    categoryBasedTransactions.forEach(t => {
      if (!allTransactions?.some(existing => existing.id === t.id)) {
        allTransactions.push(t);
      }
    });
    
    return allTransactions;
  }, [activeContent.transactionsForPeriod, accountsFromAPI, costGroups]);

  const openDrillDownDialog = (categoryName: string, categoryId: string, budgetAmount: number) => {
    const transactions = getTransactionsForCategory(categoryId);
    const actualAmount = calculateActualAmountForCategory(categoryId);
    
    // Add mobile debug log only when drill-down is opened
    if (categoryName === 'Transport') {
      addMobileDebugLog(`🚗 [TRANSPORT DRILL-DOWN]`);
      addMobileDebugLog(`  - Category ID: ${categoryId}`);
      addMobileDebugLog(`  - Found ${transactions.length} transactions`);
      addMobileDebugLog(`  - Actual amount: ${actualAmount / 100} kr`);
      
      transactions.slice(0, 3).forEach(t => {
        addMobileDebugLog(`  - ${t.description} (${t.appCategoryId}/${t.appSubCategoryId})`);
      });
    }
    
    setDrillDownDialog({
      isOpen: true,
      transactions,
      categoryName,
      budgetAmount,
      actualAmount
    });
  };

  const openAccountDrillDownDialog = (accountId: string, accountName: string, budgetAmount: number, actualAmount: number) => {
    console.log(`🔍 [DEBUG] ============= openAccountDrillDownDialog CALLED =============`);
    console.log(`🔍 [DEBUG] accountId: "${accountId}"`);
    console.log(`🔍 [DEBUG] accountName: "${accountName}"`);
    console.log(`🔍 [DEBUG] budgetAmount: ${budgetAmount}`);
    console.log(`🔍 [DEBUG] actualAmount: ${actualAmount}`);
    
    const allTransactions = getTransactionsForAccountId(accountId);
    console.log(`🔍 [DEBUG] allTransactions from getTransactionsForAccountId: ${allTransactions.length}`);
    console.log(`🔍 [DEBUG] sample transactions:`, allTransactions.slice(0, 3).map(t => ({
      type: t.type,
      amount: t.amount,
      correctedAmount: t.correctedAmount,
      description: t.description
    })));
    
    // FIXED: Show only negative amount transactions (costs) for account drill-down (same as Account view)
    const transactions = allTransactions.filter(t => {
      const effectiveAmount = (t.correctedAmount !== undefined && t.correctedAmount !== null && t.correctedAmount !== t.amount) ? t.correctedAmount : t.amount;
      const isNegative = effectiveAmount < 0;
      
      console.log(`🔍 [DEBUG] Transaction ${t.description || 'No desc'}: type=${t.type}, effectiveAmount=${effectiveAmount}, isNegative=${isNegative}, included=${isNegative}`);
      
      return isNegative; // Show only negative amounts (costs)
    });
    
    console.log(`🔍 [DEBUG] transactions after filtering (negative amounts only): ${transactions.length}`);
    console.log(`🔍 [DEBUG] filtered transaction sample:`, transactions.slice(0, 3).map(t => ({
      type: t.type,
      amount: t.amount,
      correctedAmount: t.correctedAmount,
      description: t.description
    })));
    console.log(`🔍 [DEBUG] ============= openAccountDrillDownDialog END =============`);
    
    setDrillDownDialog({
      isOpen: true,
      transactions,
      categoryName: accountName,
      budgetAmount,
      actualAmount
    });
  };

  const openUnderkategoriDrillDownDialog = (underkategoriName: string, underkategoriId: string, budgetAmount: number) => {
    const transactions = getTransactionsForUnderkategori(underkategoriId);
    const actualAmount = calculateActualAmountForUnderkategori(underkategoriId);
    
    setDrillDownDialog({
      isOpen: true,
      transactions,
      categoryName: underkategoriName,
      budgetAmount,
      actualAmount
    });
  };

  const getSavingsTransactions = () => {
    console.log('🔍 [DEBUG] getSavingsTransactions called - using centralized storage');
    
    // Use transactions from React Query cache as primary source
    const allTransactions = transactionsFromAPI.length > 0 
      ? transactionsFromAPI 
      : (budgetState.allTransactions || []);
    
    console.log('🔍 [DEBUG] Total transactions from centralized storage:', allTransactions.length);
    
    // Log all transactions with savings targets or type 'Sparande'/'Savings'
    const savingsRelated = allTransactions.filter(t => t.type === 'Sparande' || t.type === 'Savings' || t.savingsTargetId);
    console.log(`🔍 [DEBUG] Found ${savingsRelated.length} transactions with savings type or target`);
    
    savingsRelated.forEach((t: any, index: number) => {
      const effectiveAmount = t.correctedAmount !== undefined ? t.correctedAmount : t.amount;
      console.log(`🔍 [DEBUG] Savings-related transaction ${index}:`, {
        id: t.id,
        description: t.description?.substring(0, 30),
        type: t.type,
        amount: t.amount,
        correctedAmount: t.correctedAmount,
        effectiveAmount,
        appCategoryId: t.appCategoryId,
        savingsTargetId: t.savingsTargetId,
        willBeIncluded: (t.type === 'Sparande' || t.type === 'Savings') && effectiveAmount > 0
      });
    });
    
    // Filter for savings transactions - include all transactions with type 'Sparande'/'Savings' or savingsTargetId
    const filtered = allTransactions.filter((t: any) => {
      const effectiveAmount = t.correctedAmount !== undefined ? t.correctedAmount : t.amount;
      // Include transactions that are marked as Sparande/Savings type OR have a savingsTargetId
      const isSavings = t.type === 'Sparande' || t.type === 'Savings' || t.savingsTargetId;
      return isSavings;
    });
    
    console.log('🔍 [DEBUG] getSavingsTransactions - filtered result:', filtered.length);
    console.log('🔍 [DEBUG] CORRECTED: Filter condition is (t.type === "Sparande" || t.type === "Savings" || t.savingsTargetId)');
    console.log('🔍 [DEBUG] This includes ALL savings transactions regardless of amount');
    return filtered;
  };

  const calculateTotalActualSavings = () => {
    const savingsTransactions = getSavingsTransactions();
    return savingsTransactions.reduce((sum, t) => {
      const effectiveAmount = t.correctedAmount !== undefined ? t.correctedAmount : t.amount;
      return sum + Math.abs(effectiveAmount);
    }, 0);
  };

  // UPDATED LOGIC: Calculate actual savings for a MAIN CATEGORY by summing subcategories
  const calculateSavingsActualForCategory = (mainCategoryId: string): number => {
    // 1. Hitta först den relevanta huvudkategorin ("pärmen")
    const mainCategory = savingsGroups.find(g => g.id === mainCategoryId);
    if (!mainCategory) {
      return 0; // Om huvudkategorin inte finns, är summan 0
    }

    // 2. Samla ihop ID:na från ALLA underkategorier ("flikarna") i denna pärm
    const subCategoryIds = new Set<string>();
    (mainCategory.subCategories || []).forEach(sub => subCategoryIds.add(sub.id));

    // Vi måste även inkludera sparmål som är kopplade till denna huvudkategori
    (budgetState.savingsGoals || [])
      .filter(goal => goal.mainCategoryId === mainCategoryId)
      .forEach(goal => subCategoryIds.add(goal.id));
    
    // 3. Hämta alla spar-transaktioner
    const savingsTransactions = getSavingsTransactions();

    // 4. Filtrera fram de transaktioner vars `savingsTargetId` matchar något av ID:na i vår insamlade lista
    const filtered = savingsTransactions.filter(t => t.savingsTargetId && subCategoryIds.has(t.savingsTargetId));

    // 5. Summera beloppen för de matchande transaktionerna
    return filtered.reduce((sum, t) => sum + (t.correctedAmount ?? t.amount), 0);
  };

  // NEW FUNCTION: Calculate actual savings for a specific TARGET (subcategory or goal)
  const calculateActualForTarget = (targetId: string): number => {
    console.log(`🎯 [DEBUG] calculateActualForTarget called for targetId: ${targetId}`);
    const savingsTransactions = getSavingsTransactions();
    console.log(`🎯 [DEBUG] Total savings transactions available: ${savingsTransactions.length}`);

    // Find all transactions linked to this specific target
    const filtered = savingsTransactions.filter(t => t.savingsTargetId === targetId);
    console.log(`🎯 [DEBUG] Found ${filtered.length} transactions for targetId ${targetId}`);
    
    filtered.forEach((t, index) => {
      console.log(`🎯 [DEBUG] Transaction ${index} for target ${targetId}:`, {
        id: t.id,
        description: t.description?.substring(0, 30),
        amount: t.amount,
        correctedAmount: t.correctedAmount,
        savingsTargetId: t.savingsTargetId
      });
    });

    // Sum their amounts (use absolute value for savings)
    const total = filtered.reduce((sum, t) => {
      const effectiveAmount = t.correctedAmount !== undefined ? t.correctedAmount : t.amount;
      return sum + Math.abs(effectiveAmount);
    }, 0);
    
    console.log(`🎯 [DEBUG] Total calculated for target ${targetId}: ${total}`);
    return total;
  };

  const getSavingsTransactionsForCategory = (mainCategoryId: string) => {
    console.log(`🔍 [DEBUG] getSavingsTransactionsForCategory called for: ${mainCategoryId}`);
    
    // Find the main category group
    const mainGroup = savingsGroups.find(group => group.name === mainCategoryId);
    if (!mainGroup) {
      console.log(`🔍 [DEBUG] No main group found for ${mainCategoryId}`);
      return [];
    }
    
    console.log(`🔍 [DEBUG] Found main group for ${mainCategoryId}:`, {
      id: mainGroup.id,
      name: mainGroup.name,
      subCategoriesCount: mainGroup.subCategories?.length || 0
    });
    
    // Get all transactions linked to subcategories AND main category
    const savingsTransactions = getSavingsTransactions();
    console.log(`🔍 [DEBUG] getSavingsTransactionsForCategory - Total savings transactions: ${savingsTransactions.length}`);
    
    const allCategoryTransactions: any[] = [];
    
    // 1. Get transactions directly linked to the main category
    const mainCategoryTransactions = savingsTransactions.filter(t => t.savingsTargetId === mainGroup.id);
    console.log(`🔍 [DEBUG] Main category ${mainCategoryId} (${mainGroup.id}) has ${mainCategoryTransactions.length} direct transactions`);
    allCategoryTransactions.push(...mainCategoryTransactions);
    
    // 2. Get transactions from all subcategories
    (mainGroup.subCategories || []).forEach(subCategory => {
      const itemTransactions = savingsTransactions.filter(t => t.savingsTargetId === subCategory.id);
      console.log(`🔍 [DEBUG] Subcategory ${subCategory.name} (${subCategory.id}) has ${itemTransactions.length} transactions`);
      if (itemTransactions.length > 0) {
        console.log(`🔍 [DEBUG] Subcategory ${subCategory.name} transactions:`, itemTransactions.map(t => ({
          id: t.id,
          description: t.description?.substring(0, 30),
          amount: t.amount,
          savingsTargetId: t.savingsTargetId
        })));
      }
      allCategoryTransactions.push(...itemTransactions);
    });
    
    console.log(`🔍 [DEBUG] FINAL: Total transactions for main category ${mainCategoryId}: ${allCategoryTransactions.length} (${mainCategoryTransactions.length} direct + ${allCategoryTransactions.length - mainCategoryTransactions.length} from subcategories)`);
    
    // Debug: Log sample transactions to verify they're being found
    if (allCategoryTransactions.length > 0) {
      allCategoryTransactions.slice(0, 3).forEach((t, index) => {
        console.log(`🔍 [DEBUG] Final transaction ${index}:`, {
          id: t.id,
          description: t.description?.substring(0, 30),
          amount: t.amount,
          savingsTargetId: t.savingsTargetId
        });
      });
    } else {
      console.log(`🔍 [DEBUG] NO TRANSACTIONS FOUND - This explains why Hushåll shows 0 kr`);
    }
    
    return allCategoryTransactions;
  };

  const openSavingsCategoryDrillDownDialog = (categoryName: string, budgetAmount: number) => {
    const transactions = getSavingsTransactionsForCategory(categoryName);
    const actualAmount = calculateSavingsActualForCategory(categoryName);
    
    setDrillDownDialog({
      isOpen: true,
      transactions,
      categoryName: `${categoryName} - Sparande`,
      budgetAmount,
      actualAmount
    });
  };

  const openSavingsTargetDrillDownDialog = (targetId: string, targetName: string, budgetAmount: number) => {
    console.log(`🔍 [DEBUG] openSavingsTargetDrillDownDialog called for target: ${targetId} (${targetName})`);
    const savingsTransactions = getSavingsTransactions();
    console.log(`🔍 [DEBUG] getAllSavingsTransactions returned ${savingsTransactions.length} total transactions`);
    
    // Debug: Log all savingsTransactions to see what's available
    savingsTransactions.forEach((t, index) => {
      console.log(`🔍 [DEBUG] Transaction ${index}: id=${t.id}, savingsTargetId=${t.savingsTargetId}, appCategoryId=${t.appCategoryId}, type=${t.type}, amount=${t.amount}, description=${t.description}`);
    });
    
    const transactions = savingsTransactions.filter(t => t.savingsTargetId === targetId);
    console.log(`🔍 [DEBUG] After filtering by savingsTargetId=${targetId}, found ${transactions.length} transactions`);
    
    const actualAmount = calculateActualForTarget(targetId);
    console.log(`🔍 [DEBUG] calculateActualForTarget returned: ${actualAmount}`);
    
    setDrillDownDialog({
      isOpen: true,
      transactions,
      categoryName: `${targetName} - Sparande`,
      budgetAmount,
      actualAmount
    });
  };

  const openSavingsDrillDownDialog = () => {
    const transactions = getSavingsTransactions();
    const budgetAmount = (() => {
      const savingsCategoriesTotal = allSavingsItems.reduce((sum, group) => {
        const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
        return sum + group.amount + subCategoriesTotal;
      }, 0);
      
      const savingsGoalsMonthlyTotal = allSavingsGoals.reduce((sum, goal) => {
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
    })();
    const actualAmount = calculateTotalActualSavings();
    
    setDrillDownDialog({
      isOpen: true,
      transactions,
      categoryName: 'Totalt sparande',
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

  // Calculate total income from budget posts with type 'Inkomst'
  const calculateTotalIncomeFromBudgetPosts = (): number => {
    if (!budgetPostsFromAPI) return 0;
    
    const incomePosts = budgetPostsFromAPI.filter(post => 
      post.type === 'Inkomst' && 
      post.monthKey === budgetState.selectedMonthKey
    );
    
    const incomeFromPosts = incomePosts.reduce((total, post) => total + (post.amount || 0), 0);
    
    // Legacy fallback removed - income now only comes from budget posts
    
    // Income from posts is stored in öre, but formatCurrency expects SEK
    // Convert from öre to SEK by dividing by 100
    return incomeFromPosts / 100;
  };

  // FUNCTION DEFINITIONS (must come before useEffect hooks that call them)
  const calculateBudget = () => {
    // Use new dynamic income calculation (returns in SEK for display)
    const totalSalaryFromPosts = calculateTotalIncomeFromBudgetPosts();
    
    // Legacy salary calculation removed - use budget posts only
    const andreasTotalIncome = 0;
    const susannaTotalIncome = 0;
    const totalSalary = totalSalaryFromPosts * 100; // Convert SEK to öre for calculations
    const budgetData = calculateDailyBudget();
    
    // Calculate total costs using centralized logic
    const totalCosts = calculateTotalBudgetedCosts(activeContent.budgetItems.costItems, selectedMonthKey);
    
    // Calculate total savings using centralized logic  
    const totalSavings = calculateTotalBudgetedSavings(activeContent.budgetItems.savingsItems, selectedMonthKey);
    
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
    
    // Calculate balanceLeft using centralized calculation
    const currentMonthData = historicalData[selectedBudgetMonth];
    const calculatedBalanceLeft = calculateBalanceLeft(currentMonthData, selectedBudgetMonth);
    
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
          subCategoryBelongsToAccount(sub, account) && (sub.financedFrom === 'Löpande kostnad' || !sub.financedFrom)
        ) || [];
        return items.concat(groupCosts);
      }, []);
      
      // Calculate total costs for this account (only Löpande kostnad) (same as UI)
      const totalCosts = accountCostItems.reduce((sum, item) => sum + item.amount, 0);
      
      // Calculate final balance as sum of ALL entries shown in the table (same as UI):
      // original balance + savings deposits + cost budget deposits - all costs
      const accountData = accountsFromAPI.find(acc => acc.name === account);
      const allCostItems = costGroups.reduce((items, group) => {
        const groupCosts = group.subCategories?.filter(sub => subCategoryBelongsToAccount(sub, account)) || [];
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
        // Removed totalMonthlyExpenses - now calculated on-demand
        // Removed totalCosts and totalSavings - now calculated on-demand
        // Removed balanceLeft - now calculated on-demand
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
        const [currentYear, currentMonth] = (monthKey || '').split('-').map(Number);
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

    addDebugLog(`🎯 SAVE BUTTON: Legacy salary debug logging removed`);
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

    // DEPRECATED: Redirect users to the dedicated SavingsGoalsPage instead of using old localStorage method
    console.log('🚨 [DEPRECATED] BudgetCalculator savings goal creation is deprecated - redirecting to SavingsGoalsPage');
    setIsCreateSavingsGoalDialogOpen(false);
    
    // Clear form
    setNewSavingsGoalName('');
    setNewSavingsGoalAccount('');
    setNewSavingsGoalTarget('');
    setNewSavingsGoalStartDate('');
    setNewSavingsGoalEndDate('');
    
    // TODO: Consider redirecting to /sparmal page or showing a message
    alert('Använd "Sparmål" sidan i navigationen för att skapa nya sparmål.');
  };

  // Handler för BudgetItem struktur
  const handleAddBudgetItem = (budgetItem: any) => {
    console.log('🔍 [DEBUG] handleAddBudgetItem called with:', budgetItem);
    console.log('🔍 [DEBUG] budgetItem.accountId:', budgetItem.accountId);
    console.log('🔍 [DEBUG] Available accounts:', accountsFromAPI);
    console.log('🔍 [DEBUG] SQL huvudkategorier:', huvudkategorier);
    console.log('🔍 [DEBUG] SQL underkategorier:', underkategorier);
    
    // Find category names from SQL data using UUIDs
    const selectedHuvudkategori = huvudkategorier.find(k => k.id === budgetItem.mainCategoryId);
    const selectedUnderkategori = underkategorier.find(k => k.id === budgetItem.subCategoryId);
    const selectedAccount = (accountsFromAPI || []).find(acc => acc.id === budgetItem.accountId);
    
    console.log('🔍 [DEBUG] Found huvudkategori:', selectedHuvudkategori);
    console.log('🔍 [DEBUG] Found underkategori:', selectedUnderkategori);
    console.log('🔍 [DEBUG] Found account:', selectedAccount);
    
    // Convert to legacy format using proper category names and account UUID
    const legacyItem = {
      mainCategory: selectedHuvudkategori?.name || budgetItem.mainCategoryId,
      subcategory: selectedUnderkategori?.name || budgetItem.subCategoryId,
      name: budgetItem.description,
      amount: budgetItem.amount,
      account: selectedAccount?.name || '',
      accountId: budgetItem.accountId, // Store the UUID for proper account mapping
      financedFrom: budgetItem.financedFrom || 'Löpande kostnad',
      transferType: budgetItem.transferType,
      dailyAmount: budgetItem.dailyAmount,
      transferDays: budgetItem.transferDays
    };
    
    console.log('🔍 [DEBUG] Legacy item created with proper names:', legacyItem);
    console.log('🔍 [DEBUG] Legacy mainCategory:', legacyItem.mainCategory);
    console.log('🔍 [DEBUG] Legacy subcategory:', legacyItem.subcategory);
    handleAddCostItem(legacyItem);
  };

  // Delete savings group function
  const deleteSavingsGroup = async (id: string) => {
    console.log('🔍 [DEBUG] deleteSavingsGroup called with id:', id);
    
    // Check if this is a savings goal (sparmål) from SQL
    const sqlSavingsGoal = budgetPostsFromAPI.find(post => post.id === id && post.type === 'sparmål');
    
    if (sqlSavingsGoal) {
      console.log('🔍 [DEBUG] Deleting SQL savings goal (sparmål) with id:', id);
      
      if (!confirm('Är du säker på att du vill ta bort detta sparmål?')) {
        return;
      }
      
      try {
        await deleteBudgetPostMutation.mutateAsync(id);
        console.log('🔍 [DEBUG] Savings goal deleted successfully');
      } catch (error) {
        console.error('🔍 [ERROR] Failed to delete savings goal:', error);
      }
    } else {
      // Handle legacy savings groups if needed
      console.log('🔍 [DEBUG] Attempting to delete legacy savings group with id:', id);
      deleteSavingsGoal(id); // Use orchestrator for legacy goals
    }
  };
  
  // Tab navigation helper functions

  
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
        
        // CRITICAL FIX: Do NOT load old localStorage historicalData as it overwrites SQL data
        // All transaction data including savingsTargetId now comes from SQL via useBudget hook
        console.log(`🚫 [LOCALSTORAGE FIX] Skipping old localStorage historicalData load for ${savedSelectedMonth} to prevent SQL data override`);
        
        // Load data for the selected month from historical data - DISABLED
        // The old localStorage historicalData doesn't have savingsTargetId field and overwrites SQL data
        // if (parsed.historicalData && parsed.historicalData[savedSelectedMonth]) {
        //   setTimeout(() => {
        //     loadDataFromSelectedMonth(savedSelectedMonth);
        //   }, 0);
        // }
        
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
    console.log(`📝 DEBUG: Legacy salary logging removed`);
    
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
      totalSalary: 0, // Legacy salary fields removed
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
        // totalMonthlyExpenses removed - calculated on-demand
        // balanceLeft removed - calculated on-demand
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
    const [year, month] = (monthKey || '').split('-').map(Number);
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
    if (accounts?.some(account => typeof account !== 'string')) {
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
    const [year, month] = (monthKey || '').split('-').map(Number);
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
    const accountsToProcess = (accountsFromAPI || []).map(acc => acc.name);
    
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
          ?.filter((sub: any) => subCategoryBelongsToAccount(sub, account) && sub.financedFrom === 'Enskild kostnad')
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
      id: uuidv4(),
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
        id: uuidv4(),
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
      id: uuidv4(),
      name: `${item.subcategory}: ${item.name}`,
      amount: calculatedAmount,
      accountId: item.accountId || (item.account ? accountsFromAPI.find(acc => acc.name === item.account)?.id : undefined),
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
      id: uuidv4(),
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
      id: uuidv4(),
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

  // Note: Removed hardcoded Transport subcategories initialization
  // All categories and subcategories should now come from SQL database
  // Legacy subcategories with IDs like 'transport_fuel_sub' are no longer used

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
        totalSalary: 0,
        costGroups: [],
        savingsGroups: [],
        // Removed old calculated fields - now calculated on-demand
        dailyTransfer: 300,
        weekendTransfer: 540,
        // balanceLeft removed - calculated on-demand
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
        totalSalary: calculateTotalIncomeFromBudgetPosts() * 100,
        costGroups: JSON.parse(JSON.stringify(costGroups)),
        savingsGroups: JSON.parse(JSON.stringify(savingsGroups)),
        // Removed old calculated fields - now calculated on-demand
        dailyTransfer,
        weekendTransfer,
        // balanceLeft removed - calculated on-demand
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
    
    
    return result;
  };

  // Helper function to get estimated opening balances from previous month's final balances
  const getEstimatedOpeningBalances = (freshFinalBalances?: {[key: string]: number}) => {
    const prevMonthInfo = getPreviousMonthInfo();
    const prevMonthData = historicalData[prevMonthInfo.monthKey];
    
    
    if (!prevMonthData) {
      return null;
    }
    
    const estimatedOpeningBalances: {[key: string]: number} = {};
    
    
    // Calculate estimated opening balances for current month
    // This should load the specific "AccountName.Year.Month.Endbalance" value from previous month
    accounts.forEach(account => {
        const [prevYear, prevMonth] = prevMonthInfo.monthKey.split('-');
        const endingBalanceKey = `${account}.${prevYear}.${prevMonth}.Endbalance`;
        
        // Use accountEstimatedFinalBalances as the single source of truth
        let openingBalance = prevMonthData.accountEstimatedFinalBalances?.[account];
        
        // Final fallback to accountEndingBalances with specific key format
        if (openingBalance === undefined || openingBalance === null) {
          const [prevYear, prevMonth] = prevMonthInfo.monthKey.split('-');
          const endingBalanceKey = `${account}.${prevYear}.${prevMonth}.Endbalance`;
          openingBalance = prevMonthData.accountEndingBalances?.[endingBalanceKey];
        }
        
        
        // If still not found, use 0 as default
        if (openingBalance === undefined || openingBalance === null) {
          openingBalance = 0;
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
        
    });
    
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
    const currentBalance = accountBalances[account] || 0;
    const isExplicitlySet = accountBalancesSet[account] === true;
    
    if (isExplicitlySet) {
      return currentBalance;
    }
    
    return 0;
  };

  // Helper function to get Calc.Kontosaldo for same month (for Ursprungligt saldo)
  const getCalcKontosaldoSameMonth = (account: string) => {
    const hasActualBalance = accountBalancesSet[account] === true;
    const currentBalance = accountBalances?.[account] || 0;
    
    const freshBalances = (window as any).__freshFinalBalances;
    const estimatedResult = getEstimatedOpeningBalances(freshBalances);
    const estimatedBalance = estimatedResult?.[account] || 0;
    
    const calcBalance = hasActualBalance ? currentBalance : estimatedBalance;
    
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
    
    // NEW: Save to SQL database instead of localStorage
    const accountObj = accountsFromAPI.find(acc => acc.name === account);
    if (accountObj && budgetState.selectedMonthKey) {
      const balanceInOre = Math.round(balance * 100); // Convert to öre
      updateFaktisktKontosaldoMutation.mutate({
        monthKey: budgetState.selectedMonthKey,
        accountId: accountObj.id,
        faktisktKontosaldo: balanceInOre
      });
      addDebugLog(`✅ SQL update initiated for ${account}: ${balanceInOre} öre`);
    } else {
      console.error(`❌ Could not find account ${account} or selectedMonthKey missing`);
    }
    
    // Keep existing localStorage logic for backward compatibility during transition
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
    
    // NEW: Save to SQL database instead of localStorage
    const accountObj = accountsFromAPI.find(acc => acc.name === account);
    if (accountObj && budgetState.selectedMonthKey) {
      updateFaktisktKontosaldoMutation.mutate({
        monthKey: budgetState.selectedMonthKey,
        accountId: accountObj.id,
        faktisktKontosaldo: null
      });
      addDebugLog(`✅ SQL unset initiated for ${account} - NOT calling localStorage unsetAccountBalance to avoid conflict`);
      
      // Don't call the localStorage orchestrator function to avoid conflict with database null value
      // The MonthlyAccountBalances component will handle displaying the null state
      
    } else {
      // Fallback to localStorage logic only if SQL database update is not available
      unsetAccountBalance(account);
      addDebugLog(`✅ unsetAccountBalance completed for ${account} (fallback to localStorage)`);
      
      const currentDate = new Date();
      const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      resetMonthFinalBalancesFlag(currentMonthKey);
      
      addDebugLog(`🔄 About to call forceRecalculation`);
      forceRecalculation();
      console.log(`✅ forceRecalculation completed`);
    }
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
    console.log(`💾 DEBUG: Legacy salary logging removed`);
    
    // Create explicit data snapshot to ensure we save current state values
    const currentDataSnapshot = {
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
      id: uuidv4(),
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
      id: uuidv4(),
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
      id: uuidv4(),
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
           id: `category-${uuidv4()}`,
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

  // Function to get bank balance for a specific account and month
  const getBankBalance = (accountName: string, monthKey: string) => {
    console.log(`🔍 [BANK BALANCE] Starting getBankBalance for account: ${accountName}, month: ${monthKey}`);
    
    // Find account ID from account name - accountsFromAPI is an array of {id, name} objects
    const accountObj = (accountsFromAPI || []).find(acc => acc.name === accountName);
    const accountId = accountObj?.id;
    
    console.log(`🔍 [BANK BALANCE] Found accountId: ${accountId} for accountName: ${accountName}`);
    console.log(`🔍 [BANK BALANCE] Available accounts:`, (accountsFromAPI || []).map(acc => ({ id: acc.id, name: acc.name })));
    
    if (!accountId) {
      console.log(`🔍 [BANK BALANCE] No accountId found for account name: ${accountName}`);
      return null;
    }

    // CRITICAL FIX: Use centralized SQL transactions instead of old localStorage historicalData
    // Old historicalData doesn't have savingsTargetId field and overwrites correct SQL data
    const allTransactions = budgetState.allTransactions || [];
    console.log(`🔍 [BANK BALANCE FIXED] Using ${allTransactions.length} transactions from centralized SQL storage instead of localStorage historicalData`);

    // DEBUG: Verify that SQL transactions have savingsTargetId field
    const savingsTransactions = allTransactions.filter(t => t.savingsTargetId);
    console.log(`🎯 [SAVINGS DEBUG] Found ${savingsTransactions.length} transactions with savingsTargetId in centralized storage`);
    savingsTransactions.forEach(t => {
      console.log(`  - Transaction ${t.id}: savingsTargetId=${t.savingsTargetId}, description="${t.description}"`);
    });

    console.log(`🔍 [BANK BALANCE] Finding bank balance for account ${accountName} (${accountId}) in month ${monthKey}`);
    
    // Use the extracted utility function that contains the exact same working logic
    return findBankBalanceForMonth(allTransactions, accountId, accountName, monthKey);
  };

  // Function to handle bank balance correction
  const handleBankBalanceCorrection = async (accountName: string, bankBalance: number) => {
    try {
      console.log(`🔄 [BANK BALANCE] Correcting balance for ${accountName} in ${selectedMonthKey} to ${bankBalance}`);
      
      // Update the account balance for the selected month
      updateAccountBalanceForMonth(selectedMonthKey, accountName, bankBalance);
      
      toast({
        title: "Saldo uppdaterat",
        description: `Kontosaldo för ${accountName} har uppdaterats till ${bankBalance.toLocaleString('sv-SE')} kr`,
      });
    } catch (error) {
      console.error('Error updating balance:', error);
      toast({
        title: "Fel vid uppdatering",
        description: "Kunde inte uppdatera kontosaldot",
        variant: "destructive"
      });
    }
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
      
      // Calculate totals using centralized logic
      // SYSTEMATIC FIX: Pass SQL data to eliminate budgetState dependency
      const allCategories = [...(huvudkategorier || []), ...(underkategorier || [])];
      const processedData = getProcessedBudgetDataForMonth(
        budgetState, 
        monthKey, 
        accountsFromAPI || [], 
        allCategories, 
        [] // Empty transactions for now until hook is implemented
      );
      const totalCosts = calculateTotalBudgetedCosts(processedData.costItems, monthKey);
      const totalSavings = calculateTotalBudgetedSavings(processedData.savingsItems, monthKey);
      
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
      <div className={`${isMobile ? 'h-64' : 'h-64 sm:h-80 lg:h-96'} w-full`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData}
            margin={{ 
              top: 20, 
              right: isMobile ? 5 : 30, 
              left: isMobile ? 20 : 60, 
              bottom: isMobile ? 80 : 40 
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="month" 
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? 'end' : 'middle'}
              height={isMobile ? 80 : 40}
              fontSize={isMobile ? 8 : 12}
              interval={isMobile ? 'preserveStartEnd' : 0}
              tick={isMobile ? { fontSize: 8 } : undefined}
            />
            <YAxis 
              fontSize={isMobile ? 8 : 12}
              width={isMobile ? 20 : 60}
              tickFormatter={(value) => isMobile ? `${Math.round(value / 1000)}k` : formatCurrency(value)}
              tick={isMobile ? { fontSize: 8 } : undefined}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              labelStyle={{ fontSize: isMobile ? '10px' : '14px' }}
              contentStyle={{ fontSize: isMobile ? '10px' : '14px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: isMobile ? '10px' : '14px' }}
              iconSize={isMobile ? 8 : 18}
            />
            <Line 
              type="monotone" 
              dataKey="totalIncome" 
              stroke="#22c55e" 
              name={isMobile ? "Intäkter" : "Totala Intäkter"}
              strokeWidth={isMobile ? 1.5 : 3}
              dot={{ r: isMobile ? 2 : 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="totalCosts" 
              stroke="#ef4444" 
              name={isMobile ? "Kostnader" : "Totala Kostnader"}
              strokeWidth={isMobile ? 1.5 : 3}
              dot={{ r: isMobile ? 2 : 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="totalSavings" 
              stroke="#3b82f6" 
              name={isMobile ? "Sparande" : "Totalt Sparande"}
              strokeWidth={isMobile ? 1.5 : 3}
              dot={{ r: isMobile ? 2 : 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="totalDailyBudget" 
              stroke="#f59e0b" 
              name={isMobile ? "Daglig Budget" : "Total Daglig Budget"}
              strokeWidth={isMobile ? 1.5 : 3}
              dot={{ r: isMobile ? 2 : 4 }}
            />
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
       const [year, monthNum] = (monthKey || '').split('-').map(Number);
       
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
                .filter((sub: any) => subCategoryBelongsToAccount(sub, account) && sub.financedFrom === 'Enskild kostnad')
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
                .filter((sub: any) => subCategoryBelongsToAccount(sub, account) && sub.financedFrom === 'Enskild kostnad')
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
      <div className={`bg-muted/50 rounded-lg ${isMobile ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center space-x-2 mb-3">
          <Checkbox 
            checked={useCustomTimeRange}
            onCheckedChange={(checked) => setUseCustomTimeRange(checked as boolean)}
          />
          <h4 className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Anpassa tidsintervall</h4>
        </div>
        
        {useCustomTimeRange && (
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-1 md:grid-cols-2 gap-4'}`}>
             <div>
               <Label htmlFor="chart-start-month" className={isMobile ? 'text-xs' : 'text-sm'}>Startmånad:</Label>
               <Select value={chartStartMonth} onValueChange={setChartStartMonth}>
                 <SelectTrigger className={isMobile ? 'h-8 text-sm' : ''}>
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
                         <SelectItem key={month} value={month}>{isMobile ? `${year.toString().slice(2)}-${monthName.slice(0,3)}` : `${year} - ${monthName}`}</SelectItem>
                       );
                     });
                   })()}
                 </SelectContent>
               </Select>
             </div>
            <div>
              <Label htmlFor="chart-end-month" className={isMobile ? 'text-xs' : 'text-sm'}>Slutmånad:</Label>
              <Select value={chartEndMonth} onValueChange={setChartEndMonth}>
                <SelectTrigger className={isMobile ? 'h-8 text-sm' : ''}>
                  <SelectValue placeholder="Välj slutmånad" />
                </SelectTrigger>
                <SelectContent>
                  {savedMonthKeys.map(month => {
                    const [year, monthNum] = month.split('-');
                    const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                                       'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
                    const monthName = monthNames[parseInt(monthNum) - 1];
                    return (
                      <SelectItem key={month} value={month}>{isMobile ? `${year.toString().slice(2)}-${monthName.slice(0,3)}` : `${year} - ${monthName}`}</SelectItem>
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
      <div className={`space-y-6 ${isMobile ? 'space-y-4' : ''}`}>
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
        <div className={`bg-muted/50 rounded-lg ${isMobile ? 'p-3' : 'p-4'}`}>
          <h4 className={`font-medium mb-3 ${isMobile ? 'text-sm' : ''}`}>Visa saldo som:</h4>
          <ToggleGroup 
            type="single" 
            value={balanceType} 
            onValueChange={(value) => value && setBalanceType(value as 'starting' | 'closing')}
            className={`grid grid-cols-2 w-full ${isMobile ? 'max-w-xs' : 'max-w-md'}`}
          >
            <ToggleGroupItem 
              value="starting" 
              className={`data-[state=on]:bg-primary data-[state=on]:text-primary-foreground ${isMobile ? 'text-xs h-8' : 'text-sm'}`}
            >
              Ingående
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="closing" 
              className={`data-[state=on]:bg-primary data-[state=on]:text-primary-foreground ${isMobile ? 'text-xs h-8' : 'text-sm'}`}
            >
              Slutsaldo
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Chart Display Options */}
        <div className={`bg-muted/50 rounded-lg ${isMobile ? 'p-3' : 'p-4'}`}>
          <h4 className={`font-medium mb-3 ${isMobile ? 'text-sm' : ''}`}>Visa även i grafen:</h4>
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
            className={`grid w-full ${isMobile ? 'grid-cols-1 gap-2 max-w-xs' : 'grid-cols-3 max-w-lg'}`}
          >
            <ToggleGroupItem 
              value="utgifter" 
              className={`data-[state=on]:bg-primary data-[state=on]:text-primary-foreground ${isMobile ? 'text-xs h-8' : 'text-sm'}`}
            >
              Utgifter
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="sparande" 
              className={`data-[state=on]:bg-primary data-[state=on]:text-primary-foreground ${isMobile ? 'text-xs h-8' : 'text-sm'}`}
            >
              Sparande
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="estimat" 
              className={`data-[state=on]:bg-primary data-[state=on]:text-primary-foreground ${isMobile ? 'text-xs h-8' : 'text-sm'}`}
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
              <Button variant="ghost" className={`flex-1 justify-between h-auto ${isMobile ? 'p-2 text-sm' : 'p-3'}`}>
                <span className={`font-medium ${isMobile ? 'text-sm' : ''}`}>Diagramförklaring</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isChartLegendExpanded ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            {!isMobile && (
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
            )}
          </div>
          <CollapsibleContent>
            <div className={`bg-muted/30 rounded-lg space-y-3 ${isMobile ? 'p-3 text-xs' : 'p-4 text-sm'}`}>
              {/* Dynamic legend based on selected accounts and settings */}
              <div className="space-y-2">
                <p className={`font-medium mb-2 ${isMobile ? 'text-xs' : ''}`}>Kontosaldon:</p>
                <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {selectedAccountsForChart.map((account, index) => {
                    const color = accountColors[accounts.indexOf(account) % accountColors.length];
                    return (
                      <div key={account} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-0.5 rounded" 
                            style={{ backgroundColor: color }}
                          />
                          <span className={isMobile ? 'text-xs' : 'text-xs'}>{account} (Historisk)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-0.5 rounded border-dashed border-2" 
                            style={{ borderColor: color }}
                          />
                          <span className={isMobile ? 'text-xs' : 'text-xs'}>{account} (Prognos)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Individual costs legend - only show if enabled */}
              {showIndividualCostsOutsideBudget && selectedAccountsForChart.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <h4 className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>Enskilda kostnader</h4>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-red-500" />
                    <Label className={isMobile ? 'text-xs' : 'text-sm'}>Enskilda kostnader (röd cirkel)</Label>
                  </div>
                </div>
              )}

              {/* Savings legend - only show if enabled */}
              {showSavingsSeparately && selectedAccountsForChart.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <h4 className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>Sparande</h4>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-green-500" />
                    <Label className={isMobile ? 'text-xs' : 'text-sm'}>Sparande (grön cirkel)</Label>
                  </div>
                </div>
              )}

              {/* Estimated values legend - only show if enabled */}
              {showEstimatedBudgetAmounts && selectedAccountsForChart.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className={`font-medium mb-2 ${isMobile ? 'text-xs' : ''}`}>Estimerade budgetbelopp:</p>
                  <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
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
                          <span className={isMobile ? 'text-xs' : 'text-xs'}>{account} (Estimerat)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* General legend */}
              <div className="border-t pt-3">
                <p className={`font-medium mb-2 ${isMobile ? 'text-xs' : ''}`}>Allmän förklaring:</p>
                <div className={`grid gap-1 text-muted-foreground ${isMobile ? 'grid-cols-1 text-xs' : 'grid-cols-1 md:grid-cols-2 text-xs'}`}>
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
                        // Use budget posts for income calculation
                        totalSalary: calculateTotalIncomeFromBudgetPosts() * 100,
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
    
    // Calculate totals using centralized logic
    // SYSTEMATIC FIX: Pass SQL data to eliminate budgetState dependency
    const allCategories = [...(huvudkategorier || []), ...(underkategorier || [])];
    const processedData = getProcessedBudgetDataForMonth(
      budgetState, 
      selectedHistoricalMonth, 
      accountsFromAPI || [], 
      allCategories, 
      [] // Empty transactions for now until hook is implemented
    );
    const totalCosts = calculateTotalBudgetedCosts(processedData.costItems, selectedHistoricalMonth);
    const totalSavings = calculateTotalBudgetedSavings(processedData.savingsItems, selectedHistoricalMonth);
    
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
                          <span>{formatOrenAsCurrency(sub.amount)}</span>
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
                    <span className="font-medium">{formatOrenAsCurrency(group.amount)}</span>
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
                        {formatCurrency(calculateTotalIncomeFromBudgetPosts())}
                      </CardDescription>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform text-green-800 ${expandedSections.incomeDetails ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
                {expandedSections.incomeDetails && (
                  <CardContent className="space-y-6 bg-green-50/30">
                    <DynamicIncomeSection 
                      monthKey={budgetState.selectedMonthKey}
                      onIncomeUpdate={() => {
                        // Trigger any necessary updates after income change
                        const currentDate = new Date();
                        const currentMonthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                        resetMonthFinalBalancesFlag(currentMonthKey);
                      }}
                    />

                  </CardContent>
                )}
              </Card>

              {/* Kontosaldo Kopia Section */}
              <Card className="shadow-lg border-0 bg-indigo-50/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('accountBalancesCopy')}>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-indigo-800">
                        <TrendingUp className="h-5 w-5" />
                        Kontosaldo Kopia
                      </CardTitle>
                      <CardDescription className="text-indigo-700">
                        {(() => {
                          if (!budgetState.selectedMonthKey) return 'Dagen före lönedatum';
                          
                          const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
                          const payday = budgetState?.payday || 25;
                          
                          const monthNames = [
                            'januari', 'februari', 'mars', 'april', 'maj', 'juni',
                            'juli', 'augusti', 'september', 'oktober', 'november', 'december'
                          ];
                          
                          // For the payday date, we show the payday of the PREVIOUS month
                          let payYear = year;
                          let payMonth = month - 1;
                          
                          if (payMonth === 0) {
                            payMonth = 12;
                            payYear = year - 1;
                          }
                          
                          // Calculate total from budget posts with Balance type or use 0 if none exist
                          const balancePosts = budgetPostsFromAPI.filter((post: any) => post.type === 'Balance');
                          const total = balancePosts.reduce((sum: number, post: any) => {
                            if (post.accountUserBalance !== null && post.accountUserBalance !== undefined) {
                              return sum + (post.accountUserBalance / 100); // Convert from öre to kronor
                            }
                            return sum;
                          }, 0);
                          
                          return `Totalt saldo den ${payday} ${monthNames[payMonth - 1]}: ${formatCurrency(total)}`;
                        })()}
                      </CardDescription>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform text-indigo-800 ${expandedSections.accountBalancesCopy ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
                {expandedSections.accountBalancesCopy && (
                  <CardContent className="space-y-4">
                    <KontosaldoKopia monthKey={budgetState.selectedMonthKey} />
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
                                            // NEW: Prioritize SQL data over localStorage
                                            const sqlBalance = getFaktisktKontosaldoFromSQL(account);
                                            const currentBalance = sqlBalance !== null ? (sqlBalance / 100) : (accountBalances[account] || 0);
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
                                                         // NEW: Consider SQL data when determining if balance is set
                                                         const hasSQL = sqlBalance !== null;
                                                         const hasLocalStorage = accountBalancesSet[account];
                                                         const isBalanceSet = hasSQL || hasLocalStorage;
                                                         
                                                         const value = isBalanceSet
                                                           ? currentBalance.toString() 
                                                           : (currentBalance === 0 ? "Ej ifyllt" : currentBalance.toString());
                                                         console.log(`🔍 [INPUT VALUE] ${account}: currentBalance=${currentBalance}, hasSQL=${hasSQL}, hasLocalStorage=${hasLocalStorage}, isBalanceSet=${isBalanceSet}, defaultValue="${value}"`);
                                                         return value;
                                                       })()}
                                                       key={`${account}-${currentBalance}-${accountBalancesSet[account]}-${sqlBalance}`}
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

                                                  {/* Bankens saldo */}
                                                  {(() => {
                                                    console.log(`🔍 [BANK BALANCE UI] Checking bank balance for account: ${account}`);
                                                    const bankBalanceData = getBankBalance(account, selectedMonthKey);
                                                    
                                                    console.log(`🔍 [BANK BALANCE UI] Bank balance data result:`, bankBalanceData);
                                                    
                                                    // Show debug row if no data found
                                                    if (!bankBalanceData) {
                                                      return (
                                                        <div className="flex justify-between items-center">
                                                          <span className="text-sm font-medium text-purple-700">Bankens saldo</span>
                                                          <div className="flex items-center gap-2">
                                                            <div className="text-right">
                                                              <div className="w-32 text-right text-sm text-gray-500">
                                                                Ingen data tillgänglig
                                                              </div>
                                                              <div className="text-[10px] text-muted-foreground">
                                                                Importera transaktioner med saldo
                                                              </div>
                                                            </div>
                                                            <span className="text-sm text-gray-500 min-w-8"></span>
                                                          </div>
                                                        </div>
                                                      );
                                                    }

                                                    const bankBalance = bankBalanceData.balance;
                                                    const lastTransactionDate = bankBalanceData.date;
                                                    const systemBalance = currentBalance;
                                                    const balancesMatch = Math.abs(bankBalance - systemBalance) < 0.01;

                                                    return (
                                                      <div className="flex justify-between items-center">
                                                        <span className="text-sm font-medium text-purple-700">Bankens saldo</span>
                                                        <div className="flex items-center gap-2">
                                                          <div className="text-right">
                                                            <div className={`w-32 text-right text-sm ${balancesMatch ? 'text-green-600' : 'text-purple-600'}`}>
                                                              {formatCurrency(bankBalance)}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground">
                                                              {new Date(lastTransactionDate).toLocaleDateString('sv-SE')}
                                                            </div>
                                                          </div>
                                                          <span className={`text-sm min-w-8 ${balancesMatch ? 'text-green-600' : 'text-purple-600'}`}>kr</span>
                                                          {!balancesMatch && (
                                                            <Button
                                                              size="sm"
                                                              onClick={() => handleBankBalanceCorrection(account, bankBalance)}
                                                              className="text-xs px-2 py-1 ml-2"
                                                            >
                                                              Korrigera
                                                            </Button>
                                                          )}
                                                        </div>
                                                      </div>
                                                    );
                                                  })()}
                                                
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
                              onValueChange={(value) => value && setCostViewType(value as 'category' | 'account' | 'all')}
                              className="grid grid-cols-3 w-full max-w-lg"
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
                              <ToggleGroupItem 
                                value="all" 
                                className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                              >
                                Alla poster
                              </ToggleGroupItem>
                            </ToggleGroup>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <h4 className="font-semibold">Kostnadskategorier</h4>
                            <div className="space-x-2">
                              <Button size="sm" onClick={() => setShowAddBudgetDialog({ isOpen: true, type: 'cost' })}>
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                            {costViewType === 'category' ? (
                             // Enhanced expandable category view - Show ALL categories, not just those with budget posts
                              (() => {

                                
                                // Group subcategories by main category - SHOW ALL CATEGORIES, not just those with budget posts
                                const categoryGroups: { [key: string]: { total: number; subcategories: ExtendedSubCategory[] } } = {};
                                
                                // Initialize ALL main categories from SQL data
                                if (!huvudkategorierLoading && !underkategorierLoading) {

                                  
                                  // Initialize ALL huvudkategorier from SQL but DON'T add underkategorier as budget posts
                                  // The hierarchical structure will be handled in the next step
                                  huvudkategorier.forEach(huvudkat => {
                                    if (!categoryGroups[huvudkat.name]) {
                                      categoryGroups[huvudkat.name] = { total: 0, subcategories: [] };
                                    }
                                    // Note: We don't add underkategorier here anymore - they're handled hierarchically below
                                  });
                                }
                                
                                // Process hierarchical PostgreSQL budget posts structure
                                costGroups.forEach((group) => {
                                  if (!categoryGroups[group.name]) {
                                    categoryGroups[group.name] = { total: 0, subcategories: [] };
                                  }
                                  
                                  group.subCategories?.forEach((sub) => {
                                    if (sub.isUnderkategori && sub.budgetPosts) {
                                      // Add underkategori as a container with nested budget posts
                                      const underkategoriContainer = {
                                        id: sub.id,
                                        name: sub.name,
                                        amount: sub.amount,
                                        groupId: group.id,
                                        isUnderkategori: true,
                                        budgetPosts: sub.budgetPosts // Keep the nested budget posts
                                      } as SubCategory & { 
                                        groupId: string; 
                                        isUnderkategori: boolean; 
                                        budgetPosts: any[] 
                                      };
                                      
                                      categoryGroups[group.name].subcategories.push(underkategoriContainer);
                                      categoryGroups[group.name].total += sub.amount;
                                    } else {
                                      // Handle legacy flat budget posts (non-hierarchical)
                                      const existingSubcategory = categoryGroups[group.name].subcategories.find(existing => existing.name === sub.name);
                                      if (!existingSubcategory) {
                                        let amount = 0;
                                        if (sub.transferType === 'daily') {
                                          amount = calculateMonthlyAmountForDailyTransfer(sub, selectedBudgetMonth);
                                        } else {
                                          amount = sub.amount;
                                        }
                                        
                                        categoryGroups[group.name].subcategories.push({
                                          ...sub,
                                          groupId: group.id
                                        } as SubCategory & { groupId: string });
                                        
                                        categoryGroups[group.name].total += amount;
                                      }
                                    }
                                  });
                                });
                               
                                return Object.entries(categoryGroups).map(([categoryName, data]) => {
                                  // CRITICAL FIX: Use UUID-based category ID instead of old string-based ID
                                  // Find the correct UUID for this category from the huvudkategorier API data
                                  const categoryUuid = huvudkategorier.find(kat => kat.name === categoryName)?.id;
                                  
                                  // Fallback to old system if UUID not found (backwards compatibility)
                                  const categoryGroup = costGroups.find(g => g.name === categoryName);
                                  const categoryIdToUse = categoryUuid || categoryGroup?.id || categoryName;
                                  
                                  // CRITICAL FIX: Always calculate actual amount, even if budget is 0
                                  const actualAmount = calculateActualAmountForCategory(categoryIdToUse);
                                  const difference = data.total - Math.abs(actualAmount);
                                  const progress = data.total > 0 ? (actualAmount / data.total) * 100 : 0;
                                  

                                 
                                 return (
                                 <div key={categoryName} className="group relative bg-gradient-to-r from-background to-muted/30 border-2 border-border/50 rounded-xl p-4 space-y-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] animate-fade-in">
                                   {/* Category Header */}
                                   <div className="flex items-center gap-3">
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={() => {
                                         // Add mobile debug log for Transport category when expanded
                                         if (categoryName === 'Transport' && !expandedCostGroups[categoryName]) {
                                           const categoryUuid = huvudkategorier.find(k => k.name === categoryName)?.id || categoryName;
                                           const actualAmount = calculateActualAmountForCategory(categoryUuid);
                                           const relatedSubs = underkategorier.filter(sub => sub.huvudkategoriId === categoryUuid);
                                           
                                           // Get all transactions to see what we're working with
                                           const allPeriodTx = activeContent.transactionsForPeriod || [];
                                           const braensleSubId = relatedSubs.find(s => s.name === 'Bränsle')?.id;
                                           
                                           // Find transactions that might be Transport-related  
                                           const potentialMatches = allPeriodTx.filter(t => 
                                             t.description?.toLowerCase().includes('stavsnas') ||
                                             t.description?.toLowerCase().includes('macken') ||
                                             t.description?.toLowerCase().includes('bränsle') ||
                                             t.appCategoryId === categoryUuid ||
                                             t.appSubCategoryId === braensleSubId
                                           );
                                           
                                           // Also search for "stavsnas" in ALL transactions (not just current period)
                                           const stavsnasInAll = (transactionsFromAPI || []).filter(t => 
                                             t.description?.toLowerCase().includes('stavsnas')
                                           );
                                           
                                           addMobileDebugLog(`🚗 [TRANSPORT CATEGORY CLICKED]`);
                                           addMobileDebugLog(`  - Category ID: ${categoryUuid}`);
                                           addMobileDebugLog(`  - Actual amount: ${actualAmount / 100} kr`);
                                           addMobileDebugLog(`  - Subcategories: ${relatedSubs.map(s => s.name).join(', ')}`);
                                           addMobileDebugLog(`  - Bränsle Sub ID: ${braensleSubId}`);
                                           addMobileDebugLog(`  - Found ${potentialMatches.length} potential Transport transactions:`);
                                           
                                           potentialMatches.slice(0, 3).forEach((t, i) => {
                                             addMobileDebugLog(`    ${i+1}. ${t.description} (-${Math.abs(t.amount)/100}kr)`);
                                             addMobileDebugLog(`       appCat: ${t.appCategoryId || 'null'}`);
                                             addMobileDebugLog(`       appSub: ${t.appSubCategoryId || 'null'}`);
                                           });
                                           
                                           // Show Stavsnas search results
                                           addMobileDebugLog(`  - Stavsnas transactions found in ALL data: ${stavsnasInAll.length}`);
                                           stavsnasInAll.forEach((t, i) => {
                                             addMobileDebugLog(`    ${i+1}. ${t.description} (${new Date(t.date).toISOString().split('T')[0]})`);
                                             addMobileDebugLog(`       Amount: ${t.amount/100}kr, Cat: ${t.appCategoryId || 'null'}`);
                                             addMobileDebugLog(`       Sub: ${t.appSubCategoryId || 'null'}`);
                                           });
                                         }
                                         
                                         setExpandedCostGroups(prev => ({
                                           ...prev,
                                           [categoryName]: !prev[categoryName]
                                         }));
                                       }}
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
                                           Budget: <span className="font-bold text-blue-900 dark:text-blue-100">{formatOrenAsCurrency(data.total)}</span>
                                         </div>
                                         <div className="text-sm font-medium text-green-700 dark:text-green-300 mt-1">
                                           Faktiskt: 
                                           <button
                                             className={`ml-1 font-bold underline decoration-2 underline-offset-2 hover:scale-105 transition-all duration-200 ${
                                               actualAmount < 0 
                                                 ? 'text-red-800 dark:text-red-200 hover:text-red-600 dark:hover:text-red-400' 
                                                 : 'text-green-800 dark:text-green-200 hover:text-green-600 dark:hover:text-green-400'
                                             }`}
                                             onClick={() => openDrillDownDialog(categoryName, categoryIdToUse, data.total)}
                                           >
                                             {formatOrenAsCurrency(actualAmount)}
                                           </button>
                                         </div>
                                         <div className={`text-sm font-bold mt-1 ${difference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                           <span className="inline-flex items-center gap-1">
                                             {difference >= 0 ? '↗' : '↘'} {difference >= 0 ? '+' : ''}{formatOrenAsCurrency(Math.abs(difference))}
                                           </span>
                                         </div>
                                       </div>
                                     </div>
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
                                             {sub.isUnderkategori ? (
                                               // Render underkategori container with nested budget posts
                                               <div className="space-y-2">
                                                 <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20 p-3">
                                                   <div className="flex justify-between items-center">
                                                     <div className="flex items-center gap-2">
                                                       <Button
                                                         variant="ghost"
                                                         size="sm"
                                                         onClick={() => setExpandedBudgetCategories(prev => ({
                                                           ...prev,
                                                           [`underkategori_${categoryName}_${sub.id}`]: !prev[`underkategori_${categoryName}_${sub.id}`]
                                                         }))}
                                                         className="p-1 h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20"
                                                       >
                                                         {expandedBudgetCategories[`underkategori_${categoryName}_${sub.id}`] ? (
                                                           <ChevronUp className="h-4 w-4 text-primary" />
                                                         ) : (
                                                           <ChevronDown className="h-4 w-4 text-primary" />
                                                         )}
                                                       </Button>
                                                       <span className="font-semibold text-primary">{sub.name}</span>
                                                       <Badge variant="secondary" className="text-xs">Underkategori</Badge>
                                                     </div>
                                                     <div className="text-right space-y-1">
                                                       <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                                         Budget: <span className="font-bold text-blue-900 dark:text-blue-100">{formatOrenAsCurrency(sub.amount)}</span>
                                                       </div>
                                                       <div className="text-sm font-medium text-green-700 dark:text-green-300">
                                                         Faktiskt: 
                                                         <button
                                                           className={`ml-1 font-bold underline decoration-2 underline-offset-2 hover:scale-105 transition-all duration-200 ${
                                                             calculateActualAmountForUnderkategori(sub.id) < 0 
                                                               ? 'text-red-800 dark:text-red-200 hover:text-red-600 dark:hover:text-red-400' 
                                                               : 'text-green-800 dark:text-green-200 hover:text-green-600 dark:hover:text-green-400'
                                                           }`}
                                                           onClick={() => openUnderkategoriDrillDownDialog(sub.name, sub.id, sub.amount)}
                                                         >
                                                           {formatOrenAsCurrency(calculateActualAmountForUnderkategori(sub.id))}
                                                         </button>
                                                       </div>
                                                     </div>
                                                   </div>
                                                 </div>
                                                 
                                                 {/* Show nested budget posts when expanded */}
                                                 {expandedBudgetCategories[`underkategori_${categoryName}_${sub.id}`] && sub.budgetPosts && (
                                                   <div className="ml-8 space-y-2">
                                                     {sub.budgetPosts.map((budgetPost: any) => (
                                                       <div key={budgetPost.id} className="bg-gradient-to-r from-background to-muted/20 rounded-lg border border-border/50 overflow-hidden transition-all duration-200 hover:shadow-md">
                                                         <div className="flex justify-between items-center p-3 cursor-pointer"
                                                              onClick={() => setExpandedBudgetCategories(prev => ({
                                                                ...prev,
                                                                [`budgetpost_${categoryName}_${budgetPost.id}`]: !prev[`budgetpost_${categoryName}_${budgetPost.id}`]
                                                              }))}>
                                                            <div className="flex items-center gap-2">
                                                              <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="p-1 h-8 w-8 rounded-full bg-primary/5 hover:bg-primary/10"
                                                              >
                                                                {expandedBudgetCategories[`budgetpost_${categoryName}_${budgetPost.id}`] ? (
                                                                  <ChevronUp className="h-4 w-4 text-primary" />
                                                                ) : (
                                                                  <ChevronDown className="h-4 w-4 text-primary" />
                                                                )}
                                                              </Button>
                                                              <span className="font-medium text-foreground">→ {budgetPost.name}</span>
                                                              <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  openEditDialog(budgetPost, categoryName);
                                                                }}
                                                                className="p-1 h-8 w-8 rounded-full bg-secondary/50 hover:bg-secondary/80 transition-all duration-200 opacity-70 hover:opacity-100"
                                                              >
                                                                <Edit className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                              </Button>
                                                            </div>
                                                            <span className="font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full text-sm">
                                                              {budgetPost.transferType === 'daily' 
                                                                ? formatOrenAsCurrency(calculateMonthlyAmountForDailyTransfer(budgetPost, selectedBudgetMonth))
                                                                : formatOrenAsCurrency(budgetPost.amount)
                                                              }
                                                            </span>
                                                         </div>
                                                         
                                                         {/* Budget post expandable details */}
                                                         {expandedBudgetCategories[`budgetpost_${categoryName}_${budgetPost.id}`] && (
                                                           <div className="p-4 bg-gradient-to-r from-muted/30 to-muted/10 border-t border-border/30 animate-accordion-down">
                                                             <div className="grid grid-cols-2 gap-4 text-sm">
                                                               <div>
                                                                 <span className="text-muted-foreground">Huvudkategori:</span>
                                                                 <div className="font-medium">{categoryName}</div>
                                                               </div>
                                                               <div>
                                                                 <span className="text-muted-foreground">Underkategori:</span>
                                                                 <div className="font-medium">{budgetPost.subcategory}</div>
                                                               </div>
                                                             </div>
                                                             
                                                             <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                                               <div>
                                                                 <span className="text-muted-foreground">Överföringstyp:</span>
                                                                 <div className="font-medium">{budgetPost.transferType === 'daily' ? 'Daglig överföring' : 'Månadsöverföring'}</div>
                                                               </div>
                                                                <div>
                                                                   <span className="text-muted-foreground">Konto:</span>
                                                                   <div className="font-medium">{budgetPost.accountId ? accountsFromAPI.find(acc => acc.id === budgetPost.accountId)?.name || 'Inget konto' : 'Inget konto'}</div>
                                                                </div>
                                                             </div>
                                                             
                                                             <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                                               <div>
                                                                 <span className="text-muted-foreground">
                                                                   {budgetPost.transferType === 'daily' ? 'Månadsbelopp:' : 'Belopp:'}
                                                                 </span>
                                                                 <div className="font-medium">
                                                                   {budgetPost.transferType === 'daily' 
                                                                     ? formatOrenAsCurrency(calculateMonthlyAmountForDailyTransfer(budgetPost, selectedBudgetMonth))
                                                                     : formatOrenAsCurrency(budgetPost.amount)
                                                                   }
                                                                 </div>
                                                               </div>
                                                               <div>
                                                                 <span className="text-muted-foreground">Finansieras ifrån:</span>
                                                                 <div className="font-medium">{budgetPost.financedFrom || 'Löpande kostnad'}</div>
                                                               </div>
                                                             </div>
                                                           </div>
                                                         )}
                                                       </div>
                                                     ))}
                                                   </div>
                                                 )}
                                               </div>
                                             ) : (
                                               // Display mode with expandable details for regular budget posts
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
                                                           <div className="font-medium">{sub.accountId ? accountsFromAPI.find(acc => acc.id === sub.accountId)?.name || 'Inget konto' : 'Inget konto'}</div>
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
                                       </div>
                                     </div>
                                   )}
                                 </div>
                                 );
                               });
                             })()
                            ) : costViewType === 'account' ? (
                              // Account view - show costs grouped by account
                              (() => {
                                console.log('🔍 [COST ACCOUNT VIEW] Starting account-first logic');
                                console.log('🔍 [COST ACCOUNT VIEW] Available accounts:', activeContent.activeAccounts);
                                console.log('🔍 [COST ACCOUNT VIEW] costGroups:', costGroups);
                                
                                return (
                                  <div className="space-y-4">
                                    {/* Account sections */}
                                    {(activeContent.activeAccounts || []).map((account) => {
                                      const accountExpanded = expandedCostGroups[`cost-account-${account.id}`];
                                      
                                      // Get cost items for this account from all cost groups
                                      const costItemsForAccount = costGroups.flatMap(group => 
                                        (group.subCategories || []).flatMap(sub => {
                                          // Check for new hierarchical structure with nested budget posts
                                          if (sub.budgetPosts && sub.budgetPosts.length > 0) {
                                            return sub.budgetPosts
                                              .filter((post: any) => post.accountId === account.id)
                                              .map((post: any) => ({ 
                                                ...post, 
                                                groupName: group.name, 
                                                groupId: group.id,
                                                subCategoryName: sub.name
                                              }));
                                          } else {
                                            // Handle legacy flat structure
                                            return sub.accountId === account.id ? [{ 
                                              ...sub, 
                                              groupName: group.name, 
                                              groupId: group.id,
                                              subCategoryName: sub.name 
                                            }] : [];
                                          }
                                        })
                                      );
                                      
                                      // Get transactions for this account (costs) - same logic as getTransactionsForAccountId
                                      const allTransactionsForAccount = (activeContent.transactionsForPeriod || []).filter(t => 
                                        t.accountId === account.id && (t.type === 'Transaction' || t.type === 'ExpenseClaim')
                                      );
                                      
                                      // Filter for only negative amounts (costs) - same logic as openAccountDrillDownDialog
                                      const transactionsForAccount = allTransactionsForAccount.filter(t => {
                                        const effectiveAmount = (t.correctedAmount !== undefined && t.correctedAmount !== null && t.correctedAmount !== t.amount) ? t.correctedAmount : t.amount;
                                        return effectiveAmount < 0; // Only negative amounts (costs)
                                      });
                                      
                                      // Calculate totals
                                      const budgetedAmount = costItemsForAccount.reduce((sum, item) => {
                                        if (item.transferType === 'daily') {
                                          return sum + (calculateMonthlyAmountForDailyTransfer(item, selectedBudgetMonth) * 100);
                                        }
                                        return sum + item.amount;
                                      }, 0);
                                      
                                      const actualAmount = transactionsForAccount.reduce((sum, t) => {
                                        const effectiveAmount = (t.correctedAmount !== undefined && t.correctedAmount !== null && t.correctedAmount !== t.amount) ? t.correctedAmount : t.amount;
                                        return sum + effectiveAmount; // Keep negative amounts to show as costs
                                      }, 0);
                                      
                                      const difference = budgetedAmount - actualAmount;
                                      const progress = budgetedAmount > 0 ? (actualAmount / budgetedAmount) * 100 : 0;
                                      
                                      return (
                                        <div key={account.id} className="group relative bg-gradient-to-r from-background to-muted/30 border-2 border-border/50 rounded-xl p-4 space-y-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] animate-fade-in">
                                          {/* Account Header */}
                                          <div className="flex items-center gap-3">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => setExpandedCostGroups(prev => ({
                                                ...prev,
                                                [`cost-account-${account.id}`]: !prev[`cost-account-${account.id}`]
                                              }))}
                                              className="p-2 h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20 transition-all duration-200 group-hover:scale-110"
                                            >
                                              {accountExpanded ? (
                                                <ChevronUp className="h-5 w-5 text-primary transition-transform duration-200" />
                                              ) : (
                                                <ChevronDown className="h-5 w-5 text-primary transition-transform duration-200" />
                                              )}
                                            </Button>
                                            
                                            <div className="flex-1 min-w-0">
                                              <div className="font-bold text-lg text-foreground group-hover:text-primary transition-colors duration-200">
                                                {account.name}
                                              </div>
                                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1">
                                                  <div className="w-2 h-2 rounded-full bg-primary/60"></div>
                                                  {costItemsForAccount.length} {costItemsForAccount.length === 1 ? 'post' : 'poster'}
                                                </span>
                                              </div>
                                            </div>
                                            
                                            {/* Enhanced Budget vs Actual */}
                                            <div className="text-right space-y-2">
                                              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                                <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                                  Budget: <span className="font-bold text-blue-900 dark:text-blue-100">{formatCurrency(budgetedAmount / 100)}</span>
                                                </div>
                                                <div className="text-sm font-medium text-green-700 dark:text-green-300 mt-1">
                                                  Faktiskt: 
                                                  <button
                                                    className={`ml-1 font-bold underline decoration-2 underline-offset-2 hover:scale-105 transition-all duration-200 ${
                                                      actualAmount < 0 
                                                        ? 'text-red-800 dark:text-red-200 hover:text-red-600 dark:hover:text-red-400' 
                                                        : 'text-green-800 dark:text-green-200 hover:text-green-600 dark:hover:text-green-400'
                                                    }`}
                                                    onClick={() => openAccountDrillDownDialog(account.id, account.name, budgetedAmount, actualAmount)}
                                                  >
                                                    {formatCurrency(actualAmount / 100)}
                                                  </button>
                                                </div>
                                                <div className={`text-sm font-bold mt-1 ${difference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                  <span className="inline-flex items-center gap-1">
                                                    {difference >= 0 ? '↗' : '↘'} {difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(difference) / 100)}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
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
                                          {accountExpanded && (
                                            <div className="animate-accordion-down">
                                              <div className="mt-4 pl-8 space-y-3 border-l-4 border-primary/30 bg-gradient-to-r from-muted/20 to-transparent rounded-r-lg pr-4 py-3">
                                                {/* Cost items (posts) for this account */}
                                                {costItemsForAccount.length > 0 && (
                                                  <div className="space-y-3">
                                                    <h5 className="font-semibold text-primary/80">Kostnadsposter</h5>
                                                    {costItemsForAccount.map((item) => {
                                                      const itemActual = item.underkategoriId 
                                                        ? calculateActualAmountForUnderkategori(item.underkategoriId)
                                                        : 0;
                                                      
                                                      return (
                                                        <div key={item.id} className="bg-gradient-to-r from-background to-muted/20 rounded-lg border border-border/50 overflow-hidden transition-all duration-200 hover:shadow-md">
                                                          <div className="flex justify-between items-center p-3 cursor-pointer"
                                                               onClick={() => setExpandedBudgetCategories(prev => ({
                                                                 ...prev,
                                                                 [`account_${account.id}_${item.id}`]: !prev[`account_${account.id}_${item.id}`]
                                                               }))}>
                                                             <div className="flex items-center gap-2">
                                                               <Button
                                                                 variant="ghost"
                                                                 size="sm"
                                                                 className="p-1 h-8 w-8 rounded-full bg-primary/5 hover:bg-primary/10"
                                                               >
                                                                 {expandedBudgetCategories[`account_${account.id}_${item.id}`] ? (
                                                                   <ChevronUp className="h-4 w-4 text-primary" />
                                                                 ) : (
                                                                   <ChevronDown className="h-4 w-4 text-primary" />
                                                                 )}
                                                               </Button>
                                                               <span className="font-medium text-foreground">{item.name || item.description}</span>
                                                             </div>
                                                             <span className="font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full text-sm">
                                                               {item.transferType === 'daily' 
                                                                 ? formatCurrency(calculateMonthlyAmountForDailyTransfer(item, selectedBudgetMonth))
                                                                 : formatCurrency(item.amount / 100)
                                                               }
                                                             </span>
                                                          </div>
                                                          
                                                          {/* Expandable details - same format as Kategorier view */}
                                                          {expandedBudgetCategories[`account_${account.id}_${item.id}`] && (
                                                            <div className="p-4 bg-gradient-to-r from-muted/30 to-muted/10 border-t border-border/30 animate-accordion-down">
                                                              <div className="grid grid-cols-2 gap-4 text-sm">
                                                                <div>
                                                                  <span className="text-muted-foreground">Huvudkategori:</span>
                                                                  <div className="font-medium">{item.groupName}</div>
                                                                </div>
                                                                <div>
                                                                  <span className="text-muted-foreground">Underkategori:</span>
                                                                  <div className="font-medium">{item.subCategoryName || item.name || item.description}</div>
                                                                </div>
                                                              </div>
                                                              
                                                              <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                                                <div>
                                                                  <span className="text-muted-foreground">Överföringstyp:</span>
                                                                  <div className="font-medium">{item.transferType === 'daily' ? 'Daglig överföring' : 'Månadsöverföring'}</div>
                                                                </div>
                                                                <div>
                                                                  <span className="text-muted-foreground">Konto:</span>
                                                                  <div className="font-medium">{account.name}</div>
                                                                </div>
                                                              </div>
                                                              
                                                              <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                                                <div>
                                                                  <span className="text-muted-foreground">
                                                                    {item.transferType === 'daily' ? 'Månadsbelopp:' : 'Belopp:'}
                                                                  </span>
                                                                  <div className="font-medium">
                                                                    {item.transferType === 'daily' 
                                                                      ? formatCurrency(calculateMonthlyAmountForDailyTransfer(item, selectedBudgetMonth))
                                                                      : formatCurrency(item.amount / 100)
                                                                    }
                                                                  </div>
                                                                </div>
                                                                <div>
                                                                  <span className="text-muted-foreground">Finansieras ifrån:</span>
                                                                  <div className="font-medium">{item.financedFrom || 'Löpande kostnad'}</div>
                                                                </div>
                                                              </div>
                                                              
                                                              {/* Additional information for daily transfers */}
                                                              {item.transferType === 'daily' && (
                                                                <div className="border-t pt-3 mt-3 space-y-3">
                                                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                                                    <div>
                                                                      <span className="text-muted-foreground">Dagar det överförs:</span>
                                                                      <div className="font-medium">{formatTransferDays(item.transferDays || [])}</div>
                                                                    </div>
                                                                    <div>
                                                                      <span className="text-muted-foreground">Summa per dag:</span>
                                                                      <div className="font-medium">{formatCurrency(item.dailyAmount / 100 || 0)}</div>
                                                                    </div>
                                                                  </div>
                                                                  
                                                                  <div className="space-y-2">
                                                                    <div>
                                                                      <span className="text-muted-foreground">Estimerat överfört:</span>
                                                                      <div className="font-medium text-green-600">
                                                                        Dagar: {(() => {
                                                                          const estimatedAmount = calculateEstimatedToDate(item, selectedBudgetMonth);
                                                                          const daysToDate = Math.floor(estimatedAmount / ((item.dailyAmount / 100) || 1));
                                                                          return `${daysToDate} × ${formatCurrency((item.dailyAmount / 100) || 0)} = ${formatCurrency(estimatedAmount)}`;
                                                                        })()}
                                                                      </div>
                                                                    </div>
                                                                    
                                                                    <div>
                                                                      <span className="text-muted-foreground">Kvar att överföra:</span>
                                                                      <div className="font-medium text-blue-600">
                                                                        Dagar: {(() => {
                                                                          const remainingAmount = calculateRemaining(item, selectedBudgetMonth);
                                                                          const remainingDays = Math.floor(remainingAmount / ((item.dailyAmount / 100) || 1));
                                                                          return `${remainingDays} × ${formatCurrency((item.dailyAmount / 100) || 0)} = ${formatCurrency(remainingAmount)}`;
                                                                        })()}
                                                                      </div>
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()
                            ) : (
                              // Alla poster view - copy of account view  
                              (() => {
                                console.log('🔍 [COST ALL POSTS] Starting all posts view');
                                console.log('🔍 [COST ALL POSTS] costGroups:', costGroups);
                                
                                // Get ALL budget posts with type='cost' directly from API
                                const allCostItems = (budgetPostsFromAPI || [])
                                  .filter(post => post.type === 'cost' && post.monthKey === selectedBudgetMonth)
                                  .map(post => ({
                                    ...post,
                                    accountName: (activeContent.activeAccounts || []).find(acc => acc.id === post.accountId)?.name || 'Inget konto',
                                    groupName: huvudkategorier.find(h => h.id === post.huvudkategoriId)?.name || 'Okänd kategori',
                                    subCategoryName: underkategorier.find(u => u.id === post.underkategoriId)?.name || 'Okänd underkategori'
                                  }));
                                
                                console.log('🔍 [COST ALL POSTS] All cost items:', allCostItems);
                                
                                return (
                                  <div className="space-y-6">
                                    {/* Beautiful Header Section */}
                                    <div className="relative">
                                      <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl transform rotate-1"></div>
                                      <div className="relative bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-2xl p-6 border-2 border-blue-200/50 dark:border-blue-700/50 shadow-lg">
                                        <div className="flex items-center gap-4">
                                          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                                            <Receipt className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                          </div>
                                          <div>
                                            <h5 className="font-bold text-xl text-blue-900 dark:text-blue-100">Alla Kostnadsposter</h5>
                                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                              {allCostItems.length} {allCostItems.length === 1 ? 'post' : 'poster'} totalt
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Items Grid */}
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                      {allCostItems.length > 0 ? (
                                        allCostItems.map((item) => {
                                          return (
                                            <div key={item.id} className="group relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-200/60 dark:border-gray-700/60 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] animate-fade-in">
                                              {/* Decorative Corner */}
                                              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-bl-full opacity-60"></div>
                                              
                                              {/* Content */}
                                              <div className="relative space-y-4">
                                                {/* Title Section */}
                                                <div className="space-y-2">
                                                  <h6 className="font-bold text-lg text-gray-900 dark:text-gray-100 leading-tight">
                                                    {item.name || item.description}
                                                  </h6>
                                                  <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                        {item.groupName}
                                                        {item.subCategoryName && item.subCategoryName !== item.name && ` • ${item.subCategoryName}`}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                        {item.accountName}
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>
                                                
                                                {/* Budget Display */}
                                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-xl p-4 border border-blue-200/50 dark:border-blue-800/50">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                                      Budget
                                                    </span>
                                                    <div className="text-right">
                                                      <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                                                        {formatCurrency(item.amount / 100)}
                                                      </div>
                                                      <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                                        kr
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                              
                                              {/* Hover Effect Overlay */}
                                              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="col-span-full">
                                          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                                            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                              <Receipt className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                              Inga kostnadsposter hittades
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-500">
                                              Lägg till kostnadsposter för att se dem här
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        )}
                      </div>

                      {/* Total Savings with Dropdown - Same nice design as Totala kostnader */}
                      <div className="p-4 bg-green-50/80 rounded-lg">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('savingsCategories')}>
                          <div>
                            <div className="text-sm text-muted-foreground">Totalt sparande</div>
                            <div className="text-2xl font-bold text-green-600">
                              {formatCurrency((() => {
                                const savingsCategoriesTotal = allSavingsItems.reduce((sum, group) => {
                                  const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                  return sum + group.amount + subCategoriesTotal;
                                }, 0);
                                
                                const savingsGoalsMonthlyTotal = allSavingsGoals.reduce((sum, goal) => {
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
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <DollarSign className="h-5 w-5 text-green-600" />
                            </div>
                            {expandedSections.savingsCategories ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                        </div>
                        
                        {expandedSections.savingsCategories && (
                          <div className="mt-4 space-y-4">
                            {/* Savings View Type Option - Same as cost categories */}
                            <div className="bg-muted/50 p-4 rounded-lg">
                              <h4 className="font-medium mb-3">Visa sparandebelopp för:</h4>
                              <ToggleGroup 
                                type="single" 
                                value={savingsViewType} 
                                onValueChange={(value) => value && setSavingsViewType(value as 'category' | 'account')}
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
                              <h4 className="font-semibold">Budgetkategorier</h4>
                              <div className="space-x-2">
                                <Button size="sm" onClick={() => setShowAddBudgetDialog({ isOpen: true, type: 'savings' })}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                                <Button size="sm" onClick={() => setIsEditingSavings(!isEditingSavings)}>
                                  {isEditingSavings ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                                </Button>
                              </div>
                            </div>
                            
                            <SavingsSection
                              savingsGroups={allSavingsItems}
                              savingsGoals={allSavingsGoals}
                              accounts={accountsFromAPI}
                              mainCategories={budgetState.mainCategories || []}
                              transactionsForPeriod={activeContent.transactionsForPeriod}
                              calculateSavingsActualForCategory={calculateSavingsActualForCategory}
                              calculateActualForTarget={calculateActualForTarget}
                              onSavingsCategoryDrillDown={openSavingsCategoryDrillDownDialog}
                              onSavingsTargetDrillDown={openSavingsTargetDrillDownDialog}
                              onAddSavingsItem={(item) => {
                                console.log('Adding savings item:', item);
                                addSavingsItem(item);
                              }}
                              onEditSavingsGroup={(group) => {
                                // Handle editing savings group
                                console.log('Edit savings group:', group);
                              }}
                              onDeleteSavingsGroup={(id) => {
                                // Handle deleting savings group
                                console.log('Delete savings group:', id);
                                deleteSavingsGroup(id);
                              }}
                            />
                          </div>
                        )}
                      </div>
                  </CardContent>
                )}
              </Card>

              {/* Account Summary with Transfers - Moved to TransfersAnalysis component */}

              {/* Transfers Analysis Section */}
              <TransfersAnalysis 
                budgetState={budgetState} 
                selectedMonth={selectedBudgetMonth} 
              />


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
                        {formatCurrency(calculateTotalIncomeFromBudgetPosts() * 100)}
                      </CardDescription>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.budgetSummary ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
                {expandedSections.budgetSummary && results && (
                  <CardContent className="pt-0">
                    <div>Budget Summary Content Placeholder</div>
                  </CardContent>
                )}
              </Card>

              {/* Additional sections placeholder */}
              <div className="space-y-4">
                {/* Content placeholder */}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Sammanställning */}
        <TabsContent value="sammanstallning" className="mt-0">
          <Sammanstallning 
            budgetState={budgetState} 
            selectedMonth={selectedBudgetMonth} 
          />
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
        type={showAddBudgetDialog.type}
        monthKey={selectedBudgetMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
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
