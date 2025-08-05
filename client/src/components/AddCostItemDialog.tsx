import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCategoriesHierarchy } from '../hooks/useCategories';
import type { Account } from '@shared/schema';

interface AddCostItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: {
    huvudkategoriId: string;
    underkategoriId: string;
    name: string;
    amount: number;
    accountId?: string;
    financedFrom: string;
    transferType?: 'monthly' | 'daily';
    dailyAmount?: number;
    transferDays?: number[];
  }) => void;
  accounts: Account[];
}

export const AddCostItemDialog: React.FC<AddCostItemDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  accounts 
}) => {
  const { categories, isLoading } = useCategoriesHierarchy();
  
  const [formData, setFormData] = useState({
    huvudkategoriId: '',
    underkategoriId: '',
    name: '',
    amount: 0,
    accountId: 'none',
    financedFrom: 'Löpande kostnad',
    transferType: 'monthly' as 'monthly' | 'daily',
    dailyAmount: 0,
    transferDays: [] as number[]
  });
  
  const [availableUnderkategorier, setAvailableUnderkategorier] = useState<Array<{id: string, name: string}>>([]);

  useEffect(() => {
    if (formData.huvudkategoriId) {
      const selectedCategory = categories.find(cat => cat.id === formData.huvudkategoriId);
      setAvailableUnderkategorier(selectedCategory?.underkategorier || []);
      setFormData(prev => ({ ...prev, underkategoriId: '' }));
    } else {
      setAvailableUnderkategorier([]);
    }
  }, [formData.huvudkategoriId, categories]);

  const handleSave = () => {
    console.log('🔍 [DEBUG] AddCostItemDialog handleSave called with formData:', formData);
    
    const isValidAmount = formData.transferType === 'daily' ? 
      formData.dailyAmount > 0 && formData.transferDays.length > 0 : 
      formData.amount > 0;
      
    console.log('🔍 [DEBUG] Validation check:', {
      huvudkategoriId: !!formData.huvudkategoriId,
      underkategoriId: !!formData.underkategoriId,
      name: !!formData.name,
      isValidAmount,
      transferType: formData.transferType,
      amount: formData.amount,
      dailyAmount: formData.dailyAmount,
      transferDays: formData.transferDays
    });
      
    if (formData.huvudkategoriId && formData.underkategoriId && formData.name && isValidAmount) {
      console.log('🔍 [DEBUG] Validation passed, calling onSave...');
      const itemToSave = {
        huvudkategoriId: formData.huvudkategoriId,
        underkategoriId: formData.underkategoriId,
        name: formData.name,
        amount: formData.amount,
        accountId: formData.accountId === 'none' ? undefined : formData.accountId,
        financedFrom: formData.financedFrom,
        transferType: formData.transferType,
        dailyAmount: formData.transferType === 'daily' ? formData.dailyAmount : undefined,
        transferDays: formData.transferType === 'daily' ? formData.transferDays : undefined
      };
      onSave(itemToSave);
      setFormData({
        huvudkategoriId: '',
        underkategoriId: '',
        name: '',
        amount: 0,
        accountId: 'none',
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
      huvudkategoriId: '',
      underkategoriId: '',
      name: '',
      amount: 0,
      accountId: 'none',
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
            <Label htmlFor="huvudkategori">Huvudkategori</Label>
            <Select 
              value={formData.huvudkategoriId} 
              onValueChange={(value) => setFormData({ ...formData, huvudkategoriId: value })}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Laddar kategorier..." : "Välj huvudkategori"} />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="underkategori">Underkategori</Label>
            <Select 
              value={formData.underkategoriId} 
              onValueChange={(value) => setFormData({ ...formData, underkategoriId: value })}
              disabled={!formData.huvudkategoriId || isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.huvudkategoriId ? "Välj underkategori" : "Välj först huvudkategori"} />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {availableUnderkategorier.map((underkategori) => (
                  <SelectItem key={underkategori.id} value={underkategori.id}>
                    {underkategori.name}
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
              value={formData.accountId} 
              onValueChange={(value) => setFormData({ ...formData, accountId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj konto" />
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
              !formData.huvudkategoriId || 
              !formData.underkategoriId || 
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