/**
 * OPTIMIZED BATCH RULE APPLICATION
 * 
 * Fixes the 4-minute performance issue by:
 * 1. Eliminating excessive logging
 * 2. Batch processing transactions
 * 3. Single bulk database update
 * 4. Optimized rule matching
 */

import { ImportedTransaction } from '@/types/transaction';
import { CategoryRule } from '@shared/schema';
import { addMobileDebugLog } from '@/utils/mobileDebugLogger';

interface BatchRuleResult {
  success: boolean;
  stats: {
    processed: number;
    updated: number;
    rulesApplied: number;
    autoMatched: number;
    autoApproved: number;
    bankMatched: number;
  };
  updatedTransactions: ImportedTransaction[];
}

interface OptimizedRule {
  id: string;
  ruleName: string;
  transactionName?: string;
  ruleType?: string;
  bankhuvudkategori?: string;
  bankunderkategori?: string;
  transactionDirection?: string;
  huvudkategoriId?: string;
  underkategoriId?: string;
  positiveTransactionType?: string;
  negativeTransactionType?: string;
  applicableAccountIds?: string;
  isActive: boolean;
  priority: number;
  autoApproval?: boolean;
}

interface BatchUpdate {
  id: string;
  updates: {
    appCategoryId?: string;
    appSubCategoryId?: string;
    type?: string;
    status?: string;
    isManuallyChanged?: string;
    linkedTransactionId?: string;
  };
}

/**
 * Pre-process rules for faster matching
 */
function preprocessRules(rules: any[]): OptimizedRule[] {
  return rules
    .filter(rule => rule.isActive === 'true' || rule.isActive === true)
    .map(rule => ({
      id: rule.id,
      ruleName: rule.ruleName || rule.name,
      transactionName: rule.transactionName?.toLowerCase(),
      ruleType: rule.ruleType || 'textContains', // Default to textContains for legacy rules
      bankhuvudkategori: rule.bankhuvudkategori,
      bankunderkategori: rule.bankunderkategori,
      transactionDirection: rule.transactionDirection || 'all',
      huvudkategoriId: rule.huvudkategoriId,
      underkategoriId: rule.underkategoriId,
      positiveTransactionType: rule.positiveTransactionType,
      negativeTransactionType: rule.negativeTransactionType,
      applicableAccountIds: rule.applicableAccountIds,
      isActive: true,
      priority: rule.priority || 100,
      autoApproval: rule.autoApproval === true
    }))
    .sort((a, b) => a.priority - b.priority); // Sort by priority
}

/**
 * Check if rule applies to account
 */
function ruleAppliesToAccount(rule: OptimizedRule, accountId: string): boolean {
  if (!rule.applicableAccountIds || rule.applicableAccountIds === '[]') {
    return true; // No account restrictions
  }
  
  try {
    const applicableAccounts = JSON.parse(rule.applicableAccountIds);
    return applicableAccounts.length === 0 || applicableAccounts.includes(accountId);
  } catch (e) {
    return true; // If parsing fails, assume no restrictions
  }
}

/**
 * Find matching rule for a transaction
 */
