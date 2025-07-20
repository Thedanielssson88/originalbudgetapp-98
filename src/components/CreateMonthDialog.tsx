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

  // Swedish holiday calculation functions
  const calculateEaster = (year: number) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = Math.floor((h + l - 7 * m + 114) / 31);
    const p = (h + l - 7 * m + 114) % 31;
    return new Date(year, n - 1, p + 1);
  };

  const getSwedishHolidays = (year: number) => {
    const holidays = [];
    
    // Fixed holidays
    holidays.push(new Date(year, 0, 1));   // New Year's Day
    holidays.push(new Date(year, 0, 6));   // Epiphany
    holidays.push(new Date(year, 4, 1));   // May Day
    holidays.push(new Date(year, 5, 6));   // National Day
    holidays.push(new Date(year, 11, 24)); // Christmas Eve
    holidays.push(new Date(year, 11, 25)); // Christmas Day
    holidays.push(new Date(year, 11, 26)); // Boxing Day
    holidays.push(new Date(year, 11, 31)); // New Year's Eve
    
    // Calculate Easter and related holidays
    const easter = calculateEaster(year);
    holidays.push(new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000)); // Good Friday
    holidays.push(new Date(easter.getTime() + 24 * 60 * 60 * 1000));     // Easter Monday
    holidays.push(new Date(easter.getTime() + 39 * 24 * 60 * 60 * 1000)); // Ascension Day
    holidays.push(new Date(easter.getTime() + 49 * 24 * 60 * 60 * 1000)); // Whit Sunday
    holidays.push(new Date(easter.getTime() + 50 * 24 * 60 * 60 * 1000)); // Whit Monday
    
    // All Saints' Day (first Saturday between Oct 31 and Nov 6)
    for (let day = 31; day <= 37; day++) {
      const date = new Date(year, 9, day);
      if (date.getDay() === 6) {
        holidays.push(date);
        break;
      }
    }
    
    return holidays;
  };

  const isSwedishHoliday = (date: Date) => {
    const year = date.getFullYear();
    const holidays = getSwedishHolidays(year);
    
    // Check official Swedish holidays
    const isOfficialHoliday = holidays.some(holiday => 
      holiday.getDate() === date.getDate() &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getFullYear() === date.getFullYear()
    );
    
    return isOfficialHoliday;
  };

  // Function to calculate weekdays and weekend days for a specific month
  const calculateDaysForMonth = (year: number, month: number) => {
    // Calculate from 25th of previous month to 24th of selected month
    const prevMonth = month - 1;
    const prevYear = prevMonth < 0 ? year - 1 : year;
    const adjustedPrevMonth = prevMonth < 0 ? 11 : prevMonth;
    const startDate = new Date(prevYear, adjustedPrevMonth, 25);
    const endDate = new Date(year, month, 24);
    
    let weekdayCount = 0;
    let fridayCount = 0;
    let currentDatePointer = new Date(startDate);
    
    while (currentDatePointer <= endDate) {
      const dayOfWeek = currentDatePointer.getDay();
      const isHoliday = isSwedishHoliday(currentDatePointer);
      
      if (!isHoliday && dayOfWeek >= 1 && dayOfWeek <= 5) {
        weekdayCount++;
        if (dayOfWeek === 5) { // Friday
          fridayCount++;
        }
      }
      
      currentDatePointer.setDate(currentDatePointer.getDate() + 1);
    }
    
    return { weekdayCount, fridayCount };
  };

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

            {/* Show template details if template is selected */}
            {selectedOption === 'template' && selectedTemplate && budgetTemplates[selectedTemplate] && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Detaljer för "{selectedTemplate}"</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3 text-sm">
                  {(() => {
                    const template = budgetTemplates[selectedTemplate];
                    const formatCurrency = (amount: number) => `${amount.toLocaleString('sv-SE')} kr`;
                    
                    const totalCosts = template.costGroups?.reduce((sum: number, group: any) => {
                      const subTotal = group.subCategories?.reduce((subSum: number, sub: any) => subSum + sub.amount, 0) || 0;
                      return sum + subTotal;
                    }, 0) || 0;
                    
                    const totalSavings = template.savingsGroups?.reduce((sum: number, group: any) => sum + group.amount, 0) || 0;
                    
                    return (
                      <div className="space-y-3">
                         <div className="space-y-3">
                           <div className="grid grid-cols-2 gap-4">
                             <div>
                               <span className="font-medium">Totala kostnader:</span>
                               <div className="text-destructive font-semibold">{formatCurrency(totalCosts)}</div>
                             </div>
                             <div>
                               <span className="font-medium">Total daglig budget:</span>
                               <div className="text-destructive font-semibold">
                                 {(() => {
                                   if (!template.dailyTransfer || !template.weekendTransfer) return '0 kr';
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
                                   
                                   const { weekdayCount, fridayCount } = calculateDaysForMonth(targetYear, targetMonth - 1);
                                   const totalDailyBudget = template.dailyTransfer * weekdayCount + template.weekendTransfer * fridayCount;
                                   return formatCurrency(totalDailyBudget);
                                 })()}
                               </div>
                             </div>
                           </div>
                           <div>
                             <span className="font-medium">Totalt sparande:</span>
                             <div className="text-green-600 font-semibold">{formatCurrency(totalSavings)}</div>
                           </div>
                         </div>
                        
                        {template.costGroups && template.costGroups.length > 0 && (
                          <div>
                            <span className="font-medium">Kostnadskategorier:</span>
                            <ul className="ml-4 mt-1 space-y-1">
                              {template.costGroups.map((group: any) => {
                                const groupTotal = group.subCategories?.reduce((sum: number, sub: any) => sum + sub.amount, 0) || 0;
                                return (
                                  <li key={group.id} className="text-xs">
                                    <div className="font-medium">{group.name}: {formatCurrency(groupTotal)}</div>
                                    {group.subCategories && group.subCategories.length > 0 && (
                                      <ul className="ml-4 mt-1 space-y-1">
                                        {group.subCategories.map((sub: any, index: number) => (
                                          <li key={index} className="text-xs text-muted-foreground">
                                            • {sub.name}: {formatCurrency(sub.amount)}{sub.account ? ` (${sub.account})` : ''}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                        
                        {template.savingsGroups && template.savingsGroups.length > 0 && (
                          <div>
                            <span className="font-medium">Sparandekategorier:</span>
                            <ul className="ml-4 mt-1 space-y-1">
                              {template.savingsGroups.map((group: any) => (
                                <li key={group.id} className="text-xs">
                                  {group.name}: {formatCurrency(group.amount)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Dagliga Överföringar Section */}
                        {(template.dailyTransfer || template.weekendTransfer) && (() => {
                          // Calculate for the month being created
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
                          
                          const { weekdayCount, fridayCount } = calculateDaysForMonth(targetYear, targetMonth - 1); // -1 because month is 0-based
                          const totalDailyBudget = (template.dailyTransfer || 0) * weekdayCount + (template.weekendTransfer || 0) * fridayCount;
                          
                          return (
                            <div>
                              <span className="font-medium">Dagliga Överföringar:</span>
                              <div className="ml-4 mt-1 space-y-1 text-xs">
                                <div className="font-medium">
                                  Total daglig budget: {formatCurrency(totalDailyBudget)}
                                </div>
                                <ul className="ml-4 space-y-1">
                                  <li className="text-xs text-muted-foreground">
                                    • Vardagar: {weekdayCount} × {formatCurrency(template.dailyTransfer || 0)} = {formatCurrency((template.dailyTransfer || 0) * weekdayCount)}
                                  </li>
                                  <li className="text-xs text-muted-foreground">
                                    • Helgdagar: {fridayCount} × {formatCurrency(template.weekendTransfer || 0)} = {formatCurrency((template.weekendTransfer || 0) * fridayCount)}
                                  </li>
                                </ul>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

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