import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Trash2, 
  Database,
  Link2,
  Target,
  DollarSign,
  Tags,
  Copy,
  RefreshCw,
  Bug
} from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { useHuvudkategorier, useUnderkategorier } from '@/hooks/useCategories';
import { useAccounts } from '@/hooks/useAccounts';
import { useAllBudgetPosts } from '@/hooks/useBudgetPosts';
import { useToast } from '@/hooks/use-toast';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';

interface VerificationError {
  transactionId: string;
  field: string;
  error: string;
  details?: any;
}

interface DuplicateGroup {
  key: string;
  transactions: any[];
  count: number;
}

export function DebugModePage() {
  const { toast } = useToast();
  const { data: transactions = [], refetch: refetchTransactions } = useTransactions();
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: underkategorier = [] } = useUnderkategorier();
  const { data: accounts = [] } = useAccounts();
  const { data: budgetPosts = [] } = useAllBudgetPosts();
  
  const [verificationErrors, setVerificationErrors] = useState<VerificationError[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);
  const [activeTab, setActiveTab] = useState('verification');
  const [fixingProgress, setFixingProgress] = useState<{field: string; current: number; total: number} | null>(null);

  // Verify Account IDs
  const verifyAccountIds = () => {
    const errors: VerificationError[] = [];
    const accountIds = new Set(accounts.map(a => a.id));
    
    transactions.forEach(tx => {
      if (tx.accountId && !accountIds.has(tx.accountId)) {
        errors.push({
          transactionId: tx.id,
          field: 'accountId',
          error: `Account ID ${tx.accountId} does not exist`,
          details: { accountId: tx.accountId, description: tx.description }
        });
      }
    });
    
    return errors;
  };

  // Verify Linked Transactions (bidirectional)
  const verifyLinkedTransactions = () => {
    const errors: VerificationError[] = [];
    const transactionMap = new Map(transactions.map(tx => [tx.id, tx]));
    
    transactions.forEach(tx => {
      if (tx.linkedTransactionId) {
        const linkedTx = transactionMap.get(tx.linkedTransactionId);
        
        if (!linkedTx) {
          errors.push({
            transactionId: tx.id,
            field: 'linkedTransactionId',
            error: `Linked transaction ${tx.linkedTransactionId} does not exist`,
            details: { linkedTransactionId: tx.linkedTransactionId, description: tx.description }
          });
        } else if (linkedTx.linkedTransactionId !== tx.id) {
          errors.push({
            transactionId: tx.id,
            field: 'linkedTransactionId',
            error: `Linked transaction is not bidirectional (other transaction points to ${linkedTx.linkedTransactionId})`,
            details: { 
              thisId: tx.id,
              linkedId: tx.linkedTransactionId,
              linkedPointsTo: linkedTx.linkedTransactionId,
              description: tx.description 
            }
          });
        }
      }
    });
    
    return errors;
  };

  // Verify Category IDs
  const verifyCategoryIds = () => {
    const errors: VerificationError[] = [];
    const huvudIds = new Set(huvudkategorier.map(h => h.id));
    const underIds = new Set(underkategorier.map(u => u.id));
    
    transactions.forEach(tx => {
      if (tx.appCategoryId && !huvudIds.has(tx.appCategoryId)) {
        errors.push({
          transactionId: tx.id,
          field: 'appCategoryId',
          error: `Main category ID ${tx.appCategoryId} does not exist`,
          details: { appCategoryId: tx.appCategoryId, description: tx.description }
        });
      }
      
      if (tx.appSubCategoryId && !underIds.has(tx.appSubCategoryId)) {
        errors.push({
          transactionId: tx.id,
          field: 'appSubCategoryId',
          error: `Subcategory ID ${tx.appSubCategoryId} does not exist`,
          details: { appSubCategoryId: tx.appSubCategoryId, description: tx.description }
        });
      }
      
      // Verify subcategory belongs to main category
      if (tx.appCategoryId && tx.appSubCategoryId) {
        const subcat = underkategorier.find(u => u.id === tx.appSubCategoryId);
        if (subcat && subcat.huvudkategoriId !== tx.appCategoryId) {
          errors.push({
            transactionId: tx.id,
            field: 'appSubCategoryId',
            error: `Subcategory does not belong to the main category`,
            details: { 
              appCategoryId: tx.appCategoryId,
              appSubCategoryId: tx.appSubCategoryId,
              expectedHuvudId: subcat.huvudkategoriId,
              description: tx.description 
            }
          });
        }
      }
    });
    
    return errors;
  };

  // Verify Savings Target IDs
  const verifySavingsTargets = () => {
    const errors: VerificationError[] = [];
    const savingsGoalIds = new Set(
      budgetPosts
        .filter(bp => bp.type === 'sparmål')
        .map(bp => bp.id)
    );
    
    transactions.forEach(tx => {
      if (tx.savingsTargetId && !savingsGoalIds.has(tx.savingsTargetId)) {
        errors.push({
          transactionId: tx.id,
          field: 'savingsTargetId',
          error: `Savings goal ${tx.savingsTargetId} does not exist`,
          details: { savingsTargetId: tx.savingsTargetId, description: tx.description }
        });
      }
    });
    
    return errors;
  };

  // Verify Income Target IDs
  const verifyIncomeTargets = () => {
    const errors: VerificationError[] = [];
    // Income targets are stored in budget_posts with type='income' or similar
    const incomePostIds = new Set(
      budgetPosts
        .filter(bp => bp.type === 'income' || bp.type === 'inkomst')
        .map(bp => bp.id)
    );
    
    transactions.forEach(tx => {
      if (tx.incomeTargetId && !incomePostIds.has(tx.incomeTargetId)) {
        errors.push({
          transactionId: tx.id,
          field: 'incomeTargetId',
          error: `Income target ${tx.incomeTargetId} does not exist`,
          details: { incomeTargetId: tx.incomeTargetId, description: tx.description }
        });
      }
    });
    
    return errors;
  };

  // Verify Linked Cost IDs (for expense claims and cost coverage)
  const verifyLinkedCosts = () => {
    const errors: VerificationError[] = [];
    const transactionMap = new Map(transactions.map(tx => [tx.id, tx]));
    
    transactions.forEach(tx => {
      if (tx.linkedCostId) {
        const linkedCostTx = transactionMap.get(tx.linkedCostId);
        
        if (!linkedCostTx) {
          errors.push({
            transactionId: tx.id,
            field: 'linkedCostId',
            error: `Linked cost transaction ${tx.linkedCostId} does not exist`,
            details: { linkedCostId: tx.linkedCostId, description: tx.description, type: tx.type }
          });
        } else {
          // Verify that the linked cost transaction also references back
          const hasBackReference = linkedCostTx.linkedCostId === tx.linkedCostId || 
                                  linkedCostTx.linkedCostId === tx.id;
          
          if (!hasBackReference && tx.type === 'ExpenseClaim') {
            // ExpenseClaim should point to the original expense
            // The CostCoverage should point to the same expense
            const coverageTransactions = Array.from(transactionMap.values())
              .filter(t => t.linkedCostId === tx.linkedCostId && t.type === 'CostCoverage');
            
            if (coverageTransactions.length === 0) {
              errors.push({
                transactionId: tx.id,
                field: 'linkedCostId',
                error: `ExpenseClaim has no corresponding CostCoverage`,
                details: { 
                  linkedCostId: tx.linkedCostId,
                  description: tx.description,
                  type: tx.type
                }
              });
            }
          }
        }
      }
    });
    
    return errors;
  };

  // Run all verifications
  const runAllVerifications = async () => {
    setIsVerifying(true);
    setVerificationErrors([]);
    
    try {
      const allErrors: VerificationError[] = [];
      
      // Run all verification checks
      allErrors.push(...verifyAccountIds());
      allErrors.push(...verifyLinkedTransactions());
      allErrors.push(...verifyCategoryIds());
      allErrors.push(...verifySavingsTargets());
      allErrors.push(...verifyIncomeTargets());
      allErrors.push(...verifyLinkedCosts());
      
      setVerificationErrors(allErrors);
      
      if (allErrors.length === 0) {
        toast({
          title: "✅ All verifications passed",
          description: "No integrity issues found in the database",
        });
      } else {
        toast({
          title: "⚠️ Verification completed",
          description: `Found ${allErrors.length} issues that need attention`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Error during verification",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Check for duplicate transactions
  const checkDuplicates = async () => {
    setIsDuplicateChecking(true);
    
    try {
      // Create duplicate key for each transaction
      const duplicateMap = new Map<string, any[]>();
      
      transactions.forEach(tx => {
        // Create a key based on account, date, amount, and description
        const normalizedDesc = tx.description?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
        const key = `${tx.accountId}_${tx.date}_${tx.amount}_${normalizedDesc}`;
        
        if (!duplicateMap.has(key)) {
          duplicateMap.set(key, []);
        }
        duplicateMap.get(key)!.push(tx);
      });
      
      // Filter to only keep actual duplicates
      const duplicateGroups: DuplicateGroup[] = [];
      duplicateMap.forEach((txs, key) => {
        if (txs.length > 1) {
          duplicateGroups.push({
            key,
            transactions: txs,
            count: txs.length
          });
        }
      });
      
      setDuplicates(duplicateGroups);
      
      if (duplicateGroups.length === 0) {
        toast({
          title: "✅ No duplicates found",
          description: "All transactions appear to be unique",
        });
      } else {
        const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0);
        toast({
          title: "⚠️ Duplicates found",
          description: `Found ${totalDuplicates} duplicate transactions in ${duplicateGroups.length} groups`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Duplicate check error:', error);
      toast({
        title: "Error checking duplicates",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsDuplicateChecking(false);
    }
  };

  // Fix invalid linked transaction IDs
  const fixLinkedTransactionIds = async (errors: VerificationError[]) => {
    if (!confirm(`⚠️ This will remove invalid linkedTransactionId from ${errors.length} transactions. Continue?`)) {
      return;
    }

    setFixingProgress({ field: 'linkedTransactionId', current: 0, total: errors.length });

    try {
      const transactionIds = errors.map(e => e.transactionId);
      
      setFixingProgress({ field: 'linkedTransactionId', current: 1, total: 1 });
      
      const response = await fetch('/api/transactions/fix-linked-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds, field: 'linkedTransactionId' }),
      });

      if (!response.ok) {
        throw new Error('Failed to fix linked transaction IDs');
      }

      const result = await response.json();
      
      setFixingProgress({ field: 'linkedTransactionId', current: 1, total: 1 });
      
      toast({
        title: "✅ Linked Transaction IDs fixed",
        description: `Removed invalid linkedTransactionId from ${result.updatedCount}/${result.totalRequested} transactions`,
      });

      // Refresh data and re-run verification
      await refetchTransactions();
      setTimeout(() => runAllVerifications(), 500);
    } catch (error) {
      toast({
        title: "Error fixing linked transaction IDs",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setFixingProgress(null);
    }
  };

  // Fix invalid savings target IDs  
  const fixSavingsTargetIds = async (errors: VerificationError[]) => {
    if (!confirm(`⚠️ This will remove invalid savingsTargetId from ${errors.length} transactions. Continue?`)) {
      return;
    }

    setFixingProgress({ field: 'savingsTargetId', current: 0, total: errors.length });

    try {
      const transactionIds = errors.map(e => e.transactionId);
      
      setFixingProgress({ field: 'savingsTargetId', current: 1, total: 1 });
      
      const response = await fetch('/api/transactions/fix-linked-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds, field: 'savingsTargetId' }),
      });

      if (!response.ok) {
        throw new Error('Failed to fix savings target IDs');
      }

      const result = await response.json();
      
      setFixingProgress({ field: 'savingsTargetId', current: 1, total: 1 });
      
      toast({
        title: "✅ Savings Target IDs fixed",
        description: `Removed invalid savingsTargetId from ${result.updatedCount}/${result.totalRequested} transactions`,
      });

      // Refresh data and re-run verification
      await refetchTransactions();
      setTimeout(() => runAllVerifications(), 500);
    } catch (error) {
      toast({
        title: "Error fixing savings target IDs",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setFixingProgress(null);
    }
  };

  // Fix invalid income target IDs
  const fixIncomeTargetIds = async (errors: VerificationError[]) => {
    if (!confirm(`⚠️ This will remove invalid incomeTargetId from ${errors.length} transactions. Continue?`)) {
      return;
    }

    setFixingProgress({ field: 'incomeTargetId', current: 0, total: errors.length });

    try {
      const transactionIds = errors.map(e => e.transactionId);
      
      setFixingProgress({ field: 'incomeTargetId', current: 1, total: 1 });
      
      const response = await fetch('/api/transactions/fix-linked-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds, field: 'incomeTargetId' }),
      });

      if (!response.ok) {
        throw new Error('Failed to fix income target IDs');
      }

      const result = await response.json();
      
      setFixingProgress({ field: 'incomeTargetId', current: 1, total: 1 });
      
      toast({
        title: "✅ Income Target IDs fixed",
        description: `Removed invalid incomeTargetId from ${result.updatedCount}/${result.totalRequested} transactions`,
      });

      // Refresh data and re-run verification
      await refetchTransactions();
      setTimeout(() => runAllVerifications(), 500);
    } catch (error) {
      toast({
        title: "Error fixing income target IDs",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setFixingProgress(null);
    }
  };

  // Fix invalid linked cost IDs
  const fixLinkedCostIds = async (errors: VerificationError[]) => {
    if (!confirm(`⚠️ This will remove invalid linkedCostId from ${errors.length} transactions. Continue?`)) {
      return;
    }

    setFixingProgress({ field: 'linkedCostId', current: 0, total: errors.length });

    try {
      const transactionIds = errors.map(e => e.transactionId);
      
      setFixingProgress({ field: 'linkedCostId', current: 1, total: 1 });
      
      const response = await fetch('/api/transactions/fix-linked-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds, field: 'linkedCostId' }),
      });

      if (!response.ok) {
        throw new Error('Failed to fix linked cost IDs');
      }

      const result = await response.json();
      
      setFixingProgress({ field: 'linkedCostId', current: 1, total: 1 });
      
      toast({
        title: "✅ Linked Cost IDs fixed",
        description: `Removed invalid linkedCostId from ${result.updatedCount}/${result.totalRequested} transactions`,
      });

      // Refresh data and re-run verification
      await refetchTransactions();
      setTimeout(() => runAllVerifications(), 500);
    } catch (error) {
      toast({
        title: "Error fixing linked cost IDs",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setFixingProgress(null);
    }
  };

  // NUCLEAR OPTION - Reset all user data
  const performDataReset = async () => {
    const confirmText = 'RESET ALL DATA';
    const userInput = prompt(
      `⚠️ EXTREMELY DANGEROUS OPERATION ⚠️\n\nThis will PERMANENTLY DELETE ALL of your data:\n\n• All transactions\n• All monthly account balances\n• All monthly budgets\n• All budget posts\n\nThis action CANNOT be undone and will completely reset your account.\n\nIf you are absolutely sure you want to proceed, type exactly: ${confirmText}`
    );
    
    if (userInput !== confirmText) {
      toast({
        title: "Operation cancelled",
        description: "Data reset was cancelled (incorrect confirmation text)",
      });
      return;
    }
    
    // Double confirmation
    if (!confirm('Last chance! Are you absolutely certain you want to delete ALL your data? This cannot be undone.')) {
      return;
    }
    
    setIsResettingData(true);
    
    try {
      const response = await fetch('/api/debug/reset-all-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to reset data: ${errorText}`);
      }
      
      const result = await response.json();
      
      toast({
        title: "✅ Data reset completed",
        description: `Deleted ${result.deletedTransactions} transactions, ${result.deletedBalances} balances, ${result.deletedBudgets} budgets, ${result.deletedPosts} budget posts`,
      });
      
      // Refresh all data
      await refetchTransactions();
      setDuplicates([]);
      setVerificationErrors([]);
      
      // Reload page to reset all cached data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Data reset error:', error);
      toast({
        title: "Error during data reset",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsResettingData(false);
    }
  };

  // Emergency cleanup - remove duplicates
  const performEmergencyCleanup = async () => {
    if (!confirm('⚠️ WARNING: This will delete duplicate transactions, keeping only the best version of each. This action cannot be undone. Continue?')) {
      return;
    }
    
    setIsCleaningUp(true);
    
    try {
      const response = await fetch('/api/transactions/cleanup-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error('Failed to cleanup duplicates');
      }
      
      const result = await response.json();
      
      toast({
        title: "✅ Cleanup completed",
        description: `Removed ${result.deletedCount} duplicate transactions`,
      });
      
      // Refresh data
      await refetchTransactions();
      setDuplicates([]);
    } catch (error) {
      console.error('Cleanup error:', error);
      toast({
        title: "Error during cleanup",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Group errors by field for better display
  const errorsByField = verificationErrors.reduce((acc, error) => {
    if (!acc[error.field]) {
      acc[error.field] = [];
    }
    acc[error.field].push(error);
    return acc;
  }, {} as Record<string, VerificationError[]>);

  // Get the appropriate fix function for each field
  const getFixFunction = (field: string) => {
    switch (field) {
      case 'linkedTransactionId':
        return fixLinkedTransactionIds;
      case 'savingsTargetId':
        return fixSavingsTargetIds;
      case 'incomeTargetId':
        return fixIncomeTargetIds;
      case 'linkedCostId':
        return fixLinkedCostIds;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Bug className="h-8 w-8 text-red-500" />
          DEBUG Mode
        </h1>
        <p className="text-muted-foreground">
          Advanced database verification and maintenance tools
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="verification">
            <Database className="h-4 w-4 mr-2" />
            Verification
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            <Copy className="h-4 w-4 mr-2" />
            Duplicates
          </TabsTrigger>
          <TabsTrigger value="cleanup">
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="verification" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Integrity Verification</CardTitle>
              <CardDescription>
                Verify all transaction links and references are valid
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => {
                    const errors = verifyAccountIds();
                    setVerificationErrors(errors);
                  }}
                  variant="outline"
                  className="justify-start"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Verify Account IDs
                </Button>
                
                <Button 
                  onClick={() => {
                    const errors = verifyLinkedTransactions();
                    setVerificationErrors(errors);
                  }}
                  variant="outline"
                  className="justify-start"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Verify Linked Transactions
                </Button>
                
                <Button 
                  onClick={() => {
                    const errors = verifyCategoryIds();
                    setVerificationErrors(errors);
                  }}
                  variant="outline"
                  className="justify-start"
                >
                  <Tags className="h-4 w-4 mr-2" />
                  Verify Categories
                </Button>
                
                <Button 
                  onClick={() => {
                    const errors = verifySavingsTargets();
                    setVerificationErrors(errors);
                  }}
                  variant="outline"
                  className="justify-start"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Verify Savings Goals
                </Button>
                
                <Button 
                  onClick={() => {
                    const errors = verifyIncomeTargets();
                    setVerificationErrors(errors);
                  }}
                  variant="outline"
                  className="justify-start"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Verify Income Targets
                </Button>
                
                <Button 
                  onClick={() => {
                    const errors = verifyLinkedCosts();
                    setVerificationErrors(errors);
                  }}
                  variant="outline"
                  className="justify-start"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Verify Cost Links
                </Button>
              </div>

              <div className="flex justify-center pt-4">
                <Button 
                  onClick={runAllVerifications}
                  disabled={isVerifying}
                  size="lg"
                  className="min-w-[200px]"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Run All Verifications
                    </>
                  )}
                </Button>
              </div>

              {fixingProgress && (
                <Alert className="mt-6">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <AlertTitle>Fixing {fixingProgress.field}</AlertTitle>
                  <AlertDescription>
                    Processing batch update for {fixingProgress.total} transactions...
                  </AlertDescription>
                </Alert>
              )}

              {verificationErrors.length > 0 && (
                <Alert variant="destructive" className="mt-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Found {verificationErrors.length} issues</AlertTitle>
                  <AlertDescription>
                    Review the errors below and fix the data integrity issues
                  </AlertDescription>
                </Alert>
              )}

              {Object.entries(errorsByField).map(([field, errors]) => {
                const fixFunction = getFixFunction(field);
                
                return (
                  <Card key={field} className="mt-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-500" />
                          {field} ({errors.length} issues)
                        </div>
                        {fixFunction && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => fixFunction(errors)}
                            disabled={fixingProgress?.field === field}
                            className="ml-4"
                          >
                            {fixingProgress?.field === field ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Processing batch...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Fix All ({errors.length})
                              </>
                            )}
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {errors.map((error, idx) => (
                            <div key={idx} className="text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
                              <div className="font-medium text-red-700 dark:text-red-300">
                                {error.error}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Transaction: {error.transactionId.substring(0, 8)}...
                                {error.details?.description && ` - ${error.details.description}`}
                              </div>
                              {error.details && (
                                <pre className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                                  {JSON.stringify(error.details, null, 2)}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                );
              })}

              {verificationErrors.length === 0 && !isVerifying && (
                <Alert className="mt-6">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle>No issues found</AlertTitle>
                  <AlertDescription>
                    Click "Run All Verifications" to check database integrity
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Duplicate Transaction Detection</CardTitle>
              <CardDescription>
                Find and manage duplicate transactions in the database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={checkDuplicates}
                disabled={isDuplicateChecking}
                size="lg"
                className="w-full"
              >
                {isDuplicateChecking ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Checking for duplicates...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Check for Duplicate Transactions
                  </>
                )}
              </Button>

              {duplicates.length > 0 && (
                <>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>
                      Found {duplicates.reduce((sum, g) => sum + g.count - 1, 0)} duplicate transactions
                    </AlertTitle>
                    <AlertDescription>
                      These transactions appear to be duplicates based on date, amount, and account
                    </AlertDescription>
                  </Alert>

                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {duplicates.map((group, idx) => (
                        <Card key={idx}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">
                              Duplicate Group #{idx + 1} ({group.count} transactions)
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {group.transactions.map((tx, tidx) => (
                                <div key={tidx} className="text-sm p-2 bg-gray-50 dark:bg-gray-900 rounded">
                                  <div className="flex justify-between">
                                    <span className="font-medium">{tx.description}</span>
                                    <span className="text-muted-foreground">
                                      {formatOrenAsCurrency(tx.amount)}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {tx.date} • ID: {tx.id.substring(0, 8)}...
                                    {tx.status && <Badge variant="outline" className="ml-2">{tx.status}</Badge>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cleanup" className="space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>⚠️ Emergency Cleanup Controls</AlertTitle>
            <AlertDescription>
              Use these tools with extreme caution. Actions cannot be undone.
            </AlertDescription>
          </Alert>

          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">
                Emergency Database Cleanup
              </CardTitle>
              <CardDescription>
                Remove duplicate transactions and fix database issues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <h3 className="font-semibold mb-2">Instructions:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>First run "Check for Duplicate Transactions" in the Duplicates tab</li>
                  <li>Review the duplicates carefully</li>
                  <li>Click "Emergency Cleanup" to remove duplicates</li>
                  <li>The system will keep the best version of each transaction</li>
                  <li>Page will refresh automatically after cleanup</li>
                </ol>
              </div>

              <Button 
                onClick={performEmergencyCleanup}
                disabled={isCleaningUp || duplicates.length === 0}
                variant="destructive"
                size="lg"
                className="w-full"
              >
                {isCleaningUp ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Cleaning up...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Emergency Cleanup ({duplicates.reduce((sum, g) => sum + g.count - 1, 0)} duplicates)
                  </>
                )}
              </Button>

              {duplicates.length === 0 && (
                <Alert>
                  <AlertDescription>
                    No duplicates detected. Run duplicate check first.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="border-red-600 dark:border-red-400 bg-red-50 dark:bg-red-950">
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                NUCLEAR OPTION - Complete Data Reset
              </CardTitle>
              <CardDescription className="text-red-600 dark:text-red-400">
                ⚠️ PERMANENTLY DELETE ALL USER DATA ⚠️
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-100 dark:bg-red-900/40 border border-red-300 rounded-lg">
                <h3 className="font-semibold mb-2 text-red-800 dark:text-red-200">What will be deleted:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
                  <li>ALL transactions (complete transaction history)</li>
                  <li>ALL monthly account balances (payday calculations)</li>
                  <li>ALL monthly budgets (budget configurations)</li>
                  <li>ALL budget posts (sparmål, income targets, etc.)</li>
                </ul>
                <p className="mt-3 text-xs text-red-600 dark:text-red-400 font-medium">
                  Categories, accounts, and rules will NOT be deleted.
                </p>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 rounded-lg">
                <h3 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">Use cases:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                  <li>Start completely fresh with a clean slate</li>
                  <li>Remove all financial data before sharing account</li>
                  <li>Reset after testing/development work</li>
                  <li>Troubleshoot severe data corruption issues</li>
                </ul>
              </div>

              <Button 
                onClick={performDataReset}
                disabled={isResettingData}
                variant="destructive"
                size="lg"
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                {isResettingData ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    DELETING ALL DATA...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    RESET ALL DATA (PERMANENT)
                  </>
                )}
              </Button>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This action is IRREVERSIBLE. Make sure you have exported any data you want to keep before proceeding.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}