import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Account, BudgetState } from '@/types/budget';
import { getDateRangeForMonth } from '@/services/calculationService';
import { useCategoriesHierarchy } from '@/hooks/useCategories';

interface NewTransferFormProps {
  targetAccountId?: string;
  targetAccountName?: string;
  preselectedFromAccountId?: string;
  preselectedFromAccountName?: string;
  availableAccounts: Account[];
  selectedMonth?: string;
  budgetState?: BudgetState;
  onSubmit: (transfer: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    transferType: 'monthly' | 'daily';
    dailyAmount?: number;
    transferDays?: number[];
    huvudkategoriId?: string;
    underkategoriId?: string;
  }) => void;
  onCancel: () => void;
}

export const NewTransferForm: React.FC<NewTransferFormProps> = ({
  targetAccountId,
  targetAccountName,
  preselectedFromAccountId,
  preselectedFromAccountName,
  availableAccounts,
  selectedMonth,
  budgetState,
  onSubmit,
  onCancel
}) => {
  const { categories, isLoading: categoriesLoading } = useCategoriesHierarchy();
  
  const [fromAccountId, setFromAccountId] = useState<string>(preselectedFromAccountId || '');
  const [toAccountId, setToAccountId] = useState<string>(targetAccountId || '');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [transferType, setTransferType] = useState<'monthly' | 'daily'>('monthly');
  const [dailyAmount, setDailyAmount] = useState<string>('');
  const [transferDays, setTransferDays] = useState<number[]>([1, 2, 3, 4]); // Default Monday-Thursday
  const [huvudkategoriId, setHuvudkategoriId] = useState<string>('');
  const [underkategoriId, setUnderkategoriId] = useState<string>('');
  const [availableUnderkategorier, setAvailableUnderkategorier] = useState<Array<{id: string, name: string}>>([]);
  const [previousHuvudkategoriId, setPreviousHuvudkategoriId] = useState<string>('');

  // Update available subcategories when main category changes
  useEffect(() => {
    if (huvudkategoriId && categories.length > 0) {
      const selectedCategory = categories.find(cat => cat.id === huvudkategoriId);
      const newUnderkategorier = selectedCategory?.underkategorier || [];
      setAvailableUnderkategorier(newUnderkategorier);
      
      // Only reset subcategory if huvudkategoriId actually changed
      if (huvudkategoriId !== previousHuvudkategoriId) {
        setUnderkategoriId('');
        setPreviousHuvudkategoriId(huvudkategoriId);
      }
    } else if (!huvudkategoriId) {
      setAvailableUnderkategorier([]);
      if (huvudkategoriId !== previousHuvudkategoriId) {
        setUnderkategoriId('');
        setPreviousHuvudkategoriId(huvudkategoriId);
      }
    }
  }, [huvudkategoriId, categories, previousHuvudkategoriId]);

  // Count specific weekdays in a date range (payday-based)
  const countWeekdaysInMonth = (monthKey: string, selectedWeekdays: number[], payday: number = 25): number => {
    const { startDate, endDate } = getDateRangeForMonth(monthKey, payday);
    
    let count = 0;
    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);
    
    // Iterate through each day in the range
    while (currentDate <= lastDate) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Check if this day is in our selected weekdays
      if (selectedWeekdays.includes(dayOfWeek)) {
        count++;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return count;
  };

  // Calculate total monthly amount for daily transfers
  const calculateTotalMonthlyAmount = (): number => {
    if (transferType === 'daily' && dailyAmount && transferDays.length > 0 && selectedMonth && budgetState) {
      const payday = budgetState.settings?.payday || 25;
      const weekdayCount = countWeekdaysInMonth(selectedMonth, transferDays, payday);
      return parseFloat(dailyAmount) * weekdayCount;
    }
    return 0;
  };

  const totalMonthlyAmount = calculateTotalMonthlyAmount();

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
        transferType: 'monthly',
        huvudkategoriId: huvudkategoriId || undefined,
        underkategoriId: underkategoriId || undefined
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
        transferDays,
        huvudkategoriId: huvudkategoriId || undefined,
        underkategoriId: underkategoriId || undefined
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
            <Label htmlFor="huvudkategori">Huvudkategori</Label>
            <Select value={huvudkategoriId} onValueChange={setHuvudkategoriId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj huvudkategori" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="underkategori">Underkategori</Label>
            <Select 
              value={underkategoriId} 
              onValueChange={setUnderkategoriId}
              disabled={!huvudkategoriId}
            >
              <SelectTrigger>
                <SelectValue placeholder={huvudkategoriId ? "Välj underkategori" : "Välj huvudkategori först"} />
              </SelectTrigger>
              <SelectContent>
                {availableUnderkategorier.map(subCategory => (
                  <SelectItem key={subCategory.id} value={subCategory.id}>
                    {subCategory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                {availableAccounts.filter(account => account.id && account.id !== '').map(account => (
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
                {availableAccounts.filter(account => account.id && account.id !== '').map(account => (
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
                {selectedMonth && budgetState && dailyAmount && transferDays.length > 0 && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm text-blue-800">
                      <div className="font-medium">Beräkning för {selectedMonth}:</div>
                      <div className="text-xs space-y-1 mt-1">
                        <div>Valda dagar: {transferDays.length} dagar/vecka</div>
                        <div>Period: {(() => {
                          const payday = budgetState.settings?.payday || 25;
                          const { startDate, endDate } = getDateRangeForMonth(selectedMonth, payday);
                          return `${startDate} till ${endDate}`;
                        })()}</div>
                        <div>Antal överföringsdagar: {countWeekdaysInMonth(selectedMonth, transferDays, budgetState.settings?.payday || 25)} dagar</div>
                        <div className="font-semibold border-t pt-1 mt-1">
                          Total månadsbelopp: {new Intl.NumberFormat('sv-SE', {
                            style: 'currency',
                            currency: 'SEK',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(totalMonthlyAmount)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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