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
    
    // Create a stable callback reference that forces re-render
    const updateCallback = () => {
      forceUpdate();
    };
    
    // Subscribe to state updates
    subscribeToStateChanges(updateCallback);
    
    // Unsubscribe when component unmounts
    return () => {
      unsubscribeFromStateChanges(updateCallback);
    };
  }, []);

  // Initialize app once
  useEffect(() => {
    initializeApp().catch(error => {
      console.error('[HOOK] Failed to initialize app:', error);
    });
  }, []);

  // Always get the latest state on each render
  const appState = getCurrentState();
  const { budgetState, calculated } = appState;
  
  
  
  return {
    isLoading: isAppLoading(),
    budgetState,
    calculated
  };
};