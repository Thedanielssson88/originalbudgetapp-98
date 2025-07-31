import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateTransaction } from '../orchestrator/budgetOrchestrator';
import { ImportedTransaction } from '@/types/transaction';

interface TransactionTypeSelectorProps {
  transaction: ImportedTransaction;
  onUpdateTransaction?: (transactionId: string, updates: Partial<ImportedTransaction>) => void;
}

export const TransactionTypeSelector: React.FC<TransactionTypeSelectorProps> = ({ transaction, onUpdateTransaction }) => {
  console.log(`🔄 [TransactionTypeSelector] Rendering with transaction ${transaction.id}, type: ${transaction.type}`);
  
  const handleTypeChange = (newType: string) => {
    console.log(`🔄 [TransactionTypeSelector] handleTypeChange called! Changing type from ${transaction.type} to ${newType} for transaction ${transaction.id}`);
    
    const updates = { 
      type: newType as ImportedTransaction['type'],
      // Reset related fields when changing type
      linkedTransactionId: undefined,
      savingsTargetId: undefined,
      correctedAmount: undefined
    };
    
    // Update orchestrator (for persistent storage)
    const monthKey = transaction.date.substring(0, 7);
    updateTransaction(transaction.id, updates, monthKey);
    
    // Update local state if callback provided (for immediate UI feedback)
    if (onUpdateTransaction) {
      onUpdateTransaction(transaction.id, updates);
    }
    
    console.log(`✅ [TransactionTypeSelector] updateTransaction called for ${transaction.id} with type ${newType}`);
  };

  return (
    <Select value={transaction.type} onValueChange={handleTypeChange}>
      <SelectTrigger className="w-full min-w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background border z-50">
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