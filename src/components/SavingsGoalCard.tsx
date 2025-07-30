import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import { SavingsGoal } from '../types/budget';

interface SavingsGoalCardProps {
  goal: SavingsGoal;
  currentAmount: number;
}

export const SavingsGoalCard: React.FC<SavingsGoalCardProps> = ({
  goal,
  currentAmount
}) => {
  const progress = goal.targetAmount > 0 ? (currentAmount / goal.targetAmount) * 100 : 0;
  const monthlyTarget = goal.targetAmount / 12; // Simplified monthly calculation
  
  return (
    <Card className="bg-blue-50/50 border-blue-200">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Target className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-blue-900">{goal.name}</h4>
              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                {goal.accountId}
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground mb-3">
              {goal.startDate} - {goal.endDate}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <div className="text-muted-foreground">Målbelopp</div>
                <div className="font-semibold text-blue-700">
                  {goal.targetAmount.toLocaleString()} kr
                </div>
              </div>
              
              <div>
                <div className="text-muted-foreground">Per månad</div>
                <div className="font-semibold text-blue-600">
                  {monthlyTarget.toLocaleString()} kr
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Framsteg</span>
                <span className="font-medium">
                  {currentAmount.toLocaleString()} kr / {goal.targetAmount.toLocaleString()} kr
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-blue-100 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground min-w-[3rem]">
                  {progress.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};