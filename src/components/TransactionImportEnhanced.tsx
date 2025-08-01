import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
import { updateTransaction, addCategoryRule, updateCategoryRule, deleteCategoryRule, updateCostGroups, updateTransactionsForMonth, setTransactionsForCurrentMonth, importAndReconcileFile, saveCsvMapping, getCsvMapping } from '../orchestrator/budgetOrchestrator';
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

export const TransactionImportEnhanced: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'categorization'>('upload');
  // NO MORE LOCAL STATE FOR FILES OR MAPPINGS - reading everything from central state
  const [fileStructures, setFileStructures] = useState<FileStructure[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [activeTransactionTab, setActiveTransactionTab] = useState<'all' | 'account' | 'rules'>('all');
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
  
  // Get budget data from central state (SINGLE SOURCE OF TRUTH)
  const { budgetState } = useBudget();
  console.log('🔍 [DEBUG] Full budgetState:', budgetState);
  console.log('🔍 [DEBUG] budgetState keys:', Object.keys(budgetState || {}));
  const costGroups = budgetState?.historicalData?.[budgetState.selectedMonthKey]?.costGroups || [];
  const categoryRulesFromState = budgetState?.transactionImport?.categoryRules || [];
  
  // Read transactions directly from central state - this is now the ONLY source of truth
  const allTransactions = useMemo(() => {
    console.log('🔍 [DEBUG] budgetState.historicalData:', budgetState?.historicalData);
    console.log('🔍 [DEBUG] Available months:', Object.keys(budgetState?.historicalData || {}));
    console.log('🔍 [DEBUG] useMemo re-calculating allTransactions...');
    
    const transactions = Object.values(budgetState?.historicalData || {}).flatMap(month => {
      console.log('🔍 [DEBUG] Month data:', month);
      console.log('🔍 [DEBUG] Month transactions count:', month.transactions?.length || 0);
      return (month.transactions || []).map(t => ({
        ...t,
        importedAt: (t as any).importedAt || new Date().toISOString(),
        fileSource: (t as any).fileSource || 'budgetState'
      } as ImportedTransaction))
    });
    
    console.log('🔍 [DEBUG] Total allTransactions count:', transactions.length);
    console.log('🔍 [DEBUG] Sample transactions:', transactions.slice(0, 3));
    return transactions;
  }, [budgetState?.historicalData, budgetState?.selectedMonthKey]);

  // Use actual accounts from budget state
  const accounts: Account[] = budgetState?.accounts || [];
  
  // Get main categories from actual budget data
  const mainCategories = budgetState?.mainCategories || [];
  
  // Get subcategories from storage
  const [subcategoriesFromStorage, setSubcategoriesFromStorage] = useState<Record<string, string[]>>({});
  
  // Read category rules directly from central state (no local state)
  const categoryRules = categoryRulesFromState;
  const [newRule, setNewRule] = useState<Partial<CategoryRule>>({});
  const [editingRule, setEditingRule] = useState<CategoryRule | null>(null);
  
  useEffect(() => {
    const loadedSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
    setSubcategoriesFromStorage(loadedSubcategories);
  }, []);

  // File upload handler - uses the new Smart Merge function
  const handleFileUpload = useCallback(async (file: File, accountId: string, accountName: string) => {
    try {
      const csvContent = await file.text();
      
      if (!csvContent || csvContent.trim().length === 0) {
        toast({
          title: "Fel vid filläsning",
          description: "Kunde inte läsa filinnehållet.",
          variant: "destructive"
        });
        return;
      }

      // Use the new Smart Merge function - eliminates duplicates and preserves manual changes
      console.log('🔄 [DEBUG] About to import file with accountId:', accountId);
      console.log('🔄 [DEBUG] CSV content preview:', csvContent.substring(0, 200));
      
      importAndReconcileFile(csvContent, accountId);
      
      console.log('🔄 [DEBUG] After importAndReconcileFile - checking budgetState...');
      setTimeout(() => {
        const currentState = getCurrentState();
        console.log('🔄 [DEBUG] Post-import budgetState:', currentState.budgetState);
        console.log('🔄 [DEBUG] Post-import historicalData keys:', Object.keys(currentState.budgetState.historicalData || {}));
      }, 100);
        
      toast({
        title: "Fil uppladdad",
        description: `Transaktioner från ${file.name} har bearbetats och sparats till budgeten.`,
      });
        
      // No need to update local state - data is now in central state
      // Component will re-render automatically due to budget state changes
      
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Fel vid uppladdning",
        description: "Ett fel uppstod vid bearbetning av filen.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const triggerFileUpload = useCallback((accountId: string) => {
    const input = fileInputRefs.current[accountId];
    if (input) {
      input.click();
    }
  }, []);

  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactions(prev => 
      prev.includes(transactionId) 
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  // UNIFIED UPDATE FUNCTION - This connects the UI back to the central state
  const handleTransactionUpdate = (transactionId: string, updates: Partial<ImportedTransaction>) => {
    console.log(`🔄 [TransactionImportEnhanced] Updating transaction ${transactionId} with updates:`, updates);
    
    // Find the transaction to get its date and derive monthKey
    const transaction = allTransactions.find(t => t.id === transactionId);
    if (!transaction) {
      console.error(`Transaction ${transactionId} not found`);
      return;
    }

    const monthKey = transaction.date.substring(0, 7);
    console.log(`🔄 [TransactionImportEnhanced] Derived monthKey: ${monthKey} from date: ${transaction.date}`);
    
    // Always mark as manually changed for user interactions
    const updatesWithManualFlag = {
      ...updates,
      isManuallyChanged: true
    };
    
    console.log(`🔄 [TransactionImportEnhanced] About to call updateTransaction with:`, {
      transactionId,
      updatesWithManualFlag,
      monthKey
    });
    
    // Call the central orchestrator function with CORRECT signature
    updateTransaction(transactionId, updatesWithManualFlag, monthKey);
    
    console.log(`🔄 [TransactionImportEnhanced] Called updateTransaction, checking state in 100ms...`);
    setTimeout(() => {
      const currentState = getCurrentState();
      const updatedTransaction = currentState.budgetState.historicalData[monthKey]?.transactions?.find((t: any) => t.id === transactionId);
      console.log(`🔄 [TransactionImportEnhanced] Transaction after update:`, updatedTransaction ? {
        id: updatedTransaction.id,
        status: updatedTransaction.status,
        type: updatedTransaction.type,
        isManuallyChanged: updatedTransaction.isManuallyChanged
      } : 'NOT FOUND');
    }, 100);
  };

  const updateTransactionNote = (transactionId: string, userDescription: string) => {
    handleTransactionUpdate(transactionId, { userDescription });
  };

  const updateTransactionCategory = (transactionId: string, categoryName: string, subCategoryId?: string) => {
    const costGroup = costGroups.find(g => g.name === categoryName);
    const categoryId = costGroup ? costGroup.id : categoryName;
    
    handleTransactionUpdate(transactionId, { 
      appCategoryId: categoryId,
      appSubCategoryId: subCategoryId 
    });
  };

  const updateTransactionStatus = (transactionId: string, status: 'green' | 'yellow' | 'red') => {
    handleTransactionUpdate(transactionId, { status });
  };

  const handleTransferMatch = (transaction: ImportedTransaction) => {
    const potentialMatches = allTransactions.filter(t => 
      t.id !== transaction.id &&
      t.type === 'InternalTransfer' &&
      Math.abs(t.amount + transaction.amount) < 0.01 &&
      Math.abs(new Date(t.date).getTime() - new Date(transaction.date).getTime()) <= 24 * 60 * 60 * 1000
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
    const potentialCosts = allTransactions.filter(t => 
      t.type === 'Transaction' && 
      t.amount < 0 && 
      !t.coveredCostId &&
      Math.abs(new Date(t.date).getTime() - new Date(transaction.date).getTime()) <= 7 * 24 * 60 * 60 * 1000
    );

    setCostCoverageDialog({
      isOpen: true,
      transfer: transaction,
      potentialCosts
    });
  };

  // Auto-match transfers
  useEffect(() => {
    const transfers = allTransactions.filter(t => t.type === 'InternalTransfer' && !t.linkedTransactionId);
    
    transfers.forEach(transfer => {
      const potentialMatches = transfers.filter(other => 
        other.id !== transfer.id &&
        Math.abs(other.amount + transfer.amount) < 0.01 &&
        Math.abs(new Date(other.date).getTime() - new Date(transfer.date).getTime()) <= 24 * 60 * 60 * 1000
      );

      if (potentialMatches.length === 1) {
        const match = potentialMatches[0];
        const transferMonthKey = transfer.date.substring(0, 7);
        const matchMonthKey = match.date.substring(0, 7);
        
        updateTransaction(transfer.id, {
          linkedTransactionId: match.id,
          status: 'yellow' as const,
          isManuallyChanged: true
        }, transferMonthKey);
        
        updateTransaction(match.id, {
          linkedTransactionId: transfer.id,
          status: 'yellow' as const,
          isManuallyChanged: true
        }, matchMonthKey);
      }
    });
  }, [allTransactions]);

  const getTransactionStatus = (transaction: ImportedTransaction) => {
    if (transaction.status === 'green') return { color: 'text-green-600', icon: CheckCircle };
    if (transaction.status === 'yellow') return { color: 'text-yellow-600', icon: AlertTriangle };
    return { color: 'text-red-600', icon: AlertCircle };
  };

  // CSV Column mapping functions
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

  // Category rule management functions
  const handleAddRule = () => {
    if (newRule.bankCategory && newRule.appCategoryId && newRule.transactionType) {
      const rule: CategoryRule = {
        id: uuidv4(),
        bankCategory: newRule.bankCategory,
        bankSubCategory: newRule.bankSubCategory || '',
        appCategoryId: newRule.appCategoryId,
        appSubCategoryId: newRule.appSubCategoryId,
        transactionType: newRule.transactionType,
        description: newRule.description || '',
        priority: newRule.priority || 1,
        isActive: true
      };
      
      addCategoryRule(rule);
      setNewRule({});
      
      toast({
        title: "Regel tillagd",
        description: "Kategoriseringsregeln har skapats.",
      });
    }
  };

  const handleEditRule = (rule: CategoryRule) => {
    setEditingRule(rule);
  };

  const handleUpdateRule = () => {
    if (editingRule) {
      updateCategoryRule(editingRule);
      setEditingRule(null);
      
      toast({
        title: "Regel uppdaterad",
        description: "Kategoriseringsregeln har uppdaterats.",
      });
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    deleteCategoryRule(ruleId);
    
    toast({
      title: "Regel borttagen",
      description: "Kategoriseringsregeln har tagits bort.",
    });
  };

  // Bulk approve transactions
  const handleApproveSelected = () => {
    if (selectedTransactions.length === 0) {
      toast({
        title: "Ingen transaktion vald",
        description: "Välj transaktioner att godkänna först.",
        variant: "destructive"
      });
      return;
    }

    selectedTransactions.forEach(transactionId => {
      const transaction = allTransactions.find(t => t.id === transactionId);
      if (transaction && transaction.status !== 'green') {
        const monthKey = transaction.date.substring(0, 7);
        updateTransaction(transactionId, { 
          status: 'green' as const,
          isManuallyChanged: true 
        }, monthKey);
      }
    });

    setSelectedTransactions([]);
    
    toast({
      title: "Transaktioner godkända",
      description: `${selectedTransactions.length} transaktioner har godkänts.`,
    });
  };

  // Main upload step - shows accounts and upload status
  const renderUploadStep = () => {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="text-center space-y-3 sm:space-y-4 px-2">
          <h2 className="text-xl sm:text-2xl font-bold">Ladda upp CSV-filer</h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
            Välj kontona du vill importera transaktioner för och ladda upp motsvarande CSV-filer från din bank.
          </p>
        </div>

        <div className="grid gap-4">
          {accounts.map((account) => {
            const accountTransactions = allTransactions.filter(t => t.accountId === account.id);
            const hasTransactions = accountTransactions.length > 0;
            
            return (
              <Card key={account.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg truncate">{account.name}</CardTitle>
                      <CardDescription className="text-sm">
                        Startbalans: {account.startBalance.toLocaleString('sv-SE')} kr
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasTransactions && (
                        <Badge variant="secondary" className="text-xs">
                          {accountTransactions.length} transaktioner
                        </Badge>
                      )}
                      <Button
                        onClick={() => triggerFileUpload(account.id)}
                        size="sm"
                        variant={hasTransactions ? "outline" : "default"}
                        className="text-xs sm:text-sm"
                      >
                        <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        {hasTransactions ? "Ändra fil" : "Ladda upp"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <input
                  type="file"
                  accept=".csv"
                  ref={(el) => fileInputRefs.current[account.id] = el}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file, account.id, account.name);
                    }
                  }}
                />
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 px-2 sm:px-0">
          <Button 
            onClick={() => setCurrentStep('mapping')}
            disabled={allTransactions.length === 0}
            variant="outline"
          >
            Kolumnmappning
          </Button>
          <Button 
            onClick={() => setCurrentStep('categorization')}
            disabled={allTransactions.length === 0}
            variant="default"
          >
            Gå till kategorisering
          </Button>
        </div>
      </div>
    );
  };

  // Get saved CSV mappings from central state - single source of truth
  const getCurrentMapping = (accountId: string) => {
    // Create file fingerprint for this account
    const fileFingerprint = `account_${accountId}`;
    return getCsvMapping(fileFingerprint)?.columnMapping || {};
  };

  // Save mapping to central state
  const saveCurrentMapping = (accountId: string, columnMapping: { [key: string]: string }) => {
    const fileFingerprint = `account_${accountId}`;
    console.log(`💾 [TransactionImportEnhanced] Saving mapping for ${fileFingerprint}:`, columnMapping);
    
    saveCsvMapping({
      fileFingerprint,
      columnMapping
    });
  };

  // Mapping step - restored functionality
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

    // Get unique accounts that have transactions
    const accountsWithTransactions = accounts.filter(account => 
      allTransactions.some(t => t.accountId === account.id)
    );

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

        {accountsWithTransactions.map((account) => {
          const accountTransactions = allTransactions.filter(t => t.accountId === account.id);
          const sampleCSVHeaders = ['Datum', 'Kategori', 'Underkategori', 'Text', 'Belopp', 'Saldo'];
          
          return (
            <Card key={account.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  CSV-mappning för {account.name}
                </CardTitle>
                <CardDescription>
                  {accountTransactions.length} transaktioner • Mappa kolumner till appfält
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Kolumnmappning</h4>
                    
                    {/* Mobile-first responsive layout */}
                    <div className="space-y-4 md:hidden">
                      {sampleCSVHeaders.map((header, colIndex) => {
                        const exampleData = accountTransactions.slice(0, 2).map(t => {
                          if (header.toLowerCase().includes('datum')) return t.date;
                          if (header.toLowerCase().includes('belopp')) return t.amount.toString();
                          if (header.toLowerCase().includes('text')) return t.description;
                          if (header.toLowerCase().includes('kategori')) return t.bankCategory || '';
                          return `Exempel ${colIndex + 1}`;
                        });

                        return (
                          <Card key={colIndex} className="p-3">
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Kolumn</Label>
                                <p className="text-sm font-medium">{header}</p>
                              </div>
                              
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Exempeldata</Label>
                                <div className="space-y-1 mt-1">
                                  {exampleData.map((data, i) => (
                                    <div key={i} className="text-xs bg-muted/30 px-2 py-1 rounded truncate">
                                      {data}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Mappa till</Label>
                                <Select
                                  value={getCurrentMapping(account.id)[header] || 'ignore'}
                                  onValueChange={(value) => {
                                    const currentMapping = getCurrentMapping(account.id);
                                    const updatedMapping = {
                                      ...currentMapping,
                                      [header]: value
                                    };
                                    saveCurrentMapping(account.id, updatedMapping);
                                  }}
                                >
                                  <SelectTrigger className="w-full h-8 text-xs mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {systemFields.map(field => (
                                      <SelectItem key={field.value} value={field.value} className="text-xs">
                                        {field.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Desktop table layout */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table className="text-xs min-w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24 text-xs">Kolumn</TableHead>
                            <TableHead className="w-32 text-xs">Exempeldata</TableHead>
                            <TableHead className="w-36 text-xs">Mappa till</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sampleCSVHeaders.map((header, colIndex) => {
                            const exampleData = accountTransactions.slice(0, 2).map(t => {
                              if (header.toLowerCase().includes('datum')) return t.date;
                              if (header.toLowerCase().includes('belopp')) return t.amount.toString();
                              if (header.toLowerCase().includes('text')) return t.description;
                              if (header.toLowerCase().includes('kategori')) return t.bankCategory || '';
                              return `Exempel ${colIndex + 1}`;
                            });

                            return (
                              <TableRow key={colIndex}>
                                <TableCell className="font-medium text-xs">
                                  {header}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <div className="space-y-1 max-w-32">
                                    {exampleData.map((data, i) => (
                                      <div key={i} className="truncate bg-muted/30 px-2 py-1 rounded text-xs">
                                        {data}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={getCurrentMapping(account.id)[header] || 'ignore'}
                                    onValueChange={(value) => {
                                      const currentMapping = getCurrentMapping(account.id);
                                      const updatedMapping = {
                                        ...currentMapping,
                                        [header]: value
                                      };
                                      saveCurrentMapping(account.id, updatedMapping);
                                    }}
                                  >
                                    <SelectTrigger className="w-32 h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
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
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center px-2 sm:px-0">
          <Button onClick={() => setCurrentStep('upload')} variant="outline">
            Tillbaka: Uppladdning
          </Button>
          <Button 
            onClick={() => setCurrentStep('categorization')}
            disabled={accountsWithTransactions.length === 0}
          >
            Nästa: Kategorisering
          </Button>
        </div>
      </div>
    );
  };
  const renderCategorizationStep = () => {
    const filteredTransactions = hideGreenTransactions 
      ? allTransactions.filter(t => t.status !== 'green')
      : allTransactions;

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="text-center px-2">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Kategorisering</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Granska och kategorisera dina importerade transaktioner.
          </p>
        </div>

        {/* Mobile-optimized controls */}
        <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4 p-3 sm:p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hideGreen"
              checked={hideGreenTransactions}
              onCheckedChange={(checked) => setHideGreenTransactions(checked === true)}
            />
            <Label htmlFor="hideGreen" className="text-sm">Dölj godkända transaktioner</Label>
          </div>
          
          <div className="text-xs sm:text-sm text-muted-foreground">
            Visar {filteredTransactions.length} av {allTransactions.length} transaktioner
          </div>
          
          <div className="flex flex-col sm:flex-row sm:ml-auto gap-2">
            <Button
              onClick={handleApproveSelected}
              disabled={selectedTransactions.length === 0}
              size="sm"
              variant="default"
              className="text-xs sm:text-sm"
            >
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              Godkänn valda ({selectedTransactions.length})
            </Button>
            <Button
              onClick={() => setSelectedTransactions([])}
              disabled={selectedTransactions.length === 0}
              size="sm"
              variant="outline"
              className="text-xs sm:text-sm"
            >
              Rensa urval
            </Button>
          </div>
        </div>

        <Tabs value={activeTransactionTab} onValueChange={(value) => setActiveTransactionTab(value as 'all' | 'account' | 'rules')}>
          <TabsList className="grid w-full grid-cols-3 text-xs sm:text-sm">
            <TabsTrigger value="rules" className="text-xs sm:text-sm">Regler</TabsTrigger>
            <TabsTrigger value="all" className="text-xs sm:text-sm">Alla transaktioner</TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm">Per konto</TabsTrigger>
          </TabsList>
          
          
          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Kategoriseringsregler</CardTitle>
                <CardDescription>
                  Skapa regler för automatisk kategorisering av transaktioner baserat på bankens kategorier eller beskrivningar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add new rule form */}
                <div className="p-4 border rounded-lg space-y-4">
                  <h4 className="font-medium">Lägg till ny regel</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="bankCategory">Bankens kategori</Label>
                      <Input
                        id="bankCategory"
                        value={newRule.bankCategory || ''}
                        onChange={(e) => setNewRule({ ...newRule, bankCategory: e.target.value })}
                        placeholder="t.ex. 'Livsmedel'"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bankSubCategory">Bankens underkategori (valfritt)</Label>
                      <Input
                        id="bankSubCategory"
                        value={newRule.bankSubCategory || ''}
                        onChange={(e) => setNewRule({ ...newRule, bankSubCategory: e.target.value })}
                        placeholder="t.ex. 'Dagligvaror'"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Beskrivningsmatch (valfritt)</Label>
                      <Input
                        id="description"
                        value={newRule.description || ''}
                        onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                        placeholder="t.ex. 'ICA'"
                      />
                    </div>
                    <div>
                      <Label htmlFor="transactionType">Transaktionstyp</Label>
                      <Select
                        value={newRule.transactionType || ''}
                        onValueChange={(value) => setNewRule({ ...newRule, transactionType: value as 'Transaction' | 'InternalTransfer' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Välj typ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Transaction">Transaktion</SelectItem>
                          <SelectItem value="InternalTransfer">Intern överföring</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="appCategory">App-kategori</Label>
                      <Select
                        value={newRule.appCategoryId || ''}
                        onValueChange={(value) => setNewRule({ ...newRule, appCategoryId: value })}
                      >
                        <SelectTrigger>
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
                    </div>
                    <div>
                      <Label htmlFor="priority">Prioritet</Label>
                      <Input
                        id="priority"
                        type="number"
                        value={newRule.priority || 1}
                        onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddRule} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Lägg till regel
                  </Button>
                </div>

                {/* Existing rules */}
                <div className="space-y-3">
                  <h4 className="font-medium">Befintliga regler ({categoryRules.length})</h4>
                  {categoryRules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Inga regler skapade än. Lägg till din första regel ovan.
                    </div>
                  ) : (
                    categoryRules.map((rule) => (
                      <Card key={rule.id}>
                        <CardContent className="p-4">
                          {editingRule?.id === rule.id ? (
                            // Edit mode
                            <div className="space-y-4">
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                  <Label>Bankens kategori</Label>
                                  <Input
                                    value={editingRule.bankCategory}
                                    onChange={(e) => setEditingRule({ ...editingRule, bankCategory: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label>Bankens underkategori</Label>
                                  <Input
                                    value={editingRule.bankSubCategory || ''}
                                    onChange={(e) => setEditingRule({ ...editingRule, bankSubCategory: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label>Beskrivning</Label>
                                  <Input
                                    value={editingRule.description || ''}
                                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <Label>App-kategori</Label>
                                  <Select
                                    value={editingRule.appCategoryId}
                                    onValueChange={(value) => setEditingRule({ ...editingRule, appCategoryId: value })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {mainCategories.map(category => (
                                        <SelectItem key={category} value={category}>
                                          {category}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={handleUpdateRule} size="sm">
                                  <Save className="w-4 h-4 mr-1" />
                                  Spara
                                </Button>
                                <Button onClick={() => setEditingRule(null)} variant="outline" size="sm">
                                  Avbryt
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View mode
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {rule.bankCategory}
                                  {rule.bankSubCategory && ` → ${rule.bankSubCategory}`}
                                  {rule.description && ` (innehåller "${rule.description}")`}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Blir: {rule.appCategoryId} • Typ: {rule.transactionType} • Prioritet: {rule.priority}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => handleEditRule(rule)} variant="outline" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button onClick={() => handleDeleteRule(rule.id)} variant="destructive" size="sm">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                {/* Category management */}
                <div className="border-t pt-6">
                  <CategoryManagementSection 
                    costGroups={costGroups} 
                    onCategoriesChange={() => {
                      // Trigger a refresh of categories
                      window.location.reload();
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alla transaktioner</CardTitle>
                <CardDescription>
                  {filteredTransactions.length} transaktioner totalt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredTransactions.map(transaction => (
                    <TransactionExpandableCard
                      key={`${transaction.id}-${transaction.status}-${transaction.type}-${transaction.isManuallyChanged || 'auto'}`}
                      transaction={transaction}
                      account={accounts.find(acc => acc.id === transaction.accountId)}
                      isSelected={selectedTransactions.includes(transaction.id)}
                      onToggleSelection={toggleTransactionSelection}
                      onUpdateCategory={updateTransactionCategory}
                      onUpdateNote={updateTransactionNote}
                      onUpdateStatus={updateTransactionStatus}
                      onTransferMatch={handleTransferMatch}
                      onSavingsLink={handleSavingsLink}
                      onCostCoverage={handleCostCoverage}
                      mainCategories={mainCategories}
                      costGroups={costGroups}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="account" className="space-y-4">
            {accounts.map(account => {
              const accountTransactions = filteredTransactions.filter(t => t.accountId === account.id);
              
              return (
                <Card key={account.id}>
                  <CardHeader>
                    <CardTitle>{account.name}</CardTitle>
                    <CardDescription>
                      {accountTransactions.length} transaktioner
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {accountTransactions.map(transaction => (
                        <TransactionExpandableCard
                          key={`${transaction.id}-${transaction.status}-${transaction.type}-${transaction.isManuallyChanged || 'auto'}`}
                          transaction={transaction}
                          account={account}
                          isSelected={selectedTransactions.includes(transaction.id)}
                          onToggleSelection={toggleTransactionSelection}
                          onUpdateCategory={updateTransactionCategory}
                          onUpdateNote={updateTransactionNote}
                          onUpdateStatus={updateTransactionStatus}
                          onTransferMatch={handleTransferMatch}
                          onSavingsLink={handleSavingsLink}
                          onCostCoverage={handleCostCoverage}
                          mainCategories={mainCategories}
                          costGroups={costGroups}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>

        <div className="flex justify-center gap-3">
          <Button onClick={() => setCurrentStep('upload')} variant="outline">
            Tillbaka till uppladdning
          </Button>
          <Button onClick={() => setCurrentStep('mapping')} variant="outline">
            Kolumnmappning
          </Button>
        </div>
      </div>
    );
  };

  // Progress indicator
  const steps = [
    { id: 'upload', label: 'Ladda upp' },
    { id: 'mapping', label: 'Mappning' },
    { id: 'categorization', label: 'Kategorisering' }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="container mx-auto p-2 sm:p-4 space-y-4 sm:space-y-6">
      {/* Progress indicator - Mobile optimized */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto px-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <div className={`
                w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium
                ${index <= currentStepIndex 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}>
                {index + 1}
              </div>
              <span className={`ml-1 sm:ml-2 text-xs sm:text-sm whitespace-nowrap ${index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className={`ml-2 sm:ml-4 w-4 sm:w-8 h-px ${index < currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      {currentStep === 'upload' && renderUploadStep()}
      {currentStep === 'mapping' && renderMappingStep()}
      {currentStep === 'categorization' && renderCategorizationStep()}

      {/* Dialogs */}
      <TransferMatchDialog
        isOpen={transferMatchDialog.isOpen}
        onClose={() => setTransferMatchDialog({ isOpen: false })}
        transaction={transferMatchDialog.transaction}
        suggestions={transferMatchDialog.suggestions || []}
      />

      <SavingsLinkDialog
        isOpen={savingsLinkDialog.isOpen}
        onClose={() => setSavingsLinkDialog({ isOpen: false })}
        transaction={savingsLinkDialog.transaction}
        onUpdateTransaction={(transactionId, updates) => {
          const transaction = allTransactions.find(t => t.id === transactionId);
          if (transaction) {
            const monthKey = transaction.date.substring(0, 7);
            updateTransaction(transactionId, updates, monthKey);
          }
        }}
      />

      <CostCoverageDialog
        isOpen={costCoverageDialog.isOpen}
        onClose={() => setCostCoverageDialog({ isOpen: false })}
        transfer={costCoverageDialog.transfer}
        potentialCosts={costCoverageDialog.potentialCosts || []}
      />
    </div>
  );
};