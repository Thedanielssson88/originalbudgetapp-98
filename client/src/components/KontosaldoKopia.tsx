import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Edit2, Calculator, BanknoteIcon, ChevronDown, ChevronRight, Minus, PiggyBank, ArrowRight, ArrowLeft, Plus } from 'lucide-react';
import { NewTransferForm } from '@/components/NewTransferForm';
import { AddBudgetItemDialog } from '@/components/AddBudgetItemDialog';
import { useAccounts } from '@/hooks/useAccounts';
import { useBudgetPosts, useCreateBudgetPost, useUpdateBudgetPost } from '@/hooks/useBudgetPosts';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useHuvudkategorier, useUnderkategorier } from '@/hooks/useCategories';
import { formatOrenAsCurrency, kronoraToOren } from '@/utils/currencyUtils';
import { useToast } from '@/hooks/use-toast';
import { useBudget } from '@/hooks/useBudget';
import { useTransactions } from '@/hooks/useTransactions';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface KontosaldoKopiaProps {
  monthKey: string;
}

interface EditDialogState {
  isOpen: boolean;
  accountId: string;
  accountName: string;
  currentValue: number | null;
  bankBalance: number | null;
}

export const KontosaldoKopia: React.FC<KontosaldoKopiaProps> = ({ monthKey }) => {
  const { data: accounts = [] } = useAccounts();
  const { data: budgetPosts = [] } = useBudgetPosts(monthKey);
  const { data: allTransactions = [] } = useTransactions();
  const { data: familyMembers = [] } = useFamilyMembers();
  const createBudgetPost = useCreateBudgetPost();
  const updateBudgetPost = useUpdateBudgetPost();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { budgetState } = useBudget();
  
  const [calculatedBankBalances, setCalculatedBankBalances] = useState<{ [accountId: string]: number | null }>({});
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    isOpen: false,
    accountId: '',
    accountName: '',
    currentValue: null,
    bankBalance: null
  });
  const [dialogInputValue, setDialogInputValue] = useState<string>('');
  const [dialogSelection, setDialogSelection] = useState<'custom' | 'bank'>('custom');
  const [expandedAccountDetails, setExpandedAccountDetails] = useState<{ [accountId: string]: boolean }>({});
  const [expandedBudgetSections, setExpandedBudgetSections] = useState<{ [key: string]: boolean }>({});
  const [showNewTransferForm, setShowNewTransferForm] = useState(false);
  const [showAddBudgetDialog, setShowAddBudgetDialog] = useState<{ isOpen: boolean; type: 'cost' | 'savings' }>({ 
    isOpen: false, 
    type: 'cost' 
  });
  
  // Set all accounts as expanded by default on first load
  useEffect(() => {
    if (accounts.length > 0) {
      const initialExpanded: { [accountId: string]: boolean } = {};
      accounts.forEach(account => {
        // Only set to true if there are details to show
        const hasDetails = getAccountExpenses(account.id).length > 0 || 
                          getAccountSavings(account.id).filter(isSavingsGoalVisibleInMonth).length > 0 ||
                          getAccountOutgoingTransfers(account.id).length > 0 ||
                          getAccountIncomingTransfers(account.id).length > 0 ||
                          getAccountIncome(account.id).length > 0;
        initialExpanded[account.id] = hasDetails;
      });
      setExpandedAccountDetails(prev => ({ ...prev, ...initialExpanded }));
    }
  }, [accounts, budgetPosts, monthKey]);
  
  // Filter budget posts to only get Balance type
  const balancePosts = budgetPosts.filter(post => post.type === 'Balance');
  
  // Get expense and savings posts for the month
  const expensePosts = budgetPosts.filter(post => 
    (post.type === 'cost' || post.type === 'Kostnadspost') && post.accountId
  );
  const savingsPosts = budgetPosts.filter(post => 
    (post.type === 'savings' || post.type === 'sparmål') && post.accountId
  );
  
  // Calculate bank balances from transactions
  useEffect(() => {
    if (allTransactions.length === 0 || accounts.length === 0) return;
    
    const [year, month] = monthKey.split('-').map(Number);
    const payday = 25; // Swedish standard payday
    
    // For the budget month (e.g., August 2025-08), we need the balance from
    // the last transaction before the PREVIOUS month's payday (e.g., before July 25th)
    const previousMonthPayday = new Date(year, month - 2, payday); // month-2 because JS months are 0-indexed
    
    console.log(`[KontosaldoKopia] Calculating bank balances for ${monthKey}`);
    console.log(`[KontosaldoKopia] Need balance from before ${previousMonthPayday.toISOString().split('T')[0]}`);
    
    const newBankBalances: { [accountId: string]: number | null } = {};
    
    accounts.forEach(account => {
      // Get all transactions for this account before the previous month's payday
      const accountTransactions = allTransactions
        .filter(tx => tx.accountId === account.id)
        .filter(tx => {
          const txDate = new Date(tx.date);
          return txDate < previousMonthPayday;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      if (accountTransactions.length > 0) {
        const lastTransaction = accountTransactions[0];
        if (lastTransaction.balanceAfter !== undefined && lastTransaction.balanceAfter !== null) {
          newBankBalances[account.id] = lastTransaction.balanceAfter;
          console.log(`[KontosaldoKopia] Account ${account.name}: Last transaction ${lastTransaction.date} = ${lastTransaction.balanceAfter / 100} kr`);
        } else {
          newBankBalances[account.id] = null;
          console.log(`[KontosaldoKopia] Account ${account.name}: No balance_after in last transaction`);
        }
      } else {
        newBankBalances[account.id] = null;
        console.log(`[KontosaldoKopia] Account ${account.name}: No transactions found before ${previousMonthPayday.toISOString().split('T')[0]}`);
      }
    });
    
    setCalculatedBankBalances(newBankBalances);
  }, [allTransactions, accounts, monthKey]);

  // Update the BudgetCalculator header with correct values
  useEffect(() => {
    const headerElement = document.getElementById('budget-summary-header');
    if (headerElement) {
      const summaryText = `Ingående saldo: ${formatCurrency(calculateGrandTotal())} - Kostnadsposter: -${formatCurrency(calculateTotalExpenses())} - Sparande: -${formatCurrency(calculateTotalSavings())}`;
      headerElement.textContent = summaryText;
    }
  }, [calculatedBankBalances, budgetPosts, accounts]);
  
  // Group accounts by owner (using assignedTo field)
  const accountsByOwner = accounts.reduce((acc, account) => {
    const owner = account.assignedTo || 'Gemensamt';
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(account);
    return acc;
  }, {} as { [key: string]: typeof accounts });
  
  // Get the balance post for an account
  const getBalancePost = (accountId: string) => {
    return balancePosts.find(post => post.accountId === accountId);
  };
  
  // Get display balance (Faktiskt if set, otherwise Bankens)
  const getDisplayBalance = (accountId: string): { value: number | null, isCustom: boolean } => {
    const balancePost = getBalancePost(accountId);
    const faktisktKontosaldo = balancePost?.accountUserBalance;
    const bankensKontosaldo = calculatedBankBalances[accountId];
    
    // If Faktiskt is null or undefined, use Bankens
    if (faktisktKontosaldo === null || faktisktKontosaldo === undefined) {
      return { value: bankensKontosaldo, isCustom: false };
    }
    
    // Otherwise use Faktiskt
    return { value: faktisktKontosaldo, isCustom: true };
  };
  
  // Calculate "Belopp efter budget" for an account
  const calculateBeloppEfterBudget = (accountId: string): number => {
    const { value: startBalance } = getDisplayBalance(accountId);
    if (startBalance === null) return 0;
    
    // Get all budget impacts for this account
    const expenses = getAccountExpenses(accountId).reduce((sum, expense) => sum + expense.amount, 0);
    const savings = getAccountSavings(accountId)
      .filter(isSavingsGoalVisibleInMonth)
      .reduce((sum, savings) => sum + calculateSavingsMonthlyAmount(savings), 0);
    const outgoingTransfers = getAccountOutgoingTransfers(accountId).reduce((sum, transfer) => sum + transfer.amount, 0);
    const incomingTransfers = getAccountIncomingTransfers(accountId).reduce((sum, transfer) => sum + transfer.amount, 0);
    const income = getAccountIncome(accountId).reduce((sum, income) => sum + income.amount, 0);
    
    // Calculate final balance: start balance - expenses + savings - outgoing + incoming + income
    const finalBalance = startBalance - expenses + savings - outgoingTransfers + incomingTransfers + income;
    
    return finalBalance;
  };
  
  // Format currency with proper handling of null
  const formatCurrency = (value: number | null): string => {
    if (value === null || value === undefined) return '-';
    return formatOrenAsCurrency(value);
  };
  
  // Calculate total income across all accounts
  const calculateTotalIncome = (): number => {
    return accounts.reduce((total, account) => {
      const accountIncome = getAccountIncome(account.id).reduce((sum, income) => sum + income.amount, 0);
      return total + accountIncome;
    }, 0);
  };
  
  // Calculate total expenses across all accounts
  const calculateTotalExpenses = (): number => {
    return accounts.reduce((total, account) => {
      const accountExpenses = getAccountExpenses(account.id).reduce((sum, expense) => sum + expense.amount, 0);
      return total + accountExpenses;
    }, 0);
  };
  
  // Calculate total savings across all accounts
  const calculateTotalSavings = (): number => {
    return accounts.reduce((total, account) => {
      const accountSavings = getAccountSavings(account.id)
        .filter(isSavingsGoalVisibleInMonth)
        .reduce((sum, savings) => sum + calculateSavingsMonthlyAmount(savings), 0);
      return total + accountSavings;
    }, 0);
  };
  
  // Calculate income distribution by family member (similar to Sammanställning)
  const calculateIncomeDistribution = () => {
    const incomePosts = budgetPosts?.filter(post => post.type === 'Inkomst') || [];
    
    // Group by family member
    const breakdown = new Map();
    
    incomePosts.forEach(post => {
      const memberId = post.familjemedlemId || 'unknown';
      
      if (!breakdown.has(memberId)) {
        breakdown.set(memberId, 0);
      }
      
      breakdown.set(memberId, breakdown.get(memberId) + (post.amount || 0));
    });
    
    // Convert to array with percentages
    const totalIncome = calculateTotalIncome();
    const result = [];
    
    breakdown.forEach((amount, memberId) => {
      const member = familyMembers?.find(m => m.id === memberId);
      const memberName = member?.name || 'Okänd';
      const percentage = totalIncome > 0 ? (amount / totalIncome) * 100 : 0;
      
      result.push({
        memberId,
        memberName,
        amount,
        percentage
      });
    });
    
    return result.sort((a, b) => b.amount - a.amount); // Sort by amount descending
  };
  
  // Get owner display name
  const getOwnerDisplayName = (owner: string): string => {
    if (owner === 'Gemensamt' || owner === 'gemensamt') return 'Gemensamt';
    if (owner === 'household' || owner === 'Hushåll') return 'Hushåll';
    return owner.charAt(0).toUpperCase() + owner.slice(1);
  };
  
  // Handle adding budget item
  const handleAddBudgetItem = (item: any) => {
    // The AddBudgetItemDialog already saves to the database
    // This callback is just for UI updates/backward compatibility
    console.log('Budget item added:', item);
    
    // Refresh data
    queryClient.invalidateQueries({ queryKey: ['budgetPosts'] });
    queryClient.invalidateQueries({ queryKey: ['budget-posts'] });
  };

  // Handle transfer creation
  const handleCreateTransfer = async (transfer: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    transferType: 'monthly' | 'daily';
    dailyAmount?: number;
    transferDays?: number[];
    huvudkategoriId?: string;
    underkategoriId?: string;
  }) => {
    try {
      // Convert amount to öre
      const budgetPostData = {
        monthKey: monthKey,
        huvudkategoriId: transfer.huvudkategoriId || null,
        underkategoriId: transfer.underkategoriId || null,
        description: transfer.description || 'Planerad överföring',
        amount: kronoraToOren(transfer.amount),
        accountId: transfer.toAccountId,
        accountIdFrom: transfer.fromAccountId,
        financedFrom: `Från ${accounts.find(acc => acc.id === transfer.fromAccountId)?.name || 'okänt konto'}`,
        type: 'transfer',
        userId: 'dev-user-123'
      };

      // Use the same mutation hook as AddBudgetItemDialog for consistency
      await createBudgetPost.mutateAsync(budgetPostData);
      
      toast({
        title: "Överföring skapad",
        description: "Din överföring har skapats.",
      });
      
      // Close the form
      setShowNewTransferForm(false);
      
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa överföring.",
        variant: "destructive",
      });
    }
  };

  // Open edit dialog
  const openEditDialog = (accountId: string, accountName: string) => {
    const balancePost = getBalancePost(accountId);
    const faktisktKontosaldo = balancePost?.accountUserBalance;
    const bankensKontosaldo = calculatedBankBalances[accountId];
    
    setEditDialog({
      isOpen: true,
      accountId,
      accountName,
      currentValue: faktisktKontosaldo !== null && faktisktKontosaldo !== undefined ? faktisktKontosaldo : null,
      bankBalance: bankensKontosaldo
    });
    
    // Set initial dialog values
    if (faktisktKontosaldo !== null && faktisktKontosaldo !== undefined) {
      setDialogInputValue((faktisktKontosaldo / 100).toString());
      setDialogSelection('custom');
    } else {
      setDialogInputValue('');
      setDialogSelection('bank');
    }
  };
  
  // Save balance from dialog
  const saveBalanceFromDialog = async () => {
    const { accountId } = editDialog;
    let valueToSave: number | null = null;
    
    if (dialogSelection === 'custom' && dialogInputValue) {
      const numValue = parseFloat(dialogInputValue);
      if (!isNaN(numValue)) {
        valueToSave = kronoraToOren(numValue);
      }
    }
    // If 'bank' is selected, valueToSave remains null (which means use bank balance)
    
    try {
      const balancePost = getBalancePost(accountId);
      
      if (balancePost) {
        // Update existing budget post
        await updateBudgetPost.mutateAsync({
          id: balancePost.id,
          data: {
            accountUserBalance: valueToSave
          }
        });
        
        toast({
          title: "Saldo uppdaterat",
          description: `Kontosaldo för ${editDialog.accountName} har uppdaterats.`,
        });
      } else {
        // Create new budget post
        await createBudgetPost.mutateAsync({
          monthKey,
          type: 'Balance',
          accountId: accountId,
          accountUserBalance: valueToSave,
          accountBalance: null,
          amount: 0,
          huvudkategoriId: null,
          underkategoriId: null,
          description: `Kontosaldo för ${editDialog.accountName}`,
          userId: 'dev-user-123' // Using dev user for development
        });
        
        toast({
          title: "Saldo sparat",
          description: `Kontosaldo för ${editDialog.accountName} har sparats.`,
        });
      }
      
      // Close dialog
      setEditDialog(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      console.error('Error saving balance:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara kontosaldo.",
        variant: "destructive"
      });
    }
  };
  
  // Calculate payday date text
  const getPaydayDateText = () => {
    if (!monthKey) return '';
    
    const [year, month] = monthKey.split('-').map(Number);
    const payday = 25;
    
    const monthNames = [
      'januari', 'februari', 'mars', 'april', 'maj', 'juni',
      'juli', 'augusti', 'september', 'oktober', 'november', 'december'
    ];
    
    // For the payday date, we show the payday of the PREVIOUS month
    let payYear = year;
    let payMonth = month - 1;
    
    if (payMonth === 0) {
      payMonth = 12;
      payYear = year - 1;
    }
    
    return `${payday} ${monthNames[payMonth - 1]} ${payYear}`;
  };
  
  // Calculate total for an owner group
  const calculateOwnerTotal = (ownerAccounts: typeof accounts): number => {
    return ownerAccounts.reduce((sum, account) => {
      const { value } = getDisplayBalance(account.id);
      return sum + (value || 0);
    }, 0);
  };
  
  // Calculate grand total
  const calculateGrandTotal = (): number => {
    return accounts.reduce((sum, account) => {
      const { value } = getDisplayBalance(account.id);
      return sum + (value || 0);
    }, 0);
  };
  
  // Get expenses for an account
  const getAccountExpenses = (accountId: string) => {
    return expensePosts.filter(post => post.accountId === accountId);
  };
  
  // Get planned transfers for an account
  const transferPosts = budgetPosts.filter(post => post.type === 'transfer');
  
  // Get outgoing transfers from an account (includes savings transfers and sparmål)
  const getAccountOutgoingTransfers = (accountId: string) => {
    // Get regular transfers
    const regularTransfers = transferPosts.filter(post => post.accountIdFrom === accountId);
    
    // Get savings posts and sparmål posts that transfer FROM this account
    const savingsTransfers = budgetPosts.filter(post => 
      (post.type === 'savings' || post.type === 'sparmål') && post.accountIdFrom === accountId
    );
    
    return [...regularTransfers, ...savingsTransfers];
  };
  
  // Get incoming transfers to an account
  const getAccountIncomingTransfers = (accountId: string) => {
    return transferPosts.filter(post => post.accountId === accountId);
  };
  
  // Get savings goals for an account - use sparmål type posts
  const getAccountSavings = (accountId: string) => {
    return budgetPosts.filter(post => 
      (post.type === 'sparmål' || post.type === 'savings') && post.accountId === accountId
    );
  };

  // Get income budget posts for an account - handle missing account_id by matching description
  const getAccountIncome = (accountId: string) => {
    // First, get all income posts for this account
    let incomePosts = budgetPosts.filter(post => 
      post.type === 'Inkomst' && post.accountId === accountId
    );

    // For income posts without account_id, only include them if there's ANOTHER post with same description that has THIS account_id
    const incomePostsWithoutAccount = budgetPosts.filter(post => 
      post.type === 'Inkomst' && !post.accountId
    );

    incomePostsWithoutAccount.forEach(postWithoutAccount => {
      // Check if there's another DIFFERENT income post with same description that has this account_id
      const matchingPostWithAccount = budgetPosts.find(post => 
        post.type === 'Inkomst' && 
        post.id !== postWithoutAccount.id && // Must be a different post
        post.accountId === accountId &&
        (post.description === postWithoutAccount.description || 
         (post.name && postWithoutAccount.name && post.name === postWithoutAccount.name))
      );
      
      // Only include if we found a matching different post with this account_id
      if (matchingPostWithAccount) {
        incomePosts.push(postWithoutAccount);
      }
    });

    return incomePosts;
  };
  
  // Calculate monthly amount for a sparmål goal using the same logic as main Sparmål section
  const calculateSavingsMonthlyAmount = (savingsPost: any): number => {
    // For savings transfers (type = 'savings'), just return the amount as-is
    if (savingsPost.type === 'savings') {
      return savingsPost.amount || 0;
    }
    
    // For sparmål posts that are being used as transfers (have accountIdFrom), return the amount as-is
    if (savingsPost.type === 'sparmål' && savingsPost.accountIdFrom) {
      return savingsPost.amount || 0;
    }
    
    // For regular sparmål posts, calculate based on target and timeline
    // If no end date, return a reasonable monthly amount (target / 12 months)
    if (!savingsPost.endDate) {
      const targetAmount = savingsPost.amount || 0;
      return Math.ceil(targetAmount / 12);
    }
    
    // Parse the current month from monthKey instead of using current date
    const [currentYear, currentMonth] = monthKey.split('-').map(Number);
    const [endYear, endMonth] = savingsPost.endDate.split('-').map(Number);
    
    // Calculate months remaining from current month to end date (inclusive)
    const monthsRemaining = Math.max(1, (endYear - currentYear) * 12 + (endMonth - currentMonth) + 1);
    
    console.log(`[KontosaldoKopia] Calculating for ${savingsPost.name || savingsPost.description}:`);
    console.log(`[KontosaldoKopia] - Target amount: ${savingsPost.amount} öre (${(savingsPost.amount / 100).toFixed(0)} kr)`);
    console.log(`[KontosaldoKopia] - End date: ${savingsPost.endDate}`);
    console.log(`[KontosaldoKopia] - Current month: ${monthKey}`);
    console.log(`[KontosaldoKopia] - Months remaining: ${monthsRemaining}`);
    
    const targetAmount = savingsPost.amount || 0;
    
    // For now, assume no progress (0 already saved) since we don't have actual transaction data
    // This matches the Thailand example: 25,000 kr / 3 months = 8,333 kr
    const alreadySaved = 0;
    const remainingAmount = Math.max(0, targetAmount - alreadySaved);
    const monthlyAmount = Math.ceil(remainingAmount / monthsRemaining);
    
    console.log(`[KontosaldoKopia] - Already saved: ${alreadySaved} öre (${(alreadySaved / 100).toFixed(0)} kr)`);
    console.log(`[KontosaldoKopia] - Remaining: ${remainingAmount} öre (${(remainingAmount / 100).toFixed(0)} kr)`);
    console.log(`[KontosaldoKopia] - Monthly amount: ${monthlyAmount} öre (${(monthlyAmount / 100).toFixed(0)} kr)`);
    
    return monthlyAmount;
  };
  
  // Check if a sparmål should be visible in the current month
  const isSavingsGoalVisibleInMonth = (savingsPost: any): boolean => {
    // Savings transfers (type = 'savings') are filtered by month_key already in budgetPosts
    // Since we're using useBudgetPosts(monthKey), they're already filtered for the current month
    if (savingsPost.type === 'savings') return true;
    
    // Sparmål posts that have accountIdFrom are transfers and should always be visible in their month
    if (savingsPost.type === 'sparmål' && savingsPost.accountIdFrom) return true;
    
    // For regular sparmål posts, check date range
    if (!savingsPost.startDate || !savingsPost.endDate) return true;
    
    const [currentYear, currentMonth] = monthKey.split('-').map(Number);
    const [startYear, startMonth] = savingsPost.startDate.split('-').map(Number);
    const [endYear, endMonth] = savingsPost.endDate.split('-').map(Number);
    
    const currentMonthNum = currentYear * 12 + currentMonth;
    const startMonthNum = startYear * 12 + startMonth;
    const endMonthNum = endYear * 12 + endMonth;
    
    return currentMonthNum >= startMonthNum && currentMonthNum <= endMonthNum;
  };
  
  // Toggle account details expansion
  const toggleAccountDetails = (accountId: string) => {
    setExpandedAccountDetails(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };
  
  // Toggle budget section expansion
  const toggleBudgetSection = (accountId: string, sectionType: string) => {
    const key = `${accountId}-${sectionType}`;
    setExpandedBudgetSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  
  // Check if budget section is expanded
  const isBudgetSectionExpanded = (accountId: string, sectionType: string) => {
    const key = `${accountId}-${sectionType}`;
    return expandedBudgetSections[key] || false;
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-xl font-semibold mb-3 text-gray-800">
          Budgetplanering
        </h3>
        <p className="text-sm text-gray-700">
          Ingående saldo: {formatCurrency(calculateGrandTotal())} - Kostnadsposter: -{formatCurrency(calculateTotalExpenses())} - Sparande: -{formatCurrency(calculateTotalSavings())}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mb-4 flex gap-2">
        <Button 
          size="sm" 
          variant="outline"
          className="border-blue-300 text-blue-800 hover:bg-blue-200"
          onClick={() => setShowNewTransferForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Ny Överföring
        </Button>
        <Button 
          size="sm"
          variant="outline"
          className="border-red-300 text-red-800 hover:bg-red-200"
          onClick={() => setShowAddBudgetDialog({ isOpen: true, type: 'cost' })}
        >
          <Plus className="h-4 w-4 mr-2" />
          Ny kostnadspost
        </Button>
        <Button 
          size="sm"
          variant="outline"
          className="border-green-300 text-green-800 hover:bg-green-200"
          onClick={() => setShowAddBudgetDialog({ isOpen: true, type: 'savings' })}
        >
          <PiggyBank className="h-4 w-4 mr-2" />
          Lägg till sparandepost
        </Button>
      </div>
      
      {/* Account Groups */}
      {Object.entries(accountsByOwner).map(([owner, ownerAccounts]) => (
        <Card key={owner} className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{getOwnerDisplayName(owner)}</span>
              <span className="text-base font-normal text-muted-foreground">
                Totalt: {formatCurrency(calculateOwnerTotal(ownerAccounts))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ownerAccounts.map(account => {
              const { value, isCustom } = getDisplayBalance(account.id);
              const bankBalance = calculatedBankBalances[account.id];
              const beloppEfterBudget = calculateBeloppEfterBudget(account.id);
              
              return (
                <div key={account.id} className="space-y-3">
                  {/* Account Header - New Layout */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      {/* Left side: Account name + Detaljer */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <BanknoteIcon className="w-5 h-5 text-blue-600" />
                          <h4 className="text-lg font-semibold text-gray-800">{account.name}</h4>
                          {isCustom && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                              Manuellt
                            </span>
                          )}
                        </div>
                        
                        {/* Detaljer toggle */}
                        {(getAccountExpenses(account.id).length > 0 || 
                          getAccountSavings(account.id).filter(isSavingsGoalVisibleInMonth).length > 0 ||
                          getAccountOutgoingTransfers(account.id).length > 0 ||
                          getAccountIncomingTransfers(account.id).length > 0) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 hover:bg-gray-50"
                            onClick={() => toggleAccountDetails(account.id)}
                          >
                            {expandedAccountDetails[account.id] ? 
                              <ChevronDown className="h-4 w-4 mr-1" /> : 
                              <ChevronRight className="h-4 w-4 mr-1" />
                            }
                            <span className="text-xs">Detaljer</span>
                          </Button>
                        )}
                      </div>
                      
                      {/* Right side: Balance Information */}
                      <div className="flex items-center gap-6">
                        {/* Banksaldo */}
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-600">Banksaldo</div>
                            <div className="text-lg font-bold text-gray-900">
                              {formatCurrency(value)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-blue-50"
                            onClick={() => openEditDialog(account.id, account.name)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        {/* Belopp efter budget */}
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-600">Belopp efter budget</div>
                          <div className={`text-lg font-bold ${
                            beloppEfterBudget >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(beloppEfterBudget)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Account Details - Expenses, Savings, and Transfers */}
                  {expandedAccountDetails[account.id] && (
                    <div className="space-y-4 pl-7">
                      {/* Expenses */}
                      {getAccountExpenses(account.id).length > 0 && (
                        <div className="space-y-2">
                          <div 
                            className="flex items-center justify-between cursor-pointer hover:bg-red-25 p-2 rounded"
                            onClick={() => toggleBudgetSection(account.id, 'expenses')}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                              <Minus className="w-4 h-4" />
                              <span>Kostnader</span>
                              {isBudgetSectionExpanded(account.id, 'expenses') ? 
                                <ChevronDown className="w-4 h-4" /> : 
                                <ChevronRight className="w-4 h-4" />
                              }
                            </div>
                            <span className="text-sm font-medium text-red-700">
                              -{formatCurrency(getAccountExpenses(account.id).reduce((sum, expense) => sum + expense.amount, 0))}
                            </span>
                          </div>
                          {isBudgetSectionExpanded(account.id, 'expenses') && getAccountExpenses(account.id).map(expense => (
                            <div key={expense.id} className="flex justify-between items-center py-2 px-3 bg-red-50 rounded border-l-4 border-red-200 ml-6">
                              <div>
                                <div className="font-medium text-red-800">{expense.name || expense.description}</div>
                                <div className="text-xs text-red-600">
                                  {expense.financedFrom === 'Enskild kostnad' ? 'Enskild kostnad' : 'Löpande kostnad'}
                                </div>
                              </div>
                              <span className="font-mono text-red-700 font-medium">
                                -{formatCurrency(expense.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Savings Goals - Show each sparmål separately */}
                      {getAccountSavings(account.id).filter(isSavingsGoalVisibleInMonth).length > 0 && (
                        <div className="space-y-2">
                          <div 
                            className="flex items-center justify-between cursor-pointer hover:bg-green-25 p-2 rounded"
                            onClick={() => toggleBudgetSection(account.id, 'savings')}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                              <PiggyBank className="w-4 h-4" />
                              <span>Sparande</span>
                              {isBudgetSectionExpanded(account.id, 'savings') ? 
                                <ChevronDown className="w-4 h-4" /> : 
                                <ChevronRight className="w-4 h-4" />
                              }
                            </div>
                            <span className="text-sm font-medium text-green-700">
                              +{formatCurrency(getAccountSavings(account.id)
                                .filter(isSavingsGoalVisibleInMonth)
                                .reduce((sum, savings) => sum + calculateSavingsMonthlyAmount(savings), 0))}
                            </span>
                          </div>
                          {isBudgetSectionExpanded(account.id, 'savings') && getAccountSavings(account.id)
                            .filter(isSavingsGoalVisibleInMonth)
                            .map(savings => {
                              const monthlyAmount = calculateSavingsMonthlyAmount(savings);
                              const fromAccount = savings.accountIdFrom ? 
                                accounts.find(acc => acc.id === savings.accountIdFrom) : null;
                              const isSavingsTransfer = savings.type === 'savings';
                              
                              return (
                                <div key={savings.id} className="flex justify-between items-center py-2 px-3 bg-green-50 rounded border-l-4 border-green-200 ml-6">
                                  <div>
                                    <div className="font-medium text-green-800">
                                      {savings.name || savings.description}
                                    </div>
                                    <div className="text-xs text-green-600">
                                      {isSavingsTransfer && fromAccount && (
                                        <span>Från {fromAccount.name} (Sparande)</span>
                                      )}
                                      {!isSavingsTransfer && (
                                        <>
                                          <span>Målbelopp {formatCurrency(savings.amount)}</span>
                                          {savings.startDate && savings.endDate && (
                                            <span className="ml-2">{savings.startDate} till {savings.endDate}</span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <span className="font-mono text-green-700 font-medium">
                                    +{formatCurrency(monthlyAmount)}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                      
                      {/* Outgoing Transfers */}
                      {getAccountOutgoingTransfers(account.id).length > 0 && (
                        <div className="space-y-2">
                          <div 
                            className="flex items-center justify-between cursor-pointer hover:bg-blue-25 p-2 rounded"
                            onClick={() => toggleBudgetSection(account.id, 'outgoing-transfers')}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                              <ArrowRight className="w-4 h-4" />
                              <span>Utgående överföringar</span>
                              {isBudgetSectionExpanded(account.id, 'outgoing-transfers') ? 
                                <ChevronDown className="w-4 h-4" /> : 
                                <ChevronRight className="w-4 h-4" />
                              }
                            </div>
                            <span className="text-sm font-medium text-blue-700">
                              -{formatCurrency(getAccountOutgoingTransfers(account.id).reduce((sum, transfer) => sum + transfer.amount, 0))}
                            </span>
                          </div>
                          {isBudgetSectionExpanded(account.id, 'outgoing-transfers') && getAccountOutgoingTransfers(account.id).map(transfer => {
                            const toAccount = accounts.find(acc => acc.id === transfer.accountId);
                            const isSavingsTransfer = transfer.type === 'savings' || transfer.type === 'sparmål';
                            return (
                              <div key={transfer.id} className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded border-l-4 border-blue-200 ml-6">
                                <div>
                                  <div className="font-medium text-blue-800">
                                    {transfer.description || transfer.name}
                                    {isSavingsTransfer && ' (Sparande)'}
                                  </div>
                                  <div className="text-xs text-blue-600">
                                    Till {toAccount?.name || 'Okänt konto'}
                                  </div>
                                </div>
                                <span className="font-mono text-blue-700 font-medium">
                                  -{formatCurrency(transfer.amount)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Incoming Transfers */}
                      {getAccountIncomingTransfers(account.id).length > 0 && (
                        <div className="space-y-2">
                          <div 
                            className="flex items-center justify-between cursor-pointer hover:bg-green-25 p-2 rounded"
                            onClick={() => toggleBudgetSection(account.id, 'incoming-transfers')}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                              <ArrowLeft className="w-4 h-4" />
                              <span>Inkommande överföringar</span>
                              {isBudgetSectionExpanded(account.id, 'incoming-transfers') ? 
                                <ChevronDown className="w-4 h-4" /> : 
                                <ChevronRight className="w-4 h-4" />
                              }
                            </div>
                            <span className="text-sm font-medium text-green-700">
                              +{formatCurrency(getAccountIncomingTransfers(account.id).reduce((sum, transfer) => sum + transfer.amount, 0))}
                            </span>
                          </div>
                          {isBudgetSectionExpanded(account.id, 'incoming-transfers') && getAccountIncomingTransfers(account.id).map(transfer => {
                            const fromAccount = accounts.find(acc => acc.id === transfer.accountIdFrom);
                            return (
                              <div key={transfer.id} className="flex justify-between items-center py-2 px-3 bg-green-50 rounded border-l-4 border-green-200 ml-6">
                                <div>
                                  <div className="font-medium text-green-800">{transfer.description}</div>
                                  <div className="text-xs text-green-600">
                                    Från {fromAccount?.name || 'Okänt konto'}
                                  </div>
                                </div>
                                <span className="font-mono text-green-700 font-medium">
                                  +{formatCurrency(transfer.amount)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Income section */}
                      {getAccountIncome(account.id).length > 0 && (
                        <div className="space-y-2">
                          <div 
                            className="flex items-center justify-between cursor-pointer hover:bg-yellow-25 p-2 rounded"
                            onClick={() => toggleBudgetSection(account.id, 'income')}
                          >
                            <div className="flex items-center gap-2 text-sm font-medium text-yellow-700">
                              <Plus className="h-4 w-4" />
                              <span>Inkomst</span>
                              {isBudgetSectionExpanded(account.id, 'income') ? 
                                <ChevronDown className="w-4 h-4" /> : 
                                <ChevronRight className="w-4 h-4" />
                              }
                            </div>
                            <span className="text-sm font-medium text-yellow-700">
                              +{formatCurrency(getAccountIncome(account.id).reduce((sum, income) => sum + income.amount, 0))}
                            </span>
                          </div>
                          {isBudgetSectionExpanded(account.id, 'income') && getAccountIncome(account.id).map(income => (
                            <div key={income.id} className="flex justify-between items-center py-2 px-3 bg-yellow-50 rounded border-l-4 border-yellow-200 ml-6">
                              <div>
                                <div className="font-medium text-yellow-800">{income.description || income.name}</div>
                                <div className="text-xs text-yellow-600">
                                  Inkomst för {monthKey}
                                </div>
                              </div>
                              <span className="font-mono text-yellow-700 font-medium">
                                +{formatCurrency(income.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
      
      {/* Total Summary */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-800">Totalt kontosaldo:</span>
            <span className="text-xl font-bold text-gray-900">
              {formatCurrency(calculateGrandTotal())}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Budget Summary */}
      <Card className="bg-white border-gray-300">
        <CardContent className="pt-6">
          <div className="space-y-3">
            {/* Inkomst */}
            <div className="flex justify-between items-center">
              <span className="text-base font-medium text-yellow-700">Inkomst:</span>
              <span className="font-mono font-medium text-yellow-700">
                +{formatCurrency(calculateTotalIncome())}
              </span>
            </div>
            
            {/* Kostnadsposter */}
            <div className="flex justify-between items-center">
              <span className="text-base font-medium text-red-700">Kostnadsposter:</span>
              <span className="font-mono font-medium text-red-700">
                -{formatCurrency(calculateTotalExpenses())}
              </span>
            </div>
            
            {/* Sparmål */}
            <div className="flex justify-between items-center">
              <span className="text-base font-medium text-green-700">Sparande:</span>
              <span className="font-mono font-medium text-green-700">
                -{formatCurrency(calculateTotalSavings())}
              </span>
            </div>
            
            <hr className="border-gray-300" />
            
            {/* Kvarstående */}
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-800">Kvarstående:</span>
              <span className="text-xl font-bold text-gray-900">
                {formatCurrency(calculateTotalIncome() - calculateTotalExpenses() - calculateTotalSavings())}
              </span>
            </div>
            
            {/* Utbetalning Section */}
            {(() => {
              const incomeDistribution = calculateIncomeDistribution();
              const kvarstaendeAmount = calculateTotalIncome() - calculateTotalExpenses() - calculateTotalSavings();
              
              if (incomeDistribution.length === 0) return null;
              
              return (
                <>
                  <hr className="border-gray-300 mt-4" />
                  
                  <div className="space-y-2 mt-4">
                    <div className="text-lg font-semibold text-gray-800 mb-3">Utbetalning:</div>
                    {incomeDistribution.map((person) => {
                      const personShare = (kvarstaendeAmount * person.percentage) / 100;
                      return (
                        <div key={person.memberId} className="flex justify-between items-center">
                          <span className="text-base text-gray-700">
                            {person.memberName}, {person.percentage.toFixed(0)}%
                          </span>
                          <span className="font-mono font-medium text-gray-900">
                            {formatCurrency(personShare)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={editDialog.isOpen} onOpenChange={(open) => setEditDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Redigera kontosaldo</DialogTitle>
            <DialogDescription>
              {editDialog.accountName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Bank Balance Display */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Bankens kontosaldo:</span>
                <span className="font-mono font-medium">
                  {editDialog.bankBalance !== null ? formatCurrency(editDialog.bankBalance) : 'Ingen data'}
                </span>
              </div>
            </div>
            
            {/* Selection Radio Group */}
            <RadioGroup value={dialogSelection} onValueChange={(value: 'custom' | 'bank') => setDialogSelection(value)}>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="bank" id="bank" className="mt-1" />
                  <Label htmlFor="bank" className="cursor-pointer">
                    <div>Använd bankens kontosaldo</div>
                    <div className="text-sm text-gray-500">Använder saldot från sista transaktionen</div>
                  </Label>
                </div>
                
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="custom" id="custom" className="mt-1" />
                  <Label htmlFor="custom" className="cursor-pointer">
                    <div>Ange faktiskt kontosaldo</div>
                    <div className="text-sm text-gray-500">Skriv in det faktiska saldot manuellt</div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
            
            {/* Custom Value Input */}
            {dialogSelection === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="custom-value">Faktiskt saldo (kr)</Label>
                <Input
                  id="custom-value"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={dialogInputValue}
                  onChange={(e) => setDialogInputValue(e.target.value)}
                  className="font-mono"
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditDialog(prev => ({ ...prev, isOpen: false }))}
            >
              Avbryt
            </Button>
            <Button 
              onClick={saveBalanceFromDialog}
              disabled={dialogSelection === 'custom' && !dialogInputValue}
            >
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Transfer Form Modal */}
      {showNewTransferForm && (
        <NewTransferForm
          availableAccounts={accounts}
          selectedMonth={monthKey}
          budgetState={{
            settings: { payday: 25 },
            allTransactions: allTransactions || []
          }}
          onSubmit={handleCreateTransfer}
          onCancel={() => setShowNewTransferForm(false)}
        />
      )}

      {/* Add Budget Item Dialog */}
      <AddBudgetItemDialog
        isOpen={showAddBudgetDialog.isOpen}
        onClose={() => setShowAddBudgetDialog({ isOpen: false, type: 'cost' })}
        onSave={handleAddBudgetItem}
        type={showAddBudgetDialog.type}
        monthKey={monthKey}
      />
    </div>
  );
};