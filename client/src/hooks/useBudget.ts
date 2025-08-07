import { useEffect, useReducer } from 'react';
import { 
  getCurrentState, 
  subscribeToStateChanges, 
  unsubscribeFromStateChanges,
  initializeApp
} from '../orchestrator/budgetOrchestrator';
import { isAppLoading } from '../state/budgetState';

export const useBudget = () => {
  console.log('🚀 [HOOK] useBudget hook is running!');
  
  // Force re-render when state updates
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    console.log(`🔄 [HOOK] useBudget subscribing to state changes...`);
    
    // Create a stable callback reference that forces re-render
    const updateCallback = () => {
      console.log(`🔄 [HOOK] State change detected - forcing re-render`);
      
      // Import mobile debug logger to log event reception
      import('../utils/mobileDebugLogger').then(({ addMobileDebugLog }) => {
        addMobileDebugLog('🔔 [HOOK] Received APP_STATE_UPDATED event - forcing re-render');
      });
      
      // Use setTimeout to ensure the state update is processed in the next tick
      setTimeout(() => forceUpdate(), 0);
    };
    
    // Subscribe to state updates
    subscribeToStateChanges(updateCallback);
    
    // Unsubscribe when component unmounts
    return () => {
      console.log(`🔄 [HOOK] useBudget unsubscribing from state changes`);
      unsubscribeFromStateChanges(updateCallback);
    };
  }, []);

  // Initialize app once
  useEffect(() => {
    console.log(`🔄 [HOOK] Initializing app...`);
    initializeApp().catch(error => {
      console.error('[HOOK] Failed to initialize app:', error);
    });
  }, []);

  // Always get the latest state on each render
  const appState = getCurrentState();
  const { budgetState, calculated } = appState;
  
  console.log(`🔄 [HOOK] useBudget render - isLoading: ${isAppLoading()}, selectedMonthKey: ${budgetState.selectedMonthKey}`);
  
  // Import mobile debug logger to make sure we see this in logs
  import('../utils/mobileDebugLogger').then(({ addMobileDebugLog }) => {
    addMobileDebugLog(`🔄 [HOOK] useBudget render - allTransactions: ${budgetState.allTransactions?.length || 0}`);
  });
  
  // DEBUG: Check if allTransactions has savingsTargetId
  if (budgetState.allTransactions) {
    const lonTransactionsWithSavings = budgetState.allTransactions.filter(t => 
      t.description === 'LÖN' && t.savingsTargetId
    );
    console.log(`🔍 [HOOK] LÖN transactions with savingsTargetId: ${lonTransactionsWithSavings.length}/${budgetState.allTransactions.length}`);
    
    // Also add to mobile debug logger  
    import('../utils/mobileDebugLogger').then(({ addMobileDebugLog }) => {
      addMobileDebugLog(`🔍 [HOOK] LÖN with savingsTargetId: ${lonTransactionsWithSavings.length}/${budgetState.allTransactions.length}`);
    });
    
    lonTransactionsWithSavings.forEach((tx, i) => {
      if (i < 3) {
        console.log(`🔍 [HOOK] LÖN ${i}: id=${tx.id}, savingsTargetId=${tx.savingsTargetId}`);
        
        // Also add to mobile debug logger
        import('../utils/mobileDebugLogger').then(({ addMobileDebugLog }) => {
          addMobileDebugLog(`🔍 [HOOK] LÖN ${i}: id=${tx.id}, savingsTargetId=${tx.savingsTargetId}`);
        });
      }
    });
  }
  
  return {
    isLoading: isAppLoading(),
    budgetState,
    calculated
  };
};