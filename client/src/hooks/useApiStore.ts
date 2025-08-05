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
    // Initialize the store when the app starts
    apiStore.initialize().catch(error => {
      console.error('Failed to initialize API store:', error);
    });
  }, []);
}