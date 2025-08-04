import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, ArrowLeftRight, Plus, Edit3, Trash2 } from 'lucide-react';
import { BudgetState, PlannedTransfer, BudgetItem, Account, MonthData, Transaction } from '@/types/budget';
import { getAccountNameById } from '../orchestrator/budgetOrchestrator';
import { getDateRangeForMonth, getInternalTransferSummary } from '../services/calculationService';
import { SimpleTransferMatchDialog } from './SimpleTransferMatchDialog';
import { NewTransferForm } from './NewTransferForm';

interface TransfersAnalysisProps {
  budgetState: BudgetState;
  selectedMonth: string;
}

interface AccountAnalysisData {
  account: Account;
  totalBudgeted: number;
  totalTransferredIn: number;
  actualTransferredIn: number;
  budgetItems: BudgetItem[];
  transfersOut: PlannedTransfer[];
  transfersIn: PlannedTransfer[];
}

export const TransfersAnalysis: React.FC<TransfersAnalysisProps> = ({ 
  budgetState, 
  selectedMonth 
}) => {
  console.log('🔄 [TRANSFERS COMPONENT] Component rendered with month:', selectedMonth);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [transferMatchDialog, setTransferMatchDialog] = useState<{
    isOpen: boolean;
    transaction?: Transaction;
    suggestions?: Transaction[];
  }>({ isOpen: false });
  
  const [showNewTransferForm, setShowNewTransferForm] = useState(false);
  const [selectedFromAccountId, setSelectedFromAccountId] = useState<string>('');
  const [expandedDailyTransfers, setExpandedDailyTransfers] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);

  // Toggle account expansion
  const toggleAccount = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  // Toggle daily transfer expansion
  const toggleDailyTransfer = (transferId: string) => {
    const newExpanded = new Set(expandedDailyTransfers);
    if (newExpanded.has(transferId)) {
      newExpanded.delete(transferId);
    } else {
      newExpanded.add(transferId);
    }
    setExpandedDailyTransfers(newExpanded);
  };

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', { 
      style: 'currency', 
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Get day names in Swedish
  const getDayNames = (days: number[]) => {
    const dayNames = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
    return days.map(d => dayNames[d]).join(', ');
  };

  // Handle new transfer form
  const openNewTransferForm = (fromAccountId?: string) => {
    setSelectedFromAccountId(fromAccountId || '');
    setShowNewTransferForm(true);
  };

  const handleCreateTransfer = (transfer: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    transferType: 'monthly' | 'daily';
    dailyAmount?: number;
    transferDays?: number[];
  }) => {
    // Import the orchestrator function to create planned transfers
    import('../orchestrator/budgetOrchestrator').then(({ createPlannedTransfer }) => {
      createPlannedTransfer({
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        amount: transfer.amount,
        month: selectedMonth,
        description: transfer.description,
        transferType: transfer.transferType,
        dailyAmount: transfer.dailyAmount,
        transferDays: transfer.transferDays
      });
    });
    
    console.log('Creating planned transfer:', transfer);
    setShowNewTransferForm(false);
    setSelectedFromAccountId('');
  };

  const handleDeletePlannedTransfer = async (transferId: string) => {
    // TODO: Implement delete functionality through orchestrator
    console.log('Delete planned transfer:', transferId);
  };

  // Handle clicking on "Ej matchad" badge to match transfers
  const handleMatchTransfer = (transaction: Transaction) => {
    // Get all transactions for the period
    const { startDate, endDate } = getDateRangeForMonth(selectedMonth, budgetState.settings?.payday || 25);
    const allTransactions = budgetState.allTransactions || [];
    const transactionsForPeriod = allTransactions.filter(t => {
      return t.date >= startDate && t.date <= endDate;
    });

    // Find potential matches - ALL transactions with opposite sign within 7 days from OTHER accounts
    const potentialMatches = transactionsForPeriod.filter(t => 
      t.id !== transaction.id &&
      t.accountId !== transaction.accountId && // Different account
      // Opposite signs (positive matches negative, negative matches positive)
      ((transaction.amount > 0 && t.amount < 0) || (transaction.amount < 0 && t.amount > 0)) &&
      Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01 && // Same absolute amount
      Math.abs(new Date(t.date).getTime() - new Date(transaction.date).getTime()) <= 7 * 24 * 60 * 60 * 1000 // Within 7 days
    );

    setTransferMatchDialog({
      isOpen: true,
      transaction,
      suggestions: potentialMatches,
    });
  };



  // Hämta interna överföringar för varje konto (outside useMemo so it can be used in render)
  console.log('🔄 [TRANSFERS COMPONENT] Calling getInternalTransferSummary for month:', selectedMonth);
  const allInternalTransfers = getInternalTransferSummary(budgetState, selectedMonth);
  console.log('🔄 [TRANSFERS COMPONENT] Internal transfers result:', allInternalTransfers);

  // Använd useMemo för prestanda! Dessa beräkningar kan vara tunga.
  const analysisData = useMemo(() => {
    console.log('🔄 [TRANSFERS] Computing analysis data for month:', selectedMonth);
    
    // 1. Hämta månadsdata för den valda månaden
    const monthData: MonthData = budgetState.historicalData[selectedMonth];
    if (!monthData) {
      console.log('🔄 [TRANSFERS] No month data found for:', selectedMonth);
      return [];
    }

    // 1.5. Hämta alla transaktioner för beräkning av faktiska överföringar
    const { startDate, endDate } = getDateRangeForMonth(selectedMonth, budgetState.settings?.payday || 25);
    const allTransactions = budgetState.allTransactions || [];
    const transactionsForPeriod = allTransactions.filter(t => {
      return t.date >= startDate && t.date <= endDate;
    });

    console.log('🔄 [TRANSFERS] Date filtering details:', {
      selectedMonth,
      payday: budgetState.settings?.payday || 25,
      startDate,
      endDate,
      totalTransactions: allTransactions.length,
      filteredTransactions: transactionsForPeriod.length,
      exampleFilteredDates: transactionsForPeriod.slice(0, 5).map(t => ({ date: t.date, amount: t.amount, account: t.accountId }))
    });

    // Internal transfers already calculated outside useMemo
    
    // 2. Extrahera cost items från costGroups struktur
    const costItems: BudgetItem[] = [];
    
    // Loopa igenom alla costGroups och extrahera subCategories
    if (monthData.costGroups) {
      monthData.costGroups.forEach(group => {
        if (group.subCategories) {
          group.subCategories.forEach(subCat => {
            costItems.push({
              id: subCat.id,
              mainCategoryId: group.id || '',
              subCategoryId: subCat.id,
              description: subCat.name,
              amount: subCat.amount,
              accountId: subCat.accountId || '',
              financedFrom: subCat.financedFrom,
              transferType: subCat.transferType
            });
          });
        }
      });
    }
    
    // Extrahera savings items från savingsGroups struktur
    const savingsItems: BudgetItem[] = [];
    if (monthData.savingsGroups) {
      monthData.savingsGroups.forEach(group => {
        if (group.subCategories) {
          group.subCategories.forEach(subCat => {
            savingsItems.push({
              id: subCat.id,
              mainCategoryId: group.id || '',
              subCategoryId: subCat.id,
              description: subCat.name,
              amount: subCat.amount,
              accountId: subCat.accountId || ''
            });
          });
        }
      });
    }
    
    const allBudgetItems = [...costItems, ...savingsItems];
    const monthlyTransfers = budgetState.plannedTransfers?.filter(pt => pt.month === selectedMonth) || [];
    
    console.log('🔄 [TRANSFERS] Extracted cost items:', costItems);
    console.log('🔄 [TRANSFERS] Available accounts:', budgetState.accounts);
    console.log('🔄 [TRANSFERS] Accounts type check:', budgetState.accounts.map(acc => ({ type: typeof acc, value: acc })));
    
    // 3. Skapa en lookup-map för kategorier för snabb åtkomst (för framtida användning)
    const categoryMap = new Map(budgetState.mainCategories?.map(c => [c, c]) || []);
    // 4. Use ALL accounts from settings, not just those with budget items
    console.log('🔄 [TRANSFERS] All available accounts:', budgetState.accounts);
    // Create Account objects for ALL accounts from settings
    const relevantAccounts: Account[] = budgetState.accounts.map(account => ({
      id: account.id,
      name: account.name,
      startBalance: account.startBalance || 0
    }));
    console.log('🔄 [TRANSFERS] Showing all accounts:', relevantAccounts);
    // 5. Loopa igenom varje relevant konto och aggregera data
    return relevantAccounts.map(account => {
      // Hitta alla budgetposter som hör till detta konto
      const budgetedItemsForAccount = allBudgetItems.filter(item => {
        // För nu använder vi accountId direkt från budgetItem
        // I framtiden kan vi använda category.defaultAccountId när det implementeras
        return item.accountId === account.id;
      });

      // Hitta endast kostnadsposter för kontot (för budgeterat belopp)
      const costItemsForAccount = costItems.filter(item => item.accountId === account.id);
      
      console.log(`🔄 [TRANSFERS] Account ${account.name} (ID: ${account.id}):`, {
        totalCostItems: costItems.length,
        costItemsForAccount: costItemsForAccount.length,
        costItemsForAccountDetails: costItemsForAccount
      });

      // Summera total budgeterad kostnad för kontot (endast kostnadsposter)
      const totalBudgeted = costItemsForAccount.reduce((sum, item) => sum + item.amount, 0);

      // Summera totala planerade överföringar TILL kontot
      const totalTransferredIn = monthlyTransfers
        .filter(t => t.toAccountId === account.id)
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Summera totala planerade överföringar FRÅN kontot
      const totalTransferredOut = monthlyTransfers
        .filter(t => t.fromAccountId === account.id)
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Netto planerat: in minus out
      const netPlannedTransfers = totalTransferredIn - totalTransferredOut;

      // Hitta alla överföringar FRÅN kontot (för detaljvyn)
      const transfersOut = monthlyTransfers.filter(t => t.fromAccountId === account.id);
      
      // Hitta alla överföringar TILL kontot (för detaljvyn)
      const transfersIn = monthlyTransfers.filter(t => t.toAccountId === account.id);

      // Beräkna faktiska överföringar från transaktioner (net transfer för kontot)
      const accountTransfers = allInternalTransfers.find(t => t.accountId === account.id);
      const actualTransferredIn = accountTransfers ? accountTransfers.totalIn - accountTransfers.totalOut : 0;

      return {
        account,
        totalBudgeted,
        totalTransferredIn: netPlannedTransfers, // Use net amount instead of just incoming
        actualTransferredIn,
        budgetItems: budgetedItemsForAccount,
        transfersOut,
        transfersIn,
      };
    });
  }, [budgetState.accounts, budgetState.mainCategories, budgetState.historicalData, budgetState.plannedTransfers, selectedMonth, allInternalTransfers]);

  // Beräkna totala överföringar för CardDescription (nu använder vi redan netto per konto)
  const totalTransfers = analysisData.reduce((sum, data) => sum + data.totalTransferredIn, 0);
  const totalActualTransfers = analysisData.reduce((sum, data) => sum + data.actualTransferredIn, 0);

  return (
    <Card className="shadow-lg border-0 bg-blue-50/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <ArrowLeftRight className="h-5 w-5" />
              Överföringar
            </CardTitle>
            <CardDescription className="text-blue-700">
              Planerat: {formatCurrency(totalTransfers)} • Faktiskt: {formatCurrency(totalActualTransfers)}
            </CardDescription>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform text-blue-800 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-100/50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-blue-800">Kontoöversikt ({selectedMonth})</h3>
                <p className="text-sm text-blue-700">Planerade vs faktiska överföringar per konto</p>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                className="border-blue-300 text-blue-800 hover:bg-blue-200"
                onClick={() => openNewTransferForm()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ny Överföring
              </Button>
            </div>
            
            <div className="space-y-3">
              {analysisData.length === 0 ? (
                <div className="text-center py-8 text-blue-700">
                  <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Inga överföringar planerade</p>
                  <p className="text-sm opacity-75">Lägg till överföringar för att se en översikt här</p>
                </div>
              ) : (
                analysisData.map(data => {
                  const isAccountExpanded = expandedAccounts.has(data.account.id);
                  const accountInternalTransfers = allInternalTransfers.find(t => t.accountId === data.account.id);
                  
                  return (
                    <div key={data.account.id} className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                      {/* Account Header - Klickbar för expansion */}
                      <div 
                        className="p-4 cursor-pointer hover:bg-blue-50/50 transition-colors"
                        onClick={() => toggleAccount(data.account.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-blue-900 text-lg">{data.account.name}</h4>
                              <ChevronDown className={`h-4 w-4 text-blue-600 transition-transform ${isAccountExpanded ? 'rotate-180' : ''}`} />
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="text-center">
                                <div className="text-red-700 font-medium">Budgeterade kostnader</div>
                                <div className="font-semibold text-red-900">{formatCurrency(data.totalBudgeted)}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-blue-700 font-medium">Planerat</div>
                                <div className="font-semibold text-blue-900">{formatCurrency(data.totalTransferredIn)}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-green-600 font-medium">Faktiskt</div>
                                <div className="font-semibold text-green-600">{formatCurrency(data.actualTransferredIn)}</div>
                              </div>
                            </div>
                            
                            {/* Progress bar för planerat vs faktiskt */}
                            <div className="w-full bg-blue-100 rounded-full h-2 mt-3">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                style={{ 
                                  width: data.totalTransferredIn > 0 
                                    ? `${Math.min((data.actualTransferredIn / data.totalTransferredIn) * 100, 100)}%` 
                                    : '0%' 
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanderat innehåll med detaljer */}
                      {isAccountExpanded && (
                        <div className="border-t border-blue-200 bg-blue-25/25">
                          <div className="p-4 space-y-4">
                            
                            {/* Budgeterade överföringar */}
                            {data.budgetItems.length > 0 && (
                              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                                <h4 className="font-semibold mb-3 text-sm text-red-800 uppercase tracking-wide">
                                  Budgeterade Kostnader ({data.budgetItems.length})
                                </h4>
                                <div className="space-y-2">
                                  {data.budgetItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-center py-2 px-3 rounded bg-white border border-red-100">
                                      <span className="text-sm text-red-900">{item.description}</span>
                                      <span className="font-medium text-sm text-red-800">{formatCurrency(item.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Planerade överföringar sektion */}
                            {(data.transfersIn.length > 0 || data.transfersOut.length > 0) && (
                              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <h4 className="font-semibold text-sm text-yellow-800 uppercase tracking-wide">
                                    Planerade Överföringar
                                  </h4>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="ml-2 h-6 w-6 p-0 text-yellow-700 hover:bg-yellow-200"
                                    onClick={() => setEditMode(!editMode)}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  {editMode && (
                                    <span className="text-xs text-yellow-700 ml-2">Redigera läge aktivt</span>
                                  )}
                                  {data.transfersIn.length > 0 && (
                                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
                                      In: {data.transfersIn.length}
                                    </Badge>
                                  )}
                                  {data.transfersOut.length > 0 && (
                                    <Badge variant="outline" className="border-yellow-300 text-yellow-800">
                                      Ut: {data.transfersOut.length}
                                    </Badge>
                                  )}
                                </div>
                                
                                {data.transfersIn.length > 0 && (
                                  <div className="mb-3">
                                    <h5 className="text-xs font-medium text-yellow-700 mb-2">Inkommande:</h5>
                                    <div className="space-y-1">
                                      {data.transfersIn.map((t) => (
                                        <div key={t.id}>
                                          <div className="flex justify-between items-center py-2 px-3 rounded bg-white border border-yellow-100">
                                            <span className="text-sm text-yellow-900">
                                              {formatCurrency(t.amount)} från {getAccountNameById(t.fromAccountId)}
                                              {t.transferType === 'daily' && t.transferDays && (
                                                <span className="ml-2 text-xs text-yellow-600">
                                                  ({t.transferDays.length} dagar/vecka)
                                                </span>
                                              )}
                                              {t.description && (
                                                <span className="ml-2 text-xs text-yellow-600">
                                                  - {t.description}
                                                </span>
                                              )}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-sm text-yellow-600">
                                                + {formatCurrency(t.amount)}
                                              </span>
                                              {editMode && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                                                  onClick={() => handleDeletePlannedTransfer(t.id)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              )}
                                              {t.transferType === 'daily' && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-6 w-6 p-0 text-yellow-600 hover:bg-yellow-100"
                                                  onClick={() => toggleDailyTransfer(t.id)}
                                                >
                                                  {expandedDailyTransfers.has(t.id) ? 
                                                    <ChevronUp className="h-4 w-4" /> : 
                                                    <ChevronDown className="h-4 w-4" />
                                                  }
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                          {/* Expandable daily transfer details for incoming */}
                                          {t.transferType === 'daily' && expandedDailyTransfers.has(t.id) && (
                                            <div className="mt-2 pl-4 border-l-2 border-yellow-200">
                                              <div className="text-xs text-yellow-700 mb-1">
                                                <strong>Detaljer för daglig överföring:</strong>
                                              </div>
                                              <div className="text-xs text-yellow-600 space-y-1">
                                                <div>Belopp per dag: <strong>{formatCurrency(t.dailyAmount || 0)}</strong></div>
                                                <div>Dagar: <strong>{getDayNames(t.transferDays || [])}</strong></div>
                                                <div>Totalt per månad: <strong>{formatCurrency(t.amount)}</strong></div>
                                                {t.description && (
                                                  <div>Beskrivning: <strong>{t.description}</strong></div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {data.transfersOut.length > 0 && (
                                  <div>
                                    <h5 className="text-xs font-medium text-yellow-700 mb-2">Utgående:</h5>
                                    <div className="space-y-1">
                                      {data.transfersOut.map((t) => (
                                        <div key={t.id}>
                                          <div className="flex justify-between items-center py-2 px-3 rounded bg-white border border-yellow-100">
                                            <span className="text-sm text-yellow-900">
                                              {formatCurrency(t.amount)} till {getAccountNameById(t.toAccountId)}
                                              {t.transferType === 'daily' && t.transferDays && (
                                                <span className="ml-2 text-xs text-yellow-600">
                                                  ({t.transferDays.length} dagar/vecka)
                                                </span>
                                              )}
                                              {t.description && (
                                                <span className="ml-2 text-xs text-yellow-600">
                                                  - {t.description}
                                                </span>
                                              )}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-sm text-yellow-600">
                                                - {formatCurrency(t.amount)}
                                              </span>
                                              {editMode && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                                                  onClick={() => handleDeletePlannedTransfer(t.id)}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              )}
                                              {t.transferType === 'daily' && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-6 w-6 p-0 text-yellow-600 hover:bg-yellow-100"
                                                  onClick={() => toggleDailyTransfer(t.id)}
                                                >
                                                  {expandedDailyTransfers.has(t.id) ? 
                                                    <ChevronUp className="h-4 w-4" /> : 
                                                    <ChevronDown className="h-4 w-4" />
                                                  }
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                          {/* Expandable daily transfer details for outgoing */}
                                          {t.transferType === 'daily' && expandedDailyTransfers.has(t.id) && (
                                            <div className="mt-2 pl-4 border-l-2 border-yellow-200">
                                              <div className="text-xs text-yellow-700 mb-1">
                                                <strong>Detaljer för daglig överföring:</strong>
                                              </div>
                                              <div className="text-xs text-yellow-600 space-y-1">
                                                <div>Belopp per dag: <strong>{formatCurrency(t.dailyAmount || 0)}</strong></div>
                                                <div>Dagar: <strong>{getDayNames(t.transferDays || [])}</strong></div>
                                                <div>Totalt per månad: <strong>{formatCurrency(t.amount)}</strong></div>
                                                {t.description && (
                                                  <div>Beskrivning: <strong>{t.description}</strong></div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Faktiska överföringar sektion */}
                            {accountInternalTransfers && (accountInternalTransfers.incomingTransfers.length > 0 || accountInternalTransfers.outgoingTransfers.length > 0) && (
                              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <h4 className="font-semibold text-sm text-green-800 uppercase tracking-wide">
                                    Faktiska Överföringar
                                  </h4>
                                  {accountInternalTransfers.totalIn > 0 && (
                                    <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                                      In: {formatCurrency(accountInternalTransfers.totalIn)}
                                    </Badge>
                                  )}
                                  {accountInternalTransfers.totalOut > 0 && (
                                    <Badge variant="destructive">
                                      Ut: {formatCurrency(accountInternalTransfers.totalOut)}
                                    </Badge>
                                  )}
                                </div>
                                
                                {accountInternalTransfers.incomingTransfers.length > 0 && (
                                  <div className="mb-3">
                                    <h5 className="text-xs font-medium text-green-700 mb-2">Inkommande:</h5>
                                    <div className="space-y-1">
                                      {accountInternalTransfers.incomingTransfers.map((t, index) => (
                                        <div key={index} className="flex justify-between items-center py-2 px-3 rounded bg-white border border-green-100">
                                           <span className="text-sm text-green-900">
                                             {formatCurrency(t.amount)} från {t.fromAccountName}
                                             {t.linked ? (
                                               <span className="ml-2 text-xs text-green-600 font-medium">
                                                 ({t.fromAccountName}, {t.transaction.date}) - {t.transaction.description || 'Överföring'}, {t.transaction.date}
                                               </span>
                                             ) : (
                                               <Badge 
                                                 variant="outline" 
                                                 className="ml-2 text-xs text-orange-600 border-orange-200 cursor-pointer hover:bg-orange-50"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   handleMatchTransfer(t.transaction);
                                                 }}
                                               >
                                                 Ej matchad
                                               </Badge>
                                             )}
                                           </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {accountInternalTransfers.outgoingTransfers.length > 0 && (
                                  <div>
                                    <h5 className="text-xs font-medium text-green-700 mb-2">Utgående:</h5>
                                    <div className="space-y-1">
                                      {accountInternalTransfers.outgoingTransfers.map((t, index) => (
                                        <div key={index} className="flex justify-between items-center py-2 px-3 rounded bg-white border border-green-100">
                                           <span className="text-sm text-green-900">
                                             {formatCurrency(t.amount)} till {t.toAccountName}
                                             {t.linked ? (
                                               <span className="ml-2 text-xs text-green-600 font-medium">
                                                 ({t.toAccountName}, {t.transaction.date}) - {t.transaction.description || 'Överföring'}, {t.transaction.date}
                                               </span>
                                             ) : (
                                               <Badge 
                                                 variant="outline" 
                                                 className="ml-2 text-xs text-orange-600 border-orange-200 cursor-pointer hover:bg-orange-50"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   handleMatchTransfer(t.transaction);
                                                 }}
                                               >
                                                 Ej matchad
                                               </Badge>
                                             )}
                                           </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-2 pt-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="border-blue-300 text-blue-800 hover:bg-blue-200"
                                onClick={() => openNewTransferForm(data.account.id)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Ny Överföring
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      )}

      {/* Transfer Match Dialog */}
      <SimpleTransferMatchDialog
        isOpen={transferMatchDialog.isOpen}
        onClose={() => setTransferMatchDialog({ isOpen: false })}
        transaction={transferMatchDialog.transaction}
        suggestions={transferMatchDialog.suggestions || []}
      />

      {/* New Transfer Form Modal */}
      {showNewTransferForm && (
        <NewTransferForm
          preselectedFromAccountId={selectedFromAccountId}
          preselectedFromAccountName={selectedFromAccountId ? 
            budgetState.accounts.find(acc => acc.id === selectedFromAccountId)?.name || 'Välj konto' : 
            'Välj konto'
          }
          availableAccounts={budgetState.accounts}
          onSubmit={handleCreateTransfer}
          onCancel={() => {
            setShowNewTransferForm(false);
            setSelectedFromAccountId('');
          }}
        />
      )}
    </Card>
  );
};