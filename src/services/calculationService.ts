// Calculation service - Pure calculation logic
// All functions here are "pure" - they don't manipulate state or localStorage
// They take data as input and return calculated results

import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addMonths, subMonths } from 'date-fns';
import { RawDataState, BudgetResults, MonthlyData, CalculatedState, AccountDataRow } from '../types/budget';

/**
 * Swedish holiday calculation
 */
export function getSwedishHolidays(year: number): Date[] {
  const holidays = [];
  
  // Fixed holidays
  holidays.push(new Date(year, 0, 1));   // New Year's Day
  holidays.push(new Date(year, 0, 6));   // Epiphany
  holidays.push(new Date(year, 4, 1));   // Labour Day
  holidays.push(new Date(year, 5, 6));   // National Day
  holidays.push(new Date(year, 11, 25)); // Christmas Day
  holidays.push(new Date(year, 11, 26)); // Boxing Day
  holidays.push(new Date(year, 11, 31)); // New Year's Eve
  
  // Calculate Easter Sunday for variable holidays
  const easter = getEasterSunday(year);
  holidays.push(addDays(easter, -2));  // Good Friday
  holidays.push(easter);               // Easter Sunday
  holidays.push(addDays(easter, 1));   // Easter Monday
  holidays.push(addDays(easter, 39));  // Ascension Day
  holidays.push(addDays(easter, 49));  // Whit Sunday
  holidays.push(addDays(easter, 50));  // Whit Monday
  
  // Midsummer's Eve (Friday between June 19-25)
  const midsummerStart = new Date(year, 5, 19);
  for (let i = 0; i < 7; i++) {
    const date = addDays(midsummerStart, i);
    if (date.getDay() === 5) { // Friday
      holidays.push(date);
      break;
    }
  }
  
  // All Saints' Day (Saturday between October 31 - November 6)
  const allSaintsStart = new Date(year, 9, 31);
  for (let i = 0; i < 7; i++) {
    const date = addDays(allSaintsStart, i);
    if (date.getDay() === 6) { // Saturday
      holidays.push(date);
      break;
    }
  }
  
  return holidays;
}

/**
 * Calculate Easter Sunday using the algorithm
 */
function getEasterSunday(year: number): Date {
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
  const n = Math.floor((h + l - 7 * m + 114) / 31);
  const p = (h + l - 7 * m + 114) % 31;
  
  return new Date(year, n - 1, p + 1);
}

/**
 * Calculate days and counts for budget period
 */
export function calculateDaysAndCounts(customHolidays: Array<{date: string, name: string}>): {
  daysUntil25th: number;
  weekdayCount: number;
  fridayCount: number;
  holidayDays: string[];
  holidaysUntil25th: string[];
  nextTenHolidays: string[];
  remainingWeekdayCount: number;
  remainingFridayCount: number;
} {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Get the 25th of current month
  const targetDate = new Date(currentYear, currentMonth, 25);
  
  // If we've passed the 25th, move to next month
  if (today.getDate() > 25) {
    targetDate.setMonth(targetDate.getMonth() + 1);
  }
  
  // Calculate days until 25th
  const daysUntil25th = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // Get all days from today until the 25th
  const daysInterval = eachDayOfInterval({ start: today, end: targetDate });
  
  // Get Swedish holidays for the relevant years
  const currentYearHolidays = getSwedishHolidays(currentYear);
  const nextYearHolidays = getSwedishHolidays(currentYear + 1);
  const allSwedishHolidays = [...currentYearHolidays, ...nextYearHolidays];
  
  // Convert custom holidays to Date objects
  const customHolidayDates = customHolidays.map(h => new Date(h.date));
  
  // Combine all holidays
  const allHolidays = [...allSwedishHolidays, ...customHolidayDates];
  
  // Find holidays until 25th
  const holidaysUntil25th = daysInterval
    .filter(day => allHolidays.some(holiday => 
      holiday.getDate() === day.getDate() && 
      holiday.getMonth() === day.getMonth() && 
      holiday.getFullYear() === day.getFullYear()
    ))
    .map(day => format(day, 'yyyy-MM-dd'));
  
  // Count weekdays and Fridays (excluding holidays and weekends)
  let weekdayCount = 0;
  let fridayCount = 0;
  let remainingWeekdayCount = 0;
  let remainingFridayCount = 0;
  
  daysInterval.forEach(day => {
    const isHoliday = allHolidays.some(holiday => 
      holiday.getDate() === day.getDate() && 
      holiday.getMonth() === day.getMonth() && 
      holiday.getFullYear() === day.getFullYear()
    );
    const isWeekendDay = isWeekend(day);
    
    if (!isHoliday && !isWeekendDay) {
      weekdayCount++;
      if (day >= today) {
        remainingWeekdayCount++;
      }
      
      if (day.getDay() === 5) { // Friday
        fridayCount++;
        if (day >= today) {
          remainingFridayCount++;
        }
      }
    }
  });
  
  // Get next ten holidays for display
  const futureHolidays = allHolidays
    .filter(holiday => holiday >= today)
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, 10)
    .map(holiday => format(holiday, 'yyyy-MM-dd'));
  
  return {
    daysUntil25th,
    weekdayCount,
    fridayCount,
    holidayDays: allHolidays.map(h => format(h, 'yyyy-MM-dd')),
    holidaysUntil25th,
    nextTenHolidays: futureHolidays,
    remainingWeekdayCount,
    remainingFridayCount,
  };
}

