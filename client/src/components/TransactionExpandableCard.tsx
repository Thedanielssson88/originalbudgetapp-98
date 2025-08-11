import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Edit3, Trash2 } from 'lucide-react';
import { ImportedTransaction } from '@/types/transaction';
import { StorageKey, get } from '@/services/storageService';
import { TransactionTypeSelector } from './TransactionTypeSelector';
import { useBudget } from '@/hooks/useBudget';
import { useTransactionExpansion } from '@/hooks/useTransactionExpansion';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { useHuvudkategorier, useUnderkategorier, useCategoryNames } from '@/hooks/useCategories';
import { useBudgetPosts } from '@/hooks/useBudgetPosts';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { addMobileDebugLog } from '@/utils/mobileDebugLogger';
import { useCategoryRules } from '@/hooks/useCategoryRules';
import { CreateRuleDialog } from './CreateRuleDialog';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useInkomstkallor } from '@/hooks/useInkomstkallor';

interface TransactionExpandableCardProps {
  transaction: ImportedTransaction;
  account: { id: string; name: string; startBalance: number } | undefined;
  isSelected: boolean;
  mainCategories: string[];
  costGroups?: { id: string; name: string; subCategories?: { id: string; name: string }[] }[];
  accounts: { id: string; name: string }[]; // Add accounts list for rule creation
  onToggleSelection: (id: string) => void;
  onUpdateCategory: (id: string, category: string, subCategoryId?: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onUpdateStatus?: (id: string, status: 'green' | 'yellow' | 'red') => void;
  onTransferMatch?: (transaction: ImportedTransaction) => void;
  onSavingsLink?: (transaction: ImportedTransaction) => void;
  onCostCoverage?: (transaction: ImportedTransaction) => void;
  onExpenseClaim?: (transaction: ImportedTransaction) => void;
  onRefresh?: () => void; // Add refresh callback
}

export const TransactionExpandableCard: React.FC<TransactionExpandableCardProps> = React.memo(({
  transaction: propTransaction,
  account,
  isSelected,
  mainCategories,
  costGroups = [],
  accounts,
  onToggleSelection,
  onUpdateCategory,
  onUpdateNote,
  onUpdateStatus,
  onTransferMatch,
  onSavingsLink,
  onCostCoverage,
  onExpenseClaim,
  onRefresh
}) => {
  // LOCAL STATE for immediate updates
  const [transaction, setTransaction] = useState(propTransaction);
  
  // Update local state when prop changes
  useEffect(() => {
    setTransaction(propTransaction);
  }, [propTransaction]);
  
  // Use UUID-based category hooks
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: allUnderkategorier = [] } = useUnderkategorier();
  const categoryNames = useCategoryNames();
  // Force fetch ALL budget posts for linked transaction lookups (pass undefined to get all)
  const { data: budgetPostsFromAPI = [], refetch: refetchBudgetPosts } = useBudgetPosts(undefined);
  // Fetch category rules
  const { data: categoryRules = [] } = useCategoryRules();
  // Hook for unlinking transactions
  const updateTransactionMutation = useUpdateTransaction();
  
  // Debug the budget posts data
  useEffect(() => {
    console.log('🔍 [TransactionExpandableCard] All Budget Posts from hook:', {
      count: budgetPostsFromAPI.length,
      targetId: '9252e444-4868-4b5e-a309-e0fbd711fe16',
      hasTargetId: budgetPostsFromAPI.some(p => p.id === '9252e444-4868-4b5e-a309-e0fbd711fe16'),
      allIds: budgetPostsFromAPI.map(p => p.id),
      sparmålPosts: budgetPostsFromAPI.filter(p => p.type === 'sparmål').map(p => ({ id: p.id, description: p.description }))
    });
    
    // Special debug for LÖN transactions - Check if the fix worked
    if (transaction.description === 'LÖN' && (transaction.id === 'efe00305-a8c4-4906-a493-28ebea93af0e' || transaction.id === 'edece0e6-59d1-4967-a90b-28ef3c4bfc2f')) {
      const foundPost = budgetPostsFromAPI.find(p => p.id === transaction.savingsTargetId);
      console.log('🚨 [DEBUG LÖN TRANSACTION - POST FIX] Transaction with savingsTargetId:', {
        transactionId: transaction.id,
        savingsTargetId: transaction.savingsTargetId,
        transaction_savingsTargetId: (transaction as any).savings_target_id,
        hasProperty: 'savingsTargetId' in transaction,
        transactionKeys: Object.keys(transaction),
        budgetPostsCount: budgetPostsFromAPI.length,
        foundPost,
        expectedTargetId: '9252e444-4868-4b5e-a309-e0fbd711fe16',
        fixWorked: transaction.savingsTargetId === '9252e444-4868-4b5e-a309-e0fbd711fe16'
      });
      
      // If we have a savingsTargetId but can't find the post, force refresh
      if (transaction.savingsTargetId && !foundPost) {
        console.log('🔄 [DEBUG] Forcing budget posts refetch for missing linked post');
        refetchBudgetPosts();
      }
    }
  }, [budgetPostsFromAPI, transaction]);
  
  const { isExpanded, setIsExpanded } = useTransactionExpansion(transaction.id);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [localNoteValue, setLocalNoteValue] = useState(transaction.userDescription || '');
  const [subcategoriesData, setSubcategoriesData] = useState<Record<string, string[]>>({});
  const [isCreateRuleDialogOpen, setIsCreateRuleDialogOpen] = useState(false);
  const { budgetState } = useBudget();
  const { data: familyMembers = [] } = useFamilyMembers();
  const { data: inkomstkallor = [] } = useInkomstkallor();

  // Function to find applicable rules for this transaction
  const findApplicableRules = (transaction: ImportedTransaction) => {
    return categoryRules.filter(rule => {
      // Skip inactive rules - handle both string and boolean types
      const isActive = rule.isActive === 'true' || rule.isActive === true;
      if (!isActive) {
        return false;
      }

      // Check account restrictions
      if (rule.applicableAccountIds && rule.applicableAccountIds !== '[]') {
        try {
          const accountIds = JSON.parse(rule.applicableAccountIds);
          if (accountIds.length > 0 && !accountIds.includes(transaction.accountId)) {
            return false;
          }
        } catch (e) {
          // If parsing fails, assume no restrictions
        }
      }

      // Check transaction direction
      if (rule.transactionDirection === 'positive' && transaction.amount < 0) {
        return false;
      }
      if (rule.transactionDirection === 'negative' && transaction.amount >= 0) {
        return false;
      }

      // Check rule type and matching logic
      const ruleType = rule.ruleType || 'textContains';
      const transactionText = transaction.description?.toLowerCase() || '';
      const ruleText = rule.transactionName?.toLowerCase() || '';

      // Handle wildcard (*) - matches all transactions
      if (ruleText === '*') {
        return true;
      }

      // Bank category matching
      if (ruleType === 'categoryMatch') {
        if (rule.bankhuvudkategori && rule.bankunderkategori) {
          return transaction.bankCategory === rule.bankhuvudkategori && 
                 transaction.bankSubCategory === rule.bankunderkategori;
        } else if (rule.bankhuvudkategori) {
          return transaction.bankCategory === rule.bankhuvudkategori;
        }
        return false;
      }

      // Text-based matching
      switch (ruleType) {
        case 'exactText':
          return transactionText === ruleText;
        case 'textStartsWith':
          return transactionText.startsWith(ruleText);
        case 'textContains':
        default:
          return transactionText.includes(ruleText);
      }
    });
  };

  // Get applicable rules for this transaction
  const applicableRules = findApplicableRules(transaction);
  
  // Debug logging
  useEffect(() => {
    console.log('🔍 [TransactionExpandableCard] Category rules debug:', {
      totalRules: categoryRules.length,
      applicableRules: applicableRules.length,
      transaction: {
        id: transaction.id,
        description: transaction.description,
        accountId: transaction.accountId,
        amount: transaction.amount,
        bankCategory: transaction.bankCategory,
        bankSubCategory: transaction.bankSubCategory
      },
      allRules: categoryRules.map(r => ({
        id: r.id,
        ruleName: r.ruleName,
        isActive: r.isActive,
        transactionName: r.transactionName,
        ruleType: r.ruleType
      }))
    });
  }, [categoryRules, applicableRules, transaction]);

  // Get available bank categories from all transactions in budgetState
  const availableBankCategories = useMemo(() => {
    const categories = new Set<string>();
    const allTransactions = budgetState?.allTransactions || [];
    allTransactions.forEach(tx => {
      if (tx.bankCategory && tx.bankCategory.trim() && tx.bankCategory !== '-') {
        categories.add(tx.bankCategory);
      }
    });
    return Array.from(categories).sort();
  }, [budgetState?.allTransactions]);

  const availableBankSubCategories = useMemo(() => {
    const subCategories = new Set<string>();
    const allTransactions = budgetState?.allTransactions || [];
    allTransactions.forEach(tx => {
      if (tx.bankSubCategory && tx.bankSubCategory.trim() && tx.bankSubCategory !== '-') {
        subCategories.add(tx.bankSubCategory);
      }
    });
    return Array.from(subCategories).sort();
  }, [budgetState?.allTransactions]);

  // Update local note value when transaction changes but preserve editing state
  useEffect(() => {
    if (!isEditingNote) {
      setLocalNoteValue(transaction.userDescription || '');
    }
  }, [transaction.userDescription, isEditingNote]);

  // TODO: Load subcategories from API instead of localStorage
  useEffect(() => {
    const loadedSubcategories: Record<string, string[]> = {};
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

  // Function to unlink internal transfer transactions
  const handleUnlinkInternalTransfer = async () => {
    if (!transaction.linkedTransactionId) {
      addMobileDebugLog('❌ [UNLINK ERROR] No linked transaction to unlink');
      return;
    }

    addMobileDebugLog('🗑️ [UNLINK START] Unlinking internal transfer transactions');
    addMobileDebugLog(`🗑️ [UNLINK] Transaction 1: ${transaction.id}`);
    addMobileDebugLog(`🗑️ [UNLINK] Transaction 2: ${transaction.linkedTransactionId}`);

    try {
      // Find the linked transaction to determine its status after unlinking
      let allTransactions = budgetState?.allTransactions || [];
      if (allTransactions.length === 0) {
        allTransactions = Object.values(budgetState?.historicalData || {}).flatMap(month => 
          (month as any)?.transactions || []
        );
      }
      const linkedTransaction = allTransactions.find((t: any) => t.id === transaction.linkedTransactionId);
      
      // Calculate status for both transactions based on categorization
      const calculateUnlinkedStatus = (tx: any) => {
        if (tx.appCategoryId && tx.subCategoryId) {
          return 'green'; // Both main and sub category
        } else if (tx.appCategoryId) {
          return 'yellow'; // Only main category
        } else {
          return 'red'; // No categorization
        }
      };

      const transaction1Status = calculateUnlinkedStatus(transaction);
      const transaction2Status = linkedTransaction ? calculateUnlinkedStatus(linkedTransaction) : 'red';

      addMobileDebugLog(`🔄 [UNLINK STATUS] Transaction 1 new status: ${transaction1Status}`);
      addMobileDebugLog(`🔄 [UNLINK STATUS] Transaction 2 new status: ${transaction2Status}`);

      // Update both transactions to remove links and reset type to 'Transaction'
      addMobileDebugLog('📡 [UNLINK API] Preparing API calls to unlink transactions');
      addMobileDebugLog(`📡 [UNLINK API 1] PATCH /api/transactions/${transaction.id}`);
      addMobileDebugLog(`📡 [UNLINK DATA 1] ${JSON.stringify({
        type: 'Transaction',
        linkedTransactionId: null,
        userDescription: null,
        status: transaction1Status,
        isManuallyChanged: 'true'
      }, null, 2)}`);
      addMobileDebugLog(`📡 [UNLINK API 2] PATCH /api/transactions/${transaction.linkedTransactionId}`);
      addMobileDebugLog(`📡 [UNLINK DATA 2] ${JSON.stringify({
        type: 'Transaction', 
        linkedTransactionId: null,
        userDescription: null,
        status: transaction2Status,
        isManuallyChanged: 'true'
      }, null, 2)}`);

      // Try removing null values entirely instead of sending them
      const transaction1Data: any = {
        type: 'Transaction',
        status: transaction1Status,
        isManuallyChanged: 'true'
      };
      
      const transaction2Data: any = {
        type: 'Transaction', 
        status: transaction2Status,
        isManuallyChanged: 'true'
      };

      // Set linkedTransactionId to null to unlink, and userDescription to empty string (not null due to notNull constraint)
      transaction1Data.linkedTransactionId = null;
      transaction1Data.userDescription = ''; // Must be empty string, not null due to schema constraint
      
      transaction2Data.linkedTransactionId = null; 
      transaction2Data.userDescription = ''; // Must be empty string, not null due to schema constraint

      addMobileDebugLog(`📡 [UNLINK FINAL DATA 1] ${JSON.stringify(transaction1Data, null, 2)}`);
      addMobileDebugLog(`📡 [UNLINK FINAL DATA 2] ${JSON.stringify(transaction2Data, null, 2)}`);

      const apiResults = await Promise.all([
        updateTransactionMutation.mutateAsync({
          id: transaction.id,
          data: transaction1Data
        }),
        updateTransactionMutation.mutateAsync({
          id: transaction.linkedTransactionId,
          data: transaction2Data
        })
      ]);

      addMobileDebugLog('✅ [UNLINK API RESULTS] Both API calls completed');
      addMobileDebugLog(`✅ [UNLINK API RESULT 1] ${JSON.stringify(apiResults[0], null, 2)}`);
      addMobileDebugLog(`✅ [UNLINK API RESULT 2] ${JSON.stringify(apiResults[1], null, 2)}`);

      addMobileDebugLog('✅ [UNLINK SUCCESS] Both transactions unlinked successfully');

      // Trigger refresh to update the UI
      if (onRefresh) {
        addMobileDebugLog('🔄 [UNLINK REFRESH] Calling onRefresh to update UI...');
        await onRefresh();
        addMobileDebugLog('✅ [UNLINK REFRESH] onRefresh completed');
      }

    } catch (error) {
      addMobileDebugLog('❌ [UNLINK ERROR] Failed to unlink transactions');
      addMobileDebugLog(`❌ [UNLINK ERROR DETAILS] ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
    }
  };

  // Function to unlink expense claim/cost coverage transactions
  const handleUnlinkExpenseClaim = async () => {
    if (!transaction.linkedTransactionId) {
      addMobileDebugLog('❌ [UNLINK EXPENSE ERROR] No linked transaction to unlink');
      return;
    }

    addMobileDebugLog('🗑️ [UNLINK EXPENSE START] Unlinking expense claim/cost coverage');
    addMobileDebugLog(`🗑️ [UNLINK EXPENSE] Transaction 1: ${transaction.id}`);
    addMobileDebugLog(`🗑️ [UNLINK EXPENSE] Transaction 2: ${transaction.linkedTransactionId}`);

    try {
      // Find the linked transaction to determine its status after unlinking
      let allTransactions = budgetState?.allTransactions || [];
      if (allTransactions.length === 0) {
        allTransactions = Object.values(budgetState?.historicalData || {}).flatMap(month => 
          (month as any)?.transactions || []
        );
      }
      const linkedTransaction = allTransactions.find((t: any) => t.id === transaction.linkedTransactionId);
      
      // Calculate status for both transactions based on categorization
      const calculateUnlinkedStatus = (tx: any) => {
        if (tx.appCategoryId && tx.subCategoryId) {
          return 'green';
        } else if (tx.appCategoryId) {
          return 'yellow';
        } else {
          return 'red';
        }
      };

      const transaction1Status = calculateUnlinkedStatus(transaction);
      const transaction2Status = linkedTransaction ? calculateUnlinkedStatus(linkedTransaction) : 'red';

      // Update both transactions - remove link and restore correctedAmount to null
      addMobileDebugLog('📡 [UNLINK EXPENSE API] Starting API calls for both transactions');
      
      try {
        const result1 = await updateTransactionMutation.mutateAsync({
          id: transaction.id,
          data: {
            type: 'Transaction',
            linkedTransactionId: null,
            correctedAmount: null, // Restore original amount
            userDescription: '',
            status: transaction1Status,
            isManuallyChanged: 'true'
          }
        });
        
        addMobileDebugLog(`✅ [UNLINK EXPENSE API 1] Successfully updated transaction 1: ${transaction.id}`);
        addMobileDebugLog(`✅ [UNLINK EXPENSE RESULT 1] ${JSON.stringify(result1, null, 2)}`);
        
        const result2 = await updateTransactionMutation.mutateAsync({
          id: transaction.linkedTransactionId,
          data: {
            type: 'Transaction', 
            linkedTransactionId: null,
            userDescription: '',
            status: transaction2Status,
            isManuallyChanged: 'true'
          }
        });
        
        addMobileDebugLog(`✅ [UNLINK EXPENSE API 2] Successfully updated transaction 2: ${transaction.linkedTransactionId}`);
        addMobileDebugLog(`✅ [UNLINK EXPENSE RESULT 2] ${JSON.stringify(result2, null, 2)}`);
        
      } catch (apiError) {
        // If sequential approach fails, try to at least unlink the current transaction
        addMobileDebugLog(`❌ [UNLINK EXPENSE API ERROR] Failed during sequential updates: ${apiError}`);
        throw apiError;
      }

      addMobileDebugLog('✅ [UNLINK EXPENSE SUCCESS] Both transactions unlinked successfully');

      // Trigger refresh to update the UI
      if (onRefresh) {
        addMobileDebugLog('🔄 [UNLINK EXPENSE REFRESH] Calling onRefresh to update UI...');
        await onRefresh();
        addMobileDebugLog('✅ [UNLINK EXPENSE REFRESH] onRefresh completed');
      }

    } catch (error) {
      addMobileDebugLog('❌ [UNLINK EXPENSE ERROR] Failed to unlink transactions');
      addMobileDebugLog(`❌ [UNLINK EXPENSE ERROR DETAILS] ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
    }
  };

  // Function to unlink savings transactions
  const handleUnlinkSavings = async () => {
    if (!transaction.savingsTargetId) {
      addMobileDebugLog('❌ [UNLINK SAVINGS ERROR] No savings target to unlink');
      return;
    }

    addMobileDebugLog('🗑️ [UNLINK SAVINGS START] Unlinking savings target');
    addMobileDebugLog(`🗑️ [UNLINK SAVINGS] Transaction: ${transaction.id}`);
    addMobileDebugLog(`🗑️ [UNLINK SAVINGS] Savings Target: ${transaction.savingsTargetId}`);

    try {
      // Calculate status based on categorization
      const calculateUnlinkedStatus = (tx: any) => {
        if (tx.appCategoryId && tx.subCategoryId) {
          return 'green';
        } else if (tx.appCategoryId) {
          return 'yellow';
        } else {
          return 'red';
        }
      };

      const newStatus = calculateUnlinkedStatus(transaction);

      // Update transaction - remove savings link and reset type
      await updateTransactionMutation.mutateAsync({
        id: transaction.id,
        data: {
          type: 'Transaction',
          savingsTargetId: null,
          userDescription: '',
          status: newStatus,
          isManuallyChanged: 'true'
        }
      });

      addMobileDebugLog('✅ [UNLINK SAVINGS SUCCESS] Savings target unlinked successfully');

      // Trigger refresh to update the UI
      if (onRefresh) {
        addMobileDebugLog('🔄 [UNLINK SAVINGS REFRESH] Calling onRefresh to update UI...');
        await onRefresh();
        addMobileDebugLog('✅ [UNLINK SAVINGS REFRESH] onRefresh completed');
      }

    } catch (error) {
      addMobileDebugLog('❌ [UNLINK SAVINGS ERROR] Failed to unlink savings');
      addMobileDebugLog(`❌ [UNLINK SAVINGS ERROR DETAILS] ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
    }
  };

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

                {/* Main content - 8 columns for the new layout: Account, Bank Category, Bank Subcategory, Description, App Main Category, App Subcategory, Amount, Actions */}
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
                  {/* Account */}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Konto</p>
                    <p className="font-medium text-sm truncate">{account?.name || transaction.accountId}</p>
                  </div>
                  
                  {/* Bank Category (Raw from file) */}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Bankkategori</p>
                    <p className="text-sm truncate bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded text-blue-800 dark:text-blue-200" title={transaction.bankCategory || 'Tom från banken'}>
                      {transaction.bankCategory || 'Tom från banken'}
                    </p>
                  </div>
                  
                  {/* Bank Subcategory (Raw from file) */}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Bankunderkategori</p>
                    <p className="text-sm truncate bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded text-blue-800 dark:text-blue-200" title={transaction.bankSubCategory || 'Tom från banken'}>
                      {transaction.bankSubCategory || 'Tom från banken'}
                    </p>
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
                  
                  {/* App Main Category with dropdown */}
                  <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs text-muted-foreground">Huvudkategori (App)</p>
                    <Select
                      value={transaction.appCategoryId || ''}
                      onValueChange={(value) => {
                        try {
                          console.log(`🔄 [TransactionCard] Huvudkategori changed for ${transaction.id}: ${value}`);
                          // IMMEDIATE LOCAL UPDATE
                          setTransaction(prev => ({
                            ...prev,
                            appCategoryId: value,
                            appSubCategoryId: undefined // Reset subcategory when main changes
                          }));
                          // Then notify parent
                          console.log(`🔄 [TransactionCard] Calling onUpdateCategory for ${transaction.id}`);
                          onUpdateCategory(transaction.id, value);
                        } catch (error) {
                          console.error('Error updating main category:', error);
                          console.error('Error details:', { error, stack: error?.stack });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full h-8 text-sm">
                        <SelectValue placeholder="Välj kategori" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border shadow-lg z-50">
                        {huvudkategorier.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* App Subcategory with dropdown */}
                  <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs text-muted-foreground">Underkategori (App)</p>
                    {(() => {
                      const selectedCategoryId = transaction.appCategoryId;

                      // Get subcategories for the selected hoofdkategori (UUID-based)
                      const availableSubcategories = allUnderkategorier.filter(
                        sub => sub.huvudkategoriId === selectedCategoryId
                      );

                      if (selectedCategoryId && availableSubcategories.length > 0) {
                        return (
                          <Select
                            value={transaction.appSubCategoryId || ''}
                            onValueChange={(subCategoryId) => {
                              try {
                                // IMMEDIATE LOCAL UPDATE
                                setTransaction(prev => ({
                                  ...prev,
                                  appSubCategoryId: subCategoryId
                                }));
                                // Then notify parent
                                onUpdateCategory(transaction.id, selectedCategoryId, subCategoryId);
                              } catch (error) {
                                console.error('Error updating subcategory:', error);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full h-8 text-sm">
                              <SelectValue placeholder="Välj underkategori" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border border-border shadow-lg z-50">
                              {availableSubcategories.map(subcategory => (
                                <SelectItem key={subcategory.id} value={subcategory.id}>
                                  {subcategory.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      } else {
                        return (
                          <div className="h-8 flex items-center text-xs text-muted-foreground bg-muted/30 px-2 rounded">
                            {selectedCategoryId ? 'Inga underkategorier' : 'Välj huvudkategori först'}
                          </div>
                        );
                      }
                    })()}
                  </div>

                  {/* Transaction Type (text only) */}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Transaktionstyp</p>
                    <p className="text-sm truncate">
                      {transaction.savingsTargetId && 'Länkad Transaktion'}
                      {!transaction.savingsTargetId && transaction.type === 'Transaction' && 'Transaktion'}
                      {!transaction.savingsTargetId && transaction.type === 'InternalTransfer' && 'Intern överföring'}
                      {!transaction.savingsTargetId && transaction.type === 'Savings' && 'Sparande'}
                      {!transaction.savingsTargetId && transaction.type === 'CostCoverage' && 'Kostnadstäckning'}
                      {!transaction.savingsTargetId && transaction.type === 'ExpenseClaim' && 'Utlägg'}
                    </p>
                  </div>

                  {/* Amount from Database (amount / 100) */}
                  <div className="min-w-0">
                    {/* For ExpenseClaim/CostCoverage with linked transactions, show both original (crossed) and corrected amount */}
                    {(transaction.type === 'ExpenseClaim' || transaction.type === 'CostCoverage') && transaction.linkedTransactionId ? (
                      <>
                        <p className="text-xs text-muted-foreground">Belopp</p>
                        <p className={`font-semibold text-sm line-through opacity-60 ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.amount >= 0 ? '+' : ''}{(transaction.amount / 100).toFixed(2)} kr
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Korrigerat Belopp</p>
                        <p className={`font-semibold text-sm ${(transaction.correctedAmount !== null ? transaction.correctedAmount : transaction.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(transaction.correctedAmount !== null ? transaction.correctedAmount : transaction.amount) >= 0 ? '+' : ''}{((transaction.correctedAmount !== null ? transaction.correctedAmount : transaction.amount) / 100).toFixed(2)} kr
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">Belopp</p>
                        <p className={`font-semibold text-sm ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.amount >= 0 ? '+' : ''}{(transaction.amount / 100).toFixed(2)} kr
                        </p>
                      </>
                    )}
                  </div>
                   
                   {/* Actions - Quick Access Buttons */}
                   <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                     <p className="text-xs text-muted-foreground">Åtgärder</p>
                     <div className="flex gap-1">
                       {transaction.amount < 0 && transaction.type !== 'InternalTransfer' && (
                         <Button 
                           variant="outline" 
                           size="sm" 
                           className="h-6 px-2 text-xs"
                           onClick={() => onTransferMatch?.(transaction)}
                           title="Matcha överföring"
                         >
                           Ö
                         </Button>
                       )}
                       {transaction.amount > 0 && (
                         <Button 
                           variant="outline" 
                           size="sm" 
                           className="h-6 px-2 text-xs"
                           onClick={() => onSavingsLink?.(transaction)}
                           title="Länka sparande"
                         >
                           S
                         </Button>
                       )}
                     </div>
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
            <div className="border-t pt-4">
              {/* Expanded view fields as requested */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Date */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <p className="text-sm">{transaction.date}</p>
                </div>

                {/* Egen text */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Egen text</label>
                  <div className="flex items-center space-x-2">
                    {isEditingNote ? (
                      <Input
                        value={localNoteValue}
                        onChange={(e) => setLocalNoteValue(e.target.value)}
                        onBlur={() => {
                          onUpdateNote(transaction.id, localNoteValue);
                          setIsEditingNote(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdateNote(transaction.id, localNoteValue);
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
                          onClick={() => {
                            setLocalNoteValue(transaction.userDescription || '');
                            setIsEditingNote(true);
                          }}
                          className="p-1 h-auto"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Typ (Transaktionstyp) */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Typ (Transaktionstyp)</label>
                  <div className="mt-1">
                    <TransactionTypeSelector 
                      transaction={transaction} 
                      onRefresh={onRefresh}
                      onTypeChange={(newType) => {
                        // IMMEDIATE LOCAL UPDATE
                        setTransaction(prev => ({
                          ...prev,
                          type: newType
                        }));
                      }}
                    />
                  </div>
                </div>

                {/* Åtgärder */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Åtgärder</label>
                  <div className="mt-1 flex gap-2 flex-wrap">
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
                    {transaction.type === 'ExpenseClaim' && onExpenseClaim && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onExpenseClaim(transaction)}
                        className="text-xs px-2 py-1"
                      >
                        Koppla utlägg
                      </Button>
                    )}
                    {(!transaction.type || transaction.type === 'Transaction') && (
                      <span className="text-sm text-muted-foreground italic">Inga åtgärder tillgängliga</span>
                    )}
                  </div>
                </div>

                {/* Bankkategori */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Bankkategori</label>
                  <div className="space-y-1">
                    {transaction.bankCategory && transaction.bankCategory !== '-' && transaction.bankCategory.trim() !== '' ? (
                      <p className="text-sm">{transaction.bankCategory}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">-</p>
                    )}
                  </div>
                </div>

                {/* Bank Underkategori */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Bank Underkategori</label>
                  <div className="space-y-1">
                    {transaction.bankSubCategory && transaction.bankSubCategory !== '-' && transaction.bankSubCategory.trim() !== '' ? (
                      <p className="text-sm text-muted-foreground">{transaction.bankSubCategory}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">-</p>
                    )}
                  </div>
                </div>

                {/* Huvudkategori */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Huvudkategori</label>
                  <div className="w-full p-2 bg-muted/50 rounded text-sm">
                    {transaction.appCategoryId 
                      ? (categoryNames.getHuvudkategoriName(transaction.appCategoryId) || transaction.appCategoryId)
                      : 'Ingen kategori vald'
                    }
                  </div>
                </div>

                {/* Underkategori */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Underkategori</label>
                  <div className="w-full p-2 bg-muted/50 rounded text-sm">
                    {transaction.appSubCategoryId 
                      ? (categoryNames.getUnderkategoriName(transaction.appSubCategoryId) || transaction.appSubCategoryId)
                      : 'Ingen underkategori vald'
                    }
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        console.log(`🔴 [TransactionExpandableCard] Status button clicked for transaction ${transaction.id}, current status: ${transaction.status}`);
                        if (onUpdateStatus) {
                          const newStatus = transaction.status === 'green' ? 'red' : 
                                          transaction.status === 'red' ? 'yellow' : 'green';
                          console.log(`🔴 [TransactionExpandableCard] Calling onUpdateStatus with newStatus: ${newStatus}`);
                          onUpdateStatus(transaction.id, newStatus);
                          console.log(`🔴 [TransactionExpandableCard] onUpdateStatus called, current transaction status still: ${transaction.status}`);
                        }
                      }}
                      className="p-1 h-auto hover:bg-muted"
                    >
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(transaction.status)}`} />
                    </Button>
                    <span className="text-sm">
                      {transaction.status === 'green' && 'Godkänd'}
                      {transaction.status === 'yellow' && 'Automatisk kategorisering'}
                      {transaction.status === 'red' && 'Behöver granskning'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Applicable Rules Section */}
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Automatiska regler som kan appliceras</label>
                  <div className="mt-2 space-y-2">
                    {applicableRules.length > 0 ? (
                      applicableRules.map(rule => {
                        const huvudkategoriName = categoryNames.getHuvudkategoriName(rule.huvudkategoriId || '') || 'Okänd kategori';
                        const underkategoriName = categoryNames.getUnderkategoriName(rule.underkategoriId || '') || 'Okänd underkategori';
                        const rawTransactionType = transaction.amount >= 0 
                          ? (rule.positiveTransactionType || 'Transaction')
                          : (rule.negativeTransactionType || 'Transaction');
                        // Display 'Inkomst' in UI when value is 'Income'
                        const transactionType = rawTransactionType === 'Income' ? 'Inkomst' : rawTransactionType;
                        
                        return (
                          <div key={rule.id} className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-blue-800">
                                {rule.ruleName}
                              </p>
                              <div className="text-xs text-blue-600 space-y-0.5">
                                <p>• Huvudkategori: {huvudkategoriName}</p>
                                <p>• Underkategori: {underkategoriName}</p>
                                <p>• Transaktionstyp: {transactionType}</p>
                                {rule.autoApproval && (
                                  <p>• Status: Godkänn automatiskt</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <p className="text-sm text-gray-600">
                          Ingen regel är skapad för att appliceras till den här transaktionen
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setIsCreateRuleDialogOpen(true)}
                        >
                          Skapa regel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Linked transaction and savings information */}
              {(transaction.linkedTransactionId || transaction.savingsTargetId || transaction.type === 'InternalTransfer' || transaction.type === 'Savings' || transaction.type === 'Sparande') && (
                <div className="mt-4 space-y-3">
                  {/* Linked transaction information */}
                  {(transaction.linkedTransactionId || transaction.type === 'InternalTransfer') && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        {transaction.type === 'CostCoverage' ? 'Täcker kostnad' : 
                         transaction.type === 'ExpenseClaim' ? 'Utlägg täcks av' : 'Länkad transaktion'}
                      </label>
                      <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-md">
                        {(() => {
                          // First check centralized allTransactions array, then fallback to historical data
                          let allTransactions = budgetState?.allTransactions || [];
                          if (allTransactions.length === 0) {
                            // Fallback to historical data if centralized array is empty
                            allTransactions = Object.values(budgetState?.historicalData || {}).flatMap(month => 
                              (month as any)?.transactions || []
                            );
                          }
                          const linkedTransaction = allTransactions.find((t: any) => t.id === transaction.linkedTransactionId);
                          
                          // Handle internal transfers without linked transactions
                          if (transaction.type === 'InternalTransfer' && !transaction.linkedTransactionId) {
                            return (
                              <p className="text-sm text-orange-700">
                                Ingen länkad transaktion
                              </p>
                            );
                          }
                          
                          if (!linkedTransaction) {
                            return (
                              <p className="text-sm text-blue-700">
                                Länkad transaktion hittades inte
                              </p>
                            );
                          }

                          const account = budgetState?.accounts?.find(acc => acc.id === linkedTransaction.accountId);
                          
                          if (transaction.type === 'CostCoverage') {
                            const coveredAmount = transaction.amount - (transaction.correctedAmount || 0);
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-blue-700 font-medium">
                                    Täcker {formatOrenAsCurrency(Math.abs(coveredAmount))} av kostnad:
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnlinkExpenseClaim();
                                    }}
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Ta bort länk"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="text-sm text-blue-600">
                                  {linkedTransaction.date}: {linkedTransaction.description}
                                </p>
                                <p className="text-xs text-blue-500">
                                  Konto: {account?.name || linkedTransaction.accountId}
                                </p>
                              </div>
                            );
                          } else if (transaction.type === 'ExpenseClaim') {
                            const claimedAmount = Math.abs(transaction.amount);
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-blue-700 font-medium">
                                    Utlägg på {formatOrenAsCurrency(claimedAmount)} täcks av:
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnlinkExpenseClaim();
                                    }}
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Ta bort länk"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="text-sm text-blue-600">
                                  {linkedTransaction.date}: {linkedTransaction.description}
                                </p>
                                <p className="text-xs text-blue-500">
                                  Konto: {account?.name || linkedTransaction.accountId}
                                </p>
                              </div>
                            );
                          } else if (transaction.type === 'InternalTransfer') {
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-blue-700 font-medium">
                                    Länkad transaktion:
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnlinkInternalTransfer();
                                    }}
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    title="Ta bort länk"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <p className="text-sm text-blue-600">
                                  {linkedTransaction.date}: {linkedTransaction.description}
                                </p>
                                <p className="text-xs text-blue-500">
                                  Konto: {account?.name || linkedTransaction.accountId}
                                </p>
                              </div>
                            );
                          } else {
                            const coveredAmount = Math.abs(transaction.amount) - Math.abs(transaction.correctedAmount || transaction.amount);
                            return (
                              <div className="space-y-1">
                                <p className="text-sm text-blue-700 font-medium">
                                  {coveredAmount > 0 ? `${coveredAmount.toLocaleString('sv-SE')} kr täcks av:` : 'Täcks av:'}
                                </p>
                                <p className="text-sm text-blue-600">
                                  {linkedTransaction.date}: {linkedTransaction.description}
                                </p>
                                <p className="text-xs text-blue-500">
                                  Konto: {account?.name || linkedTransaction.accountId}
                                </p>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Linked savings information - DEBUG */}
                  {(() => {
                    if (transaction.type === 'Sparande' || transaction.type === 'Savings') {
                      const debugInfo = {
                        id: transaction.id,
                        type: transaction.type,
                        description: transaction.description,
                        savingsTargetId: transaction.savingsTargetId,
                        linked_saving: transaction.linked_saving,
                        amount: transaction.amount,
                        hasAnySavingsId: !!(transaction.savingsTargetId || transaction.linked_saving),
                        conditionMet: !!(transaction.savingsTargetId || transaction.linked_saving) && (transaction.type === 'Savings' || transaction.type === 'Sparande' || transaction.type === 'Transaction')
                      };
                      console.log('🔍 [SPARANDE DEBUG] Transaction details:', debugInfo);
                      addMobileDebugLog(`🔍 [SPARANDE DEBUG] ${transaction.description}: type=${debugInfo.type}, savingsTargetId=${debugInfo.savingsTargetId}, hasLink=${debugInfo.hasAnySavingsId}, showSection=${debugInfo.conditionMet}`);
                    }
                    return null;
                  })()}

                  {/* Linked savings information - Only for Savings/Sparande type with savingsTargetId */}
                  {transaction.savingsTargetId && (transaction.type === 'Savings' || transaction.type === 'Sparande') && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground">
                          Länkad transaktion
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnlinkSavings();
                          }}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Ta bort länk"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-md">
                        {(() => {
                          // Look up the budget_post by ID using the same pattern as internal transfers
                          const linkedBudgetPost = budgetPostsFromAPI.find(post => post.id === transaction.savingsTargetId);
                          
                          if (!linkedBudgetPost) {
                            return (
                              <p className="text-sm text-blue-700">
                                Länkad transaktion hittades inte
                              </p>
                            );
                          }

                          // Get the account name
                          const account = budgetState?.accounts?.find(acc => acc.id === linkedBudgetPost.accountId);
                          
                          // Display the budget post information using the same format as internal transfers
                          return (
                            <div className="space-y-1">
                              <p className="text-sm text-blue-600">
                                {linkedBudgetPost.description}
                              </p>
                              <p className="text-xs text-blue-500">
                                Typ: {linkedBudgetPost.type === 'sparmål' ? 'Sparmål' : 'Sparpost'} • Konto: {account?.name || linkedBudgetPost.accountId}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Linked income information - For income transactions with incomeTargetId */}
                  {transaction.incomeTargetId && transaction.type === 'Inkomst' && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground">
                          Länkad inkomst
                        </label>
                      </div>
                      <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded-md">
                        {(() => {
                          // Look up the budget_post by ID
                          const linkedBudgetPost = budgetPostsFromAPI.find(post => post.id === transaction.incomeTargetId);
                          
                          if (!linkedBudgetPost) {
                            return (
                              <p className="text-sm text-green-700">
                                Länkad inkomst hittades inte
                              </p>
                            );
                          }

                          // Get the family member name
                          const familyMember = familyMembers.find(m => m.id === linkedBudgetPost.familjemedlemId);
                          
                          // Get the income source name
                          const incomeSource = inkomstkallor.find(i => i.id === linkedBudgetPost.idInkomstkalla);
                          
                          // Format the date from the transaction
                          const formattedDate = new Date(transaction.date).toLocaleDateString('sv-SE');
                          
                          // Display the income link information
                          return (
                            <div className="space-y-1">
                              <p className="text-sm text-green-700 font-medium">
                                Länkad inkomst:
                              </p>
                              <p className="text-sm text-green-600">
                                {formattedDate}: {familyMember?.name || 'Okänd person'}
                              </p>
                              <p className="text-xs text-green-500">
                                {incomeSource?.text || 'Okänd inkomstkälla'}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {/* Show message for Savings/Sparande type without savingsTargetId */}
                  {!transaction.savingsTargetId && (transaction.type === 'Savings' || transaction.type === 'Sparande') && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Länkad transaktion
                      </label>
                      <div className="mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md">
                        <p className="text-sm text-gray-600">
                          Länkad transaktion hittades inte
                        </p>
                      </div>
                    </div>
                  )}
                 </div>
               )}

               {/* Show balance information */}
               {(transaction.balanceAfter !== undefined && !isNaN(transaction.balanceAfter)) || 
                (transaction.estimatedBalanceAfter !== undefined && !isNaN(transaction.estimatedBalanceAfter)) ? (
                 <div className="pt-4 mt-4 border-t">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {/* CSV Balance - prioritized */}
                     {transaction.balanceAfter !== undefined && !isNaN(transaction.balanceAfter) && (
                       <div>
                         <label className="text-xs font-medium text-muted-foreground">Saldo efter transaktion</label>
                         <p className="text-sm font-medium">
                           {formatOrenAsCurrency(transaction.balanceAfter)}
                         </p>
                       </div>
                     )}
                     
                     {/* Estimated Balance - only shown when CSV balance is missing */}
                     {(transaction.balanceAfter === undefined || isNaN(transaction.balanceAfter)) && 
                      transaction.estimatedBalanceAfter !== undefined && !isNaN(transaction.estimatedBalanceAfter) && (
                       <div>
                         <label className="text-xs font-medium text-muted-foreground">Estimerat saldo efter transaktion</label>
                         <p className="text-sm font-medium text-muted-foreground">
                           {formatOrenAsCurrency(transaction.estimatedBalanceAfter)}
                         </p>
                       </div>
                     )}
                   </div>
                 </div>
               ) : null}
             </div>
           </CardContent>
         </CollapsibleContent>
      </Collapsible>
      
      {/* Create Rule Dialog */}
      <CreateRuleDialog
        open={isCreateRuleDialogOpen}
        onOpenChange={setIsCreateRuleDialogOpen}
        transaction={transaction}
        accounts={accounts}
        availableBankCategories={availableBankCategories}
        availableBankSubCategories={availableBankSubCategories}
      />
    </Card>
  );
});