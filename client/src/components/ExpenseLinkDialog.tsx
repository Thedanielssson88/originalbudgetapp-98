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
import { Input } from '@/components/ui/input';
import { ImportedTransaction } from '@/types/transaction';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { getAccountNameById } from '../orchestrator/budgetOrchestrator';

interface ExpenseLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  expenseTransaction: ImportedTransaction;
  transactions: ImportedTransaction[];
  onLink: (positiveTxId: string) => void;
}

export const ExpenseLinkDialog: React.FC<ExpenseLinkDialogProps> = ({
  isOpen,
  onClose,
  expenseTransaction,
  transactions,
  onLink
}) => {
  const [selectedPositiveTx, setSelectedPositiveTx] = React.useState<string>('');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [showAll, setShowAll] = React.useState<boolean>(false);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedPositiveTx('');
      setSearchTerm('');
      setShowAll(false);
    }
  }, [isOpen]);

  // Find potential positive transactions to link with
  const potentialPositiveTransactions = React.useMemo(() => {
    if (!expenseTransaction) return [];
    
    // Find positive transactions that could be reimbursements
    // Same month or nearby dates
    const expenseDate = new Date(expenseTransaction.date);
    const startDate = new Date(expenseDate);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(expenseDate);
    endDate.setDate(endDate.getDate() + 30);
    
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return tx.amount > 0 && 
             tx.accountId === expenseTransaction.accountId && // Same account only
             txDate >= startDate && 
             txDate <= endDate &&
             tx.id !== expenseTransaction.id &&
             !tx.linkedTransactionId && // Not already linked
             !tx.linkedCostId; // Not already used for cost coverage
    });
  }, [expenseTransaction, transactions]);

  const filteredTransactions = potentialPositiveTransactions.filter(tx => 
    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.date.includes(searchTerm) ||
    (getAccountNameById(tx.accountId) || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show only first 10 transactions initially
  const displayedTransactions = searchTerm || showAll ? filteredTransactions : filteredTransactions.slice(0, 10);
  const hasMoreTransactions = filteredTransactions.length > 10 && !searchTerm && !showAll;

  const handleLink = () => {
    if (selectedPositiveTx) {
      onLink(selectedPositiveTx);
    }
  };

  if (!expenseTransaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Koppla utlägg till ersättning</DialogTitle>
          <DialogDescription>
            Du har ett utlägg på {formatOrenAsCurrency(expenseTransaction.amount)} från {expenseTransaction.date}.
            Välj den positiva transaktionen som är ersättningen för detta utlägg.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">Utlägg:</p>
            <p className="text-sm">{expenseTransaction.description}</p>
            <p className="text-sm text-muted-foreground">
              {expenseTransaction.date} • {getAccountNameById(expenseTransaction.accountId) || 'Okänt konto'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search">Sök efter ersättning:</Label>
            <Input
              id="search"
              placeholder="Sök på beskrivning, datum eller konto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {displayedTransactions.length > 0 ? (
            <RadioGroup 
              value={selectedPositiveTx} 
              onValueChange={setSelectedPositiveTx}
            >
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {displayedTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                    <RadioGroupItem value={tx.id} id={tx.id} />
                    <Label htmlFor={tx.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{tx.description}</span>
                        <span className="text-green-600 font-medium">
                          {formatOrenAsCurrency(tx.amount)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tx.date} • {getAccountNameById(tx.accountId) || 'Okänt konto'}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
              
              {hasMoreTransactions && (
                <div className="pt-2 border-t">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAll(true)}
                    className="w-full"
                  >
                    Visa alla {filteredTransactions.length} transaktioner
                  </Button>
                </div>
              )}
            </RadioGroup>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Inga transaktioner matchar sökningen.' : 'Inga positiva transaktioner hittades för denna period.'}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button 
            onClick={handleLink} 
            disabled={!selectedPositiveTx}
          >
            Koppla utlägg
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};