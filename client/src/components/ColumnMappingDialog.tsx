import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Save, Eye, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBanks, useCreateBank, useBankCsvMappingsByBank, useCreateBankCsvMapping, useUpdateBankCsvMapping } from '@/hooks/useBanks';

interface ColumnMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileColumns: string[];
  sampleData: string[][];
  selectedBankId?: string;
  onMappingSaved: (mapping: ColumnMapping) => void;
}

interface ColumnMapping {
  bankId: string;
  name: string;
  dateColumn?: string;
  descriptionColumn?: string;
  amountColumn?: string;
  balanceColumn?: string;
  bankCategoryColumn?: string;
  bankSubCategoryColumn?: string;
}

const SYSTEM_FIELDS = [
  { key: 'dateColumn', label: 'Datum', description: 'Datum för transaktionen' },
  { key: 'descriptionColumn', label: 'Beskrivning', description: 'Transaktionsbeskrivning' },
  { key: 'amountColumn', label: 'Belopp', description: 'Transaktionsbelopp' },
  { key: 'balanceColumn', label: 'Saldo', description: 'Kontosaldo efter transaktion' },
  { key: 'bankCategoryColumn', label: 'Bankkategori', description: 'Bankens kategori' },
  { key: 'bankSubCategoryColumn', label: 'Bank underkategori', description: 'Bankens underkategori' },
];

