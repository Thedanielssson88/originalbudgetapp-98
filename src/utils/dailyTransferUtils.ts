import { SubCategory, Transaction } from '../types/budget';

/**
 * Räknar antalet överföringsdagar för en given månad baserat på valda veckodagar
 * Använder datumperiod från 25:e föregående månad till 24:e aktuell månad
 */
export const getNumberOfTransferDaysInMonth = (monthKey: string, transferDays: number[]): number => {
  const [year, month] = monthKey.split('-').map(Number);
  
  // Beräkna startdatum (25:e föregående månad)
  let startYear = year;
  let startMonth = month - 1;
  if (startMonth < 1) {
    startMonth = 12;
    startYear = year - 1;
  }
  const startDate = new Date(startYear, startMonth - 1, 25); // 25:e föregående månad
  
  // Beräkna slutdatum (24:e aktuell månad)
  const endDate = new Date(year, month - 1, 24); // 24:e aktuell månad
  
  let count = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay(); // 0 = Söndag, 1 = Måndag, etc.
    
    if (transferDays.includes(dayOfWeek)) {
      count++;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
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
 * Använder datumperiod från 25:e föregående månad till dagens datum
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
  
  // Beräkna startdatum (25:e föregående månad)
  let startYear = year;
  let startMonth = month - 1;
  if (startMonth < 1) {
    startMonth = 12;
    startYear = year - 1;
  }
  const startDate = new Date(startYear, startMonth - 1, 25);
  
  // Beräkna slutdatum (antingen idag eller 24:e aktuell månad, vad som är tidigare)
  const endOfPeriod = new Date(year, month - 1, 24);
  const endDate = today < endOfPeriod ? today : endOfPeriod;
  
  // Om dagens datum är före periodens början, returnera 0
  if (today < startDate) {
    return 0;
  }
  
  // Om dagens datum är efter periodens slut, returnera hela månadsbeloppet
  if (today > endOfPeriod) {
    return calculateMonthlyAmountForDailyTransfer(subcategory, monthKey);
  }
  
  let count = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    
    if (subcategory.transferDays.includes(dayOfWeek)) {
      count++;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return subcategory.dailyAmount * count;
};

/**
 * Beräknar faktiskt överfört belopp baserat på transaktioner
 * Använder datumperiod från 25:e föregående månad till 24:e aktuell månad
 */
export const calculateActualTransferred = (
  subcategory: SubCategory,
  transactions: Transaction[],
  monthKey: string
): number => {
  const [year, month] = monthKey.split('-').map(Number);
  
  // Beräkna startdatum (25:e föregående månad)
  let startYear = year;
  let startMonth = month - 1;
  if (startMonth < 1) {
    startMonth = 12;
    startYear = year - 1;
  }
  const startDate = new Date(startYear, startMonth - 1, 25);
  
  // Beräkna slutdatum (24:e aktuell månad)
  const endDate = new Date(year, month - 1, 24);
  
  // Filtrera transaktioner som matchar denna subcategory och är inom datumperioden
  const relevantTransactions = transactions.filter(t => {
    if (t.appSubCategoryId !== subcategory.id) return false;
    
    const transactionDate = new Date(t.date);
    return transactionDate >= startDate && transactionDate <= endDate;
  });
  
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