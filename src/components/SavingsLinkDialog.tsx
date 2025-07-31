import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ImportedTransaction } from '@/types/transaction';
import { linkSavingsTransaction } from '../orchestrator/budgetOrchestrator';
import { useBudget } from '@/hooks/useBudget';

interface SavingsLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: ImportedTransaction;
}

export const SavingsLinkDialog: React.FC<SavingsLinkDialogProps> = ({
  isOpen,
  onClose,
  transaction
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const { budgetState } = useBudget();

  // Set initial selection based on existing savings link
  React.useEffect(() => {
    if (transaction?.savingsTargetId) {
      setSelectedTarget(transaction.savingsTargetId);
    } else {
      setSelectedTarget('');
    }
  }, [transaction?.savingsTargetId]);

  // Get month data for savings categories
  const currentMonthData = budgetState?.historicalData?.[budgetState.selectedMonthKey];
  const savingsGroups = currentMonthData?.savingsGroups || [];
  const savingsGoals = budgetState?.savingsGoals || [];

  // Early return if no transaction
  if (!transaction) {
    return null;
  }

  // Filter based on transaction date's month
  const transactionDate = new Date(transaction.date);
  const relevantSavingsGoals = savingsGoals.filter(goal => {
    const startDate = new Date(goal.startDate + '-01');
    const endDate = new Date(goal.endDate + '-01');
    return transactionDate >= startDate && transactionDate <= endDate;
  });

  const handleLinkSavings = () => {
    if (selectedTarget && transaction) {
      linkSavingsTransaction(transaction.id, selectedTarget);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Koppla till Sparande</DialogTitle>
          <DialogDescription>
            Välj vilket sparmål eller sparkategori som transaktionen ska kopplas till.
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
                Nuvarande koppling: {(() => {
                  const targetId = transaction.savingsTargetId;
                  if (targetId.startsWith('group-')) {
                    const groupId = targetId.replace('group-', '');
                    const group = savingsGroups.find(g => g.id === groupId);
                    return group ? `${group.name} (${group.amount} kr/månad)` : 'Okänt sparmål';
                  }
                  if (targetId.startsWith('goal-')) {
                    const goalId = targetId.replace('goal-', '');
                    const goal = relevantSavingsGoals.find(g => g.id === goalId);
                    return goal ? `${goal.name} (${goal.targetAmount} kr)` : 'Okänt sparmål';
                  }
                  return 'Okänt sparmål';
                })()}
              </div>
            )}
          </div>

          <RadioGroup value={selectedTarget} onValueChange={setSelectedTarget}>
            {/* Savings groups */}
            {savingsGroups.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Sparkategorier:</h4>
                {savingsGroups.map(group => (
                  <div key={`group-${group.id}`} className="flex items-center space-x-2">
                    <RadioGroupItem value={`group-${group.id}`} id={`group-${group.id}`} />
                    <Label htmlFor={`group-${group.id}`} className="flex-1">
                      {group.name} ({group.amount} kr/månad)
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {/* Savings goals */}
            {relevantSavingsGoals.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Sparmål:</h4>
                {relevantSavingsGoals.map(goal => (
                  <div key={`goal-${goal.id}`} className="flex items-center space-x-2">
                    <RadioGroupItem value={`goal-${goal.id}`} id={`goal-${goal.id}`} />
                    <Label htmlFor={`goal-${goal.id}`} className="flex-1">
                      {goal.name} ({goal.targetAmount} kr)
                      <div className="text-sm text-muted-foreground">
                        {goal.startDate} - {goal.endDate}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </RadioGroup>

          {savingsGroups.length === 0 && relevantSavingsGoals.length === 0 && (
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