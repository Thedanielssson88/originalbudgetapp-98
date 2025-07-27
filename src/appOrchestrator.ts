// Dirigenten som binder samman allt.

import { state, initializeStateFromStorage, saveStateToStorage } from './state/mainState';
import { StorageKey } from './services/storageService';
import { calculateFullPrognosis } from './services/calculationService';
import { RawDataState } from './types/budget';

// Denna funktion ska anropas av React för att trigga en omrendrering.
// I detta exempel använder vi en simple event-emitter.
// I en riktig React-app skulle man använda Reacts state-mekanismer (t.ex. en provider eller en state manager som Zustand/Redux).
const eventEmitter = new EventTarget();
export const APP_STATE_UPDATED = 'appstateupdated';

function triggerUIRefresh() {
    eventEmitter.dispatchEvent(new Event(APP_STATE_UPDATED));
}

export function initializeApp(): void {
  initializeStateFromStorage();
  runCalculationsAndUpdateState();
}

function runCalculationsAndUpdateState(): void {
  const newCalculatedState = calculateFullPrognosis(state.rawData);
  state.calculated = newCalculatedState;
  
  // Save to localStorage after calculations
  saveStateToStorage();
  
  triggerUIRefresh(); // Meddela UI att ny data finns tillgänglig
}

export function handleManualValueChange<T>(
  key: StorageKey, 
  value: T, 
  statePath: keyof RawDataState | string,
  skipCalculation: boolean = false
): void {
  console.log(`[Orchestrator] Uppdaterar ${statePath} med nytt värde:`, value);
  
  // 2. Uppdatera vårt state i minnet
  if (statePath.includes('.')) {
    // Handle nested paths like 'accountBalances.Löpande'
    const pathParts = statePath.split('.');
    let current: any = state.rawData;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }
    current[pathParts[pathParts.length - 1]] = value;
  } else {
    // Simple path
    (state.rawData as any)[statePath] = value;
  }
  
  // 3. Kör om alla beräkningar och uppdatera UI (unless skipped)
  if (!skipCalculation) {
    runCalculationsAndUpdateState();
  }
}

export function handleBulkValueChange(changes: Array<{
  key: StorageKey,
  value: any,
  statePath: keyof RawDataState | string
}>): void {
  console.log('[Orchestrator] Utför bulk-uppdatering av värden');
  
  // Apply all changes without triggering calculations
  changes.forEach(({ key, value, statePath }) => {
    handleManualValueChange(key, value, statePath, true);
  });
  
  // Run calculations once after all changes
  runCalculationsAndUpdateState();
}

// Funktion för UI att prenumerera på ändringar
export function subscribeToStateChanges(callback: () => void) {
    eventEmitter.addEventListener(APP_STATE_UPDATED, callback);
}

export function unsubscribeFromStateChanges(callback: () => void) {
    eventEmitter.removeEventListener(APP_STATE_UPDATED, callback);
}

// Funktion för UI att hämta det aktuella statet
export function getCurrentState() {
  return state;
}

// Specific helper functions for common operations
export function updateCostGroups(newCostGroups: any[]) {
  handleManualValueChange(StorageKey.COST_GROUPS, newCostGroups, 'costGroups');
}

export function updateSavingsGroups(newSavingsGroups: any[]) {
  handleManualValueChange(StorageKey.SAVINGS_GROUPS, newSavingsGroups, 'savingsGroups');
}

export function updateAccountBalance(account: string, balance: number) {
  console.log(`🔄 updateAccountBalance called for ${account} with balance ${balance}`);
  const newBalances = { ...state.rawData.accountBalances, [account]: balance };
  handleManualValueChange(StorageKey.ACCOUNT_BALANCES, newBalances, 'accountBalances');
  
  // Propagate balance changes to future months
  console.log(`🚀 Calling propagateBalanceChangesToFutureMonths for ${account}`);
  propagateBalanceChangesToFutureMonths(account, balance);
}

