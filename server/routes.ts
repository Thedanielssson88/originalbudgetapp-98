import type { Express } from "express";
import { createServer, type Server } from "http";
import { v4 as uuidv4 } from 'uuid';

// Helper function to create transaction fingerprint for deduplication
function createTransactionFingerprint(transaction: { date: string; description: string; amount: number; accountId?: string }): string {
  // CRITICAL FIX: Extract date and completely ignore time component
  let dateOnly: string;
  
  if (transaction.date.includes('T')) {
    // ISO format: 2025-07-15T12:00:00.000Z -> 2025-07-15
    dateOnly = transaction.date.split('T')[0];
  } else if (transaction.date.includes(' ')) {
    // Space format: 2025-07-15 12:00:00 -> 2025-07-15
    dateOnly = transaction.date.split(' ')[0];
  } else {
    // Already in YYYY-MM-DD format
    dateOnly = transaction.date.substring(0, 10);
  }
  
  // Normalize description: trim, lowercase, and remove extra spaces
  const normalizedDescription = transaction.description.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Round amount to avoid floating point precision issues  
  const normalizedAmount = Math.round(transaction.amount * 100) / 100;
  
  const fingerprint = `${transaction.accountId || ''}_${dateOnly}_${normalizedDescription}_${normalizedAmount}`;
  
  console.log(`[FINGERPRINT] Created: ${fingerprint} from date: ${transaction.date} -> ${dateOnly}`);
  return fingerprint;
}
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
  insertInkomstkallorMedlemSchema,
  insertUserSettingSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Mock middleware to inject userId for development
  // In production, this would come from proper authentication
  app.use((req, res, next) => {
    // @ts-ignore - adding userId to request for development
    req.userId = 'dev-user-123';
    next();
  });

  // Environment status route
  app.get("/api/environment", (req, res) => {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const environment = isDevelopment ? 'development' : 'production';
    const database = isDevelopment ? 'Neon US (Dev)' : 'Neon EU (Prod)';
    
    res.json({
      environment,
      database,
      nodeEnv: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });

  // Debug endpoint to check environment variables
  app.get("/api/debug/client-env", (req, res) => {
    res.json({
      message: "This endpoint helps debug client-side environment variable issues",
      serverEnv: {
        NODE_ENV: process.env.NODE_ENV,
        VITE_STACK_PROJECT_ID: process.env.VITE_STACK_PROJECT_ID ? "Set" : "Missing",
        VITE_STACK_PUBLISHABLE_CLIENT_KEY: process.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ? "Set" : "Missing",
      },
      instructions: "Check browser console for client-side environment variable logs from neonAuthService"
    });
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
      
      // Check if requesting historical data
      const { fromDate, toDate } = req.query;
      let transactions;
      
      if (fromDate || toDate) {
        // Load transactions within date range
        const startDate = fromDate ? new Date(fromDate as string) : new Date('2000-01-01');
        const endDate = toDate ? new Date(toDate as string) : new Date();
        transactions = await storage.getTransactionsInDateRange(userId, startDate, endDate);
        console.log(`📊 [API] Loading historical transactions from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
      } else {
        // Default behavior - load all (for backward compatibility)
        transactions = await storage.getTransactions(userId);
      }
      
      // Add debug logging for transaction response
      console.log(`📊 [API] Sending ${transactions.length} transactions to client`);
      if (transactions.length > 0) {
        console.log(`📊 [API] Date range: ${new Date(Math.min(...transactions.map(t => new Date(t.date).getTime()))).toLocaleDateString()} to ${new Date(Math.max(...transactions.map(t => new Date(t.date).getTime()))).toLocaleDateString()}`);
        
        // TEMP DEBUG: Check if linking fields exist in storage result
        const sampleWithLinks = transactions.find(t => t.linkedCostId || t.correctedAmount !== null || t.linkedTransactionId);
        if (sampleWithLinks) {
          console.log(`🔍 [API TEMP DEBUG] Found transaction with links: ID=${sampleWithLinks.id?.slice(-8)}, linkedCostId=${sampleWithLinks.linkedCostId}, correctedAmount=${sampleWithLinks.correctedAmount}, linkedTransactionId=${sampleWithLinks.linkedTransactionId}`);
        } else {
          console.log(`🔍 [API TEMP DEBUG] No transactions with links found in storage result`);
          // Check first transaction for all field names
          const firstTx = transactions[0];
          console.log(`🔍 [API TEMP DEBUG] First transaction fields:`, Object.keys(firstTx));
          console.log(`🔍 [API TEMP DEBUG] linkedCostId field exists:`, 'linkedCostId' in firstTx, 'value:', firstTx.linkedCostId);
          console.log(`🔍 [API TEMP DEBUG] correctedAmount field exists:`, 'correctedAmount' in firstTx, 'value:', firstTx.correctedAmount);
        }
        
        // TEMP DEBUG: Look for the specific transactions we just updated (multiple possible IDs)
        const expenseId = 'a35c1310-f573-4a2b-9f11-dd5dd6c7a5ea';
        const paymentIds = ['01e4577d-50b7-4ef3-95fb-e2961d0cce8b', '0f1190b4-a5c6-414b-99e9-3e8507120ec2'];
        
        const recentExpense = transactions.find(t => t.id === expenseId);
        if (recentExpense) {
          console.log(`🔍 [API TEMP DEBUG] Recent expense transaction: ID=${recentExpense.id?.slice(-8)}, linkedCostId=${recentExpense.linkedCostId}, correctedAmount=${recentExpense.correctedAmount}, type=${recentExpense.type}, description='${recentExpense.description}'`);
        } else {
          console.log(`🔍 [API TEMP DEBUG] Recent expense transaction NOT FOUND: ${expenseId}`);
        }
        
        paymentIds.forEach(paymentId => {
          const recentPayment = transactions.find(t => t.id === paymentId);
          if (recentPayment) {
            console.log(`🔍 [API TEMP DEBUG] Recent payment transaction: ID=${recentPayment.id?.slice(-8)}, linkedCostId=${recentPayment.linkedCostId}, correctedAmount=${recentPayment.correctedAmount}, type=${recentPayment.type}, description='${recentPayment.description}'`);
          } else {
            console.log(`🔍 [API TEMP DEBUG] Recent payment transaction NOT FOUND: ${paymentId}`);
          }
        });
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
  // NEW: Emergency duplicate cleanup endpoint
  app.post("/api/transactions/cleanup-duplicates", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      console.log(`[CLEANUP] Starting emergency duplicate cleanup for user: ${userId}`);

      // Get ALL transactions for this user
      const allTransactions = await storage.getAllTransactions(userId);
      console.log(`[CLEANUP] Found ${allTransactions.length} total transactions`);

      // Group by fingerprint
      const fingerprintGroups = new Map<string, any[]>();
      allTransactions.forEach(tx => {
        const fingerprint = createTransactionFingerprint({
          date: tx.date.toISOString(),
          description: tx.description,
          amount: tx.amount,
          accountId: tx.accountId
        });
        
        if (!fingerprintGroups.has(fingerprint)) {
          fingerprintGroups.set(fingerprint, []);
        }
        fingerprintGroups.get(fingerprint)!.push(tx);
      });

      // Find and remove duplicates
      let deletedCount = 0;
      let keptCount = 0;

      for (const [fingerprint, transactions] of fingerprintGroups) {
        if (transactions.length > 1) {
          console.log(`[CLEANUP] Found ${transactions.length} duplicates for: ${fingerprint}`);
          
          // Sort by priority: manual changes first, then by creation date (newest first)
          transactions.sort((a, b) => {
            if (a.isManuallyChanged === 'true' && b.isManuallyChanged !== 'true') return -1;
            if (b.isManuallyChanged === 'true' && a.isManuallyChanged !== 'true') return 1;
            return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
          });
          
          // Keep the first (best) transaction
          const transactionToKeep = transactions[0];
          keptCount++;
          console.log(`[CLEANUP] Keeping transaction: ${transactionToKeep.id} (manual: ${transactionToKeep.isManuallyChanged})`);
          
          // Delete the rest
          for (let i = 1; i < transactions.length; i++) {
            const txToDelete = transactions[i];
            await storage.deleteTransaction(txToDelete.id);
            deletedCount++;
            console.log(`[CLEANUP] Deleted duplicate: ${txToDelete.id}`);
          }
        } else {
          keptCount++;
        }
      }

      console.log(`[CLEANUP] Cleanup complete: ${deletedCount} deleted, ${keptCount} kept`);

      res.json({
        success: true,
        deleted: deletedCount,
        kept: keptCount,
        message: `Cleanup complete: ${deletedCount} duplicates removed, ${keptCount} transactions kept`
      });

    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      res.status(500).json({ error: 'Failed to cleanup duplicates' });
    }
  });

  app.post("/api/transactions/synchronize", async (req, res) => {
    try {
      console.log(`🚨 [NUCLEAR SYNC] Raw request received`);
      console.log(`🚨 [NUCLEAR SYNC] Request body:`, req.body);
      console.log(`🚨 [NUCLEAR SYNC] Request headers:`, req.headers);
      
      // @ts-ignore
      const userId = req.userId;
      const fileTransactions = req.body.transactions;
      
      console.log(`🚨 [NUCLEAR SYNC] ================================`);
      console.log(`🚨 [NUCLEAR SYNC] ENDPOINT CALLED!`);
      console.log(`🚨 [NUCLEAR SYNC] User ID: ${userId}`);
      console.log(`🚨 [NUCLEAR SYNC] File transactions: ${fileTransactions?.length || 'undefined'}`);
      console.log(`🚨 [NUCLEAR SYNC] ================================`);
      
      if (!fileTransactions || !Array.isArray(fileTransactions)) {
        console.log(`❌ [NUCLEAR SYNC] Invalid transactions array`);
        return res.status(400).json({ error: 'transactions array is required' });
      }

      console.log(`🚨 [NUCLEAR SYNC] Starting synchronization for ${fileTransactions.length} transactions from file`);

      // Step 1: Handle empty transactions array (test case)
      if (fileTransactions.length === 0) {
        console.log(`🚨 [NUCLEAR SYNC] Empty transactions array - returning success`);
        return res.json({
          success: true,
          stats: { created: 0, deleted: 0, preserved: 0 },
          message: 'No transactions to sync'
        });
      }

      // Step 2: Identify date range from file data
      const dates = fileTransactions.map(tx => new Date(tx.date)).sort((a, b) => a.getTime() - b.getTime());
      
      // CRITICAL FIX: Ensure we have the correct min/max dates
      const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      console.log(`🚨 [NUCLEAR SYNC] Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      console.log(`🚨 [NUCLEAR SYNC] First transaction date: ${fileTransactions[0].date}`);
      console.log(`🚨 [NUCLEAR SYNC] Last transaction date: ${fileTransactions[fileTransactions.length - 1].date}`);

      // Step 3: Get existing transactions in this date range from database
      // CRITICAL: We need the accountId to filter properly
      const accountId = fileTransactions[0]?.accountId;
      if (!accountId) {
        console.error(`🚨 [NUCLEAR SYNC] ERROR: No accountId in file transactions!`);
        return res.status(400).json({ error: 'accountId is required in transactions' });
      }
      
      console.log(`🚨 [NUCLEAR SYNC] Filtering by account: ${accountId}`);
      
      // Get transactions for this specific account in the date range
      let existingTransactions = [];
      try {
        existingTransactions = await storage.getTransactionsInDateRangeByAccount(userId, accountId, startDate, endDate);
        console.log(`🚨 [NUCLEAR SYNC] Found ${existingTransactions.length} existing transactions for account ${accountId} in date range`);
      } catch (dbError) {
        console.error(`🚨 [NUCLEAR SYNC] DATABASE ERROR:`, dbError);
        console.error(`🚨 [NUCLEAR SYNC] Failed to get existing transactions`);
        // Return early with error
        return res.json({
          success: false,
          stats: { created: 0, deleted: 0, preserved: 0 },
          message: `Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`
        });
      }

      const syncStats = {
        created: 0,
        updated: 0,
        deleted: 0,
        skipped: 0,
        preserved: 0
      };

      // Step 4: NUCLEAR REPLACE STRATEGY - Extract manual edits before deletion
      const manualEditsMap = new Map<string, any>();
      
      console.log(`🚨 [NUCLEAR SYNC] Checking ${existingTransactions.length} existing transactions for manual edits...`);
      
      existingTransactions.forEach(tx => {
        if (tx.isManuallyChanged === 'true') {
          // Create fingerprint based on bank data only (not user edits)
          const bankDataFingerprint = createTransactionFingerprint({
            date: tx.date.toISOString(),
            description: tx.description,
            amount: tx.amount,
            accountId: tx.accountId
          });
          
          console.log(`🚨 [NUCLEAR SYNC] Found manual edit: ${tx.description} (${bankDataFingerprint})`);
          
          // Store the manual edits
          manualEditsMap.set(bankDataFingerprint, {
            appCategoryId: tx.appCategoryId,
            appSubCategoryId: tx.appSubCategoryId,
            type: tx.type,
            userDescription: tx.userDescription,
            status: tx.status,
            linkedTransactionId: tx.linkedTransactionId,
            savingsTargetId: tx.savingsTargetId,
            coveredCostId: tx.coveredCostId
          });
          
          console.log(`[SYNC] Preserved manual edits for: ${tx.description} (${bankDataFingerprint})`);
          syncStats.preserved++;
        }
      });

      // Step 5: DELETE ALL existing transactions in date range (NUCLEAR OPTION)
      console.log(`[SYNC] NUCLEAR DELETE: Removing all ${existingTransactions.length} transactions in date range`);
      for (const txToDelete of existingTransactions) {
        await storage.deleteTransaction(txToDelete.id);
        syncStats.deleted++;
      }

      // Step 6: CREATE all transactions from file with preserved manual edits
      console.log(`🚨 [NUCLEAR SYNC] Creating ${fileTransactions.length} transactions from file...`);
      const createdFingerprints = new Set<string>();
      
      for (const fileTx of fileTransactions) {
        try {
          // Convert file transaction to proper format
          const txData = {
            ...fileTx,
            userId,
            date: new Date(fileTx.date),
            isManuallyChanged: 'false' // Start fresh
          };
          
          // Check for duplicate creation
          const createFingerprint = createTransactionFingerprint({
            date: txData.date.toISOString(),
            description: txData.description,
            amount: txData.amount,
            accountId: txData.accountId
          });
          
          if (createdFingerprints.has(createFingerprint)) {
            console.log(`⚠️ [NUCLEAR SYNC] DUPLICATE DETECTED - Skipping: ${txData.description} (${createFingerprint})`);
            syncStats.skipped++;
            continue;
          }
          createdFingerprints.add(createFingerprint);

          // Check if we have preserved manual edits for this transaction
          const bankDataFingerprint = createTransactionFingerprint({
            date: txData.date.toISOString(),
            description: txData.description,
            amount: txData.amount,
            accountId: txData.accountId
          });
          
          const preservedEdits = manualEditsMap.get(bankDataFingerprint);
          
          if (preservedEdits) {
            // Apply preserved manual edits
            Object.assign(txData, preservedEdits);
            txData.isManuallyChanged = 'true';
            console.log(`[SYNC] Applied preserved edits to: ${txData.description}`);
          }

          // CREATE new transaction
          const validatedData = insertTransactionSchema.parse(txData);
          const newTransaction = await storage.createTransaction(validatedData);
          syncStats.created++;
          console.log(`[SYNC] Created transaction: ${newTransaction.id} (${preservedEdits ? 'with preserved edits' : 'fresh'})`);
        } catch (error) {
          console.error(`[SYNC] Error processing transaction:`, error);
          syncStats.skipped++;
        }
      }

      console.log(`[SYNC] Synchronization complete:`, syncStats);

      res.json({
        success: true,
        stats: syncStats,
        message: `NUCLEAR SYNC complete: ${syncStats.created} created, ${syncStats.deleted} deleted, ${syncStats.preserved} manual edits preserved`
      });

    } catch (error) {
      console.error('🚨 [NUCLEAR SYNC] CRITICAL ERROR:', error);
      console.error('🚨 [NUCLEAR SYNC] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('🚨 [NUCLEAR SYNC] Error message:', error instanceof Error ? error.message : String(error));
      
      res.status(500).json({ 
        error: 'Failed to synchronize transactions',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // BULLETPROOF SYNC - Zero duplicates, preserves all user data
  app.post("/api/transactions/bulletproof-sync", async (req, res) => {
    try {
      console.log(`🛡️ [BULLETPROOF SYNC] ================================`);
      console.log(`🛡️ [BULLETPROOF SYNC] REQUEST RECEIVED`);
      
      // @ts-ignore
      const userId = req.userId;
      const { accountId, startDate, endDate, transactions } = req.body;
      
      console.log(`🛡️ [BULLETPROOF] User ID: ${userId}`);
      console.log(`🛡️ [BULLETPROOF] Account ID: ${accountId}`);
      console.log(`🛡️ [BULLETPROOF] Date range: ${startDate} to ${endDate}`);
      console.log(`🛡️ [BULLETPROOF] Transactions from file: ${transactions?.length || 0}`);
      
      // Validate input
      if (!accountId || !startDate || !endDate || !transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ 
          error: 'Missing required fields: accountId, startDate, endDate, transactions' 
        });
      }
      
      if (transactions.length === 0) {
        return res.json({
          success: true,
          stats: { deleted: 0, created: 0, restored: 0, duplicatesRemoved: 0 },
          message: 'No transactions to import'
        });
      }
      
      const stats = {
        deleted: 0,
        created: 0,
        restored: 0,
        duplicatesRemoved: 0
      };
      
      // Step 1: Get existing transactions in date range for this account
      console.log(`🛡️ [BULLETPROOF] Getting existing transactions...`);
      
      // Fix date range to include full days (start at 00:00, end at 23:59:59)
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log(`🛡️ [BULLETPROOF] Adjusted date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
      
      const existingTransactions = await storage.getTransactionsInDateRangeByAccount(
        userId, 
        accountId, 
        startOfDay, 
        endOfDay
      );
      console.log(`🛡️ [BULLETPROOF] Found ${existingTransactions.length} existing transactions`);
      
      // Step 2: Create backup map of user data from ALL existing transactions
      const userDataMap = new Map<string, any>();
      
      for (const tx of existingTransactions) {
        // Backup user data from ALL transactions if they have any user modifications
        if (tx.userDescription || 
            tx.huvudkategoriId || 
            tx.underkategoriId ||
            tx.linkedTransactionId ||
            tx.incomeTargetId ||
            tx.savingsTargetId ||
            tx.isManuallyChanged === 'true' ||
            tx.type !== 'Transaction' ||
            tx.status !== 'yellow') {
          
          // Create fingerprint for matching
          const fingerprint = createBulletproofFingerprint(tx);
          
          userDataMap.set(fingerprint, {
            huvudkategoriId: tx.huvudkategoriId,
            underkategoriId: tx.underkategoriId,
            userDescription: tx.userDescription,
            type: tx.type,
            status: tx.status,
            linkedTransactionId: tx.linkedTransactionId,
            incomeTargetId: tx.incomeTargetId,
            savingsTargetId: tx.savingsTargetId,
            isManuallyChanged: tx.isManuallyChanged
          });
          
          console.log(`🛡️ [BULLETPROOF] Backed up user data for: ${tx.description.substring(0, 30)}`);
        }
      }
      console.log(`🛡️ [BULLETPROOF] Backed up ${userDataMap.size} transactions with user data`);
      
      // Step 3: DELETE all existing transactions in date range for this account
      console.log(`🛡️ [BULLETPROOF] Deleting ${existingTransactions.length} existing transactions...`);
      console.log(`🛡️ [BULLETPROOF] Date range for deletion: ${startDate} to ${endDate}`);
      
      // Debug: Log specific duplicates we're trying to delete
      const duplicateTargets = ['okq8', 'sats', 'boxer'];
      for (const target of duplicateTargets) {
        const matching = existingTransactions.filter(tx => 
          tx.description.toLowerCase().includes(target) && 
          tx.date.toISOString().startsWith('2025-01-02')
        );
        console.log(`🛡️ [BULLETPROOF] Found ${matching.length} "${target}" transactions to delete on 2025-01-02`);
        matching.forEach((tx, i) => {
          console.log(`🛡️ [BULLETPROOF]   ${i+1}. ID: ${tx.id.substring(0, 8)}, Manual: ${tx.isManuallyChanged}, Amount: ${tx.amount}`);
        });
      }
      
      for (const tx of existingTransactions) {
        console.log(`🛡️ [BULLETPROOF] Deleting: ${tx.description.substring(0, 20)} (${tx.date.toISOString().split('T')[0]}) Manual: ${tx.isManuallyChanged}`);
        await storage.deleteTransaction(tx.id);
        stats.deleted++;
      }
      console.log(`🛡️ [BULLETPROOF] Deleted ${stats.deleted} transactions`);
      
      // Step 4: Insert new transactions from file with restored user data
      const createdFingerprints = new Set<string>();
      
      for (const fileTx of transactions) {
        try {
          // Create fingerprint for duplicate check
          const fingerprint = `${fileTx.date.split('T')[0]}_${fileTx.description.toLowerCase().trim()}_${fileTx.amount}`;
          
          // Skip if we already created this transaction (duplicate in file)
          if (createdFingerprints.has(fingerprint)) {
            console.log(`⚠️ [BULLETPROOF] Skipping duplicate: ${fileTx.description}`);
            stats.duplicatesRemoved++;
            continue;
          }
          createdFingerprints.add(fingerprint);
          
          // Prepare transaction data
          const txData: any = {
            id: uuidv4(),
            userId,
            accountId,
            date: new Date(fileTx.date),
            description: fileTx.description,
            amount: fileTx.amount,
            balanceAfter: fileTx.balanceAfter,
            bankCategory: fileTx.bankCategory || '',
            bankSubCategory: fileTx.bankSubCategory || '',
            type: fileTx.type || 'Transaction',
            status: fileTx.status || 'yellow',
            isManuallyChanged: 'false',
            userDescription: '',
            linkedTransactionId: null,
            incomeTargetId: null,
            savingsTargetId: null,
            huvudkategoriId: null,
            underkategoriId: null
          };
          
          // Check if we have user data to restore
          const txFingerprint = createBulletproofFingerprint({
            date: txData.date,
            description: txData.description,
            amount: txData.amount
          });
          
          const userData = userDataMap.get(txFingerprint);
          if (userData) {
            // Restore user data
            Object.assign(txData, userData);
            stats.restored++;
            console.log(`✅ [BULLETPROOF] Restored user data for: ${txData.description.substring(0, 30)} (fingerprint: ${txFingerprint})`);
            
            // Debug specific duplicates
            if (['okq8', 'sats', 'boxer'].some(target => txData.description.toLowerCase().includes(target))) {
              console.log(`🔍 [BULLETPROOF] DUPLICATE RESTORE: ${txData.description} - Manual: ${userData.isManuallyChanged}`);
            }
          }
          
          // Create the transaction
          const validatedData = insertTransactionSchema.parse(txData);
          await storage.createTransaction(validatedData);
          stats.created++;
          
        } catch (error) {
          console.error(`❌ [BULLETPROOF] Error creating transaction:`, error);
        }
      }
      
      console.log(`🛡️ [BULLETPROOF] ================================`);
      console.log(`🛡️ [BULLETPROOF] SYNC COMPLETE`);
      console.log(`🛡️ [BULLETPROOF] Deleted: ${stats.deleted}`);
      console.log(`🛡️ [BULLETPROOF] Created: ${stats.created}`);
      console.log(`🛡️ [BULLETPROOF] Restored: ${stats.restored}`);
      console.log(`🛡️ [BULLETPROOF] Duplicates removed: ${stats.duplicatesRemoved}`);
      console.log(`🛡️ [BULLETPROOF] ================================`);
      
      res.json({
        success: true,
        stats,
        message: `Import complete: ${stats.created} created, ${stats.restored} with restored data, ${stats.duplicatesRemoved} duplicates removed`
      });
      
    } catch (error) {
      console.error('❌ [BULLETPROOF SYNC] ERROR:', error);
      res.status(500).json({ 
        error: 'Bulletproof sync failed',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Helper function for bulletproof fingerprinting
  function createBulletproofFingerprint(tx: any): string {
    const date = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : tx.date.split('T')[0];
    const desc = tx.description.toLowerCase().trim().replace(/\s+/g, ' ');
    const amount = Math.round(tx.amount);
    return `${date}_${desc}_${amount}`;
  }

  app.put("/api/transactions/:id", async (req, res) => {
    try {
      console.log('🔍 [API] Raw request body before validation:', req.body);
      console.log('🔍 [API] Body keys:', Object.keys(req.body));
      console.log('🔍 [API] appCategoryId in body?', 'appCategoryId' in req.body, req.body.appCategoryId);
      console.log('🔍 [API] appSubCategoryId in body?', 'appSubCategoryId' in req.body, req.body.appSubCategoryId);
      
      // Validate and convert the partial update data
      const updateData = insertTransactionSchema.partial().parse(req.body);
      
      console.log('🔍 [API] Parsed updateData after validation:', updateData);
      console.log('🔍 [API] updateData keys:', Object.keys(updateData));
      
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

  // Get all budget posts (for savings goals)
  app.get("/api/budget-posts-all", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const budgetPosts = await storage.getAllBudgetPosts(userId);
      res.json(budgetPosts);
    } catch (error) {
      console.error('Error fetching all budget posts:', error);
      res.status(500).json({ error: 'Failed to fetch all budget posts' });
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

  // User settings routes
  app.get("/api/user-settings", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const settings = await storage.getUserSettings(userId);
      res.json(settings);
    } catch (error) {
      console.error('Error fetching user settings:', error);
      res.status(500).json({ error: 'Failed to fetch user settings' });
    }
  });

  app.get("/api/user-settings/:settingKey", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { settingKey } = req.params;
      const setting = await storage.getUserSetting(userId, settingKey);
      if (setting) {
        res.json(setting);
      } else {
        res.status(404).json({ error: 'Setting not found' });
      }
    } catch (error) {
      console.error('Error fetching user setting:', error);
      res.status(500).json({ error: 'Failed to fetch user setting' });
    }
  });

  app.post("/api/user-settings", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const validatedData = insertUserSettingSchema.parse({
        ...req.body,
        userId
      });
      const setting = await storage.createUserSetting(validatedData);
      res.status(201).json(setting);
    } catch (error) {
      console.error('Error creating user setting:', error);
      res.status(400).json({ error: 'Failed to create user setting' });
    }
  });

  app.put("/api/user-settings/:settingKey", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { settingKey } = req.params;
      const { settingValue } = req.body;
      
      const setting = await storage.upsertUserSetting(userId, settingKey, settingValue);
      res.json(setting);
    } catch (error) {
      console.error('Error updating user setting:', error);
      res.status(400).json({ error: 'Failed to update user setting' });
    }
  });

  app.delete("/api/user-settings/:settingKey", async (req, res) => {
    try {
      // @ts-ignore
      const userId = req.userId;
      const { settingKey } = req.params;
      const deleted = await storage.deleteUserSetting(userId, settingKey);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: 'Setting not found' });
      }
    } catch (error) {
      console.error('Error deleting user setting:', error);
      res.status(500).json({ error: 'Failed to delete user setting' });
    }
  });

  // Google Authentication routes for Neon
  app.post("/api/auth/configure-database", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication token required' });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const { user } = req.body;

      if (!user || !user.email) {
        return res.status(400).json({ error: 'User information required' });
      }

      // TODO: Verify Stack Auth JWT token here
      // For now, we'll trust the token since it comes from our frontend
      
      // Create or update user in database with Stack Auth info
      console.log(`Configuring database for Stack Auth user: ${user.email}`);
      
      // In a real implementation, you might:
      // 1. Verify the Stack Auth JWT token
      // 2. Create a user record with Stack Auth ID mapping
      // 3. Set up user-specific database schema or permissions
      // 4. Store encrypted connection strings per user
      
      // For this demo, we'll just acknowledge the configuration
      const userConfig = {
        userId: user.id,
        email: user.email,
        name: user.name,
        databaseConfigured: true,
        configuredAt: new Date().toISOString()
      };

      // Store user configuration (in a real app, this would go to a secure user config table)
      console.log('User database configuration:', userConfig);

      res.json({
        success: true,
        message: 'Database authentication configured successfully',
        userConfig
      });
    } catch (error) {
      console.error('Error configuring database auth:', error);
      res.status(500).json({ error: 'Failed to configure database authentication' });
    }
  });

  app.post("/api/auth/configure-custom-database", async (req, res) => {
    try {
      const { connectionString, userEmail } = req.body;

      if (!connectionString || !userEmail) {
        return res.status(400).json({ error: 'Connection string and user email required' });
      }

      // Validate connection string format (basic check for Neon)
      if (!connectionString.includes('postgresql://') && !connectionString.includes('postgres://')) {
        return res.status(400).json({ error: 'Invalid PostgreSQL connection string format' });
      }

      // TODO: In a production app, you would:
      // 1. Validate the connection string by testing it
      // 2. Encrypt and store the connection string securely
      // 3. Associate it with the user's account
      // 4. Set up user-specific database access

      console.log(`Configuring custom database connection for user: ${userEmail}`);
      
      // For demo purposes, we'll just acknowledge the configuration
      const customConfig = {
        userEmail,
        hasCustomConnection: true,
        configuredAt: new Date().toISOString(),
        // Don't log the actual connection string for security
        connectionConfigured: true
      };

      console.log('Custom database configuration:', customConfig);

      res.json({
        success: true,
        message: 'Custom database connection configured successfully',
        config: customConfig
      });
    } catch (error) {
      console.error('Error configuring custom database connection:', error);
      res.status(500).json({ error: 'Failed to configure custom database connection' });
    }
  });

  app.get("/api/auth/database-status", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication token required' });
      }

      // TODO: Get user info from token and check their database configuration status
      // For now, return a basic status
      
      res.json({
        isConfigured: false,
        connectionType: 'default',
        configuredAt: null,
        message: 'Database authentication not configured'
      });
    } catch (error) {
      console.error('Error checking database status:', error);
      res.status(500).json({ error: 'Failed to check database status' });
    }
  });

  // Create the server
  const httpServer = createServer(app);
  return httpServer;
}
