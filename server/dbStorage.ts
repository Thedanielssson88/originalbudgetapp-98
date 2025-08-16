import { db, getUserDatabase } from "./db";
import { eq, and, gte, lte, like, sql, or } from "drizzle-orm";

// Helper function to find a record by ID across both databases
async function findRecordByIdAcrossDatabases<T>(table: any, id: string): Promise<{ record: T; userId: string } | null> {
  // Try DEV database first (for dev-user-123)
  try {
    const devDb = getUserDatabase('dev-user-123');
    const devResult = await devDb.select().from(table).where(eq(table.id, id)).limit(1);
    if (devResult.length > 0) {
      return { record: devResult[0], userId: devResult[0].userId };
    }
  } catch (error) {
    console.log('Error searching in DEV database:', error);
  }
  
  // Try PROD database for all other users
  try {
    const prodDb = getUserDatabase('other-user'); // Will route to PROD
    const prodResult = await prodDb.select().from(table).where(eq(table.id, id)).limit(1);
    if (prodResult.length > 0) {
      return { record: prodResult[0], userId: prodResult[0].userId };
    }
  } catch (error) {
    console.log('Error searching in PROD database:', error);
  }
  
  return null;
}
import {
  users,
  familyMembers,
  accountTypes,
  accounts,
  huvudkategorier,
  underkategorier,
  categoryRules,
  transactions,
  monthlyBudgets,
  monthlyAccountBalances,
  budgetPosts,
  banks,
  bankCsvMappings,
  plannedTransfers,
  inkomstkallor,
  inkomstkallorMedlem,
  userSettings,
  type User,
  type UpsertUser,
  type InsertUser,
  type FamilyMember,
  type InsertFamilyMember,
  type AccountType,
  type InsertAccountType,
  type Account,
  type InsertAccount,
  type Huvudkategori,
  type InsertHuvudkategori,
  type Underkategori,
  type InsertUnderkategori,
  type CategoryRule,
  type InsertCategoryRule,
  type Transaction,
  type InsertTransaction,
  type MonthlyBudget,
  type InsertMonthlyBudget,
  type MonthlyAccountBalance,
  type InsertMonthlyAccountBalance,
  type PlannedTransfer,
  type InsertPlannedTransfer,
  type Inkomstkall,
  type InsertInkomstkall,
  type InkomstkallorMedlem,
  type InsertInkomstkallorMedlem,
  type UserSetting,
  type InsertUserSetting
} from "@shared/schema";

