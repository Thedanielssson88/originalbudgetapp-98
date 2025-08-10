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
import { getAccountNameById } from '../orchestrator/budgetOrchestrator';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { addMobileDebugLog } from '@/utils/mobileDebugLogger';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';

interface CostCoverageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transfer?: ImportedTransaction;
  potentialCosts?: ImportedTransaction[];
  onRefresh?: () => void; // Add refresh callback
}

export const CostCoverageDialog: React.FC<CostCoverageDialogProps> = ({
  isOpen,
  onClose,
  transfer,
  potentialCosts = [],
  onRefresh
}) => {
  const [selectedCost, setSelectedCost] = React.useState<string>('');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [showAll, setShowAll] = React.useState<boolean>(false);
  const updateTransactionMutation = useUpdateTransaction();

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedCost('');
      setSearchTerm('');
      setIsProcessing(false);
      setShowAll(false);
    }
  }, [isOpen]);

  const filteredCosts = potentialCosts.filter(cost => 
    cost.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cost.date.includes(searchTerm)
  );

  // Show only first 5 transactions initially, unless user wants to see all or is searching
  const displayedCosts = searchTerm || showAll ? filteredCosts : filteredCosts.slice(0, 5);
  const hasMoreCosts = filteredCosts.length > 5 && !searchTerm && !showAll;

  const handleCover = async () => {
    if (!transfer || !selectedCost || isProcessing) return;
    
    setIsProcessing(true);

    addMobileDebugLog('====================================');
    addMobileDebugLog('🔗 [TÄCK KOSTNAD START] Beginning cost coverage calculation');
    addMobileDebugLog('====================================');
    addMobileDebugLog(`📋 [INPUT] Transfer ID: ${transfer.id}`);
    addMobileDebugLog(`📋 [INPUT] Transfer Description: ${transfer.description}`);
    addMobileDebugLog(`📋 [INPUT] Transfer Amount (original): ${transfer.amount} öre`);
    addMobileDebugLog(`📋 [INPUT] Transfer CorrectedAmount (existing): ${transfer.correctedAmount ?? 'null'} öre`);
    addMobileDebugLog(`📋 [INPUT] Transfer Type: ${transfer.type}`);
    addMobileDebugLog(`📋 [INPUT] Selected Cost ID: ${selectedCost}`);

    // DEBUG: Log to browser console for direct debugging
    console.log('=== COST COVERAGE CALCULATION DEBUG ===');
    console.log('Transfer (CostCoverage):', transfer);
    console.log('Selected Cost ID:', selectedCost);

    try {
      // Find the cost transaction
      const costTransaction = potentialCosts.find(c => c.id === selectedCost);
      if (!costTransaction) {
        addMobileDebugLog('❌ [COST COVERAGE ERROR] Cost transaction not found');
        return;
      }

      console.log('Cost Transaction (ExpenseClaim):', costTransaction);

      addMobileDebugLog(`📋 [COST] Cost Description: ${costTransaction.description}`);
      addMobileDebugLog(`📋 [COST] Cost Amount (original): ${costTransaction.amount} öre`);
      addMobileDebugLog(`📋 [COST] Cost CorrectedAmount (existing): ${costTransaction.correctedAmount ?? 'null'} öre`);
      addMobileDebugLog(`📋 [COST] Cost Type: ${costTransaction.type}`);
      addMobileDebugLog(`📋 [COST] Cost LinkedTransactionId: ${costTransaction.linkedTransactionId ?? 'null'}`);

      // Get account names for descriptions
      const transferAccountName = getAccountNameById(transfer.accountId) || 'Unknown Account';
      const costAccountName = getAccountNameById(costTransaction.accountId) || 'Unknown Account';
      
      addMobileDebugLog(`📋 [ACCOUNTS] Transfer Account: ${transferAccountName}`);
      addMobileDebugLog(`📋 [ACCOUNTS] Cost Account: ${costAccountName}`);

      // Calculate corrected amount based on coverage
      // Use EFFECTIVE amounts (correctedAmount if exists, otherwise original amount)
      addMobileDebugLog('====================================');
      addMobileDebugLog('🧮 [CALCULATION START]');
      addMobileDebugLog('====================================');
      
      // For expense: use correctedAmount if it exists AND is linked, otherwise original
      const effectiveExpenseAmount = (costTransaction.correctedAmount !== null && costTransaction.linkedTransactionId !== null)
        ? Math.abs(costTransaction.correctedAmount)
        : Math.abs(costTransaction.amount);
      
      // For transfer: use correctedAmount if it exists AND is linked, otherwise original  
      const effectiveTransferAmount = (transfer.correctedAmount !== null && transfer.linkedTransactionId !== null)
        ? Math.abs(transfer.correctedAmount)
        : Math.abs(transfer.amount);
      
      const expenseSource = (costTransaction.correctedAmount !== null && costTransaction.linkedTransactionId !== null) ? `corrected(${costTransaction.correctedAmount})` : `original(${costTransaction.amount})`;
      const transferSource = (transfer.correctedAmount !== null && transfer.linkedTransactionId !== null) ? `corrected(${transfer.correctedAmount})` : `original(${transfer.amount})`;
      
      addMobileDebugLog(`🧮 [CALC] Step 1: effectiveExpenseAmount = abs(${expenseSource}) = ${effectiveExpenseAmount} öre`);
      addMobileDebugLog(`🧮 [CALC] Step 2: effectiveTransferAmount = abs(${transferSource}) = ${effectiveTransferAmount} öre`);
      
      // Calculate how much of the expense can be covered with available transfer amount
      const amountToCover = Math.min(effectiveExpenseAmount, effectiveTransferAmount);
      
      addMobileDebugLog(`🧮 [CALC] Step 3: amountToCover = min(${effectiveExpenseAmount}, ${effectiveTransferAmount}) = ${amountToCover} öre`);
      
      // Check if there's actually any amount to cover
      if (amountToCover <= 0) {
        addMobileDebugLog('⚠️ [WARNING] No amount available to cover - transfer may be fully used or expense fully covered');
        addMobileDebugLog('====================================');
        addMobileDebugLog('🚫 [TÄCK KOSTNAD ABORTED] - Nothing to cover');
        addMobileDebugLog('====================================');
        
        // Show user-friendly message
        const message = effectiveTransferAmount === 0 
          ? 'Denna överföring har redan använts helt för att täcka andra kostnader. Du behöver antingen koppla ur den befintliga länkningen först, eller använda en annan överföring.'
          : 'Denna kostnad är redan helt täckt. Det finns inget kvar att betala.';
        
        alert(message);
        setIsProcessing(false);
        return;
      }
      
      // Calculate the NEW corrected amounts based on current effective amounts
      // For expense: reduce the remaining amount by what's being covered
      const currentExpenseAmount = (costTransaction.correctedAmount !== null && costTransaction.linkedTransactionId !== null) ? costTransaction.correctedAmount : costTransaction.amount;
      const newCostCorrectedAmount = currentExpenseAmount + amountToCover;
      
      // For transfer: reduce the available amount by what's being used  
      const currentTransferAmount = (transfer.correctedAmount !== null && transfer.linkedTransactionId !== null) ? transfer.correctedAmount : transfer.amount;
      const newTransferCorrectedAmount = currentTransferAmount - amountToCover;
      
      addMobileDebugLog(`🧮 [CALC] Step 4: newCostCorrectedAmount = ${currentExpenseAmount} + ${amountToCover} = ${newCostCorrectedAmount} öre`);
      addMobileDebugLog(`🧮 [CALC] Step 5: newTransferCorrectedAmount = ${currentTransferAmount} - ${amountToCover} = ${newTransferCorrectedAmount} öre`);
      addMobileDebugLog('====================================');

      console.log('=== CALCULATION VALUES ===');
      console.log('costTransaction.amount (original):', costTransaction.amount);
      console.log('costTransaction.correctedAmount (existing):', costTransaction.correctedAmount);
      console.log('transfer.amount (original):', transfer.amount);
      console.log('transfer.correctedAmount (existing):', transfer.correctedAmount);
      console.log('effectiveExpenseAmount (remaining to cover):', effectiveExpenseAmount);
      console.log('effectiveTransferAmount (available to use):', effectiveTransferAmount);
      console.log('amountToCover:', amountToCover);
      console.log('newCostCorrectedAmount:', newCostCorrectedAmount);
      console.log('newTransferCorrectedAmount:', newTransferCorrectedAmount);


      // Link both transactions using API calls
      addMobileDebugLog('====================================');
      addMobileDebugLog('📤 [API PREPARATION]');
      addMobileDebugLog('====================================');
      
      const costUpdate = {
        id: selectedCost,
        data: {
          type: 'ExpenseClaim',
          linkedTransactionId: transfer.id,
          correctedAmount: Math.round(newCostCorrectedAmount), // Ensure it's an integer
          userDescription: `Utlägg täcks av betalning från ${transferAccountName}`,
          isManuallyChanged: 'true'
        }
      };
      
      addMobileDebugLog(`📤 [API] Cost Update ID: ${costUpdate.id}`);
      addMobileDebugLog(`📤 [API] Cost Update Type: ${costUpdate.data.type}`);
      addMobileDebugLog(`📤 [API] Cost Update LinkedTo: ${costUpdate.data.linkedTransactionId}`);
      addMobileDebugLog(`📤 [API] Cost Update CorrectedAmount: ${costUpdate.data.correctedAmount} öre`);
      addMobileDebugLog(`📤 [API] Cost Update Description: ${costUpdate.data.userDescription}`);

      const transferUpdate = {
        id: transfer.id,
        data: {
          type: 'CostCoverage',
          linkedTransactionId: selectedCost,
          correctedAmount: Math.round(newTransferCorrectedAmount), // Ensure it's an integer
          userDescription: `Täcker utlägg från ${costAccountName}`,
          isManuallyChanged: 'true'
        }
      };
      
      addMobileDebugLog(`📤 [API] Transfer Update ID: ${transferUpdate.id}`);
      addMobileDebugLog(`📤 [API] Transfer Update Type: ${transferUpdate.data.type}`);
      addMobileDebugLog(`📤 [API] Transfer Update LinkedTo: ${transferUpdate.data.linkedTransactionId}`);
      addMobileDebugLog(`📤 [API] Transfer Update CorrectedAmount: ${transferUpdate.data.correctedAmount} öre`);
      addMobileDebugLog(`📤 [API] Transfer Update Description: ${transferUpdate.data.userDescription}`);

      console.log('=== API UPDATES ===');
      console.log('Cost Update:', costUpdate);
      console.log('Transfer Update:', transferUpdate);

      addMobileDebugLog('====================================');
      addMobileDebugLog('🚀 [API CALLS EXECUTING]');
      addMobileDebugLog('====================================');
      
      const results = await Promise.all([
        // Update cost transaction (becomes ExpenseClaim)
        updateTransactionMutation.mutateAsync(costUpdate),
        // Update transfer transaction (becomes CostCoverage)
        updateTransactionMutation.mutateAsync(transferUpdate)
      ]);

      console.log('=== API RESULTS ===');
      console.log('Cost Result:', results[0]);
      console.log('Transfer Result:', results[1]);

      addMobileDebugLog('====================================');
      addMobileDebugLog('✅ [API RESULTS]');
      addMobileDebugLog('====================================');
      addMobileDebugLog(`✅ [RESULT 1 - Cost] ID: ${results[0]?.id ?? 'undefined'}`);
      addMobileDebugLog(`✅ [RESULT 1 - Cost] Type: ${results[0]?.type ?? 'undefined'}`);
      addMobileDebugLog(`✅ [RESULT 1 - Cost] CorrectedAmount: ${results[0]?.correctedAmount ?? 'undefined'} öre`);
      addMobileDebugLog(`✅ [RESULT 2 - Transfer] ID: ${results[1]?.id ?? 'undefined'}`);
      addMobileDebugLog(`✅ [RESULT 2 - Transfer] Type: ${results[1]?.type ?? 'undefined'}`);
      addMobileDebugLog(`✅ [RESULT 2 - Transfer] CorrectedAmount: ${results[1]?.correctedAmount ?? 'undefined'} öre`);

      // Trigger refresh if callback provided
      if (onRefresh) {
        addMobileDebugLog('🔄 [REFRESH] Calling onRefresh callback...');
        await onRefresh();
        addMobileDebugLog('✅ [REFRESH] onRefresh completed - UI will update with fresh data');
      }
      
      addMobileDebugLog('====================================');
      addMobileDebugLog('🎉 [TÄCK KOSTNAD COMPLETE]');
      addMobileDebugLog('====================================');
      
      setIsProcessing(false);
      onClose();

    } catch (error) {
      addMobileDebugLog('====================================');
      addMobileDebugLog('❌ [ERROR] TÄCK KOSTNAD FAILED');
      addMobileDebugLog('====================================');
      addMobileDebugLog(`❌ [ERROR] Message: ${error instanceof Error ? error.message : String(error)}`);
      addMobileDebugLog(`❌ [ERROR] Full details: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
      console.error('Error linking cost coverage:', error);
      setIsProcessing(false);
    }
  };

  if (!transfer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vilken kostnad täcker denna överföring?</DialogTitle>
          <DialogDescription>
            Du kategoriserar {formatOrenAsCurrency(Math.abs(transfer.amount))} som "Täck en kostnad".
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

          {displayedCosts.length > 0 ? (
            <RadioGroup 
              value={selectedCost} 
              onValueChange={(value) => {
                console.log('🔘 [RADIO] Selected cost ID:', value);
                addMobileDebugLog(`🔘 [RADIO] Selected cost ID: ${value}`);
                setSelectedCost(value);
              }}
            >
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {displayedCosts.map((cost) => (
                  <div key={cost.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value={cost.id} id={cost.id} />
                    <Label htmlFor={cost.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{cost.date}: {cost.description}</span>
                        <span className="text-red-600 font-medium">
                          {formatOrenAsCurrency(cost.amount)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Konto: {cost.accountId} • Kategori: {cost.appCategoryId || 'Okategoriserad'}
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
              
              {hasMoreCosts && (
                <div className="pt-2 border-t">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAll(true)}
                    className="w-full"
                  >
                    Visa alla {filteredCosts.length} kostnader
                  </Button>
                </div>
              )}
            </RadioGroup>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Inga kostnader matchar sökningen.' : 'Inga kostnader hittades på samma konto.'}
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
          <Button 
            onClick={handleCover} 
            disabled={!selectedCost || isProcessing}
            onMouseEnter={() => {
              console.log('🔍 [DEBUG] Button state - selectedCost:', selectedCost, 'disabled:', !selectedCost || isProcessing, 'processing:', isProcessing);
              addMobileDebugLog(`🔍 [DEBUG] Button state - selectedCost: ${selectedCost || 'EMPTY'}, disabled: ${!selectedCost || isProcessing}, processing: ${isProcessing}`);
            }}
          >
            {isProcessing ? 'Bearbetar...' : 'Täck kostnad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};