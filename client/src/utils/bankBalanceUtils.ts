import { ImportedTransaction } from '@/types/transaction';
import { updateAccountBalanceForMonth } from '@/orchestrator/budgetOrchestrator';

/**
 * Finds the bank balance for a given account and month using the exact same logic
 * that's already working in BudgetCalculator.tsx
 */
export function findBankBalanceForMonth(
  allTransactions: ImportedTransaction[], 
  accountId: string, 
  accountName: string, 
  monthKey: string
): { balance: number; date: string } | null {
  console.log(`🔍 [BANK BALANCE] Finding bank balance for account ${accountName} (${accountId}) in month ${monthKey}`);
  
  // Filter transactions for this account with balanceAfter data
  const accountTransactions = allTransactions.filter(tx => 
    tx.accountId === accountId && 
    tx.balanceAfter !== undefined && 
    tx.balanceAfter !== null
  );

  console.log(`🔍 [BANK BALANCE] Found ${accountTransactions.length} transactions with balanceAfter for account ${accountName} (${accountId})`);

  if (accountTransactions.length === 0) {
    console.log(`🔍 [BANK BALANCE] No transactions with balanceAfter found for account ${accountName}`);
    return null;
  }

  // Calculate previous month (we need to look in previous month to find bank balance for current month)
  const [year, month] = monthKey.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  console.log(`🔍 [BANK BALANCE] Looking for transactions in previous month ${prevMonthKey} to find bank balance for ${monthKey}`);

  // Filter transactions to previous month
  const prevMonthTransactions = accountTransactions.filter(tx => {
    const date = new Date(tx.date);
    const txMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return txMonthKey === prevMonthKey;
  });

  console.log(`🔍 [BANK BALANCE] Found ${prevMonthTransactions.length} transactions in previous month ${prevMonthKey}`);

  if (prevMonthTransactions.length === 0) {
    console.log(`🔍 [BANK BALANCE] No transactions found for account ${accountName} in previous month ${prevMonthKey}`);
    return null;
  }

  // Filter to transactions on or before the 24th day of the previous month
  const relevantTransactions = prevMonthTransactions.filter(tx => {
    const transactionDate = new Date(tx.date);
    const dayOfMonth = transactionDate.getDate();
    return dayOfMonth <= 24;
  });

  console.log(`🔍 [BANK BALANCE] Found ${relevantTransactions.length} relevant transactions (≤24th) in ${prevMonthKey}`);

  if (relevantTransactions.length === 0) {
    console.log(`🔍 [BANK BALANCE] No transactions found before 25th for account ${accountName} in month ${prevMonthKey}`);
    return null;
  }

  // Sort by date to find the latest transaction before 25th
  relevantTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestTransaction = relevantTransactions[0];

  console.log(`🔍 [BANK BALANCE] Found bank balance for ${accountName}: ${latestTransaction.balanceAfter} kr from transaction on ${latestTransaction.date} (for month ${monthKey})`);
  
  return {
    balance: latestTransaction.balanceAfter!,
    date: latestTransaction.date
  };
}

/**
 * Updates account balance for a specific month using bank balance data.
 * Uses the exact same logic that's already working in BudgetCalculator.tsx
 */
export function updateAccountBalanceFromBankData(
  allTransactions: ImportedTransaction[],
  accountId: string,
  accountName: string,
  monthKey: string
): boolean {
  console.log(`🔄 [BANK BALANCE] Attempting to update balance for ${accountName} in ${monthKey}`);
  
  const bankBalanceResult = findBankBalanceForMonth(allTransactions, accountId, accountName, monthKey);
  
  if (!bankBalanceResult) {
    console.log(`🔄 [BANK BALANCE] No bank balance found for ${accountName} in ${monthKey}, skipping update`);
    return false;
  }
  
  const { balance: bankBalance } = bankBalanceResult;
  
  console.log(`🔄 [BANK BALANCE] Updating balance for ${accountName} in ${monthKey} to ${bankBalance} kr`);
  
  // Use the existing function to update the account balance
  updateAccountBalanceForMonth(monthKey, accountName, bankBalance);
  
  // Dispatch event to notify UI about the balance update
  const balanceUpdateEvent = new CustomEvent('balanceUpdated', {
    detail: {
      accountName,
      newBalance: bankBalance,
      monthKey
    }
  });
  window.dispatchEvent(balanceUpdateEvent);
  
  console.log(`✅ [BANK BALANCE] Successfully updated balance for ${accountName} and dispatched event`);
  return true;
}