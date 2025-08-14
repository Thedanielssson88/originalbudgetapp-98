import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { ImportedTransaction } from '@/types/transaction';
import { getCurrentState, getAccountNameById } from '../orchestrator/budgetOrchestrator';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { addMobileDebugLog } from '@/utils/mobileDebugLogger';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';

interface ExpenseClaimDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ImportedTransaction | null;
  onRefresh?: () => void;
}

export const ExpenseClaimDialog: React.FC<ExpenseClaimDialogProps> = ({
  isOpen,
  onClose,
  transaction,
  onRefresh
}) => {
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState<boolean>(false);
  const updateTransactionMutation = useUpdateTransaction();

  const { budgetState } = getCurrentState();

  // Find potential positive payments on the same account that could match this expense claim
  const potentialPayments = useMemo(() => {
    if (!transaction) return [];

    // Use centralized transaction storage
    const allTransactions = budgetState.allTransactions || [];

    // Find POSITIVE transactions on SAME account that are not linked
    return allTransactions
      .filter(t =>
        t.id !== transaction.id &&                  // Not the same transaction
        t.accountId === transaction.accountId &&    // Must be on SAME account
        t.amount > 0 &&                             // Must be a positive transaction
        !t.linkedTransactionId && !t.linkedCostId   // Not already linked to another transaction
        // Removed type restriction - show ALL positive unlinked transactions
        // Removed date restriction - show transactions from any date for better matching
      )
      .sort((a, b) => {
        // Sort by amount similarity first (exact matches first), then by date proximity
        const amountDiffA = Math.abs(Math.abs(a.amount) - Math.abs(transaction.amount));
        const amountDiffB = Math.abs(Math.abs(b.amount) - Math.abs(transaction.amount));
        
        if (amountDiffA !== amountDiffB) {
          return amountDiffA - amountDiffB; // Smaller difference first
        }
        
        // If amounts are similar, sort by date (more recent first)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [transaction, budgetState.allTransactions]);

  const filteredPayments = useMemo(() => {
    if (!searchTerm) return potentialPayments;
    return potentialPayments.filter(payment =>
      payment.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [potentialPayments, searchTerm]);

  // Show only first 5 payments initially, unless user wants to see all or is searching
  const displayedPayments = searchTerm || showAll ? filteredPayments : filteredPayments.slice(0, 5);
  const hasMorePayments = filteredPayments.length > 5 && !searchTerm && !showAll;

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPayment('');
      setSearchTerm('');
      setShowAll(false);
    }
  }, [isOpen]);

  const handleCover = async () => {
    if (!transaction || !selectedPayment) return;

    addMobileDebugLog('====================================');
    addMobileDebugLog('🔗 [KOPPLA UTLÄGG START] Beginning expense claim calculation');
    addMobileDebugLog('====================================');
    addMobileDebugLog(`📋 [INPUT] Expense ID: ${transaction.id}`);
    addMobileDebugLog(`📋 [INPUT] Expense Description: ${transaction.description}`);
    addMobileDebugLog(`📋 [INPUT] Expense Amount (original): ${transaction.amount} öre`);
    addMobileDebugLog(`📋 [INPUT] Expense CorrectedAmount (existing): ${transaction.correctedAmount ?? 'null'} öre`);
    addMobileDebugLog(`📋 [INPUT] Expense Type: ${transaction.type}`);
    addMobileDebugLog(`📋 [INPUT] Selected Payment ID: ${selectedPayment}`);

    try {
      // Find the payment transaction
      const paymentTransaction = budgetState.allTransactions.find(t => t.id === selectedPayment);
      if (!paymentTransaction) {
        addMobileDebugLog('❌ [ERROR] Payment transaction not found');
        return;
      }
      
      addMobileDebugLog(`📋 [PAYMENT] Payment Description: ${paymentTransaction.description}`);
      addMobileDebugLog(`📋 [PAYMENT] Payment Amount (original): ${paymentTransaction.amount} öre`);
      addMobileDebugLog(`📋 [PAYMENT] Payment CorrectedAmount (existing): ${paymentTransaction.correctedAmount ?? 'null'} öre`);
      addMobileDebugLog(`📋 [PAYMENT] Payment Type: ${paymentTransaction.type}`);
      addMobileDebugLog(`📋 [PAYMENT] Payment LinkedTransactionId: ${paymentTransaction.linkedTransactionId ?? 'null'}`);
      addMobileDebugLog(`📋 [PAYMENT] Payment LinkedCostId: ${paymentTransaction.linkedCostId ?? 'null'}`);

      // Get account names for descriptions
      const expenseAccountName = getAccountNameById(transaction.accountId) || 'Unknown Account';
      const paymentAccountName = getAccountNameById(paymentTransaction.accountId) || 'Unknown Account';
      
      addMobileDebugLog(`📋 [ACCOUNTS] Expense Account: ${expenseAccountName}`);
      addMobileDebugLog(`📋 [ACCOUNTS] Payment Account: ${paymentAccountName}`);

      // Calculate corrected amount based on coverage
      addMobileDebugLog('====================================');
      addMobileDebugLog('🧮 [CALCULATION START]');
      addMobileDebugLog('====================================');
      
      const expenseAmount = Math.abs(transaction.amount); // e.g., 537 (absolute value)
      const coverageAmount = paymentTransaction.amount;    // e.g., 537 (positive amount)
      
      addMobileDebugLog(`🧮 [CALC] Step 1: expenseAmount = abs(${transaction.amount}) = ${expenseAmount} öre`);
      addMobileDebugLog(`🧮 [CALC] Step 2: coverageAmount = ${paymentTransaction.amount} öre`);
      
      // Calculate how much of the expense can be covered
      const amountToCover = Math.min(expenseAmount, coverageAmount);
      
      addMobileDebugLog(`🧮 [CALC] Step 3: amountToCover = min(${expenseAmount}, ${coverageAmount}) = ${amountToCover} öre`);
      
      // Calculate the corrected amounts
      const expenseCorrectedAmount = transaction.amount + amountToCover; // e.g., -537 + 537 = 0 (fully covered)
      const coverageCorrectedAmount = coverageAmount - amountToCover;    // e.g., 537 - 537 = 0 (fully used)
      
      addMobileDebugLog(`🧮 [CALC] Step 4: expenseCorrectedAmount = ${transaction.amount} + ${amountToCover} = ${expenseCorrectedAmount} öre`);
      addMobileDebugLog(`🧮 [CALC] Step 5: coverageCorrectedAmount = ${coverageAmount} - ${amountToCover} = ${coverageCorrectedAmount} öre`);
      addMobileDebugLog('====================================');

      // Link both transactions using API calls
      addMobileDebugLog('====================================');
      addMobileDebugLog('📤 [API PREPARATION]');
      addMobileDebugLog('====================================');
      
      const expenseUpdate = {
        id: transaction.id,
        data: {
          type: 'ExpenseClaim',
          linkedCostId: selectedPayment,  // Use linkedCostId for expense coverage
          correctedAmount: Math.round(expenseCorrectedAmount), // Ensure it's an integer
          userDescription: `Utlägg täcks av betalning från ${paymentAccountName}`,
          isManuallyChanged: 'true'
        }
      };
      
      addMobileDebugLog(`📤 [API] Expense Update ID: ${expenseUpdate.id}`);
      addMobileDebugLog(`📤 [API] Expense Update Type: ${expenseUpdate.data.type}`);
      addMobileDebugLog(`📤 [API] Expense Update LinkedCostId: ${expenseUpdate.data.linkedCostId}`);
      addMobileDebugLog(`📤 [API] Expense Update CorrectedAmount: ${expenseUpdate.data.correctedAmount} öre`);
      addMobileDebugLog(`📤 [API] Expense Update Description: ${expenseUpdate.data.userDescription}`);
      
      const paymentUpdate = {
        id: selectedPayment,
        data: {
          type: 'CostCoverage',
          linkedCostId: transaction.id,  // Use linkedCostId for expense coverage
          correctedAmount: Math.round(coverageCorrectedAmount), // Ensure it's an integer
          userDescription: `Täcker utlägg från ${expenseAccountName}`,
          isManuallyChanged: 'true'
        }
      };
      
      addMobileDebugLog(`📤 [API] Payment Update ID: ${paymentUpdate.id}`);
      addMobileDebugLog(`📤 [API] Payment Update Type: ${paymentUpdate.data.type}`);
      addMobileDebugLog(`📤 [API] Payment Update LinkedCostId: ${paymentUpdate.data.linkedCostId}`);
      addMobileDebugLog(`📤 [API] Payment Update CorrectedAmount: ${paymentUpdate.data.correctedAmount} öre`);
      addMobileDebugLog(`📤 [API] Payment Update Description: ${paymentUpdate.data.userDescription}`);
      
      addMobileDebugLog('====================================');
      addMobileDebugLog('🚀 [API CALLS EXECUTING]');
      addMobileDebugLog('====================================');
      
      const results = await Promise.all([
        // Update expense claim transaction
        updateTransactionMutation.mutateAsync(expenseUpdate),
        // Update payment/coverage transaction  
        updateTransactionMutation.mutateAsync(paymentUpdate)
      ]);

      addMobileDebugLog('====================================');
      addMobileDebugLog('✅ [API RESULTS]');
      addMobileDebugLog('====================================');
      addMobileDebugLog(`✅ [RESULT 1 - Expense] ID: ${results[0]?.id ?? 'undefined'}`);
      addMobileDebugLog(`✅ [RESULT 1 - Expense] Type: ${results[0]?.type ?? 'undefined'}`);
      addMobileDebugLog(`✅ [RESULT 1 - Expense] CorrectedAmount: ${results[0]?.correctedAmount ?? 'undefined'} öre`);
      addMobileDebugLog(`✅ [RESULT 2 - Payment] ID: ${results[1]?.id ?? 'undefined'}`);
      addMobileDebugLog(`✅ [RESULT 2 - Payment] Type: ${results[1]?.type ?? 'undefined'}`);
      addMobileDebugLog(`✅ [RESULT 2 - Payment] CorrectedAmount: ${results[1]?.correctedAmount ?? 'undefined'} öre`);

      if (onRefresh) {
        addMobileDebugLog('🔄 [REFRESH] Calling onRefresh callback...');
        await onRefresh();
        addMobileDebugLog('✅ [REFRESH] onRefresh completed');
      }
      
      // Force reload transactions to ensure UI shows updated data
      try {
        addMobileDebugLog('🔄 [FORCE REFRESH] Forcing transaction reload...');
        const { forceReloadTransactions } = await import('../orchestrator/budgetOrchestrator');
        await forceReloadTransactions();
        addMobileDebugLog('✅ [FORCE REFRESH] Transaction reload completed');
      } catch (error) {
        addMobileDebugLog(`❌ [FORCE REFRESH] Failed: ${error}`);
      }
      
      addMobileDebugLog('====================================');
      addMobileDebugLog('🎉 [KOPPLA UTLÄGG COMPLETE]');
      addMobileDebugLog('====================================');
      
      onClose();
      setSelectedPayment('');
      setSearchTerm('');

    } catch (error) {
      addMobileDebugLog('====================================');
      addMobileDebugLog('❌ [ERROR] KOPPLA UTLÄGG FAILED');
      addMobileDebugLog('====================================');
      addMobileDebugLog(`❌ [ERROR] Message: ${error instanceof Error ? error.message : String(error)}`);
      addMobileDebugLog(`❌ [ERROR] Full details: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
      console.error('Error linking expense claim:', error);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedPayment('');
    setSearchTerm('');
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vilken betalning täcker detta utlägg?</DialogTitle>
          <DialogDescription>
            Du kategoriserar {formatOrenAsCurrency(Math.abs(transaction.amount))} som "Utlägg".
            Välj vilken positiv transaktion från samma konto som täcker denna kostnad.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Sök efter betalning:</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                id="search"
                placeholder="Sök på beskrivning eller datum..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {displayedPayments.length > 0 ? (
            <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {displayedPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value={payment.id} id={payment.id} />
                    <Label htmlFor={payment.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{payment.date}: {payment.description}</span>
                        <span className="text-green-600 font-medium">
                          {formatOrenAsCurrency(payment.amount)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Konto: {payment.accountId} • Kategori: {payment.appCategoryId || 'Okategoriserad'}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
              
              {hasMorePayments && (
                <div className="pt-2 border-t">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAll(true)}
                    className="w-full"
                  >
                    Visa alla {filteredPayments.length} betalningar
                  </Button>
                </div>
              )}
            </RadioGroup>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Inga betalningar matchar sökningen.' : 'Inga betalningar hittades på samma konto.'}
            </div>
          )}

          <div className="pt-4 border-t">
            <Button variant="outline" className="w-full">
              Sök efter en annan transaktion...
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Avbryt
          </Button>
          <Button 
            onClick={handleCover}
            disabled={!selectedPayment}
          >
            Koppla utlägg
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};