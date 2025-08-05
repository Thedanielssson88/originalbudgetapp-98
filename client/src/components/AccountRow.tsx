import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { BudgetState, PlannedTransfer, BudgetItem, Account } from '@/types/budget';
import { NewTransferForm } from './NewTransferForm';
import { createPlannedTransfer } from '../orchestrator/budgetOrchestrator';
import { getInternalTransferSummary } from '../services/calculationService';
import { useAccounts } from '@/hooks/useAccounts';

interface AccountRowData {
  account: Account;
  totalBudgeted: number;
  totalTransferredIn: number;
  actualTransferredIn: number;
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
  
  // Use API accounts instead of budgetState.accounts
  const { data: accountsFromAPI = [] } = useAccounts();

  // Data från props
  const { account, totalBudgeted, totalTransferredIn, actualTransferredIn, budgetItems, transfersOut } = data;

  // Hämta interna överföringar för detta konto
  const allInternalTransfers = getInternalTransferSummary(budgetState, selectedMonth);
  const accountInternalTransfers = allInternalTransfers.find(summary => summary.accountId === account.id);
  
  // Debug loggar
  console.log('🔍 [INTERNAL TRANSFERS DEBUG]', {
    selectedMonth,
    accountId: account.id,
    accountName: account.name,
    allInternalTransfers,
    accountInternalTransfers,
    hasIncomingTransfers: accountInternalTransfers?.incomingTransfers?.length || 0,
    hasOutgoingTransfers: accountInternalTransfers?.outgoingTransfers?.length || 0
  });

  const handleCreateTransfer = (transfer: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    transferType: 'monthly' | 'daily';
    dailyAmount?: number;
    transferDays?: number[];
  }) => {
    createPlannedTransfer({
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amount: transfer.amount,
      month: selectedMonth,
      description: transfer.description,
      transferType: transfer.transferType,
      dailyAmount: transfer.dailyAmount,
      transferDays: transfer.transferDays
    });
    setShowNewTransferForm(false);
  };

  const getAccountNameById = (accountId: string): string => {
    const foundAccount = accountsFromAPI.find(acc => acc.id === accountId);
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
            <span className="text-muted-foreground text-xs">Faktiskt Överfört</span>
            <span className="font-bold text-green-600">{formatCurrency(actualTransferredIn)}</span>
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

            {/* Interna överföringar sektion */}
            {accountInternalTransfers && (accountInternalTransfers.incomingTransfers.length > 0 || accountInternalTransfers.outgoingTransfers.length > 0) && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                  Interna Överföringar 
                  {accountInternalTransfers.totalIn > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 border-green-200">
                      In: {formatCurrency(accountInternalTransfers.totalIn)}
                    </Badge>
                  )}
                  {accountInternalTransfers.totalOut > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      Ut: {formatCurrency(accountInternalTransfers.totalOut)}
                    </Badge>
                  )}
                </h4>
                
                {accountInternalTransfers.incomingTransfers.length > 0 && (
                  <div className="mb-3">
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Inkommande:</h5>
                    <div className="space-y-1">
                      {accountInternalTransfers.incomingTransfers.map((t, index) => (
                        <div key={index} className="flex justify-between items-center py-1 px-2 rounded bg-background/50">
                           <span className="text-sm">
                             {formatCurrency(t.amount)} från {t.fromAccountName}
                             {t.linked ? (
                               t.transaction.userDescription && (
                                 <span className="ml-2 text-xs text-green-600 font-medium">
                                   ({t.transaction.userDescription})
                                 </span>
                               )
                             ) : (
                               <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-200">
                                 Ej matchad
                               </Badge>
                             )}
                           </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {accountInternalTransfers.outgoingTransfers.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Utgående:</h5>
                    <div className="space-y-1">
                      {accountInternalTransfers.outgoingTransfers.map((t, index) => (
                        <div key={index} className="flex justify-between items-center py-1 px-2 rounded bg-background/50">
                           <span className="text-sm">
                             {formatCurrency(t.amount)} till {t.toAccountName}
                             {t.linked ? (
                               t.transaction.userDescription && (
                                 <span className="ml-2 text-xs text-green-600 font-medium">
                                   ({t.transaction.userDescription})
                                 </span>
                               )
                             ) : (
                               <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-200">
                                 Ej matchad
                               </Badge>
                             )}
                           </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {budgetItems.length === 0 && transfersOut.length === 0 && !accountInternalTransfers && (
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
          availableAccounts={accountsFromAPI.filter(acc => acc.id !== account.id)}
          onSubmit={handleCreateTransfer}
          onCancel={() => setShowNewTransferForm(false)}
        />
      )}
    </Card>
  );
};