import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, DollarSign, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import {
  useInkomstkallor,
  useCreateInkomstkall,
  useUpdateInkomstkall,
  useDeleteInkomstkall,
  useInkomstkallorMedlem,
  useCreateInkomstkallorMedlem,
  useUpdateInkomstkallorMedlem,
  useDeleteInkomstkallorMedlem
} from '@/hooks/useInkomstkallor';

const DEFAULT_INCOME_SOURCES = [
  'Lön',
  'Försäkringskassan',
  'Barnbidrag',
  'CSN',
  'Pension',
  'Bostadsbidrag',
  'Övriga inkomster'
];

export function IncomeSourcesManagement() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSourceText, setNewSourceText] = useState('');
  const [initializingDefaults, setInitializingDefaults] = useState(false);

  // Hooks
  const { data: familyMembers, isLoading: familyMembersLoading } = useFamilyMembers();
  const { data: inkomstkallor, isLoading: inkomstkallorLoading } = useInkomstkallor();
  const { data: assignments, isLoading: assignmentsLoading } = useInkomstkallorMedlem();
  
  const createInkomstkallMutation = useCreateInkomstkall();
  const updateInkomstkallMutation = useUpdateInkomstkall();
  const deleteInkomstkallMutation = useDeleteInkomstkall();
  
  const createAssignmentMutation = useCreateInkomstkallorMedlem();
  const updateAssignmentMutation = useUpdateInkomstkallorMedlem();
  const deleteAssignmentMutation = useDeleteInkomstkallorMedlem();

  // Filter family members who contribute to budget
  const contributingMembers = familyMembers?.filter(m => m.contributesToBudget) || [];

  // Initialize default income sources if none exist
  useEffect(() => {
    if (!inkomstkallorLoading && inkomstkallor && inkomstkallor.length === 0 && !initializingDefaults) {
      initializeDefaultSources();
    }
  }, [inkomstkallor, inkomstkallorLoading]);

  const initializeDefaultSources = async () => {
    setInitializingDefaults(true);
    try {
      for (const sourceText of DEFAULT_INCOME_SOURCES) {
        await createInkomstkallMutation.mutateAsync({
          text: sourceText,
          isDefault: true
        });
      }
      toast({
        title: "Framgång",
        description: "Standard inkomstkällor har skapats"
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte skapa standard inkomstkällor",
        variant: "destructive"
      });
    } finally {
      setInitializingDefaults(false);
    }
  };

  const handleCreateSource = async () => {
    if (!newSourceText.trim()) {
      toast({
        title: "Fel",
        description: "Namn på inkomstkälla måste anges",
        variant: "destructive"
      });
      return;
    }

    try {
      await createInkomstkallMutation.mutateAsync({
        text: newSourceText.trim(),
        isDefault: false
      });
      
      toast({
        title: "Framgång",
        description: `${newSourceText} har lagts till`
      });
      
      setNewSourceText('');
      setIsAddDialogOpen(false);
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte skapa inkomstkälla",
        variant: "destructive"
      });
    }
  };

  const handleDeleteSource = async (source: any) => {
    if (!confirm(`Är du säker på att du vill ta bort ${source.text}?`)) {
      return;
    }

    try {
      await deleteInkomstkallMutation.mutateAsync(source.id);
      
      toast({
        title: "Framgång",
        description: `${source.text} har tagits bort`
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort inkomstkälla",
        variant: "destructive"
      });
    }
  };

  const handleToggleAssignment = async (memberId: string, sourceId: string, currentAssignment: any) => {
    try {
      if (currentAssignment) {
        // Toggle the enabled state
        await updateAssignmentMutation.mutateAsync({
          id: currentAssignment.id,
          data: { isEnabled: !currentAssignment.isEnabled }
        });
      } else {
        // Create new assignment
        await createAssignmentMutation.mutateAsync({
          familjemedlemId: memberId,
          idInkomstkalla: sourceId,
          isEnabled: true
        });
      }
      
      toast({
        title: "Framgång",
        description: "Inställning uppdaterad"
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera inställning",
        variant: "destructive"
      });
    }
  };

  const getAssignment = (memberId: string, sourceId: string) => {
    return assignments?.find(a => 
      a.familjemedlemId === memberId && 
      a.idInkomstkalla === sourceId
    );
  };

  if (familyMembersLoading || inkomstkallorLoading || assignmentsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Inkomstkällor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>Laddar...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Inkomstkällor
        </CardTitle>
        <CardDescription>
          Hantera olika inkomstkällor och tilldela dem till familjemedlemmar som bidrar till budgeten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Income Source Button */}
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium">Tillgängliga inkomstkällor</h3>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <Button
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Lägg till inkomstkälla
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Lägg till inkomstkälla</DialogTitle>
                <DialogDescription>
                  Skapa en ny inkomstkälla som kan tilldelas till familjemedlemmar.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="source-name">Namn på inkomstkälla</Label>
                  <Input
                    id="source-name"
                    value={newSourceText}
                    onChange={(e) => setNewSourceText(e.target.value)}
                    placeholder="T.ex. Konsultuppdrag, Aktieutdelning"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Avbryt
                </Button>
                <Button onClick={handleCreateSource} disabled={createInkomstkallMutation.isPending}>
                  {createInkomstkallMutation.isPending ? 'Skapar...' : 'Skapa'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Income Sources List */}
        {inkomstkallor && inkomstkallor.length > 0 ? (
          <div className="space-y-4">
            {inkomstkallor.map((source) => (
              <div key={source.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{source.text}</span>
                    {source.isDefault && (
                      <Badge variant="secondary">Standard</Badge>
                    )}
                  </div>
                  {!source.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSource(source)}
                      disabled={deleteInkomstkallMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Member assignments for this income source */}
                {contributingMembers.length > 0 && (
                  <div className="space-y-2 pt-3 border-t">
                    <div className="text-xs text-muted-foreground mb-2">
                      Aktivera för familjemedlemmar:
                    </div>
                    <div className="grid gap-2">
                      {contributingMembers.map((member) => {
                        const assignment = getAssignment(member.id, source.id);
                        const isEnabled = assignment?.isEnabled || false;
                        
                        return (
                          <div key={member.id} className="flex items-center justify-between">
                            <Label 
                              htmlFor={`${source.id}-${member.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {member.name}
                            </Label>
                            <Switch
                              id={`${source.id}-${member.id}`}
                              checked={isEnabled}
                              onCheckedChange={() => handleToggleAssignment(member.id, source.id, assignment)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Inga inkomstkällor har lagts till ännu.</p>
            <p className="text-sm">Klicka på knappen ovan för att lägga till inkomstkällor.</p>
          </div>
        )}

        {contributingMembers.length === 0 && (
          <div className="bg-muted/50 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Inga bidragande familjemedlemmar</p>
                <p>Lägg till familjemedlemmar som bidrar till budgeten för att kunna tilldela inkomstkällor.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}