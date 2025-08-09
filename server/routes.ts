import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertAccountTypeSchema,
  insertAccountSchema,
  insertFamilyMemberSchema,
  insertHuvudkategoriSchema, 
  insertUnderkategoriSchema, 
  insertCategoryRuleSchema,
  insertTransactionSchema,
  insertMonthlyBudgetSchema,
  insertMonthlyAccountBalanceSchema,
  insertBudgetPostSchema,
  insertBankSchema,
  insertBankCsvMappingSchema,
  insertPlannedTransferSchema,
  insertInkomstkallSchema,
  insertInkomstkallorMedlemSchema
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
      // console.log('Bootstrap data:', JSON.stringify(data, null, 2)); // Disabled for performance
      res.json(data);
    } catch (error) {
      console.error('Error bootstrapping:', error);
      res.status(500).json({ error: 'Failed to bootstrap' });
    }
  });

  // Restore backup route for importing complete data backups
  app.post("/api/restore-backup", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      console.log('Restore backup request with userId:', userId);
      
      const backupData = req.body;
      console.log('Backup data keys:', Object.keys(backupData));
      
      // Implement full restore functionality
      if (backupData.version && backupData.version.startsWith('4.')) {
        console.log('Processing version 4.x backup - full SQL restore');
        
        // Delete all existing user data first
        console.log('Deleting existing user data...');
        await Promise.all([
          // Delete in order to avoid foreign key constraints
          storage.getTransactions ? storage.getTransactions(userId).then(transactions => 
            Promise.all(transactions.map(t => storage.deleteTransaction(t.id)))) : Promise.resolve(),
          storage.getCategoryRules ? storage.getCategoryRules(userId).then(rules => 
            Promise.all(rules.map(r => storage.deleteCategoryRule(r.id)))) : Promise.resolve(),
          storage.getUnderkategorier ? storage.getUnderkategorier(userId).then(underKats => 
            Promise.all(underKats.map(u => storage.deleteUnderkategori(u.id)))) : Promise.resolve(),
          storage.getHuvudkategorier ? storage.getHuvudkategorier(userId).then(huvudKats => 
            Promise.all(huvudKats.map(h => storage.deleteHuvudkategori(h.id)))) : Promise.resolve(),
          storage.getAccounts ? storage.getAccounts(userId).then(accounts => 
            Promise.all(accounts.map(a => storage.deleteAccount(a.id)))) : Promise.resolve(),
          storage.getAccountTypes ? storage.getAccountTypes(userId).then(accountTypes => 
            Promise.all(accountTypes.map(at => storage.deleteAccountType(at.id)))) : Promise.resolve(),
        ]);
        
        console.log('Restoring new data...');
        
        // Restore data in correct order
        if (backupData.accountTypes) {
          for (const accountType of backupData.accountTypes) {
            const { id, createdAt, updatedAt, ...createData } = accountType;
            await storage.createAccountType({ ...createData, userId });
          }
        }
        
        if (backupData.accounts) {
          for (const account of backupData.accounts) {
            const { id, ...createData } = account;
            await storage.createAccount({ ...createData, userId });
          }
        }
        
        if (backupData.huvudkategorier) {
          for (const hovedkat of backupData.huvudkategorier) {
            const { id, ...createData } = hovedkat;
            await storage.createHuvudkategori({ ...createData, userId });
          }
        }
        
        if (backupData.underkategorier) {
          for (const underkat of backupData.underkategorier) {
            const { id, ...createData } = underkat;
            await storage.createUnderkategori({ ...createData, userId });
          }
        }
        
        if (backupData.categoryRules) {
          for (const rule of backupData.categoryRules) {
            const { id, ...createData } = rule;
            await storage.createCategoryRule({ ...createData, userId });
          }
        }
        
        if (backupData.transactions) {
          for (const transaction of backupData.transactions) {
            const { id, ...createData } = transaction;
            await storage.createTransaction({ ...createData, userId });
          }
        }
        
        console.log('Restore completed successfully');
        res.json({ 
          success: true, 
          message: 'All data restored successfully from SQL backup',
          restored: {
            accountTypes: backupData.accountTypes?.length || 0,
            accounts: backupData.accounts?.length || 0,
            huvudkategorier: backupData.huvudkategorier?.length || 0,
            underkategorier: backupData.underkategorier?.length || 0,
            categoryRules: backupData.categoryRules?.length || 0,
            transactions: backupData.transactions?.length || 0
          }
        });
      } else {
        res.status(400).json({ 
          error: 'Unsupported backup version. Please use a version 4.x backup file.' 
        });
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      res.status(500).json({ error: 'Failed to restore backup: ' + (error instanceof Error ? error.message : String(error)) });
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

  // Account Types routes
  app.get("/api/account-types", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const accountTypes = await storage.getAccountTypes(userId);
      res.json(accountTypes);
    } catch (error) {
      console.error('Error fetching account types:', error);
      res.status(500).json({ error: 'Failed to fetch account types' });
    }
  });

  app.get("/api/account-types/:id", async (req, res) => {
    try {
      const accountType = await storage.getAccountType(req.params.id);
      if (!accountType) {
        return res.status(404).json({ error: 'Account type not found' });
      }
      res.json(accountType);
    } catch (error) {
      console.error('Error fetching account type:', error);
      res.status(500).json({ error: 'Failed to fetch account type' });
    }
  });

  app.post("/api/account-types", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertAccountTypeSchema.parse({
        ...req.body,
        userId
      });
      const accountType = await storage.createAccountType(validatedData);
      res.status(201).json(accountType);
    } catch (error) {
      console.error('Error creating account type:', error);
      res.status(400).json({ error: 'Failed to create account type' });
    }
  });

  app.patch("/api/account-types/:id", async (req, res) => {
    try {
      const updateData = insertAccountTypeSchema.partial().parse(req.body);
      const accountType = await storage.updateAccountType(req.params.id, updateData);
      if (!accountType) {
        return res.status(404).json({ error: 'Account type not found' });
      }
      res.json(accountType);
    } catch (error) {
      console.error('Error updating account type:', error);
      res.status(400).json({ error: 'Failed to update account type' });
    }
  });

  app.delete("/api/account-types/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAccountType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Account type not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting account type:', error);
      res.status(500).json({ error: 'Failed to delete account type' });
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

  // Income sources (Inkomstkällor) routes
  app.get("/api/inkomstkallor", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const inkomstkallor = await storage.getInkomstkallor(userId);
      res.json(inkomstkallor);
    } catch (error) {
      console.error('Error fetching inkomstkällor:', error);
      res.status(500).json({ error: 'Failed to fetch inkomstkällor' });
    }
  });

  app.get("/api/inkomstkallor/:id", async (req, res) => {
    try {
      const inkomstkall = await storage.getInkomstkall(req.params.id);
      if (!inkomstkall) {
        return res.status(404).json({ error: 'Inkomstkälla not found' });
      }
      res.json(inkomstkall);
    } catch (error) {
      console.error('Error fetching inkomstkälla:', error);
      res.status(500).json({ error: 'Failed to fetch inkomstkälla' });
    }
  });

  app.post("/api/inkomstkallor", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertInkomstkallSchema.parse({
        ...req.body,
        userId
      });
      const inkomstkall = await storage.createInkomstkall(validatedData);
      res.status(201).json(inkomstkall);
    } catch (error) {
      console.error('Error creating inkomstkälla:', error);
      res.status(400).json({ error: 'Failed to create inkomstkälla' });
    }
  });

  app.patch("/api/inkomstkallor/:id", async (req, res) => {
    try {
      const updateData = insertInkomstkallSchema.partial().parse(req.body);
      const inkomstkall = await storage.updateInkomstkall(req.params.id, updateData);
      if (!inkomstkall) {
        return res.status(404).json({ error: 'Inkomstkälla not found' });
      }
      res.json(inkomstkall);
    } catch (error) {
      console.error('Error updating inkomstkälla:', error);
      res.status(400).json({ error: 'Failed to update inkomstkälla' });
    }
  });

  app.delete("/api/inkomstkallor/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteInkomstkall(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Inkomstkälla not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting inkomstkälla:', error);
      res.status(500).json({ error: 'Failed to delete inkomstkälla' });
    }
  });

  // Income source member assignments routes
  app.get("/api/inkomstkallor-medlem", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const assignments = await storage.getInkomstkallorMedlem(userId);
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching inkomstkällor medlem:', error);
      res.status(500).json({ error: 'Failed to fetch inkomstkällor medlem' });
    }
  });

  app.post("/api/inkomstkallor-medlem", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertInkomstkallorMedlemSchema.parse({
        ...req.body,
        userId
      });
      const assignment = await storage.createInkomstkallorMedlem(validatedData);
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error creating inkomstkällor medlem:', error);
      res.status(400).json({ error: 'Failed to create inkomstkällor medlem' });
    }
  });

  app.patch("/api/inkomstkallor-medlem/:id", async (req, res) => {
    try {
      const updateData = insertInkomstkallorMedlemSchema.partial().parse(req.body);
      const assignment = await storage.updateInkomstkallorMedlem(req.params.id, updateData);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      res.json(assignment);
    } catch (error) {
      console.error('Error updating inkomstkällor medlem:', error);
      res.status(400).json({ error: 'Failed to update inkomstkällor medlem' });
    }
  });

  app.delete("/api/inkomstkallor-medlem/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteInkomstkallorMedlem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting inkomstkällor medlem:', error);
      res.status(500).json({ error: 'Failed to delete inkomstkällor medlem' });
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
      console.log('🔍 [SERVER ROUTE] Received rule data:', JSON.stringify(req.body, null, 2));
      console.log('🔍 [SERVER ROUTE] Received autoApproval:', req.body.autoApproval, typeof req.body.autoApproval);
      const validatedData = insertCategoryRuleSchema.parse({
        ...req.body,
        userId
      });
      console.log('🔍 [SERVER ROUTE] Validated rule data:', JSON.stringify(validatedData, null, 2));
      console.log('🔍 [SERVER ROUTE] Validated autoApproval:', validatedData.autoApproval, typeof validatedData.autoApproval);
      const rule = await storage.createCategoryRule(validatedData);
      console.log('🔍 [SERVER ROUTE] Created rule:', JSON.stringify(rule, null, 2));
      res.status(201).json(rule);
    } catch (error) {
      console.error('Error creating category rule:', error);
      res.status(400).json({ error: 'Failed to create category rule' });
    }
  });

  app.patch("/api/category-rules/:id", async (req, res) => {
    try {
      console.log(`🔍 [PATCH RULE] Updating rule ${req.params.id} with data:`, req.body);
      const updateData = insertCategoryRuleSchema.partial().parse(req.body);
      console.log(`🔍 [PATCH RULE] Validated update data:`, updateData);
      const rule = await storage.updateCategoryRule(req.params.id, updateData);
      if (!rule) {
        return res.status(404).json({ error: 'Category rule not found' });
      }
      res.json(rule);
    } catch (error) {
      console.error('❌ [PATCH RULE] Error updating category rule:', error);
      console.error('❌ [PATCH RULE] Request body was:', req.body);
      console.error('❌ [PATCH RULE] Rule ID was:', req.params.id);
      res.status(400).json({ error: 'Failed to update category rule', details: error instanceof Error ? error.message : String(error) });
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
      
      // DEBUG: Log a few transaction amounts to verify they're coming through correctly
      if (transactions.length > 0) {
        console.log('Getting transactions for userId:', userId);
        console.log('Found transactions:', transactions.length);
        const sample = transactions.slice(0, 3);
        sample.forEach((tx, i) => {
          console.log(`Sample tx ${i}: amount=${tx.amount}, description="${tx.description}"`);
        });
        
        // Special debug for savingsTargetId field
        const savingsTransactions = transactions.filter(tx => tx.savingsTargetId);
        console.log(`🔍 [API] Found ${savingsTransactions.length} transactions with savingsTargetId:`);
        savingsTransactions.slice(0, 5).forEach(tx => {
          console.log(`  - ID: ${tx.id}, savingsTargetId: ${tx.savingsTargetId}, description: "${tx.description}"`);
        });
        
        // Special debug for our target transactions
        const targetTransactions = transactions.filter(tx => 
          tx.id === 'edece0e6-59d1-4967-a90b-28ef3c4bfc2f' || tx.id === 'efe00305-a8c4-4906-a493-28ebea93af0e'
        );
        if (targetTransactions.length > 0) {
          console.log(`🚨 [API] Target LÖN transactions debug:`);
          targetTransactions.forEach(tx => {
            console.log(`  - ID: ${tx.id}, savingsTargetId: ${tx.savingsTargetId || 'MISSING'}, description: "${tx.description}"`);
          });
        }
      }
      
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
      console.log('🔍 [API] Raw request body before validation:', req.body);
      
      // Validate and convert the partial update data
      const updateData = insertTransactionSchema.partial().parse(req.body);
      
      console.log('🔍 [API] Parsed updateData after validation:', updateData);
      
      // Debug logging for savingsTargetId updates
      if (updateData.savingsTargetId !== undefined) {
        console.log(`🔄 [API] Updating transaction ${req.params.id} with savingsTargetId:`, updateData.savingsTargetId);
        console.log(`🔄 [API] Full updateData:`, updateData);
        console.log(`🔄 [API] Raw request body:`, req.body);
      }
      
      // Convert date string to Date object if date is being updated
      if (updateData.date && typeof updateData.date === 'string') {
        updateData.date = new Date(updateData.date);
      }
      
      const transaction = await storage.updateTransaction(req.params.id, updateData);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      // Debug logging for response
      if (updateData.savingsTargetId !== undefined) {
        console.log(`✅ [API] Updated transaction response:`, { 
          id: transaction.id, 
          savingsTargetId: transaction.savingsTargetId,
          savings_target_id: (transaction as any).savings_target_id,
          rawTransaction: transaction
        });
        
        // Also check what's actually in the database with raw SQL
        try {
          const { Pool } = await import('pg');
          if (process.env.DATABASE_URL) {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            const result = await pool.query('SELECT id, savings_target_id FROM transactions WHERE id = $1', [req.params.id]);
            console.log(`🔍 [API] Raw database check:`, result.rows[0]);
            await pool.end();
          }
        } catch (dbError) {
          console.log(`❌ [API] Database check failed:`, dbError);
        }
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

  // Test endpoint for savingsTargetId validation
  app.post("/api/test-savings-target", async (req, res) => {
    try {
      console.log('🧪 [TEST] Raw request body:', req.body);
      const updateData = insertTransactionSchema.partial().parse(req.body);
      console.log('🧪 [TEST] Parsed data:', updateData);
      
      res.json({ 
        success: true, 
        rawBody: req.body, 
        parsedData: updateData,
        hasSavingsTargetId: 'savingsTargetId' in updateData,
        savingsTargetIdValue: updateData.savingsTargetId 
      });
    } catch (error) {
      console.log('🧪 [TEST] Validation error:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Debug endpoint to trigger transaction reload in frontend
  app.post("/api/debug/trigger-reload", async (req, res) => {
    try {
      console.log('🔄 [DEBUG] Trigger reload endpoint called');
      res.json({ success: true, message: 'Reload triggered - check frontend logs' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to trigger reload' });
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

  // Bulk delete transactions by account and date range
  app.post("/api/transactions/bulk-delete", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { accountId, startDate, endDate } = req.body;
      
      if (!accountId || !startDate || !endDate) {
        return res.status(400).json({ error: 'accountId, startDate, and endDate are required' });
      }
      
      console.log(`[BULK DELETE] Deleting transactions for account ${accountId} from ${startDate} to ${endDate}`);
      
      // Get transactions to delete first
      const transactionsToDelete = await storage.getTransactionsInDateRangeByAccount(userId, accountId, new Date(startDate), new Date(endDate));
      
      let deletedCount = 0;
      for (const tx of transactionsToDelete) {
        const deleted = await storage.deleteTransaction(tx.id);
        if (deleted) deletedCount++;
      }
      
      console.log(`[BULK DELETE] Successfully deleted ${deletedCount} transactions`);
      res.json({ deletedCount });
    } catch (error) {
      console.error('Error bulk deleting transactions:', error);
      res.status(500).json({ error: 'Failed to bulk delete transactions' });
    }
  });

  // Bulk create transactions
  app.post("/api/transactions/bulk-create", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { transactions } = req.body;
      
      if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: 'transactions array is required' });
      }
      
      console.log(`[BULK CREATE] Creating ${transactions.length} transactions`);
      
      let createdCount = 0;
      const createdTransactions = [];
      
      for (const txData of transactions) {
        try {
          const validatedData = insertTransactionSchema.parse({
            ...txData,
            userId,
            date: new Date(txData.date)
          });
          
          const transaction = await storage.createTransaction(validatedData);
          createdTransactions.push(transaction);
          createdCount++;
        } catch (error) {
          console.warn(`[BULK CREATE] Failed to create transaction:`, error);
        }
      }
      
      console.log(`[BULK CREATE] Successfully created ${createdCount}/${transactions.length} transactions`);
      res.json({ createdCount, transactions: createdTransactions });
    } catch (error) {
      console.error('Error bulk creating transactions:', error);
      res.status(500).json({ error: 'Failed to bulk create transactions' });
    }
  });

  // Bulk delete transactions by IDs
  app.post("/api/transactions/bulk-delete-by-ids", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: 'ids array is required' });
      }
      
      console.log(`[BULK DELETE BY IDS] Deleting ${ids.length} transactions by IDs`);
      
      let deletedCount = 0;
      
      for (const id of ids) {
        try {
          const success = await storage.deleteTransaction(id);
          if (success) deletedCount++;
        } catch (error) {
          console.warn(`[BULK DELETE BY IDS] Failed to delete transaction ${id}:`, error);
        }
      }
      
      console.log(`[BULK DELETE BY IDS] Successfully deleted ${deletedCount}/${ids.length} transactions`);
      res.json({ deletedCount });
    } catch (error) {
      console.error('Error bulk deleting transactions by IDs:', error);
      res.status(500).json({ error: 'Failed to bulk delete transactions by IDs' });
    }
  });

  // Bulk update transactions
  app.post("/api/transactions/bulk-update", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { transactions } = req.body;
      
      if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: 'transactions array is required' });
      }
      
      console.log(`[BULK UPDATE] Updating ${transactions.length} transactions`);
      
      let updatedCount = 0;
      const updatedTransactions = [];
      
      for (const txData of transactions) {
        try {
          if (!txData.id) {
            console.warn(`[BULK UPDATE] Skipping transaction without ID`);
            continue;
          }
          
          const { id, ...updateData } = txData;
          
          // Parse the update data
          const validatedData = insertTransactionSchema.partial().parse({
            ...updateData,
            date: updateData.date ? new Date(updateData.date) : undefined
          });
          
          const transaction = await storage.updateTransaction(id, validatedData);
          if (transaction) {
            updatedTransactions.push(transaction);
            updatedCount++;
          }
        } catch (error) {
          console.warn(`[BULK UPDATE] Failed to update transaction:`, error);
        }
      }
      
      console.log(`[BULK UPDATE] Successfully updated ${updatedCount}/${transactions.length} transactions`);
      res.json({ updatedCount, transactions: updatedTransactions });
    } catch (error) {
      console.error('Error bulk updating transactions:', error);
      res.status(500).json({ error: 'Failed to bulk update transactions' });
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

  // Budget Posts routes
  app.get("/api/budget-posts", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const monthKey = req.query.monthKey as string;
      const budgetPosts = await storage.getBudgetPosts(userId, monthKey);
      res.json(budgetPosts);
    } catch (error) {
      console.error('Error fetching budget posts:', error);
      res.status(500).json({ error: 'Failed to fetch budget posts' });
    }
  });

  app.get("/api/budget-posts/:id", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { id } = req.params;
      const budgetPost = await storage.getBudgetPost(userId, id);
      if (!budgetPost) {
        return res.status(404).json({ error: 'Budget post not found' });
      }
      res.json(budgetPost);
    } catch (error) {
      console.error('Error fetching budget post:', error);
      res.status(500).json({ error: 'Failed to fetch budget post' });
    }
  });

  app.post("/api/budget-posts", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      console.log('POST /api/budget-posts - Request body:', JSON.stringify(req.body, null, 2));
      const validatedData = insertBudgetPostSchema.parse({
        ...req.body,
        userId
      });
      console.log('POST /api/budget-posts - Validated data:', JSON.stringify(validatedData, null, 2));
      const budgetPost = await storage.createBudgetPost(validatedData);
      console.log('POST /api/budget-posts - Created budget post:', JSON.stringify({
        id: budgetPost.id,
        type: budgetPost.type,
        accountUserBalance: budgetPost.accountUserBalance,
        accountBalance: budgetPost.accountBalance
      }, null, 2));
      res.status(201).json(budgetPost);
    } catch (error) {
      console.error('Error creating budget post:', error);
      res.status(400).json({ error: 'Failed to create budget post' });
    }
  });

  app.patch("/api/budget-posts/:id", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { id } = req.params;
      console.log('PATCH /api/budget-posts/:id - Request body:', JSON.stringify(req.body, null, 2));
      const updateData = insertBudgetPostSchema.partial().parse(req.body);
      console.log('PATCH /api/budget-posts/:id - Parsed update data:', JSON.stringify(updateData, null, 2));
      const budgetPost = await storage.updateBudgetPost(userId, id, updateData);
      if (!budgetPost) {
        return res.status(404).json({ error: 'Budget post not found' });
      }
      console.log('PATCH /api/budget-posts/:id - Updated budget post:', JSON.stringify({
        id: budgetPost.id,
        type: budgetPost.type,
        accountUserBalance: budgetPost.accountUserBalance,
        accountBalance: budgetPost.accountBalance
      }, null, 2));
      res.json(budgetPost);
    } catch (error) {
      console.error('Error updating budget post:', error);
      res.status(400).json({ error: 'Failed to update budget post' });
    }
  });

  app.delete("/api/budget-posts/:id", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { id } = req.params;
      const deleted = await storage.deleteBudgetPost(userId, id);
      if (!deleted) {
        return res.status(404).json({ error: 'Budget post not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting budget post:', error);
      res.status(500).json({ error: 'Failed to delete budget post' });
    }
  });

  // Bank routes
  app.get("/api/banks", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const banks = await storage.getBanks(userId);
      res.json(banks);
    } catch (error) {
      console.error('Error fetching banks:', error);
      res.status(500).json({ error: 'Failed to fetch banks' });
    }
  });

  app.post("/api/banks", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertBankSchema.parse({
        ...req.body,
        userId
      });
      const bank = await storage.createBank(validatedData);
      res.status(201).json(bank);
    } catch (error) {
      console.error('Error creating bank:', error);
      res.status(400).json({ error: 'Failed to create bank' });
    }
  });

  app.delete("/api/banks/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBank(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Bank not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting bank:', error);
      res.status(500).json({ error: 'Failed to delete bank' });
    }
  });

  // Bank CSV mapping routes
  app.get("/api/bank-csv-mappings", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const mappings = await storage.getBankCsvMappings(userId);
      res.json(mappings);
    } catch (error) {
      console.error('Error fetching bank CSV mappings:', error);
      res.status(500).json({ error: 'Failed to fetch bank CSV mappings' });
    }
  });

  app.get("/api/bank-csv-mappings/bank/:bankId", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const mappings = await storage.getBankCsvMappingsByBank(userId, req.params.bankId);
      res.json(mappings);
    } catch (error) {
      console.error('Error fetching bank CSV mappings for bank:', error);
      res.status(500).json({ error: 'Failed to fetch bank CSV mappings for bank' });
    }
  });

  app.post("/api/bank-csv-mappings", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertBankCsvMappingSchema.parse({
        ...req.body,
        userId
      });
      const mapping = await storage.createBankCsvMapping(validatedData);
      res.status(201).json(mapping);
    } catch (error) {
      console.error('Error creating bank CSV mapping:', error);
      res.status(400).json({ error: 'Failed to create bank CSV mapping' });
    }
  });

  app.patch("/api/bank-csv-mappings/:id", async (req, res) => {
    try {
      const updateData = insertBankCsvMappingSchema.partial().parse(req.body);
      const mapping = await storage.updateBankCsvMapping(req.params.id, updateData);
      if (!mapping) {
        return res.status(404).json({ error: 'Bank CSV mapping not found' });
      }
      res.json(mapping);
    } catch (error) {
      console.error('Error updating bank CSV mapping:', error);
      res.status(400).json({ error: 'Failed to update bank CSV mapping' });
    }
  });

  app.delete("/api/bank-csv-mappings/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBankCsvMapping(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Bank CSV mapping not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting bank CSV mapping:', error);
      res.status(500).json({ error: 'Failed to delete bank CSV mapping' });
    }
  });

  // Monthly Account Balances routes
  app.get("/api/monthly-account-balances", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const monthKey = req.query.monthKey as string;
      const balances = await storage.getMonthlyAccountBalances(userId, monthKey);
      res.json(balances);
    } catch (error) {
      console.error('Error fetching monthly account balances:', error);
      res.status(500).json({ error: 'Failed to fetch monthly account balances' });
    }
  });

  app.post("/api/monthly-account-balances", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertMonthlyAccountBalanceSchema.parse({
        ...req.body,
        userId
      });
      const balance = await storage.saveMonthlyAccountBalance(validatedData);
      res.status(201).json(balance);
    } catch (error) {
      console.error('Error saving monthly account balance:', error);
      res.status(400).json({ error: 'Failed to save monthly account balance' });
    }
  });

  app.post("/api/monthly-account-balances/upsert", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertMonthlyAccountBalanceSchema.parse({
        ...req.body,
        userId
      });
      const result = await storage.upsertMonthlyAccountBalance(validatedData);
      res.json(result);
    } catch (error) {
      console.error('Error upserting monthly account balance:', error);
      res.status(400).json({ error: 'Failed to upsert monthly account balance' });
    }
  });

  app.put("/api/monthly-account-balances/:monthKey/:accountId/faktiskt-kontosaldo", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { monthKey, accountId } = req.params;
      const { faktisktKontosaldo } = req.body;
      
      console.log(`Updating faktiskt kontosaldo for account ${accountId}, month ${monthKey}, value:`, faktisktKontosaldo, typeof faktisktKontosaldo);
      
      const result = await storage.updateFaktisktKontosaldo(userId, monthKey, accountId, faktisktKontosaldo);
      
      console.log('Update result:', result);
      
      if (result) {
        res.json(result);
      } else {
        res.status(404).json({ error: 'Monthly account balance not found' });
      }
    } catch (error) {
      console.error('Error updating faktiskt kontosaldo:', error);
      res.status(400).json({ error: 'Failed to update faktiskt kontosaldo' });
    }
  });

  app.put("/api/monthly-account-balances/:monthKey/:accountId/bankens-kontosaldo", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { monthKey, accountId } = req.params;
      const { bankensKontosaldo } = req.body;
      
      const result = await storage.updateBankensKontosaldo(userId, monthKey, accountId, bankensKontosaldo);
      
      if (result) {
        res.json(result);
      } else {
        res.status(404).json({ error: 'Monthly account balance not found' });
      }
    } catch (error) {
      console.error('Error updating bankens kontosaldo:', error);
      res.status(400).json({ error: 'Failed to update bankens kontosaldo' });
    }
  });

  // Planned Transfers routes
  app.get("/api/planned-transfers", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const month = req.query.month as string;
      const transfers = await storage.getPlannedTransfers(userId, month);
      res.json(transfers);
    } catch (error) {
      console.error('Error fetching planned transfers:', error);
      res.status(500).json({ error: 'Failed to fetch planned transfers' });
    }
  });

  app.post("/api/planned-transfers", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      
      // Convert amounts from SEK to öre (multiply by 100)
      const transferData = {
        ...req.body,
        userId,
        amount: Math.round((req.body.amount || 0) * 100),
        dailyAmount: req.body.dailyAmount ? Math.round(req.body.dailyAmount * 100) : undefined,
        transferDays: req.body.transferDays ? JSON.stringify(req.body.transferDays) : undefined
      };
      
      const validatedData = insertPlannedTransferSchema.parse(transferData);
      const transfer = await storage.createPlannedTransfer(validatedData);
      res.status(201).json(transfer);
    } catch (error) {
      console.error('Error creating planned transfer:', error);
      res.status(400).json({ error: 'Failed to create planned transfer' });
    }
  });

  app.put("/api/planned-transfers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Convert amounts from SEK to öre if present
      const updateData = { ...req.body };
      if (updateData.amount !== undefined) {
        updateData.amount = Math.round(updateData.amount * 100);
      }
      if (updateData.dailyAmount !== undefined) {
        updateData.dailyAmount = Math.round(updateData.dailyAmount * 100);
      }
      if (updateData.transferDays !== undefined) {
        updateData.transferDays = JSON.stringify(updateData.transferDays);
      }
      
      const transfer = await storage.updatePlannedTransfer(id, updateData);
      if (transfer) {
        res.json(transfer);
      } else {
        res.status(404).json({ error: 'Planned transfer not found' });
      }
    } catch (error) {
      console.error('Error updating planned transfer:', error);
      res.status(400).json({ error: 'Failed to update planned transfer' });
    }
  });

  app.delete("/api/planned-transfers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePlannedTransfer(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting planned transfer:', error);
      res.status(400).json({ error: 'Failed to delete planned transfer' });
    }
  });

  // Create the server
  const httpServer = createServer(app);
  return httpServer;
}
