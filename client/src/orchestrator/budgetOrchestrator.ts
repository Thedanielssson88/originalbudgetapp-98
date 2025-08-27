// Single Source of Truth Orchestrator - Simplified architecture

import { state, initializeStateFromStorage, saveStateToStorage, getCurrentMonthData, updateCurrentMonthData } from '../state/budgetState';
import { calculateFullPrognosis, calculateBudgetResults, calculateAccountProgression, calculateMonthlyBreakdowns, calculateProjectedBalances, applyCategorizationRules, determineTransactionStatus } from '../services/calculationService';
import { BudgetGroup, MonthData, SavingsGoal, CsvMapping, PlannedTransfer, Transaction } from '../types/budget';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import { v4 as uuidv4 } from 'uuid';
import { ImportedTransaction } from '../types/transaction';
import { CategoryRule } from '../types/budget';
import { simpleGoogleDriveService } from '../services/simpleGoogleDriveService';
import { monthlyBudgetService } from '../services/monthlyBudgetService';
import { apiStore } from '../store/apiStore';
import { parseInputToOren, kronoraToOren } from '../utils/currencyUtils';

/**
 * Creates a budget post payload with automatic accountUserBalance sync
 * If autoUpdateBalance setting is true, sets accountUserBalance = accountBalance
 */
async function createBudgetPostPayload(basePayload: any): Promise<any> {
  try {
    const settingsResponse = await fetch('/api/user-settings/autoUpdateBalance');
    let autoUpdateEnabled = true; // Default to true when setting doesn't exist
    
    if (settingsResponse.ok) {
      const autoUpdateSetting = await settingsResponse.json();
      autoUpdateEnabled = autoUpdateSetting?.settingValue === 'true';
      console.log(`[ORCHESTRATOR] 🔍 Found auto-update setting: ${autoUpdateEnabled}`);
    } else if (settingsResponse.status === 404) {
      console.log(`[ORCHESTRATOR] ⚪ Auto-update setting not found, defaulting to enabled`);
    } else {
      console.log(`[ORCHESTRATOR] ⚠️ Failed to fetch auto-update setting, defaulting to enabled`);
    }
    
    // Create the payload
    const payload = { ...basePayload };
    
    // If auto-update is enabled AND accountBalance is being set, also set accountUserBalance
    if (autoUpdateEnabled && basePayload.accountBalance !== undefined) {
      payload.accountUserBalance = basePayload.accountBalance;
      console.log(`[ORCHESTRATOR] 🔄 Auto-update enabled: setting both accountBalance and accountUserBalance to ${basePayload.accountBalance / 100} kr`);
      addMobileDebugLog(`🔄 Auto-update enabled: syncing user balance to ${(basePayload.accountBalance / 100).toFixed(2)} kr`);
    } else if (!autoUpdateEnabled) {
      console.log(`[ORCHESTRATOR] ⚪ Auto-update disabled: only setting accountBalance`);
    }
    
    return payload;
    
  } catch (error) {
    console.log(`[ORCHESTRATOR] ⚠️ Failed to check auto-update setting, defaulting to enabled:`, error);
    // Default to enabled when there's an error
    const payload = { ...basePayload };
    if (basePayload.accountBalance !== undefined) {
      payload.accountUserBalance = basePayload.accountBalance;
      console.log(`[ORCHESTRATOR] 🔄 Auto-update enabled (fallback): setting both accountBalance and accountUserBalance to ${basePayload.accountBalance / 100} kr`);
      addMobileDebugLog(`🔄 Auto-update enabled (fallback): syncing user balance to ${(basePayload.accountBalance / 100).toFixed(2)} kr`);
    }
    return payload;
  }
}

/**
 * Matches bank categories to system categories based on exact name matching
 * Returns {appCategoryId, appSubCategoryId} if found, null otherwise
 */
