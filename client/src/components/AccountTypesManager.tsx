import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAccountTypes, useCreateAccountType, useUpdateAccountType, useDeleteAccountType } from "@/hooks/useAccountTypes";
import { Edit, Trash2, Plus } from "lucide-react";

const AccountTypesManager = () => {
  const { data: accountTypes = [], isLoading } = useAccountTypes();
  const createAccountTypeMutation = useCreateAccountType();
  const updateAccountTypeMutation = useUpdateAccountType();
  const deleteAccountTypeMutation = useDeleteAccountType();

  // New account type states
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDescription, setNewTypeDescription] = useState("");
  
  // Edit account type states
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeDescription, setEditTypeDescription] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleCreateAccountType = async () => {
    if (!newTypeName.trim()) return;

    console.log("Creating account type:", { 
      name: newTypeName.trim(), 
      description: newTypeDescription.trim() || null 
    });

    try {
      const result = await createAccountTypeMutation.mutateAsync({
        name: newTypeName.trim(),
        description: newTypeDescription.trim() || null,
        // Remove userId - the API will add it automatically
      });
      
      console.log("Account type created successfully:", result);
      setNewTypeName("");
      setNewTypeDescription("");
    } catch (error) {
      console.error("Failed to create account type:", error);
      // Show the error to the user
      alert(`Fel vid skapande av kontotyp: ${error.message || error}`);
    }
  };

  const handleEditAccountType = (accountType: any) => {
    setEditingType(accountType.id);
    setEditTypeName(accountType.name);
    setEditTypeDescription(accountType.description || "");
    setEditDialogOpen(true);
  };

  const handleUpdateAccountType = async () => {
    if (!editingType || !editTypeName.trim()) return;

    try {
      await updateAccountTypeMutation.mutateAsync({
        id: editingType,
        data: {
          name: editTypeName.trim(),
          description: editTypeDescription.trim() || null,
        },
      });
      
      setEditDialogOpen(false);
      setEditingType(null);
      setEditTypeName("");
      setEditTypeDescription("");
    } catch (error) {
      console.error("Failed to update account type:", error);
    }
  };

  const handleDeleteAccountType = async (id: string) => {
    if (!confirm("Är du säker på att du vill ta bort denna kontotyp?")) return;

    try {
      await deleteAccountTypeMutation.mutateAsync(id);
    } catch (error) {
      console.error("Failed to delete account type:", error);
    }
  };

  // Remove the blocking loading state - show the form even while loading

  return (
    <div className="space-y-6">
      {/* Create new account type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Lägg till ny kontotyp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-type-name">Namn</Label>
            <Input
              id="account-type-name"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="T.ex. Sparkonto, Transactionskonto, Kreditkonto"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-type-description">Beskrivning (valfritt)</Label>
            <Textarea
              id="account-type-description"
              value={newTypeDescription}
              onChange={(e) => setNewTypeDescription(e.target.value)}
              placeholder="Beskrivning av kontotypen..."
              rows={3}
            />
          </div>
          <Button 
            onClick={handleCreateAccountType}
            disabled={!newTypeName.trim() || createAccountTypeMutation.isPending}
          >
            {createAccountTypeMutation.isPending ? "Skapar..." : "Skapa kontotyp"}
          </Button>
        </CardContent>
      </Card>

      {/* List existing account types */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Befintliga kontotyper</h3>
        
        {isLoading ? (
          <Alert>
            <AlertDescription>
              Laddar kontotyper...
            </AlertDescription>
          </Alert>
        ) : accountTypes.length === 0 ? (
          <Alert>
            <AlertDescription>
              Inga kontotyper har skapats än. Skapa din första kontotyp för att kategorisera dina konton.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {accountTypes.map((accountType) => (
              <Card key={accountType.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{accountType.name}</h4>
                      {accountType.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {accountType.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Skapad: {new Date(accountType.createdAt).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditAccountType(accountType)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteAccountType(accountType.id)}
                        disabled={deleteAccountTypeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera kontotyp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-account-type-name">Namn</Label>
              <Input
                id="edit-account-type-name"
                value={editTypeName}
                onChange={(e) => setEditTypeName(e.target.value)}
                placeholder="Namn på kontotyp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-account-type-description">Beskrivning (valfritt)</Label>
              <Textarea
                id="edit-account-type-description"
                value={editTypeDescription}
                onChange={(e) => setEditTypeDescription(e.target.value)}
                placeholder="Beskrivning av kontotypen..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Avbryt
              </Button>
              <Button
                onClick={handleUpdateAccountType}
                disabled={!editTypeName.trim() || updateAccountTypeMutation.isPending}
              >
                {updateAccountTypeMutation.isPending ? "Sparar..." : "Spara ändringar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountTypesManager;