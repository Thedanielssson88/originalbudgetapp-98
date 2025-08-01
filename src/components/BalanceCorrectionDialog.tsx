import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { ImportedTransaction } from '@/types/transaction';
import { updateAccountBalance } from '@/orchestrator/budgetOrchestrator';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface MonthBalanceData {
  monthKey: string;
  monthName: string;
  bankBalance: number;
  systemBalance: number;
  accountId: string;
  lastTransactionDate: string;
}

interface BalanceCorrectionDialogProps {
  open: boolean;
  onClose: () => void;
  transactions: ImportedTransaction[];
  accountBalances: Record<string, Record<string, number>>; // monthKey -> accountId -> balance
}

export const BalanceCorrectionDialog: React.FC<BalanceCorrectionDialogProps> = ({
  open,
  onClose,
  transactions,
  accountBalances
}) => {
  console.log('🔍 [BALANCE CORRECTION] Dialog rendered with:', { 
    open, 
    transactionsCount: transactions.length, 
    accountBalancesKeys: Object.keys(accountBalances),
    sampleTransactions: transactions.slice(0, 3).map(t => ({ accountId: t.accountId, date: t.date, balanceAfter: t.balanceAfter }))
  });
  
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [updatingBalances, setUpdatingBalances] = useState<Set<string>>(new Set());

  const monthBalanceData = useMemo(() => {
    console.log('🔍 [BALANCE CORRECTION] Computing month balance data...');
    console.log('🔍 [BALANCE CORRECTION] Transactions count:', transactions.length);
    console.log('🔍 [BALANCE CORRECTION] Account balances:', accountBalances);
    
    const data: MonthBalanceData[] = [];
    
    // Helper functions
    const groupTransactionsByMonth = (transactions: ImportedTransaction[]) => {
      const grouped: Record<string, ImportedTransaction[]> = {};
      transactions.forEach(tx => {
        const date = new Date(tx.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!grouped[monthKey]) {
          grouped[monthKey] = [];
        }
        grouped[monthKey].push(tx);
      });
      return grouped;
    };

    const groupTransactionsByAccount = (transactions: ImportedTransaction[]) => {
      const grouped: Record<string, ImportedTransaction[]> = {};
      transactions.forEach(tx => {
        if (!grouped[tx.accountId]) {
          grouped[tx.accountId] = [];
        }
        grouped[tx.accountId].push(tx);
      });
      return grouped;
    };

    // 1. Group ALL transactions by month
    const transactionsByMonth = groupTransactionsByMonth(transactions);
    console.log('🔍 [BALANCE CORRECTION] Monthly transactions:', Object.keys(transactionsByMonth));

    // 2. Process each month
    Object.entries(transactionsByMonth).forEach(([monthKey, monthTransactions]) => {
      const [year, month] = monthKey.split('-');
      
      // Calculate next month for display and balance update
      const currentDate = new Date(parseInt(year), parseInt(month) - 1);
      const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
      const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
      const nextMonthName = nextMonthDate.toLocaleDateString('sv-SE', { 
        year: 'numeric', 
        month: 'long' 
      });

      console.log(`🔍 [BALANCE CORRECTION] Processing month ${monthKey} -> Next Month ${nextMonthKey}`);
      console.log(`🔍 [BALANCE CORRECTION] Accounts in month ${monthKey}:`, [...new Set(monthTransactions.map(tx => tx.accountId))]);
      
      // 3. Group month's transactions by account
      const transactionsByAccount = groupTransactionsByAccount(monthTransactions);

      // 4. For each account, find the correct balance
      Object.entries(transactionsByAccount).forEach(([accountId, accountTransactions]) => {
        
        // 5. Filter to include only transactions up to and including the 24th
        const relevantTransactions = accountTransactions.filter(tx => {
          const transactionDate = new Date(tx.date);
          return transactionDate.getDate() <= 24;
        });

        console.log(`🔍 [BALANCE CORRECTION] Account ${accountId} - relevant transactions (≤24th):`, relevantTransactions.length);

        // 6. If there are relevant transactions, find the latest one
        if (relevantTransactions.length > 0) {
          // Sort to find the absolutely latest transaction
          relevantTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const lastTransaction = relevantTransactions[0];
          
          // Get its balance
          const bankBalance = lastTransaction.balanceAfter || 0;
          const systemBalance = accountBalances[nextMonthKey]?.[accountId] || 0;

          console.log(`🔍 [BALANCE CORRECTION] Account ${accountId} in ${monthKey}:`, {
            bankBalance,
            systemBalance,
            lastTransactionDate: lastTransaction.date
          });

          data.push({
            monthKey: nextMonthKey,
            monthName: nextMonthName,
            bankBalance,
            systemBalance,
            accountId,
            lastTransactionDate: lastTransaction.date
          });
        }
      });
    });

    console.log('🔍 [BALANCE CORRECTION] Final data:', data);
    return data;
  }, [transactions, accountBalances]);

  const handleUseBankBalance = async (monthData: MonthBalanceData) => {
    const key = `${monthData.monthKey}-${monthData.accountId}`;
    setUpdatingBalances(prev => new Set([...prev, key]));

    try {
      console.log(`🔄 [BALANCE CORRECTION] Updating balance for ${monthData.accountId} in ${monthData.monthKey} to ${monthData.bankBalance}`);
      
      // Update the account balance for this specific month
      updateAccountBalance(monthData.accountId, monthData.bankBalance);
      
      toast({
        title: "Saldo uppdaterat",
        description: `Kontosaldo för ${monthData.accountId} har uppdaterats till ${monthData.bankBalance.toLocaleString('sv-SE')} kr`,
      });
    } catch (error) {
      console.error('Error updating balance:', error);
      toast({
        title: "Fel vid uppdatering",
        description: "Kunde inte uppdatera kontosaldot",
        variant: "destructive"
      });
    } finally {
      setUpdatingBalances(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('sv-SE')} kr`;
  };

  const getBalanceDifference = (bankBalance: number, systemBalance: number) => {
    const diff = bankBalance - systemBalance;
    return {
      amount: Math.abs(diff),
      isPositive: diff > 0,
      isZero: diff === 0
    };
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[85vh] p-4' : 'max-w-4xl max-h-[80vh]'} overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold`}>
            Korrigera startsaldo för månader
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
            Denna dialog visar månader där CSV-filen innehåller transaktioner på eller efter den 24:e i månaden. 
            Du kan använda bankens saldo från den sista transaktionen före den 25:e för att korrigera startsaldot i systemet.
          </p>

          {monthBalanceData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Inga månader hittades som behöver korrigering.</p>
              <p className="text-sm mt-2">
                Denna funktion visas endast när CSV-filen innehåller transaktioner på eller efter den 24:e i månaden.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={isMobile ? 'text-xs p-2' : ''}>Månad</TableHead>
                    <TableHead className={isMobile ? 'text-xs p-2' : ''}>Konto</TableHead>
                    {!isMobile && <TableHead>Saldo enligt bank</TableHead>}
                    {!isMobile && <TableHead>Saldo i system</TableHead>}
                    {!isMobile && <TableHead>Skillnad</TableHead>}
                    <TableHead className={isMobile ? 'text-xs p-2' : ''}>Åtgärd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthBalanceData.map((monthData, index) => {
                    const key = `${monthData.monthKey}-${monthData.accountId}`;
                    const isUpdating = updatingBalances.has(key);
                    const difference = getBalanceDifference(monthData.bankBalance, monthData.systemBalance);
                    
                    return (
                      <TableRow key={key}>
                        <TableCell className={`font-medium ${isMobile ? 'text-xs p-2' : ''}`}>
                          {monthData.monthName}
                          <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                            Senaste: {new Date(monthData.lastTransactionDate).toLocaleDateString('sv-SE')}
                          </div>
                          {isMobile && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Bank: {formatCurrency(monthData.bankBalance)} | System: {formatCurrency(monthData.systemBalance)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={isMobile ? 'text-xs p-2' : ''}>{monthData.accountId}</TableCell>
                        {!isMobile && (
                          <TableCell className="font-mono">
                            {formatCurrency(monthData.bankBalance)}
                          </TableCell>
                        )}
                        {!isMobile && (
                          <TableCell className="font-mono">
                            {formatCurrency(monthData.systemBalance)}
                          </TableCell>
                        )}
                        {!isMobile && (
                          <TableCell>
                            {difference.isZero ? (
                              <Badge variant="outline" className="text-green-600">
                                Lika
                              </Badge>
                            ) : (
                              <Badge variant={difference.isPositive ? "default" : "destructive"}>
                                {difference.isPositive ? '+' : '-'}{formatCurrency(difference.amount)}
                              </Badge>
                            )}
                          </TableCell>
                        )}
                        <TableCell className={isMobile ? 'p-2' : ''}>
                          {difference.isZero ? (
                            <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                              {isMobile ? 'OK' : 'Ingen åtgärd krävs'}
                            </span>
                          ) : (
                            <Button
                              size={isMobile ? 'sm' : 'sm'}
                              onClick={() => handleUseBankBalance(monthData)}
                              disabled={isUpdating}
                              className={`whitespace-nowrap ${isMobile ? 'text-xs px-2 py-1' : ''}`}
                            >
                              {isUpdating ? (isMobile ? 'Uppdaterar...' : 'Uppdaterar...') : (isMobile ? 'Korrigera' : 'Använd bankens saldo')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};