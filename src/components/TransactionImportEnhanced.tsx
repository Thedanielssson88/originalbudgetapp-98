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
import { updateTransaction, addCategoryRule, updateCategoryRule, deleteCategoryRule, updateCostGroups, updateTransactionsForMonth, setTransactionsForCurrentMonth, importAndReconcileFile } from '../orchestrator/budgetOrchestrator';
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
  // NO MORE LOCAL STATE FOR FILES - reading everything from central state
  const [fileStructures, setFileStructures] = useState<FileStructure[]>([]);
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
  
  // Get budget data from central state (SINGLE SOURCE OF TRUTH)
  const { budgetState } = useBudget();
  const costGroups = budgetState?.historicalData?.[budgetState.selectedMonthKey]?.costGroups || [];
  const categoryRulesFromState = budgetState?.transactionImport?.categoryRules || [];
  
  // Read transactions directly from central state - this is now the ONLY source of truth
  const transactions = useMemo(() => 
    Object.values(budgetState?.historicalData || {}).flatMap(month => 
      (month.transactions || []).map(t => ({
        ...t,
        importedAt: (t as any).importedAt || new Date().toISOString(),
        fileSource: (t as any).fileSource || 'budgetState'
      } as ImportedTransaction))
    ), [budgetState.historicalData]
  );

  // Use actual accounts from budget state
  const accounts: Account[] = budgetState?.accounts || [];
  
  // Get main categories from actual budget data
  const mainCategories = budgetState?.mainCategories || [];
  
  // Get subcategories from storage
  const [subcategoriesFromStorage, setSubcategoriesFromStorage] = useState<Record<string, string[]>>({});
  
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
      importAndReconcileFile(csvContent, accountId);
        
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

  const updateTransactionNote = (transactionId: string, userDescription: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction) {
      const monthKey = transaction.date.substring(0, 7);
      updateTransaction(transactionId, { 
        userDescription,
        isManuallyChanged: true 
      }, monthKey);
    }
  };

  const updateTransactionCategory = (transactionId: string, categoryName: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (transaction) {
      const monthKey = transaction.date.substring(0, 7);
      const costGroup = costGroups.find(g => g.name === categoryName);
      const categoryId = costGroup ? costGroup.id : categoryName;
      
      updateTransaction(transactionId, { 
        appCategoryId: categoryId,
        isManuallyChanged: true 
      }, monthKey);
    }
  };

  const handleTransferMatch = (transaction: ImportedTransaction) => {
    const potentialMatches = transactions.filter(t => 
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
    const potentialCosts = transactions.filter(t => 
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
    const transfers = transactions.filter(t => t.type === 'InternalTransfer' && !t.linkedTransactionId);
    
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
  }, [transactions]);

  const getTransactionStatus = (transaction: ImportedTransaction) => {
    if (transaction.status === 'green') return { color: 'text-green-600', icon: CheckCircle };
    if (transaction.status === 'yellow') return { color: 'text-yellow-600', icon: AlertTriangle };
    return { color: 'text-red-600', icon: AlertCircle };
  };

  // Main upload step - shows accounts and upload status
  const renderUploadStep = () => {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Ladda upp CSV-filer</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Välj kontona du vill importera transaktioner för och ladda upp motsvarande CSV-filer från din bank.
          </p>
        </div>

        <div className="grid gap-4">
          {accounts.map((account) => {
            const accountTransactions = transactions.filter(t => t.accountId === account.id);
            const hasTransactions = accountTransactions.length > 0;
            
            return (
              <Card key={account.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{account.name}</CardTitle>
                      <CardDescription>Startbalans: {account.startBalance.toLocaleString('sv-SE')} kr</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasTransactions && (
                        <Badge variant="secondary">
                          {accountTransactions.length} transaktioner
                        </Badge>
                      )}
                      <Button
                        onClick={() => triggerFileUpload(account.id)}
                        size="sm"
                        variant={hasTransactions ? "outline" : "default"}
                      >
                        <Upload className="w-4 h-4 mr-2" />
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

        <div className="flex justify-center gap-3">
          <Button 
            onClick={() => setCurrentStep('categorization')}
            disabled={transactions.length === 0}
            variant="default"
          >
            Gå till kategorisering
          </Button>
        </div>
      </div>
    );
  };

  // Simple categorization step
  const renderCategorizationStep = () => {
    const filteredTransactions = hideGreenTransactions 
      ? transactions.filter(t => t.status !== 'green')
      : transactions;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Kategorisering</h2>
          <p className="text-muted-foreground">
            Granska och kategorisera dina importerade transaktioner.
          </p>
        </div>

        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hideGreen"
              checked={hideGreenTransactions}
              onCheckedChange={(checked) => setHideGreenTransactions(checked === true)}
            />
            <Label htmlFor="hideGreen">Dölj godkända transaktioner</Label>
          </div>
          <div className="text-sm text-muted-foreground">
            Visar {filteredTransactions.length} av {transactions.length} transaktioner
          </div>
        </div>

        <Tabs value={activeTransactionTab} onValueChange={(value) => setActiveTransactionTab(value as 'all' | 'account')}>
          <TabsList>
            <TabsTrigger value="all">Alla transaktioner</TabsTrigger>
            <TabsTrigger value="account">Per konto</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alla transaktioner</CardTitle>
                <CardDescription>
                  {filteredTransactions.length} transaktioner totalt
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Beskrivning</TableHead>
                        <TableHead>Belopp</TableHead>
                        <TableHead>Konto</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Kategori</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map(transaction => {
                        const statusInfo = getTransactionStatus(transaction);
                        const StatusIcon = statusInfo.icon;
                        
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                            </TableCell>
                            <TableCell>{transaction.date}</TableCell>
                            <TableCell className="max-w-48 truncate">{transaction.description}</TableCell>
                            <TableCell className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {transaction.amount.toLocaleString('sv-SE')} kr
                            </TableCell>
                            <TableCell>
                              {accounts.find(acc => acc.id === transaction.accountId)?.name}
                            </TableCell>
                            <TableCell>
                              <TransactionTypeSelector transaction={transaction} />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={transaction.appCategoryId || ''}
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
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
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
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead>Beskrivning</TableHead>
                            <TableHead>Belopp</TableHead>
                            <TableHead>Typ</TableHead>
                            <TableHead>Kategori</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {accountTransactions.map(transaction => {
                            const statusInfo = getTransactionStatus(transaction);
                            const StatusIcon = statusInfo.icon;
                            
                            return (
                              <TableRow key={transaction.id}>
                                <TableCell>
                                  <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                                </TableCell>
                                <TableCell>{transaction.date}</TableCell>
                                <TableCell className="max-w-48 truncate">{transaction.description}</TableCell>
                                <TableCell className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {transaction.amount.toLocaleString('sv-SE')} kr
                                </TableCell>
                                <TableCell>
                                  <TransactionTypeSelector transaction={transaction} />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={transaction.appCategoryId || ''}
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
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>

        <div className="flex justify-center">
          <Button onClick={() => setCurrentStep('upload')} variant="outline">
            Tillbaka till uppladdning
          </Button>
        </div>
      </div>
    );
  };

  // Progress indicator
  const steps = [
    { id: 'upload', label: 'Ladda upp' },
    { id: 'categorization', label: 'Kategorisering' }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Progress indicator */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${index <= currentStepIndex 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}>
                {index + 1}
              </div>
              <span className={`ml-2 text-sm ${index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className={`ml-4 w-8 h-px ${index < currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      {currentStep === 'upload' && renderUploadStep()}
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
        onUpdateTransaction={(id, updates, monthKey) => updateTransaction(id, updates, monthKey)}
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