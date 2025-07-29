import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddCostItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: {
    mainCategory: string;
    name: string;
    amount: number;
    account: string;
    financedFrom: string;
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
    name: '',
    amount: 0,
    account: '',
    financedFrom: 'Löpande kostnad'
  });

  const handleSave = () => {
    if (formData.mainCategory && formData.name && formData.amount > 0) {
      onSave(formData);
      setFormData({
        mainCategory: '',
        name: '',
        amount: 0,
        account: '',
        financedFrom: 'Löpande kostnad'
      });
      onClose();
    }
  };

  const handleCancel = () => {
    setFormData({
      mainCategory: '',
      name: '',
      amount: 0,
      account: '',
      financedFrom: 'Löpande kostnad'
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till kostnadspost</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
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
            <Label htmlFor="name">Kostnadspost</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Namn på kostnadspost"
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
              value={formData.account} 
              onValueChange={(value) => setFormData({ ...formData, account: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj konto" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="">Inget konto</SelectItem>
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
                <SelectItem value="Gemensam kostnad">Gemensam kostnad</SelectItem>
                <SelectItem value="Andreas personlig kostnad">Andreas personlig kostnad</SelectItem>
                <SelectItem value="Susanna personlig kostnad">Susanna personlig kostnad</SelectItem>
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
            disabled={!formData.mainCategory || !formData.name || formData.amount <= 0}
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};