/**
 * IMPROVED CSV/XLSX IMPORT SYSTEM
 * 
 * Key Features:
 * 1. Matches transactions by Datum+Beskrivning+Amount+Saldo (not ID)
 * 2. Updates existing transactions while preserving manual changes
 * 3. Applies category rules from Regelmotor
 * 4. Only affects the selected account within date range
 * 5. Real-time UI updates after import
 */

import { v4 as uuidv4 } from 'uuid';
import { ImportedTransaction } from '@/types/transaction';
import { Transaction } from '@/types/budget';
import { determineTransactionStatus } from '@/services/calculationService';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import { parseCSVContent } from './budgetOrchestrator';

interface TransactionMatch {
  date: string;
  description: string;
  amount: number;
  balanceAfter: number;
}

/**
 * Creates a unique key for transaction matching based on date, description, amount, and balance
 */
function createTransactionKey(tx: TransactionMatch): string {
  const date = tx.date.split('T')[0];
  const desc = tx.description.toLowerCase().trim();
  const amt = Math.round(tx.amount);
  const bal = Math.round(tx.balanceAfter);
  return `${date}|${desc}|${amt}|${bal}`;
}

/**
 * Apply category rules to a transaction
 */
async function applyCategoryRules(
  transaction: ImportedTransaction,
  categoryRules: any[]
): Promise<ImportedTransaction> {
  if (!categoryRules || categoryRules.length === 0) return transaction;
  
  // Sort rules by priority (lower number = higher priority)
  const sortedRules = categoryRules
    .filter(rule => rule.isActive === 'true')
    .sort((a, b) => (a.priority || 100) - (b.priority || 100));
  
  for (const rule of sortedRules) {
    // Check if rule applies to this account
    if (rule.applicableAccountIds && rule.applicableAccountIds !== '[]') {
      try {
        const accountIds = JSON.parse(rule.applicableAccountIds);
        if (!accountIds.includes(transaction.accountId)) continue;
      } catch (e) {
        // If parsing fails, skip this rule
        continue;
      }
    }
    
    // Check if description matches
    if (rule.pattern) {
      const pattern = new RegExp(rule.pattern, 'i');
      if (!pattern.test(transaction.description)) continue;
    }
    
    // Apply the rule
    console.log(`✅ Applying rule "${rule.name}" to transaction: ${transaction.description}`);
    
    // Set categories based on transaction amount
    if (transaction.amount > 0 && rule.positiveTransactionType) {
      transaction.type = rule.positiveTransactionType;
    } else if (transaction.amount < 0 && rule.negativeTransactionType) {
      transaction.type = rule.negativeTransactionType;
    }
    
    // Set category IDs
    if (rule.huvudkategoriId) {
      transaction.appCategoryId = rule.huvudkategoriId;
    }
    if (rule.underkategoriId) {
      transaction.appSubCategoryId = rule.underkategoriId;
    }
    
    // First matching rule wins
    break;
  }
  
  return transaction;
}

/**
 * IMPROVED IMPORT FUNCTION
 * - Matches by Datum+Beskrivning+Amount+Saldo
 * - Updates existing transactions preserving manual changes
 * - Applies category rules
 * - Returns detailed stats for UI updates
 */
