import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { ImportedTransaction } from '@/types/transaction';
import { CategoryRule } from '@/types/budget';

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
    return !categoryRules.some(rule => {
      if (rule.condition.type === 'categoryMatch') {
        return (rule.condition as any).bankCategory === bankCategory;
      }
      return false;
    });
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
        <Card key={bankCategory} className="p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm">{bankCategory}</h4>
                  <Badge variant="secondary" className="text-xs">{count} st</Badge>
                </div>
                
                {subCategories.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {subCategories.join(', ')}
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Button
                size="sm"
                onClick={() => onCreateRule(bankCategory)}
                className="w-full text-xs h-8"
              >
                <Plus className="w-3 h-3 mr-1" />
                Skapa regel för "{bankCategory}"
              </Button>
              
              {subCategories.map(subCategory => (
                <Button
                  key={subCategory}
                  size="sm"
                  variant="outline"
                  onClick={() => onCreateRule(bankCategory, subCategory)}
                  className="w-full text-xs h-8"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Regel för "{subCategory}"
                </Button>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};