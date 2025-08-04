// Category Migration Dialog Component
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { performCompleteMigration, isMigrationCompleted } from '../services/categoryMigrationService';
import { StorageKey, get } from '../services/storageService';

interface CategoryMigrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrationComplete?: () => void;
}

export const CategoryMigrationDialog: React.FC<CategoryMigrationDialogProps> = ({
  isOpen,
  onClose,
  onMigrationComplete
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [migrationCompleted, setMigrationCompleted] = useState(isMigrationCompleted());
  const [error, setError] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  // Get current localStorage categories for preview
  const mainCategories = get<string[]>(StorageKey.MAIN_CATEGORIES) || [];
  const subcategories = get<Record<string, string[]>>(StorageKey.SUBCATEGORIES) || {};

  const handleMigration = async () => {
    if (migrationCompleted) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await performCompleteMigration();
      setMigrationResult(result);
      setMigrationCompleted(true);
      onMigrationComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const totalSubcategories = Object.values(subcategories).reduce((sum, subs) => sum + subs.length, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {migrationCompleted ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
            Kategorimigration
          </DialogTitle>
          <DialogDescription>
            {migrationCompleted
              ? 'Kategorimigration har slutförts framgångsrikt.'
              : 'Migrera dina kategorier från namnet till UUID-baserat system för bättre dataintegritet.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!migrationCompleted && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Denna migration kommer att konvertera dina befintliga kategorier från namn-baserade till UUID-baserade.
                  Detta förbättrar dataintegritet och gör det säkert att byta namn på kategorier.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <h4 className="font-medium">Kategorier att migrera:</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{mainCategories.length} huvudkategorier</Badge>
                  <Badge variant="secondary">{totalSubcategories} underkategorier</Badge>
                </div>
                
                {mainCategories.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md max-h-32 overflow-y-auto">
                    <div className="text-sm">
                      {mainCategories.map(category => (
                        <div key={category} className="mb-1">
                          <span className="font-medium">{category}</span>
                          {subcategories[category] && (
                            <span className="text-gray-500 ml-2">
                              ({subcategories[category].length} underkategorier)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {migrationCompleted && migrationResult && (
            <div className="space-y-2">
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Migration slutförd! Skapade {migrationResult.huvudkategorier?.length || 0} huvudkategorier 
                  och {migrationResult.underkategorier?.length || 0} underkategorier med UUID-identifierare.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              {migrationCompleted ? 'Stäng' : 'Avbryt'}
            </Button>
            {!migrationCompleted && (
              <Button onClick={handleMigration} disabled={isLoading || mainCategories.length === 0}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Migrerar...' : 'Starta migration'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};