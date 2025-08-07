import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Plus, ChevronRight } from 'lucide-react';
import { BudgetState, PlannedTransfer, BudgetItem, Account } from '@/types/budget';
import { NewTransferForm } from './NewTransferForm';
import { createPlannedTransfer } from '../orchestrator/budgetOrchestrator';
import { getInternalTransferSummary, getDateRangeForMonth } from '../services/calculationService';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategoriesHierarchy } from '@/hooks/useCategories';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';

interface AccountRowData {
  account: Account;
  totalBudgeted: number;
  totalPlannedIn: number;
  totalPlannedOut: number;
  actualTransferredIn: number;
  budgetItems: BudgetItem[];
  plannedTransfersIn: any[];
  plannedTransfersOut: any[];
}

interface AccountRowProps {
  data: AccountRowData;
  selectedMonth: string;
  budgetState: BudgetState;
}

// Helper för att formatera valuta
const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('sv-SE', { 
    style: 'currency', 
    currency: 'SEK' 
  }).format(amount);

export const AccountRow: React.FC<AccountRowProps> = ({ 
  data, 
  selectedMonth, 
  budgetState 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNewTransferForm, setShowNewTransferForm] = useState(false);
  const [expandedBudgetItems, setExpandedBudgetItems] = useState<Set<string>>(new Set());
  const [expandedTransfers, setExpandedTransfers] = useState<Set<string>>(new Set());
  
  // Use API accounts instead of budgetState.accounts
  const { data: accountsFromAPI = [] } = useAccounts();
  const { data: transactionsFromAPI = [] } = useTransactions();
  const { categories } = useCategoriesHierarchy();

  // Data från props
  const { account, totalBudgeted, totalPlannedIn, totalPlannedOut, actualTransferredIn, budgetItems, plannedTransfersIn, plannedTransfersOut } = data;
  
  // Debug logging
  addMobileDebugLog(`[AccountRow] Budget items count: ${budgetItems.length}`);
  addMobileDebugLog(`[AccountRow] Budget items: ${JSON.stringify(budgetItems.map(item => ({id: item.id, desc: item.description, type: item.transferType})))}`);
  addMobileDebugLog(`[AccountRow] Planned transfers in count: ${plannedTransfersIn.length}`);
  addMobileDebugLog(`[AccountRow] Planned transfers out count: ${plannedTransfersOut.length}`);
  
  // Calculate net planned transfers
  const netPlanned = totalPlannedIn - totalPlannedOut;

  // CRITICAL FIX: Use SQL transactions instead of localStorage budgetState
  // Hämta interna överföringar för detta konto
  const allInternalTransfers = getInternalTransferSummary(budgetState, selectedMonth, transactionsFromAPI);
  const accountInternalTransfers = allInternalTransfers.find(summary => summary.accountId === account.id);
  
  // Debug loggar
  console.log('🔍 [INTERNAL TRANSFERS DEBUG]', {
    selectedMonth,
    accountId: account.id,
    accountName: account.name,
    allInternalTransfers,
    accountInternalTransfers,
    hasIncomingTransfers: accountInternalTransfers?.incomingTransfers?.length || 0,
    hasOutgoingTransfers: accountInternalTransfers?.outgoingTransfers?.length || 0
  });

  const handleCreateTransfer = async (transfer: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    transferType: 'monthly' | 'daily';
    dailyAmount?: number;
    transferDays?: number[];
    huvudkategoriId?: string;
    underkategoriId?: string;
  }) => {
    await createPlannedTransfer({
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amount: transfer.amount,
      month: selectedMonth,
      description: transfer.description,
      transferType: transfer.transferType,
      dailyAmount: transfer.dailyAmount,
      transferDays: transfer.transferDays,
      huvudkategoriId: transfer.huvudkategoriId,
      underkategoriId: transfer.underkategoriId
    });
    setShowNewTransferForm(false);
  };

  const getAccountNameById = (accountId: string): string => {
    const foundAccount = accountsFromAPI.find(acc => acc.id === accountId);
    return foundAccount?.name || 'Okänt konto';
  };

  const getCategoryName = (categoryId: string | undefined): string => {
    if (!categoryId) return '-';
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || '-';
  };

  const getSubCategoryName = (huvudkategoriId: string | undefined, underkategoriId: string | undefined): string => {
    if (!huvudkategoriId || !underkategoriId) return '-';
    const category = categories.find(cat => cat.id === huvudkategoriId);
    const subCategory = category?.underkategorier?.find(sub => sub.id === underkategoriId);
    return subCategory?.name || '-';
  };

  const toggleBudgetItemExpanded = (itemId: string) => {
    addMobileDebugLog(`[AccountRow] Toggling budget item: ${itemId}`);
    addMobileDebugLog(`[AccountRow] Current expanded budget items: ${Array.from(expandedBudgetItems).join(', ')}`);
    const newExpanded = new Set(expandedBudgetItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
      addMobileDebugLog(`[AccountRow] Collapsing item: ${itemId}`);
    } else {
      newExpanded.add(itemId);
      addMobileDebugLog(`[AccountRow] Expanding item: ${itemId}`);
    }
    setExpandedBudgetItems(newExpanded);
  };

  const toggleTransferExpanded = (transferId: string) => {
    addMobileDebugLog(`[AccountRow] Toggling transfer: ${transferId}`);
    addMobileDebugLog(`[AccountRow] Current expanded transfers: ${Array.from(expandedTransfers).join(', ')}`);
    const newExpanded = new Set(expandedTransfers);
    if (newExpanded.has(transferId)) {
      newExpanded.delete(transferId);
      addMobileDebugLog(`[AccountRow] Collapsing transfer: ${transferId}`);
    } else {
      newExpanded.add(transferId);
      addMobileDebugLog(`[AccountRow] Expanding transfer: ${transferId}`);
    }
    setExpandedTransfers(newExpanded);
  };

  return (
    <Card className="border rounded-lg mb-2 shadow-sm">
      {/* ------ Sammanfattningsrad (alltid synlig) ------ */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="font-semibold text-lg text-foreground">{account.name}</span>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs">Budgeterat</span>
            <span className="font-medium">{formatCurrency(totalBudgeted)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs">Planerat</span>
            <span className={`font-medium ${netPlanned >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {netPlanned >= 0 ? '+' : ''}{formatCurrency(netPlanned)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs">Faktiskt Överfört</span>
            <span className="font-bold text-green-600">{formatCurrency(actualTransferredIn)}</span>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            className="ml-2"
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowNewTransferForm(true); 
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Ny Överföring
          </Button>
          {isExpanded ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
        </div>
      </div>

      {/* ------ Detaljvy (synlig när expanderad) ------ */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4">
          <div className="space-y-4 mt-4 border-t border-border pt-4">
            {budgetItems.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-3">
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                  Budgeterade Kostnader ({budgetItems.length})
                </h4>
                <div className="space-y-2">
                  {budgetItems.map(item => {
                    const isItemExpanded = expandedBudgetItems.has(item.id);
                    const isDailyTransfer = item.transferType === 'daily';
                    return (
                      <div key={item.id} className="bg-background/50 rounded">
                        <div 
                          className="flex justify-between items-center py-2 px-3 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-muted active:bg-muted/70"
                          onClick={(e) => {
                            e.stopPropagation();
                            addMobileDebugLog(`[AccountRow] Budget item clicked: ${item.id} - ${item.description}`);
                            toggleBudgetItemExpanded(item.id);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {isItemExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            <span className="text-sm">
                              {item.description}
                              {isDailyTransfer && <span className="text-muted-foreground ml-1">(Daglig)</span>}
                            </span>
                          </div>
                          <span className="font-medium text-sm">{formatCurrency(item.amount)}</span>
                        </div>
                        {isItemExpanded && (
                          <div className="px-6 py-2 bg-muted/10 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Huvudkategori:</span>
                              <span>{getCategoryName(item.mainCategoryId)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Underkategori:</span>
                              <span>{getSubCategoryName(item.mainCategoryId, item.subCategoryId)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Överföringstyp:</span>
                              <span>{item.transferType === 'daily' ? 'Daglig' : 'Månadsvis'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Finansieras från:</span>
                              <span>{item.financedFrom || 'Löpande kostnad'}</span>
                            </div>
                            {item.transferType !== 'daily' && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Belopp:</span>
                                <span>{formatCurrency(item.amount)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Planned Transfers Section */}
            {(plannedTransfersIn.length > 0 || plannedTransfersOut.length > 0) && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-3">
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                  Planerade Överföringar
                </h4>
                
                {/* Incoming planned transfers */}
                {plannedTransfersIn.length > 0 && (
                  <div className="mb-3">
                    <h5 className="text-xs font-medium text-green-700 mb-2">Inkommande:</h5>
                    <div className="space-y-2">
                      {plannedTransfersIn.map(t => {
                        const isTransferExpanded = expandedTransfers.has(t.id);
                        const payday = budgetState.settings?.payday || 25;
                        const { startDate, endDate } = getDateRangeForMonth(selectedMonth, payday);
                        
                        // Calculate days for daily transfers
                        let transferDayCount = 0;
                        if (t.transferType === 'daily' && t.transferDays) {
                          const transferDaysArray = typeof t.transferDays === 'string' ? JSON.parse(t.transferDays) : t.transferDays;
                          const start = new Date(startDate);
                          const end = new Date(endDate);
                          while (start <= end) {
                            if (transferDaysArray.includes(start.getDay())) {
                              transferDayCount++;
                            }
                            start.setDate(start.getDate() + 1);
                          }
                        }
                        
                        return (
                          <div key={t.id} className="bg-background/50 rounded">
                            <div 
                              className="flex justify-between items-center py-2 px-3 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-muted active:bg-muted/70"
                              onClick={(e) => {
                                e.stopPropagation();
                                addMobileDebugLog(`[AccountRow] Transfer clicked: ${t.id} - ${t.description || 'No description'}`);
                                toggleTransferExpanded(t.id);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                {isTransferExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span className="text-sm">
                                  Från {getAccountNameById(t.accountIdFrom || t.fromAccountId)}
                                  {t.description && <span className="text-muted-foreground ml-2">({t.description})</span>}
                                </span>
                              </div>
                              <span className="font-medium text-sm text-green-600">+ {formatCurrency(t.amount)}</span>
                            </div>
                            {isTransferExpanded && (
                              <div className="px-6 py-2 bg-muted/10 text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Huvudkategori:</span>
                                  <span>{getCategoryName(t.huvudkategoriId)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Underkategori:</span>
                                  <span>{getSubCategoryName(t.huvudkategoriId, t.underkategoriId)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Överföringstyp:</span>
                                  <span>{t.transferType === 'daily' ? 'Daglig' : 'Månadsvis'}</span>
                                </div>
                                {t.transferType === 'daily' && (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Valda dagar:</span>
                                      <span>{t.transferDays ? (typeof t.transferDays === 'string' ? JSON.parse(t.transferDays) : t.transferDays).length : 0} dagar/vecka</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Period:</span>
                                      <span>{startDate} till {endDate}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Antal överföringsdagar:</span>
                                      <span>{transferDayCount} dagar</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Belopp per dag:</span>
                                      <span>{formatCurrency(t.dailyAmount || 0)}</span>
                                    </div>
                                    <div className="flex justify-between font-medium">
                                      <span className="text-muted-foreground">Total månadsbelopp:</span>
                                      <span>{formatCurrency(t.amount)}</span>
                                    </div>
                                  </>
                                )}
                                {t.transferType === 'monthly' && (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Från Konto:</span>
                                      <span>{getAccountNameById(t.accountIdFrom || t.fromAccountId)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Till Konto:</span>
                                      <span>{getAccountNameById(t.accountId || t.toAccountId)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Belopp:</span>
                                      <span>{formatCurrency(t.amount)}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Outgoing planned transfers */}
                {plannedTransfersOut.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-red-700 mb-2">Utgående:</h5>
                    <div className="space-y-2">
                      {plannedTransfersOut.map(t => {
                        const isTransferExpanded = expandedTransfers.has(t.id);
                        const payday = budgetState.settings?.payday || 25;
                        const { startDate, endDate } = getDateRangeForMonth(selectedMonth, payday);
                        
                        // Calculate days for daily transfers
                        let transferDayCount = 0;
                        if (t.transferType === 'daily' && t.transferDays) {
                          const transferDaysArray = typeof t.transferDays === 'string' ? JSON.parse(t.transferDays) : t.transferDays;
                          const start = new Date(startDate);
                          const end = new Date(endDate);
                          while (start <= end) {
                            if (transferDaysArray.includes(start.getDay())) {
                              transferDayCount++;
                            }
                            start.setDate(start.getDate() + 1);
                          }
                        }
                        
                        return (
                          <div key={t.id} className="bg-background/50 rounded">
                            <div 
                              className="flex justify-between items-center py-2 px-3 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-muted active:bg-muted/70"
                              onClick={(e) => {
                                e.stopPropagation();
                                addMobileDebugLog(`[AccountRow] Transfer clicked: ${t.id} - ${t.description || 'No description'}`);
                                toggleTransferExpanded(t.id);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                {isTransferExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <span className="text-sm">
                                  Till {getAccountNameById(t.accountId || t.toAccountId)}
                                  {t.description && <span className="text-muted-foreground ml-2">({t.description})</span>}
                                </span>
                              </div>
                              <span className="font-medium text-sm text-red-600">- {formatCurrency(t.amount)}</span>
                            </div>
                            {isTransferExpanded && (
                              <div className="px-6 py-2 bg-muted/10 text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Huvudkategori:</span>
                                  <span>{getCategoryName(t.huvudkategoriId)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Underkategori:</span>
                                  <span>{getSubCategoryName(t.huvudkategoriId, t.underkategoriId)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Överföringstyp:</span>
                                  <span>{t.transferType === 'daily' ? 'Daglig' : 'Månadsvis'}</span>
                                </div>
                                {t.transferType === 'daily' && (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Valda dagar:</span>
                                      <span>{t.transferDays ? (typeof t.transferDays === 'string' ? JSON.parse(t.transferDays) : t.transferDays).length : 0} dagar/vecka</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Period:</span>
                                      <span>{startDate} till {endDate}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Antal överföringsdagar:</span>
                                      <span>{transferDayCount} dagar</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Belopp per dag:</span>
                                      <span>{formatCurrency(t.dailyAmount || 0)}</span>
                                    </div>
                                    <div className="flex justify-between font-medium">
                                      <span className="text-muted-foreground">Total månadsbelopp:</span>
                                      <span>{formatCurrency(t.amount)}</span>
                                    </div>
                                  </>
                                )}
                                {t.transferType === 'monthly' && (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Från Konto:</span>
                                      <span>{getAccountNameById(t.accountIdFrom || t.fromAccountId)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Till Konto:</span>
                                      <span>{getAccountNameById(t.accountId || t.toAccountId)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Belopp:</span>
                                      <span>{formatCurrency(t.amount)}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Interna överföringar sektion */}
            {accountInternalTransfers && (accountInternalTransfers.incomingTransfers.length > 0 || accountInternalTransfers.outgoingTransfers.length > 0) && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                <h4 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                  Interna Överföringar 
                  {accountInternalTransfers.totalIn > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 border-green-200">
                      In: {formatCurrency(accountInternalTransfers.totalIn)}
                    </Badge>
                  )}
                  {accountInternalTransfers.totalOut > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      Ut: {formatCurrency(accountInternalTransfers.totalOut)}
                    </Badge>
                  )}
                </h4>
                
                {accountInternalTransfers.incomingTransfers.length > 0 && (
                  <div className="mb-3">
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Inkommande:</h5>
                    <div className="space-y-1">
                      {accountInternalTransfers.incomingTransfers.map((t, index) => (
                        <div key={index} className="flex justify-between items-center py-1 px-2 rounded bg-background/50">
                           <span className="text-sm">
                             {formatCurrency(t.amount)} från {t.fromAccountName}
                             {t.linked ? (
                               t.transaction.userDescription && (
                                 <span className="ml-2 text-xs text-green-600 font-medium">
                                   ({t.transaction.userDescription})
                                 </span>
                               )
                             ) : (
                               <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-200">
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
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Utgående:</h5>
                    <div className="space-y-1">
                      {accountInternalTransfers.outgoingTransfers.map((t, index) => (
                        <div key={index} className="flex justify-between items-center py-1 px-2 rounded bg-background/50">
                           <span className="text-sm">
                             {formatCurrency(t.amount)} till {t.toAccountName}
                             {t.linked ? (
                               t.transaction.userDescription && (
                                 <span className="ml-2 text-xs text-green-600 font-medium">
                                   ({t.transaction.userDescription})
                                 </span>
                               )
                             ) : (
                               <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-200">
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

            {budgetItems.length === 0 && !accountInternalTransfers && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Inga budgetposter eller överföringar för detta konto
              </div>
            )}
          </div>
        </CardContent>
      )}

      {/* Modal eller inline-formulär för att skapa ny överföring */}
      {showNewTransferForm && (
        <NewTransferForm
          targetAccountId={account.id}
          targetAccountName={account.name}
          availableAccounts={accountsFromAPI.filter(acc => acc.id !== account.id)}
          onSubmit={handleCreateTransfer}
          onCancel={() => setShowNewTransferForm(false)}
        />
      )}
    </Card>
  );
};