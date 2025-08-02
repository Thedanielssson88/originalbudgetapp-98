import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountRow } from './AccountRow';
import { BudgetState, PlannedTransfer, BudgetItem, Account, MonthData } from '@/types/budget';
import { getAccountNameById } from '../orchestrator/budgetOrchestrator';

interface TransfersAnalysisProps {
  budgetState: BudgetState;
  selectedMonth: string;
}

interface AccountAnalysisData {
  account: Account;
  totalBudgeted: number;
  totalTransferredIn: number;
  actualTransferredIn: number;
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

    // 1.5. Hämta alla transaktioner för beräkning av faktiska överföringar
    const { startDate, endDate } = require('../services/calculationService').getDateRangeForMonth(selectedMonth, budgetState.settings?.payday || 25);
    const allTransactions = Object.values(budgetState.historicalData).flatMap(m => m.transactions || []);
    const transactionsForPeriod = allTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
    
    // 2. Extrahera cost items från costGroups struktur
    const costItems: BudgetItem[] = [];
    
    // Loopa igenom alla costGroups och extrahera subCategories
    if (monthData.costGroups) {
      monthData.costGroups.forEach(group => {
        if (group.subCategories) {
          group.subCategories.forEach(subCat => {
            costItems.push({
              id: subCat.id,
              mainCategoryId: group.id || '',
              subCategoryId: subCat.id,
              description: subCat.name,
              amount: subCat.amount,
              accountId: subCat.accountId || '',
              financedFrom: subCat.financedFrom,
              transferType: subCat.transferType
            });
          });
        }
      });
    }
    
    // Extrahera savings items från savingsGroups struktur
    const savingsItems: BudgetItem[] = [];
    if (monthData.savingsGroups) {
      monthData.savingsGroups.forEach(group => {
        if (group.subCategories) {
          group.subCategories.forEach(subCat => {
            savingsItems.push({
              id: subCat.id,
              mainCategoryId: group.id || '',
              subCategoryId: subCat.id,
              description: subCat.name,
              amount: subCat.amount,
              accountId: subCat.accountId || ''
            });
          });
        }
      });
    }
    
    const allBudgetItems = [...costItems, ...savingsItems];
    const monthlyTransfers = budgetState.plannedTransfers?.filter(pt => pt.month === selectedMonth) || [];
    
    console.log('🔄 [TRANSFERS] Extracted cost items:', costItems);
    console.log('🔄 [TRANSFERS] Available accounts:', budgetState.accounts);
    console.log('🔄 [TRANSFERS] Accounts type check:', budgetState.accounts.map(acc => ({ type: typeof acc, value: acc })));
    
    // 3. Skapa en lookup-map för kategorier för snabb åtkomst (för framtida användning)
    const categoryMap = new Map(budgetState.mainCategories?.map(c => [c, c]) || []);

    // 4. För varje unikt accountId som används i cost items, skapa en Account representation  
    const usedAccountIds = new Set<string>();
    costItems.forEach(item => {
      if (item.accountId) {
        usedAccountIds.add(item.accountId);
      }
    });
    savingsItems.forEach(item => {
      if (item.accountId) {
        usedAccountIds.add(item.accountId);
      }
    });

    console.log('🔄 [TRANSFERS] Used account IDs:', Array.from(usedAccountIds));

    // Skapa Account objects för alla konton som används i budget items
    const relevantAccounts: Account[] = Array.from(usedAccountIds).map(accountId => ({
      id: accountId,
      name: getAccountNameById(accountId),
      startBalance: 0
    }));

    console.log('🔄 [TRANSFERS] Relevant accounts:', relevantAccounts);

    // 5. Loopa igenom varje relevant konto och aggregera data
    return relevantAccounts.map(account => {
      // Hitta alla budgetposter som hör till detta konto
      const budgetedItemsForAccount = allBudgetItems.filter(item => {
        // För nu använder vi accountId direkt från budgetItem
        // I framtiden kan vi använda category.defaultAccountId när det implementeras
        return item.accountId === account.id;
      });

      // Hitta endast kostnadsposter för kontot (för budgeterat belopp)
      const costItemsForAccount = costItems.filter(item => item.accountId === account.id);
      
      console.log(`🔄 [TRANSFERS] Account ${account.name} (ID: ${account.id}):`, {
        totalCostItems: costItems.length,
        costItemsForAccount: costItemsForAccount.length,
        costItemsForAccountDetails: costItemsForAccount
      });

      // Summera total budgeterad kostnad för kontot (endast kostnadsposter)
      const totalBudgeted = costItemsForAccount.reduce((sum, item) => sum + item.amount, 0);

      // Summera totala planerade överföringar TILL kontot
      const totalTransferredIn = monthlyTransfers
        .filter(t => t.toAccountId === account.id)
        .reduce((sum, t) => sum + t.amount, 0);

      // Hitta alla överföringar FRÅN kontot (för detaljvyn)
      const transfersOut = monthlyTransfers.filter(t => t.fromAccountId === account.id);

      // Beräkna faktiska inkommande överföringar från transaktioner
      const actualTransferredIn = transactionsForPeriod
        .filter(t => t.accountId === account.id && t.amount > 0 && (t.type === 'InternalTransfer' || t.appCategoryId === 'Överföring'))
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        account,
        totalBudgeted,
        totalTransferredIn,
        actualTransferredIn,
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