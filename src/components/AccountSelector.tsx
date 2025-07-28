import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface AccountSelectorProps {
  accounts: string[];
  selectedAccounts: string[];
  onSelectionChange: (accounts: string[]) => void;
  accountCategories: string[];
  accountCategoryMapping: { [accountName: string]: string };
  accountColors: string[];
  className?: string;
}

export function AccountSelector({
  accounts,
  selectedAccounts,
  onSelectionChange,
  accountCategories,
  accountCategoryMapping,
  accountColors,
  className = ""
}: AccountSelectorProps) {
  
  // Helper function to group accounts by category
  const getAccountsByCategory = () => {
    const grouped: { [category: string]: string[] } = {};
    
    // Initialize all categories
    accountCategories.forEach(category => {
      grouped[category] = [];
    });
    
    // Add accounts with categories
    Object.entries(accountCategoryMapping).forEach(([accountName, category]) => {
      if (accounts.includes(accountName) && grouped[category]) {
        grouped[category].push(accountName);
      }
    });
    
    // Add accounts without categories to "Hushåll" by default
    const accountsWithoutCategory = accounts.filter(account => {
      return !accountCategoryMapping[account];
    });
    
    if (accountsWithoutCategory.length > 0) {
      if (!grouped['Hushåll']) {
        grouped['Hushåll'] = [];
      }
      grouped['Hushåll'].push(...accountsWithoutCategory);
    }
    
    // Remove empty categories
    Object.keys(grouped).forEach(category => {
      if (grouped[category].length === 0) {
        delete grouped[category];
      }
    });
    
    return grouped;
  };

  const accountsByCategory = getAccountsByCategory();
  
  // Check if all accounts are selected
  const isAllSelected = accounts.length > 0 && accounts.every(account => selectedAccounts.includes(account));
  
  // Check if all accounts in a category are selected
  const isCategoryAllSelected = (categoryAccounts: string[]) => {
    return categoryAccounts.length > 0 && categoryAccounts.every(account => selectedAccounts.includes(account));
  };
  
  // Handle select all / deselect all
  const handleSelectAll = (checked: boolean | string) => {
    const isChecked = checked === true;
    if (isChecked) {
      onSelectionChange([...accounts]);
    } else {
      onSelectionChange([]);
    }
  };
  
  // Handle category select all
  const handleCategorySelectAll = (categoryAccounts: string[], checked: boolean | string) => {
    const isChecked = checked === true;
    if (isChecked) {
      // Add all accounts in this category
      const newSelection = [...new Set([...selectedAccounts, ...categoryAccounts])];
      onSelectionChange(newSelection);
    } else {
      // Remove all accounts in this category
      const newSelection = selectedAccounts.filter(account => !categoryAccounts.includes(account));
      onSelectionChange(newSelection);
    }
  };
  
  // Handle individual account toggle
  const handleAccountToggle = (account: string, checked: boolean | string) => {
    const isChecked = checked === true;
    if (isChecked) {
      onSelectionChange([...selectedAccounts, account]);
    } else {
      onSelectionChange(selectedAccounts.filter(a => a !== account));
    }
  };

  return (
    <div className={`bg-muted/50 p-4 rounded-lg space-y-4 ${className}`}>
      <h4 className="font-medium">Välj konton att visa:</h4>
      
      {/* Select All / Deselect All */}
      <div className="flex items-center space-x-2 pb-2 border-b border-border">
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={handleSelectAll}
        />
        <Label className="font-medium text-sm">
          {isAllSelected ? 'Avmarkera alla' : 'Välj alla'}
        </Label>
      </div>
      
      {/* Categories */}
      <div className="space-y-4">
        {Object.entries(accountsByCategory).map(([category, categoryAccounts]) => {
          const isCategorySelected = isCategoryAllSelected(categoryAccounts);
          
          return (
            <div key={category} className="space-y-3">
              {/* Category Header */}
              <div className="space-y-2">
                <h5 className="font-medium text-muted-foreground">{category}</h5>
                <div className="flex items-center space-x-2 ml-4">
                  <Checkbox
                    checked={isCategorySelected}
                    onCheckedChange={(checked) => handleCategorySelectAll(categoryAccounts, checked)}
                  />
                  <Label className="text-sm font-medium">
                    Välj alla i kategorin
                  </Label>
                </div>
              </div>
              
              {/* Individual Accounts */}
              <div className="space-y-2 ml-8">
                {categoryAccounts.map((account) => {
                  const accountIndex = accounts.indexOf(account);
                  const color = accountColors[accountIndex % accountColors.length];
                  
                  return (
                    <div key={account} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedAccounts.includes(account)}
                        onCheckedChange={(checked) => handleAccountToggle(account, checked)}
                      />
                      <div 
                        className="w-3 h-3 rounded-full border border-gray-300 shrink-0" 
                        style={{ backgroundColor: color }}
                      />
                      <Label className="text-sm">{account}</Label>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}