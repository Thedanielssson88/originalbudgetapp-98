import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Transaction } from '@/types/budget';
import { getAccountNameById } from '../orchestrator/budgetOrchestrator';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { addMobileDebugLog } from '@/utils/mobileDebugLogger';

interface SimpleTransferMatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction;
  suggestions?: Transaction[];
  onRefresh?: () => void;
}

export const SimpleTransferMatchDialog: React.FC<SimpleTransferMatchDialogProps> = ({
  isOpen,
  onClose,
  transaction,
  suggestions = [],
  onRefresh
}) => {
  const [selectedMatch, setSelectedMatch] = React.useState<string>('');
  const [showAllSuggestions, setShowAllSuggestions] = React.useState<boolean>(false);
  const updateTransactionMutation = useUpdateTransaction();

  // Filter suggestions to show only same-date initially, with option to show all 7-day range
  const filteredSuggestions = React.useMemo(() => {
    if (!transaction) return suggestions;
    
    const sameDateSuggestions = suggestions.filter(s => s.date === transaction.date);
    
    if (showAllSuggestions) {
      return suggestions;
    }
    
    // Hide already linked transactions from initial same-date view
    return sameDateSuggestions.filter(s => !s.linkedTransactionId);
  }, [suggestions, transaction, showAllSuggestions]);

  // Auto-select the best match when suggestions change
  React.useEffect(() => {
    if (filteredSuggestions.length > 0 && transaction) {
      // Find the best match: prioritize same date, amount, and description
      const perfectMatch = filteredSuggestions.find(s => 
        s.date === transaction.date && 
        Math.abs(s.amount) === Math.abs(transaction.amount) &&
        s.description === transaction.description
      );
      
      // If no perfect match, find same date and amount
      const goodMatch = filteredSuggestions.find(s => 
        s.date === transaction.date && 
        Math.abs(s.amount) === Math.abs(transaction.amount)
      );
      
      if (perfectMatch) {
        setSelectedMatch(perfectMatch.id);
      } else if (goodMatch) {
        setSelectedMatch(goodMatch.id);
      } else {
        setSelectedMatch('');
      }
    }
  }, [filteredSuggestions, transaction]);

  // Remove custom formatCurrency - use formatOrenAsCurrency instead
  // The transaction amounts are stored in öre in the database

  const handleMatch = async () => {
    // === MOBILE DEBUG: Initial state ===
    addMobileDebugLog('🔗 [MATCH START] User clicked "Matcha transaktioner"');
    addMobileDebugLog(`🔗 [MATCH] Transaction 1: ${transaction?.id} (${transaction?.type})`);
    addMobileDebugLog(`🔗 [MATCH] Selected match: ${selectedMatch}`);
    addMobileDebugLog(`🔗 [MATCH] Transaction 1 amount: ${transaction?.amount} öre`);
    
    console.log('🔗 [SimpleTransferMatchDialog] handleMatch called', { 
      transactionId: transaction?.id, 
      selectedMatch,
      transactionType: transaction?.type 
    });
    
    if (!transaction || !selectedMatch) {
      addMobileDebugLog('❌ [MATCH ERROR] Missing transaction or selectedMatch');
      console.warn('🔗 [SimpleTransferMatchDialog] Missing transaction or selectedMatch', {
        hasTransaction: !!transaction,
        selectedMatch
      });
      return;
    }

    const selectedTransaction = suggestions.find(s => s.id === selectedMatch);
    if (!selectedTransaction) {
      addMobileDebugLog('❌ [MATCH ERROR] Could not find selected transaction in suggestions');
      console.error('🔗 [SimpleTransferMatchDialog] Could not find selected transaction');
      return;
    }
    
    // === MOBILE DEBUG: Transaction details ===
    addMobileDebugLog(`🔗 [MATCH] Transaction 2: ${selectedTransaction.id} (${selectedTransaction.type})`);
    addMobileDebugLog(`🔗 [MATCH] Transaction 2 amount: ${selectedTransaction.amount} öre`);
    addMobileDebugLog(`🔗 [MATCH] Transaction 1 account: ${transaction.accountId}`);
    addMobileDebugLog(`🔗 [MATCH] Transaction 2 account: ${selectedTransaction.accountId}`);
    
    console.log('🔗 [SimpleTransferMatchDialog] Found selected transaction:', {
      selectedTransactionId: selectedTransaction.id,
      selectedTransactionType: selectedTransaction.type,
      selectedTransactionAmount: selectedTransaction.amount
    });

    try {
      // Get account names for descriptions
      addMobileDebugLog('🔍 [MATCH] Getting account names from orchestrator...');
      const account1Name = getAccountNameById(transaction.accountId) || 'Unknown Account';
      const account2Name = getAccountNameById(selectedTransaction.accountId) || 'Unknown Account';
      
      addMobileDebugLog(`🏦 [MATCH] Account 1: ${account1Name} (${transaction.accountId})`);
      addMobileDebugLog(`🏦 [MATCH] Account 2: ${account2Name} (${selectedTransaction.accountId})`);
      
      console.log('🔗 [SimpleTransferMatchDialog] Linking transactions with API calls');
      
      // === MOBILE DEBUG: API call preparation ===
      const update1Data = {
        type: 'InternalTransfer',
        linkedTransactionId: selectedTransaction.id,
        userDescription: `Överföring till ${account2Name}, ${selectedTransaction.date}`,
        isManuallyChanged: 'true'
      };
      
      const update2Data = {
        type: 'InternalTransfer', 
        linkedTransactionId: transaction.id,
        userDescription: `Överföring från ${account1Name}, ${transaction.date}`,
        isManuallyChanged: 'true'
      };
      
      addMobileDebugLog('📡 [API CALL] Preparing to call PATCH /api/transactions');
      addMobileDebugLog(`📡 [API CALL 1] PATCH /api/transactions/${transaction.id}`);
      addMobileDebugLog(`📡 [API DATA 1] ${JSON.stringify(update1Data, null, 2)}`);
      addMobileDebugLog(`📡 [API CALL 2] PATCH /api/transactions/${selectedTransaction.id}`);
      addMobileDebugLog(`📡 [API DATA 2] ${JSON.stringify(update2Data, null, 2)}`);
      
      // Update both transactions to link them together
      addMobileDebugLog('📡 [API] Starting Promise.all for both API calls...');
      
      const apiResults = await Promise.all([
        // Update first transaction
        updateTransactionMutation.mutateAsync({
          id: transaction.id,
          data: update1Data
        }),
        // Update second transaction
        updateTransactionMutation.mutateAsync({
          id: selectedTransaction.id,
          data: update2Data
        })
      ]);
      
      // === MOBILE DEBUG: API success ===
      addMobileDebugLog('✅ [API SUCCESS] Both API calls completed successfully');
      addMobileDebugLog(`✅ [API RESULT 1] ${JSON.stringify(apiResults[0], null, 2)}`);
      addMobileDebugLog(`✅ [API RESULT 2] ${JSON.stringify(apiResults[1], null, 2)}`);
      
      console.log('🔗 [SimpleTransferMatchDialog] Successfully linked transactions via API');
      
      // Trigger refresh to update the UI
      if (onRefresh) {
        addMobileDebugLog('🔄 [REFRESH] Calling onRefresh to update UI...');
        console.log('🔗 [SimpleTransferMatchDialog] Calling onRefresh');
        await onRefresh();
        addMobileDebugLog('✅ [REFRESH] onRefresh completed');
      } else {
        addMobileDebugLog('⚠️ [REFRESH] No onRefresh callback provided');
      }
      
      addMobileDebugLog('🚪 [MATCH] Closing dialog - operation complete');
      console.log('🔗 [SimpleTransferMatchDialog] Closing dialog');
      onClose();
      
    } catch (error) {
      // === MOBILE DEBUG: API errors ===
      addMobileDebugLog('❌ [API ERROR] Failed to link transactions');
      addMobileDebugLog(`❌ [API ERROR] ${error}`);
      addMobileDebugLog(`❌ [ERROR DETAILS] ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
      
      console.error('🔗 [SimpleTransferMatchDialog] Error linking transactions:', error);
      // Don't close dialog on error so user can try again
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Matcha överföring</DialogTitle>
          <DialogDescription>
            Matcha denna transaktion på {formatOrenAsCurrency(Math.abs(transaction.amount))} från {getAccountNameById(transaction.accountId)}
            med en motsvarande transaktion. Båda transaktionerna kommer att konverteras till interna överföringar och länkas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900">Transaktion att matcha:</h4>
            <div className="text-sm text-blue-700 mt-1">
              <div className="font-medium">{getAccountNameById(transaction.accountId)}</div>
              <div>{transaction.date}: {transaction.description} ({formatOrenAsCurrency(transaction.amount)})</div>
            </div>
          </div>

          {suggestions.length > 0 ? (
            <div className="space-y-4">
              <RadioGroup value={selectedMatch} onValueChange={setSelectedMatch}>
                <div className="space-y-2">
                  {filteredSuggestions.map((suggestion) => {
                    const isSelected = selectedMatch === suggestion.id;
                    const isSameDateAndAmount = transaction && suggestion.date === transaction.date && Math.abs(suggestion.amount) === Math.abs(transaction.amount);
                    const isPerfectMatch = isSameDateAndAmount && suggestion.description === transaction.description;
                    
                    return (
                    <div 
                      key={suggestion.id} 
                      className={`flex items-center space-x-2 p-3 border rounded-lg hover:bg-blue-50 ${
                        isSelected && isPerfectMatch
                          ? 'border-green-500 bg-green-50 shadow-md' 
                          : isSelected && isSameDateAndAmount
                          ? 'border-yellow-500 bg-yellow-50 shadow-md'
                          : isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : isPerfectMatch
                          ? 'border-green-300 bg-green-25'
                          : isSameDateAndAmount
                          ? 'border-yellow-300 bg-yellow-25'
                          : ''
                      }`}
                    >
                      <RadioGroupItem value={suggestion.id} id={suggestion.id} />
                      <Label htmlFor={suggestion.id} className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="font-medium text-blue-900">{getAccountNameById(suggestion.accountId)}</div>
                            <div className="text-sm text-gray-700">{suggestion.date}: {suggestion.description}</div>
                          </div>
                          <span className={`font-medium ml-4 ${suggestion.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatOrenAsCurrency(suggestion.amount)}
                          </span>
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          Typ: {suggestion.type || 'Transaktion'}
                          {suggestion.type !== 'InternalTransfer' && (
                            <span className="ml-2 text-orange-600">(kommer konverteras till Intern Överföring)</span>
                          )}
                        </div>
                      </Label>
                    </div>
                    );
                  })}
                </div>
              </RadioGroup>
              
              {!showAllSuggestions && suggestions.length > filteredSuggestions.length && (
                <div className="text-center">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAllSuggestions(true)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    Visa fler ({suggestions.length - filteredSuggestions.length} transaktioner inom 7 dagar)
                  </Button>
                </div>
              )}
              
              {showAllSuggestions && filteredSuggestions.length < suggestions.length && (
                <div className="text-center">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAllSuggestions(false)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    Visa endast samma datum
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-blue-600">
              <div className="text-blue-800 font-medium mb-2">Inga matchande transaktioner hittades</div>
              <div className="text-sm">Kontrollera att den motsvarande transaktionen finns inom 7 dagar och har motsatt belopp.</div>
            </div>
          )}
        </div>

        <DialogFooter className="space-x-2">
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          {filteredSuggestions.length > 0 && (
            <Button 
              onClick={handleMatch} 
              disabled={!selectedMatch || updateTransactionMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateTransactionMutation.isPending ? 'Matchar...' : 'Matcha transaktioner'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};