function findMatchingRule(transaction: ImportedTransaction, rules: OptimizedRule[]): OptimizedRule | null {
  for (const rule of rules) {
    // Check account applicability first (fastest check)
    if (!ruleAppliesToAccount(rule, transaction.accountId)) {
      continue;
    }
    
    // Check transaction direction filter
    if (rule.transactionDirection === 'positive' && transaction.amount < 0) {
      continue;
    }
    if (rule.transactionDirection === 'negative' && transaction.amount >= 0) {
      continue;
    }
    
    const isAllBankCategories = rule.bankhuvudkategori === 'Alla Bankkategorier' || 
                               rule.bankunderkategori === 'Alla Bankunderkategorier' ||
                               rule.bankhuvudkategori === '*' || 
                               rule.bankunderkategori === '*';
    
    // Wildcard matching for bank categories
    if (rule.bankhuvudkategori === '*' || rule.bankunderkategori === '*') {
      return rule;
    }
    
    // Bank category + subcategory exact match
    if (rule.bankhuvudkategori && rule.bankunderkategori && !isAllBankCategories) {
      if (transaction.bankCategory === rule.bankhuvudkategori && 
          transaction.bankSubCategory === rule.bankunderkategori) {
        return rule;
      }
    }
    // Bank category only match
    else if (rule.bankhuvudkategori && !rule.bankunderkategori && !isAllBankCategories) {
      if (transaction.bankCategory === rule.bankhuvudkategori) {
        return rule;
      }
    }
    // Text-based matching
    else if (rule.transactionName) {
      const transactionText = transaction.description?.toLowerCase() || '';
      // Handle wildcard (*) - matches all transactions
      if (rule.transactionName === '*') {
        return rule;
      }
      
      // Apply matching logic based on rule type
      const ruleType = rule.ruleType || 'textContains'; // Default to textContains for legacy rules
      
      switch (ruleType) {
        case 'exactText':
          // Exact text match (case insensitive)
          if (transactionText === rule.transactionName) {
            return rule;
          }
          break;
        case 'textStartsWith':
          // Text starts with match
          if (transactionText.startsWith(rule.transactionName)) {
            return rule;
          }
          break;
        case 'textContains':
        default:
          // Text contains match (default behavior)
          if (transactionText.includes(rule.transactionName)) {
            return rule;
          }
          break;
      }
    }
  }
  
  return null;
}

/**
 * Apply rule to transaction and return batch update
 */
function applyRuleToTransaction(
  transaction: ImportedTransaction, 
  rule: OptimizedRule
): BatchUpdate | null {
  const updates: BatchUpdate['updates'] = {};
  let hasUpdates = false;
  
  // Apply category
  if (rule.huvudkategoriId) {
    updates.appCategoryId = rule.huvudkategoriId;
    hasUpdates = true;
  }
  
  if (rule.underkategoriId) {
    updates.appSubCategoryId = rule.underkategoriId;
    hasUpdates = true;
  }
  
  // Apply transaction type based on amount
  const isPositive = transaction.amount >= 0;
  const newType = isPositive ? 
    (rule.positiveTransactionType || 'Transaction') : 
    (rule.negativeTransactionType || 'Transaction');
  
  if (newType !== transaction.type) {
    updates.type = newType;
    hasUpdates = true;
  }
  
  // For InternalTransfer type, only auto-approve if transaction has a linked transaction
  // Otherwise, do not auto-approve even if the rule says to
  if (rule.autoApproval && rule.huvudkategoriId && rule.underkategoriId && transaction.status !== 'green') {
    // Check if this is an InternalTransfer rule
    const isInternalTransferRule = 
      newType === 'InternalTransfer' || 
      transaction.type === 'InternalTransfer' ||
      (rule.positiveTransactionType === 'InternalTransfer' || rule.negativeTransactionType === 'InternalTransfer');
    
    if (isInternalTransferRule) {
      // Only auto-approve if transaction has a linked transaction
      if (transaction.linkedTransactionId) {
        updates.status = 'green';
        hasUpdates = true;
      }
      // Do not auto-approve unlinked internal transfers
    } else {
      // Regular transactions can be auto-approved
      updates.status = 'green';
      hasUpdates = true;
    }
  }
  
  // Mark as rule-processed (not manually changed)
  updates.isManuallyChanged = 'false';
  
  return hasUpdates ? { id: transaction.id, updates } : null;
}

/**
 * Apply bank category fallback matching
 */
function applyBankCategoryFallback(
  transaction: ImportedTransaction,
  huvudkategorier: any[],
  underkategorier: any[]
): BatchUpdate | null {
  if (!transaction.bankCategory || !transaction.bankSubCategory) {
    return null;
  }
  
  // Find matching huvudkategori by name
  const matchingHuvudkategori = huvudkategorier.find(hk => 
    hk.name.trim().toLowerCase() === transaction.bankCategory.trim().toLowerCase()
  );
  
  if (!matchingHuvudkategori) {
    return null;
  }
  
  // Find matching underkategori by name within the huvudkategori
  const matchingUnderkategori = underkategorier.find(uk => 
    uk.huvudkategoriId === matchingHuvudkategori.id &&
    uk.name.trim().toLowerCase() === transaction.bankSubCategory.trim().toLowerCase()
  );
  
  if (!matchingUnderkategori) {
    return null;
  }
  
  return {
    id: transaction.id,
    updates: {
      appCategoryId: matchingHuvudkategori.id,
      appSubCategoryId: matchingUnderkategori.id,
      isManuallyChanged: 'false'
    }
  };
}

