import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Search } from 'lucide-react';
import { Transaction } from '../types/budget';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import { useAccounts } from '@/hooks/useAccounts';

interface IncomeLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLink: (transactionId: string) => void;
  onUnlink: () => void;
  transactions: Transaction[];
  currentAmount?: number;
  currentLinkedTransactionId?: string;
  memberName: string;
  incomeSourceName: string;
  monthKey: string; // Format: YYYY-MM
}

export const IncomeLinkDialog: React.FC<IncomeLinkDialogProps> = ({
  isOpen,
  onClose,
  onLink,
  onUnlink,
  transactions,
  currentAmount,
  currentLinkedTransactionId,
  memberName,
  incomeSourceName,
  monthKey,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(
    currentLinkedTransactionId || null
  );
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [allMonthsTransactions, setAllMonthsTransactions] = useState<Transaction[]>([]);
  const [isLoadingAllMonths, setIsLoadingAllMonths] = useState(false);

  // Fetch accounts data for name lookup
  const { data: accounts = [] } = useAccounts();

  // Helper function to get account name by ID
  const getAccountName = (accountId: string | null): string => {
    if (!accountId) return 'Okänt konto';
    const account = accounts.find(acc => acc.id === accountId);
    return account?.name || `Konto: ${accountId}`;
  };

  // Fetch all unlinked income transactions when "show all months" is checked
  const fetchAllMonthsTransactions = async () => {
    if (isLoadingAllMonths) return;
    
    setIsLoadingAllMonths(true);
    try {
      console.log('🔍 [ALL MONTHS] Fetching all unlinked income transactions...');
      addMobileDebugLog('🔍 Fetching all unlinked income transactions...');
      
      // Fetch ALL transactions from server (no date filter)
      const response = await fetch('/api/transactions');
      const allTransactions = await response.json();
      
      // Filter to only unlinked income transactions
      const unlinkedIncomeTransactions = allTransactions
        .filter((t: any) => {
          // Must be positive amount and income type
          if (t.amount <= 0) return false;
          if (t.type !== 'Inkomst' && t.type !== 'Income') return false;
          // Must not be linked to any income target
          if (t.incomeTargetId) return false;
          return true;
        })
        .map((t: any) => ({ 
          ...t, 
          date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date
        }));
      
      console.log(`🔍 [ALL MONTHS] Found ${unlinkedIncomeTransactions.length} unlinked income transactions`);
      addMobileDebugLog(`🔍 Found ${unlinkedIncomeTransactions.length} unlinked income transactions`);
      
      setAllMonthsTransactions(unlinkedIncomeTransactions);
    } catch (error) {
      console.error('Failed to fetch all months transactions:', error);
      addMobileDebugLog(`❌ Failed to fetch all months transactions: ${error}`);
      setAllMonthsTransactions([]);
    } finally {
      setIsLoadingAllMonths(false);
    }
  };

  // Handle show all months checkbox change
  const handleShowAllMonthsChange = (checked: boolean) => {
    setShowAllMonths(checked);
    if (checked) {
      fetchAllMonthsTransactions();
    }
  };

  // Calculate date range for the month based on payday (25th)
  const { startDate, endDate } = useMemo(() => {
    // Validate monthKey format
    if (!monthKey || !monthKey.includes('-')) {
      console.error('Invalid monthKey format:', monthKey);
      const now = new Date();
      return { startDate: now, endDate: now };
    }
    
    const parts = monthKey.split('-');
    if (parts.length !== 2) {
      console.error('Invalid monthKey format:', monthKey);
      const now = new Date();
      return { startDate: now, endDate: now };
    }
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    
    // Validate parsed values
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      console.error('Invalid year or month in monthKey:', monthKey);
      const now = new Date();
      return { startDate: now, endDate: now };
    }
    
    // Calculate the payday period for this month with 6-day buffer for early payments
    // The income for a month comes between 6 days before the 25th of previous month and the 24th of current month
    // This accounts for salary paid early due to weekends/holidays
    // For February 2025: January 19, 2025 to February 24, 2025 (if 25th is Sunday, salary paid Friday 23rd)
    
    // Start date: 25th of previous month minus 6 days to catch early salary payments
    let startYear = year;
    let startMonth = month - 1; // Previous month
    if (startMonth === 0) {
      startMonth = 12;
      startYear = year - 1;
    }
    
    // Create date for 25th of previous month, then subtract 6 days
    const paydayStart = new Date(startYear, startMonth - 1, 25, 0, 0, 0);
    const start = new Date(paydayStart);
    start.setDate(paydayStart.getDate() - 6); // 6 days before payday
    
    // End date: 25th of current month at END of day to ensure we catch all transactions
    // This ensures transactions on the 24th (and even early 25th) are included
    const end = new Date(year, month - 1, 25, 23, 59, 59); // This is 25th at 23:59:59
    
    return { startDate: start, endDate: end };
  }, [monthKey]);

  // Filter for positive transactions with type = 'Inkomst' within the month period or all months
  const incomeTransactions = useMemo(() => {
    try {
      // If showing all months, use the all months transactions data
      if (showAllMonths) {
        if (allMonthsTransactions.length === 0 && !isLoadingAllMonths) {
          return [];
        }
        return allMonthsTransactions; // These are already filtered to unlinked income transactions
      }

      // Early return if no transactions for current month
      if (!transactions || transactions.length === 0) {
        return [];
      }

      // Count transactions at each filter stage
      const positiveTransactions = transactions.filter(t => t.amount > 0);
    const incomeTypeTransactions = positiveTransactions.filter(t => 
      (t.type as string) === 'Inkomst' || (t.type as string) === 'Income'
    );
    const notLinkedTransactions = incomeTypeTransactions.filter(t => !t.incomeTargetId);
    
    // Apply date filtering only if not showing all months
    let dateFilteredTransactions = incomeTypeTransactions;
    if (!showAllMonths) {
      dateFilteredTransactions = incomeTypeTransactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate < endDate;
      });
    }
    
    // Apply date filtering to unlinked transactions
    let unlinkedDateFilteredTransactions = notLinkedTransactions;
    if (!showAllMonths) {
      unlinkedDateFilteredTransactions = notLinkedTransactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate < endDate;
      });
    }
    
    // Log to mobile debug when dialog opens
    addMobileDebugLog(`📊 Income Dialog for ${monthKey}:`);
    if (showAllMonths) {
      addMobileDebugLog(`- Showing ALL months (no date filtering)`);
    } else {
      try {
        addMobileDebugLog(`- Date range (6 days early): ${format(startDate, 'yyyy-MM-dd')} to ${format(new Date(endDate.getTime() - 1), 'yyyy-MM-dd')}`);
        addMobileDebugLog(`- Covers early salary payments (weekends/holidays)`);
      } catch (e) {
        addMobileDebugLog(`- Date range formatting error`);
      }
    }
    addMobileDebugLog(`- Show all months: ${showAllMonths ? 'Yes' : 'No'}`);
    addMobileDebugLog(`- Showing all: ${showAllTransactions ? 'Yes' : 'No'}`);
    addMobileDebugLog(`- Total transactions: ${transactions.length}`);
    addMobileDebugLog(`- Positive amount: ${positiveTransactions.length}`);
    addMobileDebugLog(`- Income type: ${incomeTypeTransactions.length}`);
    addMobileDebugLog(`- Not linked: ${notLinkedTransactions.length}`);
    addMobileDebugLog(`- Date filtered: ${showAllTransactions ? dateFilteredTransactions.length : unlinkedDateFilteredTransactions.length}`);
    
    // Check for LÖN transactions specifically
    const lonTransactions = transactions.filter(t => 
      t.description && t.description.toUpperCase().includes('LÖN')
    );
    
    if (lonTransactions.length > 0) {
      addMobileDebugLog(`🔍 Found ${lonTransactions.length} LÖN transaction(s):`);
      lonTransactions.forEach(t => {
        try {
          const transactionDate = new Date(t.date);
          const isInRange = showAllMonths || (transactionDate >= startDate && transactionDate < endDate);
          addMobileDebugLog(`  - Date: ${format(transactionDate, 'yyyy-MM-dd')}, Amount: ${t.amount} kr, Type: "${t.type}", Linked: ${t.incomeTargetId ? 'Yes' : 'No'}, In range: ${isInRange ? 'Yes' : 'No'}`);
        } catch (e) {
          addMobileDebugLog(`  - Date formatting error for transaction`);
        }
      });
    }
    
    // Also check Barnbidrag
    const barnbidragTransactions = transactions.filter(t => 
      t.description && t.description.toLowerCase().includes('barnbidrag')
    );
    
    if (barnbidragTransactions.length > 0 && !showAllTransactions) {
      addMobileDebugLog(`🔍 Found ${barnbidragTransactions.length} Barnbidrag transaction(s):`);
      barnbidragTransactions.forEach(t => {
        try {
          const transactionDate = new Date(t.date);
          const isInRange = showAllMonths || (transactionDate >= startDate && transactionDate < endDate);
          addMobileDebugLog(`  - Amount: ${t.amount} kr, Date: ${format(transactionDate, 'MMM d')}, Type: ${t.type}, Linked: ${t.incomeTargetId ? 'Yes' : 'No'}, In range: ${isInRange ? 'Yes' : 'No'}`);
        } catch (e) {
          addMobileDebugLog(`  - Date formatting error for transaction`);
        }
      });
    }
    
    console.log('Filtering transactions for income dialog:', {
      monthKey,
      showAllTransactions,
      showAllMonths,
      startDate: startDate instanceof Date && !isNaN(startDate.getTime()) ? startDate.toISOString() : 'Invalid Date',
      endDate: endDate instanceof Date && !isNaN(endDate.getTime()) ? endDate.toISOString() : 'Invalid Date',
      totalTransactions: transactions.length,
      positiveTransactions: positiveTransactions.length,
      incomeTypeTransactions: incomeTypeTransactions.length,
      notLinkedTransactions: notLinkedTransactions.length,
      dateFilteredTransactions: dateFilteredTransactions.length,
      unlinkedDateFilteredTransactions: unlinkedDateFilteredTransactions.length
    });
    
    // Final filtering
    const filtered = transactions.filter(t => {
      // Quick checks first
      if (t.amount <= 0) return false;
      
      const isIncomeType = (t.type as string) === 'Inkomst' || (t.type as string) === 'Income';
      if (!isIncomeType) return false;
      
      // Check linked status if not showing all
      if (!showAllTransactions && t.incomeTargetId) return false;
      
      // Date range check
      if (!showAllMonths) {
        const transactionDate = new Date(t.date);
        if (transactionDate < startDate || transactionDate >= endDate) return false;
      }
      
      return true;
    });
    
    // Sort by date descending
    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
    } catch (error) {
      console.error('Error filtering income transactions:', error);
      addMobileDebugLog(`❌ Error filtering transactions: ${error}`);
      return []; // Return empty array on error to prevent UI freeze
    }
  }, [transactions, startDate, endDate, monthKey, showAllTransactions, showAllMonths, allMonthsTransactions, isLoadingAllMonths]);

  // Filter by search term
  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return incomeTransactions;
    
    const search = searchTerm.toLowerCase();
    return incomeTransactions.filter(t => 
      t.description.toLowerCase().includes(search) ||
      format(new Date(t.date), 'yyyy-MM-dd').includes(search)
    );
  }, [incomeTransactions, searchTerm]);

  // Include the currently linked transaction if it exists
  const currentLinkedTransaction = useMemo(() => {
    if (!currentLinkedTransactionId) return null;
    return transactions.find(t => t.id === currentLinkedTransactionId);
  }, [transactions, currentLinkedTransactionId]);

  const handleMatch = () => {
    if (selectedTransactionId) {
      const selectedTransaction = transactions.find(t => t.id === selectedTransactionId);
      
      // If the selected transaction is already linked to another income source
      if (selectedTransaction?.incomeTargetId && showAllTransactions) {
        const confirmRelink = window.confirm(
          'Denna transaktion är redan länkad till en annan inkomstkälla. ' +
          'Vill du ta bort den tidigare länkningen och länka om den till denna inkomstkälla?'
        );
        
        if (!confirmRelink) {
          return;
        }
        
        // Log the re-linking action
        addMobileDebugLog(`🔄 Re-linking transaction ${selectedTransaction.description} from ${selectedTransaction.incomeTargetId} to current income source`);
      }
      
      onLink(selectedTransactionId);
    }
  };

  const handleNoIncome = () => {
    onUnlink();
    onClose();
  };

  const handleCancel = () => {
    if (currentLinkedTransactionId) {
      onUnlink();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Hämta Inkomstdata</DialogTitle>
          <DialogDescription>
            Hämta inkomst från transaktioner som är sparade som "Inkomst" för {memberName} - {incomeSourceName}.
            <br />
            {showAllMonths ? (
              <span>Visar alla inkomsttransaktioner för alla månader.</span>
            ) : (
              <span>
                {startDate instanceof Date && !isNaN(startDate.getTime()) && endDate instanceof Date && !isNaN(endDate.getTime()) ? (
                  <>Visar transaktioner från {format(startDate, 'yyyy-MM-dd')} till {format(new Date(endDate.getTime() - 1), 'yyyy-MM-dd')}.</>
                ) : (
                  <>Visar transaktioner för vald månad.</>
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Sök på beskrivning eller datum..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllMonths}
                  onChange={(e) => handleShowAllMonthsChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium">
                  Visa alla olänkade inkomster, för alla månader
                </span>
              </label>
              {showAllMonths && (
                <span className="text-xs text-gray-500">
                  {isLoadingAllMonths ? '(laddar...)' : '(visar alla olänkade inkomsttransaktioner)'}
                </span>
              )}
            </div>

            {!showAllMonths && (
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllTransactions}
                    onChange={(e) => setShowAllTransactions(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">
                    Visa alla Inkomst-transaktioner för {format(new Date(monthKey + '-01'), 'MMMM', { locale: sv })}
                  </span>
                </label>
                {showAllTransactions && (
                  <span className="text-xs text-gray-500">
                    (inkluderar redan länkade transaktioner)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Transaktioner att matcha:</p>
            <ScrollArea className="h-[200px] border rounded-md p-4">
              <div className="space-y-2">
                {currentLinkedTransaction && (
                  <div
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedTransactionId === currentLinkedTransaction.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-green-50 border-green-300'
                    }`}
                    onClick={() => setSelectedTransactionId(currentLinkedTransaction.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-green-700">
                          {(() => {
                            try {
                              return format(new Date(currentLinkedTransaction.date), 'yyyy-MM-dd');
                            } catch {
                              return currentLinkedTransaction.date;
                            }
                          })()}: {currentLinkedTransaction.description}
                        </p>
                        <p className="text-sm text-green-600">Nuvarande länkad transaktion</p>
                        {currentLinkedTransaction.accountId && (
                          <p className="text-sm text-gray-500">
                            {getAccountName(currentLinkedTransaction.accountId)}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold text-green-700">
                        {formatOrenAsCurrency(currentLinkedTransaction.amount)}
                      </p>
                    </div>
                  </div>
                )}
                
                {filteredTransactions.length === 0 && !currentLinkedTransaction && (
                  <p className="text-center text-gray-500 py-4">
                    Inga inkomsttransaktioner hittades för denna period.
                  </p>
                )}

                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedTransactionId === transaction.id
                        ? 'bg-blue-50 border-blue-300'
                        : transaction.incomeTargetId
                        ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedTransactionId(transaction.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">
                          {(() => {
                            try {
                              return format(new Date(transaction.date), 'yyyy-MM-dd');
                            } catch {
                              return transaction.date;
                            }
                          })()}: {transaction.description}
                        </p>
                        {transaction.incomeTargetId && (
                          <p className="text-sm text-orange-600 font-medium">
                            ⚠️ Redan länkad till annan inkomstkälla
                          </p>
                        )}
                        {transaction.accountId && (
                          <p className="text-sm text-gray-500">
                            {getAccountName(transaction.accountId)}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold">
                        {formatOrenAsCurrency(transaction.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Avbryt
            </Button>
            <Button variant="secondary" onClick={handleNoIncome}>
              Ingen inkomst denna månad
            </Button>
          </div>
          <Button 
            onClick={handleMatch}
            disabled={!selectedTransactionId}
          >
            Matcha transaktioner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};