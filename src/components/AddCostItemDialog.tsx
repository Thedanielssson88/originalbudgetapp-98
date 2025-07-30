import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { StorageKey, get } from '../services/storageService';

interface AddCostItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: {
    mainCategory: string;
    subcategory: string;
    name: string;
    amount: number;
    account: string;
    financedFrom: string;
    transferType?: 'monthly' | 'daily';
    dailyAmount?: number;
    transferDays?: number[];
  }) => void;
  mainCategories: string[];
  accounts: string[];
}

export const AddCostItemDialog: React.FC<AddCostItemDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  mainCategories, 
  accounts 
}) => {
  const [formData, setFormData] = useState({
    mainCategory: '',
    subcategory: '',
    name: '',
    amount: 0,
    account: 'none',
    financedFrom: 'Löpande kostnad',
    transferType: 'monthly' as 'monthly' | 'daily',
    dailyAmount: 0,
    transferDays: [] as number[]
  });
  
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>({});
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>([]);

  useEffect(() => {
    const loadedSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
    console.log('AddCostItemDialog: Loading subcategories:', loadedSubcategories);
    setSubcategories(loadedSubcategories);
  }, []);

  // Reload subcategories when dialog opens
  useEffect(() => {
    if (isOpen) {
      const loadedSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
      console.log('AddCostItemDialog: Reloading subcategories on dialog open:', loadedSubcategories);
      setSubcategories(loadedSubcategories);
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.mainCategory) {
      const available = subcategories[formData.mainCategory] || [];
      console.log(`AddCostItemDialog: Setting subcategories for ${formData.mainCategory}:`, available);
      setAvailableSubcategories(available);
      setFormData(prev => ({ ...prev, subcategory: '' }));
    } else {
      setAvailableSubcategories([]);
    }
  }, [formData.mainCategory, subcategories]);

  const handleSave = () => {
    console.log('🔍 [DEBUG] AddCostItemDialog handleSave called with formData:', formData);
    
    const isValidAmount = formData.transferType === 'daily' ? 
      formData.dailyAmount > 0 && formData.transferDays.length > 0 : 
      formData.amount > 0;
      
    console.log('🔍 [DEBUG] Validation check:', {
      mainCategory: !!formData.mainCategory,
      subcategory: !!formData.subcategory,
      name: !!formData.name,
      isValidAmount,
      transferType: formData.transferType,
      amount: formData.amount,
      dailyAmount: formData.dailyAmount,
      transferDays: formData.transferDays
    });
      
    if (formData.mainCategory && formData.subcategory && formData.name && isValidAmount) {
      console.log('🔍 [DEBUG] Validation passed, calling onSave...');
      const itemToSave = {
        ...formData,
        account: formData.account === 'none' ? '' : formData.account
      };
      onSave(itemToSave);
      setFormData({
        mainCategory: '',
        subcategory: '',
        name: '',
        amount: 0,
        account: 'none',
        financedFrom: 'Löpande kostnad',
        transferType: 'monthly' as 'monthly' | 'daily',
        dailyAmount: 0,
        transferDays: [] as number[]
      });
      onClose();
    } else {
      console.log('🔍 [DEBUG] Validation failed, save not executed');
    }
  };

  const handleCancel = () => {
    setFormData({
      mainCategory: '',
      subcategory: '',
      name: '',
      amount: 0,
      account: 'none',
      financedFrom: 'Löpande kostnad',
      transferType: 'monthly' as 'monthly' | 'daily',
      dailyAmount: 0,
      transferDays: [] as number[]
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
          <DialogTitle>Lägg till kostnadspost</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="mainCategory">Huvudkategori</Label>
            <Select 
              value={formData.mainCategory} 
              onValueChange={(value) => setFormData({ ...formData, mainCategory: value })}
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
              value={formData.subcategory} 
              onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
              disabled={!formData.mainCategory}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.mainCategory ? "Välj underkategori" : "Välj först huvudkategori"} />
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
            <Label htmlFor="name">Kostnadspost</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Namn på kostnadspost"
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

          <div className="space-y-2">
            <Label htmlFor="account">Konto</Label>
            <Select 
              value={formData.account} 
              onValueChange={(value) => setFormData({ ...formData, account: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj konto" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="none">Inget konto</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="financedFrom">Finansieras från</Label>
            <Select 
              value={formData.financedFrom} 
              onValueChange={(value) => setFormData({ ...formData, financedFrom: value })}
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
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Avbryt
          </Button>
          <Button 
            onClick={handleSave}
            disabled={
              !formData.mainCategory || 
              !formData.subcategory || 
              !formData.name || 
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