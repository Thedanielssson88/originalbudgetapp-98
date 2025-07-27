// Dirigenten som binder samman allt.

import { state, initializeStateFromStorage, saveStateToStorage } from './state/mainState';
import { StorageKey } from './services/storageService';
import { calculateFullPrognosis, calculateBudgetResults, calculateAccountProgression, calculateMonthlyBreakdowns, calculateProjectedBalances } from './services/calculationService';
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

export function getCurrentState() {
  return state;
}

// Subscribe to state changes
export function subscribeToStateChanges(callback: () => void): void {
  eventEmitter.addEventListener(APP_STATE_UPDATED, callback);
}

// Unsubscribe from state changes
export function unsubscribeFromStateChanges(callback: () => void): void {
  eventEmitter.removeEventListener(APP_STATE_UPDATED, callback);
}

export function runCalculationsAndUpdateState(): void {
  // 1. Kör den rena beräkningsfunktionen
  const { estimatedStartBalancesByMonth, estimatedFinalBalancesByMonth } = calculateFullPrognosis(state.rawData);
  
  // 2. Beräkna endast budget results separat
  const results = calculateBudgetResults(state.rawData);
  
  // 3. Skapa en djup kopia av nuvarande historik för att säkert kunna modifiera den
  const newHistoricalData = JSON.parse(JSON.stringify(state.rawData.historicalData));

  // 4. Loopa igenom resultaten och uppdatera ENDAST de estimerade fälten
  Object.keys(estimatedStartBalancesByMonth).forEach(monthKey => {
    if (newHistoricalData[monthKey]) {
      newHistoricalData[monthKey].accountEstimatedStartBalances = estimatedStartBalancesByMonth[monthKey];
      newHistoricalData[monthKey].accountEstimatedFinalBalances = estimatedFinalBalancesByMonth[monthKey];
    }
  });

  // 5. Uppdatera state med den nya historiken och resultaten
  state.rawData.historicalData = newHistoricalData;
  state.calculated = {
    results: results,
    fullPrognosis: {
      accountProgression: calculateAccountProgression(state.rawData),
      monthlyBreakdowns: calculateMonthlyBreakdowns(state.rawData),
      projectedBalances: calculateProjectedBalances(state.rawData)
    }
  };

  // 6. Spara state till localStorage
  saveStateToStorage();

  // 7. Notifiera alla prenumeranter att statet har uppdaterats
  triggerUIRefresh();
}

export function handleManualValueChange(key: StorageKey, value: any, field: string, shouldSave: boolean = true): void {
  try {
    if (field && field.includes('.')) {
      const parts = field.split('.');
      let currentLevel: any = state.rawData;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!currentLevel[parts[i]]) {
          currentLevel[parts[i]] = {};
        }
        currentLevel = currentLevel[parts[i]];
      }
      
      currentLevel[parts[parts.length - 1]] = value;
    } else {
      (state.rawData as any)[field] = value;
    }

    if (shouldSave) {
      runCalculationsAndUpdateState();
    }
  } catch (error) {
    console.error(`[AppOrchestrator] Fel vid hantering av manuell värdeändring:`, error);
  }
}

export function updateCostGroups(value: any[]) {
  handleManualValueChange(StorageKey.COST_GROUPS, value, 'costGroups');
}

export function updateSavingsGroups(value: any[]) {
  handleManualValueChange(StorageKey.SAVINGS_GROUPS, value, 'savingsGroups');
}

export function updateAccountBalance(accountName: string, balance: number) {
  const accountBalances = { ...state.rawData.accountBalances };
  accountBalances[accountName] = balance;
  handleManualValueChange(StorageKey.ACCOUNT_BALANCES, accountBalances, 'accountBalances');
}

export function updateSelectedBudgetMonth(monthKey: string) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, monthKey, 'selectedBudgetMonth');
}

export function updateHistoricalData(historicalData: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, historicalData, 'historicalData');
}

export function updateHistoricalDataSingle(key: string, data: any) {
  const newHistoricalData = { ...state.rawData.historicalData };
  newHistoricalData[key] = data;
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, newHistoricalData, 'historicalData');
}

export function forceRecalculation() {
  runCalculationsAndUpdateState();
}

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
  // Update the main state
  handleManualValueChange(StorageKey.COST_GROUPS, value, 'costGroups', true);
  
  // Also update the currently selected month's historical data
  const currentSelectedMonth = state.rawData.selectedBudgetMonth;
  if (currentSelectedMonth && state.rawData.historicalData[currentSelectedMonth]) {
    const updatedHistoricalData = {
      ...state.rawData.historicalData,
      [currentSelectedMonth]: {
        ...state.rawData.historicalData[currentSelectedMonth],
        costGroups: value
      }
    };
    handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, updatedHistoricalData, 'historicalData', false);
  } else {
    // If no selected month, just trigger calculation
    runCalculationsAndUpdateState();
  }
}

export function setSavingsGroups(value: any[]) {
  // Update the main state
  handleManualValueChange(StorageKey.SAVINGS_GROUPS, value, 'savingsGroups', true);
  
  // Also update the currently selected month's historical data
  const currentSelectedMonth = state.rawData.selectedBudgetMonth;
  if (currentSelectedMonth && state.rawData.historicalData[currentSelectedMonth]) {
    const updatedHistoricalData = {
      ...state.rawData.historicalData,
      [currentSelectedMonth]: {
        ...state.rawData.historicalData[currentSelectedMonth],
        savingsGroups: value
      }
    };
    handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, updatedHistoricalData, 'historicalData', false);
  } else {
    // If no selected month, just trigger calculation
    runCalculationsAndUpdateState();
  }
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

export function setAndreasPersonalCosts(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'andreasPersonalCosts');
}

export function setAndreasPersonalSavings(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'andreasPersonalSavings');
}

export function setSusannaPersonalCosts(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'susannaPersonalCosts');
}

export function setSusannaPersonalSavings(value: number) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'susannaPersonalSavings');
}

export function setAccounts(value: any[]) {
  handleManualValueChange(StorageKey.ACCOUNTS, value, 'accounts');
}

export function setHistoricalData(value: any) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'historicalData');
}

export function setResults(value: any) {
  state.calculated.results = value;
  triggerUIRefresh();
}

export function setSelectedBudgetMonth(value: string) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'selectedBudgetMonth');
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

export function setSelectedHistoricalMonth(value: string) {
  handleManualValueChange(StorageKey.BUDGET_CALCULATOR_DATA, value, 'selectedHistoricalMonth');
}

console.log('✅ App Orchestrator loaded successfully');