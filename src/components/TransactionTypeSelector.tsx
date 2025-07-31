import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateTransaction } from '../orchestrator/budgetOrchestrator';
import { ImportedTransaction } from '@/types/transaction';

console.log('🚀 TransactionTypeSelector FILE LOADED!');

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
    <div className="w-full min-w-[180px]">
      <select 
        value={transaction.type} 
        onChange={(e) => handleTypeChange(e.target.value)}
        className="w-full p-2 border border-input bg-background rounded-md text-sm"
      >
        {transaction.amount < 0 ? (
          // Alternativ för negativa transaktioner
          <>
            <option value="Transaction">Transaktion</option>
            <option value="InternalTransfer">Intern Överföring</option>
          </>
        ) : (
          // Alternativ för positiva transaktioner
          <>
            <option value="Transaction">Transaktion</option>
            <option value="InternalTransfer">Intern Överföring</option>
            <option value="Savings">Sparande</option>
            <option value="CostCoverage">Täck en kostnad</option>
          </>
        )}
      </select>
    </div>
  );
};