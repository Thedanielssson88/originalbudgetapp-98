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
  costGroups?: { id: string; name: string; subCategories?: { id: string; name: string }[] }[];
  onToggleSelection: (id: string) => void;
  onUpdateCategory: (id: string, category: string, subCategoryId?: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onTransferMatch?: (transaction: ImportedTransaction) => void;
  onSavingsLink?: (transaction: ImportedTransaction) => void;
  onCostCoverage?: (transaction: ImportedTransaction) => void;
}

export const TransactionGroupByDate: React.FC<TransactionGroupByDateProps> = ({
  transactions,
  selectedTransactions,
  mainCategories,
  accounts,
  costGroups,
  onToggleSelection,
  onUpdateCategory,
  onUpdateNote,
  onTransferMatch,
  onSavingsLink,
  onCostCoverage
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

  const getDateGroupStatus = (transactions: ImportedTransaction[]): 'red' | 'yellow' | 'green' => {
    const statuses = transactions.map(t => t.status);
    
    // If any transaction is red, the whole group is red
    if (statuses.includes('red')) {
      return 'red';
    }
    
    // If all transactions are green, the group is green
    if (statuses.every(status => status === 'green')) {
      return 'green';
    }
    
    // Otherwise, it's yellow
    return 'yellow';
  };

  const getStatusBackgroundClass = (status: 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'green':
        return 'bg-green-50 hover:bg-green-100 border-green-200';
      case 'red':
        return 'bg-red-50 hover:bg-red-100 border-red-200';
      case 'yellow':
        return 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200';
      default:
        return 'hover:bg-muted/50';
    }
  };

  return (
    <div className="space-y-2">
      {groupedTransactions.map(([date, dateTransactions]) => {
        const groupStatus = getDateGroupStatus(dateTransactions);
        const statusClass = getStatusBackgroundClass(groupStatus);
        
        return (
          <Card key={date} className="border border-border">
            <Collapsible 
              open={expandedDates.has(date)} 
              onOpenChange={() => toggleDateExpansion(date)}
            >
              <CollapsibleTrigger asChild>
                <CardContent className={`p-4 cursor-pointer transition-colors ${statusClass}`}>
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
                  {dateTransactions.map(transaction => {
                    console.log(`🎯 [TransactionGroupByDate] Rendering TransactionExpandableCard for ${transaction.id} with type ${transaction.type}`);
                    return (
                      <TransactionExpandableCard
                      key={transaction.id}
                      transaction={transaction}
                      account={accounts.find(a => a.id === transaction.accountId)}
                      isSelected={selectedTransactions.includes(transaction.id)}
                      mainCategories={mainCategories}
                      costGroups={costGroups}
                      onToggleSelection={onToggleSelection}
                      onUpdateCategory={onUpdateCategory}
                      onUpdateNote={onUpdateNote}
                      onTransferMatch={onTransferMatch}
                      onSavingsLink={onSavingsLink}
                      onCostCoverage={onCostCoverage}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
        );
      })}
    </div>
  );
};