import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Account } from '@/types/budget';

interface NewTransferFormProps {
  targetAccountId?: string;
  targetAccountName?: string;
  preselectedFromAccountId?: string;
  preselectedFromAccountName?: string;
  availableAccounts: Account[];
  onSubmit: (transfer: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    transferType: 'monthly' | 'daily';
    dailyAmount?: number;
    transferDays?: number[];
  }) => void;
  onCancel: () => void;
}

export const NewTransferForm: React.FC<NewTransferFormProps> = ({
  targetAccountId,
  targetAccountName,
  preselectedFromAccountId,
  preselectedFromAccountName,
  availableAccounts,
  onSubmit,
  onCancel
}) => {
  const [fromAccountId, setFromAccountId] = useState<string>(preselectedFromAccountId || '');
  const [toAccountId, setToAccountId] = useState<string>(targetAccountId || '');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [transferType, setTransferType] = useState<'monthly' | 'daily'>('monthly');
  const [dailyAmount, setDailyAmount] = useState<string>('');
  const [transferDays, setTransferDays] = useState<number[]>([1, 2, 3, 4]); // Default Monday-Thursday

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fromAccountId || !toAccountId) {
      return;
    }

    if (transferType === 'monthly') {
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return;
      }
      
      onSubmit({
        fromAccountId,
        toAccountId,
        amount: numericAmount,
        description: description || undefined,
        transferType: 'monthly'
      });
    } else if (transferType === 'daily') {
      const numericDailyAmount = parseFloat(dailyAmount);
      if (isNaN(numericDailyAmount) || numericDailyAmount <= 0) {
        return;
      }
      
      if (transferDays.length === 0) {
        return;
      }
      
      onSubmit({
        fromAccountId,
        toAccountId,
        amount: 0, // Will be calculated based on days
        description: description || undefined,
        transferType: 'daily',
        dailyAmount: numericDailyAmount,
        transferDays
      });
    }
  };

  const toggleTransferDay = (dayIndex: number) => {
    setTransferDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const weekDays = [
    { index: 1, name: 'Måndag' },
    { index: 2, name: 'Tisdag' },
    { index: 3, name: 'Onsdag' },
    { index: 4, name: 'Torsdag' },
    { index: 5, name: 'Fredag' },
    { index: 6, name: 'Lördag' },
    { index: 0, name: 'Söndag' }
  ];

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ny Planerad Överföring</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="from-account">
              Från konto
              {preselectedFromAccountId && preselectedFromAccountName && (
                <span className="text-sm text-muted-foreground ml-2">
                  (Förvalt: {preselectedFromAccountName})
                </span>
              )}
            </Label>
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
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj konto att överföra till" />
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
            <Label>Överföringstyp</Label>
            <ToggleGroup 
              type="single" 
              value={transferType} 
              onValueChange={(value) => value && setTransferType(value as 'monthly' | 'daily')}
              className="grid grid-cols-2 w-full"
            >
              <ToggleGroupItem 
                value="monthly" 
                className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Fast Månadsöverföring
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="daily" 
                className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Daglig Överföring
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {transferType === 'monthly' && (
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
          )}

          {transferType === 'daily' && (
            <>
              <div>
                <Label htmlFor="daily-amount">Belopp per dag (SEK)</Label>
                <Input
                  id="daily-amount"
                  type="number"
                  value={dailyAmount}
                  onChange={(e) => setDailyAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              
              <div>
                <Label>Vilka dagar ska överföringen ske?</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {weekDays.map(day => (
                    <div key={day.index} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.index}`}
                        checked={transferDays.includes(day.index)}
                        onCheckedChange={() => toggleTransferDay(day.index)}
                      />
                      <Label 
                        htmlFor={`day-${day.index}`}
                        className="text-sm font-normal"
                      >
                        {day.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

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
            disabled={
              !fromAccountId || 
              !toAccountId || 
              (transferType === 'monthly' && !amount) || 
              (transferType === 'daily' && (!dailyAmount || transferDays.length === 0))
            }
          >
            Skapa Överföring
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};