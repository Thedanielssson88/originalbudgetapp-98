// Innehåller all ren beräkningslogik.
import { RawDataState, CalculatedState, BudgetResults, MonthData, Account } from '../types/budget';

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
    balanceLeft,
    susannaShare,
    andreasShare,
    susannaPercentage,
    andreasPercentage,
    daysUntil25th,
    weekdayCount,
    fridayCount,
    totalMonthlyExpenses,
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
  const allTransactions: any[] = [];
  
  // Parse the selected month
  const [year, month] = selectedMonthKey.split('-').map(Number);
  
  // Calculate period: 25th of previous month to 24th of current month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  
  const periodStart = new Date(prevYear, prevMonth - 1, 25); // 25th of previous month
  const periodEnd = new Date(year, month - 1, 24); // 24th of current month
  
  // Go through all months and collect transactions within the period
  Object.values(historicalData).forEach(monthData => {
    if (monthData.transactions) {
      monthData.transactions.forEach(transaction => {
        const transactionDate = new Date(transaction.date);
        if (transactionDate >= periodStart && transactionDate <= periodEnd) {
          allTransactions.push(transaction);
        }
      });
    }
  });
  
  return allTransactions;
}