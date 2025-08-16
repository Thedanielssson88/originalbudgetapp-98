import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  Link2, 
  Sparkles,
  Receipt,
  Shield,
  Banknote,
  Calendar,
  Building2,
  Edit3,
  Plus,
  ArrowUpDown,
  AlertCircle,
  CheckCircle2,
  PiggyBank,
  Trash2,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useBudget } from '@/hooks/useBudget';
import { useTransactions, useUpdateTransaction } from '@/hooks/useTransactions';
import { useHuvudkategorier, useUnderkategorier } from '@/hooks/useCategories';
import { useAccounts } from '@/hooks/useAccounts';
import { useBudgetPosts } from '@/hooks/useBudgetPosts';
import { useCategoryRules } from '@/hooks/useCategoryRules';
import { useQueryClient } from '@tanstack/react-query';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { applyRulesToTransactionsBatch } from '@/orchestrator/batchRuleApplication';
import { TransactionTypeSelector } from '@/components/TransactionTypeSelector';
import { CreateRuleDialog } from '@/components/CreateRuleDialog';
import { ExpenseLinkDialog } from '@/components/ExpenseLinkDialog';
import { CostCoverageDialog } from '@/components/CostCoverageDialog';
import { SavingsGoalLinkDialog } from '@/components/SavingsGoalLinkDialog';
import { SimpleTransferMatchDialog } from '@/components/SimpleTransferMatchDialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
// Removed deprecated orchestrator imports - using React Query hooks directly