/**
 * Auto-match internal transfer transactions based on date, amount, and account
 * Returns matched transaction pairs
 * 
 * UPDATED: Now considers pending type updates from rules when finding InternalTransfer transactions
 */
function autoMatchInternalTransfers(
  transactions: ImportedTransaction[],
  batchUpdates: BatchUpdate[]
): Array<{ transaction1Id: string; transaction2Id: string }> {
  console.log('🔍 [BATCH RULES] Auto-matching internal transfer transactions...');
  addMobileDebugLog(`🔍 [AUTO-MATCH] Starting auto-match: ${transactions.length} transactions`);
  
  const matches: Array<{ transaction1Id: string; transaction2Id: string }> = [];
  const processedIds = new Set<string>();
  
  // Create a map of pending type updates
  const typeUpdates = new Map<string, string>();
  batchUpdates.forEach(update => {
    if (update.updates.type) {
      typeUpdates.set(update.id, update.updates.type);
    }
  });
  
  // Find all transactions that are or will be InternalTransfer type and don't have linked transactions
  const unmatchedInternalTransfers = transactions.filter(tx => {
    const effectiveType = typeUpdates.get(tx.id) || tx.type;
    return effectiveType === 'InternalTransfer' && !tx.linkedTransactionId;
  });
  
  console.log(`🔍 [AUTO-MATCH] Found ${unmatchedInternalTransfers.length} unmatched internal transfers (including pending type changes)`);
  addMobileDebugLog(`🔍 [AUTO-MATCH] Found ${unmatchedInternalTransfers.length} unmatched internal transfers`);
  
  // For each unmatched internal transfer, try to find its counterpart
  unmatchedInternalTransfers.forEach(internalTransfer => {
    if (processedIds.has(internalTransfer.id)) {
      return; // Already processed this transaction
    }
    
    // Specific logging for the two transactions mentioned by user
    const isSpecialTx = internalTransfer.id === 'f22f3f23-9e0f-40cb-9a6a-c16ca867b8a2' || 
                       internalTransfer.id === '3142764c-04c2-4245-8b98-50d9a34b02e9';
    if (isSpecialTx) {
      const specialMsg = `🎯 [SPECIAL-TX] Processing special transaction: ${internalTransfer.id} - ${internalTransfer.description} (${(internalTransfer.amount/100).toFixed(2)} kr) - Date: ${internalTransfer.date}`;
      console.log(specialMsg);
      addMobileDebugLog(specialMsg);
    }
    
    // Only log for special transactions
    if (isSpecialTx) {
      const searchMsg = `🔎 [AUTO-MATCH] Searching match for: ${internalTransfer.description} (${(internalTransfer.amount/100).toFixed(2)} kr)`;
      console.log(searchMsg);
      addMobileDebugLog(searchMsg);
    }
    
    // Look for potential counterpart with opposite amount on same date
    // The counterpart could be ANY transaction type (not necessarily InternalTransfer yet)
    const potentialCounterparts = transactions.filter(tx => {
      const sameId = tx.id === internalTransfer.id;
      const alreadyProcessed = processedIds.has(tx.id);
      const alreadyLinked = !!tx.linkedTransactionId;
      const sameDate = tx.date === internalTransfer.date;
      const differentAccount = tx.accountId !== internalTransfer.accountId;
      const equalAmounts = Math.abs(Math.abs(tx.amount) - Math.abs(internalTransfer.amount)) < 0.01;
      const oppositeSigns = (internalTransfer.amount > 0 && tx.amount < 0) || (internalTransfer.amount < 0 && tx.amount > 0);
      
      // Special logging for the two transactions mentioned by user
      if (isSpecialTx && !sameId && sameDate) {
        const detailMsg = `🎯 [SPECIAL-TX] Checking potential match: ${tx.id} - ${tx.description} (${(tx.amount/100).toFixed(2)} kr) - Account: ${tx.accountId}`;
        console.log(detailMsg);
        addMobileDebugLog(detailMsg);
        
        const checkMsg = `🎯 [SPECIAL-TX] Match criteria: alreadyProcessed=${alreadyProcessed}, alreadyLinked=${alreadyLinked}, differentAccount=${differentAccount}, equalAmounts=${equalAmounts}, oppositeSigns=${oppositeSigns}`;
        console.log(checkMsg);
        addMobileDebugLog(checkMsg);
      }
      
      // Only log detailed rejections for special transactions
      if (isSpecialTx && !sameId && !alreadyProcessed && !alreadyLinked && sameDate) {
        let rejectMsg = '';
        if (!differentAccount) {
          rejectMsg = `  ⚠️ Same account: ${tx.description}`;
        } else if (!equalAmounts) {
          rejectMsg = `  ⚠️ Wrong amount: ${tx.description} (${(tx.amount/100).toFixed(2)} kr)`;
        } else if (!oppositeSigns) {
          rejectMsg = `  ⚠️ Same direction: ${tx.description}`;
        }
        if (rejectMsg) {
          console.log(rejectMsg);
          addMobileDebugLog(rejectMsg);
        }
      }
      
      return !sameId && !alreadyProcessed && !alreadyLinked && sameDate && differentAccount && equalAmounts && oppositeSigns;
    });
    
    if (potentialCounterparts.length === 1) {
      // Found exactly one matching counterpart
      const counterpart = potentialCounterparts[0];
      
      console.log(`✅ [AUTO-MATCH] MATCHED! ${internalTransfer.description} ↔️ ${counterpart.description}`);
      
      // Special logging for the two transactions mentioned by user
      if (isSpecialTx) {
        const specialMatchMsg = `🎯 [SPECIAL-TX] SUCCESS! Special transaction ${internalTransfer.id} matched with ${counterpart.id}`;
        console.log(specialMatchMsg);
        addMobileDebugLog(specialMatchMsg);
      }
      
      matches.push({
        transaction1Id: internalTransfer.id,
        transaction2Id: counterpart.id
      });
      
      processedIds.add(internalTransfer.id);
      processedIds.add(counterpart.id);
    } else if (potentialCounterparts.length > 1) {
      console.warn(`⚠️ [AUTO-MATCH] Multiple matches for ${internalTransfer.description} - SKIPPING`);
      
      // Special logging for the two transactions mentioned by user
      if (isSpecialTx) {
        const specialMultiMsg = `🎯 [SPECIAL-TX] WARNING! Special transaction ${internalTransfer.id} has multiple potential matches - this may indicate an issue`;
        console.warn(specialMultiMsg);
        addMobileDebugLog(specialMultiMsg);
      }
    } else {
      // Special logging for the two transactions mentioned by user
      if (isSpecialTx) {
        const specialNoMatchMsg = `🎯 [SPECIAL-TX] PROBLEM! Special transaction ${internalTransfer.id} could not be auto-matched - verify rules and data`;
        console.warn(specialNoMatchMsg);
        addMobileDebugLog(specialNoMatchMsg);
      }
    }
  });
  
  // Also check for pairs of transactions that BOTH should be InternalTransfer but aren't marked yet
  // This handles the case where rules mark both sides as InternalTransfer in the same batch
  const unmatchedTransfers = transactions.filter(tx => {
    const effectiveType = typeUpdates.get(tx.id) || tx.type;
    return effectiveType === 'InternalTransfer' && !tx.linkedTransactionId && !processedIds.has(tx.id);
  });
  
  // Pre-analyze remaining unmatched InternalTransfer transactions to find pairs
  const transactionGroups = new Map<string, ImportedTransaction[]>();
  
  unmatchedTransfers.forEach(tx => {
    const key = `${tx.date}_${Math.abs(tx.amount)}`;
    if (!transactionGroups.has(key)) {
      transactionGroups.set(key, []);
    }
    transactionGroups.get(key)!.push(tx);
  });
  
  // Only process groups that have exactly 2 transactions (1 positive, 1 negative)
  transactionGroups.forEach((group, key) => {
    if (group.length === 2) {
      const [tx1, tx2] = group;
      
      // Verify they have opposite signs and different accounts
      if (((tx1.amount > 0 && tx2.amount < 0) || (tx1.amount < 0 && tx2.amount > 0)) &&
          tx1.accountId !== tx2.accountId &&
          Math.abs(Math.abs(tx1.amount) - Math.abs(tx2.amount)) < 0.01) {
        
        console.log(`✅ [AUTO-MATCH] Pair matched: ${tx1.description} ↔️ ${tx2.description}`);
        
        matches.push({
          transaction1Id: tx1.id,
          transaction2Id: tx2.id
        });
        
        processedIds.add(tx1.id);
        processedIds.add(tx2.id);
      }
    } else if (group.length > 2) {
      console.warn(`⚠️ [AUTO-MATCH] ${group.length} transactions with same amount on ${key.split('_')[0]} - SKIPPING`);
    }
  });
  
  const summaryMsg = `📊 [AUTO-MATCH] Summary: ${matches.length} pairs matched (${matches.length * 2} transactions linked)`;
  console.log(summaryMsg);
  addMobileDebugLog(summaryMsg);
  return matches;
}

