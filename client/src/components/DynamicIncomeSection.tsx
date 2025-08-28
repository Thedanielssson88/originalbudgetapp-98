import React, { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link2, Unlink2 } from 'lucide-react';
import { kronoraToOren, orenToKronor } from '@/utils/currencyUtils';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useInkomstkallor, useInkomstkallorMedlem } from '@/hooks/useInkomstkallor';
import { useBudgetPosts, useCreateBudgetPost, useUpdateBudgetPost } from '@/hooks/useBudgetPosts';
import { useTransactions, useUpdateTransaction } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { IncomeLinkDialog } from './IncomeLinkDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import type { FamilyMember, Inkomstkall, BudgetPost, Transaction, Account } from '@shared/schema';

interface DynamicIncomeSectionProps {
  monthKey: string;
  onIncomeUpdate?: () => void;
}

export const DynamicIncomeSection: React.FC<DynamicIncomeSectionProps> = ({
  monthKey,
  onIncomeUpdate
}) => {
  const { data: familyMembers } = useFamilyMembers();
  const { data: inkomstkallor } = useInkomstkallor();
  const { data: assignments } = useInkomstkallorMedlem();
  const { data: budgetPosts } = useBudgetPosts(monthKey);
  const { data: accounts = [] } = useAccounts();
  // Use default transactions (recent only) for better performance
  const { data: transactions = [] } = useTransactions();
  
  const createBudgetPostMutation = useCreateBudgetPost();
  const updateBudgetPostMutation = useUpdateBudgetPost();
  const updateTransactionMutation = useUpdateTransaction();
  const queryClient = useQueryClient();
  
  const [localIncomeValues, setLocalIncomeValues] = useState<Record<string, string>>({});
  const [linkDialogState, setLinkDialogState] = useState<{
    isOpen: boolean;
    member: FamilyMember | null;
    source: Inkomstkall | null;
    budgetPost: BudgetPost | null;
  }>({ isOpen: false, member: null, source: null, budgetPost: null });
  
  const [accountSelectionDialog, setAccountSelectionDialog] = useState<{
    isOpen: boolean;
    budgetPost: BudgetPost | null;
    member: FamilyMember | null;
    source: Inkomstkall | null;
  }>({ isOpen: false, budgetPost: null, member: null, source: null });

  // Filter family members who contribute to budget
  const contributingMembers = familyMembers?.filter((m: any) => m.contributesToBudget) || [];

  // Get enabled income sources for a family member
  const getEnabledIncomeSources = (memberId: string): Inkomstkall[] => {
    if (!assignments || !inkomstkallor) return [];
    
    const memberAssignments = assignments.filter(a => 
      a.familjemedlemId === memberId && a.isEnabled
    );
    
    return inkomstkallor.filter(source => 
      memberAssignments.some(a => a.idInkomstkalla === source.id)
    );
  };

  // Get or create budget post for a specific income source and member
  const getIncomeBudgetPost = (memberId: string, sourceId: string): BudgetPost | undefined => {
    return budgetPosts?.find(post => 
      post.type === 'Inkomst' &&
      post.familjemedlemId === memberId &&
      post.idInkomstkalla === sourceId &&
      post.monthKey === monthKey
    );
  };

  // Initialize local values from budget posts
  useEffect(() => {
    if (!budgetPosts) return;
    
    const values: Record<string, string> = {};
    contributingMembers.forEach((member: any) => {
      const sources = getEnabledIncomeSources(member.id);
      sources.forEach(source => {
        const post = getIncomeBudgetPost(member.id, source.id);
        const key = `${member.id}-${source.id}`;
        values[key] = post ? orenToKronor(post.amount).toString() : '';
      });
    });
    setLocalIncomeValues(values);
  }, [budgetPosts, familyMembers, assignments, inkomstkallor]);

  const handleIncomeChange = (memberId: string, sourceId: string, value: string) => {
    const key = `${memberId}-${sourceId}`;
    setLocalIncomeValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleIncomeBlur = async (member: any, source: Inkomstkall, value: string) => {
    const sekValue = Number(value) || 0;
    const oreValue = kronoraToOren(sekValue);
    
    const existingPost = getIncomeBudgetPost(member.id, source.id);
    
    try {
      if (existingPost) {
        // Update existing budget post
        await updateBudgetPostMutation.mutateAsync({
          id: existingPost.id,
          data: { amount: oreValue }
        });
      } else if (oreValue > 0) {
        // Create new budget post only if amount is greater than 0
        await createBudgetPostMutation.mutateAsync({
          monthKey,
          userId: member.userId || 'temp-user-id',
          type: 'Inkomst',
          description: `${member.name} - ${source.text}`,
          amount: oreValue,
          familjemedlemId: member.id,
          idInkomstkalla: source.id,
          budgetType: 'Inkomst',
          transactionType: 'Inkomst',
          financedFrom: 'Löpande kostnad'
        });
      }
      
      if (onIncomeUpdate) {
        onIncomeUpdate();
      }
    } catch (error) {
      console.error('Failed to update income:', error);
    }
  };

  const openLinkDialog = async (member: any, source: Inkomstkall) => {
    const budgetPost = getIncomeBudgetPost(member.id, source.id);
    
    // Load transactions for dialog
    await loadDialogTransactions();
    
    setLinkDialogState({
      isOpen: true,
      member,
      source,
      budgetPost: budgetPost || null
    });
  };

  // Lazy load transactions only when dialog opens to prevent UI freeze
  const [dialogTransactions, setDialogTransactions] = useState<any[]>([]);
  const [isLoadingDialogTransactions, setIsLoadingDialogTransactions] = useState(false);
  
  const loadDialogTransactions = async () => {
    if (isLoadingDialogTransactions) return;
    
    setIsLoadingDialogTransactions(true);
    console.log(`🔍 [INCOME DIALOG] Loading income transactions for dialog for ${monthKey}`);
    
    try {
      // Calculate payday date range for current month (±6 days buffer)
      const [year, month] = monthKey.split('-').map(Number);
      
      // Start date: 25th of previous month minus 6 days for early payments
      let startYear = year;
      let startMonth = month - 1;
      if (startMonth === 0) {
        startMonth = 12;
        startYear = year - 1;
      }
      
      const paydayStart = new Date(startYear, startMonth - 1, 25, 0, 0, 0);
      const startDate = new Date(paydayStart);
      startDate.setDate(paydayStart.getDate() - 6); // 6 days before payday
      
      // End date: 25th of current month (end of day) to catch all transactions
      const endDate = new Date(year, month - 1, 25, 23, 59, 59); // 25th at 23:59:59
      
      console.log(`🔍 [INCOME DIALOG] Date range: ${startDate.toISOString().split('T')[0]} to ${new Date(endDate.getTime() - 1).toISOString().split('T')[0]}`);
      
      // Fetch transactions within the date range from server
      const response = await fetch(`/api/transactions?fromDate=${startDate.toISOString().split('T')[0]}&toDate=${endDate.toISOString().split('T')[0]}`);
      const allTransactions = await response.json();
      
      // Filter to only positive income transactions and format dates
      const filtered = allTransactions
        .filter((t: any) => t.amount > 0 && (t.type === 'Inkomst' || t.type === 'Income'))
        .map((t: any) => ({ 
          ...t, 
          date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date
        }));
      
      console.log(`🔍 [INCOME DIALOG] Found ${filtered.length} income transactions in payday period`);
      addMobileDebugLog(`🔍 Income Dialog: ${filtered.length} transactions in payday period`);
      
      setDialogTransactions(filtered);
    } catch (error) {
      console.error('Failed to load dialog transactions:', error);
      addMobileDebugLog(`❌ Failed to load dialog transactions: ${error}`);
      setDialogTransactions([]);
    } finally {
      setIsLoadingDialogTransactions(false);
    }
  };

  const handleLinkTransaction = async (transactionId: string) => {
    if (!linkDialogState.member || !linkDialogState.source) return;

    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    let budgetPost = linkDialogState.budgetPost;
    
    try {
      addMobileDebugLog('🔗 [INCOME LINK] Starting transaction linking process');
      addMobileDebugLog(`🔗 [INCOME LINK] Transaction: ${transactionId} (${transaction.amount} öre)`);
      addMobileDebugLog(`🔗 [INCOME LINK] Member: ${linkDialogState.member.name}`);
      addMobileDebugLog(`🔗 [INCOME LINK] Source: ${linkDialogState.source.text}`);
      
      console.log('🔗 [INCOME LINK] Starting transaction linking process');
      console.log('🔗 [INCOME LINK] Transaction:', { id: transactionId, amount: transaction.amount });
      console.log('🔗 [INCOME LINK] Member:', linkDialogState.member.name);
      console.log('🔗 [INCOME LINK] Source:', linkDialogState.source.text);
      
      // Create budget post if it doesn't exist
      if (!budgetPost) {
        addMobileDebugLog('🔗 [INCOME LINK] Creating new budget post...');
        console.log('🔗 [INCOME LINK] Creating new budget post...');
        const result = await createBudgetPostMutation.mutateAsync({
          monthKey,
          userId: (linkDialogState.member as any).userId || 'temp-user-id',
          type: 'Inkomst',
          description: `${linkDialogState.member.name} - ${linkDialogState.source.text}`,
          amount: transaction.amount,
          accountId: transaction.accountId, // Save the transaction's account ID
          familjemedlemId: linkDialogState.member.id,
          idInkomstkalla: linkDialogState.source.id,
          budgetType: 'Inkomst',
          transactionType: 'Inkomst',
          financedFrom: 'Löpande kostnad'
        });
        budgetPost = result;
        addMobileDebugLog(`🔗 [INCOME LINK] Budget post created: ${budgetPost?.id}`);
        console.log('🔗 [INCOME LINK] Budget post created:', budgetPost?.id);
      } else {
        addMobileDebugLog(`🔗 [INCOME LINK] Updating existing budget post: ${budgetPost.id}`);
        console.log('🔗 [INCOME LINK] Updating existing budget post:', budgetPost.id);
        // Update budget post amount and account ID to match transaction
        await updateBudgetPostMutation.mutateAsync({
          id: budgetPost.id,
          data: { 
            amount: transaction.amount,
            accountId: transaction.accountId // Save the transaction's account ID
          }
        });
        addMobileDebugLog('🔗 [INCOME LINK] Budget post updated');
        console.log('🔗 [INCOME LINK] Budget post updated');
      }

      // Update transaction with income_target_id using mutation
      addMobileDebugLog(`🔗 [INCOME LINK] Updating transaction with incomeTargetId: ${budgetPost?.id}`);
      console.log('🔗 [INCOME LINK] Updating transaction with incomeTargetId:', budgetPost?.id);
      const updateResult = await updateTransactionMutation.mutateAsync({
        id: transactionId,
        data: { incomeTargetId: budgetPost?.id }
      });
      addMobileDebugLog('🔗 [INCOME LINK] Transaction update completed');
      console.log('🔗 [INCOME LINK] Transaction update result:', updateResult);

      // Update local state immediately for responsive UI
      const key = `${linkDialogState.member.id}-${linkDialogState.source.id}`;
      setLocalIncomeValues(prev => ({
        ...prev,
        [key]: orenToKronor(transaction.amount).toString()
      }));

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['budget-posts', monthKey] });

      setLinkDialogState({ isOpen: false, member: null, source: null, budgetPost: null });
      
      if (onIncomeUpdate) {
        onIncomeUpdate();
      }
    } catch (error) {
      addMobileDebugLog(`❌ [INCOME LINK] Failed to link: ${error}`);
      console.error('❌ [INCOME LINK] Failed to link income transaction:', error);
      // Add more detailed error logging
      if (error instanceof Error) {
        addMobileDebugLog(`❌ [INCOME LINK] Error: ${error.message}`);
        console.error('❌ [INCOME LINK] Error message:', error.message);
        console.error('❌ [INCOME LINK] Error stack:', error.stack);
      }
    }
  };

  const handleUnlinkTransaction = async () => {
    if (!linkDialogState.member || !linkDialogState.source) return;

    try {
      // Find and unlink any linked transaction if there's a budget post
      if (linkDialogState.budgetPost) {
        const linkedTransaction = transactions.find(t => t.incomeTargetId === linkDialogState.budgetPost?.id);
        if (linkedTransaction) {
          await updateTransactionMutation.mutateAsync({
            id: linkedTransaction.id,
            data: { incomeTargetId: null }
          });
        }

        // Reset budget post amount to 0 to indicate "Ingen inkomst"
        await updateBudgetPostMutation.mutateAsync({
          id: linkDialogState.budgetPost.id,
          data: { amount: 0 }
        });
      } else {
        // Create a budget post with amount 0 if it doesn't exist
        await createBudgetPostMutation.mutateAsync({
          monthKey,
          userId: (linkDialogState.member as any).userId || 'temp-user-id',
          type: 'Inkomst',
          description: `${linkDialogState.member.name} - ${linkDialogState.source.text}`,
          amount: 0,
          familjemedlemId: linkDialogState.member.id,
          idInkomstkalla: linkDialogState.source.id,
          budgetType: 'Inkomst',
          transactionType: 'Inkomst',
          financedFrom: 'Löpande kostnad'
        });
      }

      // Update local state to show "0" in the input field
      const key = `${linkDialogState.member?.id}-${linkDialogState.source?.id}`;
      setLocalIncomeValues(prev => ({
        ...prev,
        [key]: '0'
      }));

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['budget-posts', monthKey] });

      setLinkDialogState({ isOpen: false, member: null, source: null, budgetPost: null });
      
      if (onIncomeUpdate) {
        onIncomeUpdate();
      }
    } catch (error) {
      console.error('Failed to unlink income transaction:', error);
    }
  };

  const getLinkedTransaction = (budgetPostId: string) => {
    return transactions.find(t => t.incomeTargetId === budgetPostId);
  };

  // Open account selection dialog
  const openAccountSelectionDialog = (member: FamilyMember, source: Inkomstkall) => {
    const budgetPost = getIncomeBudgetPost(member.id, source.id);
    setAccountSelectionDialog({
      isOpen: true,
      budgetPost,
      member,
      source
    });
  };

  // Handle account selection
  const handleAccountSelection = async (accountId: string) => {
    const { budgetPost } = accountSelectionDialog;
    if (!budgetPost) return;

    try {
      await updateBudgetPostMutation.mutateAsync({
        id: budgetPost.id,
        data: { accountId }
      });
      
      // Close dialog
      setAccountSelectionDialog({ isOpen: false, budgetPost: null, member: null, source: null });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['budgetPosts'] });
      if (onIncomeUpdate) onIncomeUpdate();
    } catch (error) {
      console.error('Failed to set account:', error);
    }
  };

  const getButtonStatus = (member: any, source: Inkomstkall) => {
    const budgetPost = getIncomeBudgetPost(member.id, source.id);
    if (!budgetPost) return { text: 'Hämta belopp', color: 'yellow', isLinked: false, isEditable: true, needsAccount: false };
    
    const linkedTransaction = getLinkedTransaction(budgetPost.id);
    if (linkedTransaction) {
      return { text: 'Länkad', color: 'green', isLinked: true, isEditable: false, needsAccount: false };
    }
    
    // Check if budget post exists but has no account assigned
    if (!budgetPost.accountId) {
      return { text: 'Hämta belopp', color: 'yellow', isLinked: false, isEditable: true, needsAccount: true };
    }
    
    if (budgetPost.amount === 0) {
      return { text: 'Inget belopp', color: 'gray', isLinked: false, isEditable: false, needsAccount: false };
    }
    
    // Budget post has account_id and amount > 0, but is not linked to a transaction
    return { text: 'Hämta belopp', color: 'yellow', isLinked: false, isEditable: true, needsAccount: false, hasAccount: true };
  };

  // Calculate total income for display
  const calculateTotalIncome = (): number => {
    let total = 0;
    contributingMembers.forEach((member: any) => {
      const sources = getEnabledIncomeSources(member.id);
      sources.forEach(source => {
        const key = `${member.id}-${source.id}`;
        const value = Number(localIncomeValues[key]) || 0;
        total += value;
      });
    });
    return total;
  };

  if (!contributingMembers.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>Inga familjemedlemmar som bidrar till budgeten har lagts till.</p>
        <p className="text-sm">Gå till Inställningar för att lägga till familjemedlemmar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {contributingMembers.map((member: any) => {
        const sources = getEnabledIncomeSources(member.id);
        
        if (sources.length === 0) {
          return null;
        }
        
        return (
          <div key={member.id} className="p-4 bg-green-100/50 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold mb-3 text-green-800">{member.name} Inkomst</h3>
            <div className="space-y-3">
              {sources.map(source => {
                const key = `${member.id}-${source.id}`;
                const value = localIncomeValues[key] || '';
                const buttonStatus = getButtonStatus(member, source);
                const budgetPost = getIncomeBudgetPost(member.id, source.id);
                const linkedTransaction = budgetPost ? getLinkedTransaction(budgetPost.id) : null;
                
                const getButtonClassName = () => {
                  if (buttonStatus.color === 'green') {
                    return 'bg-green-600 hover:bg-green-700 text-white border-green-600';
                  } else if (buttonStatus.color === 'gray') {
                    return 'bg-gray-400 hover:bg-gray-500 text-white border-gray-400';
                  } else {
                    return 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500';
                  }
                };
                
                return (
                  <div key={source.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={key} className="text-green-700">
                        {source.text}
                      </Label>
                      <div className="flex gap-2">
                        {buttonStatus.needsAccount && (
                          <Button
                            size="sm"
                            onClick={() => openAccountSelectionDialog(member, source)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500"
                          >
                            Välj konto
                          </Button>
                        )}
                        {buttonStatus.hasAccount && (
                          <Button
                            size="sm"
                            onClick={() => openAccountSelectionDialog(member, source)}
                            className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                          >
                            Konto valt
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => openLinkDialog(member, source)}
                          className={getButtonClassName()}
                        >
                          {buttonStatus.isLinked ? <Unlink2 size={16} /> : <Link2 size={16} />}
                          {buttonStatus.text}
                        </Button>
                      </div>
                    </div>
                    <Input
                      id={key}
                      type="number"
                      placeholder={`Ange ${source.text.toLowerCase()}`}
                      value={value}
                      onChange={(e) => handleIncomeChange(member.id, source.id, e.target.value)}
                      onBlur={(e) => handleIncomeBlur(member, source, e.target.value)}
                      className={`text-lg bg-white/70 ${!buttonStatus.isEditable ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      disabled={!buttonStatus.isEditable}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      
      {contributingMembers.length > 0 && (
        <div className="pt-4 border-t border-green-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-green-700">Total inkomst:</span>
            <span className="text-lg font-semibold text-green-800">
              {calculateTotalIncome().toLocaleString('sv-SE')} kr
            </span>
          </div>
        </div>
      )}

      {linkDialogState.isOpen && linkDialogState.member && linkDialogState.source && (
        <IncomeLinkDialog
          isOpen={linkDialogState.isOpen}
          onClose={() => setLinkDialogState({ isOpen: false, member: null, source: null, budgetPost: null })}
          onLink={handleLinkTransaction}
          onUnlink={handleUnlinkTransaction}
          transactions={dialogTransactions}
          currentAmount={linkDialogState.budgetPost?.amount}
          currentLinkedTransactionId={linkDialogState.budgetPost ? getLinkedTransaction(linkDialogState.budgetPost.id)?.id : undefined}
          memberName={linkDialogState.member.name}
          incomeSourceName={linkDialogState.source.text}
          monthKey={monthKey}
        />
      )}

      {/* Account Selection Dialog */}
      <Dialog open={accountSelectionDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setAccountSelectionDialog({ isOpen: false, budgetPost: null, member: null, source: null });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Välj konto</DialogTitle>
            <DialogDescription>
              Välj vilket konto som {accountSelectionDialog.source?.text?.toLowerCase()} för {accountSelectionDialog.member?.name} ska kopplas till.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {accounts.map((account: Account) => (
              <Button
                key={account.id}
                variant="outline"
                className="w-full justify-start h-auto p-3"
                onClick={() => handleAccountSelection(account.id)}
              >
                <div className="text-left">
                  <div className="font-medium">{account.name}</div>
                </div>
              </Button>
            ))}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setAccountSelectionDialog({ isOpen: false, budgetPost: null, member: null, source: null })}
            >
              Avbryt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};