function propagateBalanceChangesToFutureMonths(account: string, newBalance: number) {
  console.log(`🔄 Starting propagation for ${account} with balance ${newBalance}`);
  const currentMonth = state.rawData.selectedBudgetMonth;
  console.log(`📅 Current month: ${currentMonth}`);
  
  if (!currentMonth) {
    console.log(`❌ No current month selected, skipping propagation`);
    return;
  }

  const historicalData = state.rawData.historicalData;
  const allMonths = Object.keys(historicalData).sort();
  console.log(`📋 All months: ${allMonths.join(', ')}`);
  
  const currentMonthIndex = allMonths.indexOf(currentMonth);
  console.log(`📍 Current month index: ${currentMonthIndex}`);
  
  if (currentMonthIndex === -1) {
    console.log(`❌ Current month not found in historical data`);
    return;
  }

  // Get all future months
  const futureMonths = allMonths.slice(currentMonthIndex + 1);
  console.log(`🔮 Future months: ${futureMonths.join(', ')}`);
  
  if (futureMonths.length === 0) {
    console.log(`ℹ️ No future months to propagate to`);
    return;
  }

  let updatedHistoricalData = { ...historicalData };
  let previousMonthEndBalance = newBalance;
  let hasChanges = false;

  futureMonths.forEach(monthKey => {
    console.log(`\n🔍 Processing month: ${monthKey}`);
    const monthData = updatedHistoricalData[monthKey];
    if (!monthData) {
      console.log(`❌ No data for month ${monthKey}`);
      return;
    }

    // Only update if the account balance is not explicitly set (showing "Ej ifyllt")
    const isExplicitlySet = monthData.accountBalancesSet?.[account] === true;
    console.log(`📝 Account ${account} explicitly set in ${monthKey}: ${isExplicitlySet}`);
    
    if (!isExplicitlySet) {
      console.log(`✅ Updating estimated start balance for ${account} in ${monthKey}: ${previousMonthEndBalance}`);
      // Update the estimated start balance for this month
      updatedHistoricalData[monthKey] = {
        ...monthData,
        accountEstimatedStartBalances: {
          ...monthData.accountEstimatedStartBalances,
          [account]: previousMonthEndBalance
        }
      };
      hasChanges = true;
    } else {
      console.log(`⏭️ Skipping ${monthKey} - balance explicitly set`);
    }

    // Calculate the end balance for this month to use for the next month
    const monthCosts = monthData.costGroups?.reduce((total: number, group: any) => {
      if (group.account === account) {
        return total + (group.amount || 0);
      }
      return total;
    }, 0) || 0;

    const monthSavings = monthData.savingsGroups?.reduce((total: number, group: any) => {
      if (group.account === account) {
        return total + (group.amount || 0);
      }
      return total;
    }, 0) || 0;

    console.log(`💰 Month ${monthKey} - Costs: ${monthCosts}, Savings: ${monthSavings}`);

    // Use the actual balance if set, otherwise use the estimated start balance
    const startBalance = isExplicitlySet ? 
      (monthData.accountBalances?.[account] || 0) : 
      previousMonthEndBalance;

    previousMonthEndBalance = startBalance - monthCosts + monthSavings;
    console.log(`🔚 End balance for ${monthKey}: ${previousMonthEndBalance}`);
  });

  // Update the historical data if changes were made
  if (hasChanges) {
    console.log(`✅ Propagation complete - updating historical data and triggering recalculation`);
    handleManualValueChange(StorageKey.HISTORICAL_DATA, updatedHistoricalData, 'historicalData', false);
  } else {
    console.log(`ℹ️ No changes needed during propagation`);
  }
}

export function updateSelectedBudgetMonth(monthKey: string) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, monthKey, 'selectedBudgetMonth');
}

export function updateHistoricalData(newHistoricalData: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, newHistoricalData, 'historicalData');
}

