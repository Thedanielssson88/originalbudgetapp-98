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
import { ImportedTransaction } from '@/types/transaction';
import { matchInternalTransfer, updateTransaction, getAccountNameById } from '../orchestrator/budgetOrchestrator';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';

interface TransferMatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: ImportedTransaction;
  suggestions?: ImportedTransaction[];
  onRefresh?: () => void;
}

export const TransferMatchDialog: React.FC<TransferMatchDialogProps> = ({
  isOpen,
  onClose,
  transaction,
  suggestions = [],
  onRefresh
}) => {
  const [selectedMatch, setSelectedMatch] = React.useState<string>('');
  const [showAllSuggestions, setShowAllSuggestions] = React.useState<boolean>(false);

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

  const handleMatch = () => {
    if (transaction && selectedMatch) {
      const selectedTransaction = suggestions.find(s => s.id === selectedMatch);
      
      if (selectedTransaction) {
        // Get month key from transaction date
        const monthKey = transaction.date.substring(0, 7);
        
        // Convert both transactions to InternalTransfer if they aren't already
        if (transaction.type !== 'InternalTransfer') {
          updateTransaction(transaction.id, { type: 'InternalTransfer', isManuallyChanged: true }, monthKey);
        }
        if (selectedTransaction.type !== 'InternalTransfer') {
          updateTransaction(selectedTransaction.id, { type: 'InternalTransfer', isManuallyChanged: true }, monthKey);
        }
        
        // Match the transactions
        matchInternalTransfer(transaction.id, selectedMatch);
        
        // Trigger refresh to update the UI
        if (onRefresh) {
          onRefresh();
        }
      }
      
      onClose();
    }
  };

  const handleChangeToInternalTransfer = () => {
    if (transaction) {
      // Derive monthKey from transaction's date
      const monthKey = transaction.date.substring(0, 7);
      updateTransaction(transaction.id, { type: 'InternalTransfer', isManuallyChanged: true }, monthKey);
      onClose();
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
          <Button variant="secondary" onClick={handleChangeToInternalTransfer}>
            Ändra till Intern Överföring
          </Button>
          {filteredSuggestions.length > 0 && (
            <Button 
              onClick={handleMatch} 
              disabled={!selectedMatch}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Matcha transaktioner
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};