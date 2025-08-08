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
  bankCategory?: string;
  bankSubCategory?: string;
  transactionDirection?: string;
  huvudkategoriId?: string;
  underkategoriId?: string;
  positiveTransactionType?: string;
  negativeTransactionType?: string;
  applicableAccountIds?: string;
  isActive: boolean;
  priority: number;
}

interface BatchUpdate {
  id: string;
  updates: {
    appCategoryId?: string;
    appSubCategoryId?: string;
    type?: string;
    status?: string;
    isManuallyChanged?: string;
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
      bankCategory: rule.bankCategory,
      bankSubCategory: rule.bankSubCategory,
      transactionDirection: rule.transactionDirection || 'all',
      huvudkategoriId: rule.huvudkategoriId,
      underkategoriId: rule.underkategoriId,
      positiveTransactionType: rule.positiveTransactionType,
      negativeTransactionType: rule.negativeTransactionType,
      applicableAccountIds: rule.applicableAccountIds,
      isActive: true,
      priority: rule.priority || 100
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
    
    const isAllBankCategories = rule.bankCategory === 'Alla Bankkategorier' || 
                               rule.bankSubCategory === 'Alla Bankunderkategorier' ||
                               rule.bankCategory === '*' || 
                               rule.bankSubCategory === '*';
    
    // Wildcard matching for bank categories
    if (rule.bankCategory === '*' || rule.bankSubCategory === '*') {
      return rule;
    }
    
    // Bank category + subcategory exact match
    if (rule.bankCategory && rule.bankSubCategory && !isAllBankCategories) {
      if (transaction.bankCategory === rule.bankCategory && 
          transaction.bankSubCategory === rule.bankSubCategory) {
        return rule;
      }
    }
    // Bank category only match
    else if (rule.bankCategory && !rule.bankSubCategory && !isAllBankCategories) {
      if (transaction.bankCategory === rule.bankCategory) {
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
      // Normal text matching
      if (transactionText.includes(rule.transactionName)) {
        return rule;
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
  
  // Auto-approve if both categories are set
  if (rule.huvudkategoriId && rule.underkategoriId && transaction.status !== 'green') {
    updates.status = 'green';
    hasUpdates = true;
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
      status: 'green',
      isManuallyChanged: 'false'
    }
  };
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
            ...update.updates
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