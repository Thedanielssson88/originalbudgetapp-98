import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronDown, ChevronUp, Plus, Edit, Trash2 } from 'lucide-react';
import { BudgetGroup, SavingsGoal } from '../types/budget';
import { AddSavingsItemDialog } from './AddSavingsItemDialog';

interface SavingsSectionProps {
  savingsGroups: BudgetGroup[];
  savingsGoals: SavingsGoal[];
  accounts: string[];
  mainCategories: string[];
  onAddSavingsItem: (item: {
    mainCategory: string;
    subcategory: string;
    name: string;
    amount: number;
    account: string;
  }) => void;
  onEditSavingsGroup: (group: BudgetGroup) => void;
  onDeleteSavingsGroup: (id: string) => void;
}

type ViewMode = 'category' | 'account';

export const SavingsSection: React.FC<SavingsSectionProps> = ({
  savingsGroups,
  savingsGoals,
  accounts,
  mainCategories,
  onAddSavingsItem,
  onEditSavingsGroup,
  onDeleteSavingsGroup
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('category');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleAccountExpansion = (accountName: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountName)) {
      newExpanded.delete(accountName);
    } else {
      newExpanded.add(accountName);
    }
    setExpandedAccounts(newExpanded);
  };

  const totalSavings = savingsGroups.reduce((sum, group) => sum + group.amount, 0);

  const formatCurrency = (amount: number) => `${amount.toLocaleString()} kr`;

  const groupSavingsByAccount = () => {
    const grouped: Record<string, BudgetGroup[]> = {};
    
    savingsGroups.forEach(group => {
      const accountName = group.account || 'Inget konto';
      if (!grouped[accountName]) {
        grouped[accountName] = [];
      }
      grouped[accountName].push(group);
    });
    
    return grouped;
  };

  const groupSavingsByCategory = () => {
    const categoryGroups: { [key: string]: { total: number; subcategories: { id: string; name: string; amount: number; account?: string; groupId: string }[] } } = {};
    
    savingsGroups.forEach((group) => {
      if (!categoryGroups[group.name]) {
        categoryGroups[group.name] = { total: 0, subcategories: [] };
      }
      
      group.subCategories?.forEach((sub) => {
        categoryGroups[group.name].subcategories.push({
          ...sub,
          groupId: group.id
        });
        categoryGroups[group.name].total += sub.amount;
      });
    });
    
    return categoryGroups;
  };

  const getSavingsGoalsForAccount = (accountName: string) => {
    return savingsGoals.filter(goal => 
      goal.accountId === accountName || accounts.find(acc => acc === accountName)
    );
  };

  const renderCategoryView = () => {
    const categoryGroups = groupSavingsByCategory();
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Visa sparandebelopp för:</span>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as ViewMode)}
            className="grid grid-cols-2 w-full max-w-md"
          >
            <ToggleGroupItem 
              value="category" 
              className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Kategori
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="account" 
              className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Konto
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        <div className="flex justify-between items-center">
          <h4 className="font-semibold">Sparandekategorier</h4>
          <div className="space-x-2">
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline">
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {Object.entries(categoryGroups).map(([categoryName, data]) => {
          const actualAmount = 0; // TODO: Calculate actual amount for this category
          const difference = data.total - actualAmount;
          const progress = data.total > 0 ? (actualAmount / data.total) * 100 : 0;
         
          return (
            <div key={categoryName} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCategoryExpansion(categoryName)}
                  className="p-1"
                >
                  {expandedCategories.has(categoryName) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex-1">
                  <div className="font-medium">{categoryName}</div>
                  <div className="text-xs text-muted-foreground">
                    {data.subcategories.length} {data.subcategories.length === 1 ? 'post' : 'poster'}
                  </div>
                </div>
                
                {/* Budget vs Actual */}
                <div className="space-y-1 text-right min-w-32">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Budget: </span>
                    <span className="font-medium">{formatCurrency(data.total)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Faktiskt: </span>
                    <span className="font-bold text-green-600 underline">
                      {formatCurrency(actualAmount)}
                    </span>
                  </div>
                  <div className={`text-sm font-medium ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Diff: {difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-1">
                <Progress 
                  value={Math.min(progress, 100)} 
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground text-right">
                  {progress.toFixed(1)}% av budget använd
                </div>
              </div>

              {expandedCategories.has(categoryName) && (
                <div className="pl-6 space-y-2 border-l-2 border-muted">
                  {data.subcategories.map((sub) => (
                    <div key={sub.id} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                      <span className="flex-1">
                        {sub.name}{sub.account ? ` (${sub.account})` : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-600">
                          {formatCurrency(sub.amount)}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => onEditSavingsGroup({ id: sub.groupId } as BudgetGroup)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onDeleteSavingsGroup(sub.groupId)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Savings Goals at bottom for category view */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Sparmål</CardTitle>
          </CardHeader>
          <CardContent>
            {savingsGoals.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="text-4xl mb-2">🎯</div>
                <p>Inga sparmål skapade ännu</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savingsGoals.map((goal) => (
                  <div key={goal.id} className="border rounded-lg p-3 bg-green-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{goal.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {goal.accountId} • {goal.startDate} till {goal.endDate}
                        </p>
                        <p className="text-sm">
                          {(goal.targetAmount / 12).toLocaleString()} kr/mån
                        </p>
                        <p className="text-sm text-muted-foreground">0 kr sparat</p>
                      </div>
                      <div className="text-right text-sm">
                        <div>Total framsteg</div>
                        <div>0.0% (0 kr / {goal.targetAmount.toLocaleString()} kr)</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAccountView = () => {
    const groupedSavings = groupSavingsByAccount();
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Visa sparandebelopp för:</span>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as ViewMode)}
            className="grid grid-cols-2 w-full max-w-md"
          >
            <ToggleGroupItem 
              value="category" 
              className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Kategori
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="account" 
              className="text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Konto
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex justify-between items-center">
          <h4 className="font-semibold">Sparandekategorier</h4>
          <div className="space-x-2">
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline">
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {Object.entries(groupedSavings).map(([accountName, accountSavings]) => {
          const accountGoals = getSavingsGoalsForAccount(accountName);
          const accountTotal = accountSavings.reduce((sum, group) => sum + group.amount, 0);
          
          return (
            <div key={accountName} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAccountExpansion(accountName)}
                    className="p-1"
                  >
                    {expandedAccounts.has(accountName) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <span className="font-medium">{accountName}</span>
                  <Badge variant="secondary">
                    {accountSavings.length} kategorier
                  </Badge>
                </div>
                <span className="font-semibold text-green-600">
                  {accountTotal.toLocaleString()} kr
                </span>
              </div>

              {expandedAccounts.has(accountName) && (
                <div className="mt-3 pl-6 space-y-3 border-l-2 border-muted">
                  {/* Savings Categories */}
                  <div className="space-y-2">
                    {accountSavings.map((group) => (
                      <div key={group.id} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                        <span className="font-medium">{group.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-green-600">
                            {group.amount.toLocaleString()} kr
                          </span>
                          <Button size="sm" variant="outline" onClick={() => onEditSavingsGroup(group)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => onDeleteSavingsGroup(group.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Savings Goals for this account */}
                  {accountGoals.length > 0 && (
                    <div className="border-t pt-3">
                      <h5 className="font-medium text-sm mb-2">Sparmål</h5>
                      <div className="space-y-2">
                        {accountGoals.map((goal) => (
                          <div key={goal.id} className="p-2 bg-green-50 rounded text-sm">
                            <div className="flex justify-between">
                              <div>
                                <div className="font-medium">{goal.name}</div>
                                <div className="text-muted-foreground">
                                  {goal.startDate} - {goal.endDate}
                                </div>
                                <div>{(goal.targetAmount / 12).toLocaleString()} kr/mån</div>
                                <div className="text-muted-foreground">0 kr sparat</div>
                              </div>
                              <div className="text-right">
                                <div>Total framsteg</div>
                                <div>0.0% (0 kr / {goal.targetAmount.toLocaleString()} kr)</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">Totalt sparande</CardTitle>
            <div className="text-2xl font-bold text-green-600">
              {totalSavings.toLocaleString()} kr
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {viewMode === 'category' ? renderCategoryView() : renderAccountView()}

        {/* Daily transfer information at bottom */}
        <Card className="mt-6 bg-muted/20">
          <CardContent className="pt-4">
            <h4 className="font-medium mb-2">Total daglig budget: 8 760 kr</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Daglig överföring (måndag-torsdag): 300</div>
              <div>Helgöverföring (fredag-söndag): 540</div>
              <div>• Vardagar: 22 × 300 kr = 6 600 kr</div>
              <div>• Helgdagar: 4 × 540 kr = 2 160 kr</div>
            </div>
          </CardContent>
        </Card>
      </CardContent>

      <AddSavingsItemDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={onAddSavingsItem}
        mainCategories={mainCategories}
        accounts={accounts.map(acc => typeof acc === 'string' ? acc : (acc as any).name || (acc as any).id)}
      />
    </Card>
  );
};