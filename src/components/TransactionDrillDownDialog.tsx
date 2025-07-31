import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Transaction } from '@/types/budget';

interface TransactionDrillDownDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categoryName: string;
  budgetAmount: number;
  actualAmount: number;
}

export const TransactionDrillDownDialog: React.FC<TransactionDrillDownDialogProps> = ({
  isOpen,
  onClose,
  transactions,
  categoryName,
  budgetAmount,
  actualAmount
}) => {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());
  
  const difference = budgetAmount - actualAmount;

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [date: string]: Transaction[] } = {};
    
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

  const toggleTransactionExpansion = (transactionId: string) => {
    setExpandedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
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

  const formatCurrency = (amount: number) => {
    return `${Math.abs(amount).toLocaleString('sv-SE')} kr`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Transaktioner för {categoryName}</span>
            <div className="flex items-center space-x-4 text-sm">
              <span>Budgeterat: {budgetAmount.toLocaleString('sv-SE')} kr</span>
              <span className="font-bold">Faktiskt: {actualAmount.toLocaleString('sv-SE')} kr</span>
              <span className={`font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Differens: {difference >= 0 ? '+' : ''}{difference.toLocaleString('sv-SE')} kr
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {transactions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Inga transaktioner hittades för denna kategori
            </div>
          ) : (
            groupedTransactions.map(([date, dateTransactions]) => (
              <Card key={date} className="border border-border">
                <Collapsible 
                  open={expandedDates.has(date)} 
                  onOpenChange={() => toggleDateExpansion(date)}
                >
                  <CollapsibleTrigger asChild>
                    <CardContent className="p-4 cursor-pointer transition-colors hover:bg-muted/50">
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
                          <Card key={transaction.id} className="border border-border">
                            <Collapsible 
                              open={expandedTransactions.has(transaction.id)} 
                              onOpenChange={() => toggleTransactionExpansion(transaction.id)}
                            >
                              <CollapsibleTrigger asChild>
                                <CardContent className="p-3 cursor-pointer transition-colors hover:bg-muted/30">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-6 h-6 rounded-full bg-yellow-500"></div>
                                      <div>
                                        <div className="font-medium text-sm">Konto</div>
                                        <div className="font-bold">{transaction.accountId}</div>
                                      </div>
                                      <div>
                                        <div className="text-muted-foreground text-sm">Beskrivning</div>
                                        <div className="font-medium">{transaction.description}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                      <div>
                                        <div className="text-muted-foreground text-sm">Belopp</div>
                                        <div className="font-bold text-red-500">{formatCurrency(transaction.amount)}</div>
                                      </div>
                                      <Button variant="ghost" size="sm" className="flex-shrink-0">
                                        {expandedTransactions.has(transaction.id) ? 
                                          <ChevronUp className="w-4 h-4" /> : 
                                          <ChevronDown className="w-4 h-4" />
                                        }
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <CardContent className="pt-0 pb-3 px-3">
                                  <div className="border-t pt-3 space-y-2">
                                    <div>
                                      <div className="text-sm text-muted-foreground">Datum</div>
                                      <div className="font-medium">{transaction.date}</div>
                                    </div>
                                    
                                     <div>
                                       <div className="text-sm text-muted-foreground">Beskrivning</div>
                                       <div className="font-medium">{transaction.description}</div>
                                     </div>
                                    
                                    {transaction.appCategoryId && (
                                      <div>
                                        <div className="text-sm text-muted-foreground">Bankkategori</div>
                                        <div className="font-medium">{transaction.appCategoryId}</div>
                                      </div>
                                    )}
                                    
                                    <div>
                                      <div className="text-sm text-muted-foreground">Typ</div>
                                      <div className="font-medium">
                                        <Badge variant="outline">{transaction.type}</Badge>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </CollapsibleContent>
                            </Collapsible>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};