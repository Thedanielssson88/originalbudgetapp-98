import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { SubCategory } from "@/types/budget";
import { Edit, Trash2 } from "lucide-react";

interface CostItemEditDialogProps {
  item: SubCategory & { groupId: string; categoryName: string };
  accounts: string[];
  categories: string[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedItem: SubCategory & { groupId: string }) => void;
  onDelete: (groupId: string, itemId: string) => void;
}

const WEEKDAYS = [
  { id: 1, name: 'Måndag' },
  { id: 2, name: 'Tisdag' },
  { id: 3, name: 'Onsdag' },
  { id: 4, name: 'Torsdag' },
  { id: 5, name: 'Fredag' },
  { id: 6, name: 'Lördag' },
  { id: 0, name: 'Söndag' }
];

export const CostItemEditDialog: React.FC<CostItemEditDialogProps> = ({
  item,
  accounts,
  categories,
  isOpen,
  onClose,
  onSave,
  onDelete
}) => {
  const [editedItem, setEditedItem] = useState<SubCategory & { groupId: string; categoryName: string }>(item);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    setEditedItem(item);
  }, [item]);

  const handleSave = () => {
    onSave(editedItem);
    onClose();
  };

  const handleCancel = () => {
    setEditedItem(item); // Reset to original values
    onClose();
  };

  const handleDelete = () => {
    onDelete(editedItem.groupId, editedItem.id);
    setIsDeleteDialogOpen(false);
    onClose();
  };

  const updateField = (field: keyof SubCategory, value: any) => {
    setEditedItem(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleTransferDay = (day: number) => {
    const currentDays = editedItem.transferDays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();
    
    updateField('transferDays', newDays);
  };

  const isDailyTransfer = editedItem.transferType === 'daily';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Redigera kostnadspost
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Huvudkategori */}
          <div className="space-y-2">
            <Label htmlFor="category">Huvudkategori</Label>
            <Select 
              value={editedItem.categoryName} 
              onValueChange={(value) => setEditedItem(prev => ({ ...prev, categoryName: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj huvudkategori" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Underkategori (Kostnadspost) */}
          <div className="space-y-2">
            <Label htmlFor="name">Underkategori</Label>
            <Input
              id="name"
              value={editedItem.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Namn på underkategori"
            />
          </div>

          {/* Överföringstyp */}
          <div className="space-y-2">
            <Label>Överföringstyp</Label>
            <Select 
              value={editedItem.transferType || 'monthly'} 
              onValueChange={(value) => updateField('transferType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Fast Månadsföring</SelectItem>
                <SelectItem value="daily">Daglig överföring</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Belopp fält - conditional baserat på transfer type */}
          {isDailyTransfer ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="dailyAmount">Belopp per dag</Label>
                <Input
                  id="dailyAmount"
                  type="number"
                  value={editedItem.dailyAmount || 0}
                  onChange={(e) => updateField('dailyAmount', Number(e.target.value) || 0)}
                  placeholder="Belopp per dag"
                />
              </div>

              <div className="space-y-3">
                <Label>Överföringsdagar</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WEEKDAYS.map((day) => (
                    <div key={day.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.id}`}
                        checked={(editedItem.transferDays || []).includes(day.id)}
                        onCheckedChange={() => toggleTransferDay(day.id)}
                      />
                      <Label htmlFor={`day-${day.id}`} className="text-sm">
                        {day.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="amount">Belopp</Label>
              <Input
                id="amount"
                type="number"
                value={editedItem.amount || 0}
                onChange={(e) => updateField('amount', Number(e.target.value) || 0)}
                placeholder="Månatligt belopp"
              />
            </div>
          )}

          {/* Konto */}
          <div className="space-y-2">
            <Label>Konto</Label>
            <Select 
              value={editedItem.account || ''} 
              onValueChange={(value) => updateField('account', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj konto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Inget konto</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Finansieras ifrån */}
          <div className="space-y-2">
            <Label>Finansieras ifrån</Label>
            <Select 
              value={editedItem.financedFrom || 'Löpande kostnad'} 
              onValueChange={(value) => updateField('financedFrom', value as 'Löpande kostnad' | 'Enskild kostnad')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Löpande kostnad">Löpande kostnad</SelectItem>
                <SelectItem value="Enskild kostnad">Enskild kostnad</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Ta bort
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ta bort kostnadspost</AlertDialogTitle>
                <AlertDialogDescription>
                  Är du säker på att du vill ta bort "{editedItem.name}"? 
                  Denna åtgärd kan inte ångras.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Bekräfta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Avbryt
            </Button>
            <Button onClick={handleSave}>
              Spara
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};