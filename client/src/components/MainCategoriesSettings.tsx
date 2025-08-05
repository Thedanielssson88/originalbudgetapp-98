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
import { UuidCategoryManager } from './UuidCategoryManager';
import { useToast } from '@/hooks/use-toast';

interface MainCategoriesSettingsProps {
  mainCategories: string[];
}

export const MainCategoriesSettings: React.FC<MainCategoriesSettingsProps> = ({ mainCategories }) => {
  const { toast } = useToast();
  const migrationCompleted = isMigrationCompleted();
  
  console.log('🔍 Migration completed status:', migrationCompleted);
  
  // If migration is completed, check if we have any categories in the database
  if (migrationCompleted) {
    console.log('✅ Migration completed, switching to UUID Category Manager');
    return (
      <div className="space-y-4">
        <UuidCategoryManager />
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Reset Migration</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Om du vill köra migrationen igen eller om något gick fel, klicka här för att återställa.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                localStorage.removeItem('categoryMigrationCompleted');
                localStorage.removeItem('categoryMigrationMapping');
                window.location.reload();
              }}
              className="ml-4"
            >
              Reset Migration
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Otherwise use the legacy localStorage-based system
  console.log('⚠️ Using legacy localStorage category system');
  
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
  
  // Always show migration button for legacy system or when categories are empty
  const shouldShowMigrationButton = true;
  
  // Reset migration flag on component mount to allow re-migration
  React.useEffect(() => {
    localStorage.removeItem('categoryMigrationCompleted');
  }, []);
  
  // If categories are empty, restore them from the predefined list
  React.useEffect(() => {
    if (categories.length === 0) {
      const defaultCategories = ["Transport", "Barn", "Mat & dryck", "Hushåll", "Hälsa", "Nöje, Fritid & Media", "Inkomster", "Övrigt"];
      const defaultSubcategories = {
        "Transport": ["Bränsle", "Kollektivtrafik", "Bil service", "Parkering"],
        "Barn": ["Barnomsorg", "Leksaker", "Barnkläder", "Barnaktiviteter"],
        "Mat & dryck": ["Livsmedel", "Restaurang", "Kaffe", "Takeaway", "Godis", "Alkohol"],
        "Hushåll": ["Hyra", "El", "Internet", "Försäkring", "Städning", "Reparationer", "Möbler"],
        "Hälsa": ["Läkare", "Medicin", "Tandläkare"],
        "Nöje, Fritid & Media": ["Bio", "Streaming", "Böcker", "Spel", "Gym", "Hobbies"],
        "Inkomster": ["Lön", "Bonus", "Återbetalning"],
        "Övrigt": ["Gåvor", "Välgörenhet", "Övrigt"]
      };
      
      console.log('🔄 Restoring default categories...');
      setCategories(defaultCategories);
      setMainCategories(defaultCategories);
      setSubcategories(defaultSubcategories);
      set(StorageKey.SUBCATEGORIES, defaultSubcategories);
    }
  }, [categories.length]);

  const handleCompleteUuidMigration = async () => {
    setMigrationInProgress(true);
    try {
      // Clear the old migration flags to start fresh
      localStorage.removeItem('categoryMigrationCompleted');
      localStorage.removeItem('categoryMigrationMapping');
      
      console.log('🚀 === COMPREHENSIVE UUID MIGRATION STARTING ===');
      
      console.log('🧹 Clearing database and starting fresh comprehensive migration...');
      
      // Clear existing database data first
      const clearResponse = await fetch('/api/clear-migration-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (clearResponse.ok) {
        const clearData = await clearResponse.json();
        console.log('✅ Database cleared:', clearData);
      }
      
      // Collect all localStorage data for migration
      const currentCategories = categories.length > 0 ? categories : ["Transport", "Barn", "Mat & dryck", "Hushåll", "Hälsa", "Nöje, Fritid & Media", "Inkomster", "Övrigt"];
      const currentSubcategories = Object.keys(subcategories).length > 0 ? subcategories : {
        "Transport": ["Bränsle", "Kollektivtrafik", "Bil service", "Parkering"],
        "Barn": ["Barnomsorg", "Leksaker", "Barnkläder", "Barnaktiviteter"],
        "Mat & dryck": ["Livsmedel", "Restaurang", "Kaffe", "Takeaway", "Godis", "Alkohol"],
        "Hushåll": ["Hyra", "El", "Internet", "Försäkring", "Städning", "Reparationer", "Möbler"],
        "Hälsa": ["Läkare", "Medicin", "Tandläkare"],
        "Nöje, Fritid & Media": ["Bio", "Streaming", "Böcker", "Spel", "Gym", "Hobbies"],
        "Inkomster": ["Lön", "Bonus", "Återbetalning"],
        "Övrigt": ["Gåvor", "Välgörenhet", "Övrigt"]
      };
      
      // Get existing transactions and rules from localStorage 
      const budgetData = get(StorageKey.BUDGET_CALCULATOR_DATA) as any || {};
      const existingTransactions = Array.isArray(budgetData.allTransactions) ? budgetData.allTransactions : [];
      const existingRules = get(StorageKey.CATEGORY_RULES) || [];
      
      console.log('📊 Migrating data:', {
        categories: currentCategories.length,
        subcategories: Object.keys(currentSubcategories).length,
        transactions: existingTransactions.length,
        rules: Array.isArray(existingRules) ? existingRules.length : 0
      });

      // Call comprehensive migration API
      const migrateResponse = await fetch('/api/migrate-all-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainCategories: currentCategories,
          subcategories: currentSubcategories,
          transactions: existingTransactions,
          rules: existingRules
        })
      });
      
      if (!migrateResponse.ok) {
        throw new Error('Failed to complete comprehensive migration');
      }
      
      const migrationData = await migrateResponse.json();
      console.log('✅ Comprehensive migration completed:', migrationData);
      
      // Show success message
      toast({
        title: 'Migration Slutförd!',
        description: `Migrerade ${migrationData.huvudkategorier.length} kategorier, ${migrationData.underkategorier.length} underkategorier, ${migrationData.migratedTransactions} transaktioner, och ${migrationData.migratedRules} regler.`,
      });
      
      // Save mapping and mark complete
      if (migrationData.categoryMapping) {
        set(StorageKey.CATEGORY_MIGRATION_MAPPING, migrationData.categoryMapping);
      }
      set(StorageKey.CATEGORY_MIGRATION_COMPLETED, new Date().toISOString());
      
      // Force page reload to switch to UUID system
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error('Migration failed:', error);
      toast({
        title: 'Migration Misslyckades',
        description: 'Ett fel uppstod under migreringen. Försök igen.',
        variant: 'destructive'
      });
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
        {shouldShowMigrationButton && (
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              <div className="flex flex-col space-y-3">
                <div>
                  <strong>VIKTIGT:</strong> Du använder det gamla kategori-systemet. När du byter namn på kategorier försvinner underkategorierna. 
                </div>
                <div className="text-sm opacity-90">
                  "Fixa nu" kommer att:
                  • Importera alla dina befintliga kategorier till UUID-systemet
                  • Konvertera alla transaktioner och regler
                  • Aktivera säker kategorinamnändring (underkategorier försvinner inte)
                </div>
                <Button 
                  onClick={handleCompleteUuidMigration}
                  disabled={migrationInProgress}
                  className="bg-orange-500 hover:bg-orange-600 text-white self-start"
                >
                  <Database className="h-4 w-4 mr-2" />
                  {migrationInProgress ? 'Migrerar all data...' : 'Fixa nu - Komplett Migration'}
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