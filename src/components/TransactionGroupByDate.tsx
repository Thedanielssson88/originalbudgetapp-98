import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ImportedTransaction } from '@/types/transaction';
import { TransactionExpandableCard } from './TransactionExpandableCard';

interface TransactionGroupByDateProps {
  transactions: ImportedTransaction[];
  selectedTransactions: string[];
  mainCategories: string[];
  accounts: { id: string; name: string; startBalance: number }[];
  onToggleSelection: (id: string) => void;
  onUpdateCategory: (id: string, category: string) => void;
  onUpdateNote: (id: string, note: string) => void;
}

export const TransactionGroupByDate: React.FC<TransactionGroupByDateProps> = ({
  transactions,
  selectedTransactions,
  mainCategories,
  accounts,
  onToggleSelection,
  onUpdateCategory,
  onUpdateNote
}) => {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [date: string]: ImportedTransaction[] } = {};
    
    transactions.forEach(transaction => {
      const date = transaction.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
    });

    // Sort dates in descending order (newest first)
    const sortedEntries = Object.entries(groups).sort((a, b) => {
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateB.getTime() - dateA.getTime();
    });

    return sortedEntries;
  }, [transactions]);

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('sv-SE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-2">
      {groupedTransactions.map(([date, dateTransactions]) => (
        <Card key={date} className="border border-border">
          <Collapsible 
            open={expandedDates.has(date)} 
            onOpenChange={() => toggleDateExpansion(date)}
          >
            <CollapsibleTrigger asChild>
              <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-medium">
                      {formatDate(date)}
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {dateTransactions.length} transaktion{dateTransactions.length !== 1 ? 'er' : ''}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="flex-shrink-0">
                    {expandedDates.has(date) ? 
                      <ChevronUp className="w-4 h-4" /> : 
                      <ChevronDown className="w-4 h-4" />
                    }
                  </Button>
                </div>
              </CardContent>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0 pb-4 px-4">
                <div className="space-y-2 border-t pt-4">
                  {dateTransactions.map(transaction => (
                    <TransactionExpandableCard
                      key={transaction.id}
                      transaction={transaction}
                      account={accounts.find(a => a.id === transaction.accountId)}
                      isSelected={selectedTransactions.includes(transaction.id)}
                      mainCategories={mainCategories}
                      onToggleSelection={onToggleSelection}
                      onUpdateCategory={onUpdateCategory}
                      onUpdateNote={onUpdateNote}
                    />
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
};