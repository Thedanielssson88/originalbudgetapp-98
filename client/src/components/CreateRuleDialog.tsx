import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RuleCondition } from '@/types/budget';
import { useHuvudkategorier, useUnderkategorier } from '@/hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { ImportedTransaction } from '@/types/transaction';
import { useBudget } from '@/hooks/useBudget';

interface CreateRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: ImportedTransaction;
  accounts: { id: string; name: string }[];
  availableBankCategories?: string[];
  availableBankSubCategories?: string[];
}

export const CreateRuleDialog: React.FC<CreateRuleDialogProps> = ({
  open,
  onOpenChange,
  transaction,
  accounts,
  availableBankCategories = [],
  availableBankSubCategories = []
}) => {
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: allUnderkategorier = [] } = useUnderkategorier();
  const queryClient = useQueryClient();
  const { budgetState } = useBudget();

  // Create a mapping of bank categories to their subcategories
  const bankCategoryToSubCategories = useMemo(() => {
    const mapping: { [category: string]: string[] } = {};
    const allTransactions = budgetState?.allTransactions || [];
    
    allTransactions.forEach(tx => {
      if (tx.bankCategory && tx.bankSubCategory && 
          tx.bankCategory.trim() && tx.bankCategory !== '-' &&
          tx.bankSubCategory.trim() && tx.bankSubCategory !== '-') {
        if (!mapping[tx.bankCategory]) {
          mapping[tx.bankCategory] = [];
        }
        if (!mapping[tx.bankCategory].includes(tx.bankSubCategory)) {
          mapping[tx.bankCategory].push(tx.bankSubCategory);
        }
      }
    });
    
    // Sort subcategories for each category
    Object.keys(mapping).forEach(category => {
      mapping[category].sort();
    });
    
    return mapping;
  }, [budgetState?.allTransactions]);
  
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [newRule, setNewRule] = useState<Partial<{
    condition: RuleCondition;
    action: any;
    transactionDirection: 'all' | 'positive' | 'negative';
    priority: number;
    isActive: string;
    bankCategory: string;
    bankSubCategory: string;
  }>>({
    condition: { type: 'textContains', value: transaction?.description || '' },
    action: { 
      appMainCategoryId: '', 
      appSubCategoryId: '', 
      positiveTransactionType: 'Transaction',
      negativeTransactionType: 'Transaction',
      applicableAccountIds: []
    },
    transactionDirection: 'all',
    priority: 100,
    isActive: 'true',
    bankCategory: 'Alla Bankkategorier',
    bankSubCategory: 'Alla Bankunderkategorier'
  });

  // Update available subcategories when main category changes
  useEffect(() => {
    if (newRule.action?.appMainCategoryId) {
      const subcatsForCategory = allUnderkategorier.filter(
        sub => sub.huvudkategoriId === newRule.action?.appMainCategoryId
      );
      setAvailableSubcategories(subcatsForCategory.map(sub => sub.id));
      // Reset subcategory when main category changes
      setNewRule(prev => ({
        ...prev,
        action: { ...prev.action!, appSubCategoryId: '' }
      }));
    } else {
      setAvailableSubcategories([]);
    }
  }, [newRule.action?.appMainCategoryId, allUnderkategorier]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open && transaction) {
      setNewRule({
        condition: { type: 'textContains', value: transaction.description || '' },
        action: { 
          appMainCategoryId: '', 
          appSubCategoryId: '', 
          positiveTransactionType: 'Transaction',
          negativeTransactionType: 'Transaction',
          applicableAccountIds: []
        },
        transactionDirection: 'all',
        priority: 100,
        isActive: 'true',
        bankCategory: 'Alla Bankkategorier',
        bankSubCategory: 'Alla Bankunderkategorier'
      });
      setSelectedAccountIds([]);
    }
  }, [open, transaction]);

  const handleCreateRule = async () => {
    // Validate required fields
    const hasConditionValue = newRule.condition?.type === 'categoryMatch' ? 
      !!(newRule.condition as any).bankCategory : 
      !!(newRule.condition as any).value;
    
    const hasMainCategory = !!newRule.action?.appMainCategoryId;
    const hasSubCategory = !!newRule.action?.appSubCategoryId;
    
    if (newRule.condition && newRule.action && hasConditionValue && hasMainCategory && hasSubCategory) {
      try {
        const rulePayload = {
          ruleName: newRule.condition.type === 'categoryMatch' ? 
            `${newRule.bankCategory}/${newRule.bankSubCategory}` : 
            `${newRule.condition.type}: ${(newRule.condition as any).value}`,
          transactionName: newRule.condition.type === 'categoryMatch' ? 
            (newRule.condition as any).bankCategory || newRule.bankCategory : 
            (newRule.condition as any).value,
          ruleType: newRule.condition.type,
          // Include bankCategory/bankSubCategory for categoryMatch rules
          ...(newRule.condition.type === 'categoryMatch' ? {
            bankCategory: newRule.bankCategory === 'Alla Bankkategorier' ? null : newRule.bankCategory,
            bankSubCategory: newRule.bankSubCategory === 'Alla Bankunderkategorier' ? null : newRule.bankSubCategory
          } : {}),
          transactionDirection: newRule.transactionDirection || 'all',
          huvudkategoriId: newRule.action.appMainCategoryId,
          underkategoriId: newRule.action.appSubCategoryId,
          positiveTransactionType: newRule.action.positiveTransactionType || 'Transaction',
          negativeTransactionType: newRule.action.negativeTransactionType || 'Transaction',
          applicableAccountIds: JSON.stringify(newRule.action.applicableAccountIds || []),
          priority: newRule.priority || 100,
          isActive: 'true',
          autoApproval: newRule.action.autoApproval || false,
          userId: 'dev-user-123'
        };

        const response = await fetch('/api/category-rules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rulePayload),
        });

        if (!response.ok) {
          throw new Error(`Failed to create category rule: ${response.statusText}`);
        }

        await response.json();
        
        // Refresh the rules list
        queryClient.invalidateQueries({ queryKey: ['/api/category-rules'] });
        
        // Close dialog
        onOpenChange(false);
        
        console.log('✅ Rule created successfully');
      } catch (error) {
        console.error('❌ Failed to save rule:', error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa ny regel</DialogTitle>
          <DialogDescription>
            Skapa en automatisk regel för kategorisering av transaktioner.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm">Regeltyp</Label>
            <Select
              value={newRule.condition?.type || 'textContains'}
              onValueChange={(value) => setNewRule({
                ...newRule,
                condition: { type: value as any, value: transaction?.description || '' }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="textContains">Text innehåller</SelectItem>
                <SelectItem value="textStartsWith">Text börjar med</SelectItem>
                <SelectItem value="exactText">Exakt text</SelectItem>
                <SelectItem value="categoryMatch">Bankens kategori</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {newRule.condition?.type !== 'categoryMatch' ? (
            <div>
              <Label className="text-sm">Villkor</Label>
              <Input
                placeholder={
                  newRule.condition?.type === 'textContains' ? 'Text som ska sökas efter (eller * för alla)' :
                  newRule.condition?.type === 'textStartsWith' ? 'Text som transaktionen börjar med (eller * för alla)' :
                  newRule.condition?.type === 'exactText' ? 'Exakt text som ska matchas (eller * för alla)' :
                  'Bankens kategorinamn (eller * för alla)'
                }
                value={(newRule.condition as any)?.value || ''}
                onChange={(e) => setNewRule({
                  ...newRule,
                  condition: { ...newRule.condition!, value: e.target.value } as RuleCondition
                })}
              />
            </div>
          ) : (
            <>
              <div>
                <Label className="text-sm">Bankhuvudkategori</Label>
                <Select
                  value={newRule.bankCategory || 'Alla Bankkategorier'}
                  onValueChange={(value) => setNewRule({
                    ...newRule,
                    bankCategory: value,
                    bankSubCategory: 'Alla Bankunderkategorier' // Reset subcategory
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alla Bankkategorier">Alla Bankkategorier</SelectItem>
                    {availableBankCategories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-sm">Bankunderkategori</Label>
                <Select
                  value={newRule.bankSubCategory || 'Alla Bankunderkategorier'}
                  onValueChange={(value) => setNewRule({
                    ...newRule,
                    bankSubCategory: value
                  })}
                  disabled={newRule.bankCategory === 'Alla Bankkategorier'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alla Bankunderkategorier">Alla Bankunderkategorier</SelectItem>
                    {(() => {
                      const bankCategory = newRule.bankCategory;
                      if (bankCategory && bankCategory !== 'Alla Bankkategorier' && bankCategoryToSubCategories[bankCategory]) {
                        return bankCategoryToSubCategories[bankCategory].map(subcategory => (
                          <SelectItem key={subcategory} value={subcategory}>
                            {subcategory}
                          </SelectItem>
                        ));
                      }
                      return availableBankSubCategories.map(subcategory => (
                        <SelectItem key={subcategory} value={subcategory}>
                          {subcategory}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div>
            <Label className="text-sm">Transaktion</Label>
            <Select
              value={newRule.transactionDirection || 'all'}
              onValueChange={(value: 'all' | 'positive' | 'negative') => setNewRule({
                ...newRule,
                transactionDirection: value
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla transaktioner</SelectItem>
                <SelectItem value="positive">Positiva transaktioner</SelectItem>
                <SelectItem value="negative">Negativa transaktioner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">Huvudkategori</Label>
            <Select
              value={newRule.action?.appMainCategoryId || ''}
              onValueChange={(value) => setNewRule({
                ...newRule,
                action: { ...newRule.action!, appMainCategoryId: value, appSubCategoryId: '' }
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj huvudkategori" />
              </SelectTrigger>
              <SelectContent>
                {huvudkategorier.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">Underkategori</Label>
            <Select
              value={newRule.action?.appSubCategoryId || ''}
              onValueChange={(value) => setNewRule({
                ...newRule,
                action: { ...newRule.action!, appSubCategoryId: value }
              })}
              disabled={!newRule.action?.appMainCategoryId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj underkategori" />
              </SelectTrigger>
              <SelectContent>
                {availableSubcategories.map(subcategoryId => {
                  const subcat = allUnderkategorier.find(s => s.id === subcategoryId);
                  return (
                    <SelectItem key={subcategoryId} value={subcategoryId}>
                      {subcat?.name || subcategoryId}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Prioritet</Label>
              <Input
                type="number"
                value={newRule.priority || 100}
                onChange={(e) => setNewRule({
                  ...newRule,
                  priority: parseInt(e.target.value) || 100
                })}
              />
            </div>
            
            <div>
              <Label className="text-sm">Auto-godkänn</Label>
              <Select
                value={newRule.action?.autoApproval ? 'ja' : 'nej'}
                onValueChange={(value) => setNewRule({
                  ...newRule,
                  action: { ...newRule.action!, autoApproval: value === 'ja' }
                })}
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
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={handleCreateRule} className="flex-1">
            Skapa regel
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Avbryt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};