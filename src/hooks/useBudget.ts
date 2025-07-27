import { useEffect, useReducer } from 'react';
import { 
  getCurrentState, 
  subscribeToStateChanges, 
  unsubscribeFromStateChanges,
  initializeApp
} from '../orchestrator/budgetOrchestrator';
import { isAppLoading } from '../state/budgetState';

export const useBudget = () => {
  // Force re-render when state updates
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    console.log(`🔄 [HOOK] useBudget subscribing to state changes...`);
    // Subscribe to state updates
    subscribeToStateChanges(() => {
      console.log(`🔄 [HOOK] State change detected - forcing re-render`);
      forceUpdate();
    });
    // Unsubscribe when component unmounts
    return () => {
      console.log(`🔄 [HOOK] useBudget unsubscribing from state changes`);
      unsubscribeFromStateChanges(forceUpdate);
    };
  }, []);

  // Initialize app once
  useEffect(() => {
    console.log(`🔄 [HOOK] Initializing app...`);
    initializeApp();
  }, []);

  // Always get the latest state on each render
  const appState = getCurrentState();
  const { budgetState, calculated } = appState;
  
  console.log(`🔄 [HOOK] useBudget render - isLoading: ${isAppLoading()}, selectedMonthKey: ${budgetState.selectedMonthKey}`);
  
  return {
    isLoading: isAppLoading(),
    budgetState,
    calculated
  };
};