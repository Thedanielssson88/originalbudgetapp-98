import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatOrenAsCurrency } from "@/utils/currencyUtils";
import { IncomeEditDialog } from "./IncomeEditDialog";

interface ModernIncomeSectionProps {
  totalIncome: number; // in kronor (from calculateTotalIncomeFromBudgetPosts)
  selectedMonth: string;
  budgetState: any;
  accounts: any[];
  budgetPosts: any[];
  monthlyBudget: any;
}

export function ModernIncomeSection({
  totalIncome,
  selectedMonth,
  budgetState,
  accounts,
  budgetPosts,
  monthlyBudget
}: ModernIncomeSectionProps) {
  const [showIncomeDialog, setShowIncomeDialog] = useState(false);

  // Format the income amount (totalIncome is already in kronor from calculateTotalIncomeFromBudgetPosts)
  const formattedIncome = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalIncome).replace('SEK', 'kr');

  return (
    <>
      <Card className="p-6 mb-6 bg-green-50 border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-green-800 mb-1">
              Tillgänglig att tilldela
            </h2>
            <div className="text-3xl font-bold text-green-900">
              {formattedIncome}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIncomeDialog(true)}
            className="bg-white border-green-300 text-green-800 hover:bg-green-50"
          >
            Ändra intäkter
          </Button>
        </div>
      </Card>

      <IncomeEditDialog
        isOpen={showIncomeDialog}
        onClose={() => setShowIncomeDialog(false)}
        selectedMonth={selectedMonth}
        budgetState={budgetState}
        accounts={accounts}
        budgetPosts={budgetPosts}
        monthlyBudget={monthlyBudget}
      />
    </>
  );
}