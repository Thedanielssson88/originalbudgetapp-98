import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { ImportedTransaction } from '@/types/transaction';
import { updateAccountBalanceForMonth, getAccountNameById } from '@/orchestrator/budgetOrchestrator';
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
    
    // Debug: Log all unique account IDs and their transaction counts
    const allAccountIds = [...new Set(transactions.map(tx => tx.accountId))];
    console.log('🔍 [BALANCE CORRECTION] All account IDs in transactions:', allAccountIds);
    
    allAccountIds.forEach(accountId => {
      const accountTransactions = transactions.filter(tx => tx.accountId === accountId);
      const transactionsWithBalance = accountTransactions.filter(tx => 
        tx.balanceAfter !== undefined && tx.balanceAfter !== null
      );
      console.log(`🔍 [BALANCE CORRECTION] Account "${accountId}": ${accountTransactions.length} total transactions, ${transactionsWithBalance.length} with balanceAfter`);
      
      if (accountId.toLowerCase().includes('hushåll') || accountId === 'Hushållskonto' || 
          accountId.toLowerCase().includes('buffert') || accountId === 'Buffert') {
        console.log(`🔍 [BALANCE CORRECTION] SPECIAL ACCOUNT "${accountId}" transactions:`, 
          accountTransactions.slice(0, 5).map(t => ({ 
            date: t.date, 
            amount: t.amount,
            balanceAfter: t.balanceAfter,
            hasBalance: t.balanceAfter !== undefined && t.balanceAfter !== null
          }))
        );
      }
    });
    
    const data: MonthBalanceData[] = [];
    
    // Step 1: Group all transactions by month-account combination
    const monthAccountGroups = new Map<string, ImportedTransaction[]>();
    
    transactions.forEach(tx => {
      // Debug: Log what we're processing
      if (tx.accountId?.toLowerCase().includes('hushåll') || tx.accountId === 'Hushållskonto' || 
          tx.accountId?.toLowerCase().includes('buffert') || tx.accountId === 'Buffert') {
        console.log(`🔍 [BALANCE CORRECTION] Processing special account transaction:`, {
          accountId: tx.accountId,
          date: tx.date,
          amount: tx.amount,
          balanceAfter: tx.balanceAfter,
          hasBalance: tx.balanceAfter !== undefined && tx.balanceAfter !== null
        });
      }
      
      // Only process transactions that have balanceAfter data
      if (tx.balanceAfter === undefined || tx.balanceAfter === null) {
        if (tx.accountId?.toLowerCase().includes('hushåll') || tx.accountId === 'Hushållskonto' || 
            tx.accountId?.toLowerCase().includes('buffert') || tx.accountId === 'Buffert') {
          console.log(`🔍 [BALANCE CORRECTION] SKIPPING special account transaction due to missing balanceAfter:`, tx.accountId);
        }
        return;
      }
      
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const groupKey = `${monthKey}_${tx.accountId}`;
      
      if (!monthAccountGroups.has(groupKey)) {
        monthAccountGroups.set(groupKey, []);
      }
      monthAccountGroups.get(groupKey)!.push(tx);
    });
    
    console.log('🔍 [BALANCE CORRECTION] Found month-account groups:', monthAccountGroups.size);
    
    // Step 2: Process each month-account group to find latest transaction before 25th
    monthAccountGroups.forEach((groupTransactions, groupKey) => {
      const [monthKey, accountId] = groupKey.split('_');
      const [year, month] = monthKey.split('-');
      
      console.log(`🔍 [BALANCE CORRECTION] Processing group: ${groupKey} with ${groupTransactions.length} transactions`);
      
      // Filter to transactions on or before the 24th day of the month
      const relevantTransactions = groupTransactions.filter(tx => {
        const transactionDate = new Date(tx.date);
        const dayOfMonth = transactionDate.getDate();
        return dayOfMonth <= 24;
      });
      
      console.log(`🔍 [BALANCE CORRECTION] Relevant transactions (≤24th) for ${groupKey}:`, relevantTransactions.length);
      
      // Extra debugging for Hushållskonto
      if (accountId.toLowerCase().includes('hushåll') || accountId === 'Hushållskonto') {
        console.log(`🔍 [BALANCE CORRECTION] HUSHÅLLSKONTO DEBUG - Group ${groupKey}:`, {
          totalTransactions: groupTransactions.length,
          relevantTransactions: relevantTransactions.length,
          allTransactions: groupTransactions.map(tx => ({
            date: tx.date,
            day: new Date(tx.date).getDate(),
            balanceAfter: tx.balanceAfter,
            hasBalance: tx.balanceAfter !== undefined && tx.balanceAfter !== null
          })),
          relevantTransactionsDetail: relevantTransactions.map(tx => ({
            date: tx.date,
            day: new Date(tx.date).getDate(),
            balanceAfter: tx.balanceAfter
          }))
        });
      }
      
      // If we have relevant transactions, find the latest one
      if (relevantTransactions.length > 0) {
        // Sort by date to find the absolutely latest transaction before 25th
        relevantTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latestTransaction = relevantTransactions[0];
        
        // Calculate next month for balance comparison
        const currentDate = new Date(parseInt(year), parseInt(month) - 1);
        const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
        const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const nextMonthName = nextMonthDate.toLocaleDateString('sv-SE', { 
          year: 'numeric', 
          month: 'long' 
        });
        
        // Get balances
        const bankBalance = latestTransaction.balanceAfter || 0;
        const accountName = getAccountNameById(accountId);
        const systemBalance = accountBalances[nextMonthKey]?.[accountName] || 0;
        
        console.log(`🔍 [BALANCE CORRECTION] Row data for ${accountId} in ${monthKey}:`, {
          latestTransactionDate: latestTransaction.date,
          bankBalance,
          systemBalance,
          nextMonthKey,
          nextMonthName
        });
        
        // Create the row data
        data.push({
          monthKey: nextMonthKey,
          monthName: nextMonthName,
          bankBalance,
          systemBalance,
          accountId,
          lastTransactionDate: latestTransaction.date
        });
      }
    });
    
    // Sort data by month and account for consistent display
    data.sort((a, b) => {
      const monthCompare = a.monthKey.localeCompare(b.monthKey);
      if (monthCompare !== 0) return monthCompare;
      return a.accountId.localeCompare(b.accountId);
    });
    
    console.log('🔍 [BALANCE CORRECTION] Final processed data:', data);
    return data;
  }, [transactions, accountBalances]);

  const handleUseBankBalance = async (monthData: MonthBalanceData) => {
    const key = `${monthData.monthKey}-${monthData.accountId}`;
    setUpdatingBalances(prev => new Set([...prev, key]));

    try {
      const accountName = getAccountNameById(monthData.accountId);
      console.log(`🔄 [BALANCE CORRECTION] Updating balance for ${monthData.accountId} (${accountName}) in ${monthData.monthKey} to ${monthData.bankBalance}`);
      
      // Update the account balance for this specific month using the resolved account name
      updateAccountBalanceForMonth(monthData.monthKey, accountName, monthData.bankBalance);
      
      toast({
        title: "Saldo uppdaterat",
        description: `Kontosaldo för ${getAccountNameById(monthData.accountId)} har uppdaterats till ${monthData.bankBalance.toLocaleString('sv-SE')} kr`,
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
            Denna dialog visar månader där databasen innehåller transaktioner med saldo. 
            Du kan använda bankens saldo från den sista transaktionen före den 25:e för att korrigera startsaldot i systemet.
          </p>

          {monthBalanceData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Inga månader hittades som behöver korrigering.</p>
              <p className="text-sm mt-2">
                Denna funktion visas endast när databasen innehåller transaktioner med banksaldo.
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
                        <TableCell className={isMobile ? 'text-xs p-2' : ''}>{getAccountNameById(monthData.accountId)}</TableCell>
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