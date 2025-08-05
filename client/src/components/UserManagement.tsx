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
import { useAccounts, useUpdateAccount } from '@/hooks/useAccounts';

export function UserManagement() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');

  // Hooks
  const { data: familyMembers, isLoading: familyMembersLoading } = useFamilyMembers();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const createFamilyMemberMutation = useCreateFamilyMember();
  const updateFamilyMemberMutation = useUpdateFamilyMember();
  const deleteFamilyMemberMutation = useDeleteFamilyMember();
  const updateAccountMutation = useUpdateAccount();

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
        role: newMemberRole || undefined
      });
      
      toast({
        title: "Framgång",
        description: `${newMemberName} har lagts till som familjemedlem`
      });
      
      setNewMemberName('');
      setNewMemberRole('');
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
          role: editingMember.role || undefined
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

  const handleAccountAssignment = async (accountId: string, assignedTo: string) => {
    try {
      await updateAccountMutation.mutateAsync({
        id: accountId,
        data: { assignedTo: assignedTo === 'Gemensamt' ? null : assignedTo }
      });
      
      toast({
        title: "Framgång",
        description: "Kontotilldelning har uppdaterats"
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera kontotilldelning",
        variant: "destructive"
      });
    }
  };

  if (familyMembersLoading || accountsLoading) {
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
                    <Label htmlFor="role">Roll (valfritt)</Label>
                    <Input
                      id="role"
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      placeholder="T.ex. Förälder, Barn"
                    />
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
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">{member.name}</div>
                        {member.role && (
                          <Badge variant="secondary" className="text-xs">
                            {member.role}
                          </Badge>
                        )}
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

      {/* Account Assignment Section */}
      <Card>
        <CardHeader>
          <CardTitle>Kontotilldelning</CardTitle>
          <CardDescription>
            Tilldela konton till specifika familjemedlemmar eller markera som gemensamma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts && accounts.length > 0 ? (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{account.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Saldo: {account.balance?.toLocaleString('sv-SE') || 0} kr
                    </div>
                  </div>
                  <div className="w-48">
                    <Select
                      value={account.assignedTo || 'Gemensamt'}
                      onValueChange={(value) => handleAccountAssignment(account.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Gemensamt">Gemensamt</SelectItem>
                        {familyMembers?.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>Inga konton har skapats ännu.</p>
            </div>
          )}
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
                <Label htmlFor="edit-role">Roll (valfritt)</Label>
                <Input
                  id="edit-role"
                  value={editingMember.role || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                />
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