export async function improvedImportAndReconcileFile(
  csvContent: string, 
  accountId: string, 
  accountName: string,
  existingTransactions: Transaction[],
  categoryRules?: any[]
): Promise<{
  success: boolean, 
  stats: {created: number, updated: number, removed: number},
  finalTransactions: Transaction[]
}> {
  
  console.log(`🚀 [IMPROVED IMPORT] Starting import for account: ${accountName} (${accountId})`);
  addMobileDebugLog(`🚀 IMPROVED: Starting import for ${accountName}`);
  
  // 1. Ensure account exists
  try {
    const accountResponse = await fetch(`/api/accounts/${accountId}`);
    if (!accountResponse.ok) {
      console.log(`🆕 [IMPROVED IMPORT] Creating account ${accountName}...`);
      
      const createResponse = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: accountId,
          name: accountName,
          type: 'checking',
          balance: 0,
          assignedTo: 'gemensamt'
        })
      });
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create account: ${createResponse.status}`);
      }
      
      console.log(`✅ [IMPROVED IMPORT] Account ${accountName} created`);
    }
  } catch (error) {
    console.error(`❌ [IMPROVED IMPORT] Account verification failed:`, error);
    return {
      success: false, 
      stats: {created: 0, updated: 0, removed: 0},
      finalTransactions: existingTransactions
    };
  }
  
  // 2. Parse CSV content
  console.log(`📋 [IMPROVED IMPORT] Parsing CSV content...`);
  let newTransactions = parseCSVContent(csvContent, accountId, 'improved-import');
  
  if (newTransactions.length === 0) {
    console.log(`⚠️ [IMPROVED IMPORT] No transactions found in CSV`);
    return {
      success: false, 
      stats: {created: 0, updated: 0, removed: 0},
      finalTransactions: existingTransactions
    };
  }
  
  console.log(`📊 [IMPROVED IMPORT] Parsed ${newTransactions.length} transactions from CSV`);
  
  // 3. Apply category rules to new transactions
  if (categoryRules && categoryRules.length > 0) {
    console.log(`🔧 [IMPROVED IMPORT] Applying ${categoryRules.length} category rules...`);
    for (let i = 0; i < newTransactions.length; i++) {
      newTransactions[i] = await applyCategoryRules(newTransactions[i], categoryRules);
    }
  }
  
  // 4. Calculate date range
  const fileDates = newTransactions.map(t => t.date.split('T')[0]);
  const minDate = fileDates.reduce((min, date) => date < min ? date : min);
  const maxDate = fileDates.reduce((max, date) => date > max ? date : max);
  
  console.log(`📅 [IMPROVED IMPORT] CSV date range: ${minDate} to ${maxDate}`);
  
  // 5. Build transaction maps for matching
  const accountTransactions = existingTransactions.filter(t => t.accountId === accountId);
  const otherAccountTransactions = existingTransactions.filter(t => t.accountId !== accountId);
  
  // Create map of existing transactions by key
  const existingTxMap = new Map<string, Transaction>();
  const existingInRange: Transaction[] = [];
  const existingOutOfRange: Transaction[] = [];
  
  for (const tx of accountTransactions) {
    const txDate = tx.date.split('T')[0];
    if (txDate >= minDate && txDate <= maxDate) {
      const key = createTransactionKey(tx);
      existingTxMap.set(key, tx);
      existingInRange.push(tx);
    } else {
      existingOutOfRange.push(tx);
    }
  }
  
  console.log(`📊 [IMPROVED IMPORT] Found ${existingInRange.length} existing transactions in date range`);
  console.log(`📊 [IMPROVED IMPORT] Found ${existingOutOfRange.length} existing transactions outside date range`);
  
  // 6. Process new transactions: Update or Create
  const transactionsToCreate: Transaction[] = [];
  const transactionsToUpdate: Transaction[] = [];
  const processedKeys = new Set<string>();
  
  for (const newTx of newTransactions) {
    const key = createTransactionKey(newTx);
    processedKeys.add(key);
    
    const existingTx = existingTxMap.get(key);
    
    if (existingTx) {
      // UPDATE existing transaction, preserving manual changes
      console.log(`🔄 [IMPROVED IMPORT] Updating existing transaction: ${newTx.description}`);
      
      const updatedTx: Transaction = {
        ...existingTx, // Start with existing
        // Update fields that should come from CSV
        date: newTx.date,
        amount: newTx.amount,
        balanceAfter: newTx.balanceAfter,
        description: newTx.description,
        // Only update categories if not manually changed
        bankCategory: newTx.bankCategory || existingTx.bankCategory,
        bankSubCategory: newTx.bankSubCategory || existingTx.bankSubCategory,
      };
      
      // Preserve manually changed fields
      if (existingTx.isManuallyChanged === 'true') {
        console.log(`🔒 [IMPROVED IMPORT] Preserving manual changes for: ${existingTx.description}`);
        updatedTx.appCategoryId = existingTx.appCategoryId;
        updatedTx.appSubCategoryId = existingTx.appSubCategoryId;
        updatedTx.type = existingTx.type;
        updatedTx.userDescription = existingTx.userDescription;
        updatedTx.correctedAmount = existingTx.correctedAmount;
      } else {
        // Apply new categories from rules if not manually changed
        updatedTx.appCategoryId = newTx.appCategoryId || existingTx.appCategoryId;
        updatedTx.appSubCategoryId = newTx.appSubCategoryId || existingTx.appSubCategoryId;
        updatedTx.type = newTx.type || existingTx.type;
      }
      
      transactionsToUpdate.push(updatedTx);
    } else {
      // CREATE new transaction
      console.log(`➕ [IMPROVED IMPORT] Creating new transaction: ${newTx.description}`);
      
      const txToCreate: Transaction = {
        id: uuidv4(),
        accountId: newTx.accountId,
        date: newTx.date,
        amount: newTx.amount,
        balanceAfter: newTx.balanceAfter,
        description: newTx.description,
        userDescription: newTx.userDescription || '',
        bankCategory: newTx.bankCategory || '',
        bankSubCategory: newTx.bankSubCategory || '',
        type: newTx.type || 'Transaction',
        status: newTx.status || determineTransactionStatus(newTx),
        linkedTransactionId: newTx.linkedTransactionId || null,
        correctedAmount: newTx.correctedAmount || null,
        isManuallyChanged: 'false',
        appCategoryId: newTx.appCategoryId || null,
        appSubCategoryId: newTx.appSubCategoryId || null
      };
      
      transactionsToCreate.push(txToCreate);
    }
  }
  
  // 7. Identify transactions to remove (exist in DB but not in CSV within date range)
  const transactionsToRemove: Transaction[] = [];
  for (const existingTx of existingInRange) {
    const key = createTransactionKey(existingTx);
    if (!processedKeys.has(key)) {
      console.log(`🗑️ [IMPROVED IMPORT] Marking for removal: ${existingTx.description}`);
      transactionsToRemove.push(existingTx);
    }
  }
  
  console.log(`📊 [IMPROVED IMPORT] Summary:`);
  console.log(`  - ${transactionsToCreate.length} new transactions to create`);
  console.log(`  - ${transactionsToUpdate.length} existing transactions to update`);
  console.log(`  - ${transactionsToRemove.length} transactions to remove`);
  console.log(`  - ${existingOutOfRange.length} transactions outside range (unchanged)`);
  
  // 8. Execute database operations
  const stats = { created: 0, updated: 0, removed: 0 };
  
  // Delete transactions
  if (transactionsToRemove.length > 0) {
    try {
      const deleteIds = transactionsToRemove.map(tx => tx.id);
      const deleteResponse = await fetch('/api/transactions/bulk-delete-by-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deleteIds })
      });
      
      if (deleteResponse.ok) {
        const result = await deleteResponse.json();
        stats.removed = result.deletedCount || transactionsToRemove.length;
        console.log(`✅ [IMPROVED IMPORT] Deleted ${stats.removed} transactions`);
      }
    } catch (error) {
      console.error(`❌ [IMPROVED IMPORT] Delete failed:`, error);
    }
  }
  
  // Update existing transactions
  if (transactionsToUpdate.length > 0) {
    try {
      const updateResponse = await fetch('/api/transactions/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: transactionsToUpdate })
      });
      
      if (updateResponse.ok) {
        const result = await updateResponse.json();
        stats.updated = result.updatedCount || transactionsToUpdate.length;
        console.log(`✅ [IMPROVED IMPORT] Updated ${stats.updated} transactions`);
      }
    } catch (error) {
      console.error(`❌ [IMPROVED IMPORT] Update failed:`, error);
    }
  }
  
  // Create new transactions
  if (transactionsToCreate.length > 0) {
    try {
      const createResponse = await fetch('/api/transactions/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: transactionsToCreate })
      });
      
      if (createResponse.ok) {
        const result = await createResponse.json();
        stats.created = result.createdCount || transactionsToCreate.length;
        console.log(`✅ [IMPROVED IMPORT] Created ${stats.created} transactions`);
      }
    } catch (error) {
      console.error(`❌ [IMPROVED IMPORT] Create failed:`, error);
    }
  }
  
  // 9. Build final transaction list for UI update
  const finalTransactions = [
    ...otherAccountTransactions,
    ...existingOutOfRange,
    ...transactionsToUpdate,
    ...transactionsToCreate
  ];
  
  console.log(`✅ [IMPROVED IMPORT] Import complete! Final count: ${finalTransactions.length} transactions`);
  addMobileDebugLog(`✅ Import complete: ${stats.created} created, ${stats.updated} updated, ${stats.removed} removed`);
  
  // 10. AUTOMATIC ACCOUNT BALANCE SETTING (same as original orchestrator)
  
  try {
    const currentDate = new Date();
    const payday = 25; // Use default payday
    
    // Only process transactions for the target account
    const accountTransactions = finalTransactions.filter(tx => tx.accountId === accountId);
    
    // Group transactions by month
    const transactionsByMonth = accountTransactions.reduce((acc, tx) => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(tx);
      return acc;
    }, {} as Record<string, typeof finalTransactions>);
    
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Process each month
    for (const [monthKey, transactions] of Object.entries(transactionsByMonth)) {
      const [txYear, txMonth] = monthKey.split('-').map(Number);
      const [currentYear, currentMonth] = currentMonthKey.split('-').map(Number);
      const txDate = new Date(txYear, txMonth - 1, 1);
      const currentMonthDate = new Date(currentYear, currentMonth - 1, 1);
      
      if (txDate > currentMonthDate) {
        continue;
      }
      
      // Check payday logic
      const monthPaydayDate = new Date(txYear, txMonth - 2, payday);
      if (currentDate < monthPaydayDate) {
        continue;
      }
      
      // Find last transaction before payday
      const dayBeforePayday = payday - 1;
      
      const transactionsBeforePayday = transactions.filter((tx) => {
        const date = new Date(tx.date);
        return date.getDate() <= dayBeforePayday;
      });
      
      if (transactionsBeforePayday.length === 0) {
        continue;
      }
      
      const lastTransactionBeforePayday = transactionsBeforePayday.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      
      if (lastTransactionBeforePayday?.balanceAfter !== undefined) {
        // SWEDISH PAYDAY LOGIC: Transactions before 25th set balance for NEXT month
        // Example: July transactions before July 25th set August balance
        const [year, month] = monthKey.split('-').map(Number);
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const targetMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
        
        
        // Create/update budget post
        try {
          
          const existingResponse = await fetch(`/api/budget-posts?monthKey=${targetMonthKey}`);
          
          if (existingResponse.ok) {
            const allPosts = await existingResponse.json();
            const existingPosts = allPosts.filter((post: any) => 
              post.type === 'Balance' && post.accountId === accountId
            );
            
            
            // Create budget post payload with auto-sync logic
            const createBudgetPostPayload = async (basePayload: any) => {
              try {
                const settingsResponse = await fetch('/api/user-settings/autoUpdateBalance');
                let autoUpdateEnabled = true;
                
                if (settingsResponse.ok) {
                  const autoUpdateSetting = await settingsResponse.json();
                  autoUpdateEnabled = autoUpdateSetting?.settingValue === 'true';
                }
                
                const payload = { ...basePayload };
                
                if (autoUpdateEnabled && basePayload.accountBalance !== undefined) {
                  payload.accountUserBalance = basePayload.accountBalance;
                }
                
                return payload;
              } catch (error) {
                const payload = { ...basePayload };
                if (basePayload.accountBalance !== undefined) {
                  payload.accountUserBalance = basePayload.accountBalance;
                }
                return payload;
              }
            };
            
            if (existingPosts.length > 0) {
              // Update existing
              const existingPost = existingPosts[0];
              
              const baseUpdatePayload = {
                accountBalance: lastTransactionBeforePayday.balanceAfter,
                description: `Bank balance from CSV import (from ${monthKey} transactions, updated)`
              };
              
              const updatePayload = await createBudgetPostPayload(baseUpdatePayload);
              
              const updateResponse = await fetch(`/api/budget-posts/${existingPost.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
              });
              
              // Silently handle the response
            } else {
              // Create new
              
              const baseCreatePayload = {
                monthKey: targetMonthKey,
                type: 'Balance',
                accountId: accountId,
                amount: 0,
                accountBalance: lastTransactionBeforePayday.balanceAfter,
                description: `Bank balance from CSV import (from ${monthKey} transactions)`,
                huvudkategoriId: null,
                underkategoriId: null
              };
              
              const createPayload = await createBudgetPostPayload(baseCreatePayload);
              
              const createResponse = await fetch('/api/budget-posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createPayload)
              });
              
              // Silently handle the response
            }
          }
        } catch (error) {
          // Silently handle errors
        }
      }
    }
    
  } catch (error) {
    // Silently handle errors
  }
  
  return {
    success: true,
    stats,
    finalTransactions
  };
}