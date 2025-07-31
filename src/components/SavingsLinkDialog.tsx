import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ImportedTransaction } from '@/types/transaction';
import { updateTransaction } from '../orchestrator/budgetOrchestrator';
import { useBudget } from '@/hooks/useBudget';

interface SavingsLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: ImportedTransaction;
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
  transaction
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const { budgetState } = useBudget();

  // Get month data for savings categories
  const currentMonthData = budgetState?.historicalData?.[budgetState.selectedMonthKey];
  const savingsGroups = currentMonthData?.savingsGroups || [];
  const savingsGoals = budgetState?.savingsGoals || [];

  // Create unified list of all selectable savings targets
  const selectableTargets = useMemo<SavingsTarget[]>(() => {
    if (!transaction) return [];

    const targets: SavingsTarget[] = [];

    // Add savings subcategories (specific savings posts)
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

    // Filter savings goals based on transaction date
    const transactionDate = new Date(transaction.date);
    const relevantSavingsGoals = savingsGoals.filter(goal => {
      const startDate = new Date(goal.startDate + '-01');
      const endDate = new Date(goal.endDate + '-01');
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    // Add relevant savings goals
    relevantSavingsGoals.forEach(goal => {
      targets.push({
        id: goal.id, // UUID from savings goal
        name: `${goal.name} (Sparmål)`,
        mainCategoryId: goal.mainCategoryId || goal.id, // Use mainCategoryId if set, otherwise goal ID
        type: 'goal'
      });
    });

    return targets;
  }, [savingsGroups, savingsGoals, transaction]);

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
    console.log(`🚀 [SavingsLinkDialog] handleLinkSavings called with:`, { selectedTarget, transactionId: transaction?.id });
    
    if (!selectedTarget || !transaction) {
      console.log(`🚨 [SavingsLinkDialog] Missing data:`, { selectedTarget: !!selectedTarget, transaction: !!transaction });
      return;
    }
    
    // Find the selected target
    const target = selectableTargets.find(t => t.id === selectedTarget);
    if (!target) {
      console.error('🚨 [SavingsLinkDialog] Could not find target for ID:', selectedTarget);
      return;
    }
    
    // Derive monthKey from transaction's date
    const monthKey = transaction.date.substring(0, 7);
    
    console.log(`🚀 [SavingsLinkDialog] About to call updateTransaction:`, { 
      transactionId: transaction.id, 
      monthKey,
      mainCategoryId: target.mainCategoryId,
      savingsTargetId: target.id
    });
    
    // Update transaction with correct linking
    const updates: Partial<ImportedTransaction> = {
      type: 'Savings',
      appCategoryId: target.mainCategoryId, // Link to main category
      savingsTargetId: target.id // Link to specific savings post/goal
    };
    
    updateTransaction(transaction.id, updates, monthKey);
    console.log(`🚀 [SavingsLinkDialog] updateTransaction completed`);
    onClose();
  };

  // Get current link display name
  const getCurrentLinkName = (): string => {
    if (!transaction.savingsTargetId) return 'Ingen koppling';
    
    const target = selectableTargets.find(t => t.id === transaction.savingsTargetId);
    return target ? target.name : 'Okänt sparmål';
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
                <span className="font-medium">+{transaction.amount} kr</span>
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