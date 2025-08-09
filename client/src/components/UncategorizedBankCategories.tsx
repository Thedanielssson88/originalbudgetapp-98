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
  huvudkategorier: any[];
  underkategorier: any[];
}

export const UncategorizedBankCategories: React.FC<UncategorizedBankCategoriesProps> = ({
  transactions,
  categoryRules,
  onCreateRule,
  huvudkategorier,
  underkategorier
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
      if (!rule) return false;
      
      // NEW: Check modern PostgreSQL rules format (direct fields)
      if (rule.bankhuvudkategori) {
        // Exact match for bank category and subcategory
        const categoryMatch = rule.bankhuvudkategori === bankCategory;
        const subcategoryMatch = bankSubCategory ? 
          (rule.bankunderkategori === bankSubCategory) : 
          (!rule.bankunderkategori || rule.bankunderkategori === '');
        return categoryMatch && subcategoryMatch;
      }
      
      // LEGACY: Check old format with conditions (for backward compatibility)
      if (rule.condition) {
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
      }
      
      return false;
    });
  };

  // Helper function to check if bank category matches app category by name
  const matchesAppCategory = (bankCategory: string, bankSubCategory?: string) => {
    // Find matching huvudkategori by name
    const matchingHuvudkategori = huvudkategorier.find(hk => 
      hk.name.trim().toLowerCase() === bankCategory.trim().toLowerCase()
    );
    
    if (!matchingHuvudkategori) {
      return false;
    }
    
    // If no subcategory specified, just matching huvudkategori is enough
    if (!bankSubCategory) {
      return true;
    }
    
    // Find matching underkategori by name within the huvudkategori
    const matchingUnderkategori = underkategorier.find(uk => 
      uk.huvudkategoriId === matchingHuvudkategori.id &&
      uk.name.trim().toLowerCase() === bankSubCategory.trim().toLowerCase()
    );
    
    return !!matchingUnderkategori;
  };

  // Process categories to categorize them into different types
  const processedCategories = bankCategories.map(({ bankCategory, count, subCategories }) => {
    // Process subcategories with their category types
    const processedSubcategories = subCategories.map(subCategory => {
      const hasRule = hasRuleForCombination(bankCategory, subCategory);
      const matchesApp = matchesAppCategory(bankCategory, subCategory);
      
      let categoryType: 'uncategorized' | 'hasRule' | 'matchesApp' = 'uncategorized';
      if (hasRule) {
        categoryType = 'hasRule';
      } else if (matchesApp) {
        categoryType = 'matchesApp';
      }
      
      return {
        name: subCategory,
        type: categoryType,
        show: showHiddenSubcategories || categoryType === 'uncategorized'
      };
    });
    
    // Check main category type
    const mainCategoryHasRule = hasRuleForCombination(bankCategory);
    const mainCategoryMatchesApp = matchesAppCategory(bankCategory);
    
    let mainCategoryType: 'uncategorized' | 'hasRule' | 'matchesApp' = 'uncategorized';
    if (mainCategoryHasRule) {
      mainCategoryType = 'hasRule';
    } else if (mainCategoryMatchesApp) {
      mainCategoryType = 'matchesApp';
    }
    
    return {
      bankCategory,
      count,
      subCategories: processedSubcategories.filter(sub => sub.show),
      allSubCategories: processedSubcategories, // Keep all for when showing hidden
      mainCategoryType,
      showMainCategoryButton: showHiddenSubcategories || mainCategoryType === 'uncategorized'
    };
  });

  // Only show categories that have visible options or main button
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

      {uncategorizedCategories.map(({ bankCategory, count, subCategories, allSubCategories, showMainCategoryButton, mainCategoryType }) => {
        // Get the appropriate color classes for main category
        const getMainCategoryClasses = (type: 'uncategorized' | 'hasRule' | 'matchesApp') => {
          switch (type) {
            case 'hasRule':
              return showHiddenSubcategories ? 'bg-blue-50 border-blue-200' : '';
            case 'matchesApp':
              return showHiddenSubcategories ? 'bg-green-50 border-green-200' : '';
            default:
              return '';
          }
        };

        // Get the subcategories to show (all when showing hidden, or just visible ones)
        const subcategoriesToShow = showHiddenSubcategories ? allSubCategories : subCategories;

        return (
          <Card key={bankCategory} className={`p-3 ${getMainCategoryClasses(mainCategoryType)}`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{bankCategory}</h4>
                    <Badge variant="secondary" className="text-xs">{count} st</Badge>
                    {showHiddenSubcategories && mainCategoryType === 'hasRule' && (
                      <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300">Regel finns</Badge>
                    )}
                    {showHiddenSubcategories && mainCategoryType === 'matchesApp' && (
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">Matchar app</Badge>
                    )}
                  </div>
                  
                  {subcategoriesToShow.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {subcategoriesToShow.map(sub => sub.name).join(', ')}
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
                    disabled={mainCategoryType !== 'uncategorized' && !showHiddenSubcategories}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Skapa regel för "{bankCategory}"
                  </Button>
                )}
                
                {subcategoriesToShow.map(subCategory => {
                  const getSubCategoryClasses = (type: 'uncategorized' | 'hasRule' | 'matchesApp') => {
                    switch (type) {
                      case 'hasRule':
                        return showHiddenSubcategories ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' : '';
                      case 'matchesApp':
                        return showHiddenSubcategories ? 'bg-green-50 border-green-200 hover:bg-green-100' : '';
                      default:
                        return '';
                    }
                  };

                  return (
                    <div key={subCategory.name} className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCreateRule(bankCategory, subCategory.name)}
                        className={`flex-1 text-xs h-8 ${getSubCategoryClasses(subCategory.type)}`}
                        disabled={subCategory.type !== 'uncategorized' && !showHiddenSubcategories}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Regel för "{subCategory.name}"
                      </Button>
                      {showHiddenSubcategories && subCategory.type === 'hasRule' && (
                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300">Regel finns</Badge>
                      )}
                      {showHiddenSubcategories && subCategory.type === 'matchesApp' && (
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">Matchar app</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};