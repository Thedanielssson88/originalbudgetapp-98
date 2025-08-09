import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, Settings, Filter, Target, CheckCircle2 } from 'lucide-react';
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
  const [useRuleType, setUseRuleType] = useState(true);
  const [useBankCategories, setUseBankCategories] = useState(false);
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
      
      // Check if bank categories are pre-filled
      const hasBankCategories = transaction.bankCategory && transaction.bankCategory !== 'Alla Bankkategorier';
      setUseBankCategories(hasBankCategories);
      
      // Check if we have a description for rule type
      const hasDescription = transaction.description && transaction.description.trim() !== '';
      setUseRuleType(hasDescription);
      
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
    } else if (open && !transaction) {
      // Reset to defaults when opening without transaction
      setUseRuleType(true);
      setUseBankCategories(false);
    }
  }, [open, transaction]);

  const handleCreateRule = async () => {
    // Validate required fields
    const hasConditionValue = useRuleType ? (
      newRule.condition?.type === 'categoryMatch' ? 
        !!(newRule.condition as any).bankCategory : 
        !!(newRule.condition as any).value
    ) : true; // If not using rule type, condition is optional
    
    const hasMainCategory = !!newRule.action?.appMainCategoryId;
    const hasSubCategory = !!newRule.action?.appSubCategoryId;
    
    // Check for missing fields and provide feedback
    if (useRuleType && !hasConditionValue) {
      alert('Vänligen ange ett villkor för regeln');
      return;
    }
    if (!hasMainCategory) {
      alert('Vänligen välj en huvudkategori');
      return;
    }
    if (!hasSubCategory) {
      alert('Vänligen välj en underkategori');
      return;
    }
    
    // At least one condition (rule type or bank categories) must be checked
    if (!useRuleType && !useBankCategories) {
      alert('Vänligen välj minst en regeltyp (Villkor eller Bankens kategorier)');
      return;
    }
    
    if (newRule.action && hasMainCategory && hasSubCategory) {
      try {
        const rulePayload = {
          ruleName: useRuleType ? (
            newRule.condition?.type === 'categoryMatch' ? 
              (newRule.condition as any).bankCategory : 
              `${newRule.condition?.type}: ${(newRule.condition as any).value}`
          ) : (useBankCategories ? 
            `${newRule.bankhuvudkategori}${newRule.bankunderkategori !== 'Alla Bankunderkategorier' ? ` → ${newRule.bankunderkategori}` : ''}` :
            'Regel för alla transaktioner'
          ),
          transactionName: useRuleType ? (
            newRule.condition?.type === 'categoryMatch' ? 
              (newRule.condition as any).bankCategory : 
              (newRule.condition as any).value
          ) : "*", // "*" when not using rule type (wildcard for all transactions)
          ruleType: useRuleType ? newRule.condition?.type : null,
          // Only include bankCategory/bankSubCategory for categoryMatch rules
          ...(useRuleType && newRule.condition?.type === 'categoryMatch' ? {
            bankCategory: (newRule.condition as any).bankCategory,
            bankSubCategory: (newRule.condition as any).bankSubCategory
          } : {}),
          transactionDirection: newRule.transactionDirection || 'all',
          bankhuvudkategori: useBankCategories && newRule.bankhuvudkategori !== 'Alla Bankkategorier' ? newRule.bankhuvudkategori : null,
          bankunderkategori: useBankCategories && newRule.bankunderkategori !== 'Alla Bankunderkategorier' ? newRule.bankunderkategori : null,
          huvudkategoriId: newRule.action.appMainCategoryId,
          underkategoriId: newRule.action.appSubCategoryId,
          positiveTransactionType: newRule.action.positiveTransactionType || 'Transaction',
          negativeTransactionType: newRule.action.negativeTransactionType || 'Transaction',
          applicableAccountIds: JSON.stringify(newRule.action.applicableAccountIds || []),
          priority: newRule.priority || 100,
          isActive: 'true',
          autoApproval: autoApprove || false,
          userId: 'dev-user-123'
        };

        console.log('Creating rule with payload:', rulePayload);
        
        const response = await fetch('/api/category-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rulePayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create rule: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ Rule created successfully:', result);
        
        // Refresh the rules list
        await queryClient.invalidateQueries({ queryKey: ['/api/category-rules'] });
        
        // Close the dialog
        onOpenChange(false);
      } catch (error) {
        console.error('❌ Error creating rule:', error);
        alert(`Kunde inte skapa regel: ${error instanceof Error ? error.message : 'Okänt fel'}`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-bold">Skapa ny kategoriseringsregel</DialogTitle>
          <DialogDescription>
            Definiera hur transaktioner automatiskt ska kategoriseras baserat på dina villkor
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* Section 1: Regeln gäller för */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Regeln gäller för</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Definiera vilka transaktioner som ska matchas av denna regel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Rule Type Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="use-rule-type"
                  checked={useRuleType}
                  onCheckedChange={(checked) => setUseRuleType(checked as boolean)}
                />
                <label htmlFor="use-rule-type" className="text-sm font-medium cursor-pointer">
                  Använd textvillkor (Regeltyp)
                </label>
              </div>

              {/* Rule Type and Condition - Collapsible */}
              {useRuleType && (
                <div className="grid gap-4 md:grid-cols-2 border rounded-lg p-4 bg-gray-50/30">
                <div>
                  <Label className="text-sm font-medium">Regeltyp</Label>
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
                    <SelectTrigger className="mt-1">
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

                <div>
                  <Label className="text-sm font-medium">Villkor</Label>
                  <Input
                    className="mt-1"
                    placeholder={
                      newRule.condition?.type === 'textContains' ? 'Söktext...' :
                      newRule.condition?.type === 'textStartsWith' ? 'Börjar med...' :
                      newRule.condition?.type === 'exactText' ? 'Exakt text...' :
                      'Kategorinamn...'
                    }
                    value={(newRule.condition as any)?.value || ''}
                    onChange={(e) => setNewRule({
                      ...newRule,
                      condition: { ...newRule.condition!, value: e.target.value } as RuleCondition
                    })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Använd * för att matcha alla transaktioner
                  </p>
                </div>
                </div>
              )}

              {/* Transaction Direction */}
              <div>
                <Label className="text-sm font-medium">Transaktionsriktning</Label>
                <Select
                  value={newRule.transactionDirection || 'all'}
                  onValueChange={(value) => setNewRule({
                    ...newRule,
                    transactionDirection: value as 'all' | 'positive' | 'negative'
                  })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla transaktioner</SelectItem>
                    <SelectItem value="positive">Endast inkomster (+)</SelectItem>
                    <SelectItem value="negative">Endast utgifter (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bank Categories Checkbox */}
              <div className="flex items-center space-x-2 border-t pt-4">
                <Checkbox
                  id="use-bank-categories"
                  checked={useBankCategories}
                  onCheckedChange={(checked) => setUseBankCategories(checked as boolean)}
                />
                <label htmlFor="use-bank-categories" className="text-sm font-medium cursor-pointer">
                  Använd bankens kategorier (filter)
                </label>
              </div>

              {/* Bank Categories Filter - Collapsible */}
              {useBankCategories && (
                <div className="border rounded-lg p-4 bg-gray-50/30">
                  <div className="flex items-center gap-2 mb-2">
                    <InfoIcon className="h-4 w-4 text-blue-600" />
                    <Label className="text-sm font-medium">Bankens kategorier (valfritt filter)</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Begränsa regeln till specifika bankkategorier. Lämna som "Alla" för att matcha oavsett bankkategori.
                  </p>
                  <BankCategorySelector
                  selectedBankCategory={newRule.bankhuvudkategori || 'Alla Bankkategorier'}
                  selectedBankSubCategory={newRule.bankunderkategori || 'Alla Bankunderkategorier'}
                  onBankCategoryChange={(category) => setNewRule({
                    ...newRule,
                    bankhuvudkategori: category,
                    bankunderkategori: 'Alla Bankunderkategorier'
                  })}
                  onBankSubCategoryChange={(subcategory) => setNewRule({
                    ...newRule,
                    bankunderkategori: subcategory
                  })}
                />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Konton som regeln gäller för */}
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-green-600" />
                <CardTitle className="text-lg">Konton som regeln gäller för</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Välj vilka konton där regeln ska tillämpas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
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
                  <label htmlFor="all-accounts" className="text-sm font-medium cursor-pointer flex-1">
                    Alla konton
                  </label>
                </div>
                
                <Separator className="my-2" />
                
                <div className="grid gap-2 max-h-48 overflow-y-auto">
                  {accounts.map(account => (
                    <div key={account.id} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
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
                      <label htmlFor={`account-${account.id}`} className="text-sm cursor-pointer flex-1">
                        {account.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Kategorisering & Åtgärder */}
          <Card className="border-purple-200 bg-purple-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-lg">Kategorisering & Åtgärder</CardTitle>
              </div>
              <CardDescription className="text-sm">
                Bestäm hur matchade transaktioner ska kategoriseras
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Categories */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">Huvudkategori *</Label>
                  <Select
                    value={newRule.action?.appMainCategoryId || ''}
                    onValueChange={(value) => setNewRule({
                      ...newRule,
                      action: { ...newRule.action!, appMainCategoryId: value }
                    })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Välj kategori..." />
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
                  <Label className="text-sm font-medium">Underkategori *</Label>
                  <Select
                    value={newRule.action?.appSubCategoryId || ''}
                    onValueChange={(value) => setNewRule({
                      ...newRule,
                      action: { ...newRule.action!, appSubCategoryId: value }
                    })}
                    disabled={!newRule.action?.appMainCategoryId}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Välj underkategori..." />
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
              </div>

              {/* Transaction Types */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">Typ för positiva belopp</Label>
                  <Select
                    value={newRule.action?.positiveTransactionType || 'Transaction'}
                    onValueChange={(value) => setNewRule({
                      ...newRule,
                      action: { ...newRule.action!, positiveTransactionType: value as any }
                    })}
                  >
                    <SelectTrigger className="mt-1">
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

                <div>
                  <Label className="text-sm font-medium">Typ för negativa belopp</Label>
                  <Select
                    value={newRule.action?.negativeTransactionType || 'Transaction'}
                    onValueChange={(value) => setNewRule({
                      ...newRule,
                      action: { ...newRule.action!, negativeTransactionType: value as any }
                    })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Transaction">Transaktion</SelectItem>
                      <SelectItem value="InternalTransfer">Intern Överföring</SelectItem>
                      <SelectItem value="ExpenseClaim">Utlägg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Priority and Auto Approval */}
              <Separator />
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">Prioritet</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={newRule.priority || 100}
                    onChange={(e) => setNewRule({
                      ...newRule,
                      priority: parseInt(e.target.value) || 100
                    })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lägre nummer = högre prioritet
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Godkänn automatiskt</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Checkbox
                      id="auto-approve"
                      checked={autoApprove}
                      onCheckedChange={(checked) => setAutoApprove(checked as boolean)}
                    />
                    <label htmlFor="auto-approve" className="text-sm cursor-pointer">
                      Markera som godkänd automatiskt
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Transaktioner blir gröna direkt
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Alert */}
          <Alert className="bg-blue-50 border-blue-200">
            <InfoIcon className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Tips:</strong> Regeln kommer att tillämpas på alla framtida transaktioner som matchar dina villkor. 
              Du kan när som helst redigera eller ta bort regeln under "Regler" i menyn.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button 
              onClick={handleCreateRule}
              disabled={
                !newRule.action?.appMainCategoryId || 
                !newRule.action?.appSubCategoryId ||
                (!useRuleType && !useBankCategories) ||
                (useRuleType && (!(newRule.condition as any)?.value))
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Skapa regel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};