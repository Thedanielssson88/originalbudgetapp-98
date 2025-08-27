import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, User } from 'lucide-react';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';
import { ImportedTransaction } from '@/types/transaction';

interface UtbetalningLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ImportedTransaction;
}

export const UtbetalningLinkDialog: React.FC<UtbetalningLinkDialogProps> = ({
  isOpen,
  onClose,
  transaction,
}) => {
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState<string>('');
  const { data: familyMembers = [] } = useFamilyMembers();
  const updateTransactionMutation = useUpdateTransaction();
  const { toast } = useToast();

  const handleLinkUtbetalning = () => {
    if (!selectedFamilyMemberId) {
      toast({
        title: 'Välj familjemedlem',
        description: 'Du måste välja en familjemedlem att koppla utbetalningen till.',
        variant: 'destructive',
      });
      return;
    }

    const selectedMember = familyMembers.find(member => member.id === selectedFamilyMemberId);
    
    updateTransactionMutation.mutate({
      id: transaction.id,
      data: {
        linkedPerson: selectedFamilyMemberId,
        isManuallyChanged: 'true'
      }
    }, {
      onSuccess: () => {
        toast({
          title: 'Utbetalning kopplad',
          description: `Utbetalningen har kopplats till ${selectedMember?.name || 'vald familjemedlem'}.`,
        });
        onClose();
        setSelectedFamilyMemberId('');
      },
      onError: (error) => {
        toast({
          title: 'Fel',
          description: 'Kunde inte koppla utbetalningen. Försök igen.',
          variant: 'destructive',
        });
        console.error('Failed to link utbetalning:', error);
      }
    });
  };

  const handleClose = () => {
    setSelectedFamilyMemberId('');
    onClose();
  };

  const linkedMember = transaction.linkedPerson 
    ? familyMembers.find(member => member.id === transaction.linkedPerson)
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Koppla Utbetalning
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Välj vilken familjemedlem denna utbetalning är till:
          </div>

          {linkedMember && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <User className="h-4 w-4" />
                Redan kopplad till: <strong>{linkedMember.name}</strong>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Familjemedlem:</label>
            <Select value={selectedFamilyMemberId} onValueChange={setSelectedFamilyMemberId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Välj familjemedlem" />
              </SelectTrigger>
              <SelectContent>
                {familyMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Avbryt
            </Button>
            <Button onClick={handleLinkUtbetalning} disabled={!selectedFamilyMemberId}>
              Koppla Utbetalning
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};