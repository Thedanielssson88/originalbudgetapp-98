import { useState } from 'react';

export const useBudget = () => {
  console.log('🚀 [HOOK] useBudget hook is running - STATIC VERSION!');
  
  // Return completely static data to test if the component can render
  const [staticState] = useState(() => ({
    budgetState: {
      selectedMonthKey: '2025-07',
      selectedHistoricalMonth: '',
      historicalData: {
        '2025-07': {
          andreasSalary: 45000,
          andreasförsäkringskassan: 0,
          andreasbarnbidrag: 0,
          susannaSalary: 40000,
          susannaförsäkringskassan: 5000,
          susannabarnbidrag: 0,
          costGroups: [],
          savingsGroups: [],
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
          accountEndBalancesSet: {},
          userName1: 'Andreas',
          userName2: 'Susanna',
          transferChecks: {},
          andreasShareChecked: false,
          susannaShareChecked: false,
          monthFinalBalances: {},
          accountEndingBalances: {},
          createdAt: new Date().toISOString()
        }
      },
      accounts: [
        { id: '1', name: 'Löpande', startBalance: 0 },
        { id: '2', name: 'Sparkonto', startBalance: 0 },
        { id: '3', name: 'Buffert', startBalance: 0 }
      ],
      chartSettings: {
        selectedAccountsForChart: [],
        showIndividualCostsOutsideBudget: false,
        showSavingsSeparately: false,
        useCustomTimeRange: false,
        chartStartMonth: '',
        chartEndMonth: ''
      }
    },
    calculated: {
      results: {
        totalSalary: 90000,
        totalDailyBudget: 0,
        remainingDailyBudget: 0,
        holidayDaysBudget: 0,
        balanceLeft: 90000,
        susannaShare: 45000,
        andreasShare: 45000,
        susannaPercentage: 50,
        andreasPercentage: 50,
        daysUntil25th: 28,
        totalMonthlyExpenses: 0,
        weekdayCount: 20,
        fridayCount: 4,
        remainingWeekdayCount: 20,
        remainingFridayCount: 4,
        holidaysUntil25th: [],
        nextTenHolidays: [],
        holidayDays: []
      },
      fullPrognosis: {
        accountProgression: {},
        monthlyBreakdowns: {},
        projectedBalances: {}
      }
    }
  }));
  
  console.log('🔄 [HOOK] useBudget static render - returning static data');
  
  return {
    isLoading: false,
    budgetState: staticState.budgetState,
    calculated: staticState.calculated
  };
};