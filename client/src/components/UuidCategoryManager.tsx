// UUID-based Category Manager Component
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  ChevronDown, 
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  useHuvudkategorier,
  useUnderkategorier,
  useCreateHuvudkategori,
  useCreateUnderkategori,
  useUpdateHuvudkategori,
  useUpdateUnderkategori,
  useDeleteHuvudkategori,
  useDeleteUnderkategori,
  useCategoriesHierarchy
} from '../hooks/useCategories';
import { useToast } from '@/hooks/use-toast';

interface UuidCategoryManagerProps {
  onCategoriesChange?: () => void;
}

export const UuidCategoryManager: React.FC<UuidCategoryManagerProps> = ({ onCategoriesChange }) => {
  const { toast } = useToast();
  const [newHuvudkategori, setNewHuvudkategori] = useState('');
  const [newUnderkategori, setNewUnderkategori] = useState<Record<string, string>>({});
  const [editingHuvud, setEditingHuvud] = useState<string | null>(null);
  const [editingUnder, setEditingUnder] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Queries and mutations
  const { categories, isLoading } = useCategoriesHierarchy();
  const createHuvudMutation = useCreateHuvudkategori();
  const createUnderMutation = useCreateUnderkategori();
  const updateHuvudMutation = useUpdateHuvudkategori();
  const updateUnderMutation = useUpdateUnderkategori();
  const deleteHuvudMutation = useDeleteHuvudkategori();
  const deleteUnderMutation = useDeleteUnderkategori();

  const handleCreateHuvudkategori = async () => {
    if (!newHuvudkategori.trim()) return;

    try {
      await createHuvudMutation.mutateAsync({ name: newHuvudkategori.trim() });
      setNewHuvudkategori('');
      toast({
        title: 'Huvudkategori skapad',
        description: `"${newHuvudkategori.trim()}" har lagts till.`
      });
      onCategoriesChange?.();
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte skapa huvudkategori.',
        variant: 'destructive'
      });
    }
  };

  const handleCreateUnderkategori = async (huvudkategoriId: string) => {
    const name = newUnderkategori[huvudkategoriId]?.trim();
    if (!name) return;

    try {
      await createUnderMutation.mutateAsync({ 
        name, 
        huvudkategoriId 
      });
      setNewUnderkategori(prev => ({ ...prev, [huvudkategoriId]: '' }));
      toast({
        title: 'Underkategori skapad',
        description: `"${name}" har lagts till.`
      });
      onCategoriesChange?.();
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte skapa underkategori.',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateHuvudkategori = async (id: string) => {
    if (!editingValue.trim()) return;

    try {
      await updateHuvudMutation.mutateAsync({ 
        id, 
        data: { name: editingValue.trim() } 
      });
      setEditingHuvud(null);
      setEditingValue('');
      toast({
        title: 'Huvudkategori uppdaterad',
        description: 'Namnet har ändrats.'
      });
      onCategoriesChange?.();
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte uppdatera huvudkategori.',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateUnderkategori = async (id: string) => {
    if (!editingValue.trim()) return;

    try {
      await updateUnderMutation.mutateAsync({ 
        id, 
        data: { name: editingValue.trim() } 
      });
      setEditingUnder(null);
      setEditingValue('');
      toast({
        title: 'Underkategori uppdaterad',
        description: 'Namnet har ändrats.'
      });
      onCategoriesChange?.();
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte uppdatera underkategori.',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteHuvudkategori = async (id: string, name: string) => {
    if (!confirm(`Är du säker på att du vill ta bort huvudkategorin "${name}"? Detta kommer också ta bort alla underkategorier.`)) {
      return;
    }

    try {
      await deleteHuvudMutation.mutateAsync(id);
      toast({
        title: 'Huvudkategori borttagen',
        description: `"${name}" har tagits bort.`
      });
      onCategoriesChange?.();
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte ta bort huvudkategori.',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteUnderkategori = async (id: string, name: string) => {
    if (!confirm(`Är du säker på att du vill ta bort underkategorin "${name}"?`)) {
      return;
    }

    try {
      await deleteUnderMutation.mutateAsync(id);
      toast({
        title: 'Underkategori borttagen',
        description: `"${name}" har tagits bort.`
      });
      onCategoriesChange?.();
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte ta bort underkategori.',
        variant: 'destructive'
      });
    }
  };

  const toggleExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Laddar kategorier...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Kategorier (UUID-baserat)
          <Badge variant="outline" className="text-xs">
            {categories.length} huvudkategorier
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new huvudkategori */}
        <div className="flex gap-2">
          <Input
            placeholder="Ny huvudkategori..."
            value={newHuvudkategori}
            onChange={(e) => setNewHuvudkategori(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateHuvudkategori()}
          />
          <Button 
            onClick={handleCreateHuvudkategori}
            disabled={!newHuvudkategori.trim() || createHuvudMutation.isPending}
            size="sm"
          >
            {createHuvudMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Category list */}
        <div className="space-y-2">
          {categories.map((kategori) => {
            const isExpanded = expandedCategories.has(kategori.id);
            const isEditingThis = editingHuvud === kategori.id;

            return (
              <div key={kategori.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpansion(kategori.id)}
                      className="p-0 h-6 w-6"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {isEditingThis ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateHuvudkategori(kategori.id);
                            if (e.key === 'Escape') {
                              setEditingHuvud(null);
                              setEditingValue('');
                            }
                          }}
                          className="h-8"
                          autoFocus
                        />
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleUpdateHuvudkategori(kategori.id)}
                          disabled={updateHuvudMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setEditingHuvud(null);
                            setEditingValue('');
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium">{kategori.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {kategori.underkategorier.length} underkategorier
                        </Badge>
                      </>
                    )}
                  </div>

                  {!isEditingThis && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingHuvud(kategori.id);
                          setEditingValue(kategori.name);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteHuvudkategori(kategori.id, kategori.name)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        disabled={deleteHuvudMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Underkategorier */}
                {isExpanded && (
                  <div className="mt-3 ml-6 space-y-2">
                    {/* Add new underkategori */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ny underkategori..."
                        value={newUnderkategori[kategori.id] || ''}
                        onChange={(e) => setNewUnderkategori(prev => ({
                          ...prev,
                          [kategori.id]: e.target.value
                        }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateUnderkategori(kategori.id)}
                        className="h-8 text-sm"
                      />
                      <Button 
                        onClick={() => handleCreateUnderkategori(kategori.id)}
                        disabled={!newUnderkategori[kategori.id]?.trim() || createUnderMutation.isPending}
                        size="sm"
                        className="h-8"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Underkategori list */}
                    {kategori.underkategorier.map((under) => {
                      const isEditingThisUnder = editingUnder === under.id;

                      return (
                        <div key={under.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          {isEditingThisUnder ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateUnderkategori(under.id);
                                  if (e.key === 'Escape') {
                                    setEditingUnder(null);
                                    setEditingValue('');
                                  }
                                }}
                                className="h-8 text-sm"
                                autoFocus
                              />
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleUpdateUnderkategori(under.id)}
                                disabled={updateUnderMutation.isPending}
                                className="h-8 w-8 p-0"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setEditingUnder(null);
                                  setEditingValue('');
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm">{under.name}</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingUnder(under.id);
                                    setEditingValue(under.name);
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteUnderkategori(under.id, under.name)}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                  disabled={deleteUnderMutation.isPending}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {kategori.underkategorier.length === 0 && (
                      <div className="text-sm text-gray-500 italic p-2">
                        Inga underkategorier ännu
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {categories.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Inga kategorier skapade ännu. Lägg till din första huvudkategori ovan.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};