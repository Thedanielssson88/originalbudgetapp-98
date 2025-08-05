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
    
    subscribeToStore(updateCallback);
    
    // Unsubscribe on cleanup
    return () => {
      unsubscribeFromStore(updateCallback);
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
        import('../orchestrator/budgetOrchestrator').then(({ initializeApp, resetInitialization }) => {
          console.log('🔄 [HOOK] Resetting initialization and calling initializeApp...');
          resetInitialization(); // Force reset before initialization
          initializeApp().catch(error => {
            console.error('[HOOK] Failed to initialize app:', error);
          });
        });
      })
      .catch(error => {
        console.error('[HOOK] Failed to initialize API store:', error);
      });
  }, []);
}