// Single Source of Truth Orchestrator - Simplified architecture

import { state, initializeStateFromStorage, saveStateToStorage, getCurrentMonthData, updateCurrentMonthData } from '../state/budgetState';
import { StorageKey, set } from '../services/storageService';
import { calculateFullPrognosis, calculateBudgetResults, calculateAccountProgression, calculateMonthlyBreakdowns, calculateProjectedBalances } from '../services/calculationService';
import { BudgetGroup, MonthData, SavingsGoal, CsvMapping } from '../types/budget';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import { v4 as uuidv4 } from 'uuid';
import { ImportedTransaction, CategoryRule } from '../types/transaction';

// SMART MERGE FUNCTION - The definitive solution to duplicate and lost changes
export function importAndReconcileFile(csvContent: string, accountId: string): void {
  console.log(`[ORCHESTRATOR] 🔥 Smart merge starting for account ${accountId}`);
  
  // 1. Parse CSV content
  const transactionsFromFile = parseCSVContent(csvContent, accountId, 'imported');
  if (transactionsFromFile.length === 0) {
    console.log(`[ORCHESTRATOR] ⚠️ No transactions found in CSV`);
    return;
  }
  
  // 2. Define date range of the file
  const datesInFile = transactionsFromFile.map(t => new Date(t.date).getTime());
  const minDate = new Date(Math.min(...datesInFile));
  const maxDate = new Date(Math.max(...datesInFile));
  
  console.log(`[ORCHESTRATOR] 📅 File date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
  
  // 3. Get ALL existing transactions from central state
  const allSavedTransactions = Object.values(state.budgetState.historicalData)
    .flatMap(month => (month.transactions || []).map(t => ({
      ...t,
      importedAt: (t as any).importedAt || new Date().toISOString(),
      fileSource: (t as any).fileSource || 'budgetState'
    } as ImportedTransaction)));
  
  // 4. Remove old transactions for this account within the date range (CSV is truth)
  const transactionsToKeep = allSavedTransactions.filter(t => 
    !(t.accountId === accountId && new Date(t.date) >= minDate && new Date(t.date) <= maxDate)
  );
  
  console.log(`[ORCHESTRATOR] 🧹 Kept ${transactionsToKeep.length} transactions, removing ${allSavedTransactions.length - transactionsToKeep.length} within date range`);
  
  // 5. Create map of existing transactions for smart merge
  const savedTransactionsMap = new Map<string, ImportedTransaction>();
  allSavedTransactions.forEach(t => savedTransactionsMap.set(createTransactionFingerprint(t), t));
  
  // 6. Intelligent merge - preserve manual changes
  const mergedTransactions = transactionsFromFile.map(fileTx => {
    const fingerprint = createTransactionFingerprint(fileTx);
    const existingTx = savedTransactionsMap.get(fingerprint);

    if (existingTx && existingTx.isManuallyChanged) {
      // PRESERVE user changes but update bank fields
      console.log(`[ORCHESTRATOR] 💾 Preserving manual changes for transaction: ${fileTx.description}`);
      return {
        ...existingTx,
        // Update bank data from file
        bankCategory: fileTx.bankCategory,
        bankSubCategory: fileTx.bankSubCategory,
        bankStatus: fileTx.bankStatus,
        balanceAfter: fileTx.balanceAfter,
        fileSource: fileTx.fileSource
      };
    }
    
    // New transaction or unchanged - apply category rules
    return applyCategoryRules(fileTx, state.budgetState.transactionImport?.categoryRules || []);
  });
  
  // 7. Combine cleaned list with new merged transactions
  const finalTransactionList = [...transactionsToKeep, ...mergedTransactions];
  
  console.log(`[ORCHESTRATOR] ✅ Final transaction count: ${finalTransactionList.length}`);
  
  // 8. Save back to central state grouped by month
  const finalGroupedByMonth = groupTransactionsByMonth(finalTransactionList);
  
  // Clear existing months and update with new data
  Object.keys(state.budgetState.historicalData).forEach(monthKey => {
    if (!state.budgetState.historicalData[monthKey]) {
      state.budgetState.historicalData[monthKey] = createEmptyMonthDataForImport();
    }
    
    // Convert ImportedTransaction to Transaction format for storage
    const monthTransactions = (finalGroupedByMonth[monthKey] || []).map(tx => ({
      ...tx,
      bankCategory: tx.bankCategory || '',
      bankSubCategory: tx.bankSubCategory || '',
      userDescription: tx.userDescription || '',
      balanceAfter: tx.balanceAfter || 0,
      status: tx.status || 'red' as const
    }));
    
    state.budgetState.historicalData[monthKey].transactions = monthTransactions;
  });
  
  // 9. Save and refresh UI
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

// Apply category rules to a transaction
function applyCategoryRules(transaction: ImportedTransaction, categoryRules: CategoryRule[]): ImportedTransaction {
  let categorizedTransaction = { ...transaction };
  
  for (const rule of categoryRules) {
    if (rule.isActive && rule.description && 
        transaction.description.toLowerCase().includes(rule.description.toLowerCase())) {
      categorizedTransaction.type = rule.transactionType;
      categorizedTransaction.appCategoryId = rule.appCategoryId;
      categorizedTransaction.appSubCategoryId = rule.appSubCategoryId;
      categorizedTransaction.status = 'yellow'; // Auto-categorized
      break;
    }
  }
  
  return categorizedTransaction;
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
  
  if (savedMapping && savedMapping.columnMapping) {
    // Use saved mappings - find which CSV columns map to our app fields
    console.log(`[ORCHESTRATOR] 🔍 Using saved column mappings:`, savedMapping.columnMapping);
    
    // Find the CSV column names that map to each app field
    const dateColumn = Object.keys(savedMapping.columnMapping).find(csvCol => savedMapping.columnMapping[csvCol] === 'date');
    const amountColumn = Object.keys(savedMapping.columnMapping).find(csvCol => savedMapping.columnMapping[csvCol] === 'amount');
    const descriptionColumn = Object.keys(savedMapping.columnMapping).find(csvCol => savedMapping.columnMapping[csvCol] === 'description');
    const balanceColumn = Object.keys(savedMapping.columnMapping).find(csvCol => savedMapping.columnMapping[csvCol] === 'balanceAfter');
    
    // Get the indices of these columns in the headers
    dateColumnIndex = dateColumn ? headers.indexOf(dateColumn) : -1;
    amountColumnIndex = amountColumn ? headers.indexOf(amountColumn) : -1;
    descriptionColumnIndex = descriptionColumn ? headers.indexOf(descriptionColumn) : -1;
    balanceColumnIndex = balanceColumn ? headers.indexOf(balanceColumn) : -1;
    
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
  }
  
  console.log(`[ORCHESTRATOR] 🔍 Column indices - Date: ${dateColumnIndex}, Amount: ${amountColumnIndex}, Description: ${descriptionColumnIndex}, Balance: ${balanceColumnIndex}`);

  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(';');
    if (fields.length < headers.length) continue;

    try {
      const rawAmountField = amountColumnIndex >= 0 ? fields[amountColumnIndex] : '0';
      const cleanedAmountField = rawAmountField.trim().replace(',', '.').replace(/\s/g, '');
      const parsedAmount = parseFloat(cleanedAmountField);

      if (isNaN(parsedAmount)) continue;

      const rawDate = dateColumnIndex >= 0 ? fields[dateColumnIndex] : '';
      const parsedDate = parseSwedishDate(rawDate);
      if (!parsedDate) continue;

      // NEW: Parse balance after transaction
      let balanceAfter: number | undefined;
      if (balanceColumnIndex >= 0) {
        const rawBalanceField = fields[balanceColumnIndex];
        const cleanedBalanceField = rawBalanceField.trim().replace(',', '.').replace(/\s/g, '');
        const parsedBalance = parseFloat(cleanedBalanceField);
        if (!isNaN(parsedBalance)) {
          balanceAfter = parsedBalance;
          console.log(`[ORCHESTRATOR] 🔍 Parsed balance for transaction ${i}: ${balanceAfter}`);
        }
      }

      const transaction: ImportedTransaction = {
        id: uuidv4(),
        date: parsedDate,
        description: descriptionColumnIndex >= 0 ? fields[descriptionColumnIndex].trim() : '',
        amount: parsedAmount,
        balanceAfter: balanceAfter, // NEW: Include balance after transaction
        accountId: accountId,
        type: 'Transaction',
        status: 'red',
        importedAt: new Date().toISOString(),
        fileSource: fileName
      };

      transactions.push(transaction);
    } catch (error) {
      console.warn(`Failed to parse transaction at line ${i + 1}:`, error);
    }
  }
  
  console.log(`[ORCHESTRATOR] 🔍 Parsed ${transactions.length} transactions, balance data found: ${transactions.filter(t => t.balanceAfter !== undefined).length}`);
  return transactions;
}

// Helper functions moved from TransactionImportEnhanced
function parseSwedishDate(dateString: string): string | null {
  if (!dateString) return null;
  
  const trimmed = dateString.trim();
  const swedishDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = trimmed.match(swedishDatePattern);
  
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  return null;
}

function groupTransactionsByMonth(transactions: ImportedTransaction[]): Record<string, ImportedTransaction[]> {
  const groups: Record<string, ImportedTransaction[]> = {};
  
  transactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
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
      // Apply categorization rules to new transaction
      let categorizedTransaction = { ...fileTx };
      
      for (const rule of categoryRules) {
        if (rule.description && fileTx.description.toLowerCase().includes(rule.description.toLowerCase())) {
          categorizedTransaction.type = rule.transactionType;
          categorizedTransaction.appCategoryId = rule.appCategoryId;
          categorizedTransaction.appSubCategoryId = rule.appSubCategoryId;
          break;
        }
      }
      
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
  }, 0);
}

// Track initialization to prevent multiple calls
let isInitialized = false;

// Initialize the application
export function initializeApp(): void {
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
  
  initializeStateFromStorage();
  
  addMobileDebugLog(`[ORCHESTRATOR] After storage init - available months: ${Object.keys(state.budgetState.historicalData).join(', ')}`);
  addMobileDebugLog(`[ORCHESTRATOR] Selected month: ${state.budgetState.selectedMonthKey}`);
  
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
}

export function setAndreasförsäkringskassan(value: number): void {
  updateAndRecalculate({ andreasförsäkringskassan: value });
}

export function setAndreasbarnbidrag(value: number): void {
  updateAndRecalculate({ andreasbarnbidrag: value });
}

export function setSusannaSalary(value: number): void {
  updateAndRecalculate({ susannaSalary: value });
}

export function setSusannaförsäkringskassan(value: number): void {
  updateAndRecalculate({ susannaförsäkringskassan: value });
}

export function setSusannabarnbidrag(value: number): void {
  updateAndRecalculate({ susannabarnbidrag: value });
}

export function setCostGroups(value: BudgetGroup[]): void {
  updateAndRecalculate({ costGroups: value });
}

export function setSavingsGroups(value: BudgetGroup[]): void {
  updateAndRecalculate({ savingsGroups: value });
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
  // Ensure the month exists
  if (!state.budgetState.historicalData[monthKey]) {
    state.budgetState.historicalData[monthKey] = createEmptyMonthData();
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
  state.budgetState.selectedMonthKey = monthKey;
  
  // Ensure the month exists
  if (!state.budgetState.historicalData[monthKey]) {
    state.budgetState.historicalData[monthKey] = createEmptyMonthData();
  }
  
  saveStateToStorage();
  triggerUIRefresh();
}

export function setSelectedHistoricalMonth(monthKey: string): void {
  state.budgetState.selectedHistoricalMonth = monthKey;
  saveStateToStorage();
  triggerUIRefresh();
}

// ===== GLOBAL SETTINGS =====

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
    andreasSalary: 45000,
    andreasförsäkringskassan: 0,
    andreasbarnbidrag: 0,
    susannaSalary: 40000,
    susannaförsäkringskassan: 5000,
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
  // Also save to separate storage for migration compatibility
  set(StorageKey.MAIN_CATEGORIES, value);
  saveStateToStorage();
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
  
  // Use provided monthKey or fall back to selected month
  const targetMonthKey = monthKey || state.budgetState.selectedMonthKey;
  
  if (!targetMonthKey) {
    console.error('[Orchestrator] Ingen månad angiven och ingen månad vald, kan inte uppdatera transaktion.');
    return;
  }

  const currentMonth = state.budgetState.historicalData[targetMonthKey];
  if (!currentMonth || !currentMonth.transactions) {
    console.error(`[Orchestrator] Inga transaktioner finns för månad ${targetMonthKey}.`);
    return;
  }

  // Find the original transaction to check for restoration logic
  const originalTransaction = currentMonth.transactions.find(t => t.id === transactionId);
  if (!originalTransaction) {
    console.error(`[Orchestrator] Transaction ${transactionId} not found in month ${targetMonthKey}.`);
    return;
  }

  console.log(`🔄 [ORCHESTRATOR] Original transaction status: ${originalTransaction.status}, new status: ${updates.status}`);

  let updatedTransactions = [...currentMonth.transactions];

  // --- RESTORATION LOGIC ---
  // If the type is being changed AWAY from 'CostCoverage' or 'ExpenseClaim', restore both linked transactions
  if ((originalTransaction.type === 'CostCoverage' || originalTransaction.type === 'ExpenseClaim') && 
      updates.type && 
      updates.type !== 'CostCoverage' && 
      updates.type !== 'ExpenseClaim' &&
      originalTransaction.linkedTransactionId) {
    
    console.log(`🔄 [Orchestrator] Restoring ${originalTransaction.type} link for ${transactionId}`);
    
    // Find and restore the linked transaction
    const linkedTxIndex = updatedTransactions.findIndex(t => t.id === originalTransaction.linkedTransactionId);
    if (linkedTxIndex !== -1) {
      updatedTransactions[linkedTxIndex] = {
        ...updatedTransactions[linkedTxIndex],
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

  // Apply the updates
  updatedTransactions = updatedTransactions.map(t => {
    if (t.id === transactionId) {
      const updatedTransaction = { ...t, ...updates };
      console.log(`🔄 [ORCHESTRATOR] Updated transaction ${transactionId}:`, { 
        oldStatus: t.status, 
        newStatus: updatedTransaction.status,
        oldType: t.type,
        newType: updatedTransaction.type
      });
      return updatedTransaction;
    }
    return t;
  });

  // Update the specific month's data directly 
  state.budgetState.historicalData[targetMonthKey] = {
    ...currentMonth,
    transactions: updatedTransactions
  };
  
  console.log(`🔄 [ORCHESTRATOR] State updated, about to save and trigger refresh...`);
  
  saveStateToStorage();
  runCalculationsAndUpdateState();
  console.log(`✅ [Orchestrator] Transaction ${transactionId} updated successfully in month ${targetMonthKey}`);
}

export function matchInternalTransfer(t1Id: string, t2Id: string): void {
  const currentMonthKey = state.budgetState.selectedMonthKey;
  const currentMonth = state.budgetState.historicalData[currentMonthKey];
  
  if (!currentMonth?.transactions) return;
  
  const t1 = currentMonth.transactions.find(t => t.id === t1Id);
  const t2 = currentMonth.transactions.find(t => t.id === t2Id);
  
  if (!t1 || !t2) return;
  
  const account1Name = state.budgetState.accounts.find(a => a.id === t1.accountId)?.name || t1.accountId;
  const account2Name = state.budgetState.accounts.find(a => a.id === t2.accountId)?.name || t2.accountId;
  
  // Update both transactions
  updateTransaction(t1.id, {
    type: 'InternalTransfer',
    linkedTransactionId: t2.id,
    userDescription: `Överföring till ${account2Name}`
  }, currentMonthKey);
  
  updateTransaction(t2.id, {
    type: 'InternalTransfer',
    linkedTransactionId: t1.id,
    userDescription: `Överföring från ${account1Name}`
  }, currentMonthKey);
  
  console.log(`✅ [Orchestrator] Matched internal transfer between ${t1Id} and ${t2Id}`);
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
  for (const [monthKey, monthData] of Object.entries(state.budgetState.historicalData || {})) {
    const transactions = (monthData as any)?.transactions || [];
    const found = transactions.find((t: any) => t.id === transactionId);
    if (found) return found;
  }
  return null;
}

// Helper function to find month key for a transaction
function findMonthKeyForTransaction(transactionId: string): string | null {
  for (const [monthKey, monthData] of Object.entries(state.budgetState.historicalData || {})) {
    const transactions = (monthData as any)?.transactions || [];
    const found = transactions.find((t: any) => t.id === transactionId);
    if (found) return monthKey;
  }
  return null;
}

// Helper function to update multiple transactions efficiently
function updateMultipleTransactions(updates: { transactionId: string, monthKey: string, updates: Partial<any> }[]): void {
  updates.forEach(({ transactionId, monthKey, updates: transactionUpdates }) => {
    updateTransaction(transactionId, transactionUpdates, monthKey);
  });
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
  if (!state.budgetState.historicalData[monthKey]) {
    console.error(`[Orchestrator] Månad ${monthKey} finns inte.`);
    return;
  }
  
  // Update the transaction list for the specific month
  (state.budgetState.historicalData[monthKey] as any).transactions = transactions;

  console.log(`[Orchestrator] Sparade ${transactions.length} transaktioner till månad ${monthKey}.`);

  // Save the updated state permanently and re-run calculations
  saveStateToStorage();
  triggerUIRefresh();
  
  console.log(`[ORCHESTRATOR] Triggered UI refresh after updating transactions for month ${monthKey}`);
}

export function setTransactionsForCurrentMonth(transactions: ImportedTransaction[]): void {
  const currentMonthKey = state.budgetState.selectedMonthKey;

  // Check that a month is selected
  if (!currentMonthKey) {
    console.error('[Orchestrator] Ingen månad vald, kan inte spara transaktioner.');
    return;
  }

  // Ensure the month data exists
  if (!state.budgetState.historicalData[currentMonthKey]) {
    state.budgetState.historicalData[currentMonthKey] = createEmptyMonthData();
  }

  // Use the new flexible function
  updateTransactionsForMonth(currentMonthKey, transactions);
}

// ===== CATEGORY RULES MANAGEMENT =====

export function addCategoryRule(newRule: Omit<CategoryRule, 'id'>): void {
  const ruleWithId = { ...newRule, id: uuidv4() };
  state.budgetState.transactionImport.categoryRules.push(ruleWithId);
  saveStateToStorage();
  triggerUIRefresh();
}

export function updateCategoryRule(updatedRule: CategoryRule): void {
  const ruleIndex = state.budgetState.transactionImport.categoryRules.findIndex(r => r.id === updatedRule.id);
  if (ruleIndex !== -1) {
    state.budgetState.transactionImport.categoryRules[ruleIndex] = updatedRule;
    saveStateToStorage();
    triggerUIRefresh();
  }
}

export function deleteCategoryRule(ruleId: string): void {
  state.budgetState.transactionImport.categoryRules = state.budgetState.transactionImport.categoryRules.filter(r => r.id !== ruleId);
  saveStateToStorage();
  triggerUIRefresh();
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
  console.log('🔍 [ORCHESTRATOR] Getting all transactions from database...');
  
  const allTransactions: ImportedTransaction[] = [];
  
  // Iterate through all historical data and collect transactions
  Object.entries(state.budgetState.historicalData || {}).forEach(([monthKey, monthData]) => {
    const transactions = (monthData as any)?.transactions || [];
    console.log(`🔍 [ORCHESTRATOR] Found ${transactions.length} transactions in month ${monthKey}`);
    
    transactions.forEach((transaction: any) => {
      // Convert to ImportedTransaction format
      allTransactions.push({
        ...transaction,
        importedAt: transaction.importedAt || new Date().toISOString(),
        fileSource: transaction.fileSource || 'database'
      } as ImportedTransaction);
    });
  });
  
  console.log(`🔍 [ORCHESTRATOR] Total transactions from database: ${allTransactions.length}`);
  return allTransactions;
}

// NEW: Function to update payday setting
export function updatePaydaySetting(newPayday: number): void {
  console.log(`[updatePaydaySetting] Setting payday to: ${newPayday}`);
  
  state.budgetState.settings.payday = newPayday;
  
  // Force recalculation since this affects how months are interpreted
  forceRecalculation();
  
  // Trigger state update notifications
  triggerUIRefresh();
  
  // Save to storage
  saveStateToStorage();
}