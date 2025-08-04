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
import { ImportedTransaction, FileStructure, ColumnMapping, ImportedFile } from '@/types/transaction';
import { CategoryRule } from '@/types/budget';
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
import { Upload, CheckCircle, FileText, Settings, AlertCircle, Circle, CheckSquare, AlertTriangle, ChevronDown, ChevronUp, Trash2, Plus, Edit, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

import { Bank, BankCSVMapping } from '@/types/bank';
import { determineTransactionStatus, getDateRangeForMonth } from '@/services/calculationService';
import { Account as BudgetAccount } from '@/types/budget';
import { recalculateAllTransactionStatuses } from '@/orchestrator/budgetOrchestrator';
import { AddBankDialog } from './AddBankDialog';
import { TransactionExpandableCard } from './TransactionExpandableCard';
import { TransactionGroupByDate } from './TransactionGroupByDate';
import { TransactionTypeSelector } from './TransactionTypeSelector';
import { TransferMatchDialog } from './TransferMatchDialog';
import { SavingsLinkDialog } from './SavingsLinkDialog';
import { CostCoverageDialog } from './CostCoverageDialog';
import { ExpenseClaimDialog } from './ExpenseClaimDialog';
import { BalanceCorrectionDialog } from './BalanceCorrectionDialog';
import { CategoryRuleManagerAdvanced } from './CategoryRuleManagerAdvanced';
import { UncategorizedBankCategories } from './UncategorizedBankCategories';
import { CategorySelectionDialog } from './CategorySelectionDialog';
import { useBudget } from '@/hooks/useBudget';
import { updateTransaction, addCategoryRule, updateCategoryRule, deleteCategoryRule, updateCostGroups, updateTransactionsForMonth, setTransactionsForCurrentMonth, importAndReconcileFile, saveCsvMapping, getCsvMapping, getAllTransactionsFromDatabase, linkAccountToBankTemplate, matchInternalTransfer } from '../orchestrator/budgetOrchestrator';
import { getCurrentState, setMainCategories, updateSelectedBudgetMonth } from '../orchestrator/budgetOrchestrator';
import { StorageKey, get, set } from '../services/storageService';
import { addMobileDebugLog } from '../utils/mobileDebugLogger';
import { clearExpansionState } from '@/hooks/useTransactionExpansion';

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
  bankTemplateId?: string;
}

