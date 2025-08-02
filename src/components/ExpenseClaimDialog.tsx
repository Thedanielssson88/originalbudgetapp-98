import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { ImportedTransaction } from '@/types/transaction';
import { getCurrentState, linkExpenseAndCoverage } from '../orchestrator/budgetOrchestrator';

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

  const { budgetState } = getCurrentState();

  // Find potential positive payments on the same account that could match this expense claim
  const potentialPayments = useMemo(() => {
    if (!transaction) return [];

    const currentMonthKey = transaction.date.substring(0, 7); // Get YYYY-MM from date
    const monthData = budgetState.historicalData[currentMonthKey];
    if (!monthData) return [];

    const allMonthTransactions = monthData.transactions || [];

    // Find POSITIVE transactions on SAME account that are uncategorized
    return allMonthTransactions.filter(t =>
      t.id !== transaction.id &&                  // Not the same transaction
      t.accountId === transaction.accountId &&    // Must be on SAME account
      t.amount > 0 &&                             // Must be a positive transaction
      (t.type === 'Transaction' || t.type === 'InternalTransfer') && // Uncategorized
      !t.linkedTransactionId                      // Not already linked to another transaction
    );
  }, [transaction, budgetState.historicalData]);

  const filteredPayments = useMemo(() => {
    if (!searchTerm) return potentialPayments;
    return potentialPayments.filter(payment =>
      payment.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [potentialPayments, searchTerm]);

  const handleCover = () => {
    if (!transaction || !selectedPayment) return;

    linkExpenseAndCoverage(transaction.id, selectedPayment);
    
    if (onRefresh) {
      onRefresh();
    }
    
    onClose();
    setSelectedPayment('');
    setSearchTerm('');
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
          <DialogTitle>Vilket utlägg täcker denna överföring?</DialogTitle>
          <DialogDescription>
            Du kategoriserar {Math.abs(transaction.amount)} kr som "Utlägg". 
            Välj vilken inkommande överföring som täcker kostnaden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Sök efter överföring..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Payment selection */}
          <div className="max-h-96 overflow-y-auto">
            {filteredPayments.length > 0 ? (
              <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
                {filteredPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value={payment.id} id={payment.id} />
                    <Label htmlFor={payment.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">{payment.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {payment.date} • {payment.accountId}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600">
                            +{payment.amount.toFixed(2)} kr
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'Inga överföringar matchar din sökning.' : 'Inga tillgängliga överföringar hittades på detta konto.'}
              </div>
            )}
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