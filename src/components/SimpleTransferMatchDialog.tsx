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
import { matchInternalTransfer } from '../orchestrator/budgetOrchestrator';

interface SimpleTransferMatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction;
  suggestions?: Transaction[];
}

export const SimpleTransferMatchDialog: React.FC<SimpleTransferMatchDialogProps> = ({
  isOpen,
  onClose,
  transaction,
  suggestions = []
}) => {
  const [selectedMatch, setSelectedMatch] = React.useState<string>('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleMatch = () => {
    if (transaction && selectedMatch) {
      matchInternalTransfer(transaction.id, selectedMatch);
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
            Matcha denna överföring på {formatCurrency(Math.abs(transaction.amount))} kr från {transaction.accountId}
            med en motsvarande överföring.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900">Transaktion att matcha:</h4>
            <div className="text-sm text-blue-700 mt-1">
              {transaction.date}: {transaction.description} ({formatCurrency(transaction.amount)})
            </div>
          </div>

          {suggestions.length > 0 ? (
            <RadioGroup value={selectedMatch} onValueChange={setSelectedMatch}>
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-blue-50">
                    <RadioGroupItem value={suggestion.id} id={suggestion.id} />
                    <Label htmlFor={suggestion.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-900">{suggestion.date}: {suggestion.description}</span>
                        <span className={`font-medium ${suggestion.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(suggestion.amount)}
                        </span>
                      </div>
                      <div className="text-xs text-blue-600">
                        Konto: {suggestion.accountId}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          ) : (
            <div className="text-center py-8 text-blue-600">
              <div className="text-blue-800 font-medium mb-2">Inga matchande överföringar hittades</div>
              <div className="text-sm">Kontrollera att den motsvarande överföringen finns i samma period.</div>
            </div>
          )}
        </div>

        <DialogFooter className="space-x-2">
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          {suggestions.length > 0 && (
            <Button 
              onClick={handleMatch} 
              disabled={!selectedMatch}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Matcha överföringar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};