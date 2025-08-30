import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DynamicIncomeSection } from "@/components/DynamicIncomeSection";

interface IncomeEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  budgetState: any;
  accounts: any[];
  budgetPosts: any[];
  monthlyBudget: any;
}

export function IncomeEditDialog({
  isOpen,
  onClose,
  selectedMonth,
  budgetState,
  accounts,
  budgetPosts,
  monthlyBudget
}: IncomeEditDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ändra intäkter</DialogTitle>
        </DialogHeader>
        
        <div className="mt-6">
          <DynamicIncomeSection
            monthKey={budgetState.selectedMonthKey}
            onIncomeUpdate={() => {
              // Trigger any necessary updates after income change
              console.log('Income updated');
            }}
          />
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Stäng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}