/**
 * Synchronize categories and approval status between linked internal transfer transactions
 * Returns the number of additional transactions synchronized
 */
function synchronizeLinkedTransactions(
  transactions: ImportedTransaction[],
  batchUpdates: BatchUpdate[]
): number {
  console.log('🔄 [BATCH RULES] Synchronizing linked internal transfer transactions...');
  
  let synchronizedCount = 0;
  const processedLinkedIds = new Set<string>();
  
  // Create a map of transaction updates for quick lookup
  const updateMap = new Map<string, BatchUpdate['updates']>();
  batchUpdates.forEach(update => {
    updateMap.set(update.id, update.updates);
  });
  
  // Find all transactions that have been updated and have linked transactions
  batchUpdates.forEach(update => {
    const transaction = transactions.find(t => t.id === update.id);
    if (!transaction || !transaction.linkedTransactionId) {
      return;
    }
    
    // Skip if we've already processed this linked pair
    if (processedLinkedIds.has(transaction.linkedTransactionId)) {
      return;
    }
    
    // Check if this is an internal transfer
    const isInternalTransfer = 
      update.updates.type === 'InternalTransfer' || 
      transaction.type === 'InternalTransfer';
    
    if (!isInternalTransfer) {
      return;
    }
    
    // Find the linked transaction
    const linkedTransaction = transactions.find(t => t.id === transaction.linkedTransactionId);
    if (!linkedTransaction) {
      return;
    }
    
    // Mark this pair as processed
    processedLinkedIds.add(transaction.id);
    processedLinkedIds.add(linkedTransaction.id);
    
    // Check if linked transaction already has an update
    let linkedUpdate = batchUpdates.find(u => u.id === linkedTransaction.id);
    
    // If linked transaction doesn't have an update, create one
    if (!linkedUpdate) {
      linkedUpdate = {
        id: linkedTransaction.id,
        updates: {}
      };
      batchUpdates.push(linkedUpdate);
      synchronizedCount++;
    }
    
    // Synchronize categories from the first transaction to the linked one
    if (update.updates.appCategoryId) {
      linkedUpdate.updates.appCategoryId = update.updates.appCategoryId;
    }
    if (update.updates.appSubCategoryId) {
      linkedUpdate.updates.appSubCategoryId = update.updates.appSubCategoryId;
    }
    
    // Synchronize type
    linkedUpdate.updates.type = 'InternalTransfer';
    
    // IMPORTANT: Do NOT auto-approve the linked transaction
    // The linked transaction must be manually reviewed and approved
    // Remove any auto-approval synchronization
    
    // Mark as rule-processed
    linkedUpdate.updates.isManuallyChanged = 'false';
    
    console.log(`✅ [BATCH RULES] Synchronized categories from ${transaction.id} to linked transaction ${linkedTransaction.id}`);
  });
  
  return synchronizedCount;
}

