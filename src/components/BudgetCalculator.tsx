import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, DollarSign, TrendingUp, Users, Calendar, Plus, Trash2, Edit, Save, X, ChevronDown, ChevronUp, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface SubCategory {
  id: string;
  name: string;
  amount: number;
  account?: string;
}

interface BudgetGroup {
  id: string;
  name: string;
  amount: number;
  type: 'cost' | 'savings';
  subCategories?: SubCategory[];
  account?: string;
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
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState<string>('');
  const [newHistoricalMonth, setNewHistoricalMonth] = useState<string>('');
  const [newMonthFromCopy, setNewMonthFromCopy] = useState<string>('');
  const [selectedSourceMonth, setSelectedSourceMonth] = useState<string>('');
  const [standardValues, setStandardValues] = useState<any>(null);
  const [transferAccount, setTransferAccount] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  
  // Tab and expandable sections state
  const [activeTab, setActiveTab] = useState<string>("inkomster");
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    costCategories: false,
    savingsCategories: false,
    budgetTransfers: false,
    redDays: false,
    editMonths: false,
    monthSelector: false,
    accountSummary: false,
    budgetTemplates: false
  });
  
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
  
  // User name states
  const [userName1, setUserName1] = useState<string>('Andreas');
  const [userName2, setUserName2] = useState<string>('Susanna');

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
          const migratedCostGroups = parsed.budgetGroups.map((group: any) => ({
            ...group,
            type: 'cost'
          }));
          setCostGroups(migratedCostGroups);
        } else {
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
          setTimeout(() => {
            loadDataFromSelectedMonth(savedSelectedMonth);
          }, 0);
        }
        
      } catch (error) {
        console.error('Error loading saved data:', error);
        console.warn('Using default values due to corrupted data');
        
        const currentDate = new Date();
        const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        setSelectedBudgetMonth(currentMonthKey);
      }
    } else {
      const currentDate = new Date();
      const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      setSelectedBudgetMonth(currentMonthKey);
    }
    
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
    
    setTimeout(() => calculateBudget(), 0);
  }, []);

  // Save current data to the selected month in historical data
  const saveToSelectedMonth = () => {
    const currentDate = new Date();
    const monthKey = selectedBudgetMonth || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
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
      selectedBudgetMonth,
      userName1,
      userName2
    };
    localStorage.setItem('budgetCalculatorData', JSON.stringify(dataToSave));
  };

  // Save data whenever key values change
  useEffect(() => {
    if (!isInitialLoad) {
      saveToLocalStorage();
      saveToSelectedMonth();
    }
  }, [andreasSalary, andreasförsäkringskassan, andreasbarnbidrag, susannaSalary, susannaförsäkringskassan, susannabarnbidrag, costGroups, savingsGroups, dailyTransfer, weekendTransfer, customHolidays, selectedPerson, andreasPersonalCosts, andreasPersonalSavings, susannaPersonalCosts, susannaPersonalSavings, accounts, budgetTemplates, userName1, userName2, isInitialLoad]);

  // Utility functions, calculation logic, etc.

  const calculateBudget = () => {
    // Example calculation logic for demonstration
    const totalIncome = andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + susannaSalary + susannaförsäkringskassan + susannabarnbidrag;
    const totalExpenses = costGroups.reduce((sum, group) => sum + group.amount, 0);
    const balance = totalIncome - totalExpenses;

    const daysInMonth = 30; // Simplified
    const totalDailyBudget = balance / daysInMonth;

    setResults({
      totalSalary: totalIncome,
      totalDailyBudget,
      remainingDailyBudget: totalDailyBudget,
      holidayDaysBudget: 0,
      balanceLeft: balance,
      susannaShare: balance * 0.5,
      andreasShare: balance * 0.5,
      susannaPercentage: 50,
      andreasPercentage: 50,
      daysUntil25th: 25,
      weekdayCount: 22,
      fridayCount: 4,
      totalMonthlyExpenses: totalExpenses,
      holidayDays: [],
      holidaysUntil25th: [],
      nextTenHolidays: [],
      remainingWeekdayCount: 22,
      remainingFridayCount: 4
    });
  };

  const loadDataFromSelectedMonth = (monthKey: string) => {
    const data = historicalData[monthKey];
    if (data) {
      setAndreasSalary(data.andreasSalary || 45000);
      setAndreasförsäkringskassan(data.andreasförsäkringskassan || 0);
      setAndreasbarnbidrag(data.andreasbarnbidrag || 0);
      setSusannaSalary(data.susannaSalary || 40000);
      setSusannaförsäkringskassan(data.susannaförsäkringskassan || 5000);
      setSusannabarnbidrag(data.susannabarnbidrag || 0);
      setCostGroups(data.costGroups || []);
      setSavingsGroups(data.savingsGroups || []);
      setDailyTransfer(data.dailyTransfer || 300);
      setWeekendTransfer(data.weekendTransfer || 540);
      setCustomHolidays(data.customHolidays || []);
      setAndreasPersonalCosts(data.andreasPersonalCosts || []);
      setAndreasPersonalSavings(data.andreasPersonalSavings || []);
      setSusannaPersonalCosts(data.susannaPersonalCosts || []);
      setSusannaPersonalSavings(data.susannaPersonalSavings || []);
      setAccounts(data.accounts || ['Löpande', 'Sparkonto', 'Buffert']);
      setResults({
        totalSalary: data.totalSalary || 0,
        totalDailyBudget: data.totalDailyBudget || 0,
        remainingDailyBudget: data.remainingDailyBudget || 0,
        holidayDaysBudget: data.holidayDaysBudget || 0,
        balanceLeft: data.balanceLeft || 0,
        susannaShare: data.susannaShare || 0,
        andreasShare: data.andreasShare || 0,
        susannaPercentage: data.susannaPercentage || 0,
        andreasPercentage: data.andreasPercentage || 0,
        daysUntil25th: data.daysUntil25th || 0,
        weekdayCount: data.weekdayCount || 0,
        fridayCount: data.fridayCount || 0,
        totalMonthlyExpenses: data.totalMonthlyExpenses || 0,
        holidayDays: data.holidayDays || [],
        holidaysUntil25th: data.holidaysUntil25th || [],
        nextTenHolidays: data.nextTenHolidays || [],
        remainingWeekdayCount: data.remainingWeekdayCount || 0,
        remainingFridayCount: data.remainingFridayCount || 0
      });
    }
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

        {/* Simplified UI for now - basic structure */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Budget Calculator
            </CardTitle>
            <CardDescription>
              Enter your income and expenses to calculate your budget
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="andreas-salary">Andreas Salary</Label>
                  <Input
                    id="andreas-salary"
                    type="number"
                    value={andreasSalary}
                    onChange={(e) => setAndreasSalary(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="susanna-salary">Susanna Salary</Label>
                  <Input
                    id="susanna-salary"
                    type="number"
                    value={susannaSalary}
                    onChange={(e) => setSusannaSalary(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Cost Categories</h3>
                {costGroups.map((group) => (
                  <div key={group.id} className="flex items-center gap-4">
                    <Label className="min-w-24">{group.name}</Label>
                    <Input
                      type="number"
                      value={group.amount}
                      onChange={(e) => {
                        const updatedGroups = costGroups.map(g => 
                          g.id === group.id ? { ...g, amount: Number(e.target.value) || 0 } : g
                        );
                        setCostGroups(updatedGroups);
                      }}
                    />
                  </div>
                ))}
              </div>

              <Button 
                onClick={() => {
                  const totalIncome = andreasSalary + susannaSalary;
                  const totalExpenses = costGroups.reduce((sum, group) => sum + group.amount, 0);
                  const balance = totalIncome - totalExpenses;
                  
                  setResults({
                    totalSalary: totalIncome,
                    totalDailyBudget: balance / 30,
                    remainingDailyBudget: balance / 30,
                    holidayDaysBudget: 0,
                    balanceLeft: balance,
                    susannaShare: balance * 0.5,
                    andreasShare: balance * 0.5,
                    susannaPercentage: 50,
                    andreasPercentage: 50,
                    daysUntil25th: 25,
                    weekdayCount: 22,
                    fridayCount: 4,
                    totalMonthlyExpenses: totalExpenses,
                    holidayDays: [],
                    holidaysUntil25th: [],
                    nextTenHolidays: [],
                    remainingWeekdayCount: 22,
                    remainingFridayCount: 4
                  });
                }}
                className="w-full"
              >
                Calculate Budget
              </Button>

              {results && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Results</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p><strong>Total Income:</strong> {results.totalSalary.toLocaleString()} SEK</p>
                      <p><strong>Total Expenses:</strong> {results.totalMonthlyExpenses.toLocaleString()} SEK</p>
                      <p><strong>Balance:</strong> {results.balanceLeft.toLocaleString()} SEK</p>
                    </div>
                    <div>
                      <p><strong>Andreas Share:</strong> {results.andreasShare.toLocaleString()} SEK</p>
                      <p><strong>Susanna Share:</strong> {results.susannaShare.toLocaleString()} SEK</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BudgetCalculator;
