import React from 'react';
import { UuidCategoryManager } from './UuidCategoryManager';

interface MainCategoriesSettingsProps {
  mainCategories: string[];
}

export const MainCategoriesSettings: React.FC<MainCategoriesSettingsProps> = () => {
  
  // Always use UUID-based category system for modern database-backed implementation
  console.log('✅ Using UUID Category Manager for database-backed categories');
  return (
    <div className="space-y-4">
      <UuidCategoryManager />
      <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-green-900 dark:text-green-100">UUID-baserat kategori-system</h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Du använder nu det moderna UUID-baserade kategori-systemet med databaspersistens. 
              Kategorier kan nu säkert döpas om utan att underkategorier försvinner.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};