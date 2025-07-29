import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import Papa from 'papaparse';
import { Transaction } from '@/types/budget';

interface TransactionImportProps {
  accounts: string[];
  onTransactionsImported: (transactions: Transaction[]) => void;
}

interface CsvData {
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  account?: string;
}

const TransactionImport: React.FC<TransactionImportProps> = ({
  accounts,
  onTransactionsImported
}) => {
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
    account: ''
  });
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    setError('');

    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('Fel vid inläsning av CSV-fil: ' + results.errors[0].message);
          setUploadStatus('error');
          return;
        }

        const data = results.data as string[][];
        if (data.length < 2) {
          setError('CSV-filen måste innehålla minst en rubrikrad och en datarad');
          setUploadStatus('error');
          return;
        }

        const headers = data[0];
        const rows = data.slice(1).filter(row => row.some(cell => cell.trim() !== ''));

        setCsvData({ headers, rows });
        setUploadStatus('success');
        
        // Auto-detect common column mappings
        const dateColumn = headers.find(h => 
          h.toLowerCase().includes('datum') || 
          h.toLowerCase().includes('date')
        ) || '';
        
        const descriptionColumn = headers.find(h => 
          h.toLowerCase().includes('beskrivning') || 
          h.toLowerCase().includes('description') ||
          h.toLowerCase().includes('text')
        ) || '';
        
        const amountColumn = headers.find(h => 
          h.toLowerCase().includes('belopp') || 
          h.toLowerCase().includes('amount') ||
          h.toLowerCase().includes('summa')
        ) || '';

        setColumnMapping({
          date: dateColumn,
          description: descriptionColumn,
          amount: amountColumn,
          account: ''
        });
      },
      error: (error) => {
        setError('Fel vid inläsning av fil: ' + error.message);
        setUploadStatus('error');
      }
    });
  }, []);

  const handleImportTransactions = useCallback(() => {
    if (!csvData || !columnMapping.date || !columnMapping.description || !columnMapping.amount) {
      setError('Vänligen mappa alla obligatoriska kolumner');
      return;
    }

    if (!selectedAccount) {
      setError('Vänligen välj ett konto');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const transactions: Transaction[] = csvData.rows.map((row, index) => {
        const dateIndex = csvData.headers.indexOf(columnMapping.date);
        const descriptionIndex = csvData.headers.indexOf(columnMapping.description);
        const amountIndex = csvData.headers.indexOf(columnMapping.amount);
        const accountIndex = columnMapping.account ? csvData.headers.indexOf(columnMapping.account) : -1;

        const dateStr = row[dateIndex];
        const description = row[descriptionIndex] || 'Okänd transaktion';
        const amountStr = row[amountIndex];
        const account = accountIndex >= 0 ? row[accountIndex] : selectedAccount;

        // Parse date
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          throw new Error(`Ogiltigt datum på rad ${index + 2}: ${dateStr}`);
        }

        // Parse amount
        const amount = parseFloat(amountStr.replace(/[^\d,-]/g, '').replace(',', '.'));
        if (isNaN(amount)) {
          throw new Error(`Ogiltigt belopp på rad ${index + 2}: ${amountStr}`);
        }

        return {
          id: `import_${Date.now()}_${index}`,
          accountId: account || selectedAccount,
          date: date.toISOString().split('T')[0],
          bankCategory: '',
          bankSubCategory: '',
          description,
          userDescription: '',
          amount,
          balanceAfter: 0, // Will be calculated later
          status: 'yellow' as const,
          type: 'Transaction' as const
        };
      });

      onTransactionsImported(transactions);
      
      // Reset form
      setCsvData(null);
      setColumnMapping({ date: '', description: '', amount: '', account: '' });
      setSelectedAccount('');
      setUploadStatus('idle');
      
      setIsProcessing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Okänt fel vid import');
      setIsProcessing(false);
    }
  }, [csvData, columnMapping, selectedAccount, onTransactionsImported]);

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Ladda upp CSV-fil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file">Välj CSV-fil från din bank</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="mt-1"
              />
            </div>
            
            {uploadStatus === 'uploading' && (
              <div className="space-y-2">
                <Progress value={undefined} className="w-full" />
                <p className="text-sm text-muted-foreground">Läser fil...</p>
              </div>
            )}
            
            {uploadStatus === 'success' && csvData && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Fil inläst! Hittade {csvData.rows.length} transaktioner med {csvData.headers.length} kolumner.
                </AlertDescription>
              </Alert>
            )}
            
            {uploadStatus === 'error' && error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Column Mapping */}
      {csvData && (
        <Card>
          <CardHeader>
            <CardTitle>Mappa kolumner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="date-column">Datum *</Label>
                <Select
                  value={columnMapping.date}
                  onValueChange={(value) => setColumnMapping(prev => ({ ...prev, date: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj datumkolumn" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvData.headers.map((header, index) => (
                      <SelectItem key={index} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description-column">Beskrivning *</Label>
                <Select
                  value={columnMapping.description}
                  onValueChange={(value) => setColumnMapping(prev => ({ ...prev, description: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj beskrivningskolumn" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvData.headers.map((header, index) => (
                      <SelectItem key={index} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="amount-column">Belopp *</Label>
                <Select
                  value={columnMapping.amount}
                  onValueChange={(value) => setColumnMapping(prev => ({ ...prev, amount: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj beloppkolumn" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvData.headers.map((header, index) => (
                      <SelectItem key={index} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="account-column">Konto (valfritt)</Label>
                <Select
                  value={columnMapping.account || ''}
                  onValueChange={(value) => setColumnMapping(prev => ({ ...prev, account: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Välj kontocolumn (valfritt)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Inget val</SelectItem>
                    {csvData.headers.map((header, index) => (
                      <SelectItem key={index} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!columnMapping.account && (
              <div className="mt-4">
                <Label htmlFor="default-account">Standardkonto *</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj konto för alla transaktioner" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account} value={account}>
                        {account}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {csvData && columnMapping.date && columnMapping.description && columnMapping.amount && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Förhandsvisning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Visar de första 5 raderna:
              </p>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Datum</th>
                      <th className="p-2 text-left">Beskrivning</th>
                      <th className="p-2 text-left">Belopp</th>
                      <th className="p-2 text-left">Konto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 5).map((row, index) => {
                      const dateIndex = csvData.headers.indexOf(columnMapping.date);
                      const descriptionIndex = csvData.headers.indexOf(columnMapping.description);
                      const amountIndex = csvData.headers.indexOf(columnMapping.amount);
                      const accountIndex = columnMapping.account ? csvData.headers.indexOf(columnMapping.account) : -1;

                      return (
                        <tr key={index} className="border-t">
                          <td className="p-2">{row[dateIndex]}</td>
                          <td className="p-2">{row[descriptionIndex]}</td>
                          <td className="p-2">{row[amountIndex]}</td>
                          <td className="p-2">
                            {accountIndex >= 0 ? row[accountIndex] : selectedAccount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={handleImportTransactions}
                  disabled={isProcessing || !selectedAccount}
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importerar...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Importera {csvData.rows.length} transaktioner
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TransactionImport;