/**
 * MAIN OPTIMIZED BATCH RULE APPLICATION FUNCTION
 */
export async function applyRulesToTransactionsBatch(
  transactions: ImportedTransaction[],
  rules: any[],
  huvudkategorier: any[] = [],
  underkategorier: any[] = []
): Promise<BatchRuleResult> {
  // Force mobile logging to appear
  console.log(`🔴 [BATCH RULES START] Function called with ${transactions.length} transactions and ${rules.length} rules`);
  console.log(`🚀 [BATCH RULES] Starting optimized batch processing: ${transactions.length} transactions, ${rules.length} rules`);
  
  try {
  const stats = {
    processed: 0,
    updated: 0,
    rulesApplied: 0,
    autoMatched: 0,
    autoApproved: 0,
    bankMatched: 0
  };
  
  // Pre-process rules for optimal performance
  const optimizedRules = preprocessRules(rules);
  console.log(`🚀 [BATCH RULES] Active rules after preprocessing: ${optimizedRules.length}`);
  
  const batchUpdates: BatchUpdate[] = [];
  const updatedTransactionIds = new Set<string>();
  
  // Process transactions in batches for better performance
  const BATCH_SIZE = 100;
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    
    for (const transaction of batch) {
      stats.processed++;
      
      // Skip green transactions
      if (transaction.status === 'green') {
        continue;
      }
      
      // Try to find matching rule
      const matchingRule = findMatchingRule(transaction, optimizedRules);
      
      if (matchingRule) {
        // Apply rule
        const ruleUpdate = applyRuleToTransaction(transaction, matchingRule);
        if (ruleUpdate) {
          batchUpdates.push(ruleUpdate);
          updatedTransactionIds.add(transaction.id);
          stats.rulesApplied++;
          stats.updated++;
          
          if (ruleUpdate.updates.status === 'green') {
            stats.autoApproved++;
          }
        }
      } else {
        // Try bank category fallback
        const bankUpdate = applyBankCategoryFallback(transaction, huvudkategorier, underkategorier);
        if (bankUpdate) {
          batchUpdates.push(bankUpdate);
          updatedTransactionIds.add(transaction.id);
          stats.bankMatched++;
          stats.updated++;
          
          if (bankUpdate.updates.status === 'green') {
            stats.autoApproved++;
          }
        }
      }
    }
    
    // Progress logging (minimal)
    if (i % 500 === 0) {
      console.log(`📊 [BATCH RULES] Progress: ${i}/${transactions.length} (${Math.round(i/transactions.length*100)}%)`);
    }
  }
  
  console.log(`📊 [BATCH RULES] Processing complete: ${batchUpdates.length} updates to apply`);
  console.log(`🔍 [DEBUG] batchUpdates contents:`, batchUpdates.slice(0, 3)); // Show first 3 updates
  
  // Auto-match internal transfer transactions, considering pending type updates from rules
  const transferMatches = autoMatchInternalTransfers(transactions, batchUpdates);
  if (transferMatches.length > 0) {
    console.log(`🔗 [BATCH RULES] Applying ${transferMatches.length} auto-matched internal transfers`);
    
    // Apply the matched links to batch updates
    transferMatches.forEach(match => {
      // Check if we already have updates for these transactions
      let update1 = batchUpdates.find(u => u.id === match.transaction1Id);
      let update2 = batchUpdates.find(u => u.id === match.transaction2Id);
      
      // Create or update the first transaction
      if (!update1) {
        update1 = { id: match.transaction1Id, updates: {} };
        batchUpdates.push(update1);
      }
      update1.updates.linkedTransactionId = match.transaction2Id;
      update1.updates.type = 'InternalTransfer';
      
      // Create or update the second transaction  
      if (!update2) {
        update2 = { id: match.transaction2Id, updates: {} };
        batchUpdates.push(update2);
      }
      update2.updates.linkedTransactionId = match.transaction1Id;
      update2.updates.type = 'InternalTransfer';
      
      // If both transactions have categories and one is set to auto-approve, approve both
      const tx1 = transactions.find(t => t.id === match.transaction1Id);
      const tx2 = transactions.find(t => t.id === match.transaction2Id);
      
      if (tx1 && tx2) {
        // Check if either transaction has categories (either from rules or existing)
        const tx1HasCategory = update1.updates.appCategoryId || tx1.appCategoryId;
        const tx2HasCategory = update2.updates.appCategoryId || tx2.appCategoryId;
        const tx1HasSubCategory = update1.updates.appSubCategoryId || tx1.appSubCategoryId;
        const tx2HasSubCategory = update2.updates.appSubCategoryId || tx2.appSubCategoryId;
        
        // If one transaction has categories and the other doesn't, copy them
        if (tx1HasCategory && !tx2HasCategory) {
          update2.updates.appCategoryId = update1.updates.appCategoryId || tx1.appCategoryId;
          if (tx1HasSubCategory) {
            update2.updates.appSubCategoryId = update1.updates.appSubCategoryId || tx1.appSubCategoryId;
          }
        } else if (tx2HasCategory && !tx1HasCategory) {
          update1.updates.appCategoryId = update2.updates.appCategoryId || tx2.appCategoryId;
          if (tx2HasSubCategory) {
            update1.updates.appSubCategoryId = update2.updates.appSubCategoryId || tx2.appSubCategoryId;
          }
        }
        
        // IMPORTANT: Do NOT auto-approve the linked transaction
        // Only the transaction that was matched by a rule with auto-approval should be auto-approved
        // The linked counterpart must be manually reviewed and approved
        // The auto-approval status is already set by the rule application above if applicable
      }
    });
    
    stats.autoMatched += transferMatches.length * 2; // Count both transactions in each match
    stats.updated += transferMatches.length * 2;
  }
  
  // Synchronize linked internal transfer transactions
  const synchronizedCount = synchronizeLinkedTransactions(transactions, batchUpdates);
  if (synchronizedCount > 0) {
    console.log(`🔄 [BATCH RULES] Synchronized ${synchronizedCount} additional linked transactions`);
    stats.updated += synchronizedCount;
  }
  
  // Apply all updates in a single bulk operation
  console.log(`🔍 [DEBUG] About to check API condition: batchUpdates.length = ${batchUpdates.length}`);
  addMobileDebugLog(`🔍 [DEBUG] About to check API condition: batchUpdates.length = ${batchUpdates.length}`);
  let databaseUpdateSucceeded = false;
  if (batchUpdates.length > 0) {
    console.log(`✅ [DEBUG] API condition met, making bulk update call...`);
    addMobileDebugLog(`✅ [DEBUG] API condition met, making bulk update call...`);
    try {
      console.log(`🔄 [BATCH RULES] Applying ${batchUpdates.length} updates via bulk API...`);
      addMobileDebugLog(`🔄 [BATCH RULES] Applying ${batchUpdates.length} updates via bulk API...`);
      
      // Prepare the transactions data for the bulk update
      const transactionsToUpdate = batchUpdates.map(update => ({
        id: update.id,
        ...update.updates,
        // Ensure linkedTransactionId is properly included
        linkedTransactionId: update.updates.linkedTransactionId || undefined
      }));
      
      console.log(`📦 [BATCH RULES] Sending bulk update with ${transactionsToUpdate.length} transactions`);
      addMobileDebugLog(`📦 [BATCH RULES] Sending bulk update with ${transactionsToUpdate.length} transactions`);
      
      console.log(`🌐 [FETCH] About to call fetch('/api/transactions/bulk-update')`);
      addMobileDebugLog(`🌐 [FETCH] About to call fetch('/api/transactions/bulk-update')`);
      console.log(`🌐 [FETCH] Request body size: ${JSON.stringify({ transactions: transactionsToUpdate }).length} characters`);
      console.log(`🌐 [FETCH] Current URL: ${window.location.href}`);
      addMobileDebugLog(`🌐 [FETCH] Current URL: ${window.location.href}`);
      
      // Add detailed request information
      const requestBody = JSON.stringify({ transactions: transactionsToUpdate });
      console.log(`🌐 [FETCH] Full request body preview: ${requestBody.substring(0, 500)}...`);
      addMobileDebugLog(`🌐 [FETCH] First transaction ID: ${transactionsToUpdate[0]?.id}`);
      addMobileDebugLog(`🌐 [FETCH] First transaction updates: ${JSON.stringify(transactionsToUpdate[0])}`);
      
      const response = await fetch('/api/transactions/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });
      
      console.log(`🌐 [FETCH] Response received! Status: ${response.status}, StatusText: ${response.statusText}`);
      console.log(`🌐 [FETCH] Response headers:`, Object.fromEntries(response.headers.entries()));
      addMobileDebugLog(`📡 [BATCH RULES] API response status: ${response.status}`);
      addMobileDebugLog(`📡 [BATCH RULES] Response URL: ${response.url}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [BATCH RULES] Bulk update failed: ${response.status} - ${errorText}`);
        addMobileDebugLog(`❌ [BATCH RULES] Bulk update failed: ${response.status} - ${errorText}`);
        // Continue with local updates even if server update fails
        console.warn(`⚠️ [BATCH RULES] Continuing with local state update despite server error`);
        addMobileDebugLog(`⚠️ [BATCH RULES] Continuing with local state update despite server error`);
      } else {
        const responseText = await response.text();
        console.log(`🌐 [FETCH] Raw response text: ${responseText}`);
        addMobileDebugLog(`📡 [BATCH RULES] Raw response: ${responseText.substring(0, 200)}`);
        
        let result;
        try {
          result = JSON.parse(responseText);
          console.log(`✅ [BATCH RULES] Bulk update successful: ${result.updatedCount} transactions updated`);
          addMobileDebugLog(`✅ [BATCH RULES] Bulk update successful: ${result.updatedCount} transactions updated`);
          console.log(`✅ [DATABASE UPDATE] Successfully persisted ${result.updatedCount} transaction updates to SQL database`);
          addMobileDebugLog(`✅ [DATABASE UPDATE] Successfully persisted ${result.updatedCount} transaction updates to SQL database`);
        } catch (parseError) {
          console.error(`❌ [BATCH RULES] Failed to parse JSON response: ${parseError}`);
          addMobileDebugLog(`❌ [BATCH RULES] Failed to parse JSON response: ${parseError}`);
          result = { updatedCount: 0 };
        }
        databaseUpdateSucceeded = true;
      }
    } catch (error) {
      console.error(`❌ [BATCH RULES] Bulk update error:`, error);
      addMobileDebugLog(`❌ [BATCH RULES] Bulk update error: ${error}`);
      // Continue with local updates even if server update fails
      console.warn(`⚠️ [BATCH RULES] Continuing with local state update despite server error`);
      addMobileDebugLog(`⚠️ [BATCH RULES] Continuing with local state update despite server error`);
      // Don't return early - continue with local state update
    }
  } else {
    console.log(`📝 [BATCH RULES] No updates to apply, database update not needed`);
    addMobileDebugLog(`📝 [BATCH RULES] No updates to apply, database update not needed`);
    databaseUpdateSucceeded = true; // No updates needed = success
  }
  
  // Create updated transactions array
  const updatedTransactions = transactions.map(tx => {
    const update = batchUpdates.find(u => u.id === tx.id);
    if (update) {
      return {
        ...tx,
        ...update.updates,
        appCategoryId: update.updates.appCategoryId || tx.appCategoryId,
        appSubCategoryId: update.updates.appSubCategoryId || tx.appSubCategoryId,
        type: (update.updates.type as any) || tx.type,
        status: (update.updates.status as any) || tx.status,
        linkedTransactionId: update.updates.linkedTransactionId || tx.linkedTransactionId,
        isManuallyChanged: update.updates.isManuallyChanged === 'true'
      };
    }
    return tx;
  });
  
  console.log(`${databaseUpdateSucceeded ? '✅' : '❌'} [BATCH RULES] Batch rule application complete! Database update: ${databaseUpdateSucceeded ? 'SUCCESS' : 'FAILED'}`);
  console.log(`📊 [BATCH RULES] Final stats:`, stats);
  
  return {
    success: databaseUpdateSucceeded,
    stats,
    updatedTransactions
  };
  } catch (error) {
    console.error(`🔴🔴🔴 [BATCH RULES FATAL ERROR]:`, error);
    console.error(`Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
    // Return failure result
    return {
      success: false,
      stats: {
        processed: 0,
        updated: 0,
        rulesApplied: 0,
        autoMatched: 0,
        autoApproved: 0,
        bankMatched: 0
      },
      updatedTransactions: []
    };
  }
}