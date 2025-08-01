import { useState, useCallback } from 'react';

// Global state to persist expansion across re-renders
const globalExpansionState = new Set<string>();

export const useTransactionExpansion = (transactionId: string) => {
  const [isExpanded, setIsExpandedState] = useState(() => 
    globalExpansionState.has(transactionId)
  );

  const setIsExpanded = useCallback((expanded: boolean) => {
    if (expanded) {
      globalExpansionState.add(transactionId);
    } else {
      globalExpansionState.delete(transactionId);
    }
    setIsExpandedState(expanded);
  }, [transactionId]);

  const toggleExpansion = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded, setIsExpanded]);

  return {
    isExpanded,
    setIsExpanded,
    toggleExpansion
  };
};