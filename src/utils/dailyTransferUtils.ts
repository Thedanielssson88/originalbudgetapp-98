import { SubCategory, Transaction } from '../types/budget';

/**
 * Räknar antalet överföringsdagar för en given månad baserat på valda veckodagar
 */
export const getNumberOfTransferDaysInMonth = (monthKey: string, transferDays: number[]): number => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1); // month - 1 eftersom Date använder 0-indexerade månader
  const daysInMonth = new Date(year, month, 0).getDate();
  
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month - 1, day);
    const dayOfWeek = currentDate.getDay(); // 0 = Söndag, 1 = Måndag, etc.
    
    if (transferDays.includes(dayOfWeek)) {
      count++;
    }
  }
  
  return count;
};

/**
 * Beräknar det totala månadsbeloppet för en daglig överföring
 */
export const calculateMonthlyAmountForDailyTransfer = (
  subcategory: SubCategory, 
  monthKey: string
): number => {
  if (subcategory.transferType !== 'daily' || !subcategory.dailyAmount || !subcategory.transferDays) {
    return subcategory.amount;
  }
  
  const transferDaysCount = getNumberOfTransferDaysInMonth(monthKey, subcategory.transferDays);
  return subcategory.dailyAmount * transferDaysCount;
};

/**
 * Beräknar estimerat belopp fram till idag för en daglig överföring
 */
export const calculateEstimatedToDate = (
  subcategory: SubCategory, 
  monthKey: string
): number => {
  if (subcategory.transferType !== 'daily' || !subcategory.dailyAmount || !subcategory.transferDays) {
    return subcategory.amount;
  }
  
  const [year, month] = monthKey.split('-').map(Number);
  const today = new Date();
  const currentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
  
  if (!currentMonth) {
    // Om det inte är aktuell månad, returnera hela månadsbeloppet
    return calculateMonthlyAmountForDailyTransfer(subcategory, monthKey);
  }
  
  const todayDate = today.getDate();
  let count = 0;
  
  for (let day = 1; day <= todayDate; day++) {
    const currentDate = new Date(year, month - 1, day);
    const dayOfWeek = currentDate.getDay();
    
    if (subcategory.transferDays.includes(dayOfWeek)) {
      count++;
    }
  }
  
  return subcategory.dailyAmount * count;
};

/**
 * Beräknar faktiskt överfört belopp baserat på transaktioner
 */
export const calculateActualTransferred = (
  subcategory: SubCategory,
  transactions: Transaction[],
  monthKey: string
): number => {
  // Filtrera transaktioner som matchar denna subcategory
  const relevantTransactions = transactions.filter(t => 
    t.appSubCategoryId === subcategory.id && 
    t.date.startsWith(monthKey)
  );
  
  return relevantTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
};

/**
 * Beräknar differens mellan estimerat och faktiskt
 */
export const calculateDifference = (
  subcategory: SubCategory,
  transactions: Transaction[],
  monthKey: string
): number => {
  const estimated = calculateEstimatedToDate(subcategory, monthKey);
  const actual = calculateActualTransferred(subcategory, transactions, monthKey);
  return actual - estimated;
};

/**
 * Beräknar estimerat kvarvarande belopp att överföra
 */
export const calculateRemaining = (
  subcategory: SubCategory,
  monthKey: string
): number => {
  if (subcategory.transferType !== 'daily' || !subcategory.dailyAmount || !subcategory.transferDays) {
    return 0;
  }
  
  const totalMonthlyAmount = calculateMonthlyAmountForDailyTransfer(subcategory, monthKey);
  const estimatedToDate = calculateEstimatedToDate(subcategory, monthKey);
  
  return Math.max(0, totalMonthlyAmount - estimatedToDate);
};

/**
 * Formaterar veckodagar för visning
 */
export const formatTransferDays = (transferDays: number[]): string => {
  const dayNames = {
    0: 'Sön', 1: 'Mån', 2: 'Tis', 3: 'Ons', 
    4: 'Tor', 5: 'Fre', 6: 'Lör'
  };
  
  return transferDays
    .sort()
    .map(day => dayNames[day as keyof typeof dayNames])
    .join(', ');
};