// Innehåller all ren beräkningslogik.
import { RawDataState, CalculatedState, BudgetResults, MonthData, Account, BudgetItem, BudgetState, Transaction } from '../types/budget';
import { calculateMonthlyAmountForDailyTransfer } from '../utils/dailyTransferUtils';

/**
 * Beräknar totala budgeterade kostnader för en given månad
 */
export function calculateTotalBudgetedCosts(costItems: BudgetItem[], monthKey: string): number {
  if (!costItems) return 0;
  
  return costItems.reduce((sum, item) => {
    if (item.transferType === 'daily' && item.dailyAmount && item.transferDays) {
      // Konvertera BudgetItem till format som dagliga överföringsutils förväntar sig
      const subCategoryForCalculation = {
        ...item,
        name: item.description // BudgetItem har description istället för name
      };
      return sum + calculateMonthlyAmountForDailyTransfer(subCategoryForCalculation, monthKey);
    }
    return sum + item.amount;
  }, 0);
}

/**
 * Beräknar totalt budgeterat sparande för en given månad
 */
export function calculateTotalBudgetedSavings(savingsItems: BudgetItem[], monthKey: string): number {
  if (!savingsItems) return 0;

  // Lägg till logik för sparmål här om det behövs
  return savingsItems.reduce((sum, item) => sum + item.amount, 0);
}

/**
 * Beräknar totala inkomster för en månad
 */
export function calculateTotalIncome(monthData: MonthData): number {
  if (!monthData) return 0;
  
  // Summera alla relevanta inkomstfält från rådatan
  const total = 
    (monthData.andreasSalary || 0) +
    (monthData.andreasförsäkringskassan || 0) +
    (monthData.andreasbarnbidrag || 0) +
    (monthData.susannaSalary || 0) +
    (monthData.susannaförsäkringskassan || 0) +
    (monthData.susannabarnbidrag || 0);
    
  return total;
}

/**
 * Beräknar "Balans Kvar" - totala inkomster minus totala kostnader och sparande
 */
export function calculateBalanceLeft(
  monthData: MonthData, 
  monthKey: string
): number {
  if (!monthData) return 0;

  const totalIncome = calculateTotalIncome(monthData);
  const totalCosts = calculateTotalBudgetedCosts(monthData.costItems, monthKey);
  const totalSavings = calculateTotalBudgetedSavings(monthData.savingsItems, monthKey);
  
  return totalIncome - totalCosts - totalSavings;
}

/**
 * Calculate account end balances from the next month's account balances
 * This replaces the stored accountEndBalances with a calculated value
 */
export function calculateAccountEndBalances(
  historicalData: { [monthKey: string]: MonthData },
  currentMonthKey: string,
  accounts: Account[]
): { [accountName: string]: number } {
  const accountNames = accounts.map(acc => acc.name);
  const endBalances: { [accountName: string]: number } = {};
  
  // Get next month key
  const [year, month] = currentMonthKey.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  
  // Get next month's data
  const nextMonthData = historicalData[nextMonthKey];
  
  accountNames.forEach(accountName => {
    if (nextMonthData?.accountBalances?.[accountName] !== undefined) {
      // Use next month's account balance as this month's end balance
      endBalances[accountName] = nextMonthData.accountBalances[accountName];
    } else {
      // No next month data available, use 0 as default
      endBalances[accountName] = 0;
    }
  });
  
  return endBalances;
}

/**
 * Beräknar den fullständiga finansiella prognosen över en serie månader.
 * Denna funktion är ren och muterar inte originaldata.
 * Respekterar manuellt inmatade saldon i accountBalances.
 */