// Add the missing types that aren't auto-generated yet
type Bank = typeof banks.$inferSelect;
type InsertBank = typeof banks.$inferInsert;
type BankCsvMapping = typeof bankCsvMappings.$inferSelect;
type InsertBankCsvMapping = typeof bankCsvMappings.$inferInsert;
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Bootstrap method
  async bootstrap(userId: string): Promise<{
    accountTypes: AccountType[];
    accounts: Account[];
    huvudkategorier: Huvudkategori[];
    underkategorier: Underkategori[];
    categoryRules: CategoryRule[];
    transactions: Transaction[];
    budgetPosts: any[];
    monthlyBudgets: MonthlyBudget[];
    banks: Bank[];
    bankCsvMappings: BankCsvMapping[];
  }> {
    // Only load recent transactions for bootstrap - last month for optimal performance
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const [accountTypesResult, accountsResult, huvudkategorierResult, underkategorierResult, categoryRulesResult, recentTransactionsResult, monthlyBudgetsResult, banksResult, bankCsvMappingsResult] = await Promise.all([
      this.getAccountTypes(userId),
      this.getAccounts(userId),
      this.getHuvudkategorier(userId),
      this.getUnderkategorier(userId),
      this.getCategoryRules(userId),
      this.getRecentTransactions(userId, oneMonthAgo),
      this.getMonthlyBudgets(userId),
      this.getBanks(userId),
      this.getBankCsvMappings(userId)
    ]);

    return {
      accountTypes: accountTypesResult,
      accounts: accountsResult,
      huvudkategorier: huvudkategorierResult,
      underkategorier: underkategorierResult,
      categoryRules: categoryRulesResult,
      transactions: recentTransactionsResult,
      budgetPosts: [], // Not implemented yet
      monthlyBudgets: monthlyBudgetsResult,
      banks: banksResult,
      bankCsvMappings: bankCsvMappingsResult,
    };
  }

  // User methods - mandatory for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const userDb = getUserDatabase(id);
    const result = await userDb.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const userDb = getUserDatabase(insertUser.id);
    const result = await userDb.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Family member methods
  async getFamilyMembers(userId: string): Promise<FamilyMember[]> {
    const userDb = getUserDatabase(userId);
    return await userDb.select().from(familyMembers).where(eq(familyMembers.userId, userId));
  }

  async getFamilyMember(id: string): Promise<FamilyMember | undefined> {
    const found = await findRecordByIdAcrossDatabases<FamilyMember>(familyMembers, id);
    return found?.record;
  }

  async createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember> {
    const userDb = getUserDatabase(member.userId);
    const result = await userDb.insert(familyMembers).values(member).returning();
    return result[0];
  }

  async updateFamilyMember(id: string, member: Partial<InsertFamilyMember>): Promise<FamilyMember | undefined> {
    const found = await findRecordByIdAcrossDatabases<FamilyMember>(familyMembers, id);
    if (!found) return undefined;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.update(familyMembers)
      .set(member)
      .where(eq(familyMembers.id, id))
      .returning();
    return result[0];
  }

  async deleteFamilyMember(id: string): Promise<boolean> {
    const found = await findRecordByIdAcrossDatabases<FamilyMember>(familyMembers, id);
    if (!found) return false;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.delete(familyMembers).where(eq(familyMembers.id, id)).returning();
    return result.length > 0;
  }

  // Income sources (Inkomstkällor) methods
  async getInkomstkallor(userId: string): Promise<Inkomstkall[]> {
    const userDb = getUserDatabase(userId);
    return await userDb.select().from(inkomstkallor).where(eq(inkomstkallor.userId, userId));
  }

  async getInkomstkall(id: string): Promise<Inkomstkall | undefined> {
    const found = await findRecordByIdAcrossDatabases<Inkomstkall>(inkomstkallor, id);
    return found?.record;
  }

  async createInkomstkall(inkomstkall: InsertInkomstkall): Promise<Inkomstkall> {
    const userDb = getUserDatabase(inkomstkall.userId);
    const result = await userDb.insert(inkomstkallor).values(inkomstkall).returning();
    return result[0];
  }

  async updateInkomstkall(id: string, inkomstkall: Partial<InsertInkomstkall>): Promise<Inkomstkall | undefined> {
    const found = await findRecordByIdAcrossDatabases<Inkomstkall>(inkomstkallor, id);
    if (!found) return undefined;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.update(inkomstkallor)
      .set(inkomstkall)
      .where(eq(inkomstkallor.id, id))
      .returning();
    return result[0];
  }

  async deleteInkomstkall(id: string): Promise<boolean> {
    const found = await findRecordByIdAcrossDatabases<Inkomstkall>(inkomstkallor, id);
    if (!found) return false;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.delete(inkomstkallor).where(eq(inkomstkallor.id, id)).returning();
    return result.length > 0;
  }

  // Income source member assignments methods
  async getInkomstkallorMedlem(userId: string): Promise<InkomstkallorMedlem[]> {
    const userDb = getUserDatabase(userId);
    return await userDb.select().from(inkomstkallorMedlem).where(eq(inkomstkallorMedlem.userId, userId));
  }

  async createInkomstkallorMedlem(assignment: InsertInkomstkallorMedlem): Promise<InkomstkallorMedlem> {
    const userDb = getUserDatabase(assignment.userId);
    const result = await userDb.insert(inkomstkallorMedlem).values(assignment).returning();
    return result[0];
  }

  async updateInkomstkallorMedlem(id: string, assignment: Partial<InsertInkomstkallorMedlem>): Promise<InkomstkallorMedlem | undefined> {
    const found = await findRecordByIdAcrossDatabases<InkomstkallorMedlem>(inkomstkallorMedlem, id);
    if (!found) return undefined;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.update(inkomstkallorMedlem)
      .set(assignment)
      .where(eq(inkomstkallorMedlem.id, id))
      .returning();
    return result[0];
  }

  async deleteInkomstkallorMedlem(id: string): Promise<boolean> {
    const found = await findRecordByIdAcrossDatabases<InkomstkallorMedlem>(inkomstkallorMedlem, id);
    if (!found) return false;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.delete(inkomstkallorMedlem).where(eq(inkomstkallorMedlem.id, id)).returning();
    return result.length > 0;
  }

  async deleteInkomstkallorMedlemByMemberAndSource(userId: string, familjemedlemId: string, idInkomstkalla: string): Promise<boolean> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.delete(inkomstkallorMedlem)
      .where(and(
        eq(inkomstkallorMedlem.userId, userId),
        eq(inkomstkallorMedlem.familjemedlemId, familjemedlemId),
        eq(inkomstkallorMedlem.idInkomstkalla, idInkomstkalla)
      ))
      .returning();
    return result.length > 0;
  }

  // Account Types methods
  async getAccountTypes(userId: string): Promise<AccountType[]> {
    const userDb = getUserDatabase(userId);
    return await userDb.select().from(accountTypes).where(eq(accountTypes.userId, userId));
  }

  async getAccountType(id: string): Promise<AccountType | undefined> {
    const found = await findRecordByIdAcrossDatabases<AccountType>(accountTypes, id);
    return found?.record;
  }

  async createAccountType(accountType: InsertAccountType): Promise<AccountType> {
    const userDb = getUserDatabase(accountType.userId);
    const result = await userDb.insert(accountTypes).values(accountType).returning();
    return result[0];
  }

  async updateAccountType(id: string, accountType: Partial<InsertAccountType>): Promise<AccountType | undefined> {
    const found = await findRecordByIdAcrossDatabases<AccountType>(accountTypes, id);
    if (!found) return undefined;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.update(accountTypes)
      .set({
        ...accountType,
        updatedAt: new Date()
      })
      .where(eq(accountTypes.id, id))
      .returning();
    return result[0];
  }

  async deleteAccountType(id: string): Promise<boolean> {
    const found = await findRecordByIdAcrossDatabases<AccountType>(accountTypes, id);
    if (!found) return false;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.delete(accountTypes).where(eq(accountTypes.id, id)).returning();
    return result.length > 0;
  }

  // Account methods
  async getAccounts(userId: string): Promise<Account[]> {
    console.log('Getting accounts for userId:', userId);
    const userDb = getUserDatabase(userId);
    
    // Debug the actual database connection being used
    console.log('🔍 [DEBUG] About to query database for accounts...');
    const totalAccountsResult = await userDb.select().from(accounts);
    console.log(`🔍 [DEBUG] Total accounts in database: ${totalAccountsResult.length}`);
    console.log('🔍 [DEBUG] All account names:', totalAccountsResult.map(a => a.name));
    
    const result = await userDb.select().from(accounts).where(eq(accounts.userId, userId));
    console.log('Found accounts:', result);
    return result;
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const found = await findRecordByIdAcrossDatabases<Account>(accounts, id);
    return found?.record;
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const userDb = getUserDatabase(account.userId);
    const result = await userDb.insert(accounts).values(account).returning();
    return result[0];
  }

  async updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined> {
    console.log(`🔍 [DB] updateAccount called with id: ${id}, data:`, account);
    const found = await findRecordByIdAcrossDatabases<Account>(accounts, id);
    if (!found) {
      console.log(`❌ [DB] Account ${id} not found`);
      return undefined;
    }
    
    console.log(`🔍 [DB] Found account: ${found.name} (userId: ${found.userId})`);
    const userDb = getUserDatabase(found.userId);
    console.log(`🔍 [DB] Using database for user: ${found.userId}`);
    
    const result = await userDb.update(accounts)
      .set(account)
      .where(eq(accounts.id, id))
      .returning();
    
    console.log(`🔍 [DB] Update result:`, result[0]);
    return result[0];
  }

  async deleteAccount(id: string): Promise<boolean> {
    const found = await findRecordByIdAcrossDatabases<Account>(accounts, id);
    if (!found) return false;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.delete(accounts).where(eq(accounts.id, id)).returning();
    return result.length > 0;
  }

  // Huvudkategori methods
  async getHuvudkategorier(userId: string): Promise<Huvudkategori[]> {
    console.log(`📊 [DB] getHuvudkategorier for userId: ${userId}`);
    const userDb = getUserDatabase(userId);
    const result = await userDb.select().from(huvudkategorier).where(eq(huvudkategorier.userId, userId));
    console.log(`📊 [DB] getHuvudkategorier - found ${result.length} categories for userId: ${userId}`);
    if (result.length > 0) {
      console.log(`📊 [DB] Sample huvudkategori:`, JSON.stringify(result[0]));
      // Debug: Check if all results actually belong to the requested user
      const userIds = [...new Set(result.map(r => r.userId))];
      console.log(`📊 [DB] Unique user_ids in results:`, userIds);
    }
    return result;
  }

  async getHuvudkategori(id: string): Promise<Huvudkategori | undefined> {
    const found = await findRecordByIdAcrossDatabases<Huvudkategori>(huvudkategorier, id);
    return found?.record;
  }

  async createHuvudkategori(kategori: InsertHuvudkategori): Promise<Huvudkategori> {
    const userDb = getUserDatabase(kategori.userId);
    const result = await userDb.insert(huvudkategorier).values(kategori).returning();
    return result[0];
  }

  async updateHuvudkategori(id: string, kategori: Partial<InsertHuvudkategori>): Promise<Huvudkategori | undefined> {
    const found = await findRecordByIdAcrossDatabases<Huvudkategori>(huvudkategorier, id);
    if (!found) return undefined;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.update(huvudkategorier)
      .set(kategori)
      .where(eq(huvudkategorier.id, id))
      .returning();
    return result[0];
  }

  async deleteHuvudkategori(id: string): Promise<boolean> {
    const found = await findRecordByIdAcrossDatabases<Huvudkategori>(huvudkategorier, id);
    if (!found) return false;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.delete(huvudkategorier).where(eq(huvudkategorier.id, id)).returning();
    return result.length > 0;
  }

  // Underkategori methods
  async getUnderkategorier(userId: string): Promise<Underkategori[]> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.select().from(underkategorier).where(eq(underkategorier.userId, userId));
    console.log(`📊 [DB] getUnderkategorier for userId: ${userId} - found ${result.length} subcategories`);
    return result;
  }

  async getUnderkategorierByHuvudkategori(huvudkategoriId: string, userId: string): Promise<Underkategori[]> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.select()
      .from(underkategorier)
      .where(and(
        eq(underkategorier.huvudkategoriId, huvudkategoriId),
        eq(underkategorier.userId, userId)
      ));
    console.log(`📊 [DB] getUnderkategorierByHuvudkategori for userId: ${userId}, huvudkategoriId: ${huvudkategoriId} - found ${result.length} subcategories`);
    return result;
  }

  async getUnderkategori(id: string): Promise<Underkategori | undefined> {
    const found = await findRecordByIdAcrossDatabases<Underkategori>(underkategorier, id);
    return found?.record;
  }

  async createUnderkategori(kategori: InsertUnderkategori): Promise<Underkategori> {
    const userDb = getUserDatabase(kategori.userId);
    const result = await userDb.insert(underkategorier).values(kategori).returning();
    return result[0];
  }

  async updateUnderkategori(id: string, kategori: Partial<InsertUnderkategori>): Promise<Underkategori | undefined> {
    const found = await findRecordByIdAcrossDatabases<Underkategori>(underkategorier, id);
    if (!found) return undefined;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.update(underkategorier)
      .set(kategori)
      .where(eq(underkategorier.id, id))
      .returning();
    return result[0];
  }

  async deleteUnderkategori(id: string): Promise<boolean> {
    const found = await findRecordByIdAcrossDatabases<Underkategori>(underkategorier, id);
    if (!found) return false;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.delete(underkategorier).where(eq(underkategorier.id, id)).returning();
    return result.length > 0;
  }

  // Category Rules methods
  async getCategoryRules(userId: string): Promise<CategoryRule[]> {
    const userDb = getUserDatabase(userId);
    return await userDb.select().from(categoryRules).where(eq(categoryRules.userId, userId));
  }

  async getCategoryRule(id: string): Promise<CategoryRule | undefined> {
    const found = await findRecordByIdAcrossDatabases<CategoryRule>(categoryRules, id);
    return found?.record;
  }

  async createCategoryRule(rule: InsertCategoryRule): Promise<CategoryRule> {
    const userDb = getUserDatabase(rule.userId);
    const result = await userDb.insert(categoryRules).values(rule).returning();
    return result[0];
  }

  async updateCategoryRule(id: string, rule: Partial<InsertCategoryRule>): Promise<CategoryRule | undefined> {
    const found = await findRecordByIdAcrossDatabases<CategoryRule>(categoryRules, id);
    if (!found) return undefined;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.update(categoryRules)
      .set(rule)
      .where(eq(categoryRules.id, id))
      .returning();
    return result[0];
  }

  async deleteCategoryRule(id: string): Promise<boolean> {
    const found = await findRecordByIdAcrossDatabases<CategoryRule>(categoryRules, id);
    if (!found) return false;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.delete(categoryRules).where(eq(categoryRules.id, id)).returning();
    return result.length > 0;
  }

  // Transaction methods
  async getTransactions(userId: string): Promise<Transaction[]> {
    // DEBUG: Let's check the actual database connection and query
    console.log(`📊 [DB] getTransactions called for userId: ${userId}`);
    const userDb = getUserDatabase(userId);
    
    try {
      // Test raw query first
      const rawResult = await userDb.execute(sql`SELECT COUNT(*) as count FROM transactions WHERE user_id = ${userId}`);
      console.log(`📊 [DB] Raw count query result:`, rawResult);
      
      // Now the normal query
      const result = await userDb.select().from(transactions).where(eq(transactions.userId, userId));
      
      console.log(`📊 [DB] getTransactions - returning ${result.length} transactions with SIMPLE select()`);
      if (result.length > 0) {
        const sampleTx = result[0];
        console.log(`📊 [DB] Sample transaction fields: linkedCostId=${sampleTx.linkedCostId}, correctedAmount=${sampleTx.correctedAmount}, savingsTargetId=${sampleTx.savingsTargetId}`);
        
        // Test specific transaction that we know has data
        const testTx = result.find(t => t.id === '8871ea64-5b73-4b36-9768-f6253e5e774c');
        if (testTx) {
          console.log(`📊 [DB] TEST TRANSACTION FOUND: linkedCostId=${testTx.linkedCostId}, correctedAmount=${testTx.correctedAmount}`);
        }
      }
      
      return result;
    } catch (error) {
      console.error(`❌ [DB] Error in getTransactions:`, error);
      throw error;
    }
  }

  async getRecentTransactions(userId: string, fromDate: Date): Promise<Transaction[]> {
    console.log(`📊 [DB] Loading transactions from ${fromDate.toISOString()}`);
    const userDb = getUserDatabase(userId);
    const result = await userDb.select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, fromDate)
        )
      )
      .orderBy(transactions.date);
    console.log(`📊 [DB] Loaded ${result.length} recent transactions`);
    return result;
  }

  async getTransaction(id: string, userId?: string): Promise<Transaction | undefined> {
    console.log(`🔍 [DB] getTransaction called for id: ${id}, userId: ${userId}`);
    const userDb = getUserDatabase(userId);
    const result = await userDb.select().from(transactions).where(eq(transactions.id, id));
    console.log(`🔍 [DB] getTransaction result:`, result[0]);
    return result[0];
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const userDb = getUserDatabase(transaction.userId);
    const result = await userDb.insert(transactions).values(transaction).returning();
    return result[0];
  }

  async updateTransaction(id: string, transaction: Partial<InsertTransaction>, userId?: string): Promise<Transaction | undefined> {
    console.log(`🔍 [DB UPDATE] Transaction ${id}: Update data:`, JSON.stringify(transaction));
    console.log(`🔍 [DB UPDATE] linkedCostId in update:`, transaction.linkedCostId);
    console.log(`🔍 [DB UPDATE] correctedAmount in update:`, transaction.correctedAmount);
    console.log(`🔍 [DB UPDATE] User ID:`, userId);
    
    // Use the correct database based on user ID
    const userDb = getUserDatabase(userId);
    
    const result = await userDb.update(transactions)
      .set(transaction)
      .where(eq(transactions.id, id))
      .returning();
    
    console.log(`🔍 [DB UPDATE] Database returned:`, JSON.stringify(result[0]));
    console.log(`🔍 [DB UPDATE] DB result linkedCostId:`, result[0]?.linkedCostId);
    console.log(`🔍 [DB UPDATE] DB result correctedAmount:`, result[0]?.correctedAmount);
    
    return result[0];
  }

  async deleteTransaction(id: string, userId?: string): Promise<boolean> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.delete(transactions).where(eq(transactions.id, id)).returning();
    return result.length > 0;
  }

  // NEW: Get transactions within a date range for synchronization
  async getTransactionsInDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    console.log(`Getting transactions for userId: ${userId} between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    const userDb = getUserDatabase(userId);
    const result = await userDb
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        description: transactions.description,
        amount: transactions.amount,
        date: transactions.date,
        balanceAfter: transactions.balanceAfter,
        userDescription: transactions.userDescription,
        bankCategory: transactions.bankCategory,
        bankSubCategory: transactions.bankSubCategory,
        type: transactions.type,
        status: transactions.status,
        linkedTransactionId: transactions.linkedTransactionId,
        linkedCostId: transactions.linkedCostId,
        savingsTargetId: transactions.savingsTargetId,
        incomeTargetId: transactions.incomeTargetId,
        correctedAmount: transactions.correctedAmount,
        isManuallyChanged: transactions.isManuallyChanged,
        appCategoryId: transactions.appCategoryId,
        appSubCategoryId: transactions.appSubCategoryId,
        huvudkategoriId: transactions.huvudkategoriId,
        underkategoriId: transactions.underkategoriId
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );
    console.log(`Found ${result.length} transactions in date range`);
    return result;
  }

  async getTransactionsInDateRangeByAccount(userId: string, accountId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    console.log(`Getting transactions for userId: ${userId}, accountId: ${accountId} between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    const userDb = getUserDatabase(userId);
    const result = await userDb
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        description: transactions.description,
        amount: transactions.amount,
        date: transactions.date,
        balanceAfter: transactions.balanceAfter,
        userDescription: transactions.userDescription,
        bankCategory: transactions.bankCategory,
        bankSubCategory: transactions.bankSubCategory,
        type: transactions.type,
        status: transactions.status,
        linkedTransactionId: transactions.linkedTransactionId,
        linkedCostId: transactions.linkedCostId,
        savingsTargetId: transactions.savingsTargetId,
        incomeTargetId: transactions.incomeTargetId,
        correctedAmount: transactions.correctedAmount,
        isManuallyChanged: transactions.isManuallyChanged,
        appCategoryId: transactions.appCategoryId,
        appSubCategoryId: transactions.appSubCategoryId,
        huvudkategoriId: transactions.huvudkategoriId,
        underkategoriId: transactions.underkategoriId
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.accountId, accountId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );
    console.log(`📊 [DB] getTransactionsInDateRangeByAccount - returning ${result.length} transactions with explicit field selection`);
    if (result.length > 0) {
      const sampleTx = result[0];
      console.log(`📊 [DB] Sample account transaction fields: linkedCostId=${sampleTx.linkedCostId}, correctedAmount=${sampleTx.correctedAmount}, savingsTargetId=${sampleTx.savingsTargetId}`);
    }
    return result;
  }

  // Monthly Budget methods
  async getMonthlyBudgets(userId: string): Promise<MonthlyBudget[]> {
    const userDb = getUserDatabase(userId);
    return await userDb.select().from(monthlyBudgets).where(eq(monthlyBudgets.userId, userId));
  }

  async getMonthlyBudget(userId: string, monthKey: string): Promise<MonthlyBudget | undefined> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.select().from(monthlyBudgets)
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.monthKey, monthKey)));
    return result[0];
  }

  async createMonthlyBudget(budget: InsertMonthlyBudget): Promise<MonthlyBudget> {
    const userDb = getUserDatabase(budget.userId);
    const result = await userDb.insert(monthlyBudgets).values(budget).returning();
    return result[0];
  }

  async updateMonthlyBudget(userId: string, monthKey: string, budget: Partial<InsertMonthlyBudget>): Promise<MonthlyBudget | undefined> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.update(monthlyBudgets)
      .set({
        ...budget,
        updatedAt: new Date()
      })
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.monthKey, monthKey)))
      .returning();
    return result[0];
  }

  async deleteMonthlyBudget(userId: string, monthKey: string): Promise<boolean> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.delete(monthlyBudgets)
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.monthKey, monthKey)))
      .returning();
    return result.length > 0;
  }

  // Bank methods
  async getBanks(userId: string): Promise<Bank[]> {
    const userDb = getUserDatabase(userId);
    return await userDb.select().from(banks).where(eq(banks.userId, userId));
  }

  async getBank(id: string): Promise<Bank | undefined> {
    const found = await findRecordByIdAcrossDatabases<Bank>(banks, id);
    return found?.record;
  }

  async createBank(insertBank: InsertBank): Promise<Bank> {
    const userDb = getUserDatabase(insertBank.userId);
    const result = await userDb.insert(banks).values(insertBank).returning();
    return result[0];
  }

  async updateBank(id: string, updateBank: Partial<InsertBank>): Promise<Bank | undefined> {
    const found = await findRecordByIdAcrossDatabases<Bank>(banks, id);
    if (!found) return undefined;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.update(banks)
      .set(updateBank)
      .where(eq(banks.id, id))
      .returning();
    return result[0];
  }

  async deleteBank(id: string): Promise<boolean> {
    const found = await findRecordByIdAcrossDatabases<Bank>(banks, id);
    if (!found) return false;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.delete(banks).where(eq(banks.id, id)).returning();
    return result.length > 0;
  }

  // Bank CSV Mapping methods
  async getBankCsvMappings(userId: string): Promise<BankCsvMapping[]> {
    const userDb = getUserDatabase(userId);
    return await userDb.select().from(bankCsvMappings).where(eq(bankCsvMappings.userId, userId));
  }

  async getBankCsvMappingsByBank(userId: string, bankId: string): Promise<BankCsvMapping[]> {
    const userDb = getUserDatabase(userId);
    return await userDb.select().from(bankCsvMappings)
      .where(and(eq(bankCsvMappings.userId, userId), eq(bankCsvMappings.bankId, bankId)));
  }

  async getBankCsvMapping(id: string): Promise<BankCsvMapping | undefined> {
    const found = await findRecordByIdAcrossDatabases<BankCsvMapping>(bankCsvMappings, id);
    return found?.record;
  }

  async createBankCsvMapping(insertMapping: InsertBankCsvMapping): Promise<BankCsvMapping> {
    const userDb = getUserDatabase(insertMapping.userId);
    const result = await userDb.insert(bankCsvMappings).values(insertMapping).returning();
    return result[0];
  }

  async updateBankCsvMapping(id: string, updateMapping: Partial<InsertBankCsvMapping>): Promise<BankCsvMapping | undefined> {
    const found = await findRecordByIdAcrossDatabases<BankCsvMapping>(bankCsvMappings, id);
    if (!found) return undefined;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.update(bankCsvMappings)
      .set(updateMapping)
      .where(eq(bankCsvMappings.id, id))
      .returning();
    return result[0];
  }

  async deleteBankCsvMapping(id: string): Promise<boolean> {
    const found = await findRecordByIdAcrossDatabases<BankCsvMapping>(bankCsvMappings, id);
    if (!found) return false;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.delete(bankCsvMappings).where(eq(bankCsvMappings.id, id)).returning();
    return result.length > 0;
  }

  // Budget Post methods
  async getBudgetPosts(userId: string, monthKey?: string): Promise<any[]> {
    console.log('Getting budget posts for userId:', userId, 'monthKey:', monthKey);
    
    try {
      const userDb = getUserDatabase(userId);
      let query = userDb
        .select()
        .from(budgetPosts)
        .where(eq(budgetPosts.userId, userId));
      
      if (monthKey) {
        query = query.where(eq(budgetPosts.monthKey, monthKey));
      }
      
      const results = await query;
      console.log('Found budget posts:', results.length);
      return results;
    } catch (error) {
      console.error('Error getting budget posts:', error);
      throw error;
    }
  }

  async getAllBudgetPosts(userId: string): Promise<any[]> {
    console.log('Getting all budget posts for userId:', userId);
    
    try {
      const userDb = getUserDatabase(userId);
      const results = await userDb
        .select()
        .from(budgetPosts)
        .where(eq(budgetPosts.userId, userId));
      
      console.log('Found all budget posts:', results.length);
      return results;
    } catch (error) {
      console.error('Error getting all budget posts:', error);
      throw error;
    }
  }

  async getBudgetPost(userId: string, id: string): Promise<any> {
    console.log('Getting budget post for userId:', userId, 'id:', id);
    
    try {
      const userDb = getUserDatabase(userId);
      const result = await userDb
        .select()
        .from(budgetPosts)
        .where(and(
          eq(budgetPosts.userId, userId),
          eq(budgetPosts.id, id)
        ))
        .limit(1);
      
      console.log('Found budget post:', result.length > 0 ? result[0] : 'not found');
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error('Error getting budget post:', error);
      throw error;
    }
  }

  async createBudgetPost(data: any): Promise<any> {
    console.log('Creating budget post with data:', JSON.stringify(data, null, 2));
    console.log('budgetType field value:', data.budgetType);
    
    try {
      const userDb = getUserDatabase(data.userId);
      const result = await userDb
        .insert(budgetPosts)
        .values(data)
        .returning();
      
      console.log('Created budget post result:', JSON.stringify(result[0], null, 2));
      console.log('Result budgetType field:', result[0].budgetType);
      return result[0];
    } catch (error) {
      console.error('Error creating budget post:', error);
      throw error;
    }
  }

  async updateBudgetPost(userId: string, id: string, data: any): Promise<any> {
    console.log('Updating budget post for userId:', userId, 'id:', id, 'data:', data);
    
    try {
      const userDb = getUserDatabase(userId);
      const result = await userDb
        .update(budgetPosts)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(
          eq(budgetPosts.userId, userId),
          eq(budgetPosts.id, id)
        ))
        .returning();
      
      console.log('Updated budget post:', result.length > 0 ? result[0] : 'not found');
      if (result.length > 0) {
        console.log('Updated budget post accountUserBalance:', result[0].accountUserBalance);
        console.log('Updated budget post accountBalance:', result[0].accountBalance);
      }
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error('Error updating budget post:', error);
      throw error;
    }
  }

  async deleteBudgetPost(userId: string, id: string): Promise<boolean> {
    console.log('Deleting budget post for userId:', userId, 'id:', id);
    
    try {
      const userDb = getUserDatabase(userId);
      
      // First, check if this is a savings goal (type='sparmål') before deleting
      const budgetPostToDelete = await userDb
        .select()
        .from(budgetPosts)
        .where(and(
          eq(budgetPosts.userId, userId),
          eq(budgetPosts.id, id)
        ))
        .limit(1);
      
      if (budgetPostToDelete.length === 0) {
        console.log('Budget post not found:', id);
        return false;
      }
      
      console.log('Budget post to delete:', budgetPostToDelete[0]);
      console.log('Budget post type:', budgetPostToDelete[0].type);
      
      // CRITICAL: If this is a savings goal, FIRST clean up ALL transactions that reference it
      // This MUST happen before deleting the savings goal to prevent orphaned references
      if (budgetPostToDelete[0].type === 'sparmål') {
        console.log('🧹 STEP 1: Cleaning up transactions linked to savings goal:', id);
        
        try {
          // Find all transactions that reference this savings goal
          const linkedTransactions = await userDb
            .select()
            .from(transactions)
            .where(and(
              eq(transactions.userId, userId),
              eq(transactions.savingsTargetId, id)
            ));
          
          console.log(`🧹 Found ${linkedTransactions.length} transactions linked to this savings goal`);
          
          if (linkedTransactions.length > 0) {
            // Remove savingsTargetId from all transactions that reference this savings goal
            // Don't change the transaction type - leave it as is since transactions can have
            // types like 'CostCoverage', 'ExpenseClaim', 'Savings' etc. independent of savings goals
            const cleanupResult = await userDb
              .update(transactions)
              .set({ 
                savingsTargetId: null
              })
              .where(and(
                eq(transactions.userId, userId),
                eq(transactions.savingsTargetId, id)
              ))
              .returning();
            
            console.log(`🧹 Successfully cleaned up ${cleanupResult.length} transactions`);
            if (cleanupResult.length > 0) {
              console.log('🧹 Cleaned transaction IDs:', cleanupResult.map(t => t.id).join(', '));
            }
          }
        } catch (cleanupError) {
          console.error('🔴 ERROR cleaning up transactions:', cleanupError);
          // Still try to delete the budget post even if cleanup fails
          // but log the error so we know there might be orphaned references
        }
      } else {
        console.log('Not a savings goal (type=' + budgetPostToDelete[0].type + '), skipping transaction cleanup');
      }
      
      // STEP 2: Now delete the budget post AFTER cleaning up references
      console.log('🗑️ STEP 2: Deleting the budget post itself');
      const result = await userDb
        .delete(budgetPosts)
        .where(and(
          eq(budgetPosts.userId, userId),
          eq(budgetPosts.id, id)
        ))
        .returning();
      
      console.log('✅ Deleted budget post:', result.length > 0);
      return result.length > 0;
    } catch (error) {
      console.error('🔴 Error deleting budget post:', error);
      throw error;
    }
  }

  // Monthly Account Balances - stores calculated balances per month
  async getMonthlyAccountBalances(userId: string, monthKey?: string): Promise<MonthlyAccountBalance[]> {
    const userDb = getUserDatabase(userId);
    if (monthKey) {
      return await userDb.select()
        .from(monthlyAccountBalances)
        .where(
          and(
            eq(monthlyAccountBalances.userId, userId),
            eq(monthlyAccountBalances.monthKey, monthKey)
          )
        );
    } else {
      return await userDb.select()
        .from(monthlyAccountBalances)
        .where(eq(monthlyAccountBalances.userId, userId));
    }
  }

  async getMonthlyAccountBalance(userId: string, monthKey: string, accountId: string): Promise<MonthlyAccountBalance | undefined> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.select()
      .from(monthlyAccountBalances)
      .where(
        and(
          eq(monthlyAccountBalances.userId, userId),
          eq(monthlyAccountBalances.monthKey, monthKey),
          eq(monthlyAccountBalances.accountId, accountId)
        )
      );
    return result[0];
  }

  async saveMonthlyAccountBalance(balance: InsertMonthlyAccountBalance): Promise<MonthlyAccountBalance> {
    // Use upsert logic - update if exists, insert if not
    const existing = await this.getMonthlyAccountBalance(balance.userId, balance.monthKey, balance.accountId);
    const userDb = getUserDatabase(balance.userId);
    
    if (existing) {
      const result = await userDb.update(monthlyAccountBalances)
        .set({ 
          calculatedBalance: balance.calculatedBalance,
          updatedAt: new Date()
        })
        .where(eq(monthlyAccountBalances.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await userDb.insert(monthlyAccountBalances).values(balance).returning();
      return result[0];
    }
  }

  async upsertMonthlyAccountBalance(balance: InsertMonthlyAccountBalance): Promise<{ balance: MonthlyAccountBalance, created: boolean }> {
    // Use upsert logic - update if exists, insert if not
    const existing = await this.getMonthlyAccountBalance(balance.userId, balance.monthKey, balance.accountId);
    const userDb = getUserDatabase(balance.userId);
    
    if (existing) {
      const result = await userDb.update(monthlyAccountBalances)
        .set({ 
          calculatedBalance: balance.calculatedBalance,
          faktisktKontosaldo: balance.faktisktKontosaldo,
          bankensKontosaldo: balance.bankensKontosaldo,
          updatedAt: new Date()
        })
        .where(eq(monthlyAccountBalances.id, existing.id))
        .returning();
      return { balance: result[0], created: false };
    } else {
      const result = await userDb.insert(monthlyAccountBalances).values(balance).returning();
      return { balance: result[0], created: true };
    }
  }

  // Planned Transfers methods
  async getPlannedTransfers(userId: string, month?: string): Promise<PlannedTransfer[]> {
    const userDb = getUserDatabase(userId);
    if (month) {
      return await userDb.select()
        .from(plannedTransfers)
        .where(
          and(
            eq(plannedTransfers.userId, userId),
            eq(plannedTransfers.month, month)
          )
        );
    } else {
      return await userDb.select()
        .from(plannedTransfers)
        .where(eq(plannedTransfers.userId, userId));
    }
  }

  async createPlannedTransfer(transfer: InsertPlannedTransfer): Promise<PlannedTransfer> {
    const userDb = getUserDatabase(transfer.userId);
    const result = await userDb.insert(plannedTransfers).values(transfer).returning();
    return result[0];
  }

  async updatePlannedTransfer(id: string, transfer: Partial<InsertPlannedTransfer>): Promise<PlannedTransfer | undefined> {
    const found = await findRecordByIdAcrossDatabases<PlannedTransfer>(plannedTransfers, id);
    if (!found) return undefined;
    
    const userDb = getUserDatabase(found.userId);
    const result = await userDb.update(plannedTransfers)
      .set(transfer)
      .where(eq(plannedTransfers.id, id))
      .returning();
    return result[0];
  }

  async deletePlannedTransfer(id: string): Promise<void> {
    const found = await findRecordByIdAcrossDatabases<PlannedTransfer>(plannedTransfers, id);
    if (!found) return;
    
    const userDb = getUserDatabase(found.userId);
    await userDb.delete(plannedTransfers).where(eq(plannedTransfers.id, id));
  }

  async updateFaktisktKontosaldo(userId: string, monthKey: string, accountId: string, faktisktKontosaldo: number | null): Promise<MonthlyAccountBalance | undefined> {
    console.log(`🔍 updateFaktisktKontosaldo called: userId=${userId}, monthKey=${monthKey}, accountId=${accountId}, value=${faktisktKontosaldo}`);
    const existing = await this.getMonthlyAccountBalance(userId, monthKey, accountId);
    
    console.log(`🔍 Existing record:`, existing ? { id: existing.id, currentFaktiskt: existing.faktisktKontosaldo } : 'NOT FOUND');
    
    if (existing) {
      console.log(`🔍 Updating existing record ${existing.id} with faktisktKontosaldo: ${faktisktKontosaldo}`);
      const userDb = getUserDatabase(userId);
      const result = await userDb.update(monthlyAccountBalances)
        .set({ 
          faktisktKontosaldo: faktisktKontosaldo,
          updatedAt: new Date()
        })
        .where(eq(monthlyAccountBalances.id, existing.id))
        .returning();
      console.log(`✅ Update successful, new value:`, result[0]?.faktisktKontosaldo);
      return result[0];
    } else {
      console.log(`❌ No existing monthly balance record found for accountId=${accountId}, monthKey=${monthKey}. Creating one...`);
      // Create a new record if none exists
      const newRecord = {
        userId,
        monthKey,
        accountId,
        calculatedBalance: 0, // Default value
        faktisktKontosaldo: faktisktKontosaldo,
        bankensKontosaldo: null
      };
      console.log(`🔍 Creating new record:`, newRecord);
      const userDb = getUserDatabase(userId);
      const result = await userDb.insert(monthlyAccountBalances).values(newRecord).returning();
      console.log(`✅ Created new record:`, result[0]);
      return result[0];
    }
  }

  async updateBankensKontosaldo(userId: string, monthKey: string, accountId: string, bankensKontosaldo: number | null): Promise<MonthlyAccountBalance | undefined> {
    const existing = await this.getMonthlyAccountBalance(userId, monthKey, accountId);
    
    if (existing) {
      const userDb = getUserDatabase(userId);
      const result = await userDb.update(monthlyAccountBalances)
        .set({ 
          bankensKontosaldo: bankensKontosaldo,
          updatedAt: new Date()
        })
        .where(eq(monthlyAccountBalances.id, existing.id))
        .returning();
      return result[0];
    }
    
    return undefined;
  }

  async deleteMonthlyAccountBalance(userId: string, monthKey: string, accountId: string): Promise<boolean> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.delete(monthlyAccountBalances)
      .where(
        and(
          eq(monthlyAccountBalances.userId, userId),
          eq(monthlyAccountBalances.monthKey, monthKey),
          eq(monthlyAccountBalances.accountId, accountId)
        )
      )
      .returning();
    return result.length > 0;
  }

  // User settings methods
  async getUserSettings(userId: string): Promise<UserSetting[]> {
    const userDb = getUserDatabase(userId);
    return await userDb.select().from(userSettings).where(eq(userSettings.userId, userId));
  }

  async getUserSetting(userId: string, settingKey: string): Promise<UserSetting | undefined> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.select().from(userSettings)
      .where(and(
        eq(userSettings.userId, userId),
        eq(userSettings.settingKey, settingKey)
      ));
    return result[0];
  }

  async createUserSetting(setting: InsertUserSetting): Promise<UserSetting> {
    const userDb = getUserDatabase(setting.userId);
    const result = await userDb.insert(userSettings).values({
      ...setting,
      updatedAt: new Date()
    }).returning();
    return result[0];
  }

  async updateUserSetting(userId: string, settingKey: string, settingValue: string): Promise<UserSetting | undefined> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.update(userSettings)
      .set({
        settingValue,
        updatedAt: new Date()
      })
      .where(and(
        eq(userSettings.userId, userId),
        eq(userSettings.settingKey, settingKey)
      ))
      .returning();
    return result[0];
  }

  async upsertUserSetting(userId: string, settingKey: string, settingValue: string): Promise<UserSetting> {
    const existing = await this.getUserSetting(userId, settingKey);
    
    if (existing) {
      return await this.updateUserSetting(userId, settingKey, settingValue) as UserSetting;
    } else {
      return await this.createUserSetting({
        userId,
        settingKey,
        settingValue
      });
    }
  }

  async deleteUserSetting(userId: string, settingKey: string): Promise<boolean> {
    const userDb = getUserDatabase(userId);
    const result = await userDb.delete(userSettings)
      .where(and(
        eq(userSettings.userId, userId),
        eq(userSettings.settingKey, settingKey)
      ))
      .returning();
    return result.length > 0;
  }
}