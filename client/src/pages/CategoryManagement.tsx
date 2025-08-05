import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useHuvudkategorier,
  useUnderkategorier,
  useCreateHuvudkategori,
  useUpdateHuvudkategori,
  useDeleteHuvudkategori,
  useCreateUnderkategori,
  useUpdateUnderkategori,
  useDeleteUnderkategori,
} from '@/hooks/useCategories';
import type { Huvudkategori, Underkategori } from '@shared/schema';

const huvudkategoriSchema = z.object({
  name: z.string().min(1, 'Namn krävs'),
  description: z.string().optional(),
});

const underkategoriSchema = z.object({
  name: z.string().min(1, 'Namn krävs'),
  huvudkategoriId: z.string().min(1, 'Huvudkategori krävs'),
  description: z.string().optional(),
});

type HuvudkategoriFormData = z.infer<typeof huvudkategoriSchema>;
type UnderkategoriFormData = z.infer<typeof underkategoriSchema>;

export default function CategoryManagement() {
  const { toast } = useToast();
  const [selectedHuvudkategori, setSelectedHuvudkategori] = useState<string | null>(null);
  const [editingHuvudkategori, setEditingHuvudkategori] = useState<Huvudkategori | null>(null);
  const [editingUnderkategori, setEditingUnderkategori] = useState<Underkategori | null>(null);
  const [showHuvudkategoriDialog, setShowHuvudkategoriDialog] = useState(false);
  const [showUnderkategoriDialog, setShowUnderkategoriDialog] = useState(false);

  // Queries
  const { data: huvudkategorier = [], isLoading: isLoadingHuvud } = useHuvudkategorier();
  const { data: underkategorier = [], isLoading: isLoadingUnder } = useUnderkategorier();

  // Mutations
  const createHuvudkategori = useCreateHuvudkategori();
  const updateHuvudkategori = useUpdateHuvudkategori();
  const deleteHuvudkategori = useDeleteHuvudkategori();
  const createUnderkategori = useCreateUnderkategori();
  const updateUnderkategori = useUpdateUnderkategori();
  const deleteUnderkategori = useDeleteUnderkategori();

  // Forms
  const huvudkategoriForm = useForm<HuvudkategoriFormData>({
    resolver: zodResolver(huvudkategoriSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const underkategoriForm = useForm<UnderkategoriFormData>({
    resolver: zodResolver(underkategoriSchema),
    defaultValues: {
      name: '',
      huvudkategoriId: '',
      description: '',
    },
  });

  // Handlers
  const handleHuvudkategoriSubmit = async (data: HuvudkategoriFormData) => {
    try {
      if (editingHuvudkategori) {
        await updateHuvudkategori.mutateAsync({
          id: editingHuvudkategori.id,
          data,
        });
        toast({
          title: 'Huvudkategori uppdaterad',
          description: 'Huvudkategorin har uppdaterats.',
        });
      } else {
        await createHuvudkategori.mutateAsync(data);
        toast({
          title: 'Huvudkategori skapad',
          description: 'En ny huvudkategori har skapats.',
        });
      }
      setShowHuvudkategoriDialog(false);
      setEditingHuvudkategori(null);
      huvudkategoriForm.reset();
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte spara huvudkategorin.',
        variant: 'destructive',
      });
    }
  };

  const handleUnderkategoriSubmit = async (data: UnderkategoriFormData) => {
    try {
      if (editingUnderkategori) {
        await updateUnderkategori.mutateAsync({
          id: editingUnderkategori.id,
          data,
        });
        toast({
          title: 'Underkategori uppdaterad',
          description: 'Underkategorin har uppdaterats.',
        });
      } else {
        await createUnderkategori.mutateAsync(data);
        toast({
          title: 'Underkategori skapad',
          description: 'En ny underkategori har skapats.',
        });
      }
      setShowUnderkategoriDialog(false);
      setEditingUnderkategori(null);
      underkategoriForm.reset();
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte spara underkategorin.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteHuvudkategori = async (id: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna huvudkategori och alla dess underkategorier?')) {
      return;
    }

    try {
      await deleteHuvudkategori.mutateAsync(id);
      toast({
        title: 'Huvudkategori borttagen',
        description: 'Huvudkategorin och dess underkategorier har tagits bort.',
      });
      if (selectedHuvudkategori === id) {
        setSelectedHuvudkategori(null);
      }
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte ta bort huvudkategorin.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUnderkategori = async (id: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna underkategori?')) {
      return;
    }

    try {
      await deleteUnderkategori.mutateAsync(id);
      toast({
        title: 'Underkategori borttagen',
        description: 'Underkategorin har tagits bort.',
      });
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte ta bort underkategorin.',
        variant: 'destructive',
      });
    }
  };

  const openEditHuvudkategori = (kategori: Huvudkategori) => {
    setEditingHuvudkategori(kategori);
    huvudkategoriForm.reset({
      name: kategori.name,
      description: kategori.description || '',
    });
    setShowHuvudkategoriDialog(true);
  };

  const openEditUnderkategori = (kategori: Underkategori) => {
    setEditingUnderkategori(kategori);
    underkategoriForm.reset({
      name: kategori.name,
      huvudkategoriId: kategori.huvudkategoriId,
      description: kategori.description || '',
    });
    setShowUnderkategoriDialog(true);
  };

  const openNewUnderkategori = (huvudkategoriId: string) => {
    underkategoriForm.reset({
      name: '',
      huvudkategoriId,
      description: '',
    });
    setShowUnderkategoriDialog(true);
  };

  const filteredUnderkategorier = selectedHuvudkategori
    ? underkategorier.filter(u => u.huvudkategoriId === selectedHuvudkategori)
    : [];

  if (isLoadingHuvud || isLoadingUnder) {
    return <div className="p-8">Laddar kategorier...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Kategorihantering</h1>
        <Button onClick={() => setShowHuvudkategoriDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ny huvudkategori
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Huvudkategorier */}
        <Card>
          <CardHeader>
            <CardTitle>Huvudkategorier</CardTitle>
            <CardDescription>
              Klicka på en huvudkategori för att se dess underkategorier
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {huvudkategorier.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Inga huvudkategorier skapade än
              </p>
            ) : (
              huvudkategorier.map((kategori) => (
                <div
                  key={kategori.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedHuvudkategori === kategori.id
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedHuvudkategori(kategori.id)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4" />
                    <div>
                      <p className="font-medium">{kategori.name}</p>
                      {kategori.description && (
                        <p className="text-sm text-muted-foreground">{kategori.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditHuvudkategori(kategori);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteHuvudkategori(kategori.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Underkategorier */}
        <Card>
          <CardHeader>
            <CardTitle>Underkategorier</CardTitle>
            <CardDescription>
              {selectedHuvudkategori
                ? `Underkategorier för ${huvudkategorier.find(h => h.id === selectedHuvudkategori)?.name}`
                : 'Välj en huvudkategori för att se dess underkategorier'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedHuvudkategori ? (
              <p className="text-muted-foreground text-center py-8">
                Välj en huvudkategori först
              </p>
            ) : (
              <>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => openNewUnderkategori(selectedHuvudkategori)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ny underkategori
                </Button>
                {filteredUnderkategorier.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Inga underkategorier skapade än
                  </p>
                ) : (
                  filteredUnderkategorier.map((kategori) => (
                    <div
                      key={kategori.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted"
                    >
                      <div>
                        <p className="font-medium">{kategori.name}</p>
                        {kategori.description && (
                          <p className="text-sm text-muted-foreground">{kategori.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditUnderkategori(kategori)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteUnderkategori(kategori.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Huvudkategori Dialog */}
      <Dialog open={showHuvudkategoriDialog} onOpenChange={setShowHuvudkategoriDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingHuvudkategori ? 'Redigera huvudkategori' : 'Ny huvudkategori'}
            </DialogTitle>
            <DialogDescription>
              {editingHuvudkategori
                ? 'Uppdatera informationen för huvudkategorin'
                : 'Skapa en ny huvudkategori för att organisera dina utgifter'}
            </DialogDescription>
          </DialogHeader>
          <Form {...huvudkategoriForm}>
            <form onSubmit={huvudkategoriForm.handleSubmit(handleHuvudkategoriSubmit)} className="space-y-4">
              <FormField
                control={huvudkategoriForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Namn</FormLabel>
                    <FormControl>
                      <Input placeholder="t.ex. Boende" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={huvudkategoriForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beskrivning (valfri)</FormLabel>
                    <FormControl>
                      <Input placeholder="Beskriv kategorin..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createHuvudkategori.isPending || updateHuvudkategori.isPending}>
                  {editingHuvudkategori ? 'Uppdatera' : 'Skapa'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Underkategori Dialog */}
      <Dialog open={showUnderkategoriDialog} onOpenChange={setShowUnderkategoriDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUnderkategori ? 'Redigera underkategori' : 'Ny underkategori'}
            </DialogTitle>
            <DialogDescription>
              {editingUnderkategori
                ? 'Uppdatera informationen för underkategorin'
                : 'Skapa en ny underkategori'}
            </DialogDescription>
          </DialogHeader>
          <Form {...underkategoriForm}>
            <form onSubmit={underkategoriForm.handleSubmit(handleUnderkategoriSubmit)} className="space-y-4">
              <FormField
                control={underkategoriForm.control}
                name="huvudkategoriId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Huvudkategori</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Välj huvudkategori" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {huvudkategorier.map((kategori) => (
                          <SelectItem key={kategori.id} value={kategori.id}>
                            {kategori.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={underkategoriForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Namn</FormLabel>
                    <FormControl>
                      <Input placeholder="t.ex. Hyra" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={underkategoriForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beskrivning (valfri)</FormLabel>
                    <FormControl>
                      <Input placeholder="Beskriv underkategorin..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createUnderkategori.isPending || updateUnderkategori.isPending}>
                  {editingUnderkategori ? 'Uppdatera' : 'Skapa'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}