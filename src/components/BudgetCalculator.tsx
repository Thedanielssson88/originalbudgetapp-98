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

// Import new architecture
import { initializeApp, handleManualValueChange, handleMonthDataUpdate, handleAccountBalanceUpdate, handleUIStateUpdate, getCurrentState, handleBatchValueChanges } from '../services/appOrchestrator';
import { STORAGE_KEYS } from '../services/storageService';
import { BudgetGroup, SubCategory, Holiday, BudgetResults } from '../types/budget';

const BudgetCalculator = () => {
  // UI state that's not persisted globally
  const [activeTab, setActiveTab] = useState<string>("inkomster");
  const [previousTab, setPreviousTab] = useState<string>("");
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState<string>('');
  const [selectedHistoricalMonth, setSelectedHistoricalMonth] = useState<string>('');
  const [newHistoricalMonth, setNewHistoricalMonth] = useState<string>('');
  const [newMonthFromCopy, setNewMonthFromCopy] = useState<string>('');
  const [selectedSourceMonth, setSelectedSourceMonth] = useState<string>('');
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [isUpdatingAllMonths, setIsUpdatingAllMonths] = useState<boolean>(false);
  
  // Editing states
  const [isEditingCategories, setIsEditingCategories] = useState<boolean>(false);
  const [isEditingTransfers, setIsEditingTransfers] = useState<boolean>(false);
  const [isEditingHolidays, setIsEditingHolidays] = useState<boolean>(false);
  const [isEditingPersonalBudget, setIsEditingPersonalBudget] = useState<boolean>(false);
  const [isEditingAccounts, setIsEditingAccounts] = useState<boolean>(false);
  const [isEditingAccountCategories, setIsEditingAccountCategories] = useState<boolean>(false);
  
  // Personal budget states
  const [selectedPerson, setSelectedPerson] = useState<'andreas' | 'susanna'>('andreas');
  
  // Account management states
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  
  // Budget template states
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [selectedTemplateSourceMonth, setSelectedTemplateSourceMonth] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingTemplateData, setEditingTemplateData] = useState<any>(null);
  const [selectedTemplateToCopy, setSelectedTemplateToCopy] = useState<string>('');
  const [targetCopyMonth, setTargetCopyMonth] = useState<string>('');
  const [showTemplateDetails, setShowTemplateDetails] = useState<boolean>(false);
  
  // Create month dialog state
  const [isCreateMonthDialogOpen, setIsCreateMonthDialogOpen] = useState<boolean>(false);
  const [createMonthDirection, setCreateMonthDirection] = useState<'previous' | 'next'>('next');
  
  // Chart legend expandable state
  const [isChartLegendExpanded, setIsChartLegendExpanded] = useState<boolean>(false);
  
  // Get current state from the centralized store
  const appState = getCurrentState();
  const { rawData, calculated } = appState;
  
  // Derived state from central store
  const currentMonthResults = useMemo(() => {
    const monthKey = selectedBudgetMonth || new Date().toISOString().slice(0, 7);
    return calculated.monthlyResults[monthKey] || null;
  }, [calculated.monthlyResults, selectedBudgetMonth]);
  
  const currentMonthData = useMemo(() => {
    const monthKey = selectedBudgetMonth || new Date().toISOString().slice(0, 7);
    return rawData.historicalData[monthKey] || {};
  }, [rawData.historicalData, selectedBudgetMonth]);
  
  // Current values (from selected month or defaults)
  const andreasSalary = currentMonthData.andreasSalary ?? rawData.andreasSalary;
  const andreasForsakringskassan = currentMonthData.andreasForsakringskassan ?? rawData.andreasForsakringskassan;
  const andreasBarnbidrag = currentMonthData.andreasBarnbidrag ?? rawData.andreasBarnbidrag;
  const susannaSalary = currentMonthData.susannaSalary ?? rawData.susannaSalary;
  const susannaForsakringskassan = currentMonthData.susannaForsakringskassan ?? rawData.susannaForsakringskassan;
  const susannaBarnbidrag = currentMonthData.susannaBarnbidrag ?? rawData.susannaBarnbidrag;
  const costGroups = currentMonthData.costGroups ?? rawData.costGroups;
  const savingsGroups = currentMonthData.savingsGroups ?? rawData.savingsGroups;
  const dailyTransfer = currentMonthData.dailyTransfer ?? rawData.dailyTransfer;
  const weekendTransfer = currentMonthData.weekendTransfer ?? rawData.weekendTransfer;
  const transferAccount = currentMonthData.transferAccount ?? rawData.transferAccount;
  const andreasPersonalCosts = currentMonthData.andreasPersonalCosts ?? rawData.andreasPersonalCosts;
  const andreasPersonalSavings = currentMonthData.andreasPersonalSavings ?? rawData.andreasPersonalSavings;
  const susannaPersonalCosts = currentMonthData.susannaPersonalCosts ?? rawData.susannaPersonalCosts;
  const susannaPersonalSavings = currentMonthData.susannaPersonalSavings ?? rawData.susannaPersonalSavings;
  const accountBalances = currentMonthData.accountBalances ?? {};
  const accountBalancesSet = currentMonthData.accountBalancesSet ?? {};
  const accountEstimatedFinalBalances = currentMonthData.accountEstimatedFinalBalances ?? {};
  const accountEstimatedFinalBalancesSet = currentMonthData.accountEstimatedFinalBalancesSet ?? {};
  const transferChecks = currentMonthData.transferChecks ?? rawData.transferChecks;
  const andreasShareChecked = currentMonthData.andreasShareChecked ?? rawData.andreasShareChecked;
  const susannaShareChecked = currentMonthData.susannaShareChecked ?? rawData.susannaShareChecked;
  
  // Initialize the application on mount
  useEffect(() => {
    console.log('[BudgetCalculator] Initializing application...');
    initializeApp();
    
    // Set current month as default selected budget month
    const currentDate = new Date();
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedBudgetMonth(currentMonthKey);
    
    // Mark initial load as complete
    setTimeout(() => setIsInitialLoad(false), 100);
  }, []);
  
  // Value change handlers using the new architecture
  const handleSalaryChange = (field: string, value: number) => {
    if (selectedBudgetMonth) {
      // Update month-specific data
      const updatedMonthData = {
        ...currentMonthData,
        [field]: value
      };
      handleMonthDataUpdate(selectedBudgetMonth, updatedMonthData);
    } else {
      // Update global default
      const storageKey = STORAGE_KEYS[field.toUpperCase() as keyof typeof STORAGE_KEYS] as any;
      if (storageKey) {
        handleManualValueChange(storageKey, value, field);
      }
    }
  };
  
  const handleCostGroupsChange = (newCostGroups: BudgetGroup[]) => {
    if (selectedBudgetMonth) {
      const updatedMonthData = {
        ...currentMonthData,
        costGroups: newCostGroups
      };
      handleMonthDataUpdate(selectedBudgetMonth, updatedMonthData);
    } else {
      handleManualValueChange(STORAGE_KEYS.COST_GROUPS, newCostGroups, 'costGroups');
    }
  };
  
  const handleSavingsGroupsChange = (newSavingsGroups: BudgetGroup[]) => {
    if (selectedBudgetMonth) {
      const updatedMonthData = {
        ...currentMonthData,
        savingsGroups: newSavingsGroups
      };
      handleMonthDataUpdate(selectedBudgetMonth, updatedMonthData);
    } else {
      handleManualValueChange(STORAGE_KEYS.SAVINGS_GROUPS, newSavingsGroups, 'savingsGroups');
    }
  };
  
  const handleTransferChange = (field: 'dailyTransfer' | 'weekendTransfer' | 'transferAccount', value: number) => {
    if (selectedBudgetMonth) {
      const updatedMonthData = {
        ...currentMonthData,
        [field]: value
      };
      handleMonthDataUpdate(selectedBudgetMonth, updatedMonthData);
    } else {
      const storageKey = STORAGE_KEYS[field.toUpperCase() as keyof typeof STORAGE_KEYS] as any;
      handleManualValueChange(storageKey, value, field);
    }
  };
  
  const handleHolidaysChange = (newHolidays: Holiday[]) => {
    handleManualValueChange(STORAGE_KEYS.CUSTOM_HOLIDAYS, newHolidays, 'customHolidays');
  };
  
  const handleAccountsChange = (newAccounts: string[]) => {
    handleManualValueChange(STORAGE_KEYS.ACCOUNTS, newAccounts, 'accounts');
  };
  
  const handlePersonalBudgetChange = (person: 'andreas' | 'susanna', type: 'costs' | 'savings', newBudget: BudgetGroup[]) => {
    const field = `${person}Personal${type === 'costs' ? 'Costs' : 'Savings'}`;
    if (selectedBudgetMonth) {
      const updatedMonthData = {
        ...currentMonthData,
        [field]: newBudget
      };
      handleMonthDataUpdate(selectedBudgetMonth, updatedMonthData);
    } else {
      const storageKey = STORAGE_KEYS[field.toUpperCase() as keyof typeof STORAGE_KEYS] as any;
      handleManualValueChange(storageKey, newBudget, field);
    }
  };
  
  const handleExpandedSectionChange = (section: string, expanded: boolean) => {
    const newExpandedSections = {
      ...rawData.expandedSections,
      [section]: expanded
    };
    handleUIStateUpdate('expandedSections', newExpandedSections);
  };
  
  // Tab navigation helper functions
  const getTabOrder = () => {
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    
    let targetMonthKey;
    if (currentDay <= 24) {
      targetMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    } else {
      const nextMonth = currentDate.getMonth() + 1;
      const nextYear = nextMonth === 12 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
      const adjustedNextMonth = nextMonth === 12 ? 1 : nextMonth + 1;
      targetMonthKey = `${nextYear}-${String(adjustedNextMonth).padStart(2, '0')}`;
    }
    
    const shouldShowOverforingTab = selectedBudgetMonth === targetMonthKey;
    
    return shouldShowOverforingTab 
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

  // Helper functions
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyInput = (value: string): string => {
    const number = parseFloat(value.replace(/[^0-9.-]/g, ''));
    if (isNaN(number)) return '';
    return number.toString();
  };

  // Render historical charts
  const renderHistoricalCharts = () => {
    const historicalData = rawData.historicalData;
    const chartData = Object.keys(historicalData).map(monthKey => {
      const data = historicalData[monthKey];
      const monthResults = calculated.monthlyResults[monthKey];
      
      // Calculate totals from groups if monthResults is not available
      const totalCosts = monthResults?.totalMonthlyExpenses || 
        (data.costGroups?.reduce((sum: number, group: any) => {
          const subCategoriesTotal = group.subCategories?.reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
          return sum + (group.amount || 0) + subCategoriesTotal;
        }, 0) || 0);
      
      const totalSavings = data.savingsGroups?.reduce((sum: number, group: any) => sum + (group.amount || 0), 0) || 0;
      
      const totalIncome = monthResults?.totalSalary || 
        ((data.andreasSalary || 0) + (data.andreasForsakringskassan || 0) + (data.andreasBarnbidrag || 0) +
         (data.susannaSalary || 0) + (data.susannaForsakringskassan || 0) + (data.susannaBarnbidrag || 0));
      
      const totalDailyBudget = monthResults?.totalDailyBudget || 0;
      
      return {
        month: monthKey,
        totalIncome,
        totalCosts,
        totalSavings,
        totalDailyBudget
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

  // Add/remove budget group functions
  const addCostGroup = () => {
    const newGroup: BudgetGroup = {
      id: Date.now().toString(),
      name: 'Ny kostnad',
      amount: 0,
      type: 'cost',
      subCategories: []
    };
    const newCostGroups = [...costGroups, newGroup];
    handleCostGroupsChange(newCostGroups);
  };

  const removeCostGroup = (id: string) => {
    const newCostGroups = costGroups.filter(group => group.id !== id);
    handleCostGroupsChange(newCostGroups);
  };

  const updateCostGroup = (id: string, field: keyof BudgetGroup, value: any) => {
    const newCostGroups = costGroups.map(group =>
      group.id === id ? { ...group, [field]: value } : group
    );
    handleCostGroupsChange(newCostGroups);
  };

  const addSavingsGroup = () => {
    const newGroup: BudgetGroup = {
      id: Date.now().toString(),
      name: 'Nytt sparande',
      amount: 0,
      type: 'savings'
    };
    const newSavingsGroups = [...savingsGroups, newGroup];
    handleSavingsGroupsChange(newSavingsGroups);
  };

  const removeSavingsGroup = (id: string) => {
    const newSavingsGroups = savingsGroups.filter(group => group.id !== id);
    handleSavingsGroupsChange(newSavingsGroups);
  };

  const updateSavingsGroup = (id: string, field: keyof BudgetGroup, value: any) => {
    const newSavingsGroups = savingsGroups.map(group =>
      group.id === id ? { ...group, [field]: value } : group
    );
    handleSavingsGroupsChange(newSavingsGroups);
  };

  // Month management functions
  const loadDataFromSelectedMonth = (monthKey: string) => {
    const monthData = rawData.historicalData[monthKey];
    if (!monthData) return;
    
    console.log(`Loading data from month: ${monthKey}`);
    // Data is already loaded through the reactive system via currentMonthData
  };

  const saveToSelectedMonth = () => {
    if (!selectedBudgetMonth) return;
    
    console.log(`Saving current data to month: ${selectedBudgetMonth}`);
    // Data is automatically saved through the reactive system
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-center">Budgetkalkylator</h1>
        <p className="text-muted-foreground">
          Hantera er ekonomi och planera framtiden tillsammans
        </p>
      </div>

      {/* Month Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Välj månad att arbeta med</span>
            <Calendar className="h-5 w-5" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Månad för budgetarbete</Label>
              <Select value={selectedBudgetMonth} onValueChange={setSelectedBudgetMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj månad" />
                </SelectTrigger>
                <SelectContent>
                  {/* Generate month options */}
                  {(() => {
                    const months = [];
                    const now = new Date();
                    for (let i = -12; i <= 12; i++) {
                      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
                      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      const monthName = date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' });
                      months.push(
                        <SelectItem key={monthKey} value={monthKey}>
                          {monthName}
                        </SelectItem>
                      );
                    }
                    return months;
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={navigateToPreviousTab}
            disabled={isAnimating}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <TabsList className="grid w-full max-w-2xl mx-4 grid-cols-5 lg:grid-cols-6">
            <TabsTrigger value="inkomster">Inkomster och Utgifter</TabsTrigger>
            <TabsTrigger value="sammanstallning">Sammanställning</TabsTrigger>
            {(() => {
              const currentDate = new Date();
              const currentDay = currentDate.getDate();
              
              let targetMonthKey;
              if (currentDay <= 24) {
                targetMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
              } else {
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
            <TabsTrigger value="installningar">Inställningar</TabsTrigger>
          </TabsList>

          <Button
            variant="outline"
            size="sm"
            onClick={navigateToNextTab}
            disabled={isAnimating}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Tab Contents */}
        <TabsContent value="inkomster">
          <Card>
            <CardHeader>
              <CardTitle>Inkomster och Utgifter</CardTitle>
              <CardDescription>
                Ange era månadsintäkter och fasta utgifter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Income Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Inkomster</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <h4 className="font-medium">{rawData.userName1}</h4>
                    <div className="space-y-2">
                      <Label>Lön</Label>
                      <Input
                        type="number"
                        value={andreasSalary}
                        onChange={(e) => handleSalaryChange('andreasSalary', parseFloat(e.target.value) || 0)}
                        placeholder="Ange lön"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Försäkringskassan</Label>
                      <Input
                        type="number"
                        value={andreasForsakringskassan}
                        onChange={(e) => handleSalaryChange('andreasForsakringskassan', parseFloat(e.target.value) || 0)}
                        placeholder="Ange belopp från Försäkringskassan"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Barnbidrag</Label>
                      <Input
                        type="number"
                        value={andreasBarnbidrag}
                        onChange={(e) => handleSalaryChange('andreasBarnbidrag', parseFloat(e.target.value) || 0)}
                        placeholder="Ange barnbidrag"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">{rawData.userName2}</h4>
                    <div className="space-y-2">
                      <Label>Lön</Label>
                      <Input
                        type="number"
                        value={susannaSalary}
                        onChange={(e) => handleSalaryChange('susannaSalary', parseFloat(e.target.value) || 0)}
                        placeholder="Ange lön"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Försäkringskassan</Label>
                      <Input
                        type="number"
                        value={susannaForsakringskassan}
                        onChange={(e) => handleSalaryChange('susannaForsakringskassan', parseFloat(e.target.value) || 0)}
                        placeholder="Ange belopp från Försäkringskassan"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Barnbidrag</Label>
                      <Input
                        type="number"
                        value={susannaBarnbidrag}
                        onChange={(e) => handleSalaryChange('susannaBarnbidrag', parseFloat(e.target.value) || 0)}
                        placeholder="Ange barnbidrag"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Total Income Display */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total månadsinkomst:</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(
                        andreasSalary + andreasForsakringskassan + andreasBarnbidrag +
                        susannaSalary + susannaForsakringskassan + susannaBarnbidrag
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cost Categories Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Kostnadskategorier</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingCategories(!isEditingCategories)}
                    >
                      {isEditingCategories ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                      {isEditingCategories ? 'Avsluta' : 'Redigera'}
                    </Button>
                    {isEditingCategories && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addCostGroup}
                      >
                        <Plus className="h-4 w-4" />
                        Lägg till
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {costGroups.map((group) => (
                    <div key={group.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1">
                        {isEditingCategories ? (
                          <Input
                            value={group.name}
                            onChange={(e) => updateCostGroup(group.id, 'name', e.target.value)}
                            placeholder="Kategorinamn"
                          />
                        ) : (
                          <span className="font-medium">{group.name}</span>
                        )}
                      </div>
                      <div className="w-32">
                        {isEditingCategories ? (
                          <Input
                            type="number"
                            value={group.amount}
                            onChange={(e) => updateCostGroup(group.id, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder="Belopp"
                          />
                        ) : (
                          <span className="font-mono">{formatCurrency(group.amount)}</span>
                        )}
                      </div>
                      {isEditingCategories && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeCostGroup(group.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Total Costs Display */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Totala kostnader:</span>
                    <span className="text-xl font-bold text-red-600">
                      {formatCurrency(costGroups.reduce((sum, group) => sum + group.amount, 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Savings Categories Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Sparande</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingCategories(!isEditingCategories)}
                    >
                      {isEditingCategories ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                      {isEditingCategories ? 'Avsluta' : 'Redigera'}
                    </Button>
                    {isEditingCategories && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addSavingsGroup}
                      >
                        <Plus className="h-4 w-4" />
                        Lägg till
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {savingsGroups.map((group) => (
                    <div key={group.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1">
                        {isEditingCategories ? (
                          <Input
                            value={group.name}
                            onChange={(e) => updateSavingsGroup(group.id, 'name', e.target.value)}
                            placeholder="Sparande namn"
                          />
                        ) : (
                          <span className="font-medium">{group.name}</span>
                        )}
                      </div>
                      <div className="w-32">
                        {isEditingCategories ? (
                          <Input
                            type="number"
                            value={group.amount}
                            onChange={(e) => updateSavingsGroup(group.id, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder="Belopp"
                          />
                        ) : (
                          <span className="font-mono">{formatCurrency(group.amount)}</span>
                        )}
                      </div>
                      {isEditingCategories && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeSavingsGroup(group.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Total Savings Display */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Totalt sparande:</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(savingsGroups.reduce((sum, group) => sum + group.amount, 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Daily Transfer Settings */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Dagliga överföringar</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingTransfers(!isEditingTransfers)}
                  >
                    {isEditingTransfers ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                    {isEditingTransfers ? 'Avsluta' : 'Redigera'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vardagsöverföring (måndag-torsdag)</Label>
                    {isEditingTransfers ? (
                      <Input
                        type="number"
                        value={dailyTransfer}
                        onChange={(e) => handleTransferChange('dailyTransfer', parseFloat(e.target.value) || 0)}
                        placeholder="Daglig överföring"
                      />
                    ) : (
                      <div className="p-3 bg-muted rounded-lg">
                        <span className="font-mono text-lg">{formatCurrency(dailyTransfer)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Helgöverföring (fredag-söndag)</Label>
                    {isEditingTransfers ? (
                      <Input
                        type="number"
                        value={weekendTransfer}
                        onChange={(e) => handleTransferChange('weekendTransfer', parseFloat(e.target.value) || 0)}
                        placeholder="Helgöverföring"
                      />
                    ) : (
                      <div className="p-3 bg-muted rounded-lg">
                        <span className="font-mono text-lg">{formatCurrency(weekendTransfer)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sammanstallning">
          <Card>
            <CardHeader>
              <CardTitle>Budgetsammanställning</CardTitle>
              <CardDescription>
                Översikt över er ekonomiska situation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentMonthResults && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total inkomst</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(currentMonthResults.totalSalary)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Totala utgifter</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(currentMonthResults.totalMonthlyExpenses)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Daglig budget</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(currentMonthResults.totalDailyBudget)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Kvar att fördela</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${currentMonthResults.balanceLeft >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(currentMonthResults.balanceLeft)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">{rawData.userName1} andel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(currentMonthResults.andreasShare)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">{rawData.userName2} andel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(currentMonthResults.susannaShare)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {!currentMonthResults && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Inga beräkningar tillgängliga för vald månad.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tab contents would continue here... */}
        <TabsContent value="overforing">
          <Card>
            <CardHeader>
              <CardTitle>Överföringar</CardTitle>
              <CardDescription>
                Hantera månadsöverföringar och checklistor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Överföringsfunktioner kommer här...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="egen-budget">
          <Card>
            <CardHeader>
              <CardTitle>Egen Budget</CardTitle>
              <CardDescription>
                Personliga budgetar för {rawData.userName1} och {rawData.userName2}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Personliga budgetfunktioner kommer här...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historia">
          <div className="space-y-6">
            {/* Historical Charts Section */}
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
                <CustomLineChart 
                  data={calculated.chartData}
                  accounts={rawData.selectedAccountsForChart.length > 0 ? rawData.selectedAccountsForChart : rawData.accounts}
                  accountColors={['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']}
                  showEstimatedBudgetAmounts={rawData.showEstimatedBudgetAmounts}
                  width={0}
                  height={400}
                  margin={{ top: 20, right: 30, bottom: 60, left: 50 }}
                  formatCurrency={formatCurrency}
                  showIndividualCostsOutsideBudget={rawData.showIndividualCostsOutsideBudget}
                  showSavingsSeparately={rawData.showSavingsSeparately}
                  balanceType={rawData.balanceType as 'starting' | 'closing'}
                />
              </CardContent>
            </Card>

            {/* Account Data Table */}
            <AccountDataTable 
              data={calculated.accountDataRows}
              className="w-full"
            />
          </div>
        </TabsContent>

        <TabsContent value="installningar">
          <Card>
            <CardHeader>
              <CardTitle>Inställningar</CardTitle>
              <CardDescription>
                Hantera konton, mallar och övriga inställningar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Inställningar kommer här...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BudgetCalculator;
