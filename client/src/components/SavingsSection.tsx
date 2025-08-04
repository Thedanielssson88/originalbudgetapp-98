import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronDown, ChevronUp, Plus, Edit, Trash2 } from 'lucide-react';
import { BudgetGroup, SavingsGoal, Transaction } from '../types/budget';
import { AddSavingsItemDialog } from './AddSavingsItemDialog';

interface SavingsSectionProps {
  savingsGroups: BudgetGroup[];
  savingsGoals: SavingsGoal[];
  accounts: { id: string; name: string }[];
  mainCategories: string[];
  transactionsForPeriod?: Transaction[];
  calculateSavingsActualForCategory?: (categoryName: string) => number;
  calculateActualForTarget?: (targetId: string) => number;
  onSavingsCategoryDrillDown?: (categoryName: string, budgetAmount: number) => void;
  onSavingsTargetDrillDown?: (targetId: string, targetName: string, budgetAmount: number) => void;
  onAddSavingsItem: () => void;
  onEditSavingsGroup: (group: BudgetGroup) => void;
  onDeleteSavingsGroup: (id: string) => void;
}

type ViewMode = 'category' | 'account';

export const SavingsSection: React.FC<SavingsSectionProps> = ({
  savingsGroups,
  savingsGoals,
  accounts,
  mainCategories,
  transactionsForPeriod = [],
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

  // For now, use simple calculation since SavingsSection doesn't have budgetState access
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
    // Get only transactions with type 'Savings' (Typ: Sparande)
    const savingsTransactions = transactionsForPeriod.filter(t => t.type === 'Savings');
    
    // Debug: Log savings transactions and accounts
    console.log('🔍 Savings transactions:', savingsTransactions);
    console.log('🔍 Available accounts:', accounts);
    
    return (
      <div className="space-y-4">
        {/* View Type Toggle */}
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
        
        {/* Add button for new savings item */}
        <div className="flex justify-end mb-4">
          <Button
            size="sm"
            onClick={onAddSavingsItem}
            className="bg-gradient-to-r from-green-500/10 to-green-600/20 hover:from-green-500/20 hover:to-green-600/30"
          >
            <Plus className="w-4 h-4 mr-1" />
            Lägg till sparpost
          </Button>
        </div>

        {/* Account sections */}
        {accounts.map((account) => {
          const accountExpanded = expandedAccounts.has(account.id);
          
          // Get savings items for this account
          const savingsItemsForAccount = savingsGroups.flatMap(group => 
            (group.subCategories || [])
              .filter(sub => sub.accountId === account.id)
              .map(sub => ({ ...sub, groupName: group.name, groupId: group.id }))
          );
          
          // Get savings goals for this account
          const goalsForAccount = savingsGoals.filter(goal => goal.accountId === account.id);
          
          // Get savings transactions for this account
          const transactionsForAccount = savingsTransactions.filter(t => 
            t.accountId === account.id
          );
          
          // Always show the account, even if no savings data exists yet
          
          // Calculate totals
          const budgetedAmount = savingsItemsForAccount.reduce((sum, item) => sum + item.amount, 0);
          const goalMonthlyAmount = goalsForAccount.reduce((sum, goal) => {
            const start = new Date(goal.startDate + '-01');
            const end = new Date(goal.endDate + '-01');
            const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + 
                               (end.getMonth() - start.getMonth()) + 1;
            return sum + (goal.targetAmount / monthsDiff);
          }, 0);
          const totalBudgeted = budgetedAmount + goalMonthlyAmount;
          
          const actualAmount = transactionsForAccount.reduce((sum, t) => {
            const effectiveAmount = t.correctedAmount !== undefined ? t.correctedAmount : t.amount;
            return sum + Math.abs(effectiveAmount);
          }, 0);
          
          const difference = totalBudgeted - actualAmount;
          
          return (
            <div key={account.id} className="space-y-4">
              {/* Account header with totals */}
              <div 
                className="bg-green-50 border border-green-200 rounded-lg p-4 cursor-pointer"
                onClick={() => toggleAccountExpansion(account.id)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-green-800">{account.name}</h4>
                    {accountExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-green-700">
                      Budget: {formatCurrency(totalBudgeted)}
                    </div>
                    <div className="text-sm text-green-800">
                      Faktiskt: <span className="font-bold">{formatCurrency(actualAmount)}</span>
                    </div>
                    <div className={`text-sm font-medium ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {difference >= 0 ? '+' : ''}{formatCurrency(Math.abs(difference))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Expanded content for this account */}
              {accountExpanded && (
                <div className="mt-4 space-y-4">
                  {/* Savings items (posts) for this account */}
                  {savingsItemsForAccount.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="font-medium text-sm text-green-700">Sparandeposter</h5>
                      {savingsItemsForAccount.map((item) => {
                        const actualForItem = calculateActualForTarget ? calculateActualForTarget(item.id) : 0;
                        const difference = item.amount - actualForItem;
                        const progress = item.amount > 0 ? (actualForItem / item.amount) * 100 : 0;
                        
                        return (
                          <div key={item.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{item.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  Kategori: {item.groupName}
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

                  {/* Savings goals for this account */}
                  {goalsForAccount.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="font-medium text-sm text-green-700">Sparmål</h5>
                      {goalsForAccount.map((goal) => {
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
                )}
                  
                  {/* Savings transactions for this account */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm text-green-700">Sparandetransaktioner</h5>
                    {transactionsForAccount.length > 0 ? (
                      <div className="space-y-2">
                        {transactionsForAccount.map((transaction) => {
                          const effectiveAmount = transaction.correctedAmount !== undefined ? transaction.correctedAmount : transaction.amount;
                          return (
                            <div key={transaction.id} className="p-2 bg-gray-50 border border-gray-200 rounded">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="text-sm font-medium">{transaction.description}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(transaction.date).toLocaleDateString('sv-SE')}
                                    {transaction.bankCategory && ` • ${transaction.bankCategory}`}
                                    {transaction.bankSubCategory && ` / ${transaction.bankSubCategory}`}
                                  </div>
                                </div>
                                <div className="text-sm font-medium text-green-600">
                                  {formatCurrency(Math.abs(effectiveAmount))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-4">
                        <p className="text-sm">Inga transaktioner med typ "Sparande" för denna period</p>
                      </div>
                    )}
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