/**
 * Calculate budget results for current month based on raw data
 */
export function calculateBudgetResults(rawData: RawDataState, selectedMonth?: string): BudgetResults {
  // Use current month data or selected month data
  const monthKey = selectedMonth || format(new Date(), 'yyyy-MM');
  const monthData = rawData.historicalData[monthKey];
  
  // Use month-specific data if available, otherwise fall back to global defaults
  const andreasSalary = monthData?.andreasSalary ?? rawData.andreasSalary;
  const andreasForsakringskassan = monthData?.andreasForsakringskassan ?? rawData.andreasForsakringskassan;
  const andreasBarnbidrag = monthData?.andreasBarnbidrag ?? rawData.andreasBarnbidrag;
  const susannaSalary = monthData?.susannaSalary ?? rawData.susannaSalary;
  const susannaForsakringskassan = monthData?.susannaForsakringskassan ?? rawData.susannaForsakringskassan;
  const susannaBarnbidrag = monthData?.susannaBarnbidrag ?? rawData.susannaBarnbidrag;
  
  const costGroups = monthData?.costGroups ?? rawData.costGroups;
  const savingsGroups = monthData?.savingsGroups ?? rawData.savingsGroups;
  const dailyTransfer = monthData?.dailyTransfer ?? rawData.dailyTransfer;
  const weekendTransfer = monthData?.weekendTransfer ?? rawData.weekendTransfer;
  
  // Calculate totals
  const totalSalary = andreasSalary + andreasForsakringskassan + andreasBarnbidrag + 
                     susannaSalary + susannaForsakringskassan + susannaBarnbidrag;
  
  const totalMonthlyExpenses = costGroups.reduce((sum, group) => sum + group.amount, 0) +
                               savingsGroups.reduce((sum, group) => sum + group.amount, 0);
  
  // Calculate days and counts
  const daysInfo = calculateDaysAndCounts(rawData.customHolidays);
  
  // Calculate daily budget
  const totalDailyBudget = dailyTransfer * daysInfo.weekdayCount + weekendTransfer * daysInfo.fridayCount;
  const remainingDailyBudget = dailyTransfer * daysInfo.remainingWeekdayCount + weekendTransfer * daysInfo.remainingFridayCount;
  
  // Calculate remaining balance
  const balanceLeft = totalSalary - totalMonthlyExpenses - totalDailyBudget;
  
  // Calculate individual shares (50/50 split of remaining balance)
  const andreasShare = balanceLeft / 2;
  const susannaShare = balanceLeft / 2;
  
  // Calculate percentages (assuming equal contribution for now)
  const andreasPercentage = 50;
  const susannaPercentage = 50;
  
  // Calculate holiday days budget
  const holidayDaysBudget = daysInfo.holidaysUntil25th.length * dailyTransfer;
  
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
    daysUntil25th: daysInfo.daysUntil25th,
    weekdayCount: daysInfo.weekdayCount,
    fridayCount: daysInfo.fridayCount,
    totalMonthlyExpenses,
    holidayDays: daysInfo.holidayDays,
    holidaysUntil25th: daysInfo.holidaysUntil25th,
    nextTenHolidays: daysInfo.nextTenHolidays,
    remainingWeekdayCount: daysInfo.remainingWeekdayCount,
    remainingFridayCount: daysInfo.remainingFridayCount,
  };
}

/**
 * Calculate full prognosis for all months
 * This is the main calculation function that replaces all individual get-functions
 */
