// Hook to access the API store and subscribe to changes

import { useEffect, useReducer } from 'react';
import { apiStore, subscribeToStore, unsubscribeFromStore } from '../store/apiStore';

export function useApiStore() {
  // Force re-render when store updates
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  
  useEffect(() => {
    // Subscribe to store changes
    const updateCallback = () => {
      forceUpdate();
    };
    
    subscribeToStore();
    
    // Unsubscribe on cleanup
    return () => {
      unsubscribeFromStore();
    };
  }, []);
  
  // Return the store - components will always get the latest state
  return apiStore;
}

// Hook to initialize the store on app startup
export function useInitializeApiStore() {
  useEffect(() => {
    console.log('🔄 [HOOK] useInitializeApiStore starting initialization...');
    
    // Initialize the store when the app starts
    apiStore.initialize()
      .then(() => {
        console.log('✅ [HOOK] API store initialized successfully');
        // CRITICAL: Also initialize the budget orchestrator
        import('../orchestrator/budgetOrchestrator').then(({ initializeApp, resetInitialization, forceReloadTransactions, loadMonthlyAccountBalancesFromDatabase }) => {
          console.log('🔄 [HOOK] Resetting initialization and calling initializeApp...');
          resetInitialization(); // Force reset before initialization
          initializeApp()
            .then(() => {
              console.log('✅ [HOOK] InitializeApp completed, now loading monthly account balances from database...');
              return loadMonthlyAccountBalancesFromDatabase();
            })
            .then(() => {
              console.log('✅ [HOOK] Monthly account balances loaded');
              // Removed duplicate forceReloadTransactions - it's already called in initializeApp
            })
            .catch(error => {
              console.error('[HOOK] Failed to initialize app, load balances, or load transactions:', error);
            });
        });
      })
      .catch(error => {
        console.error('[HOOK] Failed to initialize API store:', error);
      });
  }, []);
}