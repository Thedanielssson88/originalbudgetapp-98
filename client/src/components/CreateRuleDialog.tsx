import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RuleCondition } from '@/types/budget';
import { useHuvudkategorier, useUnderkategorier } from '@/hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { ImportedTransaction } from '@/types/transaction';
import { useBudget } from '@/hooks/useBudget';
import { BankCategorySelector } from './BankCategorySelector';

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
  const [autoApprove, setAutoApprove] = useState(false);
  const [newRule, setNewRule] = useState<Partial<{
    condition: RuleCondition;
    action: any;
    transactionDirection: 'all' | 'positive' | 'negative';
    priority: number;
    isActive: string;
    bankCategory: string;
    bankSubCategory: string;
    bankhuvudkategori: string;
    bankunderkategori: string;
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
    bankSubCategory: 'Alla Bankunderkategorier',
    bankhuvudkategori: 'Alla Bankkategorier',
    bankunderkategori: 'Alla Bankunderkategorier'
  });

  // Update available subcategories when main category changes
  useEffect(() => {
    if (newRule.action?.appMainCategoryId) {
      const subcatsForCategory = allUnderkategorier.filter(
        sub => sub.huvudkategoriId === newRule.action?.appMainCategoryId
      );
      setAvailableSubcategories(subcatsForCategory.map(sub => sub.id));
      
      // Only reset subcategory if it's not from the current category
      const currentSubcat = allUnderkategorier.find(s => s.id === newRule.action?.appSubCategoryId);
      if (currentSubcat && currentSubcat.huvudkategoriId !== newRule.action?.appMainCategoryId) {
        setNewRule(prev => ({
          ...prev,
          action: { ...prev.action!, appSubCategoryId: '' }
        }));
      }
    } else {
      setAvailableSubcategories([]);
    }
  }, [newRule.action?.appMainCategoryId, allUnderkategorier]);

  // Reset form when dialog opens with transaction data pre-filled
  useEffect(() => {
    if (open && transaction) {
      // Determine transaction direction based on amount
      const transactionDirection = transaction.amount > 0 ? 'positive' : 
                                  transaction.amount < 0 ? 'negative' : 'all';
      
      // Pre-select the account from the transaction
      const accountIds = transaction.accountId ? [transaction.accountId] : [];
      setSelectedAccountIds(accountIds);
      
      setNewRule({
        condition: { type: 'exactText', value: transaction.description || '' },
        action: { 
          appMainCategoryId: transaction.appCategoryId || '', 
          appSubCategoryId: transaction.appSubCategoryId || '', 
          positiveTransactionType: transaction.amount > 0 ? 'Transaction' : 'Transaction',
          negativeTransactionType: transaction.amount < 0 ? 'Transaction' : 'Transaction',
          applicableAccountIds: accountIds
        },
        transactionDirection: transactionDirection,
        priority: 100,
        isActive: 'true',
        bankCategory: transaction.bankCategory || 'Alla Bankkategorier',
        bankSubCategory: transaction.bankSubCategory || 'Alla Bankunderkategorier',
        bankhuvudkategori: transaction.bankCategory || 'Alla Bankkategorier',
        bankunderkategori: transaction.bankSubCategory || 'Alla Bankunderkategorier'
      });
      
      setAutoApprove(false);
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
          ruleName: `Regel för ${(newRule.condition as any).value || 'transaktion'}`,
          ruleType: newRule.condition.type,
          transactionName: (newRule.condition as any).value || '',
          transactionDirection: newRule.transactionDirection || 'all',
          huvudkategoriId: newRule.action.appMainCategoryId,
          underkategoriId: newRule.action.appSubCategoryId,
          positiveTransactionType: newRule.action.positiveTransactionType || 'Transaction',
          negativeTransactionType: newRule.action.negativeTransactionType || 'Transaction',
          applicableAccountIds: JSON.stringify(newRule.action.applicableAccountIds || []),
          priority: newRule.priority || 100,
          isActive: true,
          bankhuvudkategori: newRule.bankhuvudkategori === 'Alla Bankkategorier' ? null : newRule.bankhuvudkategori,
          bankunderkategori: newRule.bankunderkategori === 'Alla Bankunderkategorier' ? null : newRule.bankunderkategori,
          autoApproval: autoApprove
        };

        console.log('Creating rule with payload:', rulePayload);
        
        const response = await fetch('/api/category-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rulePayload)
        });

        if (response.ok) {
          await queryClient.invalidateQueries({ queryKey: ['/api/category-rules'] });
          onOpenChange(false);
        } else {
          console.error('Failed to create rule:', response.status);
        }
      } catch (error) {
        console.error('Error creating rule:', error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa ny regel</DialogTitle>
          <DialogDescription>
            Skapa en regel baserad på transaktionen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rule Type */}
          <div>
            <Label>Regeltyp</Label>
            <Select
              value={newRule.condition?.type || 'textContains'}
              onValueChange={(value) => setNewRule({
                ...newRule,
                condition: { 
                  type: value as any, 
                  value: value === 'exactText' ? (transaction?.description || '') : '' 
                }
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

          {/* Condition Value */}
          <div>
            <Label>Villkor</Label>
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
            <p className="text-xs text-muted-foreground mt-1">
              Använd * som wildcard för att matcha alla transaktioner
            </p>
          </div>

          {/* Transaction Direction */}
          <div>
            <Label>Transaktion</Label>
            <Select
              value={newRule.transactionDirection || 'all'}
              onValueChange={(value) => setNewRule({
                ...newRule,
                transactionDirection: value as 'all' | 'positive' | 'negative'
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla transaktioner</SelectItem>
                <SelectItem value="positive">Endast positiva belopp</SelectItem>
                <SelectItem value="negative">Endast negativa belopp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Main Category */}
          <div>
            <Label>Huvudkategori</Label>
            <Select
              value={newRule.action?.appMainCategoryId || ''}
              onValueChange={(value) => setNewRule({
                ...newRule,
                action: { ...newRule.action!, appMainCategoryId: value }
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

          {/* Subcategory */}
          <div>
            <Label>Underkategori</Label>
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

          {/* Bank Category Selector */}
          <div className="border-t pt-4">
            <Label className="font-semibold mb-2 block">Bankens kategorier (filter)</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Regeln gäller endast för transaktioner som matchar de valda bankkategorierna.
            </p>
            <BankCategorySelector
              selectedBankCategory={newRule.bankhuvudkategori || 'Alla Bankkategorier'}
              selectedBankSubCategory={newRule.bankunderkategori || 'Alla Bankunderkategorier'}
              onBankCategoryChange={(category) => setNewRule({
                ...newRule,
                bankhuvudkategori: category,
                bankunderkategori: 'Alla Bankunderkategorier' // Reset subcategory when main category changes
              })}
              onBankSubCategoryChange={(subcategory) => setNewRule({
                ...newRule,
                bankunderkategori: subcategory
              })}
            />
          </div>

          {/* Priority and Transaction Types */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prioritet</Label>
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
              <Label>Pos. belopp typ</Label>
              <Select
                value={newRule.action?.positiveTransactionType || 'Transaction'}
                onValueChange={(value) => setNewRule({
                  ...newRule,
                  action: { ...newRule.action!, positiveTransactionType: value as any }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
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
          </div>

          <div>
            <Label>Neg. belopp typ</Label>
            <Select
              value={newRule.action?.negativeTransactionType || 'Transaction'}
              onValueChange={(value) => setNewRule({
                ...newRule,
                action: { ...newRule.action!, negativeTransactionType: value as any }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Transaction">Transaktion</SelectItem>
                <SelectItem value="InternalTransfer">Intern Överföring</SelectItem>
                <SelectItem value="ExpenseClaim">Utlägg</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Account Selection */}
          <div>
            <Label>Konton som regeln gäller för</Label>
            <div className="space-y-2 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="all-accounts"
                  checked={selectedAccountIds.length === 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedAccountIds([]);
                      setNewRule({
                        ...newRule,
                        action: { ...newRule.action!, applicableAccountIds: [] }
                      });
                    }
                  }}
                />
                <label htmlFor="all-accounts" className="text-sm text-muted-foreground">
                  Alla konton
                </label>
              </div>
              
              {accounts.map(account => (
                <div key={account.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`account-${account.id}`}
                    checked={selectedAccountIds.includes(account.id)}
                    onCheckedChange={(checked) => {
                      let updatedAccountIds;
                      if (checked) {
                        updatedAccountIds = [...selectedAccountIds, account.id];
                      } else {
                        updatedAccountIds = selectedAccountIds.filter(id => id !== account.id);
                      }
                      setSelectedAccountIds(updatedAccountIds);
                      setNewRule({
                        ...newRule,
                        action: { ...newRule.action!, applicableAccountIds: updatedAccountIds }
                      });
                    }}
                  />
                  <label htmlFor={`account-${account.id}`} className="text-sm">
                    {account.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Auto Approve */}
          <div className="flex items-center space-x-2">
            <Label>Godkänn automatiskt</Label>
            <Select
              value={autoApprove ? 'yes' : 'no'}
              onValueChange={(value) => setAutoApprove(value === 'yes')}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Ja</SelectItem>
                <SelectItem value="no">Nej</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button 
              onClick={handleCreateRule}
              disabled={
                !newRule.condition || 
                !newRule.action?.appMainCategoryId || 
                !newRule.action?.appSubCategoryId ||
                !(newRule.condition as any)?.value
              }
            >
              Skapa regel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};