export function TransactionReviewPage() {
  const { toast } = useToast();
  const { budgetState } = useBudget();
  const { data: transactions = [], refetch: refetchTransactions } = useTransactions();
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: underkategorier = [] } = useUnderkategorier();
  const { data: accounts = [] } = useAccounts();
  const { data: budgetPosts = [] } = useBudgetPosts();
  const { data: categoryRules = [] } = useCategoryRules();
  const updateTransactionMutation = useUpdateTransaction();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showCostCoverageDialog, setShowCostCoverageDialog] = useState(false);
  const [showSavingsDialog, setShowSavingsDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [editMode, setEditMode] = useState<'note' | 'amount' | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [tempAmount, setTempAmount] = useState('');
  const [showLinkedTransactionDialog, setShowLinkedTransactionDialog] = useState(false);
  const [linkedTransactionToShow, setLinkedTransactionToShow] = useState<any>(null);
  const [showApplyRulesResults, setShowApplyRulesResults] = useState(false);
  const [applyRulesResults, setApplyRulesResults] = useState<any>(null);
  const [isApplyingRules, setIsApplyingRules] = useState(false);
  
  // Local UI state for immediate updates
  const [localTransactionUpdates, setLocalTransactionUpdates] = useState<Record<string, Partial<any>>>({});

  // Get transactions for current month (including green ones to prevent index shifting)
  const monthTransactions = useMemo(() => {
    const currentMonth = budgetState.selectedMonthKey;
    return transactions.filter(tx => {
      const txMonth = tx.date ? tx.date.substring(0, 7) : '';
      return txMonth === currentMonth && tx.amount !== 0;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, budgetState.selectedMonthKey]);

  // Filter for uncategorized for count purposes, but use all for navigation
  const uncategorizedTransactions = useMemo(() => {
    return monthTransactions.filter(tx => 
      tx.status === 'red' || tx.status === 'yellow'
    );
  }, [monthTransactions]);

  // Get current transaction but check if it still exists in the filtered list
  const baseTransaction = uncategorizedTransactions[currentIndex];
  
  // Apply local updates to current transaction for immediate UI feedback
  const currentTransaction = baseTransaction ? {
    ...baseTransaction,
    ...localTransactionUpdates[baseTransaction.id]
  } : null;

  // Transform budget posts into savings goals for the dialog, filtered by current transaction's account
  const savingsGoals = useMemo(() => {
    const currentTransactionAccountId = currentTransaction?.accountId;
    if (!currentTransactionAccountId) return [];
    
    return budgetPosts
      .filter(post => 
        (post.type === 'sparmål' || post.type === 'savings') && 
        post.accountId === currentTransactionAccountId
      )
      .map(post => ({
        id: post.id,
        name: post.description || 'Unnamed Goal',
        targetAmount: post.amount ? post.amount / 100 : undefined, // Convert from öre to SEK
        currentAmount: 0, // Would need to be calculated from linked transactions
        mainCategoryId: post.huvudkategoriId,
        subCategoryId: post.underkategoriId
      }));
  }, [budgetPosts, currentTransaction?.accountId]);
  
  // Removed auto-categorization handler - no automatic navigation

  // Don't auto-adjust index - let user manually navigate
  // This prevents automatic switching when transactions are categorized
  // React.useEffect(() => {
  //   if (uncategorizedTransactions.length > 0 && currentIndex >= uncategorizedTransactions.length) {
  //     setCurrentIndex(Math.max(0, uncategorizedTransactions.length - 1));
  //   }
  // }, [uncategorizedTransactions.length, currentIndex]);

  // Handle swipe/navigation
  const handleNext = useCallback(() => {
    if (currentIndex < uncategorizedTransactions.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
      setEditMode(null);
      // Clear local updates when navigating
      setLocalTransactionUpdates({});
    }
  }, [currentIndex, uncategorizedTransactions.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
      setEditMode(null);
      // Clear local updates when navigating
      setLocalTransactionUpdates({});
    }
  }, [currentIndex]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 100;
    if (info.offset.x > swipeThreshold) {
      handlePrevious();
    } else if (info.offset.x < -swipeThreshold) {
      handleNext();
    }
  };

  // Handle category updates - SIMPLIFIED VERSION
  const handleCategoryUpdate = async (huvudkategoriId: string, underkategoriId?: string) => {
    if (!currentTransaction) return;

    const huvudkat = huvudkategorier.find(h => h.id === huvudkategoriId);
    const underkat = underkategoriId ? underkategorier.find(u => u.id === underkategoriId) : null;

    // Determine new status based on category selection
    // NOTE: Never auto-approve! Only change to yellow when partially categorized
    let newStatus: 'green' | 'yellow' | 'red' = 'red';
    if (huvudkat) {
      newStatus = 'yellow'; // Always yellow when categorized, never auto-green
    }

    // When changing huvudkategori, clear underkategori if it doesn't belong to the new category
    let actualUnderkategoriId = underkategoriId;
    if (underkategoriId) {
      const underkatCheck = underkategorier.find(u => u.id === underkategoriId);
      if (underkatCheck && underkatCheck.huvudkategoriId !== huvudkategoriId) {
        actualUnderkategoriId = undefined;
        // newStatus already set to 'yellow' above - no need to change it here
      }
    }

    // IMMEDIATELY UPDATE LOCAL UI STATE
    // NOTE: We don't update status locally to prevent transaction from disappearing from list
    const localUpdate = {
      appCategoryId: huvudkategoriId,
      appSubCategoryId: actualUnderkategoriId || null,
      isManuallyChanged: 'true'
    };
    
    setLocalTransactionUpdates(prev => ({
      ...prev,
      [currentTransaction.id]: {
        ...prev[currentTransaction.id],
        ...localUpdate
      }
    }));

    console.log(`🎯 [TRANSACTION PAGE] Updating category: ${huvudkat?.name}${actualUnderkategoriId && underkat ? ` - ${underkat.name}` : ''}`);
    console.log(`🎯 [TRANSACTION PAGE] Transaction ID: ${currentTransaction.id}`);
    console.log(`🎯 [TRANSACTION PAGE] Category IDs:`, {
      huvudkategoriId,
      actualUnderkategoriId,
      hovedkategoriName: huvudkat?.name,
      underkategoriName: underkat?.name
    });
    console.log(`🎯 [TRANSACTION PAGE] About to call updateTransactionMutation.mutate`);
    console.log(`🎯 [TRANSACTION PAGE] Mutation state:`, {
      isLoading: updateTransactionMutation.isLoading,
      isError: updateTransactionMutation.isError,
      error: updateTransactionMutation.error
    });

    // Add mobile debug logging
    const { addMobileDebugLog } = await import('../utils/mobileDebugLogger');
    addMobileDebugLog(`🎯 [TRANSACTION PAGE] Updating category: ${huvudkat?.name}${actualUnderkategoriId && underkat ? ` - ${underkat.name}` : ''}`);
    addMobileDebugLog(`🎯 [TRANSACTION PAGE] Transaction ID: ${currentTransaction.id}`);
    addMobileDebugLog(`🔍 [TRANSACTION PAGE] Transaction details: ${currentTransaction.description} - ${currentTransaction.date} - ${currentTransaction.amount}`);
    addMobileDebugLog(`🔍 [TRANSACTION PAGE] Current transaction userId: ${currentTransaction.userId}`);
    addMobileDebugLog(`🔍 [TRANSACTION PAGE] Total transactions loaded: ${transactions.length}`);
    
    // Check if this transaction exists in our loaded data
    const foundInList = transactions.find(tx => tx.id === currentTransaction.id);
    if (foundInList) {
      addMobileDebugLog(`✅ [TRANSACTION PAGE] Transaction found in loaded list: ${foundInList.id}`);
    } else {
      addMobileDebugLog(`❌ [TRANSACTION PAGE] Transaction NOT found in loaded list! This is the problem.`);
    }
    
    addMobileDebugLog(`🎯 [TRANSACTION PAGE] About to call updateTransactionMutation.mutate`);

    // SIMPLE APPROACH: Just update SQL and let React Query refetch
    updateTransactionMutation.mutate({
      id: currentTransaction.id,
      data: {
        appCategoryId: huvudkategoriId,
        appSubCategoryId: actualUnderkategoriId || null,
        status: newStatus, // Server gets the correct status
        isManuallyChanged: 'true'
      }
    }, {
      onSuccess: () => {
        // Clear local updates since server confirmed the change
        setLocalTransactionUpdates(prev => {
          const newUpdates = { ...prev };
          delete newUpdates[currentTransaction.id];
          return newUpdates;
        });
        
        toast({
          title: "Kategori uppdaterad!",
          description: `Ändrad till ${huvudkat?.name}${actualUnderkategoriId && underkat ? ` - ${underkat.name}` : ''}`,
        });
        
        // Never auto-advance - user must manually navigate
        // This allows full control over the review process
      },
      onError: (error) => {
        // Rollback local updates on error
        setLocalTransactionUpdates(prev => {
          const newUpdates = { ...prev };
          delete newUpdates[currentTransaction.id];
          return newUpdates;
        });
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast({
          title: "API Error",
          description: errorMessage,
          variant: "destructive",
        });
        console.error("Failed to update category:", error);
        console.error("Error details:", errorMessage);
      }
    });

    // Show immediate feedback
    toast({
      title: "Sparar...",
      description: `Uppdaterar till ${huvudkat?.name}${actualUnderkategoriId && underkat ? ` - ${underkat.name}` : ''}`,
    });
  };

  // Handle transaction type update (callback from TransactionTypeSelector)
  const handleTypeUpdate = (type: string) => {
    // The TransactionTypeSelector handles the mutation internally
    // We just show a toast for user feedback
    toast({
      title: "Transaktionstyp uppdaterad",
      description: `Ändrad till ${type}`,
    });
  };

  // Handle approve (make green)
  const handleApprove = async () => {
    if (!currentTransaction) return;

    updateTransactionMutation.mutate({
      id: currentTransaction.id,
      data: {
        status: 'green',
        isManuallyChanged: 'true'
      }
    });
    
    toast({
      title: "Transaktion godkänd",
      className: "bg-green-50 border-green-200",
    });

    // No auto-advance - user controls navigation manually
  };

  // Handle note update
  const handleNoteUpdate = async () => {
    if (!currentTransaction) return;
    
    updateTransactionMutation.mutate({
      id: currentTransaction.id,
      data: {
        userDescription: tempNote,
        isManuallyChanged: 'true'
      }
    });
    setEditMode(null);
    
    toast({
      title: "Anteckning sparad",
    });
  };

  // Handle linked transaction view
  const handleLinkedTransactionClick = (linkedTransactionId: string) => {
    const linkedTransaction = transactions.find(tx => tx.id === linkedTransactionId);
    if (linkedTransaction) {
      setLinkedTransactionToShow(linkedTransaction);
      setShowLinkedTransactionDialog(true);
    } else {
      toast({
        title: "Länkad transaktion hittades inte",
        description: "Transaktionen kanske har tagits bort.",
        variant: "destructive",
      });
    }
  };

  // Handle unlinking internal transfer
  const handleUnlinkInternalTransfer = async () => {
    if (!currentTransaction?.linkedTransactionId) return;

    const linkedTransactionId = currentTransaction.linkedTransactionId;
    
    try {
      // Update both transactions to remove the link
      await Promise.all([
        updateTransactionMutation.mutateAsync({
          id: currentTransaction.id,
          data: {
            type: 'Transaction',
            linkedTransactionId: null,
            userDescription: '',
            isManuallyChanged: 'true'
          }
        }),
        updateTransactionMutation.mutateAsync({
          id: linkedTransactionId,
          data: {
            type: 'Transaction',
            linkedTransactionId: null,
            userDescription: '',
            isManuallyChanged: 'true'
          }
        })
      ]);

      toast({
        title: "Länkning borttagen",
        description: "Intern överföring har kopplats ur.",
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort länkningen.",
        variant: "destructive",
      });
    }
  };

  // Handle unlinking expense/cost
  const handleUnlinkExpenseCost = async () => {
    if (!currentTransaction?.linkedCostId) return;

    const linkedCostId = currentTransaction.linkedCostId;
    
    try {
      // Update both transactions to remove the link and corrected amount
      await Promise.all([
        updateTransactionMutation.mutateAsync({
          id: currentTransaction.id,
          data: {
            type: 'Transaction',
            linkedCostId: null,
            correctedAmount: null,
            userDescription: '',
            isManuallyChanged: 'true'
          }
        }),
        updateTransactionMutation.mutateAsync({
          id: linkedCostId,
          data: {
            type: 'Transaction',
            linkedCostId: null,
            correctedAmount: null,
            userDescription: '',
            isManuallyChanged: 'true'
          }
        })
      ]);

      toast({
        title: "Länkning borttagen",
        description: "Utlägg/kostnad har kopplats ur och korrigerat belopp återställt.",
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort länkningen.",
        variant: "destructive",
      });
    }
  };

  // Handle unlinking savings
  const handleUnlinkSavings = async () => {
    if (!currentTransaction?.savingsTargetId) return;
    
    try {
      await updateTransactionMutation.mutateAsync({
        id: currentTransaction.id,
        data: {
          type: 'Transaction',
          savingsTargetId: null,
          appCategoryId: null,
          appSubCategoryId: null,
          isManuallyChanged: 'true'
        }
      });

      toast({
        title: "Länkning borttagen",
        description: "Sparande har kopplats ur.",
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort länkningen.",
        variant: "destructive",
      });
    }
  };

  // Handle unlinking income
  const handleUnlinkIncome = async () => {
    if (!currentTransaction?.incomeTargetId) return;
    
    try {
      await updateTransactionMutation.mutateAsync({
        id: currentTransaction.id,
        data: {
          type: 'Transaction',
          incomeTargetId: null,
          isManuallyChanged: 'true'
        }
      });

      toast({
        title: "Länkning borttagen",
        description: "Inkomst har kopplats ur.",
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort länkningen.",
        variant: "destructive",
      });
    }
  };

  // Apply rules to all filtered transactions
  const handleApplyRulesToFiltered = async () => {
    setIsApplyingRules(true);
    
    try {
      console.log(`🚀 [APPLY RULES] Starting rule application to ${uncategorizedTransactions.length} filtered transactions`);
      
      const result = await applyRulesToTransactionsBatch(
        uncategorizedTransactions,
        categoryRules,
        huvudkategorier,
        underkategorier
      );
      
      if (result.success) {
        // Force refresh data to show updates - invalidate all transaction caches
        await queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
        
        // Also invalidate the specific query used by this component 
        await queryClient.invalidateQueries({ queryKey: ['/api/transactions', 'all'] });
        
        // Reset any local state that might be caching transaction data
        setLocalTransactionUpdates({});
        
        // Small delay to ensure backend processing is complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force refetch with fresh data
        await refetchTransactions();
        
        // Additional force refresh by removing and re-adding data to cache
        queryClient.removeQueries({ queryKey: ['/api/transactions'] });
        await refetchTransactions();
        
        // Show results dialog
        setApplyRulesResults(result);
        setShowApplyRulesResults(true);
        
        toast({
          title: "Regler applicerade!",
          description: `${result.stats.updated} transaktioner uppdaterade (${result.stats.rulesApplied} regelträffar, ${result.stats.autoApproved} auto-godkända)`,
        });
        
        console.log(`✅ [APPLY RULES] Successfully applied rules:`, result.stats);
      } else {
        throw new Error('Rule application failed');
      }
    } catch (error) {
      console.error('❌ [APPLY RULES] Error:', error);
      toast({
        title: "Fel vid regelapplicering",
        description: error instanceof Error ? error.message : "Kunde inte applicera regler",
        variant: "destructive",
      });
    } finally {
      setIsApplyingRules(false);
    }
  };


  if (uncategorizedTransactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Allt är kategoriserat!</h2>
        <p className="text-muted-foreground">Du har inga transaktioner att granska just nu.</p>
      </div>
    );
  }

  if (!currentTransaction) return null;

  const progress = ((currentIndex + 1) / uncategorizedTransactions.length) * 100;
  const huvudkategoriForTransaction = huvudkategorier.find(h => h.id === currentTransaction.appCategoryId);
  const underkategorierForHuvud = currentTransaction.appCategoryId 
    ? underkategorier.filter(u => u.huvudkategoriId === currentTransaction.appCategoryId)
    : [];

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20">
      {/* Header with progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Granska transaktioner</h1>
          <Badge variant="outline" className="text-lg px-3 py-1">
            {currentIndex + 1} / {uncategorizedTransactions.length}
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm text-muted-foreground">
            {uncategorizedTransactions.length - currentIndex - 1} transaktioner kvar att granska
          </p>
          <Button
            onClick={handleApplyRulesToFiltered}
            disabled={isApplyingRules || uncategorizedTransactions.length === 0 || categoryRules.length === 0}
            size="sm"
            variant="outline"
            className="ml-4"
          >
            {isApplyingRules ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Applicerar...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Applicera regler ({uncategorizedTransactions.length} transaktioner)
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Swipeable transaction card */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentTransaction.id}
          custom={direction}
          initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction > 0 ? -300 : 300, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="touch-pan-y"
        >
          <Card className={cn(
            "border-2 shadow-lg",
            currentTransaction.status === 'red' ? "border-red-200 bg-red-50/50" : "border-yellow-200 bg-yellow-50/50"
          )}>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      variant={currentTransaction.status === 'red' ? "destructive" : "default"}
                      className="text-xs"
                    >
                      {currentTransaction.status === 'red' ? 'Ej kategoriserad' : 'Delvis kategoriserad'}
                    </Badge>
                    {currentTransaction.type && (
                      <Badge variant="outline" className="text-xs">
                        {currentTransaction.type}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(currentTransaction.date), 'PPP', { locale: sv })}</span>
                  </div>
                </div>
                <div className="text-right">
                  {currentTransaction.correctedAmount !== null && currentTransaction.correctedAmount !== undefined ? (
                    <div>
                      <p className={cn(
                        "text-2xl font-bold",
                        currentTransaction.correctedAmount < 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {formatOrenAsCurrency(currentTransaction.correctedAmount)}
                      </p>
                      <p className="text-sm text-muted-foreground line-through">
                        Ursprungligt: {formatOrenAsCurrency(currentTransaction.amount)}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">
                        Korrigerat belopp
                      </p>
                    </div>
                  ) : (
                    <p className={cn(
                      "text-2xl font-bold",
                      currentTransaction.amount < 0 ? "text-red-600" : "text-green-600"
                    )}>
                      {formatOrenAsCurrency(currentTransaction.amount)}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mx-4 mt-4">
                  <TabsTrigger value="details">Detaljer</TabsTrigger>
                  <TabsTrigger value="linked">Länkade transaktioner</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="p-4 space-y-4">
              {/* Account info */}
              <div className="flex items-center gap-2 p-3 bg-background rounded-lg">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {accounts.find(a => a.id === currentTransaction.accountId)?.name || currentTransaction.accountName || 'Okänt konto'}
                </span>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Beskrivning</Label>
                <div className="p-3 bg-background rounded-lg">
                  <p className="font-medium">{currentTransaction.description}</p>
                  {currentTransaction.bankKategori && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Bank: {currentTransaction.bankKategori}
                      {currentTransaction.bankUnderkategori && ` - ${currentTransaction.bankUnderkategori}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Egen text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Egen text</Label>
                  {editMode === 'note' ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={handleNoteUpdate}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditMode(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setTempNote(currentTransaction.userDescription || '');
                        setEditMode('note');
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {editMode === 'note' ? (
                  <Input
                    value={tempNote}
                    onChange={(e) => setTempNote(e.target.value)}
                    placeholder="Lägg till egen text..."
                    onKeyDown={(e) => e.key === 'Enter' && handleNoteUpdate()}
                    className="w-full"
                  />
                ) : (
                  <div className="p-3 bg-background rounded-lg">
                    <p className="font-medium">
                      {currentTransaction.userDescription || <span className="text-muted-foreground">Ingen egen text tillagd</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* Category selection */}
              <div className="space-y-3">
                <Label>Kategori</Label>
                {currentTransaction.savingsTargetId ? (
                  // Read-only display for savings-linked transactions
                  <div className="space-y-2">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-blue-700">Sparande - Kategori ärfs från sparmål</span>
                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                          Låst
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">
                          {huvudkategoriForTransaction?.name || 'Huvudkategori saknas'}
                        </div>
                        {currentTransaction.appSubCategoryId && (
                          <div className="text-muted-foreground mt-1">
                            {underkategorier.find(u => u.id === currentTransaction.appSubCategoryId)?.name || 'Underkategori'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Editable category selection
                  <div className="grid gap-2">
                    <Select
                      value={currentTransaction.appCategoryId || ''}
                      onValueChange={(value) => handleCategoryUpdate(value, undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj huvudkategori" />
                      </SelectTrigger>
                      <SelectContent>
                        {huvudkategorier.map(kat => (
                          <SelectItem key={kat.id} value={kat.id}>
                            {kat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {currentTransaction.appCategoryId && underkategorierForHuvud.length > 0 && (
                      <Select
                        value={currentTransaction.appSubCategoryId || ''}
                        onValueChange={(value) => handleCategoryUpdate(currentTransaction.appCategoryId, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Välj underkategori" />
                        </SelectTrigger>
                        <SelectContent>
                          {underkategorierForHuvud.map(kat => (
                            <SelectItem key={kat.id} value={kat.id}>
                              {kat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>

              {/* Transaction type */}
              <div className="space-y-2">
                <Label>Transaktionstyp</Label>
                <TransactionTypeSelector
                  transaction={currentTransaction}
                  onTypeChange={handleTypeUpdate}
                />
              </div>


              {/* Action buttons */}
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTransferDialog(true)}
                    className="justify-start"
                  >
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    Intern överföring
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExpenseDialog(true)}
                    className="justify-start"
                    disabled={currentTransaction.amount >= 0}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Utlägg
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCostCoverageDialog(true)}
                    className="justify-start"
                    disabled={currentTransaction.amount <= 0}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Täck kostnad
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRuleDialog(true)}
                    className="justify-start"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Skapa regel
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSavingsDialog(true)}
                  className="justify-start w-full"
                  disabled={currentTransaction.amount <= 0}
                >
                  <PiggyBank className="h-4 w-4 mr-2" />
                  Länka sparande
                </Button>
              </div>
                </TabsContent>
                
                <TabsContent value="linked" className="p-4">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">
                      Länkningsstatus
                    </h4>
                    
                    {/* Linked Transaction (Internal Transfer) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Länkad intern överföring</span>
                        {currentTransaction.linkedTransactionId ? (
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="default" 
                              className="bg-green-100 text-green-700 border-green-300 cursor-pointer hover:bg-green-200 transition-colors"
                              onClick={() => handleLinkedTransactionClick(currentTransaction.linkedTransactionId)}
                            >
                              Länkad
                            </Badge>
                            <button
                              onClick={handleUnlinkInternalTransfer}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Ta bort länkning"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            Ej länkad
                          </Badge>
                        )}
                      </div>
                      {currentTransaction.linkedTransactionId && (
                        <div className="text-xs text-muted-foreground pl-4 border-l-2 border-green-200">
                          ID: {currentTransaction.linkedTransactionId.substring(0, 8)}...
                          <br />
                          Typ: Intern överföring
                        </div>
                      )}
                    </div>
                    
                    {/* Linked Cost (Expense/Coverage) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Länkad utlägg/kostnad</span>
                        {currentTransaction.linkedCostId ? (
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="default" 
                              className="bg-blue-100 text-blue-700 border-blue-300 cursor-pointer hover:bg-blue-200 transition-colors"
                              onClick={() => handleLinkedTransactionClick(currentTransaction.linkedCostId)}
                            >
                              Länkad
                            </Badge>
                            <button
                              onClick={handleUnlinkExpenseCost}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Ta bort länkning och återställ korrigerat belopp"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            Ej länkad
                          </Badge>
                        )}
                      </div>
                      {currentTransaction.linkedCostId && (
                        <div className="text-xs text-muted-foreground pl-4 border-l-2 border-blue-200">
                          ID: {currentTransaction.linkedCostId.substring(0, 8)}...
                          <br />
                          Typ: {currentTransaction.type === 'ExpenseClaim' ? 'Utlägg' : 'Kostnadstäckning'}
                        </div>
                      )}
                    </div>
                    
                    {/* Linked Savings Target */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Länkat sparande/sparmål</span>
                        {currentTransaction.savingsTargetId ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-300">
                              Länkad
                            </Badge>
                            <button
                              onClick={handleUnlinkSavings}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Ta bort länkning"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            Ej länkad
                          </Badge>
                        )}
                      </div>
                      {currentTransaction.savingsTargetId && (
                        <div className="text-xs text-muted-foreground pl-4 border-l-2 border-purple-200">
                          ID: {currentTransaction.savingsTargetId.substring(0, 8)}...
                          <br />
                          Typ: Sparande
                        </div>
                      )}
                    </div>
                    
                    {/* Linked Income Target */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Länkad inkomst</span>
                        {currentTransaction.incomeTargetId ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                              Länkad
                            </Badge>
                            <button
                              onClick={handleUnlinkIncome}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Ta bort länkning"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">
                            Ej länkad
                          </Badge>
                        )}
                      </div>
                      {currentTransaction.incomeTargetId && (
                        <div className="text-xs text-muted-foreground pl-4 border-l-2 border-yellow-200">
                          ID: {currentTransaction.incomeTargetId.substring(0, 8)}...
                          <br />
                          Typ: Inkomst
                        </div>
                      )}
                    </div>
                    
                    {/* Summary */}
                    <div className="mt-6 p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-muted-foreground text-center">
                        {[currentTransaction.linkedTransactionId, currentTransaction.linkedCostId, currentTransaction.savingsTargetId, currentTransaction.incomeTargetId].filter(Boolean).length} av 4 möjliga länkningar aktiva
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            className="flex-1"
            size="lg"
            onClick={handleApprove}
            disabled={!currentTransaction.appCategoryId}
          >
            <Check className="h-5 w-5 mr-2" />
            Godkänn
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex === uncategorizedTransactions.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Rule creation dialog */}
      {showRuleDialog && currentTransaction && (
        <CreateRuleDialog
          open={showRuleDialog}
          onOpenChange={(open) => setShowRuleDialog(open)}
          transaction={currentTransaction}
          accounts={accounts}
        />
      )}

      {/* Expense link dialog */}
      {showExpenseDialog && currentTransaction && (
        <ExpenseLinkDialog
          isOpen={showExpenseDialog}
          onClose={() => setShowExpenseDialog(false)}
          expenseTransaction={currentTransaction}
          transactions={transactions}
          onLink={(positiveTxId) => {
            // Find the transactions
            const expenseTransaction = currentTransaction; // negative transaction
            const coverageTransaction = transactions.find(tx => tx.id === positiveTxId); // positive transaction
            
            if (!coverageTransaction) {
              toast({
                title: "Fel",
                description: "Kunde inte hitta täckningstransaktionen.",
                variant: "destructive",
              });
              return;
            }
            
            // Calculate amounts
            const expenseAmount = Math.abs(expenseTransaction.amount);
            const coverageAmount = coverageTransaction.amount;
            const amountToCover = Math.min(expenseAmount, coverageAmount);
            
            const newExpenseCorrectedAmount = expenseTransaction.amount + amountToCover;
            const newCoverageCorrectedAmount = coverageAmount - amountToCover;
            
            console.log('🔗 Expense linking calculation:', {
              expenseAmount,
              coverageAmount,
              amountToCover,
              newExpenseCorrectedAmount,
              newCoverageCorrectedAmount,
              expenseId: expenseTransaction.id,
              coverageId: positiveTxId
            });
            
            // Update expense transaction (negative) - the selected one
            updateTransactionMutation.mutate({
              id: expenseTransaction.id,
              data: {
                type: 'ExpenseClaim',
                correctedAmount: newExpenseCorrectedAmount,
                linkedCostId: positiveTxId, // Points to the original transaction
                isManuallyChanged: 'true'
              }
            }, {
              onSuccess: () => {
                // Update coverage transaction (positive) - the original one
                updateTransactionMutation.mutate({
                  id: positiveTxId,
                  data: {
                    type: 'CostCoverage',
                    correctedAmount: newCoverageCorrectedAmount,
                    linkedCostId: expenseTransaction.id, // Points to the selected transaction
                    isManuallyChanged: 'true'
                  }
                }, {
                  onSuccess: () => {
                    setShowExpenseDialog(false);
                    toast({
                      title: "Utlägg länkat",
                      description: "Transaktionen har markerats som utlägg.",
                    });
                  },
                  onError: (error) => {
                    toast({
                      title: "Fel",
                      description: "Kunde inte uppdatera täckningstransaktionen.",
                      variant: "destructive",
                    });
                    console.error('Failed to update coverage transaction:', error);
                  }
                });
              },
              onError: (error) => {
                toast({
                  title: "Fel",
                  description: "Kunde inte uppdatera utläggstransaktionen.",
                  variant: "destructive",
                });
                console.error('Failed to update expense transaction:', error);
              }
            });
            // No auto-advance - user controls navigation
          }}
        />
      )}

      {/* Cost coverage dialog */}
      {showCostCoverageDialog && currentTransaction && (
        <CostCoverageDialog
          isOpen={showCostCoverageDialog}
          onClose={() => setShowCostCoverageDialog(false)}
          coverageTransaction={currentTransaction}
          transactions={transactions}
          onLink={(costTxId) => {
            // Find the transactions
            const coverageTransaction = currentTransaction; // positive transaction
            const costTransaction = transactions.find(tx => tx.id === costTxId); // negative transaction
            
            if (!costTransaction) {
              toast({
                title: "Fel",
                description: "Kunde inte hitta kostnadstransaktionen.",
                variant: "destructive",
              });
              return;
            }
            
            // Calculate amounts
            const costAmount = Math.abs(costTransaction.amount);
            const coverageAmount = coverageTransaction.amount;
            const amountToCover = Math.min(costAmount, coverageAmount);
            
            const newCostCorrectedAmount = costTransaction.amount + amountToCover;
            const newCoverageCorrectedAmount = coverageAmount - amountToCover;
            
            // Update cost transaction (negative) - the selected one
            updateTransactionMutation.mutate({
              id: costTxId,
              data: {
                type: 'ExpenseClaim',
                correctedAmount: newCostCorrectedAmount,
                linkedCostId: currentTransaction.id, // Points to the original transaction
                isManuallyChanged: 'true'
              }
            }, {
              onSuccess: () => {
                // Update coverage transaction (positive) - the original one
                updateTransactionMutation.mutate({
                  id: currentTransaction.id,
                  data: {
                    type: 'CostCoverage',
                    correctedAmount: newCoverageCorrectedAmount,
                    linkedCostId: costTxId, // Points to the selected transaction
                    isManuallyChanged: 'true'
                  }
                }, {
                  onSuccess: () => {
                    setShowCostCoverageDialog(false);
                    toast({
                      title: "Kostnad täckt",
                      description: "Transaktionen har länkats till kostnaden.",
                    });
                  },
                  onError: (error) => {
                    toast({
                      title: "Fel",
                      description: "Kunde inte uppdatera täckningstransaktionen.",
                      variant: "destructive",
                    });
                    console.error('Failed to update coverage transaction:', error);
                  }
                });
              },
              onError: (error) => {
                toast({
                  title: "Fel",
                  description: "Kunde inte uppdatera kostnadstransaktionen.",
                  variant: "destructive",
                });
                console.error('Failed to update cost transaction:', error);
              }
            });
            // No auto-advance - user controls navigation
          }}
        />
      )}

      {/* Savings link dialog */}
      {showSavingsDialog && currentTransaction && (
        <SavingsGoalLinkDialog
          isOpen={showSavingsDialog}
          onClose={() => setShowSavingsDialog(false)}
          transaction={currentTransaction}
          savingsGoals={savingsGoals}
          onLink={(savingsTargetId, mainCategoryId, subCategoryId) => {
            updateTransactionMutation.mutate({
              id: currentTransaction.id,
              data: {
                savingsTargetId: savingsTargetId,
                appCategoryId: mainCategoryId,
                appSubCategoryId: subCategoryId || null,
                type: 'savings',
                isManuallyChanged: 'true'
              }
            }, {
              onSuccess: () => {
                setShowSavingsDialog(false);
                toast({
                  title: "Sparande länkat",
                  description: "Transaktionen har länkats till sparmålet.",
                });
              },
              onError: (error) => {
                toast({
                  title: "Fel",
                  description: "Kunde inte länka transaktionen till sparmålet.",
                  variant: "destructive"
                });
                console.error('Failed to link savings transaction:', error);
              }
            });
            // No auto-advance - user controls navigation
          }}
        />
      )}

      {/* Internal transfer dialog */}
      {showTransferDialog && currentTransaction && (
        <SimpleTransferMatchDialog
          isOpen={showTransferDialog}
          onClose={() => setShowTransferDialog(false)}
          transaction={currentTransaction}
          suggestions={transactions.filter(tx => 
            tx.id !== currentTransaction.id && 
            Math.abs(tx.amount) === Math.abs(currentTransaction.amount) &&
            Math.abs(new Date(tx.date).getTime() - new Date(currentTransaction.date).getTime()) <= 7 * 24 * 60 * 60 * 1000 &&
            ((currentTransaction.amount < 0 && tx.amount > 0) || (currentTransaction.amount > 0 && tx.amount < 0)) // Opposite signs only
          )}
          onRefresh={async () => {
            // Refresh transactions data using React Query
            await refetchTransactions();
          }}
        />
      )}

      {/* Linked transaction view dialog */}
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
                    {format(new Date(linkedTransactionToShow.date), 'dd MMMM yyyy', { locale: sv })}
                    {linkedTransactionToShow.accountId && accounts.find(a => a.id === linkedTransactionToShow.accountId) && (
                      <> • {accounts.find(a => a.id === linkedTransactionToShow.accountId)?.name}</>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  {linkedTransactionToShow.correctedAmount !== null && linkedTransactionToShow.correctedAmount !== undefined ? (
                    <div>
                      <p className={cn("text-2xl font-bold", linkedTransactionToShow.correctedAmount < 0 ? "text-red-600" : "text-green-600")}>
                        {formatOrenAsCurrency(linkedTransactionToShow.correctedAmount)}
                      </p>
                      <p className="text-sm text-muted-foreground line-through">
                        Ursprungligt: {formatOrenAsCurrency(linkedTransactionToShow.amount)}
                      </p>
                      <p className="text-xs text-blue-600 font-medium">Korrigerat belopp</p>
                    </div>
                  ) : (
                    <p className={cn("text-2xl font-bold", linkedTransactionToShow.amount < 0 ? "text-red-600" : "text-green-600")}>
                      {formatOrenAsCurrency(linkedTransactionToShow.amount)}
                    </p>
                  )}
                </div>
              </div>

              {/* Transaction details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Typ</Label>
                  <Badge variant="outline" className="block w-fit mt-1">
                    {linkedTransactionToShow.type}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "block w-fit mt-1",
                      linkedTransactionToShow.status === 'green' && "bg-green-100 text-green-700 border-green-300",
                      linkedTransactionToShow.status === 'yellow' && "bg-yellow-100 text-yellow-700 border-yellow-300",
                      linkedTransactionToShow.status === 'red' && "bg-red-100 text-red-700 border-red-300"
                    )}
                  >
                    {linkedTransactionToShow.status === 'green' ? 'Godkänd' : 
                     linkedTransactionToShow.status === 'yellow' ? 'Granskning' : 'Behöver åtgärd'}
                  </Badge>
                </div>
              </div>

              {/* User note */}
              {linkedTransactionToShow.userDescription && (
                <div>
                  <Label className="text-xs text-muted-foreground">Anteckning</Label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded">{linkedTransactionToShow.userDescription}</p>
                </div>
              )}

              {/* Categories */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Huvudkategori</Label>
                  <p className="text-sm mt-1">
                    {linkedTransactionToShow.appCategoryId && huvudkategorier.find(h => h.id === linkedTransactionToShow.appCategoryId)?.name || 'Ej kategoriserad'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Underkategori</Label>
                  <p className="text-sm mt-1">
                    {linkedTransactionToShow.appSubCategoryId && underkategorier.find(u => u.id === linkedTransactionToShow.appSubCategoryId)?.name || 'Ej vald'}
                  </p>
                </div>
              </div>

              {/* Linking Status */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Länkningsstatus
                </h4>
                
                <div className="space-y-3">
                  {/* Linked Internal Transfer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Länkad intern överföring</span>
                      {linkedTransactionToShow.linkedTransactionId ? (
                        <Badge variant="default" className="bg-green-100 text-green-700 border-green-300">
                          Länkad
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          Ej länkad
                        </Badge>
                      )}
                    </div>
                    {linkedTransactionToShow.linkedTransactionId && (
                      <div className="text-xs text-muted-foreground pl-4 border-l-2 border-green-200">
                        ID: {linkedTransactionToShow.linkedTransactionId.substring(0, 8)}...
                        <br />
                        Typ: Intern överföring
                      </div>
                    )}
                  </div>
                  
                  {/* Linked Cost (Expense/Coverage) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Länkad utlägg/kostnad</span>
                      {linkedTransactionToShow.linkedCostId ? (
                        <Badge variant="default" className="bg-blue-100 text-blue-700 border-blue-300">
                          Länkad
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          Ej länkad
                        </Badge>
                      )}
                    </div>
                    {linkedTransactionToShow.linkedCostId && (
                      <div className="text-xs text-muted-foreground pl-4 border-l-2 border-blue-200">
                        ID: {linkedTransactionToShow.linkedCostId.substring(0, 8)}...
                        <br />
                        Typ: {linkedTransactionToShow.type === 'ExpenseClaim' ? 'Utlägg' : 'Kostnadstäckning'}
                      </div>
                    )}
                  </div>
                  
                  {/* Linked Savings Target */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Länkat sparande/sparmål</span>
                      {linkedTransactionToShow.savingsTargetId ? (
                        <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-300">
                          Länkad
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          Ej länkad
                        </Badge>
                      )}
                    </div>
                    {linkedTransactionToShow.savingsTargetId && (
                      <div className="text-xs text-muted-foreground pl-4 border-l-2 border-purple-200">
                        ID: {linkedTransactionToShow.savingsTargetId.substring(0, 8)}...
                        <br />
                        Typ: Sparande
                      </div>
                    )}
                  </div>
                  
                  {/* Linked Income Target */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Länkad inkomst</span>
                      {linkedTransactionToShow.incomeTargetId ? (
                        <Badge variant="default" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                          Länkad
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          Ej länkad
                        </Badge>
                      )}
                    </div>
                    {linkedTransactionToShow.incomeTargetId && (
                      <div className="text-xs text-muted-foreground pl-4 border-l-2 border-yellow-200">
                        ID: {linkedTransactionToShow.incomeTargetId.substring(0, 8)}...
                        <br />
                        Typ: Inkomst
                      </div>
                    )}
                  </div>
                  
                  {/* Summary */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-muted-foreground text-center">
                      {[linkedTransactionToShow.linkedTransactionId, linkedTransactionToShow.linkedCostId, linkedTransactionToShow.savingsTargetId, linkedTransactionToShow.incomeTargetId].filter(Boolean).length} av 4 möjliga länkningar aktiva
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction ID */}
              <div>
                <Label className="text-xs text-muted-foreground">Transaktions-ID</Label>
                <p className="text-xs font-mono mt-1 p-2 bg-gray-50 rounded">{linkedTransactionToShow.id}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Apply Rules Results Dialog */}
      {showApplyRulesResults && applyRulesResults && (
        <Dialog open={showApplyRulesResults} onOpenChange={setShowApplyRulesResults}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Regelapplicering genomförd
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Statistics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{applyRulesResults.stats.processed}</div>
                  <div className="text-sm text-muted-foreground">Behandlade</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{applyRulesResults.stats.updated}</div>
                  <div className="text-sm text-muted-foreground">Uppdaterade</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{applyRulesResults.stats.rulesApplied}</div>
                  <div className="text-sm text-muted-foreground">Regelträffar</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{applyRulesResults.stats.autoApproved}</div>
                  <div className="text-sm text-muted-foreground">Auto-godkända</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{applyRulesResults.stats.bankMatched}</div>
                  <div className="text-sm text-muted-foreground">Bankträffar</div>
                </div>
                <div className="text-center p-4 bg-indigo-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">{applyRulesResults.stats.autoMatched}</div>
                  <div className="text-sm text-muted-foreground">Auto-matchade</div>
                </div>
              </div>

              {/* Success Message */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-800">Regelapplicering slutförd</h4>
                    <p className="text-sm text-green-700 mt-1">
                      {applyRulesResults.stats.updated} av {applyRulesResults.stats.processed} transaktioner uppdaterades.
                      {applyRulesResults.stats.autoApproved > 0 && ` ${applyRulesResults.stats.autoApproved} transaktioner godkändes automatiskt.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Results */}
              {applyRulesResults.stats.updated > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Uppdateringsdetaljer</h4>
                  <div className="space-y-2 text-sm">
                    {applyRulesResults.stats.rulesApplied > 0 && (
                      <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                        <span>Regelbaserade kategoriseringar</span>
                        <Badge variant="outline" className="bg-purple-100 text-purple-700">
                          {applyRulesResults.stats.rulesApplied}
                        </Badge>
                      </div>
                    )}
                    {applyRulesResults.stats.bankMatched > 0 && (
                      <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                        <span>Bankkategori-matchningar</span>
                        <Badge variant="outline" className="bg-orange-100 text-orange-700">
                          {applyRulesResults.stats.bankMatched}
                        </Badge>
                      </div>
                    )}
                    {applyRulesResults.stats.autoMatched > 0 && (
                      <div className="flex items-center justify-between p-2 bg-indigo-50 rounded">
                        <span>Automatiskt matchade överföringar</span>
                        <Badge variant="outline" className="bg-indigo-100 text-indigo-700">
                          {applyRulesResults.stats.autoMatched}
                        </Badge>
                      </div>
                    )}
                    {applyRulesResults.stats.autoApproved > 0 && (
                      <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <span>Automatiskt godkända</span>
                        <Badge variant="outline" className="bg-green-100 text-green-700">
                          {applyRulesResults.stats.autoApproved}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Nästa steg</p>
                    <p>
                      Transaktionerna har uppdaterats automatiskt. Du kan fortsätta granska de återstående transaktionerna 
                      eller gå tillbaka för att se översikten.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={() => setShowApplyRulesResults(false)}>
                  Stäng
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}