import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, ArrowLeftRight, Plus } from 'lucide-react';
import { AccountRow } from './AccountRow';
import { BudgetState, PlannedTransfer, BudgetItem, Account, MonthData } from '@/types/budget';
import { getAccountNameById } from '../orchestrator/budgetOrchestrator';
import { getDateRangeForMonth } from '../services/calculationService';

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
  const [isExpanded, setIsExpanded] = useState(false);

  // Utility function för att formatera valuta
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

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
    const { startDate, endDate } = getDateRangeForMonth(selectedMonth, budgetState.settings?.payday || 25);
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

  // Beräkna totala överföringar för CardDescription
  const totalTransfers = analysisData.reduce((sum, data) => sum + data.totalTransferredIn, 0);
  const totalActualTransfers = analysisData.reduce((sum, data) => sum + data.actualTransferredIn, 0);

  return (
    <Card className="shadow-lg border-0 bg-blue-50/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <ArrowLeftRight className="h-5 w-5" />
              Överföringar
            </CardTitle>
            <CardDescription className="text-blue-700">
              Planerat: {formatCurrency(totalTransfers)} • Faktiskt: {formatCurrency(totalActualTransfers)}
            </CardDescription>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform text-blue-800 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-100/50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-blue-800">Kontoöversikt ({selectedMonth})</h3>
                <p className="text-sm text-blue-700">Planerade vs faktiska överföringar per konto</p>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                className="border-blue-300 text-blue-800 hover:bg-blue-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ny Överföring
              </Button>
            </div>
            
            <div className="space-y-3">
              {analysisData.length === 0 ? (
                <div className="text-center py-8 text-blue-700">
                  <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Inga överföringar planerade</p>
                  <p className="text-sm opacity-75">Lägg till överföringar för att se en översikt här</p>
                </div>
              ) : (
                analysisData.map(data => (
                  <div key={data.account.id} className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-blue-900">{data.account.name}</h4>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-right">
                            <div className="text-blue-700">Budgeterat</div>
                            <div className="font-medium">{formatCurrency(data.totalBudgeted)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-blue-700">Planerat</div>
                            <div className="font-medium">{formatCurrency(data.totalTransferredIn)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-blue-700">Faktiskt</div>
                            <div className="font-medium text-green-600">{formatCurrency(data.actualTransferredIn)}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress bar för planerat vs faktiskt */}
                      <div className="w-full bg-blue-100 rounded-full h-2 mb-3">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ 
                            width: data.totalTransferredIn > 0 
                              ? `${Math.min((data.actualTransferredIn / data.totalTransferredIn) * 100, 100)}%` 
                              : '0%' 
                          }}
                        />
                      </div>
                      
                      {/* Budget items preview */}
                      {data.budgetItems.length > 0 && (
                        <div className="text-sm text-blue-600">
                          {data.budgetItems.length} budgetpost{data.budgetItems.length !== 1 ? 'er' : ''} kopplad{data.budgetItems.length !== 1 ? 'e' : ''} till detta konto
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};