import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountRow } from './AccountRow';
import { BudgetState, PlannedTransfer, BudgetItem, Account, MonthData } from '@/types/budget';

interface TransfersAnalysisProps {
  budgetState: BudgetState;
  selectedMonth: string;
}

interface AccountAnalysisData {
  account: Account;
  totalBudgeted: number;
  totalTransferredIn: number;
  difference: number;
  budgetItems: BudgetItem[];
  transfersOut: PlannedTransfer[];
}

export const TransfersAnalysis: React.FC<TransfersAnalysisProps> = ({ 
  budgetState, 
  selectedMonth 
}) => {
  // Använd useMemo för prestanda! Dessa beräkningar kan vara tunga.
  const analysisData = useMemo(() => {
    console.log('🔄 [TRANSFERS] Computing analysis data for month:', selectedMonth);
    
    // 1. Hämta månadsdata för den valda månaden
    const monthData: MonthData = budgetState.historicalData[selectedMonth];
    if (!monthData) {
      console.log('🔄 [TRANSFERS] No month data found for:', selectedMonth);
      return [];
    }
    
    // 2. Kombinera cost och savings items från månadsdata
    const allBudgetItems = [...(monthData.costItems || []), ...(monthData.savingsItems || [])];
    const monthlyTransfers = budgetState.plannedTransfers?.filter(pt => pt.month === selectedMonth) || [];
    
    // 3. Skapa en lookup-map för kategorier för snabb åtkomst (för framtida användning)
    const categoryMap = new Map(budgetState.mainCategories?.map(c => [c, c]) || []);

    // 4. Loopa igenom varje konto och aggregera data
    return budgetState.accounts.map(account => {
      // Hitta alla budgetposter som hör till detta konto
      const budgetedItemsForAccount = allBudgetItems.filter(item => {
        // För nu använder vi accountId direkt från budgetItem
        // I framtiden kan vi använda category.defaultAccountId när det implementeras
        return item.accountId === account.id;
      });

      // Summera total budgeterad kostnad för kontot
      const totalBudgeted = budgetedItemsForAccount.reduce((sum, item) => sum + item.amount, 0);

      // Summera totala planerade överföringar TILL kontot
      const totalTransferredIn = monthlyTransfers
        .filter(t => t.toAccountId === account.id)
        .reduce((sum, t) => sum + t.amount, 0);

      // Hitta alla överföringar FRÅN kontot (för detaljvyn)
      const transfersOut = monthlyTransfers.filter(t => t.fromAccountId === account.id);

      return {
        account,
        totalBudgeted,
        totalTransferredIn,
        difference: totalTransferredIn - totalBudgeted,
        budgetItems: budgetedItemsForAccount,
        transfersOut,
      };
    });
  }, [budgetState.accounts, budgetState.mainCategories, budgetState.historicalData, budgetState.plannedTransfers, selectedMonth]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Planerade Överföringar ({selectedMonth})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {analysisData.map(data => (
            <AccountRow 
              key={data.account.id} 
              data={data} 
              selectedMonth={selectedMonth}
              budgetState={budgetState}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};