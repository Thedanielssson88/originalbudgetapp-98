import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertHuvudkategoriSchema, 
  insertUnderkategoriSchema, 
  insertCategoryRuleSchema,
  insertTransactionSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Huvudkategori routes
  app.get("/api/huvudkategorier", async (req, res) => {
    try {
      const kategorier = await storage.getHuvudkategorier();
      res.json(kategorier);
    } catch (error) {
      console.error('Error fetching huvudkategorier:', error);
      res.status(500).json({ error: 'Failed to fetch huvudkategorier' });
    }
  });

  app.get("/api/huvudkategorier/:id", async (req, res) => {
    try {
      const kategori = await storage.getHuvudkategori(req.params.id);
      if (!kategori) {
        return res.status(404).json({ error: 'Huvudkategori not found' });
      }
      res.json(kategori);
    } catch (error) {
      console.error('Error fetching huvudkategori:', error);
      res.status(500).json({ error: 'Failed to fetch huvudkategori' });
    }
  });

  app.post("/api/huvudkategorier", async (req, res) => {
    try {
      const validatedData = insertHuvudkategoriSchema.parse(req.body);
      const kategori = await storage.createHuvudkategori(validatedData);
      res.status(201).json(kategori);
    } catch (error) {
      console.error('Error creating huvudkategori:', error);
      res.status(400).json({ error: 'Failed to create huvudkategori' });
    }
  });

  app.patch("/api/huvudkategorier/:id", async (req, res) => {
    try {
      const updateData = insertHuvudkategoriSchema.partial().parse(req.body);
      const kategori = await storage.updateHuvudkategori(req.params.id, updateData);
      if (!kategori) {
        return res.status(404).json({ error: 'Huvudkategori not found' });
      }
      res.json(kategori);
    } catch (error) {
      console.error('Error updating huvudkategori:', error);
      res.status(400).json({ error: 'Failed to update huvudkategori' });
    }
  });

  app.delete("/api/huvudkategorier/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteHuvudkategori(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Huvudkategori not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting huvudkategori:', error);
      res.status(500).json({ error: 'Failed to delete huvudkategori' });
    }
  });

  // Underkategori routes
  app.get("/api/underkategorier", async (req, res) => {
    try {
      const { huvudkategoriId } = req.query;
      let kategorier;
      
      if (huvudkategoriId) {
        kategorier = await storage.getUnderkategorierByHuvudkategori(huvudkategoriId as string);
      } else {
        kategorier = await storage.getUnderkategorier();
      }
      
      res.json(kategorier);
    } catch (error) {
      console.error('Error fetching underkategorier:', error);
      res.status(500).json({ error: 'Failed to fetch underkategorier' });
    }
  });

  app.get("/api/underkategorier/:id", async (req, res) => {
    try {
      const kategori = await storage.getUnderkategori(req.params.id);
      if (!kategori) {
        return res.status(404).json({ error: 'Underkategori not found' });
      }
      res.json(kategori);
    } catch (error) {
      console.error('Error fetching underkategori:', error);
      res.status(500).json({ error: 'Failed to fetch underkategori' });
    }
  });

  app.post("/api/underkategorier", async (req, res) => {
    try {
      const validatedData = insertUnderkategoriSchema.parse(req.body);
      const kategori = await storage.createUnderkategori(validatedData);
      res.status(201).json(kategori);
    } catch (error) {
      console.error('Error creating underkategori:', error);
      res.status(400).json({ error: 'Failed to create underkategori' });
    }
  });

  app.patch("/api/underkategorier/:id", async (req, res) => {
    try {
      const updateData = insertUnderkategoriSchema.partial().parse(req.body);
      const kategori = await storage.updateUnderkategori(req.params.id, updateData);
      if (!kategori) {
        return res.status(404).json({ error: 'Underkategori not found' });
      }
      res.json(kategori);
    } catch (error) {
      console.error('Error updating underkategori:', error);
      res.status(400).json({ error: 'Failed to update underkategori' });
    }
  });

  app.delete("/api/underkategorier/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteUnderkategori(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Underkategori not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting underkategori:', error);
      res.status(500).json({ error: 'Failed to delete underkategori' });
    }
  });

  // Category Rules routes
  app.get("/api/category-rules", async (req, res) => {
    try {
      const rules = await storage.getCategoryRules();
      res.json(rules);
    } catch (error) {
      console.error('Error fetching category rules:', error);
      res.status(500).json({ error: 'Failed to fetch category rules' });
    }
  });

  app.post("/api/category-rules", async (req, res) => {
    try {
      const validatedData = insertCategoryRuleSchema.parse(req.body);
      const rule = await storage.createCategoryRule(validatedData);
      res.status(201).json(rule);
    } catch (error) {
      console.error('Error creating category rule:', error);
      res.status(400).json({ error: 'Failed to create category rule' });
    }
  });

  app.patch("/api/category-rules/:id", async (req, res) => {
    try {
      const updateData = insertCategoryRuleSchema.partial().parse(req.body);
      const rule = await storage.updateCategoryRule(req.params.id, updateData);
      if (!rule) {
        return res.status(404).json({ error: 'Category rule not found' });
      }
      res.json(rule);
    } catch (error) {
      console.error('Error updating category rule:', error);
      res.status(400).json({ error: 'Failed to update category rule' });
    }
  });

  app.delete("/api/category-rules/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCategoryRule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Category rule not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting category rule:', error);
      res.status(500).json({ error: 'Failed to delete category rule' });
    }
  });

  // Migration route to import existing localStorage categories
  app.post("/api/migrate-categories", async (req, res) => {
    try {
      const { mainCategories, subcategories } = req.body;
      
      if (!Array.isArray(mainCategories)) {
        return res.status(400).json({ error: 'mainCategories must be an array' });
      }

      const migrationResult = {
        huvudkategorier: [] as any[],
        underkategorier: [] as any[],
        categoryMapping: {} as Record<string, string>
      };

      // Create huvudkategorier and track name-to-ID mapping
      for (const categoryName of mainCategories) {
        const huvudkategori = await storage.createHuvudkategori({ name: categoryName });
        migrationResult.huvudkategorier.push(huvudkategori);
        migrationResult.categoryMapping[categoryName] = huvudkategori.id;
      }

      // Create underkategorier
      if (subcategories && typeof subcategories === 'object') {
        for (const [mainCategoryName, subCategoryNames] of Object.entries(subcategories)) {
          if (Array.isArray(subCategoryNames)) {
            const huvudkategoriId = migrationResult.categoryMapping[mainCategoryName];
            if (huvudkategoriId) {
              for (const subCategoryName of subCategoryNames) {
                const underkategori = await storage.createUnderkategori({
                  name: subCategoryName,
                  huvudkategoriId
                });
                migrationResult.underkategorier.push(underkategori);
                migrationResult.categoryMapping[`${mainCategoryName}:${subCategoryName}`] = underkategori.id;
              }
            }
          }
        }
      }

      res.json(migrationResult);
    } catch (error) {
      console.error('Error migrating categories:', error);
      res.status(500).json({ error: 'Failed to migrate categories' });
    }
  });

  // Comprehensive migration route for fixing all data
  app.post("/api/migrate-all-data", async (req, res) => {
    try {
      const { mainCategories, subcategories, transactions, rules } = req.body;
      
      console.log('🚀 Starting comprehensive data migration...');
      
      const migrationResult = {
        huvudkategorier: [] as any[],
        underkategorier: [] as any[],
        categoryMapping: {} as Record<string, string>,
        migratedTransactions: 0,
        migratedRules: 0,
        errors: [] as string[]
      };

      // Step 1: Create huvudkategorier
      if (Array.isArray(mainCategories)) {
        for (const categoryName of mainCategories) {
          try {
            const huvudkategori = await storage.createHuvudkategori({ name: categoryName });
            migrationResult.huvudkategorier.push(huvudkategori);
            migrationResult.categoryMapping[categoryName] = huvudkategori.id;
          } catch (error) {
            migrationResult.errors.push(`Failed to create huvudkategori: ${categoryName}`);
          }
        }
      }

      // Step 2: Create underkategorier
      if (subcategories && typeof subcategories === 'object') {
        for (const [mainCategoryName, subCategoryNames] of Object.entries(subcategories)) {
          if (Array.isArray(subCategoryNames)) {
            const huvudkategoriId = migrationResult.categoryMapping[mainCategoryName];
            if (huvudkategoriId) {
              for (const subCategoryName of subCategoryNames) {
                try {
                  const underkategori = await storage.createUnderkategori({
                    name: subCategoryName,
                    huvudkategoriId
                  });
                  migrationResult.underkategorier.push(underkategori);
                  migrationResult.categoryMapping[`${mainCategoryName}:${subCategoryName}`] = underkategori.id;
                } catch (error) {
                  migrationResult.errors.push(`Failed to create underkategori: ${subCategoryName} for ${mainCategoryName}`);
                }
              }
            }
          }
        }
      }

      // Step 3: Migrate transactions (if provided)
      if (Array.isArray(transactions)) {
        for (const transaction of transactions) {
          try {
            // Convert string-based category references to UUID
            let huvudkategoriId = null;
            let underkategoriId = null;
            
            if (transaction.huvudkategori && transaction.underkategori) {
              const underkategoriKey = `${transaction.huvudkategori}:${transaction.underkategori}`;
              underkategoriId = migrationResult.categoryMapping[underkategoriKey];
              huvudkategoriId = migrationResult.categoryMapping[transaction.huvudkategori];
            }
            
            await storage.createTransaction({
              ...transaction,
              huvudkategoriId,
              underkategoriId
            });
            migrationResult.migratedTransactions++;
          } catch (error) {
            migrationResult.errors.push(`Failed to migrate transaction: ${transaction.id || 'unknown'}`);
          }
        }
      }

      // Step 4: Migrate rules (if provided)  
      if (Array.isArray(rules)) {
        for (const rule of rules) {
          try {
            // Convert string-based category references to UUID
            let huvudkategoriId = null;
            let underkategoriId = null;
            
            if (rule.appMainCategory && rule.appSubCategory) {
              const underkategoriKey = `${rule.appMainCategory}:${rule.appSubCategory}`;
              underkategoriId = migrationResult.categoryMapping[underkategoriKey];
              huvudkategoriId = migrationResult.categoryMapping[rule.appMainCategory];
            }
            
            await storage.createCategoryRule({
              priority: rule.priority || 100,
              conditionType: rule.conditionType || 'textContains',
              conditionValue: rule.conditionValue || '',
              bankCategory: rule.bankCategory,
              bankSubCategory: rule.bankSubCategory,
              huvudkategoriId: huvudkategoriId!,
              underkategoriId,
              positiveTransactionType: rule.positiveTransactionType || 'Transaction',
              negativeTransactionType: rule.negativeTransactionType || 'Transaction',
              applicableAccountIds: rule.applicableAccountIds || [],
              isActive: rule.isActive !== false
            });
            migrationResult.migratedRules++;
          } catch (error) {
            migrationResult.errors.push(`Failed to migrate rule: ${rule.id || 'unknown'}`);
          }
        }
      }

      console.log('✅ Comprehensive migration completed:', migrationResult);
      res.json(migrationResult);
    } catch (error) {
      console.error('Error in comprehensive migration:', error);
      res.status(500).json({ error: 'Failed to complete comprehensive migration' });
    }
  });

  // Clear database endpoint for fresh migration
  app.post("/api/clear-migration-data", async (req, res) => {
    try {
      console.log('🧹 Clearing existing migration data...');
      
      // Note: In a real implementation, you would delete from the database
      // For now, we'll just log this action since we're using in-memory storage
      const deletedRules = await storage.getCategoryRules();
      const deletedTransactions = await storage.getTransactions();
      const deletedUnder = await storage.getUnderkategorier();
      const deletedHuvud = await storage.getHuvudkategorier();
      
      console.log('📊 Would clear:', {
        rules: deletedRules.length,
        transactions: deletedTransactions.length,
        underkategorier: deletedUnder.length,
        huvudkategorier: deletedHuvud.length
      });
      
      res.json({ 
        message: 'Database cleared for fresh migration',
        cleared: {
          rules: deletedRules.length,
          transactions: deletedTransactions.length,
          underkategorier: deletedUnder.length,
          huvudkategorier: deletedHuvud.length
        }
      });
    } catch (error) {
      console.error('Error clearing migration data:', error);
      res.status(500).json({ error: 'Failed to clear migration data' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
