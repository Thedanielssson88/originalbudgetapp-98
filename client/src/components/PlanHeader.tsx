import React, { useState } from 'react';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { MonthSelector } from './MonthSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DynamicIncomeSection } from './DynamicIncomeSection';
import { cn } from '@/lib/utils';

interface PlanHeaderProps {
  selectedMonth: string;
  totalIncome: number;
  totalCosts: number;
  totalSavings: number;
  onMonthChange?: (month: string) => void;
}

export function PlanHeader({ 
  selectedMonth, 
  totalIncome, 
  totalCosts, 
  totalSavings,
  onMonthChange
}: PlanHeaderProps) {
  const [viewMode, setViewMode] = useState<'categories' | 'spotlights'>('categories');
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);

  // Calculate available to assign (Lön - kostnader - sparande)
  const availableToAssign = totalIncome - totalCosts - totalSavings;

  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-4">
      {/* Top row: Month selector */}
      <div className="flex items-center justify-start">
        <MonthSelector
          selectedMonth={selectedMonth}
          onMonthChange={onMonthChange || (() => {})}
        />
      </div>

      {/* Second row: Categories/Spotlights selector (Premium YNAB style) */}
      <div className="inline-flex bg-gray-100 rounded-lg p-1 shadow-inner">
        <button
          onClick={() => setViewMode('categories')}
          className={cn(
            'relative px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-100',
            viewMode === 'categories'
              ? 'bg-white text-gray-900 shadow-md shadow-gray-200/50 transform scale-[1.02]'
              : 'bg-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50'
          )}
        >
          <span className="relative z-10">Categories</span>
        </button>
        <button
          onClick={() => setViewMode('spotlights')}
          className={cn(
            'relative px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ml-1',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-100',
            viewMode === 'spotlights'
              ? 'bg-white text-gray-900 shadow-md shadow-gray-200/50 transform scale-[1.02]'
              : 'bg-transparent text-gray-600 hover:text-gray-800 hover:bg-white/50'
          )}
        >
          <span className="relative z-10">All Accounts</span>
        </button>
      </div>

      {/* Third row: Lön card (Green like YNAB) - Clickable */}
      <Card 
        className="p-3 bg-green-50 border-green-200 shadow-sm cursor-pointer hover:bg-green-100 transition-colors"
        onClick={() => setIsIncomeDialogOpen(true)}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-green-800">Lön</h3>
          <p className="text-2xl font-bold text-green-800">
            {formatOrenAsCurrency(totalIncome)}
          </p>
        </div>
      </Card>

      {/* Fourth row: Tillgängligt att tilldela card (Yellow like YNAB) */}
      <Card className={cn(
        'p-3 shadow-sm',
        availableToAssign >= 0 
          ? 'bg-yellow-50 border-yellow-200' 
          : 'bg-red-50 border-red-200'
      )}>
        <div className="flex items-center justify-between">
          <h3 className={cn(
            'text-lg font-semibold',
            availableToAssign >= 0 ? 'text-yellow-800' : 'text-red-800'
          )}>
            Tillgängligt att tilldela
          </h3>
          <p className={cn(
            'text-2xl font-bold',
            availableToAssign >= 0 ? 'text-yellow-800' : 'text-red-800'
          )}>
            {formatOrenAsCurrency(availableToAssign)}
          </p>
        </div>
      </Card>

      {/* Income Dialog */}
      <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hantera inkomster</DialogTitle>
            <DialogDescription>
              Redigera inkomster för {selectedMonth}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <DynamicIncomeSection 
              monthKey={selectedMonth}
              onIncomeUpdate={() => {
                // Optional: Trigger refresh of parent data
                console.log('Income updated for', selectedMonth);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}