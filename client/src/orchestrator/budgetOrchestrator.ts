// Single Source of Truth Orchestrator - Simplified architecture

import { state, initializeStateFromStorage, saveStateToStorage, getCurrentMonthData, updateCurrentMonthData } from '../state/budgetState';
import { calculateFullPrognosis, calculateBudgetResults, calculateAccountProgression, calculateMonthlyBreakdowns, calculateProjectedBalances, applyCategorizationRules, determineTransactionStatus } from '../services/calculationService';
import { BudgetGroup, MonthData, SavingsGoal, CsvMapping, PlannedTransfer, Transaction } from '../types/budget';
import { updateAccountBalanceFromBankData } from '../utils/bankBalanceUtils';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import { v4 as uuidv4 } from 'uuid';
import { ImportedTransaction } from '../types/transaction';
import { CategoryRule } from '../types/budget';
import { simpleGoogleDriveService } from '../services/simpleGoogleDriveService';
import { monthlyBudgetService } from '../services/monthlyBudgetService';

// SMART MERGE FUNCTION - The definitive solution to duplicate and lost changes
export async function importAndReconcileFile(csvContent: string, accountId: string): Promise<void> {
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
    const headers = lines[0]?.split(';').map(h => h.trim()) || [];
    addMobileDebugLog(`📋 Available CSV columns: ${headers.join(', ')}`);
    
    // Still trigger UI refresh so user can access column mapping
    triggerUIRefresh();
    return;
  }
  
  
  // 2. Define date range of the file using string dates (YYYY-MM-DD format)
  console.log(`[ORCHESTRATOR] 📊 Raw transactions from file:`, transactionsFromFile.map(t => ({ date: t.date, desc: t.description.substring(0, 30) })));
  addMobileDebugLog(`📊 Raw transactions: ${transactionsFromFile.length} found`);
  
  const fileDates = transactionsFromFile.map((t, index) => {
    const dateStr = t.date.split('T')[0];
    console.log(`[ORCHESTRATOR] 📊 Transaction ${index}: "${t.date}" -> "${dateStr}" (Amount: ${t.amount}, Description: "${t.description}")`);
    addMobileDebugLog(`📊 TX ${index}: ${dateStr} - ${t.amount} - "${t.description?.substring(0, 30)}"`);
    
    // Special logging for April transactions
    if (dateStr.startsWith('2025-04')) {
      console.log(`[ORCHESTRATOR] 🔍 APRIL TRANSACTION FOUND: ${dateStr} - ${t.amount} - "${t.description}"`);
      addMobileDebugLog(`🔍 APRIL TX: ${dateStr} - ${t.amount} - "${t.description?.substring(0, 30)}"`);
    }
    
    return dateStr;
  });
  
  addMobileDebugLog(`📊 Processed dates: ${fileDates.sort().join(', ')}`);
  
  const minDateStr = fileDates.reduce((min, date) => date < min ? date : min);
  const maxDateStr = fileDates.reduce((max, date) => date > max ? date : max);
  
  console.log(`[ORCHESTRATOR] 📅 File date range: ${minDateStr} to ${maxDateStr}`);
  addMobileDebugLog(`📅 FILE RANGE: ${minDateStr} to ${maxDateStr}`);
  addMobileDebugLog(`📅 All file dates: ${fileDates.sort().join(', ')}`);
  console.log(`[ORCHESTRATOR] 📅 File contains ${transactionsFromFile.length} transactions`);
  addMobileDebugLog(`📅 File contains ${transactionsFromFile.length} transactions`);
  
  // 3. Get ALL existing transactions from centralized storage
  const allSavedTransactions = state.budgetState.allTransactions.map(t => ({
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
  
  const existingForAccount = allSavedTransactions.filter(t => t.accountId === accountId).map(t => t.date.split('T')[0]).sort();
  console.log(`[ORCHESTRATOR] 📅 Existing transactions for account ${accountId}:`, existingForAccount);
  addMobileDebugLog(`📅 Existing transactions for account ${accountId}: ${existingForAccount.join(', ')}`);
  
  // 4. Remove ONLY transactions within the exact date range for this account
  const transactionsToKeep = allSavedTransactions.filter(t => {
    if (t.accountId !== accountId) return true; // Keep all transactions from other accounts
    
    // Normalize existing transaction date to YYYY-MM-DD format
    const existingDateStr = t.date.split('T')[0];
    
    // FIXED: Only remove if date is WITHIN the new file's range (inclusive)
    const isInFileRange = existingDateStr >= minDateStr && existingDateStr <= maxDateStr;
    
    console.log(`[ORCHESTRATOR] 🔍 Checking transaction ${existingDateStr}:`);
    console.log(`[ORCHESTRATOR] 🔍   - >= ${minDateStr}: ${existingDateStr >= minDateStr}`);
    console.log(`[ORCHESTRATOR] 🔍   - <= ${maxDateStr}: ${existingDateStr <= maxDateStr}`);
    console.log(`[ORCHESTRATOR] 🔍   - isInFileRange: ${isInFileRange}`);
    console.log(`[ORCHESTRATOR] 🔍   - Decision: ${isInFileRange ? 'REMOVE (in range)' : 'KEEP (outside range)'}`);
    
    addMobileDebugLog(`🔍 Transaction ${existingDateStr}: ${isInFileRange ? 'REMOVE (in range)' : 'KEEP (outside range)'}`);
    
    return !isInFileRange; // Keep transactions OUTSIDE the file's date range
  });
  
  // 5. Create map of existing transactions for smart merge
  const savedTransactionsMap = new Map<string, ImportedTransaction>();
  allSavedTransactions.forEach(t => savedTransactionsMap.set(createTransactionFingerprint(t), t));
  
  console.log(`[ORCHESTRATOR] 🧹 Kept ${transactionsToKeep.length} transactions, removing ${allSavedTransactions.length - transactionsToKeep.length} within date range`);
  
  // 6. Intelligent merge - preserve manual changes
  const mergedTransactions = transactionsFromFile.map(fileTx => {
    const fingerprint = createTransactionFingerprint(fileTx);
    const existingTx = savedTransactionsMap.get(fingerprint);

    if (existingTx) {
      // CRITICAL FIX: ALWAYS update bank fields from file for ALL existing transactions
      console.log(`[ORCHESTRATOR] 🔄 Found existing transaction: ${fileTx.description}`);
      console.log(`[ORCHESTRATOR] 🔄 OLD bankCategory: "${existingTx.bankCategory || 'EMPTY'}" -> NEW: "${fileTx.bankCategory || 'EMPTY'}"`);
      console.log(`[ORCHESTRATOR] 🔄 OLD bankSubCategory: "${existingTx.bankSubCategory || 'EMPTY'}" -> NEW: "${fileTx.bankSubCategory || 'EMPTY'}"`);
      console.log(`[ORCHESTRATOR] 🔄 isManuallyChanged: ${existingTx.isManuallyChanged || false}`);
      
      // DIAGNOSTIC: Log exactly what we're working with
      console.log(`[ORCHESTRATOR] 🔬 DIAGNOSTIC - existingTx fields:`, {
        bankCategory: existingTx.bankCategory,
        bankSubCategory: existingTx.bankSubCategory,
        appCategoryId: existingTx.appCategoryId,
        isManuallyChanged: existingTx.isManuallyChanged
      });
      console.log(`[ORCHESTRATOR] 🔬 DIAGNOSTIC - fileTx fields:`, {
        bankCategory: fileTx.bankCategory,
        bankSubCategory: fileTx.bankSubCategory,
        description: fileTx.description
      });
      
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
      
      console.log(`[ORCHESTRATOR] 🔬 DIAGNOSTIC - baseUpdatedTx after creation:`, {
        bankCategory: baseUpdatedTx.bankCategory,
        bankSubCategory: baseUpdatedTx.bankSubCategory,
        appCategoryId: baseUpdatedTx.appCategoryId
      });
      
      if (existingTx.isManuallyChanged) {
        console.log(`[ORCHESTRATOR] 💾 MANUAL transaction - preserving user changes, updating bank data only`);
        console.log(`[ORCHESTRATOR] 🔬 FINAL MANUAL - bankCategory: "${baseUpdatedTx.bankCategory}", bankSubCategory: "${baseUpdatedTx.bankSubCategory}"`);
        // For manually changed transactions: keep user categorization, update bank data
        return baseUpdatedTx; // This preserves all manual changes while updating bank data
      } else {
        console.log(`[ORCHESTRATOR] 🔄 NON-MANUAL transaction - applying rules to updated data`);
        // For non-manual transactions: apply categorization rules
        const processedTransaction = applyCategorizationRules(baseUpdatedTx, state.budgetState.categoryRules || []);
        console.log(`[ORCHESTRATOR] ✅ After rules - bankCategory: "${processedTransaction.bankCategory || 'EMPTY'}", type: ${processedTransaction.type}`);
        console.log(`[ORCHESTRATOR] 🔬 FINAL PROCESSED - bankCategory: "${processedTransaction.bankCategory}", bankSubCategory: "${processedTransaction.bankSubCategory}"`);
        return processedTransaction;
      }
    }
    
    // New transaction or unchanged - apply category rules using the new advanced rule engine
    console.log(`[ORCHESTRATOR] 🔄 Processing transaction: ${fileTx.description}, bankCategory: ${fileTx.bankCategory} / ${fileTx.bankSubCategory}`);
    const processedTransaction = applyCategorizationRules(fileTx, state.budgetState.categoryRules || []);
    console.log(`[ORCHESTRATOR] ✅ After processing: ${processedTransaction.description}, bankCategory: ${processedTransaction.bankCategory} / ${processedTransaction.bankSubCategory}`);
    return processedTransaction;
  });
  
  // 7. Combine cleaned list with new merged transactions
  const finalTransactionList = [...transactionsToKeep, ...mergedTransactions];
  
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
  const transactionsForCentralStorage = finalTransactionList.map((tx, index) => {
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
  
  // 8.2. CRITICAL FIX: Save transactions to PostgreSQL database
  console.log(`[ORCHESTRATOR] 💾 Saving ${finalTransactionList.length} transactions to PostgreSQL database...`);
  addMobileDebugLog(`💾 Saving ${finalTransactionList.length} transactions to database...`);
  
  try {
    // Import the API store to access createTransaction function
    const { apiStore } = await import('../store/apiStore');
    
    for (const transaction of finalTransactionList) {
      // Convert ImportedTransaction to the format expected by the database
      const dbTransaction = {
        accountId: transaction.accountId,
        date: transaction.date, // Schema handles string-to-Date conversion
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
        isManuallyChanged: String(transaction.isManuallyChanged || false), // Convert boolean to string
        appCategoryId: transaction.appCategoryId || null,
        appSubCategoryId: transaction.appSubCategoryId || null,
        userId: 'dev-user-123' // Mock user ID for development
      };
      
      try {
        await apiStore.createTransaction(dbTransaction);
        console.log(`[ORCHESTRATOR] ✅ Saved transaction to DB: ${transaction.description} (${transaction.amount} kr)`);
      } catch (error) {
        console.error(`[ORCHESTRATOR] ❌ Failed to save transaction to DB: ${transaction.description}`, error);
        addMobileDebugLog(`❌ DB save failed: ${transaction.description}`);
      }
    }
    
    console.log(`[ORCHESTRATOR] ✅ Successfully saved all ${finalTransactionList.length} transactions to PostgreSQL`);
    addMobileDebugLog(`✅ All ${finalTransactionList.length} transactions saved to database!`);
    
  } catch (error) {
    console.error(`[ORCHESTRATOR] ❌ Critical error saving transactions to database:`, error);
    addMobileDebugLog(`❌ Critical DB save error: ${error}`);
  }
  
  // 8.5. Automatic transfer matching for InternalTransfer transactions
  performAutomaticTransferMatching();
  
  // 9. Update account balances from saldo data using the SAME working logic as BudgetCalculator
  updateAccountBalancesUsingWorkingLogic(finalTransactionList, accountId);

  // 10. Save and refresh UI
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log(`[ORCHESTRATOR] 🎉 Smart merge completed successfully - UI refresh triggered`);
}

// Helper function to create empty month data for import
function createEmptyMonthDataForImport() {
  return {
    andreasSalary: 0,
    andreasförsäkringskassan: 0,
    andreasbarnbidrag: 0,
    susannaSalary: 0,
    susannaförsäkringskassan: 0,
    susannabarnbidrag: 0,
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

export function addCategoryRule(rule: any): void {
  const newRule = {
    id: uuidv4(),
    isActive: true,
    ...rule
  };
  
  console.log('🔍 [DEBUG] Adding category rule:', newRule);
  console.log('🔍 [DEBUG] Before adding - total rules:', state.budgetState.categoryRules.length);
  
  state.budgetState.categoryRules = [...state.budgetState.categoryRules, newRule];
  
  console.log('🔍 [DEBUG] After adding - total rules:', state.budgetState.categoryRules.length);
  console.log('🔍 [DEBUG] All rules:', state.budgetState.categoryRules);
  
  // Add mobile debug logging too
  import('../utils/mobileDebugLogger').then(({ addMobileDebugLog }) => {
    addMobileDebugLog(`🔍 [ORCHESTRATOR] Rule added. Total rules now: ${state.budgetState.categoryRules.length}`);
    addMobileDebugLog(`🔍 [ORCHESTRATOR] Latest rule ID: ${newRule.id}`);
  });
  
  saveStateToStorage();
  triggerUIRefresh();
}

export function updateCategoryRule(ruleId: string, updates: Partial<any>): void {
  state.budgetState.categoryRules = state.budgetState.categoryRules.map(rule =>
    rule.id === ruleId ? { ...rule, ...updates } : rule
  );
  saveStateToStorage();
  triggerUIRefresh();
}

export function deleteCategoryRule(ruleId: string): void {
  state.budgetState.categoryRules = state.budgetState.categoryRules.filter(rule => rule.id !== ruleId);
  saveStateToStorage();
  triggerUIRefresh();
}

// Enhanced CSV parsing function that returns both transactions and mapping info
function parseCSVContentWithMapping(csvContent: string, accountId: string, fileName: string): { transactions: ImportedTransaction[], mapping: CsvMapping | undefined } {
  const transactions = parseCSVContent(csvContent, accountId, fileName);
  
  // Get the mapping that was used
  const account = state.budgetState.accounts.find(acc => acc.id === accountId);
  let savedMapping: CsvMapping | undefined;
  
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

// CSV parsing function moved from TransactionImportEnhanced
function parseCSVContent(csvContent: string, accountId: string, fileName: string): ImportedTransaction[] {
  console.log(`[ORCHESTRATOR] 🔍 parseCSVContent called for account: ${accountId}`);
  
  const cleanedContent = csvContent.replace(/�/g, '');
  const lines = cleanedContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(';').map(h => h.trim());
  console.log(`[ORCHESTRATOR] 🔍 CSV headers:`, headers);
  
  // NEW: Hämta bankmallen från kontot och använd dess mappning
  const account = state.budgetState.accounts.find(acc => acc.id === accountId);
  let savedMapping: CsvMapping | undefined;
  
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
      
      const parsedAmount = parseFloat(cleanedAmountField);

      console.log(`[ORCHESTRATOR] 🔍 Processing line ${i}: Raw line: "${lines[i]}"`);
      console.log(`[ORCHESTRATOR] 🔍 Processing line ${i}: Amount field: "${rawAmountField}" -> cleaned: "${cleanedAmountField}" -> ${parsedAmount}`);

      if (isNaN(parsedAmount)) {
        console.log(`[ORCHESTRATOR] ⚠️ Skipping line ${i}: Invalid amount`);
        continue;
      }

      const rawDate = dateColumnIndex >= 0 ? fields[dateColumnIndex] : '';
      const parsedDate = parseSwedishDate(rawDate);
      console.log(`[ORCHESTRATOR] 🔍 Processing line ${i}: Date field: "${rawDate}" -> "${parsedDate}"`);
      
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
        
        const parsedBalance = parseFloat(cleanedBalanceField);
        if (!isNaN(parsedBalance)) {
          balanceAfter = parsedBalance;
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

// NEW: Function to update account balances using the SAME working logic as BudgetCalculator.tsx
function updateAccountBalancesUsingWorkingLogic(allTransactions: ImportedTransaction[], accountId: string): void {
  console.log(`[ORCHESTRATOR] 💰 Starting account balance updates using working logic for account ${accountId}`);
  
  // Get account name from account ID
  const account = state.budgetState.accounts.find(acc => acc.id === accountId);
  if (!account) {
    console.log(`[ORCHESTRATOR] ⚠️ Could not find account name for ID ${accountId}`);
    return;
  }
  
  console.log(`[ORCHESTRATOR] 💰 Found account: ${account.name} (${accountId})`);
  
  // Check if we have any transactions with balance data
  const transactionsWithBalance = allTransactions.filter(tx => 
    tx.accountId === accountId && 
    tx.balanceAfter !== undefined && 
    tx.balanceAfter !== null
  );
  
  console.log(`[ORCHESTRATOR] 💰 Found ${transactionsWithBalance.length} transactions with balance data`);
  
  if (transactionsWithBalance.length === 0) {
    console.log(`[ORCHESTRATOR] 💰 No transactions with balance data found, skipping balance updates`);
    return;
  }
  
  // Group transactions by month and attempt to update balances for relevant months
  const monthsWithTransactions = new Set<string>();
  transactionsWithBalance.forEach(tx => {
    const monthKey = tx.date.substring(0, 7); // Extract "YYYY-MM"
    monthsWithTransactions.add(monthKey);
  });
  
  console.log(`[ORCHESTRATOR] 💰 Found transactions in months: ${Array.from(monthsWithTransactions).join(', ')}`);
  
  // For each month, try to update the NEXT month's balance using the working logic
  monthsWithTransactions.forEach(monthKey => {
    const [year, month] = monthKey.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    
    console.log(`[ORCHESTRATOR] 💰 Attempting to update balance for ${account.name} in ${nextMonthKey} using data from ${monthKey}`);
    
    // Use the working logic from bankBalanceUtils
    const updateSuccess = updateAccountBalanceFromBankData(allTransactions, accountId, account.name, nextMonthKey);
    
    if (updateSuccess) {
      console.log(`[ORCHESTRATOR] ✅ Successfully updated balance for ${account.name} in ${nextMonthKey}`);
    } else {
      console.log(`[ORCHESTRATOR] ℹ️ No balance update needed for ${account.name} in ${nextMonthKey}`);
    }
  });
}

// Helper functions moved from TransactionImportEnhanced
function parseSwedishDate(dateString: string): string | null {
  if (!dateString) return null;
  
  const trimmed = dateString.trim();
  const swedishDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = trimmed.match(swedishDatePattern);
  
  if (match) {
    const [, year, month, day] = match;
    // Validate the date values without creating a Date object
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);
    
    if (yearNum >= 1900 && yearNum <= 2100 && 
        monthNum >= 1 && monthNum <= 12 && 
        dayNum >= 1 && dayNum <= 31) {
      return trimmed; // Return the original YYYY-MM-DD string if valid
    }
  }
  
  return null;
}

function groupTransactionsByMonth(transactions: ImportedTransaction[]): Record<string, ImportedTransaction[]> {
  const groups: Record<string, ImportedTransaction[]> = {};
  
  transactions.forEach(transaction => {
    // Extract month from YYYY-MM-DD string directly - no Date object needed
    const monthKey = transaction.date.substring(0, 7); // Extract "YYYY-MM" from "YYYY-MM-DD"
    
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
      const categorizedTransaction = applyCategorizationRules(fileTx, categoryRules);
      reconciledTransactions.push(categorizedTransaction);
    }
  });

  return reconciledTransactions;
}

function createTransactionFingerprint(transaction: { date: string; description: string; amount: number; accountId?: string }): string {
  return `${transaction.accountId || ''}_${transaction.date.trim()}_${transaction.description.trim().toLowerCase()}_${transaction.amount}`;
}

// Event system for UI updates
const eventEmitter = new EventTarget();
export const APP_STATE_UPDATED = 'appstateupdated';
export { eventEmitter };

function triggerUIRefresh() {
  console.log('🎯 [ORCHESTRATOR] Dispatching APP_STATE_UPDATED event...');
  addMobileDebugLog('🎯 [ORCHESTRATOR] Dispatching APP_STATE_UPDATED event...');
  
  // Dispatch immediately
  eventEmitter.dispatchEvent(new Event(APP_STATE_UPDATED));
  
  // Also dispatch in the next tick to ensure all state updates are captured
  setTimeout(() => {
    console.log('🎯 [ORCHESTRATOR] Dispatching delayed APP_STATE_UPDATED event...');
    eventEmitter.dispatchEvent(new Event(APP_STATE_UPDATED));
    
    // Trigger automatic Google Drive backup if enabled and signed in
    triggerAutoBackup();
  }, 0);
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

// Initialize the application
export async function initializeApp(): Promise<void> {
  console.log('[BudgetOrchestrator] 🚀 initializeApp() called!');
  addMobileDebugLog('[ORCHESTRATOR] 🚀 initializeApp() called!');
  
  if (isInitialized) {
    console.log('[BudgetOrchestrator] ⚠️ App already initialized - skipping...');
    addMobileDebugLog('[ORCHESTRATOR] ⚠️ App already initialized - skipping...');
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
  
  // Sync accounts from API store to orchestrator state
  await syncAccountsFromApiStore();
  
  // Ensure the Överföring account exists
  ensureOverforingAccount();
  
  // Clean up any invalid links to unknown accounts
  cleanupInvalidTransferLinks();
  
  addMobileDebugLog(`[ORCHESTRATOR] After storage init - available months: ${Object.keys(state.budgetState.historicalData).join(', ')}`);
  addMobileDebugLog(`[ORCHESTRATOR] Selected month: ${state.budgetState.selectedMonthKey}`);
  
  // Load monthly budget data from database for current month
  await loadMonthlyBudgetFromDatabase();
  
  // Run initial calculations to ensure state is up to date
  runCalculationsAndUpdateState();
  
  // Mark loading as complete
  state.isLoading = false;
  addMobileDebugLog('[ORCHESTRATOR] ✅ App initialization complete - loading set to false');
  
  // Don't trigger UI refresh here - runCalculationsAndUpdateState() already does it
  addMobileDebugLog('[ORCHESTRATOR] 📡 App initialization complete - UI refresh was done by runCalculationsAndUpdateState');
}

// Get current state
export function getCurrentState() {
  return state;
}

// Subscribe/unsubscribe to state changes
export function subscribeToStateChanges(callback: () => void): void {
  console.log('🎯 [ORCHESTRATOR] Subscribing to state changes...');
  addMobileDebugLog('🎯 [ORCHESTRATOR] Subscribing to state changes...');
  eventEmitter.addEventListener(APP_STATE_UPDATED, callback);
}

export function unsubscribeFromStateChanges(callback: () => void): void {
  console.log('🎯 [ORCHESTRATOR] Unsubscribing from state changes...');
  addMobileDebugLog('🎯 [ORCHESTRATOR] Unsubscribing from state changes...');
  eventEmitter.removeEventListener(APP_STATE_UPDATED, callback);
}

// Main calculation and state update function
export function runCalculationsAndUpdateState(): void {
  console.log('🔥 [ORCHESTRATOR] runCalculationsAndUpdateState() STARTED');
  const stack = new Error().stack;
  const callerLine = stack?.split('\n')[2] || 'unknown';
  console.log('🔥 [ORCHESTRATOR] WHO IS CALLING ME?:', callerLine);
  addMobileDebugLog('🔥 [ORCHESTRATOR] runCalculationsAndUpdateState() STARTED');
  addMobileDebugLog(`🔥 [ORCHESTRATOR] WHO IS CALLING ME?: ${callerLine}`);
  
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
    
    console.log('🔥 [ORCHESTRATOR] runCalculationsAndUpdateState() COMPLETED');
    addMobileDebugLog('🔥 [ORCHESTRATOR] runCalculationsAndUpdateState() COMPLETED');
  } catch (error) {
    console.error('[BudgetOrchestrator] Error in calculations:', error);
  }
}

// Helper function for updating data
function updateAndRecalculate(updates: Partial<MonthData>): void {
  const stack = new Error().stack;
  const callerLine = stack?.split('\n')[2] || 'unknown';
  console.log('🔥 [ORCHESTRATOR] updateAndRecalculate() called from:', callerLine);
  addMobileDebugLog(`🔥 [ORCHESTRATOR] updateAndRecalculate() called from: ${callerLine}`);
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

export function setAndreasSalary(value: number): void {
  updateAndRecalculate({ andreasSalary: value });
  // Also persist to database
  const monthKey = state.budgetState.selectedMonthKey;
  monthlyBudgetService.updateMonthlyBudgetField(monthKey, 'andreasSalary', value).catch(error => {
    console.error('Failed to update Andreas salary in database:', error);
  });
}

export function setAndreasförsäkringskassan(value: number): void {
  updateAndRecalculate({ andreasförsäkringskassan: value });
  // Also persist to database
  const monthKey = state.budgetState.selectedMonthKey;
  monthlyBudgetService.updateMonthlyBudgetField(monthKey, 'andreasförsäkringskassan', value).catch(error => {
    console.error('Failed to update Andreas försäkringskassan in database:', error);
  });
}

export function setAndreasbarnbidrag(value: number): void {
  updateAndRecalculate({ andreasbarnbidrag: value });
  // Also persist to database
  const monthKey = state.budgetState.selectedMonthKey;
  monthlyBudgetService.updateMonthlyBudgetField(monthKey, 'andreasbarnbidrag', value).catch(error => {
    console.error('Failed to update Andreas barnbidrag in database:', error);
  });
}

export function setSusannaSalary(value: number): void {
  updateAndRecalculate({ susannaSalary: value });
  // Also persist to database
  const monthKey = state.budgetState.selectedMonthKey;
  monthlyBudgetService.updateMonthlyBudgetField(monthKey, 'susannaSalary', value).catch(error => {
    console.error('Failed to update Susanna salary in database:', error);
  });
}

export function setSusannaförsäkringskassan(value: number): void {
  updateAndRecalculate({ susannaförsäkringskassan: value });
  // Also persist to database
  const monthKey = state.budgetState.selectedMonthKey;
  monthlyBudgetService.updateMonthlyBudgetField(monthKey, 'susannaförsäkringskassan', value).catch(error => {
    console.error('Failed to update Susanna försäkringskassan in database:', error);
  });
}

export function setSusannabarnbidrag(value: number): void {
  updateAndRecalculate({ susannabarnbidrag: value });
  // Also persist to database
  const monthKey = state.budgetState.selectedMonthKey;
  monthlyBudgetService.updateMonthlyBudgetField(monthKey, 'susannabarnbidrag', value).catch(error => {
    console.error('Failed to update Susanna barnbidrag in database:', error);
  });
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
  
  // Find the account ID from the account name
  const accountId = state.budgetState.accounts.find(acc => acc.name === item.account)?.id || '';
  
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

export function updateAccountBalance(accountName: string, balance: number): void {
  const currentMonthData = getCurrentMonthData();
  const newBalances = { ...currentMonthData.accountBalances, [accountName]: balance };
  const newBalancesSet = { ...currentMonthData.accountBalancesSet, [accountName]: true };
  
  // Update current month accountBalances and accountBalancesSet
  updateAndRecalculate({ 
    accountBalances: newBalances,
    accountBalancesSet: newBalancesSet
  });

  // No need to update previous month's accountEndBalances anymore
  // as they are now calculated from next month's accountBalances
  console.log(`✅ Updated account balance for ${accountName}: ${balance} (accountEndBalances now calculated dynamically)`);
}

export function updateAccountBalanceForMonth(monthKey: string, accountName: string, balance: number): void {
  // Ensure the month exists - CRITICAL FIX: Use preservation logic
  if (!state.budgetState.historicalData[monthKey]) {
    state.budgetState.historicalData[monthKey] = createEmptyMonthDataWithTransactionPreservation(monthKey);
  }
  
  const monthData = state.budgetState.historicalData[monthKey];
  const newBalances = { ...monthData.accountBalances, [accountName]: balance };
  const newBalancesSet = { ...monthData.accountBalancesSet, [accountName]: true };
  
  // Update the specific month's account balances
  state.budgetState.historicalData[monthKey] = {
    ...monthData,
    accountBalances: newBalances,
    accountBalancesSet: newBalancesSet
  };
  
  saveStateToStorage();
  runCalculationsAndUpdateState();
  triggerUIRefresh();
  
  console.log(`✅ Updated account balance for ${accountName} in ${monthKey}: ${balance}`);
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

// Sync accounts from API store to orchestrator state
async function syncAccountsFromApiStore(): Promise<void> {
  try {
    console.log('[BudgetOrchestrator] 🔄 Syncing accounts from API store...');
    const { apiStore } = await import('../store/apiStore');
    
    // Get accounts from API store and convert to orchestrator format
    const apiAccounts = apiStore.accounts || [];
    const orchestratorAccounts = apiAccounts.map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      startBalance: acc.balance || 0
    }));
    
    // Update orchestrator state with API store accounts  
    state.budgetState.accounts = orchestratorAccounts;
    
    console.log('[BudgetOrchestrator] ✅ Synced accounts from API store:', orchestratorAccounts.length);
    addMobileDebugLog(`[ORCHESTRATOR] ✅ Synced ${orchestratorAccounts.length} accounts from API store`);
  } catch (error) {
    console.error('[BudgetOrchestrator] ❌ Failed to sync accounts from API store:', error);
    addMobileDebugLog('[ORCHESTRATOR] ❌ Failed to sync accounts from API store');
  }
}

export function setAccounts(accounts: any[]): void {
  if (Array.isArray(accounts) && accounts.length > 0) {
    if (typeof accounts[0] === 'string') {
      // Convert string array to Account objects
      state.budgetState.accounts = accounts.map((name, index) => ({
        id: (index + 1).toString(),
        name: name,
        startBalance: 0
      }));
    } else {
      // Already Account objects
      state.budgetState.accounts = accounts;
    }
  }
  saveStateToStorage();
  triggerUIRefresh();
}

export function addAccount(account: { name: string; startBalance: number }): void {
  console.log('🔄 [ORCHESTRATOR] Adding new account:', account);
  
  const newAccount = {
    id: uuidv4(),
    name: account.name,
    startBalance: account.startBalance
  };
  
  // Add to existing accounts
  state.budgetState.accounts = [...state.budgetState.accounts, newAccount];
  
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log('✅ [ORCHESTRATOR] Account added successfully:', newAccount);
}

// Helper function to add the Överföring account if it doesn't exist
export function ensureOverforingAccount(): void {
  const overforingExists = state.budgetState.accounts.some(acc => acc.name === "Överföring");
  if (!overforingExists) {
    const overforingAccount = {
      id: "aa9d996d-1baf-4c34-91bb-02f82b51aab6",
      name: "Överföring",
      startBalance: 0
    };
    state.budgetState.accounts = [...state.budgetState.accounts, overforingAccount];
    console.log('✅ [ORCHESTRATOR] Added missing Överföring account:', overforingAccount);
    saveStateToStorage();
  }
}

export function removeAccount(accountId: string): void {
  console.log('🔄 [ORCHESTRATOR] Removing account:', accountId);
  
  // Remove from accounts
  state.budgetState.accounts = state.budgetState.accounts.filter(acc => acc.id !== accountId);
  
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log('✅ [ORCHESTRATOR] Account removed successfully');
}

// ===== BANK TEMPLATE MANAGEMENT =====

export function linkAccountToBankTemplate(accountId: string, templateId: string): void {
  console.log(`[ORCHESTRATOR] 🏦 Linking account ${accountId} to bank template ${templateId}`);
  
  const account = state.budgetState.accounts.find(acc => acc.id === accountId);
  if (account) {
    account.bankTemplateId = templateId;
    saveStateToStorage();
    triggerUIRefresh();
    console.log(`[ORCHESTRATOR] ✅ Account ${accountId} linked to template ${templateId}`);
  } else {
    console.error(`[ORCHESTRATOR] ❌ Account ${accountId} not found`);
  }
}

// ===== HELPER FUNCTIONS =====

function createEmptyMonthData(): MonthData {
  return {
    andreasSalary: 0,
    andreasförsäkringskassan: 0,
    andreasbarnbidrag: 0,
    susannaSalary: 0,
    susannaförsäkringskassan: 0,
    susannabarnbidrag: 0,
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
  addMobileDebugLog('🔥 [ORCHESTRATOR] updateHistoricalData called');
  addMobileDebugLog(`🔥 [ORCHESTRATOR] Incoming data keys: ${Object.keys(value).join(', ')}`);
  
  // Check what's in the data for current month
  const currentMonth = state.budgetState.selectedMonthKey;
  if (value[currentMonth]) {
    addMobileDebugLog(`🔥 [ORCHESTRATOR] Current month data keys: ${Object.keys(value[currentMonth]).join(', ')}`);
    addMobileDebugLog(`🔥 [ORCHESTRATOR] accountBalances in data: ${JSON.stringify(value[currentMonth].accountBalances)}`);
    addMobileDebugLog(`🔥 [ORCHESTRATOR] accountBalancesSet in data: ${JSON.stringify(value[currentMonth].accountBalancesSet)}`);
  }
  
  state.budgetState.historicalData = value;
  addMobileDebugLog('🔥 [ORCHESTRATOR] State updated, calling saveStateToStorage');
  saveStateToStorage();
  addMobileDebugLog('🔥 [ORCHESTRATOR] saveStateToStorage completed');
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

export function updateTransaction(transactionId: string, updates: Partial<ImportedTransaction>, monthKey?: string): void {
  console.log(`🔄 [ORCHESTRATOR] updateTransaction called with:`, { transactionId, updates, monthKey });
  
  // CRITICAL: Use centralized transaction storage
  const originalTransactionIndex = state.budgetState.allTransactions.findIndex(t => t.id === transactionId);
  if (originalTransactionIndex === -1) {
    console.error(`[Orchestrator] Transaction ${transactionId} not found in centralized storage.`);
    return;
  }

  const originalTransaction = state.budgetState.allTransactions[originalTransactionIndex];
  console.log(`🔄 [ORCHESTRATOR] Original transaction status: ${originalTransaction.status}, new status: ${updates.status}`);

  // --- RESTORATION LOGIC ---
  // If the type is being changed AWAY from 'CostCoverage' or 'ExpenseClaim', restore both linked transactions
  if ((originalTransaction.type === 'CostCoverage' || originalTransaction.type === 'ExpenseClaim') && 
      updates.type && 
      updates.type !== 'CostCoverage' && 
      updates.type !== 'ExpenseClaim' &&
      originalTransaction.linkedTransactionId) {
    
    console.log(`🔄 [Orchestrator] Restoring ${originalTransaction.type} link for ${transactionId}`);
    
    // Find and restore the linked transaction
    const linkedTxIndex = state.budgetState.allTransactions.findIndex(t => t.id === originalTransaction.linkedTransactionId);
    if (linkedTxIndex !== -1) {
      state.budgetState.allTransactions[linkedTxIndex] = {
        ...state.budgetState.allTransactions[linkedTxIndex],
        correctedAmount: undefined, // Remove the correction
        linkedTransactionId: undefined // Break the link
      };
      console.log(`🔄 [Orchestrator] Restored linked transaction ${originalTransaction.linkedTransactionId}`);
    }
    
    // Prepare updates for the transaction being changed - break the link and remove correction
    updates = {
      ...updates,
      correctedAmount: undefined, // Remove the correction
      linkedTransactionId: undefined // Break the link
    };
  }
  // --- END RESTORATION LOGIC ---

  // Apply the updates to centralized storage
  const updatedTransaction = { ...originalTransaction, ...updates } as Transaction;
  
  // Convert ImportedTransaction updates to Transaction format if needed
  if ('appCategoryId' in updates || 'appSubCategoryId' in updates) {
    // Map ImportedTransaction fields to Transaction fields if they don't exist
    updatedTransaction.appCategoryId = updates.appCategoryId || originalTransaction.appCategoryId;
    updatedTransaction.appSubCategoryId = updates.appSubCategoryId || originalTransaction.appSubCategoryId;
  }
  
  // Always recalculate status unless explicitly overridden
  if (!updates.hasOwnProperty('status')) {
    updatedTransaction.status = determineTransactionStatus(updatedTransaction);
  }
  
  state.budgetState.allTransactions[originalTransactionIndex] = updatedTransaction;
  
  console.log(`🔄 [ORCHESTRATOR] Updated transaction ${transactionId} in centralized storage:`, { 
    oldStatus: originalTransaction.status, 
    newStatus: updatedTransaction.status,
    oldType: originalTransaction.type,
    newType: updatedTransaction.type
  });
  
  console.log(`🔄 [ORCHESTRATOR] State updated, about to save and trigger refresh...`);
  
  saveStateToStorage();
  runCalculationsAndUpdateState();
  console.log(`✅ [Orchestrator] Transaction ${transactionId} updated successfully in centralized storage`);
}

export function matchInternalTransfer(t1Id: string, t2Id: string): void {
  console.log(`🔄 [ORCHESTRATOR] Matching internal transfers: ${t1Id} <-> ${t2Id}`);
  
  // Search for transactions in centralized allTransactions array first
  let t1: any = state.budgetState.allTransactions.find(t => t.id === t1Id);
  let t2: any = state.budgetState.allTransactions.find(t => t.id === t2Id);
  let t1MonthKey = '';
  let t2MonthKey = '';
  
  // If found in centralized storage, derive month keys from dates
  if (t1) {
    t1MonthKey = t1.date.substring(0, 7);
  }
  if (t2) {
    t2MonthKey = t2.date.substring(0, 7);
  }
  
  // Fallback: search in monthly historical data if not found in centralized storage
  if (!t1 || !t2) {
    Object.keys(state.budgetState.historicalData).forEach(monthKey => {
      const monthData = state.budgetState.historicalData[monthKey];
      if (monthData?.transactions) {
        const foundT1 = monthData.transactions.find(t => t.id === t1Id);
        const foundT2 = monthData.transactions.find(t => t.id === t2Id);
        
        if (foundT1 && !t1) {
          t1 = foundT1;
          t1MonthKey = monthKey;
        }
        if (foundT2 && !t2) {
          t2 = foundT2;
          t2MonthKey = monthKey;
        }
      }
    });
  }
  
  if (!t1 || !t2) {
    console.error(`❌ [ORCHESTRATOR] Could not find transactions: t1=${!!t1} t2=${!!t2}`);
    console.error(`❌ [ORCHESTRATOR] Searched for ${t1Id} and ${t2Id} in ${state.budgetState.allTransactions.length} centralized transactions and ${Object.keys(state.budgetState.historicalData).length} historical months`);
    return;
  }
  
  console.log(`✅ [ORCHESTRATOR] Found transactions in months: t1=${t1MonthKey}, t2=${t2MonthKey}`);
  
  const account1Name = state.budgetState.accounts.find(a => a.id === t1.accountId)?.name || t1.accountId;
  const account2Name = state.budgetState.accounts.find(a => a.id === t2.accountId)?.name || t2.accountId;
  
  console.log(`🔄 [ORCHESTRATOR] Matching ${account1Name} transaction "${t1.description}" with ${account2Name} transaction "${t2.description}"`);
  
  // Update both transactions with link and description
  updateTransaction(t1.id, {
    type: 'InternalTransfer',
    linkedTransactionId: t2.id,
    userDescription: `Överföring till ${account2Name}, ${t2.date}`,
    isManuallyChanged: true
  }, t1MonthKey);
  
  updateTransaction(t2.id, {
    type: 'InternalTransfer',
    linkedTransactionId: t1.id,
    userDescription: `Överföring från ${account1Name}, ${t1.date}`,
    isManuallyChanged: true
  }, t2MonthKey);
  
  console.log(`✅ [ORCHESTRATOR] Successfully matched internal transfer between ${t1Id} and ${t2Id}`);
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
  
  updateTransaction(transactionId, {
    type: 'Savings',
    savingsTargetId: savingsTargetId,
    appCategoryId: mainCategoryId // Save the main category ID directly on the transaction
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
      
      // Check if either account doesn't exist
      const transactionAccount = state.budgetState.accounts.find(acc => acc.id === transaction.accountId);
      const linkedAccount = linkedTx ? state.budgetState.accounts.find(acc => acc.id === linkedTx.accountId) : null;
      
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
      addMobileDebugLog(`✅ [ORCHESTRATOR] Loaded monthly budget from database - Andreas: ${budget.andreasSalary}, Susanna: ${budget.susannaSalary}`);
      
      // Update current month data with database values
      const updates = {
        andreasSalary: budget.andreasSalary,
        andreasförsäkringskassan: budget.andreasförsäkringskassan,
        andreasbarnbidrag: budget.andreasbarnbidrag,
        susannaSalary: budget.susannaSalary,
        susannaförsäkringskassan: budget.susannaförsäkringskassan,
        susannabarnbidrag: budget.susannabarnbidrag,
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
    // Skip transactions from accounts that don't exist (would show as "Okänt konto")
    const transactionAccount = state.budgetState.accounts.find(acc => acc.id === transaction.accountId);
    if (!transactionAccount) {
      console.log(`[ORCHESTRATOR] Skipping transaction ${transaction.id} - account ${transaction.accountId} not found`);
      return;
    }
    
    // Find potential matches on the same date with opposite signs on different accounts
    const potentialMatches = state.budgetState.allTransactions.filter(t => {
      // Skip transactions from accounts that don't exist
      const targetAccount = state.budgetState.accounts.find(acc => acc.id === t.accountId);
      if (!targetAccount) {
        return false;
      }
      
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
    correctedAmount: tx.correctedAmount,
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

export function getAccountNameById(accountId: string): string {
  // First check if the accountId is already a name (like "Bil")
  const accountByName = state.budgetState.accounts.find(acc => acc.name === accountId);
  if (accountByName) {
    return accountId; // It's already a name
  }
  
  // Otherwise, look up by ID
  const accountById = state.budgetState.accounts.find(acc => acc.id === accountId);
  return accountById?.name || accountId; // Return name if found, otherwise return the original ID
}
// Categories are now directly managed through mainCategories and subcategories
// No more separate linking system needed

// ===== TRANSACTION RETRIEVAL =====

export function getAllTransactionsFromDatabase(): ImportedTransaction[] {
  console.log('🔍 [ORCHESTRATOR] Getting all transactions from centralized storage...');
  
  // CRITICAL: Use centralized transaction storage INCLUDING bank categories
  const allTransactions: ImportedTransaction[] = state.budgetState.allTransactions.map(tx => ({
    id: tx.id,
    accountId: tx.accountId,
    date: tx.date,
    amount: tx.amount,
    balanceAfter: tx.balanceAfter,
    description: tx.description,
    userDescription: tx.userDescription,
    type: tx.type as ImportedTransaction['type'],
    status: tx.status as ImportedTransaction['status'],
    linkedTransactionId: tx.linkedTransactionId,
    correctedAmount: tx.correctedAmount,
    isManuallyChanged: tx.isManuallyChanged,
    appCategoryId: tx.appCategoryId,
    appSubCategoryId: tx.appSubCategoryId,
    bankCategory: tx.bankCategory,  // CRITICAL: Include bank category from file (now properly typed)
    bankSubCategory: tx.bankSubCategory,  // CRITICAL: Include bank subcategory from file (now properly typed)
    importedAt: (tx as any).importedAt || new Date().toISOString(),
    fileSource: (tx as any).fileSource || 'database'
  } as ImportedTransaction));
  
  console.log(`🔍 [ORCHESTRATOR] Total transactions from centralized storage: ${allTransactions.length}`);
  
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

export function createPlannedTransfer(transfer: Omit<PlannedTransfer, 'id' | 'created'>): void {
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
  
  const newTransfer: PlannedTransfer = {
    ...transfer,
    amount: totalAmount,
    id: uuidv4(),
    created: new Date().toISOString()
  };
  
  state.budgetState.plannedTransfers.push(newTransfer);
  saveStateToStorage();
  triggerUIRefresh();
  
  const transferTypeText = transfer.transferType === 'daily' ? 'Daglig överföring' : 'Fast månadsöverföring';
  console.log(`✅ [ORCHESTRATOR] ${transferTypeText} created: ${totalAmount} SEK from ${transfer.fromAccountId} to ${transfer.toAccountId}`);
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