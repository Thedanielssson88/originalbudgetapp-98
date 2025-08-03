import React, { useState } from 'react';
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
  const [newRule, setNewRule] = useState<Partial<CategoryRule>>({
    condition: { type: 'textContains', value: '' },
    action: { appMainCategoryId: '', transactionType: 'Transaction' },
    priority: 100,
    isActive: true
  });

  const handleAddRule = () => {
    if (newRule.condition && newRule.action) {
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
        action: { appMainCategoryId: '', transactionType: 'Transaction' },
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
        <CardTitle>Avancerad Regelmotor för Kategorisering</CardTitle>
        <CardDescription>
          Skapa regler för att automatiskt kategorisera transaktioner baserat på text eller bankens kategorier.
          Textbaserade regler har högre prioritet än kategoriregler.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Rule Button */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Kategoriseringsregler</h3>
          <Button onClick={() => setIsAddingRule(true)} disabled={isAddingRule}>
            <Plus className="h-4 w-4 mr-2" />
            Lägg till regel
          </Button>
        </div>

        {/* Add Rule Form */}
        {isAddingRule && (
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Regeltyp</Label>
                <Select
                  value={newRule.condition?.type || 'textContains'}
                  onValueChange={(value) => setNewRule({
                    ...newRule,
                    condition: { type: value as any, value: '' }
                  })}
                >
                  <SelectTrigger>
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
                <Label>Prioritet (lägre nummer = högre prioritet)</Label>
                <Input
                  type="number"
                  value={newRule.priority || 100}
                  onChange={(e) => setNewRule({
                    ...newRule,
                    priority: parseInt(e.target.value) || 100
                  })}
                />
              </div>
            </div>

            <div>
              <Label>Villkor</Label>
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
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                    <SelectValue placeholder="Välj kategori" />
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
                <Label>Transaktionstyp</Label>
                <Select
                  value={newRule.action?.transactionType || 'Transaction'}
                  onValueChange={(value) => setNewRule({
                    ...newRule,
                    action: { ...newRule.action!, transactionType: value as any }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transaction">Transaktion</SelectItem>
                    <SelectItem value="Transfer">Överföring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddRule}>Lägg till regel</Button>
              <Button variant="outline" onClick={() => setIsAddingRule(false)}>
                Avbryt
              </Button>
            </div>
          </Card>
        )}

        {/* Rules Table */}
        {rules.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aktiv</TableHead>
                <TableHead>Prioritet</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Villkor</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.sort((a, b) => a.priority - b.priority).map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() => handleToggleRule(rule.id)}
                    />
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    <Badge variant={rule.condition.type === 'categoryMatch' ? 'secondary' : 'default'}>
                      {rule.condition.type === 'textContains' ? 'Text innehåller' :
                       rule.condition.type === 'textStartsWith' ? 'Text börjar med' :
                       'Bankens kategori'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm">
                      {(rule.condition as any).value || (rule.condition as any).bankCategory}
                    </code>
                  </TableCell>
                  <TableCell>{rule.action.appMainCategoryId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {rule.action.transactionType === 'Transaction' ? 'Transaktion' : 'Överföring'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Inga regler har konfigurerats ännu.
          </div>
        )}
      </CardContent>
    </Card>
  );
};