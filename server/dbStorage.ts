import { db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  users,
  familyMembers,
  accounts,
  huvudkategorier,
  underkategorier,
  categoryRules,
  transactions,
  monthlyBudgets,
  monthlyAccountBalances,
  banks,
  bankCsvMappings,
  type User,
  type InsertUser,
  type FamilyMember,
  type InsertFamilyMember,
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
  type InsertMonthlyAccountBalance
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
    const [accountsResult, huvudkategorierResult, underkategorierResult, categoryRulesResult, transactionsResult, monthlyBudgetsResult, banksResult, bankCsvMappingsResult] = await Promise.all([
      this.getAccounts(userId),
      this.getHuvudkategorier(userId),
      this.getUnderkategorier(userId),
      this.getCategoryRules(userId),
      this.getTransactions(userId),
      this.getMonthlyBudgets(userId),
      this.getBanks(userId),
      this.getBankCsvMappings(userId)
    ]);

    return {
      accounts: accountsResult,
      huvudkategorier: huvudkategorierResult,
      underkategorier: underkategorierResult,
      categoryRules: categoryRulesResult,
      transactions: transactionsResult,
      budgetPosts: [], // Not implemented yet
      monthlyBudgets: monthlyBudgetsResult,
      banks: banksResult,
      bankCsvMappings: bankCsvMappingsResult,
    };
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Family member methods
  async getFamilyMembers(userId: string): Promise<FamilyMember[]> {
    return await db.select().from(familyMembers).where(eq(familyMembers.userId, userId));
  }

  async getFamilyMember(id: string): Promise<FamilyMember | undefined> {
    const result = await db.select().from(familyMembers).where(eq(familyMembers.id, id));
    return result[0];
  }

  async createFamilyMember(member: InsertFamilyMember): Promise<FamilyMember> {
    const result = await db.insert(familyMembers).values(member).returning();
    return result[0];
  }

  async updateFamilyMember(id: string, member: Partial<InsertFamilyMember>): Promise<FamilyMember | undefined> {
    const result = await db.update(familyMembers)
      .set(member)
      .where(eq(familyMembers.id, id))
      .returning();
    return result[0];
  }

  async deleteFamilyMember(id: string): Promise<boolean> {
    const result = await db.delete(familyMembers).where(eq(familyMembers.id, id)).returning();
    return result.length > 0;
  }

  // Account methods
  async getAccounts(userId: string): Promise<Account[]> {
    console.log('Getting accounts for userId:', userId);
    const result = await db.select().from(accounts).where(eq(accounts.userId, userId));
    console.log('Found accounts:', result);
    return result;
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const result = await db.select().from(accounts).where(eq(accounts.id, id));
    return result[0];
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const result = await db.insert(accounts).values(account).returning();
    return result[0];
  }

  async updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account | undefined> {
    const result = await db.update(accounts)
      .set(account)
      .where(eq(accounts.id, id))
      .returning();
    return result[0];
  }

  async deleteAccount(id: string): Promise<boolean> {
    const result = await db.delete(accounts).where(eq(accounts.id, id)).returning();
    return result.length > 0;
  }

  // Huvudkategori methods
  async getHuvudkategorier(userId: string): Promise<Huvudkategori[]> {
    return await db.select().from(huvudkategorier).where(eq(huvudkategorier.userId, userId));
  }

  async getHuvudkategori(id: string): Promise<Huvudkategori | undefined> {
    const result = await db.select().from(huvudkategorier).where(eq(huvudkategorier.id, id));
    return result[0];
  }

  async createHuvudkategori(kategori: InsertHuvudkategori): Promise<Huvudkategori> {
    const result = await db.insert(huvudkategorier).values(kategori).returning();
    return result[0];
  }

  async updateHuvudkategori(id: string, kategori: Partial<InsertHuvudkategori>): Promise<Huvudkategori | undefined> {
    const result = await db.update(huvudkategorier)
      .set(kategori)
      .where(eq(huvudkategorier.id, id))
      .returning();
    return result[0];
  }

  async deleteHuvudkategori(id: string): Promise<boolean> {
    const result = await db.delete(huvudkategorier).where(eq(huvudkategorier.id, id)).returning();
    return result.length > 0;
  }

  // Underkategori methods
  async getUnderkategorier(userId: string): Promise<Underkategori[]> {
    return await db.select().from(underkategorier).where(eq(underkategorier.userId, userId));
  }

  async getUnderkategorierByHuvudkategori(huvudkategoriId: string, userId: string): Promise<Underkategori[]> {
    return await db.select()
      .from(underkategorier)
      .where(and(
        eq(underkategorier.huvudkategoriId, huvudkategoriId),
        eq(underkategorier.userId, userId)
      ));
  }

  async getUnderkategori(id: string): Promise<Underkategori | undefined> {
    const result = await db.select().from(underkategorier).where(eq(underkategorier.id, id));
    return result[0];
  }

  async createUnderkategori(kategori: InsertUnderkategori): Promise<Underkategori> {
    const result = await db.insert(underkategorier).values(kategori).returning();
    return result[0];
  }

  async updateUnderkategori(id: string, kategori: Partial<InsertUnderkategori>): Promise<Underkategori | undefined> {
    const result = await db.update(underkategorier)
      .set(kategori)
      .where(eq(underkategorier.id, id))
      .returning();
    return result[0];
  }

  async deleteUnderkategori(id: string): Promise<boolean> {
    const result = await db.delete(underkategorier).where(eq(underkategorier.id, id)).returning();
    return result.length > 0;
  }

  // Category Rules methods
  async getCategoryRules(userId: string): Promise<CategoryRule[]> {
    return await db.select().from(categoryRules).where(eq(categoryRules.userId, userId));
  }

  async getCategoryRule(id: string): Promise<CategoryRule | undefined> {
    const result = await db.select().from(categoryRules).where(eq(categoryRules.id, id));
    return result[0];
  }

  async createCategoryRule(rule: InsertCategoryRule): Promise<CategoryRule> {
    const result = await db.insert(categoryRules).values(rule).returning();
    return result[0];
  }

  async updateCategoryRule(id: string, rule: Partial<InsertCategoryRule>): Promise<CategoryRule | undefined> {
    const result = await db.update(categoryRules)
      .set(rule)
      .where(eq(categoryRules.id, id))
      .returning();
    return result[0];
  }

  async deleteCategoryRule(id: string): Promise<boolean> {
    const result = await db.delete(categoryRules).where(eq(categoryRules.id, id)).returning();
    return result.length > 0;
  }

  // Transaction methods
  async getTransactions(userId: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.userId, userId));
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id));
    return result[0];
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values(transaction).returning();
    return result[0];
  }

  async updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const result = await db.update(transactions)
      .set(transaction)
      .where(eq(transactions.id, id))
      .returning();
    return result[0];
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const result = await db.delete(transactions).where(eq(transactions.id, id)).returning();
    return result.length > 0;
  }

  // NEW: Get transactions within a date range for synchronization
  async getTransactionsInDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    console.log(`Getting transactions for userId: ${userId} between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    const result = await db
      .select()
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

  // Monthly Budget methods
  async getMonthlyBudgets(userId: string): Promise<MonthlyBudget[]> {
    return await db.select().from(monthlyBudgets).where(eq(monthlyBudgets.userId, userId));
  }

  async getMonthlyBudget(userId: string, monthKey: string): Promise<MonthlyBudget | undefined> {
    const result = await db.select().from(monthlyBudgets)
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.monthKey, monthKey)));
    return result[0];
  }

  async createMonthlyBudget(budget: InsertMonthlyBudget): Promise<MonthlyBudget> {
    const result = await db.insert(monthlyBudgets).values(budget).returning();
    return result[0];
  }

  async updateMonthlyBudget(userId: string, monthKey: string, budget: Partial<InsertMonthlyBudget>): Promise<MonthlyBudget | undefined> {
    const result = await db.update(monthlyBudgets)
      .set({
        ...budget,
        updatedAt: new Date()
      })
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.monthKey, monthKey)))
      .returning();
    return result[0];
  }

  async deleteMonthlyBudget(userId: string, monthKey: string): Promise<boolean> {
    const result = await db.delete(monthlyBudgets)
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.monthKey, monthKey)))
      .returning();
    return result.length > 0;
  }

  // Bank methods
  async getBanks(userId: string): Promise<Bank[]> {
    return await db.select().from(banks).where(eq(banks.userId, userId));
  }

  async getBank(id: string): Promise<Bank | undefined> {
    const result = await db.select().from(banks).where(eq(banks.id, id));
    return result[0];
  }

  async createBank(insertBank: InsertBank): Promise<Bank> {
    const result = await db.insert(banks).values(insertBank).returning();
    return result[0];
  }

  async updateBank(id: string, updateBank: Partial<InsertBank>): Promise<Bank | undefined> {
    const result = await db.update(banks)
      .set(updateBank)
      .where(eq(banks.id, id))
      .returning();
    return result[0];
  }

  async deleteBank(id: string): Promise<boolean> {
    const result = await db.delete(banks).where(eq(banks.id, id)).returning();
    return result.length > 0;
  }

  // Bank CSV Mapping methods
  async getBankCsvMappings(userId: string): Promise<BankCsvMapping[]> {
    return await db.select().from(bankCsvMappings).where(eq(bankCsvMappings.userId, userId));
  }

  async getBankCsvMappingsByBank(userId: string, bankId: string): Promise<BankCsvMapping[]> {
    return await db.select().from(bankCsvMappings)
      .where(and(eq(bankCsvMappings.userId, userId), eq(bankCsvMappings.bankId, bankId)));
  }

  async getBankCsvMapping(id: string): Promise<BankCsvMapping | undefined> {
    const result = await db.select().from(bankCsvMappings).where(eq(bankCsvMappings.id, id));
    return result[0];
  }

  async createBankCsvMapping(insertMapping: InsertBankCsvMapping): Promise<BankCsvMapping> {
    const result = await db.insert(bankCsvMappings).values(insertMapping).returning();
    return result[0];
  }

  async updateBankCsvMapping(id: string, updateMapping: Partial<InsertBankCsvMapping>): Promise<BankCsvMapping | undefined> {
    const result = await db.update(bankCsvMappings)
      .set(updateMapping)
      .where(eq(bankCsvMappings.id, id))
      .returning();
    return result[0];
  }

  async deleteBankCsvMapping(id: string): Promise<boolean> {
    const result = await db.delete(bankCsvMappings).where(eq(bankCsvMappings.id, id)).returning();
    return result.length > 0;
  }

  // Stub methods for BudgetPost - not implemented yet
  async getBudgetPosts(): Promise<any[]> {
    return [];
  }

  async getBudgetPost(): Promise<any> {
    return undefined;
  }

  async createBudgetPost(): Promise<any> {
    throw new Error("Not implemented");
  }

  async updateBudgetPost(): Promise<any> {
    return undefined;
  }

  async deleteBudgetPost(): Promise<boolean> {
    return false;
  }

  // Monthly Account Balances - stores calculated balances per month
  async getMonthlyAccountBalances(userId: string, monthKey?: string): Promise<MonthlyAccountBalance[]> {
    let query = db.select().from(monthlyAccountBalances).where(eq(monthlyAccountBalances.userId, userId));
    
    if (monthKey) {
      query = query.where(eq(monthlyAccountBalances.monthKey, monthKey));
    }
    
    return await query;
  }

  async getMonthlyAccountBalance(userId: string, monthKey: string, accountId: string): Promise<MonthlyAccountBalance | undefined> {
    const result = await db.select()
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
    
    if (existing) {
      const result = await db.update(monthlyAccountBalances)
        .set({ 
          calculatedBalance: balance.calculatedBalance,
          updatedAt: new Date()
        })
        .where(eq(monthlyAccountBalances.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(monthlyAccountBalances).values(balance).returning();
      return result[0];
    }
  }

  async deleteMonthlyAccountBalance(userId: string, monthKey: string, accountId: string): Promise<boolean> {
    const result = await db.delete(monthlyAccountBalances)
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
}