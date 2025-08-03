import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { get, StorageKey } from '@/services/storageService';

interface CategorySelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mainCategory: string, subCategory: string) => void;
  bankCategory: string;
  bankSubCategory?: string;
  mainCategories: string[];
}

export const CategorySelectionDialog: React.FC<CategorySelectionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  bankCategory,
  bankSubCategory,
  mainCategories
}) => {
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
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
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (selectedMainCategory && selectedSubCategory) {
      onConfirm(selectedMainCategory, selectedSubCategory);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedMainCategory('');
    setSelectedSubCategory('');
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