export function calculateFullPrognosis(
  historicalData: { [monthKey: string]: MonthData },
  accounts: Account[]
) {
  console.log('[Calculator] Påbörjar full omberäkning av estimerade saldon...');
  
  const historicalMonths = Object.keys(historicalData).sort((a, b) => a.localeCompare(b));
  const accountNames = accounts.map(acc => acc.name);

  if (!historicalMonths.length || !accountNames.length) {
    return { estimatedStartBalancesByMonth: {}, estimatedFinalBalancesByMonth: {} };
  }

  const estimatedStartBalancesByMonth: { [monthKey: string]: { [acc: string]: number } } = {};
  const estimatedFinalBalancesByMonth: { [monthKey: string]: { [acc: string]: number } } = {};
  
  // Håll koll på löpande balans för varje konto
  const runningBalances: { [acc: string]: number } = {};

  // Initiera löpande balans från första månadens data
  const firstMonthKey = historicalMonths[0];
  const firstMonthData = historicalData[firstMonthKey];
  accountNames.forEach(accountName => {
    if (firstMonthData.accountBalancesSet?.[accountName]) {
      runningBalances[accountName] = firstMonthData.accountBalances?.[accountName] || 0;
    } else {
      runningBalances[accountName] = 0;
    }
  });

  historicalMonths.forEach(monthKey => {
    const monthData = historicalData[monthKey];
    const startBalancesForThisMonth: { [acc: string]: number } = {};
    const finalBalancesForThisMonth: { [acc: string]: number } = {};

    accountNames.forEach(accountName => {
      // KRITISK KONTROLL: Finns manuellt angivet STARTBALANS?
      if (monthData?.accountBalancesSet?.[accountName]) {
        // Använd det manuella värdet som STARTBALANS
        startBalancesForThisMonth[accountName] = monthData.accountBalances?.[accountName] || 0;
        console.log(`[Calculator] ${monthKey} ${accountName}: Använder manuell startbalans ${startBalancesForThisMonth[accountName]} istället för löpande ${runningBalances[accountName]}`);
      } else {
        // Sätt startbalans från löpande balans
        startBalancesForThisMonth[accountName] = runningBalances[accountName];
        console.log(`[Calculator] ${monthKey} ${accountName}: Använder löpande startbalans ${startBalancesForThisMonth[accountName]}`);
      }

      // Beräkna slutsaldo baserat på startbalans + transaktioner
      const savingsForAccount = monthData?.savingsGroups?.filter((group: any) => group.account === accountName) || [];
      const totalDeposits = savingsForAccount.reduce((sum: number, group: any) => {
        const subCategoriesSum = group.subCategories?.reduce((subSum: number, sub: any) => subSum + (sub.amount || 0), 0) || 0;
        return sum + (group.amount || 0) + subCategoriesSum;
      }, 0);
      
      const costsForAccount = monthData?.costGroups?.filter((group: any) => group.account === accountName) || [];
      const totalCostDeposits = costsForAccount.reduce((sum: number, group: any) => sum + (group.amount || 0), 0);
      
      const allCostItems = monthData?.costGroups?.reduce((items: any[], group: any) => {
        const groupCosts = group.subCategories?.filter((sub: any) => 
          sub.account === accountName && sub.financedFrom === 'Enskild kostnad'
        ) || [];
        return items.concat(groupCosts);
      }, []) || [];
      const totalAllCosts = allCostItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
      
      // Beräkna slutsaldo från startbalans
      const finalBalanceToShow = startBalancesForThisMonth[accountName] + totalDeposits + totalCostDeposits - totalAllCosts;
      console.log(`[Calculator] ${monthKey} ${accountName}: Beräknar slutsaldo ${finalBalanceToShow} (start: ${startBalancesForThisMonth[accountName]} + insättningar: ${totalDeposits + totalCostDeposits} - kostnader: ${totalAllCosts})`);

      finalBalancesForThisMonth[accountName] = finalBalanceToShow;
      
      // Uppdatera löpande balans för nästa månad
      runningBalances[accountName] = finalBalanceToShow;
      console.log(`[Calculator] ${monthKey} ${accountName}: Uppdaterar runningBalance till ${finalBalanceToShow} för nästa månad`);
    });

    estimatedStartBalancesByMonth[monthKey] = startBalancesForThisMonth;
    estimatedFinalBalancesByMonth[monthKey] = finalBalancesForThisMonth;
  });

  return { estimatedStartBalancesByMonth, estimatedFinalBalancesByMonth };
}

