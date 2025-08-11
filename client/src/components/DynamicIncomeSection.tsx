import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { kronoraToOren, orenToKronor } from '@/utils/currencyUtils';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useInkomstkallor, useInkomstkallorMedlem } from '@/hooks/useInkomstkallor';
import { useBudgetPosts, useCreateBudgetPost, useUpdateBudgetPost } from '@/hooks/useBudgetPosts';
import { useTransactions, useUpdateTransaction } from '@/hooks/useTransactions';
import { IncomeLinkDialog } from './IncomeLinkDialog';
import { useQueryClient } from '@tanstack/react-query';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import type { FamilyMember, Inkomstkall, InkomstkallorMedlem, BudgetPost } from '@shared/schema';

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

  // Filter family members who contribute to budget
  const contributingMembers = familyMembers?.filter(m => m.contributesToBudget) || [];

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
    contributingMembers.forEach(member => {
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

  const handleIncomeBlur = async (member: FamilyMember, source: Inkomstkall, value: string) => {
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

  const openLinkDialog = (member: FamilyMember, source: Inkomstkall) => {
    const budgetPost = getIncomeBudgetPost(member.id, source.id);
    setLinkDialogState({
      isOpen: true,
      member,
      source,
      budgetPost: budgetPost || null
    });
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
          type: 'Inkomst',
          description: `${linkDialogState.member.name} - ${linkDialogState.source.text}`,
          amount: transaction.amount,
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
        // Update budget post amount to match transaction
        await updateBudgetPostMutation.mutateAsync({
          id: budgetPost.id,
          data: { amount: transaction.amount }
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
      addMobileDebugLog('🔗 [INCOME LINK] Invalidating queries...');
      console.log('🔗 [INCOME LINK] Invalidating queries...');
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['budget-posts', monthKey] });

      addMobileDebugLog('✅ [INCOME LINK] Successfully linked transaction');
      console.log('🔗 [INCOME LINK] Successfully linked transaction');
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

  const getButtonStatus = (member: FamilyMember, source: Inkomstkall) => {
    const budgetPost = getIncomeBudgetPost(member.id, source.id);
    if (!budgetPost) return { text: 'Hämta belopp', color: 'yellow', isLinked: false, isEditable: true };
    
    const linkedTransaction = getLinkedTransaction(budgetPost.id);
    if (linkedTransaction) {
      return { text: 'Länkad', color: 'green', isLinked: true, isEditable: false };
    }
    
    if (budgetPost.amount === 0) {
      return { text: 'Inget belopp', color: 'gray', isLinked: false, isEditable: false };
    }
    
    return { text: 'Hämta belopp', color: 'yellow', isLinked: false, isEditable: true };
  };

  // Calculate total income for display
  const calculateTotalIncome = (): number => {
    let total = 0;
    contributingMembers.forEach(member => {
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
      {contributingMembers.map(member => {
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
                      <Button
                        size="sm"
                        onClick={() => openLinkDialog(member, source)}
                        className={`${getButtonClassName()} transition-colors duration-200 font-medium px-4 py-1.5 rounded-md`}
                      >
                        {buttonStatus.text}
                      </Button>
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
          transactions={transactions}
          currentAmount={linkDialogState.budgetPost?.amount}
          currentLinkedTransactionId={linkDialogState.budgetPost ? getLinkedTransaction(linkDialogState.budgetPost.id)?.id : undefined}
          memberName={linkDialogState.member.name}
          incomeSourceName={linkDialogState.source.text}
          monthKey={monthKey}
        />
      )}
    </div>
  );
};