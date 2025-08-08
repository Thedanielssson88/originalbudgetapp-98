import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { kronoraToOren, orenToKronor } from '@/utils/currencyUtils';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useInkomstkallor, useInkomstkallorMedlem } from '@/hooks/useInkomstkallor';
import { useBudgetPosts, useCreateBudgetPost, useUpdateBudgetPost } from '@/hooks/useBudgetPosts';
import type { FamilyMember, Inkomstkall, InkomstkallorMedlem, BudgetPost } from '@shared/schema';

interface DynamicIncomeSectionProps {
  monthKey: string;
  onIncomeUpdate?: () => void;
}

export const DynamicIncomeSection: React.FC<DynamicIncomeSectionProps> = ({
  monthKey,
  onIncomeUpdate
}) => {
  const { data: familyMembers } = useFamilyMembers();
  const { data: inkomstkallor } = useInkomstkallor();
  const { data: assignments } = useInkomstkallorMedlem();
  const { data: budgetPosts } = useBudgetPosts(monthKey);
  
  const createBudgetPostMutation = useCreateBudgetPost();
  const updateBudgetPostMutation = useUpdateBudgetPost();
  
  const [localIncomeValues, setLocalIncomeValues] = useState<Record<string, string>>({});

  // Filter family members who contribute to budget
  const contributingMembers = familyMembers?.filter(m => m.contributesToBudget) || [];

  // Get enabled income sources for a family member
  const getEnabledIncomeSources = (memberId: string): Inkomstkall[] => {
    if (!assignments || !inkomstkallor) return [];
    
    const memberAssignments = assignments.filter(a => 
      a.familjemedlemId === memberId && a.isEnabled
    );
    
    return inkomstkallor.filter(source => 
      memberAssignments.some(a => a.idInkomstkalla === source.id)
    );
  };

  // Get or create budget post for a specific income source and member
  const getIncomeBudgetPost = (memberId: string, sourceId: string): BudgetPost | undefined => {
    return budgetPosts?.find(post => 
      post.type === 'Inkomst' &&
      post.familjemedlemId === memberId &&
      post.idInkomstkalla === sourceId &&
      post.monthKey === monthKey
    );
  };

  // Initialize local values from budget posts
  useEffect(() => {
    if (!budgetPosts) return;
    
    const values: Record<string, string> = {};
    contributingMembers.forEach(member => {
      const sources = getEnabledIncomeSources(member.id);
      sources.forEach(source => {
        const post = getIncomeBudgetPost(member.id, source.id);
        const key = `${member.id}-${source.id}`;
        values[key] = post ? orenToKronor(post.amount).toString() : '';
      });
    });
    setLocalIncomeValues(values);
  }, [budgetPosts, familyMembers, assignments, inkomstkallor]);

  const handleIncomeChange = (memberId: string, sourceId: string, value: string) => {
    const key = `${memberId}-${sourceId}`;
    setLocalIncomeValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleIncomeBlur = async (member: FamilyMember, source: Inkomstkall, value: string) => {
    const sekValue = Number(value) || 0;
    const oreValue = kronoraToOren(sekValue);
    
    const existingPost = getIncomeBudgetPost(member.id, source.id);
    
    try {
      if (existingPost) {
        // Update existing budget post
        await updateBudgetPostMutation.mutateAsync({
          id: existingPost.id,
          data: { amount: oreValue }
        });
      } else if (oreValue > 0) {
        // Create new budget post only if amount is greater than 0
        await createBudgetPostMutation.mutateAsync({
          monthKey,
          type: 'Inkomst',
          description: `${member.name} - ${source.text}`,
          amount: oreValue,
          familjemedlemId: member.id,
          idInkomstkalla: source.id,
          budgetType: 'Inkomst',
          transactionType: 'Inkomst',
          financedFrom: 'Löpande kostnad'
        });
      }
      
      if (onIncomeUpdate) {
        onIncomeUpdate();
      }
    } catch (error) {
      console.error('Failed to update income:', error);
    }
  };

  // Calculate total income for display
  const calculateTotalIncome = (): number => {
    let total = 0;
    contributingMembers.forEach(member => {
      const sources = getEnabledIncomeSources(member.id);
      sources.forEach(source => {
        const key = `${member.id}-${source.id}`;
        const value = Number(localIncomeValues[key]) || 0;
        total += value;
      });
    });
    return total;
  };

  if (!contributingMembers.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>Inga familjemedlemmar som bidrar till budgeten har lagts till.</p>
        <p className="text-sm">Gå till Inställningar för att lägga till familjemedlemmar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {contributingMembers.map(member => {
        const sources = getEnabledIncomeSources(member.id);
        
        if (sources.length === 0) {
          return null;
        }
        
        return (
          <div key={member.id} className="p-4 bg-green-100/50 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold mb-3 text-green-800">{member.name} Inkomst</h3>
            <div className="space-y-3">
              {sources.map(source => {
                const key = `${member.id}-${source.id}`;
                const value = localIncomeValues[key] || '';
                
                return (
                  <div key={source.id} className="space-y-2">
                    <Label htmlFor={key} className="text-green-700">
                      {source.text}
                    </Label>
                    <Input
                      id={key}
                      type="number"
                      placeholder={`Ange ${source.text.toLowerCase()}`}
                      value={value}
                      onChange={(e) => handleIncomeChange(member.id, source.id, e.target.value)}
                      onBlur={(e) => handleIncomeBlur(member, source, e.target.value)}
                      className="text-lg bg-white/70"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      
      {contributingMembers.length > 0 && (
        <div className="pt-4 border-t border-green-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-green-700">Total inkomst:</span>
            <span className="text-lg font-semibold text-green-800">
              {calculateTotalIncome().toLocaleString('sv-SE')} kr
            </span>
          </div>
        </div>
      )}
    </div>
  );
};