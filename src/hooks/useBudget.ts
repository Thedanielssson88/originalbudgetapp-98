import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  getCurrentState, 
  subscribeToStateChanges, 
  unsubscribeFromStateChanges,
  initializeApp
} from '../orchestrator/budgetOrchestrator';
import { isAppLoading } from '../state/budgetState';

export const useBudget = () => {
  console.log('🚀 [HOOK] useBudget hook is running!');
  
  // Use useState to hold the current state
  const [currentState, setCurrentState] = useState(() => getCurrentState());
  const isInitializedRef = useRef(false);
  
  // Create a stable callback that won't change on every render
  const updateStateCallback = useCallback(() => {
    console.log(`🔄 [HOOK] State change detected - updating state`);
    // Get fresh state and update
    const newState = getCurrentState();
    setCurrentState(newState);
  }, []);

  useEffect(() => {
    console.log(`🔄 [HOOK] Setting up state subscription...`);
    
    // Subscribe to state updates
    subscribeToStateChanges(updateStateCallback);
    
    // Cleanup on unmount
    return () => {
      console.log(`🔄 [HOOK] Cleaning up state subscription`);
      unsubscribeFromStateChanges(updateStateCallback);
    };
  }, [updateStateCallback]);

  // Initialize app once
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log(`🔄 [HOOK] Initializing app...`);
      isInitializedRef.current = true;
      initializeApp();
    }
  }, []);
  
  console.log(`🔄 [HOOK] useBudget render - isLoading: ${isAppLoading()}, selectedMonthKey: ${currentState.budgetState.selectedMonthKey}`);
  
  return {
    isLoading: isAppLoading(),
    budgetState: currentState.budgetState,
    calculated: currentState.calculated
  };
};