export function calculateBudgetResults(monthData: MonthData): BudgetResults {
  const {
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
  } = monthData;

  // Calculate total salary
  const totalSalary = andreasSalary + andreasförsäkringskassan + andreasbarnbidrag + 
                     susannaSalary + susannaförsäkringskassan + susannabarnbidrag;

  // Calculate total monthly expenses
  const totalMonthlyCosts = costGroups.reduce((total, group) => total + group.amount, 0);
  const totalMonthlySavings = savingsGroups.reduce((total, group) => total + group.amount, 0);
  const totalMonthlyExpenses = totalMonthlyCosts + totalMonthlySavings;

  // Calculate balance left
  const balanceLeft = totalSalary - totalMonthlyExpenses;

  // Calculate individual shares
  const andreasTotal = andreasSalary + andreasförsäkringskassan + andreasbarnbidrag;
  const susannaTotal = susannaSalary + susannaförsäkringskassan + susannabarnbidrag;
  
  const andreasPercentage = totalSalary > 0 ? (andreasTotal / totalSalary) * 100 : 50;
  const susannaPercentage = totalSalary > 0 ? (susannaTotal / totalSalary) * 100 : 50;
  
  const andreasShare = Math.round(balanceLeft * (andreasPercentage / 100));
  const susannaShare = Math.round(balanceLeft * (susannaPercentage / 100));

  // Calculate days and holiday information
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Get target month (current or next based on day)
  let targetMonth = currentMonth;
  let targetYear = currentYear;
  
  if (currentDay > 24) {
    targetMonth++;
    if (targetMonth === 12) {
      targetMonth = 0;
      targetYear++;
    }
  }

  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const daysUntil25th = currentDay <= 24 ? 25 - currentDay : (daysInMonth - currentDay) + 25;

  // Calculate holidays and working days
  const holidayDays = getHolidaysInMonth(targetYear, targetMonth, customHolidays);
  const holidaysUntil25th = holidayDays.filter(date => {
    const day = new Date(date).getDate();
    return day <= 25;
  });

  const weekdayCount = getWeekdayCount(targetYear, targetMonth);
  const fridayCount = getFridayCount(targetYear, targetMonth);
  
  const remainingWeekdayCount = getRemainingWeekdayCount(targetYear, targetMonth, currentDay <= 24 ? currentDay : 1);
  const remainingFridayCount = getRemainingFridayCount(targetYear, targetMonth, currentDay <= 24 ? currentDay : 1);

  // Calculate daily budgets
  const totalDailyBudget = dailyTransfer * remainingWeekdayCount + weekendTransfer * remainingFridayCount;
  const remainingDailyBudget = totalDailyBudget;
  const holidayDaysBudget = holidaysUntil25th.length * weekendTransfer;

  const nextTenHolidays = getNextTenHolidays(currentDate, customHolidays);

  return {
    totalSalary,
    totalDailyBudget,
    remainingDailyBudget,
    holidayDaysBudget,
    // balanceLeft removed - calculated on-demand with calculateBalanceLeft
    susannaShare,
    andreasShare,
    susannaPercentage,
    andreasPercentage,
    daysUntil25th,
    weekdayCount,
    fridayCount,
    // totalMonthlyExpenses removed - calculated on-demand
    holidayDays,
    holidaysUntil25th,
    nextTenHolidays,
    remainingWeekdayCount,
    remainingFridayCount
  };
}

export function calculateAccountProgression(
  historicalData: { [monthKey: string]: MonthData },
  accounts: Account[]
) {
  // Implement account progression logic
  return {};
}

export function calculateMonthlyBreakdowns(
  historicalData: { [monthKey: string]: MonthData },
  accounts: Account[]
) {
  // Implement monthly breakdown logic
  return {};
}

