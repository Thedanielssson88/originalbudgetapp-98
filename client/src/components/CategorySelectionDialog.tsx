import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { get, StorageKey } from '@/services/storageService';
import { useQuery } from '@tanstack/react-query';
import type { Huvudkategori, Underkategori } from '@shared/schema';

interface CategorySelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    mainCategory: string, 
    subCategory: string, 
    positiveTransactionType: string,
    negativeTransactionType: string,
    applicableAccountIds: string[],
    autoApproval: boolean
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
  const [autoApproval, setAutoApproval] = useState(false);
  // Load categories from PostgreSQL database using React Query
  const { data: huvudkategorier = [], isLoading: isLoadingHuvudkategorier } = useQuery<Huvudkategori[]>({
    queryKey: ['/api/huvudkategorier'],
    queryFn: async () => {
      const response = await fetch('/api/huvudkategorier');
      if (!response.ok) throw new Error('Failed to fetch huvudkategorier');
      return response.json();
    }
  });

  const { data: underkategorier = [], isLoading: isLoadingUnderkategorier } = useQuery<Underkategori[]>({
    queryKey: ['/api/underkategorier'],
    queryFn: async () => {
      const response = await fetch('/api/underkategorier');
      if (!response.ok) throw new Error('Failed to fetch underkategorier');
      return response.json();
    }
  });

  // Get available subcategories for the selected main category
  const availableSubcategories = underkategorier.filter(
    sub => sub.huvudkategoriId === selectedMainCategory
  );

  // Reset subcategory when main category changes
  useEffect(() => {
    if (selectedMainCategory) {
      setSelectedSubCategory('');
    }
  }, [selectedMainCategory]);

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
      // Find the actual category names for display purposes
      const selectedHuvudkategori = huvudkategorier.find(cat => cat.id === selectedMainCategory);
      const selectedUnderkategori = underkategorier.find(cat => cat.id === selectedSubCategory);
      
      console.log('🔍 [CATEGORY DIALOG] Creating rule with:', {
        huvudkategoriId: selectedMainCategory,
        huvudkategoriName: selectedHuvudkategori?.name,
        underkategoriId: selectedSubCategory,
        underkategoriName: selectedUnderkategori?.name,
        bankCategory,
        bankSubCategory
      });
      
      onConfirm(
        selectedMainCategory,  // This will now be UUID
        selectedSubCategory,   // This will now be UUID
        positiveTransactionType,
        negativeTransactionType,
        selectedAccountIds,
        autoApproval
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
                {huvudkategorier.filter(category => category.id && category.id !== '').map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
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
                <SelectItem value="Inkomst">Inkomst</SelectItem>
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
                {availableSubcategories.filter(subcategory => subcategory.id && subcategory.id !== '').map(subcategory => (
                  <SelectItem key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="auto-approval">Godkänn automatiskt</Label>
            <Select 
              value={autoApproval ? 'ja' : 'nej'} 
              onValueChange={(value) => setAutoApproval(value === 'ja')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ja">Ja</SelectItem>
                <SelectItem value="nej">Nej</SelectItem>
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