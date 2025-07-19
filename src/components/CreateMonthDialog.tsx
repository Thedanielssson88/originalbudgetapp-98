import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Copy, FileText, X } from 'lucide-react';

interface CreateMonthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateMonth: (type: 'empty' | 'template' | 'copy', templateName?: string) => void;
  budgetTemplates: { [key: string]: any };
  selectedBudgetMonth: string;
  direction?: 'previous' | 'next';
}

const CreateMonthDialog: React.FC<CreateMonthDialogProps> = ({
  isOpen,
  onClose,
  onCreateMonth,
  budgetTemplates,
  selectedBudgetMonth,
  direction = 'next'
}) => {
  const [selectedOption, setSelectedOption] = useState<'empty' | 'template' | 'copy'>('empty');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const handleCreate = () => {
    if (selectedOption === 'template' && !selectedTemplate) {
      return; // Don't proceed if template is selected but none chosen
    }
    onCreateMonth(selectedOption, selectedTemplate);
    onClose();
  };

  const handleCancel = () => {
    setSelectedOption('empty');
    setSelectedTemplate('');
    onClose();
  };

  const formatMonthDisplay = (monthKey: string) => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-');
    const monthNames = [
      'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  const getTargetMonthDisplay = () => {
    if (!selectedBudgetMonth) return '';
    const [year, month] = selectedBudgetMonth.split('-');
    const currentYear = parseInt(year);
    const currentMonth = parseInt(month);
    
    let targetMonth, targetYear;
    if (direction === 'next') {
      targetMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      targetYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    } else {
      targetMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      targetYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    }
    
    const targetMonthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    return formatMonthDisplay(targetMonthKey);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Skapa {direction === 'next' ? 'nästa' : 'föregående'} månad ({getTargetMonthDisplay()})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4 overflow-y-auto flex-1">
          <RadioGroup value={selectedOption} onValueChange={(value) => setSelectedOption(value as any)}>
            {/* Empty month option */}
            <Card className={`cursor-pointer transition-colors ${selectedOption === 'empty' ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="empty" id="empty" />
                  <div className="flex-1">
                    <Label htmlFor="empty" className="cursor-pointer font-medium">
                      Tom månad med samma kategorier
                    </Label>
                    <CardDescription className="mt-1">
                      Skapa en ny månad med samma budgetkategorier som nuvarande månad, men utan belopp
                    </CardDescription>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Template option */}
            <Card className={`cursor-pointer transition-colors ${selectedOption === 'template' ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="template" id="template" />
                  <div className="flex-1">
                    <Label htmlFor="template" className="cursor-pointer font-medium">
                      Använd sparad mall
                    </Label>
                    <CardDescription className="mt-1">
                      Skapa månad baserat på en av dina sparade budgetmallar
                    </CardDescription>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                
                {selectedOption === 'template' && (
                  <div className="mt-3">
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj en mall" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(budgetTemplates).sort().map(templateName => (
                          <SelectItem key={templateName} value={templateName}>
                            {templateName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Copy current month option */}
            <Card className={`cursor-pointer transition-colors ${selectedOption === 'copy' ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="copy" id="copy" />
                  <div className="flex-1">
                    <Label htmlFor="copy" className="cursor-pointer font-medium">
                      Kopiera nuvarande månad
                    </Label>
                    <CardDescription className="mt-1">
                      Skapa månad med samma kategorier, inkomster och belopp som {formatMonthDisplay(selectedBudgetMonth)}
                    </CardDescription>
                  </div>
                  <Copy className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </RadioGroup>

          {/* Show template details if template is selected */}
          {selectedOption === 'template' && selectedTemplate && budgetTemplates[selectedTemplate] && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Malldetaljer</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Skapad:</span>
                  <span>{new Date(budgetTemplates[selectedTemplate].created).toLocaleDateString('sv-SE')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Antal kostnadskategorier:</span>
                  <span>{budgetTemplates[selectedTemplate].costGroups?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Antal sparkategorier:</span>
                  <span>{budgetTemplates[selectedTemplate].savingsGroups?.length || 0}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t bg-background">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            <X className="h-4 w-4 mr-2" />
            Avbryt
          </Button>
          <Button 
            onClick={handleCreate} 
            className="flex-1"
            disabled={selectedOption === 'template' && !selectedTemplate}
          >
            Skapa månad
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMonthDialog;