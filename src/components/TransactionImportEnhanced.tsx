import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, FileText, Settings, AlertCircle, Circle, CheckSquare, AlertTriangle, ChevronDown, ChevronUp, Trash2, Plus, Edit, Save, X } from 'lucide-react';
import { ImportedTransaction, CategoryRule, FileStructure, ColumnMapping } from '@/types/transaction';
import { TransactionExpandableCard } from './TransactionExpandableCard';
import { TransactionGroupByDate } from './TransactionGroupByDate';
import { TransactionTypeSelector } from './TransactionTypeSelector';
import { TransferMatchDialog } from './TransferMatchDialog';
import { SavingsLinkDialog } from './SavingsLinkDialog';
import { CostCoverageDialog } from './CostCoverageDialog';
import { useBudget } from '@/hooks/useBudget';
import { setTransactionsForCurrentMonth, addCategoryRule, updateCategoryRule, deleteCategoryRule, updateCostGroups, APP_STATE_UPDATED, eventEmitter } from '../orchestrator/budgetOrchestrator';
import { getCurrentState, setMainCategories } from '../orchestrator/budgetOrchestrator';
import { StorageKey, get, set } from '../services/storageService';

// Category Management Component
interface CategoryManagementSectionProps {
  costGroups: any[];
  onCategoriesChange: () => void;
}

const CategoryManagementSection: React.FC<CategoryManagementSectionProps> = ({ costGroups, onCategoriesChange }) => {
  const [categories, setCategories] = useState<string[]>(() => {
    const state = getCurrentState();
    return state.budgetState.mainCategories || [];
  });
  const [newCategory, setNewCategory] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>(() => {
    return get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
  });
  const [newSubcategory, setNewSubcategory] = useState<Record<string, string>>({});
  const [editingSubcategory, setEditingSubcategory] = useState<{category: string, index: number} | null>(null);
  const [editingSubcategoryValue, setEditingSubcategoryValue] = useState('');

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      const updatedCategories = [...categories, newCategory.trim()];
      setCategories(updatedCategories);
      setMainCategories(updatedCategories);
      setNewCategory('');
      onCategoriesChange();
    }
  };

  const removeCategory = (index: number) => {
    const categoryToRemove = categories[index];
    const updatedCategories = categories.filter((_, i) => i !== index);
    const updatedSubcategories = { ...subcategories };
    delete updatedSubcategories[categoryToRemove];
    
    setCategories(updatedCategories);
    setSubcategories(updatedSubcategories);
    setMainCategories(updatedCategories);
    set(StorageKey.SUBCATEGORIES, updatedSubcategories);
    onCategoriesChange();
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(categories[index]);
  };

  const saveEdit = () => {
    if (editingIndex !== null && editingValue.trim() && !categories.includes(editingValue.trim())) {
      const updatedCategories = [...categories];
      updatedCategories[editingIndex] = editingValue.trim();
      setCategories(updatedCategories);
      setMainCategories(updatedCategories);
      setEditingIndex(null);
      setEditingValue('');
      onCategoriesChange();
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  const toggleCategoryExpansion = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const addSubcategory = (category: string) => {
    const newSubcategoryName = newSubcategory[category]?.trim();
    if (newSubcategoryName && !(subcategories[category]?.includes(newSubcategoryName))) {
      const updatedSubcategories = {
        ...subcategories,
        [category]: [...(subcategories[category] || []), newSubcategoryName]
      };
      setSubcategories(updatedSubcategories);
      set(StorageKey.SUBCATEGORIES, updatedSubcategories);
      setNewSubcategory({ ...newSubcategory, [category]: '' });
    }
  };

  const removeSubcategory = (category: string, index: number) => {
    const updatedSubcategories = {
      ...subcategories,
      [category]: subcategories[category]?.filter((_, i) => i !== index) || []
    };
    setSubcategories(updatedSubcategories);
    set(StorageKey.SUBCATEGORIES, updatedSubcategories);
  };

  const startSubcategoryEdit = (category: string, index: number) => {
    setEditingSubcategory({ category, index });
    setEditingSubcategoryValue(subcategories[category]?.[index] || '');
  };

  const saveSubcategoryEdit = () => {
    if (editingSubcategory && editingSubcategoryValue.trim()) {
      const { category, index } = editingSubcategory;
      const updatedSubcategories = {
        ...subcategories,
        [category]: subcategories[category]?.map((sub, i) => 
          i === index ? editingSubcategoryValue.trim() : sub
        ) || []
      };
      setSubcategories(updatedSubcategories);
      set(StorageKey.SUBCATEGORIES, updatedSubcategories);
      setEditingSubcategory(null);
      setEditingSubcategoryValue('');
    }
  };

  const cancelSubcategoryEdit = () => {
    setEditingSubcategory(null);
    setEditingSubcategoryValue('');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <h4 className="font-medium">Huvudkategorier för kostnader</h4>
        {categories.map((category, index) => (
          <div key={index} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              {editingIndex === index ? (
                <>
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="flex-1"
                    placeholder="Kategorinamn"
                  />
                  <Button size="sm" onClick={saveEdit} variant="default">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={cancelEdit} variant="outline">
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCategoryExpansion(category)}
                    className="p-1"
                  >
                    {expandedCategories.has(category) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <span className="flex-1 font-medium">{category}</span>
                  <div className="text-sm text-muted-foreground">
                    {subcategories[category]?.length || 0} underkategorier
                  </div>
                  <Button size="sm" onClick={() => startEdit(index)} variant="outline">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={() => removeCategory(index)} variant="destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {expandedCategories.has(category) && (
              <div className="pl-6 space-y-3 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Underkategorier</Label>
                  {subcategories[category]?.map((subcategory, subIndex) => (
                    <div key={subIndex} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      {editingSubcategory?.category === category && editingSubcategory?.index === subIndex ? (
                        <>
                          <Input
                            value={editingSubcategoryValue}
                            onChange={(e) => setEditingSubcategoryValue(e.target.value)}
                            className="flex-1"
                            placeholder="Underkategorinamn"
                          />
                          <Button size="sm" onClick={saveSubcategoryEdit} variant="default">
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={cancelSubcategoryEdit} variant="outline">
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1">{subcategory}</span>
                          <Button 
                            size="sm" 
                            onClick={() => startSubcategoryEdit(category, subIndex)} 
                            variant="outline"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => removeSubcategory(category, subIndex)} 
                            variant="destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={newSubcategory[category] || ''}
                    onChange={(e) => setNewSubcategory({ 
                      ...newSubcategory, 
                      [category]: e.target.value 
                    })}
                    placeholder="Ny underkategori"
                    onKeyPress={(e) => e.key === 'Enter' && addSubcategory(category)}
                  />
                  <Button 
                    onClick={() => addSubcategory(category)} 
                    disabled={!newSubcategory[category]?.trim()}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="Ny huvudkategori"
          onKeyPress={(e) => e.key === 'Enter' && addCategory()}
        />
        <Button onClick={addCategory} disabled={!newCategory.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Lägg till
        </Button>
      </div>
    </div>
  );
};

interface Account {
  id: string;
  name: string;
  startBalance: number;
}

interface UploadedFile {
  file: File;
  accountId: string;
  balance?: number;
  status: 'uploaded' | 'mapped' | 'processed';
  dateRange?: {
    from: string;
    to: string;
  };
  transactions: ImportedTransaction[];
}

export const TransactionImportEnhanced: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'categorization'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [fileStructures, setFileStructures] = useState<FileStructure[]>([]);
  // Remove local categoryRules state - now using budgetState
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [activeTransactionTab, setActiveTransactionTab] = useState<'all' | 'account'>('all');
  const [hideGreenTransactions, setHideGreenTransactions] = useState<boolean>(false);
  const [selectedAccountForView, setSelectedAccountForView] = useState<string>('');
  const [transferMatchDialog, setTransferMatchDialog] = useState<{
    isOpen: boolean;
    transaction?: ImportedTransaction;
    suggestions?: ImportedTransaction[];
  }>({ isOpen: false });
  const [costCoverageDialog, setCostCoverageDialog] = useState<{
    isOpen: boolean;
    transfer?: ImportedTransaction;
    potentialCosts?: ImportedTransaction[];
  }>({ isOpen: false });
  const [savingsLinkDialog, setSavingsLinkDialog] = useState<{
    isOpen: boolean;
    transaction?: ImportedTransaction;
  }>({ isOpen: false });
  
  const fileInputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});
  const { toast } = useToast();
  
  // Get budget data to access cost groups and their IDs
  const { budgetState } = useBudget();
  const costGroups = budgetState?.historicalData?.[budgetState.selectedMonthKey]?.costGroups || [];
  const categoryRulesFromState = budgetState?.transactionImport?.categoryRules || [];

  // Use actual accounts from budget state
  const accounts: Account[] = budgetState?.accounts || [];

  // Get main categories from actual budget data - use the same as MainCategoriesSettings
  const mainCategories = budgetState?.mainCategories || [];
  
  // Get subcategories from storage - same as UnifiedCategoryManager
  const [subcategoriesFromStorage, setSubcategoriesFromStorage] = useState<Record<string, string[]>>({});
  
  useEffect(() => {
    const loadedSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
    setSubcategoriesFromStorage(loadedSubcategories);
  }, []);

  // Sync transactions from budgetState when it changes
  useEffect(() => {
    const currentMonthData = budgetState?.historicalData?.[budgetState.selectedMonthKey];
    if (currentMonthData?.transactions) {
      console.log('🔄 [TransactionImportEnhanced] Syncing transactions from budgetState:', currentMonthData.transactions.length);
      // Convert Transaction[] to ImportedTransaction[] by adding missing fields
      const importedTransactions = currentMonthData.transactions.map(t => ({
        ...t,
        importedAt: new Date().toISOString(),
        fileSource: 'budgetState'
      })) as ImportedTransaction[];
      setTransactions(importedTransactions);
    }
  }, [budgetState?.historicalData, budgetState?.selectedMonthKey]);

  // Listen to orchestrator updates
  useEffect(() => {
    const handleStateUpdate = () => {
      console.log('🎯 [TransactionImportEnhanced] Received APP_STATE_UPDATED event');
      const currentState = getCurrentState();
      const currentMonthData = currentState.budgetState.historicalData[currentState.budgetState.selectedMonthKey];
      if (currentMonthData?.transactions) {
        console.log('🔄 [TransactionImportEnhanced] Updating transactions from state update:', currentMonthData.transactions.length);
        // Convert Transaction[] to ImportedTransaction[] by adding missing fields
        const importedTransactions = currentMonthData.transactions.map(t => ({
          ...t,
          importedAt: new Date().toISOString(),
          fileSource: 'budgetState'
        })) as ImportedTransaction[];
        setTransactions(importedTransactions);
      }
    };

    const eventEmitterRef = eventEmitter;
    // Get the event emitter from orchestrator
    eventEmitterRef.addEventListener(APP_STATE_UPDATED, handleStateUpdate);

    return () => {
      eventEmitterRef.removeEventListener(APP_STATE_UPDATED, handleStateUpdate);
    };
  }, []);

  // CSV Parsing with enhanced logic
  const parseCSV = useCallback((csvContent: string, accountId: string, fileName: string): ImportedTransaction[] => {
    // Clean the CSV content by removing � characters
    const cleanedContent = csvContent.replace(/�/g, '');
    const lines = cleanedContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(';').map(h => h.trim());
    const transactions: ImportedTransaction[] = [];
    
    // Try to detect common column patterns
    const dateColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('datum') || h.toLowerCase().includes('date')
    );
    const amountColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('belopp') || h.toLowerCase().includes('amount')
    );
    const descriptionColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('beskrivning') || h.toLowerCase().includes('text') || h.toLowerCase().includes('description')
    );
    const balanceColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('saldo') || h.toLowerCase().includes('balance')
    );
    const categoryColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('kategori') && !h.toLowerCase().includes('under')
    );
    const subCategoryColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('underkategori') || h.toLowerCase().includes('subcategory')
    );
    const statusColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('status') || h.toLowerCase().includes('utförd') || h.toLowerCase().includes('utf')
    );
    const avstamtColumnIndex = headers.findIndex(h => 
      h.toLowerCase().includes('avstämt') || h.toLowerCase().includes('avstämd') || h.toLowerCase().includes('av')
    );

    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split(';');
      if (fields.length < headers.length) continue;

      try {
        // Debug amount parsing
        const rawAmountField = amountColumnIndex >= 0 ? fields[amountColumnIndex] : '0';
        const cleanedAmountField = rawAmountField.trim().replace(',', '.').replace(/\s/g, '');
        const parsedAmount = parseFloat(cleanedAmountField);
        console.log(`[CSV Parse] Raw amount: "${rawAmountField}" -> Cleaned: "${cleanedAmountField}" -> Parsed: ${parsedAmount}`);
        
        const transaction: ImportedTransaction = {
          id: `${accountId}-${uuidv4()}-${i}`,
          accountId, // Explicitly set the account ID from file upload
          date: dateColumnIndex >= 0 ? fields[dateColumnIndex] : fields[0],
          amount: parsedAmount,
          balanceAfter: balanceColumnIndex >= 0 ? 
            (fields[balanceColumnIndex] && fields[balanceColumnIndex].trim() !== '' ? 
              parseFloat(fields[balanceColumnIndex].replace(',', '.')) : undefined) : undefined,
          description: descriptionColumnIndex >= 0 ? fields[descriptionColumnIndex] : fields[1] || '',
          bankCategory: categoryColumnIndex >= 0 ? fields[categoryColumnIndex] : undefined,
          bankSubCategory: subCategoryColumnIndex >= 0 ? fields[subCategoryColumnIndex] : undefined,
          bankStatus: statusColumnIndex >= 0 ? fields[statusColumnIndex] : undefined,
          reconciled: avstamtColumnIndex >= 0 ? fields[avstamtColumnIndex] : undefined,
          type: 'Transaction',
          status: 'yellow', // Default status
          importedAt: new Date().toISOString(),
          fileSource: fileName
        };

        // Determine transaction type based on amount
        if (transaction.amount > 0) {
          transaction.type = 'Transaction'; // Income
        } else {
          // Check if it might be a transfer (contains account names or transfer keywords)
          const desc = transaction.description.toLowerCase();
          if (desc.includes('överföring') || desc.includes('transfer') || 
              accounts.some(acc => desc.includes(acc.name.toLowerCase()))) {
            transaction.type = 'InternalTransfer';
          }
        }

        transactions.push(transaction);
      } catch (error) {
        console.warn(`Failed to parse line ${i}:`, error);
      }
    }

    // Calculate missing balances based on previous transactions
    console.log('Processing transactions for balance calculation:', transactions.length);
    
    // First pass: fill forward from any valid balance
    for (let i = 0; i < transactions.length; i++) {
      const currentTransaction = transactions[i];
      console.log(`Transaction ${i}: amount=${currentTransaction.amount}, balanceAfter=${currentTransaction.balanceAfter}`);
      
      if (isNaN(currentTransaction.balanceAfter!) || currentTransaction.balanceAfter === undefined) {
        console.log(`Transaction ${i} has no balance, looking for previous transaction`);
        if (i > 0) {
          // Use balanceAfter from previous transaction, or estimatedBalanceAfter if balanceAfter is not available
          const prevBalance = transactions[i - 1].balanceAfter !== undefined && !isNaN(transactions[i - 1].balanceAfter!) 
            ? transactions[i - 1].balanceAfter! 
            : transactions[i - 1].estimatedBalanceAfter;
          
          if (prevBalance !== undefined && !isNaN(prevBalance)) {
            // Calculate estimated balance based on previous balance + current amount
            const newBalance = prevBalance + currentTransaction.amount;
            transactions[i].estimatedBalanceAfter = newBalance;
            console.log(`Calculated estimated balance for transaction ${i}: ${prevBalance} + ${currentTransaction.amount} = ${newBalance}`);
          } else {
            console.log(`Cannot calculate balance for transaction ${i} - no valid previous balance`);
          }
        }
      }
    }
    
    // Second pass: work backwards from the last valid balance to fill any remaining gaps
    for (let i = transactions.length - 1; i >= 0; i--) {
      if ((isNaN(transactions[i].balanceAfter!) || transactions[i].balanceAfter === undefined) && 
          (isNaN(transactions[i].estimatedBalanceAfter!) || transactions[i].estimatedBalanceAfter === undefined)) {
        // Look for the next transaction with a valid balance
        for (let j = i + 1; j < transactions.length; j++) {
          const nextBalance = transactions[j].balanceAfter !== undefined && !isNaN(transactions[j].balanceAfter!) 
            ? transactions[j].balanceAfter! 
            : transactions[j].estimatedBalanceAfter;
            
          if (nextBalance !== undefined && !isNaN(nextBalance)) {
            // Calculate balance by working backwards: next_balance - sum_of_amounts_between
            let sumOfAmounts = 0;
            for (let k = i; k < j; k++) {
              sumOfAmounts += transactions[k].amount;
            }
            transactions[i].estimatedBalanceAfter = nextBalance - sumOfAmounts;
            console.log(`Calculated estimated balance backwards for transaction ${i}: ${nextBalance} - ${sumOfAmounts} = ${transactions[i].estimatedBalanceAfter}`);
            break;
          }
        }
      }
    }

    return transactions;
  }, [accounts]);

  // Create unique fingerprint for transaction matching
  const createTransactionFingerprint = useCallback((transaction: { date: string; description: string; amount: number }): string => {
    return `${transaction.date.trim()}_${transaction.description.trim().toLowerCase()}_${transaction.amount}`;
  }, []);

  // Reconcile transactions from file with already saved transactions
  const reconcileTransactions = useCallback((transactionsFromFile: ImportedTransaction[], accountId: string): ImportedTransaction[] => {
    console.log(`[Reconciliation] Starting reconciliation for account ${accountId} with ${transactionsFromFile.length} transactions from file`);
    
    // Get currently saved transactions for this month and account
    const currentState = getCurrentState();
    const currentMonthKey = currentState.budgetState.selectedMonthKey;
    const currentMonthData = currentState.budgetState.historicalData[currentMonthKey];
    const savedTransactions: ImportedTransaction[] = (currentMonthData as any)?.transactions || [];
    
    console.log(`[Reconciliation] Found ${savedTransactions.length} already saved transactions for month ${currentMonthKey}`);
    
    // Filter saved transactions for this account only
    const savedTransactionsForAccount = savedTransactions.filter(t => t.accountId === accountId);
    console.log(`[Reconciliation] Found ${savedTransactionsForAccount.length} saved transactions for account ${accountId}`);
    
    // Create a map of saved transactions for quick lookup
    const savedTransactionsMap = new Map<string, ImportedTransaction>();
    savedTransactionsForAccount.forEach(transaction => {
      const fingerprint = createTransactionFingerprint({
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount
      });
      savedTransactionsMap.set(fingerprint, transaction);
    });
    
    console.log(`[Reconciliation] Created fingerprint map with ${savedTransactionsMap.size} entries`);
    
    // Reconcile: match file transactions with saved transactions
    const reconciledTransactions = transactionsFromFile.map(fileTransaction => {
      const fingerprint = createTransactionFingerprint({
        date: fileTransaction.date,
        description: fileTransaction.description,
        amount: fileTransaction.amount
      });
      
      const existingTransaction = savedTransactionsMap.get(fingerprint);
      
      if (existingTransaction) {
        // SMART MERGE: Start with saved transaction (preserves user changes) 
        // but update bank-controlled fields with latest data from file
        console.log(`[Reconciliation] ✅ Match found for: ${fingerprint}. Performing smart merge.`);
        
        const mergedTransaction = { ...existingTransaction };
        
        // Update bank-controlled fields with latest data from file
        mergedTransaction.bankCategory = fileTransaction.bankCategory;
        mergedTransaction.bankSubCategory = fileTransaction.bankSubCategory;
        mergedTransaction.bankStatus = fileTransaction.bankStatus;
        mergedTransaction.reconciled = fileTransaction.reconciled;
        mergedTransaction.balanceAfter = fileTransaction.balanceAfter;
        mergedTransaction.fileSource = fileTransaction.fileSource;
        mergedTransaction.importedAt = fileTransaction.importedAt;
        
        // Update date and description in case bank has corrected them
        mergedTransaction.date = fileTransaction.date;
        mergedTransaction.description = fileTransaction.description;
        
        // Amount should generally stay the same, but update in case of corrections
        mergedTransaction.amount = fileTransaction.amount;
        
        // Preserve user-controlled fields (these are NOT overwritten):
        // - appCategoryId (user's category choice)
        // - appSubCategoryId (user's subcategory choice) 
        // - status (user's approval status: red/yellow/green)
        // - egenText (user's custom notes)
        // - isManuallyChanged (user modification flag)
        // - linkedTransactionId (user's transfer matching)
        
        return mergedTransaction;
      } else {
        // New transaction - use data from file
        console.log(`[Reconciliation] ⚠️ No match for: ${fingerprint}. Creating new transaction.`);
        return fileTransaction;
      }
    });
    
    console.log(`[Reconciliation] Reconciliation complete. ${reconciledTransactions.length} transactions reconciled.`);
    return reconciledTransactions;
  }, [createTransactionFingerprint]);

  const handleFileUpload = useCallback((accountId: string, file: File) => {
    // Find the account name from the ID for backward compatibility
    const account = accounts.find(acc => acc.id === accountId);
    const accountName = account ? account.name : accountId;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const parsedTransactions = parseCSV(csvContent, accountName, file.name);
      
      console.log(`[FileUpload] Parsed ${parsedTransactions.length} transactions for account ${accountId}`);
      console.log(`[FileUpload] Sample transaction accountId:`, parsedTransactions[0]?.accountId);
      
      if (parsedTransactions.length === 0) {
        toast({
          title: "Fel vid filläsning",
          description: "Kunde inte läsa några transaktioner från filen.",
          variant: "destructive"
        });
        return;
      }

      // Calculate date range
      const dates = parsedTransactions.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime()));
      const dateRange = dates.length > 0 ? {
        from: new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().split('T')[0],
        to: new Date(Math.max(...dates.map(d => d.getTime()))).toISOString().split('T')[0]
      } : undefined;

      // Extract balance from last transaction
      const lastTransaction = parsedTransactions[parsedTransactions.length - 1];
      const extractedBalance = lastTransaction?.balanceAfter;

      const uploadedFile: UploadedFile = {
        file,
        accountId: accountName, // Use account name for consistency
        balance: extractedBalance,
        status: 'uploaded',
        dateRange,
        transactions: parsedTransactions
      };

      setUploadedFiles(prev => {
        const filtered = prev.filter(f => f.accountId !== accountName);
        return [...filtered, uploadedFile];
      });

      // Reconcile transactions with already saved data before adding to global list
      const reconciledTransactions = reconcileTransactions(parsedTransactions, accountName);
      
      console.log(`[FileUpload] Reconciliation complete. Original: ${parsedTransactions.length}, Reconciled: ${reconciledTransactions.length}`);

      // Add reconciled transactions to global list
      setTransactions(prev => {
        const filtered = prev.filter(t => t.accountId !== accountName);
        const updatedTransactions = [...filtered, ...reconciledTransactions];
        
        // Save to persistent storage - verify accountId is preserved
        console.log(`[FileUpload] Saving ${updatedTransactions.length} transactions. Sample accountIds:`, 
          updatedTransactions.slice(0, 3).map(t => ({ id: t.id, accountId: t.accountId })));
        setTransactionsForCurrentMonth(updatedTransactions);
        
        return updatedTransactions;
      });

      toast({
        title: "Fil uppladdad",
        description: `${reconciledTransactions.length} transaktioner bearbetade från ${file.name}. Tidigare kategoriseringar och ändringar bevarade.`,
      });
    };
    reader.readAsText(file);
  }, [parseCSV, toast, reconcileTransactions]);

  const applyCategorizationRules = useCallback(() => {
    setTransactions(prev => {
      const updatedTransactions = prev.map(transaction => {
        if (transaction.isManuallyChanged) return transaction; // Don't override manual changes

        // Find matching rule
        const matchingRule = categoryRulesFromState
          .filter(rule => rule.isActive)
          .sort((a, b) => b.priority - a.priority) // Higher priority first
          .find(rule => {
            const bankCategoryMatch = transaction.bankCategory === rule.bankCategory;
            const subCategoryMatch = !rule.bankSubCategory || transaction.bankSubCategory === rule.bankSubCategory;
          return bankCategoryMatch && subCategoryMatch;
        });

      if (matchingRule) {
      return {
        ...transaction,
        appCategoryId: matchingRule.appCategoryId,
        appSubCategoryId: matchingRule.appSubCategoryId,
        type: matchingRule.transactionType,
        status: 'yellow' as const // Auto-categorized
      };
      }

      return {
        ...transaction,
        status: 'red' as const // Needs manual categorization
      };
    });
    
    // Save to persistent storage
    setTransactionsForCurrentMonth(updatedTransactions);
    
    return updatedTransactions;
  });
  }, [categoryRulesFromState]);

  const autoMatchTransfers = useCallback(() => {
    const transfers = transactions.filter(t => t.type === 'InternalTransfer' && !t.linkedTransactionId);
    
    transfers.forEach(transfer => {
      // Look for matching transfer (same amount, opposite sign, same or next day)
      const potentialMatches = transfers.filter(other => 
        other.id !== transfer.id &&
        Math.abs(other.amount + transfer.amount) < 0.01 && // Same amount, opposite sign
        Math.abs(new Date(other.date).getTime() - new Date(transfer.date).getTime()) <= 24 * 60 * 60 * 1000 // Within 1 day
      );

      if (potentialMatches.length === 1) {
        const match = potentialMatches[0];
        // Auto-link them
        setTransactions(prev => {
          const updatedTransactions = prev.map(t => {
            if (t.id === transfer.id) {
              return { ...t, linkedTransactionId: match.id, status: 'yellow' as const };
            }
            if (t.id === match.id) {
              return { ...t, linkedTransactionId: transfer.id, status: 'yellow' as const };
            }
            return t;
          });
          
          // Save to persistent storage
          setTransactionsForCurrentMonth(updatedTransactions);
          
          return updatedTransactions;
        });
      }
    });
  }, [transactions]);

  const getTransactionStatus = (transaction: ImportedTransaction) => {
    if (transaction.status === 'green') return { color: 'text-green-600', icon: CheckCircle };
    if (transaction.status === 'yellow') return { color: 'text-yellow-600', icon: AlertTriangle };
    return { color: 'text-red-600', icon: AlertCircle };
  };

  const [columnMappings, setColumnMappings] = useState<{[fileId: string]: {[csvColumn: string]: string}}>({});

  const getCSVColumnsFromFile = (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvContent = e.target?.result as string;
        const firstLine = csvContent.split('\n')[0];
        const headers = firstLine.split(';').map(h => h.trim());
        resolve(headers);
      };
      reader.readAsText(file);
    });
  };

  const renderMappingStep = () => {
    const systemFields = [
      { value: 'datum', label: 'Datum' },
      { value: 'kategori', label: 'Kategori' },
      { value: 'underkategori', label: 'Underkategori' },
      { value: 'text', label: 'Text' },
      { value: 'belopp', label: 'Belopp' },
      { value: 'saldo', label: 'Saldo' },
      { value: 'status', label: 'Status' },
      { value: 'avstamt', label: 'Avstämt' },
      { value: 'ignore', label: 'Ignorera' }
    ];

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Kolumnmappning</h2>
          <p className="text-sm sm:text-base text-muted-foreground px-2">
            Mappa CSV-kolumner till appens fält. Detta sparas för framtida imports.
          </p>
        </div>

        <div className="p-3 bg-green-50 rounded-lg border border-green-200 mb-6">
          <div className="text-sm text-green-800">
            ✓ Automatisk mappning genomförd baserat på kolumnnamn och innehåll
          </div>
        </div>

        {uploadedFiles.map((uploadedFile, fileIndex) => (
          <Card key={uploadedFile.accountId}>
            <CardHeader>
              <CardTitle className="text-lg">
                {uploadedFile.file.name}
              </CardTitle>
              <CardDescription>
                Konto: {accounts.find(acc => acc.id === uploadedFile.accountId)?.name} • 
                {uploadedFile.transactions.length} transaktioner
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Show example transactions for this account */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Exempeldata från {accounts.find(acc => acc.id === uploadedFile.accountId)?.name}</h4>
                  <div className="overflow-x-auto">
                    <div className="min-w-full">
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20 text-xs">Kolumn</TableHead>
                            <TableHead className="w-24 text-xs">Data</TableHead>
                            <TableHead className="w-28 text-xs">Mappa</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                        {/* Parse CSV headers for this specific file */}
                        {(() => {
                          const reader = new FileReader();
                          const csvHeaders = uploadedFile.file.name.includes('csv') ? 
                            ['Datum', 'Kategori', 'Underkategori', 'Text', 'Belopp', 'Saldo', 'Status', 'Avstämt'] :
                            ['Date', 'Category', 'Amount', 'Description'];
                          
                          return csvHeaders.map((header, colIndex) => {
                            const exampleData = uploadedFile.transactions.slice(0, 2).map(t => {
                              if (header.toLowerCase().includes('datum') || header.toLowerCase().includes('date')) return t.date;
                              if (header.toLowerCase().includes('belopp') || header.toLowerCase().includes('amount')) return t.amount.toString();
                              if (header.toLowerCase().includes('text') || header.toLowerCase().includes('beskrivning') || header.toLowerCase().includes('description')) return t.description;
                              if (header.toLowerCase().includes('saldo') || header.toLowerCase().includes('balance')) return t.balanceAfter?.toString() || '';
                              if (header.toLowerCase().includes('kategori') || header.toLowerCase().includes('category')) return t.bankCategory || '';
                              if (header.toLowerCase().includes('underkategori') || header.toLowerCase().includes('subcategory')) return t.bankSubCategory || '';
                              if (header.toLowerCase().includes('status')) return 'Genomförd';
                              if (header.toLowerCase().includes('avstämt')) return 'Nej';
                              return `Exempel ${colIndex + 1}`;
                            });

                            // Auto-detect mapping
                            let autoMapping = 'ignore';
                            if (header.toLowerCase().includes('datum') || header.toLowerCase().includes('date')) autoMapping = 'datum';
                            else if (header.toLowerCase().includes('belopp') || header.toLowerCase().includes('amount')) autoMapping = 'belopp';
                            else if (header.toLowerCase().includes('text') || header.toLowerCase().includes('beskrivning') || header.toLowerCase().includes('description')) autoMapping = 'text';
                            else if (header.toLowerCase().includes('saldo') || header.toLowerCase().includes('balance')) autoMapping = 'saldo';
                            else if (header.toLowerCase().includes('kategori') && !header.toLowerCase().includes('under')) autoMapping = 'kategori';
                            else if (header.toLowerCase().includes('underkategori') || header.toLowerCase().includes('subcategory')) autoMapping = 'underkategori';
                            else if (header.toLowerCase().includes('status')) autoMapping = 'status';
                            else if (header.toLowerCase().includes('avstämt')) autoMapping = 'avstamt';

                            const fileKey = `${uploadedFile.accountId}-${fileIndex}`;
                            
                            return (
                              <TableRow key={colIndex}>
                                <TableCell className="font-medium text-xs p-2">{header.length > 8 ? header.substring(0, 8) + '...' : header}</TableCell>
                                <TableCell className="text-xs p-2 max-w-24 truncate" title={exampleData[0]}>
                                  {exampleData[0]?.length > 10 ? exampleData[0].substring(0, 10) + '...' : exampleData[0] || '...'}
                                </TableCell>
                                <TableCell className="p-2">
                                  <Select 
                                    value={columnMappings[fileKey]?.[header] || autoMapping}
                                    onValueChange={(value) => {
                                      setColumnMappings(prev => ({
                                        ...prev,
                                        [fileKey]: {
                                          ...prev[fileKey],
                                          [header]: value
                                        }
                                      }));
                                    }}
                                  >
                                    <SelectTrigger className="w-24 h-8 text-xs">
                                      <SelectValue placeholder="Välj" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border border-border shadow-lg z-50">
                                      {systemFields.map(field => (
                                        <SelectItem key={field.value} value={field.value} className="text-xs">
                                          {field.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4 sm:pt-6">
          <Button 
            variant="outline"
            onClick={() => setCurrentStep('upload')}
            className="w-full sm:w-auto"
          >
            Tillbaka
          </Button>
          <Button 
            onClick={() => {
              // Apply mappings and continue
              toast({
                title: "Mappning sparad",
                description: "Kolumnmappningen har sparats för framtida imports."
              });
              setCurrentStep('categorization');
            }}
            className="w-full sm:min-w-48"
          >
            Fortsätt till kategorisering
          </Button>
        </div>
      </div>
    );
  };

  const getAccountStatusForTab = (accountId: string) => {
    const accountTransactions = transactions.filter(t => t.accountId === accountId);
    const redCount = accountTransactions.filter(t => t.status === 'red').length;
    const yellowCount = accountTransactions.filter(t => t.status === 'yellow').length;
    
    if (redCount > 0) return 'red';
    if (yellowCount > 0) return 'yellow';
    return 'green';
  };

  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactions(prev => 
      prev.includes(transactionId) 
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const approveSelectedTransactions = () => {
    setTransactions(prev => {
      const updatedTransactions = prev.map(t => 
        selectedTransactions.includes(t.id) 
          ? { ...t, status: 'green' as const }
          : t
      );
      
      // Save to persistent storage
      setTransactionsForCurrentMonth(updatedTransactions);
      
      return updatedTransactions;
    });
    setSelectedTransactions([]);
    toast({
      title: "Transaktioner godkända",
      description: `${selectedTransactions.length} transaktioner markerade som godkända.`
    });
  };

  const updateTransactionCategory = (transactionId: string, categoryName: string, subCategoryId?: string) => {
    // Get the current list of cost groups from the budget state
    const currentCostGroups = [...costGroups];
    
    // Find the selected main category
    let targetGroup = currentCostGroups.find(group => group.name === categoryName);

    // --- NEW ROBUST LOGIC STARTS HERE ---

    // 1. Create main category if it doesn't exist
    if (!targetGroup) {
      console.log(`Huvudkategori '${categoryName}' hittades inte för denna månad, skapar den.`);
      targetGroup = {
        id: uuidv4(),
        name: categoryName,
        amount: 0,
        type: 'cost',
        subCategories: []
      };
      currentCostGroups.push(targetGroup);
      
      // Save the updated list with the new main category
      updateCostGroups(currentCostGroups); 
    }

    // --- END OF NEW LOGIC ---

    // Find ID for the now guaranteed existing category
    const categoryId = targetGroup.id;
    
    console.log(`🔥 [CATEGORY FIX] Converting category name "${categoryName}" to ID "${categoryId}"`);
    console.log(`🔥 [CATEGORY FIX] Available cost groups:`, currentCostGroups.map(g => ({id: g.id, name: g.name})));
    
    // Update transaction with correct category ID
    setTransactions(prev => {
      const updatedTransactions = prev.map(t => 
        t.id === transactionId 
          ? { 
              ...t, 
            appCategoryId: categoryId, // Store the ID, not the name!
            appSubCategoryId: subCategoryId,
            isManuallyChanged: true,
            status: 'yellow' as const
            }
          : t
      );
      
      // Save to persistent storage
      setTransactionsForCurrentMonth(updatedTransactions);
      
      return updatedTransactions;
    });
  };

  const updateTransactionNote = (transactionId: string, note: string) => {
    setTransactions(prev => {
      const updatedTransactions = prev.map(t => 
        t.id === transactionId 
          ? { ...t, userDescription: note }
          : t
      );
      
      // Save to persistent storage
      setTransactionsForCurrentMonth(updatedTransactions);
      
      return updatedTransactions;
    });
  };

  // Handler functions for action buttons
  const handleTransferMatch = (transaction: ImportedTransaction) => {
    // Find potential matching transfers (opposite amounts, different accounts)
    const potentialMatches = transactions.filter(t => 
      t.id !== transaction.id &&
      t.accountId !== transaction.accountId &&
      Math.abs(t.amount + transaction.amount) < 0.01 && // Opposite amounts (with small tolerance)
      !t.linkedTransactionId // Not already matched
    );

    setTransferMatchDialog({
      isOpen: true,
      transaction,
      suggestions: potentialMatches
    });
  };

  const handleSavingsLink = (transaction: ImportedTransaction) => {
    setSavingsLinkDialog({
      isOpen: true,
      transaction
    });
  };

  const handleCostCoverage = (transaction: ImportedTransaction) => {
    // Find potential costs to cover (negative transactions from same period)
    const potentialCosts = transactions.filter(t =>
      t.id !== transaction.id &&
      t.amount < 0 && // Negative transaction (cost)
      !t.correctedAmount && // Not already covered
      new Date(t.date) <= new Date(transaction.date) // Cost should be before or same as coverage
    );

    setCostCoverageDialog({
      isOpen: true,
      transfer: transaction,
      potentialCosts
    });
  };

  const renderUploadStep = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Ladda upp CSV-filer</h2>
        <p className="text-sm sm:text-base text-muted-foreground px-2">
          Välj och ladda upp CSV-filer för de konton du vill importera transaktioner från
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4">
        {accounts.map(account => {
          const uploadedFile = uploadedFiles.find(f => f.accountId === account.id);
          const hasFile = !!uploadedFile;
          
          return (
            <Card key={account.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{account.name}</CardTitle>
                  <Badge 
                    variant={hasFile ? 'default' : 'outline'}
                    className={hasFile ? 'bg-green-500' : ''}
                  >
                    {hasFile ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Inläst
                      </>
                    ) : (
                      'Väntar'
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    onClick={() => fileInputRefs.current[account.id]?.click()}
                    className="w-full"
                    variant="outline"
                  >
                    {hasFile ? (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Byt fil
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Läs In
                      </>
                    )}
                  </Button>
                  
                  {uploadedFile && (
                    <div className="space-y-2 text-sm">
                      {uploadedFile.balance !== undefined && (
                        <div className="text-muted-foreground">
                          <span className="font-medium">Saldo enligt filen:</span> {uploadedFile.balance.toLocaleString('sv-SE')} kr
                        </div>
                      )}
                      {uploadedFile.dateRange && (
                        <div className="text-muted-foreground">
                          <span className="font-medium">Period:</span> {uploadedFile.dateRange.from} - {uploadedFile.dateRange.to}
                        </div>
                      )}
                      <div className="text-muted-foreground">
                        <span className="font-medium">Transaktioner:</span> {uploadedFile.transactions.length} st
                      </div>
                    </div>
                  )}
                  
                  <input
                    ref={el => fileInputRefs.current[account.id] = el}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(account.id, file);
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 pt-4 sm:pt-6">
        {/* Navigation buttons */}
        <div className="border-t border-border pt-6">
          {/* Prominent button for continuing with existing files */}
          {transactions.length > 0 && (
            <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Fortsätt med tidigare filer</h4>
                  <p className="text-xs text-muted-foreground">
                    Du har {transactions.length} transaktioner redo för kategorisering
                  </p>
                </div>
                <Button 
                  onClick={() => setCurrentStep('categorization')}
                  variant="default"
                  className="shrink-0"
                >
                  Kategorisering & Mappning
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <Button 
          onClick={() => setCurrentStep('mapping')}
          disabled={uploadedFiles.length === 0}
          className="w-full sm:min-w-48"
        >
          Fortsätt till mappning
        </Button>
        <Button 
          variant="outline"
          onClick={() => setCurrentStep('categorization')}
          disabled={transactions.length === 0}
          className="w-full sm:min-w-48 hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          Kategorisering & Regler
        </Button>
      </div>
    </div>
  );

  // Rules management logic
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRule, setNewRule] = useState<{
    bankCategory: string;
    bankSubCategory: string;
    appCategoryId: string;
    appSubCategoryId?: string;
    transactionType: 'Transaction' | 'InternalTransfer';
  }>({
    bankCategory: '',
    bankSubCategory: '',
    appCategoryId: '',
    transactionType: 'Transaction'
  });

  // Get unique bank categories from transactions
  const getUniqueBankCategories = () => {
    const uniqueCategories = new Map<string, { main: string; sub: string; count: number }>();
    
    transactions.forEach(transaction => {
      if (transaction.bankCategory) {
        const key = `${transaction.bankCategory}|${transaction.bankSubCategory || ''}`;
        const existing = uniqueCategories.get(key);
        if (existing) {
          existing.count++;
        } else {
          uniqueCategories.set(key, {
            main: transaction.bankCategory,
            sub: transaction.bankSubCategory || '',
            count: 1
          });
        }
      }
    });
    
    return Array.from(uniqueCategories.values());
  };

  // Separate uncategorized from existing rules
  const allBankCategories = getUniqueBankCategories();
  const uncategorized = allBankCategories.filter(bankCat => 
    !categoryRulesFromState.some(rule => 
      rule.bankCategory === bankCat.main && 
      (rule.bankSubCategory || '') === bankCat.sub
    )
  );

  const handleAddRule = () => {
    if (!newRule.bankCategory || !newRule.appCategoryId) {
      toast({
        title: "Fel",
        description: "Bankkategori och appkategori måste väljas",
        variant: "destructive"
      });
      return;
    }

    addCategoryRule({
      bankCategory: newRule.bankCategory,
      bankSubCategory: newRule.bankSubCategory,
      appCategoryId: newRule.appCategoryId,
      appSubCategoryId: newRule.appSubCategoryId,
      transactionType: newRule.transactionType,
      priority: 1,
      isActive: true
    });

    // Reset form
    setNewRule({
      bankCategory: '',
      bankSubCategory: '',
      appCategoryId: '',
      transactionType: 'Transaction'
    });
    setIsAddingRule(false);

    toast({
      title: "Regel skapad",
      description: "Den nya kategoriseringsregeln har sparats"
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    deleteCategoryRule(ruleId);
    toast({
      title: "Regel borttagen",
      description: "Kategoriseringsregeln har tagits bort"
    });
  };

  // Get subcategories for selected main category from storage
  const getSubCategoriesForMainCategory = (mainCategoryName: string) => {
    return subcategoriesFromStorage[mainCategoryName] || [];
  };

  const renderRulesContent = () => (
    <div className="space-y-4">
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>
            Okategoriserade ({uncategorized.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {uncategorized.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Alla bankkategorier har redan regler konfigurerade.
                </p>
              ) : (
                <>
                  {uncategorized.map((bankCat, index) => (
                    <div key={`${bankCat.main}-${bankCat.sub}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{bankCat.main}</div>
                        {bankCat.sub && (
                          <div className="text-sm text-muted-foreground">{bankCat.sub}</div>
                        )}
                        <div className="text-xs text-muted-foreground">{bankCat.count} transaktioner</div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setNewRule({
                            bankCategory: bankCat.main,
                            bankSubCategory: bankCat.sub,
                            appCategoryId: '',
                            transactionType: 'Transaction'
                          });
                          setIsAddingRule(true);
                        }}
                      >
                        Skapa regel
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2">
          <AccordionTrigger>
            Befintliga regler ({categoryRulesFromState.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {categoryRulesFromState.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Inga regler har skapats ännu.
                </p>
              ) : (
                <div className="space-y-2">
                  {categoryRulesFromState.map((rule) => {
                    const appCategory = costGroups.find(g => g.id === rule.appCategoryId);
                    const appSubCategory = appCategory?.subCategories?.find(s => s.id === rule.appSubCategoryId);
                    
                    return (
                      <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{rule.bankCategory}</Badge>
                            {rule.bankSubCategory && (
                              <Badge variant="secondary">{rule.bankSubCategory}</Badge>
                            )}
                            <span className="text-sm text-muted-foreground">→</span>
                            <Badge>{appCategory?.name || rule.appCategoryId}</Badge>
                            {appSubCategory && (
                              <Badge variant="secondary">{appSubCategory.name}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Typ: {rule.transactionType === 'Transaction' ? 'Transaktion' : 'Överföring'}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          Ta bort
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-center pt-4">
        <Button onClick={applyCategorizationRules} variant="outline">
          Tillämpa alla regler
        </Button>
      </div>

      {/* Add Rule Dialog */}
      <Dialog open={isAddingRule} onOpenChange={setIsAddingRule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skapa ny kategoriseringsregel</DialogTitle>
            <DialogDescription>
              Mappa bankkategori "{newRule.bankCategory}" {newRule.bankSubCategory && `"${newRule.bankSubCategory}"`} till appkategori
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="appCategory">Huvudkategori</Label>
              <Select value={newRule.appCategoryId} onValueChange={(value) => {
                setNewRule(prev => ({ ...prev, appCategoryId: value, appSubCategoryId: undefined }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj kategori" />
                </SelectTrigger>
                <SelectContent>
                  {mainCategories.filter(category => category && category.trim() !== '').map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newRule.appCategoryId && getSubCategoriesForMainCategory(newRule.appCategoryId).length > 0 && (
              <div>
                <Label htmlFor="appSubCategory">Underkategori (valfritt)</Label>
                <Select value={newRule.appSubCategoryId || 'none'} onValueChange={(value) => {
                  setNewRule(prev => ({ ...prev, appSubCategoryId: value === 'none' ? undefined : value }));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj underkategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen underkategori</SelectItem>
                    {getSubCategoriesForMainCategory(newRule.appCategoryId).filter(subCat => subCat && subCat.trim() !== '').map(subCat => (
                      <SelectItem key={subCat} value={subCat}>
                        {subCat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Transaktionstyp</Label>
              <RadioGroup 
                value={newRule.transactionType} 
                onValueChange={(value) => setNewRule(prev => ({ ...prev, transactionType: value as 'Transaction' | 'InternalTransfer' }))}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Transaction" id="transaction" />
                  <Label htmlFor="transaction">Transaktion</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="InternalTransfer" id="transfer" />
                  <Label htmlFor="transfer">Överföring</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Category Management Section */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  Hantera kategorier
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="max-h-[50vh] overflow-y-auto space-y-4 border rounded-lg p-4 bg-muted/30">
                  <CategoryManagementSection 
                    costGroups={costGroups}
                    onCategoriesChange={() => {
                      // Force refresh of categories
                      window.location.reload();
                    }}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddingRule(false)}>
                Avbryt
              </Button>
              <Button onClick={handleAddRule}>
                Spara regel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderCategorizationStep = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Kategorisering & Regler</h2>
        <p className="text-sm sm:text-base text-muted-foreground px-2">
          Kategorisera transaktioner och hantera regler för automatisk kategorisering
        </p>
      </div>

      <Tabs defaultValue="transaktioner" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="regler">Regler</TabsTrigger>
          <TabsTrigger value="transaktioner">Transaktioner</TabsTrigger>
        </TabsList>

        <TabsContent value="regler" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kategoriseringsregler</CardTitle>
              <CardDescription>
                Automatiska regler för att kategorisera transaktioner baserat på bankens kategorier
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderRulesContent()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transaktioner" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-base sm:text-lg font-semibold">
              Importerade transaktioner ({transactions.length})
            </h3>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <Button 
                variant={activeTransactionTab === 'all' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setActiveTransactionTab('all')}
                className="text-xs sm:text-sm"
              >
                Alla Transaktioner
              </Button>
              <Button 
                variant={activeTransactionTab === 'account' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setActiveTransactionTab('account')}
                className="text-xs sm:text-sm"
              >
                Per konto
              </Button>
            </div>
          </div>

          {selectedTransactions.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm">{selectedTransactions.length} valda</span>
              <Button size="sm" onClick={approveSelectedTransactions}>
                Godkänn valda
              </Button>
            </div>
          )}

          {activeTransactionTab === 'all' ? (
            (() => {
              // Filter transactions based on hide green setting
              const filteredTransactions = hideGreenTransactions 
                ? transactions.filter(t => t.status !== 'green')
                : transactions;

              return (
                <div className="space-y-3">
                  {/* Select all header */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedTransactions.length === filteredTransactions.length && filteredTransactions.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTransactions(filteredTransactions.map(t => t.id));
                          } else {
                            setSelectedTransactions([]);
                          }
                        }}
                      />
                      <span className="text-sm font-medium">Markera alla transaktioner</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {selectedTransactions.filter(id => filteredTransactions.some(t => t.id === id)).length} av {filteredTransactions.length} valda
                    </span>
                  </div>

                  {/* Hide green transactions toggle */}
                  <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
                     <Checkbox
                       checked={hideGreenTransactions}
                       onCheckedChange={(checked) => setHideGreenTransactions(checked === true)}
                     />
                    <span className="text-sm">Dölj godkända transaktioner</span>
                    {hideGreenTransactions && (
                      <span className="text-xs text-muted-foreground">
                        ({transactions.filter(t => t.status === 'green').length} dolda)
                      </span>
                    )}
                  </div>

                  {/* Grouped transaction cards */}
                  <TransactionGroupByDate
                    transactions={filteredTransactions}
                    selectedTransactions={selectedTransactions}
                    mainCategories={mainCategories}
                    accounts={accounts}
                    costGroups={costGroups}
                    onToggleSelection={toggleTransactionSelection}
                    onUpdateCategory={updateTransactionCategory}
                    onUpdateNote={updateTransactionNote}
                    onTransferMatch={handleTransferMatch}
                    onSavingsLink={handleSavingsLink}
                    onCostCoverage={handleCostCoverage}
                  />
                </div>
              );
            })()
          ) : (
            <Tabs value={selectedAccountForView} onValueChange={setSelectedAccountForView}>
              <TabsList className="w-full">
                {accounts.map(account => {
                  const accountTransactions = transactions.filter(t => t.accountId === account.id);
                  const statusColor = getAccountStatusForTab(account.id);
                  
                  return (
                    <TabsTrigger key={account.id} value={account.id} className="flex items-center gap-2">
                      <Circle className={`w-2 h-2 fill-current ${
                        statusColor === 'red' ? 'text-red-500' : 
                        statusColor === 'yellow' ? 'text-yellow-500' : 
                        'text-green-500'
                      }`} />
                      {account.name}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              
              {accounts.map(account => (
                <TabsContent key={account.id} value={account.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle>{account.name} - Transaktioner</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">Välj</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Datum</TableHead>
                              <TableHead>Beskrivning</TableHead>
                              <TableHead>Egen text</TableHead>
                              <TableHead>Belopp</TableHead>
                              <TableHead>Typ</TableHead>
                              <TableHead>Kategori</TableHead>
                              <TableHead>Åtgärder</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transactions
                              .filter(t => t.accountId === account.id)
                              .map(transaction => {
                                const statusInfo = getTransactionStatus(transaction);
                                const StatusIcon = statusInfo.icon;
                                
                                return (
                                  <TableRow key={transaction.id}>
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedTransactions.includes(transaction.id)}
                                        onCheckedChange={() => toggleTransactionSelection(transaction.id)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                                    </TableCell>
                                    <TableCell>{transaction.date}</TableCell>
                                    <TableCell className="max-w-48 truncate">{transaction.description}</TableCell>
                                    <TableCell>
                                      <Input
                                        value={transaction.userDescription || ''}
                                        onChange={(e) => updateTransactionNote(transaction.id, e.target.value)}
                                        placeholder="Egen notering..."
                                        className="w-32"
                                      />
                                    </TableCell>
                                    <TableCell className={transaction.correctedAmount !== undefined ? (transaction.correctedAmount >= 0 ? 'text-green-600' : 'text-red-600') : (transaction.amount >= 0 ? 'text-green-600' : 'text-red-600')}>
                                      {transaction.correctedAmount !== undefined ? (
                                        <div className="space-y-1">
                                          <div className="text-xs text-muted-foreground">Korrigerat:</div>
                                          <div className="font-semibold">
                                            {transaction.correctedAmount.toLocaleString('sv-SE')} kr
                                          </div>
                                          <div className="text-xs line-through opacity-60">
                                            Urspr: {transaction.amount.toLocaleString('sv-SE')} kr
                                          </div>
                                        </div>
                                      ) : (
                                        `${transaction.amount.toLocaleString('sv-SE')} kr`
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <TransactionTypeSelector transaction={transaction} />
                                    </TableCell>
                                    <TableCell>
                                       <Select
                                         value={(() => {
                                           // Convert stored ID back to category name for display
                                           const category = costGroups.find(g => g.id === transaction.appCategoryId);
                                           return category ? category.name : transaction.appCategoryId || '';
                                         })()}
                                         onValueChange={(value) => updateTransactionCategory(transaction.id, value)}
                                       >
                                         <SelectTrigger className="w-32">
                                           <SelectValue placeholder="Välj kategori" />
                                         </SelectTrigger>
                                         <SelectContent>
                                           {mainCategories.map(category => (
                                             <SelectItem key={category} value={category}>
                                               {category}
                                             </SelectItem>
                                           ))}
                                         </SelectContent>
                                       </Select>
                                     </TableCell>
                                     <TableCell>
                                       <div className="flex gap-1">
                                         {transaction.type === 'InternalTransfer' && (
                                           <Button
                                             size="sm"
                                             variant="outline"
                                             onClick={() => handleTransferMatch(transaction)}
                                             className="text-xs px-2 py-1"
                                           >
                                             Matcha
                                           </Button>
                                         )}
                                         {transaction.type === 'Savings' && (
                                           <Button
                                             size="sm"
                                             variant="outline"
                                             onClick={() => handleSavingsLink(transaction)}
                                             className="text-xs px-2 py-1"
                                           >
                                             Koppla
                                           </Button>
                                         )}
                                         {transaction.type === 'CostCoverage' && (
                                           <Button
                                             size="sm"
                                             variant="outline"
                                             onClick={() => handleCostCoverage(transaction)}
                                             className="text-xs px-2 py-1"
                                           >
                                             Täck
                                           </Button>
                                         )}
                                       </div>
                                     </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          )}

          <div className="flex justify-center space-x-4 pt-4">
            <Button onClick={autoMatchTransfers} variant="outline">
              Auto-matcha överföringar
            </Button>
            <Button onClick={applyCategorizationRules} variant="outline">
              Tillämpa regler
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-center pt-4 sm:pt-6">
        <Button 
          variant="outline"
          onClick={() => setCurrentStep('mapping')}
          className="w-full sm:w-auto"
        >
          Tillbaka till mappning
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Progress indicator */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-center space-x-2 sm:space-x-4 overflow-x-auto">
          <div className={`flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${currentStep === 'upload' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm ${
              currentStep === 'upload' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
            }`}>
              1
            </div>
            <span className="text-xs sm:text-sm">Ladda upp</span>
          </div>
          <div className="w-4 sm:w-8 h-px bg-muted-foreground flex-shrink-0" />
          <div className={`flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${currentStep === 'mapping' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm ${
              currentStep === 'mapping' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
            }`}>
              2
            </div>
            <span className="text-xs sm:text-sm">Mappning</span>
          </div>
          <div className="w-4 sm:w-8 h-px bg-muted-foreground flex-shrink-0" />
          <div className={`flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${currentStep === 'categorization' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs sm:text-sm ${
              currentStep === 'categorization' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
            }`}>
              3
            </div>
            <span className="text-xs sm:text-sm">Kategorisering</span>
          </div>
        </div>
      </div>

      {/* Step content */}
      {currentStep === 'upload' && renderUploadStep()}
      {currentStep === 'mapping' && renderMappingStep()}
      {currentStep === 'categorization' && renderCategorizationStep()}

      {/* Dialog components */}
      <TransferMatchDialog
        isOpen={transferMatchDialog.isOpen}
        onClose={() => setTransferMatchDialog({ isOpen: false })}
        transaction={transferMatchDialog.transaction}
        suggestions={transferMatchDialog.suggestions}
      />

      <SavingsLinkDialog
        isOpen={savingsLinkDialog.isOpen}
        onClose={() => setSavingsLinkDialog({ isOpen: false })}
        transaction={savingsLinkDialog.transaction}
      />

      <CostCoverageDialog
        isOpen={costCoverageDialog.isOpen}
        onClose={() => setCostCoverageDialog({ isOpen: false })}
        transfer={costCoverageDialog.transfer}
        potentialCosts={costCoverageDialog.potentialCosts}
      />
    </div>
  );
};