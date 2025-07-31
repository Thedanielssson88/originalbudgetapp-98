import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { ImportedTransaction } from '@/types/transaction';
import { StorageKey, get } from '@/services/storageService';
import { TransactionTypeSelector } from './TransactionTypeSelector';
import { updateTransaction } from '../orchestrator/budgetOrchestrator';
import { useBudget } from '@/hooks/useBudget';

interface TransactionExpandableCardProps {
  transaction: ImportedTransaction;
  account: { id: string; name: string; startBalance: number } | undefined;
  isSelected: boolean;
  mainCategories: string[];
  costGroups?: { id: string; name: string; subCategories?: { id: string; name: string }[] }[];
  onToggleSelection: (id: string) => void;
  onUpdateCategory: (id: string, category: string, subCategoryId?: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onTransferMatch?: (transaction: ImportedTransaction) => void;
  onSavingsLink?: (transaction: ImportedTransaction) => void;
  onCostCoverage?: (transaction: ImportedTransaction) => void;
}

export const TransactionExpandableCard: React.FC<TransactionExpandableCardProps> = ({
  transaction,
  account,
  isSelected,
  mainCategories,
  costGroups = [],
  onToggleSelection,
  onUpdateCategory,
  onUpdateNote,
  onTransferMatch,
  onSavingsLink,
  onCostCoverage
}) => {
  console.log(`🎯 [TransactionExpandableCard] Rendering for transaction ${transaction.id}, type: ${transaction.type}`);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [subcategoriesData, setSubcategoriesData] = useState<Record<string, string[]>>({});
  const { budgetState } = useBudget();

  // Load subcategories from the same storage as MainCategoriesSettings
  useEffect(() => {
    const loadedSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
    setSubcategoriesData(loadedSubcategories);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'green': return 'border-l-green-500';
      case 'yellow': return 'border-l-yellow-500'; 
      case 'red': return 'border-l-red-500';
      default: return 'border-l-gray-400';
    }
  };

  // Display user description if available, otherwise original description
  const displayDescription = transaction.userDescription || transaction.description;
  const hasUserDescription = Boolean(transaction.userDescription);

  return (
    <Card className={`border-l-4 ${getStatusBorderColor(transaction.status)} hover:shadow-md transition-shadow`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Status indicator */}
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusColor(transaction.status)}`} />
                
                {/* Checkbox */}
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelection(transaction.id)}
                    className="flex-shrink-0"
                  />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                  {/* Account */}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Konto</p>
                    <p className="font-medium text-sm truncate">{account?.name || transaction.accountId}</p>
                  </div>
                  
                  {/* Description */}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Beskrivning</p>
                    <p className="text-sm truncate" title={displayDescription}>
                      {hasUserDescription && (
                        <span className="text-primary font-medium">{displayDescription}</span>
                      )}
                      {!hasUserDescription && displayDescription}
                    </p>
                  </div>
                  
                  {/* Amount */}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Belopp</p>
                    {transaction.correctedAmount !== undefined ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Korrigerat belopp</p>
                        <p className={`font-semibold text-sm ${transaction.correctedAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.correctedAmount >= 0 ? '+' : ''}{Math.abs(transaction.correctedAmount).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                        </p>
                        <p className="text-xs text-muted-foreground">Ursprungligt belopp</p>
                        <p className={`text-xs ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'} line-through`}>
                          {transaction.amount >= 0 ? '+' : ''}{Math.abs(transaction.amount).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                        </p>
                      </div>
                    ) : (
                      <p className={`font-semibold text-sm ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.amount >= 0 ? '+' : ''}{Math.abs(transaction.amount).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Expand button */}
              <Button variant="ghost" size="sm" className="flex-shrink-0 ml-2">
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <div className="border-t pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Left column */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Datum</label>
                    <p className="text-sm">{transaction.date}</p>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Ursprunglig beskrivning</label>
                    <p className="text-sm text-muted-foreground">{transaction.description}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Egen text</label>
                    <div className="flex items-center space-x-2">
                      {isEditingNote ? (
                        <Input
                          value={transaction.userDescription || ''}
                          onChange={(e) => onUpdateNote(transaction.id, e.target.value)}
                          onBlur={() => setIsEditingNote(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setIsEditingNote(false);
                            }
                          }}
                          placeholder="Skriv egen beskrivning..."
                          className="text-sm"
                          autoFocus
                        />
                      ) : (
                        <>
                          <p className="text-sm flex-1">
                            {transaction.userDescription || (
                              <span className="text-muted-foreground italic">Ingen egen text</span>
                            )}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditingNote(true)}
                            className="p-1 h-auto"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-3">
                  {/* Bank Category and Subcategory */}
                  {(transaction.bankCategory || transaction.bankSubCategory) && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Bankkategori</label>
                      <div className="space-y-1">
                        {transaction.bankCategory && (
                          <p className="text-sm">{transaction.bankCategory}</p>
                        )}
                        {transaction.bankSubCategory && (
                          <p className="text-sm text-muted-foreground">{transaction.bankSubCategory}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Typ</label>
                    <div className="mt-1">
                      <select 
                        value={transaction.type} 
                        onChange={(e) => {
                          const newType = e.target.value;
                          console.log(`🔄 EXPANDABLE CARD: Changing type from ${transaction.type} to ${newType} for transaction ${transaction.id}`);
                          // Direct orchestrator update
                          const monthKey = transaction.date.substring(0, 7);
                          updateTransaction(transaction.id, { 
                            type: newType as ImportedTransaction['type'],
                            linkedTransactionId: undefined,
                            savingsTargetId: undefined,
                            correctedAmount: undefined
                          }, monthKey);
                        }}
                        className="w-full p-2 border border-input bg-background rounded-md text-sm"
                      >
                        {transaction.amount < 0 ? (
                          <>
                            <option value="Transaction">Transaktion</option>
                            <option value="InternalTransfer">Intern Överföring</option>
                          </>
                        ) : (
                          <>
                            <option value="Transaction">Transaktion</option>
                            <option value="InternalTransfer">Intern Överföring</option>
                            <option value="Savings">Sparande</option>
                            <option value="CostCoverage">Täck en kostnad</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Savings link status */}
                  {transaction.type === 'Savings' && transaction.savingsTargetId && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Kopplat till sparande</label>
                      <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-sm text-green-700 font-medium">
                          {(() => {
                            const targetId = transaction.savingsTargetId;
                            if (!targetId) return 'Okänt sparmål';
                            
                            const currentMonthData = budgetState?.historicalData?.[budgetState.selectedMonthKey];
                            const savingsGroups = currentMonthData?.savingsGroups || [];
                            const savingsGoals = budgetState?.savingsGoals || [];
                            
                            // Check if it's a savings subcategory (specific savings post)
                            for (const group of savingsGroups) {
                              const subcategory = (group.subCategories || []).find((sub: any) => sub.id === targetId);
                              if (subcategory) {
                                return `${subcategory.name} (från ${group.name})`;
                              }
                            }
                            
                            // Check if it's a savings goal
                            const goal = savingsGoals.find((g: any) => g.id === targetId);
                            if (goal) {
                              return `${goal.name} (Sparmål)`;
                            }
                            
                            return 'Okänt sparmål';
                          })()}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons based on transaction type */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Åtgärder</label>
                    <div className="mt-1 flex gap-2">
                      {transaction.type === 'InternalTransfer' && onTransferMatch && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onTransferMatch(transaction)}
                          className="text-xs px-2 py-1"
                        >
                          Matcha överföring
                        </Button>
                      )}
                      {transaction.type === 'Savings' && onSavingsLink && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSavingsLink(transaction)}
                          className="text-xs px-2 py-1"
                        >
                          {transaction.savingsTargetId ? 'Ändra sparande' : 'Koppla sparande'}
                        </Button>
                      )}
                      {transaction.type === 'CostCoverage' && onCostCoverage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onCostCoverage(transaction)}
                          className="text-xs px-2 py-1"
                        >
                          Täck kostnad
                        </Button>
                      )}
                    </div>
                  </div>

                   <div>
                     <label className="text-xs font-medium text-muted-foreground">Kategori</label>
                     <Select
                       value={(() => {
                         // Convert stored ID back to category name for display
                         if (transaction.appCategoryId) {
                           // Check if the stored value is already a name (for backwards compatibility)
                           if (mainCategories.includes(transaction.appCategoryId)) {
                             return transaction.appCategoryId;
                           }
                           // Convert ID to name using cost groups
                           const costGroup = costGroups.find(group => group.id === transaction.appCategoryId);
                           return costGroup ? costGroup.name : '';
                         }
                         return '';
                       })()}
                       onValueChange={(value) => onUpdateCategory(transaction.id, value)}
                     >
                       <SelectTrigger className="w-full">
                         <SelectValue placeholder="Välj kategori" />
                       </SelectTrigger>
                       <SelectContent className="bg-background border border-border shadow-lg z-50">
                         {mainCategories.map(category => (
                           <SelectItem key={category} value={category}>
                             {category}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>

                   {/* Subcategory selector - show for any category that has subcategories */}
                   {(() => {
                     const selectedCategoryName = (() => {
                       if (transaction.appCategoryId) {
                         if (mainCategories.includes(transaction.appCategoryId)) {
                           return transaction.appCategoryId;
                         }
                         const costGroup = costGroups.find(group => group.id === transaction.appCategoryId);
                         return costGroup ? costGroup.name : '';
                       }
                       return '';
                     })();

                     // Check if this category has subcategories in the storage
                     const availableSubcategories = subcategoriesData[selectedCategoryName] || [];

                     if (selectedCategoryName && availableSubcategories.length > 0) {
                       return (
                         <div>
                           <label className="text-xs font-medium text-muted-foreground">Underkategori</label>
                           <Select
                             value={(() => {
                               // For subcategories from storage, we need to find the subcategory name
                               // since storage uses names, not IDs for subcategories
                               if (transaction.appSubCategoryId) {
                                 // Check if it's already a name that exists in our subcategories
                                 if (availableSubcategories.includes(transaction.appSubCategoryId)) {
                                   return transaction.appSubCategoryId;
                                 }
                                 // For Transport subcategories with IDs, try to map ID to name
                                 if (selectedCategoryName === 'Transport') {
                                   const transportGroup = costGroups.find(group => group.name === 'Transport');
                                   const subcategory = transportGroup?.subCategories?.find(sub => sub.id === transaction.appSubCategoryId);
                                   return subcategory ? subcategory.name : '';
                                 }
                               }
                               return '';
                             })()}
                             onValueChange={(subCategoryName) => {
                               // For Transport, use the ID mapping from costGroups
                               if (selectedCategoryName === 'Transport') {
                                 const transportGroup = costGroups.find(group => group.name === 'Transport');
                                 const subcategory = transportGroup?.subCategories?.find(sub => sub.name === subCategoryName);
                                 if (subcategory) {
                                   onUpdateCategory(transaction.id, selectedCategoryName, subcategory.id);
                                 }
                               } else {
                                 // For other categories, use the subcategory name as ID
                                 onUpdateCategory(transaction.id, selectedCategoryName, subCategoryName);
                               }
                             }}
                           >
                             <SelectTrigger className="w-full">
                               <SelectValue placeholder="Välj underkategori" />
                             </SelectTrigger>
                             <SelectContent className="bg-background border border-border shadow-lg z-50">
                               {availableSubcategories.map(subcategory => (
                                 <SelectItem key={subcategory} value={subcategory}>
                                   {subcategory}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                       );
                     }
                     return null;
                   })()}

                   <div>
                     <label className="text-xs font-medium text-muted-foreground">Status</label>
                     <div className="flex items-center space-x-2">
                       <div className={`w-2 h-2 rounded-full ${getStatusColor(transaction.status)}`} />
                       <span className="text-sm">
                         {transaction.status === 'green' && 'Godkänd'}
                         {transaction.status === 'yellow' && 'Automatisk kategorisering'}
                         {transaction.status === 'red' && 'Behöver granskning'}
                       </span>
                     </div>
                   </div>

                   {/* Bank Status */}
                   {transaction.bankStatus && (
                     <div>
                       <label className="text-xs font-medium text-muted-foreground">Bankens status</label>
                       <p className="text-sm">{transaction.bankStatus}</p>
                     </div>
                   )}

                   {/* Reconciled */}
                   {transaction.reconciled && (
                     <div>
                       <label className="text-xs font-medium text-muted-foreground">Avstämt</label>
                       <p className="text-sm">{transaction.reconciled}</p>
                     </div>
                   )}
                </div>
              </div>

              {/* Show balance information */}
              {(transaction.balanceAfter !== undefined && !isNaN(transaction.balanceAfter)) || 
               (transaction.estimatedBalanceAfter !== undefined && !isNaN(transaction.estimatedBalanceAfter)) ? (
                <div className="pt-2 border-t space-y-2">
                  {/* CSV Balance - prioritized */}
                  {transaction.balanceAfter !== undefined && !isNaN(transaction.balanceAfter) && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Saldo efter transaktion</label>
                      <p className="text-sm font-medium">
                        {transaction.balanceAfter.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                      </p>
                    </div>
                  )}
                  
                  {/* Estimated Balance - only shown when CSV balance is missing */}
                  {(transaction.balanceAfter === undefined || isNaN(transaction.balanceAfter)) && 
                   transaction.estimatedBalanceAfter !== undefined && !isNaN(transaction.estimatedBalanceAfter) && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Estimerat saldo efter transaktion</label>
                      <p className="text-sm font-medium text-muted-foreground">
                        {transaction.estimatedBalanceAfter.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};