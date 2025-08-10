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
 */
function autoMatchInternalTransfers(
  transactions: ImportedTransaction[]
): Array<{ transaction1Id: string; transaction2Id: string }> {
  console.log('🔍 [BATCH RULES] Auto-matching internal transfer transactions...');
  
  const matches: Array<{ transaction1Id: string; transaction2Id: string }> = [];
  const processedIds = new Set<string>();
  
  // Find all InternalTransfer transactions that don't have linked transactions
  const unmatchedTransfers = transactions.filter(tx => 
    tx.type === 'InternalTransfer' && !tx.linkedTransactionId
  );
  
  console.log(`[BATCH RULES] Found ${unmatchedTransfers.length} unmatched internal transfers`);
  
  unmatchedTransfers.forEach(transaction => {
    // Skip if already processed
    if (processedIds.has(transaction.id)) {
      return;
    }
    
    // Find potential matches on the same date with opposite signs on different accounts
    const potentialMatches = transactions.filter(t => {
      return t.id !== transaction.id &&
        t.accountId !== transaction.accountId && // Different account
        t.date === transaction.date && // Same date only
        // Opposite signs (positive matches negative, negative matches positive)
        ((transaction.amount > 0 && t.amount < 0) || (transaction.amount < 0 && t.amount > 0)) &&
        Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01 && // Same absolute amount
        !t.linkedTransactionId && // Not already linked
        !processedIds.has(t.id); // Not already processed
    });
    
    // If exactly one match found, auto-link them
    if (potentialMatches.length === 1) {
      const matchedTransaction = potentialMatches[0];
      console.log(`[BATCH RULES] Auto-matching ${transaction.id} with ${matchedTransaction.id}`);
      
      matches.push({
        transaction1Id: transaction.id,
        transaction2Id: matchedTransaction.id
      });
      
      // Mark both as processed to avoid duplicate matching
      processedIds.add(transaction.id);
      processedIds.add(matchedTransaction.id);
    }
  });
  
  console.log(`✅ [BATCH RULES] Found ${matches.length} matching internal transfer pairs`);
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
    
    // If the first transaction is auto-approved, also approve the linked one
    if (update.updates.status === 'green') {
      linkedUpdate.updates.status = 'green';
    }
    
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
  console.log(`🚀 [BATCH RULES] Starting optimized batch processing: ${transactions.length} transactions, ${rules.length} rules`);
  
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
  
  // Auto-match internal transfer transactions first
  const transferMatches = autoMatchInternalTransfers(transactions);
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
        // Check if both have categories (either from rules or existing)
        const tx1HasCategory = update1.updates.appCategoryId || tx1.appCategoryId;
        const tx2HasCategory = update2.updates.appCategoryId || tx2.appCategoryId;
        
        if (tx1HasCategory && tx2HasCategory) {
          // Auto-approve both since they're matched and categorized
          update1.updates.status = 'green';
          update2.updates.status = 'green';
          stats.autoApproved += 2;
        }
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
  if (batchUpdates.length > 0) {
    try {
      console.log(`🔄 [BATCH RULES] Applying ${batchUpdates.length} updates via bulk API...`);
      
      const response = await fetch('/api/transactions/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: batchUpdates.map(update => ({
            id: update.id,
            ...update.updates,
            // Ensure linkedTransactionId is properly included
            linkedTransactionId: update.updates.linkedTransactionId || undefined
          }))
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ [BATCH RULES] Bulk update successful: ${result.updatedCount} transactions updated`);
      } else {
        console.error(`❌ [BATCH RULES] Bulk update failed: ${response.status}`);
        return { success: false, stats, updatedTransactions: [] };
      }
    } catch (error) {
      console.error(`❌ [BATCH RULES] Bulk update error:`, error);
      return { success: false, stats, updatedTransactions: [] };
    }
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
  
  console.log(`✅ [BATCH RULES] Batch rule application complete!`);
  console.log(`📊 [BATCH RULES] Final stats:`, stats);
  
  return {
    success: true,
    stats,
    updatedTransactions
  };
}