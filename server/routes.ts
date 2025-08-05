import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertAccountSchema,
  insertFamilyMemberSchema,
  insertHuvudkategoriSchema, 
  insertUnderkategoriSchema, 
  insertCategoryRuleSchema,
  insertTransactionSchema,
  insertMonthlyBudgetSchema,
  insertBudgetPostSchema
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

  // Family member routes
  app.get("/api/family-members", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const familyMembers = await storage.getFamilyMembers(userId);
      res.json(familyMembers);
    } catch (error) {
      console.error('Error fetching family members:', error);
      res.status(500).json({ error: 'Failed to fetch family members' });
    }
  });

  app.get("/api/family-members/:id", async (req, res) => {
    try {
      const familyMember = await storage.getFamilyMember(req.params.id);
      if (!familyMember) {
        return res.status(404).json({ error: 'Family member not found' });
      }
      res.json(familyMember);
    } catch (error) {
      console.error('Error fetching family member:', error);
      res.status(500).json({ error: 'Failed to fetch family member' });
    }
  });

  app.post("/api/family-members", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertFamilyMemberSchema.parse({
        ...req.body,
        userId
      });
      const familyMember = await storage.createFamilyMember(validatedData);
      res.status(201).json(familyMember);
    } catch (error) {
      console.error('Error creating family member:', error);
      res.status(400).json({ error: 'Failed to create family member' });
    }
  });

  app.patch("/api/family-members/:id", async (req, res) => {
    try {
      const updateData = insertFamilyMemberSchema.partial().parse(req.body);
      const familyMember = await storage.updateFamilyMember(req.params.id, updateData);
      if (!familyMember) {
        return res.status(404).json({ error: 'Family member not found' });
      }
      res.json(familyMember);
    } catch (error) {
      console.error('Error updating family member:', error);
      res.status(400).json({ error: 'Failed to update family member' });
    }
  });

  app.delete("/api/family-members/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFamilyMember(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Family member not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting family member:', error);
      res.status(500).json({ error: 'Failed to delete family member' });
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
      
      // Convert date string to Date object before validation
      const requestData = {
        ...req.body,
        userId,
        date: new Date(req.body.date) // Convert string date to Date object
      };
      
      const validatedData = insertTransactionSchema.parse(requestData);
      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(400).json({ error: 'Failed to create transaction' });
    }
  });

  // NEW: Intelligent transaction synchronization endpoint
  app.post("/api/transactions/synchronize", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const fileTransactions = req.body.transactions;
      
      if (!fileTransactions || !Array.isArray(fileTransactions)) {
        return res.status(400).json({ error: 'transactions array is required' });
      }

      console.log(`[SYNC] Starting synchronization for ${fileTransactions.length} transactions from file`);

      // Step 1: Identify date range from file data
      const dates = fileTransactions.map(tx => new Date(tx.date)).sort((a, b) => a.getTime() - b.getTime());
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      
      console.log(`[SYNC] Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

      // Step 2: Get existing transactions in this date range from database
      const existingTransactions = await storage.getTransactionsInDateRange(userId, startDate, endDate);
      console.log(`[SYNC] Found ${existingTransactions.length} existing transactions in date range`);

      const syncStats = {
        created: 0,
        updated: 0,
        deleted: 0,
        skipped: 0
      };

      // Step 3: Process each transaction from file
      const processedTransactionIds = new Set<string>();

      for (const fileTx of fileTransactions) {
        try {
          // Convert file transaction to proper format
          const txData = {
            ...fileTx,
            userId,
            date: new Date(fileTx.date),
            isManuallyChanged: fileTx.isManuallyChanged === 'true' || fileTx.isManuallyChanged === true ? 'true' : 'false'
          };

          // Try to find matching existing transaction (by date, description, amount)
          const matchingTx = existingTransactions.find(existing => {
            const sameDate = existing.date.toISOString().split('T')[0] === new Date(fileTx.date).toISOString().split('T')[0];
            const sameDescription = existing.description === fileTx.description;
            const sameAmount = Math.abs(existing.amount - fileTx.amount) < 0.01;
            return sameDate && sameDescription && sameAmount;
          });

          if (matchingTx) {
            // UPDATE existing transaction
            processedTransactionIds.add(matchingTx.id);
            
            if (matchingTx.isManuallyChanged === 'true') {
              // Preserve manually changed fields: appCategoryId, appSubCategoryId, type, userDescription
              const preservedFields = {
                appCategoryId: matchingTx.appCategoryId,
                appSubCategoryId: matchingTx.appSubCategoryId,
                type: matchingTx.type,
                userDescription: matchingTx.userDescription
              };
              
              // Update all other fields
              const updateData = {
                ...txData,
                ...preservedFields, // Override with preserved fields
                isManuallyChanged: 'true' // Keep the manual flag as string
              };
              
              await storage.updateTransaction(matchingTx.id, updateData);
              syncStats.updated++;
              console.log(`[SYNC] Updated manually changed transaction: ${matchingTx.id}`);
            } else {
              // Update all fields and run through categorization
              const validatedData = insertTransactionSchema.parse(txData);
              await storage.updateTransaction(matchingTx.id, validatedData);
              syncStats.updated++;
              console.log(`[SYNC] Updated clean transaction: ${matchingTx.id}`);
            }
          } else {
            // CREATE new transaction
            const validatedData = insertTransactionSchema.parse(txData);
            const newTransaction = await storage.createTransaction(validatedData);
            processedTransactionIds.add(newTransaction.id);
            syncStats.created++;
            console.log(`[SYNC] Created new transaction: ${newTransaction.id}`);
          }
        } catch (error) {
          console.error(`[SYNC] Error processing transaction:`, error);
          syncStats.skipped++;
        }
      }

      // Step 4: Delete transactions that exist in DB but not in file (within date range)
      const transactionsToDelete = existingTransactions.filter(existing => 
        !processedTransactionIds.has(existing.id)
      );

      for (const txToDelete of transactionsToDelete) {
        await storage.deleteTransaction(txToDelete.id);
        syncStats.deleted++;
        console.log(`[SYNC] Deleted removed transaction: ${txToDelete.id}`);
      }

      console.log(`[SYNC] Synchronization complete:`, syncStats);

      res.json({
        success: true,
        stats: syncStats,
        message: `Synchronization complete: ${syncStats.created} created, ${syncStats.updated} updated, ${syncStats.deleted} deleted`
      });

    } catch (error) {
      console.error('Error synchronizing transactions:', error);
      res.status(500).json({ error: 'Failed to synchronize transactions' });
    }
  });

  app.put("/api/transactions/:id", async (req, res) => {
    try {
      // Validate and convert the partial update data
      const updateData = insertTransactionSchema.partial().parse(req.body);
      
      // Convert date string to Date object if date is being updated
      if (updateData.date && typeof updateData.date === 'string') {
        updateData.date = new Date(updateData.date);
      }
      
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

  // Monthly Budget routes
  app.get("/api/monthly-budgets", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const budgets = await storage.getMonthlyBudgets(userId);
      res.json(budgets);
    } catch (error) {
      console.error('Error fetching monthly budgets:', error);
      res.status(500).json({ error: 'Failed to fetch monthly budgets' });
    }
  });

  app.get("/api/monthly-budgets/:monthKey", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { monthKey } = req.params;
      const budget = await storage.getMonthlyBudget(userId, monthKey);
      if (!budget) {
        return res.status(404).json({ error: 'Monthly budget not found' });
      }
      res.json(budget);
    } catch (error) {
      console.error('Error fetching monthly budget:', error);
      res.status(500).json({ error: 'Failed to fetch monthly budget' });
    }
  });

  app.post("/api/monthly-budgets", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertMonthlyBudgetSchema.parse({
        ...req.body,
        userId
      });
      const budget = await storage.createMonthlyBudget(validatedData);
      res.status(201).json(budget);
    } catch (error) {
      console.error('Error creating monthly budget:', error);
      res.status(400).json({ error: 'Failed to create monthly budget' });
    }
  });

  app.patch("/api/monthly-budgets/:monthKey", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { monthKey } = req.params;
      const updateData = insertMonthlyBudgetSchema.partial().parse(req.body);
      const budget = await storage.updateMonthlyBudget(userId, monthKey, updateData);
      if (!budget) {
        return res.status(404).json({ error: 'Monthly budget not found' });
      }
      res.json(budget);
    } catch (error) {
      console.error('Error updating monthly budget:', error);
      res.status(400).json({ error: 'Failed to update monthly budget' });
    }
  });

  app.delete("/api/monthly-budgets/:monthKey", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { monthKey } = req.params;
      const deleted = await storage.deleteMonthlyBudget(userId, monthKey);
      if (!deleted) {
        return res.status(404).json({ error: 'Monthly budget not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting monthly budget:', error);
      res.status(500).json({ error: 'Failed to delete monthly budget' });
    }
  });

  // Create the server
  const httpServer = createServer(app);
  return httpServer;
}
