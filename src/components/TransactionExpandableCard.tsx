import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { ImportedTransaction } from '@/types/transaction';

interface TransactionExpandableCardProps {
  transaction: ImportedTransaction;
  account: { id: string; name: string; startBalance: number } | undefined;
  isSelected: boolean;
  mainCategories: string[];
  costGroups?: { id: string; name: string; subCategories?: { id: string; name: string }[] }[];
  onToggleSelection: (id: string) => void;
  onUpdateCategory: (id: string, category: string, subCategoryId?: string) => void;
  onUpdateNote: (id: string, note: string) => void;
}

export const TransactionExpandableCard: React.FC<TransactionExpandableCardProps> = ({
  transaction,
  account,
  isSelected,
  mainCategories,
  costGroups = [],
  onToggleSelection,
  onUpdateCategory,
  onUpdateNote
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);

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
                    <p className={`font-semibold text-sm ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.amount >= 0 ? '+' : ''}{Math.abs(transaction.amount).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                    </p>
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
                    <div>
                      <Badge variant={transaction.type === 'InternalTransfer' ? 'secondary' : 'outline'} className="text-xs">
                        {transaction.type === 'InternalTransfer' ? 'Intern överföring' : 'Transaktion'}
                      </Badge>
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

                   {/* Subcategory selector - only show for Transport */}
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

                     if (selectedCategoryName === 'Transport') {
                       const transportGroup = costGroups.find(group => group.name === 'Transport');
                       const subcategories = transportGroup?.subCategories || [];

                       return (
                         <div>
                           <label className="text-xs font-medium text-muted-foreground">Underkategori</label>
                           <Select
                             value={(() => {
                               // Convert stored subcategory ID back to name for display
                               if (transaction.appSubCategoryId) {
                                 const subcategory = subcategories.find(sub => sub.id === transaction.appSubCategoryId);
                                 return subcategory ? subcategory.name : '';
                               }
                               return '';
                             })()}
                             onValueChange={(subCategoryName) => {
                               // Find the subcategory ID from the name
                               const subcategory = subcategories.find(sub => sub.name === subCategoryName);
                               if (subcategory) {
                                 onUpdateCategory(transaction.id, selectedCategoryName, subcategory.id);
                               }
                             }}
                           >
                             <SelectTrigger className="w-full">
                               <SelectValue placeholder="Välj underkategori" />
                             </SelectTrigger>
                             <SelectContent className="bg-background border border-border shadow-lg z-50">
                               {subcategories.map(subcategory => (
                                 <SelectItem key={subcategory.id} value={subcategory.name}>
                                   {subcategory.name}
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
                </div>
              </div>

              {transaction.balanceAfter !== undefined && !isNaN(transaction.balanceAfter) && (
                <div className="pt-2 border-t">
                  <label className="text-xs font-medium text-muted-foreground">Saldo efter transaktion</label>
                  <p className="text-sm font-medium">
                    {transaction.balanceAfter.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};