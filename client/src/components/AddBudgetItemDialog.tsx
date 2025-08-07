import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BudgetItem, Account } from '../types/budget';
import { useHuvudkategorier, useUnderkategorier } from '../hooks/useCategories';
import { useAccounts } from '../hooks/useAccounts';
import { useCreateBudgetPost } from '../hooks/useBudgetPosts';
import { getDateRangeForMonth } from '../services/calculationService';

// Helper function to count weekdays in a month based on payday
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

interface AddBudgetItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: BudgetItem) => void;
  type: 'cost' | 'savings';
  monthKey: string;
}

export const AddBudgetItemDialog: React.FC<AddBudgetItemDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  type,
  monthKey
}) => {
  // Fetch data from SQL database
  const { data: huvudkategorier = [], isLoading: isLoadingHuvud } = useHuvudkategorier();
  const { data: underkategorier = [], isLoading: isLoadingUnder } = useUnderkategorier();
  const { data: accounts = [], isLoading: isLoadingAccounts } = useAccounts();
  const createBudgetPostMutation = useCreateBudgetPost();

  const initialFormData = useMemo(() => ({
    mainCategoryId: '',
    subCategoryId: '',
    description: '',
    amount: 0,
    accountId: 'none', // For cost posts (to account)
    fromAccountId: 'none', // For savings posts (from account)
    toAccountId: 'none', // For savings posts (to account)
    financedFrom: 'Löpande kostnad' as 'Löpande kostnad' | 'Enskild kostnad',
    transferType: 'monthly' as 'monthly' | 'daily',
    dailyAmount: 0,
    transferDays: [] as number[]
  }), []);

  const [formData, setFormData] = useState(initialFormData);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        mainCategoryId: '',
        subCategoryId: '',
        description: '',
        amount: 0,
        accountId: 'none',
        fromAccountId: 'none',
        toAccountId: 'none',
        financedFrom: 'Löpande kostnad' as 'Löpande kostnad' | 'Enskild kostnad',
        transferType: 'monthly' as 'monthly' | 'daily',
        dailyAmount: 0,
        transferDays: [] as number[]
      });
    }
  }, [isOpen]);

  // Filter subcategories based on selected main category
  const currentAvailableSubcategories = useMemo(() => {
    if (formData.mainCategoryId && underkategorier.length > 0) {
      return underkategorier.filter(sub => sub.huvudkategoriId === formData.mainCategoryId);
    }
    return [];
  }, [formData.mainCategoryId, underkategorier]);

  // Remove the problematic useEffect that was causing infinite loops
  // We can use currentAvailableSubcategories directly in the JSX

  const handleSave = async () => {
    console.log('🔍 [DEBUG] AddBudgetItemDialog handleSave called with formData:', formData);
    console.log('🔍 [DEBUG] formData.accountId:', formData.accountId);
    console.log('🔍 [DEBUG] accounts prop:', accounts);
    
    const isValidAmount = formData.transferType === 'daily' ? 
      formData.dailyAmount > 0 && formData.transferDays.length > 0 : 
      formData.amount > 0;
      
    console.log('🔍 [DEBUG] Validation check:', {
      mainCategoryId: !!formData.mainCategoryId,
      subCategoryId: !!formData.subCategoryId,
      description: !!formData.description,
      isValidAmount,
      transferType: formData.transferType,
      amount: formData.amount,
      dailyAmount: formData.dailyAmount,
      transferDays: formData.transferDays
    });
      
    if (formData.mainCategoryId && formData.subCategoryId && formData.description && isValidAmount) {
      console.log('🔍 [DEBUG] Validation passed, saving to PostgreSQL...');
      
      try {
        // Save to PostgreSQL database
        const budgetPostData = {
          userId: 'dev-user-123', // Mock user ID for development
          monthKey: monthKey,
          huvudkategoriId: formData.mainCategoryId,
          underkategoriId: formData.subCategoryId,
          description: formData.description,
          amount: Math.round((formData.transferType === 'daily' ? 
            formData.dailyAmount * countWeekdaysInMonth(monthKey, formData.transferDays, 25) : 
            formData.amount) * 100), // Convert to öre
          accountId: type === 'savings' ? 
            (formData.toAccountId && formData.toAccountId !== 'none' ? formData.toAccountId : null) :
            (formData.accountId && formData.accountId !== 'none' ? formData.accountId : null),
          accountIdFrom: type === 'savings' ? 
            (formData.fromAccountId && formData.fromAccountId !== 'none' ? formData.fromAccountId : null) : 
            null,
          financedFrom: formData.financedFrom,
          transferType: formData.transferType,
          dailyAmount: formData.transferType === 'daily' ? Math.round(formData.dailyAmount * 100) : null, // Convert to öre
          transferDays: formData.transferType === 'daily' ? JSON.stringify(formData.transferDays) : null,
          type: type,
          transactionType: type === 'cost' ? 'Kostnadspost' : 'Sparpost',
          budgetType: type === 'cost' ? 'Kostnadspost' : 'Sparpost',
        };
        
        console.log('🔍 [DEBUG] Saving budget post data:', JSON.stringify(budgetPostData, null, 2));
        console.log('🔍 [DEBUG] budgetType field being sent:', budgetPostData.budgetType);
        
        await createBudgetPostMutation.mutateAsync(budgetPostData);
        
        console.log('🔍 [DEBUG] Budget post saved successfully to PostgreSQL');
        
        // Still call the old onSave for backward compatibility and immediate UI update
        const budgetItem: BudgetItem = {
          id: uuidv4(), // Generate unique ID for legacy compatibility
          mainCategoryId: formData.mainCategoryId,
          subCategoryId: formData.subCategoryId,
          description: formData.description,
          amount: formData.transferType === 'daily' ? 0 : formData.amount,
          accountId: formData.accountId && formData.accountId !== 'none' ? formData.accountId : undefined,
          financedFrom: formData.financedFrom,
          transferType: formData.transferType,
          dailyAmount: formData.transferType === 'daily' ? formData.dailyAmount : undefined,
          transferDays: formData.transferType === 'daily' ? formData.transferDays : undefined
        };

        onSave(budgetItem);
        handleCancel();
        
      } catch (error) {
        console.error('🔍 [ERROR] Failed to save budget post:', error);
        // Could add error toast here
      }
    } else {
      console.log('🔍 [DEBUG] Validation failed, save not executed');
    }
  };

  const handleCancel = useCallback(() => {
    setFormData(initialFormData);
    onClose();
  }, [initialFormData, onClose]);

  const weekdays = [
    { value: 1, label: 'M', name: 'Måndag' },
    { value: 2, label: 'T', name: 'Tisdag' },
    { value: 3, label: 'O', name: 'Onsdag' },
    { value: 4, label: 'T', name: 'Torsdag' },
    { value: 5, label: 'F', name: 'Fredag' },
    { value: 6, label: 'L', name: 'Lördag' },
    { value: 0, label: 'S', name: 'Söndag' }
  ];

  const handleTransferDaysChange = useCallback((days: string[]) => {
    const numericDays = days.map(d => parseInt(d));
    setFormData(prev => ({ ...prev, transferDays: numericDays }));
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {type === 'cost' ? 'Lägg till kostnadspost' : 'Lägg till sparandepost'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="mainCategory">Huvudkategori</Label>
            <Select 
              value={formData.mainCategoryId} 
              onValueChange={(value) => {
                setFormData({ ...formData, mainCategoryId: value, subCategoryId: '' });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj huvudkategori" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {isLoadingHuvud ? (
                  <SelectItem value="loading" disabled>Laddar...</SelectItem>
                ) : (
                  huvudkategorier.filter(k => k.id && k.id !== '').map((kategori) => (
                    <SelectItem key={kategori.id} value={kategori.id}>
                      {kategori.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subcategory">Underkategori</Label>
            <Select 
              value={formData.subCategoryId} 
              onValueChange={(value) => setFormData({ ...formData, subCategoryId: value })}
              disabled={!formData.mainCategoryId}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.mainCategoryId ? "Välj underkategori" : "Välj först huvudkategori"} />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {isLoadingUnder ? (
                  <SelectItem value="loading" disabled>Laddar...</SelectItem>
                ) : (
                  currentAvailableSubcategories.filter(s => s.id && s.id !== '').map((subkategori) => (
                    <SelectItem key={subkategori.id} value={subkategori.id}>
                      {subkategori.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivning</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Beskrivning av posten"
            />
          </div>

          <div className="space-y-2">
            <Label>Överföringstyp</Label>
            <RadioGroup
              value={formData.transferType}
              onValueChange={(value: 'monthly' | 'daily') => setFormData({ ...formData, transferType: value })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly">Fast Månadsöverföring</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily" id="daily" />
                <Label htmlFor="daily">Daglig Överföring</Label>
              </div>
            </RadioGroup>
          </div>

          {formData.transferType === 'monthly' ? (
            <div className="space-y-2">
              <Label htmlFor="amount">Belopp</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dailyAmount">Belopp per dag</Label>
                <Input
                  id="dailyAmount"
                  type="number"
                  value={formData.dailyAmount || ''}
                  onChange={(e) => setFormData({ ...formData, dailyAmount: Number(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Överföringsdagar</Label>
                <ToggleGroup
                  type="multiple"
                  value={formData.transferDays.map(d => d.toString())}
                  onValueChange={handleTransferDaysChange}
                  className="justify-start"
                >
                  {weekdays.map((day) => (
                    <ToggleGroupItem
                      key={day.value}
                      value={day.value.toString()}
                      aria-label={day.name}
                      size="sm"
                      className="h-8 w-8"
                    >
                      {day.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {formData.transferDays.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Valda dagar: {formData.transferDays.map(d => weekdays.find(w => w.value === d)?.name).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {type === 'cost' ? (
            <div className="space-y-2">
              <Label htmlFor="account">Konto</Label>
              <Select 
                value={formData.accountId} 
                onValueChange={(value) => setFormData({ ...formData, accountId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj konto (valfritt)" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <SelectItem value="none">Inget konto</SelectItem>
                  {accounts.length === 0 ? (
                    isLoadingAccounts ? (
                      <SelectItem value="loading" disabled>Laddar konton...</SelectItem>
                    ) : (
                      <SelectItem value="no-accounts" disabled>Inga konton hittades</SelectItem>
                    )
                  ) : (
                    accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fromAccount">Från Konto</Label>
                <Select 
                  value={formData.fromAccountId} 
                  onValueChange={(value) => setFormData({ ...formData, fromAccountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj konto" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg z-50">
                    {accounts.length === 0 ? (
                      isLoadingAccounts ? (
                        <SelectItem value="loading" disabled>Laddar konton...</SelectItem>
                      ) : (
                        <SelectItem value="no-accounts" disabled>Inga konton hittades</SelectItem>
                      )
                    ) : (
                      accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toAccount">Till Konto</Label>
                <Select 
                  value={formData.toAccountId} 
                  onValueChange={(value) => setFormData({ ...formData, toAccountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj konto" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border shadow-lg z-50">
                    {accounts.length === 0 ? (
                      isLoadingAccounts ? (
                        <SelectItem value="loading" disabled>Laddar konton...</SelectItem>
                      ) : (
                        <SelectItem value="no-accounts" disabled>Inga konton hittades</SelectItem>
                      )
                    ) : (
                      accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {type === 'cost' && (
            <div className="space-y-2">
              <Label htmlFor="financedFrom">Finansieras från</Label>
              <Select 
                value={formData.financedFrom} 
                onValueChange={(value: 'Löpande kostnad' | 'Enskild kostnad') => setFormData({ ...formData, financedFrom: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  <SelectItem value="Löpande kostnad">Löpande kostnad</SelectItem>
                  <SelectItem value="Enskild kostnad">Enskild kostnad</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Avbryt
          </Button>
          <Button 
            onClick={handleSave}
            disabled={
              !formData.mainCategoryId || 
              !formData.subCategoryId || 
              !formData.description || 
              (type === 'savings' && (!formData.fromAccountId || !formData.toAccountId || formData.fromAccountId === 'none' || formData.toAccountId === 'none')) ||
              (formData.transferType === 'daily' ? 
                (formData.dailyAmount <= 0 || formData.transferDays.length === 0) : 
                formData.amount <= 0
              )
            }
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};