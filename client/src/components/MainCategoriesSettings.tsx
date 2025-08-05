import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus, Edit, Save, X, ChevronDown, ChevronUp, Database, AlertTriangle } from 'lucide-react';
import { setMainCategories } from '../orchestrator/budgetOrchestrator';
import { StorageKey, get, set } from '../services/storageService';
import { forceCompleteMigration, isMigrationCompleted } from '../services/categoryMigrationService';

interface MainCategoriesSettingsProps {
  mainCategories: string[];
}

export const MainCategoriesSettings: React.FC<MainCategoriesSettingsProps> = ({ mainCategories }) => {
  const [categories, setCategories] = useState<string[]>(mainCategories);
  const [newCategory, setNewCategory] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>(() => {
    return get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
  });
  const [newSubcategory, setNewSubcategory] = useState<Record<string, string>>({});
  const [editingSubcategory, setEditingSubcategory] = useState<{category: string, index: number} | null>(null);
  const [editingSubcategoryValue, setEditingSubcategoryValue] = useState('');
  const [migrationInProgress, setMigrationInProgress] = useState(false);
  
  const migrationCompleted = isMigrationCompleted();

  const handleCompleteUuidMigration = async () => {
    setMigrationInProgress(true);
    try {
      await forceCompleteMigration();
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationInProgress(false);
    }
  };

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      const updatedCategories = [...categories, newCategory.trim()];
      setCategories(updatedCategories);
      setMainCategories(updatedCategories);
      setNewCategory('');
    }
  };

  const removeCategory = (index: number) => {
    const categoryToRemove = categories[index];
    const updatedCategories = categories.filter((_, i) => i !== index);
    const updatedSubcategories = { ...subcategories };
    delete updatedSubcategories[categoryToRemove];
    
    setCategories(updatedCategories);
    setSubcategories(updatedSubcategories);
    setMainCategories(updatedCategories);
    set(StorageKey.SUBCATEGORIES, updatedSubcategories);
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

  const toggleCategoryExpansion = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const addSubcategory = (category: string) => {
    const newSubcategoryName = newSubcategory[category]?.trim();
    if (newSubcategoryName && !(subcategories[category]?.includes(newSubcategoryName))) {
      const updatedSubcategories = {
        ...subcategories,
        [category]: [...(subcategories[category] || []), newSubcategoryName]
      };
      setSubcategories(updatedSubcategories);
      set(StorageKey.SUBCATEGORIES, updatedSubcategories);
      setNewSubcategory({ ...newSubcategory, [category]: '' });
    }
  };

  const removeSubcategory = (category: string, index: number) => {
    const updatedSubcategories = {
      ...subcategories,
      [category]: subcategories[category]?.filter((_, i) => i !== index) || []
    };
    setSubcategories(updatedSubcategories);
    set(StorageKey.SUBCATEGORIES, updatedSubcategories);
  };

  const startSubcategoryEdit = (category: string, index: number) => {
    setEditingSubcategory({ category, index });
    setEditingSubcategoryValue(subcategories[category]?.[index] || '');
  };

  const saveSubcategoryEdit = () => {
    if (editingSubcategory && editingSubcategoryValue.trim()) {
      const { category, index } = editingSubcategory;
      const updatedSubcategories = {
        ...subcategories,
        [category]: subcategories[category]?.map((sub, i) => 
          i === index ? editingSubcategoryValue.trim() : sub
        ) || []
      };
      setSubcategories(updatedSubcategories);
      set(StorageKey.SUBCATEGORIES, updatedSubcategories);
      setEditingSubcategory(null);
      setEditingSubcategoryValue('');
    }
  };

  const cancelSubcategoryEdit = () => {
    setEditingSubcategory(null);
    setEditingSubcategoryValue('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kategorier</CardTitle>
        <CardDescription>
          Hantera kategorier som används för kostnader, sparande och transaktioner
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!migrationCompleted && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              <div className="flex items-center justify-between">
                <span>
                  Du använder det gamla kategori-systemet. Uppgradera till UUID-baserat system för att undvika problem när du byter namn på kategorier.
                </span>
                <Button 
                  size="sm" 
                  onClick={handleCompleteUuidMigration}
                  disabled={migrationInProgress}
                  className="ml-4"
                >
                  <Database className="h-4 w-4 mr-2" />
                  {migrationInProgress ? 'Migrerar...' : 'Uppgradera nu'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        <div className="space-y-4">
          {categories.map((category, index) => (
            <div key={index} className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCategoryExpansion(category)}
                      className="p-1"
                    >
                      {expandedCategories.has(category) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <span className="flex-1 font-medium">{category}</span>
                    <div className="text-sm text-muted-foreground">
                      {subcategories[category]?.length || 0} underkategorier
                    </div>
                    <Button size="sm" onClick={() => startEdit(index)} variant="outline">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => removeCategory(index)} variant="destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {expandedCategories.has(category) && (
                <div className="pl-6 space-y-3 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Underkategorier</Label>
                    {subcategories[category]?.map((subcategory, subIndex) => (
                      <div key={subIndex} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                        {editingSubcategory?.category === category && editingSubcategory?.index === subIndex ? (
                          <>
                            <Input
                              value={editingSubcategoryValue}
                              onChange={(e) => setEditingSubcategoryValue(e.target.value)}
                              className="flex-1"
                              placeholder="Underkategorinamn"
                            />
                            <Button size="sm" onClick={saveSubcategoryEdit} variant="default">
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={cancelSubcategoryEdit} variant="outline">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 font-medium">{subcategory}</span>
                            <Button 
                              size="sm" 
                              onClick={() => startSubcategoryEdit(category, subIndex)} 
                              variant="outline"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => removeSubcategory(category, subIndex)} 
                              variant="destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={newSubcategory[category] || ''}
                      onChange={(e) => setNewSubcategory({ 
                        ...newSubcategory, 
                        [category]: e.target.value 
                      })}
                      placeholder="Ny underkategori"
                      onKeyPress={(e) => e.key === 'Enter' && addSubcategory(category)}
                    />
                    <Button 
                      onClick={() => addSubcategory(category)} 
                      disabled={!newSubcategory[category]?.trim()}
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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