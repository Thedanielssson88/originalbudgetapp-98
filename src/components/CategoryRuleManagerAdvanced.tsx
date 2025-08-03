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

interface CategoryRuleManagerAdvancedProps {
  rules: CategoryRule[];
  onRulesChange: (rules: CategoryRule[]) => void;
  mainCategories: string[];
}

export const CategoryRuleManagerAdvanced: React.FC<CategoryRuleManagerAdvancedProps> = ({
  rules,
  onRulesChange,
  mainCategories
}) => {
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>({});
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>([]);
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

  // Load subcategories from storage
  useEffect(() => {
    const loadedSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
    setSubcategories(loadedSubcategories);
  }, []);

  // Update available subcategories when main category changes
  useEffect(() => {
    if (newRule.action?.appMainCategoryId) {
      setAvailableSubcategories(subcategories[newRule.action.appMainCategoryId] || []);
      // Reset subcategory when main category changes
      setNewRule(prev => ({
        ...prev,
        action: { ...prev.action!, appSubCategoryId: '' }
      }));
    } else {
      setAvailableSubcategories([]);
    }
  }, [newRule.action?.appMainCategoryId, subcategories]);

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

  const handleDeleteRule = (ruleId: string) => {
    onRulesChange(rules.filter(rule => rule.id !== ruleId));
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
                    {mainCategories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
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
                    {availableSubcategories.map(subcategory => (
                      <SelectItem key={subcategory} value={subcategory}>
                        {subcategory}
                      </SelectItem>
                    ))}
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
        {rules.length > 0 ? (
          <div className="space-y-2">
            {rules.sort((a, b) => a.priority - b.priority).map((rule) => (
              <Card key={rule.id} className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => handleToggleRule(rule.id)}
                      />
                      <Badge variant="outline" className="text-xs">
                        {rule.priority}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.condition.type === 'categoryMatch' ? 'secondary' : 'default'} className="text-xs">
                        {rule.condition.type === 'textContains' ? 'Text innehåller' :
                         rule.condition.type === 'textStartsWith' ? 'Text börjar med' :
                         'Bankens kategori'}
                      </Badge>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {(rule.condition as any).value || (rule.condition as any).bankCategory}
                      </code>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">{rule.action.appMainCategoryId}</span>
                      {rule.action.appSubCategoryId && (
                        <span> → {rule.action.appSubCategoryId}</span>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        <span className="font-medium">Pos: </span>
                        <span>{rule.action.positiveTransactionType}</span>
                        <span className="mx-2">|</span>
                        <span className="font-medium">Neg: </span>
                        <span>{rule.action.negativeTransactionType}</span>
                      </div>
                      {rule.action.applicableAccountIds && rule.action.applicableAccountIds.length > 0 && (
                        <div>
                          <span className="font-medium">Konton: </span>
                          <span>{rule.action.applicableAccountIds.length} valda</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Inga regler har skapats ännu.
          </div>
        )}
      </CardContent>
    </Card>
  );
};