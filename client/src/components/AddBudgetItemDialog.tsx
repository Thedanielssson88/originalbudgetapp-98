import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BudgetItem, Account } from '../types/budget';
import { StorageKey, get } from '../services/storageService';

interface AddBudgetItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: BudgetItem) => void;
  mainCategories: string[];
  accounts: Account[];
  type: 'cost' | 'savings';
  preselectedMainCategory?: string;
  preselectedSubCategory?: string;
}

export const AddBudgetItemDialog: React.FC<AddBudgetItemDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  mainCategories, 
  accounts,
  type,
  preselectedMainCategory,
  preselectedSubCategory
}) => {
  const [formData, setFormData] = useState({
    mainCategoryId: '',
    subCategoryId: '',
    description: '',
    amount: 0,
    accountId: 'none',
    financedFrom: 'Löpande kostnad' as 'Löpande kostnad' | 'Enskild kostnad',
    transferType: 'monthly' as 'monthly' | 'daily',
    dailyAmount: 0,
    transferDays: [] as number[]
  });
  
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>({});
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>([]);

  useEffect(() => {
    const loadedSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
    console.log('AddBudgetItemDialog: Loading subcategories:', loadedSubcategories);
    setSubcategories(loadedSubcategories);
  }, []);

  // Reload subcategories when dialog opens
  useEffect(() => {
    if (isOpen) {
      const loadedSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
      console.log('AddBudgetItemDialog: Reloading subcategories on dialog open:', loadedSubcategories);
      setSubcategories(loadedSubcategories);
      
      // Reset form when dialog opens, but respect preselected values
      setFormData({
        mainCategoryId: preselectedMainCategory || '',
        subCategoryId: preselectedSubCategory || '',
        description: '',
        amount: 0,
        accountId: 'none',
        financedFrom: 'Löpande kostnad',
        transferType: 'monthly',
        dailyAmount: 0,
        transferDays: []
      });
    }
  }, [isOpen, preselectedMainCategory, preselectedSubCategory]);

  useEffect(() => {
    if (formData.mainCategoryId) {
      const available = subcategories[formData.mainCategoryId] || [];
      console.log(`AddBudgetItemDialog: Setting subcategories for ${formData.mainCategoryId}:`, available);
      setAvailableSubcategories(available);
      setFormData(prev => ({ ...prev, subCategoryId: '' }));
    } else {
      setAvailableSubcategories([]);
    }
  }, [formData.mainCategoryId, subcategories]);

  const handleSave = () => {
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
      console.log('🔍 [DEBUG] Validation passed, calling onSave...');
      
      const budgetItem: BudgetItem = {
        id: uuidv4(), // Generate unique ID
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
    } else {
      console.log('🔍 [DEBUG] Validation failed, save not executed');
    }
  };

  const handleCancel = () => {
    setFormData({
      mainCategoryId: '',
      subCategoryId: '',
      description: '',
      amount: 0,
      accountId: 'none',
      financedFrom: 'Löpande kostnad',
      transferType: 'monthly',
      dailyAmount: 0,
      transferDays: []
    });
    onClose();
  };

  const weekdays = [
    { value: 1, label: 'M', name: 'Måndag' },
    { value: 2, label: 'T', name: 'Tisdag' },
    { value: 3, label: 'O', name: 'Onsdag' },
    { value: 4, label: 'T', name: 'Torsdag' },
    { value: 5, label: 'F', name: 'Fredag' },
    { value: 6, label: 'L', name: 'Lördag' },
    { value: 0, label: 'S', name: 'Söndag' }
  ];

  const handleTransferDaysChange = (days: string[]) => {
    const numericDays = days.map(d => parseInt(d));
    setFormData({ ...formData, transferDays: numericDays });
  };

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
              onValueChange={(value) => setFormData({ ...formData, mainCategoryId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj huvudkategori" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {mainCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
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
                {availableSubcategories.map((subcategory) => (
                  <SelectItem key={subcategory} value={subcategory}>
                    {subcategory}
                  </SelectItem>
                ))}
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

          {type === 'cost' && (
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
          )}

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
          ) : type === 'cost' ? (
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
          ) : (
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
          )}

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
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              (formData.transferType === 'daily' && type === 'cost' ? 
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