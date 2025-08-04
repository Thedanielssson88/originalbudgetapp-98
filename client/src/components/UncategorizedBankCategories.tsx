import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { ImportedTransaction } from '@/types/transaction';
import { CategoryRule } from '@/types/budget';
import { addMobileDebugLog } from '@/utils/mobileDebugLogger';

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
  const [showHiddenSubcategories, setShowHiddenSubcategories] = React.useState(false);
  
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

  // Helper function to check if a specific combination has a rule
  const hasRuleForCombination = (bankCategory: string, bankSubCategory?: string) => {
    return categoryRules.some(rule => {
      if (!rule || !rule.condition) return false;
      
      if (rule.condition.type === 'categoryMatch') {
        const ruleCondition = rule.condition as any;
        // Exact match for both category and subcategory
        return ruleCondition.bankCategory === bankCategory && 
               (bankSubCategory ? ruleCondition.bankSubCategory === bankSubCategory : !ruleCondition.bankSubCategory);
      }
      
      // Text-based rules that could match this category
      if (rule.condition.type === 'textContains') {
        const ruleValue = (rule.condition as any).value?.toLowerCase() || '';
        return bankCategory.toLowerCase().includes(ruleValue) && ruleValue.length > 0;
      }
      
      if (rule.condition.type === 'textStartsWith') {
        const ruleValue = (rule.condition as any).value?.toLowerCase() || '';
        return bankCategory.toLowerCase().startsWith(ruleValue) && ruleValue.length > 0;
      }
      
      return false;
    });
  };

  // Process categories to show available subcategories
  const processedCategories = bankCategories.map(({ bankCategory, count, subCategories }) => {
    // Filter subcategories - hide those with rules unless showHidden is true
    const availableSubcategories = subCategories.filter(subCategory => {
      const hasRule = hasRuleForCombination(bankCategory, subCategory);
      return showHiddenSubcategories || !hasRule;
    });
    
    // Check if main category (without subcategory) has a rule
    const mainCategoryHasRule = hasRuleForCombination(bankCategory);
    
    return {
      bankCategory,
      count,
      subCategories: availableSubcategories,
      mainCategoryHasRule,
      showMainCategoryButton: showHiddenSubcategories || !mainCategoryHasRule
    };
  });

  // Only filter out categories that have no available options at all
  const uncategorizedCategories = processedCategories.filter(({ subCategories, showMainCategoryButton }) => {
    return showMainCategoryButton || subCategories.length > 0;
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
      {/* Toggle button for showing hidden subcategories */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {uncategorizedCategories.length} kategorier
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHiddenSubcategories(!showHiddenSubcategories)}
          className="text-xs"
        >
          {showHiddenSubcategories ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
          {showHiddenSubcategories ? 'Dölj befintliga regler' : 'Visa dolda underkategorier'}
        </Button>
      </div>

      {uncategorizedCategories.map(({ bankCategory, count, subCategories, showMainCategoryButton }) => (
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
              {showMainCategoryButton && (
                <Button
                  size="sm"
                  onClick={() => onCreateRule(bankCategory)}
                  className="w-full text-xs h-8"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Skapa regel för "{bankCategory}"
                </Button>
              )}
              
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