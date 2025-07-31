import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateTransaction } from '../orchestrator/budgetOrchestrator';
import { ImportedTransaction } from '@/types/transaction';

interface TransactionTypeSelectorProps {
  transaction: ImportedTransaction;
}

export const TransactionTypeSelector: React.FC<TransactionTypeSelectorProps> = ({ transaction }) => {
  const handleTypeChange = (newType: string) => {
    console.log(`🔄 [TransactionTypeSelector] Changing type from ${transaction.type} to ${newType} for transaction ${transaction.id}`);
    console.log(`🔄 [TransactionTypeSelector] Transaction before update:`, JSON.stringify(transaction, null, 2));
    
    // Derive monthKey from transaction's date (e.g. "2025-07-30" -> "2025-07")
    const monthKey = transaction.date.substring(0, 7);
    console.log(`🔄 [TransactionTypeSelector] Using monthKey: ${monthKey}`);
    
    // Anropa den nya generella funktionen för att bara uppdatera typen
    updateTransaction(transaction.id, { 
      type: newType as ImportedTransaction['type'],
      // Reset related fields when changing type
      linkedTransactionId: undefined,
      savingsTargetId: undefined,
      correctedAmount: undefined
    }, monthKey);
    
    console.log(`✅ [TransactionTypeSelector] updateTransaction called for ${transaction.id} with type ${newType}`);
    
    // Add a small delay to check if the transaction was actually updated
    setTimeout(() => {
      console.log(`🔍 [TransactionTypeSelector] Transaction after update (delayed check):`, transaction.type);
    }, 100);
  };

  return (
    <Select key={transaction.id} value={transaction.type} onValueChange={handleTypeChange}>
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