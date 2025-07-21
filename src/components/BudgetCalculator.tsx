import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Calculator, DollarSign, TrendingUp, Users, Calendar, Plus, Trash2, Edit, Save, X, ChevronDown, ChevronUp, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import CreateMonthDialog from './CreateMonthDialog';

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
  const [isEditingCategories, setIsEditingCategories] = useState<boolean>(false);
  const [isEditingTransfers, setIsEditingTransfers] = useState<boolean>(false);
  const [isEditingHolidays, setIsEditingHolidays] = useState<boolean>(false);
  const [customHolidays, setCustomHolidays] = useState<{date: string, name: string}[]>([]);
  const [results, setResults] = useState<{
    totalSalary: number;
    totalDailyBudget: number;
    remainingDailyBudget: number;
    holidayDaysBudget: number;
    balanceLeft: number;
    susannaShare: number;
    andreasShare: number;
    susannaPercentage: number;
    andreasPercentage: number;
    daysUntil25th: number;
    weekdayCount: number;
    fridayCount: number;
    totalMonthlyExpenses: number;
    holidayDays: string[];
    holidaysUntil25th: string[];
    nextTenHolidays: string[];
    remainingWeekdayCount: number;
    remainingFridayCount: number;
  } | null>(null);
  const [historicalData, setHistoricalData] = useState<{[key: string]: any}>({});
  const [selectedHistoricalMonth, setSelectedHistoricalMonth] = useState<string>('');
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState<string>(''); // New state for budget month selector
  const [newHistoricalMonth, setNewHistoricalMonth] = useState<string>(''); // State for new month input
  const [newMonthFromCopy, setNewMonthFromCopy] = useState<string>(''); // State for new month when copying from historical
  const [selectedSourceMonth, setSelectedSourceMonth] = useState<string>(''); // State for source month to copy from
  const [standardValues, setStandardValues] = useState<any>(null);
  const [transferAccount, setTransferAccount] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  
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
  const [andreasPersonalCosts, setAndreasPersonalCosts] = useState<BudgetGroup[]>([]);
  const [andreasPersonalSavings, setAndreasPersonalSavings] = useState<BudgetGroup[]>([]);
  const [susannaPersonalCosts, setSusannaPersonalCosts] = useState<BudgetGroup[]>([]);
  const [susannaPersonalSavings, setSusannaPersonalSavings] = useState<BudgetGroup[]>([]);
  const [isEditingPersonalBudget, setIsEditingPersonalBudget] = useState<boolean>(false);
  
  // Account management states
  const [accounts, setAccounts] = useState<string[]>(['Löpande', 'Sparkonto', 'Buffert']);
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [isEditingAccounts, setIsEditingAccounts] = useState<boolean>(false);
  const [expandedAccounts, setExpandedAccounts] = useState<{[key: string]: boolean}>({});

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
  
  // Account final balances (Slutsaldo) state - saved per month
  const [accountFinalBalances, setAccountFinalBalances] = useState<{[key: string]: number}>({});
  
  // Account chart selection state
  const [selectedAccountsForChart, setSelectedAccountsForChart] = useState<string[]>([]);

  // Tab navigation helper functions
  const getTabOrder = () => {
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonth = selectedBudgetMonth === currentMonthKey;
    
    return isCurrentMonth 
      ? ["inkomster", "sammanstallning", "overforing", "egen-budget", "historia", "installningar"]
      : ["inkomster", "sammanstallning", "egen-budget", "historia", "installningar"];
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
        setCustomHolidays(parsed.customHolidays || []);
        
        // Load personal budget data
        setSelectedPerson(parsed.selectedPerson || 'andreas');
        setAndreasPersonalCosts(parsed.andreasPersonalCosts || []);
        setAndreasPersonalSavings(parsed.andreasPersonalSavings || []);
        setSusannaPersonalCosts(parsed.susannaPersonalCosts || []);
        setSusannaPersonalSavings(parsed.susannaPersonalSavings || []);
        
        // Load historical data
        setHistoricalData(parsed.historicalData || {});
        
        // Load accounts data
        setAccounts(parsed.accounts || ['Löpande', 'Sparkonto', 'Buffert']);
        
        // Load budget templates
        setBudgetTemplates(parsed.budgetTemplates || {});
        
        // Load user names
        setUserName1(parsed.userName1 || 'Andreas');
        setUserName2(parsed.userName2 || 'Susanna');
        
        // Load transfer checkbox states
        setTransferChecks(parsed.transferChecks || {});
        setAndreasShareChecked(parsed.andreasShareChecked || false);
        setSusannaShareChecked(parsed.susannaShareChecked || false);
        
        // Load account balances
        setAccountBalances(parsed.accountBalances || {});
        
        // Load account final balances
        setAccountFinalBalances(parsed.accountFinalBalances || {});
        
        // Load selected accounts for chart
        setSelectedAccountsForChart(parsed.selectedAccountsForChart || []);
        
        if (parsed.results) {
          setResults(parsed.results);
        }
        
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
    }
    
    // Mark initial load as complete
    setTimeout(() => setIsInitialLoad(false), 100);

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
    setTimeout(() => calculateBudget(), 0);
  }, []);

  // Save current data to the selected month in historical data
  const saveToSelectedMonth = () => {
    const currentDate = new Date();
    const monthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Final balances are now calculated and saved directly in calculateBudget()
    
    const monthSnapshot = {
      month: monthKey,
      date: currentDate.toISOString(),
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
      customHolidays: JSON.parse(JSON.stringify(customHolidays)),
      andreasPersonalCosts: JSON.parse(JSON.stringify(andreasPersonalCosts)),
      andreasPersonalSavings: JSON.parse(JSON.stringify(andreasPersonalSavings)),
      susannaPersonalCosts: JSON.parse(JSON.stringify(susannaPersonalCosts)),
      susannaPersonalSavings: JSON.parse(JSON.stringify(susannaPersonalSavings)),
      accounts: JSON.parse(JSON.stringify(accounts)),
      accountBalances: JSON.parse(JSON.stringify(accountBalances)),
      accountFinalBalances: JSON.parse(JSON.stringify(accountFinalBalances)),
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
    
    console.log(`Saving month data for ${monthKey} with final balances:`, accountFinalBalances);
    
    setHistoricalData(prev => ({
      ...prev,
      [monthKey]: monthSnapshot
    }));
  };

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
      customHolidays,
      results,
      selectedPerson,
      andreasPersonalCosts,
      andreasPersonalSavings,
      susannaPersonalCosts,
      susannaPersonalSavings,
      historicalData,
      accounts,
      budgetTemplates,
      selectedBudgetMonth, // Save the selected month
      userName1,
      userName2,
      transferChecks,
      andreasShareChecked,
      susannaShareChecked,
      accountBalances,
      accountFinalBalances,
      selectedAccountsForChart
    };
    localStorage.setItem('budgetCalculatorData', JSON.stringify(dataToSave));
  };

  // Save data whenever key values change - both to localStorage and to selected month
  useEffect(() => {
    if (!isInitialLoad) {
      saveToLocalStorage();
      saveToSelectedMonth();
    }
  }, [andreasSalary, andreasförsäkringskassan, andreasbarnbidrag, susannaSalary, susannaförsäkringskassan, susannabarnbidrag, costGroups, savingsGroups, dailyTransfer, weekendTransfer, customHolidays, selectedPerson, andreasPersonalCosts, andreasPersonalSavings, susannaPersonalCosts, susannaPersonalSavings, accounts, budgetTemplates, userName1, userName2, transferChecks, andreasShareChecked, susannaShareChecked, accountBalances, accountFinalBalances, selectedAccountsForChart, isInitialLoad]);

  // Auto-calculate budget whenever any input changes
  useEffect(() => {
    calculateBudget();
  }, [andreasSalary, andreasförsäkringskassan, andreasbarnbidrag, susannaSalary, susannaförsäkringskassan, susannabarnbidrag, costGroups, savingsGroups, dailyTransfer, weekendTransfer, customHolidays, selectedBudgetMonth, transferAccount, andreasPersonalCosts, andreasPersonalSavings, susannaPersonalCosts, susannaPersonalSavings, accounts]);

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
    const balanceLeft = preliminaryBalance - susannaShare - andreasShare;
    
    // Calculate final balances (Slutsaldo) for each account FIRST
    const finalBalances: {[key: string]: number} = {};
    accounts.forEach(account => {
      const originalBalance = accountBalances[account] || 0;
      
      // Calculate total deposits for this account from savings groups
      const accountSavings = savingsGroups
        .filter((group: any) => group.account === account)
        .reduce((sum: number, group: any) => sum + group.amount, 0);
      
      // Calculate total costs for this account from cost subcategories  
      const accountCosts = costGroups.reduce((sum: number, group: any) => {
        const groupCosts = group.subCategories
          ?.filter((sub: any) => sub.account === account)
          .reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
        return sum + groupCosts;
      }, 0);
      
      // Final balance (Slutsaldo) = original balance + savings - costs
      finalBalances[account] = originalBalance + accountSavings - accountCosts;
    });
    
    // Update state with final balances
    setAccountFinalBalances(finalBalances);
    
    console.log('Holiday days calculated:', budgetData.holidayDays);
    setResults({
      totalSalary,
      totalDailyBudget: budgetData.totalBudget,
      remainingDailyBudget: budgetData.remainingBudget,
      holidayDaysBudget: budgetData.holidayBudget,
      balanceLeft,
      susannaShare,
      andreasShare,
      susannaPercentage,
      andreasPercentage,
      daysUntil25th: budgetData.daysUntil25th,
      weekdayCount: budgetData.weekdayCount,
      fridayCount: budgetData.fridayCount,
      totalMonthlyExpenses,
      holidayDays: budgetData.holidayDays,
      holidaysUntil25th: budgetData.holidaysUntil25th,
      nextTenHolidays: budgetData.nextTenHolidays,
      remainingWeekdayCount: budgetData.remainingWeekdayCount,
      remainingFridayCount: budgetData.remainingFridayCount
    });
    
    // Update historical data for selected month with calculated results INCLUDING final balances
    const currentDate = new Date();
    const monthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Update the existing month data with calculated results
    setHistoricalData(prev => ({
      ...prev,
      [monthKey]: {
        ...prev[monthKey], // Keep existing data
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
        accountFinalBalances: finalBalances, // Save final balances directly to historical data
        date: currentDate.toISOString() // Update timestamp
      }
    }));
    
    console.log(`Final balances calculated and saved for ${monthKey}:`, finalBalances);
  };


  // Function to calculate and save final balances for the previous month of a target month
  const calculateAndSavePreviousMonthFinalBalances = (targetMonthKey: string) => {
    console.log(`=== CALCULATE AND SAVE PREVIOUS MONTH DEBUG ===`);
    // Get previous month info
    const [year, month] = targetMonthKey.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
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
    const accountsToProcess = prevMonthData.accounts || ['Löpande', 'Sparkonto', 'Buffert'];
    
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
        
        // Check if there's saved final balance from the month before previous
        const prevPrevMonthData = historicalData[prevPrevMonthKey];
        if (prevPrevMonthData && prevPrevMonthData.accountFinalBalances && prevPrevMonthData.accountFinalBalances[account] !== undefined) {
          originalBalance = prevPrevMonthData.accountFinalBalances[account];
          console.log(`${account}: Using estimated starting balance from ${prevPrevMonthKey}: ${originalBalance}`);
        }
      }
      
      console.log(`${account}: Final starting balance: ${originalBalance}`);
      
      // Calculate total deposits for this account from savings groups
      const accountSavings = (prevMonthData.savingsGroups || [])
        .filter((group: any) => group.account === account)
        .reduce((sum: number, group: any) => sum + group.amount, 0);
      
      // Calculate total costs for this account from cost subcategories  
      const accountCosts = (prevMonthData.costGroups || []).reduce((sum: number, group: any) => {
        const groupCosts = group.subCategories
          ?.filter((sub: any) => sub.account === account)
          .reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
        return sum + groupCosts;
      }, 0);
      
      // Final balance (Slutsaldo) = original balance (estimated or actual) + savings - costs
      finalBalances[account] = originalBalance + accountSavings - accountCosts;
      console.log(`${account}: ${originalBalance} + ${accountSavings} - ${accountCosts} = ${finalBalances[account]}`);
    });
    
    console.log(`Final balances calculated:`, finalBalances);
    
    // Always save the recalculated final balances to the previous month's data
    setHistoricalData(prev => {
      const updated = {
        ...prev,
        [prevMonthKey]: {
          ...prev[prevMonthKey],
          accountFinalBalances: finalBalances
        }
      };
      console.log(`Updated historical data for ${prevMonthKey}:`, updated[prevMonthKey]);
      return updated;
    });
    
    console.log(`Final balances recalculated and saved for ${prevMonthKey}:`, finalBalances);
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

  const updateSavingsGroup = (id: string, field: 'name' | 'amount' | 'account' | 'financedFrom', value: string | number) => {
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
      
      setHistoricalData(prev => ({
        ...prev,
        [monthKey]: newMonthData
      }));
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
        accountBalances: {} // Always start with empty account balances - user should fill manually
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
        accountBalances: {} // Always start with empty account balances - user should fill manually
      };
      console.log(`No historical data found, using current form values for new month: ${monthKey}`);
    }
    
    setHistoricalData(prev => ({
      ...prev,
      [monthKey]: newMonthData
    }));
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

  // Helper function to get estimated account balances from previous month's final balances
  const getEstimatedAccountBalances = (freshFinalBalances?: {[key: string]: number}) => {
    const prevMonthInfo = getPreviousMonthInfo();
    const prevMonthData = historicalData[prevMonthInfo.monthKey];
    
    console.log(`=== GET ESTIMATED BALANCES DEBUG ===`);
    console.log(`🔍 BERÄKNAR ESTIMERAT SLUTSALDO FÖR: ${selectedBudgetMonth || 'Aktuell månad'}`);
    console.log(`📅 ANVÄNDER DATA FRÅN FÖREGÅENDE MÅNAD: ${prevMonthInfo.monthKey}`);
    console.log(`📊 Föregående månads data finns:`, !!prevMonthData);
    console.log(`📋 Tillgängliga historiska månader:`, Object.keys(historicalData));
    console.log(`💰 Föregående månads slutsaldon:`, prevMonthData?.accountFinalBalances);
    console.log(`🆕 Nya slutsaldon medskickade:`, freshFinalBalances);
    if (prevMonthData) {
      console.log(`Previous month data structure:`, {
        accountBalances: prevMonthData.accountBalances,
        accountFinalBalances: prevMonthData.accountFinalBalances,
        hasAccountFinalBalances: !!prevMonthData.accountFinalBalances,
        accountFinalBalancesKeys: Object.keys(prevMonthData.accountFinalBalances || {}),
        buffertFinalBalance: prevMonthData.accountFinalBalances?.['Buffert']
      });
    }
    
    if (!prevMonthData) {
      console.log(`❌ INGEN DATA HITTADES FÖR FÖREGÅENDE MÅNAD: ${prevMonthInfo.monthKey}`);
      console.log(`   Detta betyder att estimerat slutsaldo inte kan beräknas.`);
      console.log(`   För Augusti skulle vi behöva data från Juli för att beräkna.`);
      return null;
    }
    
    const estimatedBalances: {[key: string]: number} = {};
    
    console.log('Previous month data found:', prevMonthInfo.monthKey, prevMonthData);
    
    // Calculate final balances from previous month for each account
    accounts.forEach(account => {
      // Use fresh final balances first (if just calculated), then saved final balances
      if (freshFinalBalances && freshFinalBalances[account] !== undefined) {
        estimatedBalances[account] = freshFinalBalances[account];
        console.log(`${account}: Using fresh calculated Slutsaldo: ${freshFinalBalances[account]}`);
      } else if (prevMonthData.accountFinalBalances && prevMonthData.accountFinalBalances[account] !== undefined) {
        estimatedBalances[account] = prevMonthData.accountFinalBalances[account];
        console.log(`${account}: Using saved Slutsaldo: ${prevMonthData.accountFinalBalances[account]}`);
      } else {
        console.log(`${account}: No saved final balance found, calculating from raw data...`);
        // Fallback: calculate from previous month's data
        let originalBalance = prevMonthData.accountBalances?.[account] || 0;
        
        // If account balance is 0 or empty, try to use estimated balance from the month before
        if (originalBalance === 0) {
          const [prevYear, prevMonth] = prevMonthInfo.monthKey.split('-').map(Number);
          const prevPrevMonth = prevMonth === 1 ? 12 : prevMonth - 1;
          const prevPrevYear = prevMonth === 1 ? prevYear - 1 : prevYear;
          const prevPrevMonthKey = `${prevPrevYear}-${String(prevPrevMonth).padStart(2, '0')}`;
          
          console.log(`${account}: Account balance is 0, checking for estimated value from ${prevPrevMonthKey}`);
          
          const prevPrevMonthData = historicalData[prevPrevMonthKey];
          if (prevPrevMonthData && prevPrevMonthData.accountFinalBalances && prevPrevMonthData.accountFinalBalances[account] !== undefined) {
            originalBalance = prevPrevMonthData.accountFinalBalances[account];
            console.log(`${account}: Using estimated starting balance from ${prevPrevMonthKey}: ${originalBalance}`);
          }
        }
        
        // Calculate savings for this account
        const accountSavings = (prevMonthData.savingsGroups || [])
          .filter((group: any) => group.account === account)
          .reduce((sum: number, group: any) => sum + group.amount, 0);
        
        // Calculate costs for this account that are "Löpande kostnad" (for cost budget deposit)
        const accountRecurringCosts = (prevMonthData.costGroups || []).reduce((sum: number, group: any) => {
          const groupCosts = group.subCategories
            ?.filter((sub: any) => sub.account === account && (sub.financedFrom === 'Löpande kostnad' || !sub.financedFrom))
            .reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
          return sum + groupCosts;
        }, 0);
        
        // Calculate non-recurring costs for this account (costs that are NOT "Löpande kostnad")
        const accountNonRecurringCosts = (prevMonthData.costGroups || []).reduce((sum: number, group: any) => {
          const groupCosts = group.subCategories
            ?.filter((sub: any) => sub.account === account && sub.financedFrom && sub.financedFrom !== 'Löpande kostnad')
            .reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
          return sum + groupCosts;
        }, 0);
        
        // Final balance (Slutsaldo) from previous month = original balance + savings + cost budget deposit (recurring costs) - non-recurring costs
        estimatedBalances[account] = originalBalance + accountSavings + accountRecurringCosts - accountNonRecurringCosts;
        console.log(`=== 🧮 DETALJERAD BERÄKNING FÖR ${account.toUpperCase()} ===`);
        console.log(`📈 Startbalans från ${prevMonthInfo.monthKey}: ${originalBalance} kr`);
        console.log(`💾 Sparande under ${prevMonthInfo.monthKey}: ${accountSavings} kr`);
        console.log(`💰 Insättning kostnadsbudget (Löpande kostnader): ${accountRecurringCosts} kr`);
        console.log(`💸 Icke-löpande kostnader under ${prevMonthInfo.monthKey}: ${accountNonRecurringCosts} kr`);
        console.log(`🔢 FORMEL: ${originalBalance} + ${accountSavings} + ${accountRecurringCosts} - ${accountNonRecurringCosts} = ${originalBalance + accountSavings + accountRecurringCosts - accountNonRecurringCosts} kr`);
        console.log(`✅ ESTIMERAT SLUTSALDO FÖR ${account}: ${originalBalance + accountSavings + accountRecurringCosts - accountNonRecurringCosts} kr`);
        console.log(`=== 🏁 SLUT DETALJERAD BERÄKNING ===`);
      }
    });
    
    console.log('All estimated balances:', estimatedBalances);
    console.log(`=== END GET ESTIMATED BALANCES DEBUG ===`);
    return estimatedBalances;
  };

  // Helper function to check if current month has empty account balances
  const hasEmptyAccountBalances = () => {
    return accounts.every(account => (accountBalances[account] || 0) === 0);
  };

  // Helper function to get account balance with fallback to estimated
  const getAccountBalanceWithFallback = (account: string) => {
    const currentBalance = accountBalances[account] || 0;
    if (currentBalance !== 0) return currentBalance;
    
    if (hasEmptyAccountBalances()) {
      const freshBalances = (window as any).__freshFinalBalances;
      const estimated = getEstimatedAccountBalances(freshBalances);
      return estimated?.[account] || 0;
    }
    
    return currentBalance;
  };

  // Function to update account balance
  const updateAccountBalance = (account: string, balance: number) => {
    setAccountBalances(prev => ({
      ...prev,
      [account]: balance
    }));
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
    
    // Load all the form data from the selected month
    setAndreasSalary(monthData.andreasSalary || 0);
    setAndreasförsäkringskassan(monthData.andreasförsäkringskassan || 0);
    setAndreasbarnbidrag(monthData.andreasbarnbidrag || 0);
    setSusannaSalary(monthData.susannaSalary || 0);
    setSusannaförsäkringskassan(monthData.susannaförsäkringskassan || 0);
    setSusannabarnbidrag(monthData.susannabarnbidrag || 0);
    setCostGroups(monthData.costGroups || []);
    setSavingsGroups(monthData.savingsGroups || []);
    setDailyTransfer(monthData.dailyTransfer || 300);
    setWeekendTransfer(monthData.weekendTransfer || 540);
    
    // Load personal budget data
    setAndreasPersonalCosts(monthData.andreasPersonalCosts || []);
    setAndreasPersonalSavings(monthData.andreasPersonalSavings || []);
    setSusannaPersonalCosts(monthData.susannaPersonalCosts || []);
    setSusannaPersonalSavings(monthData.susannaPersonalSavings || []);
    
    // Load saved account balances, or start with empty if none exist
    setAccountBalances(monthData.accountBalances || {});
    setAccountFinalBalances(monthData.accountFinalBalances || {});
    
    // Update results if available
    if (monthData.totalSalary !== undefined) {
      setResults({
        totalSalary: monthData.totalSalary,
        totalDailyBudget: monthData.totalDailyBudget || 0,
        remainingDailyBudget: monthData.remainingDailyBudget || 0,
        holidayDaysBudget: monthData.holidayDaysBudget || 0,
        balanceLeft: monthData.balanceLeft || 0,
        susannaShare: monthData.susannaShare || 0,
        andreasShare: monthData.andreasShare || 0,
        susannaPercentage: monthData.susannaPercentage || 0,
        andreasPercentage: monthData.andreasPercentage || 0,
        weekdayCount: 0, // These will be recalculated when needed
        fridayCount: 0,
        daysUntil25th: monthData.daysUntil25th || 0,
        totalMonthlyExpenses: monthData.totalMonthlyExpenses || 0,
        holidayDays: [],
        holidaysUntil25th: [],
        nextTenHolidays: [],
        remainingWeekdayCount: 0,
        remainingFridayCount: 0
      });
    }
  };

  // Function to get available months with saved data
  const getMonthsWithSavedData = () => {
    return Object.keys(historicalData)
      .filter(month => historicalData[month]) // Only months with actual saved data
      .sort((a, b) => a.localeCompare(b)); // Sort chronologically (oldest first)
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
      
      setHistoricalData(prev => ({
        ...prev,
        [prevMonthKey]: newMonthData
      }));
      
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
        // Load non-income data
        setCostGroups(monthData.costGroups || []);
        setSavingsGroups(monthData.savingsGroups || []);
        setDailyTransfer(monthData.dailyTransfer || 0);
        setWeekendTransfer(monthData.weekendTransfer || 0);
        setCustomHolidays(monthData.customHolidays || []);
        setSelectedPerson(monthData.selectedPerson || 'andreas');
        setAndreasPersonalCosts(monthData.andreasPersonalCosts || []);
        setAndreasPersonalSavings(monthData.andreasPersonalSavings || []);
        setSusannaPersonalCosts(monthData.susannaPersonalCosts || []);
        setSusannaPersonalSavings(monthData.susannaPersonalSavings || []);
        setAccounts(monthData.accounts || []);
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
      
      setHistoricalData(prev => ({
        ...prev,
        [nextMonthKey]: newMonthData
      }));
      
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
        // Load non-income data
        setCostGroups(monthData.costGroups || []);
        setSavingsGroups(monthData.savingsGroups || []);
        setDailyTransfer(monthData.dailyTransfer || 0);
        setWeekendTransfer(monthData.weekendTransfer || 0);
        setCustomHolidays(monthData.customHolidays || []);
        setSelectedPerson(monthData.selectedPerson || 'andreas');
        setAndreasPersonalCosts(monthData.andreasPersonalCosts || []);
        setAndreasPersonalSavings(monthData.andreasPersonalSavings || []);
        setSusannaPersonalCosts(monthData.susannaPersonalCosts || []);
        setSusannaPersonalSavings(monthData.susannaPersonalSavings || []);
        setAccounts(monthData.accounts || []);
        setUserName1(monthData.userName1 || 'Andreas');
        setUserName2(monthData.userName2 || 'Susanna');
        setTransferChecks(monthData.transferChecks || {});
        setAndreasShareChecked(monthData.andreasShareChecked !== undefined ? monthData.andreasShareChecked : true);
        setSusannaShareChecked(monthData.susannaShareChecked !== undefined ? monthData.susannaShareChecked : true);
      }, 0);
    }
  };

  // Function to handle month creation from dialog
  const handleCreateMonthFromDialog = (type: 'empty' | 'template' | 'copy', templateName?: string) => {
    if (!selectedBudgetMonth) return;
    
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
    
    // Don't create if it already exists
    if (historicalData[targetMonthKey]) {
      handleBudgetMonthChange(targetMonthKey);
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
      const currentMonthData = historicalData[selectedBudgetMonth];
      if (currentMonthData) {
        newMonthData = {
          ...currentMonthData,
          // Reset all income values to 0
          andreasSalary: 0,
          andreasförsäkringskassan: 0,
          andreasbarnbidrag: 0,
          susannaSalary: 0,
          susannaförsäkringskassan: 0,
          susannabarnbidrag: 0,
          // Reset all category amounts to 0
          costGroups: (currentMonthData.costGroups || []).map((group: any) => ({
            ...group,
            amount: 0,
            subCategories: (group.subCategories || []).map((sub: any) => ({
              ...sub,
              amount: 0
            }))
          })),
          savingsGroups: (currentMonthData.savingsGroups || []).map((group: any) => ({
            ...group,
            amount: 0,
            subCategories: (group.subCategories || []).map((sub: any) => ({
              ...sub,
              amount: 0
            }))
          })),
          // Reset transfers
          dailyTransfer: 0,
          weekendTransfer: 0,
          // Reset personal budgets
          andreasPersonalCosts: (currentMonthData.andreasPersonalCosts || []).map((item: any) => ({
            ...item,
            amount: 0
          })),
          andreasPersonalSavings: (currentMonthData.andreasPersonalSavings || []).map((item: any) => ({
            ...item,
            amount: 0
          })),
          susannaPersonalCosts: (currentMonthData.susannaPersonalCosts || []).map((item: any) => ({
            ...item,
            amount: 0
          })),
          susannaPersonalSavings: (currentMonthData.susannaPersonalSavings || []).map((item: any) => ({
            ...item,
            amount: 0
          })),
          // Use estimated account balances from previous month
          accountBalances: estimatedAccountBalances,
          accountFinalBalances: {},
          createdAt: new Date().toISOString()
        };
      }
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
          // Use estimated account balances from previous month
          accountBalances: estimatedAccountBalances,
          accountFinalBalances: {},
          createdAt: new Date().toISOString()
      };
    } else if (type === 'copy') {
      // Copy current month with all data including income values
      const currentMonthData = historicalData[selectedBudgetMonth];
      if (currentMonthData) {
        newMonthData = {
          ...currentMonthData,
          // Keep all income values from the source month
          // Use estimated account balances from previous month
          accountBalances: estimatedAccountBalances,
          accountFinalBalances: {},
          createdAt: new Date().toISOString()
        };
      }
    }
    
    if (newMonthData) {
      setHistoricalData(prev => {
        const updatedData = {
          ...prev,
          [targetMonthKey]: newMonthData
        };
        
        // Set the new month as selected
        setSelectedBudgetMonth(targetMonthKey);
        
        // Load the new month data immediately with the updated data
        setTimeout(() => {
          const monthData = updatedData[targetMonthKey];
          if (monthData) {
            // Load all the form data from the new month
            setAndreasSalary(monthData.andreasSalary || 0);
            setAndreasförsäkringskassan(monthData.andreasförsäkringskassan || 0);
            setAndreasbarnbidrag(monthData.andreasbarnbidrag || 0);
            setSusannaSalary(monthData.susannaSalary || 0);
            setSusannaförsäkringskassan(monthData.susannaförsäkringskassan || 0);
            setSusannabarnbidrag(monthData.susannabarnbidrag || 0);
            setCostGroups(JSON.parse(JSON.stringify(monthData.costGroups || [])));
            setSavingsGroups(JSON.parse(JSON.stringify(monthData.savingsGroups || [])));
            setDailyTransfer(monthData.dailyTransfer || 0);
            setWeekendTransfer(monthData.weekendTransfer || 0);
            setCustomHolidays(JSON.parse(JSON.stringify(monthData.customHolidays || [])));
            setAndreasPersonalCosts(JSON.parse(JSON.stringify(monthData.andreasPersonalCosts || [])));
            setAndreasPersonalSavings(JSON.parse(JSON.stringify(monthData.andreasPersonalSavings || [])));
            setSusannaPersonalCosts(JSON.parse(JSON.stringify(monthData.susannaPersonalCosts || [])));
            setSusannaPersonalSavings(JSON.parse(JSON.stringify(monthData.susannaPersonalSavings || [])));
            setAccounts(JSON.parse(JSON.stringify(monthData.accounts || ['Löpande', 'Sparkonto', 'Buffert'])));
            setUserName1(monthData.userName1 || 'Andreas');
            setUserName2(monthData.userName2 || 'Susanna');
            setTransferChecks(monthData.transferChecks || {});
            setAndreasShareChecked(monthData.andreasShareChecked !== undefined ? monthData.andreasShareChecked : true);
            setSusannaShareChecked(monthData.susannaShareChecked !== undefined ? monthData.susannaShareChecked : true);
            // Set account balances (should be empty {} for new months)
            setAccountBalances(monthData.accountBalances || {});
            setAccountFinalBalances(monthData.accountFinalBalances || {});
          }
        }, 0);
        
        return updatedData;
      });
    }
  };

  // Function to handle month selection change
  const handleBudgetMonthChange = (monthKey: string) => {
    console.log(`=== MONTH CHANGE: Switching to ${monthKey} ===`);
    console.log(`Current historicalData keys BEFORE operations:`, Object.keys(historicalData));
    
    // Save current data to current month before switching
    console.log(`Saving current month data before switching...`);
    saveToSelectedMonth();
    
    console.log(`Historical data keys AFTER saveToSelectedMonth:`, Object.keys(historicalData));
    
    // Calculate and save final balances for the previous month of the target month
    console.log(`Calculating previous month final balances...`);
    const freshFinalBalances = calculateAndSavePreviousMonthFinalBalances(monthKey);
    
    console.log(`Historical data keys AFTER calculateAndSavePreviousMonthFinalBalances:`, Object.keys(historicalData));
    console.log(`Historical data after calculating previous month final balances:`, JSON.stringify(historicalData, null, 2));
    
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
    const templateData = {
      name: templateName.trim(),
      date: new Date().toISOString(),
      costGroups: JSON.parse(JSON.stringify(sourceData.costGroups || [])),
      savingsGroups: JSON.parse(JSON.stringify(sourceData.savingsGroups || [])),
      dailyTransfer: sourceData.dailyTransfer || 300,
      weekendTransfer: sourceData.weekendTransfer || 540,
      customHolidays: JSON.parse(JSON.stringify(sourceData.customHolidays || [])),
      // Include accounts to ensure they are available when loading template
      accounts: JSON.parse(JSON.stringify(sourceData.accounts || ['Löpande', 'Sparkonto', 'Buffert']))
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
    setCostGroups(JSON.parse(JSON.stringify(template.costGroups || [])));
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
    
    // Auto-save to localStorage
    setTimeout(() => {
      saveToLocalStorage();
    }, 0);
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
    
    // Force save to localStorage
    setTimeout(() => {
      saveToLocalStorage();
    }, 100);
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
      setCostGroups(JSON.parse(JSON.stringify(template.costGroups || [])));
      setSavingsGroups(JSON.parse(JSON.stringify(template.savingsGroups || [])));
      setDailyTransfer(template.dailyTransfer || 300);
      setWeekendTransfer(template.weekendTransfer || 540);
      setCustomHolidays(JSON.parse(JSON.stringify(template.customHolidays || [])));
      setAndreasPersonalCosts(JSON.parse(JSON.stringify(template.andreasPersonalCosts || [])));
      setAndreasPersonalSavings(JSON.parse(JSON.stringify(template.andreasPersonalSavings || [])));
      setSusannaPersonalCosts(JSON.parse(JSON.stringify(template.susannaPersonalCosts || [])));
      setAccounts(JSON.parse(JSON.stringify(template.accounts || ['Löpande', 'Sparkonto', 'Buffert'])));
      // Always start with empty account balances - user should fill manually
      setAccountBalances({});
    }
    
    // Add the copied data to historical data
    setHistoricalData(prev => ({
      ...prev,
      [month]: templateDataToCopy
    }));
    
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
      budgetTemplates
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
      setCostGroups(standardValues.costGroups || []);
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
    setCostGroups(costGroups.map(group => 
      group.id === groupId ? {
        ...group,
        subCategories: group.subCategories?.map(sub => 
          sub.id === subId ? { ...sub, [field]: value } : sub
        ) || []
      } : group
    ));
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
    setCostGroups(costGroups.map(group => ({
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
    if (selectedPerson === 'andreas') {
      setAndreasPersonalCosts(costs);
    } else {
      setSusannaPersonalCosts(costs);
    }
  };

  const setCurrentPersonalSavings = (savings: BudgetGroup[]) => {
    if (selectedPerson === 'andreas') {
      setAndreasPersonalSavings(savings);
    } else {
      setSusannaPersonalSavings(savings);
    }
  };

  const addPersonalCostGroup = () => {
    const newGroup: BudgetGroup = {
      id: Date.now().toString(),
      name: 'Ny kostnad',
      amount: 0,
      type: 'cost',
      subCategories: []
    };
    setCurrentPersonalCosts([...getCurrentPersonalCosts(), newGroup]);
  };

  const addPersonalSavingsGroup = () => {
    const newGroup: BudgetGroup = {
      id: Date.now().toString(),
      name: 'Nytt sparande',
      amount: 0,
      type: 'savings',
      subCategories: []
    };
    setCurrentPersonalSavings([...getCurrentPersonalSavings(), newGroup]);
  };

  const removePersonalCostGroup = (id: string) => {
    setCurrentPersonalCosts(getCurrentPersonalCosts().filter(group => group.id !== id));
  };

  const removePersonalSavingsGroup = (id: string) => {
    setCurrentPersonalSavings(getCurrentPersonalSavings().filter(group => group.id !== id));
  };

  const updatePersonalCostGroup = (id: string, field: 'name' | 'amount', value: string | number) => {
    setCurrentPersonalCosts(getCurrentPersonalCosts().map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
  };

  const updatePersonalSavingsGroup = (id: string, field: 'name' | 'amount', value: string | number) => {
    setCurrentPersonalSavings(getCurrentPersonalSavings().map(group => 
      group.id === id ? { ...group, [field]: value } : group
    ));
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
      
      // Use saved calculated totals if available, otherwise calculate from groups
      const totalCosts = data.totalCosts !== undefined ? data.totalCosts : 
        (data.costGroups?.reduce((sum: number, group: any) => {
          const subCategoriesTotal = group.subCategories?.reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
          return sum + subCategoriesTotal;
        }, 0) || 0);
      
      const totalSavings = data.totalSavings !== undefined ? data.totalSavings : 
        (data.savingsGroups?.reduce((sum: number, group: any) => sum + group.amount, 0) || 0);
      
      return {
        month: monthKey,
        totalIncome: data.totalSalary || 0,
        totalCosts: totalCosts,
        totalSavings: totalSavings,
        totalDailyBudget: data.totalDailyBudget || 0
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
      <div className="h-96">
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
    
    // Create extended month list including previous months before each saved month
    const extendedMonthKeys: string[] = [];
    
    // For each saved month, add the previous month first, then the saved month
    for (const savedMonthKey of savedMonthKeys) {
      const [year, month] = savedMonthKey.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Add previous month if not already added
      if (!extendedMonthKeys.includes(prevMonthKey)) {
        extendedMonthKeys.push(prevMonthKey);
      }
      
      // Add the saved month if not already added
      if (!extendedMonthKeys.includes(savedMonthKey)) {
        extendedMonthKeys.push(savedMonthKey);
      }
    }

    // Add current month at the end if it's not already included (for forecast)
    if (!extendedMonthKeys.includes(currentMonthKey)) {
      extendedMonthKeys.push(currentMonthKey);
    }

    // Initialize selected accounts if empty
    if (selectedAccountsForChart.length === 0 && accounts.length > 0) {
      setSelectedAccountsForChart(accounts.slice(0, 3)); // Start with first 3 accounts
    }
    
    // Helper function to calculate estimated balances for any month
    const getEstimatedBalancesForMonth = (monthKey: string) => {
      console.log(`Calculating estimated balances for ${monthKey}`);
      const [year, month] = monthKey.split('-').map(Number);
      const prevDate = new Date(year, month - 1 - 1, 1); // month-1 for previous month, -1 for Date object
      const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      console.log(`For month ${monthKey}, looking for previous month data: ${prevMonthKey}`);
      
      const prevMonthData = historicalData[prevMonthKey];
      console.log(`Previous month data exists:`, !!prevMonthData);
      
      if (!prevMonthData) return null;
      
      const estimatedBalances: {[key: string]: number} = {};
      
      // Calculate final balances from previous month for each account
      accounts.forEach(account => {
        // Try to use saved final balance (Slutsaldo) from previous month first
        if (prevMonthData.accountFinalBalances && prevMonthData.accountFinalBalances[account] !== undefined) {
          estimatedBalances[account] = prevMonthData.accountFinalBalances[account];
          console.log(`${account}: Using saved Slutsaldo from previous month: ${prevMonthData.accountFinalBalances[account]}`);
          return;
        }
        
        // Fallback: calculate final balance from previous month's data
        const originalBalance = prevMonthData.accountBalances?.[account] || 0;
        console.log(`${account}: Original balance for calculation: ${originalBalance}`);
        
        // Calculate savings/deposits for this account from previous month
        const accountSavings = (prevMonthData.savingsGroups || [])
          .filter((group: any) => group.account === account)
          .reduce((sum: number, group: any) => sum + group.amount, 0);
        
        // Calculate costs for this account from previous month
        // Calculate costs for this account that are "Löpande kostnad" (for cost budget deposit)
        const accountRecurringCosts = (prevMonthData.costGroups || []).reduce((sum: number, group: any) => {
          const groupCosts = group.subCategories
            ?.filter((sub: any) => sub.account === account && (sub.financedFrom === 'Löpande kostnad' || !sub.financedFrom))
            .reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
          return sum + groupCosts;
        }, 0);
        
        // Calculate all costs for this account (for deduction)
        const accountAllCosts = (prevMonthData.costGroups || []).reduce((sum: number, group: any) => {
          const groupCosts = group.subCategories
            ?.filter((sub: any) => sub.account === account)
            .reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
          return sum + groupCosts;
        }, 0);
        
        // Final balance (Slutsaldo) from "Kontobelopp efter budget" = original balance + savings + cost budget deposit (recurring only) - all costs
        const slutsaldo = originalBalance + accountSavings + accountRecurringCosts - accountAllCosts;
        
        // Use this slutsaldo as the estimated starting balance for the next month
        estimatedBalances[account] = slutsaldo;
        console.log(`${account}: Calculated Slutsaldo from previous month: ${slutsaldo}`);
      });
      
      console.log(`All estimated balances:`, estimatedBalances);
      return estimatedBalances;
    };

    // Helper function to get account balance from saved "Min Månadsbudget" data
    const getAccountBalanceForMonth = (monthKey: string, account: string) => {
      console.log(`Getting balance for ${monthKey}, account: ${account}`);
      
      if (historicalData[monthKey]) {
        // For saved months, use the accountBalances from "Min Månadsbudget" section (Kontosaldon)
        const monthData = historicalData[monthKey];
        if (monthData.accountBalances && monthData.accountBalances[account] !== undefined) {
          const savedBalance = monthData.accountBalances[account];
          console.log(`Found saved balance for ${monthKey}: ${savedBalance}`);
          
          // If saved balance is 0, try to get estimated values instead
          if (savedBalance === 0) {
            const estimated = getEstimatedBalancesForMonth(monthKey);
            if (estimated && estimated[account] !== undefined && estimated[account] > 0) {
              console.log(`Using estimated balance instead of 0 for ${monthKey}: ${estimated[account]}`);
              return estimated[account];
            }
          }
          
          return savedBalance;
        }
      }
      
      // For months without saved data, calculate estimated values for that specific month
      const estimated = getEstimatedBalancesForMonth(monthKey);
      if (estimated && estimated[account] !== undefined) {
        console.log(`Using estimated balance for ${monthKey}: ${estimated[account]}`);
        return estimated[account];
      }
      
      // If no estimation possible, use current context as fallback for current month only
      if (monthKey === currentMonthKey) {
        const estimatedBalance = getAccountBalanceWithFallback(account);
        console.log(`Using current context estimated balance for ${monthKey}: ${estimatedBalance}`);
        return estimatedBalance;
      }
      
      console.log(`No data for month ${monthKey}, returning 0`);
      return 0;
    };

    // Calculate account balances for each month using saved "Kontosaldon" data
    const chartData = extendedMonthKeys.map((monthKey) => {
      const dataPoint: any = { month: monthKey };
      
      accounts.forEach(account => {
        dataPoint[account] = getAccountBalanceForMonth(monthKey, account);
      });
      
      return dataPoint;
    });

    // Find where historical data ends and forecast begins
    const lastHistoricalIndex = chartData.findIndex(data => data.month === currentMonthKey);
    
    if (chartData.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Ingen data tillgänglig för kontosaldon.</p>
        </div>
      );
    }

    // Colors for different accounts
    const accountColors = [
      '#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', 
      '#ec4899', '#06b6d4', '#10b981', '#f97316', '#6366f1'
    ];

    return (
      <div className="space-y-4">
        {/* Account Selection */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Välj konton att visa:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {accounts.map((account, index) => (
              <label key={account} className="flex items-center space-x-2 cursor-pointer">
                <Checkbox 
                  checked={selectedAccountsForChart.includes(account)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedAccountsForChart(prev => [...prev, account]);
                    } else {
                      setSelectedAccountsForChart(prev => prev.filter(a => a !== account));
                    }
                  }}
                />
                <span className="text-sm">{account}</span>
                <div 
                  className="w-3 h-3 rounded-full ml-1" 
                  style={{ backgroundColor: accountColors[index % accountColors.length] }}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="h-96 relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value: number) => formatCurrency(value)} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              
              {/* Historical data separator line */}
              {lastHistoricalIndex >= 0 && (
                <Line 
                  type="monotone" 
                  dataKey={() => null}
                  stroke="transparent"
                  strokeDasharray="5 5"
                />
              )}
              
              {/* Account lines */}
              {selectedAccountsForChart.map((account, index) => (
                <Line
                  key={account}
                  type="monotone"
                  dataKey={account}
                  stroke={accountColors[accounts.indexOf(account) % accountColors.length]}
                  name={account}
                  strokeWidth={2}
                  strokeDasharray={chartData.findIndex(d => d.month === currentMonthKey) >= 0 ? undefined : "5 5"}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          
          {/* Historical/Forecast separator */}
          {lastHistoricalIndex >= 0 && chartData.length > 1 && (
            <div 
              className="absolute top-0 bottom-0 border-l-2 border-dashed border-gray-400 pointer-events-none"
              style={{ 
                left: `${((lastHistoricalIndex + 0.5) / chartData.length) * 100}%`,
                zIndex: 10
              }}
            >
              <div className="absolute -top-6 left-2 text-xs text-gray-600 bg-white px-1 rounded">
                Historisk | Prognos
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="bg-muted/30 p-3 rounded-lg text-sm">
          <p className="font-medium mb-1">Förklaring:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-muted-foreground">
            <div>• Heldragna linjer: Historiska data</div>
            <div>• Streckade linjer: Prognoser</div>
            <div>• Vertikal linje: Skillnad mellan historik och prognos</div>
          </div>
        </div>
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
                        totalSalary: currentMonthData.totalSalary || 0,
                        costGroups: JSON.parse(JSON.stringify(currentMonthData.costGroups || [])),
                        savingsGroups: JSON.parse(JSON.stringify(currentMonthData.savingsGroups || [])),
                        totalMonthlyExpenses: currentMonthData.totalMonthlyExpenses || 0,
                        totalCosts: currentMonthData.totalCosts || 0,
                        totalSavings: currentMonthData.totalSavings || 0,
                        dailyTransfer: currentMonthData.dailyTransfer || dailyTransfer,
                        weekendTransfer: currentMonthData.weekendTransfer || weekendTransfer,
                        balanceLeft: currentMonthData.balanceLeft || 0,
                        susannaShare: currentMonthData.susannaShare || 0,
                        andreasShare: currentMonthData.andreasShare || 0,
                        susannaPercentage: currentMonthData.susannaPercentage || 0,
                        andreasPercentage: currentMonthData.andreasPercentage || 0,
                        totalDailyBudget: currentMonthData.totalDailyBudget || 0,
                        remainingDailyBudget: currentMonthData.remainingDailyBudget || 0,
                        holidayDaysBudget: currentMonthData.holidayDaysBudget || 0,
                        daysUntil25th: currentMonthData.daysUntil25th || 0
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
                  
                  setHistoricalData(prev => ({
                    ...prev,
                    [newHistoricalMonth]: {
                      ...sourceData,
                      month: newHistoricalMonth,
                      date: new Date().toISOString()
                    }
                  }));
                  setNewHistoricalMonth('');
                }
              }}
              disabled={!newHistoricalMonth || newHistoricalMonth >= currentMonth || historicalData[newHistoricalMonth]}
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
      setHistoricalData(prev => {
        const newData = { ...prev };
        delete newData[month];
        return newData;
      });
      if (selectedHistoricalMonth === month) {
        setSelectedHistoricalMonth('');
      }
    };
    
    return (
      <div className="mt-4 p-4 bg-muted rounded-lg">
        <div>
          <Label>Hantera sparade månader:</Label>
          <div className="mt-2 space-y-2">
            {Object.keys(historicalData).sort((a, b) => b.localeCompare(a)).map(month => (
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
    
    // Use saved calculated totals if available, otherwise calculate from groups
    const totalCosts = data.totalCosts !== undefined ? data.totalCosts : 
      (data.costGroups?.reduce((sum: number, group: any) => {
        const subCategoriesTotal = group.subCategories?.reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
        return sum + subCategoriesTotal;
      }, 0) || 0);
    
    const totalSavings = data.totalSavings !== undefined ? data.totalSavings : 
      (data.savingsGroups?.reduce((sum: number, group: any) => sum + group.amount, 0) || 0);

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
                <span>{formatCurrency(data.totalSalary || 0)}</span>
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
                <span className="font-medium">{formatCurrency(data.totalDailyBudget || 0)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Kvar efter kostnader, sparande och daglig budget:</span>
                <span>{formatCurrency((data.totalSalary || 0) - totalCosts - totalSavings - (data.totalDailyBudget || 0))}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium mb-2">Individuella Andelar:</h4>
              <div className="flex justify-between">
                <span>Andreas andel:</span>
                <span className="font-medium">{formatCurrency(data.andreasShare || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Susannas andel:</span>
                <span className="font-medium">{formatCurrency(data.susannaShare || 0)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>Andreas andel: {(data.andreasPercentage || 0).toFixed(1)}%</span>
                <span>Susannas andel: {(data.susannaPercentage || 0).toFixed(1)}%</span>
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
            <CardTitle className="text-xl">
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
                  setSelectedBudgetMonth(value);
                  if (historicalData[value]) {
                    loadDataFromSelectedMonth(value);
                  }
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
                    
                    // Generate options for current month and all historical months
                    const currentDate = new Date();
                    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    const allMonths = new Set([currentMonthKey, ...Object.keys(historicalData)]);
                    
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
              // Only show Överföring tab for current month
              const currentDate = new Date();
              const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
              const isCurrentMonth = selectedBudgetMonth === currentMonthKey;
              return isCurrentMonth ? (
                <TabsTrigger value="overforing">Överföring</TabsTrigger>
              ) : null;
            })()}
            <TabsTrigger value="egen-budget">Egen Budget</TabsTrigger>
            <TabsTrigger value="historia">Historia</TabsTrigger>
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
                            value={andreasSalary || ''}
                            onChange={(e) => setAndreasSalary(Number(e.target.value))}
                            className="text-lg bg-white/70"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="andreas-forsakringskassan" className="text-green-700">Försäkringskassan</Label>
                          <Input
                            id="andreas-forsakringskassan"
                            type="number"
                            placeholder="Ange försäkringskassan"
                            value={andreasförsäkringskassan || ''}
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
                            value={andreasbarnbidrag || ''}
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
                            value={susannaSalary || ''}
                            onChange={(e) => setSusannaSalary(Number(e.target.value))}
                            className="text-lg bg-white/70"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="susanna-forsakringskassan" className="text-green-700">Försäkringskassan</Label>
                          <Input
                            id="susanna-forsakringskassan"
                            type="number"
                            placeholder="Ange försäkringskassan"
                            value={susannaförsäkringskassan || ''}
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
                            value={susannabarnbidrag || ''}
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
                      
                      <div className="space-y-4">
                        {accounts.map(account => {
                          const currentBalance = accountBalances[account] || 0;
                           const freshBalances = (window as any).__freshFinalBalances;
                           const estimatedResult = getEstimatedAccountBalances(freshBalances);
                           const estimatedBalance = estimatedResult?.[account] || 0;
                          
                          return (
                            <div key={account} className="bg-white rounded border overflow-hidden">
                              <div className="p-3 bg-blue-50 border-b">
                                <h4 className="font-semibold text-blue-800">{account}</h4>
                              </div>
                              
                              <div className="p-3 space-y-3">
                                {/* Faktiskt kontosaldo */}
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-blue-700">Faktiskt kontosaldo</span>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      value={currentBalance || ''}
                                      onChange={(e) => updateAccountBalance(account, Number(e.target.value) || 0)}
                                      className="w-32 text-right"
                                      placeholder="0"
                                    />
                                    <span className="text-sm text-blue-700 min-w-8">kr</span>
                                  </div>
                                </div>
                                
                                {/* Estimerat slutsaldo */}
                                {estimatedResult && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-orange-700">Estimerat slutsaldo</span>
                                    <div className="flex items-center gap-2">
                                      <span className="w-32 text-right text-sm text-orange-600">{formatCurrency(estimatedBalance)}</span>
                                      <span className="text-sm text-orange-600 min-w-8">kr</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
                             {accounts.map((account, index) => (
                               <div key={account} className="flex justify-between items-center p-2 bg-white rounded border">
                                 <span className="font-medium">{account}</span>
                                 <Button
                                   size="sm"
                                   variant="ghost"
                                   onClick={() => removeAccount(account)}
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
                        {expandedSections.costCategories ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                      
                      {expandedSections.costCategories && (
                        <div className="mt-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="font-semibold">Kostnadskategorier</h4>
                            <div className="space-x-2">
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
                          
                          {costGroups.map((group) => (
                            <div key={group.id} className="space-y-2">
                              <div className="flex gap-2 items-center">
                                {isEditingCategories ? (
                                  <>
                                    <Input
                                      value={group.name}
                                      onChange={(e) => updateCostGroup(group.id, 'name', e.target.value)}
                                      className="flex-1"
                                    />
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => removeCostGroup(group.id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <div className="flex-1 font-medium">{group.name}</div>
                                )}
                              </div>
                              
                              {group.subCategories && group.subCategories.length > 0 && (
                                <div className="pl-4 space-y-1">
                                   {group.subCategories.map((sub) => (
                                     <div key={sub.id} className="text-sm space-y-2">
                                       {isEditingCategories ? (
                                         <div className="space-y-2">
                                           <div className="flex gap-2 items-center">
                                             <Input
                                               value={sub.name}
                                               onChange={(e) => updateSubCategory(group.id, sub.id, 'name', e.target.value)}
                                               className="w-32 text-base"
                                               placeholder="Underkategori namn"
                                             />
                                             <Input
                                               type="number"
                                               value={sub.amount === 0 ? '' : sub.amount}
                                               onChange={(e) => updateSubCategory(group.id, sub.id, 'amount', Number(e.target.value) || 0)}
                                               className="flex-1"
                                               placeholder="Belopp"
                                             />
                                             <Button
                                               size="sm"
                                               variant="destructive"
                                               onClick={() => removeSubCategory(group.id, sub.id)}
                                             >
                                               <Trash2 className="w-4 h-4" />
                                             </Button>
                                           </div>
                                            <div className="flex gap-2 items-center pl-2">
                                              <span className="text-sm text-muted-foreground min-w-16">Konto:</span>
                                              <Select
                                                value={sub.account || 'none'}
                                                onValueChange={(value) => updateSubCategory(group.id, sub.id, 'account', value === 'none' ? undefined : value)}
                                              >
                                                <SelectTrigger className="w-36">
                                                  <SelectValue placeholder="Välj konto" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">Inget konto</SelectItem>
                                                  {accounts.map((account) => (
                                                    <SelectItem key={account} value={account}>
                                                      {account}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="flex gap-2 items-center pl-2">
                                              <span className="text-sm text-muted-foreground min-w-16">Finansieras ifrån:</span>
                                              <Select
                                                value={sub.financedFrom || 'Löpande kostnad'}
                                                onValueChange={(value) => updateSubCategory(group.id, sub.id, 'financedFrom', value as 'Löpande kostnad' | 'Enskild kostnad')}
                                              >
                                                <SelectTrigger className="w-36">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="Löpande kostnad">Löpande kostnad</SelectItem>
                                                  <SelectItem value="Enskild kostnad">Enskild kostnad</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                         </div>
                                       ) : (
                                         <div className="flex justify-between items-center">
                                           <span className="flex-1">
                                             {sub.name}{sub.account ? ` (${sub.account})` : ''}
                                           </span>
                                           <span className="w-32 text-right font-medium text-destructive">
                                             {formatCurrency(sub.amount)}
                                           </span>
                                         </div>
                                       )}
                                     </div>
                                   ))}
                                </div>
                              )}
                              
                              {isEditingCategories && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="ml-4"
                                  onClick={() => addSubCategory(group.id)}
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Lägg till underkategori
                                </Button>
                              )}
                            </div>
                          ))}
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
                                 onChange={(e) => setDailyTransfer(Number(e.target.value))}
                                 disabled={!isEditingTransfers}
                               />
                             </div>
                             <div className="space-y-2">
                               <Label htmlFor="weekend-transfer">Helgöverföring (fredag-söndag)</Label>
                               <Input
                                 id="weekend-transfer"
                                 type="number"
                                 value={weekendTransfer || ''}
                                 onChange={(e) => setWeekendTransfer(Number(e.target.value))}
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
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('savingsCategories')}>
                        <div>
                          <div className="text-sm text-muted-foreground">Totalt sparande</div>
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(savingsGroups.reduce((sum, group) => sum + group.amount, 0))}
                          </div>
                        </div>
                        {expandedSections.savingsCategories ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                      
                      {expandedSections.savingsCategories && (
                        <div className="mt-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="font-semibold">Sparandekategorier</h4>
                            <div className="space-x-2">
                              <Button size="sm" onClick={() => setIsEditingCategories(!isEditingCategories)}>
                                {isEditingCategories ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                              </Button>
                              {isEditingCategories && (
                                <Button size="sm" onClick={addSavingsGroup}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                           {savingsGroups.map((group) => (
                             <div key={group.id} className="space-y-2">
                               {isEditingCategories ? (
                                 <div className="space-y-2">
                                   <div className="flex gap-2 items-center">
                                     <Input
                                       value={group.name}
                                       onChange={(e) => updateSavingsGroup(group.id, 'name', e.target.value)}
                                       className="flex-1 text-base"
                                       placeholder="Kategori namn"
                                     />
                                     <Input
                                       type="number"
                                       value={group.amount === 0 ? '' : group.amount}
                                       onChange={(e) => updateSavingsGroup(group.id, 'amount', Number(e.target.value) || 0)}
                                       className="w-32"
                                       placeholder="Belopp"
                                     />
                                     <Button
                                       size="sm"
                                       variant="destructive"
                                       onClick={() => removeSavingsGroup(group.id)}
                                     >
                                       <Trash2 className="w-4 h-4" />
                                     </Button>
                                   </div>
                                    <div className="flex gap-2 items-center pl-2">
                                      <span className="text-sm text-muted-foreground min-w-16">Konto:</span>
                                      <Select
                                        value={group.account || 'none'}
                                        onValueChange={(value) => updateSavingsGroup(group.id, 'account', value === 'none' ? undefined : value)}
                                      >
                                        <SelectTrigger className="w-36">
                                          <SelectValue placeholder="Välj konto" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">Inget konto</SelectItem>
                                          {accounts.map((account) => (
                                            <SelectItem key={account} value={account}>
                                              {account}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                 </div>
                               ) : (
                                 <div className="flex justify-between items-center">
                                   <span className="flex-1">
                                     {group.name}{group.account ? ` (${group.account})` : ''}
                                   </span>
                                   <span className="w-32 text-right font-medium text-green-600">
                                     {formatCurrency(group.amount)}
                                   </span>
                                 </div>
                               )}
                             </div>
                            ))}
                            
                             {/* Total Daily Budget with breakdown under Savings Categories */}
                             <div className="mt-4 pt-4 border-t border-gray-200">
                               <div className="font-medium text-base mb-2">
                                 Total daglig budget: {formatCurrency((() => {
                                   if (!results) return 0;
                                   const currentDate = new Date();
                                   let selectedYear = currentDate.getFullYear();
                                   let selectedMonth = currentDate.getMonth();
                                   
                                   if (selectedBudgetMonth) {
                                     const [yearStr, monthStr] = selectedBudgetMonth.split('-');
                                     selectedYear = parseInt(yearStr);
                                     selectedMonth = parseInt(monthStr) - 1;
                                   }
                                   
                                   const { weekdayCount, fridayCount } = calculateDaysForMonth(selectedYear, selectedMonth);
                                   return dailyTransfer * weekdayCount + weekendTransfer * fridayCount;
                                 })())}
                               </div>
                               <div className="ml-4 space-y-1 text-xs text-muted-foreground">
                                 <div>Daglig överföring (måndag-torsdag): {dailyTransfer}</div>
                                 <div>Helgöverföring (fredag-söndag): {weekendTransfer}</div>
                                 {(() => {
                                   if (!results) return null;
                                   const currentDate = new Date();
                                   let selectedYear = currentDate.getFullYear();
                                   let selectedMonth = currentDate.getMonth();
                                   
                                   if (selectedBudgetMonth) {
                                     const [yearStr, monthStr] = selectedBudgetMonth.split('-');
                                     selectedYear = parseInt(yearStr);
                                     selectedMonth = parseInt(monthStr) - 1;
                                   }
                                   
                                   const { weekdayCount, fridayCount } = calculateDaysForMonth(selectedYear, selectedMonth);
                                   const weekdaysExcludingFridays = weekdayCount - fridayCount;
                                   
                                   return (
                                     <>
                                       <div>• Vardagar: {weekdayCount} × {dailyTransfer} kr = {formatCurrency(weekdayCount * dailyTransfer)}</div>
                                       <div>• Helgdagar: {fridayCount} × {weekendTransfer} kr = {formatCurrency(fridayCount * weekendTransfer)}</div>
                                     </>
                                   );
                                 })()}
                               </div>
                             </div>
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
                          {formatCurrency(savingsGroups.reduce((sum, group) => sum + group.amount, 0))}
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
                             savings: savingsGroups.reduce((sum, group) => {
                               const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                               return sum + group.amount + subCategoriesTotal;
                             }, 0),
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
                                                      <div key={sub.id} className="flex justify-between">
                                                        <span>• {sub.name}:</span>
                                                        <span className="font-medium">{formatCurrency(sub.amount)}</span>
                                                      </div>
                                                    ))}
                                                    <div className="flex justify-between pt-1 border-t">
                                                      <span className="font-medium">Total:</span>
                                                      <span className="font-semibold">{formatCurrency(group.subCategories.reduce((sum, sub) => sum + sub.amount, 0))}</span>
                                                    </div>
                                                  </>
                                                ) : (
                                                  <div className="flex justify-between">
                                                    <span>Inga underkategorier</span>
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
                             const accountSavings = savingsGroups
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

                    {/* Account Summary after transfers */}
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
                              // Get original balance from first page or use estimated balance
                              const originalBalance = getAccountBalanceWithFallback(account);
                              
                              // Calculate savings for this account
                              const accountSavings = savingsGroups
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
                          {(() => {
                            const freshBalances = (window as any).__freshFinalBalances;
                            const isEstimated = hasEmptyAccountBalances() && getEstimatedAccountBalances(freshBalances);
                            return isEstimated ? "Ursprungligt saldo (Est)" : "Ursprungligt saldo";
                          })()}
                        </span>
                        <span className={originalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}>
                          {formatCurrency(originalBalance)}
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
                              // Get original balance from first page or use estimated balance
                              const originalBalance = getAccountBalanceWithFallback(account);
                              
                              // Calculate total deposits (savings + costs as positive) for this account
                              const savingsAmount = savingsGroups
                                .filter(group => group.account === account)
                                .reduce((sum, group) => sum + group.amount, 0);
                              
                              const costsAmount = costGroups.reduce((sum, group) => {
                                const groupCosts = group.subCategories
                                  ?.filter(sub => sub.account === account)
                                  .reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                                return sum + groupCosts;
                              }, 0);
                              
                               // Only count savings as deposits, not costs
                               const totalDeposits = savingsAmount;
                               
                                // Get all cost subcategories for this account that are "Löpande kostnad"
                                const accountCostItems = costGroups.reduce((items, group) => {
                                  const groupCosts = group.subCategories?.filter(sub => 
                                    sub.account === account && (sub.financedFrom === 'Löpande kostnad' || !sub.financedFrom)
                                  ) || [];
                                  return items.concat(groupCosts);
                                }, []);
                                
                                // Calculate total costs for this account (only Löpande kostnad)
                                const totalCosts = accountCostItems.reduce((sum, item) => sum + item.amount, 0);
                               
                                // Calculate final balance (original + savings deposits + cost budget deposit - costs)
                                const finalBalance = originalBalance + totalDeposits + totalCosts - totalCosts;
                               
                               console.log(`=== KONTOBELOPP EFTER BUDGET DEBUG FOR ${account} ===`);
                               console.log(`Original balance: ${originalBalance}`);
                               console.log(`Savings (deposits): ${savingsAmount}`);
                               console.log(`Costs: ${totalCosts}`);
                               console.log(`Final balance (Slutsaldo): ${finalBalance}`);
                               console.log(`Month: ${selectedBudgetMonth}`);
                               console.log(`=== END DEBUG ===`);
                              
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
                                          {(() => {
                            const freshBalances = (window as any).__freshFinalBalances;
                            const isEstimated = hasEmptyAccountBalances() && getEstimatedAccountBalances(freshBalances);
                                            return isEstimated ? "Ursprungligt saldo (Est)" : "Ursprungligt saldo";
                                          })()}
                                        </span>
                                        <span className={originalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}>
                                          {formatCurrency(originalBalance)}
                                        </span>
                                      </div>
                                      
                                      {/* Individual savings items (deposits) */}
                                      {savingsGroups
                                        .filter(group => group.account === account)
                                        .map(savingsGroup => (
                                          <div key={`costbudget-savings-${savingsGroup.id}`} className="flex justify-between text-sm">
                                            <span className="text-gray-600">{savingsGroup.name} (Insättning)</span>
                                            <span className="text-green-600">+{formatCurrency(savingsGroup.amount)}</span>
                                          </div>
                                        ))}
                                      
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
                                          <span className="text-gray-800">Slutsaldo</span>
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
                             const accountSavings = savingsGroups
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
                               const accountSavings = savingsGroups
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
                                 const accountSavings = savingsGroups
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
                               const accountSavings = savingsGroups
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
                    {isEditingPersonalBudget && (
                      <Button size="sm" onClick={addPersonalCostGroup}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  {getCurrentPersonalCosts().length > 0 ? (
                    <div className="space-y-2">
                      {getCurrentPersonalCosts().map((group) => (
                        <div key={group.id} className="flex gap-2 items-center">
                          {isEditingPersonalBudget ? (
                            <>
                              <Input
                                value={group.name}
                                onChange={(e) => updatePersonalCostGroup(group.id, 'name', e.target.value)}
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                value={group.amount === 0 ? '' : group.amount}
                                onChange={(e) => updatePersonalCostGroup(group.id, 'amount', Number(e.target.value) || 0)}
                                className="w-32"
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removePersonalCostGroup(group.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1">{group.name}</span>
                              <span className="w-32 text-right font-medium text-destructive">
                                {formatCurrency(group.amount)}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Inga personliga kostnader tillagda</p>
                      {isEditingPersonalBudget && (
                        <Button size="sm" onClick={addPersonalCostGroup} className="mt-2">
                          <Plus className="w-4 h-4 mr-1" />
                          Lägg till kostnad
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Personal Savings */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h5 className="font-medium">Personligt sparande</h5>
                    {isEditingPersonalBudget && (
                      <Button size="sm" onClick={addPersonalSavingsGroup}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  {getCurrentPersonalSavings().length > 0 ? (
                    <div className="space-y-2">
                      {getCurrentPersonalSavings().map((group) => (
                        <div key={group.id} className="flex gap-2 items-center">
                          {isEditingPersonalBudget ? (
                            <>
                              <Input
                                value={group.name}
                                onChange={(e) => updatePersonalSavingsGroup(group.id, 'name', e.target.value)}
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                value={group.amount === 0 ? '' : group.amount}
                                onChange={(e) => updatePersonalSavingsGroup(group.id, 'amount', Number(e.target.value) || 0)}
                                className="w-32"
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removePersonalSavingsGroup(group.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1">{group.name}</span>
                              <span className="w-32 text-right font-medium text-green-600">
                                {formatCurrency(group.amount)}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Inget personligt sparande tillagt</p>
                      {isEditingPersonalBudget && (
                        <Button size="sm" onClick={addPersonalSavingsGroup} className="mt-2">
                          <Plus className="w-4 h-4 mr-1" />
                          Lägg till sparande
                        </Button>
                      )}
                    </div>
                  )}
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
                        -{formatCurrency(getCurrentPersonalCosts().reduce((sum, group) => sum + group.amount, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Totalt sparande:</span>
                      <span className="font-medium">
                        -{formatCurrency(getCurrentPersonalSavings().reduce((sum, group) => sum + group.amount, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-semibold">
                      <span>Kvar att spendera:</span>
                      <span className={`font-semibold ${
                        (getCurrentPersonIncome() - 
                         getCurrentPersonalCosts().reduce((sum, group) => sum + group.amount, 0) - 
                         getCurrentPersonalSavings().reduce((sum, group) => sum + group.amount, 0)) >= 0 
                        ? 'text-green-600' : 'text-destructive'
                      }`}>
                        {results ? formatCurrency(
                          getCurrentPersonIncome() - 
                          getCurrentPersonalCosts().reduce((sum, group) => sum + group.amount, 0) - 
                          getCurrentPersonalSavings().reduce((sum, group) => sum + group.amount, 0)
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
                              getCurrentPersonalCosts().reduce((sum, group) => sum + group.amount, 0) - 
                              getCurrentPersonalSavings().reduce((sum, group) => sum + group.amount, 0)) / results.daysUntil25th)}
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
              <div className="space-y-6">
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
                          {Object.keys(historicalData).sort().reverse().map(month => (
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
                              setHistoricalData(prev => ({
                                ...prev,
                                [newMonthFromCopy]: {
                                  ...sourceData,
                                  month: newMonthFromCopy,
                                  date: new Date().toISOString()
                                }
                              }));
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
                          {Object.keys(historicalData).sort().reverse().map(month => (
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
                                susannaShareChecked
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
                             {Object.keys(historicalData).sort().reverse().map(month => (
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
                             accounts: JSON.parse(JSON.stringify(sourceData.accounts || ['Löpande', 'Sparkonto', 'Buffert'])),
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
                                <CollapsibleTrigger 
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
                                                      <Label className="text-xs text-muted-foreground">Underkategorier:</Label>
                                                       {group.subCategories.map((sub: any) => (
                                                         <div key={sub.id} className="grid grid-cols-4 gap-2">
                                                           <Input
                                                             value={sub.name}
                                                             onChange={(e) => updateEditingTemplateGroup(group.id, 'name', e.target.value, true, sub.id)}
                                                             className="h-7 text-xs"
                                                             placeholder="Underkategori"
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
      />
      {/* Bottom padding for better visual spacing */}
      <div className="h-16"></div>
    </div>
  );
};

export default BudgetCalculator;