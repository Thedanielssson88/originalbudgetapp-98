import { useState, useEffect } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MonthSelectorProps {
  selectedMonth: string; // Format: "YYYY-MM"
  onMonthChange: (month: string) => void;
  availableMonths?: string[]; // Optional: specific months that have data
  minYear?: number;
  maxYear?: number;
}

const monthNames = [
  "Jan", "Feb", "Mar", "Apr",
  "Maj", "Jun", "Jul", "Aug",
  "Sep", "Okt", "Nov", "Dec"
];

const fullMonthNames = [
  "Januari", "Februari", "Mars", "April",
  "Maj", "Juni", "Juli", "Augusti",
  "September", "Oktober", "November", "December"
];

export function MonthSelector({
  selectedMonth,
  onMonthChange,
  availableMonths,
  minYear = 2020,
  maxYear = 2030,
}: MonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayYear, setDisplayYear] = useState<number>(new Date().getFullYear());
  
  // Parse selected month
  const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
  const selectedMonthName = fullMonthNames[selectedMonthNum - 1];
  
  // Update display year when selected month changes
  useEffect(() => {
    if (selectedYear) {
      setDisplayYear(selectedYear);
    }
  }, [selectedYear]);
  
  // Check if a month is available/selectable
  const isMonthAvailable = (year: number, month: number): boolean => {
    if (!availableMonths || availableMonths.length === 0) {
      // If no specific months provided, all are available
      return true;
    }
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    return availableMonths.includes(monthStr);
  };
  
  // Check if a month is in the future
  const isMonthInFuture = (year: number, month: number): boolean => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    
    if (year > currentYear) return true;
    if (year === currentYear && month > currentMonth) return true;
    return false;
  };
  
  const handleMonthClick = (month: number) => {
    const monthStr = `${displayYear}-${String(month).padStart(2, '0')}`;
    
    // Only allow selection if month is available and not in future
    if (isMonthAvailable(displayYear, month) && !isMonthInFuture(displayYear, month)) {
      onMonthChange(monthStr);
      setIsOpen(false);
    }
  };
  
  const handleYearChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && displayYear > minYear) {
      setDisplayYear(displayYear - 1);
    } else if (direction === 'next' && displayYear < maxYear) {
      setDisplayYear(displayYear + 1);
    }
  };
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto px-3 py-2 font-semibold text-base hover:bg-accent"
        >
          <span>{selectedMonthName} {selectedYear}</span>
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        {/* Year selector */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleYearChange('prev')}
            disabled={displayYear <= minYear}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-lg">{displayYear}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleYearChange('next')}
            disabled={displayYear >= maxYear}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Month grid */}
        <div className="grid grid-cols-4 gap-2">
          {monthNames.map((monthName, index) => {
            const monthNum = index + 1;
            const isSelected = displayYear === selectedYear && monthNum === selectedMonthNum;
            const isAvailable = isMonthAvailable(displayYear, monthNum);
            const isFuture = isMonthInFuture(displayYear, monthNum);
            const isDisabled = !isAvailable || isFuture;
            
            return (
              <button
                key={monthNum}
                onClick={() => handleMonthClick(monthNum)}
                disabled={isDisabled}
                className={cn(
                  "px-3 py-2 text-sm rounded-md transition-colors",
                  isSelected && "bg-primary text-primary-foreground font-semibold",
                  !isSelected && !isDisabled && "hover:bg-accent hover:text-accent-foreground",
                  isDisabled && "text-muted-foreground cursor-not-allowed opacity-50",
                  !isSelected && !isDisabled && "text-foreground"
                )}
              >
                {monthName}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}