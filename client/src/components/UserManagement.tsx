import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Edit, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { useFamilyMembers, useCreateFamilyMember, useUpdateFamilyMember, useDeleteFamilyMember } from '@/hooks/useFamilyMembers';
import { useMonthlyBudget } from '@/hooks/useMonthlyBudget';
import { useBudget } from '@/hooks/useBudget';
import { apiStore } from '@/store/apiStore';
import { useQueryClient } from '@tanstack/react-query';

export function UserManagement() {
  const { toast } = useToast();
  const { budgetState } = useBudget();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'adult' | 'child'>('adult');
  const [newMemberContributesToBudget, setNewMemberContributesToBudget] = useState<boolean>(true);

  // Hooks
  const { data: familyMembers, isLoading: familyMembersLoading } = useFamilyMembers();
  const { monthlyBudget, isLoading: monthlyBudgetLoading, updateIncome } = useMonthlyBudget(budgetState.selectedMonthKey);
  const createFamilyMemberMutation = useCreateFamilyMember();
  const updateFamilyMemberMutation = useUpdateFamilyMember();
  const deleteFamilyMemberMutation = useDeleteFamilyMember();

  const handleCreateFamilyMember = async () => {
    if (!newMemberName.trim()) {
      toast({
        title: "Fel",
        description: "Namn måste anges",
        variant: "destructive"
      });
      return;
    }

    try {
      await createFamilyMemberMutation.mutateAsync({
        name: newMemberName.trim(),
        role: newMemberRole,
        contributesToBudget: newMemberContributesToBudget
      });
      
      toast({
        title: "Framgång",
        description: `${newMemberName} har lagts till som familjemedlem`
      });
      
      setNewMemberName('');
      setNewMemberRole('adult');
      setNewMemberContributesToBudget(true);
      setIsAddDialogOpen(false);
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte skapa familjemedlem",
        variant: "destructive"
      });
    }
  };

  const handleUpdateFamilyMember = async () => {
    if (!editingMember || !editingMember.name.trim()) {
      toast({
        title: "Fel", 
        description: "Namn måste anges",
        variant: "destructive"
      });
      return;
    }

    try {
      await updateFamilyMemberMutation.mutateAsync({
        id: editingMember.id,
        data: {
          name: editingMember.name.trim(),
          role: editingMember.role,
          contributesToBudget: editingMember.contributesToBudget
        }
      });
      
      toast({
        title: "Framgång",
        description: `${editingMember.name} har uppdaterats`
      });
      
      setEditingMember(null);
      setIsEditDialogOpen(false);
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera familjemedlem",
        variant: "destructive"
      });
    }
  };

  const handleDeleteFamilyMember = async (member: any) => {
    if (!confirm(`Är du säker på att du vill ta bort ${member.name}?`)) {
      return;
    }

    try {
      await deleteFamilyMemberMutation.mutateAsync(member.id);
      
      toast({
        title: "Framgång",
        description: `${member.name} har tagits bort`
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort familjemedlem",
        variant: "destructive"
      });
    }
  };


  const handlePrimaryUserSelection = async (familyMemberId: string | null) => {
    if (!monthlyBudget) return;
    
    try {
      // Use the apiStore directly to update the monthly budget
      await apiStore.updateMonthlyBudget(budgetState.selectedMonthKey, { 
        primaryUserId: familyMemberId 
      });
      
      // Refresh the monthly budget data to update UI immediately
      await refreshMonthlyBudget();
      
      // Invalidate React Query cache to trigger UI updates
      queryClient.invalidateQueries({ queryKey: ['/api/monthly-budgets'] });
      
      const selectedMember = familyMembers?.find(m => m.id === familyMemberId);
      toast({
        title: "Framgång",
        description: `Användare 1 uppdaterad till ${selectedMember?.name || 'Ingen'}`
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera Användare 1",
        variant: "destructive"
      });
    }
  };

  const handleSecondaryUserSelection = async (familyMemberId: string | null) => {
    if (!monthlyBudget) return;
    
    try {
      // Use the apiStore directly to update the monthly budget
      await apiStore.updateMonthlyBudget(budgetState.selectedMonthKey, { 
        secondaryUserId: familyMemberId 
      });
      
      // Refresh the monthly budget data to update UI immediately
      await refreshMonthlyBudget();
      
      // Invalidate React Query cache to trigger UI updates
      queryClient.invalidateQueries({ queryKey: ['/api/monthly-budgets'] });
      
      const selectedMember = familyMembers?.find(m => m.id === familyMemberId);
      toast({
        title: "Framgång",
        description: `Användare 2 uppdaterad till ${selectedMember?.name || 'Ingen'}`
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera Användare 2",
        variant: "destructive"
      });
    }
  };

  if (familyMembersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Användarhantering
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>Laddar...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Family Members Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Familjemedlemmar
          </CardTitle>
          <CardDescription>
            Hantera familjemedlemmar som kan tilldelas konton och användas i budgetberäkningar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Add Family Member Button */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Lägg till familjemedlem
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Lägg till familjemedlem</DialogTitle>
                  <DialogDescription>
                    Skapa en ny familjemedlem som kan tilldelas konton.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Namn</Label>
                    <Input
                      id="name"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="T.ex. Andreas, Susanna, Alicia"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="role">Roll</Label>
                    <Select value={newMemberRole} onValueChange={(value: 'adult' | 'child') => setNewMemberRole(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj roll" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adult">Vuxen</SelectItem>
                        <SelectItem value="child">Barn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="contributesToBudget">Bidrar till budgeten</Label>
                    <Select value={newMemberContributesToBudget ? 'yes' : 'no'} onValueChange={(value) => setNewMemberContributesToBudget(value === 'yes')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj bidrag" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Ja</SelectItem>
                        <SelectItem value="no">Nej</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Avbryt
                  </Button>
                  <Button onClick={handleCreateFamilyMember} disabled={createFamilyMemberMutation.isPending}>
                    {createFamilyMemberMutation.isPending ? 'Skapar...' : 'Skapa'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Family Members List */}
            {familyMembers && familyMembers.length > 0 ? (
              <div className="grid gap-3">
                {familyMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="font-medium text-lg">{member.name}</div>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant={member.role === 'adult' ? 'default' : 'secondary'}>
                            {member.role === 'adult' ? 'Vuxen' : 'Barn'}
                          </Badge>
                          <Badge variant={member.contributesToBudget ? 'default' : 'outline'}>
                            {member.contributesToBudget ? 'Bidrar till budgeten' : 'Bidrar ej till budgeten'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingMember(member);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteFamilyMember(member)}
                        disabled={deleteFamilyMemberMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Inga familjemedlemmar har lagts till ännu.</p>
                <p className="text-sm">Lägg till familjemedlemmar för att tilldela konton till specifika personer.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>



      {/* Edit Family Member Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera familjemedlem</DialogTitle>
            <DialogDescription>
              Uppdatera information för familjemedlem.
            </DialogDescription>
          </DialogHeader>
          {editingMember && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Namn</Label>
                <Input
                  id="edit-name"
                  value={editingMember.name}
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-role">Roll</Label>
                <Select value={editingMember.role} onValueChange={(value: 'adult' | 'child') => setEditingMember({ ...editingMember, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj roll" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adult">Vuxen</SelectItem>
                    <SelectItem value="child">Barn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit-contributesToBudget">Bidrar till budgeten</Label>
                <Select value={editingMember.contributesToBudget ? 'yes' : 'no'} onValueChange={(value) => setEditingMember({ ...editingMember, contributesToBudget: value === 'yes' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj bidrag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Ja</SelectItem>
                    <SelectItem value="no">Nej</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleUpdateFamilyMember} disabled={updateFamilyMemberMutation.isPending}>
              {updateFamilyMemberMutation.isPending ? 'Uppdaterar...' : 'Uppdatera'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}