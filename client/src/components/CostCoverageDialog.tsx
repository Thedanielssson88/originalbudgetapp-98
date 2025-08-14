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
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { addMobileDebugLog } from '@/utils/mobileDebugLogger';

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
      console.log('🔵 [DIALOG] CostCoverageDialog opened', { 
        transfer: transfer?.id, 
        potentialCostsCount: potentialCosts.length,
        transfer_full: transfer 
      });
      addMobileDebugLog(`🔵 [DIALOG] CostCoverageDialog opened - transfer: ${transfer?.id}, costs: ${potentialCosts.length}`);
      addMobileDebugLog(`💰 [TRANSFER] ID: ${transfer?.id}, LinkedCostId: ${transfer?.linkedCostId || 'NONE'}`);
      
      setSelectedCost('');
      setSearchTerm('');
      setIsProcessing(false);
      setShowAll(false);
    }
  }, [isOpen, transfer, potentialCosts]);

  const filteredCosts = potentialCosts.filter(cost => 
    cost.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cost.date.includes(searchTerm)
  );

  // Show only first 5 transactions initially, unless user wants to see all or is searching
  const displayedCosts = searchTerm || showAll ? filteredCosts : filteredCosts.slice(0, 5);
  const hasMoreCosts = filteredCosts.length > 5 && !searchTerm && !showAll;

  const handleCover = async () => {
    console.log('🔵 [TÄCK KOSTNAD] Button clicked!', { transfer: transfer?.id, selectedCost, isProcessing });
    addMobileDebugLog(`🔵 [TÄCK KOSTNAD] Button clicked! transfer: ${transfer?.id}, selectedCost: ${selectedCost}`);
    addMobileDebugLog(`💰 [TRANSFER BEFORE] ID: ${transfer?.id}, LinkedCostId: ${transfer?.linkedCostId || 'NONE'}, Amount: ${transfer?.amount}`);
    
    // Find and log the selected cost transaction details
    const selectedCostTransaction = potentialCosts.find(c => c.id === selectedCost);
    if (selectedCostTransaction) {
      addMobileDebugLog(`💸 [COST BEFORE] ID: ${selectedCostTransaction.id}, LinkedCostId: ${selectedCostTransaction.linkedCostId || 'NONE'}, Amount: ${selectedCostTransaction.amount}`);
    }
    
    if (!transfer || !selectedCost || isProcessing) {
      console.log('🔴 [TÄCK KOSTNAD] Early return - missing data or processing');
      addMobileDebugLog(`🔴 [TÄCK KOSTNAD] Early return - transfer: ${!!transfer}, selectedCost: ${!!selectedCost}, isProcessing: ${isProcessing}`);
      return;
    }
    
    setIsProcessing(true);

    // STEP 1: Check if transfer already has an existing cost coverage link and remove it
    if (transfer.linkedCostId) {
      addMobileDebugLog('🗑️ [UNLINK EXISTING] Transfer already has a linkedCostId, removing existing link first');
      addMobileDebugLog(`🗑️ [UNLINK EXISTING] Removing link between transfer ${transfer.id} and existing cost ${transfer.linkedCostId}`);
      
      try {
        // Remove link from both the transfer and its currently linked cost
        await Promise.all([
          // Remove link from transfer
          updateTransactionMutation.mutateAsync({
            id: transfer.id,
            data: {
              type: 'Transaction',
              linkedCostId: null,
              correctedAmount: null,
              userDescription: '',
              isManuallyChanged: 'true'
            }
          }),
          // Remove link from existing cost
          updateTransactionMutation.mutateAsync({
            id: transfer.linkedCostId,
            data: {
              type: 'Transaction', 
              linkedCostId: null,
              correctedAmount: null,
              userDescription: '',
              isManuallyChanged: 'true'
            }
          })
        ]);
        
        addMobileDebugLog('✅ [UNLINK EXISTING] Successfully removed existing links');
      } catch (unlinkError) {
        addMobileDebugLog(`❌ [UNLINK EXISTING ERROR] Failed to remove existing links: ${unlinkError}`);
        setIsProcessing(false);
        return;
      }
    }


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
      
      addMobileDebugLog(`💸 [COST FOUND] Description: ${costTransaction.description}, ID: ${costTransaction.id}`);
      addMobileDebugLog(`💸 [COST DETAILS] Amount: ${costTransaction.amount}, LinkedCostId: ${costTransaction.linkedCostId || 'NONE'}`);

      console.log('Cost Transaction (ExpenseClaim):', costTransaction);


      // STEP 2: Check if the selected cost already has an existing cost coverage link and remove it
      if (costTransaction.linkedCostId) {
        addMobileDebugLog('🗑️ [UNLINK EXISTING COST] Selected cost already has a linkedCostId, removing existing link first');
        addMobileDebugLog(`🗑️ [UNLINK EXISTING COST] Removing link between cost ${costTransaction.id} and existing transfer ${costTransaction.linkedCostId}`);
        
        try {
          // Remove link from both the cost and its currently linked transfer
          await Promise.all([
            // Remove link from cost
            updateTransactionMutation.mutateAsync({
              id: costTransaction.id,
              data: {
                type: 'Transaction',
                linkedCostId: null,
                correctedAmount: null,
                userDescription: '',
                isManuallyChanged: 'true'
              }
            }),
            // Remove link from existing transfer
            updateTransactionMutation.mutateAsync({
              id: costTransaction.linkedCostId,
              data: {
                type: 'Transaction', 
                linkedCostId: null,
                correctedAmount: null,
                userDescription: '',
                isManuallyChanged: 'true'
              }
            })
          ]);
          
          addMobileDebugLog('✅ [UNLINK EXISTING COST] Successfully removed existing cost links');
        } catch (unlinkError) {
          addMobileDebugLog(`❌ [UNLINK EXISTING COST ERROR] Failed to remove existing cost links: ${unlinkError}`);
          setIsProcessing(false);
          return;
        }
      }

      // Get account names for descriptions
      const transferAccountName = getAccountNameById(transfer.accountId) || 'Unknown Account';
      const costAccountName = getAccountNameById(costTransaction.accountId) || 'Unknown Account';
      

      // Calculate corrected amount based on coverage
      // Use EFFECTIVE amounts (correctedAmount if exists, otherwise original amount)
        
      // Since we've removed any existing links above, both transactions should now be in their original state
      // Use original amounts for calculation
      const effectiveExpenseAmount = Math.abs(costTransaction.amount);
      const effectiveTransferAmount = Math.abs(transfer.amount);
      
      const expenseSource = `original(${costTransaction.amount})`;
      const transferSource = `original(${transfer.amount})`;
      
      
      // Calculate how much of the expense can be covered with available transfer amount
      const amountToCover = Math.min(effectiveExpenseAmount, effectiveTransferAmount);
      
      
      // Check if there's actually any amount to cover
      if (amountToCover <= 0) {
            
        // Show user-friendly message
        const message = effectiveTransferAmount === 0 
          ? 'Denna överföring har redan använts helt för att täcka andra kostnader. Du behöver antingen koppla ur den befintliga länkningen först, eller använda en annan överföring.'
          : 'Denna kostnad är redan helt täckt. Det finns inget kvar att betala.';
        
        alert(message);
        setIsProcessing(false);
        return;
      }
      
      // Calculate the NEW corrected amounts - since we unlinked existing connections, work from original amounts
      // For expense (negative): adding positive coverage amount moves toward 0 (less negative)
      const newCostCorrectedAmount = costTransaction.amount + amountToCover;
      
      // For transfer (positive): subtracting used amount reduces available amount
      const newTransferCorrectedAmount = transfer.amount - amountToCover;
      
  
      console.log('=== CALCULATION VALUES (after unlinking existing connections) ===');
      console.log('costTransaction.amount (original):', costTransaction.amount);
      console.log('transfer.amount (original):', transfer.amount);
      console.log('effectiveExpenseAmount (amount to cover):', effectiveExpenseAmount);
      console.log('effectiveTransferAmount (available to use):', effectiveTransferAmount);
      console.log('amountToCover:', amountToCover);
      console.log('newCostCorrectedAmount:', newCostCorrectedAmount);
      console.log('newTransferCorrectedAmount:', newTransferCorrectedAmount);


      // Link both transactions using API calls
        
      const costUpdate = {
        id: selectedCost,
        data: {
          type: 'ExpenseClaim',
          linkedCostId: transfer.id,  // Use linkedCostId instead of linkedTransactionId for cost coverage
          correctedAmount: Math.round(newCostCorrectedAmount), // Ensure it's an integer
          userDescription: `Utlägg täcks av betalning från ${transferAccountName}`,
          isManuallyChanged: 'true'
        }
      };
      

      const transferUpdate = {
        id: transfer.id,
        data: {
          type: 'CostCoverage',
          linkedCostId: selectedCost,  // Use linkedCostId instead of linkedTransactionId for cost coverage
          correctedAmount: Math.round(newTransferCorrectedAmount), // Ensure it's an integer
          userDescription: `Täcker utlägg från ${costAccountName}`,
          isManuallyChanged: 'true'
        }
      };
      

      console.log('=== API UPDATES ===');
      console.log('Cost Update:', costUpdate);
      console.log('Transfer Update:', transferUpdate);

        
      // Execute API calls with detailed error handling
      let costResult, transferResult;
      
      addMobileDebugLog('🚀 [API CALLS] Starting transaction updates...');
      addMobileDebugLog(`💸 [COST UPDATE] Will link to transfer: ${transfer.id}`);
      addMobileDebugLog(`💰 [TRANSFER UPDATE] Will link to cost: ${selectedCost}`);
      
      try {
        addMobileDebugLog('📡 [SQL SAVE 1] Starting cost transaction update...');
        costResult = await updateTransactionMutation.mutateAsync(costUpdate);
        addMobileDebugLog(`✅ [SQL SAVE 1] Cost transaction updated - ID: ${costResult?.id}, LinkedCostId: ${costResult?.linkedCostId}`);
      } catch (error) {
        addMobileDebugLog(`❌ [SQL SAVE 1] Cost transaction update FAILED: ${error}`);
        throw new Error(`Cost transaction update failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      try {
        addMobileDebugLog('📡 [SQL SAVE 2] Starting transfer transaction update...');
        transferResult = await updateTransactionMutation.mutateAsync(transferUpdate);
        addMobileDebugLog(`✅ [SQL SAVE 2] Transfer transaction updated - ID: ${transferResult?.id}, LinkedCostId: ${transferResult?.linkedCostId}`);
      } catch (error) {
        addMobileDebugLog(`❌ [SQL SAVE 2] Transfer transaction update FAILED: ${error}`);
        throw new Error(`Transfer transaction update failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      const results = [costResult, transferResult];

      console.log('=== API RESULTS ===');
      console.log('Cost Result:', results[0]);
      console.log('Transfer Result:', results[1]);
      
      addMobileDebugLog('✅ [FINAL RESULTS] Both transactions updated successfully!');
      addMobileDebugLog(`💸 [COST FINAL] ID: ${results[0]?.id}, LinkedCostId: ${results[0]?.linkedCostId}, CorrectedAmount: ${results[0]?.correctedAmount}`);
      addMobileDebugLog(`💰 [TRANSFER FINAL] ID: ${results[1]?.id}, LinkedCostId: ${results[1]?.linkedCostId}, CorrectedAmount: ${results[1]?.correctedAmount}`);


      // Trigger refresh if callback provided
      if (onRefresh) {
        addMobileDebugLog('🔄 [REFRESH] Calling onRefresh callback...');
        await onRefresh();
        addMobileDebugLog('✅ [REFRESH] onRefresh completed - UI will update with fresh data');
      }
      
      // Force reload transactions to ensure UI shows updated data
      try {
        addMobileDebugLog('🔄 [FORCE REFRESH] Forcing transaction reload...');
        const { forceReloadTransactions } = await import('../orchestrator/budgetOrchestrator');
        await forceReloadTransactions();
        addMobileDebugLog('✅ [FORCE REFRESH] Transaction reload completed');
      } catch (error) {
        addMobileDebugLog(`❌ [FORCE REFRESH] Failed: ${error}`);
      }
      
        
      addMobileDebugLog('🎉 [TÄCK KOSTNAD COMPLETE] Successfully linked transactions!');
      
      setIsProcessing(false);
      onClose();

    } catch (error) {
      addMobileDebugLog('❌ [ERROR] TÄCK KOSTNAD FAILED');
      addMobileDebugLog(`❌ [ERROR] Message: ${error instanceof Error ? error.message : String(error)}`);
      
      console.error('Error linking cost coverage:', error);
      
      // Show user-friendly error message
      alert(`Fel vid sparande till databas: ${error instanceof Error ? error.message : String(error)}`);
      
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
            Välj vilken negativ transaktion från samma konto som denna överföring ska betala av.
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
                
                // Log details about the newly selected cost
                const newSelectedCost = potentialCosts.find(c => c.id === value);
                if (newSelectedCost) {
                  addMobileDebugLog(`💸 [NEW SELECTION] Cost: ${newSelectedCost.description}, Amount: ${newSelectedCost.amount}, LinkedCostId: ${newSelectedCost.linkedCostId || 'NONE'}`);
                }
                
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
                        Konto: {getAccountNameById(cost.accountId) || 'Okänt konto'} • Kategori: {cost.appCategoryId || 'Okategoriserad'}
                        {cost.linkedCostId && (
                          <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                            Redan länkad (kommer att ändras)
                          </span>
                        )}
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
              {searchTerm ? 'Inga kostnader matchar sökningen.' : 'Inga negativa transaktioner hittades på samma konto.'}
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