export function ColumnMappingDialog({ 
  isOpen, 
  onClose, 
  fileColumns, 
  sampleData, 
  selectedBankId,
  onMappingSaved 
}: ColumnMappingDialogProps) {
  const { toast } = useToast();
  const { data: banks } = useBanks();
  const [currentBankId, setCurrentBankId] = useState(selectedBankId || '');
  const { data: existingMappings } = useBankCsvMappingsByBank(currentBankId || selectedBankId || '');
  const createBank = useCreateBank();
  const createMapping = useCreateBankCsvMapping();
  const updateMapping = useUpdateBankCsvMapping();
  const [newBankName, setNewBankName] = useState('');
  const [mappingName, setMappingName] = useState('Standard mappning');
  const [showPreview, setShowPreview] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Update currentBankId when selectedBankId changes
  useEffect(() => {
    if (selectedBankId) {
      setCurrentBankId(selectedBankId);
    }
  }, [selectedBankId]);

  // Load existing mapping when bank changes
  useEffect(() => {
    if (existingMappings && existingMappings.length > 0) {
      const activeMapping = existingMappings.find(m => m.isActive === 'true') || existingMappings[0];
      setMapping({
        dateColumn: activeMapping.dateColumn || '',
        descriptionColumn: activeMapping.descriptionColumn || '',
        amountColumn: activeMapping.amountColumn || '',
        balanceColumn: activeMapping.balanceColumn || '',
        bankCategoryColumn: activeMapping.bankCategoryColumn || '',
        bankSubCategoryColumn: activeMapping.bankSubCategoryColumn || '',
      });
      setMappingName(activeMapping.name);
    } else {
      // Auto-detect columns based on common names
      const autoMapping: Record<string, string> = {};
      
      fileColumns.forEach((col, index) => {
        const lowerCol = col.toLowerCase();
        if (lowerCol.includes('datum') || lowerCol.includes('date')) {
          autoMapping.dateColumn = col;
        } else if (lowerCol.includes('beskrivning') || lowerCol.includes('text') || lowerCol.includes('description')) {
          autoMapping.descriptionColumn = col;
        } else if (lowerCol.includes('belopp') || lowerCol.includes('amount') || lowerCol.includes('summa')) {
          autoMapping.amountColumn = col;
        } else if (lowerCol.includes('saldo') || lowerCol.includes('balance')) {
          autoMapping.balanceColumn = col;
        } else if (lowerCol.includes('kategori') && !lowerCol.includes('under')) {
          autoMapping.bankCategoryColumn = col;
        } else if (lowerCol.includes('underkategori') || lowerCol.includes('subcategory')) {
          autoMapping.bankSubCategoryColumn = col;
        }
      });
      
      setMapping(autoMapping);
    }
  }, [existingMappings]);

  const handleCreateBank = async () => {
    if (!newBankName.trim()) return;
    
    try {
      const result = await createBank.mutateAsync({ name: newBankName.trim() });
      setCurrentBankId(result.id);
      setNewBankName('');
      toast({
        title: "Bank skapad",
        description: `Bank "${result.name}" har skapats.`,
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte skapa bank.",
        variant: "destructive",
      });
    }
  };

  const handleSaveMapping = async () => {
    if (!currentBankId) {
      toast({
        title: "Fel",
        description: "Välj eller skapa en bank först.",
        variant: "destructive",
      });
      return;
    }

    const mappingData = {
      bankId: currentBankId,
      name: mappingName,
      ...mapping,
    };

    try {
      const existingMapping = existingMappings?.find(m => m.isActive === 'true');
      
      if (existingMapping) {
        await updateMapping.mutateAsync({
          id: existingMapping.id,
          ...mappingData,
        });
      } else {
        await createMapping.mutateAsync(mappingData);
      }

      onMappingSaved(mappingData);
      toast({
        title: "Mappning sparad",
        description: "Kolumnmappningen har sparats i databasen.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte spara kolumnmappning.",
        variant: "destructive",
      });
    }
  };

  const getPreviewData = () => {
    if (!sampleData.length) return [];
    
    return sampleData.slice(0, 3).map(row => {
      const preview: Record<string, string> = {};
      
      SYSTEM_FIELDS.forEach(field => {
        const columnName = mapping[field.key];
        if (columnName) {
          const columnIndex = fileColumns.indexOf(columnName);
          if (columnIndex !== -1) {
            preview[field.label] = row[columnIndex] || '';
          }
        }
      });
      
      return preview;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Kolumnmappning för CSV/XLSX Import
          </DialogTitle>
          <DialogDescription>
            Mappa filens kolumner mot systemets fält för korrekt inläsning av data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bank Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Välj Bank</CardTitle>
              <CardDescription>
                Välj vilken bank denna kolumnmappning gäller för
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="bank-select">Bank</Label>
                  <Select value={currentBankId} onValueChange={setCurrentBankId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj bank..." />
                    </SelectTrigger>
                    <SelectContent>
                      {banks?.map(bank => (
                        <SelectItem key={bank.id} value={bank.id}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <span className="text-sm text-muted-foreground">eller</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="new-bank">Skapa ny bank</Label>
                  <Input
                    id="new-bank"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    placeholder="Bankens namn..."
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleCreateBank}
                    disabled={!newBankName.trim() || createBank.isPending}
                  >
                    Skapa
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mapping Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Kolumnmappning</CardTitle>
              <CardDescription>
                Mappa filens kolumner ({fileColumns.length} kolumner funna) mot systemets fält
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="mapping-name">Mappningsnamn</Label>
                <Input
                  id="mapping-name"  
                  value={mappingName}
                  onChange={(e) => setMappingName(e.target.value)}
                  placeholder="Mappningsnamn..."
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {SYSTEM_FIELDS.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>
                      {field.label}
                      {(field.key === 'dateColumn' || field.key === 'descriptionColumn' || field.key === 'amountColumn') && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    <Select 
                      value={mapping[field.key] || 'NONE'} 
                      onValueChange={(value) => setMapping(prev => ({ ...prev, [field.key]: value === 'NONE' ? '' : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj kolumn..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Ingen mappning</SelectItem>
                        {fileColumns.map(column => (
                          <SelectItem key={column} value={column}>
                            {column}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">{field.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* File Columns Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tillgängliga kolumner i filen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {fileColumns.map((column, index) => (
                  <Badge key={index} variant="outline" className="text-sm">
                    {column}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {sampleData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Förhandsvisning
                </CardTitle>
                <CardDescription>
                  Så här kommer datan att mappas baserat på dina inställningar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                  className="mb-4"
                >
                  {showPreview ? 'Dölj' : 'Visa'} förhandsvisning
                </Button>
                
                {showPreview && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          {SYSTEM_FIELDS.map(field => (
                            <th key={field.key} className="text-left p-3 font-medium">
                              {field.label}
                              {mapping[field.key] && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  ← {mapping[field.key]}
                                </div>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getPreviewData().map((row, index) => (
                          <tr key={index} className="border-t">
                            {SYSTEM_FIELDS.map(field => (
                              <td key={field.key} className="p-3 text-sm">
                                {row[field.label] || <span className="text-muted-foreground">-</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button 
              onClick={handleSaveMapping}
              disabled={!currentBankId || !mapping.dateColumn || !mapping.descriptionColumn || !mapping.amountColumn}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Spara mappning
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}