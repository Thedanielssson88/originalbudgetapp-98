import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { get, StorageKey } from '@/services/storageService';

interface CategorySelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    mainCategory: string, 
    subCategory: string, 
    positiveTransactionType: string,
    negativeTransactionType: string,
    applicableAccountIds: string[]
  ) => void;
  bankCategory: string;
  bankSubCategory?: string;
  mainCategories: string[];
  accounts: { id: string; name: string }[];
}

export const CategorySelectionDialog: React.FC<CategorySelectionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  bankCategory,
  bankSubCategory,
  mainCategories,
  accounts
}) => {
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [positiveTransactionType, setPositiveTransactionType] = useState('Transaction');
  const [negativeTransactionType, setNegativeTransactionType] = useState('Transaction');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>({});
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>([]);

  // Load subcategories from storage
  useEffect(() => {
    const loadedSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
    setSubcategories(loadedSubcategories);
  }, []);

  // Update available subcategories when main category changes
  useEffect(() => {
    if (selectedMainCategory) {
      setAvailableSubcategories(subcategories[selectedMainCategory] || []);
      setSelectedSubCategory('');
    } else {
      setAvailableSubcategories([]);
    }
  }, [selectedMainCategory, subcategories]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMainCategory('');
      setSelectedSubCategory('');
      setPositiveTransactionType('Transaction');
      setNegativeTransactionType('Transaction');
      setSelectedAccountIds([]);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (selectedMainCategory && selectedSubCategory) {
      onConfirm(
        selectedMainCategory, 
        selectedSubCategory, 
        positiveTransactionType,
        negativeTransactionType,
        selectedAccountIds
      );
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedMainCategory('');
    setSelectedSubCategory('');
    setPositiveTransactionType('Transaction');
    setNegativeTransactionType('Transaction');
    setSelectedAccountIds([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa kategoriregel</DialogTitle>
          <DialogDescription>
            Välj vilken huvudkategori och underkategori som transaktioner med bankens kategori "{bankCategory}"
            {bankSubCategory && ` (${bankSubCategory})`} ska mappas till.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="main-category">Huvudkategori</Label>
            <Select value={selectedMainCategory} onValueChange={setSelectedMainCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Välj huvudkategori" />
              </SelectTrigger>
              <SelectContent>
                {mainCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="positive-transaction-type">Transaktionstyp (Positiva belopp)</Label>
            <Select value={positiveTransactionType} onValueChange={setPositiveTransactionType}>
              <SelectTrigger>
                <SelectValue placeholder="Välj typ för positiva belopp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Transaction">Transaktion</SelectItem>
                <SelectItem value="InternalTransfer">Intern Överföring</SelectItem>
                <SelectItem value="Savings">Sparande</SelectItem>
                <SelectItem value="CostCoverage">Täck en kostnad</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="negative-transaction-type">Transaktionstyp (Negativa belopp)</Label>
            <Select value={negativeTransactionType} onValueChange={setNegativeTransactionType}>
              <SelectTrigger>
                <SelectValue placeholder="Välj typ för negativa belopp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Transaction">Transaktion</SelectItem>
                <SelectItem value="InternalTransfer">Intern Överföring</SelectItem>
                <SelectItem value="ExpenseClaim">Utlägg</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="accounts">Konton som regeln gäller för</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedAccountIds.length === 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAccountIds([]);
                    }
                  }}
                />
                <span className="text-sm">Alla konton</span>
              </label>
              {accounts.map(account => (
                <label key={account.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedAccountIds.includes(account.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAccountIds([...selectedAccountIds, account.id]);
                      } else {
                        setSelectedAccountIds(selectedAccountIds.filter(id => id !== account.id));
                      }
                    }}
                  />
                  <span className="text-sm">{account.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="sub-category">Underkategori</Label>
            <Select 
              value={selectedSubCategory} 
              onValueChange={setSelectedSubCategory}
              disabled={!selectedMainCategory}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj underkategori" />
              </SelectTrigger>
              <SelectContent>
                {availableSubcategories.map(subcategory => (
                  <SelectItem key={subcategory} value={subcategory}>
                    {subcategory}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Avbryt
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!selectedMainCategory || !selectedSubCategory}
          >
            Skapa regel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};