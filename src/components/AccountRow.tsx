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
    <Card className="account-row-wrapper">
      {/* ------ Sammanfattningsrad (alltid synlig) ------ */}
      <div 
        className="summary-row flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="account-name font-medium">{account.name}</span>
        <div className="flex items-center gap-4">
          <span className="budgeted-amount text-sm">
            Budgeterat: {formatCurrency(totalBudgeted)}
          </span>
          <span className="transferred-amount text-sm">
            Planerat In: {formatCurrency(totalTransferredIn)}
          </span>
          <span className={`difference text-sm font-semibold ${difference < 0 ? 'text-destructive' : 'text-success'}`}>
            Diff: {formatCurrency(difference)}
          </span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowNewTransferForm(true); 
            }}
          >
            <Plus className="h-4 w-4" />
            Ny Överföring
          </Button>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* ------ Detaljvy (synlig när expanderad) ------ */}
      {isExpanded && (
        <CardContent className="details-view pt-0">
          <div className="grid gap-4 mt-4">
            {budgetItems.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Budgeterade Poster ({budgetItems.length}):</h4>
                <ul className="space-y-1">
                  {budgetItems.map(item => (
                    <li key={item.id} className="text-sm flex justify-between">
                      <span>{item.description}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {transfersOut.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Planerade Överföringar Från Detta Konto:</h4>
                <ul className="space-y-1">
                  {transfersOut.map(t => (
                    <li key={t.id} className="text-sm flex justify-between">
                      <span>Till {getAccountNameById(t.toAccountId)}</span>
                      <span className="text-destructive">- {formatCurrency(t.amount)}</span>
                    </li>
                  ))}
                </ul>
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