import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Edit3, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImportedTransaction } from '@/types/transaction';
import { StorageKey, get } from '@/services/storageService';
import { TransactionTypeSelector } from './TransactionTypeSelector';
import { useBudget } from '@/hooks/useBudget';
import { useTransactionExpansion } from '@/hooks/useTransactionExpansion';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { useHuvudkategorier, useUnderkategorier, useCategoryNames } from '@/hooks/useCategories';
import { useBudgetPosts } from '@/hooks/useBudgetPosts';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { useCategoryRules } from '@/hooks/useCategoryRules';
import { CreateRuleDialog } from './CreateRuleDialog';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useInkomstkallor } from '@/hooks/useInkomstkallor';
import { addMobileDebugLog } from '@/utils/mobileDebugLogger';

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
  // LOCAL STATE for immediate updates - with snake_case to camelCase conversion
  const [transaction, setTransaction] = useState(() => {
    return {
      ...propTransaction,
      linkedCostId: propTransaction.linkedCostId || (propTransaction as any).linked_cost_id || null,
      linkedTransactionId: propTransaction.linkedTransactionId || (propTransaction as any).linked_transaction_id || null,
      savingsTargetId: propTransaction.savingsTargetId || (propTransaction as any).savings_target_id || null,
      correctedAmount: propTransaction.correctedAmount !== undefined ? propTransaction.correctedAmount : (propTransaction as any).corrected_amount || null,
    };
  });
  
  // Update local state when prop changes
  useEffect(() => {
    // Apply snake_case to camelCase conversion for linking fields, same as orchestrator
    // WORKAROUND: For CostCoverage and ExpenseClaim transactions, if linkedCostId is missing but we have linkedTransactionId,
    // check if the linkedTransactionId might actually be the linkedCostId based on the transaction context
    let linkedCostId = propTransaction.linkedCostId || (propTransaction as any).linked_cost_id || null;
    
    // If this is a CostCoverage or ExpenseClaim transaction and we don't have linkedCostId but have linkedTransactionId,
    // try to fetch the transaction directly from backend to get missing data
    if ((propTransaction.type === 'CostCoverage' || propTransaction.type === 'ExpenseClaim') && !linkedCostId && propTransaction.linkedTransactionId) {
      addMobileDebugLog(`🔧 [WORKAROUND] ${propTransaction.type} ${propTransaction.id?.slice(-8)}: Missing linkedCostId, fetching from backend`);
      
      // Fetch the transaction directly from backend
      fetch(`/api/transactions/${propTransaction.id}`)
        .then(response => response.json())
        .then(backendData => {
          if (backendData.linkedCostId) {
            addMobileDebugLog(`🔧 [WORKAROUND] Got linkedCostId from backend: ${backendData.linkedCostId?.slice(-8)}`);
            linkedCostId = backendData.linkedCostId;
            
            // Update the converted transaction with correct data
            const fixedTransaction = {
              ...convertedTransaction,
              linkedCostId: linkedCostId
            };
            setTransaction(fixedTransaction);
          }
        })
        .catch(error => {
          addMobileDebugLog(`🔧 [WORKAROUND] Failed to fetch from backend: ${error.message}`);
        });
    }
    
    const convertedTransaction = {
      ...propTransaction,
      linkedCostId: linkedCostId,
      linkedTransactionId: propTransaction.linkedTransactionId || (propTransaction as any).linked_transaction_id || null,
      savingsTargetId: propTransaction.savingsTargetId || (propTransaction as any).savings_target_id || null,
      correctedAmount: propTransaction.correctedAmount !== undefined ? propTransaction.correctedAmount : (propTransaction as any).corrected_amount || null,
    };
    
    setTransaction(convertedTransaction);
    
    // Debug for ALL transactions to see what's happening
    if (propTransaction.id?.includes('ea19a8a5')) {
      addMobileDebugLog(`🔄 [TransactionExpandableCard] Transaction ${propTransaction.id?.slice(-8)}: RAW linkedCostId=${propTransaction.linkedCostId || 'null'}, RAW linkedTransactionId=${propTransaction.linkedTransactionId || 'null'}, type=${propTransaction.type}`);
      addMobileDebugLog(`🔄 [TransactionExpandableCard] Transaction ${propTransaction.id?.slice(-8)}: CONVERTED linkedCostId=${convertedTransaction.linkedCostId || 'null'}, CONVERTED linkedTransactionId=${convertedTransaction.linkedTransactionId || 'null'}`);
    }
    
    // Debug for ExpenseClaim/CostCoverage transactions
    if (propTransaction.type === 'ExpenseClaim' || propTransaction.type === 'CostCoverage') {
      console.log('🔄 [TransactionExpandableCard] RAW PROP DATA:', {
        id: propTransaction.id,
        type: propTransaction.type,
        // Raw fields from API
        raw_linkedCostId: propTransaction.linkedCostId,
        raw_linkedTransactionId: propTransaction.linkedTransactionId,  
        raw_correctedAmount: propTransaction.correctedAmount,
        raw_linked_cost_id: (propTransaction as any).linked_cost_id,
        raw_linked_transaction_id: (propTransaction as any).linked_transaction_id,
        raw_corrected_amount: (propTransaction as any).corrected_amount,
      });
      
      console.log('🔄 [TransactionExpandableCard] CONVERTED DATA:', {
        id: propTransaction.id,
        type: propTransaction.type,
        linkedCostId: convertedTransaction.linkedCostId,
        linkedTransactionId: convertedTransaction.linkedTransactionId,
        correctedAmount: convertedTransaction.correctedAmount,
        description: propTransaction.description,
        userDescription: propTransaction.userDescription,
        willShowCorrectedAmount: !!(convertedTransaction.linkedTransactionId || convertedTransaction.linkedCostId)
      });
    }
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
  const [showLinkedTransactionDialog, setShowLinkedTransactionDialog] = useState(false);
  const [linkedTransactionToShow, setLinkedTransactionToShow] = useState<any>(null);
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
      return;
    }


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


      // Update both transactions to remove links and reset type to 'Transaction'
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



      // Trigger refresh to update the UI
      if (onRefresh) {
        await onRefresh();
      }

    } catch (error) {
    }
  };

  // Function to unlink expense claim/cost coverage transactions
  const handleUnlinkExpenseClaim = async () => {
    const linkedId = transaction.linkedTransactionId || transaction.linkedCostId;
    if (!linkedId) {
      return;
    }


    try {
      // Find the linked transaction to determine its status after unlinking
      let allTransactions = budgetState?.allTransactions || [];
      if (allTransactions.length === 0) {
        allTransactions = Object.values(budgetState?.historicalData || {}).flatMap(month => 
          (month as any)?.transactions || []
        );
      }
      const linkedTransaction = allTransactions.find((t: any) => t.id === linkedId);
      
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
      
      try {
        const result1 = await updateTransactionMutation.mutateAsync({
          id: transaction.id,
          data: {
            type: 'Transaction',
            linkedTransactionId: null,
            linkedCostId: null,  // Clear both types of links
            correctedAmount: null, // Restore original amount
            userDescription: '',
            status: transaction1Status,
            isManuallyChanged: 'true'
          }
        });
        
        
        const result2 = await updateTransactionMutation.mutateAsync({
          id: linkedId,
          data: {
            type: 'Transaction', 
            linkedTransactionId: null,
            linkedCostId: null,  // Clear both types of links
            userDescription: '',
            status: transaction2Status,
            isManuallyChanged: 'true'
          }
        });
        
        
      } catch (apiError) {
        // If sequential approach fails, try to at least unlink the current transaction
        throw apiError;
      }


      // Trigger refresh to update the UI
      if (onRefresh) {
        await onRefresh();
      }

    } catch (error) {
    }
  };

  // Function to unlink savings transactions
  const handleUnlinkSavings = async () => {
    if (!transaction.savingsTargetId) {
      return;
    }


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


      // Trigger refresh to update the UI
      if (onRefresh) {
        await onRefresh();
      }

    } catch (error) {
    }
  };

  // Handle linked transaction view
  const handleLinkedTransactionClick = (linkedTransactionId: string) => {
    console.log('🔍 [TransactionExpandableCard] Looking for linked transaction:', linkedTransactionId);
    
    // Try to find the linked transaction in the allTransactions from budgetState
    const linkedTransaction = budgetState?.allTransactions?.find(tx => tx.id === linkedTransactionId);
    
    if (linkedTransaction) {
      console.log('✅ [TransactionExpandableCard] Found linked transaction:', linkedTransaction);
      setLinkedTransactionToShow(linkedTransaction);
      setShowLinkedTransactionDialog(true);
    } else {
      console.log('❌ [TransactionExpandableCard] Linked transaction not found in budgetState.allTransactions');
      console.log('Available transactions count:', budgetState?.allTransactions?.length || 0);
      
      // Fallback: try to construct a basic transaction object with available data
      const fallbackTransaction = {
        id: linkedTransactionId,
        description: 'Länkad transaktion (detaljer ej tillgängliga)',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        status: 'yellow'
      };
      
      setLinkedTransactionToShow(fallbackTransaction);
      setShowLinkedTransactionDialog(true);
    }
  };

  return (
    <Card className={`border-l-4 ${getStatusBorderColor(transaction.status)} hover:shadow-lg transition-all duration-200 bg-gradient-to-r from-white to-gray-50/30 dark:from-gray-900 dark:to-gray-800/30`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-5 cursor-pointer">
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

                {/* Beautiful card layout */}
                <div className="flex-1 min-w-0">
                  {/* Top section: Amount and Balance */}
                  <div className="flex justify-between items-start mb-4 p-3 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-100/50 dark:border-blue-800/30">
                    <div>
                      {/* Amount */}
                      <div className={`text-xl font-bold ${transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {transaction.amount >= 0 ? '+' : ''}{(transaction.amount / 100).toFixed(2)} kr
                      </div>
                      {/* Balance after transaction - smaller text under amount */}
                      {(transaction.balanceAfter !== undefined && !isNaN(transaction.balanceAfter)) && (
                        <div className="text-sm text-muted-foreground mt-1 font-medium">
                          Saldo efter transaktion: {((transaction.balanceAfter || 0) / 100).toFixed(2)} kr
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">Konto</div>
                      <div className="font-semibold text-sm text-gray-700 dark:text-gray-300">{account?.name || 'Okänt konto'}</div>
                    </div>
                  </div>

                  {/* Description and User Note Row */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Beskrivning / Egen text</div>
                      <div className="text-xs text-muted-foreground">{transaction.date}</div>
                    </div>
                    <div className="text-sm font-medium truncate" title={displayDescription}>
                      {hasUserDescription && (
                        <span className="text-primary">{displayDescription}</span>
                      )}
                      {!hasUserDescription && displayDescription}
                    </div>
                    {/* Show linked transaction indicator */}
                    {(transaction.linkedTransactionId || transaction.linkedCostId) && (
                      <div className="text-xs text-blue-600 font-medium mt-1">
                        {transaction.type === 'ExpenseClaim' 
                          ? (transaction.linkedCostId 
                              ? `Länkad till Utlägg/Kostnad: ${transaction.linkedCostId.slice(0, 8)}...` 
                              : `Utlägg täcks av: ${transaction.linkedTransactionId?.slice(0, 8)}...`)
                          : transaction.type === 'CostCoverage'
                            ? `Täcker kostnad: ${(transaction.linkedTransactionId || transaction.linkedCostId)?.slice(0, 8)}...`
                            : transaction.type === 'InternalTransfer'
                              ? `Intern överföring: ${transaction.linkedTransactionId?.slice(0, 8)}...`
                              : `Länkad: ${(transaction.linkedTransactionId || transaction.linkedCostId)?.slice(0, 8)}...`
                        }
                      </div>
                    )}
                  </div>

                  {/* Bank Categories Row */}
                  <div className="mb-4 p-3 bg-gradient-to-r from-gray-50/70 to-blue-50/40 dark:from-gray-800/40 dark:to-blue-900/20 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Bankkategorier</div>
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Bankkategori:</span>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700">
                          {transaction.bankCategory || 'Nöje & fritid'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Bank Underkategori:</span>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700">
                          {transaction.bankSubCategory || 'Kafé & restaurang'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* App Categories Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  </div>

                  {/* Quick Actions Section */}
                  <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {transaction.amount < 0 && transaction.type !== 'InternalTransfer' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-3 text-xs"
                        onClick={() => onTransferMatch?.(transaction)}
                      >
                        Matcha överföring
                      </Button>
                    )}
                    {transaction.amount > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-3 text-xs"
                        onClick={() => onSavingsLink?.(transaction)}
                      >
                        Länka sparande
                      </Button>
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

              {/* All linked information sections */}
              <div className="mt-4 space-y-3">
                {/* Linked cost/expense (linked_cost_id) */}
                {(transaction.linkedCostId || transaction.type === 'CostCoverage' || transaction.type === 'ExpenseClaim') && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Länkad transaktion för utlägg/kostnad [DEBUG: linkedCostId={transaction.linkedCostId || 'null'}, type={transaction.type}]
                    </label>
                    <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-md">
                      {(() => {
                        // Debug logging for ExpenseClaim
                        if (transaction.type === 'ExpenseClaim') {
                          console.log('🔍 [ExpenseClaim Debug]', {
                            transactionId: transaction.id,
                            linkedCostId: transaction.linkedCostId,
                            description: transaction.description,
                            userDescription: transaction.userDescription,
                            type: transaction.type
                          });
                        }
                        
                        // Debug logging for linked cost section
                        console.log('🔍 [LinkedCost Section] Transaction check:', {
                          id: transaction.id?.slice(-8),
                          type: transaction.type,
                          linkedCostId: transaction.linkedCostId,
                          linkedTransactionId: transaction.linkedTransactionId,
                          description: transaction.description,
                          userDescription: transaction.userDescription
                        });
                        
                        if (!transaction.linkedCostId) {
                          // Try to extract from description if ExpenseClaim
                          if (transaction.type === 'ExpenseClaim' && (transaction.description || transaction.userDescription)) {
                            const desc = transaction.userDescription || transaction.description;
                            const uuidPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
                            const match = desc.match(uuidPattern);
                            if (match) {
                              console.log('🔍 [ExpenseClaim] Found UUID in description:', match[1]);
                            }
                          }
                          
                          return (
                            <p className="text-sm text-orange-700">
                              Ingen länkad transaktion (linkedCostId: {transaction.linkedCostId || 'null'})
                            </p>
                          );
                        }
                        
                        // Find the linked transaction
                        let allTransactions = budgetState?.allTransactions || [];
                        if (allTransactions.length === 0) {
                          allTransactions = Object.values(budgetState?.historicalData || {}).flatMap(month => 
                            (month as any)?.transactions || []
                          );
                        }
                        const linkedTransaction = allTransactions.find((t: any) => t.id === transaction.linkedCostId);
                        
                        if (!linkedTransaction) {
                          return (
                            <p className="text-sm text-blue-700">
                              Länkad transaktion hittades inte (ID: {transaction.linkedCostId})
                            </p>
                          );
                        }

                        const account = budgetState?.accounts?.find(acc => acc.id === linkedTransaction.accountId);
                        
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-blue-700 font-medium">
                                ID: {transaction.linkedCostId}
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
                              Konto: {account?.name || 'Okänt konto'} • Belopp: {formatOrenAsCurrency(linkedTransaction.amount)}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Linked internal transfer (linked_transaction_id) */}
                {(transaction.linkedTransactionId || transaction.type === 'InternalTransfer') && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Länkad intern överföring
                    </label>
                    <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-md">
                      {(() => {
                        if (!transaction.linkedTransactionId) {
                          return (
                            <p className="text-sm text-orange-700">
                              Ingen länkad transaktion
                            </p>
                          );
                        }
                        
                        // Find the linked transaction
                        let allTransactions = budgetState?.allTransactions || [];
                        if (allTransactions.length === 0) {
                          allTransactions = Object.values(budgetState?.historicalData || {}).flatMap(month => 
                            (month as any)?.transactions || []
                          );
                        }
                        const linkedTransaction = allTransactions.find((t: any) => t.id === transaction.linkedTransactionId);
                        
                        if (!linkedTransaction) {
                          return (
                            <p className="text-sm text-blue-700">
                              Länkad transaktion hittades inte (ID: {transaction.linkedTransactionId})
                            </p>
                          );
                        }

                        const account = budgetState?.accounts?.find(acc => acc.id === linkedTransaction.accountId);
                        
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-blue-700 font-medium">
                                ID: {transaction.linkedTransactionId}
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
                              Konto: {account?.name || 'Okänt konto'} • Belopp: {formatOrenAsCurrency(linkedTransaction.amount)}
                            </p>
                          </div>
                        );
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
                    }
                    return null;
                  })()}

                {/* Linked savings (savings_target_id) */}
                {(transaction.savingsTargetId || transaction.type === 'Savings' || transaction.type === 'Sparande') && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Länkat sparande/sparmål
                    </label>
                    <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded-md">
                      {(() => {
                        if (!transaction.savingsTargetId) {
                          return (
                            <p className="text-sm text-orange-700">
                              Ingen länkad transaktion
                            </p>
                          );
                        }
                        
                        // Look up the budget_post by ID
                        const linkedBudgetPost = budgetPostsFromAPI.find(post => post.id === transaction.savingsTargetId);
                        
                        if (!linkedBudgetPost) {
                          return (
                            <p className="text-sm text-green-700">
                              Länkad transaktion hittades inte (ID: {transaction.savingsTargetId})
                            </p>
                          );
                        }

                        // Get the account name
                        const account = budgetState?.accounts?.find(acc => acc.id === linkedBudgetPost.accountId);
                        
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-green-700 font-medium">
                                ID: {transaction.savingsTargetId}
                              </p>
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
                            <p className="text-sm text-green-600">
                              {linkedBudgetPost.description}
                            </p>
                            <p className="text-xs text-green-500">
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
              </div>

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

               {/* Comprehensive Linked Transactions Section */}
               <div className="mt-6 border-t pt-4">
                 <h4 className="text-sm font-medium text-muted-foreground mb-3">
                   Länkade transaktioner
                 </h4>
                 <div className="space-y-3">
                   
                   {/* Länkad intern överföring (linkedTransactionId) */}
                   <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                     <div className="flex-1">
                       <span className="text-sm font-medium">Länkad intern överföring:</span>
                       <span className="text-sm ml-2">
                         {transaction.linkedTransactionId ? (
                           <div className="inline-flex items-center gap-2">
                             <span 
                               className="text-green-600 cursor-pointer hover:text-green-700 hover:underline"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleLinkedTransactionClick(transaction.linkedTransactionId);
                               }}
                               title="Klicka för att visa länkad transaktion"
                             >
                               ✓ Länkad ({transaction.linkedTransactionId.slice(-8)})
                             </span>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleUnlinkInternalTransfer();
                               }}
                               className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                               title="Ta bort länkning"
                             >
                               <Trash2 className="h-3 w-3" />
                             </button>
                           </div>
                         ) : (
                           <span className="text-gray-500">Ingen länkning</span>
                         )}
                       </span>
                     </div>
                     <Badge variant={transaction.linkedTransactionId ? "default" : "secondary"} className="text-xs">
                       {transaction.linkedTransactionId ? "Aktiv" : "Ej länkad"}
                     </Badge>
                   </div>

                   {/* Länkad transaktion för utlägg/kostnad (linkedCostId) */}
                   <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                     <div className="flex-1">
                       <span className="text-sm font-medium">Länkad transaktion för utlägg/kostnad:</span>
                       <span className="text-sm ml-2">
                         {transaction.linkedCostId ? (
                           <div className="inline-flex items-center gap-2">
                             <span 
                               className="text-green-600 cursor-pointer hover:text-green-700 hover:underline"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleLinkedTransactionClick(transaction.linkedCostId);
                               }}
                               title="Klicka för att visa länkad transaktion"
                             >
                               ✓ Länkad ({transaction.linkedCostId.slice(-8)})
                             </span>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleUnlinkExpenseClaim();
                               }}
                               className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                               title="Ta bort länkning"
                             >
                               <Trash2 className="h-3 w-3" />
                             </button>
                           </div>
                         ) : (
                           <span className="text-gray-500">Ingen länkning</span>
                         )}
                       </span>
                     </div>
                     <Badge variant={transaction.linkedCostId ? "default" : "secondary"} className="text-xs">
                       {transaction.linkedCostId ? "Aktiv" : "Ej länkad"}
                     </Badge>
                   </div>

                   {/* Länkat sparande/sparmål (savingsTargetId) */}
                   <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                     <div className="flex-1">
                       <span className="text-sm font-medium">Länkat sparande/sparmål:</span>
                       <span className="text-sm ml-2">
                         {transaction.savingsTargetId ? (
                           <div className="inline-flex items-center gap-2">
                             <span className="text-green-600">
                               ✓ Länkad ({transaction.savingsTargetId.slice(-8)})
                             </span>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleUnlinkSavings();
                               }}
                               className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                               title="Ta bort länkning"
                             >
                               <Trash2 className="h-3 w-3" />
                             </button>
                           </div>
                         ) : (
                           <span className="text-gray-500">Ingen länkning</span>
                         )}
                       </span>
                     </div>
                     <Badge variant={transaction.savingsTargetId ? "default" : "secondary"} className="text-xs">
                       {transaction.savingsTargetId ? "Aktiv" : "Ej länkad"}
                     </Badge>
                   </div>

                   {/* Länkad inkomst (incomeTargetId) */}
                   <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                     <div className="flex-1">
                       <span className="text-sm font-medium">Länkad inkomst:</span>
                       <span className="text-sm ml-2">
                         {transaction.incomeTargetId ? (
                           <div className="inline-flex items-center gap-2">
                             <span className="text-green-600">
                               ✓ Länkad ({transaction.incomeTargetId.slice(-8)})
                             </span>
                             {/* Note: Income unlinking not implemented yet */}
                           </div>
                         ) : (
                           <span className="text-gray-500">Ingen länkning</span>
                         )}
                       </span>
                     </div>
                     <Badge variant={transaction.incomeTargetId ? "default" : "secondary"} className="text-xs">
                       {transaction.incomeTargetId ? "Aktiv" : "Ej länkad"}
                     </Badge>
                   </div>

                   {/* Summary count */}
                   <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                     Totalt antal aktiva länkar: {[
                       transaction.linkedTransactionId,
                       transaction.linkedCostId, 
                       transaction.savingsTargetId,
                       transaction.incomeTargetId
                     ].filter(Boolean).length} av 4
                   </div>
                 </div>
               </div>

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

      {/* Linked Transaction Dialog */}
      {showLinkedTransactionDialog && linkedTransactionToShow && (
        <Dialog open={showLinkedTransactionDialog} onOpenChange={setShowLinkedTransactionDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Länkad transaktion</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Transaction header */}
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <div>
                  <h3 className="text-lg font-semibold">{linkedTransactionToShow.description}</h3>
                  <p className="text-sm text-muted-foreground">
                    {linkedTransactionToShow.date} • {accounts.find(acc => acc.id === linkedTransactionToShow.accountId)?.name || 'Okänt konto'}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${linkedTransactionToShow.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatOrenAsCurrency(linkedTransactionToShow.amount)}
                  </p>
                  <Badge variant={linkedTransactionToShow.status === 'green' ? 'default' : linkedTransactionToShow.status === 'yellow' ? 'secondary' : 'destructive'} className="text-xs">
                    {linkedTransactionToShow.status === 'green' ? 'Godkänd' : linkedTransactionToShow.status === 'yellow' ? 'Under granskning' : 'Felaktig'}
                  </Badge>
                </div>
              </div>

              {/* Transaction details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Typ</label>
                    <p className="text-sm">{linkedTransactionToShow.type || 'Transaction'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Bank kategori</label>
                    <p className="text-sm">{linkedTransactionToShow.bankCategory || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Bank underkategori</label>
                    <p className="text-sm">{linkedTransactionToShow.bankSubCategory || '-'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <p className="text-sm">{linkedTransactionToShow.status || 'yellow'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Saldo efter</label>
                    <p className="text-sm">{linkedTransactionToShow.balanceAfter ? formatOrenAsCurrency(linkedTransactionToShow.balanceAfter) : '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Manuellt ändrad</label>
                    <p className="text-sm">{linkedTransactionToShow.isManuallyChanged === 'true' ? 'Ja' : 'Nej'}</p>
                  </div>
                </div>
              </div>

              {/* User description */}
              {linkedTransactionToShow.userDescription && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Egen anteckning</label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded">{linkedTransactionToShow.userDescription}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
});