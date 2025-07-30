import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  const getSavingsGoalsForAccount = (accountName: string) => {
    return savingsGoals.filter(goal => 
      accounts.find(acc => acc === accountName)
    );
  };

  const renderCategoryView = () => (
    <div className="space-y-4">
      {savingsGroups.map((group) => (
        <div key={group.id} className="border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleCategoryExpansion(group.id)}
                className="p-1"
              >
                {expandedCategories.has(group.id) ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
              <span className="font-medium">{group.name}</span>
              {group.subCategories && group.subCategories.length > 0 && (
                <Badge variant="secondary">
                  {group.subCategories.length} poster
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-600">
                {group.amount.toLocaleString()} kr
              </span>
              <Button size="sm" variant="outline" onClick={() => onEditSavingsGroup(group)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onDeleteSavingsGroup(group.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {expandedCategories.has(group.id) && group.subCategories && (
            <div className="mt-3 pl-6 space-y-2 border-l-2 border-muted">
              {group.subCategories.map((subCategory, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                  <div>
                    <span className="font-medium">{subCategory.name}</span>
                    {subCategory.account && (
                      <span className="text-sm text-muted-foreground ml-2">
                        ({subCategory.account})
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-green-600">
                    {subCategory.amount.toLocaleString()} kr
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Savings Goals Section */}
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
                        {goal.startDate} till {goal.endDate}
                      </p>
                      <p className="text-sm">
                        Målbelopp: {goal.targetAmount.toLocaleString()} kr
                      </p>
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

  const renderAccountView = () => {
    const groupedSavings = groupSavingsByAccount();
    
    return (
      <div className="space-y-4">
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
                            <div className="font-medium">{goal.name}</div>
                            <div className="text-muted-foreground">
                              {goal.startDate} - {goal.endDate} • {goal.targetAmount.toLocaleString()} kr
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
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Ny sparpost
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <span className="text-sm font-medium">Visa sparande per:</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={viewMode === 'category' ? 'default' : 'outline'}
              onClick={() => setViewMode('category')}
            >
              Kategori
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'account' ? 'default' : 'outline'}
              onClick={() => setViewMode('account')}
            >
              Konto
            </Button>
          </div>
        </div>

        {viewMode === 'category' ? renderCategoryView() : renderAccountView()}
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