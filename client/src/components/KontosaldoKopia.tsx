import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, TrendingUp } from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import { useBudgetPosts, useCreateBudgetPost, useUpdateBudgetPost } from '@/hooks/useBudgetPosts';
import { formatOrenAsCurrency, kronoraToOren } from '@/utils/currencyUtils';
import { useToast } from '@/hooks/use-toast';
import { useBudget } from '@/hooks/useBudget';

interface KontosaldoKopiaProps {
  monthKey: string;
}

export const KontosaldoKopia: React.FC<KontosaldoKopiaProps> = ({ monthKey }) => {
  const { data: accounts = [] } = useAccounts();
  const { data: budgetPosts = [] } = useBudgetPosts(monthKey);
  const createBudgetPost = useCreateBudgetPost();
  const updateBudgetPost = useUpdateBudgetPost();
  const { toast } = useToast();
  const { budgetState } = useBudget();
  
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['household']);
  const [localBalances, setLocalBalances] = useState<{ [accountId: string]: number | null }>({});
  const [focusedFields, setFocusedFields] = useState<{ [accountId: string]: boolean }>({});
  
  // Filter budget posts to only get Balance type
  const balancePosts = budgetPosts.filter(post => post.type === 'Balance');
  
  // Group accounts by owner
  const accountsByOwner = accounts.reduce((acc, account) => {
    const owner = account.owner || 'gemensamt';
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(account);
    return acc;
  }, {} as { [key: string]: typeof accounts });
  
  // Initialize local balances from budget posts or accounts - only when data changes significantly
  useEffect(() => {
    if (accounts.length > 0) {
      setLocalBalances(prevBalances => {
        const newBalances: { [accountId: string]: number } = {};
        
        // First, initialize all accounts with 0 or keep existing value
        accounts.forEach(account => {
          newBalances[account.id] = prevBalances[account.id] ?? 0;
        });
        
        // Then, override with actual values from budget posts (only if different)
        console.log('Budget posts to load from:', budgetPosts);
        budgetPosts.forEach(post => {
          console.log(`Checking post:`, post);
          if (post.type === 'Balance' && post.accountId) {
            if (post.accountUserBalance !== null && post.accountUserBalance !== undefined) {
              const valueInKronor = post.accountUserBalance / 100;
              // Only update if the value is different from what we have
              if (newBalances[post.accountId] !== valueInKronor) {
                newBalances[post.accountId] = valueInKronor;
                console.log(`✅ Loading balance for account ${post.accountId}: ${valueInKronor} kr from post ${post.id}`);
              }
            } else {
              // Set to null for "Ej ifyllt" state
              newBalances[post.accountId] = null;
              console.log(`✅ Loading null balance for account ${post.accountId} from post ${post.id} (Ej ifyllt)`);
            }
          }
        });
        
        // Only return new balances if they're actually different
        const hasChanges = Object.keys(newBalances).some(
          key => newBalances[key] !== prevBalances[key]
        );
        
        if (hasChanges) {
          console.log('Updating balances from DB:', newBalances);
          return newBalances;
        }
        
        return prevBalances;
      });
    }
  }, [accounts, budgetPosts]); // Re-initialize when budget posts are loaded from DB
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  
  const handleBalanceChange = (accountId: string, value: string) => {
    console.log(`handleBalanceChange called for ${accountId} with value: "${value}"`);
    
    // Allow empty string (set to null) and numbers
    if (value === '' || value === 'Ej ifyllt') {
      setLocalBalances(prev => {
        const newBalances = {
          ...prev,
          [accountId]: null
        };
        console.log('New balances after empty (Ej ifyllt):', newBalances);
        return newBalances;
      });
    } else {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        setLocalBalances(prev => {
          const newBalances = {
            ...prev,
            [accountId]: numericValue
          };
          console.log('New balances after update:', newBalances);
          return newBalances;
        });
      }
    }
  };
  
  const saveBalance = async (accountId: string, value: number | null) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;
    
    console.log(`Saving balance for ${account.name} (${accountId}): ${value} kr`);
    const balanceInOre = value !== null ? kronoraToOren(value) : null;
    console.log(`Converting to öre: ${balanceInOre}`);
    
    // Find existing balance post for this account
    const existingPost = balancePosts.find(post => post.accountId === accountId && post.type === 'Balance');
    console.log('Existing post:', existingPost);
    
    try {
      if (existingPost) {
        console.log(`Updating existing post ${existingPost.id} with accountUserBalance: ${balanceInOre}`);
        // Update existing post
        const result = await updateBudgetPost.mutateAsync({
          id: existingPost.id,
          data: {
            accountUserBalance: balanceInOre,
            accountBalance: existingPost.accountBalance // Keep bank balance unchanged
          }
        });
        console.log('Update result:', result);
      console.log('Update result accountUserBalance:', result?.accountUserBalance);
      } else if (balanceInOre !== null) {
        console.log(`Creating new balance post for account ${accountId}`);
        // Only create new post if value is not null
        const result = await createBudgetPost.mutateAsync({
          monthKey,
          type: 'Balance',
          accountId,
          accountUserBalance: balanceInOre,
          accountBalance: null, // Bank balance will be set separately
          amount: 0, // Not used for Balance type
          huvudkategoriId: null,
          underkategoriId: null,
          description: `Balance for ${account.name}` // Add required description field
        });
        console.log('Create result:', result);
        console.log('Create result accountUserBalance:', result?.accountUserBalance);
      }
      
      const displayValue = value !== null ? `${value} kr` : 'Ej ifyllt';
      toast({
        title: "Saldo sparat",
        description: `Kontosaldo för ${account.name}: ${displayValue}`,
      });
    } catch (error) {
      console.error('Error saving balance:', error);
      toast({
        title: "Fel vid sparande",
        description: "Kunde inte spara kontosaldo",
        variant: "destructive",
      });
    }
  };
  
  const getBalancePost = (accountId: string) => {
    return balancePosts.find(post => post.accountId === accountId && post.type === 'Balance');
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };
  
  const calculateTotal = () => {
    return Object.values(localBalances).reduce((sum, balance) => {
      return sum + (balance !== null && balance !== undefined ? balance : 0);
    }, 0);
  };
  
  const getCategoryLabel = (owner: string) => {
    switch (owner) {
      case 'gemensamt': return 'Hushåll';
      case 'andreas': return 'Andreas';
      case 'susanna': return 'Susanna';
      default: return owner;
    }
  };
  
  // Calculate payday date based on month and payday setting
  const getPaydayDateText = () => {
    if (!monthKey) return '';
    
    const [year, month] = monthKey.split('-').map(Number);
    const payday = budgetState?.payday || 25;
    
    const monthNames = [
      'januari', 'februari', 'mars', 'april', 'maj', 'juni',
      'juli', 'augusti', 'september', 'oktober', 'november', 'december'
    ];
    
    // For the payday date, we show the payday of the PREVIOUS month
    // E.g., for August (month 8), we show July 25
    let payYear = year;
    let payMonth = month - 1;
    
    if (payMonth === 0) {
      payMonth = 12;
      payYear = year - 1;
    }
    
    return `${payday} ${monthNames[payMonth - 1]}`;
  };
  
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-100/50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold mb-2 text-blue-800">
          Totalt saldo den {getPaydayDateText()}
        </h3>
        <p className="text-sm text-blue-700">
          Ange kontosaldo den sista transaktionen dagen före lönedatum.
        </p>
      </div>
      
      {Object.entries(accountsByOwner).map(([owner, ownerAccounts]) => {
        const ownerTotal = ownerAccounts.reduce((sum, account) => {
          const balance = localBalances[account.id];
          return sum + (balance !== null && balance !== undefined ? balance : 0);
        }, 0);
        const isExpanded = expandedCategories.includes(owner);
        
        return (
          <div key={owner} className="space-y-2">
            <Collapsible open={isExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between hover:bg-blue-50 p-4"
                  onClick={() => toggleCategory(owner)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getCategoryLabel(owner)}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(ownerTotal)} kr
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Visa konton ({ownerAccounts.length})
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-3">
                {ownerAccounts.map(account => {
                  const balancePost = getBalancePost(account.id);
                  const bankBalance = balancePost?.accountBalance;
                  const currentValue = localBalances[account.id];
                  const isFocused = focusedFields[account.id];
                  const displayValue = isFocused ? 
                    (currentValue !== null && currentValue !== undefined ? currentValue.toString() : '') :
                    (currentValue !== null && currentValue !== undefined ? currentValue.toString() : 'Ej ifyllt');
                  
                  return (
                    <Card key={account.id} className="p-4">
                      <div className="space-y-3">
                        <div className="font-medium">{account.name}</div>
                        
                        {/* Faktiskt Kontosaldo (editable) */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Faktiskt kontosaldo</span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              value={displayValue}
                              onChange={(e) => handleBalanceChange(account.id, e.target.value)}
                              onFocus={(e) => {
                                // Mark field as focused to show empty string instead of "Ej ifyllt"
                                setFocusedFields(prev => ({
                                  ...prev,
                                  [account.id]: true
                                }));
                              }}
                              onBlur={(e) => {
                                // Mark field as not focused
                                setFocusedFields(prev => ({
                                  ...prev,
                                  [account.id]: false
                                }));
                                
                                const value = e.target.value;
                                if (value === '' || value === 'Ej ifyllt') {
                                  saveBalance(account.id, null);
                                } else {
                                  const numericValue = parseFloat(value);
                                  if (!isNaN(numericValue)) {
                                    saveBalance(account.id, numericValue);
                                  }
                                }
                              }}
                              className="w-32 text-right"
                              placeholder="Ej ifyllt"
                            />
                            <span className="text-sm">kr</span>
                          </div>
                        </div>
                        
                        {/* Bankens Kontosaldo (read-only) */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Bankens kontosaldo</span>
                          <div className="flex items-center gap-2">
                            <span className="w-32 text-right">
                              {bankBalance !== null && bankBalance !== undefined
                                ? formatCurrency(bankBalance / 100)
                                : 'Ingen data'}
                            </span>
                            <span className="text-sm">kr</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
      
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-blue-800">Totalt saldo den {getPaydayDateText()}:</span>
          <span className="font-semibold text-blue-800">
            {formatCurrency(calculateTotal())} kr
          </span>
        </div>
      </div>
    </div>
  );
};