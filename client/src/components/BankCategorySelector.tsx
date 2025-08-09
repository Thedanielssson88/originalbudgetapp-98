import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useBudget } from '@/hooks/useBudget';

interface BankCategorySelectorProps {
  selectedBankCategory: string;
  selectedBankSubCategory: string;
  onBankCategoryChange: (category: string) => void;
  onBankSubCategoryChange: (subcategory: string) => void;
  label?: string;
}

export const BankCategorySelector: React.FC<BankCategorySelectorProps> = ({
  selectedBankCategory,
  selectedBankSubCategory,
  onBankCategoryChange,
  onBankSubCategoryChange,
  label = "Bankens kategorier"
}) => {
  const { budgetState } = useBudget();

  // Extract unique bank categories from all transactions
  const { bankCategories, bankCategoryToSubCategories } = React.useMemo(() => {
    const categoryMap = new Map<string, Set<string>>();
    const allTransactions = budgetState?.allTransactions || [];
    
    allTransactions.forEach(transaction => {
      if (transaction.bankCategory && 
          transaction.bankCategory.trim() && 
          transaction.bankCategory !== '-') {
        
        if (!categoryMap.has(transaction.bankCategory)) {
          categoryMap.set(transaction.bankCategory, new Set());
        }
        
        if (transaction.bankSubCategory && 
            transaction.bankSubCategory.trim() && 
            transaction.bankSubCategory !== '-') {
          categoryMap.get(transaction.bankCategory)!.add(transaction.bankSubCategory);
        }
      }
    });

    // Convert to arrays and sort
    const categories = Array.from(categoryMap.keys()).sort();
    const categoryToSubs: { [key: string]: string[] } = {};
    
    categoryMap.forEach((subCats, category) => {
      categoryToSubs[category] = Array.from(subCats).sort();
    });

    return {
      bankCategories: categories,
      bankCategoryToSubCategories: categoryToSubs
    };
  }, [budgetState?.allTransactions]);

  // Get available subcategories based on selected main category
  const availableSubCategories = React.useMemo(() => {
    if (selectedBankCategory === 'Alla Bankkategorier' || !selectedBankCategory) {
      return [];
    }
    
    return bankCategoryToSubCategories[selectedBankCategory] || [];
  }, [selectedBankCategory, bankCategoryToSubCategories]);


  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Bankhuvudkategori</Label>
        <Select
          value={selectedBankCategory || 'Alla Bankkategorier'}
          onValueChange={onBankCategoryChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-y-auto">
            <SelectItem value="Alla Bankkategorier">
              <div className="flex items-center gap-2">
                <span>Alla Bankkategorier</span>
                <Badge variant="outline" className="text-xs">
                  {bankCategories.length} kategorier
                </Badge>
              </div>
            </SelectItem>
            {bankCategories.map(category => {
              const subCount = bankCategoryToSubCategories[category]?.length || 0;
              return (
                <SelectItem key={category} value={category}>
                  <div className="flex items-center gap-2">
                    <span>{category}</span>
                    {subCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {subCount} underkategorier
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">Bankunderkategori</Label>
        <Select
          value={selectedBankSubCategory || 'Alla Bankunderkategorier'}
          onValueChange={onBankSubCategoryChange}
          disabled={selectedBankCategory === 'Alla Bankkategorier' || !selectedBankCategory}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-y-auto">
            <SelectItem value="Alla Bankunderkategorier">
              <div className="flex items-center gap-2">
                <span>Alla Bankunderkategorier</span>
                {availableSubCategories.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {availableSubCategories.length} underkategorier
                  </Badge>
                )}
              </div>
            </SelectItem>
            {availableSubCategories.map(subcategory => (
              <SelectItem key={subcategory} value={subcategory}>
                {subcategory}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};