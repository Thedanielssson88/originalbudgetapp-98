import { useEffect, useReducer } from 'react';
import { 
  getCurrentState, 
  subscribeToStateChanges, 
  unsubscribeFromStateChanges,
  initializeApp
} from '../orchestrator/budgetOrchestrator';

export const useBudget = () => {
  // Force re-render when state updates
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    // Subscribe to state updates
    subscribeToStateChanges(forceUpdate);
    // Unsubscribe when component unmounts
    return () => unsubscribeFromStateChanges(forceUpdate);
  }, []);

  // Initialize app once
  useEffect(() => {
    initializeApp();
  }, []);

  // Always get the latest state on each render
  const appState = getCurrentState();
  const { budgetState, calculated } = appState;
  
  return {
    budgetState,
    calculated
  };
};