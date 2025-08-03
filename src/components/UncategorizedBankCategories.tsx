import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { ImportedTransaction, CategoryRule } from '@/types/transaction';

interface UncategorizedBankCategoriesProps {
  transactions: ImportedTransaction[];
  categoryRules: CategoryRule[];
  onCreateRule: (bankCategory: string, bankSubCategory?: string) => void;
}

export const UncategorizedBankCategories: React.FC<UncategorizedBankCategoriesProps> = ({
  transactions,
  categoryRules,
  onCreateRule
}) => {
  // Extract unique bank categories from transactions
  const bankCategories = React.useMemo(() => {
    const categoryMap = new Map<string, { count: number; subCategories: Set<string> }>();
    
    transactions.forEach(transaction => {
      if (transaction.bankCategory) {
        const key = transaction.bankCategory;
        if (!categoryMap.has(key)) {
          categoryMap.set(key, { count: 0, subCategories: new Set() });
        }
        const entry = categoryMap.get(key)!;
        entry.count++;
        
        if (transaction.bankSubCategory) {
          entry.subCategories.add(transaction.bankSubCategory);
        }
      }
    });
    
    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      bankCategory: category,
      count: data.count,
      subCategories: Array.from(data.subCategories)
    }));
  }, [transactions]);

  // Filter out categories that already have rules
  const uncategorizedCategories = bankCategories.filter(({ bankCategory }) => {
    return !categoryRules.some(rule => 
      rule.bankCategory === bankCategory
    );
  });

  if (uncategorizedCategories.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Alla bankkategorier har regler konfigurerade!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {uncategorizedCategories.map(({ bankCategory, count, subCategories }) => (
        <Card key={bankCategory} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium">{bankCategory}</h4>
                <Badge variant="secondary">{count} transaktioner</Badge>
              </div>
              
              {subCategories.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Underkategorier: {subCategories.join(', ')}
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => onCreateRule(bankCategory)}
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Skapa regel
              </Button>
              
              {subCategories.map(subCategory => (
                <Button
                  key={subCategory}
                  size="sm"
                  variant="outline"
                  onClick={() => onCreateRule(bankCategory, subCategory)}
                  className="text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {subCategory}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};