import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Transaction } from '@/types/budget';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { useAccounts } from '@/hooks/useAccounts';

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
  const isMobile = useIsMobile();
  const { data: accounts = [] } = useAccounts();
  
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
    return formatOrenAsCurrency(amount);
  };

  // Helper function to resolve account name from accountId
  const getAccountName = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account?.name || accountId; // Fallback to accountId if name not found
  };

  // Helper function to format date as YYYY-MM-DD
  const formatDateOnly = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('sv-SE'); // Swedish format: YYYY-MM-DD
    } catch {
      return dateString.split('T')[0] || dateString; // Fallback: take part before 'T'
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] m-2' : 'max-w-4xl max-h-[80vh]'} overflow-hidden flex flex-col`}>
        <DialogHeader>
          <DialogTitle className={`${isMobile ? 'flex flex-col space-y-2' : 'flex items-center justify-between'}`}>
            <span className="text-lg font-semibold">Transaktioner för {categoryName}</span>
            <div className={`${isMobile ? 'flex flex-col space-y-1 text-xs' : 'flex items-center space-x-4 text-sm'}`}>
              <span>Budgeterat: {formatOrenAsCurrency(budgetAmount)}</span>
              <span className="font-bold">Faktiskt: {formatOrenAsCurrency(actualAmount)}</span>
              <span className={`font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Differens: {difference >= 0 ? '+' : ''}{formatOrenAsCurrency(difference)}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className={`flex-1 overflow-y-auto space-y-2 ${isMobile ? 'pr-1' : 'pr-2'}`}>
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
                    <CardContent className={`${isMobile ? 'p-3' : 'p-4'} cursor-pointer transition-colors hover:bg-muted/50`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="text-sm font-medium">
                              {formatDate(date)}
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                              {dateTransactions.length}
                            </div>
                                            <div className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
                                              {formatOrenAsCurrency(Math.abs(dateTransactions.reduce((sum, t) => {
                                                const effectiveAmount = (t.correctedAmount !== undefined && t.correctedAmount !== null && t.correctedAmount !== t.amount) ? t.correctedAmount : t.amount;
                                                return sum + effectiveAmount;
                                              }, 0)), false)}
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
                    <CardContent className={`pt-0 pb-4 ${isMobile ? 'px-3' : 'px-4'}`}>
                      <div className="space-y-2 border-t pt-4">
                        {dateTransactions.map(transaction => (
                          <Card key={transaction.id} className="border border-border">
                            <Collapsible 
                              open={expandedTransactions.has(transaction.id)} 
                              onOpenChange={() => toggleTransactionExpansion(transaction.id)}
                            >
                              <CollapsibleTrigger asChild>
                                <CardContent className={`${isMobile ? 'p-2' : 'p-3'} cursor-pointer transition-colors hover:bg-muted/30`}>
                                  <div className={`${isMobile ? 'flex flex-col space-y-2' : 'flex items-center justify-between'}`}>
                                    <div className={`${isMobile ? 'flex items-start space-x-2' : 'flex items-center space-x-3'}`}>
                                      <div className="w-6 h-6 rounded-full bg-yellow-500 flex-shrink-0"></div>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-xs text-muted-foreground">Konto</div>
                                        <div className={`font-bold ${isMobile ? 'text-sm' : 'text-base'} truncate`}>{getAccountName(transaction.accountId)}</div>
                                      </div>
                                      {!isMobile && (
                                        <div className="flex-1 min-w-0">
                                          <div className="text-muted-foreground text-sm">Beskrivning</div>
                                          <div className="font-medium truncate">{transaction.description}</div>
                                        </div>
                                      )}
                                    </div>
                                    {isMobile && (
                                      <div className="ml-8">
                                        <div className="text-muted-foreground text-xs">Beskrivning</div>
                                        <div className="font-medium text-sm break-words">{transaction.description}</div>
                                      </div>
                                    )}
                                    <div className={`${isMobile ? 'flex items-center justify-between ml-8' : 'flex items-center space-x-3'}`}>
                                       <div>
                                         {transaction.correctedAmount !== undefined && transaction.correctedAmount !== null && (transaction.correctedAmount !== transaction.amount) ? (
                                           <div className="space-y-1">
                                             <div className="text-muted-foreground text-xs">Korrigerat belopp</div>
                                             <div className={`font-bold ${transaction.correctedAmount >= 0 ? 'text-green-600' : 'text-red-500'} ${isMobile ? 'text-sm' : 'text-base'}`}>
                                               {formatCurrency(transaction.correctedAmount)}
                                             </div>
                                             <div className="text-muted-foreground text-xs">Ursprungligt belopp</div>
                                             <div className={`text-xs line-through opacity-60 ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                               {formatCurrency(transaction.amount)}
                                             </div>
                                           </div>
                                         ) : (
                                           <div>
                                             <div className="text-muted-foreground text-xs">Belopp</div>
                                             <div className={`font-bold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-500'} ${isMobile ? 'text-sm' : 'text-base'}`}>
                                               {formatCurrency(transaction.amount)}
                                             </div>
                                           </div>
                                         )}
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
                                <CardContent className={`pt-0 pb-3 ${isMobile ? 'px-2' : 'px-3'}`}>
                                  <div className="border-t pt-3 space-y-2">
                                    <div className={`${isMobile ? 'grid grid-cols-2 gap-2' : 'space-y-2'}`}>
                                      <div>
                                        <div className="text-xs text-muted-foreground">Datum</div>
                                        <div className={`font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>{formatDateOnly(transaction.date)}</div>
                                      </div>
                                      
                                      <div>
                                        <div className="text-xs text-muted-foreground">Beskrivning</div>
                                        <div className={`font-medium ${isMobile ? 'text-sm break-words' : 'text-base'}`}>{transaction.description}</div>
                                      </div>
                                      
                                      {transaction.appCategoryId && (
                                        <div>
                                          <div className="text-xs text-muted-foreground">Bankkategori</div>
                                          <div className={`font-medium ${isMobile ? 'text-sm break-words' : 'text-base'}`}>{transaction.appCategoryId}</div>
                                        </div>
                                      )}
                                      
                                      <div>
                                        <div className="text-xs text-muted-foreground">Typ</div>
                                        <div className="font-medium">
                                          <Badge variant="outline" className={isMobile ? 'text-xs' : ''}>{transaction.type}</Badge>
                                        </div>
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