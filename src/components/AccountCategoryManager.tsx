import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';

interface Account {
  name: string;
  category: string;
}

interface AccountCategoryManagerProps {
  accounts: Account[];
  accountCategories: string[];
  onAccountsChange: (accounts: Account[]) => void;
  onCategoriesChange: (categories: string[]) => void;
}

export const AccountCategoryManager = ({ 
  accounts, 
  accountCategories, 
  onAccountsChange, 
  onCategoriesChange 
}: AccountCategoryManagerProps) => {
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountCategory, setNewAccountCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const addAccount = () => {
    if (newAccountName.trim() && newAccountCategory.trim() && 
        !accounts.some(acc => acc.name === newAccountName.trim())) {
      onAccountsChange([...accounts, {name: newAccountName.trim(), category: newAccountCategory.trim()}]);
      setNewAccountName('');
      setNewAccountCategory('');
    }
  };

  const addAccountCategory = () => {
    if (newCategoryName.trim() && !accountCategories.includes(newCategoryName.trim())) {
      onCategoriesChange([...accountCategories, newCategoryName.trim()]);
      setNewCategoryName('');
    }
  };

  const removeAccount = (accountToRemove: string) => {
    onAccountsChange(accounts.filter(account => account.name !== accountToRemove));
  };

  const removeAccountCategory = (categoryToRemove: string) => {
    const accountsUsingCategory = accounts.filter(acc => acc.category === categoryToRemove);
    if (accountsUsingCategory.length > 0) {
      alert(`Kan inte ta bort kategorin "${categoryToRemove}" eftersom den används av konton: ${accountsUsingCategory.map(acc => acc.name).join(', ')}`);
      return;
    }
    onCategoriesChange(accountCategories.filter(cat => cat !== categoryToRemove));
  };

  const updateAccountCategory = (accountName: string, newCategory: string) => {
    onAccountsChange(accounts.map(acc => 
      acc.name === accountName ? {...acc, category: newCategory} : acc
    ));
  };

  return (
    <div className="space-y-6">
      {/* Add New Category */}
      <div className="space-y-3">
        <h4 className="font-semibold">Hantera kontokategorier</h4>
        <div className="flex gap-2">
          <Input
            placeholder="Ny kategori"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <Button onClick={addAccountCategory} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Lägg till
          </Button>
        </div>
        
        {/* Existing Categories */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Befintliga kategorier:</Label>
          {accountCategories.map((category) => (
            <div key={category} className="flex justify-between items-center p-2 bg-white rounded border">
              <span>{category}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => removeAccountCategory(category)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Add New Account */}
      <div className="space-y-3">
        <h4 className="font-semibold">Lägg till nytt konto</h4>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Kontonamn"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
          />
          <Select value={newAccountCategory} onValueChange={setNewAccountCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Välj kategori" />
            </SelectTrigger>
            <SelectContent>
              {accountCategories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={addAccount} size="sm" className="w-full">
          <Plus className="w-4 h-4 mr-1" />
          Lägg till konto
        </Button>
      </div>

      {/* Existing Accounts */}
      <div className="space-y-3">
        <h4 className="font-semibold">Befintliga konton</h4>
        {accountCategories.map(category => {
          const categoryAccounts = accounts.filter(acc => acc.category === category);
          if (categoryAccounts.length === 0) return null;
          
          return (
            <div key={category} className="space-y-2">
              <Label className="text-sm font-medium text-primary">{category}</Label>
              {categoryAccounts.map((account) => (
                <div key={account.name} className="flex justify-between items-center p-2 bg-white rounded border ml-4">
                  <div className="flex items-center gap-2">
                    <span>{account.name}</span>
                    <Select 
                      value={account.category} 
                      onValueChange={(newCategory) => updateAccountCategory(account.name, newCategory)}
                    >
                      <SelectTrigger className="w-32 h-6 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accountCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeAccount(account.name)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
