import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Edit, Save, X } from 'lucide-react';
import { setMainCategories } from '../orchestrator/budgetOrchestrator';

interface MainCategoriesSettingsProps {
  mainCategories: string[];
}

export const MainCategoriesSettings: React.FC<MainCategoriesSettingsProps> = ({ mainCategories }) => {
  const [categories, setCategories] = useState<string[]>(mainCategories);
  const [newCategory, setNewCategory] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      const updatedCategories = [...categories, newCategory.trim()];
      setCategories(updatedCategories);
      setMainCategories(updatedCategories);
      setNewCategory('');
    }
  };

  const removeCategory = (index: number) => {
    const updatedCategories = categories.filter((_, i) => i !== index);
    setCategories(updatedCategories);
    setMainCategories(updatedCategories);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(categories[index]);
  };

  const saveEdit = () => {
    if (editingIndex !== null && editingValue.trim() && !categories.includes(editingValue.trim())) {
      const updatedCategories = [...categories];
      updatedCategories[editingIndex] = editingValue.trim();
      setCategories(updatedCategories);
      setMainCategories(updatedCategories);
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Huvudkategorier för kostnader</CardTitle>
        <CardDescription>
          Hantera huvudkategorier som används för kostnadskategorier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {categories.map((category, index) => (
            <div key={index} className="flex items-center gap-2 p-2 border rounded">
              {editingIndex === index ? (
                <>
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="flex-1"
                    placeholder="Kategorinamn"
                  />
                  <Button size="sm" onClick={saveEdit} variant="default">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={cancelEdit} variant="outline">
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1">{category}</span>
                  <Button size="sm" onClick={() => startEdit(index)} variant="outline">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={() => removeCategory(index)} variant="destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Ny huvudkategori"
            onKeyPress={(e) => e.key === 'Enter' && addCategory()}
          />
          <Button onClick={addCategory} disabled={!newCategory.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Lägg till
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};