async function matchBankCategoriesToSystemCategories(bankCategory: string, bankSubCategory: string): Promise<{appCategoryId: string, appSubCategoryId: string} | null> {
  try {
    // Skip if bank categories are empty or whitespace
    if (!bankCategory || !bankSubCategory || !bankCategory.trim() || !bankSubCategory.trim()) {
      console.log(`[BANK CATEGORY MATCHING] Skipping empty bank categories: "${bankCategory}" / "${bankSubCategory}"`);
      return null;
    }
    
    console.log(`[BANK CATEGORY MATCHING] Attempting to match: "${bankCategory}" / "${bankSubCategory}"`);
    
    // Fetch system categories from database with simple error handling
    let huvudkategorierResponse, underkategorierResponse;
    try {
      [huvudkategorierResponse, underkategorierResponse] = await Promise.all([
        fetch('/api/huvudkategorier', { 
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/underkategorier', { 
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
      ]);
    } catch (error) {
      console.log(`[BANK CATEGORY MATCHING] Failed to fetch categories from API:`, error.message);
      return null;
    }
    
    if (!huvudkategorierResponse.ok || !underkategorierResponse.ok) {
      console.log(`[BANK CATEGORY MATCHING] API responses not OK: huvudkategorier=${huvudkategorierResponse.status}, underkategorier=${underkategorierResponse.status}`);
      return null;
    }
    
    const huvudkategorier = await huvudkategorierResponse.json();
    const underkategorier = await underkategorierResponse.json();
    
    if (!Array.isArray(huvudkategorier) || !Array.isArray(underkategorier)) {
      console.log('[BANK CATEGORY MATCHING] Invalid response format from APIs');
      return null;
    }
    
    console.log(`[BANK CATEGORY MATCHING] Fetched ${huvudkategorier.length} huvudkategorier, ${underkategorier.length} underkategorier`);
    
    // Find matching huvudkategori by exact name match (case insensitive)
    const matchingHuvudkategori = huvudkategorier.find((kat: any) => 
      kat.name && kat.name.toLowerCase().trim() === bankCategory.toLowerCase().trim()
    );
    
    if (!matchingHuvudkategori) {
      console.log(`[BANK CATEGORY MATCHING] No matching huvudkategori found for: "${bankCategory}"`);
      return null;
    }
    
    // Find matching underkategori by exact name match and belonging to the huvudkategori
    const matchingUnderkategori = underkategorier.find((kat: any) => 
      kat.name && kat.name.toLowerCase().trim() === bankSubCategory.toLowerCase().trim() &&
      kat.huvudkategoriId === matchingHuvudkategori.id
    );
    
    if (!matchingUnderkategori) {
      console.log(`[BANK CATEGORY MATCHING] No matching underkategori found for: "${bankSubCategory}" under "${bankCategory}"`);
      return null;
    }
    
    console.log(`[BANK CATEGORY MATCHING] ✅ Found match: "${bankCategory}" -> "${matchingHuvudkategori.name}" (${matchingHuvudkategori.id}), "${bankSubCategory}" -> "${matchingUnderkategori.name}" (${matchingUnderkategori.id})`);
    
    return {
      appCategoryId: matchingHuvudkategori.id,
      appSubCategoryId: matchingUnderkategori.id
    };
    
  } catch (error) {
    console.log('[BANK CATEGORY MATCHING] Error matching categories:', error);
    console.log('[BANK CATEGORY MATCHING] Continuing import without bank category matching...');
    return null;
  }
}

/**
 * Simple bank category matching using hardcoded mappings (no API calls)
 * This is a fallback approach that doesn't require network requests
 */
async function matchBankCategoriesSimple(bankCategory: string, bankSubCategory: string): Promise<{appCategoryId: string, appSubCategoryId: string} | null> {
  try {
    console.log(`[BANK CATEGORY SIMPLE] Attempting simple match for: "${bankCategory}" / "${bankSubCategory}"`);
    
    // Common bank category mappings (you can extend this as needed)
    const bankCategoryMappings: {[key: string]: {[key: string]: {appCategoryId: string, appSubCategoryId: string}}} = {
      "Mat & dryck": {
        "Livsmedel": { appCategoryId: "8424bc25-493b-4983-8349-7c0c33bd8d2a", appSubCategoryId: "5e841229-e512-411c-8f0c-a093b324a34a" },
        "Restaurang & Kafé": { appCategoryId: "8424bc25-493b-4983-8349-7c0c33bd8d2a", appSubCategoryId: "53e6e79f-b4c8-47be-bbd7-9a7e4eb6638e" },
        "Fastfood & take-away": { appCategoryId: "8424bc25-493b-4983-8349-7c0c33bd8d2a", appSubCategoryId: "26e96527-f132-417f-ac1f-07842cf51770" }
      },
      "Transport": {
        "Bränsle": { appCategoryId: "4f884437-16c1-4893-b3a6-1320c7c2ada8", appSubCategoryId: "0b5c89f1-5771-4161-b364-1635b4eac57b" },
        "Kollektivtrafik & Taxi": { appCategoryId: "4f884437-16c1-4893-b3a6-1320c7c2ada8", appSubCategoryId: "11106080-7ae2-4d6f-a666-018f6f9c2a92" }
      },
      "Hushåll": {
        "El & Värme": { appCategoryId: "ead69b7f-51d2-43b4-bc08-638053392877", appSubCategoryId: "ba5151bb-384b-44b8-b096-14f0466b2695" },
        "Hemelektronik & Vitvaror": { appCategoryId: "ead69b7f-51d2-43b4-bc08-638053392877", appSubCategoryId: "684d9237-4fbc-46a4-9a8d-5c9606596e63" }
      }
      // Add more mappings as needed based on your bank's categories
    };
    
    const trimmedBankCategory = bankCategory.trim();
    const trimmedBankSubCategory = bankSubCategory.trim();
    const categoryMapping = bankCategoryMappings[trimmedBankCategory]?.[trimmedBankSubCategory];
    
    console.log(`[BANK CATEGORY SIMPLE] 🔍 DEBUG - looking for mapping:`);
    console.log(`[BANK CATEGORY SIMPLE] 🔍 DEBUG - trimmedBankCategory: "${trimmedBankCategory}"`);
    console.log(`[BANK CATEGORY SIMPLE] 🔍 DEBUG - trimmedBankSubCategory: "${trimmedBankSubCategory}"`);
    console.log(`[BANK CATEGORY SIMPLE] 🔍 DEBUG - available main categories:`, Object.keys(bankCategoryMappings));
    if (bankCategoryMappings[trimmedBankCategory]) {
      console.log(`[BANK CATEGORY SIMPLE] 🔍 DEBUG - available subcategories for "${trimmedBankCategory}":`, Object.keys(bankCategoryMappings[trimmedBankCategory]));
    }
    
    if (categoryMapping) {
      console.log(`[BANK CATEGORY SIMPLE] ✅ Found mapping: "${bankCategory}" / "${bankSubCategory}" -> ${categoryMapping.appCategoryId}/${categoryMapping.appSubCategoryId}`);
      return categoryMapping;
    } else {
      console.log(`[BANK CATEGORY SIMPLE] No mapping found for: "${bankCategory}" / "${bankSubCategory}"`);
      return null;
    }
    
  } catch (error) {
    console.log('[BANK CATEGORY SIMPLE] Error in simple matching:', error);
    return null;
  }
}

/**
 * Apply the SAME rules as "Applicera regler på filtrerade transaktioner" with selective field protection
 * This ensures import uses identical logic to manual rule application
 * STEP 1: Apply PostgreSQL rules first (priority over bank matching)
 * STEP 2: Bank category matching as fallback for empty categories
 */
async function applyImportRulesWithProtection(transaction: any, categoryRules: any[]): Promise<any> {
  const originalTransaction = { ...transaction };
  const isManuallyChanged = transaction.isManuallyChanged === true || transaction.isManuallyChanged === 'true';
  const isStatusGreen = transaction.status === 'green';
  
  // Debug logging
  console.log(`[IMPORT RULES] === Processing transaction: "${transaction.description}" ===`);
  console.log(`[IMPORT RULES] Received ${categoryRules?.length || 0} rules`);
  console.log(`[IMPORT RULES] Transaction account: ${transaction.accountId}`);
  console.log(`[IMPORT RULES] isStatusGreen: ${isStatusGreen}, isManuallyChanged: ${isManuallyChanged}`);
  console.log(`[IMPORT RULES] 🔍 ENTRY DEBUG - bankCategory: "${transaction.bankCategory}", bankSubCategory: "${transaction.bankSubCategory}"`);
  console.log(`[IMPORT RULES] 🔍 ENTRY DEBUG - appCategoryId: "${transaction.appCategoryId}", appSubCategoryId: "${transaction.appSubCategoryId}"`);
  
  // Ensure categoryRules is always an array
  if (!Array.isArray(categoryRules)) {
    categoryRules = [];
  }
  
  // CRITICAL FIX: If no rules passed, fetch them directly
  if (categoryRules.length === 0) {
    console.log(`[IMPORT RULES] ⚠️ No rules provided, attempting to fetch from API...`);
    try {
      const response = await fetch('/api/category-rules');
      if (response.ok) {
        const fetchedRules = await response.json();
        if (Array.isArray(fetchedRules)) {
          categoryRules = fetchedRules;
          console.log(`[IMPORT RULES] ✅ Fetched ${categoryRules.length} rules from API`);
        } else {
          console.log(`[IMPORT RULES] ⚠️ Invalid rules format from API, continuing without rules`);
          categoryRules = [];
        }
      } else {
        console.log(`[IMPORT RULES] ⚠️ Failed to fetch rules (status: ${response.status} ${response.statusText}), continuing without rules`);
        categoryRules = [];
      }
    } catch (error) {
      console.log(`[IMPORT RULES] ⚠️ Network error fetching category rules, continuing without auto-categorization:`, error?.message || error);
      categoryRules = [];
    }
  }
  
  // PROTECTION: Skip green status transactions (don't change them at all)
  if (isStatusGreen) {
    console.log(`[IMPORT RULES] ⏭️ SKIPPING - Green status transaction: "${transaction.description}"`);
    return originalTransaction;
  }
  
  // PROTECTION: Skip manually changed transactions (don't apply rules to them)
  if (isManuallyChanged) {
    console.log(`[IMPORT RULES] ⏭️ SKIPPING - Manually changed transaction: "${transaction.description}"`);
    return originalTransaction;
  }
  
  // Apply the same rule logic as the manual "Applicera regler" button
  let workingTransaction = { ...transaction };
  let ruleMatched = false;
  
  // STEP 1: Check each PostgreSQL rule (same logic as manual button)
  for (const rule of categoryRules) {
    // Check if rule is active
    const isActive = rule.isActive === 'true';
    if (!isActive) {
      console.log(`[IMPORT RULES] ⏭️ Rule "${rule.ruleName}" is inactive, skipping`);
      continue;
    }
    
    let matchFound = false;
    console.log(`[IMPORT RULES] 🔍 Checking rule "${rule.ruleName}"`);
    
    // Check account restrictions (same logic as manual button)
    if (rule.applicableAccountIds && rule.applicableAccountIds !== '[]') {
      try {
        const applicableAccounts = JSON.parse(rule.applicableAccountIds);
        if (applicableAccounts.length > 0 && !applicableAccounts.includes(transaction.accountId)) {
          console.log(`[IMPORT RULES] ⏭️ Rule skipped - account mismatch`);
          continue;
        }
      } catch (e) {
        console.log('[IMPORT RULES] Failed to parse applicableAccountIds:', rule.applicableAccountIds);
      }
    }
    
    // Rule matching logic (same as manual button)
    const isAllBankCategories = rule.bankhuvudkategori === 'Alla Bankkategorier' || rule.bankunderkategori === 'Alla Bankunderkategorier';
    
    if (rule.bankhuvudkategori && rule.bankunderkategori && !isAllBankCategories) {
      // Exact bank category + subcategory match
      if (transaction.bankCategory === rule.bankhuvudkategori && 
          transaction.bankSubCategory === rule.bankunderkategori) {
        matchFound = true;
        console.log(`[IMPORT RULES] ✅ Exact bank category match: ${rule.bankhuvudkategori} → ${rule.bankunderkategori}`);
      }
    } else if (rule.bankhuvudkategori && !rule.bankunderkategori && !isAllBankCategories) {
      // Exact bank category match (any subcategory)
      if (transaction.bankCategory === rule.bankhuvudkategori) {
        matchFound = true;
        console.log(`[IMPORT RULES] ✅ Bank category match: ${rule.bankhuvudkategori}`);
      }
    } else {
      // Text-based matching (same as manual button)
      const transactionText = transaction.description?.toLowerCase() || '';
      const ruleText = rule.transactionName?.toLowerCase() || '';
      
      console.log(`[IMPORT RULES] 🔍 Text matching - Transaction: "${transactionText}", Rule: "${ruleText}"`);
      
      if (ruleText && transactionText.includes(ruleText)) {
        matchFound = true;
        console.log(`[IMPORT RULES] ✅ TEXT MATCH FOUND: "${ruleText}" in "${transactionText}"`);
      }
    }
    
    if (matchFound) {
      console.log(`[IMPORT RULES] 🎯 RULE MATCHED: "${rule.ruleName}" for "${transaction.description}"`);
      
      // Apply categories (same as manual button)
      workingTransaction.appCategoryId = rule.huvudkategoriId;
      workingTransaction.appSubCategoryId = rule.underkategoriId;
      
      // Apply transaction type based on amount (same as manual button)
      const isPositive = transaction.amount >= 0;
      workingTransaction.type = isPositive ? 
        (rule.positiveTransactionType || 'Transaction') : 
        (rule.negativeTransactionType || 'Transaction');
      
      console.log(`[IMPORT RULES] ✅ Applied rule: categories=${rule.huvudkategoriId}/${rule.underkategoriId}, type=${workingTransaction.type}`);
      
      // Check auto-approval setting from rule
      if (rule.autoApproval === true && rule.huvudkategoriId && rule.underkategoriId) {
        workingTransaction.status = 'green';
        console.log(`[IMPORT RULES] ✅ Auto-approved transaction (autoApproval=true)`);
      } else if (rule.huvudkategoriId && rule.underkategoriId) {
        // Keep default behavior for rules without auto-approval
        console.log(`[IMPORT RULES] ℹ️ Rule applied but not auto-approved (autoApproval=${rule.autoApproval})`);
      }
      
      ruleMatched = true;
      break; // Stop checking other rules
    }
  }
  
  // STEP 2: Bank category fallback if no rules matched (use simple matching)
  if (!ruleMatched && transaction.bankCategory && transaction.bankSubCategory) {
    console.log(`[IMPORT RULES] 🏦 No rules matched, attempting bank category fallback for: "${transaction.bankCategory}" / "${transaction.bankSubCategory}"`);
    
    try {
      // Use simple name-based matching (same as manual button)
      const matchedCategories = await matchBankCategoriesSimple(
        transaction.bankCategory, 
        transaction.bankSubCategory
      );
      
      if (matchedCategories) {
        workingTransaction.appCategoryId = matchedCategories.appCategoryId;
        workingTransaction.appSubCategoryId = matchedCategories.appSubCategoryId;
        console.log(`[IMPORT RULES] ✅ Bank category fallback applied: ${matchedCategories.appCategoryId}/${matchedCategories.appSubCategoryId}`);
      } else {
        console.log(`[IMPORT RULES] ℹ️ No bank category fallback match found`);
      }
    } catch (error) {
      console.log(`[IMPORT RULES] ⚠️ Bank category fallback failed:`, error);
    }
  }
  
  return workingTransaction;
}

// SMART MERGE FUNCTION - The definitive solution to duplicate and lost changes
export async function importAndReconcileFile(csvContent: string, accountId: string, categoryRules?: any[]): Promise<void> {
  console.log(`🚨 ORCHESTRATOR FUNCTION CALLED - accountId: ${accountId}`);
  addMobileDebugLog(`🚨 ORCHESTRATOR FUNCTION CALLED for ${accountId}`);
  console.log(`[ORCHESTRATOR] 🔥 Smart merge starting for account ${accountId}`);
  addMobileDebugLog(`🔥 IMPORT STARTED for account ${accountId}`);
  
  // Clean up encoding issues before parsing
  const cleanedCsvContent = csvContent
    .replace(/�/g, '') // Remove � characters
    .replace(/Ã¥/g, 'å') // Fix å
    .replace(/Ã¤/g, 'ä') // Fix ä  
    .replace(/Ã¶/g, 'ö') // Fix ö
    .replace(/Ã…/g, 'Å') // Fix Å
    .replace(/Ã„/g, 'Ä') // Fix Ä
    .replace(/Ã–/g, 'Ö'); // Fix Ö
  
  console.log(`[ORCHESTRATOR] 🧹 CSV content cleaned from ${csvContent.length} to ${cleanedCsvContent.length} characters`);
  
  // 1. Parse CSV content and get mapping info
  const parseResult = parseCSVContentWithMapping(cleanedCsvContent, accountId, 'imported');
  const transactionsFromFile = parseResult.transactions;
  const csvMapping = parseResult.mapping;
  
  console.log(`[ORCHESTRATOR] 💰 CSV parsing result:`, {
    transactionsCount: transactionsFromFile.length,
    mappingExists: !!csvMapping,
    mapping: csvMapping
  });
  
  addMobileDebugLog(`🔥 Parsed ${transactionsFromFile.length} transactions from CSV`);
  if (transactionsFromFile.length === 0) {
    console.log(`[ORCHESTRATOR] ⚠️ No transactions found in CSV - but storing raw data for column mapping`);
    addMobileDebugLog(`⚠️ No transactions found in CSV - raw data stored for mapping`);
    
    // Store raw CSV data for column mapping interface even if parsing failed
    const lines = cleanedCsvContent.split('\n').filter(line => line.trim());
    const headers = (lines[0] || '').split(';').map(h => h.trim());
    addMobileDebugLog(`📋 Available CSV columns: ${headers.join(', ')}`);
    
    // Still trigger UI refresh so user can access column mapping
    triggerUIRefresh();
    return;
  }
  
  
  // 2. Define date range of the file using string dates (YYYY-MM-DD format)  
  const isLargeFile = transactionsFromFile.length > 200;
  
  if (!isLargeFile) {
    console.log(`[ORCHESTRATOR] 📊 Raw transactions from file:`, transactionsFromFile.map(t => ({ date: t.date, desc: t.description.substring(0, 30) })));
  } else {
    console.log(`[ORCHESTRATOR] 📊 Large file detected: ${transactionsFromFile.length} transactions - reducing logging`);
  }
  addMobileDebugLog(`📊 Raw transactions: ${transactionsFromFile.length} found`);
  
  const fileDates = (transactionsFromFile || []).map((t, index) => {
    const dateStr = t.date.split('T')[0];
    
    // Reduce per-transaction logging for large files
    if (!isLargeFile) {
      console.log(`[ORCHESTRATOR] 📊 Transaction ${index}: "${t.date}" -> "${dateStr}" (Amount: ${t.amount}, Description: "${t.description}")`);
      addMobileDebugLog(`📊 TX ${index}: ${dateStr} - ${t.amount} - "${t.description?.substring(0, 30)}"`);
    } else {
      // Only log every 100th transaction for large files
      if (index % 100 === 0 || index === transactionsFromFile.length - 1) {
        console.log(`[ORCHESTRATOR] 📊 Progress: ${index + 1}/${transactionsFromFile.length} transactions processed`);
        addMobileDebugLog(`📊 Progress: ${index + 1}/${transactionsFromFile.length}`);
      }
    }
    
    // Special logging for April transactions (keep but reduce for large files)
    if (dateStr.startsWith('2025-04') && (!isLargeFile || index < 10)) {
      console.log(`[ORCHESTRATOR] 🔍 APRIL TRANSACTION FOUND: ${dateStr} - ${t.amount} - "${t.description}"`);
      if (!isLargeFile) {
        addMobileDebugLog(`🔍 APRIL TX: ${dateStr} - ${t.amount} - "${t.description?.substring(0, 30)}"`);
      }
    }
    
    return dateStr;
  });
  
  if (!isLargeFile) {
    addMobileDebugLog(`📊 Processed dates: ${fileDates.sort().join(', ')}`);
  }
  
  const minDateStr = fileDates.reduce((min, date) => date < min ? date : min);
  const maxDateStr = fileDates.reduce((max, date) => date > max ? date : max);
  
  console.log(`[ORCHESTRATOR] 📅 File date range: ${minDateStr} to ${maxDateStr}`);
  addMobileDebugLog(`📅 FILE RANGE: ${minDateStr} to ${maxDateStr}`);
  
  if (!isLargeFile) {
    addMobileDebugLog(`📅 All file dates: ${fileDates.sort().join(', ')}`);
  }
  console.log(`[ORCHESTRATOR] 📅 File contains ${transactionsFromFile.length} transactions`);
  addMobileDebugLog(`📅 File contains ${transactionsFromFile.length} transactions`);
  
  // 3. Get ALL existing transactions from centralized storage
  const allSavedTransactions = (state.budgetState.allTransactions || []).map(t => ({
    id: t.id,
    accountId: t.accountId,
    date: t.date,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    description: t.description,
    userDescription: t.userDescription,
    type: t.type as ImportedTransaction['type'],
    status: t.status as ImportedTransaction['status'],
    linkedTransactionId: t.linkedTransactionId,
    correctedAmount: t.correctedAmount,
    isManuallyChanged: t.isManuallyChanged,
    appCategoryId: t.appCategoryId,
    appSubCategoryId: t.appSubCategoryId,
    importedAt: (t as any).importedAt || new Date().toISOString(),
    fileSource: (t as any).fileSource || 'budgetState'
  } as ImportedTransaction));
  
  console.log(`[ORCHESTRATOR] 📅 Found ${allSavedTransactions.length} existing transactions total`);
  addMobileDebugLog(`📅 Found ${allSavedTransactions.length} existing transactions total`);
  
  const existingForAccount = (allSavedTransactions || []).filter(t => t.accountId === accountId).map(t => t.date.split('T')[0]).sort();
  console.log(`[ORCHESTRATOR] 📅 Found ${existingForAccount.length} existing transactions for account`);
  
  if (!isLargeFile) {
    console.log(`[ORCHESTRATOR] 📅 Existing transactions for account ${accountId}:`, existingForAccount);
    addMobileDebugLog(`📅 Existing transactions for account ${accountId}: ${existingForAccount.join(', ')}`);
  } else {
    addMobileDebugLog(`📅 Found ${existingForAccount.length} existing transactions for account`);
  }
  
  // 4. ENHANCED: Remove transactions within date range and perform aggressive duplicate cleanup
  let keepCount = 0;
  let removeCount = 0;
  const transactionsToKeep = allSavedTransactions.filter(t => {
    if (t.accountId !== accountId) return true; // Keep all transactions from other accounts
    
    // Normalize existing transaction date to YYYY-MM-DD format
    const existingDateStr = t.date.split('T')[0];
    
    // ENHANCED: Only remove if date is WITHIN the new file's range (inclusive)
    const isInFileRange = existingDateStr >= minDateStr && existingDateStr <= maxDateStr;
    
    if (!isLargeFile) {
      console.log(`[ORCHESTRATOR] 🔍 Checking transaction ${existingDateStr}:`);
      console.log(`[ORCHESTRATOR] 🔍   - >= ${minDateStr}: ${existingDateStr >= minDateStr}`);
      console.log(`[ORCHESTRATOR] 🔍   - <= ${maxDateStr}: ${existingDateStr <= maxDateStr}`);
      console.log(`[ORCHESTRATOR] 🔍   - isInFileRange: ${isInFileRange}`);
      console.log(`[ORCHESTRATOR] 🔍   - Decision: ${isInFileRange ? 'REMOVE (in range)' : 'KEEP (outside range)'}`);
    }
    
    // Track counts for performance optimization
    if (isInFileRange) {
      removeCount++;
    } else {
      keepCount++;
    }
    
    return !isInFileRange; // Keep transactions OUTSIDE the file's date range
  });
  
  // ENHANCED: Additional duplicate detection across time variations
  console.log(`[ORCHESTRATOR] 🧹 Enhanced duplicate detection: checking for time-based duplicates...`);
  const enhancedDeduplication = new Map<string, ImportedTransaction>();
  allSavedTransactions.forEach(t => {
    const fingerprint = createTransactionFingerprint(t);
    const existing = enhancedDeduplication.get(fingerprint);
    
    if (existing) {
      // Keep the transaction with the most manual changes or most recent
      const betterTransaction = (existing.isManuallyChanged && !t.isManuallyChanged) ? existing :
                               (!existing.isManuallyChanged && t.isManuallyChanged) ? t :
                               new Date(existing.date) > new Date(t.date) ? existing : t;
      enhancedDeduplication.set(fingerprint, betterTransaction);
      console.log(`[ORCHESTRATOR] 🔧 Resolved time-based duplicate: ${fingerprint}`);
    } else {
      enhancedDeduplication.set(fingerprint, t);
    }
  });
  
  // 5. Create map of existing transactions for smart merge with enhanced duplicate detection
  const savedTransactionsMap = new Map<string, ImportedTransaction>();
  const duplicateGroups = new Map<string, ImportedTransaction[]>(); // Track potential duplicates
  
  (allSavedTransactions || []).forEach(t => {
    const fingerprint = createTransactionFingerprint(t);
    const existing = savedTransactionsMap.get(fingerprint);
    
    if (existing) {
      // Found potential duplicate - group them for resolution
      if (!duplicateGroups.has(fingerprint)) {
        duplicateGroups.set(fingerprint, [existing]);
      }
      duplicateGroups.get(fingerprint)!.push(t);
      console.log(`[ORCHESTRATOR] 🔍 Found potential duplicate: ${fingerprint}`);
    } else {
      savedTransactionsMap.set(fingerprint, t);
    }
  });
  
  // Resolve duplicates by keeping the most complete transaction (with manual changes or latest)
  duplicateGroups.forEach((duplicates, fingerprint) => {
    console.log(`[ORCHESTRATOR] 🔧 Resolving ${duplicates.length} duplicates for: ${fingerprint}`);
    
    // Prefer transactions with manual changes, then most recent
    const bestTransaction = duplicates.reduce((best, current) => {
      if (current.isManuallyChanged && !best.isManuallyChanged) return current;
      if (!current.isManuallyChanged && best.isManuallyChanged) return best;
      // If both or neither have manual changes, prefer the most recent
      return new Date(current.date) > new Date(best.date) ? current : best;
    });
    
    savedTransactionsMap.set(fingerprint, bestTransaction);
    console.log(`[ORCHESTRATOR] ✅ Kept best transaction: ${bestTransaction.id} (manually changed: ${!!bestTransaction.isManuallyChanged})`);
  });
  
  // Update transactionsToKeep to exclude duplicates that were resolved
  const resolvedTransactionIds = new Set();
  duplicateGroups.forEach((duplicates, fingerprint) => {
    const kept = savedTransactionsMap.get(fingerprint);
    duplicates.forEach(dup => {
      if (dup.id !== kept?.id) {
        resolvedTransactionIds.add(dup.id);
      }
    });
  });
  
  // Filter out resolved duplicates from transactionsToKeep
  const originalKeepCount = transactionsToKeep.length;
  let filteredTransactionsToKeep = transactionsToKeep.filter(t => !resolvedTransactionIds.has(t.id));
  
  console.log(`[ORCHESTRATOR] 🧹 Kept ${filteredTransactionsToKeep.length} transactions (removed ${originalKeepCount - filteredTransactionsToKeep.length} duplicates), removing ${allSavedTransactions.length - originalKeepCount} within date range, resolved ${duplicateGroups.size} duplicate groups`);
  
  // 6. Intelligent merge with SAME rule logic as manual "Applicera regler på filtrerade transaktioner"
  const mergedTransactions = await Promise.all((transactionsFromFile || []).map(async (fileTx) => {
    const fingerprint = createTransactionFingerprint(fileTx);
    const existingTx = savedTransactionsMap.get(fingerprint);

    if (existingTx) {
      // CRITICAL FIX: ALWAYS update bank fields from file for ALL existing transactions
      console.log(`[ORCHESTRATOR] 🔄 Found existing transaction: ${fileTx.description}`);
      console.log(`[ORCHESTRATOR] 🔄 OLD bankCategory: "${existingTx.bankCategory || 'EMPTY'}" -> NEW: "${fileTx.bankCategory || 'EMPTY'}"`);
      console.log(`[ORCHESTRATOR] 🔄 OLD bankSubCategory: "${existingTx.bankSubCategory || 'EMPTY'}" -> NEW: "${fileTx.bankSubCategory || 'EMPTY'}"`);
      console.log(`[ORCHESTRATOR] 🔄 isManuallyChanged: ${existingTx.isManuallyChanged || false}`);
      
      // Create base updated transaction with ALL bank data from file
      const baseUpdatedTx = {
        ...existingTx,
        // ALWAYS update these fields from file data for ALL transactions
        bankCategory: fileTx.bankCategory,
        bankSubCategory: fileTx.bankSubCategory,
        bankStatus: fileTx.bankStatus,
        balanceAfter: fileTx.balanceAfter,
        fileSource: fileTx.fileSource,
        // Preserve basic transaction data from file
        date: fileTx.date,
        amount: fileTx.amount,
        description: fileTx.description,
      };
      
      // Apply SAME rule logic as manual button with protection
      const processedTransaction = await applyImportRulesWithProtection(baseUpdatedTx, categoryRules || []);
      console.log(`[ORCHESTRATOR] ✅ Import rule processing complete for existing transaction`);
      return processedTransaction;
    }
    
    // New transaction - apply SAME rule logic as manual button
    console.log(`[ORCHESTRATOR] 🔄 Processing new transaction: ${fileTx.description}, bankCategory: ${fileTx.bankCategory} / ${fileTx.bankSubCategory}`);
    const processedTransaction = await applyImportRulesWithProtection(fileTx, categoryRules || []);
    console.log(`[ORCHESTRATOR] ✅ Import rule processing complete for new transaction`);
    return processedTransaction;
  }));
  
  // 7. Combine cleaned list with new merged transactions
  const finalTransactionList = [...filteredTransactionsToKeep, ...mergedTransactions];
  
  // Debug: Count April transactions in final list
  const aprilTransactions = finalTransactionList.filter(t => t.date.startsWith('2025-04'));
  console.log(`[ORCHESTRATOR] 🔍 APRIL DEBUG: Found ${aprilTransactions.length} April transactions in final list`);
  aprilTransactions.forEach(t => {
    console.log(`[ORCHESTRATOR] 🔍 APRIL: ${t.date} - ${t.amount} - "${t.description}"`);
  });
  addMobileDebugLog(`🔍 APRIL: ${aprilTransactions.length} transactions in final list`);
  
  console.log(`[ORCHESTRATOR] ✅ Final transaction count: ${finalTransactionList.length}`);
  
  // 8. CRITICAL: Update centralized transaction storage
  console.log(`[ORCHESTRATOR] 🔍 CSV date range: ${minDateStr} to ${maxDateStr} for account: ${accountId}`);
  console.log(`[ORCHESTRATOR] 🔍 Updating centralized storage with ${finalTransactionList.length} transactions`);
  
  // Convert ImportedTransaction[] to Transaction[] for centralized storage
  const transactionsForCentralStorage = (finalTransactionList || []).map((tx, index) => {
    const finalTransaction = {
      id: tx.id,
      accountId: tx.accountId,
      date: tx.date,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      description: tx.description,
      userDescription: tx.userDescription,
      bankCategory: tx.bankCategory,  // CRITICAL FIX: Include bank categories!
      bankSubCategory: tx.bankSubCategory,  // CRITICAL FIX: Include bank subcategories!
      type: tx.type,
      status: tx.status === 'green' ? 'green' : determineTransactionStatus(tx),
      linkedTransactionId: tx.linkedTransactionId,
      correctedAmount: tx.correctedAmount,
      isManuallyChanged: tx.isManuallyChanged,
      appCategoryId: tx.appCategoryId,
      appSubCategoryId: tx.appSubCategoryId
    } as Transaction;

    // CRITICAL DEBUG: Log the conversion from ImportedTransaction to Transaction
    if (index <= 3) {
      console.log(`[ORCHESTRATOR] 🔍 CONVERSION DEBUG ${index}:`);
      console.log(`[ORCHESTRATOR] 🔍 ImportedTx bankCategory: "${tx.bankCategory}"`);
      console.log(`[ORCHESTRATOR] 🔍 ImportedTx bankSubCategory: "${tx.bankSubCategory}"`);
      console.log(`[ORCHESTRATOR] 🔍 FinalTx bankCategory: "${finalTransaction.bankCategory}"`);
      console.log(`[ORCHESTRATOR] 🔍 FinalTx bankSubCategory: "${finalTransaction.bankSubCategory}"`);
      
      if (finalTransaction.bankCategory && finalTransaction.bankSubCategory) {
        console.log(`[ORCHESTRATOR] ✅ Transaction ${index} HAS CATEGORIES IN FINAL TX`);
      } else {
        console.log(`[ORCHESTRATOR] ❌ Transaction ${index} MISSING CATEGORIES IN FINAL TX`);
      }
    }

    return finalTransaction;
  });
  
  // Update centralized storage
  state.budgetState.allTransactions = transactionsForCentralStorage;
  console.log(`[ORCHESTRATOR] ✅ Updated centralized storage with ${state.budgetState.allTransactions.length} transactions`);
  
  // 8.2. NEW: Intelligent Synchronization with PostgreSQL Database
  console.log(`[ORCHESTRATOR] 🔄 SYNCHRONIZING ${finalTransactionList.length} transactions with PostgreSQL database...`);
  addMobileDebugLog(`🔄 Synchronizing ${finalTransactionList.length} transactions with database...`);
  
  try {
    // Convert ImportedTransaction[] to format expected by synchronize endpoint
    const transactionsToSync = finalTransactionList.map(transaction => ({
      id: transaction.id,
      accountId: transaction.accountId,
      date: transaction.date, // Keep as string, endpoint will convert
      amount: Math.round(transaction.amount), // Convert to integer (öre)
      balanceAfter: Math.round(transaction.balanceAfter || 0), // Convert to integer (öre)
      description: transaction.description,
      userDescription: transaction.userDescription || '',
      bankCategory: transaction.bankCategory || '',
      bankSubCategory: transaction.bankSubCategory || '',
      type: transaction.type || 'Transaction',
      status: transaction.status || 'yellow',
      linkedTransactionId: transaction.linkedTransactionId || null,
      correctedAmount: transaction.correctedAmount ? Math.round(transaction.correctedAmount) : null,
      isManuallyChanged: transaction.isManuallyChanged ? 'true' : 'false', // Ensure proper string conversion
      appCategoryId: transaction.appCategoryId || null,
      appSubCategoryId: transaction.appSubCategoryId || null,
      fileSource: transaction.fileSource || 'import'
    }));

    // Call the new synchronize endpoint
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
      throw new Error(`Synchronization failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`[ORCHESTRATOR] ✅ SYNCHRONIZATION COMPLETE:`, result.stats);
    console.log(`[ORCHESTRATOR] ✅ Created: ${result.stats.created}, Updated: ${result.stats.updated}, Deleted: ${result.stats.deleted}`);
    addMobileDebugLog(`✅ Sync complete: ${result.stats.created} created, ${result.stats.updated} updated, ${result.stats.deleted} deleted`);
    
  } catch (error) {
    console.error(`[ORCHESTRATOR] ❌ Critical error synchronizing transactions:`, error);
    addMobileDebugLog(`❌ Sync error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // 8.5. NEW: Automatic Account Balance Setting Based on Last Transaction Before 25th (Payday)
  // OPTIMIZATION: Only process the specific account being imported, not all accounts
  console.log(`[ORCHESTRATOR] 💰 Setting account balances for account ${accountId} based on last transaction before payday (25th)...`);
  
  try {
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    const payday = state.budgetState.settings?.payday || 25;
    
    console.log(`[ORCHESTRATOR] 💰 Current date: ${currentDate.toISOString().split('T')[0]}, payday: ${payday}, current day: ${currentDay}`);
    
    // We'll check payday logic for each month individually below
    console.log(`[ORCHESTRATOR] 💰 Processing balance updates for eligible months for account ${accountId}...`);
    
    // OPTIMIZATION: Only process transactions for the target account
    const accountTransactions = finalTransactionList.filter(tx => tx.accountId === accountId);
    console.log(`[ORCHESTRATOR] 💰 Found ${accountTransactions.length} transactions for target account ${accountId}`);
    addMobileDebugLog(`🔍 Balance Update Debug: Found ${accountTransactions.length} transactions for account ${accountId}`);
    
    // Group transactions by account and month (now only for target account)
    const transactionsByAccountMonth = accountTransactions.reduce((acc, tx) => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const key = `${tx.accountId}_${monthKey}`;
      
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(tx);
      return acc;
    }, {} as Record<string, typeof finalTransactionList>);
    
    const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    console.log(`[ORCHESTRATOR] 💰 Transaction groups by month:`, Object.keys(transactionsByAccountMonth));
    addMobileDebugLog(`🔍 Balance Update Debug: Found transaction groups for months: ${Object.keys(transactionsByAccountMonth).join(', ')}`);
    
    // For each account-month group, find last transaction before payday (day 24 and earlier)
    for (const [key, transactions] of Object.entries(transactionsByAccountMonth)) {
      const [accountId, monthKey] = key.split('_');
      
      // Only process months that are current month or earlier (since we're on or after payday)
      const [txYear, txMonth] = monthKey.split('-').map(Number);
      const [currentYear, currentMonth] = currentMonthKey.split('-').map(Number);
      const txDate = new Date(txYear, txMonth - 1, 1);
      const currentMonthDate = new Date(currentYear, currentMonth - 1, 1);
      
      if (txDate > currentMonthDate) {
        console.log(`[ORCHESTRATOR] ⏭️ Skipping future month ${monthKey} (current: ${currentMonthKey})`);
        addMobileDebugLog(`⏭️ Skipped future month ${monthKey} for account ${accountId}`);
        continue;
      }
      
      // Check if current date is after this month's payday
      // For August (2025-08), check if current date is after 2025-07-25
      const monthPaydayDate = new Date(txYear, txMonth - 2, payday); // Previous month's payday
      if (currentDate < monthPaydayDate) {
        console.log(`[ORCHESTRATOR] ⏳ Skipping ${monthKey} - current date (${currentDate.toISOString().split('T')[0]}) is before payday (${monthPaydayDate.toISOString().split('T')[0]})`);
        addMobileDebugLog(`⏳ Skipped ${monthKey} for account ${accountId} - waiting for payday ${monthPaydayDate.toISOString().split('T')[0]}`);
        continue;
      }
      console.log(`[ORCHESTRATOR] ✅ Processing ${monthKey} - current date is after payday (${monthPaydayDate.toISOString().split('T')[0]})`);
      addMobileDebugLog(`✅ Processing ${monthKey} for account ${accountId} - payday criteria met`);
      
      // Filter transactions that are on or before the day before payday (24th if payday is 25th)
      const dayBeforePayday = payday - 1;
      console.log(`[ORCHESTRATOR] 🔍 Looking for transactions before day ${dayBeforePayday} in ${monthKey}`);
      addMobileDebugLog(`🔍 Balance Debug: Checking ${monthKey} - looking for transactions before day ${dayBeforePayday}`);
      
      const transactionsBeforePayday = (transactions as typeof finalTransactionList).filter((tx) => {
        const date = new Date(tx.date);
        return date.getDate() <= dayBeforePayday;
      });
      
      console.log(`[ORCHESTRATOR] 🔍 Found ${transactionsBeforePayday.length} transactions before payday in ${monthKey}`);
      addMobileDebugLog(`🔍 Balance Debug: Found ${transactionsBeforePayday.length} transactions before payday in ${monthKey}`);
      
      if (transactionsBeforePayday.length === 0) {
        console.log(`[ORCHESTRATOR] ⚠️ No transactions found before payday for account ${accountId} in ${monthKey}`);
        addMobileDebugLog(`⚠️ Balance Debug: No transactions before day ${dayBeforePayday} in ${monthKey} for account ${accountId} - SKIPPING`);
        continue;
      }
      
      // Sort by date to get the last one
      const lastTransactionBeforePayday = transactionsBeforePayday.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      
      console.log(`[ORCHESTRATOR] 🔍 Last transaction before payday: ${lastTransactionBeforePayday.date} - ${lastTransactionBeforePayday.description} - Balance: ${lastTransactionBeforePayday?.balanceAfter}`);
      addMobileDebugLog(`🔍 Balance Debug: Last transaction before payday: ${lastTransactionBeforePayday.date} - Balance: ${lastTransactionBeforePayday?.balanceAfter || 'NONE'}`);
      
      if (lastTransactionBeforePayday?.balanceAfter !== undefined) {
        console.log(`[ORCHESTRATOR] 💰 Account ${accountId}: Found last transaction before payday in ${monthKey}: ${lastTransactionBeforePayday.balanceAfter / 100} kr (from ${lastTransactionBeforePayday.date})`);
        addMobileDebugLog(`💰 ${accountId} ${monthKey}: ${(lastTransactionBeforePayday.balanceAfter / 100).toFixed(2)} kr`);
        
        // Set balance for the same month as transactions (not next month)
        const targetMonthKey = monthKey;
        
        console.log(`[ORCHESTRATOR] 💰 Transaction month: ${monthKey}, Target budget month: ${targetMonthKey}`);
        addMobileDebugLog(`💰 Found balance ${(lastTransactionBeforePayday.balanceAfter / 100).toFixed(2)} kr from ${monthKey} → updating ${targetMonthKey}`);
        
        // Update budget_posts with account_balance (bank balance) for the target month
        // First check if a Balance type budget post already exists for this account and month
        try {
          console.log(`[ORCHESTRATOR] 🔍 Checking for existing balance post: monthKey=${targetMonthKey}, type=Balance, accountId=${accountId}`);
          addMobileDebugLog(`🔍 Balance Debug: Checking for existing Balance post for ${targetMonthKey}`);
          
          // First, check if a budget post already exists (fetch all posts for month, then filter by type and accountId)
          const existingResponse = await fetch(`/api/budget-posts?monthKey=${targetMonthKey}`);
          
          if (existingResponse.ok) {
            const allPosts = await existingResponse.json();
            
            // Filter posts by type='Balance' and accountId
            const existingPosts = allPosts.filter((post: any) => 
              post.type === 'Balance' && post.accountId === accountId
            );
            
            console.log(`[ORCHESTRATOR] 🔍 Found ${allPosts.length} total posts, ${existingPosts.length} matching balance posts for account ${accountId}`);
            addMobileDebugLog(`🔍 Balance Debug: Found ${allPosts.length} total posts, ${existingPosts.length} Balance posts for this account`);
            
            if (existingPosts.length > 0) {
              // Update existing budget post
              const existingPost = existingPosts[0];
              console.log(`[ORCHESTRATOR] 📝 Found existing balance post ${existingPost.id}, updating account_balance...`);
              addMobileDebugLog(`📝 Balance Debug: UPDATING existing Balance post ${existingPost.id}`);
              
              // Create update payload with automatic accountUserBalance sync
              const baseUpdatePayload = {
                accountBalance: lastTransactionBeforePayday.balanceAfter,
                description: `Bank balance from CSV import (from ${monthKey} transactions, updated)`
              };
              
              console.log(`[ORCHESTRATOR] 🔍 Creating update payload with balance: ${lastTransactionBeforePayday.balanceAfter}`);
              addMobileDebugLog(`🔍 Balance Debug: Creating update payload with balance: ${(lastTransactionBeforePayday.balanceAfter / 100).toFixed(2)} kr`);
              
              const updatePayload = await createBudgetPostPayload(baseUpdatePayload);
              
              console.log(`[ORCHESTRATOR] 🔍 Final update payload:`, updatePayload);
              addMobileDebugLog(`🔍 Balance Debug: Final update payload - accountBalance: ${updatePayload.accountBalance ? (updatePayload.accountBalance / 100).toFixed(2) + ' kr' : 'NONE'}, accountUserBalance: ${updatePayload.accountUserBalance ? (updatePayload.accountUserBalance / 100).toFixed(2) + ' kr' : 'NONE'}`);
              
              const updateResponse = await fetch(`/api/budget-posts/${existingPost.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
              });
              
              if (updateResponse.ok) {
                const result = await updateResponse.json();
                console.log(`[ORCHESTRATOR] 💾 Updated existing budget_post account_balance for ${accountId} in ${targetMonthKey}: ${lastTransactionBeforePayday.balanceAfter / 100} kr`);
                addMobileDebugLog(`💾 ✅ SUCCESS: Updated ${accountId} balance for ${targetMonthKey}: Bank=${(result.accountBalance / 100).toFixed(2)} kr, User=${result.accountUserBalance ? (result.accountUserBalance / 100).toFixed(2) + ' kr' : 'NONE'}`);
              } else {
                console.log(`[ORCHESTRATOR] ❌ Failed to update existing budget_post:`, updateResponse.statusText);
                addMobileDebugLog(`❌ FAILED to update existing balance for ${targetMonthKey} account ${accountId}: ${updateResponse.statusText}`);
              }
            } else {
              // No existing post found, create new one
              console.log(`[ORCHESTRATOR] ➕ No existing balance post found, creating new one for ${accountId} in ${targetMonthKey}`);
              addMobileDebugLog(`➕ Balance Debug: CREATING new Balance post for ${accountId} in ${targetMonthKey}`);
              
              // Create new budget post payload with automatic accountUserBalance sync
              const baseCreatePayload = {
                monthKey: targetMonthKey,
                type: 'Balance',
                accountId: accountId,
                amount: 0, // Not used for Balance type
                accountBalance: lastTransactionBeforePayday.balanceAfter, // Bank balance in öre
                description: `Bank balance from CSV import (from ${monthKey} transactions)`,
                huvudkategoriId: null,
                underkategoriId: null
              };
              
              console.log(`[ORCHESTRATOR] 🔍 Creating new post payload with balance: ${lastTransactionBeforePayday.balanceAfter}`);
              addMobileDebugLog(`🔍 Balance Debug: Creating new post payload with balance: ${(lastTransactionBeforePayday.balanceAfter / 100).toFixed(2)} kr`);
              
              const createPayload = await createBudgetPostPayload(baseCreatePayload);
              
              console.log(`[ORCHESTRATOR] 🔍 Final create payload:`, createPayload);
              addMobileDebugLog(`🔍 Balance Debug: Final create payload - accountBalance: ${createPayload.accountBalance ? (createPayload.accountBalance / 100).toFixed(2) + ' kr' : 'NONE'}, accountUserBalance: ${createPayload.accountUserBalance ? (createPayload.accountUserBalance / 100).toFixed(2) + ' kr' : 'NONE'}`);
              
              const createResponse = await fetch('/api/budget-posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createPayload)
              });
              
              if (createResponse.ok) {
                const result = await createResponse.json();
                console.log(`[ORCHESTRATOR] 💾 Created new budget_post account_balance for ${accountId} in ${targetMonthKey}: ${lastTransactionBeforePayday.balanceAfter / 100} kr`);
                addMobileDebugLog(`💾 ✅ SUCCESS: Created new Balance post for ${accountId} in ${targetMonthKey}: Bank=${(result.accountBalance / 100).toFixed(2)} kr, User=${result.accountUserBalance ? (result.accountUserBalance / 100).toFixed(2) + ' kr' : 'NONE'}`);
              } else {
                console.log(`[ORCHESTRATOR] ❌ Failed to create budget_post:`, createResponse.statusText);
                addMobileDebugLog(`❌ FAILED to create balance entry for ${targetMonthKey} account ${accountId}: ${createResponse.statusText}`);
              }
            }
          } else {
            console.log(`[ORCHESTRATOR] ❌ Failed to check for existing budget posts:`, existingResponse.statusText);
            addMobileDebugLog(`❌ Failed to check existing balance entries for ${targetMonthKey} account ${accountId}: ${existingResponse.statusText}`);
          }
        } catch (error) {
          console.log(`[ORCHESTRATOR] ❌ Error saving account balance to budget_posts:`, error);
          addMobileDebugLog(`❌ Balance Debug: Network/API error for ${targetMonthKey} account ${accountId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        console.log(`[ORCHESTRATOR] ⚠️ No balanceAfter found for last transaction in ${monthKey}`);
        addMobileDebugLog(`⚠️ Balance Debug: No balanceAfter value found for last transaction in ${monthKey} - SKIPPING balance update`);
      }
    }
    
    console.log(`[ORCHESTRATOR] ✅ Account balance setting complete for account ${accountId}`);
    addMobileDebugLog(`✅ Balance Debug: Process complete for account ${accountId} - checked ${Object.keys(transactionsByAccountMonth).length} month(s). If no balances were created/updated, check the debug logs above for reasons.`);
    
  } catch (error) {
    console.log(`[ORCHESTRATOR] ❌ Error setting account balances:`, error);
    addMobileDebugLog(`❌ Error setting account balances: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 8.6. Automatic transfer matching for InternalTransfer transactions
  performAutomaticTransferMatching();
  

  // 10. Save and refresh UI
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log(`[ORCHESTRATOR] 🎉 Smart merge completed successfully - UI refresh triggered`);
}

// Helper function to create empty month data for import
function createEmptyMonthDataForImport() {
  return {
    costGroups: [],
    savingsGroups: [],
    costItems: [],
    savingsItems: [],
    dailyTransfer: 0,
    weekendTransfer: 0,
    andreasPersonalCosts: 0,
    andreasPersonalSavings: 0,
    susannaPersonalCosts: 0,
    susannaPersonalSavings: 0,
    customHolidays: [],
    accountBalances: {},
    accountBalancesSet: {},
    accountEstimatedFinalBalances: {},
    accountEstimatedFinalBalancesSet: {},
    accountEstimatedStartBalances: {},
    accountStartBalancesSet: {},
    userName1: 'Andreas',
    userName2: 'Susanna',
    transferChecks: {},
    andreasShareChecked: false,
    susannaShareChecked: false,
    monthFinalBalances: {},
    accountEndingBalances: {},
    transactions: [],
    createdAt: new Date().toISOString()
  };
}

// ============= REGELHANTERING =============

// Load category rules from PostgreSQL database
async function loadCategoryRulesFromDatabase(): Promise<void> {
  console.log('🔍 [DEBUG] Loading category rules from PostgreSQL...');
  
  try {
    const { apiStore } = await import('../store/apiStore');
    const dbRules = await apiStore.getCategoryRules();
    
    console.log('✅ [DEBUG] Loaded rules from PostgreSQL:', dbRules);
    
    // Safety check: ensure categoryRules array exists before checking length
    if (!state.budgetState.categoryRules) {
      state.budgetState.categoryRules = [];
    }
    console.log('✅ [DEBUG] Current categoryRules in state:', state.budgetState.categoryRules.length);
    
    if (!dbRules || !Array.isArray(dbRules) || dbRules.length === 0) {
      console.log('⚠️ [DEBUG] No rules found in PostgreSQL database');
      return;
    }
    
    // Convert PostgreSQL rules to legacy format for localStorage compatibility
    const legacyRules = (dbRules || [])
      .filter(dbRule => dbRule.huvudkategoriId && dbRule.underkategoriId) // Only include rules with valid categories
      .map(dbRule => ({
        id: dbRule.id,
        priority: 100,
        condition: {
          type: 'textContains' as const,
          value: dbRule.transactionName,
          bankCategory: dbRule.transactionName,
          bankSubCategory: ''
        },
        action: {
          appMainCategoryId: dbRule.huvudkategoriId!, // Safe to use ! since we filtered out nulls
          appSubCategoryId: dbRule.underkategoriId!, // Safe to use ! since we filtered out nulls
          positiveTransactionType: 'Transaction' as const,
          negativeTransactionType: 'Transaction' as const,
          applicableAccountIds: []
        },
        isActive: true
      }));
    
    console.log('🔄 [DEBUG] Converted PostgreSQL rules to legacy format:', legacyRules);
    
    // Ensure categoryRules exists and merge with existing rules (avoid duplicates)
    if (!state.budgetState.categoryRules) {
      state.budgetState.categoryRules = [];
    }
    const existingRuleIds = new Set(state.budgetState.categoryRules.map(r => r.id));
    const newRules = legacyRules.filter(rule => !existingRuleIds.has(rule.id));
    
    console.log(`🔄 [DEBUG] Existing rules: ${existingRuleIds.size}, New rules to add: ${newRules.length}`);
    
    if (newRules.length > 0) {
      state.budgetState.categoryRules = [...state.budgetState.categoryRules, ...newRules];
      console.log(`✅ [DEBUG] Added ${newRules.length} new rules from PostgreSQL`);
      console.log(`✅ [DEBUG] Total rules now: ${state.budgetState.categoryRules.length}`);
      
      import('../utils/mobileDebugLogger').then(({ addMobileDebugLog }) => {
        addMobileDebugLog(`✅ [ORCHESTRATOR] Loaded ${dbRules.length} rules from PostgreSQL, added ${newRules.length} new`);
      });
      
      saveStateToStorage();
      triggerUIRefresh();
    } else {
      console.log('ℹ️ [DEBUG] All PostgreSQL rules already exist in localStorage - no duplicates added');
      import('../utils/mobileDebugLogger').then(({ addMobileDebugLog }) => {
        addMobileDebugLog(`ℹ️ [ORCHESTRATOR] PostgreSQL rules already loaded (${dbRules.length} total)`);
      });
    }
    
  } catch (error) {
    console.error('❌ [DEBUG] Failed to load rules from PostgreSQL:', error);
    import('../utils/mobileDebugLogger').then(({ addMobileDebugLog }) => {
      addMobileDebugLog(`❌ [ORCHESTRATOR] Failed to load rules from DB: ${error}`);
    });
  }
}

export async function addCategoryRule(rule: any): Promise<void> {
  console.log('🔍 [DEBUG] Adding category rule to PostgreSQL:', rule);
  
  try {
    // Create rule data for PostgreSQL
    const newRuleData = {
      ruleName: rule.condition?.bankCategory || rule.condition?.value || 'Auto-generated rule',
      transactionName: rule.condition?.bankCategory || rule.condition?.value || '',
      huvudkategoriId: rule.action?.appMainCategoryId || '',
      underkategoriId: rule.action?.appSubCategoryId || '',
      userId: 'dev-user-123' // Mock user ID for development
    };
    
    // Save to PostgreSQL database via API
    const { apiStore } = await import('../store/apiStore');
    const savedRule = await apiStore.createCategoryRule(newRuleData);
    
    console.log('✅ [DEBUG] Rule saved to PostgreSQL:', savedRule);
    
    // Also add to localStorage for backward compatibility during transition
    const legacyRule = {
      id: savedRule.id,
      isActive: true,
      ...rule
    };
    
    // Ensure categoryRules is initialized as array before adding
    if (!state.budgetState.categoryRules) {
      state.budgetState.categoryRules = [];
    }
    state.budgetState.categoryRules = [...state.budgetState.categoryRules, legacyRule];
    
    console.log('🔍 [DEBUG] After adding - total rules:', state.budgetState.categoryRules.length);
    
    // Add mobile debug logging
    import('../utils/mobileDebugLogger').then(({ addMobileDebugLog }) => {
      addMobileDebugLog(`🔍 [ORCHESTRATOR] Rule saved to PostgreSQL. ID: ${savedRule.id}`);
      addMobileDebugLog(`🔍 [ORCHESTRATOR] Rule name: ${newRuleData.ruleName}`);
    });
    
    saveStateToStorage();
    triggerUIRefresh();
  } catch (error) {
    console.error('❌ [DEBUG] Failed to save rule to PostgreSQL:', error);
    
    // Fallback to localStorage only
    const fallbackRule = {
      id: uuidv4(),
      isActive: true,
      ...rule
    };
    
    // Ensure categoryRules is initialized as array before adding
    if (!state.budgetState.categoryRules) {
      state.budgetState.categoryRules = [];
    }
    state.budgetState.categoryRules = [...state.budgetState.categoryRules, fallbackRule];
    
    import('../utils/mobileDebugLogger').then(({ addMobileDebugLog }) => {
      addMobileDebugLog(`❌ [ORCHESTRATOR] Failed to save to DB, using localStorage. Error: ${error}`);
    });
    
    saveStateToStorage();
    triggerUIRefresh();
  }
}

export function updateCategoryRule(ruleId: string, updates: Partial<any>): void {
  // Ensure categoryRules is initialized as array
  if (!state.budgetState.categoryRules) {
    state.budgetState.categoryRules = [];
  }
  state.budgetState.categoryRules = state.budgetState.categoryRules.map(rule =>
    rule.id === ruleId ? { ...rule, ...updates } : rule
  );
  saveStateToStorage();
  triggerUIRefresh();
}

export function deleteCategoryRule(ruleId: string): void {
  // Ensure categoryRules is initialized as array
  if (!state.budgetState.categoryRules) {
    state.budgetState.categoryRules = [];
  }
  state.budgetState.categoryRules = state.budgetState.categoryRules.filter(rule => rule.id !== ruleId);
  saveStateToStorage();
  triggerUIRefresh();
}

// Enhanced CSV parsing function that returns both transactions and mapping info
function parseCSVContentWithMapping(csvContent: string, accountId: string, fileName: string): { transactions: ImportedTransaction[], mapping: CsvMapping | undefined } {
  const transactions = parseCSVContent(csvContent, accountId, fileName);
  
  // Get the mapping that was used - TODO: Pass sqlAccounts parameter
  const account = state.budgetState.accounts?.find(acc => acc.id === accountId);
  let savedMapping: CsvMapping | undefined;
  console.log('⚠️ [ORCHESTRATOR] Using legacy budgetState.accounts lookup - should pass sqlAccounts parameter');
  
  if (account?.bankTemplateId) {
    const cleanedContent = csvContent.replace(/�/g, '');
    const lines = cleanedContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(';').map(h => h.trim());
    const fileFingerprint = `${headers.join('|')}_${lines.length}`;
    
    savedMapping = state.budgetState.csvMappings.find(mapping => 
      mapping.fileFingerprint === fileFingerprint
    );
  } else {
    const cleanedContent = csvContent.replace(/�/g, '');
    const lines = cleanedContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(';').map(h => h.trim());
    const fileFingerprint = `${headers.join('|')}_${lines.length}`;
    savedMapping = getCsvMapping(fileFingerprint);
  }
  
  return { transactions, mapping: savedMapping };
}

// CSV parsing function moved from TransactionImportEnhanced - EXPORTED for optimized import
export function parseCSVContent(csvContent: string, accountId: string, fileName: string): ImportedTransaction[] {
  console.log(`[ORCHESTRATOR] 🔍 parseCSVContent called for account: ${accountId}`);
  
  const cleanedContent = csvContent.replace(/�/g, '');
  const lines = cleanedContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(';').map(h => h.trim());
  console.log(`[ORCHESTRATOR] 🔍 CSV headers:`, headers);
  
  // NEW: Hämta bankmallen från kontot och använd dess mappning - TODO: Pass sqlAccounts parameter
  const account = state.budgetState.accounts?.find(acc => acc.id === accountId);
  let savedMapping: CsvMapping | undefined;
  console.log('⚠️ [ORCHESTRATOR] Using legacy budgetState.accounts lookup - should pass sqlAccounts parameter');
  
  if (account?.bankTemplateId) {
    console.log(`[ORCHESTRATOR] 🔍 Account has bank template: ${account.bankTemplateId}`);
    
    // Skapa fingerprint för att matcha CSV-strukturen
    const fileFingerprint = `${headers.join('|')}_${lines.length}`;
    
    // Hämta mappning för denna bankmall och CSV-struktur
    savedMapping = state.budgetState.csvMappings.find(mapping => 
      mapping.fileFingerprint === fileFingerprint
    );
    
    console.log(`[ORCHESTRATOR] 🔍 Found bank template mapping:`, savedMapping);
  } else {
    console.log(`[ORCHESTRATOR] 🔍 No bank template linked to account ${accountId}`);
    
    // Fallback: Sök efter mappning baserat på enbart CSV-fingerprint
    const fileFingerprint = `${headers.join('|')}_${lines.length}`;
    savedMapping = getCsvMapping(fileFingerprint);
    console.log(`[ORCHESTRATOR] 🔍 Found legacy mapping:`, savedMapping);
  }
  
  const transactions: ImportedTransaction[] = [];
  
  // Use saved mapping if available, otherwise auto-detect
  let dateColumnIndex: number;
  let amountColumnIndex: number; 
  let descriptionColumnIndex: number;
  let balanceColumnIndex: number = -1;
  let bankCategoryIndex: number = -1;
  let bankSubCategoryIndex: number = -1;
  
  if (savedMapping && savedMapping.columnMapping) {
    // Use saved mappings - find which CSV columns map to our app fields
    console.log(`[ORCHESTRATOR] 🔍 Using saved column mappings:`, savedMapping.columnMapping);
    
    // Find the CSV column names that map to each app field
    const dateColumn = Object.keys(savedMapping.columnMapping).find(csvCol => savedMapping.columnMapping[csvCol] === 'date');
    const amountColumn = Object.keys(savedMapping.columnMapping).find(csvCol => savedMapping.columnMapping[csvCol] === 'amount');
    const descriptionColumn = Object.keys(savedMapping.columnMapping).find(csvCol => savedMapping.columnMapping[csvCol] === 'description');
    const balanceColumn = Object.keys(savedMapping.columnMapping).find(csvCol => 
      savedMapping.columnMapping[csvCol] === 'balanceAfter' || savedMapping.columnMapping[csvCol] === 'saldo'
    );
    const bankCategoryColumn = Object.keys(savedMapping.columnMapping).find(csvCol => 
      savedMapping.columnMapping[csvCol] === 'bankCategory'
    );
    const bankSubCategoryColumn = Object.keys(savedMapping.columnMapping).find(csvCol => 
      savedMapping.columnMapping[csvCol] === 'bankSubCategory'
    );
    
    // Get the indices of these columns in the headers
    dateColumnIndex = dateColumn ? headers.indexOf(dateColumn) : -1;
    amountColumnIndex = amountColumn ? headers.indexOf(amountColumn) : -1;
    descriptionColumnIndex = descriptionColumn ? headers.indexOf(descriptionColumn) : -1;
    balanceColumnIndex = balanceColumn ? headers.indexOf(balanceColumn) : -1;
    bankCategoryIndex = bankCategoryColumn ? headers.indexOf(bankCategoryColumn) : -1;
    bankSubCategoryIndex = bankSubCategoryColumn ? headers.indexOf(bankSubCategoryColumn) : -1;
    
    console.log(`[ORCHESTRATOR] 🔍 Dynamic column mapping - Date: ${dateColumn}(${dateColumnIndex}), Amount: ${amountColumn}(${amountColumnIndex}), Description: ${descriptionColumn}(${descriptionColumnIndex}), Balance: ${balanceColumn}(${balanceColumnIndex})`);
  } else {
    // Auto-detect column indices (fallback)
    console.log(`[ORCHESTRATOR] 🔍 Auto-detecting columns...`);
    dateColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('datum') || h.toLowerCase().includes('date')
    );
    amountColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('belopp') || h.toLowerCase().includes('amount')
    );
    descriptionColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('beskrivning') || h.toLowerCase().includes('text') || h.toLowerCase().includes('description')
    );
    balanceColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('saldo') || h.toLowerCase().includes('balance')
    );
    bankCategoryIndex = headers.findIndex(h => {
      const normalized = h.toLowerCase().trim();
      return normalized === 'kategori' || 
             normalized === 'category' || 
             normalized === 'bankkategori' ||
             normalized.includes('kategori') || 
             normalized.includes('category');
    });
    bankSubCategoryIndex = headers.findIndex(h => {
      const normalized = h.toLowerCase().trim();
      return normalized === 'underkategori' || 
             normalized === 'subcategory' || 
             normalized === 'bank underkategori' ||
             normalized.includes('underkategori') || 
             normalized.includes('subcategory');
    });
  }
  
  console.log(`[ORCHESTRATOR] 🔍 Column indices - Date: ${dateColumnIndex}, Amount: ${amountColumnIndex}, Description: ${descriptionColumnIndex}, Balance: ${balanceColumnIndex}, BankCategory: ${bankCategoryIndex}, BankSubCategory: ${bankSubCategoryIndex}`);
  
  // CRITICAL DEBUG: Log exact headers and auto-detection results
  console.log(`[ORCHESTRATOR] 🔍 DEBUGGING CATEGORY MAPPING:`);
  console.log(`[ORCHESTRATOR] 🔍 Headers array:`, headers);
  headers.forEach((h, i) => {
    console.log(`[ORCHESTRATOR] 🔍 Header ${i}: "${h}" (lower: "${h.toLowerCase()}")`);
    if (h.toLowerCase().includes('kategori')) {
      console.log(`[ORCHESTRATOR] 🚨 FOUND CATEGORY HEADER AT INDEX ${i}: "${h}"`);
    }
    if (h.toLowerCase().includes('underkategori')) {
      console.log(`[ORCHESTRATOR] 🚨 FOUND SUBCATEGORY HEADER AT INDEX ${i}: "${h}"`);
    }
  });
  console.log(`[ORCHESTRATOR] 🔍 Final bankCategoryIndex: ${bankCategoryIndex}, bankSubCategoryIndex: ${bankSubCategoryIndex}`);
  
  // Check if essential columns were found
  if (dateColumnIndex === -1 || amountColumnIndex === -1 || descriptionColumnIndex === -1) {
    console.log(`[ORCHESTRATOR] ❌ Required columns not found - Date: ${dateColumnIndex}, Amount: ${amountColumnIndex}, Description: ${descriptionColumnIndex}`);
    console.log(`[ORCHESTRATOR] ❌ Available headers:`, headers);
    addMobileDebugLog(`❌ Required columns not found in CSV. Headers: ${headers.join(', ')}`);
    
    // Still return empty array but log the headers so user can see them in debug
    addMobileDebugLog(`📋 CSV Headers found: ${headers.map((h, i) => `${i}: ${h}`).join(', ')}`);
    return [];
  }

  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(';');
    if (fields.length < headers.length) continue;

    try {
      const rawAmountField = amountColumnIndex >= 0 ? fields[amountColumnIndex] : '0';
      // Handle both Swedish and international number formats
      let cleanedAmountField = rawAmountField.trim().replace(/\s/g, ''); // Remove all spaces
      
      // Check if comma is decimal separator (Swedish) or thousand separator (international)
      if (cleanedAmountField.includes(',') && cleanedAmountField.includes('.')) {
        // Format like "1,234.56" - comma is thousand separator, dot is decimal
        cleanedAmountField = cleanedAmountField.replace(/,/g, ''); // Remove commas
      } else if (cleanedAmountField.includes(',')) {
        // Check if comma is likely decimal separator (Swedish) vs thousand separator
        const commaIndex = cleanedAmountField.lastIndexOf(',');
        const afterComma = cleanedAmountField.substring(commaIndex + 1);
        
        if (afterComma.length <= 2 && /^\d+$/.test(afterComma)) {
          // Likely decimal separator: "1234,56" or "4,00"
          cleanedAmountField = cleanedAmountField.replace(',', '.');
        } else {
          // Likely thousand separator: "4,000" 
          cleanedAmountField = cleanedAmountField.replace(/,/g, '');
        }
      }
      
      const amountInKronor = parseFloat(cleanedAmountField);
      const parsedAmount = kronoraToOren(amountInKronor); // Convert to ören for database storage

      console.log(`[ORCHESTRATOR] 🔍 Processing line ${i}: Raw line: "${lines[i]}"`);
      console.log(`[ORCHESTRATOR] 💰 Amount field: "${rawAmountField}" -> cleaned: "${cleanedAmountField}" -> kronor: ${amountInKronor} -> ören: ${parsedAmount}`);

      if (isNaN(amountInKronor)) {
        console.log(`[ORCHESTRATOR] ⚠️ Skipping line ${i}: Invalid amount`);
        continue;
      }

      const rawDate = dateColumnIndex >= 0 ? fields[dateColumnIndex] : '';
      const parsedDate = parseSwedishDate(rawDate);
      console.log(`[ORCHESTRATOR] 📅 Processing line ${i}: Date field: "${rawDate}" -> "${parsedDate}"`);
      
      // Add mobile debug log for date parsing
      if (i <= 3) { // Only log first 3 for mobile
        addMobileDebugLog(`📅 Date parsing: "${rawDate}" -> "${parsedDate}"`);
      }
      
      if (!parsedDate) {
        console.log(`[ORCHESTRATOR] ⚠️ Skipping line ${i}: Invalid date`);
        continue;
      }

      // NEW: Parse balance after transaction
      let balanceAfter: number | undefined;
      if (balanceColumnIndex >= 0) {
        const rawBalanceField = fields[balanceColumnIndex];
        // Handle both Swedish and international number formats
        let cleanedBalanceField = rawBalanceField.trim().replace(/\s/g, ''); // Remove all spaces
        
        // Check if comma is decimal separator (Swedish) or thousand separator (international)
        if (cleanedBalanceField.includes(',') && cleanedBalanceField.includes('.')) {
          // Format like "1,234.56" - comma is thousand separator, dot is decimal
          cleanedBalanceField = cleanedBalanceField.replace(/,/g, ''); // Remove commas
        } else if (cleanedBalanceField.includes(',')) {
          // Check if comma is likely decimal separator (Swedish) vs thousand separator
          const commaIndex = cleanedBalanceField.lastIndexOf(',');
          const afterComma = cleanedBalanceField.substring(commaIndex + 1);
          
          if (afterComma.length <= 2 && /^\d+$/.test(afterComma)) {
            // Likely decimal separator: "1234,56" or "4,00"
            cleanedBalanceField = cleanedBalanceField.replace(',', '.');
          } else {
            // Likely thousand separator: "4,000" 
            cleanedBalanceField = cleanedBalanceField.replace(/,/g, '');
          }
        }
        
        const balanceInKronor = parseFloat(cleanedBalanceField);
        if (!isNaN(balanceInKronor)) {
          balanceAfter = kronoraToOren(balanceInKronor); // Convert to ören for database storage
          console.log(`[ORCHESTRATOR] 💰 Balance field: "${rawBalanceField}" -> cleaned: "${cleanedBalanceField}" -> kronor: ${balanceInKronor} -> ören: ${balanceAfter}`);
        }
      }

      // Parse bank categories from CSV columns
      const bankCategory = bankCategoryIndex >= 0 ? fields[bankCategoryIndex]?.trim() || '' : '';
      const bankSubCategory = bankSubCategoryIndex >= 0 ? fields[bankSubCategoryIndex]?.trim() || '' : '';

      const description = descriptionColumnIndex >= 0 ? fields[descriptionColumnIndex]?.trim() || '' : '';
      
      // CRITICAL DEBUG: Log the full row data and mappings
      if (i <= 5) { // Only log first 5 transactions to avoid spam
        console.log(`[ORCHESTRATOR] 🔍 LINE ${i} FULL DEBUG:`);
        console.log(`[ORCHESTRATOR] 🔍 Full fields array:`, fields);
        console.log(`[ORCHESTRATOR] 🔍 Description: "${description}" (index ${descriptionColumnIndex})`);
        console.log(`[ORCHESTRATOR] 🔍 Raw bankCategory field[${bankCategoryIndex}]: "${fields[bankCategoryIndex] || 'UNDEFINED'}"`);
        console.log(`[ORCHESTRATOR] 🔍 Raw bankSubCategory field[${bankSubCategoryIndex}]: "${fields[bankSubCategoryIndex] || 'UNDEFINED'}"`);
        console.log(`[ORCHESTRATOR] 🔍 Final bankCategory: "${bankCategory}"`);
        console.log(`[ORCHESTRATOR] 🔍 Final bankSubCategory: "${bankSubCategory}"`);
        
        // Show if this transaction will have categories
        if (bankCategory && bankSubCategory) {
          console.log(`[ORCHESTRATOR] ✅ Transaction ${i} WILL HAVE CATEGORIES: "${bankCategory}" / "${bankSubCategory}"`);
        } else {
          console.log(`[ORCHESTRATOR] ❌ Transaction ${i} MISSING CATEGORIES: bankCategory="${bankCategory}", bankSubCategory="${bankSubCategory}"`);
        }
      }

      // Determine transaction type - detect internal transfers
      let transactionType: 'Transaction' | 'InternalTransfer' = 'Transaction';
      const isInternalTransfer = bankCategory === 'Intern Överföring' || 
                                bankCategory.includes('Överföring') ||
                                bankSubCategory === 'Intern Överföring' ||
                                bankSubCategory.includes('Överföring');
      
      if (isInternalTransfer) {
        transactionType = 'InternalTransfer';
        console.log(`[ORCHESTRATOR] 🔄 Detected internal transfer: ${description} (category: ${bankCategory})`);
      }

      const transaction: ImportedTransaction = {
        id: uuidv4(),
        date: parsedDate, // Already in YYYY-MM-DD string format
        description: description,
        amount: parsedAmount,
        balanceAfter: balanceAfter || 0,
        bankCategory: bankCategory,
        bankSubCategory: bankSubCategory,
        accountId: accountId,
        type: transactionType,
        status: 'red',
        importedAt: new Date().toISOString(),
        fileSource: fileName
      };

      console.log(`[ORCHESTRATOR] ✅ Created transaction for line ${i}: id=${transaction.id}, desc="${transaction.description}", bankCat="${transaction.bankCategory}", bankSubCat="${transaction.bankSubCategory}"`);
      transactions.push(transaction);
    } catch (error) {
      console.warn(`Failed to parse transaction at line ${i + 1}:`, error);
    }
  }
  
  console.log(`[ORCHESTRATOR] 🔍 Parsed ${transactions.length} transactions, balance data found: ${transactions.filter(t => t.balanceAfter !== undefined).length}`);
  addMobileDebugLog(`🔍 Successfully parsed ${transactions.length} transactions from CSV`);
  return transactions;
}


// Helper functions moved from TransactionImportEnhanced
function parseSwedishDate(dateString: string): string | null {
  if (!dateString) return null;
  
  const trimmed = dateString.trim();
  let year: string, month: string, day: string;
  
  // Pattern 1: YYYY-MM-DD (ISO format)
  const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  let match = trimmed.match(isoPattern);
  
  if (match) {
    [, year, month, day] = match;
  } else {
    // Pattern 2: DD/MM/YYYY (Swedish format)
    const swedishPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    match = trimmed.match(swedishPattern);
    
    if (match) {
      [, day, month, year] = match;
      // Pad with zeros if needed
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');
    } else {
      // Pattern 3: DD-MM-YYYY (alternative Swedish format)
      const altSwedishPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
      match = trimmed.match(altSwedishPattern);
      
      if (match) {
        [, day, month, year] = match;
        // Pad with zeros if needed
        day = day.padStart(2, '0');
        month = month.padStart(2, '0');
      } else {
        return null; // No matching pattern found
      }
    }
  }
  
  // Validate the date values
  const yearNum = parseInt(year);
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  
  if (yearNum >= 1900 && yearNum <= 2100 && 
      monthNum >= 1 && monthNum <= 12 && 
      dayNum >= 1 && dayNum <= 31) {
    // Always return ISO format with 12:00 time (noon) to avoid timezone edge cases
    return `${year}-${month}-${day}T12:00:00.000Z`;
  }
  
  return null;
}

function groupTransactionsByMonth(transactions: ImportedTransaction[]): Record<string, ImportedTransaction[]> {
  const groups: Record<string, ImportedTransaction[]> = {};
  
  transactions.forEach(transaction => {
    // Extract month from ISO date string - handles both old YYYY-MM-DD and new ISO format
    const monthKey = transaction.date.substring(0, 7); // Extract "YYYY-MM" from "YYYY-MM-DDTHH:MM:SS.000Z" or "YYYY-MM-DD"
    
    console.log(`[ORCHESTRATOR] 📅 Transaction ${transaction.date} -> calendar month ${monthKey}`);
    addMobileDebugLog(`📅 TX ${transaction.date} -> calendar month ${monthKey}`);
    
    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(transaction);
  });
  
  return groups;
}

function reconcileTransactions(
  fileTransactions: ImportedTransaction[],
  existingTransactions: ImportedTransaction[],
  categoryRules: CategoryRule[]
): ImportedTransaction[] {
  const reconciledTransactions: ImportedTransaction[] = [];
  const existingFingerprints = new Set(
    existingTransactions.map(t => createTransactionFingerprint(t))
  );

  fileTransactions.forEach(fileTx => {
    const fingerprint = createTransactionFingerprint(fileTx);
    const existingTransaction = existingTransactions.find(
      existing => createTransactionFingerprint(existing) === fingerprint
    );

    if (existingTransaction) {
      // Preserve manual changes from existing transaction
      reconciledTransactions.push({
        ...fileTx,
        id: existingTransaction.id,
        type: existingTransaction.type,
        status: existingTransaction.status,
        appCategoryId: existingTransaction.appCategoryId,
        appSubCategoryId: existingTransaction.appSubCategoryId,
        linkedTransactionId: existingTransaction.linkedTransactionId,
        savingsTargetId: existingTransaction.savingsTargetId,
        coveredCostId: existingTransaction.coveredCostId
      });
    } else {
      // Apply categorization rules to new transaction using the modern rule engine
      const categorizedTransaction = applyCategorizationRules(fileTx, categoryRules || []);
      reconciledTransactions.push(categorizedTransaction);
    }
  });

  return reconciledTransactions;
}

function createTransactionFingerprint(transaction: { date: string; description: string; amount: number; accountId?: string }): string {
  // CRITICAL FIX: Extract date and completely ignore time component
  let dateOnly: string;
  
  if (transaction.date.includes('T')) {
    // ISO format: 2025-07-15T12:00:00.000Z -> 2025-07-15
    dateOnly = transaction.date.split('T')[0];
  } else if (transaction.date.includes(' ')) {
    // Space format: 2025-07-15 12:00:00 -> 2025-07-15
    dateOnly = transaction.date.split(' ')[0];
  } else {
    // Already in YYYY-MM-DD format
    dateOnly = transaction.date.substring(0, 10);
  }
  
  // Normalize description: trim, lowercase, and remove extra spaces
  const normalizedDescription = transaction.description.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Round amount to avoid floating point precision issues  
  const normalizedAmount = Math.round(transaction.amount * 100) / 100;
  
  const fingerprint = `${transaction.accountId || ''}_${dateOnly}_${normalizedDescription}_${normalizedAmount}`;
  
  console.log(`[CLIENT FINGERPRINT] Created: ${fingerprint} from date: ${transaction.date} -> ${dateOnly}`);
  return fingerprint;
}

/**
 * Clean up duplicate transactions in the database
 * This function identifies and removes duplicate transactions based on the same fingerprint logic
 * used during imports, keeping the best version of each duplicate group.
 */
/**
 * Enhanced duplicate transaction cleanup with improved detection
 * Now includes better normalization and handles time-based duplicates (12:00 vs 00:00)
 */
export async function cleanupDuplicateTransactions(): Promise<{removed: number; kept: number}> {
  console.log('[CLEANUP] 🧹 Starting ENHANCED duplicate transaction cleanup...');
  
  try {
    // Fetch all transactions from the API
    const response = await fetch('/api/transactions');
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.status}`);
    }
    
    const allTransactions = await response.json();
    console.log(`[CLEANUP] 📊 Found ${allTransactions.length} total transactions`);
    
    // Group transactions by fingerprint
    const transactionGroups = new Map<string, any[]>();
    allTransactions.forEach((tx: any) => {
      const fingerprint = createTransactionFingerprint(tx);
      if (!transactionGroups.has(fingerprint)) {
        transactionGroups.set(fingerprint, []);
      }
      transactionGroups.get(fingerprint)!.push(tx);
    });
    
    // Find duplicates (groups with more than one transaction)
    const duplicateGroups = new Map<string, any[]>();
    transactionGroups.forEach((transactions, fingerprint) => {
      if (transactions.length > 1) {
        duplicateGroups.set(fingerprint, transactions);
        console.log(`[CLEANUP] 🔍 Found ${transactions.length} duplicates for: ${fingerprint}`);
      }
    });
    
    console.log(`[CLEANUP] 📊 Found ${duplicateGroups.size} groups with duplicates`);
    
    if (duplicateGroups.size === 0) {
      console.log('[CLEANUP] ✅ No duplicates found');
      return { removed: 0, kept: allTransactions.length };
    }
    
    let removedCount = 0;
    
    // Process each duplicate group
    for (const [fingerprint, duplicates] of duplicateGroups) {
      console.log(`[CLEANUP] 🔧 Processing ${duplicates.length} duplicates for: ${fingerprint}`);
      
      // Find the best transaction to keep
      const bestTransaction = duplicates.reduce((best, current) => {
        // Prefer transactions with manual changes
        if (current.isManuallyChanged && !best.isManuallyChanged) return current;
        if (!current.isManuallyChanged && best.isManuallyChanged) return best;
        
        // Prefer transactions with income links
        if (current.incomeTargetId && !best.incomeTargetId) return current;
        if (!current.incomeTargetId && best.incomeTargetId) return best;
        
        // Prefer transactions with categories
        if (current.appCategoryId && !best.appCategoryId) return current;
        if (!current.appCategoryId && best.appCategoryId) return best;
        
        // If all else equal, prefer the most recent
        return new Date(current.date) > new Date(best.date) ? current : best;
      });
      
      // Remove all duplicates except the best one
      const toRemove = duplicates.filter(tx => tx.id !== bestTransaction.id);
      console.log(`[CLEANUP] 🗑️ Removing ${toRemove.length} duplicates, keeping: ${bestTransaction.id}`);
      
      for (const txToRemove of toRemove) {
        try {
          const deleteResponse = await fetch(`/api/transactions/${txToRemove.id}`, {
            method: 'DELETE'
          });
          
          if (deleteResponse.ok) {
            removedCount++;
            console.log(`[CLEANUP] ✅ Removed duplicate: ${txToRemove.id}`);
          } else {
            console.error(`[CLEANUP] ❌ Failed to remove duplicate ${txToRemove.id}: ${deleteResponse.status}`);
          }
        } catch (error) {
          console.error(`[CLEANUP] ❌ Error removing duplicate ${txToRemove.id}:`, error);
        }
      }
    }
    
    const keptCount = allTransactions.length - removedCount;
    console.log(`[CLEANUP] 🎉 Cleanup complete: removed ${removedCount} duplicates, kept ${keptCount} transactions`);
    
    // Trigger UI refresh
    triggerUIRefresh();
    
    return { removed: removedCount, kept: keptCount };
    
  } catch (error) {
    console.error('[CLEANUP] ❌ Error during cleanup:', error);
    throw error;
  }
}

/**
 * COMPREHENSIVE duplicate cleanup specifically for the user's requirements
 * Removes duplicates based on date, description, and amount - handles time differences (12:00 vs 00:00)
 */
export async function comprehensiveDuplicateCleanup(): Promise<{removed: number; kept: number; summary: string[]}> {
  console.log('[COMPREHENSIVE] 🧹 Starting comprehensive duplicate cleanup for CSV import issues...');
  
  const summary: string[] = [];
  let totalRemoved = 0;
  
  try {
    // First run the standard cleanup
    console.log('[COMPREHENSIVE] Step 1: Running standard duplicate cleanup...');
    const standardResult = await cleanupDuplicateTransactions();
    totalRemoved += standardResult.removed;
    summary.push(`Standard cleanup: removed ${standardResult.removed} duplicates`);
    
    // Now do additional comprehensive cleanup for CSV-specific issues
    console.log('[COMPREHENSIVE] Step 2: Checking for CSV import-specific duplicates...');
    
    const response = await fetch('/api/transactions');
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.status}`);
    }
    
    const allTransactions = await response.json();
    console.log(`[COMPREHENSIVE] Analyzing ${allTransactions.length} transactions for advanced duplicates...`);
    
    // Group by enhanced fingerprint
    const fingerprintGroups = new Map<string, any[]>();
    allTransactions.forEach((tx: any) => {
      const fingerprint = createTransactionFingerprint(tx);
      if (!fingerprintGroups.has(fingerprint)) {
        fingerprintGroups.set(fingerprint, []);
      }
      fingerprintGroups.get(fingerprint)!.push(tx);
    });
    
    // Find and resolve complex duplicates
    let complexDuplicatesRemoved = 0;
    for (const [fingerprint, transactions] of fingerprintGroups) {
      if (transactions.length > 1) {
        console.log(`[COMPREHENSIVE] 🔧 Processing ${transactions.length} complex duplicates: ${fingerprint}`);
        
        // Sort by preference: manually changed > more categories > more recent
        const bestTransaction = transactions.reduce((best, current) => {
          // Prefer manually changed
          if (current.isManuallyChanged && !best.isManuallyChanged) return current;
          if (!current.isManuallyChanged && best.isManuallyChanged) return best;
          
          // Prefer transactions with more app categories
          const currentCategories = (current.appCategoryId ? 1 : 0) + (current.appSubCategoryId ? 1 : 0);
          const bestCategories = (best.appCategoryId ? 1 : 0) + (best.appSubCategoryId ? 1 : 0);
          if (currentCategories > bestCategories) return current;
          if (currentCategories < bestCategories) return best;
          
          // Prefer more recent
          return new Date(current.date || current.createdAt) > new Date(best.date || best.createdAt) ? current : best;
        });
        
        // Remove all others
        const toRemove = transactions.filter(tx => tx.id !== bestTransaction.id);
        for (const txToRemove of toRemove) {
          try {
            const deleteResponse = await fetch(`/api/transactions/${txToRemove.id}`, {
              method: 'DELETE'
            });
            
            if (deleteResponse.ok) {
              complexDuplicatesRemoved++;
              console.log(`[COMPREHENSIVE] ✅ Removed complex duplicate: ${txToRemove.id}`);
            } else {
              console.error(`[COMPREHENSIVE] ❌ Failed to remove duplicate ${txToRemove.id}: ${deleteResponse.status}`);
            }
          } catch (error) {
            console.error(`[COMPREHENSIVE] ❌ Error removing duplicate ${txToRemove.id}:`, error);
          }
        }
      }
    }
    
    totalRemoved += complexDuplicatesRemoved;
    summary.push(`Advanced cleanup: removed ${complexDuplicatesRemoved} complex duplicates`);
    
    const finalCount = allTransactions.length - totalRemoved;
    summary.push(`Final result: ${finalCount} transactions remaining`);
    
    console.log(`[COMPREHENSIVE] 🎉 Comprehensive cleanup complete!`);
    summary.forEach(line => console.log(`[COMPREHENSIVE] ${line}`));
    
    // Trigger UI refresh
    triggerUIRefresh();
    
    return { 
      removed: totalRemoved, 
      kept: finalCount, 
      summary 
    };
    
  } catch (error) {
    console.error('[COMPREHENSIVE] ❌ Error during comprehensive cleanup:', error);
    summary.push(`Error: ${error}`);
    throw error;
  }
}

// Event system for UI updates
const eventEmitter = new EventTarget();
export const APP_STATE_UPDATED = 'appstateupdated';
export { eventEmitter };

function triggerUIRefresh() {
  // Throttle UI refresh events to prevent spam and loops
  const now = Date.now();
  if (!window.lastUIRefresh || now - window.lastUIRefresh > 100) {
    console.log('🎯 [ORCHESTRATOR] Dispatching APP_STATE_UPDATED event...');
    
    // Only dispatch once - remove the delayed dispatch that was causing loops
    eventEmitter.dispatchEvent(new Event(APP_STATE_UPDATED));
    
    window.lastUIRefresh = now;
    
    // Trigger automatic Google Drive backup if enabled and signed in
    // Use setTimeout to avoid blocking the UI refresh
    setTimeout(() => {
      triggerAutoBackup();
    }, 100);
  }
}

// Automatic Google Drive backup after data changes
async function triggerAutoBackup() {
  try {
    // Check if auto backup is enabled
    const savedData = localStorage.getItem('budgetCalculatorData');
    if (!savedData) return;
    
    const settings = JSON.parse(savedData);
    if (!settings.autoBackupEnabled) return;
    
    // Check if Google Drive is available and user is signed in
    const status = simpleGoogleDriveService.getSignInStatus();
    if (!status.isSignedIn) return;
    
    console.log('[ORCHESTRATOR] 🔄 Triggering automatic Google Drive backup...');
    
    // Create backup in the background without blocking UI
    const success = await simpleGoogleDriveService.createBackup();
    if (success) {
      console.log('[ORCHESTRATOR] ✅ Automatic backup completed successfully');
    } else {
      console.warn('[ORCHESTRATOR] ⚠️ Automatic backup failed');
    }
  } catch (error) {
    console.error('[ORCHESTRATOR] ❌ Auto backup error:', error);
  }
}

// Track initialization to prevent multiple calls  
let isInitialized = false;

// NEW: Force reset initialization (for debugging)
export function resetInitialization(): void {
  console.log('🔄 [ORCHESTRATOR] Resetting initialization flag...');
  isInitialized = false;
}

// NEW: Force reload transactions from database (for debugging)
export async function forceReloadTransactions(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`🔄 [ORCHESTRATOR] FORCE RELOAD: Loading transactions from PostgreSQL at ${timestamp}`);
  
  // Also log to mobile debug logger
  const { addMobileDebugLog } = await import('../utils/mobileDebugLogger');
  addMobileDebugLog(`🔄 [FORCE RELOAD] Starting transaction reload at ${timestamp}...`);
  
  try {
    const { apiStore } = await import('../store/apiStore');
    const dbTransactions = await apiStore.getTransactions();
    
    console.log(`✅ [ORCHESTRATOR] FORCE RELOAD: Found ${dbTransactions.length} transactions in database`);
    addMobileDebugLog(`✅ [FORCE RELOAD] Found ${dbTransactions.length} transactions in database`);
    
    // Debug logging removed for performance

    // Convert and store transactions
    const convertedTransactions = (dbTransactions || []).map((tx, index) => {
      // Debug logging removed for performance
      
      const converted = {
        id: tx.id,
        accountId: tx.accountId,
        date: tx.date,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter || 0,
        description: tx.description,
        userDescription: tx.userDescription || '',
        type: tx.type || 'Transaction',
        status: tx.status || 'red',
        linkedTransactionId: tx.linkedTransactionId || (tx as any).linked_transaction_id,
        linkedCostId: tx.linkedCostId || (tx as any).linked_cost_id, // CRITICAL FIX: Handle snake_case
        savingsTargetId: tx.savingsTargetId || (tx as any).savings_target_id, // CRITICAL FIX: Include savingsTargetId field (handle both field names)
        incomeTargetId: tx.incomeTargetId || (tx as any).income_target_id, // Handle snake_case
        correctedAmount: tx.correctedAmount ?? (tx as any).corrected_amount ?? null, // Handle snake_case and null values
        linkedPerson: tx.linkedPerson || (tx as any).linked_person, // CRITICAL FIX: Include linkedPerson field (handle both field names)
        isManuallyChanged: tx.isManuallyChanged === 'true',
        appCategoryId: tx.appCategoryId || (tx as any).app_category_id,
        appSubCategoryId: tx.appSubCategoryId || (tx as any).app_sub_category_id,
        bankCategory: tx.bankCategory || '',
        bankSubCategory: tx.bankSubCategory || '',
        createdAt: tx.createdAt || new Date().toISOString(),
        fileSource: tx.fileSource || 'database'
      };
      
      // CRITICAL DEBUG: Log converted result
      if (index < 3) {
        console.log(`  - Converted amount: ${converted.amount} (type: ${typeof converted.amount})`);
        console.log(`  - Converted balanceAfter: ${converted.balanceAfter} (type: ${typeof converted.balanceAfter})`);
      }
      
      return converted;
    });
    
    // DEBUG: Check what we're about to store
    const convertedLonTransactions = convertedTransactions.filter(tx => tx.description === 'LÖN');
    addMobileDebugLog(`🔍 [FORCE RELOAD] About to store ${convertedLonTransactions.length} converted LÖN transactions`);
    convertedLonTransactions.forEach((tx, i) => {
      if (i < 3) {
        addMobileDebugLog(`🔍 [FORCE RELOAD] Converted LÖN ${i}: id=${tx.id}, savingsTargetId=${tx.savingsTargetId}`);
      }
    });
    
    // Store in centralized transaction storage
    state.budgetState.allTransactions = convertedTransactions;
    
    // Debug logging removed for performance
    
    console.log(`✅ [ORCHESTRATOR] FORCE RELOAD: Stored ${convertedTransactions.length} transactions in state`);
    addMobileDebugLog(`✅ [FORCE RELOAD] Updated budget state with ${convertedTransactions.length} transactions`);
    
    // Trigger UI refresh to show the transactions
    triggerUIRefresh();
    addMobileDebugLog(`✅ [FORCE RELOAD] Triggered UI refresh`);
    
  } catch (error) {
    console.error('❌ [ORCHESTRATOR] FORCE RELOAD failed:', error);
  }
}

// Throttle initialization calls to prevent infinite loops
let lastInitTime = 0;
const INIT_THROTTLE_MS = 5000; // Only allow initialization every 5 seconds

// Initialize the application
export async function initializeApp(): Promise<void> {
  const now = Date.now();
  const shouldSkip = now - lastInitTime < INIT_THROTTLE_MS;
  
  if (isInitialized && shouldSkip) {
    // Skip frequent repeated calls - app already initialized recently
    return;
  }
  
  lastInitTime = now;
  console.log('[BudgetOrchestrator] 🚀 initializeApp() called!');
  
  if (isInitialized) {
    // Only check transactions once every few seconds to prevent loops
    const currentTxCount = state?.budgetState?.allTransactions?.length || 0;
    if (currentTxCount === 0) {
      console.log('[BudgetOrchestrator] 🔄 No transactions found, forcing reload...');
      await forceReloadTransactions();
    }
    return;
  }
  
  isInitialized = true;
  console.log('[BudgetOrchestrator] ✅ Setting initialization flag and starting...');
  addMobileDebugLog('[ORCHESTRATOR] ✅ Setting initialization flag and starting...');
  
  // Wait for API store to be ready before initializing state
  const { apiStore } = await import('../store/apiStore');
  if (!apiStore.isLoading) {
    console.log('[BudgetOrchestrator] API store already loaded, syncing data...');
    addMobileDebugLog('[ORCHESTRATOR] API store already loaded, syncing data...');
  } else {
    console.log('[BudgetOrchestrator] Waiting for API store to load...');
    addMobileDebugLog('[ORCHESTRATOR] Waiting for API store to load...');
    // Wait a bit for API store to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  initializeStateFromStorage();
  
  // CRITICAL FIX: Load transactions AFTER state initialization to prevent conflicts
  console.log('🔄 [ORCHESTRATOR] CRITICAL: Force loading transactions AFTER state init...');
  await forceReloadTransactions();
  
  // Sync accounts from API store to orchestrator state (function was renamed)
  // Note: This functionality is now handled by React Query hooks
  
  // Ensure the Överföring account exists
  ensureOverforingAccount();
  
  // Clean up any invalid links to unknown accounts
  cleanupInvalidTransferLinks();
  
  addMobileDebugLog(`[ORCHESTRATOR] After storage init - available months: ${Object.keys(state.budgetState.historicalData).join(', ')}`);
  addMobileDebugLog(`[ORCHESTRATOR] Selected month: ${state.budgetState.selectedMonthKey}`);
  
  // Load monthly budget data from database for current month
  await loadMonthlyBudgetFromDatabase();
  
  // Load planned transfers from database
  await loadPlannedTransfersFromDatabase();
  
  // Load category rules from PostgreSQL
  await loadCategoryRulesFromDatabase();
  
  // CRITICAL FIX: Load all transactions from PostgreSQL at app startup (secondary check)
  console.log('🔍 [ORCHESTRATOR] About to call loadTransactionsFromDatabase...');
  await loadTransactionsFromDatabase();
  console.log('✅ [ORCHESTRATOR] loadTransactionsFromDatabase completed!');
  
  // Final check removed - duplicate loading removed for performance
  
  // CRITICAL: Final transaction count check before calculations
  console.log(`🔍 [ORCHESTRATOR] PRE-CALCULATION CHECK: ${state.budgetState.allTransactions.length} transactions in state`);
  
  // Run initial calculations to ensure state is up to date
  runCalculationsAndUpdateState();
  
  // DIAGNOSTIC: Check if calculations cleared transactions
  console.log(`🔍 [ORCHESTRATOR] POST-CALCULATION CHECK: ${state.budgetState.allTransactions.length} transactions in state`);
  
  // Mark loading as complete
  state.isLoading = false;
  addMobileDebugLog('[ORCHESTRATOR] ✅ App initialization complete - loading set to false');
  
  // Don't trigger UI refresh here - runCalculationsAndUpdateState() already does it
  addMobileDebugLog('[ORCHESTRATOR] 📡 App initialization complete - UI refresh was done by runCalculationsAndUpdateState');
}

// Get current state
export function getCurrentState() {
  // CRITICAL DEBUG: Log current state transactions for debugging
  const currentTransactionCount = state?.budgetState?.allTransactions?.length || 0;
  if (currentTransactionCount === 0) {
    console.warn(`[ORCHESTRATOR] getCurrentState() WARNING: allTransactions is empty or undefined`);
    console.warn(`[ORCHESTRATOR] State structure:`, {
      hasBudgetState: !!state?.budgetState,
      hasAllTransactions: !!state?.budgetState?.allTransactions,
      transactionCount: currentTransactionCount
    });
  } else {
  }
  
  return state;
}

// Subscribe/unsubscribe to state changes
export function subscribeToStateChanges(callback: () => void): void {
  console.log('🎯 [ORCHESTRATOR] Subscribing to state changes...');
  eventEmitter.addEventListener(APP_STATE_UPDATED, callback);
}

export function unsubscribeFromStateChanges(callback: () => void): void {
  console.log('🎯 [ORCHESTRATOR] Unsubscribing from state changes...');
  eventEmitter.removeEventListener(APP_STATE_UPDATED, callback);
}

// Main calculation and state update function
export function runCalculationsAndUpdateState(): void {
  // Only log once per second to prevent spam
  const now = Date.now();
  if (!window.lastCalcLog || now - window.lastCalcLog > 1000) {
    console.log('🔥 [ORCHESTRATOR] runCalculationsAndUpdateState() STARTED');
    window.lastCalcLog = now;
  }
  
  try {
    const { historicalData, accounts } = state.budgetState;
    const currentMonth = getCurrentMonthData();
    
    // Run calculations with the new state structure
    const { estimatedStartBalancesByMonth, estimatedFinalBalancesByMonth } = 
      calculateFullPrognosis(historicalData, accounts);
    const results = calculateBudgetResults(currentMonth);
    
    // Update estimated balances in historical data (direct state modification to avoid loops)
    Object.keys(estimatedStartBalancesByMonth).forEach(monthKey => {
      if (state.budgetState.historicalData[monthKey]) {
        // Direct state modification - no function calls to avoid infinite loops
        state.budgetState.historicalData[monthKey].accountEstimatedStartBalances = estimatedStartBalancesByMonth[monthKey];
        state.budgetState.historicalData[monthKey].accountEstimatedFinalBalances = estimatedFinalBalancesByMonth[monthKey];
        
        // CRITICAL: Log transaction count to ensure they're not being lost here
        const txCount = (state.budgetState.historicalData[monthKey].transactions || []).length;
        if (txCount > 0) {
          console.log(`[ORCHESTRATOR] 📊 Month ${monthKey} still has ${txCount} transactions after balance update`);
        }
      }
    });
    
    // Update calculated state
    state.calculated = {
      results: results,
      fullPrognosis: {
        accountProgression: calculateAccountProgression(historicalData, accounts),
        monthlyBreakdowns: calculateMonthlyBreakdowns(historicalData, accounts),
        projectedBalances: calculateProjectedBalances(historicalData, accounts)
      }
    };
    
    // Save and trigger UI update
    saveStateToStorage();
    triggerUIRefresh();
    
    // Reduced logging to prevent spam
    console.log('🔥 [ORCHESTRATOR] runCalculationsAndUpdateState() COMPLETED');
  } catch (error) {
    console.error('[BudgetOrchestrator] Error in calculations:', error);
  }
}

// Helper function for updating data
function updateAndRecalculate(updates: Partial<MonthData>): void {
  // Only log when debugging specific issues
  // console.log('🔥 [ORCHESTRATOR] updateAndRecalculate() called');
  updateCurrentMonthData(updates);
  runCalculationsAndUpdateState();
}

// ===== DATA UPDATE FUNCTIONS =====
// These functions now only write to historicalData[selectedMonthKey]

export function updateCostGroups(value: BudgetGroup[]): void {
  console.log('🔍 [ORCHESTRATOR] updateCostGroups called with:', value);
  console.log('🔍 [ORCHESTRATOR] Number of groups being saved:', value.length);
  value.forEach((group, index) => {
    console.log(`🔍 [ORCHESTRATOR] Group ${index}: ${group.name} with ${group.subCategories?.length || 0} subcategories`);
    if (group.subCategories) {
      group.subCategories.forEach((sub, subIndex) => {
        console.log(`  🔍 [ORCHESTRATOR] Subcategory ${subIndex}: ${sub.name} - ${sub.amount}`);
      });
    }
  });
  updateAndRecalculate({ costGroups: value });
}

export function updateSavingsGroups(value: BudgetGroup[]): void {
  updateAndRecalculate({ savingsGroups: value });
}



export function setCostGroups(value: BudgetGroup[]): void {
  updateAndRecalculate({ costGroups: value });
}

export function setSavingsGroups(value: BudgetGroup[]): void {
  updateAndRecalculate({ savingsGroups: value });
}

export function addSavingsItem(item: {
  mainCategory: string;
  subcategory: string;
  name: string;
  amount: number;
  account: string;
}): void {
  const currentMonthData = getCurrentMonthData();
  let savingsGroups = [...(currentMonthData.savingsGroups || [])];
  
  // Find or create the main category group
  let categoryGroup = savingsGroups.find(g => g.name === item.mainCategory);
  
  if (!categoryGroup) {
    // Create new category group
    categoryGroup = {
      id: uuidv4(),
      name: item.mainCategory,
      amount: 0,
      type: 'savings',
      subCategories: []
    };
    savingsGroups.push(categoryGroup);
  }
  
  // Find the account ID from the account name - TODO: Pass sqlAccounts parameter
  const accountId = state.budgetState.accounts.find(acc => acc.name === item.account)?.id || '';
  console.log('⚠️ [ORCHESTRATOR] Using legacy budgetState.accounts lookup - should pass sqlAccounts parameter');
  
  // Add the subcategory
  if (!categoryGroup.subCategories) {
    categoryGroup.subCategories = [];
  }
  
  categoryGroup.subCategories.push({
    id: uuidv4(),
    name: item.name,
    amount: item.amount,
    accountId: accountId
  });
  
  // Update the total amount for the category
  categoryGroup.amount = (categoryGroup.subCategories || []).reduce((sum, sub) => sum + sub.amount, 0);
  
  console.log('🔍 [ORCHESTRATOR] Adding savings item:', item);
  console.log('🔍 [ORCHESTRATOR] Updated savings groups:', savingsGroups);
  
  setSavingsGroups(savingsGroups);
}

export function setDailyTransfer(value: number): void {
  updateAndRecalculate({ dailyTransfer: value });
}

export function setWeekendTransfer(value: number): void {
  updateAndRecalculate({ weekendTransfer: value });
}

export function setCustomHolidays(value: {date: string, name: string}[]): void {
  updateAndRecalculate({ customHolidays: value });
}

export function setAndreasPersonalCosts(value: number): void {
  updateAndRecalculate({ andreasPersonalCosts: value });
}

export function setAndreasPersonalSavings(value: number): void {
  updateAndRecalculate({ andreasPersonalSavings: value });
}

export function setSusannaPersonalCosts(value: number): void {
  updateAndRecalculate({ susannaPersonalCosts: value });
}

export function setSusannaPersonalSavings(value: number): void {
  updateAndRecalculate({ susannaPersonalSavings: value });
}

export function setAccountBalances(value: {[key: string]: number}): void {
  updateAndRecalculate({ accountBalances: value });
}

export function setAccountBalancesSet(value: {[key: string]: boolean}): void {
  updateAndRecalculate({ accountBalancesSet: value });
}


export function unsetAccountBalance(accountName: string): void {
  const currentMonthData = getCurrentMonthData();
  const newBalances = { ...currentMonthData.accountBalances };
  const newBalancesSet = { ...currentMonthData.accountBalancesSet };
  
  // Set balance to 0 and mark as not set by user
  newBalances[accountName] = 0;
  newBalancesSet[accountName] = false;
  
  // Update current month accountBalances and accountBalancesSet
  updateAndRecalculate({ 
    accountBalances: newBalances,
    accountBalancesSet: newBalancesSet
  });
  
  console.log(`✅ Unset account balance for ${accountName} (marked as not set by user)`);
}

// ===== MONTH MANAGEMENT =====

export function setSelectedBudgetMonth(monthKey: string): void {
  console.log(`[ORCHESTRATOR] 🔄 Switching to month: ${monthKey}`);
  console.log(`[ORCHESTRATOR] 🔄 Current historicalData keys:`, Object.keys(state.budgetState.historicalData));
  
  // CRITICAL: Log transaction counts BEFORE switching
  Object.entries(state.budgetState.historicalData).forEach(([month, data]) => {
    const txCount = (data.transactions || []).length;
    if (txCount > 0) {
      console.log(`[ORCHESTRATOR] 📊 Month ${month} has ${txCount} transactions BEFORE switch`);
    }
  });
  
  state.budgetState.selectedMonthKey = monthKey;
  
  // CRITICAL FIX: Only create empty month data if it truly doesn't exist
  // AND preserve any existing transaction data from previous imports
  if (!state.budgetState.historicalData[monthKey]) {
    console.log(`[ORCHESTRATOR] 🆕 Creating new month data for ${monthKey} - preserving transactions`);
    
    // Check if there are any existing transactions for this month across the system
    const allTransactions = Object.values(state.budgetState.historicalData)
      .flatMap(month => (month.transactions || []) as ImportedTransaction[]);
    
    const existingTransactionsForMonth = allTransactions.filter(tx => {
      const txMonth = tx.date.substring(0, 7); // Get YYYY-MM format
      return txMonth === monthKey;
    });
    
    console.log(`[ORCHESTRATOR] 🔍 Found ${existingTransactionsForMonth.length} existing transactions for month ${monthKey}`);
    
    // Create empty month data but preserve any existing transactions
    const emptyMonth = createEmptyMonthData();
    // Convert ImportedTransaction to Transaction format
    emptyMonth.transactions = existingTransactionsForMonth.map(tx => ({
      ...tx,
      userDescription: tx.userDescription || '',
      bankCategory: tx.bankCategory || '',
      bankSubCategory: tx.bankSubCategory || '',
      balanceAfter: tx.balanceAfter || 0
    }));
    
    state.budgetState.historicalData[monthKey] = emptyMonth;
    
    console.log(`[ORCHESTRATOR] ✅ Created month ${monthKey} with ${existingTransactionsForMonth.length} preserved transactions`);
  } else {
    console.log(`[ORCHESTRATOR] ✅ Month ${monthKey} already exists with ${(state.budgetState.historicalData[monthKey].transactions || []).length} transactions`);
  }
  
  // CRITICAL: Log transaction counts AFTER switching
  console.log(`[ORCHESTRATOR] 📊 AFTER SWITCH - Transaction counts:`);
  Object.entries(state.budgetState.historicalData).forEach(([month, data]) => {
    const txCount = (data.transactions || []).length;
    console.log(`[ORCHESTRATOR] 📊 Month ${month}: ${txCount} transactions`);
  });
  
  saveStateToStorage();
  triggerUIRefresh();
}

export function setSelectedHistoricalMonth(monthKey: string): void {
  state.budgetState.selectedHistoricalMonth = monthKey;
  saveStateToStorage();
  triggerUIRefresh();
}

// ===== GLOBAL SETTINGS =====

// Load monthly account balances from database and sync to local state
export async function loadMonthlyAccountBalancesFromDatabase(): Promise<void> {
  try {
    console.log('[ORCHESTRATOR] 🔄 Loading account balances from budget_posts (Balance type)...');
    
    // Load Balance type budget posts instead of old monthly-account-balances
    const response = await fetch('/api/budget-posts?type=Balance');
    if (!response.ok) {
      console.error('[ORCHESTRATOR] ❌ Failed to fetch balance budget posts:', response.statusText);
      return;
    }
    
    const balancePosts = await response.json();
    console.log(`[ORCHESTRATOR] 📥 Loaded ${balancePosts.length} account balance posts from database`);
    
    // Get account mapping for name lookup
    const accountsResponse = await fetch('/api/accounts');
    const accounts = accountsResponse.ok ? await accountsResponse.json() : [];
    const accountMap = new Map(accounts.map((acc: any) => [acc.id, acc.name]));
    
    // Group balance posts by month and apply bank balances to historical data
    for (const post of balancePosts) {
      if (!post.monthKey || !post.accountId) continue;
      const monthKey = post.monthKey;
      const accountName = accountMap.get(post.accountId) || post.accountId;
      
      // Use account_balance (bank balance) if available, otherwise fall back to calculated balance
      const bankBalanceInOre = post.accountBalance || 0;
      const balanceInKr = bankBalanceInOre / 100; // Convert from öre to kronor
      
      // Skip if no balance to apply
      if (balanceInKr === 0) continue;
      
      // Ensure the month exists in historical data
      if (!state.budgetState.historicalData[monthKey]) {
        const currentMonthData = getCurrentMonthData();
        state.budgetState.historicalData[monthKey] = { ...currentMonthData };
      }
      
      const monthData = state.budgetState.historicalData[monthKey];
      monthData.accountBalances = monthData.accountBalances || {};
      monthData.accountBalancesSet = monthData.accountBalancesSet || {};
      
      monthData.accountBalances[accountName] = balanceInKr;
      monthData.accountBalancesSet[accountName] = true;
      
      console.log(`[ORCHESTRATOR] 💰 Loaded ${accountName} bank balance for ${monthKey}: ${balanceInKr} kr`);
    }
    
    console.log('[ORCHESTRATOR] ✅ Account balances loaded from budget_posts');
    addMobileDebugLog(`✅ Loaded ${balancePosts.length} account balances from budget_posts`);
    
  } catch (error) {
    console.error('[ORCHESTRATOR] ❌ Error loading monthly account balances from database:', error);
    addMobileDebugLog(`❌ Error loading monthly balances: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Accounts are now synced via React Query hooks
// This function is removed to prevent apiStore.getAccounts() error

export function setAccounts(accounts: any[]): void {
  console.log('🚫 [ORCHESTRATOR] setAccounts is deprecated - use SQL API via useAccounts hook instead');
  console.log('🔄 [ORCHESTRATOR] Legacy setAccounts call attempted with:', accounts);
  // This function is now deprecated - accounts should be managed through SQL API
  // Components should use useCreateAccount, useUpdateAccount, useDeleteAccount hooks
  triggerUIRefresh();
}

export function addAccount(account: { name: string; startBalance: number }): void {
  console.log('🚫 [ORCHESTRATOR] addAccount is deprecated - use SQL API via useCreateAccount hook instead');
  console.log('🔄 [ORCHESTRATOR] Legacy addAccount call attempted with:', account);
  // This function is now deprecated - accounts should be created through SQL API
  // Components should use the useCreateAccount hook from useAccounts.ts
  triggerUIRefresh();
}

// DISABLED: Prevent duplicate account creation
export async function ensureOverforingAccount(sqlAccounts?: any[]): Promise<void> {
  console.log('🚫 [ORCHESTRATOR] ensureOverforingAccount is DISABLED to prevent duplicates');
  console.log('🔍 [ORCHESTRATOR] Överföring accounts should be created manually when needed');
  
  // CRITICAL FIX: This function was causing multiple duplicate "Överföring" accounts
  // to be created during app initialization. We disable it completely.
  // Users can create transfer accounts manually through the UI when needed.
  
  // Optional: Log existing Överföring accounts for debugging
  try {
    const response = await fetch('/api/accounts');
    if (response.ok) {
      const allAccounts = await response.json();
      const overforingAccounts = allAccounts.filter((acc: any) => acc.name === "Överföring");
      console.log(`🔍 [ORCHESTRATOR] Found ${overforingAccounts.length} existing Överföring accounts`);
      overforingAccounts.forEach((acc: any, idx: number) => {
        console.log(`  - Account ${idx + 1}: id=${acc.id}, assigned_to=${acc.assignedTo}, bank_template_id=${acc.bankTemplateId}`);
      });
    }
  } catch (error) {
    console.error('❌ [ORCHESTRATOR] Error checking existing accounts:', error);
  }
}

export function removeAccount(accountId: string): void {
  console.log('🚫 [ORCHESTRATOR] removeAccount is deprecated - use SQL API via useDeleteAccount hook instead');
  console.log('🔄 [ORCHESTRATOR] Legacy removeAccount call attempted with:', accountId);
  // This function is now deprecated - accounts should be deleted through SQL API
  // Components should use the useDeleteAccount hook from useAccounts.ts
  triggerUIRefresh();
}

// ===== BANK TEMPLATE MANAGEMENT =====

export async function linkAccountToBankTemplate(accountId: string, templateId: string): Promise<void> {
  console.log(`[ORCHESTRATOR] 🏦 Linking account ${accountId} to bank template ${templateId}`);
  
  try {
    // Update account in PostgreSQL via API
    const response = await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bankTemplateId: templateId })
    });

    if (!response.ok) {
      throw new Error(`Failed to update account: ${response.statusText}`);
    }

    triggerUIRefresh();
    console.log(`[ORCHESTRATOR] ✅ Account ${accountId} linked to template ${templateId}`);
  } catch (error) {
    console.error(`[ORCHESTRATOR] ❌ Failed to link account ${accountId} to template ${templateId}:`, error);
  }
}

// ===== HELPER FUNCTIONS =====

function createEmptyMonthData(): MonthData {
  return {
    costGroups: [
      { id: '1', name: 'Hyra', amount: 15000, type: 'cost' },
      { id: '2', name: 'Mat & Kläder', amount: 8000, type: 'cost' },
      { id: '3', name: 'Transport', amount: 2000, type: 'cost', subCategories: [] }
    ],
    savingsGroups: [],
    costItems: [], // Nya struktur
    savingsItems: [], // Nya struktur
    dailyTransfer: 300,
    weekendTransfer: 540,
    andreasPersonalCosts: 0,
    andreasPersonalSavings: 0,
    susannaPersonalCosts: 0,
    susannaPersonalSavings: 0,
    customHolidays: [],
    accountBalances: {},
    accountBalancesSet: {},
    accountEstimatedFinalBalances: {},
    accountEstimatedFinalBalancesSet: {},
    accountEstimatedStartBalances: {},
    accountStartBalancesSet: {},
    userName1: 'Andreas',
    userName2: 'Susanna',
    transferChecks: {},
    andreasShareChecked: false,
    susannaShareChecked: false,
    monthFinalBalances: {},
    accountEndingBalances: {},
    transactions: [], // NYTT FÄLT
    createdAt: new Date().toISOString()
  };
}

// CRITICAL FIX: New function that preserves existing transactions when creating month data
function createEmptyMonthDataWithTransactionPreservation(monthKey: string): MonthData {
  console.log(`[ORCHESTRATOR] 🔍 Creating month data for ${monthKey} with transaction preservation`);
  
  // Check if there are any existing transactions for this month across all stored months
  const allTransactions = Object.values(state.budgetState.historicalData)
    .flatMap(month => (month.transactions || []) as any[]);
  
  const existingTransactionsForMonth = allTransactions.filter(tx => {
    const txMonth = tx.date.substring(0, 7); // Get YYYY-MM format
    return txMonth === monthKey;
  });
  
  console.log(`[ORCHESTRATOR] 🔍 Found ${existingTransactionsForMonth.length} existing transactions for month ${monthKey}`);
  
  // Create empty month data but preserve any existing transactions
  const emptyMonth = createEmptyMonthData();
  emptyMonth.transactions = existingTransactionsForMonth.map(tx => ({
    ...tx,
    userDescription: tx.userDescription || '',
    bankCategory: tx.bankCategory || '',
    bankSubCategory: tx.bankSubCategory || '',
    balanceAfter: tx.balanceAfter || 0
  }));
  
  console.log(`[ORCHESTRATOR] ✅ Created month ${monthKey} with ${existingTransactionsForMonth.length} preserved transactions`);
  return emptyMonth;
}

// Legacy compatibility functions (to be removed after component refactoring)
export function forceRecalculation(): void {
  runCalculationsAndUpdateState();
}

export function setResults(value: any): void {
  state.calculated.results = value;
  triggerUIRefresh();
}

export function updateHistoricalData(value: any): void {
  // Remove excessive debug logging to prevent console spam
  console.log('🔥 [ORCHESTRATOR] updateHistoricalData called');
  
  state.budgetState.historicalData = value;
  saveStateToStorage();
  triggerUIRefresh();
}

export function setHistoricalData(value: any): void {
  state.budgetState.historicalData = value;
  saveStateToStorage();
  triggerUIRefresh();
}

export function updateHistoricalDataSingle(monthKey: string, data: any): void {
  state.budgetState.historicalData[monthKey] = data;
  saveStateToStorage();
  triggerUIRefresh();
}

export function updateSelectedBudgetMonth(value: string): void {
  setSelectedBudgetMonth(value);
}

export function setAccountEstimatedFinalBalances(value: {[key: string]: number}): void {
  updateAndRecalculate({ accountEstimatedFinalBalances: value });
}

export function setAccountEstimatedFinalBalancesSet(value: {[key: string]: boolean}): void {
  updateAndRecalculate({ accountEstimatedFinalBalancesSet: value });
}

export function setAccountEstimatedStartBalances(value: {[key: string]: number}): void {
  updateAndRecalculate({ accountEstimatedStartBalances: value });
}

export function setAccountStartBalancesSet(value: {[key: string]: boolean}): void {
  updateAndRecalculate({ accountStartBalancesSet: value });
}

// setAccountEndBalances and setAccountEndBalancesSet removed - now calculated dynamically

export function setMonthFinalBalances(value: {[key: string]: boolean}): void {
  updateAndRecalculate({ monthFinalBalances: value });
}

// Main categories management
export function setMainCategories(value: string[]): void {
  state.budgetState.mainCategories = value;
  // No longer saving to localStorage - will be persisted via API
  triggerUIRefresh();
}

// ===== SAVINGS GOALS MANAGEMENT =====

export const createSavingsGoal = (goalData: Omit<SavingsGoal, 'id'>) => {
  console.log(`🎯 [ORCHESTRATOR] Creating new savings goal: ${goalData.name}`);
  
  const newGoal: SavingsGoal = {
    ...goalData,
    id: uuidv4() // Generate unique ID
  };
  
  state.budgetState.savingsGoals.push(newGoal);
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log(`✅ [ORCHESTRATOR] Savings goal created successfully`);
};

export const updateSavingsGoal = (goalId: string, updates: Partial<SavingsGoal>) => {
  console.log(`🎯 [ORCHESTRATOR] Updating savings goal: ${goalId}`);
  
  const goalIndex = state.budgetState.savingsGoals.findIndex(goal => goal.id === goalId);
  if (goalIndex !== -1) {
    state.budgetState.savingsGoals[goalIndex] = {
      ...state.budgetState.savingsGoals[goalIndex],
      ...updates
    };
    saveStateToStorage();
    triggerUIRefresh();
    console.log(`✅ [ORCHESTRATOR] Savings goal updated successfully`);
  } else {
    console.error(`❌ [ORCHESTRATOR] Savings goal not found: ${goalId}`);
  }
};

export const deleteSavingsGoal = (goalId: string) => {
  console.log(`🎯 [ORCHESTRATOR] Deleting savings goal: ${goalId}`);
  
  state.budgetState.savingsGoals = state.budgetState.savingsGoals.filter(goal => goal.id !== goalId);
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log(`✅ [ORCHESTRATOR] Savings goal deleted successfully`);
};

// ===== TRANSACTION MANAGEMENT =====

/**
 * @deprecated This function is deprecated and will be removed in future versions.
 * Use useUpdateTransaction() React Query hook instead for proper SQL persistence.
 * This function now throws an error to prevent accidental usage.
 */
export function updateTransaction(transactionId: string, updates: Partial<ImportedTransaction>, monthKey?: string): void {
  addMobileDebugLog('🚨 [LEGACY ERROR] updateTransaction() was called - THIS IS DEPRECATED AND DISABLED');
  addMobileDebugLog(`🚨 [LEGACY ERROR] Attempted to update transaction ${transactionId} with: ${JSON.stringify(updates)}`);
  addMobileDebugLog('🚨 [LEGACY ERROR] Use useUpdateTransaction() React Query hook instead');
  
  console.error('🚨 [LEGACY ERROR] updateTransaction() is deprecated and disabled!');
  console.error('🚨 [LEGACY ERROR] Transaction ID:', transactionId, 'Updates:', updates);
  console.error('🚨 [LEGACY ERROR] Use useUpdateTransaction() React Query hook instead');
  
  // Throw an error to make it clear this function should not be used
  throw new Error('updateTransaction() is deprecated. Use useUpdateTransaction() React Query hook instead.');
}

/**
 * @deprecated This function is deprecated and will be removed in future versions.
 * Use useUpdateTransaction() React Query hook with Promise.all instead for proper SQL persistence.
 * This function now throws an error to prevent accidental usage.
 */
export function matchInternalTransfer(t1Id: string, t2Id: string): void {
  addMobileDebugLog('🚨 [LEGACY ERROR] matchInternalTransfer() was called - THIS IS DEPRECATED AND DISABLED');
  addMobileDebugLog(`🚨 [LEGACY ERROR] Attempted to match ${t1Id} <-> ${t2Id}`);
  addMobileDebugLog('🚨 [LEGACY ERROR] Use useUpdateTransaction() React Query hook with Promise.all instead');
  
  console.error('🚨 [LEGACY ERROR] matchInternalTransfer() is deprecated and disabled!');
  console.error('🚨 [LEGACY ERROR] Transaction IDs:', t1Id, t2Id);
  console.error('🚨 [LEGACY ERROR] Use useUpdateTransaction() React Query hook with Promise.all instead');
  
  // Throw an error to make it clear this function should not be used
  throw new Error('matchInternalTransfer() is deprecated. Use useUpdateTransaction() React Query hook with Promise.all instead.');
}

/**
  let t1MonthKey = '';
  let t2MonthKey = '';
  
  addMobileDebugLog(`🔍 [LEGACY] Searching for transactions in centralized storage...`);
  addMobileDebugLog(`🔍 [LEGACY] Found t1 in centralized: ${!!t1}`);
  addMobileDebugLog(`🔍 [LEGACY] Found t2 in centralized: ${!!t2}`);
  
  // If found in centralized storage, derive month keys from dates
  if (t1) {
    t1MonthKey = t1.date.substring(0, 7);
    addMobileDebugLog(`🔍 [LEGACY] t1 month key: ${t1MonthKey}`);
  }
  if (t2) {
    t2MonthKey = t2.date.substring(0, 7);
    addMobileDebugLog(`🔍 [LEGACY] t2 month key: ${t2MonthKey}`);
  }
  
  // Fallback: search in monthly historical data if not found in centralized storage
  if (!t1 || !t2) {
    addMobileDebugLog('🔍 [LEGACY] Searching in historical data...');
    Object.keys(state.budgetState.historicalData).forEach(monthKey => {
      const monthData = state.budgetState.historicalData[monthKey];
      if (monthData?.transactions) {
        const foundT1 = monthData.transactions.find(t => t.id === t1Id);
        const foundT2 = monthData.transactions.find(t => t.id === t2Id);
        
        if (foundT1 && !t1) {
          t1 = foundT1;
          t1MonthKey = monthKey;
          addMobileDebugLog(`🔍 [LEGACY] Found t1 in historical data: ${monthKey}`);
        }
        if (foundT2 && !t2) {
          t2 = foundT2;
          t2MonthKey = monthKey;
          addMobileDebugLog(`🔍 [LEGACY] Found t2 in historical data: ${monthKey}`);
        }
      }
    });
  }
  
  if (!t1 || !t2) {
    addMobileDebugLog('❌ [LEGACY ERROR] Could not find one or both transactions');
    console.error(`❌ [ORCHESTRATOR] Could not find transactions: t1=${!!t1} t2=${!!t2}`);
    console.error(`❌ [ORCHESTRATOR] Searched for ${t1Id} and ${t2Id} in ${state.budgetState.allTransactions.length} centralized transactions and ${Object.keys(state.budgetState.historicalData).length} historical months`);
    return;
  }
  
  console.log(`✅ [ORCHESTRATOR] Found transactions in months: t1=${t1MonthKey}, t2=${t2MonthKey}`);
  
  // TODO: Pass sqlAccounts parameter to avoid legacy budgetState lookup
  const account1Name = state.budgetState.accounts.find(a => a.id === t1.accountId)?.name || t1.accountId;
  const account2Name = state.budgetState.accounts.find(a => a.id === t2.accountId)?.name || t2.accountId;
  console.log('⚠️ [ORCHESTRATOR] Using legacy budgetState.accounts lookup - should pass sqlAccounts parameter');
  
  addMobileDebugLog(`🏦 [LEGACY] Account 1: ${account1Name}`);
  addMobileDebugLog(`🏦 [LEGACY] Account 2: ${account2Name}`);
  
  console.log(`🔄 [ORCHESTRATOR] Matching ${account1Name} transaction "${t1.description}" with ${account2Name} transaction "${t2.description}"`);
  
  // Update both transactions with link and description
  addMobileDebugLog('⚠️ [LEGACY] About to call updateTransaction() for t1 (WILL NOT SAVE)');
  updateTransaction(t1.id, {
    type: 'InternalTransfer',
    linkedTransactionId: t2.id,
    userDescription: `Överföring till ${account2Name}, ${t2.date}`,
    isManuallyChanged: true
  }, t1MonthKey);
  
  addMobileDebugLog('⚠️ [LEGACY] About to call updateTransaction() for t2 (WILL NOT SAVE)');
  updateTransaction(t2.id, {
    type: 'InternalTransfer',
    linkedTransactionId: t1.id,
    userDescription: `Överföring från ${account1Name}, ${t1.date}`,
    isManuallyChanged: true
  }, t2MonthKey);
  
  addMobileDebugLog('⚠️ [LEGACY] matchInternalTransfer completed - but no data was saved to SQL');
  console.log(`✅ [ORCHESTRATOR] Successfully matched internal transfer between ${t1Id} and ${t2Id}`);
}

/**
 * Unlinks an internal transfer and resets both transactions' status
 * @param transactionId - The ID of one of the linked transactions
 */
export function unlinkInternalTransfer(transactionId: string): void {
  console.log(`🔓 [ORCHESTRATOR] Unlinking internal transfer: ${transactionId}`);
  
  const transaction = findTransactionById(transactionId);
  if (!transaction) {
    console.error(`❌ [ORCHESTRATOR] Transaction not found: ${transactionId}`);
    return;
  }
  
  const linkedTransactionId = transaction.linkedTransactionId;
  if (!linkedTransactionId) {
    console.warn(`⚠️ [ORCHESTRATOR] Transaction has no linked transaction: ${transactionId}`);
    return;
  }
  
  const linkedTransaction = findTransactionById(linkedTransactionId);
  const t1MonthKey = findMonthKeyForTransaction(transactionId);
  const t2MonthKey = linkedTransaction ? findMonthKeyForTransaction(linkedTransactionId) : null;
  
  // Update first transaction - remove link and recalculate status
  const newStatus1 = determineTransactionStatus({
    ...transaction,
    linkedTransactionId: undefined,
    type: 'Transaction'
  });
  
  updateTransaction(transactionId, {
    linkedTransactionId: undefined,
    type: 'Transaction',
    status: newStatus1,
    isManuallyChanged: true
  }, t1MonthKey || state.budgetState.selectedMonthKey);
  
  // Update linked transaction if it exists
  if (linkedTransaction && t2MonthKey) {
    const newStatus2 = determineTransactionStatus({
      ...linkedTransaction,
      linkedTransactionId: undefined,
      type: 'Transaction'
    });
    
    updateTransaction(linkedTransactionId, {
      linkedTransactionId: undefined,
      type: 'Transaction',
      status: newStatus2,
      isManuallyChanged: true
    }, t2MonthKey);
  }
  
  console.log(`✅ [ORCHESTRATOR] Successfully unlinked internal transfer between ${transactionId} and ${linkedTransactionId}`);
}

export function linkSavingsTransaction(transactionId: string, savingsTargetId: string, mainCategoryId: string, monthKey?: string): void {
  console.log(`🔗 [DEBUG] linkSavingsTransaction called with:`, { transactionId, savingsTargetId, mainCategoryId, monthKey });
  
  // Use provided monthKey or fall back to selected month
  const targetMonthKey = monthKey || state.budgetState.selectedMonthKey;
  console.log(`🔗 [DEBUG] Target month:`, targetMonthKey);
  
  const targetMonth = state.budgetState.historicalData[targetMonthKey];
  const transactionExists = targetMonth?.transactions?.find(t => t.id === transactionId);
  console.log(`🔗 [DEBUG] Transaction exists in target month:`, !!transactionExists);
  console.log(`🔗 [DEBUG] Transaction before update:`, transactionExists ? { id: transactionExists.id, type: transactionExists.type, savingsTargetId: transactionExists.savingsTargetId, appCategoryId: transactionExists.appCategoryId } : 'NOT FOUND');
  
  // Get the transaction to preserve its linkedTransactionId
  const transaction = findTransactionById(transactionId);
  
  updateTransaction(transactionId, {
    type: 'Savings',
    savingsTargetId: savingsTargetId,
    appCategoryId: mainCategoryId, // Save the main category ID directly on the transaction
    linkedTransactionId: transaction?.linkedTransactionId // Preserve the internal transfer link if it exists
  }, targetMonthKey);
  
  // Check after update
  const updatedMonth = state.budgetState.historicalData[targetMonthKey];
  const updatedTransaction = updatedMonth?.transactions?.find(t => t.id === transactionId);
  console.log(`🔗 [DEBUG] Transaction after update:`, updatedTransaction ? { id: updatedTransaction.id, type: updatedTransaction.type, savingsTargetId: updatedTransaction.savingsTargetId, appCategoryId: updatedTransaction.appCategoryId } : 'NOT FOUND');
  
  console.log(`✅ [Orchestrator] Linked transaction ${transactionId} to savings target ${savingsTargetId} with main category ${mainCategoryId} in month ${targetMonthKey}`);
}

// Helper function to find transaction by ID across all months
function findTransactionById(transactionId: string): any {
  // CRITICAL: Use centralized transaction storage
  return state.budgetState.allTransactions.find(t => t.id === transactionId) || null;
}

// Helper function to find month key for a transaction
function findMonthKeyForTransaction(transactionId: string): string | null {
  // CRITICAL: Use centralized transaction storage
  const transaction = state.budgetState.allTransactions.find(t => t.id === transactionId);
  if (!transaction) return null;
  
  // Extract month key from transaction date
  const date = new Date(transaction.date);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return monthKey;
}

// Helper function to update multiple transactions efficiently
function updateMultipleTransactions(updates: { transactionId: string, monthKey: string, updates: Partial<any> }[]): void {
  updates.forEach(({ transactionId, monthKey, updates: transactionUpdates }) => {
    updateTransaction(transactionId, transactionUpdates, monthKey);
  });
}

// Function to recalculate all transaction statuses using the current logic
export function recalculateAllTransactionStatuses(): void {
  console.log('🔄 [ORCHESTRATOR] Recalculating all transaction statuses...');
  
  let updatedCount = 0;
  
  // Update all transactions in centralized storage
  state.budgetState.allTransactions.forEach((transaction, index) => {
    const currentStatus = transaction.status;
    const newStatus = determineTransactionStatus(transaction);
    
    if (currentStatus !== newStatus) {
      state.budgetState.allTransactions[index] = {
        ...transaction,
        status: newStatus
      };
      updatedCount++;
      console.log(`🔄 [ORCHESTRATOR] Updated status for transaction ${transaction.id}: ${currentStatus} -> ${newStatus}`);
    }
  });
  
  console.log(`✅ [ORCHESTRATOR] Recalculated statuses for ${updatedCount} transactions`);
  
  if (updatedCount > 0) {
    saveStateToStorage();
    runCalculationsAndUpdateState();
  }
}

// Function to clean up invalid transfer links to unknown accounts
function cleanupInvalidTransferLinks(): void {
  console.log('🔄 [ORCHESTRATOR] Cleaning up invalid transfer links to unknown accounts...');
  
  let cleanedCount = 0;
  
  // Find all linked transactions where either transaction points to a non-existent account
  state.budgetState.allTransactions.forEach(transaction => {
    if (transaction.linkedTransactionId) {
      const linkedTx = state.budgetState.allTransactions.find(t => t.id === transaction.linkedTransactionId);
      
      // Check if either account doesn't exist - TODO: Pass sqlAccounts parameter
      const transactionAccount = state.budgetState.accounts.find(acc => acc.id === transaction.accountId);
      const linkedAccount = linkedTx ? state.budgetState.accounts.find(acc => acc.id === linkedTx.accountId) : null;
      console.log('⚠️ [ORCHESTRATOR] Using legacy budgetState.accounts lookup - should pass sqlAccounts parameter');
      
      if (!transactionAccount || !linkedAccount || !linkedTx) {
        console.log(`[ORCHESTRATOR] Removing invalid link: transaction ${transaction.id} (account ${transaction.accountId}) -> ${transaction.linkedTransactionId}`);
        
        // Remove the link from current transaction
        const transactionIndex = state.budgetState.allTransactions.findIndex(t => t.id === transaction.id);
        if (transactionIndex !== -1) {
          state.budgetState.allTransactions[transactionIndex] = {
            ...state.budgetState.allTransactions[transactionIndex],
            linkedTransactionId: undefined,
            type: 'Transaction' // Reset to default type
          };
        }
        
        // Remove the reverse link if it exists
        if (linkedTx) {
          const linkedIndex = state.budgetState.allTransactions.findIndex(t => t.id === linkedTx.id);
          if (linkedIndex !== -1) {
            state.budgetState.allTransactions[linkedIndex] = {
              ...state.budgetState.allTransactions[linkedIndex],
              linkedTransactionId: undefined,
              type: 'Transaction' // Reset to default type
            };
          }
        }
        
        cleanedCount++;
      }
    }
  });
  
  console.log(`✅ [ORCHESTRATOR] Cleaned up ${cleanedCount} invalid transfer links`);
}

// Load monthly budget from database and update state
async function loadMonthlyBudgetFromDatabase(): Promise<void> {
  try {
    const monthKey = state.budgetState.selectedMonthKey;
    console.log('📊 [ORCHESTRATOR] Loading monthly budget from database for month:', monthKey);
    addMobileDebugLog(`📊 [ORCHESTRATOR] Loading monthly budget from database for month: ${monthKey}`);
    
    const budget = await monthlyBudgetService.loadMonthlyBudgetFromDatabase(monthKey);
    
    if (budget) {
      console.log('✅ [ORCHESTRATOR] Loaded monthly budget from database:', budget);
      addMobileDebugLog(`✅ [ORCHESTRATOR] Loaded monthly budget from database`);
      
      // Update current month data with database values
      const updates = {
        dailyTransfer: budget.dailyTransfer,
        weekendTransfer: budget.weekendTransfer,
        andreasPersonalCosts: budget.andreasPersonalCosts,
        andreasPersonalSavings: budget.andreasPersonalSavings,
        susannaPersonalCosts: budget.susannaPersonalCosts,
        susannaPersonalSavings: budget.susannaPersonalSavings,
        userName1: budget.userName1,
        userName2: budget.userName2
      };
      
      updateCurrentMonthData(updates);
      console.log('✅ [ORCHESTRATOR] Updated current month data with database values');
      addMobileDebugLog('✅ [ORCHESTRATOR] Updated current month data with database values');
    } else {
      console.log('⚠️ [ORCHESTRATOR] No monthly budget found in database, using default values');
      addMobileDebugLog('⚠️ [ORCHESTRATOR] No monthly budget found in database, using default values');
    }
  } catch (error) {
    console.error('❌ [ORCHESTRATOR] Error loading monthly budget from database:', error);
    addMobileDebugLog(`❌ [ORCHESTRATOR] Error loading monthly budget: ${error}`);
  }
}

// Function to perform automatic transfer matching for InternalTransfer transactions
function performAutomaticTransferMatching(): void {
  console.log('🔄 [ORCHESTRATOR] Performing automatic transfer matching...');
  
  // First clean up any existing invalid links
  cleanupInvalidTransferLinks();
  
  let matchedCount = 0;
  
  // Find all InternalTransfer transactions that don't have linked transactions
  const unmatchedTransfers = state.budgetState.allTransactions.filter(tx => 
    tx.type === 'InternalTransfer' && !tx.linkedTransactionId
  );
  
  console.log(`[ORCHESTRATOR] Found ${unmatchedTransfers.length} unmatched internal transfers`);
  
  unmatchedTransfers.forEach(transaction => {
    // Skip transactions from accounts that don't exist (would show as "Okänt konto") - TODO: Pass sqlAccounts parameter
    const transactionAccount = state.budgetState.accounts.find(acc => acc.id === transaction.accountId);
    if (!transactionAccount) {
      console.log(`[ORCHESTRATOR] Skipping transaction ${transaction.id} - account ${transaction.accountId} not found`);
      console.log('⚠️ [ORCHESTRATOR] Using legacy budgetState.accounts lookup - should pass sqlAccounts parameter');
      return;
    }
    console.log('⚠️ [ORCHESTRATOR] Using legacy budgetState.accounts lookup - should pass sqlAccounts parameter');
    
    // Find potential matches on the same date with opposite signs on different accounts
    const potentialMatches = state.budgetState.allTransactions.filter(t => {
      // Skip transactions from accounts that don't exist - TODO: Pass sqlAccounts parameter
      const targetAccount = state.budgetState.accounts.find(acc => acc.id === t.accountId);
      if (!targetAccount) {
        return false;
      }
      console.log('⚠️ [ORCHESTRATOR] Using legacy budgetState.accounts lookup - should pass sqlAccounts parameter');
      
      return t.id !== transaction.id &&
        t.accountId !== transaction.accountId && // Different account
        t.date === transaction.date && // Same date only
        // Opposite signs (positive matches negative, negative matches positive)
        ((transaction.amount > 0 && t.amount < 0) || (transaction.amount < 0 && t.amount > 0)) &&
        Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01 && // Same absolute amount
        !t.linkedTransactionId; // Not already linked
    });
    
    console.log(`[ORCHESTRATOR] Found ${potentialMatches.length} potential matches for transaction ${transaction.id}`);
    
    // If exactly one match found, auto-link them
    if (potentialMatches.length === 1) {
      const matchedTransaction = potentialMatches[0];
      console.log(`[ORCHESTRATOR] Auto-matching ${transaction.id} with ${matchedTransaction.id}`);
      
      // Update both transactions to be InternalTransfer and link them
      const transactionIndex = state.budgetState.allTransactions.findIndex(t => t.id === transaction.id);
      const matchedIndex = state.budgetState.allTransactions.findIndex(t => t.id === matchedTransaction.id);
      
      if (transactionIndex !== -1 && matchedIndex !== -1) {
        state.budgetState.allTransactions[transactionIndex] = {
          ...state.budgetState.allTransactions[transactionIndex],
          type: 'InternalTransfer',
          linkedTransactionId: matchedTransaction.id,
          isManuallyChanged: true
        };
        
        state.budgetState.allTransactions[matchedIndex] = {
          ...state.budgetState.allTransactions[matchedIndex],
          type: 'InternalTransfer',
          linkedTransactionId: transaction.id,
          isManuallyChanged: true
        };
        
        matchedCount++;
        console.log(`[ORCHESTRATOR] Successfully matched internal transfer between ${transaction.id} and ${matchedTransaction.id}`);
      }
    }
  });
  
  console.log(`✅ [ORCHESTRATOR] Automatically matched ${matchedCount} internal transfers`);
}

// NEW UNIFIED FUNCTION - replaces both applyExpenseClaim and coverCost
export function linkExpenseAndCoverage(negativeTxId: string, positiveTxId: string): void {
  console.log(`🔗 [Orchestrator] Linking expense and coverage - negative: ${negativeTxId}, positive: ${positiveTxId}`);
  
  const negativeTx = findTransactionById(negativeTxId);
  const positiveTx = findTransactionById(positiveTxId);

  if (!negativeTx || !positiveTx) {
    console.error("[Orchestrator] Could not find one or both transactions.");
    return;
  }

  const expenseAmount = Math.abs(negativeTx.amount); // e.g., 414
  const coverageAmount = positiveTx.amount;          // e.g., 300 or 1000

  // Calculate how much of the expense can be covered
  const amountToCover = Math.min(expenseAmount, coverageAmount); // e.g., min(414, 300) -> 300

  // Calculate the new corrected amounts
  const newNegativeCorrectedAmount = negativeTx.amount + amountToCover; // e.g., -414 + 300 = -114
  const newPositiveCorrectedAmount = coverageAmount - amountToCover; // e.g., 300 - 300 = 0

  console.log(`🔗 [Orchestrator] Coverage calculation:`, {
    expenseAmount,
    coverageAmount,
    amountToCover,
    newNegativeCorrectedAmount,
    newPositiveCorrectedAmount
  });

  // Create updates for BOTH transactions
  const updates: { transactionId: string, monthKey: string, updates: Partial<any> }[] = [
    {
      transactionId: negativeTxId,
      monthKey: findMonthKeyForTransaction(negativeTxId)!,
      updates: {
        type: 'ExpenseClaim',
        correctedAmount: newNegativeCorrectedAmount,
        linkedTransactionId: positiveTxId,
        linkedCostId: positiveTxId, // CRITICAL FIX: Add linkedCostId for ExpenseClaim
        isManuallyChanged: true
      }
    },
    {
      transactionId: positiveTxId,
      monthKey: findMonthKeyForTransaction(positiveTxId)!,
      updates: {
        type: 'CostCoverage',
        correctedAmount: newPositiveCorrectedAmount,
        linkedTransactionId: negativeTxId,
        linkedCostId: negativeTxId, // CRITICAL FIX: Add linkedCostId for CostCoverage
        isManuallyChanged: true
      }
    }
  ];

  updateMultipleTransactions(updates);
  
  // Force UI update by running calculations and triggering state update
  runCalculationsAndUpdateState();
  
  console.log(`✅ [Orchestrator] Expense and coverage linked successfully - covered ${amountToCover} from ${positiveTxId} to ${negativeTxId}`);
}

// LEGACY FUNCTIONS - kept for backward compatibility, now just call the unified function
export function coverCost(transferId: string, costId: string): void {
  console.log(`🔗 [Orchestrator] Legacy coverCost called - delegating to linkExpenseAndCoverage`);
  linkExpenseAndCoverage(costId, transferId);
}

export function applyExpenseClaim(expenseId: string, paymentId: string): void {
  console.log(`🔗 [Orchestrator] Legacy applyExpenseClaim called - delegating to linkExpenseAndCoverage`);
  linkExpenseAndCoverage(expenseId, paymentId);
}

// New flexible function that can update transactions for any month
export function updateTransactionsForMonth(monthKey: string, transactions: ImportedTransaction[]): void {
  console.log(`[ORCHESTRATOR] 🔄 CENTRALIZED STORAGE - Updating transactions for month ${monthKey}`);
  console.log(`[ORCHESTRATOR] 📊 New transactions to add: ${transactions.length}`);
  
  // CRITICAL: Use centralized transaction storage
  // Remove old transactions for this month from allTransactions
  const otherTransactions = state.budgetState.allTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
    return txMonthKey !== monthKey;
  });
  
  console.log(`[ORCHESTRATOR] 📊 Kept ${otherTransactions.length} transactions from other months`);
  
  // Add new transactions to centralized storage
  // Convert ImportedTransaction to Transaction format
  const transactionsAsBaseType: Transaction[] = transactions.map(tx => ({
    id: tx.id,
    date: tx.date,
    description: tx.description,
    originalDescription: tx.description, // Use description as originalDescription
    amount: tx.amount,
    balance: tx.balanceAfter || 0, // Use balanceAfter from ImportedTransaction
    balanceAfter: tx.balanceAfter || 0, // Required property
    account: '', // Will be set from accountId
    accountId: tx.accountId,
    huvudkategori: tx.appCategoryId || '', // Use app category fields
    underkategori: tx.appSubCategoryId || '',
    transaktionstyp: tx.type || 'Transaction',
    linkedTransactionId: tx.linkedTransactionId,
    linkedCostId: tx.linkedCostId, // CRITICAL FIX: Include linkedCostId field
    savingsTargetId: tx.savingsTargetId, // Include savingsTargetId field
    incomeTargetId: tx.incomeTargetId, // Include incomeTargetId field
    correctedAmount: tx.correctedAmount,
    linkedPerson: tx.linkedPerson, // CRITICAL FIX: Include linkedPerson field
    type: tx.type || 'Transaction',
    status: tx.status || 'red', // Use status from ImportedTransaction
    isManuallyChanged: tx.isManuallyChanged || false,
    userDescription: tx.userDescription || '',
    appCategoryId: tx.appCategoryId,
    appSubCategoryId: tx.appSubCategoryId
  }));
  
  state.budgetState.allTransactions = [...otherTransactions, ...transactionsAsBaseType];
  
  console.log(`[ORCHESTRATOR] 📊 Total transactions in centralized storage: ${state.budgetState.allTransactions.length}`);

  // Save the updated state permanently and re-run calculations
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log(`[ORCHESTRATOR] ✅ Triggered UI refresh after updating transactions for month ${monthKey}`);
}

export function setTransactionsForCurrentMonth(transactions: ImportedTransaction[]): void {
  const currentMonthKey = state.budgetState.selectedMonthKey;

  // Check that a month is selected
  if (!currentMonthKey) {
    console.error('[Orchestrator] Ingen månad vald, kan inte spara transaktioner.');
    return;
  }

  // Ensure the month data exists - CRITICAL FIX: Use preservation logic
  if (!state.budgetState.historicalData[currentMonthKey]) {
    state.budgetState.historicalData[currentMonthKey] = createEmptyMonthDataWithTransactionPreservation(currentMonthKey);
  }

  // Use the new flexible function
  updateTransactionsForMonth(currentMonthKey, transactions);
}


// ===== CSV MAPPING MANAGEMENT =====

export function saveCsvMapping(mapping: CsvMapping): void {
  console.log(`🔗 [ORCHESTRATOR] Saving CSV mapping for fingerprint: ${mapping.fileFingerprint}`);
  
  const existingIndex = state.budgetState.csvMappings.findIndex(m => m.fileFingerprint === mapping.fileFingerprint);
  if (existingIndex !== -1) {
    state.budgetState.csvMappings[existingIndex] = mapping;
    console.log(`✅ [ORCHESTRATOR] Updated existing CSV mapping`);
  } else {
    state.budgetState.csvMappings.push(mapping);
    console.log(`✅ [ORCHESTRATOR] Added new CSV mapping`);
  }
  
  saveStateToStorage();
  triggerUIRefresh();
}

export function getCsvMapping(fileFingerprint: string): CsvMapping | undefined {
  return state.budgetState.csvMappings.find(m => m.fileFingerprint === fileFingerprint);
}

// ===== ACCOUNT HELPER FUNCTIONS =====

export function getAccountNameById(accountId: string, sqlAccounts?: any[]): string {
  // CRITICAL FIX: Use SQL accounts as primary source instead of localStorage budgetState
  const accounts = sqlAccounts && sqlAccounts.length > 0 
    ? sqlAccounts 
    : (state.budgetState.accounts || []);
  
  console.log(`[ORCHESTRATOR] getAccountNameById using ${sqlAccounts && sqlAccounts.length > 0 ? 'SQL' : 'localStorage'} accounts: ${accounts.length} total`);
  
  // Safety check: ensure accounts array exists
  if (!accounts || !Array.isArray(accounts)) {
    console.warn(`[ORCHESTRATOR] getAccountNameById called but accounts not loaded yet, returning accountId: ${accountId}`);
    return accountId;
  }
  
  // First check if the accountId is already a name (like "Bil")
  const accountByName = accounts.find(acc => acc.name === accountId);
  if (accountByName) {
    return accountId; // It's already a name
  }
  
  // Otherwise, look up by ID
  const accountById = accounts.find(acc => acc.id === accountId);
  const result = accountById?.name || accountId;
  return result; // Return name if found, otherwise return the original ID
}
// Categories are now directly managed through mainCategories and subcategories
// No more separate linking system needed

// ===== TRANSACTION RETRIEVAL =====

export async function getAllTransactionsFromDatabase(): Promise<ImportedTransaction[]> {
  console.log('🔍 [ORCHESTRATOR] Getting all transactions from SQL database...');
  
  try {
    // NEW: Get transactions directly from database instead of broken budgetState
    const transactionsFromDB = await apiStore.getTransactions();
    console.log(`🔍 [ORCHESTRATOR] Retrieved ${transactionsFromDB.length} transactions from SQL database`);
    
    // Convert database transactions to ImportedTransaction format
    const allTransactions: ImportedTransaction[] = (transactionsFromDB || []).map(tx => ({
      id: tx.id,
      accountId: tx.accountId,
      date: tx.date,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter || 0,
      description: tx.description,
      userDescription: tx.userDescription || '',
      type: (tx.type as ImportedTransaction['type']) || 'Transaction',
      status: (tx.status as ImportedTransaction['status']) || 'red',
      linkedTransactionId: tx.linkedTransactionId,
      savingsTargetId: tx.savingsTargetId || tx.savings_target_id, // CRITICAL FIX: Include savingsTargetId field (handle both field names)
      correctedAmount: tx.correctedAmount,
      isManuallyChanged: tx.isManuallyChanged || false,
      appCategoryId: tx.huvudkategoriId, // CRITICAL FIX: Corrected typo from 'hoofdkategoriId' to 'huvudkategoriId'
      appSubCategoryId: tx.underkategoriId,
      bankCategory: tx.bankCategory || '',
      bankSubCategory: tx.bankSubCategory || '',
      importedAt: tx.createdAt || new Date().toISOString(),
      fileSource: tx.fileSource || 'database'
    } as ImportedTransaction));
    
    console.log(`🔍 [ORCHESTRATOR] Total transactions from SQL database: ${allTransactions.length}`);
    
    // DEBUG: Check if bank categories are present
    const transactionsWithBankCategories = allTransactions.filter(tx => tx.bankCategory);
    console.log(`🔍 [ORCHESTRATOR DEBUG] Transactions with bankCategory: ${transactionsWithBankCategories.length}/${allTransactions.length}`);
    if (transactionsWithBankCategories.length > 0) {
      console.log(`🔍 [ORCHESTRATOR DEBUG] Sample bankCategory: "${transactionsWithBankCategories[0].bankCategory}"`);
      console.log(`🔍 [ORCHESTRATOR DEBUG] Sample bankSubCategory: "${transactionsWithBankCategories[0].bankSubCategory}"`);
      console.log(`🔍 [ORCHESTRATOR DEBUG] Sample description: "${transactionsWithBankCategories[0].description}"`);
    } else {
    console.log(`🔍 [ORCHESTRATOR DEBUG] NO TRANSACTIONS WITH BANK CATEGORIES FOUND! Checking first few transactions...`);
    const sampleTransactions = allTransactions.slice(0, 3);
    sampleTransactions.forEach((tx, i) => {
      console.log(`🔍 [ORCHESTRATOR DEBUG] Transaction ${i}: "${tx.description}" - bankCategory: "${tx.bankCategory || 'MISSING'}" - bankSubCategory: "${tx.bankSubCategory || 'MISSING'}"`);
    });
  }
  
  return allTransactions;
  
  } catch (error) {
    console.error('❌ [ORCHESTRATOR] Failed to get transactions from database:', error);
    // Return empty array as fallback, but log the error
    return [];
  }
}

// NEW: Load all transactions from PostgreSQL at app startup
async function loadTransactionsFromDatabase(): Promise<void> {
  console.log('🔍 [ORCHESTRATOR] Loading all transactions from PostgreSQL at startup...');
  console.log('[ORCHESTRATOR] Loading transactions from database...');
  
  try {
    const { apiStore } = await import('../store/apiStore');
    const dbTransactions = await apiStore.getTransactions();
    
    console.log(`✅ [ORCHESTRATOR] Loaded ${dbTransactions.length} transactions from PostgreSQL`);
    addMobileDebugLog(`✅ [ORCHESTRATOR] Loaded ${dbTransactions.length} transactions from database`);
    
    // Debug: Check if any transactions have savingsTargetId
    const transactionsWithSavings = dbTransactions.filter(t => t.savingsTargetId || (t as any).savings_target_id);
    if (transactionsWithSavings.length > 0) {
      console.log(`🔍 [ORCHESTRATOR] Found ${transactionsWithSavings.length} transactions with savings links:`, 
        transactionsWithSavings.map(t => ({ 
          id: t.id, 
          description: t.description,
          savingsTargetId: t.savingsTargetId, 
          savings_target_id: (t as any).savings_target_id 
        }))
      );
      addMobileDebugLog(`🔍 [LOAD] Found ${transactionsWithSavings.length} transactions with savingsTargetId in database response`);
    } else {
      console.log(`🔍 [ORCHESTRATOR] No transactions found with savingsTargetId or savings_target_id fields`);
      addMobileDebugLog(`🔍 [LOAD] No transactions found with savingsTargetId in database response`);
    }
    
    // Debug: Check if any transactions have linkedCostId (for cost/expense links)
    const transactionsWithCostLinks = dbTransactions.filter(t => t.linkedCostId || (t as any).linked_cost_id);
    if (transactionsWithCostLinks.length > 0) {
      console.log(`🔍 [ORCHESTRATOR] Found ${transactionsWithCostLinks.length} transactions with cost links:`, 
        transactionsWithCostLinks.map(t => ({ 
          id: t.id, 
          description: t.description,
          type: t.type,
          linkedCostId: t.linkedCostId, 
          linked_cost_id: (t as any).linked_cost_id 
        }))
      );
      addMobileDebugLog(`🔍 [LOAD] Found ${transactionsWithCostLinks.length} transactions with linkedCostId in database response`);
    } else {
      console.log(`🔍 [ORCHESTRATOR] No transactions found with linkedCostId or linked_cost_id fields`);
      addMobileDebugLog(`🔍 [LOAD] No transactions found with linkedCostId in database response`);
    }
    
    // DEBUG: Check the first few transactions to see field names
    if (dbTransactions && dbTransactions.length > 0) {
      const sampleTx = dbTransactions[0];
      console.log('🔍 [LOAD DEBUG] Sample transaction field names:', Object.keys(sampleTx));
      console.log('🔍 [LOAD DEBUG] Sample savingsTargetId values:', {
        savingsTargetId: sampleTx.savingsTargetId,
        savings_target_id: (sampleTx as any).savings_target_id
      });
      
      // Check specifically for LÖN transactions
      const lonTransactions = dbTransactions.filter(tx => tx.description === 'LÖN');
      console.log(`🔍 [LOAD DEBUG] Found ${lonTransactions.length} LÖN transactions`);
      lonTransactions.forEach((tx, i) => {
        if (i < 3) { // Log first 3
          console.log(`🔍 [LOAD DEBUG] LÖN tx ${i}: id=${tx.id}, savingsTargetId=${tx.savingsTargetId}, savings_target_id=${(tx as any).savings_target_id}`);
        }
      });
    }

    // Convert database transactions to the format expected by budgetState
    const convertedTransactions = (dbTransactions || []).map(tx => ({
      id: tx.id,
      accountId: tx.accountId,
      date: tx.date,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter || 0,
      description: tx.description,
      userDescription: tx.userDescription || '',
      type: tx.type || 'Transaction',
      status: tx.status || 'red',
      linkedTransactionId: tx.linkedTransactionId || (tx as any).linked_transaction_id,
      linkedCostId: tx.linkedCostId || (tx as any).linked_cost_id, // Handle snake_case
      savingsTargetId: tx.savingsTargetId || (tx as any).savings_target_id, // Handle both camelCase and snake_case from database
      incomeTargetId: tx.incomeTargetId || (tx as any).income_target_id, // Handle snake_case
      correctedAmount: tx.correctedAmount ?? (tx as any).corrected_amount ?? null, // Handle snake_case and null values
      isManuallyChanged: tx.isManuallyChanged === 'true',
      appCategoryId: tx.appCategoryId || (tx as any).app_category_id,
      appSubCategoryId: tx.appSubCategoryId || (tx as any).app_sub_category_id,
      bankCategory: tx.bankCategory || '',
      bankSubCategory: tx.bankSubCategory || '',
      createdAt: tx.createdAt || new Date().toISOString(),
      fileSource: tx.fileSource || 'database'
    }));
    
    // Store in centralized transaction storage
    state.budgetState.allTransactions = convertedTransactions;
    
    console.log(`✅ [ORCHESTRATOR] Stored ${convertedTransactions.length} transactions in centralized storage`);
    addMobileDebugLog(`✅ [ORCHESTRATOR] Centralized storage updated with ${convertedTransactions.length} transactions`);
    
    // Debug: Show sample of loaded transactions
    if (convertedTransactions.length > 0) {
      const sample = convertedTransactions.slice(0, 3);
      console.log('[ORCHESTRATOR] Sample loaded transactions:', sample.map(tx => ({
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        bankCategory: tx.bankCategory
      })));
      
      // CRITICAL DEBUG: Check exact amount values before and after conversion
      console.log('[ORCHESTRATOR] AMOUNT DEBUG for first 3 transactions:');
      sample.forEach((tx, i) => {
        const originalTx = dbTransactions[i];
        console.log(`Transaction ${i}: "${tx.description}"`);
        console.log(`  - Original amount from DB: ${originalTx?.amount} (type: ${typeof originalTx?.amount})`);
        console.log(`  - Converted amount: ${tx.amount} (type: ${typeof tx.amount})`);
        console.log(`  - BalanceAfter: ${tx.balanceAfter} (type: ${typeof tx.balanceAfter})`);
      });
    }
    
  } catch (error) {
    console.error('❌ [ORCHESTRATOR] Failed to load transactions from PostgreSQL:', error);
    addMobileDebugLog(`❌ [ORCHESTRATOR] Failed to load transactions: ${error}`);
    
    // Provide detailed error information
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('🌐 [ORCHESTRATOR] Network error - server may be unreachable');
      addMobileDebugLog('🌐 Server connection failed - check if server is running');
    } else if (error instanceof Error) {
      console.error('📋 [ORCHESTRATOR] Error details:', error.message);
      addMobileDebugLog(`📋 Error: ${error.message}`);
    }
    
    // Initialize with empty array as fallback - app should still work
    state.budgetState.allTransactions = [];
    console.log('🔄 [ORCHESTRATOR] Initialized with empty transactions array as fallback');
    addMobileDebugLog('🔄 Using offline mode - transactions will load from localStorage if available');
  }
}

// NEW: Function to update payday setting
export function updatePaydaySetting(newPayday: number): void {
  console.log(`[updatePaydaySetting] Setting payday to: ${newPayday}`);
  
  state.budgetState.settings.payday = newPayday;
  
  // Save to storage first
  saveStateToStorage();
  
  // Clear calculated data to force complete recalculation
  state.calculated = {
    results: null,
    fullPrognosis: null
  };
  
  // Force complete recalculation since payday affects month boundaries
  console.log(`[updatePaydaySetting] Forcing complete recalculation due to payday change...`);
  runCalculationsAndUpdateState();
  
  console.log(`[updatePaydaySetting] Payday updated to ${newPayday} with complete recalculation triggered`);
}

// ===== PLANNED TRANSFERS MANAGEMENT =====

async function loadPlannedTransfersFromDatabase(): Promise<void> {
  console.log('📥 [ORCHESTRATOR] Loading planned transfers from database...');
  
  try {
    const apiUrl = (window as any).apiUrl || '';
    const response = await fetch(`${apiUrl}/api/planned-transfers`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch planned transfers from database');
    }
    
    const transfers = await response.json();
    
    // Convert from database format to local format
    const convertedTransfers = transfers.map((transfer: any) => ({
      ...transfer,
      amount: transfer.amount / 100, // Convert from öre to SEK
      dailyAmount: transfer.dailyAmount ? transfer.dailyAmount / 100 : undefined,
      transferDays: transfer.transferDays ? JSON.parse(transfer.transferDays) : undefined
    }));
    
    // Replace local state with database state
    state.budgetState.plannedTransfers = convertedTransfers;
    saveStateToStorage();
    
    console.log(`✅ [ORCHESTRATOR] Loaded ${transfers.length} planned transfers from database`);
  } catch (error) {
    console.error('❌ [ORCHESTRATOR] Failed to load planned transfers from database:', error);
    // Keep using local storage data if database fails
  }
}

export async function createPlannedTransfer(transfer: Omit<PlannedTransfer, 'id' | 'created'>): Promise<void> {
  console.log('🔄 [ORCHESTRATOR] Creating planned transfer:', transfer);
  
  // Calculate total amount for daily transfers
  let totalAmount = transfer.amount;
  if (transfer.transferType === 'daily' && transfer.dailyAmount && transfer.transferDays) {
    // Calculate days in current month based on payday cycle (25th-24th)
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const daysInPayCycle = calculateDaysInTransferDays(transfer.transferDays, currentMonth);
    totalAmount = transfer.dailyAmount * daysInPayCycle;
    console.log(`💰 [ORCHESTRATOR] Daily transfer calculated: ${transfer.dailyAmount} × ${daysInPayCycle} days = ${totalAmount} SEK`);
  }
  
  // Save to SQL backend
  try {
    const apiUrl = (window as any).apiUrl || '';
    const response = await fetch(`${apiUrl}/api/planned-transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...transfer,
        amount: totalAmount
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create planned transfer in database');
    }
    
    const savedTransfer = await response.json();
    
    // Also save to local state for immediate UI update
    const newTransfer: PlannedTransfer = {
      ...savedTransfer,
      amount: savedTransfer.amount / 100, // Convert from öre to SEK
      dailyAmount: savedTransfer.dailyAmount ? savedTransfer.dailyAmount / 100 : undefined,
      transferDays: savedTransfer.transferDays ? JSON.parse(savedTransfer.transferDays) : undefined
    };
    
    state.budgetState.plannedTransfers.push(newTransfer);
    saveStateToStorage();
    triggerUIRefresh();
    
    const transferTypeText = transfer.transferType === 'daily' ? 'Daglig överföring' : 'Fast månadsöverföring';
    console.log(`✅ [ORCHESTRATOR] ${transferTypeText} created: ${totalAmount} SEK from ${transfer.fromAccountId} to ${transfer.toAccountId}`);
  } catch (error) {
    console.error('❌ [ORCHESTRATOR] Failed to save planned transfer to database:', error);
    // Fall back to local storage only
    const newTransfer: PlannedTransfer = {
      ...transfer,
      amount: totalAmount,
      id: uuidv4(),
      created: new Date().toISOString()
    };
    
    state.budgetState.plannedTransfers.push(newTransfer);
    saveStateToStorage();
    triggerUIRefresh();
  }
}

// Helper function to calculate days in transfer cycle
function calculateDaysInTransferDays(transferDays: number[], monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  const payday = state.budgetState.settings?.payday || 25;
  
  // Calculate payday cycle dates (25th to 24th)
  const startDate = new Date(year, month - 1, payday);
  const endDate = new Date(year, month, payday - 1);
  
  let totalDays = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (transferDays.includes(dayOfWeek)) {
      totalDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return totalDays;
}

export function updatePlannedTransfer(transferId: string, updates: Partial<PlannedTransfer>): void {
  console.log('🔄 [ORCHESTRATOR] Updating planned transfer:', transferId, updates);
  
  const transferIndex = state.budgetState.plannedTransfers.findIndex(t => t.id === transferId);
  if (transferIndex !== -1) {
    state.budgetState.plannedTransfers[transferIndex] = {
      ...state.budgetState.plannedTransfers[transferIndex],
      ...updates
    };
    saveStateToStorage();
    triggerUIRefresh();
    console.log(`✅ [ORCHESTRATOR] Planned transfer updated successfully`);
  } else {
    console.error(`❌ [ORCHESTRATOR] Planned transfer not found: ${transferId}`);
  }
}

export function deletePlannedTransfer(transferId: string): void {
  console.log('🔄 [ORCHESTRATOR] Deleting planned transfer:', transferId);
  
  state.budgetState.plannedTransfers = state.budgetState.plannedTransfers.filter(t => t.id !== transferId);
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log(`✅ [ORCHESTRATOR] Planned transfer deleted successfully`);
}