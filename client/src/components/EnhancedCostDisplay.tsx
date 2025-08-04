import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { BudgetItem, Transaction } from '@/types/budget';
import { AddBudgetItemDialog } from './AddBudgetItemDialog';

// Format currency helper - inline since no utils file exists
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('sv-SE', { 
    style: 'currency', 
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

interface MainCategory {
  id: string;
  name: string;
  icon?: string;
  type: 'cost' | 'savings';
  subCategories?: SubCategory[];
}

interface SubCategory {
  id: string;
  name: string;
  parentId: string;
}

interface EnhancedCostDisplayProps {
  budgetItems: BudgetItem[];
  transactions: Transaction[];
  mainCategories: MainCategory[];
  accounts: any[];
  onAddBudgetItem: (item: BudgetItem) => void;
  onEditBudgetItem?: (item: BudgetItem) => void;
  onDeleteBudgetItem?: (id: string) => void;
}

export const EnhancedCostDisplay: React.FC<EnhancedCostDisplayProps> = ({
  budgetItems,
  transactions,
  mainCategories,
  accounts,
  onAddBudgetItem,
  onEditBudgetItem,
  onDeleteBudgetItem
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState<{
    isOpen: boolean;
    preselectedMainCategory?: string;
    preselectedSubCategory?: string;
  }>({ isOpen: false });

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Filter cost items only
  const costItems = budgetItems.filter(item => {
    const mainCategory = mainCategories.find(cat => cat.id === item.mainCategoryId);
    return mainCategory?.type === 'cost';
  });

  // Calculate actual amounts from transactions
  const calculateActualForCategory = (mainCategoryId: string, subCategoryId?: string): number => {
    return transactions
      .filter(t => {
        if (subCategoryId) {
          return t.appCategoryId === mainCategoryId && t.appSubCategoryId === subCategoryId;
        }
        return t.appCategoryId === mainCategoryId;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  };

  // Group budget items by main category and subcategory
  const categorizedData = mainCategories
    .filter(mainCat => mainCat.type === 'cost')
    .map(mainCategory => {
      // Get all subcategories for this main category
      const subCategories = mainCategory.subCategories || [];
      
      // Get all budget items for this main category
      const mainCategoryItems = costItems.filter(item => item.mainCategoryId === mainCategory.id);
      
      // Calculate totals for main category
      const totalBudget = mainCategoryItems.reduce((sum, item) => sum + item.amount, 0);
      const totalActual = calculateActualForCategory(mainCategory.id);
      const totalDifference = totalActual - totalBudget;

      // Group items by subcategory
      const subCategoryData = subCategories.map(subCategory => {
        const subCategoryItems = mainCategoryItems.filter(item => item.subCategoryId === subCategory.id);
        const subBudget = subCategoryItems.reduce((sum, item) => sum + item.amount, 0);
        const subActual = calculateActualForCategory(mainCategory.id, subCategory.id);
        const subDifference = subActual - subBudget;

        return {
          subCategory,
          items: subCategoryItems,
          budget: subBudget,
          actual: subActual,
          difference: subDifference
        };
      });

      return {
        mainCategory,
        subCategoryData,
        totalBudget,
        totalActual,
        totalDifference,
        hasSubCategories: subCategories.length > 0
      };
    })
    .filter(data => data.totalBudget > 0 || data.totalActual > 0); // Only show categories with data

  const handleAddCostPost = (mainCategoryId?: string, subCategoryId?: string) => {
    setShowAddDialog({
      isOpen: true,
      preselectedMainCategory: mainCategoryId,
      preselectedSubCategory: subCategoryId
    });
  };

  return (
    <Card className="shadow-lg border-0 bg-red-50/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-red-800">
            Budgeterade kostnader
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAddCostPost()}
            className="text-red-600 border-red-200 hover:bg-red-100"
          >
            <Plus className="w-4 h-4 mr-1" />
            Lägg till kostnad
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {categorizedData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Inga kostnadskategorier hittades</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddCostPost()}
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-1" />
              Lägg till första kostnaden
            </Button>
          </div>
        ) : (
          categorizedData.map(({ mainCategory, subCategoryData, totalBudget, totalActual, totalDifference, hasSubCategories }) => (
            <div key={mainCategory.id} className="border border-red-200 rounded-lg bg-white">
              {/* Main Category Header */}
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-red-50"
                onClick={() => hasSubCategories && toggleCategory(mainCategory.id)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-medium text-red-900">{mainCategory.name}</span>
                  {hasSubCategories && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-600"
                    >
                      {expandedCategories.has(mainCategory.id) ? 
                        <ChevronUp className="h-4 w-4" /> : 
                        <ChevronDown className="h-4 w-4" />
                      }
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center min-w-[80px]">
                    <div className="text-red-700 font-medium">Budget</div>
                    <div className="font-semibold text-red-800">{formatCurrency(totalBudget)}</div>
                  </div>
                  <div className="text-center min-w-[80px]">
                    <div className="text-green-600 font-medium">Faktiskt</div>
                    <div className="font-semibold text-green-600">{formatCurrency(totalActual)}</div>
                  </div>
                  <div className="text-center min-w-[80px]">
                    <div className="text-gray-700 font-medium">Skillnad</div>
                    <div className={`font-semibold ${totalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalDifference >= 0 ? '+' : ''}{formatCurrency(totalDifference)}
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddCostPost(mainCategory.id);
                    }}
                    className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Subcategories (expanded) */}
              {hasSubCategories && expandedCategories.has(mainCategory.id) && (
                <div className="border-t border-red-100 bg-red-25">
                  {subCategoryData.map(({ subCategory, items, budget, actual, difference }) => (
                    <div key={subCategory.id} className="flex items-center justify-between p-3 pl-8 hover:bg-red-50/50">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-red-800">{subCategory.name}</span>
                        <span className="text-xs text-red-600">({items.length} poster)</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center min-w-[80px]">
                          <div className="font-semibold text-red-800">{formatCurrency(budget)}</div>
                        </div>
                        <div className="text-center min-w-[80px]">
                          <div className="font-semibold text-green-600">{formatCurrency(actual)}</div>
                        </div>
                        <div className="text-center min-w-[80px]">
                          <div className={`font-semibold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAddCostPost(mainCategory.id, subCategory.id)}
                          className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>

      {/* Add Budget Item Dialog */}
      {showAddDialog.isOpen && (
        <AddBudgetItemDialog
          isOpen={showAddDialog.isOpen}
          onClose={() => setShowAddDialog({ isOpen: false })}
          onSave={(item: BudgetItem) => {
            onAddBudgetItem(item);
            setShowAddDialog({ isOpen: false });
          }}
          mainCategories={mainCategories.map(cat => cat.name)}
          accounts={accounts}
          type="cost"
        />
      )}
    </Card>
  );
};