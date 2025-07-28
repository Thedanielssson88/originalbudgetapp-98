import { useState, useEffect, useMemo } from 'react';
import { useBudget } from './useBudget';
import { AccountDataRow } from '@/components/AccountDataTable';

// Custom hook to handle all the complex state and effects for BudgetCalculator
export const useBudgetCalculator = () => {
  const { isLoading, budgetState, calculated } = useBudget();
  
  // ALL STATE HOOKS
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
  const [createMonthDirection, setCreateMonthDirection] = useState<'previous' | 'next'>('next');
  
  // Account balances state
  const [accountBalances, setAccountBalances] = useState<{[key: string]: number}>({});
  const [accountBalancesSet, setAccountBalancesSet] = useState<{[key: string]: boolean}>({});
  const [accountEstimatedFinalBalances, setAccountEstimatedFinalBalances] = useState<{[key: string]: number}>({});
  const [accountEstimatedFinalBalancesSet, setAccountEstimatedFinalBalancesSet] = useState<{[key: string]: boolean}>({});
  const [accountEstimatedStartBalances, setAccountEstimatedStartBalances] = useState<{[key: string]: number}>({});
  const [accountStartBalancesSet, setAccountStartBalancesSet] = useState<{[key: string]: boolean}>({});
  const [accountEndBalancesSet, setAccountEndBalancesSet] = useState<{[key: string]: boolean}>({});
  
  // Chart selection states
  const [selectedAccountsForChart, setSelectedAccountsForChart] = useState<string[]>([]);
  const [showIndividualCostsOutsideBudget, setShowIndividualCostsOutsideBudget] = useState<boolean>(false);
  const [showSavingsSeparately, setShowSavingsSeparately] = useState<boolean>(false);
  const [showEstimatedBudgetAmounts, setShowEstimatedBudgetAmounts] = useState<boolean>(false);
  const [balanceType, setBalanceType] = useState<'starting' | 'closing'>('closing');
  const [monthFinalBalances, setMonthFinalBalances] = useState<{[key: string]: boolean}>({});
  
  // Chart legend and time range states
  const [isChartLegendExpanded, setIsChartLegendExpanded] = useState<boolean>(false);
  const [useCustomTimeRange, setUseCustomTimeRange] = useState<boolean>(false);
  const [chartStartMonth, setChartStartMonth] = useState<string>('');
  const [chartEndMonth, setChartEndMonth] = useState<string>('');
  
  // Derived state (only when not loading)
  const { historicalData: appHistoricalData, selectedMonthKey } = budgetState;
  const currentMonthData = appHistoricalData[selectedMonthKey] || {};
  const accounts = budgetState.accounts.map(acc => acc.name);
  
  // Centralized month list logic for consistent dropdown behavior
  const availableMonths = useMemo(() => {
    const keys = Object.keys(appHistoricalData).sort((a, b) => a.localeCompare(b));
    console.log(`🔍 availableMonths recalculated. historicalData keys:`, keys);
    return keys;
  }, [appHistoricalData]);

  // Calculate structured account data for table view
  const accountDataRows: AccountDataRow[] = useMemo(() => {
    // Helper function to get Calc.Kontosaldo for a month and account
    const getCalcKontosaldoForTable = (monthKey: string, account: string) => {
      const monthData = appHistoricalData[monthKey];
      
      if (!monthData) {
        return { balance: 0, isEstimated: true };
      }
      
      // CRITICAL FIX: Always use the estimated final balance (which is calculated from starting balance + transactions)
      // rather than just the raw starting balance when manually set
      const estimatedFinalBalance = monthData.accountEstimatedFinalBalances?.[account];
      
      if (estimatedFinalBalance !== undefined && estimatedFinalBalance !== null) {
        // Use the calculated final balance (starting balance + transactions)
        const hasActualStartBalance = monthData.accountBalancesSet && 
                                    monthData.accountBalancesSet[account] === true;
        const isUsingEstimated = !hasActualStartBalance;
        return { balance: estimatedFinalBalance, isEstimated: isUsingEstimated };
      }
      
      // Fallback: if no estimated final balance available, use previous logic
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
        const prevMonthData = appHistoricalData[prevMonthKey];
        
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
    const allMonthKeys = Object.keys(appHistoricalData).sort();
    
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
  }, [appHistoricalData, accounts]);

  return {
    // Loading state
    isLoading,
    
    // Core data
    budgetState,
    calculated,
    currentMonthData,
    accounts,
    availableMonths,
    accountDataRows,
    
    // All state setters and values
    isEditingCategories,
    setIsEditingCategories,
    isEditingTransfers,
    setIsEditingTransfers,
    isEditingHolidays,
    setIsEditingHolidays,
    newHistoricalMonth,
    setNewHistoricalMonth,
    newMonthFromCopy,
    setNewMonthFromCopy,
    selectedSourceMonth,
    setSelectedSourceMonth,
    standardValues,
    setStandardValues,
    transferAccount,
    setTransferAccount,
    isInitialLoad,
    setIsInitialLoad,
    updateProgress,
    setUpdateProgress,
    isUpdatingAllMonths,
    setIsUpdatingAllMonths,
    activeTab,
    setActiveTab,
    previousTab,
    setPreviousTab,
    isAnimating,
    setIsAnimating,
    swipeDirection,
    setSwipeDirection,
    expandedSections,
    setExpandedSections,
    expandedBudgetCategories,
    setExpandedBudgetCategories,
    selectedPerson,
    setSelectedPerson,
    isEditingPersonalBudget,
    setIsEditingPersonalBudget,
    newAccountName,
    setNewAccountName,
    isEditingAccounts,
    setIsEditingAccounts,
    expandedAccounts,
    setExpandedAccounts,
    accountCategories,
    setAccountCategories,
    accountCategoryMapping,
    setAccountCategoryMapping,
    newCategoryName,
    setNewCategoryName,
    isEditingAccountCategories,
    setIsEditingAccountCategories,
    budgetTemplates,
    setBudgetTemplates,
    newTemplateName,
    setNewTemplateName,
    selectedTemplateSourceMonth,
    setSelectedTemplateSourceMonth,
    expandedTemplates,
    setExpandedTemplates,
    editingTemplate,
    setEditingTemplate,
    editingTemplateData,
    setEditingTemplateData,
    selectedTemplateToCopy,
    setSelectedTemplateToCopy,
    targetCopyMonth,
    setTargetCopyMonth,
    showTemplateDetails,
    setShowTemplateDetails,
    userName1,
    setUserName1,
    userName2,
    setUserName2,
    transferChecks,
    setTransferChecks,
    andreasShareChecked,
    setAndreasShareChecked,
    susannaShareChecked,
    setSusannaShareChecked,
    isCreateMonthDialogOpen,
    setIsCreateMonthDialogOpen,
    createMonthDirection,
    setCreateMonthDirection,
    accountBalances,
    setAccountBalances,
    accountBalancesSet,
    setAccountBalancesSet,
    accountEstimatedFinalBalances,
    setAccountEstimatedFinalBalances,
    accountEstimatedFinalBalancesSet,
    setAccountEstimatedFinalBalancesSet,
    accountEstimatedStartBalances,
    setAccountEstimatedStartBalances,
    accountStartBalancesSet,
    setAccountStartBalancesSet,
    accountEndBalancesSet,
    setAccountEndBalancesSet,
    selectedAccountsForChart,
    setSelectedAccountsForChart,
    showIndividualCostsOutsideBudget,
    setShowIndividualCostsOutsideBudget,
    showSavingsSeparately,
    setShowSavingsSeparately,
    showEstimatedBudgetAmounts,
    setShowEstimatedBudgetAmounts,
    balanceType,
    setBalanceType,
    monthFinalBalances,
    setMonthFinalBalances,
    isChartLegendExpanded,
    setIsChartLegendExpanded,
    useCustomTimeRange,
    setUseCustomTimeRange,
    chartStartMonth,
    setChartStartMonth,
    chartEndMonth,
    setChartEndMonth
  };
};