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
  type InsertMonthlyBudget
} from "@shared/schema";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Bootstrap method
  async bootstrap(userId: string): Promise<{
    accounts: Account[];
    familyMembers: FamilyMember[];
    huvudkategorier: Huvudkategori[];
    underkategorier: Underkategori[];
    categoryRules: CategoryRule[];
    transactions: Transaction[];
    monthlyBudgets: MonthlyBudget[];
  }> {
    const [accountsResult, familyMembersResult, huvudkategorierResult, underkategorierResult, categoryRulesResult, transactionsResult, monthlyBudgetsResult] = await Promise.all([
      this.getAccounts(userId),
      this.getFamilyMembers(userId),
      this.getHuvudkategorier(userId),
      this.getUnderkategorier(userId),
      this.getCategoryRules(userId),
      this.getTransactions(userId),
      this.getMonthlyBudgets(userId)
    ]);

    return {
      accounts: accountsResult,
      familyMembers: familyMembersResult,
      huvudkategorier: huvudkategorierResult,
      underkategorier: underkategorierResult,
      categoryRules: categoryRulesResult,
      transactions: transactionsResult,
      monthlyBudgets: monthlyBudgetsResult,
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
}