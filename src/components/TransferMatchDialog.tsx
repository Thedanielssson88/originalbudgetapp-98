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
import { matchInternalTransfer, updateTransaction } from '../orchestrator/budgetOrchestrator';

interface TransferMatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: ImportedTransaction;
  suggestions?: ImportedTransaction[];
}

export const TransferMatchDialog: React.FC<TransferMatchDialogProps> = ({
  isOpen,
  onClose,
  transaction,
  suggestions = []
}) => {
  const [selectedMatch, setSelectedMatch] = React.useState<string>('');

  const handleMatch = () => {
    if (transaction && selectedMatch) {
      matchInternalTransfer(transaction.id, selectedMatch);
      onClose();
    }
  };

  const handleChangeToInternalTransfer = () => {
    if (transaction) {
      updateTransaction(transaction.id, { type: 'InternalTransfer' });
      onClose();
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Föreslå matchning för överföring</DialogTitle>
          <DialogDescription>
            Jag ser en överföring på {Math.abs(transaction.amount).toLocaleString('sv-SE')} kr från {transaction.accountId}.
            Vill du para ihop denna med någon av följande transaktioner?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium">Transaktion att matcha:</h4>
            <div className="text-sm text-muted-foreground mt-1">
              {transaction.date}: {transaction.description} ({transaction.amount.toLocaleString('sv-SE')} kr)
            </div>
          </div>

          {suggestions.length > 0 ? (
            <RadioGroup value={selectedMatch} onValueChange={setSelectedMatch}>
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value={suggestion.id} id={suggestion.id} />
                    <Label htmlFor={suggestion.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span>{suggestion.date}: {suggestion.description}</span>
                        <span className={`font-medium ${suggestion.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {suggestion.amount.toLocaleString('sv-SE')} kr
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Konto: {suggestion.accountId}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Inga matchande överföringar hittades automatiskt.
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
          {suggestions.length > 0 && (
            <Button onClick={handleMatch} disabled={!selectedMatch}>
              Matcha transaktioner
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};