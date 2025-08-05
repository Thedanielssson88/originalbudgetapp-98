import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertAccountSchema,
  insertHuvudkategoriSchema, 
  insertUnderkategoriSchema, 
  insertCategoryRuleSchema,
  insertTransactionSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Mock middleware to inject userId for development
  // In production, this would come from proper authentication
  app.use((req, res, next) => {
    // @ts-ignore - adding userId to request for development
    req.userId = 'dev-user-123';
    next();
  });

  // Bootstrap route to get all initial data
  app.get("/api/bootstrap", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      console.log('Bootstrap request with userId:', userId);
      const data = await storage.bootstrap(userId);
      console.log('Bootstrap data:', JSON.stringify(data, null, 2));
      res.json(data);
    } catch (error) {
      console.error('Error bootstrapping:', error);
      res.status(500).json({ error: 'Failed to bootstrap' });
    }
  });

  // Account routes
  app.get("/api/accounts", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const accounts = await storage.getAccounts(userId);
      res.json(accounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      res.status(500).json({ error: 'Failed to fetch accounts' });
    }
  });

  app.get("/api/accounts/:id", async (req, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.json(account);
    } catch (error) {
      console.error('Error fetching account:', error);
      res.status(500).json({ error: 'Failed to fetch account' });
    }
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertAccountSchema.parse({
        ...req.body,
        userId
      });
      const account = await storage.createAccount(validatedData);
      res.status(201).json(account);
    } catch (error) {
      console.error('Error creating account:', error);
      res.status(400).json({ error: 'Failed to create account' });
    }
  });

  app.patch("/api/accounts/:id", async (req, res) => {
    try {
      const updateData = insertAccountSchema.partial().parse(req.body);
      const account = await storage.updateAccount(req.params.id, updateData);
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.json(account);
    } catch (error) {
      console.error('Error updating account:', error);
      res.status(400).json({ error: 'Failed to update account' });
    }
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAccount(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  });

  // Huvudkategori routes
  app.get("/api/huvudkategorier", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const kategorier = await storage.getHuvudkategorier(userId);
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
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertHuvudkategoriSchema.parse({
        ...req.body,
        userId
      });
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
      // @ts-ignore
      const userId = req.userId;
      const { huvudkategoriId } = req.query;
      let kategorier;
      
      if (huvudkategoriId) {
        kategorier = await storage.getUnderkategorierByHuvudkategori(huvudkategoriId as string, userId);
      } else {
        kategorier = await storage.getUnderkategorier(userId);
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
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertUnderkategoriSchema.parse({
        ...req.body,
        userId
      });
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
      // @ts-ignore
      const userId = req.userId;
      const rules = await storage.getCategoryRules(userId);
      res.json(rules);
    } catch (error) {
      console.error('Error fetching category rules:', error);
      res.status(500).json({ error: 'Failed to fetch category rules' });
    }
  });

  app.post("/api/category-rules", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertCategoryRuleSchema.parse({
        ...req.body,
        userId
      });
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

  // Transaction routes
  app.get("/api/transactions", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const transactions = await storage.getTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  app.get("/api/transactions/:id", async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      res.json(transaction);
    } catch (error) {
      console.error('Error fetching transaction:', error);
      res.status(500).json({ error: 'Failed to fetch transaction' });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        userId
      });
      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(400).json({ error: 'Failed to create transaction' });
    }
  });

  app.patch("/api/transactions/:id", async (req, res) => {
    try {
      const updateData = insertTransactionSchema.partial().parse(req.body);
      const transaction = await storage.updateTransaction(req.params.id, updateData);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      res.json(transaction);
    } catch (error) {
      console.error('Error updating transaction:', error);
      res.status(400).json({ error: 'Failed to update transaction' });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTransaction(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ error: 'Failed to delete transaction' });
    }
  });



  // Create the server
  const httpServer = createServer(app);
  return httpServer;
}
