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
  accounts: { id: string; name: string }[];
  mainCategories: string[];
  calculateSavingsActualForCategory?: (categoryName: string) => number;
  calculateActualForTarget?: (targetId: string) => number;
  onSavingsCategoryDrillDown?: (categoryName: string, budgetAmount: number) => void;
  onSavingsTargetDrillDown?: (targetId: string, targetName: string, budgetAmount: number) => void;
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
  calculateSavingsActualForCategory,
  calculateActualForTarget,
  onSavingsCategoryDrillDown,
  onSavingsTargetDrillDown,
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

  const totalSavings = savingsGroups.reduce((sum, group) => sum + (group.amount || 0), 0);

  const formatCurrency = (amount: number) => `${amount.toLocaleString()} kr`;

  const groupSavingsByAccount = () => {
    const grouped: Record<string, BudgetGroup[]> = {};
    
    savingsGroups.forEach(group => {
      // For savings groups, check subcategories for account information
      if (group.subCategories && group.subCategories.length > 0) {
        group.subCategories.forEach(sub => {
          const accountName = sub.accountId ? accounts.find(acc => acc.id === sub.accountId)?.name || 'Inget konto' : 'Inget konto';
          
          // Create a virtual group for each subcategory with account info
          const virtualGroup = {
            ...group,
            amount: sub.amount,
            subCategories: [sub]
          };
          
          if (!grouped[accountName]) {
            grouped[accountName] = [];
          }
          grouped[accountName].push(virtualGroup);
        });
      } else {
        // Fallback for groups without subcategories
        const accountName = group.accountId ? accounts.find(acc => acc.id === group.accountId)?.name || 'Inget konto' : 'Inget konto';
        if (!grouped[accountName]) {
          grouped[accountName] = [];
        }
        grouped[accountName].push(group);
      }
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
      goal.accountId === accounts.find(acc => acc.name === accountName)?.id
    );
  };

  const renderCategoryView = () => {
    // Flatten all savings subcategories into a single list
    const allSavingsItems: { id: string; name: string; amount: number; account?: string; groupId: string }[] = [];
    
    savingsGroups.forEach((group) => {
      group.subCategories?.forEach((sub) => {
        allSavingsItems.push({
          ...sub,
          groupId: group.id
        });
      });
    });
    
    return (
      <div className="space-y-4">
        {/* Cost View Type Option */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Visa sparandebelopp för:</h4>
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
        
        {/* Sparandebudget section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold">Sparandebudget</h4>
            <div className="space-x-2">
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline">
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {allSavingsItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <div className="text-4xl mb-2">💰</div>
              <p>Inga sparandeposter skapade ännu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allSavingsItems.map((item) => {
                const actualForItem = calculateActualForTarget ? calculateActualForTarget(item.id) : 0;
                const difference = item.amount - actualForItem;
                const progress = item.amount > 0 ? (actualForItem / item.amount) * 100 : 0;
                
                return (
                  <div key={item.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {item.account ? `Konto: ${item.account}` : 'Inget konto valt'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Budget: </span>
                          <span className="font-medium">{formatCurrency(item.amount)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Faktiskt: </span>
                          {onSavingsTargetDrillDown ? (
                            <button
                              className="font-bold text-blue-600 hover:text-blue-500 underline decoration-2 underline-offset-2 hover:scale-105 transition-all duration-200"
                              onClick={() => onSavingsTargetDrillDown(item.id, item.name, item.amount)}
                            >
                              {formatCurrency(actualForItem)}
                            </button>
                          ) : (
                            <span className="font-bold text-blue-600">{formatCurrency(actualForItem)}</span>
                          )}
                        </div>
                        <div className={`text-sm font-medium ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Diff: {difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Framsteg</span>
                        <span>{progress.toFixed(1)}% av budget använd</span>
                      </div>
                      <Progress value={Math.min(progress, 100)} className="h-2" />
                    </div>
                    
                    <div className="flex justify-end gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => onEditSavingsGroup({ id: item.groupId } as BudgetGroup)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDeleteSavingsGroup(item.groupId)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sparmål section */}
        <div className="mt-6 pt-4 border-t border-green-200">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold">Sparmål</h4>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Nytt mål
            </Button>
          </div>
          
          {savingsGoals.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <div className="text-4xl mb-2">🎯</div>
              <p>Inga sparmål skapade ännu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savingsGoals.map((goal) => {
                // Calculate monthly amount
                const start = new Date(goal.startDate + '-01');
                const end = new Date(goal.endDate + '-01');
                const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                                   (end.getMonth() - start.getMonth()) + 1;
                const monthlyAmount = goal.targetAmount / monthsDiff;
                
                // Calculate actual saved using the target function
                const actualSaved = calculateActualForTarget ? calculateActualForTarget(goal.id) : 0;
                const totalProgress = Math.min((actualSaved / goal.targetAmount) * 100, 100);
                
                return (
                  <div key={goal.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{goal.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {goal.accountId} • {goal.startDate} till {goal.endDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(monthlyAmount)}/mån
                        </div>
                        <div className="text-xs text-muted-foreground">
                        <button
                          className="font-bold text-green-600 hover:text-green-500 underline decoration-2 underline-offset-2 hover:scale-105 transition-all duration-200"
                          onClick={() => {
                            console.log(`🎯 [SavingsSection] Clicked on goal:`, { 
                              id: goal.id, 
                              name: goal.name, 
                              targetAmount: goal.targetAmount,
                              accountId: goal.accountId 
                            });
                            console.log(`🎯 [SavingsSection] All available savings goals:`, savingsGoals);
                            onSavingsTargetDrillDown && onSavingsTargetDrillDown(goal.id, goal.name, goal.targetAmount);
                          }}
                        >
                          {formatCurrency(actualSaved)} sparat
                        </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Total framsteg</span>
                        <span>
                          {totalProgress.toFixed(1)}% ({formatCurrency(actualSaved)} / {formatCurrency(goal.targetAmount)})
                        </span>
                      </div>
                      <Progress value={totalProgress} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAccountView = () => {
    const groupedSavings = groupSavingsByAccount();
    
    return (
      <div className="space-y-4">
        {/* Cost View Type Option */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Visa sparandebelopp för:</h4>
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
        
        {/* Account sections organized like category view */}
        {Object.entries(groupedSavings).map(([accountName, accountSavings]) => {
          const accountGoals = getSavingsGoalsForAccount(accountName);
          
          return (
            <div key={accountName} className="space-y-4">
              {/* Account section header */}
              <div className="flex justify-between items-center">
                <h4 className="font-semibold">Kontot {accountName}</h4>
                <div className="space-x-2">
                  <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* Savings items for this account - same design as category view */}
              {accountSavings.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <div className="text-4xl mb-2">💰</div>
                  <p>Inga sparandeposter skapade ännu för {accountName}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {accountSavings.map((group) => {
                    // For account view, show each subcategory as individual items
                    return group.subCategories?.map((item) => {
                      const actualForItem = calculateActualForTarget ? calculateActualForTarget(item.id) : 0;
                      const difference = item.amount - actualForItem;
                      const progress = item.amount > 0 ? (actualForItem / item.amount) * 100 : 0;
                      
                      return (
                        <div key={item.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{item.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                Kategori: {group.name}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm">
                                <span className="text-muted-foreground">Budget: </span>
                                <span className="font-medium">{formatCurrency(item.amount)}</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-muted-foreground">Faktiskt: </span>
                                {onSavingsTargetDrillDown ? (
                                  <button
                                    className="font-bold text-blue-600 hover:text-blue-500 underline decoration-2 underline-offset-2 hover:scale-105 transition-all duration-200"
                                    onClick={() => onSavingsTargetDrillDown(item.id, item.name, item.amount)}
                                  >
                                    {formatCurrency(actualForItem)}
                                  </button>
                                ) : (
                                  <span className="font-bold text-blue-600">{formatCurrency(actualForItem)}</span>
                                )}
                              </div>
                              <div className={`text-sm font-medium ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Diff: {difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>Framsteg</span>
                              <span>{progress.toFixed(1)}% av budget använd</span>
                            </div>
                            <Progress value={Math.min(progress, 100)} className="h-2" />
                          </div>
                          
                          <div className="flex justify-end gap-2 mt-2">
                            <Button size="sm" variant="outline" onClick={() => onEditSavingsGroup({ id: group.id } as BudgetGroup)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => onDeleteSavingsGroup(group.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    }) || [];
                  })}
                </div>
              )}

              {/* Savings goals for this account - same design as category view */}
              {accountGoals.length > 0 && (
                <div className="mt-6 pt-4 border-t border-green-200">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold">Sparmål</h4>
                    <Button size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-1" />
                      Nytt mål
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {accountGoals.map((goal) => {
                      // Calculate monthly amount
                      const start = new Date(goal.startDate + '-01');
                      const end = new Date(goal.endDate + '-01');
                      const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                                         (end.getMonth() - start.getMonth()) + 1;
                      const monthlyAmount = goal.targetAmount / monthsDiff;
                      
                      // Calculate actual saved using the target function
                      const actualSaved = calculateActualForTarget ? calculateActualForTarget(goal.id) : 0;
                      const totalProgress = Math.min((actualSaved / goal.targetAmount) * 100, 100);
                      
                      return (
                        <div key={goal.id} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{goal.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {goal.startDate} till {goal.endDate}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-green-600">
                                {formatCurrency(monthlyAmount)}/mån
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <button
                                  className="font-bold text-green-600 hover:text-green-500 underline decoration-2 underline-offset-2 hover:scale-105 transition-all duration-200"
                                  onClick={() => {
                                    console.log(`🎯 [SavingsSection] Clicked on goal:`, { 
                                      id: goal.id, 
                                      name: goal.name, 
                                      targetAmount: goal.targetAmount,
                                      accountId: goal.accountId 
                                    });
                                    console.log(`🎯 [SavingsSection] All available savings goals:`, savingsGoals);
                                    onSavingsTargetDrillDown && onSavingsTargetDrillDown(goal.id, goal.name, goal.targetAmount);
                                  }}
                                >
                                  {formatCurrency(actualSaved)} sparat
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>Total framsteg</span>
                              <span>
                                {totalProgress.toFixed(1)}% ({formatCurrency(actualSaved)} / {formatCurrency(goal.targetAmount)})
                              </span>
                            </div>
                            <Progress value={totalProgress} className="h-2" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {viewMode === 'category' ? renderCategoryView() : renderAccountView()}

      {/* Daily transfer information at bottom */}
      <Card className="bg-muted/20">
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

      <AddSavingsItemDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={onAddSavingsItem}
        mainCategories={mainCategories}
        accounts={accounts.map(acc => acc.name)}
      />
    </div>
  );
};