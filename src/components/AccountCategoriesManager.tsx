import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit, Save, X, Settings } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  category: string;
}

interface AccountCategoriesManagerProps {
  accounts: string[];
  accountCategories: string[];
  accountCategoryMapping: {[key: string]: string};
  onAccountsChange: (accounts: string[]) => void;
  onCategoriesChange: (categories: string[]) => void;
  onCategoryMappingChange: (mapping: {[key: string]: string}) => void;
}

const AccountCategoriesManager: React.FC<AccountCategoriesManagerProps> = ({
  accounts,
  accountCategories,
  accountCategoryMapping,
  onAccountsChange,
  onCategoriesChange,
  onCategoryMappingChange,
}) => {
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [newAccountCategory, setNewAccountCategory] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [isEditingCategories, setIsEditingCategories] = useState<boolean>(false);
  const [isEditingAccounts, setIsEditingAccounts] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<string | null>(null);
  const [editingAccountData, setEditingAccountData] = useState<{ name: string; category: string }>({ name: '', category: '' });

  const addCategory = () => {
    if (newCategoryName.trim() && !accountCategories.includes(newCategoryName.trim())) {
      onCategoriesChange([...accountCategories, newCategoryName.trim()]);
      setNewCategoryName('');
    }
  };

  const removeCategory = (categoryName: string) => {
    // Check if any accounts use this category
    const accountsUsingCategory = accounts.filter(accountName => accountCategoryMapping[accountName] === categoryName);
    if (accountsUsingCategory.length > 0) {
      alert(`Kan inte ta bort kategori "${categoryName}" eftersom den används av följande konton: ${accountsUsingCategory.join(', ')}`);
      return;
    }
    
    onCategoriesChange(accountCategories.filter(category => category !== categoryName));
  };

  const addAccount = () => {
    if (newAccountName.trim() && newAccountCategory.trim() && 
        !accounts.includes(newAccountName.trim())) {
      onAccountsChange([...accounts, newAccountName.trim()]);
      onCategoryMappingChange({
        ...accountCategoryMapping,
        [newAccountName.trim()]: newAccountCategory.trim()
      });
      setNewAccountName('');
      setNewAccountCategory('');
    }
  };

  const removeAccount = (accountName: string) => {
    onAccountsChange(accounts.filter(account => account !== accountName));
    const newMapping = { ...accountCategoryMapping };
    delete newMapping[accountName];
    onCategoryMappingChange(newMapping);
  };

  const startEditingAccount = (accountName: string) => {
    setEditingAccount(accountName);
    setEditingAccountData({ name: accountName, category: accountCategoryMapping[accountName] || 'Huvudkonton' });
  };

  const saveAccountEdit = () => {
    if (editingAccount && editingAccountData.name.trim()) {
      const updatedAccounts = accounts.map(account => 
        account === editingAccount 
          ? editingAccountData.name.trim()
          : account
      );
      
      const newMapping = { ...accountCategoryMapping };
      delete newMapping[editingAccount];
      newMapping[editingAccountData.name.trim()] = editingAccountData.category;
      
      onAccountsChange(updatedAccounts);
      onCategoryMappingChange(newMapping);
      setEditingAccount(null);
      setEditingAccountData({ name: '', category: '' });
    }
  };

  const cancelAccountEdit = () => {
    setEditingAccount(null);
    setEditingAccountData({ name: '', category: '' });
  };

  // Group accounts by category
  const accountsByCategory = accountCategories.reduce((acc, category) => {
    acc[category] = accounts.filter(accountName => accountCategoryMapping[accountName] === category);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="space-y-6">
      {/* Categories Management */}
      <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Kontokategorier
          </CardTitle>
          <CardDescription>
            Hantera kategorier för dina konton
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setIsEditingCategories(!isEditingCategories)}
              variant="outline"
              size="sm"
            >
              <Edit className="h-4 w-4 mr-2" />
              {isEditingCategories ? 'Sluta redigera' : 'Redigera kategorier'}
            </Button>
          </div>

          {isEditingCategories && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div className="flex gap-2">
                <Input
                  placeholder="Ny kategori"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={addCategory} disabled={!newCategoryName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {accountCategories.map((category) => (
                  <div key={category} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-medium">{category}</span>
                    <Button 
                      onClick={() => removeCategory(category)}
                      variant="ghost" 
                      size="sm"
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {accountCategories.map((category) => (
              <div key={category} className="p-3 border rounded-lg">
                <h4 className="font-medium mb-2">{category}</h4>
                <div className="text-sm text-muted-foreground">
                  {accountsByCategory[category]?.length || 0} konton
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accounts Management */}
      <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Kontohantering
          </CardTitle>
          <CardDescription>
            Lägg till, redigera och ta bort konton
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setIsEditingAccounts(!isEditingAccounts)}
              variant="outline"
              size="sm"
            >
              <Edit className="h-4 w-4 mr-2" />
              {isEditingAccounts ? 'Sluta redigera' : 'Redigera konton'}
            </Button>
          </div>

          {isEditingAccounts && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                    {accountCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={addAccount} 
                disabled={!newAccountName.trim() || !newAccountCategory.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Lägg till konto
              </Button>
            </div>
          )}

          <div className="space-y-4">
            {accountCategories.map((category) => (
              <div key={category} className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">{category}</h4>
                <div className="space-y-2">
                  {accountsByCategory[category]?.map((accountName) => (
                    <div key={accountName} className="flex items-center justify-between p-3 border rounded-lg">
                      {editingAccount === accountName ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingAccountData.name}
                            onChange={(e) => setEditingAccountData({ ...editingAccountData, name: e.target.value })}
                            className="flex-1"
                          />
                          <Select 
                            value={editingAccountData.category} 
                            onValueChange={(value) => setEditingAccountData({ ...editingAccountData, category: value })}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {accountCategories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={saveAccountEdit} size="sm">
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button onClick={cancelAccountEdit} variant="ghost" size="sm">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium">{accountName}</span>
                          {isEditingAccounts && (
                            <div className="flex gap-1">
                              <Button 
                                onClick={() => startEditingAccount(accountName)}
                                variant="ghost" 
                                size="sm"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                onClick={() => removeAccount(accountName)}
                                variant="ghost" 
                                size="sm"
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountCategoriesManager;