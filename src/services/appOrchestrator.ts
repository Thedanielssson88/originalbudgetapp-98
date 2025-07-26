// App orchestrator - Main coordination logic
// This file binds everything together and manages the main app flow

import { initializeState, updateRawData, updateCalculatedState, getRawData, getCalculatedData } from '../state/mainState';
import * as storage from './storageService';
import * as calculator from './calculationService';
import { StorageKey } from './storageService';

/**
 * Initialize the application
 * This runs once when the app starts
 */
export function initializeApp(): void {
  console.log('[AppOrchestrator] Initializing application...');
  
  // Load all data from localStorage into memory
  initializeState();
  
  // Run initial calculations and update UI
  runCalculationsAndUpdateState();
  
  console.log('[AppOrchestrator] Application initialization complete');
}

/**
 * Run calculations and update the calculated state
 * This is called whenever raw data changes
 */
export function runCalculationsAndUpdateState(): void {
  console.log('[AppOrchestrator] Running calculations...');
  
  const rawData = getRawData();
  
  // Run the fast in-memory calculation
  const newCalculatedState = calculator.calculateFullPrognosis(rawData);
  
  // Update the calculated state in memory
  updateCalculatedState(newCalculatedState);
  
  console.log('[AppOrchestrator] Calculations complete');
}

/**
 * Handle manual value changes from the UI
 * This saves the change immediately and triggers recalculation
 * @param key - Storage key for the data that changed
 * @param newValue - The new value
 * @param statePath - The path in state.rawData to update (dot notation)
 */
export function handleManualValueChange<T = any>(
  key: StorageKey, 
  newValue: T, 
  statePath: string
): void {
  console.log(`[AppOrchestrator] Handling manual value change for ${statePath}`);
  
  // Update raw data and save to localStorage
  updateRawData(key, newValue, statePath);
  
  // Trigger recalculation and state update
  runCalculationsAndUpdateState();
  
  console.log(`[AppOrchestrator] Manual value change processed for ${statePath}`);
}

/**
 * Get current application state
 */
export function getCurrentState() {
  return {
    rawData: getRawData(),
    calculated: getCalculatedData()
  };
}

/**
 * Batch update multiple values (for efficiency)
 * @param updates - Array of updates to make
 */
export function handleBatchValueChanges(updates: Array<{
  key: StorageKey;
  value: any;
  statePath: string;
}>): void {
  console.log(`[AppOrchestrator] Handling batch value changes (${updates.length} updates)`);
  
  // Apply all updates
  updates.forEach(update => {
    updateRawData(update.key, update.value, update.statePath);
  });
  
  // Run calculations once after all updates
  runCalculationsAndUpdateState();
  
  console.log(`[AppOrchestrator] Batch value changes processed`);
}

/**
 * Handle month-specific data updates
 * @param monthKey - The month key (YYYY-MM format)
 * @param monthData - The complete month data
 */
export function handleMonthDataUpdate(monthKey: string, monthData: any): void {
  console.log(`[AppOrchestrator] Updating month data for ${monthKey}`);
  
  const rawData = getRawData();
  const updatedHistoricalData = {
    ...rawData.historicalData,
    [monthKey]: {
      ...rawData.historicalData[monthKey],
      ...monthData
    }
  };
  
  handleManualValueChange(
    storage.STORAGE_KEYS.HISTORICAL_DATA,
    updatedHistoricalData,
    'historicalData'
  );
}

/**
 * Handle account balance updates for a specific month
 * @param monthKey - The month key (YYYY-MM format)
 * @param accountName - The account name
 * @param balance - The new balance
 * @param isSet - Whether this balance has been explicitly set
 */
export function handleAccountBalanceUpdate(
  monthKey: string, 
  accountName: string, 
  balance: number, 
  isSet: boolean = true
): void {
  console.log(`[AppOrchestrator] Updating account balance for ${accountName} in ${monthKey}`);
  
  const rawData = getRawData();
  const monthData = rawData.historicalData[monthKey] || {};
  
  const updatedMonthData = {
    ...monthData,
    accountBalances: {
      ...monthData.accountBalances,
      [accountName]: balance
    },
    accountBalancesSet: {
      ...monthData.accountBalancesSet,
      [accountName]: isSet
    }
  };
  
  handleMonthDataUpdate(monthKey, updatedMonthData);
}

/**
 * Handle UI state updates (expanded sections, etc.)
 * @param stateKey - The UI state key
 * @param value - The new value
 */
export function handleUIStateUpdate(stateKey: string, value: any): void {
  // Find the appropriate storage key and state path
  let storageKey: StorageKey;
  let statePath: string;
  
  switch (stateKey) {
    case 'expandedSections':
      storageKey = storage.STORAGE_KEYS.EXPANDED_SECTIONS;
      statePath = 'expandedSections';
      break;
    case 'expandedBudgetCategories':
      storageKey = storage.STORAGE_KEYS.EXPANDED_BUDGET_CATEGORIES;
      statePath = 'expandedBudgetCategories';
      break;
    case 'expandedAccounts':
      storageKey = storage.STORAGE_KEYS.EXPANDED_ACCOUNTS;
      statePath = 'expandedAccounts';
      break;
    case 'expandedTemplates':
      storageKey = storage.STORAGE_KEYS.EXPANDED_TEMPLATES;
      statePath = 'expandedTemplates';
      break;
    default:
      console.warn(`[AppOrchestrator] Unknown UI state key: ${stateKey}`);
      return;
  }
  
  // UI state changes don't need recalculation, just storage update
  updateRawData(storageKey, value, statePath);
}