export function calculateFullPrognosis(rawData: RawDataState): CalculatedState {
  const monthlyResults: {[monthKey: string]: BudgetResults} = {};
  const accountSummaries: {[monthKey: string]: {[accountName: string]: number}} = {};
  
  // Calculate results for all months in historical data
  Object.keys(rawData.historicalData).forEach(monthKey => {
    monthlyResults[monthKey] = calculateBudgetResults(rawData, monthKey);
    
    // Calculate account summaries for this month
    const monthData = rawData.historicalData[monthKey];
    const summary: {[accountName: string]: number} = {};
    
    rawData.accounts.forEach(account => {
      summary[account] = monthData.accountBalances?.[account] || 0;
    });
    
    accountSummaries[monthKey] = summary;
  });
  
  // Also calculate for current month if not in historical data
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  if (!monthlyResults[currentMonthKey]) {
    monthlyResults[currentMonthKey] = calculateBudgetResults(rawData, currentMonthKey);
  }
  
  // Generate chart data
  const chartData = generateChartData(rawData, accountSummaries);
  
  // Generate account data rows for table
  const accountDataRows = generateAccountDataRows(rawData, accountSummaries);
  
  return {
    monthlyResults,
    accountSummaries,
    chartData,
    accountDataRows
  };
}

/**
 * Generate chart data for visualization
 */
function generateChartData(rawData: RawDataState, accountSummaries: {[monthKey: string]: {[accountName: string]: number}}): any[] {
  const chartData: any[] = [];
  const monthKeys = Object.keys(accountSummaries).sort();
  
  monthKeys.forEach(monthKey => {
    const [year, month] = monthKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    
    const dataPoint: any = {
      month: `${monthNames[parseInt(month) - 1]} ${year}`,
      monthKey,
    };
    
    // Add account data
    rawData.accounts.forEach(account => {
      dataPoint[account] = accountSummaries[monthKey][account] || 0;
    });
    
    chartData.push(dataPoint);
  });
  
  return chartData;
}

/**
 * Generate account data rows for the data table
 */
function generateAccountDataRows(rawData: RawDataState, accountSummaries: {[monthKey: string]: {[accountName: string]: number}}): AccountDataRow[] {
  const rows: AccountDataRow[] = [];
  const allMonthKeys = Object.keys(rawData.historicalData).sort();
  
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
      displayYear = currentYear - 1;
      displayMonth = 12;
    } else {
      displayYear = currentYear;
      displayMonth = currentMonth - 1;
    }
    
    const displayMonthName = monthNames[displayMonth - 1];
    
    rawData.accounts.forEach(account => {
      const monthData = rawData.historicalData[monthKey];
      const hasActualBalance = monthData?.accountBalancesSet && 
                              monthData.accountBalancesSet[account] === true;
      const currentBalance = monthData?.accountBalances?.[account] || 0;
      
      // Calculate estimated opening balance if actual is not set
      let balance = currentBalance;
      let isEstimated = !hasActualBalance;
      
      if (!hasActualBalance) {
        // Get estimated opening balance from previous month's ending balance
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
        const prevMonthData = rawData.historicalData[prevMonthKey];
        
        if (prevMonthData) {
          const endingBalanceKey = `${account}.${prevYear}.${String(prevMonth).padStart(2, '0')}.Endbalance`;
          balance = prevMonthData.accountEndingBalances?.[endingBalanceKey] || 
                   prevMonthData.accountEstimatedFinalBalances?.[account] || 
                   prevMonthData.accountBalances?.[account] || 0;
        }
      }
      
      const calcDescr = isEstimated ? "(Est)" : "";
      
      rows.push({
        year: displayYear,
        month: displayMonthName,
        monthKey,
        account,
        calcKontosaldo: balance,
        calcDescr
      });
    });
  });
  
  return rows;
}

/**
 * Calculate estimated account balances for a specific month
 */
export function calculateEstimatedAccountBalances(
  rawData: RawDataState, 
  monthKey: string, 
  results: BudgetResults
): {[account: string]: number} {
  const estimatedBalances: {[account: string]: number} = {};
  const monthData = rawData.historicalData[monthKey];
  
  if (!monthData) return estimatedBalances;
  
  rawData.accounts.forEach(account => {
    // Start with current account balance
    const currentBalance = monthData.accountBalances?.[account] || 0;
    
    // Add estimated changes based on budget allocations
    let estimatedChange = 0;
    
    // Add income allocated to this account
    // Add costs allocated to this account
    // Add savings allocated to this account
    // This would need more detailed logic based on account allocations
    
    estimatedBalances[account] = currentBalance + estimatedChange;
  });
  
  return estimatedBalances;
}