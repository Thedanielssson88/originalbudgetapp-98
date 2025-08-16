import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ImportedTransaction } from '@/types/transaction';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { getAccountNameById } from '../orchestrator/budgetOrchestrator';

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount?: number;
  currentAmount?: number;
  mainCategoryId?: string;
  subCategoryId?: string;
}

interface SavingsGoalLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ImportedTransaction;
  savingsGoals: SavingsGoal[];
  onLink: (savingsTargetId: string, mainCategoryId: string, subCategoryId?: string) => void;
}

export const SavingsGoalLinkDialog: React.FC<SavingsGoalLinkDialogProps> = ({
  isOpen,
  onClose,
  transaction,
  savingsGoals,
  onLink
}) => {
  const [selectedGoal, setSelectedGoal] = React.useState<string>('');

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedGoal('');
    }
  }, [isOpen]);

  const handleLink = () => {
    if (selectedGoal) {
      const goal = savingsGoals.find(g => g.id === selectedGoal);
      if (goal && goal.mainCategoryId) {
        onLink(selectedGoal, goal.mainCategoryId, goal.subCategoryId);
      }
    }
  };

  if (!transaction) return null;

  const isPositive = transaction.amount > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Koppla till sparmål</DialogTitle>
          <DialogDescription>
            Välj vilket sparmål denna transaktion ska kopplas till.
            {isPositive ? ' Beloppet kommer att läggas till sparmålet.' : ' Beloppet kommer att dras från sparmålet.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">{transaction.description}</p>
            <p className="text-sm text-muted-foreground">
              {transaction.date} • {getAccountNameById(transaction.accountId) || 'Okänt konto'}
            </p>
            <p className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {formatOrenAsCurrency(transaction.amount)}
            </p>
          </div>

          {savingsGoals.length > 0 ? (
            <RadioGroup 
              value={selectedGoal} 
              onValueChange={setSelectedGoal}
            >
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {savingsGoals.map((goal) => {
                  const progress = goal.targetAmount && goal.currentAmount 
                    ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                    : 0;
                  
                  return (
                    <div key={goal.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                      <RadioGroupItem value={goal.id} id={goal.id} />
                      <Label htmlFor={goal.id} className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{goal.name}</span>
                          {goal.targetAmount && (
                            <span className="text-sm text-muted-foreground">
                              {progress}% uppnått
                            </span>
                          )}
                        </div>
                        {goal.targetAmount && goal.currentAmount !== undefined && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatOrenAsCurrency(goal.currentAmount * 100)} av {formatOrenAsCurrency(goal.targetAmount * 100)}
                          </div>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Inga sparmål har konfigurerats ännu.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button 
            onClick={handleLink} 
            disabled={!selectedGoal}
          >
            Koppla till sparmål
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};