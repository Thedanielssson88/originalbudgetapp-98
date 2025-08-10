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
import { Search } from 'lucide-react';
import { Transaction } from '../types/budget';

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

  // Calculate date range for the month based on payday (25th)
  const { startDate, endDate } = useMemo(() => {
    const [year, month] = monthKey.split('-').map(Number);
    
    // Calculate the payday period for this month
    // The income for a month comes between the 25th of the previous month and the 24th of the current month
    // For July 2025 (2025-07): June 25, 2025 to July 24, 2025
    // For August 2025 (2025-08): July 25, 2025 to August 24, 2025
    
    // Start date: 25th of previous month
    let startYear = year;
    let startMonth = month - 1; // Previous month
    if (startMonth === 0) {
      startMonth = 12;
      startYear = year - 1;
    }
    const start = new Date(startYear, startMonth - 1, 25, 0, 0, 0); // month-1 because JS months are 0-indexed
    
    // End date: 24th of current month  
    const end = new Date(year, month - 1, 24, 23, 59, 59); // month-1 because JS months are 0-indexed
    
    return { startDate: start, endDate: end };
  }, [monthKey]);

  // Filter for positive transactions with type = 'Inkomst' within the month period
  const incomeTransactions = useMemo(() => {
    console.log('Filtering transactions for income dialog:', {
      monthKey,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalTransactions: transactions.length,
      positiveTransactions: transactions.filter(t => t.amount > 0).length,
      incomeTypeTransactions: transactions.filter(t => t.type === 'Inkomst' || t.type === 'Income').length
    });
    
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const isInDateRange = transactionDate >= startDate && transactionDate <= endDate;
      const isIncomeType = t.type === 'Inkomst' || t.type === 'Income';
      const isPositive = t.amount > 0;
      const notLinked = !t.incomeTargetId;
      
      // Debug specific transaction
      if (t.description && t.description.includes('Fkassa')) {
        console.log('Fkassa transaction check:', {
          date: t.date,
          transactionDate: transactionDate.toISOString(),
          isInDateRange,
          isIncomeType,
          type: t.type,
          isPositive,
          amount: t.amount,
          notLinked,
          incomeTargetId: t.incomeTargetId,
          willBeIncluded: isPositive && isIncomeType && notLinked && isInDateRange
        });
      }
      
      return isPositive && 
        isIncomeType &&
        notLinked && // Don't show already linked transactions
        isInDateRange;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, startDate, endDate, monthKey]);

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
            Visar transaktioner från {format(startDate, 'yyyy-MM-dd')} till {format(endDate, 'yyyy-MM-dd')}.
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
                          {format(new Date(currentLinkedTransaction.date), 'yyyy-MM-dd')}: {currentLinkedTransaction.description}
                        </p>
                        <p className="text-sm text-green-600">Nuvarande länkad transaktion</p>
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
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedTransactionId(transaction.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {format(new Date(transaction.date), 'yyyy-MM-dd')}: {transaction.description}
                        </p>
                        {transaction.accountId && (
                          <p className="text-sm text-gray-500">
                            Konto: {transaction.accountId}
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