import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { ImportedTransaction } from '@/types/transaction';

interface TransactionTypeSelectorProps {
  transaction: ImportedTransaction;
  onRefresh?: () => void; // Add optional refresh callback
  onTypeChange?: (newType: string) => void; // Add callback for immediate local update
}

export const TransactionTypeSelector: React.FC<TransactionTypeSelectorProps> = ({ transaction, onRefresh, onTypeChange }) => {
  const updateTransactionMutation = useUpdateTransaction();

  const handleTypeChange = (newType: string) => {
    // Notify parent immediately for local update
    if (onTypeChange) {
      onTypeChange(newType);
    }
    console.log(`🔄 [TransactionTypeSelector] Changing type from ${transaction.type} to ${newType} for transaction ${transaction.id}`);
    
    // Prepare updates based on the new type
    const updates: any = {
      type: newType as ImportedTransaction['type'],
      // Mark as manually changed to preserve user's choice on re-import (string format for database)
      isManuallyChanged: 'true'
    };
    
    // Only reset fields that are not relevant to the new type
    if (newType !== 'InternalTransfer' && newType !== 'CostCoverage' && newType !== 'ExpenseClaim') {
      updates.linkedTransactionId = undefined;
    }
    if (newType !== 'CostCoverage' && newType !== 'ExpenseClaim') {
      updates.correctedAmount = undefined;
    }
    // Keep savingsTargetId when changing TO Savings type, reset when changing away
    if (newType !== 'Savings' && newType !== 'Transaction' && newType !== 'Income') {
      updates.savingsTargetId = undefined;
    }

    // DATABASE UPDATE: Use SQL-based mutation with optimistic updates
    updateTransactionMutation.mutate({ 
      id: transaction.id, 
      data: updates 
    });
    
    console.log(`✅ [TransactionTypeSelector] SQL update called for ${transaction.id} with:`, updates);
  };

  return (
    <Select key={`${transaction.id}-${transaction.type}`} value={transaction.type} onValueChange={handleTypeChange}>
      <SelectTrigger className="w-full min-w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background border z-50">
        {transaction.amount < 0 ? (
          // Alternativ för negativa transaktioner
          <>
            <SelectItem value="Transaction">Transaktion</SelectItem>
            <SelectItem value="InternalTransfer">Intern Överföring</SelectItem>
            <SelectItem value="ExpenseClaim">Utlägg</SelectItem>
          </>
        ) : (
          // Alternativ för positiva transaktioner
          <>
            <SelectItem value="Income">Inkomst</SelectItem>
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