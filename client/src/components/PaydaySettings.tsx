import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { IncomeSourcesManagement } from './IncomeSourcesManagement';

interface PaydaySettingsProps {
  currentPayday: number;
  onPaydayChange: (newPayday: number) => void;
}

export const PaydaySettings: React.FC<PaydaySettingsProps> = ({
  currentPayday,
  onPaydayChange
}) => {
  const [selectedPayday, setSelectedPayday] = useState<number>(currentPayday);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const handlePaydaySelect = (value: string) => {
    const newPayday = parseInt(value);
    setSelectedPayday(newPayday);
    setHasChanges(newPayday !== currentPayday);
  };

  const handleSave = () => {
    onPaydayChange(selectedPayday);
    setHasChanges(false);
  };

  const handleReset = () => {
    setSelectedPayday(currentPayday);
    setHasChanges(false);
  };

  const getPaydayDescription = (payday: number) => {
    if (payday === 1) {
      return {
        title: "Kalendermånad",
        description: "Månaden definieras som 1:a till sista dagen i kalendermånaden",
        example: "November 2024: 1 nov - 30 nov"
      };
    } else {
      return {
        title: "Lönedagsmånad",
        description: `Månaden definieras som ${payday}:e föregående månad till ${payday - 1}:e aktuella månaden`,
        example: `November 2024: 25 okt - 24 nov`
      };
    }
  };

  const paydays = Array.from({ length: 31 }, (_, i) => i + 1);
  const description = getPaydayDescription(selectedPayday);

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Utbetalning & Månadsperiod
        </CardTitle>
        <CardDescription>
          Välj vilken dag som definierar början och slutet av din budgetmånad
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="payday-select">Lönedag</Label>
          <Select value={selectedPayday.toString()} onValueChange={handlePaydaySelect}>
            <SelectTrigger>
              <SelectValue placeholder="Välj lönedag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">
                <div className="flex items-center justify-between w-full">
                  <span>1:a (Kalendermånad)</span>
                  <Badge variant="outline">Standard</Badge>
                </div>
              </SelectItem>
              {paydays.slice(1).map(day => (
                <SelectItem key={day} value={day.toString()}>
                  {day}:e
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div>
                <strong>{description.title}</strong>
              </div>
              <div className="text-sm text-muted-foreground">
                {description.description}
              </div>
              <div className="text-sm font-mono bg-muted p-2 rounded">
                Exempel: {description.example}
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {hasChanges && (
          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} className="flex-1">
              Spara ändring
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Återställ
            </Button>
          </div>
        )}

        {!hasChanges && (
          <div className="text-sm text-muted-foreground">
            Aktuell inställning: <strong>{description.title}</strong>
          </div>
        )}
      </CardContent>
    </Card>
    
    <IncomeSourcesManagement />
    </>
  );
};