import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { BudgetState, PlannedTransfer, BudgetItem, Account } from '@/types/budget';
import { NewTransferForm } from './NewTransferForm';
import { createPlannedTransfer } from '../orchestrator/budgetOrchestrator';

interface AccountRowData {
  account: Account;
  totalBudgeted: number;
  totalTransferredIn: number;
  difference: number;
  budgetItems: BudgetItem[];
  transfersOut: PlannedTransfer[];
}

interface AccountRowProps {
  data: AccountRowData;
  selectedMonth: string;
  budgetState: BudgetState;
}

// Helper för att formatera valuta
const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('sv-SE', { 
    style: 'currency', 
    currency: 'SEK' 
  }).format(amount);

export const AccountRow: React.FC<AccountRowProps> = ({ 
  data, 
  selectedMonth, 
  budgetState 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNewTransferForm, setShowNewTransferForm] = useState(false);

  // Data från props
  const { account, totalBudgeted, totalTransferredIn, difference, budgetItems, transfersOut } = data;

  const handleCreateTransfer = (fromAccountId: string, amount: number, description?: string) => {
    createPlannedTransfer({
      fromAccountId,
      toAccountId: account.id,
      amount,
      month: selectedMonth,
      description
    });
    setShowNewTransferForm(false);
  };

  const getAccountNameById = (accountId: string): string => {
    const foundAccount = budgetState.accounts.find(acc => acc.id === accountId);
    return foundAccount?.name || 'Okänt konto';
  };

  return (
    <Card className="border rounded-lg mb-2 shadow-sm">
      {/* ------ Sammanfattningsrad (alltid synlig) ------ */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="font-semibold text-lg text-foreground">{account.name}</span>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs">Budgeterat</span>
            <span className="font-medium">{formatCurrency(totalBudgeted)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs">Planerat In</span>
            <span className="font-medium">{formatCurrency(totalTransferredIn)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs">Skillnad</span>
            <span className={`font-bold ${difference < 0 ? 'text-destructive' : 'text-green-600'}`}>
              {formatCurrency(difference)}
            </span>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            className="ml-2"
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowNewTransferForm(true); 
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Ny Överföring
          </Button>
          {isExpanded ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
        </div>
      </div>

      {/* ------ Detaljvy (synlig när expanderad) ------ */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4">
          <div className="space-y-4 mt-4 border-t border-border pt-4">
            {budgetItems.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-3">
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                  Budgeterade Poster ({budgetItems.length})
                </h4>
                <div className="space-y-2">
                  {budgetItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center py-1 px-2 rounded bg-background/50">
                      <span className="text-sm">{item.description}</span>
                      <span className="font-medium text-sm">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {transfersOut.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                  Planerade Överföringar Ut ({transfersOut.length})
                </h4>
                <div className="space-y-2">
                  {transfersOut.map(t => (
                    <div key={t.id} className="flex justify-between items-center py-1 px-2 rounded bg-background/50">
                      <span className="text-sm">Till {getAccountNameById(t.toAccountId)}</span>
                      <span className="font-medium text-sm text-destructive">- {formatCurrency(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {budgetItems.length === 0 && transfersOut.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Inga budgetposter eller överföringar för detta konto
              </div>
            )}
          </div>
        </CardContent>
      )}

      {/* Modal eller inline-formulär för att skapa ny överföring */}
      {showNewTransferForm && (
        <NewTransferForm
          targetAccountId={account.id}
          targetAccountName={account.name}
          availableAccounts={budgetState.accounts.filter(acc => acc.id !== account.id)}
          onSubmit={handleCreateTransfer}
          onCancel={() => setShowNewTransferForm(false)}
        />
      )}
    </Card>
  );
};