export function calculateProjectedBalances(
  historicalData: { [monthKey: string]: MonthData },
  accounts: Account[]
) {
  // Implement projected balance logic
  return {};
}

// Helper functions for date calculations
function getHolidaysInMonth(year: number, month: number, customHolidays: {date: string, name: string}[]): string[] {
  const holidays = [];
  
  // Get Swedish holidays for the year
  const swedishHolidays = getSwedishHolidays(year);
  
  // Filter holidays for the specific month
  swedishHolidays.forEach(holiday => {
    if (holiday.getMonth() === month) {
      holidays.push(holiday.toISOString().split('T')[0]);
    }
  });
  
  // Add custom holidays for the specific month
  customHolidays.forEach(holiday => {
    const holidayDate = new Date(holiday.date);
    if (holidayDate.getFullYear() === year && holidayDate.getMonth() === month) {
      holidays.push(holiday.date);
    }
  });
  
  return holidays;
}

function getSwedishHolidays(year: number): Date[] {
  const holidays = [];
  
  // Fixed holidays
  holidays.push(new Date(year, 0, 1));   // New Year's Day
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
}

function calculateEaster(year: number): Date {
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
}

function getMidsummerEve(year: number): Date {
  // Friday between June 19-25
  for (let day = 19; day <= 25; day++) {
    const date = new Date(year, 5, day); // June
    if (date.getDay() === 5) { // Friday
      return date;
    }
  }
  return new Date(year, 5, 24); // Fallback
}

function getAllSaintsDay(year: number): Date {
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
}

function getWeekdayCount(year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let weekdayCount = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Monday to Thursday
      weekdayCount++;
    }
  }
  
  return weekdayCount;
}

function getFridayCount(year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let fridayCount = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 5) { // Friday
      fridayCount++;
    }
  }
  
  return fridayCount;
}

function getRemainingWeekdayCount(year: number, month: number, fromDay: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let weekdayCount = 0;
  
  for (let day = fromDay; day <= Math.min(25, daysInMonth); day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Monday to Thursday
      weekdayCount++;
    }
  }
  
  return weekdayCount;
}

function getRemainingFridayCount(year: number, month: number, fromDay: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let fridayCount = 0;
  
  for (let day = fromDay; day <= Math.min(25, daysInMonth); day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 5) { // Friday
      fridayCount++;
    }
  }
  
  return fridayCount;
}

function getNextTenHolidays(fromDate: Date, customHolidays: {date: string, name: string}[]): string[] {
  const holidays = [];
  const currentYear = fromDate.getFullYear();
  
  // Get holidays for current and next year
  for (let year = currentYear; year <= currentYear + 1; year++) {
    const yearHolidays = getSwedishHolidays(year);
    yearHolidays.forEach(holiday => {
      if (holiday >= fromDate) {
        holidays.push(holiday.toISOString().split('T')[0]);
      }
    });
    
    // Add custom holidays
    customHolidays.forEach(holiday => {
      const holidayDate = new Date(holiday.date);
      if (holidayDate.getFullYear() === year && holidayDate >= fromDate) {
        holidays.push(holiday.date);
      }
    });
  }
  
  // Sort and return first 10
  return holidays.sort().slice(0, 10);
}

/**
 * Get transactions for a specific month period (25th of previous month to 24th of current month)
 */
export function getTransactionsForPeriod(
  historicalData: { [monthKey: string]: MonthData },
  selectedMonthKey: string
): any[] {
  console.log(`[getTransactionsForPeriod] Looking for transactions in period for month: ${selectedMonthKey}`);
  console.log(`[getTransactionsForPeriod] FORCED DEBUG - Starting transaction search...`);
  
  // UPDATED LOGIC: Simply get transactions from the selectedMonthKey
  // This matches our new import logic where transactions are grouped by budget month
  const monthData = historicalData[selectedMonthKey];
  
  if (!monthData || !monthData.transactions) {
    console.log(`[getTransactionsForPeriod] No transactions found for month ${selectedMonthKey}`);
    return [];
  }
  
  const transactions = monthData.transactions || [];
  console.log(`[getTransactionsForPeriod] Found ${transactions.length} transactions for budget month ${selectedMonthKey}`);
  console.log(`[getTransactionsForPeriod] Sample transactions:`, transactions.slice(0, 3).map(t => ({ 
    id: t.id, 
    accountId: t.accountId, 
    date: t.date, 
    amount: t.amount,
    description: t.description
  })));
  
  return transactions;
}