export const TransactionImportEnhanced: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'categorization'>('upload');
  // NO MORE LOCAL STATE FOR FILES OR MAPPINGS - reading everything from central state
  const [fileStructures, setFileStructures] = useState<FileStructure[]>([]);
  const [rawCsvData, setRawCsvData] = useState<{[accountId: string]: {headers: string[], rows: string[][]}}>({})
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [activeTransactionTab, setActiveTransactionTab] = useState<'all' | 'account' | 'rules'>('all');
  const [hideGreenTransactions, setHideGreenTransactions] = useState<boolean>(false);
  const [selectedAccountForView, setSelectedAccountForView] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'red' | 'yellow' | 'green'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('current'); // 'all' or 'YYYY-MM' or 'current'
  const [accountFilter, setAccountFilter] = useState<string>('all'); // 'all' or account ID
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 50; // Show 50 transactions per page for better performance
  
  // State for category selection dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [selectedBankCategory, setSelectedBankCategory] = useState('');
  const [selectedBankSubCategory, setSelectedBankSubCategory] = useState<string | undefined>(undefined);
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
  const [expenseClaimDialog, setExpenseClaimDialog] = useState<{
    isOpen: boolean;
    expense?: ImportedTransaction;
  }>({ isOpen: false });
  const [savingsLinkDialog, setSavingsLinkDialog] = useState<{
    isOpen: boolean;
    transaction?: ImportedTransaction;
  }>({ isOpen: false });
  const [balanceCorrectionDialog, setBalanceCorrectionDialog] = useState(false);
  const [allTransactionsDialog, setAllTransactionsDialog] = useState<{
    isOpen: boolean;
    accountId?: string;
    accountName?: string;
  }>({ isOpen: false });
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [dateRangeDialog, setDateRangeDialog] = useState<{
    isOpen: boolean;
    date: string;
    accountId: string;
    transactions: any[];
  }>({ isOpen: false, date: '', accountId: '', transactions: [] });
  const fileInputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});
  
  // Bank selection state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCSVMappings, setBankCSVMappings] = useState<BankCSVMapping[]>([]);
  const [selectedBanks, setSelectedBanks] = useState<{[accountId: string]: string}>({});
  const { toast } = useToast();
  
  // Get budget data from central state (SINGLE SOURCE OF TRUTH)
  const { budgetState } = useBudget();
  
  // Reset filters and states when month changes to ensure consistency
  useEffect(() => {
    console.log('🔄 Month changed, resetting filters and states');
    setMonthFilter('current');
    setStatusFilter('all');
    setHideGreenTransactions(false);
    setSelectedTransactions([]);
    setExpandedAccounts(new Set());
    setCurrentPage(1);
    // Clear expansion state as well
    clearExpansionState();
    // Force refresh to ensure UI updates
    setRefreshKey(prev => prev + 1);
  }, [budgetState.selectedMonthKey]);
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [monthFilter, statusFilter, accountFilter, hideGreenTransactions]);

  // Month navigation functions
  const navigateToPreviousMonth = () => {
    const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    // Clear expansion state when changing months
    clearExpansionState();
    updateSelectedBudgetMonth(prevMonthKey);
    triggerRefresh();
  };

  const navigateToNextMonth = () => {
    const [year, month] = budgetState.selectedMonthKey.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    // Clear expansion state when changing months
    clearExpansionState();
    updateSelectedBudgetMonth(nextMonthKey);
    triggerRefresh();
  };

  const handleBudgetMonthChange = (value: string) => {
    // Clear expansion state when changing months
    clearExpansionState();
    updateSelectedBudgetMonth(value);
    triggerRefresh();
  };
  const costGroups = budgetState?.historicalData?.[budgetState.selectedMonthKey]?.costGroups || [];
  const categoryRulesFromState = budgetState?.categoryRules || [];
  
  // CRITICAL: Read transactions from centralized storage - single source of truth
  const allTransactions = useMemo(() => {
    console.log('[TX IMPORT] 🔄 Reading from centralized transaction storage');
    console.log('[TX IMPORT] 📊 Total transactions in centralized storage:', budgetState?.allTransactions?.length || 0);
    
    // Convert Transaction[] to ImportedTransaction[] format
    const transactions = (budgetState?.allTransactions || []).map(t => ({
      id: t.id,
      accountId: t.accountId,
      date: t.date,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      description: t.description,
      userDescription: t.userDescription,
      type: t.type as ImportedTransaction['type'],
      status: t.status as ImportedTransaction['status'],
      linkedTransactionId: t.linkedTransactionId,
      correctedAmount: t.correctedAmount,
      isManuallyChanged: t.isManuallyChanged,
      appCategoryId: t.appCategoryId,
      appSubCategoryId: t.appSubCategoryId,
      importedAt: (t as any).importedAt || new Date().toISOString(),
      fileSource: (t as any).fileSource || 'budgetState'
    } as ImportedTransaction));
    
    console.log('[TX IMPORT] 📊 Converted transactions:', transactions.length);
    
    // Debug: Show transactions per account
    const accountCounts = transactions.reduce((acc, t) => {
      acc[t.accountId] = (acc[t.accountId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('[TX IMPORT] 📊 Transactions per account:', accountCounts);
    
    return transactions;
  }, [budgetState?.allTransactions, refreshKey]);

  // Use actual accounts from budget state
  const accounts: Account[] = budgetState?.accounts || [];
  
  // Get main categories from actual budget data
  const mainCategories = budgetState?.mainCategories || [];
  
  // Get subcategories from storage
  const [subcategoriesFromStorage, setSubcategoriesFromStorage] = useState<Record<string, string[]>>({});
  
  // Read category rules directly from central state (no local state)
  const categoryRules = categoryRulesFromState;

  // Check if CSV contains transactions on/after 24th for balance correction
  const hasTransactionsOnOrAfter24th = useMemo(() => {
    return allTransactions.some(tx => {
      const date = new Date(tx.date);
      return date.getDate() >= 24;
    });
  }, [allTransactions]);

  // Prepare account balances data for balance correction dialog
  const accountBalancesForDialog = useMemo(() => {
    const balances: Record<string, Record<string, number>> = {};
    
    Object.entries(budgetState?.historicalData || {}).forEach(([monthKey, monthData]) => {
      balances[monthKey] = monthData.accountBalances || {};
    });
    
    return balances;
  }, [budgetState?.historicalData]);
  
  useEffect(() => {
    const loadedSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
    setSubcategoriesFromStorage(loadedSubcategories);
  }, []);

  // Load banks and mappings from storage
  useEffect(() => {
    const storedBanks = get<Bank[]>(StorageKey.BANKS) || [];
    const storedMappings = get<BankCSVMapping[]>(StorageKey.BANK_CSV_MAPPINGS) || [];
    setBanks(storedBanks);
    setBankCSVMappings(storedMappings);
  }, []);

  // State to collect balance updates during import
  const [balanceUpdates, setBalanceUpdates] = useState<{accountName: string, newBalance: number, monthKey: string}[]>([]);
  const [isWaitingForBalanceUpdates, setIsWaitingForBalanceUpdates] = useState(false);
  const [pendingToast, setPendingToast] = useState<{fileName: string} | null>(null);

  // Listen for automatic balance updates from saldo imports
  useEffect(() => {
    const handleBalanceUpdate = (event: CustomEvent) => {
      const { accountName, newBalance, monthKey } = event.detail;
      console.log('🔄 [BALANCE UPDATE] Received balance update event:', { accountName, newBalance, monthKey });
      setBalanceUpdates(prev => [...prev, { accountName, newBalance, monthKey }]);
    };

    window.addEventListener('balanceUpdated', handleBalanceUpdate as EventListener);
    
    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate as EventListener);
    };
  }, []);

  // Show combined toast when balance updates are complete
  useEffect(() => {
    if (pendingToast && !isWaitingForBalanceUpdates) {
      console.log('🔄 [TOAST] Showing combined toast with balance updates:', balanceUpdates);
      
      let toastDescription = `Transaktioner från ${pendingToast.fileName} har bearbetats och sparats till budgeten.`;
      
      // Add balance updates if any occurred during import
      if (balanceUpdates.length > 0) {
        const balanceText = balanceUpdates.map(update => 
          `${update.accountName}: ${update.newBalance.toLocaleString('sv-SE')} kr - ${update.monthKey}`
        ).join('. ');
        
        toastDescription += `\n\nSaldo uppdaterat\nFaktiskt saldo har uppdaterats för månaderna: ${balanceText}`;
      }

      toast({
        title: "Fil uppladdad",
        description: toastDescription,
      });
      
      // Clear states
      setPendingToast(null);
      setBalanceUpdates([]);
    }
  }, [pendingToast, isWaitingForBalanceUpdates, balanceUpdates, toast]);

  const handleAddBank = (bankName: string) => {
    const newBank: Bank = {
      id: uuidv4(),
      name: bankName,
      createdAt: new Date().toISOString()
    };
    
    const updatedBanks = [...banks, newBank];
    setBanks(updatedBanks);
    set(StorageKey.BANKS, updatedBanks);
  };

  const handleBankSelection = (accountId: string, bankId: string) => {
    console.log(`🏦 [TransactionImportEnhanced] Bank selection: Account ${accountId} -> Bank ${bankId}`);
    
    // Spara permanent koppling via orchestrator
    linkAccountToBankTemplate(accountId, bankId);
    
    // Uppdatera lokalt state för UI
    setSelectedBanks(prev => ({ ...prev, [accountId]: bankId }));
    
    // Load existing mapping for this bank if available
    const existingMapping = bankCSVMappings.find(mapping => mapping.bankId === bankId && mapping.isActive);
    if (existingMapping) {
      console.log('🔗 Found existing mapping for bank:', bankId, existingMapping);
    }
  };

  // Helper function to parse XLSX files and convert to CSV format
  const parseXLSXFile = useCallback(async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Get the first worksheet
    const worksheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[worksheetName];
    
    // Convert to CSV format - Use array method to preserve empty cells
    const sheetData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: '', // Keep empty cells as empty strings
      raw: false  // Format values as strings
    });
    
    // Convert back to CSV with semicolon separator, preserving all columns
    let csvData = sheetData.map((row: any[]) => {
      // Ensure we have at least 8 columns for all expected fields
      const paddedRow = [...row];
      while (paddedRow.length < 8) paddedRow.push('');
      return paddedRow.join(';');
    }).join('\n');
    
    console.log(`🚀 [IMPORT] XLSX converted with preserved cells, length: ${csvData.length}`);
    
    // Debug: Check for April data in XLSX conversion
    const lines = csvData.split('\n');
    const aprilLines = lines.filter(line => line.includes('2025-04'));
    console.log(`🔍 [XLSX] Total lines in converted CSV: ${lines.length}`);
    console.log(`🔍 [XLSX] April 2025 lines found: ${aprilLines.length}`);
    
    // Debug headers - check first few lines
    console.log(`🔍 [XLSX] First 5 lines from XLSX conversion:`);
    lines.slice(0, 5).forEach((line, index) => {
      console.log(`🔍 [XLSX] Line ${index + 1}: "${line}"`);
    });
    
    // Fix XLSX header structure - find the real header row and remove title/empty rows
    let headerRowIndex = -1;
    let filteredLines: string[] = [];
    
    // Find the real header row (contains "Datum", "Kategori", "Text", etc.)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('Datum') && line.includes('Kategori') && line.includes('Underkategori') && line.includes('Text')) {
        headerRowIndex = i;
        console.log(`🔍 [XLSX] Found header row at index: ${i}`);
        break;
      }
    }
    
    if (headerRowIndex >= 0) {
      // Include header row and all following data rows (skip title and empty rows before header)
      filteredLines = lines.slice(headerRowIndex).filter(line => {
        // Keep header and all non-empty data rows
        return line.trim() && !line.match(/^;+$/);
      });
      
      console.log(`🔍 [XLSX] After filtering: ${filteredLines.length} lines (header + data)`);
      console.log(`🔍 [XLSX] Header line: "${filteredLines[0]}"`);
      
      const headers = filteredLines[0].split(';').map(h => h.trim());
      console.log(`🔍 [XLSX] Parsed headers:`, headers);
      
      // Debug: Show position of category columns
      headers.forEach((header, index) => {
        if (header.toLowerCase().includes('kategori')) {
          console.log(`🔍 [XLSX] Category column "${header}" at position ${index + 1}`);
        }
      });
      
      addMobileDebugLog(`🔍 XLSX Headers: ${headers.join(', ')}`);
      addMobileDebugLog(`🔍 XLSX Category columns: Kategori at pos ${headers.indexOf('Kategori') + 1}, Underkategori at pos ${headers.indexOf('Underkategori') + 1}`);
      
      // Show sample data to verify category columns have values
      if (filteredLines.length > 1) {
        const sampleRow = filteredLines[1].split(';');
        console.log(`🔍 [XLSX] Sample data row:`, sampleRow);
        const kategoriIndex = headers.indexOf('Kategori');
        const underkategoriIndex = headers.indexOf('Underkategori');
        console.log(`🔍 [XLSX] Sample Kategori: "${sampleRow[kategoriIndex] || 'MISSING'}" at index ${kategoriIndex}`);
        console.log(`🔍 [XLSX] Sample Underkategori: "${sampleRow[underkategoriIndex] || 'MISSING'}" at index ${underkategoriIndex}`);
      }
    } else {
      console.warn(`🔍 [XLSX] Could not find header row with expected columns`);
      // Fallback to original filtering
      filteredLines = lines.filter((line, index) => {
        if (!line.trim()) return false;
        if (line.startsWith('Transaktioner')) return false;
        if (line.match(/^;+$/)) return false;
        return true;
      });
    }
    
    // Reconstruct CSV data
    csvData = filteredLines.join('\n');
    
    aprilLines.slice(0, 5).forEach((line, index) => {
      console.log(`🔍 [XLSX] April line ${index + 1}: ${line}`);
    });
    addMobileDebugLog(`🔍 XLSX: ${lines.length} total lines, ${aprilLines.length} April lines, ${filteredLines.length} after cleanup`);
    
    return csvData;
  }, []);

  // File upload handler - uses the new Smart Merge function
  const handleFileUpload = useCallback(async (file: File, accountId: string, accountName: string) => {
    console.log(`🚀 [IMPORT] handleFileUpload called with:`, { fileName: file.name, accountId, accountName });
    addMobileDebugLog(`📁 FILE UPLOAD STARTED: ${file.name} for account ${accountId}`);
    
    // Clear any previous balance updates and prepare for new import
    setBalanceUpdates([]);
    setIsWaitingForBalanceUpdates(true);
    setPendingToast({ fileName: file.name });
    
    try {
      let csvContent: string;
      
      // Check file type and parse accordingly
      const fileExtension = file.name.toLowerCase().split('.').pop();
      
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        console.log(`🚀🚀🚀 XLSX IMPORT STARTING: ${file.name} 🚀🚀🚀`);
        console.clear(); // Clear console to see XLSX logs clearly
        addMobileDebugLog(`📁 Processing XLSX file: ${file.name}`);
        csvContent = await parseXLSXFile(file);
      } else {
        console.log(`🚀 [IMPORT] Processing CSV file: ${file.name}`);
        addMobileDebugLog(`📁 Processing CSV file: ${file.name}`);
        
        // Read file with proper encoding for Swedish characters
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        csvContent = decoder.decode(arrayBuffer);
      }
      
      // Clean up encoding issues - remove � characters and fix common Swedish character issues
      csvContent = csvContent
        .replace(/�/g, '') // Remove � characters
        .replace(/Ã¥/g, 'å') // Fix å
        .replace(/Ã¤/g, 'ä') // Fix ä  
        .replace(/Ã¶/g, 'ö') // Fix ö
        .replace(/Ã…/g, 'Å') // Fix Å
        .replace(/Ã„/g, 'Ä') // Fix Ä
        .replace(/Ã–/g, 'Ö'); // Fix Ö
      
      console.log(`🚀 [IMPORT] File content cleaned, length: ${csvContent.length}`);
      addMobileDebugLog(`📁 File read successfully: ${csvContent.length} characters`);
      
      if (!csvContent || csvContent.trim().length === 0) {
        setIsWaitingForBalanceUpdates(false);
        setPendingToast(null);
        toast({
          title: "Fel vid filläsning",
          description: "Kunde inte läsa filinnehållet.",
          variant: "destructive"
        });
        return;
      }

      // Parse and store raw CSV data for table display
      const lines = csvContent.split('\n').filter(line => line.trim());
      const headers = lines[0]?.split(';').map(h => h.trim()) || [];
      const rows = lines.slice(1).map(line => line.split(';').map(cell => cell.trim()));
      
      setRawCsvData(prev => ({
        ...prev,
        [accountId]: { headers, rows }
      }));

      // Use the new Smart Merge function - eliminates duplicates and preserves manual changes
      console.log('🔄 [DEBUG] About to import file with accountId:', accountId);
      console.log('🔄 [DEBUG] Account name:', accountName);
      console.log('🔄 [DEBUG] File type:', fileExtension);
      console.log('🔄 [DEBUG] CSV content preview:', csvContent.substring(0, 200));
      console.log('🔄 [DEBUG] CSV lines count:', csvContent.split('\n').length);
      
      // Debug: Check headers and sample data
      const csvLines = csvContent.split('\n');
      const csvHeaders = csvLines[0]?.split(';') || [];
      console.log('🔍 [DEBUG] Headers from CSV content:', csvHeaders);
      console.log('🔍 [DEBUG] Sample CSV lines:');
      csvLines.slice(0, 5).forEach((line, index) => {
        console.log(`🔍 [DEBUG] Line ${index}: ${line}`);
      });
      
      addMobileDebugLog(`🔄 About to import for account: ${accountId}`);
      addMobileDebugLog(`🔄 CSV preview: ${csvContent.substring(0, 100)}...`);
      addMobileDebugLog(`🔄 Headers: ${csvHeaders.join(', ')}`);
      
      console.log(`🚀 [IMPORT] About to call importAndReconcileFile...`);
      console.log(`🚀 [IMPORT] XLSX import targeting account: ${accountName} (${accountId})`);
      console.log(`🚀 [IMPORT] CSV content has ${csvContent.split('\n').length} lines (including header)`);
      importAndReconcileFile(csvContent, accountId);
      console.log(`🚀 [IMPORT] importAndReconcileFile call completed for account: ${accountName}`);
      
      console.log('🔄 [DEBUG] After importAndReconcileFile - checking budgetState...');
      
      // Wait for processing and balance updates, then allow toast to show
      setTimeout(() => {
        const currentState = getCurrentState();
        console.log('🔄 [DEBUG] Post-import budgetState:', currentState.budgetState);
        console.log('🔄 [DEBUG] Post-import historicalData keys:', Object.keys(currentState.budgetState.historicalData || {}));
        
        // Trigger component re-render by updating refresh key
        setRefreshKey(prev => prev + 1);
        console.log('🔄 [DEBUG] Triggered UI refresh after file import');
        
        // Allow toast to show (balance updates should be complete by now)
        setIsWaitingForBalanceUpdates(false);
      }, 500); // Increased delay to ensure balance updates are processed
        
    } catch (error) {
      console.error('Error uploading file:', error);
      addMobileDebugLog(`❌ FILE UPLOAD ERROR: ${error instanceof Error ? error.message : String(error)}`);
      addMobileDebugLog(`❌ Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      setIsWaitingForBalanceUpdates(false);
      setPendingToast(null);
      toast({
        title: "Fel vid uppladdning",
        description: `Ett fel uppstod vid bearbetning av filen: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    }
  }, [toast, parseXLSXFile]);

  const triggerFileUpload = useCallback((accountId: string) => {
    addMobileDebugLog(`🔄 TRIGGER FILE UPLOAD clicked for account: ${accountId}`);
    const input = fileInputRefs.current[accountId];
    if (input) {
      addMobileDebugLog(`🔄 File input found, clearing value and triggering click`);
      addMobileDebugLog(`🔄 File input disabled: ${input.disabled}, type: ${input.type}, accept: ${input.accept}`);
      // CRITICAL: Clear the input value to ensure fresh file processing
      input.value = '';
      try {
        input.click();
        addMobileDebugLog(`🔄 File input click() executed successfully`);
      } catch (error) {
        addMobileDebugLog(`❌ Error clicking file input: ${error}`);
      }
    } else {
      addMobileDebugLog(`❌ No file input found for account: ${accountId}`);
      addMobileDebugLog(`❌ Available file inputs: ${Object.keys(fileInputRefs.current).join(', ')}`);
    }
  }, []);

  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactions(prev => 
      prev.includes(transactionId) 
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  // Select all filtered transactions
  const selectAllFilteredTransactions = (filteredTransactions: ImportedTransaction[]) => {
    const filteredIds = filteredTransactions.map(t => t.id);
    setSelectedTransactions(prev => {
      const currentlySelected = prev.filter(id => filteredIds.includes(id));
      if (currentlySelected.length === filteredIds.length) {
        // All are selected, unselect all
        return prev.filter(id => !filteredIds.includes(id));
      } else {
        // Not all are selected, select all
        const newSelection = [...prev.filter(id => !filteredIds.includes(id)), ...filteredIds];
        return newSelection;
      }
    });
  };

  // Select all transactions for a specific account
  const selectAllAccountTransactions = (accountTransactions: ImportedTransaction[]) => {
    const accountIds = accountTransactions.map(t => t.id);
    setSelectedTransactions(prev => {
      const currentlySelected = prev.filter(id => accountIds.includes(id));
      if (currentlySelected.length === accountIds.length) {
        // All are selected, unselect all
        return prev.filter(id => !accountIds.includes(id));
      } else {
        // Not all are selected, select all
        const newSelection = [...prev.filter(id => !accountIds.includes(id)), ...accountIds];
        return newSelection;
      }
    });
  };

  // Select all transactions for a specific date
  const selectAllDateTransactions = (dateTransactions: ImportedTransaction[]) => {
    const dateIds = dateTransactions.map(t => t.id);
    setSelectedTransactions(prev => {
      const currentlySelected = prev.filter(id => dateIds.includes(id));
      if (currentlySelected.length === dateIds.length) {
        // All are selected, unselect all
        return prev.filter(id => !dateIds.includes(id));
      } else {
        // Not all are selected, select all
        const newSelection = [...prev.filter(id => !dateIds.includes(id)), ...dateIds];
        return newSelection;
      }
    });
  };

  // UNIFIED UPDATE FUNCTION - This connects the UI back to the central state
  const handleTransactionUpdate = (transactionId: string, updates: Partial<ImportedTransaction>) => {
    console.log(`🔄 [TransactionImportEnhanced] Updating transaction ${transactionId} with updates:`, updates);
    
    // Find the transaction to get its date and derive monthKey
    // First try filteredTransactions (current view), then allTransactions
    let transaction = filteredTransactions.find(t => t.id === transactionId);
    if (!transaction) {
      transaction = allTransactions.find(t => t.id === transactionId);
    }
    
    if (!transaction) {
      console.error(`Transaction ${transactionId} not found in filtered or all transactions`);
      toast({
        title: "Fel",
        description: "Kunde inte hitta transaktionen. Försök ladda om sidan.",
        variant: "destructive"
      });
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
      const updatedTransaction = currentState.budgetState.allTransactions.find((t: any) => t.id === transactionId);
      console.log(`🔄 [TransactionImportEnhanced] Transaction after update:`, updatedTransaction ? {
        id: updatedTransaction.id,
        status: updatedTransaction.status,
        type: updatedTransaction.type,
        isManuallyChanged: updatedTransaction.isManuallyChanged
      } : 'NOT FOUND');
      
      // Force a state refresh by updating a dummy state value
      setRefreshKey(prev => prev + 1);
    }, 100);
  };

  // Create a refresh function to be passed to components
  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const toggleAccountExpansion = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const toggleDateExpansion = (dateKey: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(dateKey)) {
      newExpanded.delete(dateKey);
    } else {
      newExpanded.add(dateKey);
    }
    setExpandedDates(newExpanded);
  };

  const getTransactionsInDateRange = (targetDate: string, accountTransactions: any[]) => {
    const target = new Date(targetDate);
    const startDate = new Date(target);
    startDate.setDate(target.getDate() - 7);
    const endDate = new Date(target);
    endDate.setDate(target.getDate() + 7);

    return accountTransactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= endDate && transaction.date !== targetDate;
    });
  };

  const openDateRangeDialog = (date: string, accountId: string, accountTransactions: any[]) => {
    const rangeTransactions = getTransactionsInDateRange(date, accountTransactions);
    setDateRangeDialog({
      isOpen: true,
      date,
      accountId,
      transactions: rangeTransactions
    });
  };

  const updateTransactionNote = (transactionId: string, userDescription: string) => {
    handleTransactionUpdate(transactionId, { userDescription });
  };

  const updateTransactionCategory = (transactionId: string, categoryName: string, subCategoryId?: string) => {
    const costGroup = costGroups.find(g => g.name === categoryName);
    const categoryId = costGroup ? costGroup.id : categoryName;
    
    // Find the current transaction - first try filtered, then all
    let currentTransaction = filteredTransactions.find(t => t.id === transactionId);
    if (!currentTransaction) {
      currentTransaction = allTransactions.find(t => t.id === transactionId);
    }
    
    if (!currentTransaction) {
      console.error(`Transaction ${transactionId} not found for category update`);
      toast({
        title: "Fel",
        description: "Kunde inte hitta transaktionen för att uppdatera kategori.",
        variant: "destructive"
      });
      return;
    }
    
    // Create updated transaction object for status determination
    const updatedTransaction = {
      ...currentTransaction,
      appCategoryId: categoryId,
      appSubCategoryId: subCategoryId
    };
    
    // Use centralized status determination that includes auto-approval logic
    const newStatus = determineTransactionStatus(updatedTransaction);
    
    handleTransactionUpdate(transactionId, { 
      appCategoryId: categoryId,
      appSubCategoryId: subCategoryId,
      status: newStatus
    });
  };

  const updateTransactionStatus = (transactionId: string, status: 'green' | 'yellow' | 'red') => {
    handleTransactionUpdate(transactionId, { status });
  };

  const handleTransferMatch = (transaction: ImportedTransaction) => {
    // Find potential matches - ALL transactions with opposite sign within 7 days from OTHER accounts
    const potentialMatches = allTransactions.filter(t => 
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

  const handleExpenseClaim = (transaction: ImportedTransaction) => {
    setExpenseClaimDialog({
      isOpen: true,
      expense: transaction
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
        console.log(`🔄 [BULK APPROVE] Approving transaction ${transactionId} via handleTransactionUpdate`);
        // Use handleTransactionUpdate instead of direct updateTransaction to get force refresh
        handleTransactionUpdate(transactionId, { status: 'green' as const });
      }
    });

    setSelectedTransactions([]);
    
    // Force immediate UI refresh
    console.log(`🔄 [BULK APPROVE] Forcing refresh by updating refreshKey`);
    setRefreshKey(prev => prev + 1);
    
    toast({
      title: "Transaktioner godkända",
      description: `${selectedTransactions.length} transaktioner har godkänts.`,
    });
  };
  
  // Helper function to automatically find and match internal transfers
  const findAndMatchTransfer = (transaction: ImportedTransaction) => {
    console.log(`🔄 [AUTO TRANSFER MATCH] Attempting to match transaction ${transaction.id}: ${transaction.description} (${transaction.amount} kr, ${transaction.date}, account: ${transaction.accountId})`);
    
    // Find potential matches on the same date with opposite signs on different accounts
    // Include any transaction type, not just InternalTransfer, since regular transactions can be converted
    const potentialMatches = allTransactions.filter(t => 
      t.id !== transaction.id &&
      t.accountId !== transaction.accountId && // Different account
      t.date === transaction.date && // Same date only
      // Opposite signs (positive matches negative, negative matches positive)
      ((transaction.amount > 0 && t.amount < 0) || (transaction.amount < 0 && t.amount > 0)) &&
      Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01 && // Same absolute amount
      !t.linkedTransactionId // Not already linked
    );
    
    console.log(`🔄 [AUTO TRANSFER MATCH] Found ${potentialMatches.length} potential matches for transaction ${transaction.id}:`);
    potentialMatches.forEach(match => {
      console.log(`  - ${match.id}: ${match.description} (${match.amount} kr, ${match.date}, account: ${match.accountId})`);
    });
    
    // If exactly one match found, auto-link them
    if (potentialMatches.length === 1) {
      const matchedTransaction = potentialMatches[0];
      console.log(`🔄 [AUTO TRANSFER MATCH] Found exact match on same date: ${transaction.id} (${transaction.amount} kr, ${transaction.date}) <-> ${matchedTransaction.id} (${matchedTransaction.amount} kr, ${matchedTransaction.date})`);
      
      // Use the matchInternalTransfer function from imports
      // Match the transactions
      matchInternalTransfer(transaction.id, matchedTransaction.id);
      
      return true; // Indicates a match was found and linked
    }
    
    if (potentialMatches.length > 1) {
      console.log(`🔄 [AUTO TRANSFER MATCH] Multiple potential matches found for ${transaction.id}, skipping auto-match. Matches: ${potentialMatches.length}`);
    } else if (potentialMatches.length === 0) {
      console.log(`🔄 [AUTO TRANSFER MATCH] No potential matches found for ${transaction.id}`);
    }
    
    return false; // No unique match found
  };

  // Apply all rules to filtered transactions
  const applyRulesToFilteredTransactions = () => {
    let updatedCount = 0;
    let autoMatchedCount = 0;
    let autoApprovedCount = 0;
    
    filteredTransactions.forEach(transaction => {
      // Check each rule for ALL filtered transactions (no status check)
      for (const rule of categoryRules) {
        if (!rule.isActive) continue;
        
        let matchFound = false;
        
        // Check based on condition type
        if (rule.condition.type === 'categoryMatch') {
          // Check bank category match
          if (transaction.bankCategory === rule.condition.bankCategory) {
            // If no bank subcategory specified in rule, or it matches
            if (!rule.condition.bankSubCategory || transaction.bankSubCategory === rule.condition.bankSubCategory) {
              matchFound = true;
            }
          }
        } else if (rule.condition.type === 'textContains') {
          const searchLower = rule.condition.value.toLowerCase();
          const descriptionLower = (transaction.description || '').toLowerCase();
          
          if (descriptionLower.includes(searchLower)) {
            matchFound = true;
          }
        } else if (rule.condition.type === 'textStartsWith') {
          const searchLower = rule.condition.value.toLowerCase();
          const descriptionLower = (transaction.description || '').toLowerCase();
          
          if (descriptionLower.startsWith(searchLower)) {
            matchFound = true;
          }
        }
        
        if (matchFound) {
          // Check if rule applies to this account
          if (rule.action.applicableAccountIds && 
              rule.action.applicableAccountIds.length > 0 && 
              !rule.action.applicableAccountIds.includes(transaction.accountId)) {
            continue;
          }
          
          // Apply the rule - update category
          updateTransactionCategory(transaction.id, rule.action.appMainCategoryId, rule.action.appSubCategoryId);
          
          // Apply the rule - update transaction type based on amount, but preserve InternalTransfer
          const isPositive = transaction.amount >= 0;
          let newTransactionType = isPositive ? 
            rule.action.positiveTransactionType : 
            rule.action.negativeTransactionType;
          
          // Preserve existing InternalTransfer type and set it for "Intern Överföring" transactions
          const isInternalTransfer = transaction.type === 'InternalTransfer' || 
                                    transaction.bankCategory === 'Intern Överföring' ||
                                    (transaction.bankCategory && transaction.bankCategory.includes('Överföring'));
          
          if (isInternalTransfer) {
            newTransactionType = 'InternalTransfer';
            console.log(`Preserving InternalTransfer type for transaction ${transaction.id} during manual rule application (category: ${transaction.bankCategory})`);
          }
          
          // Update transaction type using handleTransactionUpdate
          handleTransactionUpdate(transaction.id, { 
            type: newTransactionType as 'Transaction' | 'InternalTransfer' | 'Savings' | 'CostCoverage' | 'ExpenseClaim'
          });
          
          // If the rule sets transaction type to InternalTransfer, try to auto-match
          if (newTransactionType === 'InternalTransfer') {
            const wasMatched = findAndMatchTransfer(transaction);
            if (wasMatched) {
              autoMatchedCount++;
              
              // Check if the matched transaction should also be auto-approved
              // Find the matched transaction ID from the linking
              const updatedTransaction = allTransactions.find(t => t.id === transaction.id);
              if (updatedTransaction?.linkedTransactionId) {
                const linkedTransaction = allTransactions.find(t => t.id === updatedTransaction.linkedTransactionId);
                if (linkedTransaction) {
                  // Check if the linked transaction also has a rule that applies
                  for (const linkedRule of categoryRules) {
                    if (!linkedRule.isActive) continue;
                    
                    let linkedMatchFound = false;
                    
                    // Check the same rule conditions for the linked transaction
                    if (linkedRule.condition.type === 'categoryMatch') {
                      if (linkedTransaction.bankCategory === linkedRule.condition.bankCategory) {
                        if (!linkedRule.condition.bankSubCategory || linkedTransaction.bankSubCategory === linkedRule.condition.bankSubCategory) {
                          linkedMatchFound = true;
                        }
                      }
                    } else if (linkedRule.condition.type === 'textContains') {
                      const searchLower = linkedRule.condition.value.toLowerCase();
                      const descriptionLower = (linkedTransaction.description || '').toLowerCase();
                      if (descriptionLower.includes(searchLower)) {
                        linkedMatchFound = true;
                      }
                    } else if (linkedRule.condition.type === 'textStartsWith') {
                      const searchLower = linkedRule.condition.value.toLowerCase();
                      const descriptionLower = (linkedTransaction.description || '').toLowerCase();
                      if (descriptionLower.startsWith(searchLower)) {
                        linkedMatchFound = true;
                      }
                    }
                    
                    if (linkedMatchFound) {
                      // Check if rule applies to the linked transaction's account
                      if (linkedRule.action.applicableAccountIds && 
                          linkedRule.action.applicableAccountIds.length > 0 && 
                          !linkedRule.action.applicableAccountIds.includes(linkedTransaction.accountId)) {
                        continue;
                      }
                      
                      // Apply rule to linked transaction if it matches
                      updateTransactionCategory(linkedTransaction.id, linkedRule.action.appMainCategoryId, linkedRule.action.appSubCategoryId);
                      
                      // Auto-approve linked transaction if it has both categories
                      if (linkedRule.action.appMainCategoryId && linkedRule.action.appSubCategoryId) {
                        handleTransactionUpdate(linkedTransaction.id, { status: 'green' as const });
                        autoApprovedCount++;
                      }
                      break;
                    }
                  }
                }
              }
            }
          }
          
          // If both category and subcategory are set, auto-approve the transaction
          if (rule.action.appMainCategoryId && rule.action.appSubCategoryId) {
            handleTransactionUpdate(transaction.id, { status: 'green' as const });
            autoApprovedCount++;
          }
          
          updatedCount++;
          break; // Stop checking other rules for this transaction
        }
      }
    });
    
    // After applying rules, also try to auto-match any unmatched InternalTransfer transactions
    // This includes existing InternalTransfer transactions that weren't covered by rules
    // Also check any Transaction that could potentially be a transfer (to catch cases like the user's example)
    const unmatchedTransfers = filteredTransactions.filter(t => 
      (t.type === 'InternalTransfer' || t.type === 'Transaction') && !t.linkedTransactionId
    );
    
    console.log(`🔄 [AUTO TRANSFER MATCH] Found ${unmatchedTransfers.length} unmatched transactions to process for transfer matching:`);
    unmatchedTransfers.forEach((transfer, index) => {
      console.log(`  ${index + 1}. ${transfer.id}: ${transfer.description} (${transfer.amount} kr, ${transfer.date}, type: ${transfer.type}, account: ${transfer.accountId})`);
    });
    
    // Store matching results for detailed feedback
    const matchingResults: string[] = [];
    
    unmatchedTransfers.forEach(transfer => {
      const wasMatched = findAndMatchTransfer(transfer);
      if (wasMatched) {
        autoMatchedCount++;
        matchingResults.push(`✓ ${transfer.description} (${transfer.amount} kr, ${transfer.date})`);
      } else {
        // Find potential matches to explain why it didn't work
        const potentialMatches = allTransactions.filter(t => 
          t.id !== transfer.id &&
          t.accountId !== transfer.accountId &&
          t.date === transfer.date &&
          ((transfer.amount > 0 && t.amount < 0) || (transfer.amount < 0 && t.amount > 0)) &&
          Math.abs(Math.abs(t.amount) - Math.abs(transfer.amount)) < 0.01 &&
          !t.linkedTransactionId
        );
        
        if (potentialMatches.length === 0) {
          matchingResults.push(`✗ ${transfer.description} (${transfer.amount} kr, ${transfer.date}) - Ingen matchning hittad`);
        } else if (potentialMatches.length > 1) {
          matchingResults.push(`✗ ${transfer.description} (${transfer.amount} kr, ${transfer.date}) - ${potentialMatches.length} möjliga matchningar (tvetydig)`);
        } else {
          const match = potentialMatches[0];
          matchingResults.push(`✗ ${transfer.description} (${transfer.amount} kr, ${transfer.date}) - Hittade match: ${match.description} men kunde inte länka`);
        }
      }
    });
    
    if (updatedCount > 0 || autoMatchedCount > 0) {
      let description = '';
      if (updatedCount > 0) {
        description += `${updatedCount} transaktioner uppdaterades enligt reglerna.`;
      }
      if (autoMatchedCount > 0) {
        if (description) description += ' ';
        description += `${autoMatchedCount} interna överföringar matchades automatiskt.`;
      }
      if (autoApprovedCount > 0) {
        if (description) description += ' ';
        description += `${autoApprovedCount} transaktioner godkändes automatiskt.`;
      }
      
      toast({
        title: "Regler tillämpade",
        description: description
      });
      
      // Show detailed matching results if there were any transfer attempts
      if (matchingResults.length > 0) {
        setTimeout(() => {
          toast({
            title: "Automatisk matchningsdetaljer",
            description: matchingResults.slice(0, 2).join(' | ') + (matchingResults.length > 2 ? ` | ...och ${matchingResults.length - 2} till` : ''),
            duration: 8000, // Show longer to read the details
          });
        }, 1500);
      }
      // Force refresh after applying rules
      setRefreshKey(prev => prev + 1);
      
      // Recalculate all transaction statuses to apply new business rules
      recalculateAllTransactionStatuses();
      
      // Additional force refresh for UI consistency 
      setTimeout(() => {
        setRefreshKey(prev => prev + 1);
      }, 100);
    } else {
      toast({
        title: "Inga ändringar",
        description: "Inga transaktioner matchade reglerna."
      });
    }
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
            // Force fresh calculation of transactions for this account
            const accountTransactions = allTransactions.filter(t => t.accountId === account.id);
            const hasTransactions = accountTransactions.length > 0;
            
            // Additional debug for specific account issues
            if (account.name === "Överföring" || accountTransactions.length > 0) {
              console.log(`[ACCOUNT DEBUG] ${account.name} (${account.id}): ${accountTransactions.length} transactions`);
            }
            
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
                        <Badge 
                          variant="secondary" 
                          className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                          onClick={() => setAllTransactionsDialog({
                            isOpen: true,
                            accountId: account.id,
                            accountName: account.name
                          })}
                        >
                          {(() => {
                            const count = allTransactions.filter(t => t.accountId === account.id).length;
                            console.log(`[TX COUNT] Account ${account.name} (${account.id}): ${count} transactions out of ${allTransactions.length} total`);
                            return count;
                          })()} transaktioner
                        </Badge>
                      )}
                      <Button
                        onClick={() => triggerFileUpload(account.id)}
                        size="sm"
                        variant={hasTransactions ? "outline" : "default"}
                        className="text-xs sm:text-sm"
                        disabled={!account.bankTemplateId && !selectedBanks[account.id]}
                      >
                        <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        {hasTransactions ? "Ändra fil" : "Ladda upp CSV/XLSX"}
                      </Button>
                      {rawCsvData[account.id]?.headers && (
                        <Button
                          onClick={() => {
                            // Create temporary bank if account doesn't have one
                            if (!account.bankTemplateId && !selectedBanks[account.id]) {
                              const tempBank: Bank = {
                                id: `temp_${account.id}`,
                                name: `${account.name} Bank`,
                                createdAt: new Date().toISOString()
                              };
                              setBanks(prev => [...prev, tempBank]);
                              handleBankSelection(account.id, tempBank.id);
                            }
                            setCurrentStep('mapping');
                          }}
                          size="sm"
                          variant="secondary"
                          className="text-xs"
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          Kolumnmappning
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Bank selection */}
                    <div className="space-y-2">
                      <Label htmlFor={`bank-${account.id}`} className="text-sm font-medium">Bank</Label>
                      <div className="flex items-center space-x-2">
                        <Select 
                          value={account.bankTemplateId || selectedBanks[account.id] || ''} 
                          onValueChange={(value) => handleBankSelection(account.id, value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Välj bank" />
                          </SelectTrigger>
                          <SelectContent>
                            {banks.map(bank => (
                              <SelectItem key={bank.id} value={bank.id}>
                                {bank.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <AddBankDialog 
                          onAddBank={handleAddBank}
                          trigger={
                            <Button variant="outline" size="icon">
                              <Plus className="w-4 h-4" />
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  ref={(el) => fileInputRefs.current[account.id] = el}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    addMobileDebugLog(`📁 FILE INPUT CHANGE EVENT: ${file ? file.name : 'no file'} for account ${account.id}`);
                    if (file) {
                      addMobileDebugLog(`📁 Calling handleFileUpload for: ${file.name}`);
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
  const getCurrentMapping = (bankId: string) => {
    // Create file fingerprint for this bank
    const fileFingerprint = `bank_${bankId}`;
    return getCsvMapping(fileFingerprint)?.columnMapping || {};
  };

  // Save mapping to central state
  const saveCurrentMapping = (bankId: string, columnMapping: { [key: string]: string }) => {
    const fileFingerprint = `bank_${bankId}`;
    console.log(`💾 [TransactionImportEnhanced] Saving mapping for ${fileFingerprint}:`, columnMapping);
    
    saveCsvMapping({
      fileFingerprint,
      columnMapping
    });
  };

  // Mapping step - restored functionality
  const renderMappingStep = () => {
    const systemFields = [
      { value: 'date', label: 'Datum' },
      { value: 'category', label: 'Kategori' }, 
      { value: 'subcategory', label: 'Underkategori' },
      { value: 'description', label: 'Beskrivning' },
      { value: 'amount', label: 'Belopp' },
      { value: 'balanceAfter', label: 'Saldo' },
      { value: 'status', label: 'Status' },
      { value: 'ignore', label: 'Ignorera' }
    ];

    // Get unique banks that have uploaded files/transactions OR raw CSV data
    const banksWithTransactions = banks.filter(bank => {
      // Check if any account has this bank as template AND has transactions OR raw CSV data
      return accounts.some(account => 
        account.bankTemplateId === bank.id && 
        (allTransactions.some(t => t.accountId === account.id) || rawCsvData[account.id]?.headers)
      );
    });

    console.log('🔍 [DEBUG] Banks with transactions:', banksWithTransactions);
    console.log('🔍 [DEBUG] All accounts:', accounts.map(a => ({ id: a.id, name: a.name, bankTemplateId: a.bankTemplateId })));
    console.log('🔍 [DEBUG] All transactions count:', allTransactions.length);

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Kolumnmappning</h2>
          <p className="text-sm sm:text-base text-muted-foreground px-2">
            Mappa CSV-kolumner till appens fält per bank. Detta sparas för framtida imports från samma bank.
          </p>
        </div>

        <div className="p-3 bg-green-50 rounded-lg border border-green-200 mb-6">
          <div className="text-sm text-green-800">
            ✓ Automatisk mappning genomförd baserat på kolumnnamn och innehåll
          </div>
        </div>

        {banksWithTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Inga CSV-filer har laddats upp än. Gå tillbaka till "Ladda upp"-steget för att ladda upp filer.</p>
          </div>
        ) : (
          banksWithTransactions.map((bank) => {
            // Get accounts using this bank that have transactions OR raw CSV data
            const accountsUsingThisBank = accounts.filter(account => 
              account.bankTemplateId === bank.id && 
              (allTransactions.some(t => t.accountId === account.id) || rawCsvData[account.id]?.headers)
            );
            
            // Get sample transactions from the first account using this bank
            const sampleAccount = accountsUsingThisBank[0];
            const sampleTransactions = sampleAccount ? allTransactions.filter(t => t.accountId === sampleAccount.id).slice(0, 3) : [];
            
            // Get actual CSV headers from raw CSV data or fallback to transaction data
            const firstAccountWithData = accountsUsingThisBank[0];
            const actualCSVHeaders = firstAccountWithData && rawCsvData[firstAccountWithData.id]?.headers 
              ? rawCsvData[firstAccountWithData.id].headers 
              : ['Datum', 'Kategori', 'Underkategori', 'Text', 'Belopp', 'Saldo'];
            
            console.log('🔍 [DEBUG] Rendering bank:', bank.name, 'with accounts:', accountsUsingThisBank.map(a => a.name));
            console.log('🔍 [DEBUG] CSV headers for bank:', actualCSVHeaders);
            
            return (
              <Card key={bank.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    CSV-mappning för {bank.name}
                  </CardTitle>
                  <CardDescription>
                    Används för konton: {accountsUsingThisBank.map(acc => acc.name).join(', ')} • 
                    {sampleTransactions.length} transaktioner i exempel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium mb-3">Kolumnmappning</h4>
                      
                      {/* Mobile-first responsive layout */}
                      <div className="space-y-4 md:hidden">
                        {actualCSVHeaders.map((header, colIndex) => {
                          // Use raw CSV data if available, otherwise use transaction data
                          const exampleData = firstAccountWithData && rawCsvData[firstAccountWithData.id]?.rows 
                            ? rawCsvData[firstAccountWithData.id].rows.slice(0, 3).map(row => row[colIndex] || '')
                            : sampleTransactions.map(t => {
                                // Show actual transaction data based on what we can guess from header name
                                if (header.toLowerCase().includes('datum') || header.toLowerCase().includes('date')) return t.date;
                                if (header.toLowerCase().includes('belopp') || header.toLowerCase().includes('amount')) return t.amount.toString();
                                if (header.toLowerCase().includes('text') || header.toLowerCase().includes('beskrivning') || header.toLowerCase().includes('description')) return t.description;
                                if (header.toLowerCase().includes('kategori') || header.toLowerCase().includes('category')) return t.bankCategory || '';
                                if (header.toLowerCase().includes('saldo') || header.toLowerCase().includes('balance')) return t.balanceAfter?.toString() || '';
                                return 'Exempel data';
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
                                  value={getCurrentMapping(bank.id)[header] || 'ignore'}
                                  onValueChange={(value) => {
                                    const currentMapping = getCurrentMapping(bank.id);
                                    const updatedMapping = {
                                      ...currentMapping,
                                      [header]: value
                                    };
                                    saveCurrentMapping(bank.id, updatedMapping);
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
                          {actualCSVHeaders.map((header, colIndex) => {
                            const exampleData = sampleTransactions.slice(0, 2).map(t => {
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
                                    value={getCurrentMapping(bank.id)[header] || 'ignore'}
                                    onValueChange={(value) => {
                                      const currentMapping = getCurrentMapping(bank.id);
                                      const updatedMapping = {
                                        ...currentMapping,
                                        [header]: value
                                      };
                                      saveCurrentMapping(bank.id, updatedMapping);
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
        })
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center px-2 sm:px-0">
          <Button onClick={() => setCurrentStep('upload')} variant="outline">
            Tillbaka: Uppladdning
          </Button>
          <Button 
            onClick={() => setCurrentStep('categorization')}
            disabled={banksWithTransactions.length === 0}
          >
            Nästa: Kategorisering
          </Button>
        </div>
      </div>
    );
  };
  // Memoize filtered transactions for performance optimization
  const filteredTransactions = useMemo(() => {
    // Always show all transactions in the system
    let baseTransactions = allTransactions;
    
    // Filter by month if not 'all' or 'current'
    if (monthFilter !== 'all' && monthFilter !== 'current') {
      // Use payday-based filtering for specific months too
      const payday = budgetState?.settings?.payday || 25;
      const { startDate, endDate } = getDateRangeForMonth(monthFilter, payday);
      
      baseTransactions = baseTransactions.filter(t => {
        const transactionDate = t.date; // Already in YYYY-MM-DD format
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    } else if (monthFilter === 'current') {
      // Filter by current selected month from budget state using payday-based filtering
      const payday = budgetState?.settings?.payday || 25;
      const { startDate, endDate } = getDateRangeForMonth(budgetState.selectedMonthKey, payday);
      
      baseTransactions = baseTransactions.filter(t => {
        const transactionDate = t.date; // Already in YYYY-MM-DD format
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
      baseTransactions = baseTransactions.filter(t => t.status === statusFilter);
    }
    
    // Filter by account
    if (accountFilter !== 'all') {
      baseTransactions = baseTransactions.filter(t => t.accountId === accountFilter);
    }
    
    return hideGreenTransactions 
      ? baseTransactions.filter(t => t.status !== 'green')
      : baseTransactions;
  }, [allTransactions, monthFilter, statusFilter, accountFilter, hideGreenTransactions, budgetState?.settings?.payday, budgetState.selectedMonthKey]);

  const renderCategorizationStep = () => {

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
            <Label htmlFor="statusFilter" className="text-sm">Visa bara status:</Label>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'red' | 'yellow' | 'green') => setStatusFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="red">Röd</SelectItem>
                <SelectItem value="yellow">Gul</SelectItem>
                <SelectItem value="green">Grön</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="accountFilter" className="text-sm">Konto:</Label>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                {budgetState.accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="monthFilter" className="text-sm">Månad:</Label>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visa alla</SelectItem>
                <SelectItem value="current">Aktuell månad</SelectItem>
                {/* Generate available months from historical data */}
                {Object.keys(budgetState?.historicalData || {}).sort().reverse().map(monthKey => (
                  <SelectItem key={monthKey} value={monthKey}>
                    {new Date(monthKey + '-01').toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
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
            <Button
              onClick={applyRulesToFilteredTransactions}
              disabled={categoryRules.length === 0 || filteredTransactions.length === 0}
              size="sm"
              variant="secondary"
              className="text-xs sm:text-sm"
            >
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              Applicera regler på filtrerade transaktioner
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
            <CategoryRuleManagerAdvanced
              key={refreshKey}
              rules={categoryRules}
              onRulesChange={(newRules) => {
                // Clear existing rules and add new ones (using modern format)
                categoryRules.forEach(oldRule => {
                  deleteCategoryRule(oldRule.id);
                });
                
                newRules.forEach(rule => {
                  addCategoryRule(rule);
                });
                
                triggerRefresh();
              }}
              mainCategories={mainCategories}
              accounts={accounts}
            />
            
            {/* Uncategorized Bank Categories */}
            <Card>
              <CardHeader>
                <CardTitle>Okategoriserade Bankkategorier</CardTitle>
                <CardDescription>
                  Bankkategorier som inte har någon regel än. Klicka för att skapa en regel automatiskt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UncategorizedBankCategories 
                  transactions={allTransactions}
                  categoryRules={categoryRules}
                  onCreateRule={(bankCategory, bankSubCategory) => {
                    setSelectedBankCategory(bankCategory);
                    setSelectedBankSubCategory(bankSubCategory);
                    setCategoryDialogOpen(true);
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Kategorihantering</CardTitle>
                <CardDescription>
                  Hantera huvudkategorier och kostnadskategorier för dina transaktioner.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryManagementSection 
                  costGroups={costGroups} 
                  onCategoriesChange={() => {
                    // Trigger a refresh of categories
                    window.location.reload();
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="all" className="space-y-4">
              <Card>
               <CardHeader>
                 <CardTitle className="flex items-center justify-between">
                   <span>Alla transaktioner</span>
                   <Button
                     onClick={() => selectAllFilteredTransactions(filteredTransactions)}
                     size="sm"
                     variant="outline"
                     className="text-xs"
                   >
                     {(() => {
                       const filteredIds = filteredTransactions.map(t => t.id);
                       const currentlySelected = selectedTransactions.filter(id => filteredIds.includes(id));
                       return currentlySelected.length === filteredIds.length ? 'Avmarkera alla' : 'Markera alla';
                     })()}
                   </Button>
                 </CardTitle>
                 <CardDescription>
                   {filteredTransactions.length} transaktioner totalt
                   {filteredTransactions.length > transactionsPerPage && 
                     ` - Visar ${((currentPage - 1) * transactionsPerPage) + 1}-${Math.min(currentPage * transactionsPerPage, filteredTransactions.length)}`
                   }
                 </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(() => {
                    const startIndex = (currentPage - 1) * transactionsPerPage;
                    const endIndex = startIndex + transactionsPerPage;
                    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
                    
                    return paginatedTransactions.map(transaction => (
                      <TransactionExpandableCard
                        key={transaction.id}
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
                        onExpenseClaim={handleExpenseClaim}
                        onRefresh={triggerRefresh}
                        mainCategories={mainCategories}
                        costGroups={costGroups}
                      />
                    ));
                  })()}
                </div>
                
                {/* Pagination controls */}
                {filteredTransactions.length > transactionsPerPage && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Föregående
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Sida {currentPage} av {Math.ceil(filteredTransactions.length / transactionsPerPage)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredTransactions.length / transactionsPerPage), prev + 1))}
                      disabled={currentPage === Math.ceil(filteredTransactions.length / transactionsPerPage)}
                    >
                      Nästa
                    </Button>
                  </div>
                )}
                
                {/* Apply rules button for all transactions tab */}
                {filteredTransactions.length > 0 && (
                  <div className="flex justify-center mt-6">
                    <Button
                      onClick={applyRulesToFilteredTransactions}
                      disabled={categoryRules.length === 0 || filteredTransactions.length === 0}
                      variant="secondary"
                      className="text-sm"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Applicera regler på filtrerade transaktioner
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="account" className="space-y-4">
            {accounts.map(account => {
              const accountTransactions = filteredTransactions.filter(t => t.accountId === account.id);
              const isExpanded = expandedAccounts.has(account.id);
              
              // Group transactions by date
              const transactionsByDate = accountTransactions.reduce((acc, transaction) => {
                const date = transaction.date;
                if (!acc[date]) {
                  acc[date] = [];
                }
                acc[date].push(transaction);
                return acc;
              }, {} as Record<string, typeof accountTransactions>);

              const sortedDates = Object.keys(transactionsByDate).sort((a, b) => 
                new Date(b).getTime() - new Date(a).getTime()
              );
              
              return (
                <div key={account.id} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAccountExpansion(account.id)}
                      className="p-1"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <span className="flex-1 font-medium">{account.name}</span>
                    <div className="text-sm text-muted-foreground">
                      {accountTransactions.length} transaktioner
                    </div>
                    <Button
                      onClick={() => selectAllAccountTransactions(accountTransactions)}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      {(() => {
                        const accountIds = accountTransactions.map(t => t.id);
                        const currentlySelected = selectedTransactions.filter(id => accountIds.includes(id));
                        return currentlySelected.length === accountIds.length ? 'Avmarkera' : 'Markera alla';
                      })()}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="pl-6 space-y-3 border-l-2 border-muted">
                      {sortedDates.map(date => {
                        const dateTransactions = transactionsByDate[date];
                        const dateKey = `${account.id}-${date}`;
                        const isDateExpanded = expandedDates.has(dateKey);
                        
                        return (
                          <div key={dateKey} className="border rounded-lg p-2 space-y-2">
                             <div className="flex items-center gap-2">
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => toggleDateExpansion(dateKey)}
                                 className="p-1"
                               >
                                 {isDateExpanded ? (
                                   <ChevronUp className="h-3 w-3" />
                                 ) : (
                                   <ChevronDown className="h-3 w-3" />
                                 )}
                               </Button>
                               <span className="flex-1 text-sm font-medium">
                                 {new Date(date).toLocaleDateString('sv-SE')}
                               </span>
                               <div className="text-xs text-muted-foreground">
                                 {dateTransactions.length} transaktioner
                               </div>
                               <Button
                                 onClick={() => selectAllDateTransactions(dateTransactions)}
                                 size="sm"
                                 variant="outline"
                                 className="text-xs"
                               >
                                 {(() => {
                                   const dateIds = dateTransactions.map(t => t.id);
                                   const currentlySelected = selectedTransactions.filter(id => dateIds.includes(id));
                                   return currentlySelected.length === dateIds.length ? 'Avmarkera' : 'Markera alla';
                                 })()}
                               </Button>
                             </div>

                            {isDateExpanded && (
                              <div className="pl-4 space-y-2 border-l border-muted">
                                {dateTransactions.map(transaction => (
                                  <TransactionExpandableCard
                                    key={transaction.id}
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
                                    onExpenseClaim={handleExpenseClaim}
                                    onRefresh={triggerRefresh}
                                    mainCategories={mainCategories}
                                    costGroups={costGroups}
                                  />
                                ))}
                                
                                {(() => {
                                  const rangeTransactions = getTransactionsInDateRange(date, accountTransactions);
                                  return rangeTransactions.length > 0 && (
                                    <div className="pt-2 border-t border-muted">
                                      <Button
                                        variant="link"
                                        size="sm"
                                        onClick={() => openDateRangeDialog(date, account.id, accountTransactions)}
                                        className="text-xs text-muted-foreground p-0 h-auto"
                                      >
                                        Visa fler transaktioner ({rangeTransactions.length} inom 7 dagar)
                                      </Button>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Apply rules button for account tab */}
            {filteredTransactions.length > 0 && (
              <div className="flex justify-center mt-4">
                <Button
                  onClick={applyRulesToFilteredTransactions}
                  disabled={categoryRules.length === 0 || filteredTransactions.length === 0}
                  size="sm"
                  variant="secondary"
                  className="text-xs sm:text-sm"
                >
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Applicera regler på filtrerade transaktioner
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Date Range Dialog */}
          <Dialog open={dateRangeDialog.isOpen} onOpenChange={(open) => setDateRangeDialog(prev => ({ ...prev, isOpen: open }))}>
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  Transaktioner inom 7 dagar från {new Date(dateRangeDialog.date).toLocaleDateString('sv-SE')}
                </DialogTitle>
                <DialogDescription>
                  {dateRangeDialog.transactions.length} transaktioner
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {dateRangeDialog.transactions.map(transaction => {
                  const account = accounts.find(acc => acc.id === transaction.accountId);
                  return account ? (
                    <TransactionExpandableCard
                      key={transaction.id}
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
                      onExpenseClaim={handleExpenseClaim}
                      onRefresh={triggerRefresh}
                      mainCategories={mainCategories}
                      costGroups={costGroups}
                    />
                  ) : null;
                })}
              </div>
            </DialogContent>
          </Dialog>
        </Tabs>

        {/* Balance correction button */}
        <div className="flex justify-center mb-4">
          <Button
            onClick={() => setBalanceCorrectionDialog(true)}
            variant="secondary"
            className="text-sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Korrigera startsaldo för månader
          </Button>
        </div>

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
      {/* Header - Same as main budget page */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Familjens Budgetkalkylator
        </h1>
        <p className="text-muted-foreground text-lg">
          Beräkna era gemensamma utgifter och individuella bidrag
        </p>
      </div>

      {/* Month Selector - Same as main budget page */}
      <Card className="mb-6">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-foreground">
            Aktuell månad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigateToPreviousMonth()}
              className="p-3 h-12 w-12 text-primary hover:text-primary/80"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            
            <Select 
              value={budgetState.selectedMonthKey} 
              onValueChange={(value) => handleBudgetMonthChange(value)}
            >
              <SelectTrigger className="w-auto min-w-[200px] border-none bg-transparent text-xl font-semibold text-primary hover:bg-muted/50 transition-colors text-center justify-center">
                <SelectValue>
                  {(() => {
                    const monthNames = [
                      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                    ];
                    
                    const [year, month] = budgetState.selectedMonthKey.split('-');
                    const monthIndex = parseInt(month) - 1;
                    return `${monthNames[monthIndex]} ${year}`;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const monthNames = [
                    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
                    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
                  ];
                  
                  const availableMonths = Object.keys(budgetState.historicalData || {});
                  const currentDate = new Date();
                  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                  
                  const allMonths = new Set([currentMonthKey, ...availableMonths]);
                  
                  return Array.from(allMonths).sort().reverse().map(monthKey => {
                    const [year, month] = monthKey.split('-');
                    const monthIndex = parseInt(month) - 1;
                    const displayName = `${monthNames[monthIndex]} ${year}`;
                    
                    return (
                      <SelectItem key={monthKey} value={monthKey}>
                        {displayName}
                      </SelectItem>
                    );
                  });
                })()}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigateToNextMonth()}
              className="p-3 h-12 w-12 text-primary hover:text-primary/80"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Page-specific heading */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Ladda upp CSV-filer - {(() => {
            const monthNames = [
              'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
              'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
            ];
            const [year, month] = budgetState.selectedMonthKey.split('-');
            const monthIndex = parseInt(month) - 1;
            return `${monthNames[monthIndex]} ${year}`;
          })()}
        </h1>
      </div>

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
        onRefresh={triggerRefresh}
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
        onRefresh={() => setRefreshKey(prev => prev + 1)}
      />

      <CostCoverageDialog
        isOpen={costCoverageDialog.isOpen}
        onClose={() => setCostCoverageDialog({ isOpen: false })}
        transfer={costCoverageDialog.transfer}
        potentialCosts={costCoverageDialog.potentialCosts || []}
        onRefresh={triggerRefresh}
      />

      <ExpenseClaimDialog
        isOpen={expenseClaimDialog.isOpen}
        onClose={() => setExpenseClaimDialog({ isOpen: false })}
        transaction={expenseClaimDialog.expense || null}
        onRefresh={triggerRefresh}
      />

      <BalanceCorrectionDialog
        open={balanceCorrectionDialog}
        onClose={() => setBalanceCorrectionDialog(false)}
        transactions={getAllTransactionsFromDatabase()}
        accountBalances={accountBalancesForDialog}
      />

      {/* All Transactions Dialog */}
      <Dialog open={allTransactionsDialog.isOpen} onOpenChange={(open) => setAllTransactionsDialog({ isOpen: open })}>
        <DialogContent className="max-w-[95vw] w-full h-[80vh] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Alla transaktioner - {allTransactionsDialog.accountName}
            </DialogTitle>
            <DialogDescription>
              {allTransactions.filter(t => t.accountId === allTransactionsDialog.accountId).length} transaktioner
              {!rawCsvData[allTransactionsDialog.accountId || '']?.headers && (
                <div className="text-sm text-muted-foreground mt-1">
                  För att se rå CSV-data, ladda upp filen igen efter att ha öppnat denna vy.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <div 
              className="h-full overflow-auto border rounded-lg"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              style={{ touchAction: 'auto' }}
            >
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {rawCsvData[allTransactionsDialog.accountId || '']?.headers?.length > 0 ? (
                      // Show raw CSV headers if available
                      rawCsvData[allTransactionsDialog.accountId || '']?.headers?.map((header, index) => (
                        <TableHead key={index} className="min-w-[120px] whitespace-nowrap">
                          {header}
                        </TableHead>
                      ))
                    ) : (
                      // Fallback to processed transaction headers
                      <>
                        <TableHead className="min-w-[100px]">Datum</TableHead>
                        <TableHead className="min-w-[120px]">Bankkategori</TableHead>
                        <TableHead className="min-w-[120px]">Underkategori</TableHead>
                        <TableHead className="min-w-[200px]">Beskrivning</TableHead>
                        <TableHead className="min-w-[150px]">Användarbeskrivning</TableHead>
                        <TableHead className="min-w-[100px] text-right">Belopp</TableHead>
                        <TableHead className="min-w-[100px] text-right">Saldo</TableHead>
                        <TableHead className="min-w-[80px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Typ</TableHead>
                        <TableHead className="min-w-[120px]">App-kategori</TableHead>
                        <TableHead className="min-w-[120px]">Åtgärder</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawCsvData[allTransactionsDialog.accountId || '']?.rows?.length > 0 ? (
                    // Show raw CSV data if available
                    rawCsvData[allTransactionsDialog.accountId || '']?.rows?.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell 
                            key={cellIndex} 
                            className="text-sm whitespace-nowrap"
                            title={cell}
                          >
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    // Fallback to processed transaction data
                    allTransactions
                      .filter(t => t.accountId === allTransactionsDialog.accountId)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-mono text-sm">
                            {new Date(transaction.date).toLocaleDateString('sv-SE')}
                          </TableCell>
                          <TableCell className="text-sm">{transaction.bankCategory || '-'}</TableCell>
                          <TableCell className="text-sm">{transaction.bankSubCategory || '-'}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate" title={transaction.description}>
                            {transaction.description}
                          </TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate" title={transaction.userDescription || ''}>
                            {transaction.userDescription || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            <span className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {transaction.amount.toLocaleString('sv-SE', { minimumFractionDigits: 2 })} kr
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {(transaction.balanceAfter || 0).toLocaleString('sv-SE', { minimumFractionDigits: 2 })} kr
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                transaction.status === 'green' ? 'default' :
                                transaction.status === 'yellow' ? 'secondary' : 
                                'destructive'
                              }
                              className="text-xs"
                            >
                              {transaction.status === 'green' ? 'Klar' :
                               transaction.status === 'yellow' ? 'Granskas' : 'Fel'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {transaction.type === 'Transaction' ? 'Transaktion' :
                             transaction.type === 'InternalTransfer' ? 'Intern transfer' :
                             transaction.type === 'Savings' ? 'Sparande' :
                             transaction.type === 'CostCoverage' ? 'Kostnadstäckning' :
                             transaction.type}
                          </TableCell>
                          <TableCell className="text-sm">
                            {transaction.appCategoryId ? (
                              <div>
                                <div>{costGroups.find(g => g.id === transaction.appCategoryId)?.name || transaction.appCategoryId}</div>
                                {transaction.appSubCategoryId && (
                                  <div className="text-xs text-muted-foreground">
                                    {transaction.appSubCategoryId}
                                  </div>
                                )}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {transaction.type === 'InternalTransfer' && !transaction.linkedTransactionId ? (
                              <Button
                                onClick={() => handleTransferMatch(transaction)}
                                size="sm"
                                variant="outline"
                                className="text-xs h-6 px-2"
                              >
                                Matcha överföring
                              </Button>
                            ) : transaction.linkedTransactionId ? (
                              <span className="text-xs text-muted-foreground">Matchad</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Selection Dialog */}
      <CategorySelectionDialog
        isOpen={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        onConfirm={(mainCategory, subCategory, positiveTransactionType, negativeTransactionType, applicableAccountIds) => {
          const newRule = {
            id: uuidv4(),
            priority: 100,
            condition: { 
              type: 'categoryMatch' as const,
              bankCategory: selectedBankCategory,
              bankSubCategory: selectedBankSubCategory
            },
            action: {
              appMainCategoryId: mainCategory,
              appSubCategoryId: subCategory,
              positiveTransactionType: positiveTransactionType as any,
              negativeTransactionType: negativeTransactionType as any,
              applicableAccountIds: applicableAccountIds
            },
            isActive: true
          };
          addMobileDebugLog('🔍 [DEBUG] Creating rule for Semester: ' + JSON.stringify(newRule, null, 2));
          addCategoryRule(newRule);
          triggerRefresh();
        }}
        bankCategory={selectedBankCategory}
        bankSubCategory={selectedBankSubCategory}
        mainCategories={mainCategories}
        accounts={budgetState.accounts}
      />
    </div>
  );
};