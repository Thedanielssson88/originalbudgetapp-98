import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ImportedTransaction } from '@/types/transaction';
import { useBudget } from '@/hooks/useBudget';
import { useBudgetPosts } from '@/hooks/useBudgetPosts';
import { addMobileDebugLog } from '@/utils/mobileDebugLogger';

interface SavingsLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: ImportedTransaction;
  onUpdateTransaction: (transactionId: string, updates: Partial<ImportedTransaction>) => void;
  onRefresh?: () => void; // Add refresh callback
}

interface SavingsTarget {
  id: string;
  name: string;
  mainCategoryId: string;
  type: 'subcategory' | 'goal';
}

export const SavingsLinkDialog: React.FC<SavingsLinkDialogProps> = ({
  isOpen,
  onClose,
  transaction,
  onUpdateTransaction,
  onRefresh
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const { budgetState } = useBudget();
  const { data: budgetPostsFromAPI = [] } = useBudgetPosts();

  // Get month data for savings categories (legacy)
  const currentMonthData = budgetState?.historicalData?.[budgetState.selectedMonthKey];
  const savingsGroups = currentMonthData?.savingsGroups || [];
  const savingsGoals = budgetState?.savingsGoals || [];

  // Get savings goals and savings posts from SQL budget_posts
  const savingsPostsFromSQL = useMemo(() => {
    if (!budgetPostsFromAPI) return [];
    return budgetPostsFromAPI.filter(post => 
      post.type === 'sparmål' || post.type === 'savings'
    );
  }, [budgetPostsFromAPI]);

  // Create unified list of all selectable savings targets
  const selectableTargets = useMemo<SavingsTarget[]>(() => {
    if (!transaction) return [];

    const targets: SavingsTarget[] = [];

    // Add savings subcategories (specific savings posts) - LEGACY
    savingsGroups.forEach(group => {
      (group.subCategories || []).forEach(sub => {
        targets.push({
          id: sub.id, // UUID from subcategory
          name: `${sub.name} (från ${group.name})`,
          mainCategoryId: group.id, // Main category ID
          type: 'subcategory'
        });
      });
    });

    // Add savings posts from SQL database
    savingsPostsFromSQL.forEach(post => {
      try {
        let displayName = post.description;
        let postType = 'SQL post';
        
        // Try to parse structured JSON description for sparmål
        if (post.type === 'sparmål') {
          try {
            const goalData = JSON.parse(post.description);
            displayName = goalData.name;
            postType = 'Sparmål (SQL)';
          } catch {
            // Fallback to raw description for non-JSON descriptions
            postType = 'Sparmål (SQL)';
          }
        } else if (post.type === 'savings') {
          postType = 'Sparpost (SQL)';
        }

        targets.push({
          id: post.id,
          name: `${displayName} (${postType})`,
          mainCategoryId: post.huvudkategoriId || post.id, // Use huvudkategoriId or fallback to post ID
          type: post.type === 'sparmål' ? 'goal' : 'subcategory'
        });
      } catch (error) {
        console.warn('Failed to process savings post:', post, error);
      }
    });

    // Filter legacy savings goals based on transaction date
    const transactionDate = new Date(transaction.date);
    const relevantSavingsGoals = savingsGoals.filter(goal => {
      const startDate = new Date(goal.startDate + '-01');
      const endDate = new Date(goal.endDate + '-01');
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    // Add relevant legacy savings goals
    relevantSavingsGoals.forEach(goal => {
      targets.push({
        id: goal.id, // UUID from savings goal
        name: `${goal.name} (Sparmål - Legacy)`,
        mainCategoryId: goal.mainCategoryId || goal.id, // Use mainCategoryId if set, otherwise goal ID
        type: 'goal'
      });
    });

    return targets;
  }, [savingsGroups, savingsGoals, savingsPostsFromSQL, transaction]);

  // Set initial selection based on existing savings link
  React.useEffect(() => {
    if (transaction?.savingsTargetId) {
      setSelectedTarget(transaction.savingsTargetId);
    } else {
      setSelectedTarget('');
    }
  }, [transaction?.savingsTargetId]);

  // Early return if no transaction - MOVED AFTER ALL HOOKS
  if (!transaction) {
    return null;
  }

  const handleLinkSavings = () => {
    if (!selectedTarget || !transaction) {
      return;
    }
    
    // Find the selected target
    const target = selectableTargets.find(t => t.id === selectedTarget);
    if (!target) {
      console.error('🚨 [SavingsLinkDialog] Could not find target for ID:', selectedTarget);
      return;
    }
    
    console.log('🔗 [SavingsLinkDialog] Linking transaction to savings target:', {
      transactionId: transaction.id,
      targetId: target.id,
      targetName: target.name,
      targetType: target.type,
      mainCategoryId: target.mainCategoryId
    });
    
    // Update transaction with correct linking via prop function
    // IMPORTANT: Preserve linkedTransactionId if it exists (for InternalTransfer links)
    const updates: Partial<ImportedTransaction> = {
      type: 'Savings', // Use 'Savings' instead of 'Sparande' for consistency with SQL
      appCategoryId: target.mainCategoryId, // Link to main category
      savingsTargetId: target.id, // Link to specific savings post/goal (budget_post ID for SQL targets)
      // Preserve the existing linkedTransactionId (internal transfer link)
      linkedTransactionId: transaction.linkedTransactionId
    };
    
    // Call the prop function instead of direct orchestrator call
    console.log('🔗 [SavingsLinkDialog] Calling onUpdateTransaction with updates:', updates);
    addMobileDebugLog(`🔗 [SavingsLinkDialog] Linking transaction ${transaction.id} to savings target ${target.id} (${target.name})`);
    addMobileDebugLog(`🔗 Updates: type=${updates.type}, savingsTargetId=${updates.savingsTargetId}, appCategoryId=${updates.appCategoryId}`);
    
    onUpdateTransaction(transaction.id, updates);
    
    // Trigger refresh after the update
    if (onRefresh) {
      setTimeout(() => {
        console.log('🔗 [SavingsLinkDialog] Triggering refresh after linking');
        addMobileDebugLog('🔗 [SavingsLinkDialog] Triggering refresh after linking');
        onRefresh();
      }, 100);
    }
    
    console.log('🔗 [SavingsLinkDialog] Link operation completed, closing dialog');
    addMobileDebugLog('🔗 [SavingsLinkDialog] Link operation completed, closing dialog');
    onClose();
  };

  // Get current link display name
  const getCurrentLinkName = (): string => {
    if (!transaction.savingsTargetId) {
      console.log('🔍 [getCurrentLinkName] No savingsTargetId found');
      return 'Ingen koppling';
    }
    
    console.log('🔍 [getCurrentLinkName] Looking for ID:', transaction.savingsTargetId);
    console.log('🔍 [getCurrentLinkName] Available targets:', selectableTargets.map(t => ({ id: t.id, name: t.name })));
    console.log('🔍 [getCurrentLinkName] Current month data:', currentMonthData);
    console.log('🔍 [getCurrentLinkName] Savings groups:', savingsGroups);
    console.log('🔍 [getCurrentLinkName] Savings goals:', savingsGoals);
    
    const target = selectableTargets.find(t => t.id === transaction.savingsTargetId);
    const result = target ? target.name : 'Okänt sparmål';
    
    console.log('🔍 [getCurrentLinkName] Found target:', target);
    console.log('🔍 [getCurrentLinkName] Returning result:', result);
    return result;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Koppla till Sparande</DialogTitle>
          <DialogDescription>
            Välj vilken specifik sparandepost eller sparmål som transaktionen ska kopplas till.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Transaktion:</h4>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span>{transaction.description}</span>
                <span className="font-medium">{transaction.amount >= 0 ? '+' : ''}{(transaction.amount / 100).toFixed(2)} kr</span>
              </div>
              <div className="text-sm text-muted-foreground">{transaction.date}</div>
            </div>
            {transaction.savingsTargetId && (
              <div className="text-sm text-muted-foreground">
                Nuvarande koppling: {getCurrentLinkName()}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="savings-target">Välj sparmål eller sparandepost:</Label>
            <Select value={selectedTarget} onValueChange={setSelectedTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Välj vad transaktionen ska kopplas till" />
              </SelectTrigger>
              <SelectContent>
                {selectableTargets.map(target => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectableTargets.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              Inga sparkategorier eller sparmål tillgängliga för denna period.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button 
            onClick={handleLinkSavings} 
            disabled={!selectedTarget}
          >
            Koppla till Sparande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};