/**
 * OPTIMIZED CSV/XLSX IMPORT SYSTEM
 * Addresses the specific issues:
 * 1. CSV import should ONLY update transactions within the date range of the file for THAT account
 * 2. New accounts (like "Alicia") should work properly
 * 3. No unnecessary database fetching - uses already-loaded transaction data
 */

import { v4 as uuidv4 } from 'uuid';
import { ImportedTransaction } from '@/types/transaction';
import { Transaction } from '@/types/budget';
import { determineTransactionStatus } from '@/services/calculationService';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import { parseCSVContent } from './budgetOrchestrator';

/**
 * OPTIMIZED IMPORT FUNCTION
 * - Uses in-memory transaction data (no DB fetching)
 * - Only processes the specific account and date range
 * - Ensures account exists before importing
 * - Efficient targeted updates
 */
export async function optimizedImportAndReconcileFile(
  csvContent: string, 
  accountId: string, 
  accountName: string,
  existingTransactions: Transaction[]
): Promise<{success: boolean, stats: {created: number, updated: number, removed: number}}> {
  
  console.log(`🚀 [OPTIMIZED IMPORT] Starting optimized import for account: ${accountName} (${accountId})`);
  addMobileDebugLog(`🚀 OPTIMIZED: Starting import for ${accountName}`);
  
  // 1. FIRST: Ensure account exists in database
  try {
    const accountResponse = await fetch(`/api/accounts/${accountId}`);
    if (!accountResponse.ok) {
      console.log(`🆕 [OPTIMIZED IMPORT] Account ${accountName} doesn't exist, creating it...`);
      addMobileDebugLog(`🆕 Creating new account: ${accountName}`);
      
      // Create the account first
      const createResponse = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: accountId,
          name: accountName,
          type: 'checking'
        })
      });
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create account: ${createResponse.status}`);
      }
      
      console.log(`✅ [OPTIMIZED IMPORT] Account ${accountName} created successfully`);
      addMobileDebugLog(`✅ Account ${accountName} created`);
    } else {
      console.log(`✅ [OPTIMIZED IMPORT] Account ${accountName} already exists`);
    }
  } catch (error) {
    console.error(`❌ [OPTIMIZED IMPORT] Failed to verify/create account:`, error);
    addMobileDebugLog(`❌ Account verification failed: ${error instanceof Error ? error.message : String(error)}`);
    return {success: false, stats: {created: 0, updated: 0, removed: 0}};
  }
  
  // 2. Use the EXISTING parseCSVContent function from budgetOrchestrator
  console.log(`🔍 [OPTIMIZED IMPORT] Using parseCSVContent from budgetOrchestrator for ${accountName}...`);
  
  const newTransactions = parseCSVContent(csvContent, accountId, 'optimized-import');
  
  if (newTransactions.length === 0) {
    console.log(`⚠️ [OPTIMIZED IMPORT] No transactions found in CSV`);
    addMobileDebugLog(`⚠️ No transactions in CSV file`);
    return {success: false, stats: {created: 0, updated: 0, removed: 0}};
  }
  
  console.log(`📊 [OPTIMIZED IMPORT] Parsed ${newTransactions.length} transactions from CSV`);
  addMobileDebugLog(`📊 Parsed ${newTransactions.length} transactions`);
  
  // 3. Calculate date range of the CSV file
  const fileDates = newTransactions.map((t: ImportedTransaction) => t.date.split('T')[0]);
  const minDate = fileDates.reduce((min: string, date: string) => date < min ? date : min);
  const maxDate = fileDates.reduce((max: string, date: string) => date > max ? date : max);
  
  console.log(`📅 [OPTIMIZED IMPORT] CSV date range: ${minDate} to ${maxDate}`);
  addMobileDebugLog(`📅 CSV range: ${minDate} to ${maxDate}`);
  
  // 4. EFFICIENT FILTERING: Only work with transactions for this account
  const accountTransactions = existingTransactions.filter(t => t.accountId === accountId);
  console.log(`🎯 [OPTIMIZED IMPORT] Found ${accountTransactions.length} existing transactions for account ${accountName}`);
  
  // 5. Remove existing transactions ONLY within the CSV's date range for this account
  const transactionsToKeep = accountTransactions.filter((t: Transaction) => {
    const txDate = t.date.split('T')[0];
    const isInRange = txDate >= minDate && txDate <= maxDate;
    return !isInRange; // Keep transactions OUTSIDE the CSV date range
  });
  
  const transactionsToRemove = accountTransactions.filter((t: Transaction) => {
    const txDate = t.date.split('T')[0];
    return txDate >= minDate && txDate <= maxDate;
  });
  
  console.log(`🧹 [OPTIMIZED IMPORT] Will keep ${transactionsToKeep.length} existing transactions outside date range`);
  console.log(`🗑️ [OPTIMIZED IMPORT] Will remove ${transactionsToRemove.length} existing transactions in date range`);
  addMobileDebugLog(`🧹 Keep ${transactionsToKeep.length}, remove ${transactionsToRemove.length}`);
  
  // 6. Convert new CSV transactions to Transaction format
  const convertedNewTransactions: Transaction[] = newTransactions.map((tx: ImportedTransaction) => ({
    id: tx.id,
    accountId: tx.accountId,
    date: tx.date,
    amount: tx.amount,
    balanceAfter: tx.balanceAfter,
    description: tx.description,
    userDescription: tx.userDescription,
    bankCategory: tx.bankCategory,
    bankSubCategory: tx.bankSubCategory,
    type: tx.type,
    status: tx.status || determineTransactionStatus(tx),
    linkedTransactionId: tx.linkedTransactionId,
    correctedAmount: tx.correctedAmount,
    isManuallyChanged: tx.isManuallyChanged,
    appCategoryId: tx.appCategoryId,
    appSubCategoryId: tx.appSubCategoryId
  } as Transaction));
  
  // 7. Create final transaction list: All other accounts + this account's kept transactions + new CSV transactions
  const otherAccountTransactions = existingTransactions.filter(t => t.accountId !== accountId);
  const finalTransactionList = [
    ...otherAccountTransactions,
    ...transactionsToKeep,
    ...convertedNewTransactions
  ];
  
  console.log(`✅ [OPTIMIZED IMPORT] Final transaction list: ${finalTransactionList.length} total transactions`);
  console.log(`📊 [OPTIMIZED IMPORT] Stats: ${convertedNewTransactions.length} new, ${transactionsToRemove.length} replaced, ${otherAccountTransactions.length} from other accounts`);
  addMobileDebugLog(`✅ Final: ${finalTransactionList.length} total transactions`);
  
  // 8. Sync new transactions to database (only the CSV transactions)
  try {
    console.log(`🔄 [OPTIMIZED IMPORT] Syncing ${convertedNewTransactions.length} new transactions to database...`);
    
    const transactionsToSync = convertedNewTransactions.map(tx => ({
      id: tx.id,
      accountId: tx.accountId,
      date: tx.date,
      amount: Math.round(tx.amount),
      balanceAfter: Math.round(tx.balanceAfter || 0),
      description: tx.description,
      userDescription: tx.userDescription || '',
      bankCategory: tx.bankCategory || '',
      bankSubCategory: tx.bankSubCategory || '',
      type: tx.type || 'Transaction',
      status: tx.status || 'yellow',
      linkedTransactionId: tx.linkedTransactionId || null,
      correctedAmount: tx.correctedAmount ? Math.round(tx.correctedAmount) : null,
      isManuallyChanged: tx.isManuallyChanged ? 'true' : 'false',
      appCategoryId: tx.appCategoryId || null,
      appSubCategoryId: tx.appSubCategoryId || null,
      fileSource: 'optimized-import'
    }));
    
    // Use the existing synchronize endpoint
    const response = await fetch('/api/transactions/synchronize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactions: transactionsToSync
      })
    });
    
    if (!response.ok) {
      throw new Error(`Database sync failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ [OPTIMIZED IMPORT] Database sync complete:`, result.stats);
    addMobileDebugLog(`✅ DB sync: ${result.stats.created} created, ${result.stats.updated} updated`);
    
    return {
      success: true, 
      stats: {
        created: convertedNewTransactions.length,
        updated: 0, // This is new transactions, not updates
        removed: transactionsToRemove.length
      }
    };
    
  } catch (error) {
    console.error(`❌ [OPTIMIZED IMPORT] Database sync failed:`, error);
    addMobileDebugLog(`❌ DB sync failed: ${error}`);
    
    return {
      success: false, 
      stats: {
        created: 0,
        updated: 0, 
        removed: 0
      }
    };
  }
}