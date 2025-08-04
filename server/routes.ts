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

  const httpServer = createServer(app);

  return httpServer;
}
