import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Edit } from 'lucide-react';
import { CategoryRule, RuleCondition } from '@/types/budget';
import { v4 as uuidv4 } from 'uuid';
import { get, StorageKey } from '@/services/storageService';
import { useHuvudkategorier, useUnderkategorier, useCategoryNames } from '@/hooks/useCategories';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CategoryRule as PostgreSQLCategoryRule } from '@shared/schema';

interface CategoryRuleManagerAdvancedProps {
  rules: CategoryRule[];
  onRulesChange: (rules: CategoryRule[]) => void;
  mainCategories: string[]; // Legacy - still used for backwards compatibility during transition
  accounts: { id: string; name: string }[];
}

export const CategoryRuleManagerAdvanced: React.FC<CategoryRuleManagerAdvancedProps> = ({
  rules,
  onRulesChange,
  mainCategories,
  accounts
}) => {
  // Use UUID-based category hooks
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: allUnderkategorier = [] } = useUnderkategorier();
  const { getHuvudkategoriName, getUnderkategoriName, getCategoryPath } = useCategoryNames();
  
  const queryClient = useQueryClient();
  
  // Load PostgreSQL category rules
  const { data: postgresqlRules = [], refetch: refetchRules } = useQuery<PostgreSQLCategoryRule[]>({
    queryKey: ['/api/category-rules'],
    queryFn: async () => {
      const response = await fetch('/api/category-rules');
      if (!response.ok) throw new Error('Failed to fetch category rules');
      return response.json();
    }
  });

  // Delete rule mutation
  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(`/api/category-rules/${ruleId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete rule: ${response.status} ${errorText}`);
      }
      // DELETE returns status 204 with no content, don't try to parse JSON
      return { success: true };
    },
    onSuccess: () => {
      console.log('✅ [RULE MANAGER] Rule deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/category-rules'] });
      refetchRules();
    },
    onError: (error) => {
      console.error('❌ [RULE MANAGER] Failed to delete rule:', error);
    }
  });
  
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null);
  const [newRule, setNewRule] = useState<Partial<CategoryRule>>({
    condition: { type: 'textContains', value: '' },
    action: { 
      appMainCategoryId: '', 
      appSubCategoryId: '', 
      positiveTransactionType: 'Transaction',
      negativeTransactionType: 'Transaction',
      applicableAccountIds: []
    },
    priority: 100,
    isActive: true
  });

  // Update available subcategories when main category changes (UUID-based)
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

  const handleAddRule = () => {
    // Validate required fields
    const hasConditionValue = newRule.condition?.type === 'categoryMatch' ? 
      !!(newRule.condition as any).bankCategory : 
      !!(newRule.condition as any).value;
    
    const hasMainCategory = !!newRule.action?.appMainCategoryId;
    const hasSubCategory = !!newRule.action?.appSubCategoryId;
    
    if (newRule.condition && newRule.action && hasConditionValue && hasMainCategory && hasSubCategory) {
      const rule: CategoryRule = {
        id: uuidv4(),
        priority: newRule.priority || 100,
        condition: newRule.condition,
        action: newRule.action,
        isActive: true
      };
      
      onRulesChange([...rules, rule]);
      
      // Reset form
      setSelectedAccountIds([]);
      setNewRule({
        condition: { type: 'textContains', value: '' },
        action: { 
          appMainCategoryId: '', 
          appSubCategoryId: '', 
          positiveTransactionType: 'Transaction',
          negativeTransactionType: 'Transaction',
          applicableAccountIds: []
        },
        priority: 100,
        isActive: true
      });
      setIsAddingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    console.log('🗑️ [RULE MANAGER] Deleting rule:', ruleId);
    try {
      await deleteMutation.mutateAsync(ruleId);
      console.log('✅ [RULE MANAGER] Rule deleted successfully');
    } catch (error) {
      console.error('❌ [RULE MANAGER] Failed to delete rule:', error);
    }
  };

  const handleEditRule = (rule: CategoryRule) => {
    setEditingRuleId(rule.id);
    setEditingRule({ ...rule });
    // Set available subcategories for the rule being edited (UUID-based)
    if (rule.action.appMainCategoryId) {
      const subcatsForCategory = allUnderkategorier.filter(
        sub => sub.huvudkategoriId === rule.action.appMainCategoryId
      );
      setAvailableSubcategories(subcatsForCategory.map(sub => sub.id));
    }
  };

  const handleSaveEdit = () => {
    if (!editingRule) return;
    
    const updatedRules = rules.map(rule => 
      rule.id === editingRuleId ? editingRule : rule
    );
    onRulesChange(updatedRules);
    setEditingRuleId(null);
    setEditingRule(null);
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setEditingRule(null);
  };

  const handleToggleRule = (ruleId: string) => {
    onRulesChange(rules.map(rule => 
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
    ));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Regelmotor för Kategorisering</CardTitle>
        <CardDescription className="text-sm">
          Skapa regler för automatisk kategorisering av transaktioner.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Rule Button */}
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium">Aktiva regler</h3>
          <Button size="sm" onClick={() => setIsAddingRule(true)} disabled={isAddingRule}>
            <Plus className="h-3 w-3 mr-1" />
            Ny regel
          </Button>
        </div>

        {/* Add Rule Form - Mobile Optimized */}
        {isAddingRule && (
          <Card className="p-3 space-y-3 border-dashed">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Regeltyp</Label>
                <Select
                  value={newRule.condition?.type || 'textContains'}
                  onValueChange={(value) => setNewRule({
                    ...newRule,
                    condition: { type: value as any, value: '' }
                  })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="textContains">Text innehåller</SelectItem>
                    <SelectItem value="textStartsWith">Text börjar med</SelectItem>
                    <SelectItem value="categoryMatch">Bankens kategori</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs">Villkor</Label>
                <Input
                  placeholder={
                    newRule.condition?.type === 'textContains' ? 'Text som ska sökas efter' :
                    newRule.condition?.type === 'textStartsWith' ? 'Text som transaktionen börjar med' :
                    'Bankens kategorinamn'
                  }
                  value={(newRule.condition as any)?.value || ''}
                  onChange={(e) => setNewRule({
                    ...newRule,
                    condition: { ...newRule.condition!, value: e.target.value } as RuleCondition
                  })}
                  className="h-8"
                />
              </div>

              <div>
                <Label className="text-xs">Huvudkategori</Label>
                <Select
                  value={newRule.action?.appMainCategoryId || ''}
                  onValueChange={(value) => setNewRule({
                    ...newRule,
                    action: { ...newRule.action!, appMainCategoryId: value, appSubCategoryId: '' }
                  })}
                >
                  <SelectTrigger className="h-8">
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
                <Label className="text-xs">Underkategori</Label>
                <Select
                  value={newRule.action?.appSubCategoryId || ''}
                  onValueChange={(value) => setNewRule({
                    ...newRule,
                    action: { ...newRule.action!, appSubCategoryId: value }
                  })}
                  disabled={!newRule.action?.appMainCategoryId}
                >
                  <SelectTrigger className="h-8">
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Prioritet</Label>
                  <Input
                    type="number"
                    value={newRule.priority || 100}
                    onChange={(e) => setNewRule({
                      ...newRule,
                      priority: parseInt(e.target.value) || 100
                    })}
                    className="h-8"
                  />
                </div>
                
                <div>
                  <Label className="text-xs">Pos. belopp typ</Label>
                  <Select
                    value={newRule.action?.positiveTransactionType || 'Transaction'}
                    onValueChange={(value) => setNewRule({
                      ...newRule,
                      action: { ...newRule.action!, positiveTransactionType: value as any }
                    })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Transaction">Transaktion</SelectItem>
                      <SelectItem value="InternalTransfer">Intern Överföring</SelectItem>
                      <SelectItem value="Savings">Sparande</SelectItem>
                      <SelectItem value="CostCoverage">Täck en kostnad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Neg. belopp typ</Label>
                <Select
                  value={newRule.action?.negativeTransactionType || 'Transaction'}
                  onValueChange={(value) => setNewRule({
                    ...newRule,
                    action: { ...newRule.action!, negativeTransactionType: value as any }
                  })}
                >
                  <SelectTrigger className="h-8">
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
                <Label className="text-xs">Konton som regeln gäller för</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="all-accounts"
                      checked={selectedAccountIds.length === 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAccountIds([]);
                          setNewRule({
                            ...newRule,
                            action: { ...newRule.action!, applicableAccountIds: [] }
                          });
                        }
                      }}
                      className="rounded"
                    />
                    <label htmlFor="all-accounts" className="text-xs text-muted-foreground">
                      Alla konton
                    </label>
                  </div>
                  
                  {accounts.map(account => (
                    <div key={account.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`account-${account.id}`}
                        checked={selectedAccountIds.includes(account.id)}
                        onChange={(e) => {
                          let updatedAccountIds;
                          if (e.target.checked) {
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
                        className="rounded"
                      />
                      <label htmlFor={`account-${account.id}`} className="text-xs">
                        {account.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleAddRule} className="flex-1">
                Skapa regel
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsAddingRule(false)} className="flex-1">
                Avbryt
              </Button>
            </div>
          </Card>
        )}

        {/* Rules List - Mobile Optimized */}
        {postgresqlRules.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-2">
              {postgresqlRules.length} regler laddade från databasen
            </div>
            {postgresqlRules
              .sort((a, b) => (a.priority || 100) - (b.priority || 100))
              .map((rule) => (
              <Card key={rule.id} className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {rule.priority || 100}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {rule.ruleName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="h-6 w-6 p-0"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-xs">
                      <span className="font-medium">Bankkategori:</span> {rule.transactionName}
                    </div>
                    <div className="text-xs">
                      <span className="font-medium">Huvudkategori:</span> {getHuvudkategoriName(rule.huvudkategoriId)}
                    </div>
                    <div className="text-xs">
                      <span className="font-medium">Underkategori:</span> {getUnderkategoriName(rule.underkategoriId)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Inga regler skapade än
          </div>
        )}
      </CardContent>
    </Card>
  );
};