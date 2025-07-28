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
    
    // Add a throttle mechanism to prevent infinite re-renders
    let isUpdating = false;
    
    // Create a stable callback reference
    const updateCallback = () => {
      if (isUpdating) {
        console.log(`🔄 [HOOK] Update already in progress - skipping`);
        return;
      }
      
      isUpdating = true;
      console.log(`🔄 [HOOK] State change detected - forcing re-render`);
      
      // Use setTimeout to break the synchronous update cycle
      setTimeout(() => {
        forceUpdate();
        isUpdating = false;
      }, 0);
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