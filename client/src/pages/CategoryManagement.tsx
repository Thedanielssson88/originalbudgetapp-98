// Category Management Page - Demonstrates UUID-based category system
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  ArrowUpDown, 
  AlertCircle, 
  CheckCircle,
  RefreshCw,
  Settings
} from 'lucide-react';
import { UuidCategoryManager } from '../components/UuidCategoryManager';
import { CategoryMigrationDialog } from '../components/CategoryMigrationDialog';
import { useCategoriesHierarchy } from '../hooks/useCategories';
import { isMigrationCompleted } from '../services/categoryMigrationService';
import { StorageKey, get } from '../services/storageService';

export default function CategoryManagement() {
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const { categories, hovedkategorier, underkategorier, isLoading } = useCategoriesHierarchy();
  const migrationCompleted = isMigrationCompleted();
  
  // Get current localStorage categories for comparison
  const localStorageMainCategories = get<string[]>(StorageKey.MAIN_CATEGORIES) || [];
  const localStorageSubcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};
  const totalLocalSubcategories = Object.values(localStorageSubcategories).reduce((sum, subs) => sum + subs.length, 0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleMigrationComplete = () => {
    handleRefresh();
    setMigrationDialogOpen(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kategorihantering</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Hantera kategorier med UUID-baserat system för bättre dataintegritet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Uppdatera
          </Button>
          <Button onClick={() => setMigrationDialogOpen(true)}>
            <ArrowUpDown className="h-4 w-4 mr-2" />
            {migrationCompleted ? 'Visa migration' : 'Migrera kategorier'}
          </Button>
        </div>
      </div>

      {/* Migration Status */}
      <Alert className={migrationCompleted ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20'}>
        {migrationCompleted ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-yellow-500" />
        )}
        <AlertDescription className={migrationCompleted ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}>
          {migrationCompleted 
            ? 'Migration till UUID-baserat system är slutförd. Kategorier använder nu UUID-identifierare för bättre dataintegritet.'
            : 'Kategorier använder fortfarande namn-baserat system. Klicka på "Migrera kategorier" för att uppgradera till UUID-baserat system.'
          }
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="uuid-categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="uuid-categories">
            <Database className="h-4 w-4 mr-2" />
            UUID Kategorier
          </TabsTrigger>
          <TabsTrigger value="legacy-comparison">
            <Settings className="h-4 w-4 mr-2" />
            System jämförelse
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uuid-categories" className="space-y-4">
          <UuidCategoryManager 
            key={refreshKey}
            onCategoriesChange={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="legacy-comparison" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Legacy localStorage Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  LocalStorage kategorier (Legacy)
                  <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                    Namn-baserat
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{localStorageMainCategories.length} huvudkategorier</Badge>
                    <Badge variant="secondary">{totalLocalSubcategories} underkategorier</Badge>
                  </div>
                  
                  {localStorageMainCategories.length > 0 ? (
                    <div className="space-y-2">
                      {localStorageMainCategories.map(category => (
                        <div key={category} className="border rounded p-2">
                          <div className="font-medium">{category}</div>
                          {localStorageSubcategories[category] && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                              {localStorageSubcategories[category].map(sub => (
                                <div key={sub}>• {sub}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">Inga kategorier i localStorage</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* UUID Database Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Databas kategorier (UUID)
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                    UUID-baserat
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="text-center py-4">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Laddar kategorier...
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{hovedkategorier.length} huvudkategorier</Badge>
                        <Badge variant="secondary">{underkategorier.length} underkategorier</Badge>
                      </div>
                      
                      {categories.length > 0 ? (
                        <div className="space-y-2">
                          {categories.map(category => (
                            <div key={category.id} className="border rounded p-2">
                              <div className="font-medium">{category.name}</div>
                              <div className="text-xs text-gray-500 mb-1">UUID: {category.id}</div>
                              {category.underkategorier.length > 0 && (
                                <div className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                                  {category.underkategorier.map(sub => (
                                    <div key={sub.id}>
                                      • {sub.name}
                                      <span className="text-xs text-gray-400 ml-2">({sub.id})</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 italic">Inga kategorier i databasen</div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Migration Benefits */}
          <Card>
            <CardHeader>
              <CardTitle>Fördelar med UUID-baserat system</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2 text-green-700 dark:text-green-300">UUID-baserat system</h4>
                  <ul className="space-y-1 text-sm">
                    <li>✅ Unika identifierare som aldrig ändras</li>
                    <li>✅ Säker att byta namn på kategorier</li>
                    <li>✅ Ingen risk för dubbletter eller konflikter</li>
                    <li>✅ Robust datarelationer</li>
                    <li>✅ Skalbart för stora datamängder</li>
                    <li>✅ Databas-optimerat</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 text-red-700 dark:text-red-300">Namn-baserat system (Legacy)</h4>
                  <ul className="space-y-1 text-sm">
                    <li>❌ Namnändringar bryter datarelationer</li>
                    <li>❌ Risk för dubbletter</li>
                    <li>❌ Stavfel kan skapa problem</li>
                    <li>❌ Svårt att hantera stora datamängder</li>
                    <li>❌ Begränsad skalbarhet</li>
                    <li>❌ Ingen referentiel integritet</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Migration Dialog */}
      <CategoryMigrationDialog
        isOpen={migrationDialogOpen}
        onClose={() => setMigrationDialogOpen(false)}
        onMigrationComplete={handleMigrationComplete}
      />
    </div>
  );
}