import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ImportedTransaction } from '@/types/transaction';
import { coverCost } from '../orchestrator/budgetOrchestrator';

interface CostCoverageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transfer?: ImportedTransaction;
  potentialCosts?: ImportedTransaction[];
}

export const CostCoverageDialog: React.FC<CostCoverageDialogProps> = ({
  isOpen,
  onClose,
  transfer,
  potentialCosts = []
}) => {
  const [selectedCost, setSelectedCost] = React.useState<string>('');
  const [searchTerm, setSearchTerm] = React.useState<string>('');

  const filteredCosts = potentialCosts.filter(cost => 
    cost.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cost.date.includes(searchTerm)
  );

  const handleCover = () => {
    if (transfer && selectedCost) {
      coverCost(transfer.id, selectedCost);
      onClose();
    }
  };

  if (!transfer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vilken kostnad täcker denna överföring?</DialogTitle>
          <DialogDescription>
            Du kategoriserar +{Math.abs(transfer.amount).toLocaleString('sv-SE')} kr som "Täck en kostnad".
            Välj vilken kostnad från ett annat konto som denna överföring ska betala av.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Sök efter kostnad:</Label>
            <Input
              id="search"
              placeholder="Sök på beskrivning eller datum..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredCosts.length > 0 ? (
            <RadioGroup value={selectedCost} onValueChange={setSelectedCost}>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredCosts.map((cost) => (
                  <div key={cost.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value={cost.id} id={cost.id} />
                    <Label htmlFor={cost.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{cost.date}: {cost.description}</span>
                        <span className="text-red-600 font-medium">
                          {cost.amount.toLocaleString('sv-SE')} kr
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Konto: {cost.accountId} • Kategori: {cost.appCategoryId || 'Okategoriserad'}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Inga kostnader matchar sökningen.' : 'Inga okategoriserade kostnader hittades.'}
            </div>
          )}

          <div className="pt-4 border-t">
            <Button variant="outline" className="w-full">
              Sök efter en annan transaktion...
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={handleCover} disabled={!selectedCost}>
            Täck kostnad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};