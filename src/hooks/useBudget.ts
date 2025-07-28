import { useEffect, useState } from 'react';
import { 
  getCurrentState, 
  initializeApp
} from '../orchestrator/budgetOrchestrator';
import { isAppLoading } from '../state/budgetState';

export const useBudget = () => {
  console.log('🚀 [HOOK] useBudget hook is running - MINIMAL VERSION!');
  
  // Use a simple state approach without any subscriptions for now
  const [initialized, setInitialized] = useState(false);
  
  // Initialize app once only
  useEffect(() => {
    if (!initialized) {
      console.log(`🔄 [HOOK] Initializing app ONCE...`);
      try {
        initializeApp();
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    }
  }, [initialized]);

  // Get current state (this might be the issue, but let's test)
  const currentState = getCurrentState();
  
  console.log(`🔄 [HOOK] useBudget minimal render - isLoading: ${isAppLoading()}`);
  
  return {
    isLoading: isAppLoading(),
    budgetState: currentState.budgetState,
    calculated: currentState.calculated
  };
};