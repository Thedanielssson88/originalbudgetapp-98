import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateTransaction, getCurrentState } from '../orchestrator/budgetOrchestrator';
import { ImportedTransaction } from '@/types/transaction';

interface TransactionTypeSelectorProps {
  transaction: ImportedTransaction;
  onRefresh?: () => void; // Add optional refresh callback
}

export const TransactionTypeSelector: React.FC<TransactionTypeSelectorProps> = ({ transaction, onRefresh }) => {
  const handleTypeChange = (newType: string) => {
    console.log(`🔄 [TransactionTypeSelector] Changing type from ${transaction.type} to ${newType} for transaction ${transaction.id}`);
    
    // Derive monthKey from transaction's date (e.g. "2025-07-30" -> "2025-07")
    const monthKey = transaction.date.substring(0, 7);
    
    // If this transaction is linked to another (cost coverage), we need to unlink both
    if (transaction.linkedTransactionId) {
      console.log(`🔗 [TransactionTypeSelector] Breaking bidirectional link with transaction ${transaction.linkedTransactionId}`);
      
      // First, find and reset the linked transaction
      const state = getCurrentState();
      console.log(`🔍 [TransactionTypeSelector] Current state:`, state);
      let linkedTransaction: any = null;
      let linkedMonthKey = '';
      
      // Search for the linked transaction across all months
      console.log(`🔍 [TransactionTypeSelector] Searching for linked transaction ${transaction.linkedTransactionId} across all months`);
      const allTransactions = state.budgetState.allTransactions || [];
      console.log(`🔍 [TransactionTypeSelector] Checking ${allTransactions.length} transactions`);
      linkedTransaction = allTransactions.find((t: any) => t.id === transaction.linkedTransactionId);
      if (linkedTransaction) {
        linkedMonthKey = linkedTransaction.date.substring(0, 7); // Extract YYYY-MM from date
        console.log(`✅ [TransactionTypeSelector] Found linked transaction:`, linkedTransaction);
      }
      
      if (linkedTransaction && linkedMonthKey) {
        console.log(`🔗 [TransactionTypeSelector] Resetting linked transaction fields for ${transaction.linkedTransactionId} in month ${linkedMonthKey}`);
        // Reset the linked transaction's fields
        updateTransaction(transaction.linkedTransactionId, {
          linkedTransactionId: undefined,
          correctedAmount: undefined,
          type: 'Transaction', // Ensure it goes back to Transaction type
          isManuallyChanged: true
        }, linkedMonthKey);
        console.log(`✅ [TransactionTypeSelector] Called updateTransaction for linked transaction ${transaction.linkedTransactionId}`);
      } else {
        console.log(`❌ [TransactionTypeSelector] Could not find linked transaction ${transaction.linkedTransactionId}`);
      }
    }
    
    // Then update the current transaction
    // Prepare updates based on the new type
    const updates: any = {
      type: newType as ImportedTransaction['type'],
      // Mark as manually changed to preserve user's choice on re-import
      isManuallyChanged: true
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
    
    updateTransaction(transaction.id, updates, monthKey);
    
    console.log(`✅ [TransactionTypeSelector] updateTransaction called for ${transaction.id}`);
    
    // Trigger refresh similar to handleTransactionUpdate in TransactionImportEnhanced
    if (onRefresh) {
      setTimeout(() => {
        onRefresh();
      }, 100);
    }
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