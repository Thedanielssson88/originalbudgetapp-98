import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface MonthlyAccountBalance {
  id: string;
  userId: string;
  monthKey: string;
  accountId: string;
  calculatedBalance: number;
  faktisktKontosaldo?: number | null;
  bankensKontosaldo?: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Account {
  id: string;
  name: string;
}

interface MonthlyAccountBalancesProps {
  selectedMonthKey: string;
  accounts: Account[];
  className?: string;
}

export const MonthlyAccountBalances: React.FC<MonthlyAccountBalancesProps> = ({ 
  selectedMonthKey, 
  accounts, 
  className 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [inputValues, setInputValues] = useState<{[accountId: string]: string}>({});
  const queryClient = useQueryClient();

  // Get current date info for payday logic
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  const [selectedYear, selectedMonth] = selectedMonthKey.split('-').map(Number);
  const currentYear = currentDate.getFullYear();
  const currentMonthNum = currentDate.getMonth() + 1;
  
  // Check if we're on or after the 25th of the selected month
  const isPaydayOrAfter = (currentYear === selectedYear && currentMonthNum === selectedMonth && currentDay >= 25) ||
                         (currentYear > selectedYear) ||
                         (currentYear === selectedYear && currentMonthNum > selectedMonth);

  // Fetch monthly account balances
  const { data: monthlyBalances, isLoading } = useQuery<MonthlyAccountBalance[]>({
    queryKey: ['monthly-account-balances', selectedMonthKey],
    queryFn: async () => {
      const response = await fetch(`/api/monthly-account-balances?monthKey=${selectedMonthKey}`);
      if (!response.ok) throw new Error('Failed to fetch monthly account balances');
      return response.json();
    }
  });

  // Update faktiskt kontosaldo mutation
  const updateFaktisktKontosaldoMutation = useMutation({
    mutationFn: async ({ accountId, faktisktKontosaldo }: { accountId: string; faktisktKontosaldo: number | null }) => {
      const response = await fetch(`/api/monthly-account-balances/${selectedMonthKey}/${accountId}/faktiskt-kontosaldo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faktisktKontosaldo })
      });
      if (!response.ok) throw new Error('Failed to update faktiskt kontosaldo');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-account-balances', selectedMonthKey] });
    }
  });

  // Initialize input values when data loads
  useEffect(() => {
    if (monthlyBalances && accounts) {
      const newInputValues: {[accountId: string]: string} = {};
      accounts.forEach(account => {
        const balance = monthlyBalances.find(b => b.accountId === account.id);
        if (balance?.faktisktKontosaldo !== null && balance?.faktisktKontosaldo !== undefined) {
          newInputValues[account.id] = (balance.faktisktKontosaldo / 100).toString();
        } else {
          newInputValues[account.id] = '';
        }
      });
      setInputValues(newInputValues);
    }
  }, [monthlyBalances, accounts]);

  // Auto-sync functionality when on/after payday
  useEffect(() => {
    if (isPaydayOrAfter && monthlyBalances && accounts) {
      accounts.forEach(account => {
        const balance = monthlyBalances.find(b => b.accountId === account.id);
        if (balance && balance.faktisktKontosaldo !== balance.calculatedBalance) {
          // Auto-update faktiskt kontosaldo to match calculated balance
          updateFaktisktKontosaldoMutation.mutate({
            accountId: account.id,
            faktisktKontosaldo: balance.calculatedBalance
          });
        }
      });
    }
  }, [isPaydayOrAfter, monthlyBalances, accounts, selectedMonthKey]);

  const handleInputChange = (accountId: string, value: string) => {
    setInputValues(prev => ({ ...prev, [accountId]: value }));
  };

  const handleInputBlur = (accountId: string) => {
    const value = inputValues[accountId];
    if (value === '') {
      // Clear the field - set to null
      updateFaktisktKontosaldoMutation.mutate({
        accountId,
        faktisktKontosaldo: null
      });
    } else {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        // Save as öre (multiply by 100)
        updateFaktisktKontosaldoMutation.mutate({
          accountId,
          faktisktKontosaldo: Math.round(numericValue * 100)
        });
      }
    }
  };

  const getMonthName = (monthKey: string): string => {
    const [year, month] = monthKey.split('-');
    const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 
                       'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Kontosaldon för {getMonthName(selectedMonthKey)}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Ange saldot på kontona den 24:e föregående månad, innan kontona fylls på med nya pengar den 25:e.
                </p>
              </div>
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Show warning if on/after payday */}
            {isPaydayOrAfter && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Automatisk uppdatering aktiverad:</strong> Eftersom vi är på eller efter den 25:e i den valda månaden, 
                  synkroniseras "Faktiskt kontosaldo" automatiskt med "Bankens saldo".
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                <p><strong>Hushåll</strong></p>
                <p>Estimerat: 0 kr</p>
              </div>

              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  Visa konton ({accounts.length})
                  {isExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                </Button>

                {accounts.map(account => {
                  const balance = monthlyBalances?.find(b => b.accountId === account.id);
                  // Prioritize bankensKontosaldo from CSV import, fall back to calculatedBalance
                  const bankensaldo = balance 
                    ? (balance.bankensKontosaldo !== null && balance.bankensKontosaldo !== undefined 
                        ? balance.bankensKontosaldo / 100 
                        : balance.calculatedBalance / 100)
                    : 0;
                  const faktisktSaldo = balance?.faktisktKontosaldo !== null && balance?.faktisktKontosaldo !== undefined 
                    ? balance.faktisktKontosaldo / 100 
                    : null;
                  
                  const displayFaktiskt = isPaydayOrAfter ? bankensaldo : faktisktSaldo;
                  const showEjIfyllt = !isPaydayOrAfter && faktisktSaldo === null;

                  return (
                    <div key={account.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <h4 className="font-medium">{account.name}</h4>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-sm text-blue-600">Faktiskt kontosaldo</Label>
                          <div className="flex items-center gap-2">
                            {showEjIfyllt ? (
                              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                Ej ifyllt
                              </span>
                            ) : (
                              <Input
                                type="number"
                                step="0.01"
                                value={inputValues[account.id] || ''}
                                onChange={(e) => handleInputChange(account.id, e.target.value)}
                                onBlur={() => handleInputBlur(account.id)}
                                className="w-24 text-right text-sm"
                                placeholder="kr"
                                disabled={isPaydayOrAfter}
                              />
                            )}
                            <span className="text-sm">kr</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <Label className="text-sm text-purple-600">Bankens saldo</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {bankensaldo.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-sm">kr</span>
                          </div>
                        </div>

                        <div className="border-t pt-2">
                          <div className="flex justify-between items-center">
                            <Label className="text-sm font-medium">Estimerad ingående balans</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">0</span>
                              <span className="text-sm">kr</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <Label className="text-sm">Calc.Kontosaldo</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">0</span>
                            <span className="text-sm">kr</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <Label className="text-sm">Calc.Descr</Label>
                          <span className="text-sm">(Est)</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Ingen data
                        </p>
                        <p className="text-xs text-muted-foreground">
                          tillgänglig
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Importera transaktioner med saldo
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};