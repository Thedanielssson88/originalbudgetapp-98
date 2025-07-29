import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { CategoryRule } from '@/types/transaction';

interface CategoryRuleManagerProps {
  rules: CategoryRule[];
  onRulesChange: (rules: CategoryRule[]) => void;
  mainCategories: string[];
}

export const CategoryRuleManager: React.FC<CategoryRuleManagerProps> = ({
  rules,
  onRulesChange,
  mainCategories
}) => {
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRule, setNewRule] = useState<Partial<CategoryRule>>({
    bankCategory: '',
    bankSubCategory: '',
    appCategoryId: '',
    transactionType: 'Transaction',
    priority: 1,
    isActive: true
  });

  const handleAddRule = () => {
    if (!newRule.bankCategory || !newRule.appCategoryId) return;

    const rule: CategoryRule = {
      id: Date.now().toString(),
      bankCategory: newRule.bankCategory!,
      bankSubCategory: newRule.bankSubCategory,
      appCategoryId: newRule.appCategoryId!,
      transactionType: newRule.transactionType!,
      priority: newRule.priority!,
      isActive: newRule.isActive!,
    };

    onRulesChange([...rules, rule]);
    setNewRule({
      bankCategory: '',
      bankSubCategory: '',
      appCategoryId: '',
      transactionType: 'Transaction',
      priority: 1,
      isActive: true
    });
    setIsAddingRule(false);
  };

  const handleDeleteRule = (ruleId: string) => {
    onRulesChange(rules.filter(r => r.id !== ruleId));
  };

  const handleToggleRule = (ruleId: string) => {
    onRulesChange(rules.map(r => 
      r.id === ruleId ? { ...r, isActive: !r.isActive } : r
    ));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Kategoriseringsregler</CardTitle>
              <CardDescription>
                Automatiska regler för att kategorisera transaktioner baserat på bankens kategorier
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddingRule(true)} disabled={isAddingRule}>
              <Plus className="w-4 h-4 mr-2" />
              Lägg till regel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isAddingRule && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Ny regel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bank-category">Bankens kategori</Label>
                    <Input
                      id="bank-category"
                      value={newRule.bankCategory || ''}
                      onChange={(e) => setNewRule({ ...newRule, bankCategory: e.target.value })}
                      placeholder="T.ex. 'Dagligvaror'"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bank-subcategory">Bankens underkategori (valfritt)</Label>
                    <Input
                      id="bank-subcategory"
                      value={newRule.bankSubCategory || ''}
                      onChange={(e) => setNewRule({ ...newRule, bankSubCategory: e.target.value })}
                      placeholder="T.ex. 'ICA'"
                    />
                  </div>
                  <div>
                    <Label htmlFor="app-category">Appens kategori</Label>
                    <Select
                      value={newRule.appCategoryId || ''}
                      onValueChange={(value) => setNewRule({ ...newRule, appCategoryId: value })}
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
                    <Label htmlFor="transaction-type">Transaktionstyp</Label>
                    <Select
                      value={newRule.transactionType || 'Transaction'}
                      onValueChange={(value) => setNewRule({ ...newRule, transactionType: value as 'Transaction' | 'InternalTransfer' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Transaction">Transaktion</SelectItem>
                        <SelectItem value="InternalTransfer">Överföring</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Prioritet</Label>
                    <Input
                      id="priority"
                      type="number"
                      min="1"
                      max="100"
                      value={newRule.priority || 1}
                      onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddingRule(false)}>
                    Avbryt
                  </Button>
                  <Button onClick={handleAddRule}>
                    Lägg till regel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {rules.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aktiv</TableHead>
                    <TableHead>Bankens kategori</TableHead>
                    <TableHead>Underkategori</TableHead>
                    <TableHead>Appens kategori</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Prioritet</TableHead>
                    <TableHead>Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => handleToggleRule(rule.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{rule.bankCategory}</TableCell>
                      <TableCell>{rule.bankSubCategory || '-'}</TableCell>
                      <TableCell>{rule.appCategoryId}</TableCell>
                      <TableCell>
                        <Badge variant={rule.transactionType === 'InternalTransfer' ? 'secondary' : 'outline'}>
                          {rule.transactionType === 'InternalTransfer' ? 'Överföring' : 'Transaktion'}
                        </Badge>
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Inga regler konfigurerade ännu. Lägg till din första regel ovan.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};