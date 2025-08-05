import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategoriesHierarchy } from '../hooks/useCategories';
import type { Account } from '@shared/schema';

interface AddSavingsItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: {
    huvudkategoriId: string;
    underkategoriId: string;
    name: string;
    amount: number;
    accountId: string;
  }) => void;
  accounts: Account[];
}

export const AddSavingsItemDialog: React.FC<AddSavingsItemDialogProps> = ({ 
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
    accountId: 'none'
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
    if (formData.huvudkategoriId && formData.underkategoriId && formData.name && formData.amount > 0) {
      const itemToSave = {
        huvudkategoriId: formData.huvudkategoriId,
        underkategoriId: formData.underkategoriId,
        name: formData.name,
        amount: formData.amount,
        accountId: formData.accountId === 'none' ? '' : formData.accountId
      };
      onSave(itemToSave);
      setFormData({
        huvudkategoriId: '',
        underkategoriId: '',
        name: '',
        amount: 0,
        accountId: 'none'
      });
      onClose();
    }
  };

  const handleCancel = () => {
    setFormData({
      huvudkategoriId: '',
      underkategoriId: '',
      name: '',
      amount: 0,
      accountId: 'none'
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till sparpost</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
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
            <Label htmlFor="name">Beskrivning</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Beskrivning av sparandet"
            />
          </div>

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
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Avbryt
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!formData.huvudkategoriId || !formData.underkategoriId || !formData.name || formData.amount <= 0}
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};