// NEW: Central date logic for payday-based months
export function getDateRangeForMonth(monthKey: string, payday: number): { startDate: Date, endDate: Date } {
  const [year, month] = monthKey.split('-').map(Number);

  if (payday === 1) {
    // Calendar month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day, last millisecond
    return { startDate, endDate };
  } else {
    // Payday month (e.g., 25th to 24th)
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    
    const startDate = new Date(prevYear, prevMonth - 1, payday);
    const endDate = new Date(year, month - 1, payday - 1, 23, 59, 59, 999);
    return { startDate, endDate };
  }
}

// NEW: Central business logic function that replaces the complex useMemo in BudgetCalculator
export function getProcessedBudgetDataForMonth(budgetState: any, selectedMonthKey: string) {
  // 1. Get the correct date range
  const payday = budgetState.settings?.payday || 25;
  const { startDate, endDate } = getDateRangeForMonth(selectedMonthKey, payday);
  
  // 2. Get all relevant raw data
  const allTransactions = Object.values(budgetState.historicalData).flatMap((m: any) => m.transactions || []);
  const currentMonthData = budgetState.historicalData[selectedMonthKey] || {};
  
  // FIXED: Convert costGroups to flat costItems array
  const costGroups = currentMonthData.costGroups || [];
  const costItems = costGroups.flatMap((group: any) => 
    (group.subCategories || []).map((sub: any) => ({
      ...sub,
      mainCategoryId: group.name,  // Use group name as main category
      groupId: group.id
    }))
  );
  
  // FIXED: Convert savingsGroups to flat savingsItems array  
  const savingsGroups = currentMonthData.savingsGroups || [];
  const savingsItems = savingsGroups.flatMap((group: any) => 
    (group.subCategories || []).map((sub: any) => ({
      ...sub,
      mainCategoryId: group.name,  // Use group name as main category
      groupId: group.id
    }))
  );
  
  const budgetItems = [...costItems, ...savingsItems];
  
  // 3. Filter transactions based on the new, correct date range
  const transactionsForPeriod = allTransactions.filter((t: any) => {
    const transactionDate = new Date(t.date);
    return transactionDate >= startDate && transactionDate <= endDate;
  });

  // 4. MOVE THE LOGIC from activeContent (useMemo in BudgetCalculator)
  // Find active accounts and categories
  const activeAccountIds = new Set<string>();
  budgetItems.forEach((item: any) => item.accountId && activeAccountIds.add(item.accountId));
  transactionsForPeriod.forEach((t: any) => t.accountId && activeAccountIds.add(t.accountId));
  
  const activeMainCategoryIds = new Set<string>();
  // Process budget items for main categories
  budgetItems.forEach((item: any) => {
    if (item.mainCategoryId) {
      activeMainCategoryIds.add(item.mainCategoryId);
    }
  });
  
  // Process transactions for main categories  
  transactionsForPeriod.forEach((t: any) => {
    if (t.appCategoryId) {
      activeMainCategoryIds.add(t.appCategoryId);
    }
  });

  const activeAccounts = budgetState.accounts.filter((acc: any) => activeAccountIds.has(acc.id));
  // FIXED: Always return all main categories for adding new items, not just ones with transactions
  const activeCategories = budgetState.mainCategories || [];
  
  // 5. Return a single, complete object with all data the UI needs
  return {
    activeAccounts,
    activeCategories,
    transactionsForPeriod,
    budgetItems: {
      costItems: costItems,
      savingsItems: savingsItems,
      all: budgetItems  // Keep the combined array for backward compatibility
    },
    dateRange: { startDate, endDate },
    costItems,
    savingsItems
  };
}

