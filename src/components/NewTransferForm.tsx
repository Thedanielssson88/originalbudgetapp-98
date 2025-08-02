import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Account } from '@/types/budget';

interface NewTransferFormProps {
  targetAccountId: string;
  targetAccountName: string;
  availableAccounts: Account[];
  onSubmit: (fromAccountId: string, amount: number, description?: string) => void;
  onCancel: () => void;
}

export const NewTransferForm: React.FC<NewTransferFormProps> = ({
  targetAccountId,
  targetAccountName,
  availableAccounts,
  onSubmit,
  onCancel
}) => {
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fromAccountId || !amount) {
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    onSubmit(fromAccountId, numericAmount, description || undefined);
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ny Planerad Överföring</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="from-account">Från konto</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj konto att överföra från" />
              </SelectTrigger>
              <SelectContent>
                {availableAccounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="to-account">Till konto</Label>
            <Input
              id="to-account"
              value={targetAccountName}
              disabled
              className="bg-muted"
            />
          </div>

          <div>
            <Label htmlFor="amount">Belopp (SEK)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <Label htmlFor="description">Beskrivning (valfritt)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="T.ex. Månadsbudget för hushållskostnader"
            />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Avbryt
          </Button>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            disabled={!fromAccountId || !amount}
          >
            Skapa Överföring
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};