import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
import { Upload, CheckCircle, FileText, Settings, AlertCircle, Plus } from 'lucide-react';
import { AddBankDialog } from './AddBankDialog';
import { Bank, BankCSVMapping, ColumnMapping } from '@/types/bank';
import { get, set, StorageKey } from '@/services/storageService';

interface UploadedFile {
  file: File;
  accountId: string;
  bankId?: string;
  balance?: number;
  status: 'uploaded' | 'mapped' | 'processed';
}

interface CSVColumn {
  name: string;
  mappedTo?: string;
  sampleData: string[];
}

interface FileMapping {
  fileId: string;
  bankId?: string;
  columns: CSVColumn[];
  structure: string; // unique identifier for this file structure
}

export const TransactionImport: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'categorization'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [fileMappings, setFileMappings] = useState<FileMapping[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCSVMappings, setBankCSVMappings] = useState<BankCSVMapping[]>([]);
  const [selectedBanks, setSelectedBanks] = useState<{[accountId: string]: string}>({});
  const fileInputRefs = useRef<{[key: string]: HTMLInputElement | null}>({});

  // Mock accounts - this should come from props or context
  const accounts = [
    { id: 'hushalskonto', name: 'Hushållskonto', balance: 0 },
    { id: 'sparkonto', name: 'Sparkonto', balance: 0 },
    { id: 'barnkonto', name: 'Barnkonto', balance: 0 }
  ];

  // Load banks and mappings from storage
  useEffect(() => {
    const storedBanks = get<Bank[]>(StorageKey.BANKS) || [];
    const storedMappings = get<BankCSVMapping[]>(StorageKey.BANK_CSV_MAPPINGS) || [];
    setBanks(storedBanks);
    setBankCSVMappings(storedMappings);
  }, []);

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
    setSelectedBanks(prev => ({ ...prev, [accountId]: bankId }));
    
    // Load existing mapping for this bank if available
    const existingMapping = bankCSVMappings.find(mapping => mapping.bankId === bankId && mapping.isActive);
    if (existingMapping) {
      // Apply the existing mapping to current file mappings
      setFileMappings(prev => prev.map(mapping => {
        if (mapping.fileId.startsWith(accountId)) {
          return {
            ...mapping,
            bankId,
            columns: mapping.columns.map(col => {
              const existingCol = existingMapping.columns.find(c => c.csvColumn === col.name);
              return existingCol ? { ...col, mappedTo: existingCol.appField } : col;
            })
          };
        }
        return mapping;
      }));
    }
  };

  const handleFileUpload = (accountId: string, file: File) => {
    // Parse CSV and extract sample data
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const lines = csvContent.split('\n').slice(0, 6); // Get first 6 lines
      const headers = lines[0]?.split(';') || [];
      
      // Extract balance from last transaction if possible
      let extractedBalance: number | undefined;
      if (lines.length > 1) {
        const lastLine = lines[lines.length - 1];
        const fields = lastLine.split(';');
        // Try to find balance in common positions (usually last or second to last column)
        const balanceField = fields[fields.length - 1] || fields[fields.length - 2];
        const balanceMatch = balanceField?.match(/-?\d+[,.]?\d*/);
        if (balanceMatch) {
          extractedBalance = parseFloat(balanceMatch[0].replace(',', '.'));
        }
      }

      const bankId = selectedBanks[accountId];
      const uploadedFile: UploadedFile = {
        file,
        accountId,
        bankId,
        balance: extractedBalance,
        status: 'uploaded'
      };

      setUploadedFiles(prev => {
        const filtered = prev.filter(f => f.accountId !== accountId);
        return [...filtered, uploadedFile];
      });

      // Create file mapping for column mapping step
      const columns: CSVColumn[] = headers.map(header => ({
        name: header.trim(),
        sampleData: lines.slice(1).map(line => {
          const fields = line.split(';');
          const index = headers.indexOf(header);
          return fields[index] || '';
        }).filter(Boolean)
      }));

      const fileMapping: FileMapping = {
        fileId: `${accountId}-${uuidv4()}`,
        bankId,
        columns,
        structure: headers.join('|') // Simple structure identifier
      };

      setFileMappings(prev => {
        const filtered = prev.filter(f => !f.fileId.startsWith(accountId));
        return [...filtered, fileMapping];
      });

      // If a bank is selected and has existing mappings, apply them
      if (bankId) {
        const existingMapping = bankCSVMappings.find(mapping => mapping.bankId === bankId && mapping.isActive);
        if (existingMapping) {
          setTimeout(() => {
            setFileMappings(prev => prev.map(mapping => {
              if (mapping.fileId.startsWith(accountId) && mapping.bankId === bankId) {
                return {
                  ...mapping,
                  columns: mapping.columns.map(col => {
                    const existingCol = existingMapping.columns.find(c => c.csvColumn === col.name);
                    return existingCol ? { ...col, mappedTo: existingCol.appField } : col;
                  })
                };
              }
              return mapping;
            }));
          }, 100);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleColumnMapping = (fileId: string, columnIndex: number, appField: string) => {
    setFileMappings(prev => prev.map(mapping => {
      if (mapping.fileId === fileId) {
        const updatedColumns = [...mapping.columns];
        updatedColumns[columnIndex] = { ...updatedColumns[columnIndex], mappedTo: appField };
        return { ...mapping, columns: updatedColumns };
      }
      return mapping;
    }));
  };

  const saveBankCSVMappings = () => {
    fileMappings.forEach(mapping => {
      if (mapping.bankId) {
        const bankName = banks.find(b => b.id === mapping.bankId)?.name || 'Unknown Bank';
        const columns: ColumnMapping[] = mapping.columns
          .filter(col => col.mappedTo && col.mappedTo !== 'ignore')
          .map(col => ({
            csvColumn: col.name,
            appField: col.mappedTo as any
          }));

        const existingMappingIndex = bankCSVMappings.findIndex(bm => bm.bankId === mapping.bankId);
        let updatedMappings: BankCSVMapping[];

        if (existingMappingIndex >= 0) {
          // Update existing mapping
          updatedMappings = [...bankCSVMappings];
          updatedMappings[existingMappingIndex] = {
            ...updatedMappings[existingMappingIndex],
            columns,
            fingerprint: mapping.structure
          };
        } else {
          // Create new mapping
          const newMapping: BankCSVMapping = {
            id: uuidv4(),
            bankId: mapping.bankId,
            name: `${bankName} Format`,
            columns,
            fingerprint: mapping.structure,
            isActive: true,
            createdAt: new Date().toISOString()
          };
          updatedMappings = [...bankCSVMappings, newMapping];
        }

        setBankCSVMappings(updatedMappings);
        set(StorageKey.BANK_CSV_MAPPINGS, updatedMappings);
      }
    });
  };

  const triggerFileUpload = (accountId: string) => {
    fileInputRefs.current[accountId]?.click();
  };

  const getAccountUploadStatus = (accountId: string) => {
    const uploadedFile = uploadedFiles.find(f => f.accountId === accountId);
    return uploadedFile ? 'uploaded' : 'pending';
  };

  const getAccountBalance = (accountId: string) => {
    const uploadedFile = uploadedFiles.find(f => f.accountId === accountId);
    return uploadedFile?.balance;
  };

  const canProceedToMapping = () => {
    return uploadedFiles.length > 0;
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
          const uploadStatus = getAccountUploadStatus(account.id);
          const extractedBalance = getAccountBalance(account.id);
          
          return (
            <Card key={account.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{account.name}</CardTitle>
                  <Badge 
                    variant={uploadStatus === 'uploaded' ? 'default' : 'outline'}
                    className={uploadStatus === 'uploaded' ? 'bg-green-500' : ''}
                  >
                    {uploadStatus === 'uploaded' ? (
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
                  {/* Bank selection */}
                  <div className="space-y-2">
                    <Label htmlFor={`bank-${account.id}`} className="text-sm font-medium">Bank</Label>
                    <div className="flex items-center space-x-2">
                      <Select 
                        value={selectedBanks[account.id] || ''} 
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

                  {uploadStatus === 'pending' ? (
                    <Button 
                      onClick={() => triggerFileUpload(account.id)}
                      className="w-full"
                      variant="outline"
                      disabled={!selectedBanks[account.id]}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Läs In
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => triggerFileUpload(account.id)}
                      className="w-full"
                      variant="outline"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Byt fil
                    </Button>
                  )}
                  
                  {extractedBalance !== undefined && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Saldo enligt filen:</span> {extractedBalance.toLocaleString('sv-SE')} kr
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
        <Button 
          onClick={() => setCurrentStep('mapping')}
          disabled={!canProceedToMapping()}
          className="w-full sm:min-w-48"
        >
          Fortsätt till mappning
        </Button>
        <Button 
          variant="outline"
          onClick={() => setCurrentStep('categorization')}
          disabled={fileMappings.length === 0}
          className="w-full sm:min-w-48"
        >
          Kategorisering & Regler
        </Button>
      </div>
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Kolumnmappning</h2>
        <p className="text-sm sm:text-base text-muted-foreground px-2">
          Mappa CSV-kolumner till appens fält. Detta sparas för framtida imports.
        </p>
      </div>

      {fileMappings.map((mapping, index) => (
        <Card key={mapping.fileId}>
          <CardHeader>
            <CardTitle className="text-lg">
              Fil {index + 1} - {mapping.columns.length} kolumner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                <TableRow>
                  <TableHead>CSV Kolumn</TableHead>
                  <TableHead>Exempeldata</TableHead>
                  <TableHead>Mappa till</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mapping.columns.map((column, colIndex) => (
                  <TableRow key={colIndex}>
                    <TableCell className="font-medium">{column.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {column.sampleData.slice(0, 2).join(', ')}
                      {column.sampleData.length > 2 && '...'}
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={column.mappedTo || ''} 
                        onValueChange={(value) => handleColumnMapping(mapping.fileId, colIndex, value)}
                      >
                        <SelectTrigger className="w-32 sm:w-48">
                          <SelectValue placeholder="Välj fält" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="datum">Datum</SelectItem>
                          <SelectItem value="kategori">Kategori</SelectItem>
                          <SelectItem value="underkategori">Underkategori</SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="belopp">Belopp</SelectItem>
                          <SelectItem value="saldo">Saldo</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                          <SelectItem value="avstamt">Avstämt</SelectItem>
                          <SelectItem value="ignore">Ignorera</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
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
            saveBankCSVMappings();
            setCurrentStep('categorization');
          }}
          className="w-full sm:min-w-48"
        >
          Fortsätt till kategorisering
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

      <Tabs defaultValue="regler" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="regler">Regler</TabsTrigger>
          <TabsTrigger value="transaktioner">Transaktioner</TabsTrigger>
        </TabsList>

        <TabsContent value="regler" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Okategoriserade</CardTitle>
              <CardDescription>
                Kategorier från bankfiler som behöver mappas till appens kategorier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Inga okategoriserade transaktioner ännu. Ladda upp filer för att se kategorier som behöver mappning.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transaktioner" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-base sm:text-lg font-semibold">Importerade transaktioner</h3>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                Alla Transaktioner
              </Button>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                Per konto
              </Button>
            </div>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                Inga transaktioner ännu. Slutför mappningssteget för att se transaktioner här.
              </div>
            </CardContent>
          </Card>
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