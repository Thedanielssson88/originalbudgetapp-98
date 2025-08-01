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
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [updatingBalances, setUpdatingBalances] = useState<Set<string>>(new Set());

  const monthBalanceData = useMemo(() => {
    console.log('🔍 [BALANCE CORRECTION] Computing month balance data...');
    console.log('🔍 [BALANCE CORRECTION] Transactions count:', transactions.length);
    console.log('🔍 [BALANCE CORRECTION] Account balances:', accountBalances);
    
    const data: MonthBalanceData[] = [];
    const monthlyTransactions: Record<string, ImportedTransaction[]> = {};
    
    // Group transactions by month
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyTransactions[monthKey]) {
        monthlyTransactions[monthKey] = [];
      }
      monthlyTransactions[monthKey].push(tx);
    });

    console.log('🔍 [BALANCE CORRECTION] Monthly transactions:', Object.keys(monthlyTransactions));

    // Check each month for transactions on/after 24th and find last balance before 25th
    Object.entries(monthlyTransactions).forEach(([monthKey, monthTransactions]) => {
      const [year, month] = monthKey.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('sv-SE', { 
        year: 'numeric', 
        month: 'long' 
      });

      // Check if month has transactions on or after 24th
      const hasTransactionsOnOrAfter24th = monthTransactions.some(tx => {
        const date = new Date(tx.date);
        return date.getDate() >= 24;
      });

      if (!hasTransactionsOnOrAfter24th) {
        return;
      }

      // Group by account
      const accountGroups: Record<string, ImportedTransaction[]> = {};
      monthTransactions.forEach(tx => {
        if (!accountGroups[tx.accountId]) {
          accountGroups[tx.accountId] = [];
        }
        accountGroups[tx.accountId].push(tx);
      });

      // For each account, find last transaction before 25th
      const monthEntries: MonthBalanceData[] = [];
      Object.entries(accountGroups).forEach(([accountId, accountTransactions]) => {
        const transactionsBefor25th = accountTransactions
          .filter(tx => new Date(tx.date).getDate() < 25)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (transactionsBefor25th.length > 0) {
          const lastTransaction = transactionsBefor25th[0];
          const bankBalance = lastTransaction.balanceAfter || 0;
          const systemBalance = accountBalances[monthKey]?.[accountId] || 0;

          console.log(`🔍 [BALANCE CORRECTION] Month ${monthKey}, Account ${accountId}:`, {
            bankBalance,
            systemBalance,
            lastTransactionDate: lastTransaction.date
          });

          monthEntries.push({
            monthKey,
            monthName,
            bankBalance,
            systemBalance,
            accountId,
            lastTransactionDate: lastTransaction.date
          });
        }
      });

      // Select only entries where bank balance is not 0, prefer accounts with system balances
      const validEntries = monthEntries.filter(entry => entry.bankBalance !== 0);
      
      if (validEntries.length > 0) {
        const bestEntry = validEntries
          .sort((a, b) => {
            // First priority: accounts that exist in the system (have balances)
            const aHasSystemBalance = (accountBalances[monthKey]?.[a.accountId] || 0) !== 0;
            const bHasSystemBalance = (accountBalances[monthKey]?.[b.accountId] || 0) !== 0;
            
            if (aHasSystemBalance !== bHasSystemBalance) {
              return bHasSystemBalance ? 1 : -1;
            }
            
            // Second priority: highest bank balance
            return Math.abs(b.bankBalance) - Math.abs(a.bankBalance);
          })[0];
        
        data.push(bestEntry);
      }
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