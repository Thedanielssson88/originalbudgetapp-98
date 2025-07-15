import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, DollarSign, TrendingUp, Users, Calendar, Plus, Trash2, Edit, Save, X, ChevronDown, ChevronUp, History } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
  
  // Tab and expandable sections state
  const [activeTab, setActiveTab] = useState<string>("inkomster");
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    costCategories: false,
    savingsCategories: false,
    budgetTransfers: false,
    redDays: false,
    editMonths: false,
    monthSelector: false
  });
  
  // Personal budget states
  const [selectedPerson, setSelectedPerson] = useState<'andreas' | 'susanna'>('andreas');
  const [andreasPersonalCosts, setAndreasPersonalCosts] = useState<BudgetGroup[]>([]);
  const [andreasPersonalSavings, setAndreasPersonalSavings] = useState<BudgetGroup[]>([]);
  const [susannaPersonalCosts, setSusannaPersonalCosts] = useState<BudgetGroup[]>([]);
  const [susannaPersonalSavings, setSusannaPersonalSavings] = useState<BudgetGroup[]>([]);
  const [isEditingPersonalBudget, setIsEditingPersonalBudget] = useState<boolean>(false);
  
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
    
    // Set current month as default selected budget month
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedBudgetMonth(currentMonthKey);

    // Load standard values
    const savedStandardValues = localStorage.getItem('budgetCalculatorStandardValues');
    if (savedStandardValues) {
      try {
        const parsed = JSON.parse(savedStandardValues);
        setStandardValues(parsed);
        console.log('Successfully loaded standard values');
      } catch (error) {
        console.error('Error loading standard values:', error);
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
      customHolidays,
      results,
      selectedPerson,
      andreasPersonalCosts,
      andreasPersonalSavings,
      susannaPersonalCosts,
      susannaPersonalSavings,
      historicalData
    };
    localStorage.setItem('budgetCalculatorData', JSON.stringify(dataToSave));
  };

  // Save data whenever key values change
  useEffect(() => {
    saveToLocalStorage();
  }, [andreasSalary, andreasförsäkringskassan, andreasbarnbidrag, susannaSalary, susannaförsäkringskassan, susannabarnbidrag, costGroups, savingsGroups, dailyTransfer, weekendTransfer, customHolidays, results, selectedPerson, andreasPersonalCosts, andreasPersonalSavings, susannaPersonalCosts, susannaPersonalSavings, historicalData]);

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
    
    // Calculate remaining budget: from current date to 24th of selected month
    let remainingEndDate = new Date(selectedYear, selectedMonth, 24);
    
    if (currentDay > 24 && selectedYear === currentDate.getFullYear() && selectedMonth === currentDate.getMonth()) {
      // If current day is after 24th and we're looking at current month, calculate for next month
      const nextMonth = selectedMonth + 1;
      const nextYear = nextMonth > 11 ? selectedYear + 1 : selectedYear;
      const adjustedMonth = nextMonth > 11 ? 0 : nextMonth;
      remainingEndDate.setFullYear(nextYear, adjustedMonth, 24);
    }
    
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
    
    // Collect holiday days - show next 5 holidays or all until 25th (whichever is more)
    let holidayBudget = 0;
    
    // First collect holidays until 25th of current/next month
    const holidaysUntil25th: string[] = [];
    let currentDatePointer = new Date(currentDate);
    
    while (currentDatePointer <= remainingEndDate) {
      const dayOfWeek = currentDatePointer.getDay();
      const isHoliday = isSwedishHoliday(currentDatePointer);
      
      if (isHoliday) {
        const holidayName = getHolidayName(currentDatePointer);
        holidaysUntil25th.push(`${currentDatePointer.getDate()}/${currentDatePointer.getMonth() + 1} - ${holidayName}`);
        
        // If it's a weekday holiday, add to holiday budget
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          holidayBudget += dailyTransfer;
          if (dayOfWeek === 5) { // Friday
            holidayBudget += weekendTransfer;
          }
        }
      }
      
      currentDatePointer.setDate(currentDatePointer.getDate() + 1);
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
    
    // Calculate remaining budget (today to 24th) excluding holidays
    let remainingBudget = 0;
    let remainingWeekdayCount = 0;
    let remainingFridayCount = 0;
    currentDatePointer = new Date(currentDate);
    
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
      totalBudget: totalBudget - holidayBudget, // Subtract holiday budget from total
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
    
    // Save historical data for selected month
    const currentDate = new Date();
    const monthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const historicalSnapshot = {
      month: monthKey,
      date: currentDate.toISOString(),
      andreasSalary,
      andreasförsäkringskassan,
      andreasbarnbidrag,
      susannaSalary,
      susannaförsäkringskassan,
      susannabarnbidrag,
      totalSalary,
      costGroups: [...costGroups],
      savingsGroups: [...savingsGroups],
      totalMonthlyExpenses,
      totalCosts, // Add calculated total costs
      totalSavings, // Add calculated total savings
      dailyTransfer,
      weekendTransfer,
      balanceLeft,
      susannaShare,
      andreasShare,
      susannaPercentage,
      andreasPercentage,
      totalDailyBudget: budgetData.totalBudget,
      remainingDailyBudget: budgetData.remainingBudget,
      holidayDaysBudget: budgetData.holidayBudget,
      daysUntil25th: budgetData.daysUntil25th
    };
    
    setHistoricalData(prev => ({
      ...prev,
      [monthKey]: historicalSnapshot
    }));
    
    // Switch to summary tab after calculation
    setActiveTab("sammanstallning");
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

  // Function to get available months (only historical months with saved data)
  const getAvailableMonths = () => {
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Only include months with saved historical data
    const availableMonths = Object.keys(historicalData)
      .filter(month => month <= currentMonthKey) // Only current month and historical months
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
      // Copy ALL data from the latest historical month
      newMonthData = {
        ...JSON.parse(JSON.stringify(historicalData[latestMonth])), // Deep copy everything
        month: monthKey,
        date: new Date().toISOString()
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
        daysUntil25th: 0
      };
      console.log(`No historical data found, using current form values for new month: ${monthKey}`);
    }
    
    setHistoricalData(prev => ({
      ...prev,
      [monthKey]: newMonthData
    }));
  };

  // Function to load data from selected month into current form
  const loadDataFromSelectedMonth = (monthKey: string) => {
    const monthData = historicalData[monthKey];
    if (!monthData) return;
    
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

  // Function to handle month selection change
  const handleBudgetMonthChange = (monthKey: string) => {
    setSelectedBudgetMonth(monthKey);
    
    // If the month exists in historical data, load it
    if (historicalData[monthKey]) {
      loadDataFromSelectedMonth(monthKey);
    } else {
      // If it's a new month, add it with data copied from current month
      addNewBudgetMonth(monthKey, true);
    }
  };

  // Standard values functions
  const saveStandardValues = () => {
    const valuesToSave = {
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
      customHolidays
    };
    localStorage.setItem('budgetCalculatorStandardValues', JSON.stringify(valuesToSave));
    setStandardValues(valuesToSave);
    console.log('Standard values saved successfully');
  };

  const loadStandardValues = () => {
    if (standardValues) {
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
      console.log('Standard values loaded successfully');
    }
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
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
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
        totalSavings: totalSavings
      };
    }).sort((a, b) => a.month.localeCompare(b.month));

    if (chartData.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Ingen historisk data tillgänglig. Beräkna budget för att spara data.</p>
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
          </LineChart>
        </ResponsiveContainer>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Välj Budget Månad
            </CardTitle>
            <CardDescription>
              Beräkningar baseras på period från 24:e föregående månad till 25:e valda månad.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Current Month Display */}
            <div className="mb-4">
              <Label>Aktuell månad</Label>
              <div className="text-lg font-medium text-primary mt-1">
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

            {/* Expandable Advanced Options */}
            <div className="border rounded-lg">
              <Button
                variant="ghost"
                onClick={() => setExpandedSections(prev => ({
                  ...prev,
                  monthSelector: !prev.monthSelector
                }))}
                className="w-full justify-between p-4 h-auto"
              >
                <span className="text-sm font-medium">Avancerade månadsalternativ</span>
                {expandedSections.monthSelector ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
              
              {expandedSections.monthSelector && (
                <div className="p-4 border-t space-y-4">
                  {/* Original Month Selector */}
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <Label htmlFor="budget-month-selector">Månad för budget</Label>
                      <Select value={selectedBudgetMonth} onValueChange={handleBudgetMonthChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Välj månad..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableMonths().map(month => (
                            <SelectItem key={month} value={month}>
                              {month} {historicalData[month] ? '(Sparad data)' : '(Ny månad)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedBudgetMonth && !historicalData[selectedBudgetMonth] && (
                      <Button 
                        onClick={() => handleBudgetMonthChange(selectedBudgetMonth)}
                        variant="outline"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Skapa månad
                      </Button>
                    )}
                    {selectedBudgetMonth && historicalData[selectedBudgetMonth] && (
                      <Button 
                        onClick={() => {
                          const monthToDelete = selectedBudgetMonth;
                          setHistoricalData(prev => {
                            const newData = { ...prev };
                            delete newData[monthToDelete];
                            return newData;
                          });
                          
                          // Reset to current month after deletion and load current month data
                          const currentDate = new Date();
                          const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                          setSelectedBudgetMonth(currentMonthKey);
                          
                          // Load current month data if it exists, otherwise create it with current form values
                          if (historicalData[currentMonthKey]) {
                            loadDataFromSelectedMonth(currentMonthKey);
                          } else {
                            // If current month doesn't exist in historical data, create it with current values
                            addNewBudgetMonth(currentMonthKey, true);
                          }
                        }}
                        variant="destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Ta bort månad
                      </Button>
                    )}
                  </div>
                  
                  {selectedBudgetMonth && (
                    <div className="text-sm text-muted-foreground">
                      Arbetar med månad: <strong>{selectedBudgetMonth}</strong>
                      {historicalData[selectedBudgetMonth] ? 
                        ' - Data laddad från sparad historik' : 
                        ' - Ny månad med tomma fält'}
                    </div>
                  )}
                  
                  {/* Copy from Historical Month Section */}
                  {Object.keys(historicalData).length > 0 && (
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <h4 className="text-sm font-medium mb-3">Kopiera från historisk månad</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="source-month">Välj månad att kopiera från</Label>
                          <Select value={selectedSourceMonth} onValueChange={setSelectedSourceMonth}>
                            <SelectTrigger>
                              <SelectValue placeholder="Välj månad..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(historicalData)
                                .sort((a, b) => b.localeCompare(a))
                                .map(month => (
                                  <SelectItem key={month} value={month}>
                                    {month}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor="new-month-copy">Ny månad</Label>
                          <input
                            id="new-month-copy"
                            type="month"
                            value={newMonthFromCopy}
                            onChange={(e) => setNewMonthFromCopy(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                        
                        <div className="flex items-end">
                          <Button
                            onClick={() => {
                              if (selectedSourceMonth && newMonthFromCopy && !historicalData[newMonthFromCopy]) {
                                // Copy ALL data from selected historical month to new month
                                const sourceData = historicalData[selectedSourceMonth];
                                if (sourceData) {
                                  setHistoricalData(prev => ({
                                    ...prev,
                                    [newMonthFromCopy]: {
                                      ...JSON.parse(JSON.stringify(sourceData)), // Deep copy everything
                                      month: newMonthFromCopy,
                                      date: new Date().toISOString()
                                    }
                                  }));
                                  
                                  // Clear the form
                                  setNewMonthFromCopy('');
                                  setSelectedSourceMonth('');
                                  
                                  // Switch to the newly created month
                                  setSelectedBudgetMonth(newMonthFromCopy);
                                  loadDataFromSelectedMonth(newMonthFromCopy);
                                }
                              }
                            }}
                            disabled={!selectedSourceMonth || !newMonthFromCopy || historicalData[newMonthFromCopy]}
                            size="sm"
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Lägg till
                          </Button>
                        </div>
                      </div>
                      
                      {newMonthFromCopy && historicalData[newMonthFromCopy] && (
                        <div className="mt-2 text-sm text-destructive">
                          Månad {newMonthFromCopy} finns redan
                        </div>
                      )}
                      
                      {selectedSourceMonth && newMonthFromCopy && !historicalData[newMonthFromCopy] && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          Kopierar all data från {selectedSourceMonth} till {newMonthFromCopy}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 h-auto p-1">
            <TabsTrigger value="inkomster" className="w-full text-xs sm:text-sm">Inkomster och Utgifter</TabsTrigger>
            <TabsTrigger value="sammanstallning" className="w-full text-xs sm:text-sm">Sammanställning</TabsTrigger>
            <TabsTrigger value="overforing" className="w-full text-xs sm:text-sm">Överföring</TabsTrigger>
            <TabsTrigger value="egen-budget" className="w-full text-xs sm:text-sm">Egen Budget</TabsTrigger>
            <TabsTrigger value="historia" className="w-full text-xs sm:text-sm">Historia</TabsTrigger>
          </TabsList>

          {/* Tab 1: Inkomster och Utgifter */}
          <TabsContent value="inkomster" className="mt-32">
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
                    </div>
                  </div>

                  {/* Susanna Income Section */}
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-3 text-primary">Susanna Inkomst</h3>
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
                    </div>
                  </div>

                  {/* Calculate Button */}
                  <Button onClick={calculateBudget} className="w-full" size="lg">
                    <Calculator className="mr-2 h-4 w-4" />
                    Beräkna Budget
                  </Button>
                </CardContent>
              </Card>

              {/* Saved Values Section */}
              <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Save className="h-5 w-5 text-primary" />
                    Sparade värden
                  </CardTitle>
                  <CardDescription>
                    Spara och ladda standardvärden
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Button onClick={saveStandardValues} className="w-full">
                      <Save className="mr-2 h-4 w-4" />
                      Spara nuvarande värden
                    </Button>
                    <Button 
                      onClick={loadStandardValues} 
                      variant="outline" 
                      className="w-full"
                      disabled={!standardValues}
                    >
                      Ladda sparade värden
                    </Button>
                  </div>
                  
                  {standardValues && (
                    <div className="p-3 bg-muted/50 rounded-lg text-sm">
                      <p className="font-medium mb-2">Sparade värden innehåller:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>• Alla inkomster</li>
                        <li>• Budgetkategorier</li>
                        <li>• Överföringsinställningar</li>
                        <li>• Anpassade helgdagar</li>
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: Sammanställning */}
          <TabsContent value="sammanstallning" className="mt-32">
            <div className="space-y-6">
              {/* Total Income Display */}
              <Card>
                <CardHeader>
                  <CardTitle>Inkomstöversikt</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Andreas totala inkomst</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag)}
                      </div>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <div className="text-sm text-muted-foreground">Susannas totala inkomst</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(susannaSalary + susannaförsäkringskassan + susannabarnbidrag)}
                      </div>
                    </div>
                    <div className="p-4 bg-primary/20 rounded-lg">
                      <div className="text-sm text-muted-foreground">Total inkomst</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Budget Categories */}
              <Card>
                <CardHeader>
                  <CardTitle>Budgetöversikt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                                  <div key={sub.id} className="flex gap-2 items-center text-sm">
                                    {isEditingCategories ? (
                                      <>
                                        <Input
                                          value={sub.name}
                                          onChange={(e) => updateSubCategory(group.id, sub.id, 'name', e.target.value)}
                                          className="flex-1"
                                        />
                                        <Input
                                          type="number"
                                          value={sub.amount === 0 ? '' : sub.amount}
                                          onChange={(e) => updateSubCategory(group.id, sub.id, 'amount', Number(e.target.value) || 0)}
                                          className="w-32"
                                        />
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => removeSubCategory(group.id, sub.id)}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="flex-1">{sub.name}</span>
                                        <span className="w-32 text-right font-medium text-destructive">
                                          {formatCurrency(sub.amount)}
                                        </span>
                                      </>
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
                          <div key={group.id} className="flex gap-2 items-center">
                            {isEditingCategories ? (
                              <>
                                <Input
                                  value={group.name}
                                  onChange={(e) => updateSavingsGroup(group.id, 'name', e.target.value)}
                                  className="flex-1"
                                />
                                <Input
                                  type="number"
                                  value={group.amount === 0 ? '' : group.amount}
                                  onChange={(e) => updateSavingsGroup(group.id, 'amount', Number(e.target.value) || 0)}
                                  className="w-32"
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeSavingsGroup(group.id)}
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
                    )}
                  </div>

                  {/* Total Daily Budget with Dropdown */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('budgetTransfers')}>
                      <div>
                        <div className="text-sm text-muted-foreground">Total daglig budget</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {results ? formatCurrency(results.totalDailyBudget) : 'Beräkna budget först'}
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
                          <div className="text-sm text-muted-foreground">
                            <div>Vardagar: {results.weekdayCount} × {formatCurrency(dailyTransfer)} = {formatCurrency(results.weekdayCount * dailyTransfer)}</div>
                            <div>Helgdagar: {results.fridayCount} × {formatCurrency(weekendTransfer)} = {formatCurrency(results.fridayCount * weekendTransfer)}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Remaining Daily Budget */}
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Återstående daglig budget</div>
                    <div className="text-2xl font-bold text-amber-600">
                      {results ? formatCurrency(results.remainingDailyBudget) : 'Beräkna budget först'}
                    </div>
                  </div>

                  {/* Summary of Total Costs, Savings, and Daily Budget */}
                  <div className="p-4 bg-muted rounded-lg">
                    <h5 className="font-medium mb-3">Summering totala gemensamma kostnader/sparande</h5>
                    <div className="text-lg font-semibold text-center">
                      {formatCurrency(
                        (results ? results.totalDailyBudget : 0) +
                        costGroups.reduce((sum, group) => {
                          const subCategoriesTotal = group.subCategories?.reduce((subSum, sub) => subSum + sub.amount, 0) || 0;
                          return sum + subCategoriesTotal;
                        }, 0) +
                        savingsGroups.reduce((sum, group) => sum + group.amount, 0)
                      )}
                    </div>
                  </div>

                  {/* Budget Not Transferred (Red Days) */}
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('redDays')}>
                      <div>
                        <div className="text-sm text-muted-foreground">Budget som ej överförs (röda dagar)</div>
                        <div className="text-2xl font-bold text-red-600">
                          {results ? formatCurrency(results.holidayDaysBudget) : 'Beräkna budget först'}
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

                  {/* Remaining to Allocate */}
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Kvar att fördela</div>
                    <div className={`text-2xl font-bold ${results && results.balanceLeft >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {results ? formatCurrency(results.balanceLeft) : 'Beräkna budget först'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Individual Shares */}
              <Card>
                <CardHeader>
                  <CardTitle>Individuella andelar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Andreas andel</div>
                      <div className="text-lg font-semibold">
                        {results ? `${results.andreasPercentage.toFixed(1)}%` : 'Beräkna budget först'}
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {results ? formatCurrency(results.andreasShare) : 'Beräkna budget först'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Susanna andel</div>
                      <div className="text-lg font-semibold">
                        {results ? `${results.susannaPercentage.toFixed(1)}%` : 'Beräkna budget först'}
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {results ? formatCurrency(results.susannaShare) : 'Beräkna budget först'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Time & Transfer Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Tid & överföringsdetaljer</CardTitle>
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

                  {/* Individual Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Andreas Column */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-lg">Andreas</h5>
                      <div className="space-y-3">
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <div className="text-sm text-muted-foreground">Procentuell fördelning</div>
                          <div className="text-xl font-bold">
                            {(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                              ? ((andreasSalary + andreasförsäkringskassan + andreasbarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) * 100).toFixed(1)
                              : '0'}%
                          </div>
                        </div>
                        <div className="p-3 bg-destructive/10 rounded-lg">
                          <div className="text-sm text-muted-foreground">Andel av gemensamma kostnader/sparande</div>
                          <div className="text-xl font-bold text-destructive">
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
                        <div className="p-3 bg-green-50 rounded-lg">
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
                    </div>

                    {/* Susanna Column */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-lg">Susanna</h5>
                      <div className="space-y-3">
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <div className="text-sm text-muted-foreground">Procentuell fördelning</div>
                          <div className="text-xl font-bold">
                            {(andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) > 0
                              ? ((susannaSalary + susannaförsäkringskassan + susannabarnbidrag) / (andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag) * 100).toFixed(1)
                              : '0'}%
                          </div>
                        </div>
                        <div className="p-3 bg-destructive/10 rounded-lg">
                          <div className="text-sm text-muted-foreground">Andel av gemensamma kostnader/sparande</div>
                          <div className="text-xl font-bold text-destructive">
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
                        <div className="p-3 bg-green-50 rounded-lg">
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 3: Överföring */}
          <TabsContent value="overforing" className="mt-32">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Kontroll av belopp
                </CardTitle>
                <CardDescription>
                  Kontrollera överföringsbelopp och saldo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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

                {results && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-3">Beloppssammanfattning</h4>
                      <div className="space-y-2">
                         <div className="flex justify-between">
                           <span>Belopp för Återstående daglig budget:</span>
                           <span className={`font-medium ${results.remainingDailyBudget < 0 ? 'text-red-600' : ''}`}>{formatCurrency(results.remainingDailyBudget)}</span>
                         </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span>Individuella Andelar (Totalt belopp):</span>
                          <span className={`font-medium ${(results.andreasShare + results.susannaShare) < 0 ? 'text-red-600' : ''}`}>{formatCurrency(results.andreasShare + results.susannaShare)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Andreas andel:</span>
                          <span className="font-medium">{formatCurrency(results.andreasShare)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Susannas andel:</span>
                          <span className="font-medium">{formatCurrency(results.susannaShare)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span>Differens:</span>
                          <span className={`font-semibold ${(transferAccount - results.remainingDailyBudget - (results.andreasShare + results.susannaShare)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(transferAccount - results.remainingDailyBudget - (results.andreasShare + results.susannaShare))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Kvar på överföringskonto:</span>
                          <span className="font-medium">{formatCurrency(results.remainingDailyBudget + (transferAccount - results.remainingDailyBudget - (results.andreasShare + results.susannaShare)))}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium mb-3">Överföringsplan</h4>
                      <div className="space-y-1 text-sm">
                         <div>Antal dagar till lön (den 25): {results.daysUntil25th} dagar</div>
                         <div>Vardagar ({results.remainingWeekdayCount} st): {formatCurrency(dailyTransfer)} per dag</div>
                         <div>Helgdagar ({results.remainingFridayCount} st): {formatCurrency(weekendTransfer)} per dag</div>
                         <div className="font-medium pt-2">
                           Total överföring: {formatCurrency(results.remainingWeekdayCount * dailyTransfer + results.remainingFridayCount * weekendTransfer)}
                         </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Egen Budget */}
          <TabsContent value="egen-budget" className="mt-32">
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
                        {results ? formatCurrency(getCurrentPersonIncome()) : 'Beräkna budget först'}
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
                        ) : 'Beräkna budget först'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 5: Historia */}
          <TabsContent value="historia" className="mt-32">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BudgetCalculator;