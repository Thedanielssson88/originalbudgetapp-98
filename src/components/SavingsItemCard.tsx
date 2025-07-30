import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { BudgetGroup } from '../types/budget';

interface SavingsItemCardProps {
  group: BudgetGroup;
  actualAmount: number;
  onEdit: (group: BudgetGroup) => void;
  onDelete: (id: string) => void;
}

export const SavingsItemCard: React.FC<SavingsItemCardProps> = ({
  group,
  actualAmount,
  onEdit,
  onDelete
}) => {
  const difference = group.amount - actualAmount;
  const percentageUsed = group.amount > 0 ? (actualAmount / group.amount) * 100 : 0;

  return (
    <Card className="bg-green-50/50 border-green-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-green-900">{group.name}</h4>
              {group.account && (
                <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                  {group.account}
                </Badge>
              )}
              {group.financedFrom && (
                <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                  {group.financedFrom}
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Budget</div>
                <div className="font-semibold text-green-700">
                  {group.amount.toLocaleString()} kr
                </div>
              </div>
              
              <div>
                <div className="text-muted-foreground">Faktiskt</div>
                <div className="font-semibold text-green-600">
                  {actualAmount.toLocaleString()} kr
                </div>
              </div>
              
              <div>
                <div className="text-muted-foreground">Skillnad</div>
                <div className={`font-semibold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {difference >= 0 ? '+' : ''}{difference.toLocaleString()} kr
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 bg-green-100 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground min-w-[3rem]">
                {percentageUsed.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex gap-1 ml-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(group)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(group.id)}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};