// ============= INTERNAL TRANSFERS ANALYSIS =============

export interface TransferSummary {
  accountId: string;
  accountName: string;
  totalIn: number;
  totalOut: number;
  incomingTransfers: { fromAccountName: string; amount: number; linked: boolean; transaction: Transaction }[];
  outgoingTransfers: { toAccountName: string; amount: number; linked: boolean; transaction: Transaction }[];
}

export function getInternalTransferSummary(
  budgetState: BudgetState, 
  selectedMonthKey: string
): TransferSummary[] {
  console.log('🔍 [INTERNAL TRANSFERS CALCULATION] Starting calculation', {
    selectedMonthKey,
    paydaySetting: budgetState.settings?.payday || 25,
    accountsCount: budgetState.accounts.length,
    historicalDataKeys: Object.keys(budgetState.historicalData)
  });

  // 1. Hämta det korrekta datumintervallet baserat på payday-inställningen
  const { startDate, endDate } = getDateRangeForMonth(selectedMonthKey, budgetState.settings?.payday || 25);
  const allTransactions = Object.values(budgetState.historicalData).flatMap(m => m.transactions || []);
  
  console.log('🔍 [INTERNAL TRANSFERS CALCULATION] Date range and transactions', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    totalTransactions: allTransactions.length,
    internalTransferTransactions: allTransactions.filter(t => t.type === 'InternalTransfer').length
  });
  
  // 2. Filtrera ut alla interna överföringar inom den korrekta perioden
  const transfersForPeriod = allTransactions.filter(t => {
    const transactionDate = new Date(t.date);
    return t.type === 'InternalTransfer' && transactionDate >= startDate && transactionDate <= endDate;
  });

  console.log('🔍 [INTERNAL TRANSFERS CALCULATION] Filtered transfers', {
    transfersForPeriod: transfersForPeriod.length,
    transfers: transfersForPeriod
  });

  const allAccounts = budgetState.accounts;

  // 3. Gå igenom varje konto och bygg upp en sammanställning
  const result = allAccounts.map(account => {
    const summary: TransferSummary = {
      accountId: account.id,
      accountName: account.name,
      totalIn: 0,
      totalOut: 0,
      incomingTransfers: [],
      outgoingTransfers: []
    };

    // Hitta alla överföringar som rör detta konto
    transfersForPeriod.forEach(t => {
      // Om det är en inkommande överföring TILL detta konto
      if (t.accountId === account.id && t.amount > 0) {
        summary.totalIn += t.amount;
        const linkedTx = t.linkedTransactionId ? transfersForPeriod.find(tx => tx.id === t.linkedTransactionId) : undefined;
        const fromAccount = linkedTx ? allAccounts.find(acc => acc.id === linkedTx.accountId) : undefined;
        summary.incomingTransfers.push({
          fromAccountName: fromAccount?.name || 'Okänt konto',
          amount: t.amount,
          linked: !!t.linkedTransactionId,
          transaction: t
        });
      }
      // Om det är en utgående överföring FRÅN detta konto
      else if (t.accountId === account.id && t.amount < 0) {
        summary.totalOut += Math.abs(t.amount);
        const linkedTx = t.linkedTransactionId ? transfersForPeriod.find(tx => tx.id === t.linkedTransactionId) : undefined;
        const toAccount = linkedTx ? allAccounts.find(acc => acc.id === linkedTx.accountId) : undefined;
        summary.outgoingTransfers.push({
          toAccountName: toAccount?.name || 'Okänt konto',
          amount: Math.abs(t.amount),
          linked: !!t.linkedTransactionId,
          transaction: t
        });
      }
    });
    return summary;
  }).filter(s => s.totalIn > 0 || s.totalOut > 0); // Visa bara konton med överföringar
  
  console.log('🔍 [INTERNAL TRANSFERS CALCULATION] Final result', {
    summariesWithTransfers: result.length,
    result
  });
  
  return result;
}