// Legacy function - kept for backward compatibility
export function updateHistoricalDataSingle(monthKey: string, data: any) {
  const newHistoricalData = { ...state.rawData.historicalData, [monthKey]: data };
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, newHistoricalData, 'historicalData');
}

// Updated function to handle month data updates that can create new entries
export function handleMonthDataUpdate(monthKey: string, monthData: any) {
  const updatedHistoricalData = {
    ...state.rawData.historicalData,
    [monthKey]: {
      ...(state.rawData.historicalData[monthKey] || {}), // KORRIGERING: Hanterar fallet där månaden är 'undefined'
      ...monthData
    }
  };
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, updatedHistoricalData, 'historicalData');
}

// Force a full recalculation
export function forceRecalculation() {
  runCalculationsAndUpdateState();
}

// Helper functions to replace setter functions in the original component
export function setAndreasSalary(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'andreasSalary');
}

export function setAndreasförsäkringskassan(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'andreasförsäkringskassan');
}

export function setAndreasbarnbidrag(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'andreasbarnbidrag');
}

export function setSusannaSalary(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'susannaSalary');
}

export function setSusannaförsäkringskassan(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'susannaförsäkringskassan');
}

export function setSusannabarnbidrag(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'susannabarnbidrag');
}

export function setCostGroups(value: any[]) {
  handleManualValueChange(StorageKey.COST_GROUPS, value, 'costGroups');
}

export function setSavingsGroups(value: any[]) {
  handleManualValueChange(StorageKey.SAVINGS_GROUPS, value, 'savingsGroups');
}

export function setDailyTransfer(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'dailyTransfer');
}

export function setWeekendTransfer(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'weekendTransfer');
}

export function setCustomHolidays(value: any[]) {
  handleManualValueChange(StorageKey.CUSTOM_HOLIDAYS, value, 'customHolidays');
}

export function setAndreasPersonalCosts(value: any[]) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'andreasPersonalCosts');
}

export function setAndreasPersonalSavings(value: any[]) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'andreasPersonalSavings');
}

export function setSusannaPersonalCosts(value: any[]) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'susannaPersonalCosts');
}

export function setSusannaPersonalSavings(value: any[]) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'susannaPersonalSavings');
}

export function setAccounts(value: string[]) {
  handleManualValueChange(StorageKey.ACCOUNTS, value, 'accounts');
}

export function setHistoricalData(value: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'historicalData');
}

export function setResults(value: any) {
  state.calculated.results = value;
  saveStateToStorage();
  triggerUIRefresh();
}

export function setSelectedBudgetMonth(value: string) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'selectedBudgetMonth');
}

export function setSelectedHistoricalMonth(value: string) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'selectedHistoricalMonth');
}

export function setAccountBalances(value: any) {
  handleManualValueChange(StorageKey.ACCOUNT_BALANCES, value, 'accountBalances');
}

export function setAccountBalancesSet(value: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'accountBalancesSet');
}

export function setAccountEstimatedFinalBalances(value: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'accountEstimatedFinalBalances');
}

export function setAccountEstimatedFinalBalancesSet(value: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'accountEstimatedFinalBalancesSet');
}

export function setAccountEstimatedStartBalances(value: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'accountEstimatedStartBalances');
}

export function setAccountStartBalancesSet(value: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'accountStartBalancesSet');
}

export function setAccountEndBalancesSet(value: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'accountEndBalancesSet');
}

export function setMonthFinalBalances(value: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'monthFinalBalances');
}

// Get specific data from state
export function getAccountBalances() {
  return state.rawData.accountBalances;
}

export function getCostGroups() {
  return state.rawData.costGroups;
}

export function getSavingsGroups() {
  return state.rawData.savingsGroups;
}

export function getHistoricalData() {
  return state.rawData.historicalData;
}

export function getSelectedBudgetMonth() {
  return state.rawData.selectedBudgetMonth;
}

export function getResults() {
  return state.calculated.results;
}