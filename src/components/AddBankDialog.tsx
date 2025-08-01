import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

interface AddBankDialogProps {
  onAddBank: (bankName: string) => void;
  trigger?: React.ReactNode;
}

export const AddBankDialog: React.FC<AddBankDialogProps> = ({ onAddBank, trigger }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [bankName, setBankName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bankName.trim()) {
      onAddBank(bankName.trim());
      setBankName('');
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Lägg till bank
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till ny bank</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bankName">Banknamn</Label>
            <Input
              id="bankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="T.ex. Danske Bank"
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={!bankName.trim()}>
              Lägg till
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};