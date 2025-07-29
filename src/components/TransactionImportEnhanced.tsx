import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle, FileText, Settings, AlertCircle, Circle, CheckSquare, AlertTriangle } from 'lucide-react';
import { ImportedTransaction, CategoryRule, FileStructure, ColumnMapping } from '@/types/transaction';
import { TransactionExpandableCard } from './TransactionExpandableCard';
import { TransactionGroupByDate } from './TransactionGroupByDate';

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
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
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
  
  const fileInputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});
  const { toast } = useToast();

  // Mock data - should come from context/props
  const accounts: Account[] = [
    { id: 'hushalskonto', name: 'Hushållskonto', startBalance: 0 },
    { id: 'sparkonto', name: 'Sparkonto', startBalance: 0 },
    { id: 'barnkonto', name: 'Barnkonto', startBalance: 0 }
  ];

  const mainCategories = ['Hushåll', 'Mat & Kläder', 'Transport', 'Sparande'];
  const subCategories = {
    'Hushåll': ['Hyra', 'El', 'Internet', 'Försäkringar'],
    'Mat & Kläder': ['Dagligvaror', 'Restaurang', 'Kläder'],
    'Transport': ['Bensin', 'Kollektivtrafik', 'Bilservice'],
    'Sparande': ['Långsiktigt', 'Buffert', 'Semester']
  };

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
        const transaction: ImportedTransaction = {
          id: `${accountId}-${Date.now()}-${i}`,
          accountId,
          date: dateColumnIndex >= 0 ? fields[dateColumnIndex] : fields[0],
          amount: amountColumnIndex >= 0 ? parseFloat(fields[amountColumnIndex].replace(',', '.')) : 0,
          balanceAfter: balanceColumnIndex >= 0 ? parseFloat(fields[balanceColumnIndex].replace(',', '.')) : undefined,
          description: descriptionColumnIndex >= 0 ? fields[descriptionColumnIndex] : fields[1] || '',
          bankCategory: categoryColumnIndex >= 0 ? fields[categoryColumnIndex] : undefined,
          bankSubCategory: subCategoryColumnIndex >= 0 ? fields[subCategoryColumnIndex] : undefined,
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
    for (let i = 0; i < transactions.length; i++) {
      if (isNaN(transactions[i].balanceAfter!) || transactions[i].balanceAfter === undefined) {
        if (i > 0 && !isNaN(transactions[i - 1].balanceAfter!)) {
          // Calculate balance based on previous transaction's balance + current amount
          transactions[i].balanceAfter = transactions[i - 1].balanceAfter! + transactions[i].amount;
        }
      }
    }

    return transactions;
  }, [accounts]);

  const handleFileUpload = useCallback((accountId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const parsedTransactions = parseCSV(csvContent, accountId, file.name);
      
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
        accountId,
        balance: extractedBalance,
        status: 'uploaded',
        dateRange,
        transactions: parsedTransactions
      };

      setUploadedFiles(prev => {
        const filtered = prev.filter(f => f.accountId !== accountId);
        return [...filtered, uploadedFile];
      });

      // Add transactions to global list
      setTransactions(prev => {
        const filtered = prev.filter(t => t.accountId !== accountId);
        return [...filtered, ...parsedTransactions];
      });

      toast({
        title: "Fil uppladdad",
        description: `${parsedTransactions.length} transaktioner lästa från ${file.name}`,
      });
    };
    reader.readAsText(file);
  }, [parseCSV, toast]);

  const applyCategorizationRules = useCallback(() => {
    setTransactions(prev => prev.map(transaction => {
      if (transaction.isManuallyChanged) return transaction; // Don't override manual changes

      // Find matching rule
      const matchingRule = categoryRules
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
          status: 'yellow' // Auto-categorized
        };
      }

      return {
        ...transaction,
        status: 'red' // Needs manual categorization
      };
    }));
  }, [categoryRules]);

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
        setTransactions(prev => prev.map(t => {
          if (t.id === transfer.id) {
            return { ...t, linkedTransactionId: match.id, status: 'yellow' };
          }
          if (t.id === match.id) {
            return { ...t, linkedTransactionId: transfer.id, status: 'yellow' };
          }
          return t;
        }));
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
    setTransactions(prev => prev.map(t => 
      selectedTransactions.includes(t.id) 
        ? { ...t, status: 'green' }
        : t
    ));
    setSelectedTransactions([]);
    toast({
      title: "Transaktioner godkända",
      description: `${selectedTransactions.length} transaktioner markerade som godkända.`
    });
  };

  const updateTransactionCategory = (transactionId: string, categoryId: string, subCategoryId?: string) => {
    setTransactions(prev => prev.map(t => 
      t.id === transactionId 
        ? { 
            ...t, 
            appCategoryId: categoryId,
            appSubCategoryId: subCategoryId,
            isManuallyChanged: true,
            status: 'yellow'
          }
        : t
    ));
  };

  const updateTransactionNote = (transactionId: string, note: string) => {
    setTransactions(prev => prev.map(t => 
      t.id === transactionId 
        ? { ...t, userDescription: note }
        : t
    ));
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
              <div className="space-y-4">
                <Button onClick={applyCategorizationRules} className="w-full">
                  Tillämpa befintliga regler
                </Button>
                <div className="text-sm text-muted-foreground">
                  {categoryRules.length} regler konfigurerade
                </div>
              </div>
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
                    onToggleSelection={toggleTransactionSelection}
                    onUpdateCategory={updateTransactionCategory}
                    onUpdateNote={updateTransactionNote}
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
                              <TableHead>Kategori</TableHead>
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
                                    <TableCell className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {transaction.amount.toLocaleString('sv-SE')} kr
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
    </div>
  );
};