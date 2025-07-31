import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateTransaction } from '../orchestrator/budgetOrchestrator';
import { ImportedTransaction } from '@/types/transaction';

interface TransactionTypeSelectorProps {
  transaction: ImportedTransaction;
}

export const TransactionTypeSelector: React.FC<TransactionTypeSelectorProps> = ({ transaction }) => {
  const [localType, setLocalType] = useState(transaction.type);

  // Update local state when transaction prop changes
  useEffect(() => {
    setLocalType(transaction.type);
  }, [transaction.type, transaction.id]);

  const handleTypeChange = (newType: string) => {
    console.log(`🔄 [TransactionTypeSelector] Changing type from ${localType} to ${newType} for transaction ${transaction.id}`);
    
    // Update local state immediately for responsive UI
    setLocalType(newType as ImportedTransaction['type']);
    
    // Derive monthKey from transaction's date (e.g. "2025-07-30" -> "2025-07")
    const monthKey = transaction.date.substring(0, 7);
    console.log(`🔄 [TransactionTypeSelector] Using monthKey: ${monthKey}`);
    
    // Update the backend state
    updateTransaction(transaction.id, { 
      type: newType as ImportedTransaction['type'],
      // Reset related fields when changing type
      linkedTransactionId: undefined,
      savingsTargetId: undefined,
      correctedAmount: undefined
    }, monthKey);
    
    console.log(`✅ [TransactionTypeSelector] updateTransaction called for ${transaction.id}`);
  };

  console.log(`🔍 [TransactionTypeSelector] Rendering with localType: ${localType}, transaction.type: ${transaction.type}, id: ${transaction.id}`);

  return (
    <Select value={localType} onValueChange={handleTypeChange}>
      <SelectTrigger 
        className="w-full min-w-[180px]"
        onClick={() => console.log('🔍 [TransactionTypeSelector] SelectTrigger clicked')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background border z-[60] relative">
        {transaction.amount < 0 ? (
          // Alternativ för negativa transaktioner
          <>
            <SelectItem value="Transaction">Transaktion</SelectItem>
            <SelectItem value="InternalTransfer">Intern Överföring</SelectItem>
          </>
        ) : (
          // Alternativ för positiva transaktioner
          <>
            <SelectItem value="Transaction">Transaktion</SelectItem>
            <SelectItem value="InternalTransfer">Intern Överföring</SelectItem>
            <SelectItem value="Savings">Sparande</SelectItem>
            <SelectItem value="CostCoverage">Täck en kostnad</SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
};